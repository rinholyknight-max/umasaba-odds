export function initTheme() {
  console.log("--- theme.js initialized ---");

  const htmlEl = document.documentElement;

  // 1. ダークモードの設定
  const savedTheme = localStorage.getItem("theme") || "light";
  htmlEl.setAttribute("data-theme", savedTheme);
  console.log("Current data-theme:", savedTheme);

  // --- 【追加】2. 保存された推しキャラテーマの反映 ---
  const savedOshi = sessionStorage.getItem("user_oshi");
  if (savedOshi) {
    console.log("Applying saved oshi theme:", savedOshi);
    applyCharaTheme(savedOshi);
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
