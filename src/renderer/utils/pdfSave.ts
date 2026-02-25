import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { AnyAnnotation, DrawAnnotation, EraserAnnotation, HighlightAnnotation, RectAnnotation, TextAnnotation } from '../types'
import { hexToRgb01 } from './colorUtils'

function mapFontFamily(family: string): string {
  const f = family.toLowerCase()
  if (f.includes('courier') || f.includes('mono')) return StandardFonts.Courier
  if (f.includes('times') || f.includes('serif') && !f.includes('sans')) return StandardFonts.TimesRoman
  return StandardFonts.Helvetica
}

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
      if (ann.type === 'eraser') {
        const a = ann as EraserAnnotation
        if (a.points.length < 2) continue
        for (let i = 1; i < a.points.length; i++) {
          const p1 = a.points[i - 1]
          const p2 = a.points[i]
          page.drawLine({
            start: { x: p1.x, y: height - p1.y },
            end: { x: p2.x, y: height - p2.y },
            thickness: a.lineWidth,
            color: rgb(1, 1, 1),
            opacity: 1,
          })
        }
        continue
      }

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
        const fontName = mapFontFamily(a.fontFamily)
        const font = await pdfDoc.embedFont(fontName)
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

