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
export async function login(input) {
  if (!input) {
    alert("IDまたはパスワードを入力してください");
    return;
  }

  try {
    let role = "";
    let displayName = "";

    // 1. 管理者チェック
    if (input === PASSWORDS.ADMIN) {
      role = "admin";
      displayName = "管理者";
    }
    // 2. 登録ユーザーチェック (USER_MAP[input] が存在するか)
    else if (USER_MAP[input]) {
      role = "guest"; // 一般ユーザーの権限名
      displayName = USER_MAP[input]; // 登録されている名前
    } else {
      alert("有効なIDまたはパスワードではありません");
      return;
    }

    // --- ここからFirebaseとセッションの同期 ---

    // 3. Firebase 匿名認証
    await signInAnonymously(auth);

    // 4. SessionStorage への保存（checkAuthがここを絶対に見る）
    sessionStorage.setItem("user_id", input);
    sessionStorage.setItem("auth_role", role);
    sessionStorage.setItem("user_name", displayName);
    sessionStorage.setItem("is_logged_in", "true");

    console.log(`ログイン成功: ${displayName} (${role})`);

    // 5. 遷移先の振り分け
    if (role === "admin") {
      window.location.href = "admin.html";
    } else {
      // 一般ユーザーは index.html へ
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Login Error:", error);
    alert("認証中にエラーが発生しました。");
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
