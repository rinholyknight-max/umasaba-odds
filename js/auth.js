/**
 * 認証管理モジュール (js/auth.js)
 */

// パスワードを一括管理
export const PASSWORDS = {
  // 配列にすることで、複数のパスワードを許可
  USER: ["01-LastCrop", "02-cocoa", "03-Snowknight", "04-Smile"],
  ADMIN: "04umasaba-Observers",
};

/**
 * ログイン実行
 */
export function login(inputPass) {
  // .includes() を使って、入力されたパスワードが配列内にあるかチェック
  if (PASSWORDS.USER.includes(inputPass)) {
    sessionStorage.setItem("auth_role", "user");
    window.location.href = "index.html";
  } else if (inputPass === PASSWORDS.ADMIN) {
    sessionStorage.setItem("auth_role", "admin");
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
