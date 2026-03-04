import { useState } from 'react'
import { shareChart } from '../lib/database'
import { useSystemDialog } from './SystemDialogProvider'

const B = {
    orange: "#F5921B",
    darkGreen: "#2D5A27",
    cream: "#FAF7F2",
    beige: "#EDE8DF",
    dark: "#2A2A2A",
    white: "#FFFFFF",
}

export default function ShareModal({ chartId, onClose }) {
    const { showAlert } = useSystemDialog()
    const [loading, setLoading] = useState(false)
    const [shareLink, setShareLink] = useState('')
    const [copied, setCopied] = useState(false)

    const generateShareLink = async () => {
        setLoading(true)
        try {
            const { data, error } = await shareChart(chartId, { generateToken: true })
            if (error) throw error

            const link = `${window.location.origin}/?share=${data.share_token}`
            setShareLink(link)
        } catch (err) {
            showAlert('Kon geen deellink genereren: ' + err.message, { title: 'Delen mislukt', tone: 'danger' })
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} style={closeBtn}>✕</button>

                <h2 style={titleStyle}>🔗 Patroon Delen</h2>

                <div style={infoStyle}>
                    <div style={{ fontSize: '14px', marginBottom: '12px' }}>
                        Genereer een deelbare link om dit patroon met anderen te delen.
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                        ⚠️ Iedereen met de link kan dit patroon bekijken en laden.
                    </div>
                </div>

                {!shareLink ? (
                    <button
                        onClick={generateShareLink}
                        disabled={loading}
                        style={generateBtn}
                    >
                        {loading ? '⏳ Genereren...' : '🔗 Genereer Deel-Link'}
                    </button>
                ) : (
                    <div>
                        <div style={linkBoxStyle}>
                            <input
                                type="text"
                                value={shareLink}
                                readOnly
                                style={linkInputStyle}
                            />
                            <button onClick={copyToClipboard} style={copyBtnStyle}>
                                {copied ? '✓ Gekopieerd!' : '📋 Kopieer'}
                            </button>
                        </div>

                        <div style={successStyle}>
                            ✅ Link gegenereerd! Deel deze link om het patroon te delen.
                        </div>
                    </div>
                )}

                <div style={featuresStyle}>
                    <div style={featureItemStyle}>
                        <span>🔒</span>
                        <div>
                            <strong>Veilig</strong>
                            <div style={{ fontSize: '11px', color: '#666' }}>
                                Alleen mensen met de link kunnen het patroon zien
                            </div>
                        </div>
                    </div>
                    <div style={featureItemStyle}>
                        <span>👁️</span>
                        <div>
                            <strong>Alleen bekijken</strong>
                            <div style={{ fontSize: '11px', color: '#666' }}>
                                Anderen kunnen het patroon kopiëren, maar niet jouw origineel aanpassen
                            </div>
                        </div>
                    </div>
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
    maxWidth: '520px',
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
}

const titleStyle = {
    fontSize: '24px',
    fontWeight: 800,
    color: B.darkGreen,
    marginBottom: '20px',
}

const infoStyle = {
    background: B.cream,
    border: `1px solid ${B.beige}`,
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px',
}

const generateBtn = {
    width: '100%',
    background: `linear-gradient(135deg, ${B.orange}, #F7A63E)`,
    color: B.white,
    border: 'none',
    borderRadius: '8px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: `0 4px 16px ${B.orange}40`,
}

const linkBoxStyle = {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
}

const linkInputStyle = {
    flex: 1,
    padding: '12px 16px',
    border: `2px solid ${B.beige}`,
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'monospace',
    background: B.cream,
}

const copyBtnStyle = {
    background: B.darkGreen,
    color: B.white,
    border: 'none',
    borderRadius: '8px',
    padding: '12px 20px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
}

const successStyle = {
    background: '#E8F5E9',
    border: '1px solid #81C784',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    color: '#2E7D32',
    marginBottom: '20px',
}

const featuresStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '20px',
}

const featureItemStyle = {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    fontSize: '14px',
}
