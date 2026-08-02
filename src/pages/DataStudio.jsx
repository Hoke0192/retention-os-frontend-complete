import { useRef, useState } from 'react'
import Icon from '../components/Icon'
import { Badge, Button, Card, CardHeader, PageHeader, Progress } from '../components/ui'
import { requiredScoringFields } from '../lib/analytics'
import { useProduct } from '../state/ProductContext'

const datasets = [
  { id: 'training_data', title: '历史训练数据', rows: 520, state: '已验证', purpose: '模型验证与成熟标签' },
  { id: 'current_scoring', title: '当前评分快照', rows: 368, state: '可分析', purpose: '当前在职员工风险评分' },
  { id: 'history_snapshots', title: '历史组织快照', rows: 1104, state: '可比较', purpose: '趋势与风险迁移' },
  { id: 'quality_anomalies', title: '预埋质量场景', rows: 8, state: '测试集', purpose: '验证阻断、告警与恢复' },
  { id: 'dataset_metadata', title: '治理元数据', rows: 4, state: '已绑定', purpose: '用途、时间与血缘' },
]

function clientParseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
  const split = (line) => {
    const cells = []
    let current = ''
    let quoted = false
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index]
      if (char === '"' && line[index + 1] === '"' && quoted) { current += '"'; index += 1 }
      else if (char === '"') quoted = !quoted
      else if (char === ',' && !quoted) { cells.push(current); current = '' }
      else current += char
    }
    cells.push(current)
    return cells
  }
  const headers = split(lines.shift()).map((value) => value.trim())
  return lines.map((line) => Object.fromEntries(split(line).map((value, index) => [headers[index], value.trim()])))
}

