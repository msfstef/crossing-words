import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './index.css'
import App from './App.tsx'
import { exposeTestPuzzlesGlobally, isDevMode } from './lib/testPuzzleGenerator'

// In dev mode, expose test puzzle utilities to window for debugging and E2E tests
if (isDevMode()) {
  exposeTestPuzzlesGlobally();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
