# 專案開發注意事項

## Windows Native Modules 安裝

本專案使用以下 native modules，需要編譯環境:

### 安裝 Visual Studio Build Tools

```bash
npm install --global windows-build-tools
```

或手動安裝 [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)

### 問題排解

如果 `keysender` 安裝失敗:
```bash
npm install --save keysender --build-from-source
```

如果 `better-sqlite3` 安裝失敗:
```bash
npm rebuild better-sqlite3
```

## API 配置

### OpenAI API

1. 前往 https://platform.openai.com/api-keys
2. 創建 API Key
3. 填入 `config.local.json`:
   ```json
   {
     "ai": {
       "apiUrl": "https://api.openai.com/v1/chat/completions",
       "apiKey": "sk-xxx..."
     }
   }
   ```

### Claude API

```json
{
  "ai": {
    "apiUrl": "https://api.anthropic.com/v1/messages",
    "apiKey": "sk-ant-xxx...",
    "model": "claude-3-opus"
  }
}
```

### Gemini API

```json
{
  "ai": {
    "apiUrl": "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent",
    "apiKey": "AIza...",
    "model": "gemini-pro"
  }
}
```

## 開發模式

啟用 DevTools:
```bash
npm run dev
```

## 打包注意事項

1. 確保所有 native modules 已正確編譯
2. 檢查 `package.json` 中的 `build.files` 排除不必要的檔案
3. 準備應用程式圖示 (`build/icon.ico`)

## 測試清單

- [ ] 快捷鍵註冊成功
- [ ] 截圖功能正常
- [ ] 視窗彈出並置頂
- [ ] AI API 調用成功
- [ ] 文字回填到目標應用
- [ ] 歷史記錄儲存與讀取
- [ ] 應用關閉時清理資源
- [ ] 多次觸發快捷鍵穩定性

## 效能優化

1. 截圖壓縮: 調整 `quality` 參數平衡品質與檔案大小
2. API 請求快取: 相同截圖+指令可快取結果
3. 資料庫索引: 為 timestamp 建立索引加速查詢
4. 記憶體管理: 限制歷史記錄數量避免資料庫過大

## 安全性考量

1. API Key 不應提交到版本控制
2. 使用 `config.local.json` 儲存敏感資訊
3. 截圖資料不應傳送到非必要的第三方服務
4. 考慮加密本地資料庫（可選）

## 已知限制

1. 目前僅支援 Windows
2. 某些應用程式（遊戲、管理員權限）可能無法回填
3. 多顯示器環境預設只截取主螢幕
4. 大尺寸截圖可能超過 API 限制
