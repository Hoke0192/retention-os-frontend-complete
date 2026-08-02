import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createDemoData, initialActions, metadata as demoMetadata } from '../data/demoData'
import { aggregate, buildMetrics, qualityCheck, scoreEmployee } from '../lib/analytics'

const ProductContext = createContext(null)
const STORAGE_KEY = 'retention-os-complete-frontend-v1'
const SMALL_SAMPLE_THRESHOLD = 10

const roleDefinitions = {
  hr_lead: { label: '企业HR负责人', scope: '全企业', userId: 'U-HR-001', canViewIndividuals: true, canExport: true, canAdmin: false, canManageData: true },
  hrbp: { label: 'HRBP', scope: '数字科技中心', userId: 'U-HRBP-017', canViewIndividuals: true, canExport: false, canAdmin: false, canManageData: false },
  manager: { label: '业务经理', scope: '数据产品团队', userId: 'U-MGR-031', canViewIndividuals: false, canExport: false, canAdmin: false, canManageData: false },
  admin: { label: '系统管理员', scope: '系统元数据', userId: 'U-ADM-001', canViewIndividuals: false, canExport: false, canAdmin: true, canManageData: true },
}

const publicRoles = Object.fromEntries(Object.entries(roleDefinitions).map(([key, value]) => [key, {
  label: value.label,
  scope: value.scope,
  canViewIndividuals: value.canViewIndividuals,
  canExport: value.canExport,
  canAdmin: value.canAdmin,
  canManageData: value.canManageData,
}]))

function freshStore() {
  const demo = createDemoData()
  return {
    records: demo.current,
    training: demo.training,
    history: demo.history,
    metrics: demo.metrics,
    metadata: { ...demoMetadata },
    actions: initialActions.map((item) => ({ ...item })),
    reviews: {},
    audits: [{ time: '2026-07-24 13:42', actor: '系统', action: '载入标准数据', object: demoMetadata.datasetId, result: '成功' }],
    batches: [{
      id: demoMetadata.datasetId,
      filename: 'retention_demo_bundle.xlsx',
      dataRole: 'current_scoring',
      status: 'ready',
      rowCount: demo.current.length,
      timeStart: demoMetadata.cutoffDate,
      timeEnd: demoMetadata.cutoffDate,
      createdAt: demoMetadata.generatedAt,
      mappingVersion: 'MAP-03',
      issueCount: 0,
      blockerCount: 0,
      source: '标准数据',
    }],
    tasks: [],
  }
}

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (parsed?.records?.length && parsed?.metadata) return parsed
  } catch { /* 使用标准初始状态 */ }
  return freshStore()
}

function scopedRows(records, role, department) {
  let rows = records
  if (role === 'hrbp') rows = rows.filter((row) => row.department === '数字科技中心')
  if (role === 'manager') rows = rows.filter((row) => row.team === '数据产品')
  if (role === 'admin') rows = []
  if (department && department !== '全部组织') rows = rows.filter((row) => row.department === department)
  return rows
}

function summarizeRisk(rows, reviews) {
  if (rows.length < SMALL_SAMPLE_THRESHOLD) return { suppressed: true, total: null, scorable: null, low: null, medium: null, high: null, unscorable: null, criticalHigh: null, pendingReview: null }
  const scorable = rows.filter((row) => row.band !== 'unscorable')
  const highRows = scorable.filter((row) => row.band === 'high')
  const medium = scorable.filter((row) => row.band === 'medium').length
  return {
    suppressed: false,
    total: rows.length,
    scorable: scorable.length,
    low: scorable.length - highRows.length - medium,
    medium,
    high: highRows.length,
    unscorable: rows.length - scorable.length,
    criticalHigh: highRows.filter((row) => row.critical_role === true).length,
    pendingReview: highRows.filter((row) => !reviews[row.employee_id]).length,
  }
}

function summarizeDrivers(rows) {
  if (rows.length < SMALL_SAMPLE_THRESHOLD) return []
  const drivers = new Map()
  rows.forEach((row) => row.drivers?.forEach((driver) => {
    const current = drivers.get(driver.key) || { key: driver.key, label: driver.label, direction: driver.direction, contribution: 0, cases: 0 }
    current.contribution += Math.abs(driver.contribution)
    current.cases += 1
    drivers.set(driver.key, current)
  }))
  return [...drivers.values()]
    .map((item) => ({ ...item, contribution: item.contribution / Math.max(1, item.cases) }))
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 6)
}

