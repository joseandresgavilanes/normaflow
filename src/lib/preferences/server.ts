import { cookies } from "next/headers";
import {
  DATE_FORMAT_COOKIE, HOME_COOKIE, MOTION_COOKIE, PRIVATE_MODE_COOKIE, TIME_ZONE_COOKIE,
  readHomePreference, readMotionPreference, readPrivateMode,
  type HomeOption, type MotionPreference,
} from "./config";
import { readDateFormat, readTimeZone, type DateFormatStyle } from "@/lib/format/datetime";

export type ServerPreferences = {
  home: HomeOption;
  privateMode: boolean;
  motion: MotionPreference;
  timeZone: string;
  dateFormat: DateFormatStyle;
};

/**
 * Preferencias resueltas en el servidor.
 *
 * Igual que el tema y el idioma: se leen aquí y se pintan en el HTML inicial,
 * así el modo privado no destella con los datos visibles durante un instante
 * —que es justo lo que ese modo existe para evitar.
 */
export async function getServerPreferences(): Promise<ServerPreferences> {
  const cookieStore = await cookies();
  return {
    home: readHomePreference(cookieStore.get(HOME_COOKIE)?.value),
    privateMode: readPrivateMode(cookieStore.get(PRIVATE_MODE_COOKIE)?.value),
    motion: readMotionPreference(cookieStore.get(MOTION_COOKIE)?.value),
    timeZone: readTimeZone(cookieStore.get(TIME_ZONE_COOKIE)?.value),
    dateFormat: readDateFormat(cookieStore.get(DATE_FORMAT_COOKIE)?.value),
  };
}
