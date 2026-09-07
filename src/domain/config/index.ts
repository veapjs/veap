export interface VeapConfig {
  /**
   * Prefix for all administrative routes.
   * Default: "/app"
   */
  privatePath?: string;

  intl?: {
    /**
     * The name of the cookie that stores the user's locale.
     * Default: "VEAP_LOCALE"
     */
    cookie?: string;
    /**
     * The default locale to use if none is provided.
     * Default: "en"
     */
    default?: string;
    /**
     * A list of all available locales.
     * Default: ["en", "de", "fr", "es", "it", "ja", "ko", "pt", "ru", "zh"]
     */
    locales?: string[];
    /**
     * The default timezone to use for date and relative time formatting.
     * Default: "UTC"
     */
    timeZone?: string;
  };
  debug?: boolean;
}

export const DEFAULT_CONFIG: VeapConfig = {
  privatePath: "/app",
};
