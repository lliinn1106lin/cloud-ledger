// firebase-config.js
// ============================================================================
// 🔑 TODO: 請將下方的 firebaseConfig 替換為你自己的 Firebase 專案設定金鑰！
// 取得方式：Firebase Console -> 專案設定 (齒輪圖示) -> 您的應用程式 (Web) -> SDK 設定與配置
// 詳細圖文步驟請參閱 README.md
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";

// 👇 請從這裡開始替換成你自己的 Firebase 金鑰 👇
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// 👆 請在上方替換完成，不要刪除下方的程式碼 👆

// 檢查使用者是否已經填入真實的 Firebase 設定
export function isFirebaseConfigured() {
  return (
    Boolean(firebaseConfig.apiKey) &&
    !firebaseConfig.apiKey.startsWith("YOUR_") &&
    Boolean(firebaseConfig.projectId) &&
    !firebaseConfig.projectId.startsWith("YOUR_")
  );
}

// 初始化 Firebase 服務
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// 每次登入時提示選擇 Google 帳號（方便多帳號切換測試）
googleProvider.setCustomParameters({
  prompt: "select_account"
});
