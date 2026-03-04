import { useState, useEffect } from 'react'
import { loadUserCharts, loadUserFolders, deleteChart, renameChart, createFolder, deleteFolder } from '../lib/database'
import { useAuth } from '../lib/AuthContext'
import { useSystemDialog } from './SystemDialogProvider'

const B = {
    orange: "#F5921B",
    darkGreen: "#2D5A27",
    cream: "#FAF7F2",
    beige: "#EDE8DF",
    dark: "#2A2A2A",
    white: "#FFFFFF",
}

const formatChartLastSaved = (updatedAt, createdAt) => {
    const timestamp = updatedAt || createdAt
    if (!timestamp) return 'Onbekend'

    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return 'Onbekend'

    return new Intl.DateTimeFormat('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

export default function LibraryModal({ onClose, onLoadChart }) {
    const { user } = useAuth()
    const { showConfirm } = useSystemDialog()
    const [charts, setCharts] = useState([])
    const [folders, setFolders] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState('charts') // 'charts' | 'folders'
    const [newFolderName, setNewFolderName] = useState('')
    const [editingChartId, setEditingChartId] = useState(null)
    const [editTitle, setEditTitle] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        const [chartsRes, foldersRes] = await Promise.all([
            loadUserCharts(),
            loadUserFolders()
        ])

        if (!chartsRes.error) setCharts(chartsRes.data || [])
        if (!foldersRes.error) setFolders(foldersRes.data || [])
        setLoading(false)
    }

    const handleDeleteChart = async (chartId) => {
        const confirmed = await showConfirm('Weet je zeker dat je dit patroon wilt verwijderen?', {
            title: 'Patroon verwijderen',
            confirmLabel: 'Verwijderen',
            cancelLabel: 'Annuleren',
            tone: 'danger',
        })
        if (!confirmed) return

        const { error } = await deleteChart(chartId)
        if (!error) {
            setCharts(charts.filter(c => c.id !== chartId))
        }
    }

    const handleLoadChart = (chart) => {
        onLoadChart(chart)
        onClose()
    }

    const startEditing = (chart) => {
        setEditingChartId(chart.id)
        setEditTitle(chart.title)
    }

    const cancelEditing = () => {
        setEditingChartId(null)
        setEditTitle('')
    }

    const handleRenameChart = async (chartId) => {
        if (!editTitle.trim()) {
            cancelEditing()
            return
        }

        const { data, error } = await renameChart(chartId, editTitle.trim())
        if (!error && data) {
            setCharts(charts.map(c => c.id === chartId ? { ...c, ...data } : c))
        }
        cancelEditing()
    }

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return

        const { data, error } = await createFolder(newFolderName.trim())
        if (!error && data) {
            setFolders([data, ...folders])
            setNewFolderName('')
        }
    }

    const handleDeleteFolder = async (folderId) => {
        const confirmed = await showConfirm('Weet je zeker dat je deze map wilt verwijderen?', {
            title: 'Map verwijderen',
            confirmLabel: 'Verwijderen',
            cancelLabel: 'Annuleren',
            tone: 'danger',
        })
        if (!confirmed) return

        const { error } = await deleteFolder(folderId)
        if (!error) {
            setFolders(folders.filter(f => f.id !== folderId))
        }
    }

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} style={closeBtn}>✕</button>

                <h2 style={titleStyle}>📚 Mijn Bibliotheek</h2>

                <div style={tabsStyle}>
                    <button
                        onClick={() => setView('charts')}
                        style={{ ...tabBtn, ...(view === 'charts' ? tabBtnActive : {}) }}
                    >
                        🎨 Patronen ({charts.length})
                    </button>
                    <button
                        onClick={() => setView('folders')}
                        style={{ ...tabBtn, ...(view === 'folders' ? tabBtnActive : {}) }}
                    >
                        📁 Mappen ({folders.length})
                    </button>
                </div>

                {loading ? (
                    <div style={loadingStyle}>⏳ Laden...</div>
                ) : (
                    <>
                        {view === 'charts' && (
                            <div style={contentStyle}>
                                {charts.length === 0 ? (
                                    <div style={emptyStyle}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
                                        <div>Je hebt nog geen patronen opgeslagen</div>
                                        <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                                            Maak een patroon en klik op "Opslaan in Cloud"
                                        </div>
                                    </div>
                                ) : (
                                    <div style={gridStyle}>
                                        {charts.map(chart => {
                                            const lastSaved = formatChartLastSaved(chart.updated_at, chart.created_at)

                                            return (
                                            <div key={chart.id} style={chartCardStyle}>
                                                <div style={chartHeaderStyle}>
                                                    {editingChartId === chart.id ? (
                                                        <div style={editTitleWrap}>
                                                            <input
                                                                type="text"
                                                                value={editTitle}
                                                                onChange={(e) => setEditTitle(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleRenameChart(chart.id)
                                                                    if (e.key === 'Escape') cancelEditing()
                                                                }}
                                                                style={editTitleInput}
                                                                autoFocus
                                                            />
                                                            <button onClick={() => handleRenameChart(chart.id)} style={editSaveBtn}>✓</button>
                                                            <button onClick={cancelEditing} style={editCancelBtn}>✕</button>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div style={chartTitleStyle}>{chart.title}</div>
                                                            {chart.is_public && <span style={publicBadge}>🌐 Publiek</span>}
                                                        </>
                                                    )}
                                                </div>
                                                {chart.description && (
                                                    <div style={chartDescStyle}>{chart.description}</div>
                                                )}
                                                <div style={chartMetaStyle}>
                                                    <div>📐 {chart.grid_width} × {chart.grid_height}</div>
                                                    <div>🎨 {chart.color_a.name} & {chart.color_b.name}</div>
                                                    <div>🕒 Laatst opgeslagen: {lastSaved}</div>
                                                </div>
                                                <div style={chartActionsStyle}>
                                                    <button
                                                        onClick={() => handleLoadChart(chart)}
                                                        style={loadBtnStyle}
                                                    >
                                                        📥 Laden
                                                    </button>
                                                    <button
                                                        onClick={() => startEditing(chart)}
                                                        style={editBtnStyle}
                                                        title="Hernoemen"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteChart(chart.id)}
                                                        style={deleteBtnStyle}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {view === 'folders' && (
                            <div style={contentStyle}>
                                <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        placeholder="Nieuwe map naam..."
                                        style={{ ...inputStyle, flex: 1 }}
                                        onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                                    />
                                    <button onClick={handleCreateFolder} style={addFolderBtn}>
                                        ➕ Toevoegen
                                    </button>
                                </div>

                                {folders.length === 0 ? (
                                    <div style={emptyStyle}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                                        <div>Nog geen mappen aangemaakt</div>
                                    </div>
                                ) : (
                                    <div style={foldersListStyle}>
                                        {folders.map(folder => (
                                            <div key={folder.id} style={folderItemStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                    <div style={{ ...folderIconStyle, background: folder.color }}>📁</div>
                                                    <div>
                                                        <div style={folderNameStyle}>{folder.name}</div>
                                                        <div style={folderMetaStyle}>
                                                            {folder.chart_folders?.length || 0} patronen
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteFolder(folder.id)}
                                                    style={deleteBtnStyle}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
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
    maxWidth: '800px',
    width: '90%',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
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

const tabsStyle = {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    borderBottom: `2px solid ${B.beige}`,
}

const tabBtn = {
    background: 'transparent',
    border: 'none',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#666',
    borderBottom: '3px solid transparent',
    marginBottom: '-2px',
}

const tabBtnActive = {
    color: B.orange,
    borderBottom: `3px solid ${B.orange}`,
}

const contentStyle = {
    flex: 1,
    overflowY: 'auto',
}

const loadingStyle = {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
}

const emptyStyle = {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#999',
}

const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
}

const chartCardStyle = {
    background: B.cream,
    border: `1px solid ${B.beige}`,
    borderRadius: '12px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
}

const chartHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
}

const chartTitleStyle = {
    fontSize: '16px',
    fontWeight: 700,
    color: B.darkGreen,
    flex: 1,
}

const publicBadge = {
    fontSize: '10px',
    background: B.orange,
    color: B.white,
    padding: '2px 8px',
    borderRadius: '12px',
    whiteSpace: 'nowrap',
}

const chartDescStyle = {
    fontSize: '12px',
    color: '#666',
    lineHeight: 1.4,
}

const chartMetaStyle = {
    fontSize: '11px',
    color: '#999',
    lineHeight: 1.5,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
}

const chartActionsStyle = {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
}

const loadBtnStyle = {
    flex: 1,
    background: B.orange,
    color: B.white,
    border: 'none',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
}

const deleteBtnStyle = {
    background: 'transparent',
    border: `1px solid ${B.beige}`,
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
}

const inputStyle = {
    padding: '10px 14px',
    border: `2px solid ${B.beige}`,
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
}

const addFolderBtn = {
    background: B.darkGreen,
    color: B.white,
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
}

const foldersListStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
}

const folderItemStyle = {
    background: B.cream,
    border: `1px solid ${B.beige}`,
    borderRadius: '8px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
}

const folderIconStyle = {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
}

const folderNameStyle = {
    fontSize: '15px',
    fontWeight: 600,
    color: B.dark,
}

const folderMetaStyle = {
    fontSize: '11px',
    color: '#999',
}

const editBtnStyle = {
    background: 'transparent',
    border: `1px solid ${B.beige}`,
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '13px',
    cursor: 'pointer',
}

const editTitleWrap = {
    display: 'flex',
    gap: '4px',
    flex: 1,
    alignItems: 'center',
}

const editTitleInput = {
    flex: 1,
    padding: '6px 10px',
    border: `2px solid ${B.orange}`,
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    outline: 'none',
}

const editSaveBtn = {
    background: B.darkGreen,
    color: B.white,
    border: 'none',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '14px',
    cursor: 'pointer',
}

const editCancelBtn = {
    background: 'transparent',
    border: `1px solid ${B.beige}`,
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '14px',
    cursor: 'pointer',
}