export default function DataStudio() {
  const { qualityIssues, batchState, batches, tasks, loadRows, retryBatch, retryTask, restoreDemo, refresh, notify } = useProduct()
  const [activeTab, setActiveTab] = useState('import')
  const [dataRole, setDataRole] = useState('current_scoring')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploaded, setUploaded] = useState(null)
  const inputRef = useRef(null)
  const blockers = qualityIssues.filter((issue) => issue.severity === 'block')
  const warnings = qualityIssues.filter((issue) => issue.severity === 'warning')

  const handleFile = async (file) => {
    if (!file) return
    if (!/\.(csv|xlsx)$/i.test(file.name)) { notify('仅支持 UTF-8 CSV 或 XLSX 文件', 'warning'); return }
    if (file.size > 50 * 1024 * 1024) { notify('单文件不能超过 50MB', 'warning'); return }
    setUploading(true)
    setUploadProgress(18)
    try {
      let rows
      if (/\.csv$/i.test(file.name)) {
        const buffer = await file.arrayBuffer()
        let text
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
        } catch {
          throw new Error('CSV 不是严格 UTF-8 编码，请转换编码后重新上传')
        }
        setUploadProgress(56)
        rows = clientParseCsv(text)
      } else {
        setUploadProgress(42)
        const response = await fetch(`/api/import?filename=${encodeURIComponent(file.name)}&sheet=${encodeURIComponent(dataRole)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: await file.arrayBuffer(),
        })
        if (!response.ok) throw new Error((await response.json()).error || 'XLSX 解析失败')
        rows = (await response.json()).rows
      }
      setUploadProgress(78)
      const result = await loadRows(rows, file.name, { dataRole })
      const issues = Array.isArray(result) ? result : (result?.issues || [])
      const batch = !Array.isArray(result) ? result?.batch : null
      setUploaded({ name: file.name, size: file.size, rows: rows.length, issues: issues.length, batch })
      setUploadProgress(100)
      setActiveTab('quality')
    } catch (error) {
      notify(`${error.message}；已保留当前批次，可修复后重试`, 'warning')
      await refresh().catch(() => {})
    } finally {
      if (inputRef.current) inputRef.current.value = ''
      window.setTimeout(() => { setUploading(false); setUploadProgress(0) }, 500)
    }
  }

  const handleRestoreDemo = async () => {
    setRestoring(true)
    try {
      await restoreDemo()
      setUploaded(null)
      setActiveTab('import')
    } finally {
      setRestoring(false)
    }
  }

  const downloadTemplate = () => {
    const headers = [...requiredScoringFields, 'team', 'job_level', 'location', 'engagement_score', 'overtime_hours_3m', 'compa_ratio', 'months_since_promotion', 'manager_change_count_12m', 'training_hours_12m', 'career_conversation_6m', 'team_turnover_rate_12m', 'critical_role']
    const example = ['EMP001', '2026-06-30', 'active', '2022-05-16', '数字科技中心', '数据技术', '数据产品', 'P4', '北京', '68', '42', '0.91', '18', '2', '24', 'false', '0.17', 'true']
    const blob = new Blob([`\uFEFF${headers.join(',')}\n${example.join(',')}\n`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'current_scoring_template.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    notify('标准评分模板已下载')
  }

  return (
    <div className="page data-page">
      <PageHeader
        eyebrow="DATA INPUT / 数据接入"
        title="先证明数据可信，再允许风险生成"
        description="上传、字段映射、质量检查与版本血缘在同一条可恢复流程中完成；阻断问题不会被静默忽略。"
        actions={<><Button variant="secondary" icon="download" onClick={downloadTemplate}>下载标准模板</Button><Button icon="retry" disabled={restoring} onClick={handleRestoreDemo}>{restoring ? '正在恢复…' : '恢复标准数据'}</Button></>}
      />

      <div className="tabs reveal delay-1">
        <button className={activeTab === 'import' ? 'active' : ''} onClick={() => setActiveTab('import')}>数据接入</button>
        <button className={activeTab === 'mapping' ? 'active' : ''} onClick={() => setActiveTab('mapping')}>字段映射 <Badge tone="green">18/18</Badge></button>
        <button className={activeTab === 'quality' ? 'active' : ''} onClick={() => setActiveTab('quality')}>质量检查 <Badge tone={blockers.length ? 'red' : 'green'}>{qualityIssues.length}</Badge></button>
        <button className={activeTab === 'batches' ? 'active' : ''} onClick={() => setActiveTab('batches')}>批次与血缘</button>
      </div>

      {uploaded && <div className="uploaded-file reveal"><Icon name="check" /><div><strong>{uploaded.name}</strong><span>{uploaded.rows} 条记录 · {(uploaded.size / 1024).toFixed(1)} KB · {uploaded.issues} 个质量提示</span>{uploaded.batch && <small><code>{uploaded.batch.id}</code> · {formatRange(uploaded.batch.timeStart, uploaded.batch.timeEnd)}</small>}</div><Badge tone={uploaded.batch?.status === 'blocked' || uploaded.issues ? 'amber' : 'green'}>{batchStatusLabel(uploaded.batch?.status) || '已提交'}</Badge></div>}

      {activeTab === 'import' && (
        <div className="data-import-grid reveal">
          <Card className="upload-card">
            <CardHeader eyebrow={dataRole === 'current_scoring' ? 'CURRENT SCORING' : 'TRAINING DATA'} title={dataRole === 'current_scoring' ? '上传当前评分数据' : '上传历史训练数据'}>
              <p className="card-description">系统不会从内容猜测数据用途；请在上传前明确选择数据角色。</p>
            </CardHeader>
            <label className="field-label">数据角色<select value={dataRole} disabled={uploading} onChange={(event) => setDataRole(event.target.value)}><option value="current_scoring">当前评分快照（current_scoring）</option><option value="training_data">历史训练数据（training_data）</option></select></label>
            <input ref={inputRef} type="file" accept=".csv,.xlsx" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
            <button
              className={`dropzone ${dragging ? 'dragging' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); handleFile(event.dataTransfer.files?.[0]) }}
              onClick={() => inputRef.current?.click()}
            >
              <span className="drop-icon"><Icon name="upload" size={28} /></span>
              <strong>拖入文件，或点击选择</strong>
              <p>UTF-8 CSV / XLSX · 最大 50MB · 直接标识不进入分析页面</p>
              {uploading && <div className="upload-progress"><Progress value={uploadProgress} /><span>正在解析与预检… {uploadProgress}%</span></div>}
            </button>
            <div className="privacy-callout"><Icon name="shield" /><div><strong>隐私最小化</strong><p>姓名、邮箱、证件号不作为模型特征；系统使用匿名稳定ID关联业务对象。</p></div></div>
          </Card>
          <Card className="dataset-contract-card">
            <CardHeader eyebrow="STANDARD DATA CONTRACT" title="五类数据，职责严格分开" aside={<Badge tone="blue">PRD V4.4</Badge>} />
            <div className="dataset-list">
              {datasets.map((item, index) => <button key={item.id} onClick={() => setActiveTab('batches')}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><code>{item.id}</code><small>{item.purpose}</small></div><Badge tone={index === 1 ? 'green' : 'neutral'}>{item.state}</Badge></button>)}
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'mapping' && <MappingPanel onContinue={() => setActiveTab('quality')} />}
      {activeTab === 'quality' && <QualityPanel issues={qualityIssues} blockers={blockers} warnings={warnings} batchState={batchState} onRetry={() => setActiveTab('import')} />}
      {activeTab === 'batches' && <BatchPanel batches={batches} tasks={tasks} retryBatch={retryBatch} retryTask={retryTask} />}
    </div>
  )
}

