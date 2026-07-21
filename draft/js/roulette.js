/**
 * ドラフト会議 ルーレットシステム
 */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("members-container");
  const rouletteModal = document.getElementById("roulette-modal");
  const rouletteStartBtn = document.getElementById("roulette-start-btn");
  const rouletteSpinBtn = document.getElementById("roulette-spin-btn");
  const rouletteCloseBtn = document.getElementById("roulette-close-btn");
  const rouletteName = document.getElementById("roulette-name");

  let isSpinning = false;

  // モーダルを開く
  if (rouletteStartBtn) {
    rouletteStartBtn.addEventListener("click", () => {
      if (!container) return;

      // 💡 開いているカード（is-active）から対象メンバーを抽出
      let activeCards = container.querySelectorAll(".member-card.is-active");
      if (activeCards.length === 0) {
        activeCards = container.querySelectorAll(".member-card");
      }

      if (activeCards.length === 0) {
        alert("抽選対象のメンバーがいません。");
        return;
      }

      rouletteName.textContent = "???";
      rouletteName.className = "roulette-name";
      rouletteSpinBtn.disabled = false;
      rouletteModal.classList.add("is-open");
    });
  }

  // モーダルを閉じる
  if (rouletteCloseBtn) {
    rouletteCloseBtn.addEventListener("click", () => {
      if (isSpinning) return; // 抽選中は閉じさせない
      rouletteModal.classList.remove("is-open");
    });
  }

  // 🎰 スロット回転ロジック
  if (rouletteSpinBtn) {
    rouletteSpinBtn.addEventListener("click", () => {
      if (isSpinning || !container) return;

      // 💡 中身が開いている（is-active）カードから候補の名前を取得
      let targetCards = Array.from(container.querySelectorAll(".member-card.is-active"));

      // 一つも開いていない場合は全員から抽選
      if (targetCards.length === 0) {
        targetCards = Array.from(container.querySelectorAll(".member-card"));
      }

      const candidates = targetCards.map((card) => {
        return card.querySelector("h3")?.textContent.trim() || "名前なし";
      });

      if (candidates.length === 0) return;

      isSpinning = true;
      rouletteSpinBtn.disabled = true;
      rouletteName.className = "roulette-name is-spinning";

      let counter = 0;
      let speed = 50; // 開始時のスロット速度(ms)
      let totalRounds = 30; // ルーレットが切り替わる回数

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

  // 確定した勝者のカードにスクロール移動して強調する処理
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
