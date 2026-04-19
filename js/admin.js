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
/**
 * 管理画面の初期化
 */
export async function initAdmin() {
  console.log("--- admin.js initialized ---");
  const db = getDatabase();

  // --- 1. 最初に認証をチェックして結果を待つ ---
  // 管理者権限 ("admin") を確認
  const authInfo = await checkAuth("admin");

  if (!authInfo) {
    // 認証失敗時は checkAuth 側でリダイレクトされるのでここで終了
    console.warn("管理者認証に失敗しました。");
    return;
  }

  // --- 2. 認証成功後、テーマを初期化 ---
  // authInfo から userNumericId を渡すことで、管理者の推し設定を反映させる
  await initTheme(authInfo.userNumericId);

  // --- 3. ページ情報の初期化 ---
  if (typeof initPageInfo === "function") {
    initPageInfo("admin");
  }

  const params = new URLSearchParams(window.location.search);
  const raceId = params.get("race") || "race_001";

  const raceTitleInput = document.getElementById("js-race-title-input");
  const updateTitleBtn = document.getElementById("js-update-race-title");

  // --- 4. レース情報の同期 ---
  const raceRef = ref(db, `races/${raceId}`);
  onValue(raceRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.title) {
      raceTitleInput.value = data.title;
    } else {
      raceTitleInput.value = "";
    }
  });

  // --- 保存ボタン（新規登録として動作） ---
  if (updateTitleBtn) {
    updateTitleBtn.onclick = async () => {
      const newTitle = raceTitleInput.value.trim();
      if (!newTitle) {
        alert("レース名を入力してください");
        return;
      }

      if (!confirm("新しいレースとして登録しますか？（現在の履歴は保存されます）")) return;

      updateTitleBtn.disabled = true;
      try {
        // 【重要】既存のraceIdを更新するのではなく、push()で新しいIDを作る
        const racesRef = ref(db, "races");
        const newRaceRef = push(racesRef);

        await set(newRaceRef, {
          title: newTitle,
          status: "open", // 初期状態は「開催中」
          createdAt: Date.now(),
        });

        alert("新しいレースを登録しました！");

        // 新しいレースの管理画面へ移動
        window.location.href = `admin.html?race=${newRaceRef.key}`;
      } catch (e) {
        console.error(e);
        alert("登録に失敗しました");
      } finally {
        updateTitleBtn.disabled = false;
      }
    };
  }

  // --- 追加箇所：レース終了ボタン ---
  const closeRaceBtn = document.getElementById("js-close-race");
  if (closeRaceBtn) {
    closeRaceBtn.onclick = async () => {
      if (!confirm("このレースを『終了済』に設定しますか？\n（投票の一覧などには表示されなくなります）")) return;

      try {
        // 削除（remove）ではなく、statusを closed に更新する
        await update(ref(db, `races/${raceId}`), { status: "closed" });
        alert("レースを終了済みにしました。");
        location.reload(); // 状態を反映
      } catch (e) {
        alert("エラーが発生しました");
      }
    };
  }

  // --- 追加：新規レース発行ロジック ---
  const createNewRaceBtn = document.getElementById("js-create-new-race");

  if (createNewRaceBtn) {
    createNewRaceBtn.onclick = async () => {
      const newTitle = raceTitleInput.value.trim();
      if (!newTitle) {
        alert("新しいレース名を入力してください");
        return;
      }

      if (!confirm("既存のレースを上書きせず、新しいレースとして登録しますか？")) return;

      createNewRaceBtn.disabled = true;
      try {
        // 1. Firebaseの 'races' フォルダ内に新しいユニークIDを作成
        const newRaceRef = push(ref(db, "races"));

        // 2. その場所にデータをセット（初期状態は open）
        await set(newRaceRef, {
          title: newTitle,
          status: "open",
          createdAt: Date.now(),
        });

        alert("新規レースを登録しました！");

        // 3. 登録した新しいレースの編集画面へ移動（URLパラメータを新しいIDに書き換え）
        window.location.href = `admin.html?race=${newRaceRef.key}`;
      } catch (e) {
        console.error("新規登録エラー:", e);
        alert("登録に失敗しました");
      } finally {
        createNewRaceBtn.disabled = false;
      }
    };
  }

  const activeIdDisp = document.getElementById("js-active-race-id");
  if (activeIdDisp) activeIdDisp.innerText = raceId;

  const raceSelect = document.getElementById("js-race-select");
  if (raceSelect) raceSelect.value = raceId;

  // 表示名の設定（sessionStorageから取得、なければデフォルト）
  const userName = sessionStorage.getItem("user_name") || "管理者";
  const userDisplay = document.getElementById("js-display-user");
  if (userDisplay) userDisplay.innerText = userName;

  // ローディング解除（theme.js側の opacity 制御と競合しないよう注意）
  document.body.classList.remove("is-loading");

  if (typeof initMenu === "function") {
    initMenu();
  }

  // --- レース一覧をセレクトボックスに反映させる処理 ---
  if (raceSelect) {
    // 全てのレースデータを取得
    onValue(ref(db, "races"), (snapshot) => {
      const allRaces = snapshot.val();
      if (!allRaces) {
        raceSelect.innerHTML = '<option value="">レースがありません</option>';
        return;
      }

      // セレクトボックスを一旦クリア
      raceSelect.innerHTML = '<option value="">レースを選択してください</option>';

      // 取得したデータをループして option を作成
      Object.keys(allRaces)
        .reverse()
        .forEach((id) => {
          const race = allRaces[id];
          const opt = document.createElement("option");
          opt.value = id;

          // ステータスが終了なら【終了】と付けると分かりやすい
          const statusLabel = race.status === "closed" ? "【終了】" : "【開催中】";
          opt.innerText = `${statusLabel} ${race.title || "無題のレース"} (${id})`;

          // 現在編集中のIDなら選択状態にする
          if (id === raceId) opt.selected = true;

          raceSelect.appendChild(opt);
        });
    });
  }

  // ログアウト
  const logoutBtn = document.getElementById("js-logout");
  if (logoutBtn) logoutBtn.onclick = logout;

  // --- 5. DOM要素の取得とイベント登録 ---
  const charInput = document.getElementById("horse-name");
  const userInput = document.getElementById("user-name");
  const addBtn = document.getElementById("add-btn");
  const fileInput = document.getElementById("js-upload-file");
  const adminList = document.getElementById("admin-list");

  const allowIdInput = document.getElementById("new-allow-id");
  const allowNameInput = document.getElementById("new-allow-name");
  const allowCircleSelect = document.getElementById("new-allow-circle");
  const addAllowBtn = document.getElementById("add-allow-btn");
  const addAllowMsg = document.getElementById("add-allow-msg");

  const allowCsvInput = document.getElementById("js-allow-csv-file");
  const allowCsvBtn = document.getElementById("js-allow-csv-btn");

  // 個別登録（出走馬）
  if (addBtn) {
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
  }

  // 一括登録（出走馬CSV）
  if (fileInput) {
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
  }

  // 新規ユーザー許可登録
  if (addAllowBtn) {
    addAllowBtn.addEventListener("click", async () => {
      const id = allowIdInput.value.trim();
      const name = allowNameInput.value.trim();
      const circle = allowCircleSelect.value;
      if (!id || !name) {
        alert("ゲームIDと表示名の両方を入力してください");
        return;
      }
      try {
        await set(ref(db, `allowed_users/${id}`), {
          userName: name,
          circleName: circle,
          initialPoints: 100,
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
  }

  // 名簿一括登録
  if (allowCsvBtn) {
    allowCsvBtn.addEventListener("click", () => {
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
          await update(ref(db), updates);
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
  }

  // 出走馬リスト表示
  onValue(ref(db, `races/${raceId}/horses`), (snapshot) => {
    const data = snapshot.val();
    if (!adminList) return;
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

  // 許可済みユーザーリスト表示
  onValue(ref(db, "allowed_users"), (snapshot) => {
    const data = snapshot.val();
    let allowListArea = document.getElementById("allow-list-display");
    if (!allowListArea) {
      allowListArea = document.createElement("div");
      allowListArea.id = "allow-list-display";
      if (adminList) adminList.after(allowListArea);
    }
    allowListArea.innerHTML = "<hr style='margin:20px 0;'><h3>許可済みユーザー（ID連携）</h3>";

    if (!data) return;
    for (let id in data) {
      const div = document.createElement("div");
      div.className = "p-admin__item";
      div.style.borderLeft = "4px solid var(--p-color-primary, #4caf50)"; // 接頭辞 p- を追加
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

  // リセット系
  document.getElementById("js-reset-votes")?.addEventListener("click", () => {
    if (confirm("このレースの全キャラを削除しますか？")) {
      remove(ref(db, `races/${raceId}/horses`));
      remove(ref(db, `races/${raceId}/combos`));
    }
  });

  // --- 修正箇所：リセット系 ---
  document.getElementById("js-reset-horses")?.addEventListener("click", () => {
    // 「全データ」という言葉を「このレース単体」に変更
    if (confirm(`【警告】レース [${raceId}] の履歴を完全に削除しますか？\n※一度消すと元に戻せません。`)) {
      remove(ref(db, `races/${raceId}`));
      // 削除後は一覧に戻る
      window.location.href = "admin.html";
    }
  });
}
