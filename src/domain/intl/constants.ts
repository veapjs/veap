/**
 * Default configuration for the intl package.
 * These values are used if no configuration is provided in veap.config.ts.
 */
export const DEFAULT_INTL_CONFIG = {
  cookie: "VEAP_LOCALE",
  default: "en",
  locales: ["en"],
  timeZone: "UTC",
} as const;

/**
 * Static constants for quick access.
 * Note: On the server, you should prefer using getIntlConfig() from veap/intl/server
 * to get the merged configuration from veap.config.ts.
 */
export const COOKIE_NAME = DEFAULT_INTL_CONFIG.cookie;
export const DEFAULT_LOCALE = DEFAULT_INTL_CONFIG.default;
export const LOCALES = DEFAULT_INTL_CONFIG.locales;

export const IN_MS = {
  SECOND: 1_000,
  MINUTE: 60_000, // 60 * 1_000
  HOUR: 3_600_000, // 60 * 60 * 1_000
  DAY: 86_400_000, // 24 * 60 * 60 * 1_000
  WEEK: 604_800_000, // 7 * 24 * 60 * 60 * 1_000
  MONTH: 2_630_016_000, // 30.44 * 24 * 60 * 60 * 1_000 -- approximation using average month length
  YEAR: 31_556_736_000, // 365.24 * 24 * 60 * 60 * 1_000 -- approximation using average year length
};
