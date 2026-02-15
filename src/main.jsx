import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './YarnZooMosaicStudio_v3.jsx'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { hasSupabaseConfig } from './lib/supabaseClient'

function LoginScreen() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { signIn, signUp, resetPassword } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) { setError('Wachtwoorden komen niet overeen'); setBusy(false); return }
        if (password.length < 6) { setError('Wachtwoord moet minimaal 6 tekens zijn'); setBusy(false); return }
        const { error } = await signUp(email, password)
        if (error) throw error
        setMessage('Account aangemaakt! Check je email voor verificatie.')
      } else if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email)
        if (error) throw error
        setMessage('Reset link is verzonden naar je email!')
      }
    } catch (err) {
      setError(err.message || 'Er is iets misgegaan')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={logoStyle}>YarnZoo Studio</h1>
        <p style={subtitleStyle}>Mosaic Crochet Pattern Designer</p>

        <h2 style={titleStyle}>
          {mode === 'signin' && 'Inloggen'}
          {mode === 'signup' && 'Account Aanmaken'}
          {mode === 'reset' && 'Wachtwoord Resetten'}
        </h2>

        {error && <div style={errorStyle}>{error}</div>}
        {message && <div style={messageStyle}>{message}</div>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="jouw@email.nl" style={inputStyle} required />
          </div>

          {mode !== 'reset' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Wachtwoord</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimaal 6 tekens" style={inputStyle} required minLength={6} />
            </div>
          )}

          {mode === 'signup' && (
            <div style={fieldStyle}>
              <label style={labelStyle}>Bevestig Wachtwoord</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Herhaal wachtwoord" style={inputStyle} required minLength={6} />
            </div>
          )}

          <button type="submit" disabled={busy} style={submitBtn}>
            {busy ? 'Laden...' : mode === 'signin' ? 'Inloggen' : mode === 'signup' ? 'Account Aanmaken' : 'Reset Link Versturen'}
          </button>
        </form>

        <div style={linksStyle}>
          {mode === 'signin' && (
            <>
              <button onClick={() => { setMode('signup'); setError(''); setMessage('') }} style={linkBtn}>Nog geen account? Maak er een aan</button>
              <button onClick={() => { setMode('reset'); setError(''); setMessage('') }} style={linkBtn}>Wachtwoord vergeten?</button>
            </>
          )}
          {mode === 'signup' && (
            <button onClick={() => { setMode('signin'); setError(''); setMessage('') }} style={linkBtn}>Al een account? Log in</button>
          )}
          {mode === 'reset' && (
            <button onClick={() => { setMode('signin'); setError(''); setMessage('') }} style={linkBtn}>Terug naar inloggen</button>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={pageStyle}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={logoStyle}>YarnZoo Studio</h1>
        <p style={{ color: '#666', fontSize: '14px', marginTop: '16px' }}>Laden...</p>
      </div>
    </div>
  )
}

function AppWithGate() {
  const { user, loading } = useAuth()

  if (!hasSupabaseConfig) return <App />
  if (loading) return <LoadingScreen />
  if (!user) return <LoginScreen />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppWithGate />
    </AuthProvider>
  </React.StrictMode>,
)

// Styles
const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg, #FFEDEC 0%, #FFF1DB 50%, #FFEDEC 100%)',
  fontFamily: "'CamptonMedium', 'Campton Medium', -apple-system, sans-serif",
  padding: '20px',
}

const cardStyle = {
  background: '#FFFFFF',
  borderRadius: '16px',
  padding: '40px 32px',
  maxWidth: '420px',
  width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
}

const logoStyle = {
  fontSize: '32px',
  fontWeight: 800,
  color: '#E74016',
  textAlign: 'center',
  margin: 0,
  fontFamily: "'SketchSolid', 'CamptonMedium', sans-serif",
}

const subtitleStyle = {
  fontSize: '13px',
  color: '#888',
  textAlign: 'center',
  marginTop: '4px',
  marginBottom: '28px',
}

const titleStyle = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#444249',
  marginBottom: '20px',
  textAlign: 'center',
}

const formStyle = { display: 'flex', flexDirection: 'column', gap: '16px' }
const fieldStyle = { display: 'flex', flexDirection: 'column', gap: '6px' }
const labelStyle = { fontSize: '12px', fontWeight: 600, color: '#444249', textTransform: 'uppercase', letterSpacing: '0.5px' }

const inputStyle = {
  padding: '12px 16px',
  border: '2px solid #E6E6E6',
  borderRadius: '8px',
  fontSize: '14px',
  outline: 'none',
  fontFamily: 'inherit',
}

const submitBtn = {
  background: 'linear-gradient(135deg, #E74016, #F5921B)',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '8px',
  padding: '14px',
  fontSize: '16px',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: '8px',
  boxShadow: '0 4px 16px rgba(231,64,22,0.25)',
  fontFamily: 'inherit',
}

const linksStyle = { marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }
const linkBtn = { background: 'transparent', border: 'none', color: '#E74016', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }

const errorStyle = { background: '#FEE', border: '1px solid #F88', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#C00', marginBottom: '8px' }
const messageStyle = { background: '#EFE', border: '1px solid #8F8', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#080', marginBottom: '8px' }
