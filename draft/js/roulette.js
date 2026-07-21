/**
 * 🎰 ドラフト会議 ルーレットシステム（チェックボックス選択版）
 */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("members-container");
  const rouletteModal = document.getElementById("roulette-modal");
  const rouletteStartBtn = document.getElementById("roulette-start-btn");
  const rouletteSpinBtn = document.getElementById("roulette-spin-btn");
  const rouletteCloseBtn = document.getElementById("roulette-close-btn");
  const rouletteName = document.getElementById("roulette-name");

  let isSpinning = false;

  // モーダルを開く処理
  if (rouletteStartBtn) {
    rouletteStartBtn.addEventListener("click", () => {
      if (!container) return;

      // 💡 チェックされているチェックボックスを検索
      const checkedBoxes = container.querySelectorAll(".roulette-checkbox:checked");

      if (checkedBoxes.length === 0) {
        alert("ルーレットで抽選したいチームにチェックを入れてください。");
        return;
      }

      rouletteName.textContent = "???";
      rouletteName.className = "roulette-name";
      rouletteSpinBtn.disabled = false;
      rouletteModal.classList.add("is-open");
    });
  }

  // モーダルを閉じる処理
  if (rouletteCloseBtn) {
    rouletteCloseBtn.addEventListener("click", () => {
      if (isSpinning) return;
      rouletteModal.classList.remove("is-open");
    });
  }

  // 🎰 スロット回転ロジック
  if (rouletteSpinBtn) {
    rouletteSpinBtn.addEventListener("click", () => {
      if (isSpinning || !container) return;

      // 💡 チェックされているカードからチーム名/メンバー名を取得
      const checkedBoxes = Array.from(container.querySelectorAll(".roulette-checkbox:checked"));

      const candidates = checkedBoxes.map((box) => {
        const card = box.closest(".member-card");
        return card ? card.querySelector("h3")?.textContent.trim() || "名前なし" : "名前なし";
      });

      if (candidates.length === 0) return;

      isSpinning = true;
      rouletteSpinBtn.disabled = true;
      rouletteName.className = "roulette-name is-spinning";

      let counter = 0;
      let speed = 50;
      let totalRounds = 30;

      function spin() {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        rouletteName.textContent = candidates[randomIndex];

        counter++;

        if (counter < totalRounds) {
          if (counter > totalRounds - 10) speed += 30;
          else if (counter > totalRounds - 5) speed += 60;

          setTimeout(spin, speed);
        } else {
          // 🎉 最終決定（確定演出）
          const winner = candidates[Math.floor(Math.random() * candidates.length)];
          rouletteName.textContent = winner;
          rouletteName.className = "roulette-name is-winner";
          isSpinning = false;

          highlightWinnerCard(winner);
        }
      }

      spin();
    });
  }

  // 確定したチームのカードへスクロール
  function highlightWinnerCard(winnerName) {
    if (!container) return;
    const cards = container.querySelectorAll(".member-card");
    cards.forEach((card) => {
      const name = card.querySelector("h3")?.textContent.trim();
      if (name === winnerName) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }
});