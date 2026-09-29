/**
 * 💣 シックスボンバー 司会用ボード
 * 6チームの回答を1枚ずつめくり、○×で判定。全員正解でクリア演出。
 */
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("members-container");
  const resetBtn = document.getElementById("reset-all-btn");
  const refreshBtn = document.getElementById("refresh-data-btn");
  const openAllBtn = document.getElementById("open-all-btn");
  const questionInput = document.getElementById("question-input");
  const scoreSlots = document.getElementById("score-slots");
  const scoreCorrect = document.getElementById("score-correct");
  const scoreTotal = document.getElementById("score-total");
  const clearOverlay = document.getElementById("clear-overlay");
  const clearCloseBtn = document.getElementById("clear-close-btn");

  const API_URL = "/api/get-members?board=sixbomber";
  const QUESTION_KEY = "umasaba_sixbomber_question";

  // お題はリロードしても消えないようにブラウザに保持
  try {
    questionInput.value = localStorage.getItem(QUESTION_KEY) || "";
  } catch (e) {}
  questionInput.addEventListener("input", () => {
    try {
      localStorage.setItem(QUESTION_KEY, questionInput.value);
    } catch (e) {}
  });

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
      <div class="judge-actions">
        <button type="button" class="judge-btn judge-btn--correct" data-judge="correct" title="正解">
          <span class="material-symbols-outlined">circle</span>
        </button>
        <button type="button" class="judge-btn judge-btn--wrong" data-judge="wrong" title="不正解">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="judge-stamp"></div>
    `;

      applyExclusiveContent(card, member.text, member.image);

      // カードをクリックで回答オープン（一度開いたら判定まで開きっぱなし）
      card.addEventListener("click", () => openCard(card));

      // ○×判定ボタン
      card.querySelectorAll(".judge-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // カード本体のクリックイベント発火をストップ
          setJudge(card, btn.dataset.judge);
        });
      });

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

    // リセット：すべての回答を隠して判定もクリア
    resetBtn.addEventListener("click", () => {
      container.querySelectorAll(".member-card").forEach((card) => {
        card.classList.remove("is-active", "is-correct", "is-wrong");
        card.removeAttribute("data-judge");
        card.querySelector(".toggle-badge").textContent = "オープン";
        card.querySelector(".judge-stamp").textContent = "";
      });
      clearOverlay.classList.remove("is-open");
      renderScore();
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

  /**
   * カードを開いて回答を表示する
   */
  function openCard(card) {
    if (card.classList.contains("is-active")) return;
    card.classList.add("is-active");
    card.querySelector(".toggle-badge").textContent = "判定待ち";
  }

  /**
   * ○×判定をカードに反映し、スコアボードを更新する
   */
  function setJudge(card, judge) {
    card.classList.remove("is-correct", "is-wrong");
    // 再判定できるように、同じ判定を押し直したら解除
    if (card.dataset.judge === judge) {
      card.removeAttribute("data-judge");
      card.querySelector(".toggle-badge").textContent = "判定待ち";
      card.querySelector(".judge-stamp").textContent = "";
      renderScore();
      return;
    }

    card.dataset.judge = judge;
    // アニメーションを毎回再生するため、リフローを挟んでからクラス付与
    void card.offsetWidth;
    card.classList.add(judge === "correct" ? "is-correct" : "is-wrong");
    card.querySelector(".toggle-badge").textContent = judge === "correct" ? "正解" : "BOMB!";
    card.querySelector(".judge-stamp").textContent = judge === "correct" ? "○" : "×";
    renderScore();
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

    if (cards.length > 0 && correctCount === cards.length) {
      clearOverlay.classList.add("is-open");
    }
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
