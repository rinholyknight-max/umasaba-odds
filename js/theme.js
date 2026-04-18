/**
 * theme.js
 */
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.x/firebase-database.js";

/**
 * カラー変数をDOMに直接注入する（同期処理）
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
      localStorage.removeItem("user_oshi_colors"); // 色キャッシュも消す
      return;
    }

    // 1. JSONを取得（マスタデータ）
    const response = await fetch("./data/characters.json");
    if (!response.ok) return;

    const charaMaster = await response.json();
    const config = charaMaster[oshiName];

    if (config && config.main && config.sub) {
      // 変数注入
      injectColorVariables(config.main, config.sub);

      // 【重要】次回ページ遷移時にfetchを待たずに済むよう、色自体を保存しておく
      const colorCache = JSON.stringify({ main: config.main, sub: config.sub });
      localStorage.setItem("user_oshi_colors", colorCache);
      localStorage.setItem("user_oshi", oshiName);
    }
  } catch (error) {
    console.error("[Theme] Apply Error:", error);
  } finally {
    // 色のセット（または失敗）が確定したら表示
    root.setAttribute("data-theme-loaded", "true");
  }
}

/**
 * 初期化処理
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

  // --- 高速化ロジック：fetchを待たずにLocalStorageの色を即座に当てる ---
  const cachedColors = localStorage.getItem("user_oshi_colors");
  if (cachedColors) {
    const { main, sub } = JSON.parse(cachedColors);
    injectColorVariables(main, sub);
    // 色を当てたらすぐに表示許可（fetchを待たない）
    htmlEl.setAttribute("data-theme-loaded", "true");
  }
  // -----------------------------------------------------------

  // 3. 最新情報の同期（Firebase or LocalStorage名）
  // DBに繋がるまではキャッシュで表示を維持し、DB確定後に必要なら再描画する
  const currentOshiName = localStorage.getItem("user_oshi");

  if (userNumericId) {
    // Firebaseから最新の推しを取得して同期
    try {
      const db = getDatabase();
      const snap = await get(ref(db, `users/${userNumericId}/settings/favoriteCharacter`));
      if (snap.exists() && snap.val() !== currentOshiName) {
        await applyCharaTheme(snap.val()); // 変更があれば再適用
      }
    } catch (e) {
      console.warn("[Theme] Sync failed");
    }
  } else if (currentOshiName && !cachedColors) {
    // IDはないが名前の記録だけある場合（初回など）
    await applyCharaTheme(currentOshiName);
  } else if (!cachedColors) {
    // 何も設定がない場合
    htmlEl.setAttribute("data-theme-loaded", "true");
  }

  // 4. トグル設定
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
