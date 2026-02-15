import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './YarnZooMosaicStudio_v3.jsx'
import { AuthProvider } from './lib/AuthContext'

// Wrap app with authentication
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
