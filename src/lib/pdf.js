const PAGE = { pixelWidth: 1240, pixelHeight: 1754, width: 595.28, height: 841.89 }
const encoder = new TextEncoder()
const toBytes = (value) => typeof value === 'string' ? encoder.encode(value) : value
const joinBytes = (parts) => {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) { output.set(part, offset); offset += part.length }
  return output
}
const safe = (value, fallback = '—') => String(value ?? '').trim() || fallback

function normalizeDrivers(value) {
  const items = Array.isArray(value) ? value : value?.items || value?.drivers || []
  return items.slice(0, 6).map((item, index) => ({
    name: safe(typeof item === 'string' ? item : item.name || item.label || item.driver, `驱动因素 ${index + 1}`),
    direction: safe(typeof item === 'string' ? '需核验' : item.direction || item.impact, '需核验'),
    evidence: safe(typeof item === 'string' ? '来自系统聚合信号' : item.evidence || item.description, '来自系统聚合信号'),
  }))
}

/** 纯函数：创建导出快照，并在此处执行最终的小样本脱敏。 */
export function buildReportModel({ records = [], aggregates = [], actions = [], metadata = {}, role = {}, summary = '', riskSummary, driverSummary, reportId = 'RPT-DRAFT', generatedAt = new Date().toLocaleString('zh-CN'), snapshot }) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {}
  const rows = source.records || records
  const groups = source.aggregates || aggregates
  const actionRows = source.actions || actions
  const meta = { ...metadata, ...(source.metadata || {}) }
  const risk = source.riskSummary || riskSummary || {}
  const suppressed = Boolean(risk.suppressed) || rows.length < 10
  const scorable = rows.filter((row) => row.band !== 'unscorable')
  const high = scorable.filter((row) => row.band === 'high')
  const open = actionRows.filter((action) => action.status === 'active' || action.status === 'blocked')
  const providedDrivers = normalizeDrivers(source.driverSummary || driverSummary)
  const drivers = suppressed ? [] : providedDrivers
  return {
    reportId: safe(source.id || reportId), generatedAt, title: '组织留任管理摘要', period: safe(meta.predictionWindow, '未来90天'),
    scope: safe(source.scope || role.scope, '当前授权组织范围'), cutoffDate: safe(meta.cutoffDate), datasetId: safe(meta.datasetId), modelVersion: safe(meta.modelVersion),
    summary: safe(source.summary || summary, '当前摘要尚待人工补充。'), suppressed,
    metrics: suppressed
      ? [['在职人数', '人数不足'], ['可评分覆盖率', '人数不足'], ['高风险信号', '人数不足'], ['开放行动', '人数不足']]
      : [['在职人数', String(risk.total ?? rows.length)], ['可评分覆盖率', `${Math.round((risk.scorable ?? scorable.length) / Math.max(1, risk.total ?? rows.length) * 100)}%`], ['高风险信号', String(risk.high ?? high.length)], ['开放行动', String(open.length)]],
    organizations: groups.slice(0, 6).map((item) => ({ name: safe(item.name), suppressed: suppressed || item.suppressed || Number(item.count) < 10, rate: Number(item.highRate) || 0 })),
    drivers,
    actions: actionRows.slice(0, 5).map((action) => ({ title: safe(action.title), scope: safe(action.scope), owner: safe(action.owner), due: safe(action.due), status: action.status === 'blocked' ? '阻塞' : action.status === 'completed' ? '已完成' : action.status === 'active' ? '进行中' : '草稿', metric: `${safe(action.metric)}：${safe(action.baseline)} → ${safe(action.target)}` })),
    limitations: [
      '系统仅提供人力决策支持，不自动作出解雇、降薪、惩罚、晋升否决等劳动关系决定。',
      '风险预测是基于当前模型与数据条件的概率估计，不得表述为员工将离职的确定事实。',
      '主要驱动是相关性解释，不等于真实离职原因或因果关系，必须由授权人员核验。',
      `数据截止 ${safe(meta.cutoffDate)}；关键特征缺失或整体特征缺失超过50%的记录标为不可评分。`,
      '少于10人的细分组织在页面、问答、接口与导出中均隐藏或合并，不展示可反推的精确数值。',
    ],
  }
}

