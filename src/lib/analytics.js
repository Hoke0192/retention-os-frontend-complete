export const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

export const sigmoid = (value) => 1 / (1 + Math.exp(-value))

export const monthDiff = (from, to) => {
  const start = new Date(from)
  const end = new Date(to)
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth())
}

export const riskThresholdConfig = { version: 'THR-1.2', lowMax: 0.3, highMin: 0.6 }

export const riskBand = (score, scorable = true, thresholds = riskThresholdConfig) => {
  if (!scorable || score == null || Number.isNaN(score)) return 'unscorable'
  if (score >= thresholds.highMin) return 'high'
  if (score >= thresholds.lowMax) return 'medium'
  return 'low'
}

export function deriveVoluntaryExitLabel({ snapshotDate, terminationDate, terminationType, observationEndDate, employmentStatus }) {
  if (String(employmentStatus).toLowerCase() !== 'active') return null
  const snapshot = new Date(`${snapshotDate}T00:00:00Z`)
  const windowEnd = new Date(snapshot)
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 90)
  const termination = terminationDate ? new Date(`${terminationDate}T00:00:00Z`) : null
  if (termination && termination > snapshot && termination <= windowEnd && terminationType === 'voluntary') return true
  if (termination && termination > snapshot && termination <= windowEnd && terminationType !== 'voluntary') return null
  const observationEnd = observationEndDate ? new Date(`${observationEndDate}T00:00:00Z`) : null
  if (!observationEnd || observationEnd < windowEnd) return null
  return false
}

export const bandLabel = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
  unscorable: '不可评分',
}

export const reviewLabel = {
  pending: '待复核',
  confirmed: '已确认',
  rejected: '已驳回',
  deferred: '暂缓',
  actioned: '已转行动',
  closed: '已关闭',
}

export const actionStatusLabel = {
  draft: '草稿',
  active: '进行中',
  blocked: '阻塞',
  completed: '已完成',
  cancelled: '已取消',
}

const featureDefs = [
  { key: 'engagement_score', label: '敬业度下降', direction: 'up', value: (r) => clamp((72 - Number(r.engagement_score || 72)) / 42), weight: 1.25, evidence: (r) => `当前敬业度 ${r.engagement_score ?? '缺失'} / 100` },
  { key: 'overtime_hours_3m', label: '持续工作负荷', direction: 'up', value: (r) => clamp((Number(r.overtime_hours_3m || 0) - 12) / 58), weight: 0.9, evidence: (r) => `近3个月加班 ${r.overtime_hours_3m ?? 0} 小时` },
  { key: 'compa_ratio', label: '薪酬带宽位置偏低', direction: 'up', value: (r) => clamp((1 - Number(r.compa_ratio || 1)) / 0.35), weight: 0.75, evidence: (r) => `薪酬带宽比 ${Number(r.compa_ratio || 1).toFixed(2)}` },
  { key: 'months_since_promotion', label: '发展停滞', direction: 'up', value: (r) => clamp((Number(r.months_since_promotion || 0) - 12) / 48), weight: 0.8, evidence: (r) => `${r.months_since_promotion ?? 0} 个月未晋升` },
  { key: 'manager_change_count_12m', label: '经理变更频繁', direction: 'up', value: (r) => clamp(Number(r.manager_change_count_12m || 0) / 3), weight: 0.55, evidence: (r) => `近12个月经理变更 ${r.manager_change_count_12m ?? 0} 次` },
  { key: 'team_turnover_rate_12m', label: '团队流失传导', direction: 'up', value: (r) => clamp((Number(r.team_turnover_rate_12m || 0) - 0.06) / 0.28), weight: 0.7, evidence: (r) => `团队12个月离职率 ${(Number(r.team_turnover_rate_12m || 0) * 100).toFixed(1)}%` },
  { key: 'career_conversation_6m', label: '已完成发展对话', direction: 'down', value: (r) => r.career_conversation_6m === true || String(r.career_conversation_6m).toLowerCase() === 'true' ? 1 : 0, weight: -0.42, evidence: (r) => String(r.career_conversation_6m).toLowerCase() === 'true' ? '近6个月已完成发展对话' : '近6个月无发展对话记录' },
  { key: 'training_hours_12m', label: '学习投入', direction: 'down', value: (r) => clamp(Number(r.training_hours_12m || 0) / 48), weight: -0.28, evidence: (r) => `近12个月学习 ${r.training_hours_12m ?? 0} 小时` },
]

export const requiredScoringFields = ['employee_id', 'snapshot_date', 'employment_status', 'hire_date', 'department', 'job_family']

// The model-input missing-value policy is versioned independently from the scoring formula so a
// missing-field policy change is visible in audits and reproducible by tests.
export const criticalModelFeatures = {
  version: 'CMF-1.0',
  fields: ['engagement_score', 'overtime_hours_3m', 'compa_ratio'],
}

