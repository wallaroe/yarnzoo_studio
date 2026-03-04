import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import AuthModal from './AuthModal'
import SaveChartModal from './SaveChartModal'
import LibraryModal from './LibraryModal'
import ShareModal from './ShareModal'

const B = {
    orange: "#F5921B",
    darkGreen: "#2D5A27",
    lightGreen: "#4A8C3F",
    white: "#FFFFFF",
    dark: "#2A2A2A",
}

export default function CloudToolbar({ chart, chartData, currentChartId, onChartLoaded }) {
    const { user, signOut } = useAuth()
    const [showAuthModal, setShowAuthModal] = useState(false)
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [showLibraryModal, setShowLibraryModal] = useState(false)
    const [showShareModal, setShowShareModal] = useState(false)
    const [savedChart, setSavedChart] = useState(currentChartId ? { id: currentChartId } : null)

    const handleChartSaved = (savedChart) => {
        setSavedChart(savedChart)
        alert(`✅ Patroon "${savedChart.title}" opgeslagen in de cloud!`)
    }

    const handleLoadChart = (chartData) => {
        if (chartData?.id) {
            setSavedChart({
                id: chartData.id,
                title: chartData.title,
                description: chartData.description,
                is_public: chartData.is_public,
                updated_at: chartData.updated_at,
            })
        }
        if (onChartLoaded) {
            onChartLoaded(chartData)
        }
    }

    return (
        <>
            <div style={toolbarStyle}>
                <div style={leftGroupStyle}>
                    <div style={brandStyle}>
                        <span style={{ fontSize: '20px' }}>☁️</span>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Cloud Features</span>
                    </div>
                </div>

                <div style={centerGroupStyle}>
                    {user && chart && (
                        <>
                            <button onClick={() => setShowSaveModal(true)} style={primaryBtnStyle}>
                                💾 Opslaan in Cloud
                            </button>
                            <button onClick={() => setShowLibraryModal(true)} style={secondaryBtnStyle}>
                                📚 Mijn Bibliotheek
                            </button>
                            {savedChart?.id && (
                                <button onClick={() => setShowShareModal(true)} style={secondaryBtnStyle}>
                                    🔗 Delen
                                </button>
                            )}
                        </>
                    )}
                </div>

                <div style={rightGroupStyle}>
                    {user ? (
                        <>
                            <div style={userInfoStyle}>
                                <span style={{ fontSize: '20px' }}>👤</span>
                                <span style={{ fontSize: '12px' }}>{user.email}</span>
                            </div>
                            <button onClick={signOut} style={logoutBtnStyle}>
                                Uitloggen
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setShowAuthModal(true)} style={loginBtnStyle}>
                            🔐 Inloggen
                        </button>
                    )}
                </div>
            </div>

            {showAuthModal && (
                <AuthModal onClose={() => setShowAuthModal(false)} />
            )}

            {showSaveModal && chart && (
                <SaveChartModal
                    chart={chart}
                    chartData={chartData}
                    onClose={() => setShowSaveModal(false)}
                    onSaved={handleChartSaved}
                    existingChart={savedChart}
                />
            )}

            {showLibraryModal && (
                <LibraryModal
                    onClose={() => setShowLibraryModal(false)}
                    onLoadChart={handleLoadChart}
                />
            )}

            {showShareModal && savedChart?.id && (
                <ShareModal
                    chartId={savedChart.id}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </>
    )
}

const toolbarStyle = {
    background: `linear-gradient(135deg, ${B.darkGreen}, ${B.lightGreen})`,
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    position: 'sticky',
    top: 0,
    zIndex: 999,
    gap: '16px',
    flexWrap: 'wrap',
}

const leftGroupStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
}

const centerGroupStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    justifyContent: 'center',
    flexWrap: 'wrap',
}

const rightGroupStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
}

const brandStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: B.white,
}

const userInfoStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: B.white,
    background: 'rgba(255,255,255,0.1)',
    padding: '6px 12px',
    borderRadius: '20px',
}

const baseBtnStyle = {
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
}

const primaryBtnStyle = {
    ...baseBtnStyle,
    background: B.orange,
    color: B.white,
    boxShadow: `0 2px 8px ${B.orange}60`,
}

const secondaryBtnStyle = {
    ...baseBtnStyle,
    background: 'rgba(255,255,255,0.9)',
    color: B.darkGreen,
}

const loginBtnStyle = {
    ...baseBtnStyle,
    background: B.white,
    color: B.darkGreen,
}

const logoutBtnStyle = {
    ...baseBtnStyle,
    background: 'transparent',
    color: B.white,
    border: `1px solid ${B.white}`,
    fontSize: '11px',
    padding: '6px 12px',
}
