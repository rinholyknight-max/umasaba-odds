/**
 * 🔥 ウマリーグ共通 Firebase 初期化モジュール
 * お題・判定・累計正解数（sixbomber_game）をリアルタイムで共有する
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set, increment } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
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
 * ゲーム状態（お題・判定・累計正解数）の変更を監視する
 * @param {(game: {question: string, judges: Object<string, "correct"|"wrong">, scores: Object<string, number>}) => void} callback
 */
export async function watchGame(callback) {
  await ready;
  onValue(ref(db, GAME_PATH), (snapshot) => {
    const game = snapshot.val() || {};
    callback({ question: game.question || "", judges: game.judges || {}, scores: game.scores || {} });
  });
}

/** お題を登録 */
export async function saveQuestion(question) {
  await ready;
  await update(ref(db, GAME_PATH), { question, updatedAt: Date.now() });
}

/**
 * 判定を登録（judge が null なら取り消し）
 * 正解が付いた／外れた分だけ、そのチームの累計正解数も同時に増減する
 */
export async function saveJudge(username, judge, prevJudge) {
  await ready;
  const delta = (judge === "correct" ? 1 : 0) - (prevJudge === "correct" ? 1 : 0);
  const changes = { [`judges/${username}`]: judge };
  if (delta !== 0) changes[`scores/${username}`] = increment(delta);
  await update(ref(db, GAME_PATH), changes);
}

/** 累計正解数を手動で増減（判定ミスの修正用） */
export async function adjustScore(username, delta) {
  await ready;
  await update(ref(db, GAME_PATH), { [`scores/${username}`]: increment(delta) });
}

/** 1チームの累計正解数をリセット */
export async function clearScore(username) {
  await ready;
  await set(ref(db, `${GAME_PATH}/scores/${username}`), null);
}

/** 累計正解数をすべてリセット */
export async function clearScores() {
  await ready;
  await set(ref(db, `${GAME_PATH}/scores`), null);
}

/** 判定をすべてリセット（次のお題へ。累計正解数はそのまま残る） */
export async function clearJudges() {
  await ready;
  await set(ref(db, `${GAME_PATH}/judges`), null);
}
