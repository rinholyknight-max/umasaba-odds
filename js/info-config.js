/**
 * 各ページのInfoボタンで表示する文言の定義
 */
const infoMessages = {
  index: {
    title: "投票ページの使い方",
    body: "開催中のレースを選択して投票できます。3連複形式（3頭選択）で投票可能です。投票後の修正はできませんのでご注意ください。",
  },
  odds: {
    title: "オッズの見方",
    body: "現在の得票状況をリアルタイムで集計しています。円グラフで全体の人気を把握できるほか、各コメントのユーザー名をクリックすると、その方のプロフィールを確認できます。",
  },
  user: {
    title: "プロフィールページ",
    body: "あなたの活動実績や、設定したプロフィールが表示されます。設定した「推しウマ娘」のテーマカラーがページ全体に反映され、自分だけのデザインになります。",
  },
  settings: {
    title: "設定ページ",
    body: "アイコン画像のアップロード、名前や紹介文の変更ができます。「推しウマ娘」を変更すると、サイト全体のテーマカラーを切り替えることができます。",
  },
  help: {
    title: "ヘルプと規約",
    body: "当サイトの詳しい利用ルールやプライバシーポリシーを掲載しています。安心してご利用いただくために、一度目を通していただければ幸いです。",
  },
};

/**
 * Infoボタンの初期化関数
 */

export function initPageInfo(pageKey) {
  const setup = () => {
    const infoBtn = document.getElementById("js-page-info");
    const modal = document.getElementById("js-modal");
    if (!infoBtn || !modal) return;

    const config = infoMessages[pageKey];
    if (!config) return;

    // ボタンクリック時の処理
    infoBtn.addEventListener("click", (e) => {
      e.preventDefault();

      // モーダル内の各パーツを取得（あなたのHTML構造に合わせる）
      const modalTitle = document.getElementById("js-modal-title");
      const modalBody = modal.querySelector(".c-modal__body");
      // bodyの中の特定のリストコンテナ（js-modal-comment-list）を取得
      const listContainer = document.getElementById("js-modal-comment-list");

      if (modalTitle && listContainer) {
        // 1. タイトルを「ページ説明」用に書き換え
        modalTitle.innerText = config.title;

        // 2. 中身をInfo用に書き換え
        listContainer.innerHTML = `
          <div class="p-info-modal" style="padding: 10px 0;">
            <p style="line-height:1.6; margin-bottom:24px; color:var(--text-main); font-size:0.95rem; white-space: pre-wrap;">${config.body}</p>
            <div style="border-top:1px solid var(--border); padding-top:16px; text-align:center;">
              <a href="help.html" style="color:var(--chara-main); font-weight:bold; text-decoration:none; font-size:0.85rem; display:inline-flex; align-items:center; gap:4px; justify-content: center;">
                <span class="material-symbols-outlined" style="font-size:1.2rem;">help</span>
                詳しく知りたい・規約を見る
              </a>
            </div>
          </div>
        `;

        // 3. 表示
        modal.classList.add("is-show");
      }
    });

    // ★重要：閉じ処理も「上書き」ではなく「追加」しておく
    const closeBtn = document.getElementById("js-modal-close");
    const overlay = document.getElementById("js-modal-overlay");
    const closeModal = () => modal.classList.remove("is-show");

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", closeModal);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
}
