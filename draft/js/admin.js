document.addEventListener("DOMContentLoaded", () => {
  // DOM要素の取得
  const loginContainer = document.getElementById("login-container");
  const adminContent = document.getElementById("admin-content");
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username-input");
  const passwordInput = document.getElementById("password-input");
  const errorMessage = document.getElementById("error-message");
  const logoutBtn = document.getElementById("logout-btn");

  // ブラウザのLocalStorageに保存するトークンのキー名
  const AUTH_KEY = "umasaba_admin_session_token";

  // 1. ページ読み込み時に即座に認証状態をチェック
  checkAuth();

  /**
   * 認証状態をチェックし、表示を切り替える関数
   */
  function checkAuth() {
    const token = localStorage.getItem(AUTH_KEY);

    // 簡易的に、特定のプレフィックスで始まるトークンがあれば認証済みと判定
    if (token && token.startsWith("auth_token_for_")) {
      loginContainer.classList.add("hidden");
      adminContent.classList.remove("hidden");
    } else {
      adminContent.classList.add("hidden");
      loginContainer.classList.remove("hidden");
    }
  }

  // 2. ログインフォームの送信イベント（非同期処理）
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMessage.textContent = ""; // 前のエラーをクリア

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    try {
      // Vercel Serverless Function (api/auth.js) へPOSTリクエストを送信
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 認証成功：返ってきたトークンをLocalStorageに保存
        localStorage.setItem(AUTH_KEY, data.token);
        // 画面の表示を更新
        checkAuth();
        // フォームをクリア
        passwordInput.value = "";
      } else {
        // 認証失敗：APIから返ってきたエラーメッセージを表示
        errorMessage.textContent = data.error || "ログインに失敗しました。";
      }
    } catch (error) {
      console.error("Auth Error:", error);
      errorMessage.textContent = "通信エラーが発生しました。サーバーの状態を確認してください。";
    }
  });

  // 3. ログアウト処理
  logoutBtn.addEventListener("click", () => {
    // トークンを破棄
    localStorage.removeItem(AUTH_KEY);
    // 入力欄を綺麗にする
    usernameInput.value = "";
    passwordInput.value = "";
    // 画面の表示を更新してログイン画面に戻す
    checkAuth();
  });
});

const canvas = document.getElementById("drawing-canvas");
const ctx = canvas.getContext("2d");
let isDrawing = false;

// 線のスタイル設定
ctx.strokeStyle = "#000000"; // 黒色
ctx.lineWidth = 3; // 線の太さ
ctx.lineCap = "round"; // 線の角を丸く

// 描画開始（マウス・タッチ共通）
function startDrawing(e) {
  isDrawing = true;
  draw(e);
}

// 描画終了
function stopDrawing() {
  isDrawing = false;
  ctx.beginPath(); // パスをリセット
}

// 描画中
function draw(e) {
  if (!isDrawing) return;

  // マウスとスマホのタッチ両方の座標に対応
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const x = clientX - rect.left;
  const y = clientY - rect.top;

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
}

// イベントリスナー登録（PC・スマホ対応）
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", draw);
window.addEventListener("mouseup", stopDrawing);

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startDrawing(e);
});
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  draw(e);
});
canvas.addEventListener("touchend", stopDrawing);

// 消去ボタンの挙動
document.getElementById("clear-btn").addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// 🎉 Canvasの内容を「data:image/png;base64,xxxx...」というテキストに変換！
const drawingDataUrl = canvas.toDataURL("image/png");

// あとはこの文字データを、いつものようにPOSTで送ってFirebaseに保存するだけ！
const dataToSend = {
  username: "team01",
  text: "今週の狙い目",
  image: drawingDataUrl, // 💡 これで手書きデータも一緒に保存完了！
};
