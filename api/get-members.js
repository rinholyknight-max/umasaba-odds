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

// 💡 データベースが空のときに入れる「6人分の仮データ」
const defaultMembers = {
  user_team01: { username: "team01", name: "チーム01", text: "チーム01の仮テキストです。管理画面から書き換えてね。", image: "" },
  user_team02: { username: "team02", name: "チーム02", text: "チーム02の仮テキストです。ここにお絵描きや文字が入ります。", image: "" },
  user_team03: { username: "team03", name: "チーム03", text: "チーム03の仮テキストです。3×2レイアウトの右端です。", image: "" },
  user_team04: { username: "team04", name: "チーム04", text: "チーム04の仮テキストです。下段の左端になります。", image: "" },
  user_team05: { username: "team05", name: "チーム05", text: "チーム05の仮テキストです。クリックすると全幅になります。", image: "" },
  user_team06: { username: "team06", name: "チーム06", text: "チーム06の仮テキストです。二重スクロールも出ないよ！", image: "" },
};

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const ref = db.ref("admin_users");
    let snapshot = await ref.once("value");

    // 💡 もし Firebase 側にデータが何もなかったら（初回アクセス時）
    if (!snapshot.exists()) {
      // 6人分の仮データを Firebase にドン！と書き込む
      await ref.set(defaultMembers);
      // 書き込んだ直後の最新データをもう一度取得する
      snapshot = await ref.once("value");
    }

    const usersData = snapshot.val();

    // 6人分のデータを配列の形（[]）に変換してフロント（index.js）に渡す
    const dataArray = Object.keys(usersData).map((key) => usersData[key]);

    // 💡 データの並び順がバラバラにならないように、username(team01〜06)の順にソートしてあげる親切設計
    dataArray.sort((a, b) => a.username.localeCompare(b.username));

    return res.status(200).json({ success: true, data: dataArray });
  } catch (error) {
    console.error("API Get Members Error:", error);
    return res.status(500).json({ success: false, error: "サーバーエラーが発生しました。" });
  }
}
