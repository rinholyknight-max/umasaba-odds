import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";

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
  initTheme();
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

  if (!checkAuth()) return;
  initMenu();
  document.getElementById("js-logout").onclick = logout;

  // DOM取得
  const oddsListDiv = document.getElementById("odds-list");
  const totalInfoDiv = document.getElementById("total-info");
  const searchInput = document.getElementById("js-search-input");
  const modal = document.getElementById("js-modal");
  const modalComment = document.getElementById("js-modal-comment");
  const modalTitle = document.getElementById("js-modal-title");
  const modalDate = document.getElementById("js-modal-date");

  let allCombos = [];
  let totalVotes = 0;
  let horseToUserMap = {};
  let currentSortOrder = "asc";
  let myChart = null;

  // モーダル操作
  const openModal = (voter) => {
    modalTitle.innerText = `${voter.name} さんのコメント`;
    modalComment.innerText = voter.comment || "コメントはありません。";
    modalDate.innerText = voter.at ? new Date(voter.at).toLocaleString() : "";
    modal.classList.add("is-show");
  };

  const closeModal = () => modal.classList.remove("is-show");
  document.getElementById("js-modal-close").onclick = closeModal;
  document.getElementById("js-modal-overlay").onclick = closeModal;

  // チャート更新（以前のロジック）
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
        datasets: [{ data: displayData.map((h) => h.votes), backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40", "#C9CBCF"] }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: isDark ? "#fff" : "#333" } } } },
    });
  };

  const render = (arr) => {
    oddsListDiv.innerHTML = "";
    arr.forEach((c) => {
      const odds = c.v > 0 ? (totalVotes / c.v).toFixed(1) : "99.9";
      const names = c.id.split("_");
      const item = document.createElement("div");
      item.className = "p-voting__item p-voting__item--odds";

      const voterList = Array.isArray(c.voters) ? c.voters : [];

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
        </div>
      `;

      // 投票者チップを個別に生成してイベントを付与
      const chipContainer = item.querySelector(`#voters-${c.id}`);
      voterList.forEach((voter) => {
        const chip = document.createElement("span");
        chip.className = "p-voting__voter-tag";
        chip.innerText = typeof voter === "string" ? voter : voter.name;
        chip.style.cursor = "pointer";
        chip.onclick = () => openModal(typeof voter === "string" ? { name: voter, comment: "（以前の投票データです）" } : voter);
        chipContainer.appendChild(chip);
      });

      oddsListDiv.appendChild(item);
    });
    updateChart();
  };

  // リアルタイム監視
  onValue(ref(db, "horses"), (snap) => {
    const data = snap.val();
    if (data) for (let id in data) horseToUserMap[data[id].horseName] = data[id].userName;
    if (allCombos.length > 0) render(allCombos);
  });

  onValue(ref(db, "combos"), (snap) => {
    const data = snap.val();
    if (!data) return;
    allCombos = [];
    totalVotes = 0;
    for (let id in data) {
      const v = data[id].votes || 0;
      totalVotes += v;
      allCombos.push({ id, ...data[id], v });
    }
    totalInfoDiv.innerText = `総投票数: ${totalVotes} 票`;
    render(allCombos.sort((a, b) => b.v - a.v));
  });

  searchInput.oninput = () => {
    const key = searchInput.value.toLowerCase();
    render(allCombos.filter((c) => c.id.toLowerCase().includes(key)));
  };
}
