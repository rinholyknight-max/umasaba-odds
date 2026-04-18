import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";

// --- Firebase初期化 (admin.jsと同じもの) ---
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

export function initSettings() {
  // 1. 認証チェック
  if (!checkAuth()) return;

  // 2. UI初期化
  initTheme();
  initMenu();

  // 3. 要素の取得
  const nameInput = document.getElementById("js-display-name");
  const stakeInput = document.getElementById("js-default-stake");
  const saveBtn = document.getElementById("js-save-settings");
  const msgArea = document.getElementById("js-status-msg");

  // sessionStorageから現在のユーザーID(ゲームID)を取得
  const userId = sessionStorage.getItem("user_id");
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";

  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

  // 4. 初期データ読み込み (Realtime Databaseから取得)
  if (userId && userId !== "GUEST_USER") {
    const userRef = ref(db, `users/${userId}`);
    get(userRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          nameInput.value = data.userName || "";
          stakeInput.value = data.defaultStake || 1000;
        }
      })
      .catch((err) => console.error("データ取得エラー:", err));
  }

  // 5. 保存処理 (Realtime Databaseのupdateを使用)
  saveBtn.addEventListener("click", async () => {
    if (!userId || userId === "GUEST_USER") {
      alert("ゲストユーザーは設定を変更できません。");
      return;
    }

    const newName = nameInput.value.trim();
    const newStake = Number(stakeInput.value);

    if (!newName) {
      alert("表示名を入力してください");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";
    msgArea.textContent = "";

    try {
      // Realtime Databaseのデータを更新
      await update(ref(db, `users/${userId}`), {
        userName: newName,
        defaultStake: newStake,
        updatedAt: Date.now(),
      });

      // sessionStorageも更新しておかないと、画面上の表示が古いままになる
      sessionStorage.setItem("user_name", newName);
      if (userDisplay) userDisplay.innerText = newName;

      msgArea.textContent = "設定を保存しました！";
      msgArea.style.color = "var(--color-primary)";
    } catch (e) {
      console.error(e);
      msgArea.textContent = "保存に失敗しました。";
      msgArea.style.color = "var(--color-danger)";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "設定を保存する";
    }
  });

  // ログアウト処理
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;
}
