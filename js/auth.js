// パスワードをここで一括管理！
export const PASSWORDS = {
  USER: "asahihai",
  ADMIN: "admin_yuya",
};

export function login(inputPass) {
  if (inputPass === PASSWORDS.USER) {
    sessionStorage.setItem("auth_role", "user");
    window.location.href = "index.html";
  } else if (inputPass === PASSWORDS.ADMIN) {
    sessionStorage.setItem("auth_role", "admin");
    window.location.href = "admin.html";
  } else {
    alert("パスワードが違います");
  }
}
