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

export async function initUserPage() {
  initTheme();

  // 1. ログインチェック (一般ユーザー権限以上が必要)
  // ログインしていない場合は index.html へ飛ばす処理が auth.js 側で走ります
  if (!checkAuth("guest")) {
    return; // ログイン（ゲスト含む）すらしていない人だけを追い返す
  }

  // 2. 共通メニューとログアウトボタンの初期化
  initMenu();
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // 3. 表示名の設定（ヘッダー用）
  const myName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = myName;

  // 4. URLパラメータから表示対象のユーザーIDを取得
  const params = new URLSearchParams(window.location.search);
  const targetId = params.get("id");

  if (!targetId) {
    alert("ユーザーIDが指定されていません。");
    window.location.href = "main.html"; // IDがない場合はメインへ
    return;
  }

  try {
    const userRef = ref(db, `users/${targetId}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
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

function renderProfile(data) {
  document.getElementById("js-user-name").innerText = data.userName || "名無し";
  document.getElementById("js-user-circle").innerText = data.circleName ? `所属: ${data.circleName}` : "無所属";
  document.getElementById("js-user-comment").innerText = data.comment || "よろしくお願いします！";
  document.getElementById("js-user-oshi").innerText = data.favoriteChara || "未設定";

  if (data.photoURL) {
    document.getElementById("js-user-icon").innerHTML = `<img src="${data.photoURL}" style="width:100%; height:100%; object-fit:cover;">`;
  }
}

// 実行
initUserPage();
