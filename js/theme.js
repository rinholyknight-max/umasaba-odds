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
  const titleEl = document.querySelector(".p-voting__title"); // タイトル要素
  const originalTitle = "現在のオッズ状況"; // または元のタイトルを取得するロジック

  try {
    if (!oshiName || oshiName === "なし" || oshiName === "") {
      root.style.removeProperty("--chara-main");
      root.style.removeProperty("--chara-sub");
      root.classList.remove("p-theme--custom"); // ★追加：クラスも外す
      localStorage.removeItem("user_oshi_colors");
      localStorage.removeItem("user_oshi");
      if (titleEl) titleEl.textContent = originalTitle; // 元に戻す
      return;
    }

    const response = await fetch("./data/characters.json");
    if (!response.ok) return;

    const charaMaster = await response.json();
    const config = charaMaster[oshiName];

    if (config && config.main && config.sub) {
      injectColorVariables(config.main, config.sub);

      // --- 🌸 たづなさん隠し演出：モーダル版 ---
      if (oshiName === "駿川たづな") {
        const modal = document.getElementById("js-modal");
        const modalTitle = document.getElementById("js-modal-title");
        const modalBody = document.getElementById("js-modal-comment-list");

        if (modal && modalTitle && modalBody) {
          // 1. モーダルの内容を書き換える
          modalTitle.innerHTML = '<span style="color: #ff3750;">⚠️ 業務連絡</span>';
          modalBody.innerHTML = `
      <div style="line-height: 1.8; color: #333;">
        <p>お疲れ様です、駿川です。</p>
        <p>……あの、何か勘違いをされていませんか？<br>
        私はあくまで『理事長秘書』であって、レースに出走する立場ではありません。</p>
        <p style="color: #d32f2f; font-weight: bold; font-size: 1.2rem; text-align: center; margin: 15px 0;">
          「私はウマ娘ではありません」
        </p>
        <p>速やかに他の候補者を選択し、適切なトレーニングプランを再構成してください。期待していますよ？</p>
      </div>
    `;

          // 2. モーダルを表示させる（既存のCSSクラスに合わせて調整）
          modal.classList.add("is-active"); // または display = "block" など、既存の仕様に合わせて
          // modal.style.display = "flex"; // クラス制御でない場合はこちら
        }
      }

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
      // ★修正箇所1：参照パスを実際のDB構造に合わせて users/ID/favoriteChara に変更
      const snap = await get(ref(db, `users/${userNumericId}/favoriteChara`));

      if (snap.exists()) {
        const latestOshi = snap.val();
        // ★修正箇所2：DBにデータがあれば、キャッシュと違わなくても強制適用して整合性を保つ
        // (アカウント切り替え直後はキャッシュが消えているため、ここを通る必要がある)
        if (latestOshi !== currentOshiName) {
          await applyCharaTheme(latestOshi);
        }
      } else {
        // ★追加：DBにデータがない（または「なし」）ならテーマを解除
        if (currentOshiName) {
          await applyCharaTheme("なし");
        }
      }
    } catch (e) {
      console.warn("[Theme] Firebase sync failed.", e);
    }
  } else if (currentOshiName && !cachedColors) {
    await applyCharaTheme(currentOshiName);
  }

  // 最終防衛線
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
