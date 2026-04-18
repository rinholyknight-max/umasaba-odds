/**
 * theme.js
 * ユーザーの推しキャラ設定とダークモードを同期・適用する
 */

/**
 * 推しキャラのテーマ（CSS変数）を適用する
 * @param {string} oshiName - キャラクター名（マスターデータのキー）
 */
export async function applyCharaTheme(oshiName) {
  const root = document.documentElement;

  try {
    // 「なし」または未設定の場合はデフォルト値をセットして終了
    if (!oshiName || oshiName === "なし") {
      root.style.removeProperty("--chara-main");
      root.style.removeProperty("--chara-sub");
      return;
    }

    const response = await fetch("./data/characters.json");
    if (!response.ok) throw new Error("Character master not found");

    const charaMaster = await response.json();
    const config = charaMaster[oshiName];

    if (config && config.main && config.sub) {
      // プロジェクト接頭辞を意識した命名ではないが、既存の変数名を維持
      // BEM設計に合わせるなら .p-theme--[name] クラスの付与が望ましいが、
      // 柔軟な色変更のためにCSS変数を採用
      root.style.setProperty("--chara-main", config.main);
      root.style.setProperty("--chara-sub", config.sub);

      // BEM用のクラスも付与（CSS側での微調整用）
      // 既存の p-theme-- クラスをクリアしてから付与
      const currentClasses = Array.from(root.classList);
      currentClasses.forEach((c) => {
        if (c.startsWith("p-theme--")) root.classList.remove(c);
      });
      root.classList.add(`p-theme--custom`);

      console.log(`[Theme] Colors applied for: ${oshiName}`);
    }
  } catch (error) {
    console.error("[Theme] Theme Apply Error:", error);
  } finally {
    // 色の準備ができたら、フェードインを許可（CSS側で[data-theme-loaded="true"]時に表示制御）
    root.setAttribute("data-theme-loaded", "true");
  }
}

/**
 * 初期化処理
 */
export async function initTheme() {
  console.log("--- theme.js initialized ---");
  const htmlEl = document.documentElement;

  // 1. ダークモード設定（LocalStorage優先）
  const savedDarkMode = localStorage.getItem("theme") || "light";
  htmlEl.setAttribute("data-theme", savedDarkMode);

  // 2. 推しテーマの適用
  const isLoginPage = window.location.pathname.includes("login.html");

  if (!isLoginPage) {
    // 【改善】SessionStorageを優先し、なければLocalを参照
    // ログイン直後はSessionStorageに最新が入る仕様に準拠
    const savedOshi = sessionStorage.getItem("user_oshi") || localStorage.getItem("user_oshi");

    // 適用が終わるまで待機
    await applyCharaTheme(savedOshi);
  } else {
    // ログインページは即時表示
    htmlEl.setAttribute("data-theme-loaded", "true");
  }

  // 3. ダークモード切り替えボタンの設定（js- 接頭辞を使用）
  const setupToggle = () => {
    const toggleBtn = document.getElementById("js-dark-mode-toggle");
    if (!toggleBtn) return false;

    // 二重イベント登録防止
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

  // DOM構築タイミングによりボタンがない場合があるためリトライ
  if (!setupToggle()) {
    const retryInterval = setInterval(() => {
      if (setupToggle()) clearInterval(retryInterval);
    }, 100);
    setTimeout(() => clearInterval(retryInterval), 3000);
  }
}
