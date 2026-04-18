/**
 * ハンバーガーメニュー制御 (js/menu.js)
 */
export function initMenu() {
  const btn = document.getElementById("js-hamburger");
  const menu = document.getElementById("js-menu");
  const overlay = document.getElementById("js-overlay");

  if (!btn || !menu || !overlay) return;

  // --- UIの更新（アイコン画像とマイページリンク） ---
  updateUserMenuUI();

  const toggleMenu = () => {
    btn.classList.toggle("is-active");
    menu.classList.toggle("is-active");
    overlay.classList.toggle("is-active");
  };

  btn.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", toggleMenu);
}

/**
 * ユーザーメニューUIの統合更新関数
 */
function updateUserMenuUI() {
  // 1. アイコン画像の描画更新
  const iconContainers = document.querySelectorAll(".l-menu__user-icon");
  const photoURL = sessionStorage.getItem("user_photo_url");

  iconContainers.forEach((container) => {
    if (photoURL && photoURL !== "null") {
      container.innerHTML = `<img src="${photoURL}" alt="User Icon" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    } else {
      container.innerHTML = `<span class="material-symbols-outlined" style="font-size: 100px;">account_circle</span>`;
    }
  });

  // 2. マイページリンクの動的更新 ★ここを追加
  const userLink = document.querySelector(".l-menu__user-link");
  // ログイン時に保存したUIDを取得（localStorageかsessionStorageか、保存先に合わせる）
  const myUid = localStorage.getItem("user_uid") || sessionStorage.getItem("user_uid");

  if (userLink && myUid) {
    userLink.href = `user.html?id=${myUid}`;
    console.log("My Page URL set to:", userLink.href);
  }
}
