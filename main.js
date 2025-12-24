const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const axios = require('axios');

// 載入配置（深度合併，避免局部覆蓋破壞 ai.apiUrl 等設定）
function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(target, source) {
  const out = { ...target };
  if (!isObject(source)) return out;
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = out[key];
    out[key] = isObject(sv) && isObject(tv) ? deepMerge(tv, sv) : sv;
  }
  return out;
}

function loadConfig() {
  const base = require('./config.json');
  let local = {};
  if (fs.existsSync('./config.local.json')) {
    try {
      local = require('./config.local.json');
    } catch (e) {
      console.error('Failed to load config.local.json:', e.message);
    }
  }
  const merged = deepMerge(base, local);
  // 環境變數優先
  if (process.env.OPENROUTER_API_KEY) {
    merged.ai = merged.ai || {};
    merged.ai.apiKey = process.env.OPENROUTER_API_KEY;
  }
  return merged;
}

let config = loadConfig();

// 全域變數
let mainWindow = null;
let toolWindow = null;
let previousWindow = null; // 儲存快捷鍵觸發前的活躍視窗
let db = null;

// 初始化資料庫
function initDatabase() {
  const dataDir = path.dirname(config.history.dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  db = new Database(config.history.dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screenshot TEXT,
      prompt TEXT,
      result TEXT,
      model TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// 創建主視窗（隱藏，用於背景運行）
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 0,
    height: 0,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
}

// 創建工具視窗
function createToolWindow() {
  if (toolWindow) {
    // 如果視窗已存在，移動到滑鼠所在螢幕
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const { x, y, width, height } = display.bounds;
    
    // 視窗置中於滑鼠所在螢幕
    const windowX = x + Math.floor((width - config.window.width) / 2);
    const windowY = y + Math.floor((height - config.window.height) / 2);
    
    toolWindow.setPosition(windowX, windowY);
    toolWindow.show();
    toolWindow.focus();
    return;
  }

  // 獲取滑鼠位置及所在螢幕
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const { x, y, width, height } = display.bounds;
  
  // 計算視窗位置（置中於該螢幕）
  const windowX = x + Math.floor((width - config.window.width) / 2);
  const windowY = y + Math.floor((height - config.window.height) / 2);

  toolWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    x: windowX,
    y: windowY,
    frame: false,
    transparent: true,
    alwaysOnTop: config.window.alwaysOnTop,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  toolWindow.loadFile('renderer/index.html');

  // 開發模式下開啟 DevTools
  if (process.argv.includes('--dev')) {
    toolWindow.webContents.openDevTools();
  }

  toolWindow.on('blur', () => {
    // 點擊外部區域時隱藏（可選）
    // toolWindow.hide();
  });

  toolWindow.once('ready-to-show', () => {
    toolWindow.show();
    toolWindow.focus();
  });
}

// 截取螢幕畫面
async function captureScreen() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: config.screenshot.maxWidth,
        height: config.screenshot.maxHeight
      }
    });

    if (sources.length === 0) {
      throw new Error('Cannot capture screenshot');
    }

    // 獲取滑鼠所在螢幕
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    
    // 嘗試找到對應的 source（根據顯示器 ID 匹配）
    let targetSource = sources[0]; // 預設第一個
    
    // 如果有多個螢幕，嘗試匹配
    if (sources.length > 1) {
      const allDisplays = screen.getAllDisplays();
      const displayIndex = allDisplays.findIndex(d => d.id === display.id);
      
      if (displayIndex >= 0 && displayIndex < sources.length) {
        targetSource = sources[displayIndex];
      }
    }
    
    const screenshot = targetSource.thumbnail.toDataURL({
      scaleFactor: config.screenshot.quality
    });

    console.log('Screenshot captured from:', targetSource.name, 'Display ID:', display.id);

    return {
      dataURL: screenshot,
      name: targetSource.name
    };
  } catch (error) {
    console.error('Screenshot failed:', error);
    return null;
  }
}

// 註冊全域快捷鍵
function registerGlobalShortcut() {
  const ret = globalShortcut.register(config.shortcut, async () => {
    console.log('Shortcut triggered:', config.shortcut);

    // 記錄當前前景視窗（用於後續回填）
    previousWindow = BrowserWindow.getFocusedWindow();

    // 創建或顯示工具視窗
    createToolWindow();

    // 截取螢幕畫面
    const screenshot = await captureScreen();
    if (screenshot && toolWindow) {
      toolWindow.webContents.send('screenshot-captured', screenshot);
    }
  });

  if (!ret) {
    console.error('Shortcut registration failed');
  }

  console.log('Shortcut registered:', config.shortcut);
}

// IPC 通訊處理
ipcMain.handle('get-config', () => {
  // 從 localStorage 或環境變數更新 API Key（如果有）
  // 注意：主行程無法直接讀取 localStorage，這由渲染程序處理
  return config;
});

ipcMain.handle('get-history', () => {
  const stmt = db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT ?');
  return stmt.all(config.history.maxRecords);
});

ipcMain.handle('fetch-models', async () => {
  try {
    console.log('Fetching OpenRouter models...');
    const response = await axios.get('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${config.ai.apiKey}`
      }
    });
    const models = response.data.data.map(m => ({
      id: m.id,
      name: m.name || m.id,
      description: m.description
    }));
    console.log(`Fetched ${models.length} models from OpenRouter`);
    return { success: true, models };
  } catch (error) {
    console.error('Failed to fetch models:', error.message);
    return { success: false, error: error.message };
  }
});
// 檢查模型是否支援視覺輸入（啟發式）
function supportsVision(modelId = '') {
  const id = (modelId || '').toLowerCase();
  return (
    id.includes('vision') ||
    id.includes('gpt-4o') ||
    id.includes('gpt-4.1') ||
    id.includes('gpt-4.1-mini') ||
    id.includes('llava') ||
    id.includes('llama') && id.includes('vision') ||
    id.includes('gemini') && (id.includes('vision') || id.includes('1.5'))
  );
}

