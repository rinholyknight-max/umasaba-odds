document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("members-container");
  const resetBtn = document.getElementById("reset-all-btn");
  const refreshBtn = document.getElementById("refresh-data-btn");

  try {
    const response = await fetch("/api/get-members");
    const result = await response.json();
    if (!result.success) return;

    const membersData = result.data;

    membersData.forEach((member) => {
      const card = document.createElement("div");
      card.className = "member-card";
      card.setAttribute("data-username", member.username);

      card.innerHTML = `
       <div class="member-header">
          <div class="header-left">
            <input type="checkbox" class="roulette-checkbox" data-username="${member.username}" checked />
            <h3>${member.name || member.username}</h3>
          </div>
          <span class="toggle-badge">中身を見る</span>
        </div>
        <div class="member-content">
          <p class="memo-text"></p>
          <div class="canvas-img-wrap">
            <img src="" alt="手書き予想" />
          </div>
        </div>
      `;

      const checkbox = card.querySelector(".roulette-checkbox");
      if (checkbox) {
        checkbox.addEventListener("click", (e) => {
          e.stopPropagation(); // カード本体のクリックイベント発火をストップ
        });
      }

      // 💡 初回表示時の表示分け処理（テキスト優先、なければ画像）
      applyExclusiveContent(card, member.text, member.image);

      // クリックイベント
      card.addEventListener("click", () => {
        const isActive = card.classList.toggle("is-active");
        card.querySelector(".toggle-badge").textContent = isActive ? "閉じる" : "中身を見る";
      });

      container.appendChild(card);
    });

    // 一括非表示ボタンのクリック処理
    resetBtn.addEventListener("click", () => {
      const activeCards = container.querySelectorAll(".member-card.is-active");
      activeCards.forEach((card) => {
        card.classList.remove("is-active");
        card.querySelector(".toggle-badge").textContent = "中身を見る";
      });
    });

    // 最新データに更新ボタンのクリック処理
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "更新中...";

        try {
          const res = await fetch("/api/get-members");
          const updateResult = await res.json();

          if (updateResult.success) {
            updateResult.data.forEach((member) => {
              const card = container.querySelector(`.member-card[data-username="${member.username}"]`);
              if (card) {
                // 💡 更新時にも同様の排他制御ロジックを適用
                applyExclusiveContent(card, member.text, member.image);
              }
            });
          }
        } catch (err) {
          console.error("Refresh Error:", err);
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.textContent = "最新データに更新";
        }
      });
    }
  } catch (error) {
    console.error("Fetch Members Error:", error);
  }

  /**
   * 💡 テキストと手書き画像の表示を完全に切り替える排他制御関数
   */
  function applyExclusiveContent(card, text, image) {
    const textElem = card.querySelector(".memo-text");
    const imgWrap = card.querySelector(".canvas-img-wrap");
    const imgElem = imgWrap ? imgWrap.querySelector("img") : null;

    // トリムして文字があるか判定
    const hasText = text && text.trim() !== "";

    if (hasText) {
      // 📝 テキストがある時は「テキストのみ」
      if (textElem) {
        textElem.textContent = text;
        textElem.style.display = ""; // 表示
      }
      if (imgWrap) imgWrap.style.display = "none"; // 画像を非表示
      if (imgElem) imgElem.src = "";
    } else if (image) {
      // 🎨 手書き画像がある時は「手書きのみ」
      if (textElem) {
        textElem.textContent = "";
        textElem.style.display = "none"; // テキストを非表示
      }
      if (imgWrap) {
        imgWrap.style.display = ""; // 画像を表示
      }
      if (imgElem) imgElem.src = image;
    } else {
      // 両方空の時
      if (textElem) textElem.style.display = "none";
      if (imgWrap) imgWrap.style.display = "none";
    }
  }
});
