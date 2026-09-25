import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { applyTheme, getInitialTheme } from './utils/theme'

// Apply the saved theme before the first paint to avoid a flash of the wrong colours
applyTheme(getInitialTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