ipcMain.handle('capture-screenshot', async () => {
  try {
    const screenshot = await captureScreen();
    if (screenshot) {
      return { success: true, screenshot };
    } else {
      return { success: false, error: 'Screenshot failed' };
    }
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-history', (event, data) => {
  const stmt = db.prepare('INSERT INTO history (screenshot, prompt, result, model) VALUES (?, ?, ?, ?)');
  const info = stmt.run(data.screenshot, data.prompt, data.result, data.model);
  return { id: info.lastInsertRowid };
});

ipcMain.handle('generate-text', async (event, data) => {
  try {
    const { screenshot, prompt, model } = data;

    // 依據模型選擇 API
    const apiConfig = getAPIConfig(model);
    
    console.log('Generating with model:', model, 'Has screenshot:', !!screenshot);
    
    // 判斷是否附帶圖片（僅視覺模型且為 data:image/...）
    const hasImage = supportsVision(apiConfig.modelName) && typeof screenshot === 'string' && screenshot.startsWith('data:image/');

    // 添加系統提示詞
    const systemMessage = { role: 'system', content: config.ai.systemPrompt || '你是一個專業的文案生成助手。請直接輸出可用的內容，不要加入「當然」「好的」「可以」等客套話。直接回答主體內容，簡潔有力。' };
    
    // OpenRouter 標準格式：無圖用字串，有圖用 content 陣列 + image_url
    const userMessage = hasImage
      ? { role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: screenshot } }] }
      : { role: 'user', content: prompt };

    const messages = [systemMessage, userMessage];

    console.log('Payload type:', hasImage ? 'multimodal' : 'text-only');
    console.log('Request URL:', apiConfig.url);

    const requestBody = {
      model: apiConfig.modelName,
      messages: messages,
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
      stream: false
    };

    // 基本驗證：URL 與 API Key 是否存在
    if (!apiConfig.url || !/^https?:\/\//.test(apiConfig.url)) {
      throw new Error(`Invalid API URL: ${apiConfig.url}`);
    }
    if (!config.ai.apiKey || typeof config.ai.apiKey !== 'string') {
      throw new Error('Missing OPENROUTER_API_KEY');
    }

    const response = await axios.post(apiConfig.url, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai.apiKey}`,
        'HTTP-Referer': 'https://github.com/yourusername/electron-ai-writer',
        'Referer': 'https://github.com/yourusername/electron-ai-writer',
        'X-Title': 'Electron AI Writer'
      },
      timeout: 60000
    });

    const result = response.data.choices[0].message.content;
    console.log('Generation successful');
    return { success: true, result };
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    const headers = error.response?.headers;
    console.error('AI generation failed:', {
      message: error.message,
      status,
      data,
      headers,
      url: (typeof error.config?.url === 'string' ? error.config.url : undefined) || apiConfig?.url,
      model: data?.model || data?.id || 'unknown',
    });
    const errorMsg = (data?.error?.message || data?.message || error.message || 'Unknown error');
    return { 
      success: false, 
      error: errorMsg,
      debug: { status, data }
    };
  }
});

ipcMain.handle('send-text-to-window', async (event, text) => {
  try {
    // 先寫入剪貼簿
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    console.log('Text copied to clipboard:', text.substring(0, 50) + '...');

    // 隱藏工具視窗
    if (toolWindow) {
      toolWindow.hide();
    }

    // 等待足夠時間讓焦點切換回原視窗（增加至800ms確保切換完成）
    await new Promise(resolve => setTimeout(resolve, 800));

    // 使用 keysender 的正確 API：貼上剪貼簿內容（速度快、相容性好）
    const keysender = require('keysender');
    const sender = new keysender.Hardware();
    const kb = sender.keyboard;

    // 執行貼上操作
    await kb.sendKeyAsync(['ctrl', 'v'], 50);

    return { success: true };
  } catch (error) {
    console.error('Text input failed, fallback to typing:', error);
    try {
      const keysender = require('keysender');
      const sender = new keysender.Hardware();
      await sender.keyboard.printTextAsync(text, config.textInput.delay || 0);
      return { success: true };
    } catch (err2) {
      console.error('Text typing fallback failed:', err2);
      return { success: false, error: err2.message };
    }
  }
});

ipcMain.on('close-window', () => {
  if (toolWindow) {
    toolWindow.hide();
  }
});

ipcMain.on('minimize-window', () => {
  if (toolWindow) {
    toolWindow.minimize();
  }
});

ipcMain.on('set-opacity', (event, opacity) => {
  if (toolWindow) {
    // 確保 opacity 在 0.3 ~ 1.0 之間
    const validOpacity = Math.max(0.3, Math.min(1.0, opacity));
    toolWindow.setOpacity(validOpacity);
    console.log('Window opacity set to:', validOpacity);
  }
});

// 取得 API 配置
function getAPIConfig(model) {
  // OpenRouter 統一使用同一個 endpoint
  return { 
    url: config.ai.apiUrl,
    modelName: model || config.ai.model
  };
}

// 應用初始化
app.whenReady().then(() => {
  initDatabase();
  createMainWindow();
  registerGlobalShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 應用關閉
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // 注銷全域快捷鍵
  globalShortcut.unregisterAll();
  
  // 關閉資料庫
  if (db) {
    db.close();
  }
});

// 錯誤處理
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
