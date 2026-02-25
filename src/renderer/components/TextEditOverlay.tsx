import React, { useState, useRef, useEffect } from 'react'
import { usePDFStore } from '../store/pdfStore'
import { PDFTextSpan } from '../types'

interface Props {
  pageIndex: number
  pageWidth: number
  pageHeight: number
  scale: number
}

export default function TextEditOverlay({ pageIndex, pageWidth, pageHeight, scale }: Props) {
  const {
    getPageTextSpans,
    textEdits,
    activeEditSpanId,
    setActiveEditSpanId,
    addTextEdit,
  } = usePDFStore()

  const spans = getPageTextSpans(pageIndex)

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: pageWidth * scale,
        height: pageHeight * scale,
        pointerEvents: 'auto',
      }}
    >
      {spans.map((span) => (
        <SpanHitbox
          key={span.id}
          span={span}
          pageHeight={pageHeight}
          scale={scale}
          isEditing={activeEditSpanId === span.id}
          isModified={span.id in textEdits}
          onStartEdit={() => setActiveEditSpanId(span.id)}
          onCommit={(newText) => {
            if (newText !== span.text) {
              addTextEdit({
                spanId: span.id,
                pageIndex,
                originalText: span.text,
                newText,
                bbox: span.bbox,
                font: span.font,
                size: span.size,
                color: span.color,
                origin: span.origin,
              })
            }
            setActiveEditSpanId(null)
          }}
          onCancel={() => setActiveEditSpanId(null)}
        />
      ))}
    </div>
  )
}

interface SpanHitboxProps {
  span: PDFTextSpan
  pageHeight: number
  scale: number
  isEditing: boolean
  isModified: boolean
  onStartEdit: () => void
  onCommit: (newText: string) => void
  onCancel: () => void
}

function SpanHitbox({
  span,
  pageHeight,
  scale,
  isEditing,
  isModified,
  onStartEdit,
  onCommit,
  onCancel,
}: SpanHitboxProps) {
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [x0, y0, x1, y1] = span.bbox
  const left = x0 * scale
  const top = y0 * scale
  const width = (x1 - x0) * scale
  const height = (y1 - y0) * scale

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        defaultValue={span.text}
        style={{
          position: 'absolute',
          left,
          top,
          width: Math.max(width, 100),
          height,
          fontSize: span.size * scale,
          fontFamily: span.font || 'sans-serif',
          padding: 0,
          margin: 0,
          border: '2px solid #3b82f6',
          borderRadius: 2,
          background: 'rgba(255,255,255,0.95)',
          color: span.color,
          outline: 'none',
          boxSizing: 'border-box',
          zIndex: 10,
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onCommit((e.target as HTMLInputElement).value)
          } else if (e.key === 'Escape') {
            onCancel()
          }
        }}
        onBlur={(e) => onCommit(e.target.value)}
      />
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        cursor: 'text',
        border: hovered
          ? '1px dashed #3b82f6'
          : isModified
          ? '1px solid #3b82f680'
          : '1px solid transparent',
        background: isModified ? 'rgba(59,130,246,0.1)' : 'transparent',
        boxSizing: 'border-box',
        borderRadius: 1,
        zIndex: 5,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onStartEdit}
    />
  )
}