export const modelFeatureFields = Object.freeze(featureDefs.map((feature) => feature.key))
export const smallSampleThreshold = 10

const isBlank = (value) => value == null || (typeof value === 'string' && value.trim() === '')

export function scoreEmployee(record) {
  const missing = requiredScoringFields.filter((field) => isBlank(record[field]))
  const missingModelFeatures = modelFeatureFields.filter((field) => isBlank(record[field]))
  const missingCriticalFeatures = criticalModelFeatures.fields.filter((field) => isBlank(record[field]))
  const missingRatio = missingModelFeatures.length / featureDefs.length
  const scorable = missing.length === 0
    && missingCriticalFeatures.length === 0
    && missingRatio <= 0.5
    && String(record.employment_status).toLowerCase() === 'active'
  if (!scorable) {
    return {
      ...record,
      score: null,
      band: 'unscorable',
      reliability: 'insufficient',
      completeness: 1 - missingRatio,
      missing,
      missingModelFeatures,
      missingCriticalFeatures,
      criticalFeaturePolicyVersion: criticalModelFeatures.version,
      drivers: [],
    }
  }

  const contributions = featureDefs.map((feature) => {
    const normalized = feature.value(record)
    const contribution = normalized * feature.weight
    return { ...feature, normalized, contribution, evidence: feature.evidence(record) }
  })
  const tenure = monthDiff(record.hire_date, record.snapshot_date)
  const newHireEffect = tenure < 9 ? 0.28 : 0
  const logit = -1.65 + contributions.reduce((sum, item) => sum + item.contribution, 0) + newHireEffect
  const score = clamp(sigmoid(logit))
  const completeness = 1 - missingRatio
  const reliability = completeness >= 0.88 ? 'high' : completeness >= 0.65 ? 'medium' : 'low'
  const drivers = [...contributions]
    .filter((item) => Math.abs(item.contribution) > 0.04)
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 4)
    .map(({ key, label, direction, contribution, evidence }) => ({ key, label, direction, contribution, evidence }))
  const criticality = record.critical_role === true || String(record.critical_role).toLowerCase() === 'true' ? 0.95 : 0.5
  const intervenability = clamp(0.78 - 0.18 * Number(record.manager_change_count_12m || 0) / 3 + (String(record.career_conversation_6m).toLowerCase() === 'true' ? -0.05 : 0.12))
  const reliabilityScore = reliability === 'high' ? 1 : reliability === 'medium' ? 0.68 : 0.4
  const priorityScore = Math.round((score * 0.45 + criticality * 0.25 + intervenability * 0.2 + reliabilityScore * 0.1) * 100)

  return {
    ...record,
    score,
    band: riskBand(score),
    reliability,
    completeness,
    priorityScore,
    criticality,
    intervenability,
    missing: [],
    missingModelFeatures,
    missingCriticalFeatures,
    criticalFeaturePolicyVersion: criticalModelFeatures.version,
    drivers,
  }
}

export function aggregate(records, field = 'department') {
  const groups = new Map()
  records.forEach((record) => {
    const key = record[field] || '未分配'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(record)
  })
  return [...groups.entries()].map(([name, rows]) => {
    if (rows.length < smallSampleThreshold) {
      return {
        name,
        total: null,
        scorable: null,
        high: null,
        medium: null,
        low: null,
        unscorable: null,
        highRate: null,
        avgRisk: null,
        critical: null,
        suppressed: true,
        suppressionThreshold: smallSampleThreshold,
        displayCount: `少于${smallSampleThreshold}人`,
      }
    }
    const scorable = rows.filter((row) => row.band !== 'unscorable')
    const high = scorable.filter((row) => row.band === 'high').length
    const medium = scorable.filter((row) => row.band === 'medium').length
    const avgRisk = scorable.length ? scorable.reduce((sum, row) => sum + row.score, 0) / scorable.length : 0
    const critical = scorable.filter((row) => row.critical_role === true).length
    return {
      name,
      total: rows.length,
      scorable: scorable.length,
      high,
      medium,
      low: scorable.length - high - medium,
      unscorable: rows.length - scorable.length,
      highRate: scorable.length ? high / scorable.length : 0,
      avgRisk,
      critical,
      suppressed: false,
      suppressionThreshold: smallSampleThreshold,
    }
  }).sort((a, b) => {
    if (a.suppressed !== b.suppressed) return a.suppressed ? 1 : -1
    if (a.suppressed) return a.name.localeCompare(b.name, 'zh-CN')
    return b.highRate - a.highRate
  })
}

