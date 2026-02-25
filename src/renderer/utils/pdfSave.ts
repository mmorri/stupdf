import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { AnyAnnotation, DrawAnnotation, HighlightAnnotation, RectAnnotation, TextAnnotation } from '../types'
import { hexToRgb01 } from './colorUtils'

export async function savePdfWithAnnotations(
  originalData: ArrayBuffer,
  annotationsByPage: Record<number, AnyAnnotation[]>
): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.load(originalData)
  const pages = pdfDoc.getPages()

  for (const [pageIndexStr, annotations] of Object.entries(annotationsByPage)) {
    const pageIndex = parseInt(pageIndexStr)
    const page = pages[pageIndex]
    if (!page) continue
    const { height } = page.getSize()

    for (const ann of annotations) {
      if (ann.type === 'eraser') continue // eraser is canvas-only

      const [r, g, b] = hexToRgb01(ann.color)

      if (ann.type === 'highlight') {
        const a = ann as HighlightAnnotation
        page.drawRectangle({
          x: a.x,
          y: height - a.y - a.height,
          width: a.width,
          height: a.height,
          color: rgb(r, g, b),
          opacity: a.opacity,
        })
      } else if (ann.type === 'text') {
        const a = ann as TextAnnotation
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
        page.drawText(a.text, {
          x: a.x,
          y: height - a.y,
          size: a.fontSize,
          font,
          color: rgb(r, g, b),
          opacity: a.opacity,
        })
      } else if (ann.type === 'rectangle') {
        const a = ann as RectAnnotation
        page.drawRectangle({
          x: a.x,
          y: height - a.y - a.height,
          width: a.width,
          height: a.height,
          borderColor: rgb(r, g, b),
          borderWidth: a.lineWidth,
          color: a.fill ? rgb(r, g, b) : undefined,
          opacity: a.fill ? a.opacity * 0.3 : undefined,
          borderOpacity: a.opacity,
        })
      } else if (ann.type === 'draw') {
        const a = ann as DrawAnnotation
        if (a.points.length < 2) continue
        for (let i = 1; i < a.points.length; i++) {
          const p1 = a.points[i - 1]
          const p2 = a.points[i]
          page.drawLine({
            start: { x: p1.x, y: height - p1.y },
            end: { x: p2.x, y: height - p2.y },
            thickness: a.lineWidth,
            color: rgb(r, g, b),
            opacity: a.opacity,
          })
        }
      }
    }
  }

  const bytes = await pdfDoc.save()
  return bytes.buffer as ArrayBuffer
}

