/**
 * ハンバーガーメニュー制御 (js/menu.js)
 */
export function initMenu() {
  const btn = document.getElementById("js-hamburger");
  const menu = document.getElementById("js-menu");
  const overlay = document.getElementById("js-overlay");

  if (!btn || !menu || !overlay) return;

  const toggleMenu = () => {
    btn.classList.toggle("is-active");
    menu.classList.toggle("is-active");
    overlay.classList.toggle("is-active");
  };

  btn.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", toggleMenu);
}
