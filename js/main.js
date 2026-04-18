import { applyCharaTheme } from "./theme.js";

// ページ読み込み時の初期化処理
async function init() {
  // セッションに保存されている「自分の推し」を取得
  const myOshi = sessionStorage.getItem("user_oshi");
  if (myOshi) {
    applyCharaTheme(myOshi);
  }
}
init();
