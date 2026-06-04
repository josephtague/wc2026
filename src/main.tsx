import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './teletext.css'
import TeletextApp from './components/TeletextApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TeletextApp />
  </StrictMode>,
)
