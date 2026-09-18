// Note: intentionally no `server-only` import here - this file must stay
// importable from plain Node (unit tests, CLI, non-Next hosts). Client bundles
// never reach it because the communication entry is a server entry.
import type { SendMailOptions, Transporter } from "nodemailer";
import nodemailer from "nodemailer";

import type { IMailer } from "../../../domain/communication/mailer";
import type {
  MailMessage,
  MailRecipient,
} from "../../../domain/communication/mail-message";

/**
 * SMTP transport (Nodemailer) implementing the {@link IMailer} port.
 *
 * A pure delivery service: takes `MailMessage`s and transmits them. It knows
 * nothing about verification codes, resets or i18n - content is decided by
 * the mailables in `application/communication/mail.ts` (the Laravel split:
 * `Mailable` = content, `Transport` = delivery).
 *
 * The only place in the codebase that knows Nodemailer exists; Nodemailer's
 * field names are a superset of the DTO, so mapping is one spread plus a
 * default sender.
 */
export class NodemailerMailService implements IMailer {
  private transporter: Transporter;
  private fromAddress: MailRecipient;

  constructor(config: {
    getService: () => string;
    getUsername: () => string | undefined;
    getPassword: () => string | undefined;
    getFromAddress: () => string | undefined;
  }) {
    this.fromAddress =
      config.getFromAddress() ||
      (config.getUsername() ? `Veap <${config.getUsername()}>` : "Veap");

    this.transporter = nodemailer.createTransport({
      service: config.getService(),
      auth: {
        user: config.getUsername(),
        pass: config.getPassword(),
      },
    });
  }

  /** The sender used when a message does not specify one. */
  public get defaultFrom(): MailRecipient {
    return this.fromAddress;
  }

  /** Exposed for tests and provider-agnostic integrations. */
  public toSendMailOptions(message: MailMessage): SendMailOptions {
    return {
      ...message,
      from: message.from ?? this.fromAddress,
    };
  }

  public async sendMail(message: MailMessage): Promise<void> {
    await this.transporter.sendMail(this.toSendMailOptions(message));
  }
}
