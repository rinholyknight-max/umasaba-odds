// サンプルの6人データ（本来はFirebase Realtime Databaseから fetch してくるよ！）
const mockData = [
  { id: "team01", name: "チーム01", text: "ここにteam01が管理画面から書いた秘匿内容が入る。" },
  { id: "team02", name: "チーム02", text: "ここにteam02が管理画面から書いた秘匿内容が入る。" },
  { id: "team03", name: "チーム03", text: "ここにteam03が管理画面から書いた秘匿内容が入る。" },
  { id: "team04", name: "チーム04", text: "ここにteam04が管理画面から書いた秘匿内容が入る。" },
  { id: "team05", name: "チーム05", text: "ここにteam05が管理画面から書いた秘匿内容が入る。" },
  { id: "team06", name: "チーム06", text: "ここにteam06が管理画面から書いた秘匿内容が入る。" },
];

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("members-container");

  // 1. 6人分のカードを画面に生成
  mockData.forEach((member) => {
    const card = document.createElement("div");
    card.className = "member-card";
    card.innerHTML = `
      <div class="member-header">
        <h3>${member.name}</h3>
        <span class="toggle-badge">クリックで確認</span>
      </div>
      <div class="member-content">
        <p>${member.text}</p>
      </div>
    `;

    // 2. クリックイベント（ここでお互いを見えなくしたり、1人にフォーカスさせる）
    card.addEventListener("click", (e) => {
      // すでにアクティブなカードがあれば、一旦すべて解除（1人のみにフォーカスさせる場合）
      const currentActive = container.querySelector(".member-card.is-active");

      if (currentActive && currentActive !== card) {
        currentActive.classList.remove("is-active");
        currentActive.querySelector(".toggle-badge").textContent = "クリックで確認";
      }

      // 自身の表示・非表示を切り替え
      const isActive = card.classList.toggle("is-active");
      card.querySelector(".toggle-badge").textContent = isActive ? "閉じる" : "クリックで確認";
    });

    container.appendChild(card);
  });
});
