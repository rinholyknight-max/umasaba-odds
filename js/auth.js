/**
 * 認証管理モジュール (js/auth.js)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

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

// パスワードと表示名の対応表 (従来ゲスト用)
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
 * 共有パスワードなら「guest」、それ以外なら「personal」として処理
 */
export async function login(input) {
  if (!input) {
    alert("IDまたはパスワードを入力してください");
    return;
  }

  // 1. 管理者チェック
  if (input === PASSWORDS.ADMIN) {
    sessionStorage.setItem("auth_role", "admin");
    sessionStorage.setItem("user_name", "管理者");
    window.location.href = "admin.html";
    return;
  }

  // 2. 従来サークル（ゲスト）チェック
  if (PASSWORDS.USER.includes(input)) {
    sessionStorage.setItem("auth_role", "guest");
    sessionStorage.setItem("user_name", USER_MAP[input]);
    // ゲストはID固定
    sessionStorage.setItem("user_id", "GUEST_USER");
    window.location.href = "index.html";
    return;
  }

  // --- 3. 個人ログイン（ゲームID）処理 ---
  try {
    // まず「許可リスト」にあるか確認
    const allowedRef = ref(db, `allowed_users/${input}`);
    const allowedSnap = await get(allowedRef);

    if (!allowedSnap.exists()) {
      alert("このIDは登録を許可されていません。\n管理者に連絡してください。");
      return;
    }

    const allowedData = allowedSnap.val();
    const userRef = ref(db, `users/${input}`);
    const userSnap = await get(userRef);

    if (!userSnap.exists()) {
      // 許可リストにはあるが、初ログインの場合：アカウントを正式作成
      await set(userRef, {
        userName: allowedData.userName, // 名簿の名前を反映
        points: allowedData.initialPoints || 100,
        createdAt: Date.now(),
        status: "active",
      });
      sessionStorage.setItem("user_name", allowedData.userName);
      alert(`ようこそ、${allowedData.userName}さん！\n初期登録が完了しました。`);
    } else {
      // 既に利用開始しているユーザー
      const userData = userSnap.val();
      sessionStorage.setItem("user_name", userData.userName);
    }

    sessionStorage.setItem("auth_role", "personal");
    sessionStorage.setItem("user_id", input);
    window.location.href = "index.html";
  } catch (error) {
    console.error(error);
    alert("通信エラーが発生しました");
  }
}

/**
 * 権限チェック
 */
export function checkAuth(requiredRole = null) {
  const currentRole = sessionStorage.getItem("auth_role");
  if (!currentRole) {
    window.location.href = "login.html";
    return false;
  }
  if (requiredRole === "admin" && currentRole !== "admin") {
    alert("管理者権限が必要です");
    window.location.href = "index.html";
    return false;
  }
  return true;
}

/**
 * ログアウト
 */
export function logout() {
  sessionStorage.clear();
  window.location.href = "login.html";
}
