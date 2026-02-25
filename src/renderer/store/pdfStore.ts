import { create } from 'zustand'
import { AnyAnnotation, PDFPageTextData, PDFTextSpan, TextEdit, ToolType } from '../types'

interface PDFStore {
  // File state
  filePath: string | null
  pdfData: ArrayBuffer | null
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

  // Annotations per page
  annotations: Record<number, AnyAnnotation[]>

  // Text editing state
  textSpans: PDFPageTextData[]
  textEdits: Record<string, TextEdit>
  activeEditSpanId: string | null
  textExtracted: boolean
  textExtracting: boolean

  // Actions
  setFilePath: (path: string | null) => void
  setPdfData: (data: ArrayBuffer | null) => void
  setPageCount: (count: number) => void
  setCurrentPage: (page: number) => void
  setScale: (scale: number) => void
  setTool: (tool: ToolType) => void
  setColor: (color: string) => void
  setOpacity: (opacity: number) => void
  setLineWidth: (width: number) => void
  setFontSize: (size: number) => void
  setFontFamily: (family: string) => void
  addAnnotation: (pageIndex: number, annotation: AnyAnnotation) => void
  updateAnnotation: (pageIndex: number, id: string, updates: Partial<AnyAnnotation>) => void
  removeAnnotation: (pageIndex: number, id: string) => void
  clearAnnotations: () => void
  getPageAnnotations: (pageIndex: number) => AnyAnnotation[]

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

export const usePDFStore = create<PDFStore>((set, get) => ({
  filePath: null,
  pdfData: null,
  pageCount: 0,
  currentPage: 0,
  scale: 1.2,
  tool: 'select',
  color: '#f9e2af',
  opacity: 0.5,
  lineWidth: 3,
  fontSize: 16,
  fontFamily: 'Arial',
  annotations: {},

  textSpans: [],
  textEdits: {},
  activeEditSpanId: null,
  textExtracted: false,
  textExtracting: false,

  setFilePath: (path) => set({ filePath: path }),
  setPdfData: (data) => set({ pdfData: data }),
  setPageCount: (count) => set({ pageCount: count }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setScale: (scale) => set({ scale }),
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setOpacity: (opacity) => set({ opacity }),
  setLineWidth: (lineWidth) => set({ lineWidth }),
  setFontSize: (fontSize) => set({ fontSize }),
  setFontFamily: (fontFamily) => set({ fontFamily }),

  addAnnotation: (pageIndex, annotation) =>
    set((state) => ({
      annotations: {
        ...state.annotations,
        [pageIndex]: [...(state.annotations[pageIndex] || []), annotation],
      },
    })),

  updateAnnotation: (pageIndex, id, updates) =>
    set((state) => ({
      annotations: {
        ...state.annotations,
        [pageIndex]: (state.annotations[pageIndex] || []).map((a) =>
          a.id === id ? { ...a, ...updates } : a
        ),
      },
    })),

  removeAnnotation: (pageIndex, id) =>
    set((state) => ({
      annotations: {
        ...state.annotations,
        [pageIndex]: (state.annotations[pageIndex] || []).filter((a) => a.id !== id),
      },
    })),

  clearAnnotations: () => set({ annotations: {} }),

  getPageAnnotations: (pageIndex) => get().annotations[pageIndex] || [],

  // Text editing actions
  setTextSpans: (spans) => set({ textSpans: spans, textExtracted: true, textExtracting: false }),
  addTextEdit: (edit) =>
    set((state) => ({
      textEdits: { ...state.textEdits, [edit.spanId]: edit },
    })),
  removeTextEdit: (spanId) =>
    set((state) => {
      const { [spanId]: _, ...rest } = state.textEdits
      return { textEdits: rest }
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

