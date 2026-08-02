import { useState } from 'react'
import Icon from '../components/Icon'
import { actionTemplates } from '../data/demoData'
import { actionStatusLabel } from '../lib/analytics'
import { Badge, Button, Card, PageHeader, Progress } from '../components/ui'
import { useProduct } from '../state/ProductContext'

const columns = [
  { key: 'draft', label: '草稿', tone: 'neutral' },
  { key: 'active', label: '进行中', tone: 'green' },
  { key: 'blocked', label: '阻塞', tone: 'red' },
  { key: 'completed', label: '已完成', tone: 'blue' },
]

export default function Actions() {
  const { actions, createAction, updateAction, department, currentRole } = useProduct()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const selected = actions.find((action) => action.id === selectedId)
  const open = actions.filter((a) => a.status === 'active' || a.status === 'blocked')
  const completed = actions.filter((a) => a.status === 'completed')
  const taskCount = actions.reduce((sum, a) => sum + a.tasks, 0)
  const doneCount = actions.reduce((sum, a) => sum + a.done, 0)

  return (
    <div className="page actions-page">
      <PageHeader eyebrow="ACTION TRACKING / 行动跟踪" title="建议只有进入负责人、期限与观察指标，才算行动" description="优先使用可逆、支持性的人才行动；完成只代表执行完成，不等同于产生因果效果。" actions={<Button icon="plus" onClick={() => setCreateOpen(true)}>新建行动计划</Button>} />
      <div className="action-metrics reveal delay-1">
        <Card><span>开放行动</span><strong>{open.length}</strong><small>{actions.filter((a) => a.status === 'blocked').length} 项阻塞</small></Card>
        <Card><span>任务完成率</span><strong>{Math.round(doneCount / Math.max(1, taskCount) * 100)}%</strong><Progress value={doneCount / Math.max(1, taskCount) * 100} /></Card>
        <Card><span>本期已完成</span><strong>{completed.length}</strong><small>均含结果摘要</small></Card>
        <Card><span>观察窗口</span><strong>2</strong><small>个后续快照</small></Card>
      </div>

      <div className="action-board reveal delay-2">
        {columns.map((column) => <div className="board-column" key={column.key}><div className="column-head"><span><i className={`dot-${column.tone}`} />{column.label}</span><Badge tone={column.tone}>{actions.filter((a) => a.status === column.key).length}</Badge></div><div className="column-items">{actions.filter((a) => a.status === column.key).map((action) => <ActionCard key={action.id} action={action} onClick={() => setSelectedId(action.id)} />)}{!actions.some((a) => a.status === column.key) && <div className="column-empty">暂无{column.label}行动</div>}</div></div>)}
      </div>

      {createOpen && <ActionModal defaultScope={department === '全部组织' ? currentRole.scope : department} onClose={() => setCreateOpen(false)} onCreate={async (payload) => { await createAction(payload); setCreateOpen(false) }} />}
      {selected && <ActionDetail action={selected} onClose={() => setSelectedId(null)} updateAction={updateAction} />}
    </div>
  )
}

function ActionCard({ action, onClick }) {
  const overdue = new Date(action.due) < new Date('2026-07-24') && action.status !== 'completed'
  return <button className="board-card" onClick={onClick}><div className="board-card-top"><code>{action.id}</code>{overdue && <Badge tone="red">逾期</Badge>}</div><h3>{action.title}</h3><p>{action.scope}</p><div className="owner-row"><span className="mini-avatar">{action.owner.slice(0, 1)}</span><span>{action.owner}</span><small>{action.due}</small></div><Progress value={action.progress} tone={action.status === 'blocked' ? 'red' : 'green'} /><div className="board-card-foot"><span>{action.progress}% 完成</span><span>{action.done}/{action.tasks} 任务</span></div><div className="metric-chip"><Icon name="insight" size={14} />{action.metric} · {action.baseline} → {action.target}</div></button>
}

function ActionModal({ onClose, onCreate, defaultScope }) {
  const [template, setTemplate] = useState('career')
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('王晨 / HRBP')
  const [due, setDue] = useState('2026-08-31')
  const [baseline, setBaseline] = useState('')
  const [target, setTarget] = useState('')
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const selected = actionTemplates.find((item) => item.id === template)
  const submit = async () => {
    if (!owner.trim() || !due || !baseline.trim() || !target.trim()) return
    setCreating(true)
    setFeedback('')
    try {
      await onCreate({ title: title.trim() || selected.title, scope: defaultScope, owner: owner.trim(), due, metric: selected.metric, baseline: baseline.trim(), target: target.trim(), tasks: DEFAULT_TASKS.length, done: 0, taskItems: DEFAULT_TASKS.map((task, index) => ({ id: `task-${index + 1}`, title: task, done: false })) })
    } catch (error) {
      setFeedback(`创建失败：${error.message || '请稍后重试'}`)
      setCreating(false)
    }
  }
  return <><div className="scrim" onClick={onClose} /><div className="modal reveal-up"><div className="modal-head"><div><span>NEW ACTION PLAN</span><h2>创建可追踪的留任行动</h2></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div><div className="template-grid">{actionTemplates.slice(0, 4).map((item) => <button className={template === item.id ? 'active' : ''} key={item.id} onClick={() => setTemplate(item.id)}><Icon name={item.id === 'workload' ? 'clock' : item.id === 'manager' ? 'people' : item.id === 'reward' ? 'spark' : 'insight'} /><strong>{item.title}</strong><span>{item.description}</span><i /></button>)}</div><div className="form-grid"><label className="field-label wide">计划名称<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={selected.title} /></label><label className="field-label">负责人<input value={owner} onChange={(e) => setOwner(e.target.value)} /></label><label className="field-label">截止日期<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label><label className="field-label">观察指标<input value={selected.metric} readOnly /></label><label className="field-label">当前基线<input value={baseline} onChange={(e) => setBaseline(e.target.value)} placeholder="例如：31%" /></label><label className="field-label">行动目标<input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="例如：覆盖率达到85%" /></label></div><div className="modal-boundary"><Icon name="shield" /><p>行动应聚焦沟通、发展、工作设计、支持和公平管理；不得基于风险分数采取惩罚性措施。</p></div>{feedback && <small className="field-help" role="status">{feedback}</small>}<div className="modal-actions"><Button variant="ghost" onClick={onClose}>取消</Button><Button disabled={creating || !owner.trim() || !due || !baseline.trim() || !target.trim()} onClick={submit}>{creating ? '正在保存…' : '保存为草稿'}</Button></div></div></>
}

