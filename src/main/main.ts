import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
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

// IPC: open file dialog
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const data = fs.readFileSync(filePath)
  return { filePath, data: data.buffer }
})

// IPC: save file dialog
ipcMain.handle('dialog:saveFile', async (_event, defaultPath?: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultPath || 'document.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  })
  return result.canceled ? null : result.filePath
})

// IPC: write file
ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: ArrayBuffer) => {
  fs.writeFileSync(filePath, Buffer.from(data))
  return true
})

// IPC: read file bytes
ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  const data = fs.readFileSync(filePath)
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
})

// IPC: get temp path
ipcMain.handle('fs:getTempPath', async (_event, suffix: string) => {
  return path.join(os.tmpdir(), `pdf_editor_${Date.now()}${suffix}`)
})

function getPythonScriptPath(): string {
  if (isDev) {
    return path.join(process.cwd(), 'python', 'pdf_text_ops.py')
  }
  return path.join(process.resourcesPath, 'python', 'pdf_text_ops.py')
}

function runPythonCommand(input: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const scriptPath = getPythonScriptPath()
    const child = execFile('python3', [scriptPath], {
      maxBuffer: 50 * 1024 * 1024,
    }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      try {
        resolve(JSON.parse(stdout))
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`))
      }
    })
    child.stdin!.write(JSON.stringify(input))
    child.stdin!.end()
  })
}

// IPC: extract text from PDF via Python
ipcMain.handle('python:extractText', async (_event, filePath: string) => {
  try {
    return await runPythonCommand({ action: 'extract', filePath })
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
})

// IPC: apply text edits via Python
ipcMain.handle('python:applyTextEdits', async (_event, filePath: string, outputPath: string, edits: any[]) => {
  try {
    return await runPythonCommand({ action: 'apply_edits', filePath, outputPath, edits })
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

