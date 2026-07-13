// js/index.js (一部抜粋・変更箇所)

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("members-container");
  const resetBtn = document.getElementById("reset-all-btn"); // 💡 ボタンの取得

  try {
    const response = await fetch("/api/get-members");
    const result = await response.json();
    if (!result.success) return;

    const membersData = result.data;

    membersData.forEach((member) => {
      const card = document.createElement("div");
      card.className = "member-card";
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

      // 💡 クリックイベントを修正
      card.addEventListener("click", () => {
        // 「他を閉じる」ロジックを削除したことで、何個でも同時オープン可能に！
        const isActive = card.classList.toggle("is-active");
        card.querySelector(".toggle-badge").textContent = isActive ? "閉じる" : "中身を見る";
      });

      container.appendChild(card);
    });

    // 💡 一括非表示ボタンのクリック処理を追加
    resetBtn.addEventListener("click", () => {
      // 画面上の全てのアクティブなカードを取得してループ処理
      const activeCards = container.querySelectorAll(".member-card.is-active");

      activeCards.forEach((card) => {
        card.classList.remove("is-active");
        card.querySelector(".toggle-badge").textContent = "中身を見る";
      });
    });
  } catch (error) {
    console.error("Fetch Members Error:", error);
  }
});
