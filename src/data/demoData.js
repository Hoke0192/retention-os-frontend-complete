import { scoreEmployee, buildMetrics } from '../lib/analytics.js'

function seeded(seed = 43) {
  let value = seed % 2147483647
  return () => {
    value = value * 16807 % 2147483647
    return (value - 1) / 2147483646
  }
}

const departments = [
  { name: '常温事业部', teams: ['华东销售', '华北销售', '渠道增长'], base: 0.05 },
  { name: '低温事业部', teams: ['酸奶研发', '供应计划', '华南营销'], base: 0.02 },
  { name: '冰品事业部', teams: ['产品创新', '渠道运营', '西部销售'], base: 0.1 },
  { name: '奶源事业部', teams: ['牧场支持', '质量技术', '采购协同'], base: -0.04 },
  { name: '数字科技中心', teams: ['数据产品', '平台工程', 'AI实验室'], base: 0.13 },
  { name: '新零售孵化组', teams: ['私域增长'], base: 0.16, size: 8 },
]

const jobFamilies = ['销售', '研发', '供应链', '数据技术', '职能']
const locations = ['呼和浩特', '北京', '上海', '武汉', '成都', '广州']

function makeRecord(index, rand, snapshot = '2026-06-30') {
  const department = departments[index % departments.length]
  const team = department.teams[index % department.teams.length]
  const stress = Math.min(1, Math.max(0, rand() * 0.75 + department.base))
  const engagement = Math.round(86 - stress * 48 + rand() * 10)
  const overtime = Math.round(8 + stress * 58 + rand() * 12)
  const compa = Number((1.08 - stress * 0.3 + rand() * 0.08).toFixed(2))
  const monthsPromotion = Math.round(5 + stress * 53 + rand() * 12)
  const managerChanges = stress > 0.66 ? (rand() > 0.46 ? 2 : 1) : (rand() > 0.8 ? 1 : 0)
  const teamTurnover = Number((0.045 + stress * 0.26 + rand() * 0.035).toFixed(3))
  const careerConversation = stress < 0.48 || rand() > 0.7
  const training = Math.round(7 + (1 - stress) * 42 + rand() * 10)
  const year = 2016 + Math.floor(rand() * 9)
  const month = String(1 + Math.floor(rand() * 12)).padStart(2, '0')
  const day = String(1 + Math.floor(rand() * 26)).padStart(2, '0')
  return {
    employee_id: `MN${String(index + 1).padStart(5, '0')}`,
    snapshot_date: snapshot,
    employment_status: index % 89 === 0 ? 'on_leave' : 'active',
    hire_date: `${year}-${month}-${day}`,
    department: department.name,
    team,
    job_family: jobFamilies[index % jobFamilies.length],
    job_level: index % 11 === 0 ? 'M2' : `P${3 + (index % 4)}`,
    location: locations[index % locations.length],
    performance_rating: Number((3.1 + rand() * 1.6).toFixed(1)),
    performance_change: Number((-0.55 + rand() * 0.9).toFixed(1)),
    compa_ratio: compa,
    months_since_promotion: monthsPromotion,
    manager_change_count_12m: managerChanges,
    training_hours_12m: training,
    career_conversation_6m: careerConversation,
    overtime_hours_3m: overtime,
    absence_days_12m: Math.round(rand() * 9),
    engagement_score: index % 47 === 0 ? '' : engagement,
    engagement_survey_date: '2026-05-18',
    engagement_change: Math.round(-stress * 15 + rand() * 8),
    recognition_count_6m: Math.floor(rand() * 4),
    project_load_index: Number((0.75 + stress * 0.9).toFixed(2)),
    team_turnover_rate_12m: teamTurnover,
    critical_role: index % 9 === 0 || (department.name === '数字科技中心' && index % 3 === 0),
    record_updated_at: '2026-07-01T09:30:00+08:00',
  }
}

export function createDemoData(count = 368) {
  const rand = seeded(20260724)
  const current = Array.from({ length: count }, (_, index) => scoreEmployee(makeRecord(index, rand)))
  const trainingRand = seeded(20250630)
  const training = Array.from({ length: 520 }, (_, index) => {
    const scored = scoreEmployee({ ...makeRecord(index, trainingRand, '2025-12-31'), employment_status: 'active' })
    const labelRand = trainingRand()
    return { ...scored, label: labelRand < Math.min(0.75, scored.score * 0.45) ? 1 : 0 }
  })
  const deptAggregates = current.reduce((acc, row) => {
    if (!acc[row.department]) acc[row.department] = []
    acc[row.department].push(row)
    return acc
  }, {})
  const history = ['2026-02-28', '2026-04-30', '2026-06-30'].flatMap((date, dateIndex) =>
    Object.entries(deptAggregates).map(([department, rows], deptIndex) => {
      const currentRisk = rows.filter((r) => r.score != null).reduce((s, r) => s + (r.score || 0), 0) / Math.max(1, rows.filter((r) => r.score != null).length)
      const drift = (dateIndex - 2) * (department === '数字科技中心' ? 0.045 : department === '冰品事业部' ? 0.028 : 0.012)
      return { date, department, avgRisk: Math.max(0.08, currentRisk + drift), highRate: Math.max(0.02, currentRisk * 0.42 + drift), actualTurnover: Math.max(0.015, currentRisk * 0.16 + deptIndex * 0.002) }
    }),
  )
  return { current, training, history, metrics: buildMetrics(training) }
}

