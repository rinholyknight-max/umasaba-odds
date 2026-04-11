import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";

// --- 初期設定 ---
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

/**
 * 管理画面の初期化
 */
export function initAdmin() {
  initTheme();

  // 表示名の設定
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

  if (!checkAuth()) {
    console.warn("認証に失敗しました。");
    return;
  }

  initMenu();

  // ログアウト
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // DOM要素の取得
  const charInput = document.getElementById("horse-name");
  const userInput = document.getElementById("user-name");
  const addBtn = document.getElementById("add-btn");
  const fileInput = document.getElementById("js-upload-file");
  const adminList = document.getElementById("admin-list");

  // 1. 個別登録
  addBtn.addEventListener("click", () => {
    const hName = charInput.value.trim();
    const uName = userInput.value.trim();

    if (!hName || !uName) {
      alert("キャラ名とユーザー名の両方を入力してください");
      return;
    }

    push(ref(db, "horses"), { horseName: hName, userName: uName, votes: 0 }).then(() => {
      charInput.value = "";
      userInput.value = "";
      charInput.focus();
    });
  });

  // 2. 一括登録
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const lines = event.target.result.split(/\r?\n/).filter((line) => line.trim() !== "");
      let count = 0;
      for (let line of lines) {
        const [hName, uName] = line.split(/[,,、\s]+/).map((s) => s.trim());
        if (hName && uName) {
          try {
            await push(ref(db, "horses"), { horseName: hName, userName: uName, votes: 0 });
            count++;
          } catch (err) {
            console.error(err);
          }
        }
      }
      alert(`${count}件登録しました`);
      fileInput.value = "";
    };
    reader.readAsText(file);
  };

  // 3. リスト表示
  onValue(ref(db, "horses"), (snapshot) => {
    const data = snapshot.val();
    adminList.innerHTML = "";
    if (!data) return;

    for (let id in data) {
      const item = document.createElement("div");
      item.className = "p-admin__item";
      item.innerHTML = `
        <div class="p-admin__info">
          <span style="display:block; font-weight:bold;">${data[id].horseName}</span>
          <small>ユーザー: ${data[id].userName}</small>
        </div>
        <button class="c-button c-button--danger js-delete-btn" data-id="${id}">削除</button>
      `;
      adminList.appendChild(item);
    }

    adminList.querySelectorAll(".js-delete-btn").forEach((btn) => {
      btn.onclick = () => {
        if (confirm("削除しますか？")) remove(ref(db, `horses/${btn.dataset.id}`));
      };
    });
  });

  // 4. リセット系
  document.getElementById("js-reset-votes")?.addEventListener("click", () => {
    if (confirm("投票データのみリセットしますか？")) {
      remove(ref(db, "combos"));
      remove(ref(db, "logs"));
    }
  });

  document.getElementById("js-reset-horses")?.addEventListener("click", () => {
    if (confirm("全キャラ削除しますか？")) {
      remove(ref(db, "horses"));
      remove(ref(db, "combos"));
    }
  });
}
