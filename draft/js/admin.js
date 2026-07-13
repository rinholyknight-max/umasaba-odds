import admin from "firebase-admin";

// 1. Firebase Admin SDK の初期化（2重初期化の防止）
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Vercel上の環境変数の改行コードを安全に処理
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n") : undefined,
      }),
      // あなたのRealtime DatabaseのURL
      databaseURL: "https://umasaba-odds-default-rtdb.firebaseio.com",
    });
  } catch (error) {
    console.error("Firebase admin initialization error", error.stack);
  }
}

// 2. Realtime Databaseのインスタンスを取得
const db = admin.database();

export default async function handler(req, res) {
  // CORSプリフライト対応
  if (req.method === "OPTIONS") return res.status(200).end();
  // POSTメソッド以外は弾く
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { username, password } = req.body;

  // 入力チェック
  if (!username || !password) {
    return res.status(400).json({ success: false, error: "ユーザー名とパスワードを入力してください。" });
  }

  try {
    // 💡 注目：ここで Firebase の 'draft_member' ノードをしっかり参照しているよ！
    const ref = db.ref("draft_member");

    // 入力された username と一致するデータをデータベース内から検索
    const snapshot = await ref.orderByChild("username").equalTo(username).once("value");

    // データが存在しない（ユーザー名が登録されていない）場合は401
    if (!snapshot.exists()) {
      return res.status(401).json({ success: false, error: "ユーザー名またはパスワードが違います。" });
    }

    const usersData = snapshot.val();
    let isAuthenticated = false;

    // 取得したデータ内のパスワードと、入力されたパスワードが一致するか検証
    Object.keys(usersData).forEach((key) => {
      if (usersData[key].password === password) {
        isAuthenticated = true;
      }
    });

    // パスワードが一致したらトークンを返して認証成功！
    if (isAuthenticated) {
      return res.status(200).json({
        success: true,
        token: `auth_token_for_${username}`,
      });
    } else {
      // パスワードが違ったら401
      return res.status(401).json({ success: false, error: "ユーザー名またはパスワードが違います。" });
    }
  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ success: false, error: "サーバー内部エラーが発生しました。" });
  }
}
