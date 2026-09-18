import type { MailMessage } from "../../domain/communication/mail-message";
import { communicationContext } from "./context";
import { getMailTranslator } from "./translator";

/**
 * Mailables - the domain vocabulary of email.
 *
 * Transports deliver; mailables decide *what* is sent. Each helper builds a
 * `MailMessage` (localized via the injected translator) and hands it to the
 * bound `IMailer` port. This is the Laravel split: `Mailable` defines the
 * content, `Transport` only delivers it - a transport never knows whether it
 * is carrying a verification code or a newsletter.
 *
 * Application services (auth flows) and plugins call these helpers; swapping
 * the transport never touches them, and adding a new mail kind never touches
 * a transport.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  return communicationContext().mailer.sendMail(message);
}

export async function sendVerifyEmail(email: string, code: string) {
  const t = await getMailTranslator();
  return sendMail({
    to: email,
    subject: t("Verify Email"),
    text: t("Verify your email address with your code: {code}", { code }),
  });
}

export async function sendResetPassword(email: string, code: string) {
  const t = await getMailTranslator();
  return sendMail({
    to: email,
    subject: t("Password Reset"),
    text: t("Verify password reset with code: {code}", { code }),
  });
}

export async function sendRecoveryCode(email: string, recoveryCode: string) {
  const t = await getMailTranslator();
  return sendMail({
    to: email,
    subject: t("Recovery Code"),
    text: t("Your recovery code is: {recoveryCode}", { recoveryCode }),
  });
}

export async function send2FACode(email: string, code: string) {
  const t = await getMailTranslator();
  return sendMail({
    to: email,
    subject: t("Your 2FA Code"),
    text: t(
      "Your verification code is: {code}. It will expire in 10 minutes.",
      {
        code,
      },
    ),
  });
}
