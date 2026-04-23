/**
 * パカレポAI相談所 ロジック
 */

// 状態管理用オブジェクト
const aiState = {
  currentRaceId: null,
  isConsulted: false,
  oshiName: "ゴールドシップ", // デフォルト
};

// 初期化処理
document.addEventListener("DOMContentLoaded", () => {
  // 1. レースIDの取得（URLパラメータ等から）
  const params = new URLSearchParams(window.location.search);
  aiState.currentRaceId = params.get("id") || "default_race";

  // 2. ユーザーの推しキャラ反映 (auth.jsのデータを想定)
  // ※お使いの環境のユーザー情報取得関数に合わせて調整してください
  if (typeof currentUser !== "undefined" && currentUser.oshi) {
    aiState.oshiName = currentUser.oshiName;
    const imgEl = document.getElementById("ai-oshi-img");
    if (imgEl) imgEl.src = `assets/images/characters/${currentUser.oshi}.png`;
  }

  // 3. 相談済みフラグの確認
  checkConsultationStatus();
});

// 相談済みかどうかをlocalStorageから確認
function checkConsultationStatus() {
  const history = JSON.parse(localStorage.getItem("ai_consultation_history") || "{}");

  if (history[aiState.currentRaceId]) {
    aiState.isConsulted = true;
    updateTicketBadge(0);
  } else {
    aiState.isConsulted = false;
    updateTicketBadge(1);
  }
}

// バッジの表示更新
function updateTicketBadge(count) {
  const badge = document.getElementById("ai-ticket-badge");
  if (badge) badge.innerText = count;
}

// 吹き出しの表示・非表示
function toggleAiBubble() {
  const bubble = document.getElementById("ai-bubble");
  bubble.classList.toggle("h-hidden");

  // 相談済みの場合はメッセージを差し替え
  if (aiState.isConsulted) {
    document.getElementById("ai-options").classList.add("h-hidden");
    document.getElementById("ai-text").innerText = `${aiState.oshiName}：「今日はもうパドックに戻るぜ！次のレースでまた会おうな！」`;
  }
}

// スタンス選択時の処理
async function handleStanceSelect(stance) {
  if (aiState.isConsulted) return;

  const textElement = document.getElementById("ai-text");
  const optionsElement = document.getElementById("ai-options");
  const loadingElement = document.getElementById("ai-loading");

  // UI更新
  optionsElement.classList.add("h-hidden");
  textElement.innerText = `${aiState.oshiName}が考え中...`;
  loadingElement.classList.remove("h-hidden");

  // --- フェーズ3でここにAPI通信を入れる ---
  // 一旦擬似的に3秒待機
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const dummyResponse = `【${stance}】だね。このオッズなら、あえて外枠から狙ってみるのもアリかもしれないぜ！`;
  // ------------------------------------

  // 相談完了処理
  loadingElement.classList.add("h-hidden");
  textElement.innerText = dummyResponse;

  // フラグ保存
  saveConsultation();
}

// 相談済みとして保存
function saveConsultation() {
  aiState.isConsulted = true;
  updateTicketBadge(0);

  const history = JSON.parse(localStorage.getItem("ai_consultation_history") || "{}");
  history[aiState.currentRaceId] = true;
  localStorage.setItem("ai_consultation_history", JSON.stringify(history));
}
