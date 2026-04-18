import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
// ★ query, orderByChild, equalTo を追加
import { getDatabase, ref, get, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";
import { initPageInfo } from "./info-config.js";

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
  initPageInfo("user");
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

// ★ 追加・修正：全レースから特定のユーザーの投票履歴を抽出する
async function loadUserHistory(targetId) {
  const historyListEl = document.getElementById("js-history-list");
  if (!historyListEl) return;

  historyListEl.innerHTML = '<div class="c-loading">履歴を読み込み中...</div>';

  try {
    // 1. 全レースデータを取得
    const racesRef = ref(db, "races");
    const snapshot = await get(racesRef);

    if (snapshot.exists()) {
      const races = snapshot.val();
      const userHistory = [];

      // 2. 各レース -> 各コンボ -> 各投票者を走査
      Object.keys(races).forEach((raceId) => {
        const race = races[raceId];
        const combos = race.combos || {};

        Object.keys(combos).forEach((comboId) => {
          const combo = combos[comboId];
          const voters = combo.voters || [];

          // voters配列の中からこのユーザー(targetId)の投票を探す
          const myVote = Array.isArray(voters) ? voters.find((v) => v.uid === targetId || v === targetId) : null;

          if (myVote) {
            // 履歴用のオブジェクトを作成
            userHistory.push({
              raceTitle: race.title || "無題のレース",
              raceId: raceId,
              combination: comboId,
              timestamp: myVote.at || 0, // 投票日時
              comment: myVote.comment || "",
            });
          }
        });
      });

      // 3. 描画
      if (userHistory.length > 0) {
        // 新しい順にソート
        userHistory.sort((a, b) => b.timestamp - a.timestamp);

        historyListEl.innerHTML = "";
        userHistory.forEach((item) => {
          const date = item.timestamp ? new Date(item.timestamp).toLocaleString() : "不明な日時";
          const comboDisplay = item.combination.split("_").join(" - ");

          const div = document.createElement("div");
          div.className = "p-user__history-item";
          div.style.borderLeft = "4px solid var(--chara-main)";
          div.style.marginBottom = "15px";
          div.style.padding = "15px";
          div.style.background = "var(--bg-card)";
          div.style.borderRadius = "8px";
          div.style.boxShadow = "0 2px 5px rgba(0,0,0,0.05)";

          div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
              <div style="font-weight: bold; color: var(--chara-main); font-size: 0.8rem;">
                <a href="odds.html?race=${item.raceId}" style="text-decoration:none; color:inherit;">
                  <span class="material-symbols-outlined" style="font-size:1rem; vertical-align:middle;">analytics</span> 
                  ${item.raceTitle}
                </a>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-sub);">${date}</div>
            </div>
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 1rem;">${comboDisplay}</div>
            ${
              item.comment
                ? `
              <p style="font-size: 0.9rem; margin: 0; color: var(--text-main); background: var(--bg-page); padding: 8px; border-radius: 4px;">
                ${item.comment}
              </p>
            `
                : ""
            }
          `;
          historyListEl.appendChild(div);
        });
      } else {
        historyListEl.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-sub);">まだ投票履歴がありません。</p>';
      }
    } else {
      historyListEl.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-sub);">データが存在しません。</p>';
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
