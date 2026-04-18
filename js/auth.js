/**
 * 認証管理モジュール (js/auth.js)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

// --- 初期設定 ---
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

// パスワードと表示名の対応表
const USER_MAP = {
  "01-LastCrop": "ラスクロメンバー",
  "02-cocoa": "へべれけメンバー",
  "03-Snowknight": "スノウナイトメンバー",
  "04-Smile": "Smileメンバー",
};

export const PASSWORDS = {
  USER: Object.keys(USER_MAP),
  ADMIN: "04umasaba-Observers",
};

/**
 * ログイン実行
 */
// js/auth.js 内の login 関数をこのように書き換えてください
export async function login(input) {
  if (!input) {
    alert("IDを入力してください");
    return;
  }

  try {
    // 1. Firebaseで匿名サインインを実行し、完了を待つ
    const userCredential = await signInAnonymously(auth);
    console.log("Firebaseサインイン成功:", userCredential.user.uid);

    // 2. 権限判定（ここはご自身のロジックに合わせてください）
    // 例: 管理者IDなら admin、それ以外は guest
    const role = input === "admin-id-here" ? "admin" : "guest";

    // 3. sessionStorage に必要な情報をすべて書き込む
    // ここが checkAuth の判定基準になります
    sessionStorage.setItem("user_id", input);
    sessionStorage.setItem("auth_role", role);
    sessionStorage.setItem("is_logged_in", "true");

    // 4. 確実に書き込みが終わったタイミングで遷移
    console.log("遷移します...");
    window.location.replace("index.html"); // replaceを使うと「戻る」でログイン画面に戻らなくなります
  } catch (error) {
    console.error("ログインエラー:", error);
    alert("ログイン処理中にエラーが発生しました: " + error.message);
  }
}

/**
 * 権限チェック
 */
export function checkAuth(requiredRole = null) {
  return new Promise((resolve) => {
    // ログインページ自体の場合はチェックをスキップしないと無限ループする
    if (window.location.pathname.includes("login.html")) {
      resolve(null);
      return;
    }

    onAuthStateChanged(auth, async (fbUser) => {
      const currentRole = sessionStorage.getItem("auth_role");
      const userId = sessionStorage.getItem("user_id");

      // 未ログイン状態の判定
      if (!fbUser || !currentRole) {
        console.warn("Not logged in, redirecting to login.html");
        window.location.href = "login.html";
        resolve(null);
        return;
      }

      // 管理者権限チェック
      if (requiredRole === "admin" && currentRole !== "admin") {
        alert("管理者権限が必要です。");
        window.location.href = "index.html";
        resolve(null);
        return;
      }

      resolve({
        uid: userId,
        fbUser: fbUser,
        role: currentRole,
      });
    });
  });
}

/**
 * ログアウト
 */
export function logout() {
  sessionStorage.clear();
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
}
