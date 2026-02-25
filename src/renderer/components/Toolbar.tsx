import React from 'react'
import { usePDFStore } from '../store/pdfStore'
import { ToolType } from '../types'

const TOOLS: { id: ToolType; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'highlight', label: 'Highlight', icon: '▬' },
  { id: 'draw', label: 'Draw', icon: '✏' },
  { id: 'rectangle', label: 'Rectangle', icon: '▭' },
  { id: 'eraser', label: 'Eraser', icon: '⌫' },
  { id: 'editText', label: 'Edit Text', icon: 'A' },
]

const COLORS = ['#f9e2af', '#f38ba8', '#a6e3a1', '#89b4fa', '#cba6f7', '#fab387', '#ffffff', '#000000']

export default function Toolbar() {
  const { tool, setTool, color, setColor, opacity, setOpacity, lineWidth, setLineWidth,
    fontSize, setFontSize, scale, setScale, pageCount, currentPage, setCurrentPage } = usePDFStore()

  return (
    <div style={styles.toolbar}>
      {/* Tools */}
      <div style={styles.group}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setTool(t.id)}
            style={{ ...styles.toolBtn, ...(tool === t.id ? styles.toolBtnActive : {}) }}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div style={styles.divider} />

      {/* Colors */}
      <div style={styles.group}>
        {COLORS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setColor(c)}
            style={{
              ...styles.colorBtn,
              background: c,
              outline: color === c ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          />
        ))}
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          style={styles.colorPicker} title="Custom color" />
      </div>

      <div style={styles.divider} />

      {/* Options */}
      <div style={styles.group}>
        <label style={styles.label}>Opacity
          <input type="range" min={0.1} max={1} step={0.05} value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))} style={styles.slider} />
          <span style={styles.val}>{Math.round(opacity * 100)}%</span>
        </label>
        {(tool === 'draw' || tool === 'rectangle' || tool === 'eraser') && (
          <label style={styles.label}>Size
            <input type="range" min={1} max={30} step={1} value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))} style={styles.slider} />
            <span style={styles.val}>{lineWidth}px</span>
          </label>
        )}
        {tool === 'text' && (
          <label style={styles.label}>Font
            <input type="range" min={8} max={72} step={1} value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))} style={styles.slider} />
            <span style={styles.val}>{fontSize}px</span>
          </label>
        )}
      </div>

      <div style={styles.divider} />

      {/* Zoom */}
      <div style={styles.group}>
        <button style={styles.toolBtn} onClick={() => setScale(Math.max(0.3, scale - 0.1))} title="Zoom out">−</button>
        <span style={styles.val}>{Math.round(scale * 100)}%</span>
        <button style={styles.toolBtn} onClick={() => setScale(Math.min(4, scale + 0.1))} title="Zoom in">+</button>
      </div>

      <div style={styles.divider} />

      {/* Page nav */}
      {pageCount > 0 && (
        <div style={styles.group}>
          <button style={styles.toolBtn} onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>‹</button>
          <span style={styles.val}>{currentPage + 1} / {pageCount}</span>
          <button style={styles.toolBtn} onClick={() => setCurrentPage(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage === pageCount - 1}>›</button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
    height: 'var(--toolbar-height)', background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)', flexWrap: 'wrap', overflowX: 'auto' },
  group: { display: 'flex', alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 32, background: 'var(--border)', margin: '0 4px' },
  toolBtn: { width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 16, background: 'var(--bg-surface)',
    color: 'var(--text-primary)', transition: 'background 0.15s' },
  toolBtnActive: { background: 'var(--accent)', color: 'var(--bg-primary)' },
  colorBtn: { width: 22, height: 22, borderRadius: 4, border: 'none', cursor: 'pointer' },
  colorPicker: { width: 28, height: 28, border: 'none', borderRadius: 4,
    background: 'none', cursor: 'pointer', padding: 0 },
  label: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
    color: 'var(--text-secondary)' },
  slider: { width: 80, accentColor: 'var(--accent)' },
  val: { fontSize: 12, color: 'var(--text-secondary)', minWidth: 36, textAlign: 'center' },
}