function makePage() {
  const canvas = document.createElement('canvas')
  canvas.width = PAGE.pixelWidth; canvas.height = PAGE.pixelHeight
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fffefa'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  return { canvas, ctx }
}
function drawText(ctx, value, x, y, size = 28, color = '#17221d', weight = 400, align = 'left') {
  ctx.save(); ctx.fillStyle = color; ctx.font = `${weight} ${size}px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'top'; ctx.fillText(safe(value), x, y); ctx.restore()
}
function drawWrap(ctx, value, x, y, maxWidth, lineHeight, { size = 27, color = '#425049', weight = 400, maxLines = 20 } = {}) {
  ctx.save(); ctx.fillStyle = color; ctx.font = `${weight} ${size}px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif`; ctx.textBaseline = 'top'
  let line = ''; let row = 0
  for (const char of Array.from(safe(value))) {
    const next = line + char
    if (ctx.measureText(next).width > maxWidth && line) { if (row < maxLines) ctx.fillText(line, x, y + row * lineHeight); line = char; row += 1 } else line = next
  }
  if (row < maxLines && line) ctx.fillText(line, x, y + row * lineHeight)
  ctx.restore(); return Math.min(row + 1, maxLines) * lineHeight
}
function rule(ctx, y) { ctx.fillStyle = '#d7ddd8'; ctx.fillRect(72, y, 1096, 2) }
function heading(ctx, number, eyebrow, title, y) { drawText(ctx, String(number).padStart(2, '0'), 72, y + 5, 20, '#2a8b69', 700); drawText(ctx, eyebrow, 132, y, 17, '#2a8b69', 700); drawText(ctx, title, 132, y + 31, 38, '#17221d', 700); return y + 100 }
function footer(ctx, model, current) { rule(ctx, 1678); drawText(ctx, `${model.reportId} · ${model.datasetId} · ${model.modelVersion}`, 72, 1695, 15, '#75827b'); drawText(ctx, `内部保密 · 仅限授权范围 · ${current}/3`, 1168, 1695, 15, '#75827b', 400, 'right') }

function coverPage(model) {
  const { canvas, ctx } = makePage(); ctx.fillStyle = '#15231d'; ctx.fillRect(0, 0, 1240, 690); ctx.strokeStyle = '#2f8e6e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(1120, 610, 300, 0, Math.PI * 2); ctx.stroke()
  drawText(ctx, '留才', 72, 64, 38, '#fff', 700); drawText(ctx, 'RETENTION OS', 190, 78, 15, '#6fae98', 600); drawText(ctx, model.title, 72, 205, 24, '#79bca5', 600); drawText(ctx, '风险不是答案，', 72, 265, 72, '#fff', 700); drawText(ctx, '行动才是。', 72, 355, 72, '#fff', 700); drawText(ctx, `${model.period}自愿离职风险 · 内部保密`, 72, 475, 22, '#a4b2ac')
  ;[['范围', model.scope], ['数据截止', model.cutoffDate], ['报告版本', 'v1.0']].forEach(([label, value], index) => { const x = 72 + index * 350; drawText(ctx, label, x, 580, 16, '#779087'); drawText(ctx, value, x, 610, 22, '#fff', 600) })
  let y = heading(ctx, 1, 'EXECUTIVE SUMMARY', '执行摘要', 770); y += drawWrap(ctx, model.summary, 132, y, 970, 48, { size: 29, color: '#30413a', weight: 500, maxLines: 7 }) + 22
  ctx.fillStyle = '#e8f3ee'; ctx.fillRect(132, y, 970, 78); drawText(ctx, '证据范围', 158, y + 17, 16, '#247b5e', 700); drawText(ctx, '风险总览、组织对比、主要驱动与行动进展 · 已经人工确认', 158, y + 43, 17, '#4b6258'); footer(ctx, model, 1); return canvas
}
function riskPage(model) {
  const { canvas, ctx } = makePage(); let y = heading(ctx, 2, 'SCOPE & RISK LANDSCAPE', '范围、口径与核心发现', 72)
  model.metrics.forEach(([label, value], index) => { const x = 72 + index * 274; ctx.fillStyle = '#f0f2ee'; ctx.fillRect(x, y, 250, 112); drawText(ctx, label, x + 18, y + 18, 16, '#75827b'); drawText(ctx, value, x + 18, y + 49, value === '人数不足' ? 25 : 35, '#17221d', 700) }); y += 155
  drawText(ctx, '组织对比', 132, y, 28, '#17221d', 700); y += 54
  model.organizations.forEach((group) => { drawText(ctx, group.name, 132, y + 4, 20, '#25352e', 600); if (group.suppressed) { ctx.fillStyle = '#eef0ec'; ctx.fillRect(690, y, 320, 38); drawText(ctx, '人数不足', 850, y + 8, 17, '#6f7b75', 600, 'center') } else { ctx.fillStyle = '#e4e9e5'; ctx.fillRect(690, y + 11, 320, 14); ctx.fillStyle = '#bf5c55'; ctx.fillRect(690, y + 11, Math.max(2, 320 * group.rate), 14); drawText(ctx, `${Math.round(group.rate * 100)}%`, 1080, y + 2, 20, '#25352e', 700, 'right') } y += 58 })
  y += 18; rule(ctx, y); y = heading(ctx, 3, 'MAJOR DRIVERS', '主要驱动', y + 42)
  if (model.suppressed) { ctx.fillStyle = '#f0f2ee'; ctx.fillRect(132, y, 970, 94); drawText(ctx, '人数不足', 160, y + 18, 26, '#17221d', 700); drawText(ctx, '当前授权范围少于10人，未展示聚合驱动及任何可反推的精确信息。', 160, y + 55, 17, '#69766f') }
  else if (!model.drivers.length) { ctx.fillStyle = '#f0f2ee'; ctx.fillRect(132, y, 970, 94); drawText(ctx, '暂无足够解释证据', 160, y + 18, 26, '#17221d', 700); drawText(ctx, '系统不会用固定文案替代缺失的真实驱动结果。', 160, y + 55, 17, '#69766f') }
  else model.drivers.slice(0, 4).forEach((driver, index) => { const rowY = y + index * 118; drawText(ctx, String(index + 1).padStart(2, '0'), 132, rowY + 5, 18, '#2a8b69', 700); drawText(ctx, driver.name, 185, rowY, 23, '#17221d', 700); drawText(ctx, driver.direction, 1080, rowY + 3, 17, '#a44c47', 600, 'right'); drawWrap(ctx, driver.evidence, 185, rowY + 37, 895, 28, { size: 17, color: '#64726b', maxLines: 2 }) })
  drawText(ctx, '说明：主要驱动反映模型相关性贡献，不构成个体意图判断或因果结论。', 132, 1608, 16, '#75827b'); footer(ctx, model, 2); return canvas
}
function actionPage(model) {
  const { canvas, ctx } = makePage(); let y = heading(ctx, 4, 'ACTION PORTFOLIO', '行动组合与进展', 72)
  const actionRows = model.actions.length ? model.actions : [{ title: '暂无行动', scope: '请在人工复核后创建行动计划', owner: '—', due: '—', status: '草稿', metric: '—' }]
  actionRows.slice(0, 4).forEach((action, index) => { const rowY = y + index * 162; ctx.fillStyle = index % 2 ? '#f7f7f3' : '#f0f2ee'; ctx.fillRect(132, rowY, 970, 138); drawText(ctx, action.status, 1072, rowY + 18, 17, action.status === '阻塞' ? '#b34f49' : '#247b5e', 700, 'right'); drawText(ctx, action.title, 158, rowY + 18, 24, '#17221d', 700); drawText(ctx, action.scope, 158, rowY + 55, 17, '#67756e'); drawText(ctx, action.metric, 158, rowY + 88, 17, '#247b5e', 600); drawText(ctx, `${action.owner} · 截止 ${action.due}`, 1072, rowY + 88, 16, '#67756e', 400, 'right') })
  y += Math.min(actionRows.length, 4) * 162 + 24; rule(ctx, y); y = heading(ctx, 5, 'BOUNDARIES', '限制与下一步', y + 38)
  model.limitations.forEach((item, index) => { const rowY = y + index * 105; ctx.fillStyle = '#e8f3ee'; ctx.beginPath(); ctx.arc(149, rowY + 16, 16, 0, Math.PI * 2); ctx.fill(); drawText(ctx, String(index + 1), 149, rowY + 5, 16, '#247b5e', 700, 'center'); drawWrap(ctx, item, 185, rowY, 890, 30, { size: 18, color: '#46554e', maxLines: 3 }) }); footer(ctx, model, 3); return canvas
}
const canvasJpeg = (canvas) => new Promise((resolve, reject) => canvas.toBlob(async (blob) => blob ? resolve(new Uint8Array(await blob.arrayBuffer())) : reject(new Error('无法生成报告页面')), 'image/jpeg', 0.9))

/** 纯函数：把JPEG页面封装为最小合法PDF。 */
export function assembleJpegPdf(images, width = PAGE.pixelWidth, height = PAGE.pixelHeight) {
  const count = 2 + images.length * 3; const objects = new Array(count + 1)
  objects[1] = toBytes('<< /Type /Catalog /Pages 2 0 R >>'); objects[2] = toBytes(`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`)
  images.forEach((image, index) => { const page = 3 + index * 3; const content = toBytes(`q\n${PAGE.width} 0 0 ${PAGE.height} 0 0 cm\n/Im1 Do\nQ\n`); objects[page] = toBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /XObject << /Im1 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>`); objects[page + 1] = joinBytes([toBytes(`<< /Length ${content.length} >>\nstream\n`), content, toBytes('endstream')]); objects[page + 2] = joinBytes([toBytes(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`), image, toBytes('\nendstream')]) })
  const header = toBytes('%PDF-1.4\n%PDFJS\n'); const chunks = [header]; const offsets = new Array(count + 1).fill(0); let offset = header.length
  for (let i = 1; i <= count; i += 1) { const start = toBytes(`${i} 0 obj\n`); const end = toBytes('\nendobj\n'); offsets[i] = offset; chunks.push(start, objects[i], end); offset += start.length + objects[i].length + end.length }
  const xrefOffset = offset; const xref = [`xref\n0 ${count + 1}\n`, '0000000000 65535 f \n']; for (let i = 1; i <= count; i += 1) xref.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  chunks.push(toBytes(xref.join('')), toBytes(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`)); return new Blob(chunks, { type: 'application/pdf' })
}
export async function createReportPdf(model) { return assembleJpegPdf(await Promise.all([coverPage(model), riskPage(model), actionPage(model)].map(canvasJpeg))) }
export async function downloadReportPdf(model, filename = '组织留任管理摘要.pdf') {
  const blob = await createReportPdf(model); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.style.display = 'none'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); return blob
}
