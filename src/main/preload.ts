import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

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
  deleteFile: (filePath: string) => ipcRenderer.invoke('fs:deleteFile', filePath),
  onMenuOpen: (cb: () => void) => {
    const listener = (_e: IpcRendererEvent) => cb()
    ipcRenderer.on('menu:open', listener)
    return () => { ipcRenderer.removeListener('menu:open', listener) }
  },
  onMenuSave: (cb: () => void) => {
    const listener = (_e: IpcRendererEvent) => cb()
    ipcRenderer.on('menu:save', listener)
    return () => { ipcRenderer.removeListener('menu:save', listener) }
  },
  onMenuSaveAs: (cb: () => void) => {
    const listener = (_e: IpcRendererEvent) => cb()
    ipcRenderer.on('menu:saveAs', listener)
    return () => { ipcRenderer.removeListener('menu:saveAs', listener) }
  },
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
})
