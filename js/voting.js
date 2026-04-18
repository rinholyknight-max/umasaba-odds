import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update, increment, push, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
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

export function initVoting() {
  initPageInfo("odds");
  initTheme();

  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

  if (!checkAuth()) return;
  initMenu();
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // --- 状態管理用変数 ---
  let allRacesData = {};
  let activeRaceId = "race_001";
  let selectedHorses = [];

  // DOM要素
  const slider = document.getElementById("js-race-slider");
  const dotsContainer = document.getElementById("js-race-dots");
  const submitBtn = document.getElementById("js-submit-vote");
  const voterNameInput = document.getElementById("js-voter-name");
  const voterCommentInput = document.getElementById("js-voter-comment");
  const raceTitleDisp = document.getElementById("js-active-race-title"); // タイトル表示用

  if (voterNameInput) {
    const savedName = sessionStorage.getItem("user_name");
    if (savedName) voterNameInput.value = savedName;
  }

  // UI更新関数
  const updateSelectionUI = () => {
    // スロットの更新（index.htmlの外に出した新しい構造に対応）
    for (let i = 1; i <= 3; i++) {
      const slot = document.querySelector(`.p-voting__slot[data-slot="${i}"] .slot-name`);
      if (slot) slot.innerText = selectedHorses[i - 1] ? selectedHorses[i - 1].name : "未選択";
    }

    if (submitBtn) submitBtn.disabled = selectedHorses.length < 3;

    // リスト内のボタン状態更新
    const activeSlide = document.querySelector(`.p-voting__slide-item[data-race-id="${activeRaceId}"]`);
    if (activeSlide) {
      activeSlide.querySelectorAll(".p-voting__item").forEach((item) => {
        const id = item.getAttribute("data-id");
        const btn = item.querySelector("button");
        if (btn) {
          const isSelected = selectedHorses.some((s) => s.id === id);
          btn.innerText = isSelected ? "解除" : "選択";
          btn.className = `c-button ${isSelected ? "c-button--danger" : "c-button--secondary"}`;
        }
      });
    }
  };

  // スライダーのスクロール検知（1箇所にまとめました）
  if (slider) {
    slider.addEventListener("scroll", () => {
      const slideWidth = slider.offsetWidth;
      const index = Math.round(slider.scrollLeft / slideWidth);
      const slides = document.querySelectorAll(".p-voting__slide-item");
      if (slides[index]) {
        const newRaceId = slides[index].getAttribute("data-race-id");
        if (activeRaceId !== newRaceId) {
          activeRaceId = newRaceId;

          // タイトル更新（存在チェック付き）
          if (raceTitleDisp && allRacesData[newRaceId]) {
            raceTitleDisp.innerText = allRacesData[newRaceId].title || "投票フォーム";
          }

          selectedHorses = [];
          updateSelectionUI();
          if (dotsContainer) updateDots(index);
        }
      }
    });
  }

  const updateDots = (index) => {
    if (!dotsContainer) return;
    dotsContainer.querySelectorAll("span").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
    });
  };

  const createSlideHtml = (raceId, raceInfo) => {
    const horses = raceInfo.horses || {};
    let horseItemsHtml = "";
    for (let id in horses) {
      const h = horses[id];
      horseItemsHtml += `
        <div class="p-voting__item" data-id="${id}">
          <div class="p-voting__info">
            <div class="p-voting__text-group">
              <span class="p-voting__name">${h.horseName}</span>
              <span class="p-voting__user">トレーナー: ${h.userName}</span>
            </div>
          </div>
          <button class="c-button c-button--secondary">選択</button>
        </div>
      `;
    }
    return `
      <div class="p-voting__slide-item" data-race-id="${raceId}">
        <h2 class="p-voting__subtitle">出走表</h2>
        <div class="p-voting__list">${horseItemsHtml || "出走馬なし"}</div>
      </div>
    `;
  };

  // 投票処理（存在チェックを追加）
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const voterName = voterNameInput ? voterNameInput.value.trim() : "";
      const voterComment = voterCommentInput ? voterCommentInput.value.trim() : "";
      const userId = sessionStorage.getItem("user_id");

      if (!voterName) {
        alert("投票者名を入力してください");
        if (voterNameInput) voterNameInput.focus();
        return;
      }

      const sortedNames = selectedHorses.map((h) => h.name).sort();
      const ticketId = sortedNames.join("_");

      submitBtn.disabled = true;
      submitBtn.innerText = "送信中...";

      try {
        const comboRef = ref(db, `races/${activeRaceId}/combos/${ticketId}`);
        const snapshot = await get(comboRef);
        const currentData = snapshot.val() || {};
        const currentVoters = Array.isArray(currentData.voters) ? currentData.voters : [];

        currentVoters.push({
          name: voterName,
          uid: userId,
          comment: voterComment,
          at: Date.now(),
        });

        await update(comboRef, {
          votes: increment(1),
          voters: currentVoters,
          names: sortedNames,
        });

        await push(ref(db, `races/${activeRaceId}/logs`), {
          user: voterName,
          uid: userId,
          comment: voterComment,
          combination: ticketId,
          timestamp: serverTimestamp(),
        });

        alert("投票が完了しました！");
        window.location.href = `odds.html?race=${activeRaceId}`;
      } catch (e) {
        console.error(e);
        alert("投票に失敗しました");
        submitBtn.disabled = false;
        submitBtn.innerText = "投票を確定する";
      }
    };
  }

  // --- データ取得 ---
  onValue(ref(db, "races"), (snapshot) => {
    const data = snapshot.val();
    if (!data || !slider) {
      if (slider) slider.innerHTML = "<p style='padding:20px;'>開催中のレースがありません</p>";
      return;
    }
    allRacesData = data;
    slider.innerHTML = "";
    if (dotsContainer) dotsContainer.innerHTML = "";

    const raceIds = Object.keys(data);
    raceIds.forEach((id, idx) => {
      slider.insertAdjacentHTML("beforeend", createSlideHtml(id, data[id]));
      const dot = document.createElement("span");
      if (idx === 0) dot.className = "is-active";
      if (dotsContainer) dotsContainer.appendChild(dot);
    });

    activeRaceId = raceIds[0];
    if (raceTitleDisp && data[activeRaceId]) {
      raceTitleDisp.innerText = data[activeRaceId].title || "投票フォーム";
    }

    slider.querySelectorAll(".p-voting__item").forEach((item) => {
      const btn = item.querySelector("button");
      if (btn) {
        btn.onclick = () => {
          const id = item.getAttribute("data-id");
          const name = item.querySelector(".p-voting__name").innerText;
          const idx = selectedHorses.findIndex((s) => s.id === id);
          if (idx > -1) {
            selectedHorses.splice(idx, 1);
          } else if (selectedHorses.length < 3) {
            selectedHorses.push({ id, name: name });
          }
          updateSelectionUI();
        };
      }
    });
    updateSelectionUI();
  });

  const clearBtn = document.getElementById("js-clear-btn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      selectedHorses = [];
      updateSelectionUI();
    };
  }
}
