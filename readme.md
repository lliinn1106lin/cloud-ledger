# 💰 雲端個人記帳本 (Cloud Ledger) — 專案自述文件

這是一個使用純前端技術（**HTML + Tailwind CSS + JavaScript**）開發的個人雲端記帳網頁 App，串接 **Firebase Authentication** 與 **Cloud Firestore**，搭配 **Chart.js** 圖表分析。每個 Google 帳號登入後都擁有完全獨立的雲端帳本，跨裝置即時同步不打架。

## ✨ 核心功能特色

* **Google 帳號登入與資料隔離**：每位使用者只會讀寫自己 `UID` 底下的資料，不同帳號帳本完全獨立。

* **完整收支管理**：支援新增、編輯、刪除紀錄（包含日期、金額、收支類型、餐飲/交通/娛樂等分類、備註），並可依類型與關鍵字搜尋。

* **即時統計與圓餅圖**：自動計算當月總收入、總支出與結餘，並用 Chart.js 繪製「支出 / 收入」分類佔比圓餅圖。

* **右側滑出式功能側邊欄**：點擊右上角「功能與設定」即可展開，內建：

  * 帳號資訊卡與一鍵複製 UID

  * 🌙 **深色模式**切換

  * 💱 **顯示幣別**切換（`NT$` / `$` / `¥` / `€`）

  * 🎯 **每月支出預算**設定與即時進度條

  * 📝 **預設記帳類型**設定

  * 📄 **CSV 匯出**（支援匯出「當月」或「全部歷史紀錄」，內建 UTF-8 BOM 防 Excel 亂碼）

## 📁 專案檔案結構

| 檔案名稱 | 說明 | 
| ----- | ----- | 
| `index.html` | 網頁主架構、響應式介面與右側滑出式側邊欄 | 
| `firebase-config.js` | **Firebase 專案設定檔（需填入你自己的金鑰）** | 
| `app.js` | 核心邏輯（登入驗證、Firestore 即時同步、圖表、設定與 CSV 匯出） | 
| `README.md` | 本專案自述文件與設定部署教學 | 

## 🚀 步驟一：建立 Firebase 專案並取得金鑰

1. 前往 [Firebase Console](https://console.firebase.google.com/)，使用你的 Google 帳號登入。

2. 點擊 **「建立專案（Create a project）」**，輸入專案名稱（例如 `my-cloud-ledger`）並完成建立。

3. 進入專案首頁後，點擊 **Web 圖示 `</>`** 新增網頁應用程式，輸入暱稱後點擊 **註冊應用程式**。

4. 複製畫面上顯示的 `firebaseConfig` 物件（包含 `apiKey`、`authDomain`、`projectId`、`storageBucket`、`messagingSenderId`、`appId`）。

5. 打開專案中的 **`firebase-config.js`**，將那 6 個欄位貼上取代原本的 `"YOUR_..."` 並存檔。

## 🔐 步驟二：啟用 Google 帳號登入

1. 在 Firebase Console 左側選單點擊 **「建構（Build）」→「Authentication」**。

2. 點擊 **「開始使用（Get started）」**，切到 **「登入方式（Sign-in method）」** 分頁。

3. 選擇 **「Google」**，將右上角的 **啟用** 開關打開。

4. 選擇你的 **專案支援電子郵件**（選自己的 Gmail 即可），按下 **儲存**。

## 🗄️ 步驟三：建立 Firestore 資料庫與安全規則

1. 在左側選單點擊 **「建構（Build）」→「Firestore Database」**，點擊 **「建立資料庫」**。

2. 位置建議選擇 **`asia-east1 (Taiwan)`**，規則先選 **「以正式版模式啟動」** 後建立。

3. 建立完成後，點擊上方 **「規則（Rules）」** 分頁，將編輯器內容**全部清空**後貼上以下規則：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/transactions/{transactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}

```

4. 點擊右上角的 **「發佈（Publish）」**，即完成帳號資料隔離保護。

## 💻 步驟四：在本機電腦執行測試

因為專案使用 `ES Modules`（`<script type="module">`），**請勿直接雙擊 `index.html`（`file://` 網址會被瀏覽器擋掉）**。請在專案資料夾內打開終端機執行：

```
python3 -m http.server 8000

```

接著在瀏覽器打開 **`http://localhost:8000`** 即可開始測試（也可以使用 VS Code 的 **Live Server** 擴充功能開啟）。

## 🌐 步驟五：免費部署上線（GitHub Pages / Cloudflare Pages）

### 方案 A：GitHub Pages

1. 在 [GitHub](https://github.com/) 建立一個新的公開（Public）Repository。

2. 將 `index.html`、`firebase-config.js`、`app.js`、`README.md` 上傳並 Commit。

3. 進入倉庫的 **Settings → Pages**，將 Branch 設為 **`main`**、資料夾設為 **`/ (root)`** 並按下 **Save**。

4. 等待 1～2 分鐘即可取得免費網址（`https://你的帳號.github.io/倉庫名稱/`）。

### 方案 B：Cloudflare Pages

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)，進入 **Workers & Pages → Create → Pages**。

2. 選擇連結 GitHub 倉庫或直接 **Upload assets** 上傳整個資料夾，即可取得 `*.pages.dev` 網址。

### ⚠️ 部署後必做：加入已授權網域

拿到正式網址後，務必回到 **Firebase Console → Authentication → Settings → 已授權網域（Authorized domains）**，點擊 **新增網域**，填入你的網域（例如 `你的帳號.github.io` 或 `專案名稱.pages.dev`，不要加 `https://`），否則線上版會無法登入。

## ❓ 常見問題排解 (FAQ)

* **點了「使用 Google 帳號登入」沒反應或出現 `auth/unauthorized-domain`？**

  * 請確認網址是使用 `http://localhost:8000` 或已部署的 HTTPS 網址（不可用 `file://`），並檢查該網域是否已加入 Firebase 的 **已授權網域**。

* **更新程式碼後按鈕點了沒反應？**

  * 瀏覽器可能還留著舊版 `app.js` 的快取，請按 **`Ctrl + Shift + R`** 強制重新整理。

* **把 `firebaseConfig` 放在前端公開安全嗎？**

  * 這是 Firebase 官方設計的運作方式，`firebaseConfig` 僅用於識別專案，真正保護資料的是 **Firestore 安全規則** 與 **已授權網域限制**。

如有其他問題請諮詢：lliinn1106lin@gmail.com
## 📄 授權條款 (License)

本專案與文件採用 **[創用 CC 姓名標示－非商業性－相同方式分享 4.0 國際授權條款 (CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hant)** 釋出。

- **原作者**：[lliinn1106lin](https://github.com/lliinn1106lin)
- 使用、重製或改編本專案時，**必須標註原作者**，**禁止用於任何商業營利行為**，且改編後的衍生作品**必須以相同授權條款公開分享**。
