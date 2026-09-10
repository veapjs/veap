import { AppError } from "../../domain/errors/app-error";
import { warn } from "../../infrastructure/logging";
import { IntlMessageFormat } from "intl-messageformat";
import type {
  AbstractIntlMessages,
  CoercibleDate,
  TranslationKeys,
} from "../../domain/intl/types";
import { IN_MS } from "../../domain/intl/constants";

export function getNestedMessage(
  messages: AbstractIntlMessages | undefined,
  path: string,
): string | AbstractIntlMessages | undefined {
  if (!messages) return undefined;

  // Try direct match first (optimization + exact match with dots)
  if (path in messages) return messages[path];

  const parts = path.split(".");
  let current: any = messages;

  let i = 0;
  while (i < parts.length) {
    if (typeof current !== "object" || current === null) return undefined;

    // Try to match longest possible key from current position
    let found = false;
    for (let j = parts.length; j > i; j--) {
      const keyAttempt = parts.slice(i, j).join(".");
      if (keyAttempt in current) {
        current = current[keyAttempt];
        i = j;
        found = true;
        break;
      }
    }

    if (!found) {
      // If we can't match anything, check if we are at the end and looking for a partial key?
      // But strictly, we failed to traverse.
      return undefined;
    }
  }

  return current;
}

export function formatMessage(
  message: string,
  values?: Record<string, any>,
  locale: string = "en",
): string {
  if (!values || Object.keys(values).length === 0) return message;

  try {
    const formatter = new IntlMessageFormat(message, locale);
    return formatter.format(values) as string;
  } catch (error) {
    warn("veap:Intl", `Error formatting message: ${message}`, error);
    return message;
  }
}

/**
 * Identity function used as a marker for static analysis tools to extract
 * translation keys that are defined as plain strings but translated later.
 */
export const i18n = (key: string): string => key;

export const createTranslator = ({
  messages,
  locale,
  timeZone,
}: {
  messages: AbstractIntlMessages;
  locale: string;
  timeZone?: string;
}) => {
  return {
    t: createTextFormatter({ messages, locale }),
    text: createTextFormatter({ messages, locale }),
    date: createDateFormatter({ locale, timeZone }),
    relativeTime: createRelativeTimeFormatter({ locale, timeZone }),
    locale,
    timeZone,
  };
};

export function coerceDate(date: CoercibleDate): Date {
  if (date instanceof Date) {
    return date;
  }

  if (typeof date === "string" || typeof date === "number") {
    return new Date(date);
  }

  throw AppError.Internal(
    `Invalid date: expected Date, string, or number, but received value "${date}" of type "${typeof date}"`,
  );
}

export function createTextFormatter({
  messages,
  locale,
}: {
  messages: AbstractIntlMessages;
  locale: string;
}) {
  return (key: TranslationKeys, values?: Record<string, any>) => {
    const message = getNestedMessage(messages, String(key));

    //If no translation found, return the key
    if (typeof message !== "string") {
      return formatMessage(key, values, locale);
    }

    return formatMessage(message, values, locale);
  };
}

export function createDateFormatter({
  locale,
  timeZone,
}: {
  locale: string;
  timeZone?: string;
}) {
  return (date: CoercibleDate, options?: Intl.DateTimeFormatOptions) => {
    const baseOptions: Intl.DateTimeFormatOptions = options ?? {
      year: "numeric",
      month: "short",
      day: "numeric",
    };

    const finalOptions: Intl.DateTimeFormatOptions = {
      ...(timeZone ? { timeZone } : {}),
      ...baseOptions,
    };

    return new Intl.DateTimeFormat(locale, finalOptions).format(
      coerceDate(date),
    );
  };
}

export function createRelativeTimeFormatter({
  locale,
  timeZone,
}: {
  locale: string;
  timeZone?: string;
}) {
  return (
    rawDate: CoercibleDate,
    {
      now = new Date(),
      numeric = "auto",
      style = "long",
      timeZone: customTimeZone = timeZone,
    }: {
      now?: Date;
      numeric?: "auto" | "always";
      style?: "long" | "short";
      timeZone?: string;
    } = {},
  ) => {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric, style });

    const date = coerceDate(rawDate);
    let msDiff = now.getTime() - date.getTime();

    // If date is slightly in the future (e.g. up to 10 seconds ahead due to clock skew or execution latency),
    // treat it as 0 ms (present).
    if (msDiff < 0 && msDiff > -10_000) {
      msDiff = 0;
    }

    const absDiff = Math.abs(msDiff);
    const sign = msDiff >= 0 ? -1 : 1;

    if (absDiff < IN_MS.MINUTE) {
      return formatter.format(sign * Math.round(absDiff / 1_000), "second");
    }

    if (absDiff < IN_MS.HOUR) {
      return formatter.format(
        sign * Math.round(absDiff / IN_MS.MINUTE),
        "minute",
      );
    }

    if (absDiff < IN_MS.DAY) {
      return formatter.format(sign * Math.round(absDiff / IN_MS.HOUR), "hour");
    }

    if (absDiff < IN_MS.WEEK) {
      return formatter.format(sign * Math.round(absDiff / IN_MS.DAY), "day");
    }

    if (absDiff < IN_MS.MONTH) {
      return formatter.format(sign * Math.round(absDiff / IN_MS.WEEK), "week");
    }

    if (absDiff < IN_MS.YEAR) {
      return formatter.format(
        sign * Math.round(absDiff / IN_MS.MONTH),
        "month",
      );
    }

    return formatter.format(sign * Math.round(absDiff / IN_MS.YEAR), "year");
  };
}
