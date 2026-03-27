const PASSWORDS = {
  user: "1234", // 一般ユーザー用
  admin: "admin99", // 管理画面用
};

function checkAuth(type) {
  const session = sessionStorage.getItem(`auth_${type}`);
  if (session !== "true") {
    const input = prompt(`${type}パスワードを入力してください:`);
    if (input === PASSWORDS[type]) {
      sessionStorage.setItem(`auth_${type}`, "true");
    } else {
      alert("パスワードが違います。");
      window.location.href = "index.html";
    }
  }
}
