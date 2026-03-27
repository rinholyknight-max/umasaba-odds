/**
 * 認証管理モジュール (js/auth.js)
 */

// パスワードと表示名の対応表
// ここに新しいユーザーを追加するだけでログインと名前表示が完結します
const USER_MAP = {
  "01-LastCrop": "ラスクロメンバー",
  "02-cocoa": "へべれけメンバー",
  "03-Snowknight": "スノウナイトメンバー",
  "04-Smile": "Smileメンバー",
};

// パスワード管理
export const PASSWORDS = {
  USER: Object.keys(USER_MAP),
  ADMIN: "04umasaba-Observers",
};

/**
 * ログイン実行
 */
export function login(inputPass) {
  if (PASSWORDS.USER.includes(inputPass)) {
    sessionStorage.setItem("auth_role", "user");
    // 対応する名前を保存
    sessionStorage.setItem("user_name", USER_MAP[inputPass]);
    window.location.href = "index.html";
  } else if (inputPass === PASSWORDS.ADMIN) {
    sessionStorage.setItem("auth_role", "admin");
    sessionStorage.setItem("user_name", "管理者");
    window.location.href = "admin.html";
  } else {
    alert("パスワードが違います");
  }
}

/**
 * 権限チェック
 */
export function checkAuth(requiredRole = null) {
  const currentRole = sessionStorage.getItem("auth_role");
  if (!currentRole) {
    window.location.href = "login.html";
    return false;
  }
  if (requiredRole === "admin" && currentRole !== "admin") {
    alert("管理者権限が必要です");
    window.location.href = "index.html";
    return false;
  }
  return true;
}

/**
 * ログアウト
 */
export function logout() {
  sessionStorage.clear();
  window.location.href = "login.html";
}
