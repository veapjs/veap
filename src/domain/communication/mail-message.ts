/**
 * Transport-agnostic mail DTOs.
 *
 * These are the *only* types a mail transport adapter is allowed to require:
 * the port (`IMailer`) speaks this vocabulary, never a concrete provider's
 * (Nodemailer, SES, Postmark, Resend…). Adapters map `MailMessage` onto their
 * own SDK types - that mapping is precisely what makes an adapter an adapter.
 */

/** A named email address, e.g. `{ name: "Veap", address: "noreply@app.dev" }`. */
export interface MailAddress {
  name?: string;
  address: string;
}

/** A file attached to the message. */
export interface MailAttachment {
  filename?: string;
  /** Inline content (string or Buffer). Mutually exclusive with `path`. */
  content?: string | Buffer;
  /** File path to read the attachment from. Mutually exclusive with `content`. */
  path?: string;
  contentType?: string;
  /** Content-ID for inline images referenced from HTML (`cid:`). */
  cid?: string;
  encoding?: string;
}

/** An address or a plain string address. */
export type MailRecipient = string | MailAddress;

/**
 * The framework's mail message.
 *
 * Intentionally minimal and framework-neutral: a transport adapter maps it
 * onto its provider's native shape. Anything provider-specific (SES
 * `SourceArn`, Postmark `Metadata`, Resend tags…) belongs to adapter
 * configuration, not to this contract.
 */
export interface MailMessage {
  /** Primary recipient(s). */
  to: MailRecipient | MailRecipient[];
  subject: string;
  /** Plain-text body. */
  text?: string;
  /** HTML body. At least one of `text` / `html` should be present. */
  html?: string;
  /** Overrides the transport's default sender (e.g. `MAIL_FROM_ADDRESS`). */
  from?: MailRecipient;
  cc?: MailRecipient | MailRecipient[];
  bcc?: MailRecipient | MailRecipient[];
  replyTo?: MailRecipient;
  attachments?: MailAttachment[];
  priority?: "high" | "normal" | "low";
  /** Custom message headers. */
  headers?: Record<string, string>;
}
