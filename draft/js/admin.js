document.addEventListener("DOMContentLoaded", () => {
  // DOM要素の取得
  const loginContainer = document.getElementById("login-container");
  const adminContent = document.getElementById("admin-content");
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username-input");
  const passwordInput = document.getElementById("password-input");
  const errorMessage = document.getElementById("error-message");
  const logoutBtn = document.getElementById("logout-btn");

  // 📝 追加：管理画面の入力項目と保存ボタンのDOM取得
  const canvas = document.getElementById("drawing-canvas");
  const ctx = canvas.getContext("2d");
  const textInput = document.getElementById("admin-text-input"); // HTML側のtextareaのidに合わせてね
  const saveBtn = document.getElementById("save-submit-btn"); // HTML側の保存ボタンのidに合わせてね
  const clearBtn = document.getElementById("clear-btn");

  // ブラウザのLocalStorageに保存するトークンのキー名
  const AUTH_KEY = "umasaba_admin_session_token";

  let isDrawing = false;

  // 線のスタイル設定
  ctx.strokeStyle = "#000000"; // 黒色
  ctx.lineWidth = 3; // 線の太さ
  ctx.lineCap = "round"; // 線の角を丸く

  // 1. ページ読み込み時に即座に認証状態をチェック
  checkAuth();

  /**
   * 認証状態をチェックし、表示を切り替える関数
   */
  async function checkAuth() {
    const token = localStorage.getItem(AUTH_KEY);

    if (token && token.startsWith("auth_token_for_")) {
      loginContainer.classList.add("hidden");
      adminContent.classList.remove("hidden");

      // 💡 トークンからログイン中のユーザー名（team01など）を抽出
      const loggedInUser = token.replace("auth_token_for_", "");

      // 💡 ログインに成功したら、そのユーザーが前回保存したデータを自動で読み込んで復元する
      await loadCurrentUserData(loggedInUser);
    } else {
      adminContent.classList.add("hidden");
      loginContainer.classList.remove("hidden");
    }
  }

  /**
   * 💡 ログイン中のユーザーの既存データをFirebaseから取得して画面に復元する関数
   */
  async function loadCurrentUserData(username) {
    try {
      // ユーザー個別のデータを取得するAPIを叩く（後ほど作成）
      const response = await fetch(`/api/get-user-data?username=${username}`);
      const result = await response.json();

      if (result.success && result.data) {
        // テキストエリアに復元
        if (result.data.text) textInput.value = result.data.text;

        // Canvasにお絵描きを復元
        if (result.data.image) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0); // 保存されていた画像をCanvasに描き直す
          };
          img.src = result.data.image;
        }
      }
    } catch (error) {
      console.error("ユーザーデータの読み込み失敗:", error);
    }
  }

  // 2. ログインフォームの送信イベント
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorMessage.textContent = "";

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem(AUTH_KEY, data.token);
        await checkAuth(); // ここで自動データ復元も走るよ
        passwordInput.value = "";
      } else {
        errorMessage.textContent = data.error || "ログインに失敗しました。";
      }
    } catch (error) {
      console.error("Auth Error:", error);
      errorMessage.textContent = "通信エラーが発生しました。";
    }
  });

  // 3. データの保存・送信処理
  saveBtn.addEventListener("click", async () => {
    const token = localStorage.getItem(AUTH_KEY);
    if (!token) return alert("セッションが切れています。再ログインしてください。");

    // トークンから現在のユーザー名を動的に取得（これでteam01〜06に自動対応！）
    const currentUsername = token.replace("auth_token_for_", "");

    // Canvasの内容を「Base64文字列」に変換
    const drawingDataUrl = canvas.toDataURL("image/png");
    const textValue = textInput.value;

    const dataToSend = {
      username: currentUsername,
      text: textValue,
      image: drawingDataUrl,
    };

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "保存中...";

      const response = await fetch("/api/save-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();
      if (result.success) {
        alert("無事に保存・更新されました！");
      } else {
        alert("保存に失敗しました: " + result.error);
      }
    } catch (error) {
      console.error("Save Error:", error);
      alert("通信エラーが発生しました。");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "この内容で保存する";
    }
  });

  // 4. ログアウト処理
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem(AUTH_KEY);
    usernameInput.value = "";
    passwordInput.value = "";
    textInput.value = ""; // テキスト入力欄もクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Canvasもクリア
    checkAuth();
  });

  // ==========================================================================
  // ✍️ お絵描きロジック（お引っ越ししてDOMContentLoadedの内部に安全に配置）
  // ==========================================================================
  function startDrawing(e) {
    isDrawing = true;
    draw(e);
  }

  function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
  }

  function draw(e) {
    if (!isDrawing) return;

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

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      startDrawing(e);
    },
    { passive: false },
  );
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      draw(e);
    },
    { passive: false },
  );
  canvas.addEventListener("touchend", stopDrawing);

  // 消去ボタンの挙動
  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
});
