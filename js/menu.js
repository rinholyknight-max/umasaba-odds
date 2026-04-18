/**
 * ハンバーガーメニュー制御 (js/menu.js)
 */
export function initMenu() {
  const btn = document.getElementById("js-hamburger");
  const menu = document.getElementById("js-menu");
  const overlay = document.getElementById("js-overlay");

  if (!btn || !menu || !overlay) return;

  // --- ★追加：アイコンの表示更新 ---
  updateUserIconUI();

  const toggleMenu = () => {
    btn.classList.toggle("is-active");
    menu.classList.toggle("is-active");
    overlay.classList.toggle("is-active");
  };

  btn.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", toggleMenu);
}

/**
 * ★追加：アイコン画像をチェックして描画を切り替える関数
 */
function updateUserIconUI() {
  // メニュー内にあるアイコンを表示する全ての要素を取得
  // HTML側でアイコン部分に .js-user-icon-target などの共通クラスをつけておくと楽です
  const iconContainers = document.querySelectorAll(".l-menu__user-icon");

  // sessionStorage から画像のURLを取得
  const photoURL = sessionStorage.getItem("user_photo_url");

  iconContainers.forEach((container) => {
    if (photoURL && photoURL !== "null") {
      // 画像URLがある場合：imgタグを生成
      container.innerHTML = `<img src="${photoURL}" alt="User Icon" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
      // アイコンフォント用のスタイルをリセット（念のため）
      container.style.display = "flex";
      container.style.alignItems = "center";
      container.style.justifyContent = "center";
    } else {
      // 画像がない場合：元の Material Symbols を表示
      container.innerHTML = `<span class="material-symbols-outlined">account_circle</span>`;
    }
  });
}
