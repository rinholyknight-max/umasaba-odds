import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { initTheme, applyCharaTheme } from "./theme.js"; // ★ applyCharaTheme もインポート
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";
import { initPageInfo } from "./info-config.js";

// --- Firebase初期化 (既存のまま) ---
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

/**
 * ユーザープロフィールの初期化
 */
export async function initUserPage() {
  initPageInfo("user");

  // ★ 1. テーマと認証を順番に待つ
  await initTheme();
  const authInfo = await checkAuth("guest");
  if (!authInfo) return;

  initMenu();
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // ヘッダーのユーザー表示
  const myName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = myName;

  // URLパラメータからターゲットIDを取得
  const params = new URLSearchParams(window.location.search);
  let targetId = params.get("id");

  // IDがなければ自分のIDを表示
  if (!targetId) {
    targetId = authInfo.uid;
    console.log("Viewing my own profile:", targetId);
  }

  if (!targetId) {
    alert("ユーザーIDが特定できませんでした。");
    window.location.href = "index.html";
    return;
  }

  // ★ 2. データの取得と描画
  try {
    const userRef = ref(db, `users/${targetId}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      renderProfile(data);
      // 履歴の読み込み（非同期だが待たずに実行開始してOK）
      loadUserHistory(targetId);
    } else {
      const nameEl = document.getElementById("js-user-name");
      if (nameEl) nameEl.innerText = "未登録のユーザーです";
      const historyListEl = document.getElementById("js-history-list");
      if (historyListEl) historyListEl.innerHTML = "";
    }
  } catch (err) {
    console.error("Profile Load Error:", err);
  } finally {
    // 全ての準備が整ったらローディングを消す
    document.body.classList.remove("is-loading");
  }
}

/**
 * プロフィール描画
 */
function renderProfile(data) {
  const headerTitle = document.getElementById("js-header-title");
  if (headerTitle) {
    const targetName = data.userName || "名無し";
    const myName = sessionStorage.getItem("user_name");
    headerTitle.innerText = targetName === myName ? "マイプロフィール" : `${targetName}さんのプロフィール`;
  }

  // ターゲットユーザーの推しキャラテーマを適用
  if (data.favoriteChara) {
    applyCharaTheme(data.favoriteChara);
  }

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

/**
 * 投票履歴の取得（的中判定付き）
 */
async function loadUserHistory(targetId) {
  const historyListEl = document.getElementById("js-history-list");
  if (!historyListEl) return;

  historyListEl.innerHTML = '<div class="c-loading">履歴を読み込み中...</div>';

  try {
    const racesRef = ref(db, "races");
    const snapshot = await get(racesRef);

    if (snapshot.exists()) {
      const races = snapshot.val();
      const userHistory = [];

      Object.keys(races).forEach((raceId) => {
        const race = races[raceId];
        const combos = race.combos || {};

        // --- 【追加】そのレースの馬名→ユーザー名マップを作成 ---
        const horseToUserMap = {};
        if (race.horses) {
          Object.values(race.horses).forEach((h) => {
            horseToUserMap[h.horseName] = h.userName;
          });
        }

        // レース結果（1〜3着）を配列化
        const results = race.results;
        const top3 = results ? [results["1"], results["2"], results["3"]] : [];

        Object.keys(combos).forEach((comboId) => {
          const combo = combos[comboId];
          const voters = combo.voters || [];
          const myVote = Array.isArray(voters) ? voters.find((v) => v.uid === targetId || v === targetId) : null;

          if (myVote) {
            // --- 【追加】的中判定 ---
            const names = comboId.split("_");
            const myFullNames = names.map((n) => `${n}(${horseToUserMap[n] || "不明"})`);
            const isHit = top3.length >= 3 && myFullNames.every((fullName) => top3.includes(fullName));

            userHistory.push({
              raceTitle: race.title || "無題のレース",
              raceId: raceId,
              combination: comboId,
              timestamp: myVote.at || 0,
              comment: myVote.comment || "",
              isHit: isHit, // 的中フラグを保存
              status: race.status, // レース終了済みかどうかの確認用
            });
          }
        });
      });

      if (userHistory.length > 0) {
        userHistory.sort((a, b) => b.timestamp - a.timestamp);
        historyListEl.innerHTML = "";

        userHistory.forEach((item) => {
          const date = item.timestamp ? new Date(item.timestamp).toLocaleString() : "不明な日時";
          const comboDisplay = item.combination.split("_").join(" - ");

          const div = document.createElement("div");
          // --- 【修正】的中している場合は is-hit クラスを付与 ---
          div.className = `p-user__history-item p-voting__item ${item.isHit ? "is-hit" : ""}`;

          // SCSSの .p-voting__item スタイルと競合しないよう、既存のインラインスタイルは適宜調整
          div.style.marginBottom = "15px";
          div.style.padding = "15px";
          div.style.background = "var(--bg-card)";
          div.style.borderRadius = "8px";
          div.style.border = "1px solid var(--border)";
          if (!item.isHit) {
            div.style.borderLeft = "4px solid var(--chara-main)";
          }

          div.innerHTML = `
            <div class="p-user__history-header">
              <div class="p-user__history-title-group">
                <a href="odds.html?race=${item.raceId}" class="p-user__history-link">
                  <span class="material-symbols-outlined">analytics</span>
                  <span class="p-user__history-race-name">${item.raceTitle}</span>
                </a>
              </div>
              <div class="p-user__history-date">${date}</div>
            </div>
            
            <div class="p-user__history-combo">
              ${comboDisplay}
            </div>

            ${
              item.comment
                ? `
              <div class="p-user__history-comment">
                ${item.comment}
              </div>
            `
                : ""
            }
          `;
          historyListEl.appendChild(div);
        });
      } else {
        historyListEl.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-sub);">まだ投票履歴がありません。</p>';
      }
    }
  } catch (err) {
    console.error("History Load Error:", err);
    historyListEl.innerHTML = '<p style="color:var(--color-danger);">履歴の読み込みに失敗しました。</p>';
  }
}

// 実行
initUserPage();
