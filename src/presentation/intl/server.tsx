import { cookies } from "next/headers";
import React, { type PropsWithChildren } from "react";
import { I18nProvider as ClientProvider } from "./client";
import { getIntlConfig } from "../../infrastructure/intl/config";
import { detectLocale } from "../../infrastructure/intl/detection";
import { getMessages } from "../../infrastructure/intl/loader";

/**
 * Smart Server Component that handles locale detection and message loading automatically.
 */
export async function I18nProvider({ children }: PropsWithChildren) {
  const {
    cookie: cookieName,
    default: defaultLocale,
    locales,
    timeZone,
  } = await getIntlConfig();

  let locale: string;

  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(cookieName)?.value;

    if (cookieValue && locales.includes(cookieValue)) {
      locale = cookieValue;
    } else {
      // Automatic detection if no cookie or invalid cookie
      locale = await detectLocale(locales, defaultLocale);
    }
  } catch (_e) {
    // Fallback for build time or static generation
    locale = defaultLocale;
  }

  const messages = await getMessages(locale);

  return React.createElement(
    ClientProvider,
    { locale, locales, messages, timeZone },
    children,
  );
}