export const demoQualityScenarios = [
  { id: 'QA-001', severity: 'block', type: '关键字段缺失', field: 'employee_id', row: 8, message: '员工标识为空', action: '拒绝该行，补充稳定匿名ID' },
  { id: 'QA-002', severity: 'block', type: '重复记录', field: 'employee_id + snapshot_date', row: 16, message: '业务键与第15行重复', action: '解决重复冲突后重新检查' },
  { id: 'QA-003', severity: 'block', type: '时间穿越', field: 'hire_date', row: 21, message: '入职日期晚于快照日期', action: '核对日期格式或修正源数据' },
  { id: 'QA-004', severity: 'warning', type: '解释覆盖降级', field: 'engagement_score', row: 22, message: '敬业度为空', action: '允许导入，显示覆盖率与解释降级' },
  { id: 'QA-005', severity: 'block', type: '未来信息泄漏', field: 'label_voluntary_exit_90d', row: '整列', message: '评分数据出现标签字段', action: '拒绝该列并物理移出特征视图' },
  { id: 'QA-006', severity: 'block', type: '未知枚举', field: 'employment_status', row: 28, message: '枚举值 working 未确认映射', action: '确认 working → active 映射' },
  { id: 'QA-007', severity: 'warning', type: '特征缺失', field: 'compa_ratio', row: 31, message: '薪酬带宽位置为空', action: '允许导入并降低解释可靠性' },
  { id: 'QA-008', severity: 'block', type: '组织缺失', field: 'department', row: 36, message: '无法进入组织聚合分析', action: '拒绝该行，补充有效组织' },
]

export const metadata = {
  datasetId: 'DS-2026-0630-SCR',
  schemaVersion: 'PRD-V4.4',
  role: 'scoring',
  cutoffDate: '2026-06-30',
  generatedAt: '2026-07-01 09:30 CST',
  modelVersion: 'LHR-RULELOGIT-1.0',
  methodType: '专家设定权重的可解释逻辑风险估计器',
  thresholdVersion: 'THR-1.2',
  criticalFeaturePolicyVersion: 'CMF-1.0',
  functionalCheck: '520条脱敏合成记录 · 单一历史快照 2025-12-31 · 无独立训练/验证切分',
  predictionWindow: '未来90天',
  purpose: 'RETENTION_RISK_SUPPORT',
}

export const initialActions = [
  { id: 'ACT-2407-01', title: '数字科技关键人才发展对话', scope: '数字科技中心 · 关键岗位', owner: '王晨 / HRBP', due: '2026-08-15', status: 'active', progress: 68, metric: '发展对话覆盖率', baseline: '31%', target: '85%', result: '', tasks: 12, done: 8 },
  { id: 'ACT-2407-02', title: '冰品渠道团队负荷治理', scope: '冰品事业部 · 渠道运营', owner: '赵敏 / 业务经理', due: '2026-08-02', status: 'blocked', progress: 42, metric: '连续高负荷人数', baseline: '19人', target: '≤8人', result: '', tasks: 7, done: 3 },
  { id: 'ACT-2406-03', title: '奶源质量人才认可计划', scope: '奶源事业部 · 质量技术', owner: '刘洋 / HRBP', due: '2026-07-20', status: 'completed', progress: 100, metric: '关键人才认可覆盖率', baseline: '46%', target: '90%', result: '完成率100%，风险变化需继续观察两个周期。', tasks: 8, done: 8 },
]

export const actionTemplates = [
  { id: 'career', title: '发展与内部流动', description: '职业对话、内部机会匹配与能力发展路径', applicable: ['发展停滞', '已完成发展对话'], metric: '发展对话覆盖率' },
  { id: 'workload', title: '工作负荷治理', description: '识别持续超负荷团队并重排优先级与资源', applicable: ['持续工作负荷'], metric: '连续高负荷人数' },
  { id: 'manager', title: '经理支持提升', description: '经理稳定性复核、1:1节奏与团队沟通机制', applicable: ['经理变更频繁', '团队流失传导'], metric: '有效1:1覆盖率' },
  { id: 'reward', title: '认可与回报校准', description: '在合规范围内复核薪酬带宽与及时认可', applicable: ['薪酬带宽位置偏低'], metric: '回报异常关闭率' },
  { id: 'diagnose', title: '证据补全诊断', description: '补充数据、访谈与事实核验后再决定行动', applicable: ['证据不足'], metric: '证据完整率' },
]
