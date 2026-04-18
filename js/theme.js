/**
 * theme.js
 * ユーザーの推しキャラ設定とダークモードを同期・適用する
 */

// プロジェクトの使用バージョン 12.11.0 に統一
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

/**
 * カラー変数をDOMに直接注入する
 */
function injectColorVariables(main, sub) {
  const root = document.documentElement;
  if (main && sub) {
    root.style.setProperty("--chara-main", main);
    root.style.setProperty("--chara-sub", sub);
    root.classList.add("p-theme--custom");
  }
}

/**
 * 推しキャラのテーマを適用する
 */
export async function applyCharaTheme(oshiName) {
  const root = document.documentElement;
  try {
    if (!oshiName || oshiName === "なし") {
      root.style.removeProperty("--chara-main");
      root.style.removeProperty("--chara-sub");
      localStorage.removeItem("user_oshi_colors");
      localStorage.removeItem("user_oshi");
      return;
    }

    const response = await fetch("./data/characters.json");
    if (!response.ok) return;

    const charaMaster = await response.json();
    const config = charaMaster[oshiName];

    if (config && config.main && config.sub) {
      injectColorVariables(config.main, config.sub);

      // 次回ページ遷移時の高速反映用キャッシュ
      const colorCache = JSON.stringify({ main: config.main, sub: config.sub });
      localStorage.setItem("user_oshi_colors", colorCache);
      localStorage.setItem("user_oshi", oshiName);

      console.log(`[Theme] Colors applied for: ${oshiName}`);
    }
  } catch (error) {
    console.error("[Theme] Apply Error:", error);
  } finally {
    root.setAttribute("data-theme-loaded", "true");
  }
}

/**
 * 初期化処理
 * @param {string|null} userNumericId - 認証後に得られる数字ID
 */
export async function initTheme(userNumericId = null) {
  const htmlEl = document.documentElement;

  // 1. ダークモード適用（即時）
  const savedDarkMode = localStorage.getItem("theme") || "light";
  htmlEl.setAttribute("data-theme", savedDarkMode);

  // 2. ログインページ以外でのテーマ適用
  if (window.location.pathname.includes("login.html")) {
    htmlEl.setAttribute("data-theme-loaded", "true");
    return;
  }

  // A. 高速化：localStorageから即座に適用
  const cachedColors = localStorage.getItem("user_oshi_colors");
  if (cachedColors) {
    try {
      const { main, sub } = JSON.parse(cachedColors);
      injectColorVariables(main, sub);
      htmlEl.setAttribute("data-theme-loaded", "true");
    } catch (e) {
      localStorage.removeItem("user_oshi_colors");
    }
  }

  // B. 最新同期：Firebaseから取得
  const currentOshiName = localStorage.getItem("user_oshi");

  if (userNumericId) {
    try {
      const db = getDatabase();
      const snap = await get(ref(db, `users/${userNumericId}/settings/favoriteCharacter`));
      if (snap.exists()) {
        const latestOshi = snap.val();
        if (latestOshi !== currentOshiName) {
          await applyCharaTheme(latestOshi);
        }
      }
    } catch (e) {
      console.warn("[Theme] Firebase sync failed.");
    }
  } else if (currentOshiName && !cachedColors) {
    await applyCharaTheme(currentOshiName);
  }

  // 最終防衛線：何らかの理由で loaded が付かなかった場合
  if (htmlEl.getAttribute("data-theme-loaded") !== "true") {
    htmlEl.setAttribute("data-theme-loaded", "true");
  }

  setupDarkModeToggle();
}

function setupDarkModeToggle() {
  const btn = document.getElementById("js-dark-mode-toggle");
  if (!btn || btn.dataset.themeBound) return;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const html = document.documentElement;
    const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });
  btn.dataset.themeBound = "true";
}
