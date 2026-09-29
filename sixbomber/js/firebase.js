/**
 * 🔥 シックスボンバー共通 Firebase 初期化モジュール
 * お題・判定（sixbomber_game）をリアルタイムで共有する
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBp5Cg6A3v3VZal-orAiwFjphKIDYx9ATo",
  authDomain: "umasaba-odds.firebaseapp.com",
  databaseURL: "https://umasaba-odds-default-rtdb.firebaseio.com",
  projectId: "umasaba-odds",
  storageBucket: "umasaba-odds.firebasestorage.app",
  messagingSenderId: "802834774249",
  appId: "1:802834774249:web:5623185854ead82c261878",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// 匿名認証（auth != null のルールを通すため）
const ready = signInAnonymously(auth);

const GAME_PATH = "sixbomber_game";

/**
 * ゲーム状態（お題・判定）の変更を監視する
 * @param {(game: {question: string, judges: Object<string, "correct"|"wrong">}) => void} callback
 */
export async function watchGame(callback) {
  await ready;
  onValue(ref(db, GAME_PATH), (snapshot) => {
    const game = snapshot.val() || {};
    callback({ question: game.question || "", judges: game.judges || {} });
  });
}

/** お題を登録 */
export async function saveQuestion(question) {
  await ready;
  await update(ref(db, GAME_PATH), { question, updatedAt: Date.now() });
}

/** 判定を登録（judge が null なら取り消し） */
export async function saveJudge(username, judge) {
  await ready;
  await set(ref(db, `${GAME_PATH}/judges/${username}`), judge);
}

/** 判定をすべてリセット */
export async function clearJudges() {
  await ready;
  await set(ref(db, `${GAME_PATH}/judges`), null);
}
