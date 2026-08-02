import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { Button, Badge } from './ui'
import { useProduct } from '../state/ProductContext'

const navigation = [
  { to: '/overview', icon: 'overview', label: '决策总览', tag: '01' },
  { to: '/data', icon: 'data', label: '数据工坊', tag: '02' },
  { to: '/insights', icon: 'insight', label: '组织洞察', tag: '03' },
  { to: '/workbench', icon: 'cases', label: '复核工作台', tag: '04' },
  { to: '/actions', icon: 'action', label: '行动中心', tag: '05' },
  { to: '/reports', icon: 'report', label: '管理报告', tag: '06' },
  { to: '/model-info', icon: 'brain', label: '模型说明', tag: '07' },
]

function AssistantPanel({ onClose }) {
  const { askAssistant, department, currentRole, notify } = useProduct()
  const [question, setQuestion] = useState('哪些部门最值得优先干预？')
  const [answer, setAnswer] = useState(null)
  const [asking, setAsking] = useState(false)
  const ask = async () => {
    if (!question.trim() || asking) return
    setAsking(true)
    try {
      const response = await askAssistant(question.trim())
      setAnswer(response)
      notify(response.suppressed ? '当前范围触发小样本保护，已拒绝返回精确结果' : '留任副驾已基于当前权限与证据生成答案', response.suppressed ? 'warning' : 'success')
    } catch (error) {
      notify(error.message, 'warning')
    } finally {
      setAsking(false)
    }
  }
  return (
    <aside className="assistant-panel reveal-right" aria-label="留任副驾">
      <div className="assistant-head">
        <div className="assistant-mark"><Icon name="brain" size={22} /></div>
        <div><span>RETENTION COPILOT</span><h2>留任副驾</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="关闭"><Icon name="close" /></button>
      </div>
      <div className="assistant-boundary"><Icon name="shield" size={16} />只回答当前权限范围内的可追溯问题；不会替你作出员工管理决定。</div>
      <div className="assistant-suggestions">
        {['哪些部门最值得优先干预？', '为什么数字科技风险上升？', '本期有哪些数据限制？'].map((item) => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}
      </div>
      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="输入问题" />
      <Button icon="spark" onClick={ask} disabled={asking}>{asking ? '正在分析…' : '基于证据分析'}</Button>
      {answer && (
        <div className="assistant-answer">
          <div className="answer-label"><span>{answer.suppressed ? '安全响应' : '结论草稿'}</span><Badge tone={answer.suppressed ? 'neutral' : 'blue'}>{answer.suppressed ? '小样本保护' : '需人工确认'}</Badge></div>
          <p>{answer.text}</p>
          {answer.citations?.[0] && <button className="evidence-link" onClick={() => window.location.assign(answer.citations[0].path)}><Icon name="eye" size={15} />查看证据 · {answer.citations[0].label}<Icon name="chevron" size={14} /></button>}
          <div className="answer-meta">筛选：{department} · 权限：{answer.scope || currentRole.scope} · 模式：{answer.mode === 'external-ai' ? '外部AI（聚合证据约束）' : '可复现证据模板'}{answer.fallbackReason ? ` · ${answer.fallbackReason}` : ''}</div>
        </div>
      )}
    </aside>
  )
}

export default function Shell({ children }) {
  const { role, roles, setRole, currentRole, toast, department, setDepartment, allowedDepartments } = useProduct()
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const departments = allowedDepartments
  const active = navigation.find((item) => location.pathname.startsWith(item.to))
    || (location.pathname.startsWith('/model-info') ? { label: '模型说明', tag: '07' } : null)

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
        <button className="brand" onClick={() => navigate('/overview')}>
          <span className="brand-mark">留才</span>
          <span><strong>RETENTION OS</strong><small>组织留任决策台</small></span>
        </button>
        <nav aria-label="主导航">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setMobileNav(false)} className={({ isActive }) => isActive ? 'active' : ''}>
              <Icon name={item.icon} size={19} /><span>{item.label}</span><small>{item.tag}</small>
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-shell">
        <div className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileNav((v) => !v)} aria-label="菜单"><Icon name="menu" /></button>
          <div className="current-module"><small>COMMAND / {active?.tag || '00'}</small><strong>{active?.label || '产品'}</strong></div>
          <div className="global-context">
            <label>
              <span>组织范围</span>
              <select value={department} onChange={(event) => setDepartment(event.target.value)} disabled={role === 'hrbp' || role === 'manager' || role === 'admin'}>
                <option>全部组织</option>
                {departments.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>当前角色</span>
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                {Object.entries(roles).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}
              </select>
            </label>
            <button className="assistant-trigger" onClick={() => setAssistantOpen(true)}><Icon name="spark" size={17} />问留任副驾 <kbd>⌘ K</kbd></button>
            <div className="avatar" title={`${currentRole.label} · ${currentRole.scope}`}>王</div>
          </div>
        </div>
        <div className="content-shell">{children}</div>
      </main>
      {assistantOpen && <><div className="scrim" onClick={() => setAssistantOpen(false)} /><AssistantPanel onClose={() => setAssistantOpen(false)} /></>}
      {toast && <div className={`toast toast-${toast.tone}`}><Icon name={toast.tone === 'warning' ? 'alert' : 'check'} size={17} />{toast.message}</div>}
    </div>
  )
}
