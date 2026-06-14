import { NextResponse } from "next/server";

export const config = {
  // Basic認証を適用したいフォルダを指定（今回は /special 以下のすべて）
  matcher: ["/special/:path*"],
};

export function middleware(req) {
  const basicAuth = req.headers.get("authorization");
  const url = req.nextUrl;

  // 💡 ここに設定したい「ユーザー名」と「パスワード」を入力してください
  const USERNAME = "umasaba-4th"; // 好きなユーザー名に変更
  const PASSWORD = "umasaba-4th"; // 好きなパスワードに変更

  if (basicAuth) {
    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");

    if (user === USERNAME && pwd === PASSWORD) {
      return NextResponse.next();
    }
  }

  url.pathname = "/api/auth";
  return new NextResponse("Auth Required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}
