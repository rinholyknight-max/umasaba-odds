// --- インポート ---
// 1. Firebaseの初期化に必要な initializeApp と getDatabase を追加
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

// 2. auth.js からは checkAuth だけをインポート（dbは消す）
import { checkAuth } from "./auth.js";

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

// 3. このファイル専用の db インスタンスを作成
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export async function initResultsAdmin() {
  // 1. 認証チェック（管理者以外は追い出すなどの処理）
  const user = await checkAuth();
  if (!user) return;

  const container = document.getElementById("js-results-list");
  if (!container) return;

  // 2. データ監視開始
  const racesRef = ref(db, "races");
  onValue(racesRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      container.innerHTML = `<p class="u-text-center">レースデータがありません</p>`;
      return;
    }

    // 終了済みレースのみを抽出して表示
    const closedRaces = Object.entries(data)
      .filter(([id, race]) => race.status === "closed")
      .reverse();

    if (closedRaces.length === 0) {
      container.innerHTML = `<p class="u-text-center">終了したレースはありません。</p>`;
      return;
    }

    container.innerHTML = closedRaces.map(([id, race]) => createRaceResultCard(id, race)).join("");
  });
}

// --- カード生成関数 ---
function createRaceResultCard(id, race) {
  const results = race.results || {};
  const horses = race.horses ? Object.values(race.horses) : [];

  const rankRows = [1, 2, 3, 4, 5]
    .map(
      (num) => `
    <div class="p-result-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
      <span style="width: 45px; font-weight: bold; color: var(--chara-main); font-family: 'Zen Kaku Gothic New';">${num}着</span>
      <select class="js-result-select c-input" data-race-id="${id}" data-rank="${num}" style="flex: 1; padding: 8px;">
        <option value="">-- 未確定 --</option>
        ${horses
          .map(
            (h) => `
          <option value="${h.horseName}" ${results[num] === h.horseName ? "selected" : ""}>
            ${h.horseName} (${h.userName})
          </option>
        `,
          )
          .join("")}
      </select>
    </div>
  `,
    )
    .join("");

  return `
    <div class="c-card" style="margin-bottom: 24px; padding: 16px; border-top: 4px solid var(--chara-main); background: var(--bg-card);">
      <h3 style="margin: 0 0 16px 0; font-size: 1.1rem; border-bottom: 1px solid var(--border); padding-bottom: 8px;">${race.title}</h3>
      <div class="p-result-inputs">
        ${rankRows}
      </div>
      <button class="c-button c-button--primary" style="width: 100%; margin-top: 16px;" onclick="saveResults('${id}')">
        <span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; margin-right: 4px;">check_circle</span>
        結果を保存する
      </button>
    </div>
  `;
}

// --- 保存処理 ---
window.saveResults = async (raceId) => {
  const selects = document.querySelectorAll(`.js-result-select[data-race-id="${raceId}"]`);
  const resultsData = {};

  selects.forEach((sel) => {
    if (sel.value) {
      resultsData[sel.dataset.rank] = sel.value;
    }
  });

  if (Object.keys(resultsData).length === 0) {
    alert("着順を選択してください。");
    return;
  }

  try {
    await update(ref(db, `races/${raceId}`), { results: resultsData });
    alert("着順を確定しました！");
  } catch (err) {
    console.error(err);
    alert("保存に失敗しました。");
  }
};
