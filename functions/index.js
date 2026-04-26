const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const geminiKey = defineSecret("GEMINI_API_KEY");

exports.askYayoi = onCall(
  {
    secrets: [geminiKey],
    cors: true,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "理事長に会うにはログインが必要だ！");
    }

    const { stance, raceTitle, oddsData, systemPrompt } = request.data;

    try {
      const genAI = new GoogleGenerativeAI(geminiKey.value());
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const fullPrompt = `${systemPrompt}\n\n【状況】\nレース: ${raceTitle}\nスタンス: ${stance}\n\n【データ】\n${oddsData}`;

      const result = await model.generateContent(fullPrompt);
      const response = await result.response;

      return {
        advice: response.text(),
      };
    } catch (error) {
      console.error("Gemini Error:", error);
      throw new HttpsError("internal", "理事長が激務で倒れてしまった（AIエラー）");
    }
  },
);
