const { app, BrowserWindow, globalShortcut, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const axios = require('axios');

// 載入配置
let config = require('./config.json');
if (fs.existsSync('./config.local.json')) {
  config = { ...config, ...require('./config.local.json') };
}

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
    toolWindow.show();
    toolWindow.focus();
    return;
  }

  toolWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
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

    // 取得主要顯示器（第一個）
    const primaryScreen = sources[0];
    const screenshot = primaryScreen.thumbnail.toDataURL({
      scaleFactor: config.screenshot.quality
    });

    return {
      dataURL: screenshot,
      name: primaryScreen.name
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
    
    const models = response.data.data
      .filter(m => m.id.includes('vision') || m.id.includes('gpt-4') || m.id.includes('claude') || m.id.includes('gemini'))
      .map(m => ({
        id: m.id,
        name: m.name || m.id,
        description: m.description
      }));
    
    console.log(`Fetched ${models.length} vision models`);
    return { success: true, models };
  } catch (error) {
    console.error('Failed to fetch models:', error.message);
    return { success: false, error: error.message };
  }
});

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
    
    // 構建消息內容
    const content = [];
    
    // 添加文字提示
    content.push({
      type: 'text',
      text: prompt
    });
    
    // 如果有截圖且格式正確，才加入圖片
    if (screenshot && typeof screenshot === 'string' && screenshot.startsWith('data:image/')) {
      content.push({
        type: 'image_url',
        image_url: {
          url: screenshot
        }
      });
      console.log('Screenshot included in request');
    } else {
      console.log('No screenshot or invalid format, using text-only');
    }

    const response = await axios.post(apiConfig.url, {
      model: apiConfig.modelName,
      messages: [
        {
          role: 'user',
          content: content
        }
      ],
      max_tokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai.apiKey}`,
        'HTTP-Referer': 'https://github.com/yourusername/electron-ai-writer',
        'X-Title': 'Electron AI Writer'
      },
      timeout: 60000
    });

    const result = response.data.choices[0].message.content;
    console.log('Generation successful');
    return { success: true, result };
  } catch (error) {
    console.error('AI generation failed:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message || error.message;
    return { 
      success: false, 
      error: errorMsg
    };
  }
});

ipcMain.handle('send-text-to-window', async (event, text) => {
  try {
    // 隱藏工具視窗
    if (toolWindow) {
      toolWindow.hide();
    }

    // 等待一小段時間讓視窗切換完成
    await new Promise(resolve => setTimeout(resolve, 200));

    // 使用 keysender 輸入文字（推薦方案 B）
    const keysender = require('keysender');
    
    // 模擬 Ctrl+A 全選（可選）
    // keysender.sendCombination(['control', 'a']);
    // await new Promise(resolve => setTimeout(resolve, 100));

    // 輸入文字
    await keysender.sendText(text, config.textInput.delay);

    return { success: true };
  } catch (error) {
    console.error('Text input failed:', error);
    return { success: false, error: error.message };
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
