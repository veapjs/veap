import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { cookies, headers } from "next/headers";
import { getIntlConfig } from "./config";

export async function detectLocale(
  supportedLocales: string[],
  defaultLocale: string,
) {
  try {
    const headerList = await headers();
    const languages = new Negotiator({
      headers: Object.fromEntries(headerList.entries()),
    }).languages();

    return match(languages, supportedLocales, defaultLocale);
  } catch (_e) {
    // Fallback for build time or environments where headers are unavailable
    return defaultLocale;
  }
}

export async function getCurrentLocale() {
  const {
    cookie: cookieName,
    default: defaultLocale,
    locales,
  } = await getIntlConfig();
  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(cookieName)?.value;

    if (cookieValue && locales.includes(cookieValue)) {
      return cookieValue;
    }

    return await detectLocale(locales, defaultLocale);
  } catch (_e) {
    // Fallback for environments where cookies/headers are not available
    return defaultLocale;
  }
}
