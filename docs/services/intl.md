# Internationalization (intl)

Veap bundles an intl system with server-side locale detection, message loading from core, plugins, templates and the application, and typed translation helpers for both server and client.

## Configuration

Intl options live in `veap.config.ts` under `intl`:

```ts
import type { VeapConfig } from "@veap/framework/core";

const config: VeapConfig = {
  intl: {
    cookie: "VEAP_LOCALE", // cookie storing the chosen locale
    default: "en", // fallback locale
    locales: ["en", "pl"], // supported locales
    timeZone: "Europe/Warsaw", // default for date/relative formatting
  },
};
```

Environment variables override config values: `VEAPCONFIG_INTL_COOKIE`, `VEAPCONFIG_INTL_DEFAULT`, `VEAPCONFIG_INTL_TIMEZONE` (plus `NEXT_PUBLIC_*` variants and `TZ` for the time zone). Defaults: cookie `VEAP_LOCALE`, locale `en`, list `["en"]`, time zone `UTC`.

## Server usage

`I18nProvider` from `@veap/framework/intl/server` is an async Server Component: it detects the locale (cookie first, then `Accept-Language` negotiation, then default), loads messages and renders the client provider:

```tsx
// app/layout.tsx (generated for you)
import { I18nProvider } from "@veap/framework/intl/server";

<I18nProvider>{children}</I18nProvider>;
```

For translations outside the React tree (Server Actions, route handlers, mailables):

```ts
import { getTranslation } from "@veap/framework/intl/server";

const { t, date, relativeTime, locale } = await getTranslation();
t("Welcome back, {name}", { name: user.name });
```

`getTranslation(localeOverride?, timeZoneOverride?)` follows the same detection chain; the mail translator used by mailables is wired to it.

## Client usage

Inside the provider tree, the client entry gives hooks:

```tsx
"use client";

import {
  useTranslation,
  useLocale,
  useSupportedLocales,
} from "@veap/framework/intl";

export function Greeting() {
  const { t, date, relativeTime } = useTranslation();
  const locale = useLocale();

  return (
    <p>
      {t("Hello!")}
      {date(new Date())}
      {relativeTime(someDate)} // "3 minutes ago"
    </p>
  );
}
```

Hooks throw if rendered outside `I18nProvider`. `useTranslation` returns the translator created from the provider's messages, locale and time zone.

## Message sources and precedence

`IntlService.getMessages(locale)` deep-merges, in order (later wins):

1. Messages registered programmatically (`registerMessages(locale, dict)`).
2. Core dictionaries (built-in `en`, `pl`).
3. Every registered plugin's `locales[locale]` loader.
4. Templates' locale loaders (via the same `locales` record on `ITemplate`).
5. Application files: `locales/<locale>.json` in the project root (plus any extra directories passed to `getMessages`).

A missing key renders the key itself (or the key with `{param}` interpolation when values are passed), so development never blocks on missing translations.

## Message format

Values use `intl-messageformat` (ICU):

```json
{
  "cart": {
    "items": "{count, plural, =0 {Your cart is empty} one {# item} other {# items}}",
    "since": "Member since {joined, date, short}"
  }
}
```

`t("cart.items", { count: 3, joined: someDate })` formats with the active locale.

## Locale switching

Write the configured cookie (`VEAP_LOCALE` by default) with a supported locale value; detection picks it up on the next request. The panel plugin ships a language switcher doing exactly this (`useLocale`/`useSupportedLocales` on the client, cookie write server-side).

## Typing keys

`TranslationKeys` derives nested dot-paths from an `IntlMessages` global interface; augment it from your application to get key completion:

```ts
declare global {
  interface IntlMessages {
    home: { hero: string };
  }
}
```

## Date and relative time

The translator exposes `date(date, options?)` (Intl.DateTimeFormat with the configured time zone) and `relativeTime(date, { now?, numeric?, style? })` (Intl.RelativeTimeFormat with sensible unit thresholds). Both accept `Date`, ISO strings or timestamps.
