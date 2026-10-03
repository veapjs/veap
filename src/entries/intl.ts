// Client API Entrypoint for the Intl module.

export * from "../application/intl/translator";
export * from "../domain/intl/constants";
export * from "../domain/intl/types";
export {
  I18nProvider,
  useLocale,
  useSupportedLocales,
  useTimeZone,
  useTranslation,
  useTranslations,
} from "../presentation/intl/client";
