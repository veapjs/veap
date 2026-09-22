import type EnLocale from "./locales/en";

type JsonDataType = typeof EnLocale;

export interface IntlMessages extends JsonDataType {}

export type CoercibleDate = Date | string | number;

/**
 * Global namespace augmentation for translation messages.
 */
declare global {
  interface IntlMessages {}
}

/**
 * Extend VeapConfig from veap/core with intl-specific options.
 */
declare module "@veap/framework/core" {
  export interface VeapConfig {
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
       * Default: ["en", "pl"]
       */
      locales?: string[];
      /**
       * The default timezone to use for date and relative time formatting.
       * Default: "UTC"
       */
      timeZone?: string;
    };
  }
}

export type AbstractIntlMessages = Record<string, any>;

/**
 * Recursive type to get all nested keys joined by dots.
 */
export type NestedKeyOf<ObjectType> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

/**
 * Gets translation keys for a specific namespace or all keys if none is provided.
 */
export type TranslationKeys<N = undefined> = N extends keyof IntlMessages
  ? NestedKeyOf<IntlMessages[N]> | (string & {})
  : NestedKeyOf<IntlMessages> | (string & {});
