# Electron AI 文案生成工具

這是一個基於 Electron 開發的桌面應用程式,可透過全域快捷鍵快速啟動 AI 文案生成功能,自動截取螢幕畫面並將生成的內容回填到原始視窗。
<img width="588" height="506" alt="image" src="https://github.com/user-attachments/assets/8fec9af9-e1d9-4b78-bcee-a9028b10fbe1" />


## 功能特色

✨ **全域快捷鍵觸發** - 按下 `Ctrl+Alt+Q` 即可在任何應用程式中啟動  
📸 **自動螢幕截圖** - 智能捕捉當前畫面內容,提供 AI 上下文  
🤖 **多模型支援** - 支援 GPT-4o、Claude 3、Gemini Pro 等多種 AI 模型  
⚡ **一鍵回填** - 生成的文案自動輸入到原始應用程式視窗  
📚 **歷史記錄** - 本地儲存最近 10 筆生成記錄,隨時重用  
🎨 **快速模板** - 內建社群貼文、客服回覆、商品描述等常用模板  

## 安裝與使用

### 前置需求

- Node.js 16.x 或更高版本
- Windows 作業系統（目前僅支援 Windows）
- Visual Studio Build Tools（用於編譯 native modules）

### 安裝步驟

1. **安裝依賴套件**
   ```bash
   npm install
   ```

2. **配置 AI API 金鑰**
   
   複製 `config.json` 為 `config.local.json` 並填入您的 API 金鑰:
   ```json
   {
     "ai": {
       "apiKey": "your-api-key-here"
     }
   }
   ```

3. **啟動開發模式**
   ```bash
   npm start
   ```

4. **建立生產版本**
   ```bash
   npm run build
   ```
   執行檔會生成在 `dist/` 目錄中。

## 使用說明

1. **啟動應用** - 執行程式後會在系統背景運行（系統匣）

2. **觸發快捷鍵** - 在任何應用程式中按下 `Ctrl+Alt+Q`，工具視窗會彈出並自動截取螢幕

3. **輸入指令** - 在文字框中輸入生成指令，例如:
   - 「為這個 Instagram 貼文撰寫吸引人的配文」
   - 「根據上方對話生成客服回覆」
   - 「幫我整理這個會議記錄的重點」

4. **選擇模型** - 從下拉選單選擇 AI 模型（預設 GPT-4o）

5. **生成文案** - 點擊「✨ 生成文案」按鈕,等待 AI 處理

6. **回填文字** - 點擊「📤 送出並回填」,文案會自動輸入到原始視窗

7. **自動關閉** - 送出後 3 秒視窗自動隱藏,準備下次使用

## 配置選項

在 `config.json` 中可自訂以下設定:

```json
{
  "shortcut": "CommandOrControl+Alt+Q",  // 全域快捷鍵
  "window": {
    "width": 600,                         // 視窗寬度
    "height": 500,                        // 視窗高度
    "autoHideDelay": 3000                 // 自動隱藏延遲（毫秒）
  },
  "ai": {
    "apiUrl": "https://api.openai.com/v1/chat/completions",
    "apiKey": "",                         // 您的 API 金鑰
    "model": "gpt-4o",                    // 預設模型
    "maxTokens": 500,                     // 最大生成長度
    "temperature": 0.7                    // 生成溫度
  },
  "textInput": {
    "delay": 50,                          // 輸入延遲（毫秒）
    "retryAttempts": 3                    // 重試次數
  }
}
```

## 技術架構

### 核心技術棧

- **Electron** - 跨平台桌面應用框架
- **desktopCapturer** - 螢幕截圖 API
- **globalShortcut** - 全域快捷鍵註冊
- **keysender** - 文字輸入模擬（方案 B）
- **ffi-napi / ref-napi** - Win32 API 整合（方案 A,可選）
- **better-sqlite3** - 本地歷史記錄資料庫
- **axios** - HTTP 請求客戶端

### 檔案結構

```
electron-ai-writer/
├── main.js              # 主程序（Electron 後端）
├── preload.js           # 預載腳本（IPC 橋接）
├── config.json          # 配置檔案
├── package.json         # 專案配置
├── renderer/            # 渲染程序（前端）
│   ├── index.html       # 主介面
│   ├── style.css        # 樣式表
│   └── renderer.js      # 前端邏輯
└── data/                # 資料目錄
    └── history.db       # 歷史記錄資料庫
```

## 進階功能

### 自訂模板

在 `config.json` 的 `templates` 陣列中新增模板:

```json
{
  "name": "Email 回覆",
  "prompt": "根據上方郵件內容,撰寫專業的英文回覆信件"
}
```

### 切換 AI 模型

支援以下 AI 服務（需對應配置 API endpoint）:

- OpenAI GPT-4o
- Anthropic Claude 3
- Google Gemini Pro

### 歷史記錄管理

- 自動儲存最近 10 筆生成記錄
- 點擊歷史項目快速重用
- 資料儲存在本地 SQLite 資料庫

## 常見問題

### Q: 快捷鍵無法觸發?
A: 確認沒有其他應用程式佔用相同快捷鍵,可在 `config.json` 中修改為其他組合。

### Q: 文字回填失敗?
A: 某些應用程式有輸入保護機制,建議:
1. 增加 `textInput.delay` 延遲時間
2. 改用手動複製貼上方式
3. 檢查目標應用是否需要管理員權限

### Q: API 錯誤?
A: 確認以下事項:
- API 金鑰正確填入 `config.local.json`
- 網路連線正常
- API 額度充足
- 截圖 base64 大小未超過 API 限制

### Q: 截圖品質太差?
A: 調整 `config.json` 中的 `screenshot.quality` (0.1-1.0)

## 開發計畫

- [ ] macOS / Linux 支援
- [ ] 多顯示器選擇
- [ ] 串流式生成（即時顯示）
- [ ] 語音輸入整合
- [ ] 更多 AI 模型支援
- [ ] 插件系統
- [ ] 雲端同步歷史記錄

## 授權

MIT License

## 貢獻

歡迎提交 Issue 和 Pull Request!

## 聯絡方式

如有問題或建議,請開啟 GitHub Issue。
