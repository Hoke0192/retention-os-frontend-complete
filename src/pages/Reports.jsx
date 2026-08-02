import { useEffect, useMemo, useState } from 'react'
import Icon from '../components/Icon'
import { Badge, Button, Card, CardHeader, PageHeader } from '../components/ui'
import { formatPercent } from '../lib/analytics'
import { buildReportModel, downloadReportPdf } from '../lib/pdf'
import { useProduct } from '../state/ProductContext'

export default function Reports() {
  const product = useProduct()
  const { accessibleRecords, aggregates, actions, metadata, currentRole, department, notify, riskSummary, driverSummary, createReportSnapshot, updateReportTask } = product
  const [confirmedKey, setConfirmedKey] = useState('')
  const [editing, setEditing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [failedSnapshot, setFailedSnapshot] = useState(null)
  const scopeSuppressed = Boolean(riskSummary?.suppressed)
  const total = riskSummary?.total ?? 0
  const scorableCount = riskSummary?.scorable ?? 0
  const highCount = riskSummary?.high ?? 0
  const top = aggregates.find((item) => !item.suppressed) || aggregates[0]
  const topDriverLabels = driverSummary.slice(0, 3).map((item) => item.label)
  const defaultSummary = scopeSuppressed ? '当前授权范围触发小样本保护，报告不呈现精确人数、比例、组织排序或驱动因素。请合并到更高组织层级后重新生成。' : `本期可评分覆盖率保持在较高水平。${top?.name || '重点组织'}的风险信号相对突出。建议先核验${topDriverLabels.join('、') || '主要业务证据'}，再确定行动范围。`
  const [summary, setSummary] = useState(defaultSummary)
  const reportScope = department === '全部组织' ? currentRole.scope : department
  const reportPeriod = `${metadata.cutoffDate} 截止 · ${metadata.predictionWindow}`
  const reportId = useMemo(() => {
    const date = String(metadata.cutoffDate || 'current').replaceAll('-', '')
    const dataset = String(metadata.datasetId || 'dataset').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'dataset'
    return `RPT-${date}-${dataset}`
  }, [metadata.cutoffDate, metadata.datasetId])
  const confirmationKey = `${department}|${metadata.datasetId}|${summary.trim()}`
  const confirmed = confirmedKey === confirmationKey
  const openActions = actions.filter((action) => action.status === 'active' || action.status === 'blocked')
  const generatedAt = useMemo(() => new Date().toLocaleString('zh-CN'), [])

  useEffect(() => {
    setSummary(defaultSummary)
    setConfirmedKey('')
    setFailedSnapshot(null)
  // 只在报告数据边界变化时重置草稿，避免普通状态刷新覆盖用户编辑。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, metadata.datasetId])

  const exportPdf = async () => {
    if (!currentRole.canExport) { notify('当前角色没有管理报告导出权限', 'warning'); return }
    if (!confirmed) { notify('请先人工确认AI摘要，再生成正式报告', 'warning'); return }
    setGenerating(true)
    let snapshot = failedSnapshot
    try {
      if (!snapshot) snapshot = typeof createReportSnapshot === 'function' ? await createReportSnapshot({ reportId, narrativeSummary: summary, confirmed: true }) : null
      const model = buildReportModel({ records: accessibleRecords, aggregates, actions, metadata, role: currentRole, summary, riskSummary, driverSummary, reportId, generatedAt, snapshot })
      await downloadReportPdf(model, `组织留任管理摘要_${metadata.cutoffDate || '当前'}.pdf`)
      if (snapshot?.id && typeof updateReportTask === 'function') await updateReportTask(snapshot.id, 'completed')
      setFailedSnapshot(null)
      notify('PDF管理报告已生成并开始下载')
    } catch (error) {
      if (snapshot?.id && typeof updateReportTask === 'function') await updateReportTask(snapshot.id, 'failed', error.message).catch(() => undefined)
      if (snapshot?.id) setFailedSnapshot(snapshot)
      notify(`PDF生成失败：${error.message}`, 'warning')
    } finally { setGenerating(false) }
  }

  return (
    <div className="page reports-page">
      <PageHeader eyebrow="MANAGEMENT REPORT / 管理输出" title="把已确认的判断与行动编成管理语言" description="正式报告只引用当前系统的聚合指标、已确认摘要与行动进展；导出时重新校验权限与小样本规则。" actions={<><Button variant="secondary" icon="eye" onClick={() => setEditing((v) => !v)}>{editing ? '完成编辑' : '编辑摘要'}</Button><Button icon="download" onClick={exportPdf} disabled={!currentRole.canExport || generating} title={!currentRole.canExport ? '当前角色无导出权限' : undefined}>{generating ? '正在生成…' : currentRole.canExport ? failedSnapshot ? '重试生成 PDF' : '生成 PDF' : '无导出权限'}</Button></>} />

      <div className="report-layout reveal delay-1">
        <Card className="report-settings">
          <CardHeader eyebrow="REPORT CONFIG" title="报告配置" />
          <div className="report-form"><label className="field-label">报告范围<input value={reportScope} readOnly /></label><label className="field-label">报告期间<input value={reportPeriod} readOnly /></label></div>
          <div className="publish-gate"><div><Icon name={confirmed ? 'check' : 'alert'} /><span><strong>{confirmed ? '摘要已确认' : '等待人工确认'}</strong><small>范围、数据或摘要变化后需重新确认</small></span></div><Button variant={confirmed ? 'secondary' : 'primary'} onClick={() => setConfirmedKey(confirmed ? '' : confirmationKey)}>{confirmed ? '撤回确认' : '确认AI摘要'}</Button></div>
        </Card>

        <div className="report-paper" id="management-report">
          <header className="report-cover"><div className="report-brand"><span>留才</span><small>RETENTION OS</small></div><Badge tone={confirmed ? 'green' : 'amber'}>{confirmed ? '已确认 · 可发布' : '草稿 · 未确认'}</Badge><div><span>组织留任管理摘要</span><h1>风险不是答案，<br />行动才是。</h1><p>{metadata.predictionWindow}自愿离职风险 · 内部保密</p></div><div className="cover-meta"><span>范围<strong>{reportScope}</strong></span><span>数据截止<strong>{metadata.cutoffDate}</strong></span><span>报告标识<strong>{reportId}</strong></span></div></header>
          <section className="report-section executive-summary"><div className="section-number">01</div><div><span>EXECUTIVE SUMMARY</span><h2>执行摘要</h2>{editing ? <textarea value={summary} onChange={(event) => { setSummary(event.target.value); setConfirmedKey(''); setFailedSnapshot(null) }} /> : <p>{summary}</p>}<div className="report-evidence"><Icon name="eye" /><span>证据：风险总览、组织对比、驱动解释</span><small>数值来自系统计算 · 人工{confirmed ? '已' : '未'}确认</small></div></div></section>
          <section className="report-section"><div className="section-number">02</div><div className="full"><span>RISK LANDSCAPE</span><h2>范围与风险总览</h2><div className="report-kpis"><div><small>在职人数</small><strong>{scopeSuppressed ? '人数不足' : total}</strong></div><div><small>可评分覆盖率</small><strong>{scopeSuppressed ? '人数不足' : formatPercent(scorableCount / Math.max(1, total))}</strong></div><div><small>高风险信号</small><strong>{scopeSuppressed ? '人数不足' : highCount}</strong></div><div><small>开放行动</small><strong>{scopeSuppressed ? '人数不足' : openActions.length}</strong></div></div><div className="report-bars">{aggregates.slice(0, 5).map((group) => { const suppressed = scopeSuppressed || group.suppressed; return <div key={group.name}><span>{group.name}</span>{suppressed ? <div className="report-bar-suppressed">人数不足</div> : <div><i style={{ width: `${group.highRate * 100}%` }} /></div>}<strong>{suppressed ? '人数不足' : formatPercent(group.highRate)}</strong></div> })}</div><p className="report-caption">注：高风险仅表示在当前模型与数据条件下的运营分层，不代表员工将离职。少于10人的细分组织已抑制精确数值与比例图形。</p></div></section>
          <section className="report-section"><div className="section-number">03</div><div className="full"><span>MAJOR DRIVERS</span><h2>主要驱动</h2>{scopeSuppressed ? <div className="report-suppressed-message"><strong>人数不足</strong><span>当前范围少于10人，不展示聚合驱动及任何可反推的精确信息。</span></div> : <div className="report-driver-list">{driverSummary.slice(0, 5).map((driver, index) => <div key={driver.key}><span>{String(index + 1).padStart(2, '0')}</span><strong>{driver.label}</strong><small>{driver.direction === 'down' ? '保护信号' : '风险信号'} · 覆盖 {driver.cases} 条可解释记录 · 需结合业务事实核验</small></div>)}</div>}<p className="report-caption">驱动因素仅用于解释模型信号，不等于员工真实离职原因或因果关系。</p></div></section>
          <section className="report-section"><div className="section-number">04</div><div className="full"><span>ACTION PORTFOLIO</span><h2>行动组合与进展</h2><div className="report-actions">{actions.slice(0, 3).map((action) => <div key={action.id}><Badge tone={action.status === 'blocked' ? 'red' : action.status === 'completed' ? 'blue' : 'green'}>{action.status === 'blocked' ? '阻塞' : action.status === 'completed' ? '已完成' : '进行中'}</Badge><h3>{action.title}</h3><p>{action.scope}</p><span>{action.metric}：{action.baseline} → {action.target}</span><small>{action.owner} · {action.due}</small></div>)}</div></div></section>
          <section className="report-section limitations"><div className="section-number">05</div><div className="full"><span>BOUNDARIES</span><h2>限制与下一步</h2><div className="limitation-grid"><div><Icon name="shield" /><strong>决策边界</strong><p>系统不自动作出解雇、降薪、惩罚或晋升否决等劳动关系决定。</p></div><div><Icon name="brain" /><strong>解释边界</strong><p>驱动因素是相关性解释，不等于真实离职原因或因果关系。</p></div><div><Icon name="data" /><strong>数据边界</strong><p>数据截止 {metadata.cutoffDate}；缺失超过50%的记录标为不可评分。</p></div></div></div></section>
          <footer className="report-footer"><span>{reportId} · {metadata.datasetId} · {metadata.modelVersion}</span><span>内部保密 · 仅限授权范围</span></footer>
        </div>
      </div>
    </div>
  )
}
