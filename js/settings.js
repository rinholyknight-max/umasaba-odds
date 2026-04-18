import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";

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
const storage = getStorage(app);

export function initSettings() {
  if (!checkAuth()) return;

  initTheme();
  initMenu();

  const nameInput = document.getElementById("js-display-name");
  const stakeInput = document.getElementById("js-default-stake");
  const saveBtn = document.getElementById("js-save-settings");
  const msgArea = document.getElementById("js-status-msg");
  const iconUploadInput = document.getElementById("js-icon-upload");
  const iconPreviewDiv = document.getElementById("js-icon-preview");
  const userDisplay = document.getElementById("js-display-user");

  // ★修正1: 先にsessionStorageから取得する（順番を上に上げた）
  const userId = sessionStorage.getItem("user_id");
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";

  if (userDisplay) userDisplay.innerText = userName;

  // ★修正2: userIdを取得した後に判定を行う
  if (!userId || userId === "GUEST_USER") {
    if (iconUploadInput) iconUploadInput.disabled = true;
    const label = document.querySelector(".p-settings__icon-label");
    if (label) label.style.display = "none";
  }

  let selectedIconFile = null;

  // 4. 初期データ読み込み
  if (userId && userId !== "GUEST_USER") {
    const userRef = ref(db, `users/${userId}`);
    get(userRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (nameInput) nameInput.value = data.userName || "";
          if (stakeInput) stakeInput.value = data.defaultStake || 1000;
          if (data.photoURL && iconPreviewDiv) {
            iconPreviewDiv.innerHTML = `<img src="${data.photoURL}" alt="アイコン" style="width:100%; height:100%; object-fit:cover;">`;
          }
        }
      })
      .catch((err) => console.error("データ取得エラー:", err));
  }

  // プレビュー処理
  iconUploadInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.match("image.*")) {
      alert("画像ファイルを選択してください");
      return;
    }
    selectedIconFile = file;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (iconPreviewDiv) {
        iconPreviewDiv.innerHTML = `<img src="${event.target.result}" alt="プレビュー" style="width:100%; height:100%; object-fit:cover;">`;
      }
    };
    reader.readAsDataURL(file);
  });

  // 5. 保存処理
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
      // ★修正3: 保存するデータのオブジェクトを定義する
      const updateData = {
        userName: newName,
        defaultStake: newStake,
        updatedAt: Date.now(),
      };

      // 画像アップロード
      if (selectedIconFile) {
        msgArea.textContent = "画像をアップロード中...";
        const fileExt = selectedIconFile.type.split("/")[1];
        const storagePath = storageRef(storage, `users/${userId}/profile.${fileExt}`);
        const snapshot = await uploadBytes(storagePath, selectedIconFile);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // オブジェクトにURLを追加
        updateData.photoURL = downloadURL;
        sessionStorage.setItem("user_photo_url", downloadURL);
      }

      // Realtime Databaseを一括更新
      await update(ref(db, `users/${userId}`), updateData);

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

  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;
}
