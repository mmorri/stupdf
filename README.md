# stuPDF

A desktop PDF editor for Linux built with Electron, React, and PyMuPDF.

## Features

- **Open & view PDFs** with smooth multi-page scrolling and zoom
- **Text annotations** — click anywhere to add text overlays
- **Highlight** — drag to highlight regions
- **Draw** — freehand drawing with configurable brush size
- **Rectangles** — draw rectangular shapes and outlines
- **Eraser** — erase annotations from the canvas
- **Edit existing PDF text** — click on actual text in the PDF, change it, and save (see below)
- **Save / Save As** — all changes are written back into the PDF file
- **Page thumbnails sidebar** with quick navigation
- **Color picker**, opacity, and line width controls

## Text Editing (Edit Text Tool)

This is the standout feature — true in-place text editing of existing PDF content, similar to Adobe Acrobat.

### How it works

1. Open a PDF file (Ctrl+O or File > Open PDF)
2. Click the **"A" button** (Edit Text) in the toolbar
3. Wait briefly — the app extracts all text spans from the PDF using PyMuPDF in the background
4. You'll see **transparent clickable regions** appear over every piece of text in the PDF
   - Hover over text to see a dashed blue border
   - Already-edited text shows a light blue background
5. **Click on any text span** — an inline input field appears pre-filled with the current text
6. **Edit the text**, then press **Enter** to confirm (or **Escape** to cancel)
7. **Save** (Ctrl+S) — the app:
   - Sends your edits to the Python backend
   - Redacts the original text with a white fill
   - Re-inserts the new text at the exact same position, size, and color
   - Then applies any annotation overlays (highlights, drawings, etc.) on top
   - Reloads the PDF in the viewer

### Requirements for text editing

- **Python 3** must be installed and available as `python3`
- **PyMuPDF** must be installed: `pip install PyMuPDF`

### Limitations

- Font matching is approximate — Times fonts map to Times, Courier to Courier, everything else to Helvetica
- Editing works best with standard fonts; heavily embedded/subset fonts may not match exactly
- Each text span is treated individually (you can't merge or split spans)

## Development

```bash
# Install dependencies
npm install
pip install PyMuPDF

# Run in development mode
npm run dev

# Build for production
npm run build

# Create AppImage
npx electron-builder --linux AppImage
```

## Building Packages

```bash
# Debian (.deb)
npm run dist:deb

# Red Hat (.rpm)
npm run dist:rpm

# Arch Linux (.pacman)
npm run dist:pacman
```

## Tech Stack

- **Electron 28** — desktop framework
- **React 18** + **TypeScript** — UI
- **Zustand** — state management
- **pdf-lib** — annotation saving (overlays)
- **pdfjs-dist** — PDF rendering in the viewer
- **PyMuPDF (fitz)** — text extraction and redact/reinsert editing
- **Vite** — build tooling
- **electron-builder** — packaging

## License

MIT
