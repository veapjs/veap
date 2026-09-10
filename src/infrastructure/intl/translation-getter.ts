import { cookies } from "next/headers";
import { createTranslator } from "../../application/intl/translator";
import { getIntlConfig } from "./config";
import { detectLocale } from "./detection";
import { getMessages } from "./loader";

export async function getTranslation(
  localeOverride?: string,
  timeZoneOverride?: string,
) {
  const {
    cookie: cookieName,
    default: defaultLocale,
    locales,
    timeZone: defaultTimeZone,
  } = await getIntlConfig();

  let locale = localeOverride;
  const timeZone = timeZoneOverride || defaultTimeZone;

  if (!locale) {
    try {
      const cookieStore = await cookies();
      const cookieValue = cookieStore.get(cookieName)?.value;

      if (cookieValue && locales.includes(cookieValue)) {
        locale = cookieValue;
      } else {
        locale = await detectLocale(locales, defaultLocale);
      }
    } catch (_e) {
      locale = defaultLocale;
    }
  }

  const activeLocale = locale || defaultLocale || "en";

  // If paths haven't been registered yet, we might be in a race condition.
  // In a real production app, we might want to have a deterministic way to load these.
  const messages = await getMessages(activeLocale);

  return createTranslator({ messages, locale: activeLocale, timeZone });
}
