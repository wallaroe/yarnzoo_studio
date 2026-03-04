import { useState } from 'react'
import { saveChart } from '../lib/database'
import { useSystemDialog } from './SystemDialogProvider'

const B = {
    orange: "#F5921B",
    darkGreen: "#2D5A27",
    cream: "#FAF7F2",
    beige: "#EDE8DF",
    dark: "#2A2A2A",
    white: "#FFFFFF",
}

export default function SaveChartModal({ chart, chartData, onClose, onSaved, existingChart = null }) {
    const { showConfirm } = useSystemDialog()
    const [title, setTitle] = useState(existingChart?.title || '')
    const [description, setDescription] = useState(existingChart?.description || '')
    const [isPublic, setIsPublic] = useState(existingChart?.is_public || false)
    const [saveAsNew, setSaveAsNew] = useState(!!existingChart?.id)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const willOverwriteExisting = !!existingChart?.id && !saveAsNew

    const handleSave = async () => {
        if (!title.trim()) {
            setError('Geef je patroon een naam')
            return
        }

        if (willOverwriteExisting) {
            const confirmed = await showConfirm(
                'Je staat op het punt een bestaand cloudpatroon te overschrijven. Weet je dit zeker?',
                {
                    title: 'Cloudpatroon overschrijven',
                    confirmLabel: 'Overschrijven',
                    cancelLabel: 'Annuleren',
                    tone: 'danger',
                }
            )
            if (!confirmed) return
        }

        setLoading(true)
        setError('')

        try {
            const { data, error: saveError } = await saveChart({
                chartId: willOverwriteExisting ? existingChart?.id : null,
                expectedUpdatedAt: willOverwriteExisting ? (existingChart?.updated_at || null) : null,
                title: title.trim(),
                description: description.trim(),
                chartData: chart,
                gridWidth: chart[0].length,
                gridHeight: chart.length,
                colorA: chartData.colA,
                colorB: chartData.colB,
                config: chartData.config,
                isPublic,
            })

            if (saveError) {
                if (saveError.code === 'CONFLICT') {
                    throw new Error('Dit patroon is intussen aangepast. Open de laatste versie uit de bibliotheek en probeer opnieuw.')
                }
                throw saveError
            }

            onSaved(data)
            onClose()
        } catch (err) {
            setError(err.message || 'Kon patroon niet opslaan')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} style={closeBtn}>✕</button>

                <h2 style={titleStyle}>
                    {willOverwriteExisting ? '✏️ Patroon Overschrijven' : '💾 Patroon Opslaan'}
                </h2>

                {error && <div style={errorStyle}>⚠️ {error}</div>}

                <div style={formStyle}>
                    {existingChart?.id && (
                        <div style={overwriteGuardStyle}>
                            <label style={overwriteGuardLabel}>
                                <input
                                    type="checkbox"
                                    checked={saveAsNew}
                                    onChange={(e) => setSaveAsNew(e.target.checked)}
                                />
                                Opslaan als nieuw patroon (veilig)
                            </label>
                            <div style={overwriteGuardText}>
                                Zet dit uit als je bewust het bestaande cloudpatroon wilt overschrijven.
                            </div>
                        </div>
                    )}

                    <div style={fieldStyle}>
                        <label style={labelStyle}>Patroon Naam *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Bijv: Giraffe Patroon"
                            style={inputStyle}
                            autoFocus
                        />
                    </div>

                    <div style={fieldStyle}>
                        <label style={labelStyle}>Beschrijving (optioneel)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Extra notities over dit patroon..."
                            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                        />
                    </div>

                    <div style={fieldStyle}>
                        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isPublic}
                                onChange={(e) => setIsPublic(e.target.checked)}
                            />
                            Maak dit patroon publiek zichtbaar
                        </label>
                        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                            Andere gebruikers kunnen dit patroon zien en gebruiken
                        </div>
                    </div>

                    <div style={statsStyle}>
                        <div>📐 {chart[0].length} × {chart.length} steken</div>
                        <div>🎨 {chartData.colA.name} & {chartData.colB.name}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button onClick={onClose} style={cancelBtn} disabled={loading}>
                            Annuleren
                        </button>
                        <button onClick={handleSave} style={saveBtn} disabled={loading}>
                            {loading ? '⏳ Opslaan...' : willOverwriteExisting ? 'Bestaand overschrijven' : 'Opslaan als nieuw'}
                        </button>
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
    maxWidth: '480px',
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
    marginBottom: '24px',
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
    fontFamily: 'inherit',
}

const statsStyle = {
    display: 'flex',
    gap: '16px',
    padding: '12px',
    background: B.cream,
    borderRadius: '8px',
    fontSize: '12px',
    color: '#666',
}

const overwriteGuardStyle = {
    border: `1px solid ${B.beige}`,
    background: B.cream,
    borderRadius: '8px',
    padding: '12px',
}

const overwriteGuardLabel = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 700,
    color: B.darkGreen,
    cursor: 'pointer',
}

const overwriteGuardText = {
    fontSize: '11px',
    color: '#666',
    marginTop: '6px',
}

const saveBtn = {
    flex: 1,
    background: `linear-gradient(135deg, ${B.orange}, #F7A63E)`,
    color: B.white,
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: `0 4px 16px ${B.orange}40`,
}

const cancelBtn = {
    flex: 1,
    background: B.white,
    color: B.dark,
    border: `2px solid ${B.beige}`,
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
}

const errorStyle = {
    background: '#FEE',
    border: '1px solid #F88',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    color: '#C00',
    marginBottom: '8px',
}
