import { getVeapConfig } from "../config/config.loader";
import { DEFAULT_INTL_CONFIG } from "../../domain/intl/constants";

/**
 * Loads the intl configuration by merging the defaults with values from veap.config.ts.
 * SERVER ONLY.
 */
export async function getIntlConfig() {
  const config = await getVeapConfig();

  return {
    cookie:
      process.env.VEAPCONFIG_INTL_COOKIE ||
      process.env.NEXT_PUBLIC_INTL_COOKIE ||
      config.intl?.cookie ||
      DEFAULT_INTL_CONFIG.cookie,
    default:
      process.env.VEAPCONFIG_INTL_DEFAULT ||
      process.env.NEXT_PUBLIC_INTL_DEFAULT ||
      config.intl?.default ||
      DEFAULT_INTL_CONFIG.default,
    locales: (config.intl?.locales || DEFAULT_INTL_CONFIG.locales) as string[],
    timeZone:
      process.env.VEAPCONFIG_INTL_TIMEZONE ||
      process.env.NEXT_PUBLIC_INTL_TIMEZONE ||
      process.env.NEXT_PUBLIC_TIMEZONE ||
      config.intl?.timeZone ||
      process.env.TZ ||
      DEFAULT_INTL_CONFIG.timeZone,
  };
}

/**
 * Returns a list of all supported locales.
 * SERVER ONLY.
 */
export async function getSupportedLocales() {
  const config = await getIntlConfig();
  return config.locales;
}

/**
 * Returns the default locale.
 * SERVER ONLY.
 */
export async function getDefaultLocale() {
  const config = await getIntlConfig();
  return config.default;
}

/**
 * Returns the default time zone.
 * SERVER ONLY.
 */
export async function getDefaultTimeZone() {
  const config = await getIntlConfig();
  return config.timeZone;
}
