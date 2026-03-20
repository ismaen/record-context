const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  checkScreenPermission: () => ipcRenderer.invoke('check-screen-permission'),
  startRecording: () => ipcRenderer.invoke('start-recording'),
  transcribeAudio: (arrayBuffer) => ipcRenderer.invoke('transcribe-audio', arrayBuffer),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  onInsightStatus: (callback) => ipcRenderer.on('insight-status', (_event, msg) => callback(msg)),
});
