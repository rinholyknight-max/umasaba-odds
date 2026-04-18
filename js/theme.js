export async function initTheme() {
  // ★ async を追加
  console.log("--- theme.js initialized ---");
  const htmlEl = document.documentElement;

  // 1. ダークモード設定
  const savedTheme = localStorage.getItem("theme") || "light";
  htmlEl.setAttribute("data-theme", savedTheme);

  // 2. ログインページ以外なら推しテーマを適用
  const isLoginPage = window.location.pathname.includes("login.html");
  if (!isLoginPage) {
    // sessionStorage か localStorage から取得（最新は sessionStorage にあるはず）
    const savedOshi = sessionStorage.getItem("user_oshi") || localStorage.getItem("user_oshi");

    // ★ await をつけて、色の適用が終わるまで待つ
    await applyCharaTheme(savedOshi);
  } else {
    htmlEl.setAttribute("data-theme-loaded", "true");
  }

  // 3. ダークモード切り替えボタンの設定（ここは非同期を待つ必要なし）
  const setupToggle = () => {
    const toggleBtn = document.getElementById("js-dark-mode-toggle");
    if (!toggleBtn) return false;
    if (toggleBtn.dataset.themeBound) return true;

    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const current = htmlEl.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      htmlEl.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });

    toggleBtn.dataset.themeBound = "true";
    return true;
  };

  if (!setupToggle()) {
    const retryInterval = setInterval(() => {
      if (setupToggle()) clearInterval(retryInterval);
    }, 100);
    setTimeout(() => clearInterval(retryInterval), 3000);
  }
}

/**
 * 推しキャラのテーマを適用する
 */
export async function applyCharaTheme(oshiName) {
  try {
    if (oshiName && oshiName !== "なし") {
      const response = await fetch("./data/characters.json");
      if (response.ok) {
        const charaMaster = await response.json();
        const config = charaMaster[oshiName];

        if (config && config.main && config.sub) {
          const root = document.documentElement;
          root.style.setProperty("--chara-main", config.main);
          root.style.setProperty("--chara-sub", config.sub);
          console.log(`Theme colors applied for: ${oshiName}`);
        }
      }
    }
  } catch (error) {
    console.error("Theme Apply Error:", error);
  } finally {
    // ★ 色の準備ができたら、フェードインを許可する
    document.documentElement.setAttribute("data-theme-loaded", "true");
  }
}
