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
  // 1. 認証チェック
  // auth.js側のcheckAuthがオブジェクト { uid, role } を返す前提です
  const authInfo = await checkAuth();
  if (!authInfo) return;

  initTheme();
  initMenu();
  initPageInfo("settings");

  // DOM要素の取得
  const nameInput = document.getElementById("js-display-name");
  const stakeInput = document.getElementById("js-default-stake");
  const saveBtn = document.getElementById("js-save-settings");
  const msgArea = document.getElementById("js-status-msg");
  const iconUploadInput = document.getElementById("js-icon-upload");
  const iconPreviewDiv = document.getElementById("js-icon-preview");
  const userDisplay = document.getElementById("js-display-user");
  const commentInput = document.getElementById("js-user-comment");
  const oshiSelect = document.getElementById("js-oshi-chara");

  // authInfoから情報を抽出
  const userId = authInfo.uid;
  const userRole = authInfo.role; // 'personal', 'admin', 'guest'
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";

  if (userDisplay) userDisplay.innerText = userName;

  // ★重要：権限による操作制限の修正
  // ログインIDがある（userIdが存在する）かつ、ロールが 'guest' ではない場合のみ許可
  const canEdit = userId && userId !== "GUEST_USER" && userRole !== "guest";

  if (!canEdit) {
    if (iconUploadInput) iconUploadInput.disabled = true;
    const label = document.querySelector(".p-settings__icon-label");
    if (label) label.style.display = "none";
    // ゲストには保存ボタンも非表示にするか無効化
    if (saveBtn) saveBtn.style.opacity = "0.5";
  }

  let selectedIconFile = null;

  // 3. 初期データ読み込み
  if (canEdit) {
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
          iconPreviewDiv.innerHTML = `<img src="${data.photoURL}" alt="アイコン" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
      }
    } catch (err) {
      console.error("データ取得エラー:", err);
    }
  }

  // --- 画像選択・クロップ処理 ---
  iconUploadInput?.addEventListener("change", async (e) => {
    if (!canEdit) return; // 権限がなければ何もしない

    let file = e.target.files[0];
    if (!file) return;

    try {
      if (msgArea) msgArea.textContent = "画像を加工中...";

      // iPhone (HEIC) 対策
      if (file.name.toLowerCase().endsWith(".heic") || file.type === "image/heic") {
        if (typeof heic2any === "function") {
          const jpegBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
          file = new File([jpegBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
        }
      }

      const croppedFile = await openCropper(file);
      if (!croppedFile) {
        if (msgArea) msgArea.textContent = "";
        return;
      }

      selectedIconFile = croppedFile;

      const reader = new FileReader();
      reader.onload = (event) => {
        if (iconPreviewDiv) {
          iconPreviewDiv.innerHTML = `<img src="${event.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
        if (msgArea) msgArea.textContent = "準備完了。「設定を保存」を押してください。";
      };
      reader.readAsDataURL(selectedIconFile);
    } catch (err) {
      console.error(err);
      alert("画像の加工に失敗しました");
    }
  });

  // --- 保存処理 ---
  saveBtn?.addEventListener("click", async () => {
    if (!canEdit) {
      alert("このアカウントでは設定を変更できません。");
      return;
    }

    const newName = nameInput ? nameInput.value.trim() : "";
    if (!newName) {
      alert("表示名を入力してください");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    try {
      const userRef = ref(db, `users/${userId}`);
      const updateData = {
        userName: newName,
        defaultStake: stakeInput ? Number(stakeInput.value) : 1000,
        comment: commentInput ? commentInput.value.trim() : "",
        favoriteChara: oshiSelect ? oshiSelect.value : "",
        updatedAt: Date.now(),
      };

      // 画像がある場合はStorageにアップロード
      if (selectedIconFile) {
        const storagePath = storageRef(storage, `users/${userId}/profile.jpg`);
        const upSnap = await uploadBytes(storagePath, selectedIconFile);
        const downloadURL = await getDownloadURL(upSnap.ref);
        updateData.photoURL = downloadURL;
        sessionStorage.setItem("user_photo_url", downloadURL);
      }

      await update(userRef, updateData);

      sessionStorage.setItem("user_name", newName);
      if (userDisplay) userDisplay.innerText = newName;

      if (msgArea) {
        msgArea.textContent = "設定を保存しました！";
        msgArea.style.color = "var(--color-primary)";
      }
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました。");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "設定を保存する";
    }
  });

  // キャラテーマ、ログアウト、ローディング解除（省略なし）
  if (oshiSelect) {
    oshiSelect.onchange = (e) => applyCharaTheme?.(e.target.value);
  }
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;
  document.body.classList.remove("is-loading");
}
