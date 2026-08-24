import { demoCookieName } from "@/lib/demo-auth";

export const ACTIVE_ORG_COOKIE = "nf_org";

export const AUTH_SESSION_COOKIES = [demoCookieName, ACTIVE_ORG_COOKIE] as const;

/** Compartido por `/api/auth/set-org` y por el alta: la organización activa se
 *  fija igual venga del selector o de crear la empresa en el registro. */
export function activeOrgCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 365 * 24 * 3600,
    secure: process.env.NODE_ENV === "production",
  };
}

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
