/**
 * 認証管理モジュール (js/auth.js)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
// ★Firebase Authのインポートを追加
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

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
const auth = getAuth(app); // ★Authの初期化

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

  // ★共通：匿名ログインを実行するヘルパー関数
  const startFirebaseSession = async (redirectUrl) => {
    try {
      await signInAnonymously(auth);
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("匿名認証失敗:", error);
      alert("認証セッションの開始に失敗しました。");
    }
  };

  // 1. 管理者チェック
  if (input === PASSWORDS.ADMIN) {
    sessionStorage.setItem("auth_role", "admin");
    sessionStorage.setItem("user_name", "管理者");
    await startFirebaseSession("admin.html"); // ★匿名ログイン後に遷移
    return;
  }

  // 2. 従来サークル（ゲスト）チェック
  if (PASSWORDS.USER.includes(input)) {
    sessionStorage.setItem("auth_role", "guest");
    sessionStorage.setItem("user_name", USER_MAP[input]);
    sessionStorage.setItem("user_id", "GUEST_USER");
    await startFirebaseSession("index.html"); // ★匿名ログイン後に遷移
    return;
  }

  // --- 3. 個人ログイン（ゲームID）処理 ---
  try {
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
      await set(userRef, {
        userName: allowedData.userName,
        points: allowedData.initialPoints || 100,
        createdAt: Date.now(),
        status: "active",
      });
      sessionStorage.setItem("user_name", allowedData.userName);
    } else {
      const userData = userSnap.val();
      sessionStorage.setItem("user_name", userData.userName);

      if (userData.photoURL) {
        sessionStorage.setItem("user_photo_url", userData.photoURL);
      } else {
        // 前のユーザーのアイコンが残らないように削除
        sessionStorage.removeItem("user_photo_url");
      }
    }

    sessionStorage.setItem("auth_role", "personal");
    sessionStorage.setItem("user_id", input);

    await startFirebaseSession("index.html"); // ★匿名ログイン後に遷移
  } catch (error) {
    console.error(error);
    alert("通信エラーが発生しました");
  }
}

/**
 * 権限チェック
 * @param {string} requiredRole - 必要とされる権限 ('admin' など)
 */
export function checkAuth(requiredRole = null) {
  const currentRole = sessionStorage.getItem("auth_role");
  const userId = sessionStorage.getItem("user_id");

  // 1. そもそもログインしていない場合
  if (!currentRole) {
    window.location.href = "login.html";
    return false;
  }

  // 2. 管理者画面へのアクセス制限
  if (requiredRole === "admin") {
    // 役割が admin ではない、またはユーザーIDが管理者用ではない場合
    if (currentRole !== "admin") {
      alert("管理者権限が必要です。");
      window.location.href = "index.html"; // 一般画面へ強制送還
      return false;
    }
  }

  // 3. 一般ユーザー画面で管理者が混ざらないようにする場合（任意）
  if (requiredRole === "personal" && currentRole === "admin") {
    // 管理者が一般画面を見るのはOKならここは不要です
  }

  return true;
}

/**
 * ログアウト
 */
export function logout() {
  sessionStorage.clear();
  // ★Firebase Authからもサインアウトする
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
}
