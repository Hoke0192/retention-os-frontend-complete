import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Shell from './components/Shell'
import { Skeleton } from './components/ui'

const Overview = lazy(() => import('./pages/Overview'))
const DataStudio = lazy(() => import('./pages/DataStudio'))
const Insights = lazy(() => import('./pages/Insights'))
const Workbench = lazy(() => import('./pages/Workbench'))
const Actions = lazy(() => import('./pages/Actions'))
const Reports = lazy(() => import('./pages/Reports'))
const ModelInfo = lazy(() => import('./pages/ModelInfo'))

export default function App() {
  return (
    <Shell>
      <Suspense fallback={<div className="route-loading"><Skeleton rows={7} /></div>}>
        <Routes>
          <Route path="/overview" element={<Overview />} />
          <Route path="/data" element={<DataStudio />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/model-info" element={<ModelInfo />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </Suspense>
    </Shell>
  )
}
