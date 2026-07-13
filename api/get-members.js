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

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const ref = db.ref("admin_users");
    const snapshot = await ref.once("value");

    if (!snapshot.exists()) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 6人分のデータを配列にしてフロントに返す
    const usersData = snapshot.val();
    const dataArray = Object.keys(usersData).map((key) => usersData[key]);

    return res.status(200).json({ success: true, data: dataArray });
  } catch (error) {
    console.error("API Get Members Error:", error);
    return res.status(500).json({ success: false, error: "サーバーエラーが発生しました。" });
  }
}
