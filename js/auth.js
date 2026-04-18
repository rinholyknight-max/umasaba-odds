/**
 * 認証管理モジュール (js/auth.js)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// --- Firebase初期化 ---
const firebaseConfig = {
  apiKey: "AIzaSyBp5Cg6A3v3VZal-orAiwFjphKIDYx9ATo",
  authDomain: "umasaba-odds.firebaseapp.com",
  databaseURL: "https://umasaba-odds-default-rtdb.firebaseio.com",
  projectId: "umasaba-odds",
  storageBucket: "umasaba-odds.firebasestorage.app",
  messagingSenderId: "802834774249",
  appId: "1:802834774249:web:5623185854ead82c261878",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ... USER_MAP, PASSWORDS は変更なし ...

/**
 * ログイン実行 (変更なし)
 */
export async function login(input) {
  // --- 省略 ---
  // 既存のログイン処理の中で sessionStorage.setItem("user_id", input); されていることを前提にします
}

/**
 * 権限チェック (★非同期 Promise 形式に修正)
 * @param {string} requiredRole - 必要とされる権限
 * @returns {Promise<Object|null>} ユーザー情報オブジェクトを返す
 */
export function checkAuth(requiredRole = null) {
  return new Promise((resolve) => {
    // Firebaseの認証状態を監視
    onAuthStateChanged(auth, (fbUser) => {
      const currentRole = sessionStorage.getItem("auth_role");
      const userId = sessionStorage.getItem("user_id"); // これが個人ID(input)

      // 1. 未ログインチェック
      if (!currentRole || !fbUser) {
        window.location.href = "login.html";
        resolve(null);
        return;
      }

      // 2. 管理者権限チェック
      if (requiredRole === "admin" && currentRole !== "admin") {
        alert("管理者権限が必要です。");
        window.location.href = "index.html";
        resolve(null);
        return;
      }

      // 3. 成功時：UIDと個人IDをセットにしたオブジェクトを返す
      resolve({
        uid: userId, // 実際のDBのキーとして使うID
        fbUser: fbUser, // Firebase Auth側のユーザー情報
        role: currentRole,
      });
    });
  });
}

/**
 * ログアウト (変更なし)
 */
export function logout() {
  sessionStorage.clear();
  localStorage.clear(); // 追加：念のため
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
}
