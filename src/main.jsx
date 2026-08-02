import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ProductProvider } from './state/ProductContext'
import App from './App'
import './styles.css'
import './console-theme.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <ProductProvider>
        <App />
      </ProductProvider>
    </HashRouter>
  </StrictMode>,
)
