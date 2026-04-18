import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update, increment, push, serverTimestamp, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
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

export function initVoting() {
  initTheme();

  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

  if (!checkAuth()) return;
  initMenu();
  document.getElementById("js-logout").onclick = logout;

  // --- 状態管理用変数 ---
  let allRacesData = {}; // Firebaseから取得した全レースデータ
  let activeRaceId = "race_001"; // 現在表示中のレースID
  let selectedHorses = []; // 現在選択中の馬（表示中のレースに紐づく）

  // DOM要素
  const slider = document.getElementById("js-race-slider");
  const dotsContainer = document.getElementById("js-race-dots");
  const submitBtn = document.getElementById("js-submit-vote");
  const voterNameInput = document.getElementById("js-voter-name");
  const voterCommentInput = document.getElementById("js-voter-comment");

  if (voterNameInput) {
    const savedName = sessionStorage.getItem("user_name");
    if (savedName) voterNameInput.value = savedName;
  }

  // UI更新関数
  const updateSelectionUI = () => {
    // アクティブなスライド内のスロットを更新
    const activeSlide = document.querySelector(`.p-voting__slide-item[data-race-id="${activeRaceId}"]`);
    if (!activeSlide) return;

    for (let i = 1; i <= 3; i++) {
      const slot = activeSlide.querySelector(`.p-voting__slot[data-slot="${i}"] .slot-name`);
      if (slot) slot.innerText = selectedHorses[i - 1] ? selectedHorses[i - 1].name : "未選択";
    }

    submitBtn.disabled = selectedHorses.length < 3;

    // リスト内のボタン状態更新
    activeSlide.querySelectorAll(".p-voting__item").forEach((item) => {
      const id = item.getAttribute("data-id");
      const btn = item.querySelector("button");
      const isSelected = selectedHorses.some((s) => s.id === id);
      btn.innerText = isSelected ? "解除" : "選択";
      btn.className = `c-button ${isSelected ? "c-button--danger" : "c-button--secondary"}`;
    });
  };

  // スライダーのスクロールを検知してactiveRaceIdを更新
  slider.addEventListener("scroll", () => {
    const slideWidth = slider.offsetWidth;
    const index = Math.round(slider.scrollLeft / slideWidth);
    const slides = document.querySelectorAll(".p-voting__slide-item");
    if (slides[index]) {
      const newRaceId = slides[index].getAttribute("data-race-id");
      if (activeRaceId !== newRaceId) {
        activeRaceId = newRaceId;
        selectedHorses = []; // レースを切り替えたら選択をリセット（混同防止）
        updateSelectionUI();
        updateDots(index);
      }
    }
  });

  const updateDots = (index) => {
    dotsContainer.querySelectorAll("span").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === index);
    });
  };

  // 1レース分のスライドHTMLを生成
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
        <div class="p-voting__selection-container">
          <h1 class="p-voting__title">${raceInfo.title || "投票フォーム"}</h1>
          <div class="p-voting__slots">
            <div class="p-voting__slot" data-slot="1">1枠: <span class="slot-name">未選択</span></div>
            <div class="p-voting__slot" data-slot="2">2枠: <span class="slot-name">未選択</span></div>
            <div class="p-voting__slot" data-slot="3">3枠: <span class="slot-name">未選択</span></div>
          </div>
        </div>
        <h2 class="p-voting__subtitle">出走表（3頭選んでください）</h2>
        <div class="p-voting__list">${horseItemsHtml || "出走馬が登録されていません"}</div>
      </div>
    `;
  };

  // 投票処理
  submitBtn.onclick = async () => {
    const voterName = voterNameInput.value.trim();
    const voterComment = voterCommentInput.value.trim();
    const userId = sessionStorage.getItem("user_id");

    if (!voterName) {
      alert("投票者名を入力してください");
      voterNameInput.focus();
      return;
    }

    const sortedNames = selectedHorses.map((h) => h.name).sort();
    const ticketId = sortedNames.join("_");

    submitBtn.disabled = true;
    submitBtn.innerText = "送信中...";

    try {
      // ★保存先を races/${activeRaceId}/combos に変更
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

      // ログもレースごとに分ける場合はパスを変更
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

  // --- データ取得（複数レース対応） ---
  onValue(ref(db, "races"), (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      slider.innerHTML = "<p style='padding:20px;'>開催中のレースがありません</p>";
      return;
    }
    allRacesData = data;
    slider.innerHTML = "";
    dotsContainer.innerHTML = "";

    const raceIds = Object.keys(data);
    raceIds.forEach((id, idx) => {
      // スライド生成
      slider.insertAdjacentHTML("beforeend", createSlideHtml(id, data[id]));

      // ドット生成
      const dot = document.createElement("span");
      if (idx === 0) dot.className = "is-active";
      dotsContainer.appendChild(dot);
    });

    // 最初のレースIDをセット
    activeRaceId = raceIds[0];

    // ボタンにイベント割り当て
    slider.querySelectorAll(".p-voting__item").forEach((item) => {
      const btn = item.querySelector("button");
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
