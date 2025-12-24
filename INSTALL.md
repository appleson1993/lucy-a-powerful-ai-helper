# 快速安裝指南

## ✅ 安裝成功！

依賴已成功安裝，現在可以啟動應用程式。

## 🔑 配置 API 金鑰

在啟動前，請先設定 OpenAI API 金鑰：

1. 編輯 `config.local.json` 檔案
2. 將 `YOUR_API_KEY_HERE` 替換為您的 OpenAI API Key

```json
{
  "ai": {
    "apiKey": "sk-proj-xxxxx..."
  }
}
```

## 🚀 啟動應用

```bash
npm start
```

## 📝 使用方式

1. **啟動後會在背景執行**（系統匣可能看不到圖示，這是正常的）

2. **按下快捷鍵 `Ctrl+Alt+Q`** 
   - 工具視窗會彈出
   - 自動截取當前螢幕畫面

3. **輸入生成指令**
   - 例如：「幫我寫一段 Instagram 貼文」
   - 或使用快速模板按鈕

4. **點擊「生成文案」**
   - AI 會根據截圖和指令生成內容

5. **點擊「送出並回填」**
   - 文案會自動輸入到原始視窗
   - 3 秒後工具自動關閉

## ⚠️ 注意事項

### 如果 keysender 安裝有問題

```bash
npm install keysender --build-from-source
```

### 如果 better-sqlite3 安裝有問題

```bash
npm rebuild better-sqlite3
```

### 如果文字回填不穩定

編輯 `config.json`，增加延遲時間：

```json
{
  "textInput": {
    "delay": 100,
    "retryAttempts": 5
  }
}
```

## 🔧 開發模式

開啟 DevTools 進行除錯：

```bash
npm run dev
```

## 📦 打包發布

建立獨立執行檔：

```bash
npm run build
```

執行檔會在 `dist/` 目錄中。

## 🐛 疑難排解

### 快捷鍵無反應
- 檢查是否有其他程式佔用 `Ctrl+Alt+Q`
- 在 `config.json` 中更改快捷鍵組合

### API 錯誤
- 確認 API Key 正確
- 檢查網路連線
- 查看 Console 錯誤訊息（開發模式）

### 截圖失敗
- 確認有顯示器連接
- Windows 10/11 需要螢幕錄製權限

## 📚 更多資訊

詳見 [README.md](README.md) 和 [DEV_NOTES.md](DEV_NOTES.md)
