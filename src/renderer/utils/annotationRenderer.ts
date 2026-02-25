import {
  AnyAnnotation,
  DrawAnnotation,
  EraserAnnotation,
  HighlightAnnotation,
  RectAnnotation,
  TextAnnotation,
} from '../types'
import { hexToRgba } from './colorUtils'

export function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: AnyAnnotation[],
  scale: number
) {
  for (const ann of annotations) {
    ctx.save()
    switch (ann.type) {
      case 'highlight':
        renderHighlight(ctx, ann as HighlightAnnotation, scale)
        break
      case 'text':
        renderText(ctx, ann as TextAnnotation, scale)
        break
      case 'draw':
        renderDraw(ctx, ann as DrawAnnotation, scale)
        break
      case 'rectangle':
        renderRect(ctx, ann as RectAnnotation, scale)
        break
      case 'eraser':
        renderEraser(ctx, ann as EraserAnnotation, scale)
        break
    }
    ctx.restore()
  }
}

function renderHighlight(ctx: CanvasRenderingContext2D, ann: HighlightAnnotation, scale: number) {
  ctx.globalAlpha = ann.opacity
  ctx.fillStyle = ann.color
  ctx.fillRect(ann.x * scale, ann.y * scale, ann.width * scale, ann.height * scale)
}

function renderText(ctx: CanvasRenderingContext2D, ann: TextAnnotation, scale: number) {
  ctx.globalAlpha = ann.opacity
  ctx.fillStyle = ann.color
  ctx.font = `${ann.fontSize * scale}px ${ann.fontFamily}`
  ctx.fillText(ann.text, ann.x * scale, ann.y * scale)
}

function renderDraw(ctx: CanvasRenderingContext2D, ann: DrawAnnotation, scale: number) {
  if (ann.points.length < 2) return
  ctx.globalAlpha = ann.opacity
  ctx.strokeStyle = ann.color
  ctx.lineWidth = ann.lineWidth * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(ann.points[0].x * scale, ann.points[0].y * scale)
  for (let i = 1; i < ann.points.length; i++) {
    ctx.lineTo(ann.points[i].x * scale, ann.points[i].y * scale)
  }
  ctx.stroke()
}

function renderRect(ctx: CanvasRenderingContext2D, ann: RectAnnotation, scale: number) {
  ctx.globalAlpha = ann.opacity
  ctx.strokeStyle = ann.color
  ctx.lineWidth = ann.lineWidth * scale
  if (ann.fill) {
    ctx.fillStyle = hexToRgba(ann.color, ann.opacity * 0.3)
    ctx.fillRect(ann.x * scale, ann.y * scale, ann.width * scale, ann.height * scale)
  }
  ctx.strokeRect(ann.x * scale, ann.y * scale, ann.width * scale, ann.height * scale)
}

function renderEraser(ctx: CanvasRenderingContext2D, ann: EraserAnnotation, scale: number) {
  if (ann.points.length < 2) return
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 1
  ctx.strokeStyle = 'rgba(0,0,0,1)'
  ctx.lineWidth = ann.lineWidth * scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(ann.points[0].x * scale, ann.points[0].y * scale)
  for (let i = 1; i < ann.points.length; i++) {
    ctx.lineTo(ann.points[i].x * scale, ann.points[i].y * scale)
  }
  ctx.stroke()
}