function explainQuality(rows) {
  if (rows.length < SMALL_SAMPLE_THRESHOLD) return { suppressed: true, coverage: null, comparable: null, stability: null, status: 'protected', limitation: '当前范围人数不足，不计算解释覆盖率或稳定性。' }
  const scorable = rows.filter((row) => row.band !== 'unscorable')
  const explained = scorable.filter((row) => row.drivers?.length)
  const comparable = explained.filter((row) => row.previous_drivers?.length)
  const stable = comparable.filter((row) => row.drivers[0]?.key === row.previous_drivers[0]?.key)
  const stability = comparable.length ? stable.length / comparable.length : null
  return {
    suppressed: false,
    coverage: explained.length / Math.max(1, scorable.length),
    comparable: comparable.length,
    stability,
    status: stability == null ? 'unavailable' : stability >= 0.7 ? 'stable' : 'unstable',
    limitation: stability == null ? '当前数据缺少可对齐的上一快照个体解释；稳定性不可计算。' : stability >= 0.7 ? '主要解释在可比快照间相对稳定，仍不代表因果关系。' : '主要解释在可比快照间变化较大，应先补充证据。',
  }
}

function actionVisible(action, role, department, records) {
  if (role === 'admin') return false
  if (role === 'hrbp' && !String(action.scope).includes('数字科技中心')) return false
  if (role === 'manager' && !String(action.scope).includes('数据产品')) return false
  if (department && department !== '全部组织') {
    if (action.employeeId) return records.some((row) => row.employee_id === action.employeeId && row.department === department)
    return String(action.scope).includes(department)
  }
  return true
}

