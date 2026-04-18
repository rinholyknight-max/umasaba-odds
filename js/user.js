import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";

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
// --- (中略：インポートやConfigはそのまま) ---

export async function initUserPage() {
  initTheme();

  if (!checkAuth("guest")) return;

  initMenu();
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  const myName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = myName;

  const params = new URLSearchParams(window.location.search);
  const targetId = params.get("id");

  if (!targetId) {
    alert("ユーザーIDが指定されていません。");
    window.location.href = "main.html";
    return;
  }

  try {
    const userRef = ref(db, `users/${targetId}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      // ★ ここでプロフィール描画（テーマ適用を含む）を実行
      renderProfile(data);
    } else {
      document.getElementById("js-user-name").innerText = "未登録のユーザーです";
    }
  } catch (err) {
    console.error("Profile Load Error:", err);
  } finally {
    document.body.classList.remove("is-loading");
  }
}

// ★ 追加：テーマを適用する関数
async function applyCharaTheme(oshiName) {
  if (!oshiName) return;

  try {
    const response = await fetch("./data/characters.json");
    const charaMaster = await response.json();
    const config = charaMaster[oshiName];

    const root = document.documentElement;

    if (config && config.main && config.sub) {
      // CSS変数を上書き
      root.style.setProperty("--chara-main", config.main);
      root.style.setProperty("--chara-sub", config.sub);
    } else {
      // 見つからない場合は変数をクリア（SCSSのデフォルト値に戻る）
      root.style.removeProperty("--chara-main");
      root.style.removeProperty("--chara-sub");
    }
  } catch (error) {
    console.error("Theme Apply Error:", error);
  }
}

// renderProfileの中でテーマ適用を呼び出す
function renderProfile(data) {
  // ★ ここでテーマ適用を実行
  applyCharaTheme(data.favoriteChara);

  // 名前
  const nameEl = document.getElementById("js-user-name");
  if (nameEl) nameEl.innerText = data.userName || "名無し";

  // サークル情報
  const circleEl = document.getElementById("js-user-circle");
  if (circleEl) {
    circleEl.innerText = data.circleName ? `所属サークル： ${data.circleName}` : "無所属";
  }

  // ひとこと（ステータス）
  const commentEl = document.getElementById("js-user-comment");
  if (commentEl) commentEl.innerText = data.comment || "よろしくお願いします！";

  // 推しウマ娘
  const oshiEl = document.getElementById("js-user-oshi");
  if (oshiEl) oshiEl.innerText = data.favoriteChara || "未設定";

  // アイコン画像
  const iconEl = document.getElementById("js-user-icon");
  if (data.photoURL && iconEl) {
    iconEl.innerHTML = `<img src="${data.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
  }
}

initUserPage();
