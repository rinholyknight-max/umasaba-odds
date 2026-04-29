import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js"; // ★ onValue もインポートに必要
import { initTheme, applyCharaTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";
import { initPageInfo } from "./info-config.js";

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

  await initTheme();
  const authInfo = await checkAuth("guest");
  const myUid = authInfo ? authInfo.uid : null;

  if (!authInfo) return;

  initMenu();
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  const myName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = myName;

  const params = new URLSearchParams(window.location.search);
  let targetId = params.get("id") || myUid; // IDがなければ自分のID

  if (!targetId) {
    alert("ユーザーIDが特定できませんでした。");
    window.location.href = "index.html";
    return;
  }

  try {
    const userRef = ref(db, `users/${targetId}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const data = snapshot.val();
      // ★ 修正点: 必要な引数をすべて渡して1回だけ実行
      renderProfile(data, targetId, myUid);
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
  // ★ 修正点: 関数末尾にあった重複した renderProfile 呼び出しを削除
}

/**
 * プロフィール描画
 */
function renderProfile(data, targetId, myUid) {
  const headerTitle = document.getElementById("js-header-title");
  if (headerTitle) {
    const targetName = data.userName || "名無し";
    const myName = sessionStorage.getItem("user_name");
    // ID比較で「マイプロフィール」かどうかを判定
    headerTitle.innerText = targetId === myUid ? "マイプロフィール" : `${targetName}さんのプロフィール`;
  }

  if (data.favoriteChara) {
    applyCharaTheme(data.favoriteChara);
  }

  const nameEl = document.getElementById("js-user-name");
  if (nameEl) nameEl.innerText = data.userName || "名無し";

  // フォローボタンの制御
  const actionArea = document.getElementById("js-user-action-area");
  if (actionArea) {
    if (targetId === myUid || !myUid) {
      actionArea.innerHTML = "";
    } else {
      const followingRef = ref(db, `social/following/${myUid}/${targetId}`);
      onValue(followingRef, (snapshot) => {
        const isFollowing = snapshot.exists();

        actionArea.innerHTML = `
          <button id="js-follow-btn" class="c-btn ${isFollowing ? "is-active" : ""}" style="
            display: flex; align-items: center; gap: 8px; margin-top: 10px;
            background: ${isFollowing ? "var(--bg-input)" : "var(--chara-main)"};
            color: ${isFollowing ? "var(--text-main)" : "#fff"};
            padding: 8px 20px; border-radius: 20px; border: 1px solid var(--border); 
            font-weight: bold; cursor: pointer; transition: 0.2s;
          ">
            <span class="material-symbols-outlined" style="font-size: 18px;">
              ${isFollowing ? "person_remove" : "person_add"}
            </span>
            ${isFollowing ? "フォロー解除" : "フォローする"}
          </button>
        `;

        const followBtn = document.getElementById("js-follow-btn");
        if (followBtn) {
          followBtn.onclick = () => handleFollow(myUid, targetId, isFollowing);
        }
      });
    }
  }

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
 * 投票履歴の取得
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

        const horseMap = {};
        if (race.horses) {
          Object.keys(race.horses).forEach((hId) => {
            const hData = race.horses[hId];
            horseMap[hId] = hData.userName;
            horseMap[hData.horseName] = hData.userName;
          });
        }

        const results = race.results;
        const top3 = results ? [results["1"], results["2"], results["3"]] : [];

        Object.keys(combos).forEach((comboId) => {
          const combo = combos[comboId];
          const voters = combo.voters || [];
          const myVote = Array.isArray(voters) ? voters.find((v) => v.uid === targetId || v === targetId) : null;

          if (myVote) {
            const horseNames = combo.names || comboId.split("_");
            const horseIds = combo.horseIds || [];

            const myFullNames = horseNames.map((hName, index) => {
              const hId = horseIds[index];
              const uName = hId ? horseMap[hId] || "不明" : horseMap[hName] || "不明";
              return `${hName}(${uName})`;
            });

            const isHit = top3.length >= 3 && myFullNames.every((fullName) => top3.includes(fullName));

            userHistory.push({
              raceTitle: race.title || "無題のレース",
              raceId: raceId,
              combination: horseNames.join(" - "),
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
          div.className = `p-user__history-item p-voting__item ${item.isHit ? "is-hit" : ""}`;
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

/**
 * フォローの実行/解除処理
 */
async function handleFollow(myUid, targetId, isFollowing) {
  const { set, remove } = await import("https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js");

  const followingRef = ref(db, `social/following/${myUid}/${targetId}`);
  const followerRef = ref(db, `social/followers/${targetId}/${myUid}`);

  try {
    if (isFollowing) {
      await Promise.all([remove(followingRef), remove(followerRef)]);
    } else {
      await Promise.all([set(followingRef, true), set(followerRef, true)]);
    }
  } catch (err) {
    console.error("Follow Error:", err);
  }
}

// 実行
initUserPage();
