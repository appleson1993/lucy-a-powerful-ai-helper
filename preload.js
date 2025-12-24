const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 給渲染程序
contextBridge.exposeInMainWorld('electronAPI', {
  // 取得配置
  getConfig: () => ipcRenderer.invoke('get-config'),
  
  // 獲取模型列表
  fetchModels: () => ipcRenderer.invoke('fetch-models'),
  
  // 手動截圖
  captureScreenshot: () => ipcRenderer.invoke('capture-screenshot'),
  
  // 截圖事件監聽
  onScreenshotCaptured: (callback) => {
    ipcRenderer.on('screenshot-captured', (event, data) => callback(data));
  },
  
  // AI 文案生成
  generateText: (data) => ipcRenderer.invoke('generate-text', data),
  
  // 文字回填
  sendTextToWindow: (text) => ipcRenderer.invoke('send-text-to-window', text),
  
  // 歷史記錄
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (data) => ipcRenderer.invoke('save-history', data),
  
  // 視窗控制
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  setOpacity: (opacity) => ipcRenderer.send('set-opacity', opacity)
});
