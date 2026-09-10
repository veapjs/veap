# Mail

Veap's mail system separates _what_ is sent from _how_ it is delivered, following the Laravel split. A `MailMessage` is a transport-agnostic DTO; transports deliver it; mailables build semantic messages; the transport is selected once at boot from `MAIL_TRANSPORT`.

## Sending mail: mailables

Application code almost never constructs raw messages. Use the mailable helpers from `@veap/core/communication`:

```ts
import {
  sendMail,
  sendVerifyEmail,
  sendResetPassword,
  sendRecoveryCode,
  send2FACode,
} from "@veap/core/communication";

await sendVerifyEmail("user@example.com", "ABC123"); // localized verification mail
await sendResetPassword("user@example.com", "XYZ789");
await sendRecoveryCode("user@example.com", "RECOVERY-CODE");
await send2FACode("user@example.com", "123456");
```

Mailables translate subject and body through the intl system (bound per send, so the locale reflects the current request) and hand a `MailMessage` to the configured transport.

## The MailMessage DTO

```ts
import type { MailMessage } from "@veap/core/communication";

await sendMail({
  to: "user@example.com", // string | MailAddress | arrays
  subject: "Invoice ready",
  text: "Your invoice is ready.",
  html: "<p>Your invoice is ready.</p>",
  from: { name: "Billing", address: "billing@acme.dev" }, // overrides transport default
  cc: "finance@acme.dev",
  bcc: [{ address: "archive@acme.dev" }],
  replyTo: "support@acme.dev",
  attachments: [
    { filename: "invoice.pdf", path: "./storage/invoices/inv-1.pdf" },
    { filename: "logo.png", content: buffer, cid: "logo" }, // inline via cid
  ],
  priority: "high",
  headers: { "X-Campaign": "welcome" },
});
```

The DTO is intentionally minimal; anything provider-specific (SES ARNs, Postmark metadata, Resend tags) belongs to your transport adapter's configuration, not to the contract.

## Transports

Selection happens in `CommunicationServiceProvider.boot()` from the `MAIL_TRANSPORT` environment variable:

| Value                   | Transport               | Notes                                                                                                                                         |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `smtp` (default, unset) | `NodemailerMailService` | configured by `MAIL_SERVICE`, `MAIL_USERNAME`/`MAIL_PASSWORD` (or `GOOGLE_SMTP_APP_USERNAME`/`GOOGLE_SMTP_APP_PASSWORD`), `MAIL_FROM_ADDRESS` |
| `console`               | `ConsoleMailService`    | logs the message to the server console; ideal for development and tests                                                                       |
| `custom`                | your transport          | resolves `CUSTOM_MAILER` from the container; fails fast if none registered                                                                    |

### Custom transport (SES, Postmark, Resend, ...)

Implement the `IMailer` port and register it under `CUSTOM_MAILER` in a service provider:

```ts
import type { IMailer, MailMessage } from "@veap/core/communication";
import { CUSTOM_MAILER } from "@veap/core/communication";
import { ServiceProvider } from "@veap/core/core/server";

export class SesMailService implements IMailer {
  async sendMail(message: MailMessage): Promise<void> {
    // map MailMessage onto the SES SDK and send
  }
}

export class MailServiceProvider extends ServiceProvider {
  register(): void {
    container.register({
      token: CUSTOM_MAILER,
      useValue: new SesMailService(),
    });
  }
}
```

```env
MAIL_TRANSPORT=custom
```

All mailables and `sendMail` calls route through your adapter. The same approach works for outbox patterns (store-and-forward) in tests.

## Environment variables

| Variable                                                | Purpose                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| `MAIL_TRANSPORT`                                        | `smtp` (default), `console`, `custom`                       |
| `MAIL_SERVICE`                                          | Nodemailer service name (default `gmail`)                   |
| `MAIL_USERNAME` / `MAIL_PASSWORD`                       | SMTP credentials                                            |
| `GOOGLE_SMTP_APP_USERNAME` / `GOOGLE_SMTP_APP_PASSWORD` | Google app-password variant (takes precedence)              |
| `MAIL_FROM_ADDRESS`                                     | default sender; falls back to `Veap <username>` then `Veap` |

## Facade notes

- `sendMail` (and every mailable) requires the communication provider to have booted; calling them before boot throws the context-not-bound error, same as other subsystems.
- The old concrete name `MailService` remains exported as an alias of `NodemailerMailService` for backwards compatibility; the `SendMailOptions` type is now an alias of `MailMessage`.
