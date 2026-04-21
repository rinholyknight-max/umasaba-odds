import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { checkAuth } from "./auth.js";

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

// 現在編集中のレースIDを保持
let editingRaceId = null;

export async function initResultsAdmin() {
  const user = await checkAuth();
  if (!user) return;

  const container = document.getElementById("js-results-list");
  if (!container) return;

  onValue(ref(db, "races"), (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      container.innerHTML = `<p class="u-text-center">レースデータがありません</p>`;
      return;
    }

    const closedRaces = Object.entries(data)
      .filter(([id, race]) => race && race.status === "closed")
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    if (closedRaces.length === 0) {
      container.innerHTML = `<p class="u-text-center">終了したレースはありません。</p>`;
      return;
    }

    // モード切り替え描画
    if (editingRaceId && data[editingRaceId]) {
      container.innerHTML = createEditForm(editingRaceId, data[editingRaceId]);
    } else {
      container.innerHTML = createListView(closedRaces);
    }
  });
}

// --- 1. 一覧表示（選択画面） ---
function createListView(closedRaces) {
  const listItems = closedRaces
    .map(([id, race]) => {
      const isSettled = race.results && Object.keys(race.results).length > 0;
      return `
      <div class="c-card" style="margin-bottom: 12px; padding: 15px; display: flex; justify-content: space-between; align-items: center; background: var(--bg-card); border-left: 5px solid ${isSettled ? "#4caf50" : "#ffa000"}; border-radius: 8px;">
        <div>
          <div style="font-size: 0.75rem; color: var(--text-sub);">${race.createdAt ? new Date(race.createdAt).toLocaleDateString() : ""}</div>
          <div style="font-weight: bold; font-size: 1rem;">${race.title || "無題のレース"}</div>
          <div style="font-size: 0.7rem; margin-top: 4px;">
            ${isSettled ? '<span style="color:#4caf50;">● 結果登録済み</span>' : '<span style="color:#ffa000;">● 未登録</span>'}
          </div>
        </div>
        <button class="c-button" style="padding: 8px 16px; font-size: 0.8rem;" onclick="setEditMode('${id}')">
          選択
        </button>
      </div>
    `;
    })
    .join("");

  return `<div class="p-admin-list-view">${listItems}</div>`;
}

// --- 2. 編集フォーム（ここが探されていた関数です） ---
function createEditForm(id, race) {
  const results = race.results || {};
  const horses = race.horses ? Object.values(race.horses) : [];

  const rankRows = [1, 2, 3, 4, 5]
    .map((num) => {
      // 保存されている「馬名(ユーザー名)」を取得
      const savedValue = results[num] || "";

      return `
      <div class="p-result-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <span style="width: 45px; font-weight: bold; color: var(--chara-main);">${num}着</span>
        <select class="js-result-select c-input" data-rank="${num}" onchange="handleSelectDuplicate(this)" style="flex: 1; padding: 10px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-input);">
          <option value="">-- 未確定 --</option>
          ${horses
            .map((h) => {
              const val = `${h.horseName}(${h.userName})`;
              return `<option value="${val}" ${savedValue === val ? "selected" : ""}>${h.horseName} 【${h.userName}】</option>`;
            })
            .join("")}
        </select>
      </div>
    `;
    })
    .join("");

  return `
    <div class="p-admin-edit-view">
      <button onclick="clearEditMode()" style="background:none; border:none; color:var(--chara-main); cursor:pointer; display:flex; align-items:center; margin-bottom:15px; padding:0; font-weight:bold;">
        <span class="material-symbols-outlined">arrow_back</span> 一覧に戻る
      </button>
      
      <div class="c-card" style="padding: 20px; border-top: 4px solid var(--chara-main); border-radius: 8px; background: var(--bg-card);">
        <h3 style="margin-bottom: 15px;">${race.title}</h3>
        <div class="p-result-inputs">${rankRows}</div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button class="c-button c-button--primary" style="flex: 2;" onclick="saveResults('${id}')">保存する</button>
          <button class="c-button" style="flex: 1; background:#eee; color:#333;" onclick="clearEditMode()">キャンセル</button>
        </div>
      </div>
    </div>
  `;
}

// --- 3. グローバル関数 ---

window.setEditMode = (id) => {
  editingRaceId = id;
};
window.clearEditMode = () => {
  editingRaceId = null;
};

// リアルタイム重複チェック
window.handleSelectDuplicate = (target) => {
  const selects = document.querySelectorAll(".js-result-select");
  const currentValues = Array.from(selects)
    .map((s) => s.value)
    .filter((v) => v !== "");
  const hasDuplicate = currentValues.some((val, index) => currentValues.indexOf(val) !== index);

  if (hasDuplicate) {
    alert("この馬（トレーナー）は既に他の着順で選択されています。");
    target.value = ""; // リセット
  }
};

window.saveResults = async (raceId) => {
  const selects = document.querySelectorAll(`.js-result-select`);
  const resultsData = {};

  selects.forEach((sel) => {
    if (sel.value) resultsData[sel.dataset.rank] = sel.value;
  });

  if (!resultsData["1"]) {
    alert("少なくとも1着は選択してください。");
    return;
  }

  try {
    await update(ref(db, `races/${raceId}`), { results: resultsData });
    alert("結果を保存しました！");
    clearEditMode();
  } catch (err) {
    alert("エラー: " + err.message);
  }
};
