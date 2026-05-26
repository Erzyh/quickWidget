const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  saveShortcuts: (list) => ipcRenderer.invoke('save-shortcuts', list),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (patch) => ipcRenderer.invoke('save-settings', patch),
  setClickable: (yes) => ipcRenderer.send('set-clickable', !!yes),
  openShortcut: (sc) => ipcRenderer.invoke('open-shortcut', sc),
  quit: () => ipcRenderer.invoke('quit-app')
});
