/**
 * 認証管理モジュール (js/auth.js)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, signInAnonymously, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

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

  // ログイン前に古いキャッシュを一度クリア（念のため）
  clearUserCache();

  const startFirebaseSession = async (redirectUrl) => {
    try {
      await signInAnonymously(auth);
      window.location.href = redirectUrl;
    } catch (error) {
      console.error("匿名認証失敗:", error);
      alert("認証セッションの開始に失敗しました。");
    }
  };

  if (input === PASSWORDS.ADMIN) {
    sessionStorage.setItem("auth_role", "admin");
    sessionStorage.setItem("user_name", "管理者");
    await startFirebaseSession("admin.html");
    return;
  }

  if (PASSWORDS.USER.includes(input)) {
    sessionStorage.setItem("auth_role", "guest");
    sessionStorage.setItem("user_name", USER_MAP[input]);
    sessionStorage.setItem("user_id", "GUEST_USER");
    await startFirebaseSession("index.html");
    return;
  }

  try {
    // 1. まず先に匿名認証を済ませる（これで auth != null になる）
    await signInAnonymously(auth);

    const allowedRef = ref(db, `allowed_users/${input}`);
    const allowedSnap = await get(allowedRef);

    if (!allowedSnap.exists()) {
      alert("このIDは登録を許可されていません。\n管理者に連絡してください。");
      return;
    }

    const allowedData = allowedSnap.val();
    sessionStorage.setItem("user_circle", allowedData.circleName || "無所属");

    const userRef = ref(db, `users/${input}`);
    const userSnap = await get(userRef);

    if (!userSnap.exists()) {
      await set(userRef, {
        userName: allowedData.userName,
        circleName: allowedData.circleName || "無所属",
        points: allowedData.initialPoints || 100,
        createdAt: Date.now(),
        status: "active",
      });
      sessionStorage.setItem("user_name", allowedData.userName);
    } else {
      const userData = userSnap.val();
      sessionStorage.setItem("user_name", userData.userName);
      sessionStorage.setItem("user_circle", userData.circleName || allowedData.circleName || "無所属");
      if (userData.photoURL) {
        sessionStorage.setItem("user_photo_url", userData.photoURL);
      }
    }

    sessionStorage.setItem("auth_role", "personal");
    sessionStorage.setItem("user_id", input);

    await startFirebaseSession("index.html");
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
  const userId = sessionStorage.getItem("user_id");

  if (!currentRole) {
    window.location.href = "login.html";
    return null;
  }

  if (requiredRole === "admin" && currentRole !== "admin") {
    alert("管理者権限が必要です。");
    window.location.href = "index.html";
    return null;
  }

  // ★ 修正：他の JS が期待している userNumericId を含めて返す
  return {
    uid: userId, // 元のID
    userNumericId: userId, // settings.js などが参照する数字ID
    role: currentRole,
  };
}

/**
 * ユーザー固有キャッシュのクリア
 */
function clearUserCache() {
  // 1. SessionStorageを全削除（名前、役割、一時データ）
  sessionStorage.clear();

  // 2. LocalStorageからテーマ関連だけを削除
  // 全削除(localStorage.clear())するとダークモード設定等も消えるため、特定キーを狙い撃ち
  localStorage.removeItem("user_oshi");
  localStorage.removeItem("user_oshi_colors");

  console.log("[Auth] User cache cleared.");
}

/**
 * ログアウト
 */
export async function logout() {
  try {
    // キャッシュを先に消す
    clearUserCache();

    // Firebase Authからサインアウト
    await signOut(auth);

    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout Error:", error);
    // エラーが起きても強制的に戻す
    window.location.href = "login.html";
  }
}
