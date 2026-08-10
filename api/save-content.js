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
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { username, text, image } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, error: "ユーザー名が不明です。" });
  }

  try {
    // 💡 admin_users の中の、該当するユーザーのデータノードを特定して直接更新する
    // 例: admin_users の中の一致する username の場所
    const ref = db.ref("admin_users");
    const snapshot = await ref.orderByChild("username").equalTo(username).once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ success: false, error: "ユーザーが見つかりません。" });
    }

    // 該当ユーザーのFirebase上のキー（自動生成されたIDなど）を取得
    const userKey = Object.keys(snapshot.val())[0];

    // データを更新（テキストと手書き画像を上書き）
    await ref.child(userKey).update({
      text: text,
      image: image,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("API Save Error:", error);
    return res.status(500).json({ success: false, error: "サーバーエラーが発生しました。" });
  }
}
