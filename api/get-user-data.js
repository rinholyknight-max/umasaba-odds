import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : undefined,
    }),
    databaseURL: "https://umasaba-odds-default-rtdb.firebaseio.com",
  });
}

const db = admin.database();

// 💡 board パラメータごとの保存先ノード（未指定ならドラフト用）
const BOARD_NODES = { draft: "admin_users", sixbomber: "sixbomber_users" };

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const { username, board = "draft" } = req.query;

  if (!username) return res.status(400).json({ success: false, error: "ユーザー名が必要です。" });
  const node = BOARD_NODES[board];
  if (!node) return res.status(400).json({ success: false, error: "不明なボードです。" });

  try {
    const ref = db.ref(node);
    const snapshot = await ref.orderByChild("username").equalTo(username).once("value");

    if (!snapshot.exists()) {
      return res.status(200).json({ success: true, data: null });
    }

    const userData = Object.values(snapshot.val())[0];
    return res.status(200).json({ success: true, data: userData });
  } catch (error) {
    console.error("API Get User Data Error:", error);
    return res.status(500).json({ success: false, error: "サーバーエラーが発生しました。" });
  }
}