function ActionDetail({ action, onClose, updateAction }) {
  const [result, setResult] = useState(action.result || '')
  const [saving, setSaving] = useState(false)
  const [pendingTask, setPendingTask] = useState(null)
  const [feedback, setFeedback] = useState('')
  const taskItems = getTaskItems(action)

  const persist = async (patch, successMessage, closeAfter = false) => {
    setSaving(true)
    setFeedback('')
    try {
      await updateAction(action.id, patch)
      setFeedback(successMessage)
      if (closeAfter) onClose()
      return true
    } catch (error) {
      setFeedback(`保存失败：${error.message || '请稍后重试'}`)
      return false
    } finally {
      setSaving(false)
    }
  }

  const toggleTask = async (index) => {
    if (pendingTask !== null || action.status === 'completed') return
    const nextItems = taskItems.map((item, itemIndex) => itemIndex === index ? { ...item, done: !item.done } : item)
    const done = nextItems.filter((item) => item.done).length
    setPendingTask(index)
    setFeedback('')
    try {
      await updateAction(action.id, { taskItems: nextItems, tasks: nextItems.length, done, progress: Math.round(done / Math.max(1, nextItems.length) * 100) })
      setFeedback('任务进度已保存。')
    } catch (error) {
      setFeedback(`任务保存失败：${error.message || '请稍后重试'}`)
    } finally {
      setPendingTask(null)
    }
  }

  const completeAction = () => {
    const completedTasks = taskItems.map((item) => ({ ...item, done: true }))
    return persist({ status: 'completed', progress: 100, done: completedTasks.length, tasks: completedTasks.length, taskItems: completedTasks, result: result.trim() }, '行动结果已保存。', true)
  }

  return <><div className="scrim" onClick={onClose} /><aside className="action-drawer reveal-right"><div className="drawer-head"><div><span>{action.id}</span><h2>{action.title}</h2></div><button className="icon-button" onClick={onClose}><Icon name="close" /></button></div><div className="action-detail-status"><Badge tone={action.status === 'blocked' ? 'red' : action.status === 'completed' ? 'blue' : action.status === 'draft' ? 'neutral' : 'green'}>{actionStatusLabel[action.status]}</Badge><span>{action.scope}</span></div><section><h3>计划进度</h3><div className="big-progress"><strong>{action.progress}%</strong><Progress value={action.progress} tone={action.status === 'blocked' ? 'red' : 'green'} /></div><div className="detail-pairs"><div><span>负责人</span><strong>{action.owner}</strong></div><div><span>截止日期</span><strong>{action.due}</strong></div><div><span>观察指标</span><strong>{action.metric}</strong></div><div><span>基线 → 目标</span><strong>{action.baseline} → {action.target}</strong></div></div></section><section><h3>任务清单</h3><div className="task-list">{taskItems.map((task, index) => <label key={task.id}><input type="checkbox" checked={task.done} disabled={pendingTask !== null || action.status === 'completed'} onChange={() => toggleTask(index)} /><span>{task.title}</span></label>)}</div></section><section><h3>结果与限制</h3><textarea value={result} onChange={(e) => setResult(e.target.value)} placeholder="填写执行结果、同期组织变化与尚不能归因的限制…" /></section>{feedback && <small className="field-help" role="status">{feedback}</small>}<div className="drawer-actions">{action.status === 'draft' ? <Button disabled={saving} onClick={() => persist({ status: 'active' }, '行动已启动。')}>{saving ? '正在启动…' : '启动行动'}</Button> : action.status !== 'completed' ? <><Button variant="secondary" disabled={saving} onClick={() => persist({ status: action.status === 'blocked' ? 'active' : 'blocked' }, action.status === 'blocked' ? '行动已恢复。' : '行动已标记为阻塞。')}>{action.status === 'blocked' ? '解除阻塞' : '标记阻塞'}</Button><Button disabled={!result.trim() || saving} onClick={completeAction}>{saving ? '正在保存…' : '完成并记录结果'}</Button></> : <Button disabled={!result.trim() || saving || result.trim() === (action.result || '').trim()} onClick={() => persist({ result: result.trim() }, '结果记录已更新。')}>{saving ? '正在保存…' : '保存结果更新'}</Button>}</div></aside></>
}

const DEFAULT_TASKS = ['确认目标人群与业务背景', '与业务经理完成方案评审', '执行行动并记录覆盖', '在下个快照复查变化']

function getTaskItems(action) {
  if (Array.isArray(action.taskItems) && action.taskItems.length) return action.taskItems.map((item, index) => typeof item === 'string' ? { id: `task-${index + 1}`, title: item, done: index < Number(action.done || 0) } : item)
  const count = Math.max(DEFAULT_TASKS.length, Number(action.tasks) || 0)
  return Array.from({ length: count }, (_, index) => ({ id: `task-${index + 1}`, title: DEFAULT_TASKS[index] || `跟进任务 ${String(index + 1).padStart(2, '0')}`, done: index < Number(action.done || 0) }))
}
