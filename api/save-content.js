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
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { username, text, image, board = "draft" } = req.body;

  if (!username) {
    return res.status(400).json({ success: false, error: "ユーザー名が不明です。" });
  }
  const node = BOARD_NODES[board];
  if (!node) return res.status(400).json({ success: false, error: "不明なボードです。" });

  try {
    // 💡 board に対応するノードの中の、該当するユーザーのデータノードを特定して直接更新する
    const ref = db.ref(node);
    const snapshot = await ref.orderByChild("username").equalTo(username).once("value");

    let userKey;
    if (snapshot.exists()) {
      // 該当ユーザーのFirebase上のキー（自動生成されたIDなど）を取得
      userKey = Object.keys(snapshot.val())[0];
    } else if (board === "sixbomber") {
      // シックスボンバー側にまだ枠が無ければ、ドラフトのチーム情報をもとに作成する
      const draftSnapshot = await db.ref(BOARD_NODES.draft).orderByChild("username").equalTo(username).once("value");
      if (!draftSnapshot.exists()) {
        return res.status(404).json({ success: false, error: "ユーザーが見つかりません。" });
      }
      userKey = Object.keys(draftSnapshot.val())[0];
      const draftUser = draftSnapshot.val()[userKey];
      await ref.child(userKey).set({ username, name: draftUser.name || username });
    } else {
      return res.status(404).json({ success: false, error: "ユーザーが見つかりません。" });
    }

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
