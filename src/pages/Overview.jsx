import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import Icon from '../components/Icon'
import { Badge, Button, Card, CardHeader, DataFreshness, KpiCard, RiskBadge } from '../components/ui'
import { formatPercent } from '../lib/analytics'
import { useProduct } from '../state/ProductContext'

const riskColors = { low: '#2f826b', medium: '#d6a23f', high: '#c94c4c', unscorable: '#a4aaa8' }

export default function Overview() {
  const navigate = useNavigate()
  const { aggregates, riskSummary, driverSummary, history, department, setDepartment, actions, metadata } = useProduct()
  const scopeSuppressed = riskSummary.suppressed
  const openActions = actions.filter((item) => item.status === 'active' || item.status === 'blocked')
  const overdue = openActions.filter((item) => new Date(item.due) < new Date('2026-07-24')).length
  const distribution = scopeSuppressed ? [] : [
    { name: '低风险', value: riskSummary.low, key: 'low' },
    { name: '中风险', value: riskSummary.medium, key: 'medium' },
    { name: '高风险', value: riskSummary.high, key: 'high' },
    { name: '不可评分', value: riskSummary.unscorable, key: 'unscorable' },
  ]
  const trend = useMemo(() => {
    if (scopeSuppressed) return []
    const filtered = department === '全部组织' ? history : history.filter((row) => row.department === department)
    const dates = [...new Set(filtered.map((row) => row.date))]
    return dates.map((date) => {
      const rows = filtered.filter((row) => row.date === date)
      return {
        date: date.slice(5).replace('-', '/'),
        risk: rows.reduce((sum, row) => sum + row.avgRisk, 0) / Math.max(1, rows.length),
        actual: rows.reduce((sum, row) => sum + row.actualTurnover, 0) / Math.max(1, rows.length),
      }
    })
  }, [history, department, scopeSuppressed])
  const prioritized = aggregates.filter((item) => !item.suppressed).slice(0, 5)
  const top = prioritized[0]
  const topDrivers = driverSummary.slice(0, 3)
  const countValue = (value) => scopeSuppressed ? '人数不足' : value
  const rateValue = (numerator, denominator) => scopeSuppressed ? '人数不足' : formatPercent(numerator / Math.max(1, denominator))

  return (
    <div className="page overview-page">
      <PageHero summary={riskSummary} top={top} metadata={metadata} navigate={navigate} />
      <DataFreshness metadata={metadata} />

      <div className="kpi-grid reveal delay-1">
        <KpiCard label="可评分覆盖率" value={rateValue(riskSummary.scorable, riskSummary.total)} delta={scopeSuppressed ? '已保护' : '本期'} meta={scopeSuppressed ? '当前范围不展示精确值' : `${riskSummary.scorable} / ${riskSummary.total} 人`} tone="green" icon="shield" onClick={() => navigate('/data')} />
        <KpiCard label="高风险信号" value={countValue(riskSummary.high)} delta={scopeSuppressed ? '已保护' : '本期'} meta={scopeSuppressed ? '小样本不进行风险分布' : `其中关键岗位 ${riskSummary.criticalHigh} 人`} tone="red" icon="alert" onClick={() => navigate('/workbench')} />
        <KpiCard label="待人工复核" value={countValue(riskSummary.pendingReview)} delta={scopeSuppressed ? '已保护' : '本期'} meta={scopeSuppressed ? '当前范围需合并后复核' : '高风险信号仍需人工确认'} tone="amber" icon="clock" onClick={() => navigate('/workbench')} />
        <KpiCard label="进行中行动" value={countValue(openActions.length)} delta={scopeSuppressed ? '已保护' : overdue ? `+${overdue}` : '本期'} meta={scopeSuppressed ? '当前范围不展示精确行动数量' : overdue ? `${overdue} 项需关注` : '全部按期'} tone="blue" icon="action" onClick={() => navigate('/actions')} />
      </div>

      <div className="overview-grid reveal delay-2">
        <Card className="risk-composition-card">
          <CardHeader eyebrow="RISK MIX" title="风险分布" aside={<button className="text-button" onClick={() => navigate('/insights')}>组织洞察 <Icon name="arrow" size={15} /></button>}>
            <p className="card-description">不可评分单列，不并入低风险。</p>
          </CardHeader>
          {scopeSuppressed ? <ProtectedState body="当前范围少于最小展示人数，不展示人数、比例或风险分布。请合并到更高组织层级。" /> : <div className="composition-body">
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={distribution} dataKey="value" innerRadius={70} outerRadius={96} paddingAngle={2} stroke="none">
                    {distribution.map((entry) => <Cell key={entry.key} fill={riskColors[entry.key]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} 人`, '人数']} contentStyle={{ borderRadius: 12, border: '1px solid #d9ddd7', boxShadow: '0 12px 30px rgba(20,30,25,.12)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><strong>{formatPercent(riskSummary.high / Math.max(1, riskSummary.scorable))}</strong><span>高风险占比</span></div>
            </div>
            <div className="legend-stack">
              {distribution.map((item) => (
                <button key={item.key} onClick={() => navigate(`/workbench?band=${item.key}`)}>
                  <span><i style={{ background: riskColors[item.key] }} />{item.name}</span><strong>{item.value}</strong><small>{formatPercent(item.value / Math.max(1, riskSummary.total))}</small>
                </button>
              ))}
              <div className="boundary-note"><Icon name="info" size={16} />不可评分单独呈现；不会被默认为低风险。</div>
            </div>
          </div>}
        </Card>

        <Card className="trend-card">
          <CardHeader eyebrow="SIGNAL TREND" title="三期信号趋势" aside={<Badge tone="amber" dot>需关注</Badge>}>
            <p className="card-description">风险用于前瞻，实际离职率仅用于历史回顾。</p>
          </CardHeader>
          {scopeSuppressed ? <ProtectedState body="小样本范围不展示趋势或历史对比，避免通过时间序列反推精确人数。" /> : <><div className="chart-legend"><span><i className="legend-green" />平均风险</span><span><i className="legend-ink" />实际离职率</span></div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
              <defs><linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2f826b" stopOpacity={0.25}/><stop offset="95%" stopColor="#2f826b" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid stroke="#e7e9e5" strokeDasharray="2 5" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#727c77', fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tickLine={false} axisLine={false} tick={{ fill: '#727c77', fontSize: 11 }} />
              <Tooltip formatter={(value) => formatPercent(value)} contentStyle={{ borderRadius: 12, border: '1px solid #d9ddd7' }} />
              <Area type="monotone" dataKey="risk" stroke="#2f826b" strokeWidth={2.4} fill="url(#riskFill)" name="平均风险" />
              <Area type="monotone" dataKey="actual" stroke="#35413b" strokeWidth={1.6} fill="transparent" strokeDasharray="5 5" name="实际离职率" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="model-event"><span>{metadata.cutoffDate}</span><i />当前展示均使用同一模型与阈值口径</div></>}
        </Card>
      </div>

      <div className="overview-lower reveal delay-3">
        <Card className="priority-card">
          <CardHeader eyebrow="DECISION QUEUE" title="组织优先队列" aside={<Badge tone="green">综合排序</Badge>}>
            <p className="card-description">综合风险、岗位关键性、可干预性与证据可靠性。</p>
          </CardHeader>
          {scopeSuppressed ? <ProtectedState body="当前范围人数不足，不生成组织排名、分布或干预优先级。" /> : <div className="table-wrap">
            <table>
              <thead><tr><th>组织</th><th>风险分布</th><th>高风险占比</th><th>关键岗位</th><th>建议</th><th /></tr></thead>
              <tbody>
                {prioritized.map((item, index) => (
                  <tr key={item.name} onClick={() => { setDepartment(item.name); navigate('/insights') }}>
                    <td><span className="rank-index">{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong></td>
                    <td><div className="mini-stacked"><i style={{ width: `${item.low / Math.max(1, item.scorable) * 100}%` }} /><i style={{ width: `${item.medium / Math.max(1, item.scorable) * 100}%` }} /><i style={{ width: `${item.high / Math.max(1, item.scorable) * 100}%` }} /></div></td>
                    <td><strong>{formatPercent(item.highRate)}</strong></td>
                    <td>{item.critical} 人</td>
                    <td><span className="recommendation">{index < 2 ? '本周诊断' : index === 2 ? '持续观察' : '保持节奏'}</span></td>
                    <td><Icon name="chevron" size={15} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </Card>

        <Card className="ai-brief-card card-dark">
          <div className="brief-head"><span><Icon name="spark" size={17} />本周判断</span><Badge tone="dark">待确认</Badge></div>
          <h2>先解决哪里，<br />再决定做什么。</h2>
          <div className="brief-items">
            <button onClick={() => navigate('/insights')}><strong>01</strong><span><b>{scopeSuppressed ? '当前范围人数不足' : `${top?.name || '重点组织'}信号最突出`}</b>{scopeSuppressed ? '已隐藏精确值、趋势与排名，请先合并组织范围。' : `高风险占比 ${formatPercent(top?.highRate)}，包含 ${top?.critical} 个关键岗位信号。`}</span><Icon name="arrow" /></button>
            <button onClick={() => navigate('/insights')}><strong>02</strong><span><b>{scopeSuppressed ? '暂不生成驱动解释' : `${topDrivers.length}个因素值得人工核验`}</b>{scopeSuppressed ? '小样本不提供可反推的聚合信号。' : topDrivers.map((item) => item.label).join('、') || '当前缺少可用驱动证据。'}</span><Icon name="arrow" /></button>
            <button onClick={() => navigate('/actions')}><strong>03</strong><span><b>先做组织行动，再谈个体</b>建议用发展对话覆盖与负荷治理作为首轮可逆行动。</span><Icon name="arrow" /></button>
          </div>
          <div className="brief-footer"><span><Icon name="shield" size={15} />数值来自系统计算，结论需人工确认</span><button>编辑并确认</button></div>
        </Card>
      </div>

    </div>
  )
}

function PageHero({ summary, top, metadata, navigate }) {
  const suppressed = summary.suppressed
  return (
    <div className="decision-hero reveal">
      <div className="hero-copy">
        <div className="eyebrow"><i /> RETENTION COMMAND / 今日决策</div>
        <h1>{suppressed ? <><span>人数不足</span><br /><em>精确信号已保护。</em></> : <><span>{summary.high}</span> 个高风险信号中，<br /><em>{summary.criticalHigh}</em> 个涉及关键岗位。</>}</h1>
        <p>{suppressed ? '当前授权范围未达最小展示人数，系统不生成人数、比例、趋势或排名。' : <>先看业务影响，再看风险概率。当前可优先诊断 <strong>{top?.name || '当前组织'}</strong>，系统不会自动对任何员工采取管理措施。</>}</p>
        <div className="hero-actions"><Button icon="cases" onClick={() => navigate('/workbench')}>进入复核队列</Button><Button variant="secondary" icon="insight" onClick={() => navigate('/insights')}>查看组织洞察</Button></div>
      </div>
      <div className="hero-console" aria-label="当前决策上下文">
        <div><span>优先组织</span><strong>{suppressed ? '范围需合并' : top?.name || '当前组织'}</strong></div>
        <div><span>预测窗口</span><strong>{metadata.predictionWindow}</strong></div>
        <div><span>数据截止</span><strong>{metadata.cutoffDate}</strong></div>
      </div>
    </div>
  )
}

function ProtectedState({ body }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="lock" /></span><h3>人数不足</h3><p>{body}</p></div>
}
