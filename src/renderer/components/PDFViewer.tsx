import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore } from '../store/pdfStore'
import PageCanvas from './PageCanvas'

// Point pdfjs to its worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export default function PDFViewer() {
  const { pdfData, scale, currentPage, setPageCount, setPdfDoc } = usePDFStore()
  const [pages, setPages] = useState<pdfjsLib.PDFPageProxy[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pdfData) { setPages([]); setPdfDoc(null); return }
    let cancelled = false

    async function load() {
      const pdf = await pdfjsLib.getDocument({ data: pdfData! }).promise
      if (cancelled) return
      setPdfDoc(pdf)
      setPageCount(pdf.numPages)
      const loaded: pdfjsLib.PDFPageProxy[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return
        loaded.push(await pdf.getPage(i))
      }
      if (!cancelled) setPages(loaded)
    }

    load()
    return () => { cancelled = true }
  }, [pdfData, setPageCount, setPdfDoc])

  // Scroll to current page when it changes
  useEffect(() => {
    if (!containerRef.current) return
    const pageEl = containerRef.current.children[currentPage] as HTMLElement
    pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [currentPage])

  if (!pdfData) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>📄</div>
        <div style={styles.emptyTitle}>No PDF open</div>
        <div style={styles.emptyHint}>Use File → Open PDF or press Ctrl+O</div>
      </div>
    )
  }

  return (
    <div style={styles.scroll}>
      <div ref={containerRef} style={styles.pages}>
        {pages.map((page, i) => (
          <PageCanvas key={i} pageIndex={i} pdfPage={page} />
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    background: 'var(--bg-primary)',
  },
  pages: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
    padding: 32,
    minHeight: '100%',
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    color: 'var(--text-muted)',
  },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontSize: 22, fontWeight: 600, color: 'var(--text-secondary)' },
  emptyHint: { fontSize: 14 },
}

