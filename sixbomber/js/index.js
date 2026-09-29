/**
 * 💣 シックスボンバー 司会用ボード
 * 6チームの回答をめくって表示。お題と○×判定はゲームマスターページからリアルタイムで反映。
 */
import { watchGame } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("members-container");
  const resetBtn = document.getElementById("reset-all-btn");
  const refreshBtn = document.getElementById("refresh-data-btn");
  const openAllBtn = document.getElementById("open-all-btn");
  const questionText = document.getElementById("question-text");
  const scoreSlots = document.getElementById("score-slots");
  const scoreCorrect = document.getElementById("score-correct");
  const scoreTotal = document.getElementById("score-total");
  const clearOverlay = document.getElementById("clear-overlay");
  const clearCloseBtn = document.getElementById("clear-close-btn");

  const API_URL = "/api/get-members?board=sixbomber";

  // 直前に受け取った判定（変化したカードだけ演出するため）
  let currentJudges = {};

  try {
    const response = await fetch(API_URL);
    const result = await response.json();
    if (!result.success) return;

    result.data.forEach((member, index) => {
      const card = document.createElement("div");
      card.className = "member-card";
      card.setAttribute("data-username", member.username);

      card.innerHTML = `
      <div class="member-header">
        <h3><span class="member-no">${index + 1}</span>${member.name || member.username}</h3>
        <span class="toggle-badge">オープン</span>
      </div>
      <div class="member-content">
        <p class="memo-text"></p>
        <div class="canvas-img-wrap">
          <img src="" alt="手書き回答" />
        </div>
      </div>
      <div class="judge-stamp"></div>
    `;

      applyExclusiveContent(card, member.text, member.image);

      // カードをクリックで回答オープン
      card.addEventListener("click", () => openCard(card));

      container.appendChild(card);
    });

    scoreTotal.textContent = result.data.length;
    renderScore();

    // まとめて開く：まだ伏せてあるカードを左から順にオープン
    openAllBtn.addEventListener("click", () => {
      const closedCards = container.querySelectorAll(".member-card:not(.is-active)");
      closedCards.forEach((card, i) => {
        setTimeout(() => openCard(card), i * 150);
      });
    });

    // すべて隠す：カードを伏せ直す（判定はゲームマスター側で管理）
    resetBtn.addEventListener("click", () => {
      container.querySelectorAll(".member-card").forEach((card) => {
        card.classList.remove("is-active");
        updateBadge(card);
      });
      clearOverlay.classList.remove("is-open");
    });

    // 最新データに更新ボタンのクリック処理
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;

      try {
        const res = await fetch(API_URL);
        const updateResult = await res.json();

        if (updateResult.success) {
          updateResult.data.forEach((member) => {
            const card = container.querySelector(`.member-card[data-username="${member.username}"]`);
            if (card) applyExclusiveContent(card, member.text, member.image);
          });
        }
      } catch (err) {
        console.error("Refresh Error:", err);
      } finally {
        refreshBtn.disabled = false;
      }
    });
  } catch (error) {
    console.error("Fetch Members Error:", error);
  }

  clearCloseBtn.addEventListener("click", () => {
    clearOverlay.classList.remove("is-open");
  });

  // 🔥 お題・判定をリアルタイムで反映
  watchGame(({ question, judges }) => {
    questionText.textContent = question || "お題の登録を待っています";
    questionText.classList.toggle("is-empty", !question);

    container.querySelectorAll(".member-card").forEach((card) => {
      const username = card.dataset.username;
      if (judges[username] !== currentJudges[username]) {
        setJudge(card, judges[username] || null);
      }
    });
    currentJudges = judges;
    renderScore();
  }).catch((error) => console.error("Watch Game Error:", error));

  /**
   * カードを開いて回答を表示する
   */
  function openCard(card) {
    if (card.classList.contains("is-active")) return;
    card.classList.add("is-active");
    updateBadge(card);
  }

  /**
   * ○×判定をカードに反映（判定が付いたカードは自動でオープン）
   */
  function setJudge(card, judge) {
    card.classList.remove("is-correct", "is-wrong");

    if (!judge) {
      card.removeAttribute("data-judge");
      card.querySelector(".judge-stamp").textContent = "";
      updateBadge(card);
      return;
    }

    card.dataset.judge = judge;
    card.classList.add("is-active");
    // アニメーションを毎回再生するため、リフローを挟んでからクラス付与
    void card.offsetWidth;
    card.classList.add(judge === "correct" ? "is-correct" : "is-wrong");
    card.querySelector(".judge-stamp").textContent = judge === "correct" ? "○" : "×";
    updateBadge(card);
  }

  /**
   * カードの状態に合わせてバッジの文言を切り替える
   */
  function updateBadge(card) {
    const badge = card.querySelector(".toggle-badge");
    if (!card.classList.contains("is-active")) badge.textContent = "オープン";
    else if (card.dataset.judge === "correct") badge.textContent = "正解";
    else if (card.dataset.judge === "wrong") badge.textContent = "BOMB!";
    else badge.textContent = "判定待ち";
  }

  /**
   * スコアボード（6つのランプと正解数）を描画
   */
  function renderScore() {
    const cards = Array.from(container.querySelectorAll(".member-card"));
    const correctCount = cards.filter((card) => card.dataset.judge === "correct").length;

    scoreSlots.innerHTML = cards
      .map((card) => `<span class="score-slot ${card.dataset.judge ? `is-${card.dataset.judge}` : ""}"></span>`)
      .join("");
    scoreCorrect.textContent = correctCount;

    clearOverlay.classList.toggle("is-open", cards.length > 0 && correctCount === cards.length);
  }

  /**
   * 💡 テキストと手書き画像の表示を完全に切り替える排他制御関数
   */
  function applyExclusiveContent(card, text, image) {
    const textElem = card.querySelector(".memo-text");
    const imgWrap = card.querySelector(".canvas-img-wrap");
    const imgElem = imgWrap.querySelector("img");

    const hasText = text && text.trim() !== "";

    if (hasText) {
      // 📝 テキストがある時は「テキストのみ」
      textElem.textContent = text;
      textElem.style.display = "";
      imgWrap.style.display = "none";
      imgElem.src = "";
    } else if (image) {
      // 🎨 手書き画像がある時は「手書きのみ」
      textElem.textContent = "";
      textElem.style.display = "none";
      imgWrap.style.display = "";
      imgElem.src = image;
    } else {
      // 両方空の時は「未回答」表示
      textElem.textContent = "（未回答）";
      textElem.style.display = "";
      imgWrap.style.display = "none";
    }
  }
});
