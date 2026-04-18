/**
 * main.js
 * アプリケーションのメインエントリーポイント
 */
import { checkAuth } from "./auth.js";
import { initTheme } from "./theme.js";

// ページ読み込み時の初期化処理
async function init() {
  console.log("--- main.js initialized ---");

  try {
    // 1. 認証チェックを最初に行う
    // authInfo = { uid, role, userNumericId }
    const authInfo = await checkAuth();

    // 2. テーマの初期化
    // userNumericId を渡すことで、Firebase DBからの最新設定取得を可能にする
    // 内部で localStorage (高速) -> Firebase DB (正確) の順に適用されます
    if (authInfo && authInfo.userNumericId) {
      await initTheme(authInfo.userNumericId);
    } else {
      // 未ログイン状態（ゲストなど）でもテーマ初期化自体は呼ぶ（ダークモード適用のため）
      await initTheme(null);
    }

    // 3. ページ固有の初期化が必要な場合はここに追加
    // (例: initHome(), initRaceList() など)
  } catch (error) {
    console.error("[Main] Initialization Error:", error);
    // 万が一エラーが起きても、画面が表示されない（opacity:0）事態を防ぐ
    document.documentElement.setAttribute("data-theme-loaded", "true");
  }
}

// 実行
init();
