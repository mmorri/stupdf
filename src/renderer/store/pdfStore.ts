import { create } from 'zustand'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { AnyAnnotation, PDFPageTextData, PDFTextSpan, TextEdit, ToolType } from '../types'

interface HistorySnapshot {
  annotations: Record<number, AnyAnnotation[]>
  textEdits: Record<string, TextEdit>
}

interface PDFStore {
  // File state
  filePath: string | null
  pdfData: ArrayBuffer | null
  pdfDoc: PDFDocumentProxy | null
  pageCount: number
  currentPage: number

  // View state
  scale: number
  tool: ToolType
  color: string
  opacity: number
  lineWidth: number
  fontSize: number
  fontFamily: string
  rectFill: boolean

  // Annotations per page
  annotations: Record<number, AnyAnnotation[]>

  // Undo/redo history
  history: HistorySnapshot[]
  historyIndex: number

  // Dirty state
  dirty: boolean

  // Text editing state
  textSpans: PDFPageTextData[]
  textEdits: Record<string, TextEdit>
  activeEditSpanId: string | null
  textExtracted: boolean
  textExtracting: boolean

  // Actions
  setFilePath: (path: string | null) => void
  setDirty: (dirty: boolean) => void
  setPdfData: (data: ArrayBuffer | null) => void
  setPdfDoc: (doc: PDFDocumentProxy | null) => void
  setPageCount: (count: number) => void
  setCurrentPage: (page: number) => void
  setScale: (scale: number) => void
  setTool: (tool: ToolType) => void
  setColor: (color: string) => void
  setOpacity: (opacity: number) => void
  setLineWidth: (width: number) => void
  setFontSize: (size: number) => void
  setFontFamily: (family: string) => void
  setRectFill: (fill: boolean) => void
  addAnnotation: (pageIndex: number, annotation: AnyAnnotation) => void
  updateAnnotation: (pageIndex: number, id: string, updates: Partial<AnyAnnotation>) => void
  removeAnnotation: (pageIndex: number, id: string) => void
  clearAnnotations: () => void
  getPageAnnotations: (pageIndex: number) => AnyAnnotation[]

  // Undo/redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Text editing actions
  setTextSpans: (spans: PDFPageTextData[]) => void
  addTextEdit: (edit: TextEdit) => void
  removeTextEdit: (spanId: string) => void
  clearTextEdits: () => void
  setActiveEditSpanId: (id: string | null) => void
  setTextExtracting: (v: boolean) => void
  setTextExtracted: (v: boolean) => void
  getPageTextSpans: (pageIndex: number) => PDFTextSpan[]
  getPendingEditsArray: () => TextEdit[]
}

const MAX_HISTORY = 50

function pushHistory(state: PDFStore): Partial<PDFStore> {
  const snapshot: HistorySnapshot = {
    annotations: state.annotations,
    textEdits: state.textEdits,
  }
  const history = state.history.slice(0, state.historyIndex + 1)
  history.push(snapshot)
  if (history.length > MAX_HISTORY) history.shift()
  return { history, historyIndex: history.length - 1 }
}

export const usePDFStore = create<PDFStore>((set, get) => ({
  filePath: null,
  pdfData: null,
  pdfDoc: null,
  pageCount: 0,
  currentPage: 0,
  scale: 1.2,
  tool: 'select',
  color: '#f9e2af',
  opacity: 0.5,
  lineWidth: 3,
  fontSize: 16,
  fontFamily: 'Arial',
  rectFill: false,
  annotations: {},

  history: [{ annotations: {}, textEdits: {} }],
  historyIndex: 0,

  dirty: false,

  textSpans: [],
  textEdits: {},
  activeEditSpanId: null,
  textExtracted: false,
  textExtracting: false,

  setFilePath: (path) => set({ filePath: path }),
  setDirty: (dirty) => set({ dirty }),
  setPdfData: (data) => set({ pdfData: data }),
  setPdfDoc: (doc) => set({ pdfDoc: doc }),
  setPageCount: (count) => set({ pageCount: count }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setScale: (scale) => set({ scale }),
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setOpacity: (opacity) => set({ opacity }),
  setLineWidth: (lineWidth) => set({ lineWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setRectFill: (rectFill) => set({ rectFill }),

  addAnnotation: (pageIndex, annotation) =>
    set((state) => {
      const newAnnotations = {
        ...state.annotations,
        [pageIndex]: [...(state.annotations[pageIndex] || []), annotation],
      }
      const hist = pushHistory(state)
      return { ...hist, annotations: newAnnotations, dirty: true }
    }),

  updateAnnotation: (pageIndex, id, updates) =>
    set((state) => {
      const newAnnotations = {
        ...state.annotations,
        [pageIndex]: (state.annotations[pageIndex] || []).map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      }
      const hist = pushHistory(state)
      return { ...hist, annotations: newAnnotations, dirty: true }
    }),

  removeAnnotation: (pageIndex, id) =>
    set((state) => {
      const newAnnotations = {
        ...state.annotations,
        [pageIndex]: (state.annotations[pageIndex] || []).filter((a) => a.id !== id),
      }
      const hist = pushHistory(state)
      return { ...hist, annotations: newAnnotations, dirty: true }
    }),

  clearAnnotations: () => set({ annotations: {}, history: [{ annotations: {}, textEdits: {} }], historyIndex: 0, dirty: false }),

  getPageAnnotations: (pageIndex) => get().annotations[pageIndex] || [],

  // Undo/redo
  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) return {}
      const newIndex = state.historyIndex - 1
      const snapshot = state.history[newIndex]
      return {
        historyIndex: newIndex,
        annotations: snapshot.annotations,
        textEdits: snapshot.textEdits,
      }
    }),

  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) return {}
      const newIndex = state.historyIndex + 1
      const snapshot = state.history[newIndex]
      return {
        historyIndex: newIndex,
        annotations: snapshot.annotations,
        textEdits: snapshot.textEdits,
      }
    }),

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  // Text editing actions
  setTextSpans: (spans) => set({ textSpans: spans, textExtracted: true, textExtracting: false }),
  addTextEdit: (edit) =>
    set((state) => {
      const newTextEdits = { ...state.textEdits, [edit.spanId]: edit }
      const hist = pushHistory(state)
      return { ...hist, textEdits: newTextEdits, dirty: true }
    }),
  removeTextEdit: (spanId) =>
    set((state) => {
      const { [spanId]: _, ...rest } = state.textEdits
      const hist = pushHistory(state)
      return { ...hist, textEdits: rest, dirty: true }
    }),
  clearTextEdits: () => set({ textEdits: {}, textExtracted: false, textSpans: [] }),
  setActiveEditSpanId: (id) => set({ activeEditSpanId: id }),
  setTextExtracting: (v) => set({ textExtracting: v }),
  setTextExtracted: (v) => set({ textExtracted: v }),
  getPageTextSpans: (pageIndex) => {
    const page = get().textSpans.find((p) => p.pageIndex === pageIndex)
    return page ? page.spans : []
  },
  getPendingEditsArray: () => Object.values(get().textEdits),
}))
