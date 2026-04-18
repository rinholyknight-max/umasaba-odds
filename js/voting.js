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

  let selectedHorses = [];
  const horseListDiv = document.getElementById("horse-list");
  const submitBtn = document.getElementById("js-submit-vote");
  const voterNameInput = document.getElementById("js-voter-name");
  const voterCommentInput = document.getElementById("js-voter-comment"); // ★追加

  // --- 自動入力ロジック ---
  if (voterNameInput) {
    // sessionStorageに保存されている名前があればセット
    const savedName = sessionStorage.getItem("user_name");
    if (savedName) {
      voterNameInput.value = savedName;
    }
  }

  // UI更新
  const updateSelectionUI = () => {
    for (let i = 1; i <= 3; i++) {
      const slot = document.querySelector(`.p-voting__slot[data-slot="${i}"] .slot-name`);
      if (slot) slot.innerText = selectedHorses[i - 1] ? selectedHorses[i - 1].name : "未選択";
    }
    submitBtn.disabled = selectedHorses.length < 3;

    document.querySelectorAll(".p-voting__item").forEach((item) => {
      const id = item.getAttribute("data-id");
      const btn = item.querySelector("button");
      const isSelected = selectedHorses.some((s) => s.id === id);
      btn.innerText = isSelected ? "解除" : "選択";
      btn.className = `c-button ${isSelected ? "c-button--danger" : "c-button--secondary"}`;
    });
  };

  document.getElementById("js-clear-btn").onclick = () => {
    selectedHorses = [];
    updateSelectionUI();
  };

  // 投票処理
  submitBtn.onclick = async () => {
    const voterName = voterNameInput.value.trim();
    const voterComment = voterCommentInput.value.trim(); // ★追加

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
      const comboRef = ref(db, `combos/${ticketId}`);
      const snapshot = await get(comboRef);
      const currentData = snapshot.val() || {};

      // voter情報をオブジェクト形式で保存するように変更
      const currentVoters = Array.isArray(currentData.voters) ? currentData.voters : [];
      currentVoters.push({
        name: voterName,
        comment: voterComment,
        at: new Date().getTime(),
      });

      await update(comboRef, {
        votes: increment(1),
        voters: currentVoters,
        names: sortedNames,
      });

      await push(ref(db, "logs"), {
        user: voterName,
        comment: voterComment,
        combination: ticketId,
        timestamp: serverTimestamp(),
      });

      window.location.href = "odds.html";
    } catch (e) {
      console.error(e);
      alert("投票に失敗しました");
      submitBtn.disabled = false;
      submitBtn.innerText = "投票を確定する";
    }
  };

  // リスト取得
  onValue(ref(db, "horses"), (snapshot) => {
    const data = snapshot.val();
    horseListDiv.innerHTML = "";
    if (!data) return;

    for (let id in data) {
      const h = data[id];
      const item = document.createElement("div");
      item.className = "p-voting__item";
      item.setAttribute("data-id", id);
      item.innerHTML = `
        <div class="p-voting__info">
            <div class="p-voting__text-group">
                <span class="p-voting__name">${h.horseName}</span>
                <span class="p-voting__user">トレーナー: ${h.userName}</span>
            </div>
        </div>
        <button class="c-button c-button--secondary">選択</button>
      `;

      item.querySelector("button").onclick = () => {
        const idx = selectedHorses.findIndex((s) => s.id === id);
        if (idx > -1) selectedHorses.splice(idx, 1);
        else if (selectedHorses.length < 3) selectedHorses.push({ id, name: h.horseName });
        updateSelectionUI();
      };
      horseListDiv.appendChild(item);
    }
    updateSelectionUI();
  });
}
