import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { usePDFStore } from '../store/pdfStore'
import { renderAnnotations } from '../utils/annotationRenderer'
import { AnyAnnotation, DrawAnnotation, EraserAnnotation, HighlightAnnotation, Point, RectAnnotation, TextAnnotation } from '../types'
import TextEditOverlay from './TextEditOverlay'

interface Props { pageIndex: number; pdfPage: pdfjsLib.PDFPageProxy }

export default function PageCanvas({ pageIndex, pdfPage }: Props) {
  const store = usePDFStore()
  const { tool, color, opacity, lineWidth, fontSize, fontFamily, scale, addAnnotation, getPageAnnotations, rectFill } = store

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const annCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [inlineText, setInlineText] = useState<{ x: number; y: number } | null>(null)
  const [inlineValue, setInlineValue] = useState('')
  const inlineRef = useRef<HTMLInputElement>(null)
  const currentAnn = useRef<AnyAnnotation | null>(null)
  const startPos = useRef<Point>({ x: 0, y: 0 })

  const viewport = pdfPage.getViewport({ scale })
  const W = Math.floor(viewport.width)
  const H = Math.floor(viewport.height)

  // Render PDF page
  useEffect(() => {
    const canvas = pdfCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = W; canvas.height = H
    pdfPage.render({ canvasContext: ctx, viewport }).promise.catch(() => {})
  }, [pdfPage, scale, W, H])

  // Render annotations
  const redrawAnnotations = useCallback(() => {
    const canvas = annCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    renderAnnotations(ctx, getPageAnnotations(pageIndex), scale)
    if (currentAnn.current) renderAnnotations(ctx, [currentAnn.current], scale)
  }, [getPageAnnotations, pageIndex, scale])

  useEffect(() => {
    const canvas = annCanvasRef.current
    if (!canvas) return
    canvas.width = W; canvas.height = H
    redrawAnnotations()
  }, [W, H, scale, store.annotations, redrawAnnotations])

  const getPos = (e: React.MouseEvent): Point => {
    const rect = annCanvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale }
  }

  const newId = () => Math.random().toString(36).slice(2)

  const onMouseDown = (e: React.MouseEvent) => {
    if (tool === 'select' || tool === 'editText') return
    const pos = getPos(e)
    startPos.current = pos

    if (tool === 'text') {
      setInlineText({ x: pos.x, y: pos.y })
      setInlineValue('')
      setTimeout(() => inlineRef.current?.focus(), 0)
      return
    }
    if (tool === 'draw') {
      currentAnn.current = { id: newId(), pageIndex, type: 'draw', color, opacity, lineWidth, points: [pos] } as DrawAnnotation
    } else if (tool === 'eraser') {
      currentAnn.current = { id: newId(), pageIndex, type: 'eraser', color: '#000', opacity: 1, lineWidth: lineWidth * 3, points: [pos] } as EraserAnnotation
    } else if (tool === 'highlight') {
      currentAnn.current = { id: newId(), pageIndex, type: 'highlight', color, opacity, x: pos.x, y: pos.y, width: 0, height: 0 } as HighlightAnnotation
    } else if (tool === 'rectangle') {
      currentAnn.current = { id: newId(), pageIndex, type: 'rectangle', color, opacity, lineWidth, fill: rectFill, x: pos.x, y: pos.y, width: 0, height: 0 } as RectAnnotation
    }
    setIsDrawing(true)
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentAnn.current) return
    const pos = getPos(e)
    const ann = currentAnn.current

    if (ann.type === 'draw' || ann.type === 'eraser') {
      ;(ann as DrawAnnotation).points.push(pos)
    } else if (ann.type === 'highlight' || ann.type === 'rectangle') {
      const a = ann as HighlightAnnotation
      a.width = pos.x - startPos.current.x
      a.height = pos.y - startPos.current.y
    }
    redrawAnnotations()
  }

  const onMouseUp = () => {
    if (!isDrawing || !currentAnn.current) return
    addAnnotation(pageIndex, { ...currentAnn.current })
    currentAnn.current = null
    setIsDrawing(false)
  }

  const commitInlineText = useCallback(() => {
    if (inlineText && inlineValue.trim()) {
      const ann: TextAnnotation = { id: newId(), pageIndex, type: 'text', color, opacity: 1, x: inlineText.x, y: inlineText.y, text: inlineValue.trim(), fontSize, fontFamily }
      addAnnotation(pageIndex, ann)
    }
    setInlineText(null)
    setInlineValue('')
  }, [inlineText, inlineValue, pageIndex, color, fontSize, fontFamily, addAnnotation])

  const isEditingText = tool === 'editText'
  const cursor = tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : tool === 'select' || isEditingText ? 'default' : 'crosshair'

  const unscaledW = viewport.width / scale
  const unscaledH = viewport.height / scale

  return (
    <div style={{ position: 'relative', width: W, height: H, flexShrink: 0, boxShadow: '0 4px 24px rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' }}>
      <canvas ref={pdfCanvasRef} style={{ position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={annCanvasRef} style={{ position: 'absolute', top: 0, left: 0, cursor, pointerEvents: isEditingText ? 'none' : 'auto' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
      {inlineText && (
        <input
          ref={inlineRef}
          value={inlineValue}
          onChange={e => setInlineValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commitInlineText(); if (e.key === 'Escape') { setInlineText(null); setInlineValue('') } }}
          onBlur={commitInlineText}
          style={{
            position: 'absolute',
            left: inlineText.x * scale,
            top: inlineText.y * scale - fontSize * scale,
            fontSize: fontSize * scale,
            fontFamily,
            color,
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 3,
            outline: 'none',
            padding: '2px 4px',
            minWidth: 100,
            zIndex: 20,
          }}
        />
      )}
      {isEditingText && (
        <TextEditOverlay pageIndex={pageIndex} pageWidth={unscaledW} pageHeight={unscaledH} scale={scale} />
      )}
    </div>
  )
}