function MappingPanel({ onContinue }) {
  const mappings = [
    ['员工编号', 'employee_id', '唯一标识', '100%'], ['数据日期', 'snapshot_date', '快照日期', '100%'], ['人员状态', 'employment_status', '在职状态', '98%'],
    ['一级部门', 'department', '组织聚合', '100%'], ['岗位序列', 'job_family', '岗位族', '96%'], ['最近敬业度', 'engagement_score', '体验信号', '92%'],
  ]
  return (
    <Card className="mapping-panel reveal">
      <CardHeader eyebrow="SEMANTIC MAPPING" title="自动推荐已完成，关键字段仍需人工确认" aside={<Badge tone="green" dot>18 项已映射</Badge>}>
        <p className="card-description">映射方案保存为版本 MAP-2026-07-24-03；关键字段不会静默忽略。</p>
      </CardHeader>
      <div className="mapping-table">
        <div className="mapping-row mapping-head"><span>源字段</span><span>标准字段</span><span>业务语义</span><span>推荐置信度</span><span>状态</span></div>
        {mappings.map(([source, target, meaning, confidence]) => <div className="mapping-row" key={target}><strong>{source}</strong><code>{target}</code><span>{meaning}</span><span>{confidence}</span><Badge tone="green">已确认</Badge></div>)}
      </div>
      <div className="panel-footer"><span><Icon name="info" />类型不兼容或一对多冲突会阻止提交。</span><Button icon="arrow" onClick={onContinue}>运行质量检查</Button></div>
    </Card>
  )
}

