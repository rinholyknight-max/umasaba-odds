import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";
import { initTheme } from "./theme.js";
import { checkAuth, logout } from "./auth.js";
import { initMenu } from "./menu.js";
import { initPageInfo } from "./info-config.js";

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
  initPageInfo("admin");
  initTheme();

  // ★1. 編集対象のレースIDを取得 (例: admin.html?race=race_001)
  const params = new URLSearchParams(window.location.search);
  const raceId = params.get("race") || "race_001"; // 指定がなければデフォルト

  const raceTitleInput = document.getElementById("js-race-title-input");
  const updateTitleBtn = document.getElementById("js-update-race-title");

  // --- 1. 現在のレース名を取得して初期値にセット ---
  const raceRef = ref(db, `races/${raceId}`);
  onValue(raceRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.title) {
      raceTitleInput.value = data.title;
    } else {
      raceTitleInput.value = ""; // 未設定の場合
    }
  });

  // --- 2. 保存ボタンのクリックイベント ---
  updateTitleBtn.onclick = async () => {
    const newTitle = raceTitleInput.value.trim();
    if (!newTitle) {
      alert("レース名を入力してください");
      return;
    }

    updateTitleBtn.disabled = true;
    try {
      // Firebaseの races/raceId/title を更新
      await update(ref(db, `races/${raceId}`), {
        title: newTitle,
      });
      alert("レース名を更新しました！");
    } catch (e) {
      console.error(e);
      alert("更新に失敗しました");
    } finally {
      updateTitleBtn.disabled = false;
    }
  };

  const activeIdDisp = document.getElementById("js-active-race-id");
  if (activeIdDisp) activeIdDisp.innerText = raceId;

  const raceSelect = document.getElementById("js-race-select");
  if (raceSelect) raceSelect.value = raceId;

  // 表示名の設定
  const userName = sessionStorage.getItem("user_name") || "不明なユーザー";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

  if (!checkAuth("admin")) {
    console.warn("認証に失敗しました。");
    return;
  }

  document.body.classList.remove("is-loading");

  initMenu();

  // ログアウト
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // DOM要素の取得
  const charInput = document.getElementById("horse-name");
  const userInput = document.getElementById("user-name");
  const addBtn = document.getElementById("add-btn");
  const fileInput = document.getElementById("js-upload-file"); // 出走馬用CSV
  const adminList = document.getElementById("admin-list");

  // --- ★ユーザー許可登録用の要素 ---
  const allowIdInput = document.getElementById("new-allow-id");
  const allowNameInput = document.getElementById("new-allow-name");
  const allowCircleSelect = document.getElementById("new-allow-circle"); // サークル選択用
  const addAllowBtn = document.getElementById("add-allow-btn");
  const addAllowMsg = document.getElementById("add-allow-msg");

  // ★名簿一括登録用の要素
  const allowCsvInput = document.getElementById("js-allow-csv-file");
  const allowCsvBtn = document.getElementById("js-allow-csv-btn");

  // 1. 個別登録（出走馬）
  addBtn.addEventListener("click", () => {
    const hName = charInput.value.trim();
    const uName = userInput.value.trim();
    if (!hName || !uName) {
      alert("キャラ名とユーザー名の両方を入力してください");
      return;
    }
    push(ref(db, `races/${raceId}/horses`), { horseName: hName, userName: uName, votes: 0 }).then(() => {
      charInput.value = "";
      userInput.value = "";
      charInput.focus();
    });
  });

  // 2. 一括登録（出走馬：キャラ名,ユーザー名）
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
            await push(ref(db, `races/${raceId}/horses`), { horseName: hName, userName: uName, votes: 0 });
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

  // --- ★新規ユーザー許可登録（個別：サークル名対応） ---
  addAllowBtn.addEventListener("click", async () => {
    const id = allowIdInput.value.trim();
    const name = allowNameInput.value.trim();
    const circle = allowCircleSelect.value; // 追加
    if (!id || !name) {
      alert("ゲームIDと表示名の両方を入力してください");
      return;
    }
    try {
      await set(ref(db, `allowed_users/${id}`), {
        userName: name,
        circleName: circle, // 追加
        initialPoints: 100, // デフォルトポイント
        addedAt: Date.now(),
      });
      addAllowMsg.innerText = `成功: ${name} / ${circle} を追加しました`;
      addAllowMsg.style.color = "var(--color-primary)";
      allowIdInput.value = "";
      allowNameInput.value = "";
    } catch (err) {
      console.error(err);
      addAllowMsg.innerText = "エラーが発生しました";
      addAllowMsg.style.color = "red";
    }
  });

  // --- ★名簿一括登録（名簿用CSV：ID,名前,サークル名） ---
  allowCsvBtn?.addEventListener("click", () => {
    const file = allowCsvInput.files[0];
    if (!file) {
      alert("CSVファイルを選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const lines = e.target.result.split(/\r?\n/).filter((l) => l.trim() !== "");
      const updates = {};
      let count = 0;

      lines.forEach((line) => {
        const [id, name, circle] = line.split(",").map((s) => s?.trim());
        if (id && name) {
          updates[`allowed_users/${id}`] = {
            userName: name,
            circleName: circle || "未設定",
            initialPoints: 100,
            addedAt: Date.now(),
          };
          count++;
        }
      });

      if (count === 0) {
        alert("有効なデータがありませんでした");
        return;
      }

      try {
        allowCsvBtn.disabled = true;
        await update(ref(db), updates); // まとめて更新
        alert(`${count}件の名簿を登録しました！`);
        allowCsvInput.value = "";
      } catch (err) {
        console.error(err);
        alert("一括登録に失敗しました");
      } finally {
        allowCsvBtn.disabled = false;
      }
    };
    reader.readAsText(file);
  });

  // 3. リスト表示（出走馬）
  onValue(ref(db, `races/${raceId}/horses`), (snapshot) => {
    const data = snapshot.val();
    adminList.innerHTML = "<h3>現在の出走表</h3>";
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
        if (confirm("削除しますか？")) remove(ref(db, `races/${raceId}/horses/${btn.dataset.id}`));
      };
    });
  });

  // --- ★許可済みユーザーリストの表示（サークル名表示対応） ---
  onValue(ref(db, "allowed_users"), (snapshot) => {
    const data = snapshot.val();
    let allowListArea = document.getElementById("allow-list-display");
    if (!allowListArea) {
      allowListArea = document.createElement("div");
      allowListArea.id = "allow-list-display";
      adminList.after(allowListArea);
    }
    allowListArea.innerHTML = "<hr style='margin:20px 0;'><h3>許可済みユーザー（ID連携）</h3>";

    if (!data) return;
    for (let id in data) {
      const div = document.createElement("div");
      div.className = "p-admin__item";
      div.style.borderLeft = "4px solid var(--color-primary, #4caf50)";
      div.innerHTML = `
        <div class="p-admin__info">
          <b>${data[id].userName}</b> <span style="font-size:0.8rem; color:#888;">[${data[id].circleName || "サークル未設定"}]</span><br>
          <small>ID: ${id}</small>
        </div>
        <button class="c-button c-button--danger js-delete-allow" data-id="${id}">許可取消</button>
      `;
      allowListArea.appendChild(div);
    }
    allowListArea.querySelectorAll(".js-delete-allow").forEach((btn) => {
      btn.onclick = () => {
        if (confirm("許可を取り消しますか？")) remove(ref(db, `allowed_users/${btn.dataset.id}`));
      };
    });
  });

  // 4. リセット系
  document.getElementById("js-reset-votes")?.addEventListener("click", () => {
    if (confirm("このレースの全キャラを削除しますか？")) {
      remove(ref(db, `races/${raceId}/horses`));
      remove(ref(db, `races/${raceId}/combos`));
      // ※ logsは全レース共通にするか、logs内にもraceIdを持たせる運用がおすすめ
    }
  });

  document.getElementById("js-reset-horses")?.addEventListener("click", () => {
    if (confirm(`レース [${raceId}] の全データを削除しますか？`)) {
      remove(ref(db, `races/${raceId}`)); // そのレースのフォルダごと消すのが確実
    }
  });
}
