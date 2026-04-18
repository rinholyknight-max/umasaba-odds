export function initTheme() {
  console.log("--- theme.js initialized ---");

  const htmlEl = document.documentElement;

  // 1. 今いるページが login.html かどうかをチェック
  const isLoginPage = window.location.pathname.includes("login.html");

  // 2. ダークモードの設定（これは全ページ共通でOK）
  const savedTheme = localStorage.getItem("theme") || "light";
  htmlEl.setAttribute("data-theme", savedTheme);

  // 3. ログインページ以外の場合のみ、推しテーマの適用とフェードイン制御を行う
  if (!isLoginPage) {
    const savedOshi = sessionStorage.getItem("user_oshi");
    // applyCharaThemeの中で最終的に data-theme-loaded を付与する
    applyCharaTheme(savedOshi);
  } else {
    // ログインページの場合は、即座に表示させる
    htmlEl.setAttribute("data-theme-loaded", "true");
  }

  // 3. ボタンを探す処理を関数化
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

  // 実行
  if (!setupToggle()) {
    const retryInterval = setInterval(() => {
      if (setupToggle()) clearInterval(retryInterval);
    }, 100);
    setTimeout(() => clearInterval(retryInterval), 3000);
  }
}

// 推しキャラのテーマを適用する共通関数
export async function applyCharaTheme(oshiName) {
  // 最後に必ず実行されるように、try-catch-finally の形にするのが安全です
  try {
    if (oshiName) {
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
    // 推しがいてもいなくても、エラーが起きても、最後は必ず画面を表示させる
    document.documentElement.setAttribute("data-theme-loaded", "true");
  }
}
