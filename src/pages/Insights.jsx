import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Icon from '../components/Icon'
import { Badge, Button, Card, CardHeader, DataFreshness, PageHeader } from '../components/ui'
import { formatPercent } from '../lib/analytics'
import { useProduct } from '../state/ProductContext'

export default function Insights() {
  const navigate = useNavigate()
  const { aggregates, riskSummary, driverSummary, explanationQuality, history, department, setDepartment, metadata } = useProduct()
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [actionType, setActionType] = useState('career')
  const [coverage, setCoverage] = useState(60)
  const scopeSuppressed = riskSummary.suppressed
  const driverData = scopeSuppressed ? [] : driverSummary.map((driver) => ({ ...driver, name: driver.label }))
  const visibleGroups = aggregates.filter((group) => !group.suppressed).slice(0, 6)
  const protectedGroups = aggregates.filter((group) => group.suppressed)
  const actionEffects = useMemo(() => ({
    career: { min: 0.025, max: 0.055 }, workload: { min: 0.018, max: 0.046 },
    manager: { min: 0.02, max: 0.05 }, reward: { min: 0.015, max: 0.04 },
  }), [])
  const eligible = scopeSuppressed ? null : riskSummary.high + riskSummary.medium
  const effect = actionEffects[actionType]
  const simulation = scopeSuppressed ? null : {
    eligible,
    covered: Math.round(eligible * coverage / 100),
    minDelta: effect.min * coverage / 100,
    maxDelta: effect.max * coverage / 100,
  }
  const trendPeriods = scopeSuppressed ? 0 : new Set(history.map((row) => row.date)).size
  const benchmark = scopeSuppressed ? null : riskSummary.high / Math.max(1, riskSummary.scorable)

  return (
    <div className="page insights-page">
      <PageHeader
        eyebrow="ORG DIAGNOSTICS / 组织洞察"
        title="从“哪里异常”下钻到“什么值得核验”"
        description="组织对比、驱动解释与证据限制统一呈现；相关性只用于提出问题，不替代事实核验与管理判断。"
        actions={<><Button variant="secondary" icon="info" onClick={() => navigate('/model-info')}>查看模型说明</Button><Button icon="cases" onClick={() => navigate('/workbench')}>将高优先级加入复核</Button></>}
      >
        <div className="context-pills"><Badge tone="green">{department}</Badge><Badge tone="neutral">{metadata.predictionWindow}</Badge><Badge tone="neutral">模型 {metadata.modelVersion}</Badge></div>
      </PageHeader>
      <DataFreshness metadata={metadata} />

      <Card className="insight-control reveal delay-1">
        <div className="dimension-switch"><span>对比维度</span><button className="active">一级部门</button></div>
        <div className="applied-filters"><Icon name="filter" size={16} /><span>已生效：</span><Badge tone="blue">在职员工</Badge><Badge tone="blue">可评分 + 不可评分</Badge><button onClick={() => setDepartment('全部组织')}>清除组织筛选</button></div>
      </Card>

      <div className="insight-grid reveal delay-2">
        <Card className="organization-map-card">
          <CardHeader eyebrow="PRIORITY MAP" title="组织风险与业务影响矩阵" aside={<Badge tone="green">点击下钻</Badge>}>
            <p className="card-description">圆点越大代表关键岗位信号越多；少于10人的组织不显示精确值。</p>
          </CardHeader>
          {scopeSuppressed || visibleGroups.length === 0 ? <ProtectedState body="当前范围人数不足，不生成风险矩阵、组织排名或圆点大小。" /> : <div className="quadrant-map">
            <div className="quadrant-label q1">高风险 · 高影响<br /><strong>优先诊断</strong></div>
            <div className="quadrant-label q2">低风险 · 高影响<br /><strong>保持监测</strong></div>
            <div className="quadrant-label q3">高风险 · 低影响<br /><strong>组织干预</strong></div>
            <div className="quadrant-label q4">低风险 · 低影响<br /><strong>常规运营</strong></div>
            <span className="axis-y">业务影响 →</span><span className="axis-x">高风险占比 →</span>
            {visibleGroups.map((group, index) => {
              const x = 10 + Math.min(80, group.highRate * 170)
              const y = 80 - Math.min(65, (group.critical / Math.max(1, group.scorable) * 230) + 15)
              return <button key={group.name} className={`map-bubble bubble-${index}`} style={{ left: `${x}%`, top: `${y}%`, width: `${44 + group.critical * 2}px`, height: `${44 + group.critical * 2}px` }} onClick={() => setDepartment(group.name)} title={`${group.name} · ${formatPercent(group.highRate)}`}><span>{group.name.replace('事业部', '')}</span></button>
            })}
          </div>}
          {protectedGroups.length > 0 && <div className="boundary-note"><Icon name="lock" size={16} />{protectedGroups.map((group) => group.name).join('、')}已触发小样本保护，不参与矩阵定位与排名。</div>}
        </Card>

        <Card className="driver-card">
          <CardHeader eyebrow="EXPLAINABLE SIGNALS" title="主要驱动因素" aside={<button className="text-button" onClick={() => setEvidenceOpen(true)}>解释口径 <Icon name="eye" size={15} /></button>}>
            <p className="card-description">相对贡献取当前筛选范围内个体解释的绝对均值，不代表真实离职原因。</p>
          </CardHeader>
          {scopeSuppressed || driverData.length === 0 ? <ProtectedState body="当前范围不展示聚合驱动、覆盖人数或贡献强度；请合并到更高层级后再解释。" /> : <><ResponsiveContainer width="100%" height={285}>
            <BarChart data={driverData} layout="vertical" margin={{ top: 4, right: 24, left: 12, bottom: 0 }}>
              <CartesianGrid stroke="#e7e9e5" strokeDasharray="2 5" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={94} tickLine={false} axisLine={false} tick={{ fill: '#45514b', fontSize: 12 }} />
              <Tooltip formatter={(value) => [value.toFixed(2), '相对贡献']} contentStyle={{ borderRadius: 12, border: '1px solid #d9ddd7' }} />
              <Bar dataKey="contribution" radius={[0, 6, 6, 0]}>{driverData.map((item, index) => <Cell key={item.key} fill={index < 2 ? '#c94c4c' : index < 4 ? '#d6a23f' : '#2f826b'} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="evidence-summary"><span><Icon name="shield" />解释覆盖 {explanationQuality.coverage == null ? '—' : formatPercent(explanationQuality.coverage)}</span><span>解释稳定性 {explanationQuality.stability == null ? '不可计算' : formatPercent(explanationQuality.stability)}</span><span>{trendPeriods} 个组织快照 · 截止 {metadata.cutoffDate}</span></div></>}
          <div className="boundary-note"><Icon name="info" size={16} />{explanationQuality.limitation || '驱动因素只解释模型输出，不等于员工的真实离职原因。'}</div>
        </Card>
      </div>

      <div className="insight-lower reveal delay-3">
        <Card className="comparison-card">
          <CardHeader eyebrow="ORGANIZATION COMPARISON" title="同口径组织对比" aside={<Badge tone="blue">{scopeSuppressed ? '基准：人数不足' : `当前范围基准 ${formatPercent(benchmark)}`}</Badge>} />
          <div className="comparison-list">
            {scopeSuppressed ? <ProtectedState body="当前范围不展示组织风险比较或排名。" /> : <>{visibleGroups.map((group, index) => <button key={group.name} onClick={() => setDepartment(group.name)}><span className="rank-index">{String(index + 1).padStart(2, '0')}</span><div className="org-name"><strong>{group.name}</strong><small>{group.scorable} 人可评分 · {group.unscorable} 人不可评分</small></div><div className="risk-meter"><span style={{ width: `${Math.max(3, group.highRate * 100)}%` }} /></div><strong className="rate-value">{formatPercent(group.highRate)}</strong><Icon name="chevron" size={15} /></button>)}{protectedGroups.map((group) => <div className="empty-state" key={group.name}><span className="empty-icon"><Icon name="lock" /></span><h3>{group.name} · 人数不足</h3><p>不参与组织排名，不展示精确人数与比例。</p></div>)}</>}
          </div>
        </Card>

        <Card className="simulation-card card-dark">
          <div className="brief-head"><span><Icon name="spark" size={17} />行动影响推演</span><Badge tone="dark">非因果模拟</Badge></div>
          <h2>把“建议”变成可讨论的资源方案</h2>
          <label>候选行动<select value={actionType} onChange={(event) => setActionType(event.target.value)}><option value="career">发展与内部流动</option><option value="workload">工作负荷治理</option><option value="manager">经理支持提升</option><option value="reward">认可与回报校准</option></select></label>
          <label className="range-label"><span>目标覆盖率 <strong>{coverage}%</strong></span><input type="range" min="20" max="100" step="10" value={coverage} onChange={(event) => setCoverage(Number(event.target.value))} /></label>
          {scopeSuppressed ? <ProtectedState body="当前范围不返回可覆盖人数或风险变化区间，请先合并组织范围。" /> : <div className="simulation-result"><div><span>预计覆盖</span><strong>{simulation.covered}</strong><small>/ {simulation.eligible} 名中高风险员工</small></div><div><span>组织风险信号变化区间</span><strong>-{formatPercent(simulation.minDelta)} ~ -{formatPercent(simulation.maxDelta)}</strong><small>仅用于行动方案比较</small></div></div>}
          <p className="simulation-disclaimer"><Icon name="info" />该区间基于历史关联与行动覆盖率，不代表因果效果或个体结果。</p>
          <Button variant="light" icon="action" onClick={() => navigate('/actions')}>带着假设创建行动</Button>
        </Card>
      </div>

      {evidenceOpen && <EvidenceDrawer onClose={() => setEvidenceOpen(false)} metadata={metadata} driverData={driverData} explanationQuality={explanationQuality} />}
    </div>
  )
}

function EvidenceDrawer({ onClose, metadata, driverData, explanationQuality }) {
  return <><div className="scrim" onClick={onClose} /><aside className="evidence-drawer reveal-right"><div className="drawer-head"><div><span>EVIDENCE DRAWER</span><h2>解释口径与证据链</h2></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div><div className="evidence-chain"><div><small>01 · 数据</small><strong>{metadata.datasetId}</strong><p>快照截止 {metadata.cutoffDate}，直接身份字段不进入特征。</p></div><Icon name="arrow" /><div><small>02 · 模型</small><strong>{metadata.modelVersion}</strong><p>专家规则驱动的可解释逻辑风险估计；阈值版本 {metadata.thresholdVersion || 'THR-1.2'}。</p></div><Icon name="arrow" /><div><small>03 · 解释</small><strong>贡献方向与相对强度</strong><p>不输出因果结论，不推断私人心理状态。</p></div></div><h3>当前主要证据</h3><div className="evidence-items">{driverData.slice(0, 4).map((driver, index) => <div key={driver.key}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{driver.name}</strong><p>覆盖 {driver.cases} 条可解释记录 · 平均相对贡献 {driver.contribution.toFixed(2)}</p></div><Badge tone={index < 2 ? 'red' : 'amber'}>{driver.direction === 'down' ? '保护信号' : '风险信号'}</Badge></div>)}</div><div className="boundary-box"><Icon name="info" /><div><strong>解释质量</strong><p>覆盖率 {explanationQuality.coverage == null ? '—' : formatPercent(explanationQuality.coverage)} · 稳定性 {explanationQuality.stability == null ? '不可计算' : formatPercent(explanationQuality.stability)}。{explanationQuality.limitation}</p></div></div><div className="boundary-box"><Icon name="shield" /><div><strong>使用边界</strong><p>驱动因素表示对当前模型输出的影响，不等同于员工真实离职原因。进入个体行动前必须完成人工复核。</p></div></div></aside></>
}

function ProtectedState({ body }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="lock" /></span><h3>人数不足</h3><p>{body}</p></div>
}
