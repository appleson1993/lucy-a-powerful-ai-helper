// 全域變數
let config = null;
let currentScreenshot = null;
let currentResult = null;
let historyExpanded = false;
let elements = {};

// 初始化
async function init() {
  console.log('Starting initialization...');
  
  try {
    // 獲取所有元素引用
    elements = {
      screenshotPlaceholder: document.getElementById('screenshotPlaceholder'),
      screenshotPreview: document.getElementById('screenshotPreview'),
      btnScreenshot: document.getElementById('btnScreenshot'),
      btnEnlarge: document.getElementById('btnEnlarge'),
      btnClearScreenshot: document.getElementById('btnClearScreenshot'),
      promptInput: document.getElementById('promptInput'),
      modelSelect: document.getElementById('modelSelect'),
      btnGenerate: document.getElementById('btnGenerate'),
      resultSection: document.getElementById('resultSection'),
      resultContent: document.getElementById('resultContent'),
      btnCopy: document.getElementById('btnCopy'),
      btnEdit: document.getElementById('btnEdit'),
      btnSend: document.getElementById('btnSend'),
      loading: document.getElementById('loading'),
      btnClose: document.getElementById('btnClose'),
      btnMinimize: document.getElementById('btnMinimize'),
      historyList: document.getElementById('historyList'),
      btnHistoryToggle: document.getElementById('btnHistoryToggle')
    };
    
    console.log('Elements loaded:', elements);
    
    // 載入配置
    config = await window.electronAPI.getConfig();
    console.log('Config loaded:', config);
    
    // 載入模型選項
    await loadModelOptions();
    
    // 載入歷史記錄
    loadHistory();
    
    // 設置事件監聽
    setupEventListeners();
    
    console.log('App initialized successfully');
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// 載入模型選項
async function loadModelOptions() {
  if (!elements.modelSelect || !config || !config.ai) {
    console.error('Cannot load models:', { modelSelect: elements.modelSelect, config });
    return;
  }
  
  elements.modelSelect.innerHTML = '<option value="">Loading models...</option>';
  console.log('Fetching models from OpenRouter...');
  
  try {
    const result = await window.electronAPI.fetchModels();
    
    if (result.success && result.models && result.models.length > 0) {
      elements.modelSelect.innerHTML = '';
      
      result.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        if (model.id === config.ai.model) {
          option.selected = true;
        }
        elements.modelSelect.appendChild(option);
      });
      
      console.log('Loaded', result.models.length, 'models from OpenRouter');
    } else {
      // 如果 API 失敗，使用配置檔中的預設模型
      console.warn('Failed to fetch models, using config defaults');
      elements.modelSelect.innerHTML = '';
      
      if (config.ai.models && config.ai.models.length > 0) {
        config.ai.models.forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          if (model === config.ai.model) {
            option.selected = true;
          }
          elements.modelSelect.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error('Error loading models:', error);
    elements.modelSelect.innerHTML = '<option value="">Error loading models</option>';
  }
}

// 設置事件監聽
function setupEventListeners() {
  console.log('Setting up event listeners...');
  
  // 視窗控制
  if (elements.btnClose) {
    elements.btnClose.addEventListener('click', () => {
      console.log('Close button clicked');
      window.electronAPI.closeWindow();
    });
  }

  if (elements.btnMinimize) {
    elements.btnMinimize.addEventListener('click', () => {
      console.log('Minimize button clicked');
      window.electronAPI.minimizeWindow();
    });
  }

  // 模板按鈕
  document.querySelectorAll('.template-btn').forEach((btn, index) => {
    btn.addEventListener('click', () => {
      console.log('Template button clicked:', index);
      if (config && config.templates && config.templates[index]) {
        const template = config.templates[index];
        elements.promptInput.value = template.prompt;
      }
    });
  });

  // 生成按鈕
  if (elements.btnGenerate) {
    elements.btnGenerate.addEventListener('click', () => {
      console.log('Generate button clicked');
      generateText();
    });
  }
  
  // Enter 鍵快速生成（Ctrl+Enter）
  if (elements.promptInput) {
    elements.promptInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        console.log('Ctrl+Enter pressed');
        generateText();
      }
    });
  }

  // 複製按鈕
  if (elements.btnCopy) {
    elements.btnCopy.addEventListener('click', () => {
      console.log('Copy button clicked');
      copyToClipboard();
    });
  }

  // 編輯按鈕
  if (elements.btnEdit) {
    elements.btnEdit.addEventListener('click', () => {
      console.log('Edit button clicked');
      const newText = prompt('Edit text:', currentResult);
      if (newText !== null) {
        currentResult = newText;
        elements.resultContent.textContent = newText;
      }
    });
  }

  // 送出按鈕
  if (elements.btnSend) {
    elements.btnSend.addEventListener('click', () => {
      console.log('Send button clicked');
      sendTextToWindow();
    });
  }

  // 放大檢視
  if (elements.btnEnlarge) {
    elements.btnEnlarge.addEventListener('click', () => {
      console.log('Enlarge button clicked');
      if (currentScreenshot) {
        const win = window.open('', '_blank', 'width=800,height=600');
        win.document.write(`<img src="${currentScreenshot}" style="width:100%; height:auto;" />`);
      }
    });
  }
  
  // 截圖按鈕
  if (elements.btnScreenshot) {
    elements.btnScreenshot.addEventListener('click', () => {
      console.log('Screenshot button clicked');
      captureScreenshotManually();
    });
  }
  
  // 清除截圖按鈕
  if (elements.btnClearScreenshot) {
    elements.btnClearScreenshot.addEventListener('click', () => {
      console.log('Clear screenshot button clicked');
      clearScreenshot();
    });
  }

  // 歷史記錄切換
  const historyHeader = document.querySelector('.history-header');
  if (historyHeader) {
    historyHeader.addEventListener('click', () => {
      console.log('History toggle clicked');
      toggleHistory();
    });
  }

  // 監聽截圖事件
  window.electronAPI.onScreenshotCaptured((screenshot) => {
    console.log('Screenshot captured');
    displayScreenshot(screenshot);
  });
  
  // 截圖按鈕
  if (elements.btnScreenshot) {
    elements.btnScreenshot.addEventListener('click', () => {
      console.log('Screenshot button clicked');
      captureScreenshotManually();
    });
  }
  
  // 清除截圖按鈕
  if (elements.btnClearScreenshot) {
    elements.btnClearScreenshot.addEventListener('click', () => {
      console.log('Clear screenshot button clicked');
      clearScreenshot();
    });
  }
  
  console.log('Event listeners setup complete');
}

