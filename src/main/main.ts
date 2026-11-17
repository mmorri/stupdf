import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn, ChildProcess } from 'child_process'
import os from 'os'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'PDF Editor',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  buildMenu(win)
}

function buildMenu(win: BrowserWindow) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open PDF…',
          accelerator: 'CmdOrCtrl+O',
          click: () => win.webContents.send('menu:open'),
        },
        {
          label: 'Save PDF',
          accelerator: 'CmdOrCtrl+S',
          click: () => win.webContents.send('menu:save'),
        },
        {
          label: 'Save PDF As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => win.webContents.send('menu:saveAs'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// Allowlist: renderer-supplied paths are only honored when they were
// previously chosen via a native dialog or issued as an app temp path.
// This keeps a future renderer XSS from becoming arbitrary file R/W/D.
const allowedPaths = new Set<string>()

function allowPath(p: string): void {
  allowedPaths.add(path.normalize(p))
}

function assertAllowedPath(p: unknown, what = 'filePath'): asserts p is string {
  if (typeof p !== 'string' || p.length === 0 || p.length > 4096) {
    throw new Error(`Invalid ${what}`)
  }
  const normalized = path.normalize(p)
  if (allowedPaths.has(normalized)) return
  const tempPrefix = path.join(os.tmpdir(), 'pdf_editor_')
  if (normalized.startsWith(tempPrefix)) {
    allowedPaths.add(normalized)
    return
  }
  throw new Error(`Access denied for ${what}`)
}

// IPC: open file dialog
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  allowPath(filePath)
  const data = fs.readFileSync(filePath)
  return { filePath, data: data.buffer }
})

// IPC: save file dialog
ipcMain.handle('dialog:saveFile', async (_event, defaultPath?: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultPath || 'document.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })
  if (result.canceled || !result.filePath) return null
  allowPath(result.filePath)
  return result.filePath
})

// IPC: write file
ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: ArrayBuffer) => {
  assertAllowedPath(filePath)
  fs.writeFileSync(filePath, Buffer.from(data))
  return true
})

// IPC: read file bytes
ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  assertAllowedPath(filePath)
  const data = fs.readFileSync(filePath)
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
})

// IPC: get temp path
ipcMain.handle('fs:getTempPath', async (_event, suffix: string) => {
  const safeSuffix = typeof suffix === 'string' ? suffix.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 32) : ''
  const tempPath = path.join(os.tmpdir(), `pdf_editor_${Date.now()}${safeSuffix}`)
  allowPath(tempPath)
  return tempPath
})

// IPC: delete file (for temp cleanup)
ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
  assertAllowedPath(filePath)
  try { fs.unlinkSync(filePath) } catch {}
  return true
})

function getPythonScriptPath(): string {
  if (isDev) {
    return path.join(process.cwd(), 'python', 'pdf_text_ops.py')
  }
  return path.join(process.resourcesPath, 'python', 'pdf_text_ops.py')
}

let pythonProcess: ChildProcess | null = null
let pendingResolve: ((value: object) => void) | null = null
let pendingReject: ((reason: Error) => void) | null = null
let lineBuffer = ''

function ensurePythonProcess() {
  if (pythonProcess && !pythonProcess.killed) return
  const scriptPath = getPythonScriptPath()
  pythonProcess = spawn('python3', ['-u', scriptPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  pythonProcess.stdout!.on('data', (data: Buffer) => {
    lineBuffer += data.toString()
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop()! // keep incomplete line
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const result = JSON.parse(line)
        if (pendingResolve) {
          const resolve = pendingResolve
          pendingResolve = null
          pendingReject = null
          resolve(result)
        }
      } catch {}
    }
  })

  pythonProcess.on('close', () => {
    pythonProcess = null
    if (pendingReject) {
      const reject = pendingReject
      pendingResolve = null
      pendingReject = null
      reject(new Error('Python process exited unexpectedly'))
    }
  })

  pythonProcess.stderr!.on('data', (data: Buffer) => {
    console.error('Python stderr:', data.toString())
  })
}

function runPythonCommand(input: object): Promise<object> {
  return new Promise((resolve, reject) => {
    ensurePythonProcess()
    pendingResolve = resolve
    pendingReject = reject
    pythonProcess!.stdin!.write(JSON.stringify(input) + '\n')
  })
}

// IPC: extract text from PDF via Python
ipcMain.handle('python:extractText', async (_event, filePath: string) => {
  try {
    assertAllowedPath(filePath)
    return await runPythonCommand({ action: 'extract', filePath })
  } catch (e: any) {
    return { ok: false, error: 'extract failed' }
  }
})

// IPC: apply text edits via Python
ipcMain.handle('python:applyTextEdits', async (_event, filePath: string, outputPath: string, edits: any[]) => {
  try {
    assertAllowedPath(filePath)
    assertAllowedPath(outputPath, 'outputPath')
    if (!Array.isArray(edits) || edits.length > 500) throw new Error('Invalid edits')
    return await runPythonCommand({ action: 'apply_edits', filePath, outputPath, edits })
  } catch (e: any) {
    return { ok: false, error: 'apply edits failed' }
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill()
    pythonProcess = null
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

