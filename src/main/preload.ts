import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (defaultPath?: string) => ipcRenderer.invoke('dialog:saveFile', defaultPath),
  writeFile: (filePath: string, data: ArrayBuffer) =>
    ipcRenderer.invoke('fs:writeFile', filePath, data),
  extractText: (filePath: string) => ipcRenderer.invoke('python:extractText', filePath),
  applyTextEdits: (filePath: string, outputPath: string, edits: any[]) =>
    ipcRenderer.invoke('python:applyTextEdits', filePath, outputPath, edits),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  getTempPath: (suffix: string) => ipcRenderer.invoke('fs:getTempPath', suffix),
  onMenuOpen: (cb: () => void) => ipcRenderer.on('menu:open', cb),
  onMenuSave: (cb: () => void) => ipcRenderer.on('menu:save', cb),
  onMenuSaveAs: (cb: () => void) => ipcRenderer.on('menu:saveAs', cb),
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
})

