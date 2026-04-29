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

        // --- 【修正】IDからも名前からも引けるマップを作成 ---
        const horseMap = {};
        if (race.horses) {
          Object.keys(race.horses).forEach((hId) => {
            const hData = race.horses[hId];
            horseMap[hId] = hData.userName;
            horseMap[hData.horseName] = hData.userName; // 旧データ用
          });
        }

        const results = race.results;
        const top3 = results ? [results["1"], results["2"], results["3"]] : [];

        Object.keys(combos).forEach((comboId) => {
          const combo = combos[comboId];
          const voters = combo.voters || [];
          const myVote = Array.isArray(voters) ? voters.find((v) => v.uid === targetId || v === targetId) : null;

          if (myVote) {
            // --- 【修正】新旧両方のデータ形式に対応した馬名取得 ---
            const horseNames = combo.names || comboId.split("_");
            const horseIds = combo.horseIds || [];

            // 的中判定用のフルネームリスト作成
            const myFullNames = horseNames.map((hName, index) => {
              const hId = horseIds[index];
              const uName = hId ? horseMap[hId] || "不明" : horseMap[hName] || "不明";
              return `${hName}(${uName})`;
            });

            const isHit = top3.length >= 3 && myFullNames.every((fullName) => top3.includes(fullName));

            userHistory.push({
              raceTitle: race.title || "無題のレース",
              raceId: raceId,
              combination: horseNames.join(" - "), // 表示用
              timestamp: myVote.at || 0,
              comment: myVote.comment || "",
              isHit: isHit,
              status: race.status,
            });
          }
        });
      });

      if (userHistory.length > 0) {
        userHistory.sort((a, b) => b.timestamp - a.timestamp);
        historyListEl.innerHTML = "";

        userHistory.forEach((item) => {
          const date = item.timestamp ? new Date(item.timestamp).toLocaleString() : "不明な日時";
          const div = document.createElement("div");

          // 的中時は is-hit クラスを付与
          div.className = `p-user__history-item p-voting__item ${item.isHit ? "is-hit" : ""}`;

          // インラインスタイルは最小限にし、CSS側で .is-hit を装飾することを推奨
          div.style.marginBottom = "15px";

          div.innerHTML = `
          <div class="p-user__history-content">
            <div class="p-user__history-header">
              <a href="odds.html?race=${item.raceId}" class="p-user__history-race-link">
                <span class="material-symbols-outlined">analytics</span>
                ${item.raceTitle}
              </a>
              <span class="p-user__history-date">${date}</span>
            </div>

            <div class="p-user__history-main">
              <span class="p-user__history-combo">${item.combination}</span>
              ${item.isHit ? '<span class="c-tag c-tag--hit" style="margin-left:8px; background:#ffd700; color:#000; padding:2px 6px; border-radius:4px; font-size:0.7rem; font-weight:bold;">的中</span>' : ""}
            </div>

            ${item.comment ? `<p class="p-user__history-comment">${item.comment}</p>` : ""}
          </div>
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
