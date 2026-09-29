/**
 * 🎤 シックスボンバー ゲームマスターページ
 * お題の登録と、各チームの回答の○×判定。どちらもボードへ即時反映される。
 */
import { watchGame, saveQuestion, saveJudge, clearJudges } from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginContainer = document.getElementById("login-container");
  const gmContent = document.getElementById("gm-content");
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username-input");
  const passwordInput = document.getElementById("password-input");
  const errorMessage = document.getElementById("error-message");
  const logoutBtn = document.getElementById("logout-btn");

  const questionInput = document.getElementById("question-input");
  const questionSaveBtn = document.getElementById("question-save-btn");
  const questionLive = document.getElementById("question-live");
  const answerList = document.getElementById("answer-list");
  const refreshBtn = document.getElementById("refresh-btn");
  const clearJudgesBtn = document.getElementById("clear-judges-btn");
  const scoreCorrect = document.getElementById("score-correct");
  const scoreTotal = document.getElementById("score-total");

  const AUTH_KEY = "umasaba_sixbomber_gm_token";
  // ゲームマスターとしてログインできるユーザー名（draft_member に登録しておく）
  const GM_USERNAMES = ["gm"];
  const API_URL = "/api/get-members?board=sixbomber";

  let judges = {};
  let isStarted = false;

  checkAuth();

  /**
   * 認証状態をチェックし、表示を切り替える
   */
  function checkAuth() {
    let token = null;
    try {
      token = localStorage.getItem(AUTH_KEY);
    } catch (e) {}

    const username = token && token.startsWith("auth_token_for_") ? token.replace("auth_token_for_", "") : null;

    if (username && GM_USERNAMES.includes(username)) {
      loginContainer.classList.add("hidden");
      gmContent.classList.remove("hidden");
      start();
    } else {
      gmContent.classList.add("hidden");
      loginContainer.classList.remove("hidden");
    }
  }

  // ログイン
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMessage.textContent = "";

    const username = usernameInput.value.trim();
    if (!GM_USERNAMES.includes(username)) {
      errorMessage.textContent = "ゲームマスター用のアカウントではありません。";
      return;
    }

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: passwordInput.value }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem(AUTH_KEY, data.token);
        passwordInput.value = "";
        checkAuth();
      } else {
        errorMessage.textContent = data.error || "ログインに失敗しました。";
      }
    } catch (error) {
      console.error("Auth Error:", error);
      errorMessage.textContent = "通信エラーが発生しました。";
    }
  });

  // ログアウト
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(AUTH_KEY);
    location.reload();
  });

  /**
   * ログイン後の初期化（回答の取得とゲーム状態の監視）
   */
  async function start() {
    if (isStarted) return;
    isStarted = true;

    await loadAnswers();

    watchGame((game) => {
      questionLive.textContent = game.question || "（未登録）";
      // 入力中のお題を上書きしないよう、空欄のときだけ現在のお題を入れておく
      if (!questionInput.value) questionInput.value = game.question;
      judges = game.judges;
      renderJudges();
    }).catch((error) => {
      console.error("Watch Game Error:", error);
      alert("ゲーム状態の取得に失敗しました。");
    });
  }

  /**
   * 各チームの回答を取得して一覧を描画
   */
  async function loadAnswers() {
    try {
      const response = await fetch(API_URL);
      const result = await response.json();
      if (!result.success) return;

      answerList.innerHTML = "";
      result.data.forEach((member, index) => {
        const item = document.createElement("li");
        item.className = "answer-item";
        item.dataset.username = member.username;

        item.innerHTML = `
          <div class="answer-item__team">
            <span class="answer-item__no">${index + 1}</span>
            <span class="answer-item__name"></span>
          </div>
          <div class="answer-item__answer"></div>
          <div class="answer-item__judge">
            <button type="button" class="judge-btn judge-btn--correct" data-judge="correct" title="正解">
              <span class="material-symbols-outlined">circle</span>
            </button>
            <button type="button" class="judge-btn judge-btn--wrong" data-judge="wrong" title="不正解">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        `;
        item.querySelector(".answer-item__name").textContent = member.name || member.username;

        const answerElem = item.querySelector(".answer-item__answer");
        if (member.text && member.text.trim() !== "") {
          answerElem.textContent = member.text;
        } else if (member.image) {
          const img = document.createElement("img");
          img.src = member.image;
          img.alt = "手書き回答";
          answerElem.appendChild(img);
        } else {
          answerElem.textContent = "（未回答）";
          answerElem.classList.add("is-empty");
        }

        // ○×ボタン：押したら即保存。同じ判定をもう一度押すと取り消し
        item.querySelectorAll(".judge-btn").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const judge = btn.dataset.judge;
            const next = judges[member.username] === judge ? null : judge;
            try {
              await saveJudge(member.username, next);
            } catch (error) {
              console.error("Save Judge Error:", error);
              alert("判定の保存に失敗しました。");
            }
          });
        });

        answerList.appendChild(item);
      });

      scoreTotal.textContent = result.data.length;
      renderJudges();
    } catch (error) {
      console.error("Fetch Members Error:", error);
    }
  }

  /**
   * 判定状態をボタンとスコアに反映
   */
  function renderJudges() {
    const items = answerList.querySelectorAll(".answer-item");
    items.forEach((item) => {
      const judge = judges[item.dataset.username];
      item.dataset.judge = judge || "";
      item.querySelectorAll(".judge-btn").forEach((btn) => {
        btn.classList.toggle("is-selected", btn.dataset.judge === judge);
      });
    });
    scoreCorrect.textContent = Object.values(judges).filter((judge) => judge === "correct").length;
  }

  // お題を反映
  questionSaveBtn.addEventListener("click", async () => {
    questionSaveBtn.disabled = true;
    try {
      await saveQuestion(questionInput.value.trim());
    } catch (error) {
      console.error("Save Question Error:", error);
      alert("お題の保存に失敗しました。");
    } finally {
      questionSaveBtn.disabled = false;
    }
  });

  // 回答を再取得
  refreshBtn.addEventListener("click", async () => {
    refreshBtn.disabled = true;
    await loadAnswers();
    refreshBtn.disabled = false;
  });

  // 判定をすべてリセット
  clearJudgesBtn.addEventListener("click", async () => {
    if (!confirm("すべての判定をリセットしますか？")) return;
    try {
      await clearJudges();
    } catch (error) {
      console.error("Clear Judges Error:", error);
      alert("判定のリセットに失敗しました。");
    }
  });
});
