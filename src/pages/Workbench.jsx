import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, RiskBadge } from '../components/ui'
import { reviewLabel } from '../lib/analytics'
import { actionTemplates } from '../data/demoData'
import { useProduct } from '../state/ProductContext'

export default function Workbench() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { accessibleRecords, currentRole, reviews, reviewCase, createAction, metadata } = useProduct()
  const [band, setBand] = useState(searchParams.get('band') || 'high')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)
  const [sort, setSort] = useState('priority')
  const [page, setPage] = useState(1)
  const pageSize = 15
  const queue = useMemo(() => accessibleRecords
    .filter((row) => band === 'all' || row.band === band)
    .filter((row) => status === 'all' || (reviews[row.employee_id]?.status || 'pending') === status)
    .sort((a, b) => sort === 'risk' ? (b.score || 0) - (a.score || 0) : (b.priorityScore || 0) - (a.priorityScore || 0)), [accessibleRecords, band, status, sort, reviews])
  const pageCount = Math.max(1, Math.ceil(queue.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * pageSize
  const pageRows = queue.slice(pageStart, pageStart + pageSize)

  useEffect(() => {
    setPage(1)
  }, [band, status, sort])

  useEffect(() => {
    setPage((value) => Math.min(value, pageCount))
  }, [pageCount])

  if (!currentRole.canViewIndividuals) return (
    <div className="page workbench-page">
      <PageHeader eyebrow="HUMAN REVIEW / 人工复核" title="个体复核需要独立授权" description={`当前“${currentRole.label}”仅可查看 ${currentRole.scope} 聚合信息；页面、搜索、问答与导出遵循同一权限。`} />
      <Card className="access-denied-card reveal delay-1">
        <div className="access-illustration"><Icon name="lock" size={34} /><span /><i /></div>
        <h2>你仍然可以完成团队级行动</h2>
        <p>系统没有返回匿名ID、个体风险、驱动因素或排序数据，避免通过前端隐藏造成侧信道泄露。</p>
        <div className="permission-list"><span><Icon name="check" />查看授权团队聚合</span><span><Icon name="check" />发起组织级行动</span><span className="disabled"><Icon name="close" />访问个体风险队列</span><span className="disabled"><Icon name="close" />导出个体明细</span></div>
        <div className="hero-actions"><Button onClick={() => navigate('/insights')}>返回聚合洞察</Button><Button variant="secondary" onClick={() => navigate('/model-info')}>查看使用边界</Button></div>
      </Card>
    </div>
  )

  return (
    <div className="page workbench-page">
      <PageHeader
        eyebrow="HUMAN REVIEW / 人工复核"
        title="把风险信号变成人工可判断的案例"
        description="队列默认按业务优先级排序，而不是制造“离职概率排行榜”；每次复核都保留理由、责任人与时间。"
        actions={<Button variant="secondary" icon="shield" onClick={() => navigate('/model-info')}>模型与边界</Button>}
      />

      <div className="queue-summary reveal delay-1">
        <Card><span>当前队列</span><strong>{queue.length}</strong><small>{metadata.predictionWindow}</small></Card>
        <Card><span>高优先级</span><strong>{queue.filter((r) => r.priorityScore >= 68).length}</strong><small>风险 + 业务影响</small></Card>
        <Card><span>已确认</span><strong>{Object.values(reviews).filter((r) => r.status === 'confirmed').length}</strong><small>可进入行动</small></Card>
        <Card><span>证据不足</span><strong>{Object.values(reviews).filter((r) => r.status === 'insufficient').length}</strong><small>已停止自动流转</small></Card>
      </div>

      <Card className="queue-card reveal delay-2">
        <CardHeader eyebrow="REVIEW QUEUE" title="风险复核队列" aside={<Badge tone="green">身份已去标识</Badge>} />
        <div className="queue-toolbar">
          <div className="segmented">{[['high', '高风险'], ['medium', '中风险'], ['unscorable', '不可评分'], ['all', '全部']].map(([key, label]) => <button key={key} className={band === key ? 'active' : ''} onClick={() => setBand(key)}>{label}</button>)}</div>
          <label><span>复核状态</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">全部状态</option><option value="pending">待复核</option><option value="confirmed">已确认</option><option value="rejected">已驳回</option><option value="insufficient">证据不足</option><option value="deferred">暂缓</option></select></label>
          <label><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="priority">决策优先级</option><option value="risk">风险分数</option></select></label>
        </div>
        {queue.length ? <div className="table-wrap queue-table"><table><thead><tr><th>匿名对象</th><th>业务范围</th><th>风险信号</th><th>决策优先级</th><th>证据可靠性</th><th>复核状态</th><th /></tr></thead><tbody>
          {pageRows.map((row) => { const review = reviews[row.employee_id]; return <tr key={row.employee_id} onClick={() => setSelected(row)}><td><strong>{row.employee_id}</strong><small>{row.job_family} · {row.job_level}</small></td><td>{row.department}<small>{row.team}</small></td><td><RiskBadge band={row.band} score={row.score} /></td><td><div className="priority-score"><strong>{row.priorityScore}</strong><span><i style={{ width: `${row.priorityScore}%` }} /></span></div></td><td><Badge tone={row.reliability === 'high' ? 'green' : 'amber'} dot>{row.reliability === 'high' ? '高' : '中'}</Badge></td><td><Badge tone={review?.status === 'confirmed' ? 'green' : review?.status === 'rejected' ? 'neutral' : 'amber'}>{getReviewLabel(review?.status || 'pending')}</Badge></td><td><Icon name="chevron" /></td></tr> })}
        </tbody></table><div className="table-pagination"><span>显示 {pageStart + 1}—{Math.min(pageStart + pageSize, queue.length)} / {queue.length}</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>上一页</button><button className="active">{currentPage}</button><button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>下一页</button></div></div></div> : <EmptyState title="没有符合条件的案例" body="调整风险区或复核状态；空结果不会被误写为低风险。" action={<Button variant="secondary" onClick={() => { setBand('all'); setStatus('all') }}>清除筛选</Button>} />}
      </Card>
      {selected && <CaseDrawer record={selected} review={reviews[selected.employee_id]} onClose={() => setSelected(null)} onReview={reviewCase} onCreateAction={async (payload) => { await createAction(payload); setSelected(null); navigate('/actions') }} />}
    </div>
  )
}

function CaseDrawer({ record, review, onClose, onReview, onCreateAction }) {
  const [reviewStatus, setReviewStatus] = useState(review?.status || '')
  const [reason, setReason] = useState(review?.reason || '')
  const [actionOpen, setActionOpen] = useState(false)
  const [template, setTemplate] = useState(actionTemplates[0].id)
  const [savingReview, setSavingReview] = useState(false)
  const [creatingAction, setCreatingAction] = useState(false)
  const [feedback, setFeedback] = useState('')
  const chosen = actionTemplates.find((item) => item.id === template)

  const submitReview = async () => {
    if (!reviewStatus || !reason.trim()) return
    setSavingReview(true)
    setFeedback('')
    try {
      await onReview(record.employee_id, reviewStatus, reason.trim())
      setFeedback('复核结论已保存，可按已保存状态继续流转。')
    } catch (error) {
      setFeedback(`保存失败：${error.message || '请稍后重试'}`)
    } finally {
      setSavingReview(false)
    }
  }

  const createActionFromReview = async () => {
    if (review?.status !== 'confirmed') return
    setCreatingAction(true)
    setFeedback('')
    try {
      await onCreateAction({ title: `${chosen.title} · ${record.department}`, scope: `${record.department} · ${record.team}`, owner: '待分派', due: '2026-08-31', metric: chosen.metric, baseline: '待记录', target: '待设定', employeeId: record.employee_id, reviewTime: review.time })
    } catch (error) {
      setFeedback(`行动创建失败：${error.message || '请稍后重试'}`)
      setCreatingAction(false)
    }
  }

  return <><div className="scrim" onClick={onClose} /><aside className="case-drawer reveal-right">
    <div className="case-head"><div><span>CASE · {record.employee_id}</span><h2>{record.department} / {record.team}</h2><p>{record.job_family} · {record.job_level} · 数据截止 {record.snapshot_date}</p></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div>
    <div className="prediction-warning"><Icon name="alert" /><div><strong>预测不是事实</strong><p>这是未来90天风险估计，只能用于提出复核问题，不能直接触发员工管理决定。</p></div></div>
    <div className="case-score-grid"><div><span>风险信号</span><RiskBadge band={record.band} score={record.score} /></div><div><span>决策优先级</span><strong>{record.priorityScore}<small>/100</small></strong></div><div><span>证据可靠性</span><Badge tone="green" dot>{record.reliability === 'high' ? '高' : '中'}</Badge></div></div>
    <section className="case-section"><div className="section-title"><h3>主要驱动证据</h3><Badge tone="neutral">非因果解释</Badge></div><div className="driver-evidence-list">{record.drivers.map((driver, index) => <div key={driver.key}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{driver.label}</strong><p>{driver.evidence}</p></div><Badge tone={driver.direction === 'down' ? 'green' : 'amber'}>{driver.direction === 'down' ? '保护' : '风险'}</Badge></div>)}</div></section>
    <section className="case-section"><div className="section-title"><h3>人工复核</h3><span>必填</span></div><div className="review-options">{[['confirmed', '确认', '证据与业务背景一致，可进入支持性行动'], ['rejected', '驳回', '判断风险信号不成立，停止流转'], ['insufficient', '证据不足', '信息不足，补证后重新复核'], ['deferred', '暂缓', '当前不做判断，保留待处理状态']].map(([key, label, body]) => <button key={key} className={reviewStatus === key ? 'active' : ''} onClick={() => { setReviewStatus(key); setFeedback('') }}><i /> <span><strong>{label}</strong><small>{body}</small></span></button>)}</div><label className="field-label">复核理由<textarea value={reason} onChange={(event) => { setReason(event.target.value); setFeedback('') }} placeholder="记录业务背景、证据来源或数据问题，不填写私人敏感内容…" /></label><Button onClick={submitReview} disabled={!reviewStatus || !reason.trim() || savingReview} icon="check">{savingReview ? '正在保存…' : '保存复核结论'}</Button>{feedback && <small className="field-help" role="status">{feedback}</small>}</section>
    <section className="case-section action-conversion"><button className="section-toggle" onClick={() => setActionOpen((value) => !value)}><span><Icon name="action" />从复核转为可逆行动</span><Icon name="chevron" className={actionOpen ? 'rotate' : ''} /></button>{actionOpen && <div className="action-form"><label className="field-label">行动模板<select value={template} onChange={(event) => setTemplate(event.target.value)}>{actionTemplates.slice(0, 4).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="template-preview"><strong>{chosen.title}</strong><p>{chosen.description}</p><span>观察指标：{chosen.metric}</span></div><Button variant="secondary" disabled={review?.status !== 'confirmed' || creatingAction} onClick={createActionFromReview}>{creatingAction ? '正在创建…' : '创建行动草稿'}</Button>{review?.status !== 'confirmed' && <small className="field-help">请先保存“确认”结论；未保存的本地选择不会触发行动。</small>}</div>}</section>
    <div className="case-timeline"><h3>证据时间线</h3><div><i /><span><strong>风险任务已发布</strong><small>2026-07-01 09:32 · {record.snapshot_date} 快照</small></span></div><div><i /><span><strong>进入人工复核队列</strong><small>2026-07-01 09:34 · 规则 PRIORITY-1.0</small></span></div>{review && <div><i /><span><strong>{getReviewLabel(review.status)}</strong><small>{new Date(review.time).toLocaleString('zh-CN')} · {review.reviewer}</small></span></div>}</div>
  </aside></>
}

const getReviewLabel = (status) => ({ ...reviewLabel, insufficient: '证据不足' }[status] || status)
