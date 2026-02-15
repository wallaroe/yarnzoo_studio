import { useState } from 'react'
import { useAuth } from './lib/AuthContext'
import AuthModal from './components/AuthModal'

const B = {
    orange: "#F5921B",
    darkGreen: "#2D5A27",
    lightGreen: "#4A8C3F",
    white: "#FFFFFF",
}

export default function SimpleCloudDemo() {
    const { user, signOut } = useAuth()
    const [showAuthModal, setShowAuthModal] = useState(false)

    return (
        <>
            <div style={bannerStyle}>
                <div style={contentStyle}>
                    <span style={{ fontSize: '24px' }}>☁️</span>
                    <span style={textStyle}>
                        {user ? `Ingelogd als ${user.email}` : 'Cloud features beschikbaar!'}
                    </span>
                </div>
                <div>
                    {user ? (
                        <button onClick={signOut} style={btnStyle}>
                            Uitloggen
                        </button>
                    ) : (
                        <button onClick={() => setShowAuthModal(true)} style={btnStyle}>
                            🔐 Probeer Cloud Features
                        </button>
                    )}
                </div>
            </div>

            {showAuthModal && (
                <AuthModal onClose={() => setShowAuthModal(false)} />
            )}
        </>
    )
}

const bannerStyle = {
    background: `linear-gradient(135deg, ${B.darkGreen}, ${B.lightGreen})`,
    color: B.white,
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    flexWrap: 'wrap',
    gap: '12px',
}

const contentStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
}

const textStyle = {
    fontSize: '14px',
    fontWeight: 600,
}

const btnStyle = {
    background: B.white,
    color: B.darkGreen,
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
}
