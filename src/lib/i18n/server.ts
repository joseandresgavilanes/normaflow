import { cookies, headers } from "next/headers";
import { detectLocale, LOCALE_COOKIE } from "./config";

export async function getServerLocale() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return detectLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );
}