function QualityPanel({ issues, blockers, warnings, batchState, onRetry }) {
  return (
    <div className="quality-layout reveal">
      <div className="quality-metrics">
        <Card><span>质量状态</span><strong className={blockers.length ? 'text-red' : 'text-green'}>{blockers.length ? '需修复' : '可分析'}</strong><small>正式评分闸门</small></Card>
        <Card><span>阻断问题</span><strong>{blockers.length}</strong><small>必须清零</small></Card>
        <Card><span>质量告警</span><strong>{warnings.length}</strong><small>允许降级进入</small></Card>
        <Card><span>恢复能力</span><strong>100%</strong><small>上下文已保留</small></Card>
      </div>
      <Card className="quality-table-card">
        <CardHeader eyebrow="QUALITY FIREWALL" title="每个问题都定位到字段、记录与恢复动作" aside={<Badge tone={batchState === 'blocked' ? 'red' : 'green'}>{batchState === 'blocked' ? '评分已阻断' : '可进入分析'}</Badge>} />
        <div className="table-wrap">
          <table><thead><tr><th>级别</th><th>问题</th><th>字段 / 行</th><th>影响</th><th>恢复动作</th></tr></thead>
            <tbody>{issues.map((issue) => <tr key={issue.id}><td><Badge tone={issue.severity === 'block' ? 'red' : 'amber'}>{issue.severity === 'block' ? '阻断' : '告警'}</Badge></td><td><strong>{issue.type}</strong></td><td><code>{issue.field}</code><small className="row-number">第 {issue.row} 行</small></td><td>{issue.message}</td><td>{issue.action}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="panel-footer"><span><Icon name="shield" />阻断记录不会进入正式评分；告警会降低覆盖或解释可靠性。</span><Button variant="secondary" icon="retry" onClick={onRetry}>修复后重新上传</Button></div>
      </Card>
    </div>
  )
}

function BatchPanel({ batches, tasks, retryBatch, retryTask }) {
  const [retrying, setRetrying] = useState('')
  const [feedback, setFeedback] = useState('')
  const failedTasks = tasks.filter((task) => task.status === 'failed')

  const retry = async (task) => {
    setRetrying(task.id)
    setFeedback('')
    try {
      if (task.type === 'quality' && task.batchId) await retryBatch(task.batchId)
      else await retryTask(task.id)
      setFeedback(`${task.id} 已完成重试，原始内容未重复写入。`)
    } catch (error) {
      setFeedback(`${task.id} 重试失败：${error.message || '请检查原始内容'}`)
    } finally {
      setRetrying('')
    }
  }

  const retryBlockedBatch = async (batch) => {
    setRetrying(batch.id)
    setFeedback('')
    try {
      await retryBatch(batch.id)
      setFeedback(`${batch.id} 已使用服务器保留内容重新检查。`)
    } catch (error) {
      setFeedback(`${batch.id} 重试失败：${error.message || '请检查原始内容'}`)
    } finally {
      setRetrying('')
    }
  }

  return (
    <Card className="batch-panel reveal">
      <CardHeader eyebrow="LINEAGE & RECOVERY" title="每个真实批次都保留来源、时间范围与处理状态" aside={<Badge tone={failedTasks.length ? 'amber' : 'green'}>{failedTasks.length ? `${failedTasks.length} 项待恢复` : '当前无失败任务'}</Badge>} />
      <div className="lineage-diagram"><span>源文件</span><Icon name="arrow" /><span>字段映射</span><Icon name="arrow" /><span>质量规则</span><Icon name="arrow" /><span>不可变快照</span><Icon name="arrow" /><span>风险任务</span></div>
      <div className="table-wrap"><table><thead><tr><th>批次 / 文件</th><th>数据角色</th><th>状态</th><th>记录数</th><th>数据时间范围</th><th>映射版本</th><th>恢复</th></tr></thead><tbody>{batches.map((batch) => <tr key={batch.id}><td><code>{batch.id}</code><small className="row-number">{batch.filename || '未记录文件名'}</small></td><td><code>{batch.dataRole}</code></td><td><Badge tone={batch.status === 'blocked' ? 'red' : 'green'}>{batchStatusLabel(batch.status)}</Badge></td><td>{Number(batch.rowCount || 0).toLocaleString('zh-CN')}</td><td>{formatRange(batch.timeStart, batch.timeEnd)}</td><td><code>{batch.mappingVersion || '—'}</code></td><td>{batch.status === 'blocked' ? <Button variant="secondary" disabled={Boolean(retrying)} onClick={() => retryBlockedBatch(batch)}>{retrying === batch.id ? '重试中…' : '重试'}</Button> : '—'}</td></tr>)}</tbody></table>{!batches.length && <p className="card-description">尚无数据批次，请先上传CSV或XLSX。</p>}</div>

      <CardHeader eyebrow="FAILED TASKS" title="失败任务可从原始内容安全重试" />
      <div className="table-wrap"><table><thead><tr><th>任务</th><th>类型</th><th>关联对象</th><th>状态</th><th>尝试次数</th><th>失败原因</th><th>操作</th></tr></thead><tbody>{failedTasks.map((task) => <tr key={task.id}><td><code>{task.id}</code><small className="row-number">{task.filename || task.updatedAt || task.createdAt}</small></td><td>{taskTypeLabel(task.type)}</td><td><code>{task.batchId || task.reportId || task.sheet || '—'}</code></td><td><Badge tone="red">失败</Badge></td><td>{task.attempts || 1}</td><td>{task.error || '未返回错误详情'}</td><td>{task.retryable && ['quality', 'risk', 'xlsx-parse', 'report'].includes(task.type) ? <Button variant="secondary" disabled={Boolean(retrying)} onClick={() => retry(task)}>{retrying === task.id ? '重试中…' : '重试原任务'}</Button> : '需回到对应流程'}</td></tr>)}</tbody></table>{!failedTasks.length && <p className="card-description">没有失败任务；上传解析、质量检查、风险与报告任务均处于可追溯状态。</p>}</div>
      {feedback && <div className="panel-footer"><span role="status"><Icon name="info" />{feedback}</span></div>}
    </Card>
  )
}

function formatRange(start, end) {
  if (!start && !end) return '未识别有效日期'
  if (!start || start === end) return start || end
  return `${start} — ${end}`
}

function batchStatusLabel(status) {
  return ({ ready: '可分析', blocked: '已阻断', processing: '处理中', failed: '失败' }[status] || status || '')
}

function taskTypeLabel(type) {
  return ({ quality: '质量检查', risk: '风险任务', 'xlsx-parse': 'XLSX解析', report: '报告生成' }[type] || type)
}
