export type ToolType =
  | 'select'
  | 'text'
  | 'highlight'
  | 'draw'
  | 'rectangle'
  | 'eraser'
  | 'editText'

export interface Point {
  x: number
  y: number
}

export interface Annotation {
  id: string
  pageIndex: number
  type: ToolType
  color: string
  opacity: number
}

export interface TextAnnotation extends Annotation {
  type: 'text'
  x: number
  y: number
  text: string
  fontSize: number
  fontFamily: string
}

export interface HighlightAnnotation extends Annotation {
  type: 'highlight'
  x: number
  y: number
  width: number
  height: number
}

export interface DrawAnnotation extends Annotation {
  type: 'draw'
  points: Point[]
  lineWidth: number
}

export interface RectAnnotation extends Annotation {
  type: 'rectangle'
  x: number
  y: number
  width: number
  height: number
  lineWidth: number
  fill: boolean
}

export interface EraserAnnotation extends Annotation {
  type: 'eraser'
  points: Point[]
  lineWidth: number
}

export type AnyAnnotation =
  | TextAnnotation
  | HighlightAnnotation
  | DrawAnnotation
  | RectAnnotation
  | EraserAnnotation

export interface PDFPageInfo {
  pageIndex: number
  width: number
  height: number
}

export interface PDFTextSpan {
  id: string
  text: string
  bbox: [number, number, number, number]
  font: string
  size: number
  color: string
  origin: [number, number]
}

export interface PDFPageTextData {
  pageIndex: number
  width: number
  height: number
  spans: PDFTextSpan[]
}

export interface TextEdit {
  spanId: string
  pageIndex: number
  originalText: string
  newText: string
  bbox: [number, number, number, number]
  font: string
  size: number
  color: string
  origin: [number, number]
}

declare global {
  interface Window {
    electronAPI: {
      openFile: () => Promise<{ filePath: string; data: ArrayBuffer } | null>
      saveFile: (defaultPath?: string) => Promise<string | null>
      writeFile: (filePath: string, data: ArrayBuffer) => Promise<boolean>
      extractText: (filePath: string) => Promise<{ ok: boolean; pages?: PDFPageTextData[]; error?: string }>
      applyTextEdits: (filePath: string, outputPath: string, edits: TextEdit[]) => Promise<{ ok: boolean; error?: string }>
      readFile: (filePath: string) => Promise<ArrayBuffer>
      getTempPath: (suffix: string) => Promise<string>
      onMenuOpen: (cb: () => void) => void
      onMenuSave: (cb: () => void) => void
      onMenuSaveAs: (cb: () => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}

