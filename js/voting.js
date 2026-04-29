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

/**
 * voting.js
 * 投票ページの初期化
 */
export async function initVoting() {
  console.log("--- voting.js initialized ---");
  const db = getDatabase();

  // 1. 認証チェックを最初に行い、結果を待つ
  const authInfo = await checkAuth();
  if (!authInfo) return; // 未ログイン時は checkAuth 内でリダイレクト

  // 2. 認証後の ID を使ってテーマを初期化
  // これにより DB 上の最新の推しキャラ設定が同期される
  await initTheme(authInfo.userNumericId);

  // 3. ページ基本情報の初期化
  if (typeof initPageInfo === "function") initPageInfo("index");
  if (typeof initMenu === "function") initMenu();

  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // --- ユーザー情報の表示 ---
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

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
  const raceTitleDisp = document.getElementById("js-active-race-title");

  if (voterNameInput) voterNameInput.value = userName;

  // --- UI更新関数 ---
  const updateSelectionUI = () => {
    for (let i = 1; i <= 3; i++) {
      const slot = document.querySelector(`.p-voting__slot[data-slot="${i}"] .slot-name`);
      if (slot) slot.innerText = selectedHorses[i - 1] ? selectedHorses[i - 1].name : "未選択";
    }
    if (submitBtn) submitBtn.disabled = selectedHorses.length < 3;

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

  // --- スライダー制御 ---
  if (slider) {
    slider.addEventListener("scroll", () => {
      const slideWidth = slider.offsetWidth;
      const index = Math.round(slider.scrollLeft / slideWidth);
      const slides = document.querySelectorAll(".p-voting__slide-item");
      if (slides[index]) {
        const newRaceId = slides[index].getAttribute("data-race-id");
        if (activeRaceId !== newRaceId) {
          activeRaceId = newRaceId;
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

  // --- 左右ボタンの制御を追加 ---
  const prevBtn = document.getElementById("js-prev-race");
  const nextBtn = document.getElementById("js-next-race");

  if (prevBtn && nextBtn && slider) {
    // scrollBy を使うことで、既存の「scroll」リスナーが自動的に反応します
    nextBtn.onclick = () => slider.scrollBy({ left: slider.offsetWidth, behavior: "smooth" });
    prevBtn.onclick = () => slider.scrollBy({ left: -slider.offsetWidth, behavior: "smooth" });
  }

  const updateDots = (index) => {
    if (!dotsContainer) return;
    dotsContainer.querySelectorAll("span").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
    });
  };

  // --- スライド生成 ---
  const createSlideHtml = (raceId, raceInfo) => {
    const horses = raceInfo.horses || {};
    let horseItemsHtml = "";
    for (let [id, h] of Object.entries(horses)) {
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

  // --- 投票処理 ---
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const voterName = voterNameInput ? voterNameInput.value.trim() : "";
      const voterComment = voterCommentInput ? voterCommentInput.value.trim() : "";
      const userId = authInfo.uid;
      const sortedHorseIds = selectedHorses.map((h) => h.id).sort();

      if (!voterName) {
        alert("投票者名を入力してください");
        if (voterNameInput) voterNameInput.focus();
        return;
      }

      const sortedNames = selectedHorses.map((h) => h.name).sort();
      const ticketId = sortedHorseIds.join("_");

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
          // どのIDの馬が選ばれたかのスナップショット
          selection: selectedHorses.reduce((acc, h) => {
            acc[h.id] = h.name;
            return acc;
          }, {}),
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
    let activeSlideCount = 0; // 表示するレースをカウント用
    let firstActiveId = null; // 最初の有効なレースIDを保持用

    raceIds.forEach((id) => {
      // 【修正ポイント】status が "closed" ならスライドを作らない
      if (data[id].status === "closed") {
        return;
      }

      // 表示対象のレースがある場合のみ処理
      slider.insertAdjacentHTML("beforeend", createSlideHtml(id, data[id]));
      const dot = document.createElement("span");
      if (activeSlideCount === 0) {
        dot.className = "is-active";
        firstActiveId = id; // 最初に見つかった開いているレースを初期IDにする
      }
      if (dotsContainer) dotsContainer.appendChild(dot);

      activeSlideCount++;
    });

    // 【修正ポイント】表示できるレースが一つもなかった場合
    if (activeSlideCount === 0) {
      slider.innerHTML = "<p style='padding:20px; text-align:center;'>現在開催中のレースはありません</p>";
      if (raceTitleDisp) raceTitleDisp.innerText = "投票受付外";
      document.body.classList.remove("is-loading");
      return;
    }

    // 最初の有効なレースをアクティブに設定
    activeRaceId = firstActiveId;
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
    document.body.classList.remove("is-loading");
  });

  const clearBtn = document.getElementById("js-clear-btn");
  if (clearBtn) {
    clearBtn.onclick = () => {
      selectedHorses = [];
      updateSelectionUI();
    };
  }
}
