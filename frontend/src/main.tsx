import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PuzzleProvider } from './context/PuzzleContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PuzzleProvider>
      <App />
    </PuzzleProvider>
  </StrictMode>,
)