function nowId(prefix) {
  return `${prefix}-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
}

export function ProductProvider({ children }) {
  const [store, setStore] = useState(loadStore)
  const [role, setRoleState] = useState('hr_lead')
  const [department, setDepartmentState] = useState('全部组织')
  const [qualityIssues, setQualityIssues] = useState([])
  const [batchState, setBatchState] = useState('ready')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch { /* 浏览器空间不足时仍保持本次会话 */ }
  }, [store])

  const notify = useCallback((message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const currentRole = useMemo(() => ({ role, ...roleDefinitions[role] }), [role])
  const baseRows = useMemo(() => scopedRows(store.records, role, '全部组织'), [store.records, role])
  const allowedDepartments = useMemo(() => [...new Set(baseRows.map((row) => row.department))], [baseRows])
  const rows = useMemo(() => scopedRows(store.records, role, department), [store.records, role, department])
  const riskSummary = useMemo(() => summarizeRisk(rows, store.reviews), [rows, store.reviews])
  const canReturnIndividuals = currentRole.canViewIndividuals && !riskSummary.suppressed
  const accessibleRecords = canReturnIndividuals ? rows : []
  const aggregates = useMemo(() => aggregate(rows), [rows])
  const driverSummary = useMemo(() => summarizeDrivers(rows), [rows])
  const explanationQuality = useMemo(() => explainQuality(rows), [rows])
  const actions = useMemo(() => store.actions.filter((action) => actionVisible(action, role, department, store.records)), [store.actions, role, department, store.records])
  const reviews = useMemo(() => Object.fromEntries(Object.entries(store.reviews).filter(([id]) => accessibleRecords.some((row) => row.employee_id === id))), [store.reviews, accessibleRecords])
  const history = useMemo(() => {
    if (riskSummary.suppressed || role === 'manager' || role === 'admin') return []
    if (role === 'hrbp') return store.history.filter((row) => row.department === '数字科技中心')
    return store.history
  }, [store.history, riskSummary.suppressed, role])

  const setRole = useCallback(async (nextRole) => {
    if (!roleDefinitions[nextRole]) throw new Error('未知角色')
    setRoleState(nextRole)
    setDepartmentState('全部组织')
    notify(`已切换为${roleDefinitions[nextRole].label}`)
  }, [notify])

  const setDepartment = useCallback(async (nextDepartment) => {
    setDepartmentState(nextDepartment)
    notify(nextDepartment === '全部组织' ? '已返回全部组织' : `已下钻至${nextDepartment}`)
    return true
  }, [notify])

  const loadRows = useCallback(async (inputRows, source = '上传文件', options = {}) => {
    const dataRole = options.dataRole || 'current_scoring'
    const issues = qualityCheck(inputRows, dataRole === 'training_data' ? 'training' : 'scoring')
    const blockers = issues.filter((issue) => issue.severity === 'block')
    const accepted = blockers.length === 0
    const dates = inputRows.map((row) => row.snapshot_date).filter(Boolean).sort()
    const batch = {
      id: nowId('DS'), filename: source, dataRole, status: accepted ? 'ready' : 'blocked', rowCount: inputRows.length,
      timeStart: dates[0] || null, timeEnd: dates.at(-1) || null, createdAt: new Date().toISOString(), mappingVersion: 'MAP-04',
      issueCount: issues.length, blockerCount: blockers.length, source: '用户上传',
    }
    setQualityIssues(issues)
    setBatchState(accepted ? 'ready' : 'blocked')
    setStore((current) => {
      const task = { id: nowId('TASK'), type: 'quality', batchId: batch.id, status: accepted ? 'completed' : 'failed', retryable: true, attempts: 1, createdAt: batch.createdAt, updatedAt: batch.createdAt, error: accepted ? null : `${blockers.length}个阻断问题` }
      const next = { ...current, batches: [batch, ...current.batches].slice(0, 8), tasks: [task, ...current.tasks].slice(0, 30) }
      if (!accepted) return next
      if (dataRole === 'training_data') {
        const training = inputRows.map((row) => ({ ...scoreEmployee(row), label: ['1', 'true', 1, true].includes(row.label_voluntary_exit_90d) ? 1 : 0 }))
        return { ...next, training, metrics: buildMetrics(training) }
      }
      return {
        ...next,
        records: inputRows.map(scoreEmployee),
        metadata: { ...current.metadata, datasetId: batch.id, cutoffDate: batch.timeEnd || current.metadata.cutoffDate, generatedAt: batch.createdAt },
        tasks: [{ id: nowId('TASK'), type: 'risk', batchId: batch.id, status: 'completed', retryable: true, attempts: 1, createdAt: batch.createdAt, updatedAt: batch.createdAt, error: null }, task, ...current.tasks].slice(0, 30),
      }
    })
    notify(accepted ? `已完成${inputRows.length}条记录的质量检查与风险更新` : `发现${blockers.length}个阻断问题，请修复后重试`, accepted ? 'success' : 'warning')
    return { batch, issues, accepted }
  }, [notify])

  const retryBatch = useCallback(async (batchId) => {
    const batch = store.batches.find((item) => item.id === batchId)
    if (!batch) throw new Error('未找到原批次')
    notify(batch.status === 'ready' ? '该批次已完成，无需重复处理' : '请修复源文件后重新上传', batch.status === 'ready' ? 'success' : 'warning')
    return { batch, issues: qualityIssues, accepted: batch.status === 'ready' }
  }, [notify, qualityIssues, store.batches])

  const retryTask = useCallback(async (taskId) => {
    const task = store.tasks.find((item) => item.id === taskId)
    if (!task) throw new Error('未找到原任务')
    notify(task.status === 'completed' ? '该任务已经完成' : '请回到对应数据批次修复问题', task.status === 'completed' ? 'success' : 'warning')
    return task
  }, [notify, store.tasks])

  const restoreDemo = useCallback(async () => {
    const next = freshStore()
    setStore(next)
    setDepartmentState('全部组织')
    setQualityIssues([])
    setBatchState('ready')
    notify('标准数据与业务状态已恢复')
    return next
  }, [notify])

  const reviewCase = useCallback(async (employeeId, status, reason) => {
    const review = { employeeId, status, reason, reviewer: `${currentRole.label} / ${currentRole.userId}`, time: new Date().toISOString() }
    setStore((current) => ({ ...current, reviews: { ...current.reviews, [employeeId]: review }, audits: [{ time: review.time, actor: review.reviewer, action: '完成人工复核', object: employeeId, result: status }, ...current.audits].slice(0, 100) }))
    notify('复核结论已保存，并记录责任人与时间')
    return review
  }, [currentRole, notify])

  const createAction = useCallback(async (payload) => {
    const action = { id: nowId('ACT'), status: 'draft', progress: 0, result: '', tasks: 4, done: 0, ...payload }
    setStore((current) => ({ ...current, actions: [action, ...current.actions], audits: [{ time: new Date().toISOString(), actor: `${currentRole.label} / ${currentRole.userId}`, action: '创建行动计划', object: action.id, result: '草稿' }, ...current.audits].slice(0, 100) }))
    notify('行动草稿已保存，可继续分派与启动')
    return action
  }, [currentRole, notify])

  const updateAction = useCallback(async (id, patch) => {
    const currentAction = store.actions.find((item) => item.id === id)
    if (!currentAction) throw new Error('未找到行动计划')
    const updated = { ...currentAction, ...patch }
    setStore((current) => ({ ...current, actions: current.actions.map((item) => item.id === id ? { ...item, ...patch } : item) }))
    notify('行动状态与任务进度已保存')
    return updated
  }, [notify, store.actions])

  const askAssistant = useCallback(async (question) => {
    if (riskSummary.suppressed) return { suppressed: true, text: '当前范围人数不足，系统不返回精确人数、比例、排名或可反推信息。请合并至更高组织层级后继续分析。', citations: [{ label: '组织洞察', path: '#/insights' }], scope: currentRole.scope, mode: 'evidence-template' }
    const top = aggregates.find((item) => !item.suppressed)
    const drivers = driverSummary.slice(0, 3).map((item) => item.label).join('、')
    let text = `${top?.name || '当前组织'}的高风险信号相对突出，建议优先核验${drivers || '工作负荷、发展与团队环境'}，再由授权人员决定支持性行动。`
    if (question.includes('限制') || question.includes('数据')) text = `当前数据截止${store.metadata.cutoffDate}，预测窗口为${store.metadata.predictionWindow}；不可评分记录与少于10人的细分组织会被单独保护。`
    if (question.includes('数字科技')) text = `数字科技中心的主要信号集中在持续工作负荷、发展停滞与团队流失传导。该解释用于提出复核问题，不代表真实离职原因。`
    return { suppressed: false, text, citations: [{ label: '组织洞察', path: '#/insights' }], scope: currentRole.scope, mode: 'evidence-template' }
  }, [aggregates, currentRole.scope, driverSummary, riskSummary.suppressed, store.metadata])

  const createReportSnapshot = useCallback(async (options = {}) => ({
    id: options.reportId || nowId('RPT'), scope: department === '全部组织' ? currentRole.scope : department,
    summary: options.narrativeSummary, records: accessibleRecords, aggregates, actions, metadata: store.metadata, riskSummary, driverSummary,
  }), [accessibleRecords, actions, aggregates, currentRole.scope, department, driverSummary, riskSummary, store.metadata])

  const updateReportTask = useCallback(async (reportId, status, error = null) => {
    const task = { id: nowId('TASK'), type: 'report', reportId, status, error, retryable: status === 'failed', attempts: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    setStore((current) => ({ ...current, tasks: [task, ...current.tasks].slice(0, 30) }))
    return task
  }, [])

  const refresh = useCallback(async () => true, [])
  const audit = useCallback(() => {}, [])
  const value = useMemo(() => ({
    ready: true, records: accessibleRecords, training: store.training, history, metrics: store.metrics, accessibleRecords,
    aggregates, riskSummary, driverSummary, explanationQuality, role, roles: publicRoles, currentRole, setRole,
    department, setDepartment, allowedDepartments, qualityIssues, setQualityIssues, batchState, setBatchState,
    batches: currentRole.canManageData ? store.batches : [], tasks: currentRole.canManageData ? store.tasks : [], actions, reviews,
    audits: currentRole.canAdmin || role === 'hr_lead' ? store.audits : [], toast, metadata: store.metadata,
    loadRows, retryBatch, retryTask, restoreDemo, reviewCase, createAction, updateAction, askAssistant,
    createReportSnapshot, updateReportTask, refresh, audit, notify,
  }), [accessibleRecords, actions, aggregates, allowedDepartments, askAssistant, batchState, createAction, createReportSnapshot, currentRole, department, driverSummary, explanationQuality, history, loadRows, notify, qualityIssues, restoreDemo, retryBatch, retryTask, reviewCase, reviews, riskSummary, role, setDepartment, setRole, store, toast, updateAction, updateReportTask, refresh, audit])

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
}

export const useProduct = () => {
  const context = useContext(ProductContext)
  if (!context) throw new Error('useProduct must be used inside ProductProvider')
  return context
}
