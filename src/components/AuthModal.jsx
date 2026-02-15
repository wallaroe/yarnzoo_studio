import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

const B = {
    orange: "#F5921B",
    darkGreen: "#2D5A27",
    cream: "#FAF7F2",
    beige: "#EDE8DF",
    dark: "#2A2A2A",
    white: "#FFFFFF",
}

export default function AuthModal({ onClose }) {
    const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'reset'
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [name, setName] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const { signIn, signUp, resetPassword } = useAuth()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setMessage('')
        setLoading(true)

        try {
            if (mode === 'signup') {
                if (password !== confirmPassword) {
                    setError('Wachtwoorden komen niet overeen')
                    setLoading(false)
                    return
                }
                if (password.length < 6) {
                    setError('Wachtwoord moet minimaal 6 tekens zijn')
                    setLoading(false)
                    return
                }

                const { error } = await signUp(email, password, { name })
                if (error) throw error
                setMessage('Account aangemaakt! Check je email voor verificatie.')
            } else if (mode === 'signin') {
                const { error } = await signIn(email, password)
                if (error) throw error
                onClose()
            } else if (mode === 'reset') {
                const { error } = await resetPassword(email)
                if (error) throw error
                setMessage('Wachtwoord reset link is verzonden naar je email!')
            }
        } catch (err) {
            setError(err.message || 'Er is iets misgegaan')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} style={closeBtn}>✕</button>

                <h2 style={titleStyle}>
                    {mode === 'signin' && '🐒 Inloggen'}
                    {mode === 'signup' && '🎨 Account Aanmaken'}
                    {mode === 'reset' && '🔑 Wachtwoord Resetten'}
                </h2>

                {error && <div style={errorStyle}>⚠️ {error}</div>}
                {message && <div style={messageStyle}>✅ {message}</div>}

                <form onSubmit={handleSubmit} style={formStyle}>
                    {mode === 'signup' && (
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Naam</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Je naam"
                                style={inputStyle}
                                required
                            />
                        </div>
                    )}

                    <div style={fieldStyle}>
                        <label style={labelStyle}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="jouw@email.nl"
                            style={inputStyle}
                            required
                        />
                    </div>

                    {mode !== 'reset' && (
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Wachtwoord</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={inputStyle}
                                required
                                minLength={6}
                            />
                        </div>
                    )}

                    {mode === 'signup' && (
                        <div style={fieldStyle}>
                            <label style={labelStyle}>Bevestig Wachtwoord</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                style={inputStyle}
                                required
                                minLength={6}
                            />
                        </div>
                    )}

                    <button type="submit" disabled={loading} style={submitBtn}>
                        {loading ? '⏳ Laden...' : mode === 'signin' ? 'Inloggen' : mode === 'signup' ? 'Account Aanmaken' : 'Reset Link Versturen'}
                    </button>
                </form>

                <div style={linksStyle}>
                    {mode === 'signin' && (
                        <>
                            <button onClick={() => setMode('signup')} style={linkBtn}>Nog geen account? Maak er één aan</button>
                            <button onClick={() => setMode('reset')} style={linkBtn}>Wachtwoord vergeten?</button>
                        </>
                    )}
                    {mode === 'signup' && (
                        <button onClick={() => setMode('signin')} style={linkBtn}>Al een account? Log in</button>
                    )}
                    {mode === 'reset' && (
                        <button onClick={() => setMode('signin')} style={linkBtn}>← Terug naar inloggen</button>
                    )}
                </div>
            </div>
        </div>
    )
}

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
}

const modalStyle = {
    background: B.white,
    borderRadius: '16px',
    padding: '32px',
    maxWidth: '420px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    position: 'relative',
}

const closeBtn = {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#999',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
}

const titleStyle = {
    fontSize: '24px',
    fontWeight: 800,
    color: B.darkGreen,
    marginBottom: '24px',
    textAlign: 'center',
}

const formStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
}

const fieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
}

const labelStyle = {
    fontSize: '12px',
    fontWeight: 600,
    color: B.dark,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
}

const inputStyle = {
    padding: '12px 16px',
    border: `2px solid ${B.beige}`,
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
}

const submitBtn = {
    background: `linear-gradient(135deg, ${B.orange}, #F7A63E)`,
    color: B.white,
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '8px',
    boxShadow: `0 4px 16px ${B.orange}40`,
}

const linksStyle = {
    marginTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
}

const linkBtn = {
    background: 'transparent',
    border: 'none',
    color: B.orange,
    fontSize: '13px',
    cursor: 'pointer',
    textDecoration: 'underline',
}

const errorStyle = {
    background: '#FEE',
    border: '1px solid #F88',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    color: '#C00',
    marginBottom: '16px',
}

const messageStyle = {
    background: '#EFE',
    border: '1px solid #8F8',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    color: '#080',
    marginBottom: '16px',
}
