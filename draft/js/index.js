// js/index.js (公開画面側のロジック)

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("members-container");

  try {
    // 1. Firebaseから6人の最新データを取ってくるAPIを叩く
    const response = await fetch("/api/get-members");
    const result = await response.json();

    if (!result.success) {
      container.innerHTML = `<p>データの読み込みに失敗しました。</p>`;
      return;
    }

    const membersData = result.data; // 6人分の配列が入ってくる

    // 2. 取得した本物のデータでカードを生成
    membersData.forEach((member) => {
      const card = document.createElement("div");
      card.className = "member-card";

      // 💡 中身にテキストと「手書き画像（<img>）」の両方を仕込む
      card.innerHTML = `
        <div class="member-header">
          <h3>${member.name || member.username}</h3>
          <span class="toggle-badge">中身を見る</span>
        </div>
        <div class="member-content">
          ${member.text ? `<p class="memo-text">${member.text}</p>` : ""}
          ${member.image ? `<div class="canvas-img-wrap"><img src="${member.image}" alt="手書き予想" /></div>` : ""}
        </div>
      `;

      // クリックイベント（以前作った比率維持＆全幅フォーカスロジック）
      card.addEventListener("click", () => {
        const currentActive = container.querySelector(".member-card.is-active");
        if (currentActive && currentActive !== card) {
          currentActive.classList.remove("is-active");
          currentActive.querySelector(".toggle-badge").textContent = "中身を見る";
        }
        const isActive = card.classList.toggle("is-active");
        card.querySelector(".toggle-badge").textContent = isActive ? "閉じる" : "中身を見る";
      });

      container.appendChild(card);
    });
  } catch (error) {
    console.error("Fetch Members Error:", error);
    container.innerHTML = `<p>エラーが発生しました。</p>`;
  }
});
