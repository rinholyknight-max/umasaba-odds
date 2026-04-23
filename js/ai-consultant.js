/**
 * パカレポAI相談所：理事長Ver.
 * ロジック管理（相談券・状態遷移）
 */

const yayoiConsultant = {
  state: {
    currentRaceId: null,
    isConsulted: false,
    name: "秋川理事長",
  },

  // 初期化
  init() {
    // 1. URLパラメータからレースIDを取得（一意に特定するため）
    const params = new URLSearchParams(window.location.search);
    this.state.currentRaceId = params.get("id") || "default_race";

    // 2. 相談済み履歴をチェック
    this.checkStatus();

    console.log(`[理事長AI] 初期化完了: RaceID=${this.state.currentRaceId}, 相談済み=${this.state.isConsulted}`);
  },

  // localStorageから状態を確認
  checkStatus() {
    const history = JSON.parse(localStorage.getItem("yayoi_consult_history") || "{}");
    this.state.isConsulted = !!history[this.state.currentRaceId];
    this.updateBadge();
  },

  // 相談券バッジの更新
  updateBadge() {
    const badge = document.getElementById("ai-ticket-badge");
    if (badge) {
      badge.innerText = this.state.isConsulted ? "0" : "1";
      badge.style.background = this.state.isConsulted ? "#95a5a6" : "#ffd700";
    }
  },

  // 吹き出しの開閉
  toggle() {
    const bubble = document.getElementById("ai-bubble");
    if (!bubble) return;

    bubble.classList.toggle("h-hidden");

    // 相談済みの場合は終了メッセージを表示
    if (this.state.isConsulted) {
      this.showFixedMessage("【休息！】今日の私の助言はここまでだ！君の健闘を祈っているぞ！");
      document.getElementById("ai-options").classList.add("h-hidden");
    }
  },

  // 固定メッセージの表示
  showFixedMessage(msg) {
    const textEl = document.getElementById("ai-text");
    if (textEl) textEl.innerText = msg;
  },

  // スタンス選択（ここからAIへ）
  async ask(stance) {
    if (this.state.isConsulted) return;

    const textEl = document.getElementById("ai-text");
    const optionsEl = document.getElementById("ai-options");
    const loadingEl = document.getElementById("ai-loading");

    // UIを「考え中」に
    optionsEl.classList.add("h-hidden");
    textEl.innerText = "【分析！】少々待ってくれたまえ！今のオッズを精査中だ！";
    loadingEl.classList.remove("h-hidden");

    try {
      // --- フェーズ3：ここでGemini APIと通信 ---
      // 現在はテスト用の擬似レスポンス
      const advice = await this.getAiAdvice(stance);
      // --------------------------------------

      // 回答表示
      loadingEl.classList.add("h-hidden");
      textEl.innerText = advice;

      // 相談券を消費
      this.finalizeConsultation();
    } catch (error) {
      console.error("理事長AIエラー:", error);
      textEl.innerText = "【遺憾！】通信環境に不備があるようだ…！";
      loadingEl.classList.add("h-hidden");
      optionsEl.classList.remove("h-hidden");
    }
  },

  // 擬似AIレスポンス（テスト用）
  async getAiAdvice(stance) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const messages = {
      safe: "【堅実！】上位人気の安定感は抜群だ！この2人を軸に添えるのが定石だろう！",
      gamble: "【大胆！】人気薄の彼に光るものを感じる！一発逆転を狙うのも一興だ！",
      free: "【直感！】自分の信じた道を往け！それが勝利への最短ルートだ！",
    };
    return messages[stance] || "【激励！】君の決断を私は支持するぞ！";
  },

  // 相談済みとして保存
  finalizeConsultation() {
    this.state.isConsulted = true;
    this.updateBadge();

    const history = JSON.parse(localStorage.getItem("yayoi_consult_history") || "{}");
    history[this.state.currentRaceId] = true;
    localStorage.setItem("yayoi_consult_history", JSON.stringify(history));
  },
};

// 実行
document.addEventListener("DOMContentLoaded", () => yayoiConsultant.init());

// HTMLからのグローバル呼び出し用
window.toggleAiBubble = () => yayoiConsultant.toggle();
window.handleStanceSelect = (stance) => yayoiConsultant.ask(stance);
