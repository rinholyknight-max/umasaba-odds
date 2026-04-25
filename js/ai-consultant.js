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

    optionsEl.classList.add("h-hidden");
    textEl.innerText = "【分析！】少々待ってくれたまえ！今のオッズを精査中だ！";
    loadingEl.classList.remove("h-hidden");

    // ★ここでデータを整形する
    const oddsData = getFormattedOddsForAI();
    const raceTitle = document.getElementById("js-race-title")?.innerText || "このレース";

    try {
      // APIに投げるパケット（イメージ）
      const aiInput = {
        role: "秋川理事長",
        race: raceTitle,
        stance: stance,
        data: oddsData,
      };

      // ここで Gemini API を叩く（次はここを実装しましょう）
      const advice = await this.callGeminiAPI(aiInput);

      loadingEl.classList.add("h-hidden");
      textEl.innerText = advice;
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

/**
 * 現在の画面（またはデータ）からAI用のテキストを作成する
 */
function getFormattedOddsForAI() {
  // 1. 画面上のオッズアイテムをすべて取得
  const items = document.querySelectorAll(".p-voting__item--odds");
  if (items.length === 0) return "現在、オッズデータが取得できないようだ！";

  let text = "現在の3連複オッズ状況（人気順）：\n";

  // 2. 上位10件程度に絞って整形（トークン節約とAIの混乱防止）
  const maxItems = 10;

  items.forEach((item, index) => {
    if (index >= maxItems) return;

    // 組み合わせ名を取得（例：ゴールドシップ, ダイワスカーレット...）
    const namesEl = item.querySelectorAll(".p-voting__name");
    const comboNames = Array.from(namesEl)
      .map((el) => el.innerText.trim())
      .join(" ＆ ");

    // オッズを取得（.p-voting__number クラス）
    const oddsEl = item.querySelector(".p-voting__number");
    const odds = oddsEl ? oddsEl.innerText : "不明";

    text += `${index + 1}番人気: ${comboNames} / オッズ ${odds}倍\n`;
  });

  return text;
}

const systemPrompt = `
あなたは「ウマ娘 プリティーダービー」に登場する「秋川やよい（理事長）」です。
以下の制約を完璧に守り、ユーザー（トレーナー）にオッズの分析結果を伝えてください。

【口調と性格の制約】
1. 文頭は必ず「【〇〇！】」という四字熟語の叫びから開始すること。
2. 常に熱意に溢れ、情熱的で、自信に満ちた態度で話すこと。
3. 一人称は「私（わたくし）」、二人称は「君（きみ）」、あるいは「トレーナー君」。
4. 語尾は「〜である！」「〜ではないか！」「〜したまえ！」など、古風で威厳のある表現を使う。
5. 扇子を広げたり閉じたりしている様子が目に浮かぶような、勢いのある文章にすること。

【分析の制約】
1. 渡された「オッズデータ」を冷静に分析しつつも、結論は熱く伝えること。
2. ユーザーが選んだ「スタンス」に沿った助言を行うこと。
   - 堅実派：上位人気の信頼性と、堅実な的中こそが王道であると説く。
   - 高配当：荒れる展開のロマンと、勇気ある決断（大穴）を称賛する。
   - 直感：君の「閃き」こそが至高のスパイスであると鼓舞する。

【出力構成】
1. 【四字熟語！】（叫び）
2. スタンスに対する評価とオッズの概況。
3. 具体的な推奨の組み合わせや注目すべき馬への言及。
4. 最後に「【激励！】」などの言葉で締めくくる。

150文字以内で簡潔かつ強烈に回答せよ。`;
const userContent = `
レース名: ${raceTitle}
スタンス: ${stance}
データ: ${oddsData}
`;

// Gemini APIに送るデータ
const payload = {
  contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n以上の指示に従い、以下のデータを分析せよ。\n" + userContent }] }],
};
