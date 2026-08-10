/**
 * パカレポAI相談所：理事長Ver.
 */

// 1. Firebase SDKのインポート（AppとFunctions）
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

// --- 初期設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyBp5Cg6A3v3VZal-orAiwFjphKIDYx9ATo",
  authDomain: "umasaba-odds.firebaseapp.com",
  databaseURL: "https://umasaba-odds-default-rtdb.firebaseio.com",
  projectId: "umasaba-odds",
  storageBucket: "umasaba-odds.firebasestorage.app",
  messagingSenderId: "802834774249",
  appId: "1:802834774249:web:5623185854ead82c261878",
};

// 既に初期化済みのAppを使い、ログイン状態を共有する
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

const yayoiConsultant = {
  state: {
    currentRaceId: null,
    isConsulted: false,
    name: "秋川理事長",
  },

  // 初期化
  init() {
    // 1. URLパラメータからレースIDを取得
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
    // 【重要】ここで現在のユーザー（匿名含む）をチェック
    const user = auth.currentUser;
    console.log("現在のユーザー:", user);

    if (!user) {
      this.showFixedMessage("【遺憾！】ログイン（匿名含む）が確認できん！再読み込みしてくれたまえ！");
      return;
    }

    if (this.state.isConsulted) return;

    const textEl = document.getElementById("ai-text");
    const optionsEl = document.getElementById("ai-options");
    const loadingEl = document.getElementById("ai-loading");

    optionsEl.classList.add("h-hidden");
    textEl.innerText = "【分析！】少々待ってくれたまえ！今のオッズを精査中だ！";
    loadingEl.classList.remove("h-hidden");

    // データを整形
    const oddsData = getFormattedOddsForAI();
    const raceTitle = document.getElementById("js-race-title")?.innerText || "このレース";

    try {
      // --- Firebase Functions 連携部分 ---
      const functions = getFunctions();
      const askYayoi = httpsCallable(functions, "askYayoi");

      // 元のプロンプトをそのまま使用
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

      // Functionsを呼び出し
      const result = await askYayoi({
        stance: stance,
        raceTitle: raceTitle,
        oddsData: oddsData,
        systemPrompt: systemPrompt,
      });

      // AIからの回答を表示
      loadingEl.classList.add("h-hidden");
      textEl.innerText = result.data.advice;
      this.finalizeConsultation();
    } catch (error) {
      console.error("理事長AIエラー:", error);
      loadingEl.classList.add("h-hidden");
      optionsEl.classList.remove("h-hidden");

      if (error.code === "unauthenticated") {
        textEl.innerText = "【遺憾！】まずはログインしたまえ！話はそれからだ！！";
      } else {
        textEl.innerText = "【遺憾！】通信環境に不備があるようだ…！";
      }
    }
  },

  // 相談済みとして保存
  finalizeConsultation() {
    this.state.isConsulted = true;
    this.updateBadge();

    const today = new Date().toLocaleDateString(); // "2026/04/27" のような形式
    const history = JSON.parse(localStorage.getItem("yayoi_consult_history") || "{}");

    // 単なる true ではなく、相談した日付を記録する
    history[this.state.currentRaceId] = today;
    localStorage.setItem("yayoi_consult_history", JSON.stringify(history));
  },

  // 相談済みかチェックする際、日付が今日かどうかを確認
  checkStatus() {
    const history = JSON.parse(localStorage.getItem("yayoi_consult_history") || "{}");
    const consultDate = history[this.state.currentRaceId];
    const today = new Date().toLocaleDateString();

    // 「履歴がある」かつ「その日付が今日である」場合のみ相談済みとする
    this.state.isConsulted = consultDate === today;
    this.updateBadge();
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
  const items = document.querySelectorAll(".p-voting__item--odds");
  if (items.length === 0) return "現在、オッズデータが取得できないようだ！";

  let text = "現在の3連複オッズ状況（人気順）：\n";
  const maxItems = 10;

  items.forEach((item, index) => {
    if (index >= maxItems) return;

    const namesEl = item.querySelectorAll(".p-voting__name");
    const comboNames = Array.from(namesEl)
      .map((el) => el.innerText.trim())
      .join(" ＆ ");

    const oddsEl = item.querySelector(".p-voting__number");
    const odds = oddsEl ? oddsEl.innerText : "不明";

    text += `${index + 1}番人気: ${comboNames} / オッズ ${odds}倍\n`;
  });

  return text;
}
