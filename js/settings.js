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

let cropper = null;

async function openCropper(file) {
  // ★要素の取得を関数の「中」で、実行されるタイミングで行う
  return new Promise((resolve) => {
    const modal = document.getElementById("js-crop-modal");
    const cropImg = document.getElementById("js-crop-image");
    const confirmBtn = document.getElementById("js-crop-confirm");
    const cancelBtn = document.getElementById("js-crop-cancel");

    // 要素が取得できなかった場合のチェック
    if (!modal || !cropImg) {
      alert("システムエラー: 切り抜き画面が見つかりません。");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      cropImg.src = e.target.result;
      modal.style.display = "flex";

      // Cropperの初期化
      if (cropper) cropper.destroy();
      cropper = new Cropper(cropImg, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: "move",
        autoCropArea: 1,
        guides: false,
      });
    };
    reader.readAsDataURL(file);

    // 確定・キャンセル処理
    confirmBtn.onclick = () => {
      const canvas = cropper.getCroppedCanvas({ width: 400, height: 400 });
      canvas.toBlob(
        (blob) => {
          modal.style.display = "none";
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.85,
      );
    };

    cancelBtn.onclick = () => {
      modal.style.display = "none";
      resolve(null);
    };
  });
}

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
  const commentInput = document.getElementById("js-user-comment"); // HTMLのIDと一致させる
  const oshiSelect = document.getElementById("js-oshi-chara"); // HTMLのIDと一致させる

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
          if (commentInput) commentInput.value = data.comment || "";
          if (oshiSelect) oshiSelect.value = data.favoriteChara || "";
          if (data.photoURL && iconPreviewDiv) {
            iconPreviewDiv.innerHTML = `<img src="${data.photoURL}" alt="アイコン" style="width:100%; height:100%; object-fit:cover;">`;
          }
        }
      })
      .catch((err) => console.error("データ取得エラー:", err));
  }

  // プレビュー処理
  iconUploadInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.match("image.*")) {
      alert("画像ファイルを選択してください");
      return;
    }

    try {
      if (msgArea) msgArea.textContent = "画像を加工中...";

      // 1. 手動切り抜きモーダルを開く
      // ★ここを openCropper に変更
      const croppedFile = await openCropper(file);

      // 2. キャンセル（モーダルの「キャンセル」ボタン）された場合は処理を中断
      if (!croppedFile) {
        if (msgArea) msgArea.textContent = "";
        return;
      }

      // 3. 切り抜かれたファイルを保存用変数に代入
      selectedIconFile = croppedFile;

      // プレビュー表示には加工後の selectedIconFile を使う
      const reader = new FileReader();
      reader.onload = (event) => {
        if (iconPreviewDiv) {
          iconPreviewDiv.innerHTML = `<img src="${event.target.result}" alt="プレビュー" style="width:100%; height:100%; object-fit:cover;">`;
        }
      };
      reader.readAsDataURL(selectedIconFile);
    } catch (err) {
      console.error("画像処理エラー:", err);
      alert("画像の加工に失敗しました");
    }
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
      // sessionStorageからサークル名を取得しておく
      const myCircle = sessionStorage.getItem("user_circle") || "";

      // ★修正：保存するデータのオブジェクト
      const updateData = {
        userName: newName,
        defaultStake: newStake,
        comment: commentInput ? commentInput.value.trim() : "", // 安全な書き方
        favoriteChara: oshiSelect ? oshiSelect.value : "", // 安全な書き方
        circleName: myCircle, // ★ここにこの1行を追加！
        updatedAt: Date.now(),
      };

      // 画像アップロード
      if (selectedIconFile) {
        msgArea.textContent = "画像をアップロード中...";
        const storagePath = storageRef(storage, `users/${userId}/profile.jpg`);
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
