export function initTheme() {
  console.log("--- theme.js initialized ---"); // これがコンソールに出るか確認

  const htmlEl = document.documentElement;

  // 1. 保存されたテーマを即座に反映
  const savedTheme = localStorage.getItem("theme") || "light";
  htmlEl.setAttribute("data-theme", savedTheme);
  console.log("Current data-theme:", savedTheme);

  // 2. ボタンを探す処理を関数化（念のため）
  const setupToggle = () => {
    const toggleBtn = document.getElementById("js-dark-mode-toggle");

    if (!toggleBtn) {
      console.warn("Button 'js-dark-mode-toggle' not found yet. Retrying...");
      return false;
    }

    // すでにイベントが登録されている場合はスキップ（二重登録防止）
    if (toggleBtn.dataset.themeBound) return true;

    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const current = htmlEl.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";

      htmlEl.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      console.log("Theme switched to:", next);
    });

    toggleBtn.dataset.themeBound = "true";
    console.log("Event listener attached to button.");
    return true;
  };

  // 実行
  if (!setupToggle()) {
    // もしボタンが見つからなければ、少し待ってから再試行
    const retryInterval = setInterval(() => {
      if (setupToggle()) clearInterval(retryInterval);
    }, 100);
    // 3秒経ってもダメなら諦める
    setTimeout(() => clearInterval(retryInterval), 3000);
  }
}

// ★ 追加：推しキャラのテーマを適用する共通関数
export async function applyCharaTheme(oshiName) {
  if (!oshiName) return;

  try {
    // パスは index.html 等から見た位置にするか、絶対パスで指定
    const response = await fetch("./data/characters.json");
    if (!response.ok) return;

    const charaMaster = await response.json();
    const config = charaMaster[oshiName];

    if (config && config.main && config.sub) {
      const root = document.documentElement;
      root.style.setProperty("--chara-main", config.main);
      root.style.setProperty("--chara-sub", config.sub);
    }
  } catch (error) {
    console.error("Theme Apply Error:", error);
  }
}