const strictIsoDate = /^\d{4}-\d{2}-\d{2}$/
const allowedEmploymentStatuses = new Set(['active', 'on_leave', 'inactive', 'terminated'])

function parseIsoDate(value) {
  if (typeof value !== 'string' || !strictIsoDate.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}

const addUtcDays = (date, days) => {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function normalizedBinaryLabel(value) {
  if (value === 0 || value === '0' || value === false || String(value).toLowerCase() === 'false') return 0
  if (value === 1 || value === '1' || value === true || String(value).toLowerCase() === 'true') return 1
  return null
}

export function qualityCheck(rows, role = 'scoring', options = {}) {
  const issues = []
  const required = role === 'scoring' ? requiredScoringFields : [...requiredScoringFields, 'label_voluntary_exit_90d']
  required.forEach((field) => {
    if (!rows.length || !Object.prototype.hasOwnProperty.call(rows[0], field)) {
      issues.push({ id: `schema-${field}`, severity: 'block', type: '关键字段缺失', field, row: '整列', message: `缺少规范字段 ${field}`, action: '返回字段映射并补充该字段' })
    }
  })
  const seen = new Map()
  rows.forEach((row, index) => {
    const line = index + 1
    required.forEach((field) => {
      if (isBlank(row[field])) {
        issues.push({ id: `required-${field}-${line}`, severity: 'block', type: '必填值缺失', field, row: line, message: `${field} 为必填值`, action: '补充该行字段值后重新检查' })
      }
    })
    const key = `${row.employee_id || ''}-${row.snapshot_date || ''}`
    if (!isBlank(row.employee_id) && !isBlank(row.snapshot_date)) {
      if (seen.has(key)) issues.push({ id: `duplicate-${line}`, severity: 'block', type: '重复记录', field: 'employee_id + snapshot_date', row: line, message: `与第 ${seen.get(key)} 行业务键重复`, action: '保留一条并记录冲突处理' })
      else seen.set(key, line)
    }

    const dateFields = ['snapshot_date', 'hire_date', 'termination_date', 'observation_end_date']
    dateFields.forEach((field) => {
      if (!isBlank(row[field]) && !parseIsoDate(row[field])) {
        issues.push({ id: `invalid-date-${field}-${line}`, severity: 'block', type: '非法日期', field, row: line, message: `${field} 必须为合法的 YYYY-MM-DD 日期`, action: '修正格式或日历日期后重试' })
      }
    })
    const hireDate = parseIsoDate(row.hire_date)
    const snapshotDate = parseIsoDate(row.snapshot_date)
    if (hireDate && snapshotDate && hireDate > snapshotDate) {
      issues.push({ id: `date-${line}`, severity: 'block', type: '时间穿越', field: 'hire_date', row: line, message: '入职日期晚于快照日期', action: '核对日期格式或更正源数据' })
    }
    if (!isBlank(row.employment_status) && !allowedEmploymentStatuses.has(String(row.employment_status).toLowerCase())) {
      issues.push({ id: `status-${line}`, severity: 'block', type: '未知枚举', field: 'employment_status', row: line, message: `未识别的在职状态 ${row.employment_status}`, action: '映射为 active、on_leave、inactive 或 terminated' })
    }
    const futureFields = Object.keys(row).filter((field) => /^termination_/i.test(field) || /^label_/i.test(field) || field === 'observation_end_date')
    if (role === 'scoring' && futureFields.length) {
      issues.push({ id: `leak-${line}`, severity: 'block', type: '未来信息泄漏', field: futureFields.join(', '), row: line, message: '当前评分数据包含标签、离职结果或观察截止字段', action: '从评分数据集中物理移除该列' })
    }
    if (role === 'training') {
      const label = normalizedBinaryLabel(row.label_voluntary_exit_90d)
      if (isBlank(row.label_voluntary_exit_90d)) {
        issues.push({ id: `label-missing-${line}`, severity: 'block', type: '标签不可用', field: 'label_voluntary_exit_90d', row: line, message: '训练行缺少90天自愿离职标签', action: '完成标签生成后再进入训练' })
      } else if (label == null) {
        issues.push({ id: `label-domain-${line}`, severity: 'block', type: '标签值非法', field: 'label_voluntary_exit_90d', row: line, message: '标签仅允许 0/1 或 true/false', action: '更正标签值并重新生成训练集' })
      }
      const observationEndValue = row.observation_end_date
        ?? row.dataset_metadata?.observation_end_date
        ?? options.observationEndDate
      const observationEnd = parseIsoDate(observationEndValue)
      if (isBlank(observationEndValue)) {
        issues.push({ id: `observation-missing-${line}`, severity: 'block', type: '标签不可用', field: 'observation_end_date', row: line, message: '缺少观察截止日，无法证明90天标签已成熟', action: '在数据集元数据中补充 observation_end_date' })
      } else if (!observationEnd) {
        issues.push({ id: `observation-invalid-${line}`, severity: 'block', type: '非法日期', field: 'observation_end_date', row: line, message: '观察截止日必须为合法的 YYYY-MM-DD 日期', action: '修正数据集元数据' })
      } else if (snapshotDate && observationEnd < addUtcDays(snapshotDate, 90)) {
        issues.push({ id: `observation-immature-${line}`, severity: 'block', type: '标签未成熟', field: 'observation_end_date', row: line, message: '观察期未覆盖快照日后90天', action: '延长观察期或将该快照移出训练集' })
      }
    }
    criticalModelFeatures.fields.filter((field) => isBlank(row[field])).forEach((field) => {
      issues.push({ id: `critical-feature-${field}-${line}`, severity: 'warning', type: '关键模型特征缺失', field, row: line, message: `关键模型特征 ${field} 为空，该行不可评分`, action: '允许导入但将该行标记为不可评分' })
    })
    const missingFeatureRatio = modelFeatureFields.filter((field) => isBlank(row[field])).length / modelFeatureFields.length
    if (missingFeatureRatio > 0.5) {
      issues.push({ id: `feature-coverage-${line}`, severity: 'warning', type: '整体特征缺失超限', field: 'model_features', row: line, message: `模型特征缺失率 ${(missingFeatureRatio * 100).toFixed(1)}%，该行不可评分`, action: '允许导入但将该行标记为不可评分' })
    }
  })
  return issues
}

export function buildExplanationQuality(records, previousRecords = []) {
  const eligible = records.filter((record) => record.band !== 'unscorable')
  const explained = eligible.filter((record) => Array.isArray(record.drivers) && record.drivers.length > 0)
  const previousById = new Map(previousRecords.map((record) => [record.employee_id, record]))
  const comparable = explained.filter((record) => {
    const previous = previousById.get(record.employee_id)
    return previous && Array.isArray(previous.drivers) && previous.drivers.length > 0
  })
  const stable = comparable.filter((record) => {
    const previous = previousById.get(record.employee_id)
    return record.drivers[0]?.key === previous.drivers[0]?.key
  })
  return {
    eligible: eligible.length,
    explained: explained.length,
    coverage: explained.length / Math.max(1, eligible.length),
    comparable: comparable.length,
    stable: stable.length,
    stability: comparable.length ? stable.length / comparable.length : null,
  }
}

export function getAuc(records) {
  const usable = records.filter((record) => (record.label === 0 || record.label === 1) && Number.isFinite(record.score)).sort((a, b) => b.score - a.score)
  const positives = usable.filter((r) => r.label === 1).length
  const negatives = usable.length - positives
  if (!positives || !negatives) return 0
  let tp = 0
  let fp = 0
  let prevTp = 0
  let prevFp = 0
  let auc = 0
  usable.forEach((record) => {
    if (record.label === 1) tp += 1
    else fp += 1
    auc += ((fp - prevFp) / negatives) * ((tp + prevTp) / (2 * positives))
    prevTp = tp
    prevFp = fp
  })
  return auc
}

export function buildMetrics(records) {
  const validationThreshold = 0.6
  const labeled = records.filter((r) => (r.label === 0 || r.label === 1) && Number.isFinite(r.score))
  const tp = labeled.filter((r) => r.label === 1 && r.score >= validationThreshold).length
  const fp = labeled.filter((r) => r.label === 0 && r.score >= validationThreshold).length
  const fn = labeled.filter((r) => r.label === 1 && r.score < validationThreshold).length
  return {
    auc: getAuc(labeled),
    precision: tp / Math.max(1, tp + fp),
    recall: tp / Math.max(1, tp + fn),
    positiveRate: labeled.filter((r) => r.label === 1).length / Math.max(1, labeled.length),
    n: labeled.length,
    validationThreshold,
  }
}

export function simulateAction(records, actionType, coverage) {
  const eligible = records.filter((record) => record.band === 'high' || record.band === 'medium')
  const effects = {
    career: { min: 0.025, max: 0.055, label: '发展与内部流动' },
    workload: { min: 0.018, max: 0.046, label: '工作负荷治理' },
    manager: { min: 0.02, max: 0.05, label: '经理支持提升' },
    reward: { min: 0.015, max: 0.04, label: '认可与回报校准' },
  }
  const effect = effects[actionType] || effects.career
  const scale = coverage / 100
  return {
    eligible: eligible.length,
    covered: Math.round(eligible.length * scale),
    minDelta: effect.min * scale,
    maxDelta: effect.max * scale,
    label: effect.label,
    disclaimer: '基于历史关联和行动覆盖率的情景区间，不代表因果效果或个体结果。',
  }
}

export function formatPercent(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}
