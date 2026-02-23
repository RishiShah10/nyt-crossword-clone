import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { PuzzleProvider } from './context/PuzzleContext'
import { AuthProvider } from './context/AuthContext'
import { RoomProvider } from './context/RoomContext'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <PuzzleProvider>
          <RoomProvider>
            <App />
          </RoomProvider>
        </PuzzleProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
