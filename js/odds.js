import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { initTheme } from "./theme.js";
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

export function initOdds() {
  initPageInfo("odds");

  initTheme();
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

  if (!checkAuth()) return;
  initMenu();
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // --- URLパラメータ判定 ---
  const urlParams = new URLSearchParams(window.location.search);
  const raceId = urlParams.get("race");

  const selectorEl = document.getElementById("js-race-selector");
  const detailEl = document.getElementById("js-odds-detail");

  if (!raceId) {
    // 【モードA】レース一覧を表示
    if (selectorEl) selectorEl.style.display = "block";
    if (detailEl) detailEl.style.display = "none";
    loadRaceList();
  } else {
    // 【モードB】詳細表示（グラフ・オッズ）
    if (selectorEl) selectorEl.style.display = "none";
    if (detailEl) detailEl.style.display = "";
    loadOddsDetail(raceId);
  }
}

// --- 関数: レース一覧の読み込み ---
function loadRaceList() {
  const listContainer = document.getElementById("js-race-list");
  onValue(ref(db, "races"), (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      listContainer.innerHTML = "<p style='padding:20px;'>開催中のレースがありません</p>";
      return;
    }
    let html = "";
    Object.keys(data).forEach((id) => {
      const race = data[id];
      html += `
        <a href="odds.html?race=${id}" class="p-voting__item" style="text-decoration: none; color: inherit;">
          <div class="p-voting__info">
            <div class="p-voting__text-group">
              <span class="p-voting__name">${race.title || "無題のレース"}</span>
              <span class="p-voting__user" style="display:block; font-size:0.75rem; color:var(--text-sub);">
                ${Object.keys(race.horses || {}).length}頭立て
              </span>
            </div>
          </div>
          <span class="material-symbols-outlined">chevron_right</span>
        </a>`;
    });
    listContainer.innerHTML = html;
  });
}
// --- 関数: オッズ詳細の読み込み (クイック切り替え対応版) ---
function loadOddsDetail(raceId) {
  // DOM再取得
  const oddsListDiv = document.getElementById("odds-list");
  const totalInfoDiv = document.getElementById("total-info");
  const searchInput = document.getElementById("js-search-input");
  const modal = document.getElementById("js-modal");
  const modalComment = document.getElementById("js-modal-comment");
  const modalTitle = document.getElementById("js-modal-title");
  const raceTitleDisp = document.getElementById("js-race-title");
  const filterDetails = document.querySelector(".p-voting__filter-details");

  // ★追加：クイックセレクター
  const quickSelect = document.getElementById("js-race-quick-select");

  let allCombos = [];
  let totalVotes = 0;
  let horseToUserMap = {};
  let myChart = null;

  // --- ★追加：クイック切り替えプルダウンの構築 ---
  if (quickSelect) {
    onValue(
      ref(db, "races"),
      (snapshot) => {
        const allRaces = snapshot.val();
        if (!allRaces) return;

        // プルダウンをリセット
        quickSelect.innerHTML = '<option value="">他のレースに切り替え...</option>';

        Object.keys(allRaces).forEach((id) => {
          const opt = document.createElement("option");
          opt.value = id;
          opt.innerText = allRaces[id].title || "無題のレース";
          if (id === raceId) opt.selected = true; // 現在のレースを選択状態に
          quickSelect.appendChild(opt);
        });
      },
      { onlyOnce: true },
    ); // 何度も書き換わらないよう1回のみ取得

    // 選択イベント
    quickSelect.onchange = (e) => {
      const selectedId = e.target.value;
      if (selectedId && selectedId !== raceId) {
        window.location.href = `odds.html?race=${selectedId}`;
      }
    };
  }

  // モーダル操作
  const openModal = (voterList) => {
    modalTitle.innerText = `投票コメント一覧`;
    const listContainer = document.getElementById("js-modal-comment-list") || modalComment;
    listContainer.innerHTML = "";
    voterList.forEach((v) => {
      const isObj = typeof v === "object" && v !== null;
      const name = isObj ? v.name : v;
      const uid = isObj ? v.uid : null;
      const comment = isObj ? v.comment : "（以前のデータ）";
      const date = isObj && v.at ? new Date(v.at).toLocaleString() : "";

      const item = document.createElement("div");
      item.className = "c-modal__comment-item";
      item.style.marginBottom = "15px";
      item.style.paddingBottom = "10px";
      item.style.borderBottom = "1px solid var(--border)";
      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-sub);">
            ${uid ? `<a href="user.html?id=${uid}" style="color:var(--chara-main); font-weight:bold; text-decoration:none;">${name}</a>` : `<strong>${name}</strong>`}
            <span>${date}</span>
        </div>
        <p style="margin:5px 0 0; line-height:1.4;">${comment}</p>`;
      listContainer.appendChild(item);
    });
    modal.classList.add("is-show");
  };

  const closeModal = () => modal.classList.remove("is-show");
  document.getElementById("js-modal-close").onclick = closeModal;
  document.getElementById("js-modal-overlay").onclick = closeModal;

  const updateChart = () => {
    const canvas = document.getElementById("oddsChart");
    if (!canvas) return;
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const horseVotes = {};
    allCombos.forEach((c) => {
      c.id.split("_").forEach((name) => (horseVotes[name] = (horseVotes[name] || 0) + c.v));
    });
    const sorted = Object.entries(horseVotes)
      .map(([name, votes]) => ({ name, votes }))
      .sort((a, b) => b.votes - a.votes);

    const displayData = sorted.slice(0, 7);
    if (myChart) myChart.destroy();
    myChart = new Chart(canvas.getContext("2d"), {
      type: "pie",
      data: {
        labels: displayData.map((h) => h.name),
        datasets: [
          {
            data: displayData.map((h) => h.votes),
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40", "#C9CBCF"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: window.innerWidth <= 768 ? "bottom" : "right",
            labels: { color: isDark ? "#fff" : "#333" },
          },
        },
      },
    });
  };

  const render = (arr) => {
    oddsListDiv.innerHTML = "";
    arr.forEach((c) => {
      const odds = c.v > 0 ? (totalVotes / c.v).toFixed(1) : "99.9";
      const names = c.id.split("_");
      const voterList = Array.isArray(c.voters) ? c.voters : [];

      const item = document.createElement("div");
      item.className = "p-voting__item p-voting__item--odds";
      item.onclick = () => openModal(voterList);
      item.innerHTML = `
        <div class="p-voting__info">
          <div class="p-voting__combo-names">
            <span class="p-voting__tag">3連複</span>
            <div class="p-voting__horse-group">
              ${names.map((n) => `<span class="p-voting__name">${n} <small>(${horseToUserMap[n] || "不明"})</small></span>`).join("")}
            </div>
          </div>
          <div class="p-voting__stats"><span class="p-voting__votes">${c.v} 票</span></div>
        </div>
        <div class="p-voting__right-column">
          <div class="p-voting__voter-list" id="voters-${c.id}"></div>
          <div class="p-voting__odds-display"><span class="p-voting__number">${odds}</span></div>
        </div>`;

      const chipContainer = item.querySelector(`#voters-${c.id}`);
      voterList.forEach((voter) => {
        const chip = document.createElement("span");
        chip.className = "p-voting__voter-tag";
        chip.innerText = typeof voter === "object" && voter !== null ? voter.name || "不明" : voter;
        chipContainer.appendChild(chip);
      });
      oddsListDiv.appendChild(item);
    });
    updateChart();
  };

  // --- リアルタイム監視 (パスを races/${raceId} 配下に変更) ---
  onValue(ref(db, `races/${raceId}`), (snap) => {
    const raceData = snap.val();
    if (!raceData) return;

    if (raceTitleDisp) raceTitleDisp.innerText = raceData.title || "投票結果";

    const horses = raceData.horses || {};
    horseToUserMap = {};
    for (let hId in horses) {
      horseToUserMap[horses[hId].horseName] = horses[hId].userName;
    }

    const comboData = raceData.combos || {};
    allCombos = [];
    totalVotes = 0;
    for (let cId in comboData) {
      const v = comboData[cId].votes || 0;
      totalVotes += v;
      allCombos.push({ id: cId, ...comboData[cId], v });
    }
    if (totalInfoDiv) totalInfoDiv.innerText = `総投票数: ${totalVotes} 票`;
    render(allCombos.sort((a, b) => b.v - a.v));
  });

  // 検索・ソート処理
  if (searchInput) {
    searchInput.oninput = () => {
      const key = searchInput.value.toLowerCase();
      if (key.length > 0 && filterDetails) filterDetails.setAttribute("open", "");
      render(allCombos.filter((c) => c.id.toLowerCase().includes(key)));
    };
  }
  document.getElementById("sort-asc").onclick = () => render([...allCombos].sort((a, b) => b.v - a.v));
  document.getElementById("sort-desc").onclick = () => render([...allCombos].sort((a, b) => a.v - b.v));
}
