import React, { useEffect, useCallback } from 'react'
import Toolbar from './components/Toolbar'
import Sidebar from './components/Sidebar'
import PDFViewer from './components/PDFViewer'
import { usePDFStore } from './store/pdfStore'
import { savePdfWithAnnotations } from './utils/pdfSave'

export default function App() {
  const { setPdfData, setFilePath, filePath, pdfData, annotations, clearAnnotations,
    tool, textExtracted, textExtracting, setTextExtracting, setTextSpans, clearTextEdits,
    getPendingEditsArray, setTextExtracted } = usePDFStore()

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
        throw new Error(result.error || 'Failed to apply text edits')
      }

      // Read the Python-edited PDF back
      basePdfData = await window.electronAPI.readFile(tempOutput)
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
      // Reload the saved PDF into viewer
      const reloaded = await window.electronAPI.readFile(filePath)
      setPdfData(reloaded)
      clearTextEdits()
    } catch (e: any) {
      console.error('Save failed:', e)
    }
  }, [pdfData, filePath, applyAllEdits, setPdfData, clearTextEdits])

  const handleSaveAs = useCallback(async () => {
    if (!pdfData) return
    const savePath = await window.electronAPI.saveFile(filePath || 'document.pdf')
    if (!savePath) return
    try {
      const saved = await applyAllEdits(savePath)
      await window.electronAPI.writeFile(savePath, saved)
      setFilePath(savePath)
      // Reload the saved PDF into viewer
      const reloaded = await window.electronAPI.readFile(savePath)
      setPdfData(reloaded)
      clearTextEdits()
    } catch (e: any) {
      console.error('Save As failed:', e)
    }
  }, [pdfData, filePath, applyAllEdits, setFilePath, setPdfData, clearTextEdits])

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
    window.electronAPI.onMenuOpen(handleOpen)
    window.electronAPI.onMenuSave(handleSave)
    window.electronAPI.onMenuSaveAs(handleSaveAs)
    return () => {
      window.electronAPI.removeAllListeners('menu:open')
      window.electronAPI.removeAllListeners('menu:save')
      window.electronAPI.removeAllListeners('menu:saveAs')
    }
  }, [handleOpen, handleSave, handleSaveAs])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); handleOpen() }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') { e.preventDefault(); handleSave() }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') { e.preventDefault(); handleSaveAs() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleOpen, handleSave, handleSaveAs])

  return (
    <div style={styles.app}>
      <Toolbar />
      <div style={styles.body}>
        <Sidebar />
        <PDFViewer />
      </div>
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

