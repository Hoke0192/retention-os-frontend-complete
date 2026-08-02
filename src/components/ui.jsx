import Icon from './Icon'
import { bandLabel, formatPercent } from '../lib/analytics'

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <header className="page-header reveal">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function Button({ children, variant = 'primary', icon, className = '', ...props }) {
  return <button className={`button ${variant} ${className}`} {...props}>{icon && <Icon name={icon} size={16} />}{children}</button>
}

export function Card({ children, className = '', accent = false, ...props }) {
  return <section className={`card ${accent ? 'card-accent' : ''} ${className}`} {...props}>{children}</section>
}

export function CardHeader({ eyebrow, title, aside, children }) {
  return (
    <div className="card-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {children}
      </div>
      {aside && <div className="card-aside">{aside}</div>}
    </div>
  )
}

export function KpiCard({ label, value, delta, tone = 'ink', meta, icon, onClick }) {
  return (
    <button className={`kpi-card tone-${tone}`} onClick={onClick} type="button">
      <div className="kpi-top"><span>{label}</span>{icon && <Icon name={icon} size={18} />}</div>
      <strong>{value}</strong>
      <div className="kpi-meta">{delta && <span className={delta.startsWith('+') ? 'delta-up' : 'delta-down'}>{delta}</span>} {meta}</div>
    </button>
  )
}

export function Badge({ children, tone = 'neutral', dot = false }) {
  return <span className={`badge badge-${tone}`}>{dot && <i />}{children}</span>
}

export function RiskBadge({ band, score, compact = false }) {
  return <span className={`risk-badge risk-${band}`}><i />{bandLabel[band]}{!compact && score != null ? ` · ${formatPercent(score, 0)}` : ''}</span>
}

export function EmptyState({ icon = 'search', title, body, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon name={icon} size={24} /></div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function Progress({ value, tone = 'green' }) {
  return <div className="progress-track" aria-label={`进度 ${value}%`}><span className={`progress-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}

export function DataFreshness({ metadata }) {
  return (
    <div className="freshness-strip">
      <span><i className="live-dot" /> 数据 {metadata.cutoffDate}</span>
      <span>窗口 {metadata.predictionWindow}</span>
      <span title={metadata.modelVersion}>模型 {String(metadata.modelVersion || '').replace('-DEMO', '')}</span>
    </div>
  )
}

export function Skeleton({ rows = 3 }) {
  return <div className="skeleton-wrap">{Array.from({ length: rows }, (_, index) => <div key={index} className="skeleton-line" style={{ width: `${92 - index * 9}%` }} />)}</div>
}
