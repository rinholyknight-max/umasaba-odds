import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

import { initTheme, applyCharaTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";
import { initPageInfo } from "./info-config.js";

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
/**
 * 設定ページの初期化
 */
export async function initSettings() {
  // ★ async を追加
  // --- ★ 1. 最初に認証をチェックして結果を待つ ---
  const authInfo = await checkAuth();
  if (!authInfo) return;

  initTheme();
  initMenu();
  initPageInfo("settings");

  const nameInput = document.getElementById("js-display-name");
  const stakeInput = document.getElementById("js-default-stake");
  const saveBtn = document.getElementById("js-save-settings");
  const msgArea = document.getElementById("js-status-msg");
  const iconUploadInput = document.getElementById("js-icon-upload");
  const iconPreviewDiv = document.getElementById("js-icon-preview");
  const userDisplay = document.getElementById("js-display-user");
  const commentInput = document.getElementById("js-user-comment");
  const oshiSelect = document.getElementById("js-oshi-chara");

  // ★ 2. authInfo から確実に ID と名前を取得する
  const userId = authInfo.uid;
  const userName = authInfo.fbUser?.displayName || sessionStorage.getItem("user_name") || "不明なユーザー";

  if (userDisplay) userDisplay.innerText = userName;

  // ゲストユーザー制限
  if (!userId || authInfo.role === "guest" || userId === "GUEST_USER") {
    if (iconUploadInput) iconUploadInput.disabled = true;
    const label = document.querySelector(".p-settings__icon-label");
    if (label) label.style.display = "none";
  }

  let selectedIconFile = null;

  // 3. 初期データ読み込み (Promiseチェーンを await に書き換えるとよりスッキリします)
  if (userId && authInfo.role !== "guest") {
    try {
      const userRef = ref(db, `users/${userId}`);
      const snapshot = await get(userRef);
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
    } catch (err) {
      console.error("データ取得エラー:", err);
    }
  }

  // --- プレビュー処理 (イベントリスナー内は既存のままでOK) ---
  iconUploadInput?.addEventListener("change", async (e) => {
    /* ... 既存のHEIC変換・Cropper処理 ... */
    // (ここは元のコードが既に async/await を適切に使っているのでそのままで大丈夫です)
  });

  // --- 保存処理 ---
  saveBtn.addEventListener("click", async () => {
    // 認証情報の再確認
    if (!userId || authInfo.role === "guest") {
      alert("ゲストユーザーは設定を変更できません。");
      return;
    }

    const nameEl = document.getElementById("js-display-name");
    const stakeEl = document.getElementById("js-default-stake");
    const commentEl = document.getElementById("js-user-comment");
    const oshiEl = document.getElementById("js-oshi-chara");
    const newName = nameEl ? nameEl.value.trim() : "";

    if (!newName) {
      alert("表示名を入力してください");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    try {
      const userRef = ref(db, `users/${userId}`);
      const snapshot = await get(userRef);
      const currentData = snapshot.exists() ? snapshot.val() : {};

      // サークル名の維持
      const myCircle = sessionStorage.getItem("user_circle") || currentData.circleName || "";

      const updateData = {
        userName: newName,
        defaultStake: stakeEl ? Number(stakeEl.value) : currentData.defaultStake || 1000,
        comment: commentEl ? commentEl.value.trim() : "",
        favoriteChara: oshiEl ? oshiEl.value : "",
        circleName: myCircle,
        updatedAt: Date.now(),
      };

      // 画像アップロード処理
      if (selectedIconFile) {
        if (msgArea) msgArea.textContent = "画像をアップロード中...";
        const storagePath = storageRef(storage, `users/${userId}/profile.jpg`);
        const upSnap = await uploadBytes(storagePath, selectedIconFile);
        const downloadURL = await getDownloadURL(upSnap.ref);
        updateData.photoURL = downloadURL;
        sessionStorage.setItem("user_photo_url", downloadURL);
      } else if (currentData.photoURL) {
        updateData.photoURL = currentData.photoURL;
      }

      await update(userRef, updateData);

      // キャッシュ更新
      sessionStorage.setItem("user_name", newName); // localStorageからsessionStorageへ
      if (userDisplay) userDisplay.innerText = newName;

      if (msgArea) {
        msgArea.textContent = "設定を保存しました！";
        msgArea.style.color = "var(--color-primary)";
      }
    } catch (e) {
      console.error("保存エラー:", e);
      if (msgArea) msgArea.textContent = "保存に失敗しました。";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "設定を保存する";
    }
  });

  // 推しキャラテーマ反映
  if (oshiSelect) {
    oshiSelect.onchange = (e) => {
      if (typeof applyCharaTheme === "function") applyCharaTheme(e.target.value);
    };
  }

  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // 全ての初期化が終わったらローディングを消す
  document.body.classList.remove("is-loading");
}
