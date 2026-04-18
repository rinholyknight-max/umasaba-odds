import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
// ★ query, orderByChild, equalTo を追加
import { getDatabase, ref, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
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
      renderProfile(data);
      // ★ 追加：投票履歴の読み込みを実行
      loadUserHistory(targetId);
    } else {
      const nameEl = document.getElementById("js-user-name");
      if (nameEl) nameEl.innerText = "未登録のユーザーです";
    }
  } catch (err) {
    console.error("Profile Load Error:", err);
  } finally {
    document.body.classList.remove("is-loading");
  }
}

// ★ 追加：投票履歴を取得して描画する関数
async function loadUserHistory(targetId) {
  const historyListEl = document.getElementById("js-history-list");
  if (!historyListEl) return;

  historyListEl.innerHTML = '<div class="c-loading">履歴を読み込み中...</div>';

  try {
    // logsフォルダから uid が targetId と一致するものを検索
    const logsRef = ref(db, "logs");
    const historyQuery = query(logsRef, orderByChild("uid"), equalTo(targetId));
    const snapshot = await get(historyQuery);

    if (snapshot.exists()) {
      historyListEl.innerHTML = "";
      const logs = [];
      snapshot.forEach((child) => {
        logs.push(child.val());
      });

      // 新しい順（降順）にソート
      logs.sort((a, b) => b.timestamp - a.timestamp);

      logs.forEach((log) => {
        const date = new Date(log.timestamp).toLocaleString();
        // 組み合わせのアンダースコアをハイフンに置換して見やすく
        const comboDisplay = log.combination ? log.combination.split("_").join(" - ") : "不明な組み合わせ";

        const item = document.createElement("div");
        item.className = "p-user__history-item";
        item.style.borderLeft = "4px solid var(--chara-main)"; // 推し色でアクセント
        item.style.marginBottom = "15px";
        item.style.padding = "10px";
        item.style.background = "var(--bg-card)";

        item.innerHTML = `
          <div style="font-size: 0.75rem; color: var(--text-sub);">${date}</div>
          <div style="font-weight: bold; margin: 5px 0;">${comboDisplay}</div>
          <p style="font-size: 0.9rem; margin: 0; color: var(--text-main);">${log.comment || "（コメントなし）"}</p>
        `;
        historyListEl.appendChild(item);
      });
    } else {
      historyListEl.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-sub);">まだ投票履歴がありません。</p>';
    }
  } catch (err) {
    console.error("History Load Error:", err);
    historyListEl.innerHTML = '<p style="color:var(--color-danger);">履歴の読み込みに失敗しました。</p>';
  }
}

// --- 他の関数はそのまま ---
async function applyCharaTheme(oshiName) {
  if (!oshiName) return;
  try {
    const response = await fetch("./data/characters.json");
    const charaMaster = await response.json();
    const config = charaMaster[oshiName];
    const root = document.documentElement;
    if (config && config.main && config.sub) {
      root.style.setProperty("--chara-main", config.main);
      root.style.setProperty("--chara-sub", config.sub);
    }
  } catch (error) {
    console.error("Theme Apply Error:", error);
  }
}

function renderProfile(data) {
  const headerTitle = document.getElementById("js-header-title");
  if (headerTitle) {
    const targetName = data.userName || "名無し";
    const myName = sessionStorage.getItem("user_name");
    headerTitle.innerText = targetName === myName ? "マイプロフィール" : `${targetName}さんのプロフィール`;
  }
  applyCharaTheme(data.favoriteChara);
  const nameEl = document.getElementById("js-user-name");
  if (nameEl) nameEl.innerText = data.userName || "名無し";
  const circleEl = document.getElementById("js-user-circle");
  if (circleEl) circleEl.innerText = data.circleName ? `所属サークル： ${data.circleName}` : "無所属";
  const commentEl = document.getElementById("js-user-comment");
  if (commentEl) commentEl.innerText = data.comment || "よろしくお願いします！";
  const oshiEl = document.getElementById("js-user-oshi");
  if (oshiEl) oshiEl.innerText = data.favoriteChara || "未設定";
  const iconEl = document.getElementById("js-user-icon");
  if (data.photoURL && iconEl) {
    iconEl.innerHTML = `<img src="${data.photoURL}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
  }
}

initUserPage();
