const mockData = [
  { id: "team01", name: "チーム01", text: "【極秘】チーム01の今週の本命馬とオッズ分析テキスト。" },
  { id: "team02", name: "チーム02", text: "【極秘】チーム02の今週の本命馬とオッズ分析テキスト。" },
  { id: "team03", name: "チーム03", text: "【極秘】チーム03の今週の本命馬とオッズ分析テキスト。" },
  { id: "team04", name: "チーム04", text: "【極秘】チーム04の今週の本命馬とオッズ分析テキスト。" },
  { id: "team05", name: "チーム05", text: "【極秘】チーム05の今週の本命馬とオッズ分析テキスト。" },
  { id: "team06", name: "チーム06", text: "【極秘】チーム06の今週の本命馬とオッズ分析テキスト。" },
];

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("members-container");

  mockData.forEach((member) => {
    const card = document.createElement("div");
    card.className = "member-card";
    card.innerHTML = `
      <div class="member-header">
        <h3>${member.name}</h3>
        <span class="toggle-badge">中身を見る</span>
      </div>
      <div class="member-content">
        <p>${member.text}</p>
      </div>
    `;

    card.addEventListener("click", () => {
      const currentActive = container.querySelector(".member-card.is-active");

      // 他に開いているカードがあれば閉じる（1人だけにフォーカス）
      if (currentActive && currentActive !== card) {
        currentActive.classList.remove("is-active");
        currentActive.querySelector(".toggle-badge").textContent = "中身を見る";
      }

      // 自分のアクティブ状態をトグル
      const isActive = card.classList.toggle("is-active");
      card.querySelector(".toggle-badge").textContent = isActive ? "閉じる" : "中身を見る";
    });

    container.appendChild(card);
  });
});
