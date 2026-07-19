document.addEventListener("DOMContentLoaded", () => {
  // DOM要素の取得
  const loginContainer = document.getElementById("login-container");
  const adminContent = document.getElementById("admin-content");
  const loginForm = document.getElementById("login-form");
  const usernameInput = document.getElementById("username-input");
  const passwordInput = document.getElementById("password-input");
  const errorMessage = document.getElementById("error-message");
  const logoutBtn = document.getElementById("logout-btn");

  // 管理画面の入力項目と保存ボタンのDOM取得
  const canvas = document.getElementById("drawing-canvas");
  const ctx = canvas.getContext("2d");
  const textInput = document.getElementById("admin-text-input");
  const saveBtn = document.getElementById("save-submit-btn");
  const clearBtn = document.getElementById("clear-btn");

  // 🎨 追加：カラー選択エリアのDOM取得
  const colorPicker = document.getElementById("color-picker");
  const colorButtons = document.querySelectorAll(".color-btn");

  // ブラウザのLocalStorageに保存するトークンのキー名
  const AUTH_KEY = "umasaba_admin_session_token";

  let isDrawing = false;

  // 線のスタイル初期設定
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

      const loggedInUser = token.replace("auth_token_for_", "");

      // ログインに成功したら、そのユーザーが前回保存したデータを自動で読み込んで復元する
      await loadCurrentUserData(loggedInUser);
    } else {
      adminContent.classList.add("hidden");
      loginContainer.classList.remove("hidden");
    }
  }

  /**
   * ログイン中のユーザーの既存データをFirebaseから取得して画面に復元する関数
   */
  async function loadCurrentUserData(username) {
    try {
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
            ctx.drawImage(img, 0, 0);
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
        await checkAuth();
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

    const currentUsername = token.replace("auth_token_for_", "");

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
    textInput.value = "";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    resetColorToDefault(); // 🎨 色の設定もデフォルトに戻す
    checkAuth();
  });

  // ==========================================================================
  // 🎨 カラー変更ロジック
  // ==========================================================================
  // パレットボタンをクリックした時
  colorButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      colorButtons.forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");

      const selectedColor = e.target.getAttribute("data-color");
      ctx.strokeStyle = selectedColor;
      if (colorPicker) colorPicker.value = selectedColor;
    });
  });

  // 自由選択カラーピッカーを変更した時
  if (colorPicker) {
    colorPicker.addEventListener("input", (e) => {
      ctx.strokeStyle = e.target.value;
      colorButtons.forEach((b) => b.classList.remove("active"));
    });
  }

  // カラー設定をデフォルトの黒に戻す共通関数
  function resetColorToDefault() {
    ctx.strokeStyle = "#000000";
    if (colorPicker) colorPicker.value = "#000000";
    colorButtons.forEach((b) => b.classList.remove("active"));
    const defaultBtn = document.querySelector('.color-btn[data-color="#000000"]');
    if (defaultBtn) defaultBtn.classList.add("active");
  }

  // ==========================================================================
  // ✍️ お絵描きロジック
  // ==========================================================================
  function startDrawing(e) {
    // 手書きを始めたら、テキストエリアを空っぽにして入力不能（disabled）にする
    textInput.value = "";
    textInput.disabled = true;
    textInput.style.opacity = "0.5";

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

  // ==========================================================================
  // 💡 排他制御・クリアボタン連動
  // ==========================================================================

  // 1. テキストエリアに入力があった時の処理
  textInput.addEventListener("input", () => {
    if (textInput.value.trim() !== "") {
      // テキストに文字があるなら、Canvasを全消去して「半透明＆操作不能」にする
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.pointerEvents = "none";
      canvas.style.opacity = "0.3";
      clearBtn.disabled = true;

      // 🎨 カラーパレットも操作不能にする
      if (colorPicker) colorPicker.disabled = true;
      colorButtons.forEach((b) => (b.disabled = true));
    } else {
      // テキストが空っぽになったら、Canvasのロックを解除
      canvas.style.pointerEvents = "auto";
      canvas.style.opacity = "1.0";
      clearBtn.disabled = false;

      // 🎨 カラーパレットのロックを解除
      if (colorPicker) colorPicker.disabled = false;
      colorButtons.forEach((b) => (b.disabled = false));
    }
  });

  // 2. 消去ボタン（clearBtn）が押された時の処理
  clearBtn.addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Canvasを全消去したら、テキストエリアのロックを解除して元に戻す
    textInput.disabled = false;
    textInput.style.opacity = "1.0";

    // 🎨 消去時はカラー設定もデフォルト（黒）に戻す
    resetColorToDefault();
  });
});
