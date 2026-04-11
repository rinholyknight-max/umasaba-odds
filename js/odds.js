import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";

const firebaseConfig = {
  /* ...そのまま... */
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// プラグイン登録はトップレベルで1回だけ
Chart.register(ChartDataLabels);

export function initOdds() {
  initTheme();
  if (!checkAuth()) return;
  initMenu();

  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;
  document.getElementById("js-logout").onclick = logout;

  // DOM取得
  const oddsListDiv = document.getElementById("odds-list");
  const totalInfoDiv = document.getElementById("total-info");
  const searchInput = document.getElementById("js-search-input");
  const modal = document.getElementById("js-modal");
  const filterDetails = document.querySelector(".p-voting__filter-details");

  let allCombos = [];
  let totalVotes = 0;
  let horseToUserMap = {};
  let chartInstance = null; // 変数名を myChart から変更して衝突回避

  // --- モーダル操作 ---
  const openModal = (voterList) => {
    const listContainer = document.getElementById("js-modal-comment-list");
    if (!listContainer) return;
    listContainer.innerHTML = voterList
      .map((v) => {
        const isObj = typeof v === "object" && v !== null;
        return `
        <div class="c-modal__comment-item" style="margin-bottom:15px; border-bottom:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:var(--text-sub);">
            <strong>${isObj ? v.name : v}</strong>
            <span>${isObj && v.at ? new Date(v.at).toLocaleString() : ""}</span>
          </div>
          <p style="margin:5px 0 10px; line-height:1.4;">${isObj ? v.comment : "（コメントなし）"}</p>
        </div>`;
      })
      .join("");
    modal.classList.add("is-show");
  };

  const closeModal = () => modal.classList.remove("is-show");
  document.getElementById("js-modal-close").onclick = closeModal;
  document.getElementById("js-modal-overlay").onclick = closeModal;

  // --- チャート更新 (ここを統合) ---
  const updateChart = (data) => {
    const canvas = document.getElementById("oddsChart");
    if (!canvas) return;

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";

    // グラフ用データ集計
    const horseVotes = {};
    allCombos.forEach((c) => {
      c.id.split("_").forEach((name) => (horseVotes[name] = (horseVotes[name] || 0) + c.v));
    });
    const sorted = Object.entries(horseVotes)
      .map(([name, votes]) => ({ name, votes }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 7);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(canvas.getContext("2d"), {
      type: "pie",
      data: {
        labels: sorted.map((h) => h.name),
        datasets: [
          {
            data: sorted.map((h) => h.votes),
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40", "#C9CBCF"],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }, // 項目をグラフ内に表示するので凡例は消す
          datalabels: {
            color: "#fff",
            font: { weight: "bold", size: 11 },
            formatter: (value, ctx) => {
              const label = ctx.chart.data.labels[ctx.dataIndex];
              const percent = ((value / totalVotes) * 100).toFixed(1);
              return `${label}\n${percent}%`;
            },
            align: "center",
            anchor: "center",
          },
        },
      },
    });
  };

  // --- レンダリング ---
  const render = (arr) => {
    oddsListDiv.innerHTML = "";
    arr.forEach((c) => {
      const odds = totalVotes > 0 && c.v > 0 ? (totalVotes / c.v).toFixed(1) : "99.9";
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
              ${names.map((n) => `<span class="p-voting__name">${n} <small>(${horseToUserMap[n] || "..."})</small></span>`).join("")}
            </div>
          </div>
          <div class="p-voting__stats"><span class="p-voting__votes">${c.v} 票</span></div>
        </div>
        <div class="p-voting__right-column">
          <div class="p-voting__voter-list">
             ${voterList.map((v) => `<span class="p-voting__voter-tag">${typeof v === "object" ? v.name : v}</span>`).join("")}
          </div>
          <div class="p-voting__odds-display"><span class="p-voting__number">${odds}</span></div>
        </div>
      `;
      oddsListDiv.appendChild(item);
    });
    updateChart();
  };

  // --- Firebase監視 ---
  onValue(ref(db, "horses"), (snap) => {
    const data = snap.val();
    if (data) {
      for (let id in data) horseToUserMap[data[id].horseName] = data[id].userName;
      if (allCombos.length > 0) render(allCombos);
    }
  });

  onValue(ref(db, "combos"), (snap) => {
    const data = snap.val();
    allCombos = [];
    totalVotes = 0;
    if (data) {
      for (let id in data) {
        const v = data[id].votes || 0;
        totalVotes += v;
        allCombos.push({ id, ...data[id], v });
      }
    }
    totalInfoDiv.innerText = `総投票数: ${totalVotes} 票`;
    render(allCombos.sort((a, b) => b.v - a.v));
  });

  // --- イベント設定 ---
  searchInput.oninput = () => {
    const key = searchInput.value.toLowerCase();
    if (key.length > 0 && filterDetails) filterDetails.setAttribute("open", "");
    render(allCombos.filter((c) => c.id.toLowerCase().includes(key)));
  };

  document.getElementById("sort-asc").onclick = () => render([...allCombos].sort((a, b) => b.v - a.v));
  document.getElementById("sort-desc").onclick = () => render([...allCombos].sort((a, b) => a.v - b.v));
}
