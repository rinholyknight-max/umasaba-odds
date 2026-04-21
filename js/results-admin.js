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
  // 1. 認証チェック
  const user = await checkAuth();
  if (!user) return;

  const container = document.getElementById("js-results-list");
  if (!container) return;

  // 2. データ監視開始
  const racesRef = ref(db, "races");
  onValue(racesRef, (snapshot) => {
    const data = snapshot.val();

    // データ自体が存在しない場合
    if (!data) {
      container.innerHTML = `<p class="u-text-center" style="padding:20px;">レースデータが見つかりません</p>`;
      return;
    }

    // 終了済みレースのみを抽出（新しい順）
    // admin.js の push() で生成されたIDに対応
    const closedRaces = Object.entries(data)
      .filter(([id, race]) => race && race.status === "closed")
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0)); // ID順ではなく作成日時順

    if (closedRaces.length === 0) {
      container.innerHTML = `<p class="u-text-center" style="padding:20px;">終了したレースはありません。</p>`;
      return;
    }

    // カードの描画
    container.innerHTML = closedRaces.map(([id, race]) => createRaceResultCard(id, race)).join("");
  });
}

// --- カード生成関数 ---
function createRaceResultCard(id, race) {
  // すでに保存されている結果を取得
  const results = race.results || {};

  // admin.js の構造に合わせて馬リストを取得（存在しない場合は空配列）
  // race.horses が undefined の場合に備えて安全に取得
  const horses = race.horses ? Object.values(race.horses) : [];

  // プルダウン部分の生成
  const rankRows = [1, 2, 3, 4, 5]
    .map((num) => {
      // 現在の着順に登録されている馬の名前
      const currentWinner = results[num] || "";

      return `
        <div class="p-result-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <span style="width: 45px; font-weight: bold; color: var(--chara-main); font-family: 'Zen Kaku Gothic New';">${num}着</span>
          <select class="js-result-select c-input" data-race-id="${id}" data-rank="${num}" style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-input);">
            <option value="">-- 未選択 --</option>
            ${horses
              .map(
                (h) => `
              <option value="${h.horseName}" ${currentWinner === h.horseName ? "selected" : ""}>
                ${h.horseName} (${h.userName})
              </option>
            `,
              )
              .join("")}
          </select>
        </div>
      `;
    })
    .join("");

  // 馬がいない場合の警告表示
  const noHorsesWarning = horses.length === 0 ? `<p style="color: #ff4d4d; font-size: 0.8rem; margin-bottom: 10px;">⚠️ このレースには馬が登録されていません</p>` : "";

  return `
    <div class="c-card" style="margin-bottom: 24px; padding: 16px; border-top: 4px solid var(--chara-main); background: var(--bg-card); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 16px 0; font-size: 1.1rem; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
        ${race.title || "無題のレース"}
      </h3>
      <div class="p-result-inputs">
        ${noHorsesWarning}
        ${rankRows}
      </div>
      <button class="c-button c-button--primary" 
              style="width: 100%; margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 8px;" 
              onclick="saveResults('${id}')"
              ${horses.length === 0 ? "disabled" : ""}>
        <span class="material-symbols-outlined" style="font-size: 18px;">check_circle</span>
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
      // data-rank(1〜5) をキーにして馬名を保存
      resultsData[sel.dataset.rank] = sel.value;
    }
  });

  if (Object.keys(resultsData).length === 0) {
    alert("少なくとも1着の馬は選択してください。");
    return;
  }

  try {
    // Firebaseの races/{raceId}/results ノードを更新
    await update(ref(db, `races/${raceId}`), {
      results: resultsData,
      updatedAt: Date.now(),
    });
    alert("レース結果を保存しました！");
  } catch (err) {
    console.error("Firebase Update Error:", err);
    alert("保存に失敗しました。権限や通信状況を確認してください。");
  }
};
