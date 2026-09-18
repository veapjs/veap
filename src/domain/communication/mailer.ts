import type { MailMessage } from "./mail-message";

/**
 * Mailer port.
 *
 * A pure delivery service: it transmits `MailMessage`s and knows nothing
 * about *why* an email is being sent. Semantics - verification codes, resets,
 * 2FA, templates, i18n - belong to the domains that own those flows and are
 * expressed as mailables (`application/communication/mail.ts`), which build a
 * `MailMessage` and hand it to this port.
 *
 * This mirrors Laravel's split: `Transport` (the `MailManager`'s drivers)
 * only delivers a raw message, while `Mailable` classes define the content.
 */
export interface IMailer {
  /** Delivers a message. The single, transport-agnostic operation. */
  sendMail(message: MailMessage): Promise<void>;
}

/**
 * Injection token for the mailer port.
 *
 * A global symbol keeps the token stable across HMR / dual-package
 * boundaries, the same reason the container keys class tokens with
 * `Symbol.for(...)`.
 */
export const MAILER = Symbol.for("veap:communication:mailer");

/**
 * Injection token for a custom transport supplied by the host application.
 *
 * Set `MAIL_TRANSPORT=custom` and register an `IMailer` implementation under
 * this token (e.g. SES, Postmark, Resend, an outbox pattern…) to route all
 * mail through your own delivery system without touching the framework.
 */
export const CUSTOM_MAILER = Symbol.for("veap:communication:custom-mailer");
