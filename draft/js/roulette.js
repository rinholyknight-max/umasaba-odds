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
        /* 
         * -------------------------------------------------------------------
         * 🎲 均等抽選の仕組み（アニメーション表示用）
         * -------------------------------------------------------------------
         * 1. Math.random() は 0 以上 1 未満の浮動小数点数を「一様分布（均等な確率）」で生成します。
         * 2. そこに配列の長さ（candidates.length）を掛けることで、[0 〜 N未満] の範囲に引き伸ばします。
         * 3. Math.floor() で端数を切り捨て、0 〜 (N-1) の整数インデックスに変換します。
         * これにより、各候補のインデックスが選ばれる確率は完全に等しく（1 / candidates.length）なります。
         */
        const randomIndex = Math.floor(Math.random() * candidates.length);
        rouletteName.textContent = candidates[randomIndex];

        counter++;

        if (counter < totalRounds) {
          if (counter > totalRounds - 10) speed += 30;
          else if (counter > totalRounds - 5) speed += 60;

          setTimeout(spin, speed);
        } else {
          /* 
           * -------------------------------------------------------------------
           * 🎉 均等抽選の仕組み（最終結果の決定）
           * -------------------------------------------------------------------
           * 表示アニメーションとは独立して、最終当選者も同様に『1 / N』の一様確率で再計算し公平に決定します。
           * (例: 5チーム選択されている場合、各チームの当選確率は正確に 20% となります)
           */
          const winnerIndex = Math.floor(Math.random() * candidates.length);
          const winner = candidates[winnerIndex];
          
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