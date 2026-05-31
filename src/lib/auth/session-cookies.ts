import { demoCookieName } from "@/lib/demo-auth";

export const AUTH_SESSION_COOKIES = [demoCookieName, "nf_org"] as const;

type CookieWriter = {
  cookies: {
    set: (name: string, value: string, options?: object) => void;
  };
};

export function appendClearAuthCookies(response: CookieWriter) {
  for (const name of AUTH_SESSION_COOKIES) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
}
