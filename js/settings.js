import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

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
const storage = getStorage(app);

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

  // ★アイコン関連の要素を取得
  const iconUploadInput = document.getElementById("js-icon-upload");
  const iconPreviewDiv = document.getElementById("js-icon-preview");

  // ユーザーIDがない、またはゲストの場合はアイコン変更を不可にする
  if (!userId || userId === "GUEST_USER") {
    if (iconUploadInput) iconUploadInput.disabled = true;
    const label = document.querySelector(".p-settings__icon-label");
    if (label) label.style.display = "none";
  }

  // アップロード用に選択されたファイルを保持する変数
  let selectedIconFile = null;

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

          // ★アイコン画像の反映
          if (data.photoURL) {
            iconPreviewDiv.innerHTML = `<img src="${data.photoURL}" alt="アイコン" style="width:100%; height:100%; object-fit:cover;">`;
          }
        }
      })
      .catch((err) => console.error("データ取得エラー:", err));
  }

  // ★追加：画像が選択された時のプレビュー処理
  iconUploadInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ファイル形式チェック (jpeg, png, gif)
    if (!file.type.match("image.*")) {
      alert("画像ファイル(jpg, png, gif)を選択してください");
      iconUploadInput.value = "";
      return;
    }

    // ファイルサイズチェック (例: 2MBまで)
    if (file.size > 2 * 1024 * 1024) {
      alert("ファイルサイズは2MB以下にしてください");
      iconUploadInput.value = "";
      return;
    }

    selectedIconFile = file;

    // FileReaderで読み込んでプレビュー表示
    const reader = new FileReader();
    reader.onload = (event) => {
      iconPreviewDiv.innerHTML = `<img src="${event.target.result}" alt="プレビュー" style="width:100%; height:100%; object-fit:cover;">`;
    };
    reader.readAsDataURL(file);
  });

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

      // ★画像が選択されている場合はアップロードを実行
      if (selectedIconFile) {
        msgArea.textContent = "画像をアップロード中...";

        // Storageの保存パス: users/ユーザーID/profile.png (またはjpg)
        const fileExt = selectedIconFile.type.split("/")[1]; // png, jpeg, gif
        const storagePath = storageRef(storage, `users/${userId}/profile.${fileExt}`);

        // アップロード実行
        const snapshot = await uploadBytes(storagePath, selectedIconFile);

        // アップロード後のダウンロードURLを取得
        const downloadURL = await getDownloadURL(snapshot.ref);

        // データベースに保存するデータに追加
        updateData.photoURL = downloadURL;

        // sessionStorageにも保存（他のページでの表示用）
        sessionStorage.setItem("user_photo_url", downloadURL);
      }

      // Realtime Databaseのデータを更新
      await update(dbRef(db, `users/${userId}`), updateData);

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
