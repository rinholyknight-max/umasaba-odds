/**
 * 📢 ウマリーグ 下部バナー広告
 * data/banners.json の広告を読み込み、中央に1枚ずつフェードイン/アウトで表示する。
 *
 * banners.json の形式:
 *   interval: 1枚あたりの表示時間（ミリ秒）
 *   banners:  [{ image: 画像パス, alt: 代替テキスト, url: リンク先（空ならリンクなし） }]
 */
document.addEventListener("DOMContentLoaded", async () => {
  const banner = document.querySelector(".bottom-banner");
  const wrapper = document.querySelector("#banner-bottom .swiper-wrapper");
  if (!banner || !wrapper) return;

  let config;
  try {
    const response = await fetch(`/sixbomber/data/banners.json?v=${Date.now()}`);
    config = await response.json();
  } catch (error) {
    console.error("Banner Load Error:", error);
  }

  const banners = (config && config.banners) || [];
  // 広告が1件もなければ枠ごと非表示
  if (banners.length === 0) {
    banner.hidden = true;
    return;
  }

  banners.forEach(({ image, alt, url }) => {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";

    const img = document.createElement("img");
    img.src = image;
    img.alt = alt || "広告";

    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.appendChild(img);
      slide.appendChild(link);
    } else {
      slide.appendChild(img);
    }

    wrapper.appendChild(slide);
  });

  new Swiper("#banner-bottom", {
    effect: "fade",
    fadeEffect: { crossFade: true },
    loop: banners.length > 1,
    speed: 800,
    autoplay: { delay: config.interval || 5000, disableOnInteraction: false },
    allowTouchMove: false,
    // ボードはログインするまで非表示なので、表示されたらサイズを再計算する
    observer: true,
    observeParents: true,
  });
});
