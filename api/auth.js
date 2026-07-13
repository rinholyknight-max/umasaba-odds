import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      // Realtime Databaseを使う場合は、databaseURLの指定が必要！
      databaseURL: "https://umasaba-odds-default-rtdb.firebaseio.com",
    });
  } catch (error) {
    console.error("Firebase admin initialization error", error.stack);
  }
}

// FirestoreではなくRealtime Databaseのインスタンスを取得
const db = admin.database();

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: "ユーザー名とパスワードを入力してください。" });
  }

  try {
    // `admin_users` ノードを参照
    const ref = db.ref("admin_users");

    // usernameが一致するデータを検索
    const snapshot = await ref.orderByChild("username").equalTo(username).once("value");

    if (!snapshot.exists()) {
      return res.status(401).json({ success: false, error: "ユーザー名またはパスワードが違います。" });
    }

    const usersData = snapshot.val();
    let isAuthenticated = false;

    // orderByChildの結果は複数ヒットする可能性があるためループで回す
    Object.keys(usersData).forEach((key) => {
      if (usersData[key].password === password) {
        isAuthenticated = true;
      }
    });

    if (isAuthenticated) {
      return res.status(200).json({
        success: true,
        token: `auth_token_for_${username}`,
      });
    } else {
      return res.status(401).json({ success: false, error: "ユーザー名またはパスワードが違います。" });
    }
  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ success: false, error: "サーバー内部エラーが発生しました。" });
  }
}
