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

export async function initSettings() {
  console.log("--- settings.js initialized ---");
  const db = getDatabase();
  const storage = getStorage();

  // 1. 認証チェック
  const authInfo = await checkAuth();
  if (!authInfo) return;

  // 2. テーマ初期化（認証後のIDを渡す）
  await initTheme(authInfo.userNumericId);

  // 3. メニュー等の初期化
  if (typeof initMenu === "function") initMenu();
  if (typeof initPageInfo === "function") initPageInfo("settings");

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

  const userId = authInfo.uid; // Firebase AuthのUID
  const userNumericId = authInfo.userNumericId; // DB照合用の数字ID
  const userRole = authInfo.role;
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";

  if (userDisplay) userDisplay.innerText = userName;

  // 権限チェック
  const canEdit = userNumericId && userRole !== "guest";

  if (!canEdit) {
    if (iconUploadInput) iconUploadInput.disabled = true;
    const label = document.querySelector(".p-settings__icon-label");
    if (label) label.style.display = "none";
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.style.opacity = "0.5";
    }
  }

  let selectedIconFile = null;

  // 4. 初期データ読み込み
  if (canEdit) {
    try {
      const userRef = ref(db, `users/${userNumericId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const data = snapshot.val();

        // --- 画面への値セット ---
        if (nameInput) nameInput.value = data.userName || "";
        if (commentInput) commentInput.value = data.comment || "";

        const savedOshi = data.favoriteChara || "";
        if (oshiSelect) {
          oshiSelect.value = savedOshi;
        }

        // --- ★ここが重要：DBから取得した推しキャラを「今すぐ」画面に反映する ---
        if (savedOshi) {
          console.log("[Settings] Initial theme apply:", savedOshi);
          // localStorageも更新しておく（他ページ遷移時のチラつき防止）
          localStorage.setItem("user_oshi", savedOshi);
          // テーマ適用（色の注入とキャッシュ作成を同時に行う）
          await applyCharaTheme(savedOshi);
        }

        if (data.photoURL && iconPreviewDiv) {
          iconPreviewDiv.innerHTML = `<img src="${data.photoURL}" class="p-settings__icon-img" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
      }
    } catch (err) {
      console.error("データ取得エラー:", err);
    }
  }

  // --- 画像処理（省略せず記述） ---
  iconUploadInput?.addEventListener("change", async (e) => {
    if (!canEdit) return;
    let file = e.target.files[0];
    if (!file) return;

    try {
      if (msgArea) msgArea.textContent = "画像を加工中...";
      if (file.name.toLowerCase().endsWith(".heic") || file.type === "image/heic") {
        if (typeof heic2any === "function") {
          const jpegBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
          file = new File([jpegBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
        }
      }
      // Cropper.jsによる1:1切り抜き（プロジェクト標準）
      const croppedFile = await openCropper(file);
      if (!croppedFile) {
        if (msgArea) msgArea.textContent = "";
        return;
      }
      selectedIconFile = croppedFile;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (iconPreviewDiv) {
          iconPreviewDiv.innerHTML = `<img src="${event.target.result}" class="p-settings__icon-img">`;
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
      // 権限がない場合はメッセージエリアに警告を出す
      if (msgArea) {
        msgArea.textContent = "このアカウントでは設定を変更できません。";
        msgArea.style.color = "red";
        msgArea.style.opacity = "1";
      }
      return;
    }

    const newName = nameInput ? nameInput.value.trim() : "";
    const newOshi = oshiSelect ? oshiSelect.value : "";

    if (!newName) {
      if (msgArea) {
        msgArea.textContent = "表示名を入力してください";
        msgArea.style.color = "red";
        msgArea.style.opacity = "1";
      }
      return;
    }

    // 保存開始時のUIフィードバック
    saveBtn.disabled = true;
    saveBtn.textContent = "保存中...";
    if (msgArea) {
      msgArea.style.transition = "none"; // 前回のフェードをリセット
      msgArea.textContent = "保存しています...";
      msgArea.style.color = "var(--p-color-primary)";
      msgArea.style.opacity = "1";
    }

    try {
      const userRef = ref(db, `users/${userNumericId}`);
      const updateData = {
        userName: newName,
        defaultStake: stakeInput ? Number(stakeInput.value) : 1000,
        comment: commentInput ? commentInput.value.trim() : "",
        favoriteChara: newOshi, // ★ favoriteCharacter から favoriteChara へ修正
        updatedAt: Date.now(),
      };

      if (selectedIconFile) {
        const path = storageRef(storage, `users/${userNumericId}/profile.jpg`);
        const upSnap = await uploadBytes(path, selectedIconFile);
        const downloadURL = await getDownloadURL(upSnap.ref);
        updateData.photoURL = downloadURL;
        sessionStorage.setItem("user_photo_url", downloadURL);
      }

      await update(userRef, updateData);

      // ★ ローカルキャッシュの更新（これが遷移時のチラつきを防ぐ）
      sessionStorage.setItem("user_name", newName);
      localStorage.setItem("user_oshi", newOshi);

      // applyCharaTheme内で user_oshi_colors も更新され、即座に画面色が変わる
      await applyCharaTheme(newOshi);

      if (userDisplay) userDisplay.innerText = newName;

      // 成功メッセージの表示
      if (msgArea) {
        msgArea.textContent = "設定を保存しました！";
        msgArea.style.color = "var(--p-color-primary)";
        msgArea.style.opacity = "1";

        // 3秒後にスッと消す（UX向上）
        setTimeout(() => {
          msgArea.style.transition = "opacity 0.8s ease";
          msgArea.style.opacity = "0";
        }, 3000);
      }
    } catch (e) {
      console.error(e);
      if (msgArea) {
        msgArea.textContent = "保存に失敗しました。";
        msgArea.style.color = "red";
        msgArea.style.opacity = "1";
      }
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "設定を保存する";
    }
  });
  // セレクトボックス変更時に即座にテーマをプレビュー
  if (oshiSelect) {
    oshiSelect.onchange = async (e) => {
      await applyCharaTheme(e.target.value);
    };
  }

  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // ローディング解除
  document.body.classList.remove("is-loading");
}
