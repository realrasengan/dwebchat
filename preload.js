const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (message) => ipcRenderer.send('ui', message),
  receive: (callback) => ipcRenderer.on('backend', callback),
});
