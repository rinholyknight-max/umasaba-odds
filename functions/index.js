// functions/index.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// シークレットを定義
const geminiKey = defineSecret("GEMINI_API_KEY");

exports.askYayoi = onCall(
  {
    secrets: [geminiKey], // ここでシークレットを明示
    cors: true,
    invoker: "public",
  },
  async (request) => {
    // ログインチェック（ここは通過済み！）
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "理事長に会うにはログインが必要だ！");
    }

    const { stance, raceTitle, oddsData, systemPrompt } = request.data;

    try {
      // APIキーの取得方法を確認
      const apiKey = geminiKey.value();
      if (!apiKey) {
        throw new Error("APIキーが空です");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "models/gemini-3.1-flash-lite-preview" });

      const fullPrompt = `${systemPrompt}\n\n【状況】\nレース: ${raceTitle}\nスタンス: ${stance}\n\n【データ】\n${oddsData}`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;

      return {
        advice: response.text(),
      };
    } catch (error) {
      console.error("Gemini Error:", error);
      // ここを書き換えると、ブラウザ側でより詳しいエラーが見えるようになります
      throw new HttpsError("internal", `理事長エラー: ${error.message}`);
    }
  },
);
