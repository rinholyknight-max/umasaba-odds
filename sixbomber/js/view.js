/**
 * 👀 シックスボンバー 観戦用ボード（閲覧専用）
 * 操作は一切なし。お題と○×判定をゲームマスターページからリアルタイムで反映し、
 * 判定が付いたカードだけ回答を表示する（判定前の回答はDOMにも入れない）。
 */
import { watchGame } from "./firebase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("members-container");
  const questionText = document.getElementById("question-text");
  const scoreSlots = document.getElementById("score-slots");
  const scoreCorrect = document.getElementById("score-correct");
  const scoreTotal = document.getElementById("score-total");
  const clearOverlay = document.getElementById("clear-overlay");
  const clearCloseBtn = document.getElementById("clear-close-btn");

  const API_URL = "/api/get-members?board=sixbomber";

  // 最新の監視コールバックの番号（回答取得中に判定が変わったら古い結果は捨てる）
  let watchSeq = 0;

  try {
    const response = await fetch(API_URL);
    const result = await response.json();
    if (!result.success) return;

    result.data.forEach((member, index) => {
      const card = document.createElement("div");
      card.className = "member-card is-readonly";
      card.setAttribute("data-username", member.username);

      card.innerHTML = `
      <div class="member-header">
        <h3><span class="member-no">${index + 1}</span></h3>
        <span class="toggle-badge">判定待ち</span>
      </div>
      <div class="member-content">
        <p class="memo-text"></p>
        <div class="canvas-img-wrap">
          <img src="" alt="手書き回答" />
        </div>
      </div>
      <div class="judge-stamp"></div>
    `;
      card.querySelector("h3").append(createName(member.name || member.username));

      container.appendChild(card);
    });

    scoreTotal.textContent = result.data.length;
    renderScore();
  } catch (error) {
    console.error("Fetch Members Error:", error);
  }

  clearCloseBtn.addEventListener("click", () => {
    clearOverlay.classList.remove("is-open");
  });

  // 🔥 お題・判定をリアルタイムで反映
  watchGame(async ({ question, judges }) => {
    questionText.textContent = question || "お題の登録を待っています";
    questionText.classList.toggle("is-empty", !question);

    // 表示中の判定と比べて変化したカードだけ演出する
    const seq = ++watchSeq;
    const changedCards = Array.from(container.querySelectorAll(".member-card")).filter(
      (card) => (judges[card.dataset.username] || undefined) !== card.dataset.judge,
    );
    if (changedCards.length === 0) return;

    // 新たに判定が付いたカードがあれば、その時点の最新回答を取得してから表示する
    const answers = changedCards.some((card) => judges[card.dataset.username]) ? await fetchAnswers() : {};
    if (seq !== watchSeq) return;

    changedCards.forEach((card) => {
      const username = card.dataset.username;
      setJudge(card, judges[username] || null, answers[username]);
    });
    renderScore();
  }).catch((error) => console.error("Watch Game Error:", error));

  /**
   * チーム名の要素を作る（名前内の <br> だけ改行にし、それ以外はテキストとして扱う）
   */
  function createName(name) {
    const span = document.createElement("span");
    span.className = "member-name";
    String(name)
      .split(/<br\s*\/?>/i)
      .forEach((line, i) => {
        if (i > 0) span.append(document.createElement("br"));
        span.append(line);
      });
    return span;
  }

  /**
   * 全メンバーの最新回答を username をキーにして取得
   */
  async function fetchAnswers() {
    try {
      const res = await fetch(API_URL);
      const result = await res.json();
      if (!result.success) return {};
      return Object.fromEntries(result.data.map((member) => [member.username, member]));
    } catch (err) {
      console.error("Fetch Answers Error:", err);
      return {};
    }
  }

  /**
   * ○×判定をカードに反映（判定が付いたら回答を表示、取り消されたら伏せ直す）
   */
  function setJudge(card, judge, member) {
    card.classList.remove("is-active", "is-correct", "is-wrong");

    if (!judge) {
      card.removeAttribute("data-judge");
      card.querySelector(".judge-stamp").textContent = "";
      applyExclusiveContent(card, "", "");
      updateBadge(card);
      return;
    }

    if (member) applyExclusiveContent(card, member.text, member.image, "（未回答）");
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
    if (card.dataset.judge === "correct") badge.textContent = "正解";
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
  function applyExclusiveContent(card, text, image, emptyLabel = "") {
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
      // 両方空の時は emptyLabel（伏せる時は空、判定済みなら「未回答」）
      textElem.textContent = emptyLabel;
      textElem.style.display = "";
      imgWrap.style.display = "none";
      imgElem.src = "";
    }
  }
});
