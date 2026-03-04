import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const B = {
    orange: '#E74016',
    orangeHover: '#C63713',
    dark: '#444249',
    white: '#FFFFFF',
    cream: '#FFEDEC',
    border: '#E6E6E6',
}

const SystemDialogContext = createContext({
    showAlert: async () => undefined,
    showConfirm: async () => false,
})

export function SystemDialogProvider({ children }) {
    const queueRef = useRef([])
    const [activeDialog, setActiveDialog] = useState(null)

    const openNextDialog = useCallback(() => {
        setActiveDialog((current) => {
            if (current || queueRef.current.length === 0) return current
            return queueRef.current.shift()
        })
    }, [])

    const enqueueDialog = useCallback((dialog) => {
        return new Promise((resolve) => {
            queueRef.current.push({ ...dialog, resolve })
            openNextDialog()
        })
    }, [openNextDialog])

    useEffect(() => {
        if (!activeDialog) openNextDialog()
    }, [activeDialog, openNextDialog])

    const resolveActiveDialog = useCallback((result) => {
        setActiveDialog((current) => {
            if (!current) return current
            current.resolve(result)
            return null
        })
    }, [])

    useEffect(() => {
        if (!activeDialog) return undefined
        const onKeyDown = (event) => {
            if (event.key !== 'Escape') return
            resolveActiveDialog(activeDialog.kind === 'confirm' ? false : undefined)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [activeDialog, resolveActiveDialog])

    const showAlert = useCallback((message, options = {}) => {
        return enqueueDialog({
            kind: 'alert',
            title: options.title || 'Melding',
            message: String(message || ''),
            confirmLabel: options.confirmLabel || 'OK',
            tone: options.tone || 'info',
        })
    }, [enqueueDialog])

    const showConfirm = useCallback((message, options = {}) => {
        return enqueueDialog({
            kind: 'confirm',
            title: options.title || 'Bevestigen',
            message: String(message || ''),
            confirmLabel: options.confirmLabel || 'Doorgaan',
            cancelLabel: options.cancelLabel || 'Annuleren',
            tone: options.tone || 'warning',
        })
    }, [enqueueDialog])

    const confirmButtonStyle = activeDialog?.tone === 'danger'
        ? { ...primaryButtonStyle, background: '#B03024', boxShadow: '0 4px 16px rgba(176,48,36,0.35)' }
        : primaryButtonStyle

    return (
        <SystemDialogContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            {activeDialog && (
                <div
                    style={overlayStyle}
                    onClick={() => resolveActiveDialog(activeDialog.kind === 'confirm' ? false : undefined)}
                >
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h3 style={titleStyle}>{activeDialog.title}</h3>
                        <div style={messageStyle}>
                            {activeDialog.message.split('\n').map((line, idx) => (
                                <p key={`${idx}-${line}`} style={lineStyle}>{line}</p>
                            ))}
                        </div>
                        <div style={actionsStyle}>
                            {activeDialog.kind === 'confirm' && (
                                <button
                                    style={secondaryButtonStyle}
                                    onClick={() => resolveActiveDialog(false)}
                                >
                                    {activeDialog.cancelLabel}
                                </button>
                            )}
                            <button
                                style={confirmButtonStyle}
                                onClick={() => resolveActiveDialog(activeDialog.kind === 'confirm' ? true : undefined)}
                            >
                                {activeDialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </SystemDialogContext.Provider>
    )
}

export function useSystemDialog() {
    return useContext(SystemDialogContext)
}

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.52)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    backdropFilter: 'blur(4px)',
    padding: '20px',
}

const modalStyle = {
    width: '100%',
    maxWidth: '520px',
    background: B.white,
    borderRadius: '16px',
    border: `1px solid ${B.border}`,
    boxShadow: '0 28px 70px rgba(0,0,0,0.28)',
    padding: '24px',
    fontFamily: "'CamptonMedium', 'Campton Medium', sans-serif",
}

const titleStyle = {
    margin: 0,
    marginBottom: '12px',
    fontSize: '24px',
    lineHeight: 1.1,
    color: B.orange,
    fontWeight: 800,
}

const messageStyle = {
    background: B.cream,
    border: `1px solid ${B.border}`,
    borderRadius: '10px',
    padding: '12px 14px',
}

const lineStyle = {
    margin: 0,
    color: B.dark,
    fontSize: '14px',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
}

const actionsStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '18px',
}

const buttonBase = {
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    padding: '10px 16px',
    cursor: 'pointer',
    minWidth: '110px',
}

const primaryButtonStyle = {
    ...buttonBase,
    color: B.white,
    background: `linear-gradient(135deg, ${B.orange}, ${B.orangeHover})`,
    boxShadow: '0 4px 16px rgba(231,64,22,0.35)',
}

const secondaryButtonStyle = {
    ...buttonBase,
    background: B.white,
    color: B.dark,
    border: `1px solid ${B.border}`,
}
