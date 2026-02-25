import React, { useEffect, useRef, useState } from 'react'
import { usePDFStore } from '../store/pdfStore'

export default function Sidebar() {
  const { pdfDoc, pageCount, currentPage, setCurrentPage } = usePDFStore()
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!pdfDoc || pageCount === 0) { setThumbnails([]); return }
    let cancelled = false

    async function generateThumbs() {
      const thumbs: string[] = []
      for (let i = 1; i <= pdfDoc!.numPages; i++) {
        if (cancelled) return
        const page = await pdfDoc!.getPage(i)
        const viewport = page.getViewport({ scale: 0.2 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise
        thumbs.push(canvas.toDataURL())
      }
      if (!cancelled) setThumbnails(thumbs)
    }

    generateThumbs()
    return () => { cancelled = true }
  }, [pdfDoc, pageCount])

  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current.children[currentPage] as HTMLElement
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [currentPage])

  if (!pdfDoc) return null

  return (
    <div style={styles.sidebar}>
      <div style={styles.header}>Pages</div>
      <div ref={containerRef} style={styles.list}>
        {Array.from({ length: pageCount }, (_, i) => (
          <div
            key={i}
            onClick={() => setCurrentPage(i)}
            style={{
              ...styles.thumb,
              ...(currentPage === i ? styles.thumbActive : {}),
            }}
          >
            {thumbnails[i] ? (
              <img src={thumbnails[i]} alt={`Page ${i + 1}`} style={styles.img} />
            ) : (
              <div style={styles.placeholder} />
            )}
            <span style={styles.pageNum}>{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--sidebar-width)',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border)',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  thumb: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: 6,
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  thumbActive: {
    borderColor: 'var(--accent)',
    background: 'var(--bg-surface)',
  },
  img: { width: '100%', borderRadius: 3, display: 'block' },
  placeholder: { width: '100%', height: 100, background: 'var(--bg-surface)', borderRadius: 3 },
  pageNum: { fontSize: 11, color: 'var(--text-muted)' },
}
