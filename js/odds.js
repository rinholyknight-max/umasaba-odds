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

  // 折りたたみ要素の取得
  const filterDetails = document.querySelector(".p-voting__filter-details");

  let allCombos = [];
  let totalVotes = 0;
  let horseToUserMap = {};
  let myChart = null;

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
        <p style="margin:5px 0 0; line-height:1.4;">${comment}</p>
    `;
      listContainer.appendChild(item);
    });

    modal.classList.add("is-show");
  };

  const closeModal = () => modal.classList.remove("is-show");
  document.getElementById("js-modal-close").onclick = closeModal;
  document.getElementById("js-modal-overlay").onclick = closeModal;

  // チャート更新
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
        maintainAspectRatio: false, // ★重要: これでCSSの高さが反映される
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
      item.style.cursor = "pointer";
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
        </div>
      `;

      const chipContainer = item.querySelector(`#voters-${c.id}`);
      voterList.forEach((voter) => {
        const chip = document.createElement("span");
        chip.className = "p-voting__voter-tag";
        chip.style.cursor = "pointer";
        const isObject = typeof voter === "object" && voter !== null;
        chip.innerText = isObject ? voter.name || "不明" : voter;
        chip.onclick = (e) => {
          e.stopPropagation();
          openModal(voterList);
        };
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

  // 検索入力
  searchInput.oninput = () => {
    const key = searchInput.value.toLowerCase();

    // 検索されたら自動で開く
    if (key.length > 0 && filterDetails) {
      filterDetails.setAttribute("open", "");
    }

    render(allCombos.filter((c) => c.id.toLowerCase().includes(key)));
  };

  // ソートボタンの処理
  document.getElementById("sort-asc").onclick = () => {
    render([...allCombos].sort((a, b) => b.v - a.v));
    if (window.innerWidth <= 768 && filterDetails) filterDetails.removeAttribute("open");
  };

  document.getElementById("sort-desc").onclick = () => {
    render([...allCombos].sort((a, b) => a.v - b.v));
    if (window.innerWidth <= 768 && filterDetails) filterDetails.removeAttribute("open");
  };
}
