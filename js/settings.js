import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";

import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";

export function initSettings() {
  if (!checkAuth()) return;

  initTheme(); // テーマ（ダークモード）の適用
  initMenu(); // ハンバーガーメニューのイベント登録

  const auth = getAuth();
  const db = getFirestore();

  const nameInput = document.getElementById("js-display-name");
  const stakeInput = document.getElementById("js-default-stake");
  const saveBtn = document.getElementById("js-save-settings");
  const msgArea = document.getElementById("js-status-msg");
  const displayUser = document.getElementById("js-display-user");

  // 1. ログイン監視と初期データ取得
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }

    displayUser.textContent = user.displayName || "ゲスト";

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      nameInput.value = data.displayName || "";
      stakeInput.value = data.defaultStake || 1000;
    }
  });

  // 2. 保存処理
  saveBtn.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";
    msgArea.textContent = "";

    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: nameInput.value.trim(),
        defaultStake: Number(stakeInput.value),
        updatedAt: new Date(),
      });
      msgArea.textContent = "保存しました！";
      msgArea.style.color = "var(--color-primary)";
    } catch (e) {
      msgArea.textContent = "エラーが発生しました。";
      msgArea.style.color = "var(--color-danger)";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "設定を保存する";
    }
  });

  // ログアウト処理（もし他のJSと共通化していなければここで定義）
  document.getElementById("js-logout")?.addEventListener("click", () => signOut(auth));
}
