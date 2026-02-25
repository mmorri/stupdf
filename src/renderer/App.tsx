import React, { useEffect, useCallback, useState } from 'react'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import PDFViewer from './components/PDFViewer'
import { usePDFStore } from './store/pdfStore'
import { savePdfWithAnnotations } from './utils/pdfSave'

export default function App() {
  const { setPdfData, setFilePath, filePath, pdfData, annotations, clearAnnotations,
    tool, setTool, textExtracted, textExtracting, setTextExtracting, setTextSpans, clearTextEdits,
    getPendingEditsArray, setTextExtracted, undo, redo, dirty, setDirty } = usePDFStore()

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleOpen = useCallback(async () => {
    const result = await window.electronAPI.openFile()
    if (!result) return
    clearAnnotations()
    clearTextEdits()
    setFilePath(result.filePath)
    setPdfData(result.data)
  }, [clearAnnotations, clearTextEdits, setFilePath, setPdfData])

  const applyAllEdits = useCallback(async (targetPath: string): Promise<ArrayBuffer> => {
    let basePdfData = pdfData!
    const pendingTextEdits = getPendingEditsArray()

    // If there are text edits, apply them via Python first
    if (pendingTextEdits.length > 0) {
      // Write current pdfData to a temp file for Python to read
      const tempInput = await window.electronAPI.getTempPath('_input.pdf')
      const tempOutput = await window.electronAPI.getTempPath('_output.pdf')
      await window.electronAPI.writeFile(tempInput, pdfData!)

      const result = await window.electronAPI.applyTextEdits(tempInput, tempOutput, pendingTextEdits)
      if (!result.ok) {
        await window.electronAPI.deleteFile(tempInput).catch(() => {})
        await window.electronAPI.deleteFile(tempOutput).catch(() => {})
        throw new Error(result.error || 'Failed to apply text edits')
      }

      // Read the Python-edited PDF back
      basePdfData = await window.electronAPI.readFile(tempOutput)

      // Clean up temp files
      await window.electronAPI.deleteFile(tempInput).catch(() => {})
      await window.electronAPI.deleteFile(tempOutput).catch(() => {})
    }

    // Then apply pdf-lib annotations on top
    const saved = await savePdfWithAnnotations(basePdfData, annotations)
    return saved
  }, [pdfData, annotations, getPendingEditsArray])

  const handleSave = useCallback(async () => {
    if (!pdfData || !filePath) return
    try {
      const saved = await applyAllEdits(filePath)
      await window.electronAPI.writeFile(filePath, saved)
      setPdfData(saved)
      clearTextEdits()
      setDirty(false)
      showToast('PDF saved successfully', 'success')
    } catch (e: any) {
      console.error('Save failed:', e)
      showToast(`Save failed: ${e.message}`, 'error')
    }
  }, [pdfData, filePath, applyAllEdits, setPdfData, clearTextEdits, setDirty, showToast])

  const handleSaveAs = useCallback(async () => {
    if (!pdfData) return
    const savePath = await window.electronAPI.saveFile(filePath || 'document.pdf')
    if (!savePath) return
    try {
      const saved = await applyAllEdits(savePath)
      await window.electronAPI.writeFile(savePath, saved)
      setFilePath(savePath)
      setPdfData(saved)
      clearTextEdits()
      setDirty(false)
      showToast('PDF saved successfully', 'success')
    } catch (e: any) {
      console.error('Save As failed:', e)
      showToast(`Save failed: ${e.message}`, 'error')
    }
  }, [pdfData, filePath, applyAllEdits, setFilePath, setPdfData, clearTextEdits, setDirty, showToast])

  // Drag-and-drop to open PDF
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation() }
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const file = e.dataTransfer?.files?.[0]
      if (!file || !file.name.toLowerCase().endsWith('.pdf')) return
      const filePath = (file as any).path as string
      if (!filePath) return
      const data = await window.electronAPI.readFile(filePath)
      clearAnnotations()
      clearTextEdits()
      setFilePath(filePath)
      setPdfData(data)
    }
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [clearAnnotations, clearTextEdits, setFilePath, setPdfData])

  // Extract text when Edit Text tool is selected
  useEffect(() => {
    if (tool !== 'editText' || !filePath || textExtracted || textExtracting) return
    setTextExtracting(true)
    window.electronAPI.extractText(filePath).then((result) => {
      if (result.ok && result.pages) {
        setTextSpans(result.pages)
      } else {
        console.error('Text extraction failed:', result.error)
        setTextExtracting(false)
      }
    })
  }, [tool, filePath, textExtracted, textExtracting, setTextExtracting, setTextSpans])

  // Wire up menu events
  useEffect(() => {
    const offOpen = window.electronAPI.onMenuOpen(handleOpen)
    const offSave = window.electronAPI.onMenuSave(handleSave)
    const offSaveAs = window.electronAPI.onMenuSaveAs(handleSaveAs)
    return () => { offOpen(); offSave(); offSaveAs() }
  }, [handleOpen, handleSave, handleSaveAs])

  // Warn on close if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); handleOpen() }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); handleSave() }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); handleSaveAs() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo() }

      // Tool shortcuts (only when not typing in an input)
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break
        case 't': setTool('text'); break
        case 'h': setTool('highlight'); break
        case 'd': setTool('draw'); break
        case 'r': setTool('rectangle'); break
        case 'e': setTool('eraser'); break
        case 'x': setTool('editText'); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleOpen, handleSave, handleSaveAs, undo, redo, setTool])

  return (
    <div style={styles.app}>
      <Toolbar />
      <div style={styles.body}>
        <Sidebar />
        <PDFViewer />
      </div>
      {toast && (
        <div style={{
          position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 500, zIndex: 1000,
          background: toast.type === 'success' ? '#166534' : '#991b1b',
          color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {toast.message}
        </div>
      )}
      {/* Status bar */}
      <div style={styles.statusBar}>
        <span>{filePath ? `📄 ${filePath}` : 'No file open'}</span>
        <div style={styles.statusActions}>
          <button style={styles.statusBtn} onClick={handleOpen}>Open</button>
          {pdfData && <button style={styles.statusBtn} onClick={handleSave}>Save</button>}
          {pdfData && <button style={styles.statusBtn} onClick={handleSaveAs}>Save As…</button>}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 12px',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    fontSize: 12,
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  statusActions: { display: 'flex', gap: 8 },
  statusBtn: {
    padding: '2px 10px',
    borderRadius: 4,
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: 12,
    cursor: 'pointer',
    border: '1px solid var(--border)',
  },
}

