document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("members-container");
  const resetBtn = document.getElementById("reset-all-btn");
  const refreshBtn = document.getElementById("refresh-data-btn"); // 🔄 追加：「最新データに更新」ボタンの取得

  try {
    const response = await fetch("/api/get-members");
    const result = await response.json();
    if (!result.success) return;

    const membersData = result.data;

    membersData.forEach((member) => {
      const card = document.createElement("div");
      card.className = "member-card";
      // 💡 後から特定のメンバーを特定して上書きできるよう、data属性を付与
      card.setAttribute("data-username", member.username);

      card.innerHTML = `
        <div class="member-header">
          <h3>${member.name || member.username}</h3>
          <span class="toggle-badge">中身を見る</span>
        </div>
        <div class="member-content">
          <!-- 💡 JavaScriptからピンポイントで書き換えられるようクラスやラッパーを固定配置 -->
          <p class="memo-text">${member.text || ""}</p>
          <div class="canvas-img-wrap" style="${member.image ? "" : "display: none;"}">
            <img src="${member.image || ""}" alt="手書き予想" />
          </div>
        </div>
      `;

      // 初期表示でテキストも画像も空なら、コンテンツエリア自体のスタイル調整が必要な場合のために考慮
      toggleContentVisibility(card, member.text, member.image);

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

    // 🔄 追加：最新データに更新ボタンのクリック処理
    if (refreshBtn) {
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = "更新中...";

        try {
          // 最新のメンバーデータを再取得
          const res = await fetch("/api/get-members");
          const updateResult = await res.json();

          if (updateResult.success) {
            updateResult.data.forEach((member) => {
              // 画面上にある該当メンバーのカードを検索（これにより要素を壊さずis-activeを維持）
              const card = container.querySelector(`.member-card[data-username="${member.username}"]`);
              if (card) {
                // テキストの更新
                const textElem = card.querySelector(".memo-text");
                if (textElem) textElem.textContent = member.text || "";

                // 画像の更新
                const imgWrap = card.querySelector(".canvas-img-wrap");
                const imgElem = imgWrap ? imgWrap.querySelector("img") : null;

                if (imgElem && imgWrap) {
                  if (member.image) {
                    imgElem.src = member.image;
                    imgWrap.style.display = ""; // 表示
                  } else {
                    imgElem.src = "";
                    imgWrap.style.display = "none"; // 非表示
                  }
                }

                // テキストと画像の有無に応じた表示ロジックの適用
                toggleContentVisibility(card, member.text, member.image);
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
   * 💡 テキストや画像の有無で要素の表示・非表示を切り替える補助関数
   */
  function toggleContentVisibility(card, text, image) {
    const textElem = card.querySelector(".memo-text");
    if (textElem) {
      textElem.style.display = text ? "" : "none";
    }
  }
});
