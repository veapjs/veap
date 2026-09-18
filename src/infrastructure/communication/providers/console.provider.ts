import type { IMailer } from "../../../domain/communication/mailer";
import type { MailMessage } from "../../../domain/communication/mail-message";

/**
 * Console transport implementing the {@link IMailer} port.
 *
 * A pure delivery service for development and testing: prints the
 * `MailMessage` instead of dialling an SMTP server. Selected with
 * `MAIL_TRANSPORT=console`. It knows nothing about message semantics -
 * content comes fully built from the mailables.
 */
export class ConsoleMailService implements IMailer {
  constructor(private readonly log: (line: string) => void = console.info) {}

  public async sendMail(message: MailMessage): Promise<void> {
    const to = Array.isArray(message.to)
      ? message.to
          .map((r) => (typeof r === "string" ? r : r.address))
          .join(", ")
      : typeof message.to === "string"
        ? message.to
        : message.to.address;

    this.log(
      [
        `📬 [MAIL:console] to=${to}`,
        `subject="${message.subject}"`,
        message.text ? `text="${message.text}"` : null,
        message.html ? `(html ${message.html.length} bytes)` : null,
        message.attachments?.length
          ? `(attachments: ${message.attachments.length})`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}
