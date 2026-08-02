import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { Badge, Button, Card, CardHeader, PageHeader } from '../components/ui'
import { formatPercent } from '../lib/analytics'
import { useProduct } from '../state/ProductContext'

const featureList = [
  { field: 'engagement_score', label: '敬业度水平' },
  { field: 'overtime_hours_3m', label: '近3个月加班时长' },
  { field: 'compa_ratio', label: '薪酬带宽位置' },
  { field: 'months_since_promotion', label: '距上次晋升月数' },
  { field: 'manager_change_count_12m', label: '近12个月经理变更次数' },
  { field: 'team_turnover_rate_12m', label: '团队近12个月离职率' },
  { field: 'career_conversation_6m', label: '近6个月发展对话' },
  { field: 'training_hours_12m', label: '近12个月学习时长' },
]

export default function ModelInfo() {
  const navigate = useNavigate()
  const { metadata, metrics } = useProduct()
  return (
    <div className="page model-info-page">
      <PageHeader
        eyebrow="MODEL CARD / 模型说明"
        title="风险方案与已知限制"
        description="说明系统如何生成风险信号、哪些数据可用，以及哪些结论不能从当前方案中推出。"
        actions={<Button variant="secondary" icon="arrow" onClick={() => navigate('/insights')}>返回组织洞察</Button>}
      />

      <div className="model-card-layout reveal delay-1">
        <Card className="model-summary card-dark">
          <div className="brief-head"><span><Icon name="brain" size={17} />METHOD CARD</span><Badge tone="dark">规则模型</Badge></div>
          <h2>专家规则驱动的可解释逻辑风险估计器</h2>
          <p>特征变换与权重由当前方案版本预先设定，并非从当前上传数据训练得到。投入正式使用前必须完成企业历史数据的独立验证与版本审批。</p>
          <div className="model-version"><span>方案版本</span><code>{metadata.modelVersion}</code></div>
          <div className="model-metrics">
            <div><span>功能校验 AUC</span><strong>{Number(metrics.auc || 0).toFixed(2)}</strong></div>
            <div><span>Precision · p≥{Number(metrics.validationThreshold ?? 0.6).toFixed(2)}</span><strong>{formatPercent(metrics.precision, 0)}</strong></div>
            <div><span>Recall · p≥{Number(metrics.validationThreshold ?? 0.6).toFixed(2)}</span><strong>{formatPercent(metrics.recall, 0)}</strong></div>
            <div><span>合成校验记录</span><strong>{metrics.n || 0}</strong></div>
          </div>
          <div className="model-warning"><Icon name="alert" />正样本比例 {formatPercent(metrics.positiveRate)}。标签按同一合成机制生成，以上数值只验证计算链路，不可作为泛化性能或商业收益承诺。</div>
        </Card>

        <Card className="model-detail">
          <CardHeader eyebrow="METHOD, DATA & LIMITS" title="公开方法、口径与边界" aside={<Badge tone="green">版本可追溯</Badge>} />
          <div className="model-detail-grid">
            <Info n="01" title="预测目标">评分日仍在职员工未来90天自愿离职风险；第90天计入，第91天不计入。</Info>
            <Info n="02" title="方案类型">{metadata.methodType || '专家设定权重的可解释逻辑风险估计器'}；经归一化特征、加权求和与 Sigmoid 变换生成风险估计。</Info>
            <Info n="03" title="功能校验数据">{metadata.functionalCheck || '520条脱敏合成记录；无独立训练/验证切分'}；仅使用可评分且标签有效的记录，Precision/Recall 校验阈值为 p≥{Number(metrics.validationThreshold ?? 0.6).toFixed(2)}。</Info>
            <Info n="04" title="风险阈值">低 p&lt;0.30；中 0.30≤p&lt;0.60；高 p≥0.60；本提交锁定版本 {metadata.thresholdVersion || 'THR-1.2'}，任何配置变更必须生成新版本并重新验证。</Info>
            <Info n="05" title="不可评分">任一关键特征缺失，或整体模型特征缺失超过50%，均不输出风险等级；策略版本 {metadata.criticalFeaturePolicyVersion || 'CMF-1.0'}。</Info>
            <Info n="06" title="解释含义">驱动因素表示对估计值的贡献方向和相对强度，只是相关性线索，不代表真实离职原因或因果关系。</Info>
            <Info n="07" title="适用限制">合成数据不能替代真实历史回溯、时间外验证、公平性评估与上线监控；分布变化后必须重新验证和版本化。</Info>
            <Info n="08" title="人工责任">系统只提供人力决策支持，不自动作出解雇、降薪、惩罚、否决晋升或其他劳动关系决定。</Info>
          </div>
          <div className="feature-whitelist"><strong>参与估计的业务特征</strong>{featureList.map((item) => <code key={item.field} title={item.field}>{item.label}</code>)}</div>
          <div className="forbidden-features"><Icon name="lock" /><div><strong>明确排除</strong><p>姓名、邮箱等直接身份字段，termination_* 与 label_* 未来字段，以及摄像头、情绪识别、私人通信内容和非必要监控数据均不得进入评分特征。</p></div></div>
        </Card>
      </div>
    </div>
  )
}

function Info({ n, title, children }) {
  return <section><span>{n}</span><div><h3>{title}</h3><p>{children}</p></div></section>
}