// 顯示截圖
function displayScreenshot(screenshot) {
  currentScreenshot = screenshot.dataURL;
  
  elements.screenshotPlaceholder.style.display = 'none';
  elements.screenshotPreview.src = currentScreenshot;
  elements.screenshotPreview.style.display = 'block';
  elements.btnEnlarge.style.display = 'block';
  elements.btnClearScreenshot.style.display = 'block';
  
  console.log('Screenshot displayed:', screenshot.name);
}

// 手動截圖
async function captureScreenshotManually() {
  console.log('Manual screenshot triggered');
  try {
    const result = await window.electronAPI.captureScreenshot();
    if (result.success && result.screenshot) {
      displayScreenshot(result.screenshot);
    } else {
      alert('截圖失敗: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Screenshot error:', error);
    alert('截圖失敗: ' + error.message);
  }
}

// 清除截圖
function clearScreenshot() {
  console.log('Clear screenshot');
  currentScreenshot = null;
  elements.screenshotPreview.style.display = 'none';
  elements.screenshotPlaceholder.style.display = 'flex';
  elements.btnEnlarge.style.display = 'none';
  elements.btnClearScreenshot.style.display = 'none';
}

// 生成文案
async function generateText() {
  const prompt = elements.promptInput.value.trim();
  
  if (!prompt) {
    alert('請輸入生成指令');
    return;
  }

  // 顯示載入狀態
  elements.btnGenerate.disabled = true;
  elements.loading.style.display = 'flex';
  elements.resultSection.style.display = 'none';

  try {
    const model = elements.modelSelect.value;
    
    const response = await window.electronAPI.generateText({
      screenshot: currentScreenshot, // 可能是 null
      prompt: prompt,
      model: model
    });

    if (response.success) {
      currentResult = response.result;
      displayResult(response.result);
      
      // 儲存到歷史記錄
      await window.electronAPI.saveHistory({
        screenshot: currentScreenshot || '',
        prompt: prompt,
        result: response.result,
        model: model
      });
      
      // 重新載入歷史
      loadHistory();
    } else {
      console.error('Generation failed:', response.error);
      alert('生成失敗:\n' + response.error);
    }
  } catch (error) {
    console.error('Generation error:', error);
    alert('生成失敗:\n' + error.message);
  } finally {
    elements.btnGenerate.disabled = false;
    elements.loading.style.display = 'none';
  }
}

// 顯示結果
function displayResult(text) {
  elements.resultContent.textContent = text;
  elements.resultSection.style.display = 'block';
}

// 複製到剪貼簿
function copyToClipboard() {
  if (!currentResult) return;
  
  navigator.clipboard.writeText(currentResult).then(() => {
    elements.btnCopy.textContent = '✅ 已複製';
    setTimeout(() => {
      elements.btnCopy.textContent = '📋 複製';
    }, 2000);
  }).catch(err => {
    console.error('複製失敗:', err);
    alert('複製失敗');
  });
}

// 送出文字到原視窗
async function sendTextToWindow() {
  if (!currentResult) return;
  
  elements.btnSend.disabled = true;
  elements.btnSend.textContent = '⏳ 正在送出...';
  
  try {
    const response = await window.electronAPI.sendTextToWindow(currentResult);
    
    if (response.success) {
      elements.btnSend.textContent = '✅ 已送出';
      
      // 延遲後自動關閉視窗
      setTimeout(() => {
        window.electronAPI.closeWindow();
      }, config.window.autoHideDelay);
    } else {
      alert('送出失敗: ' + response.error);
      elements.btnSend.disabled = false;
      elements.btnSend.textContent = '📤 送出並回填';
    }
  } catch (error) {
    console.error('送出錯誤:', error);
    alert('送出失敗: ' + error.message);
    elements.btnSend.disabled = false;
    elements.btnSend.textContent = '📤 送出並回填';
  }
}

// 載入歷史記錄
async function loadHistory() {
  try {
    const history = await window.electronAPI.getHistory();
    displayHistory(history);
  } catch (error) {
    console.error('載入歷史失敗:', error);
  }
}

// 顯示歷史記錄
function displayHistory(history) {
  elements.historyList.innerHTML = '';
  
  if (history.length === 0) {
    elements.historyList.innerHTML = '<div style="text-align:center; color:#999; padding:16px;">暫無記錄</div>';
    return;
  }
  
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    const time = new Date(item.timestamp).toLocaleString('zh-TW', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    div.innerHTML = `
      <div class="history-item-time">${time} - ${item.model}</div>
      <div class="history-item-text">${item.result}</div>
    `;
    
    div.addEventListener('click', () => {
      currentResult = item.result;
      displayResult(item.result);
    });
    
    elements.historyList.appendChild(div);
  });
}

// 切換歷史記錄顯示
function toggleHistory() {
  historyExpanded = !historyExpanded;
  
  if (historyExpanded) {
    elements.historyList.style.display = 'block';
    elements.btnHistoryToggle.textContent = '▲';
  } else {
    elements.historyList.style.display = 'none';
    elements.btnHistoryToggle.textContent = '▼';
  }
}

// 啟動應用
document.addEventListener('DOMContentLoaded', () => {
  init();
});
