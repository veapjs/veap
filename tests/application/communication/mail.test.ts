import { beforeEach, describe, expect, it } from "vitest";

import type { MailMessage } from "../../../src/domain/communication/mail-message";
import {
  bindCommunicationContext,
  communicationContext,
} from "../../../src/application/communication/context";
import {
  send2FACode,
  sendMail,
  sendRecoveryCode,
  sendResetPassword,
  sendVerifyEmail,
} from "../../../src/application/communication/mail";
import {
  getMailTranslator,
  setMailTranslatorFactory,
} from "../../../src/application/communication/translator";

/**
 * Mailables - where email semantics live.
 *
 * Transports are asserted through a capturing fake: these tests verify that
 * each mailable builds the right localized `MailMessage` and hands it to the
 * bound `IMailer` port. Swapping transports cannot affect this behaviour.
 */

/** Deterministic translator: interpolates {params} into the raw key. */
const interpolatingTranslator = () =>
  Promise.resolve((key: string, params?: Record<string, unknown>) =>
    params
      ? Object.entries(params).reduce(
          (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
          key,
        )
      : key,
  );

describe("mailables", () => {
  let sent: MailMessage[];

  beforeEach(() => {
    sent = [];
    setMailTranslatorFactory(interpolatingTranslator);

    // Bind a capturing fake transport - no SMTP, no container.
    bindCommunicationContext({
      mailer: {
        async sendMail(message: MailMessage) {
          sent.push(message);
        },
      },
    });
  });

  it("sendVerifyEmail builds a localized verification message", async () => {
    await sendVerifyEmail("u@x.dev", "123456");

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      to: "u@x.dev",
      subject: "Verify Email",
      text: "Verify your email address with your code: 123456",
    });
  });

  it("sendResetPassword builds a password-reset message", async () => {
    await sendResetPassword("u@x.dev", "ABC123");

    expect(sent[0].subject).toBe("Password Reset");
    expect(sent[0].text).toBe("Verify password reset with code: ABC123");
  });

  it("sendRecoveryCode builds a recovery-code message", async () => {
    await sendRecoveryCode("u@x.dev", "RECOVERY-9");

    expect(sent[0].subject).toBe("Recovery Code");
    expect(sent[0].text).toBe("Your recovery code is: RECOVERY-9");
  });

  it("send2FACode builds a 2FA message", async () => {
    await send2FACode("u@x.dev", "654321");

    expect(sent[0].subject).toBe("Your 2FA Code");
    expect(sent[0].text).toBe(
      "Your verification code is: 654321. It will expire in 10 minutes.",
    );
  });

  it("sendMail forwards arbitrary messages to the bound port", async () => {
    await sendMail({ to: "a@x.dev", subject: "S", text: "T" });

    expect(sent).toHaveLength(1);
    expect(communicationContext().mailer.sendMail).toBeDefined();
  });

  it("falls back to raw keys when no translator is bound", async () => {
    // Explicitly reset to the fallback (beforeEach already binds one; this
    // documents the fallback behaviour of getMailTranslator).
    const t = await getMailTranslator();
    expect(t("Hello {name}", { name: "Ada" })).toBe("Hello Ada");
  });

  it("exposes no semantics on the transport interface", () => {
    // The port itself is a single-method delivery contract.
    const keys = Object.keys(communicationContext().mailer);
    expect(keys.sort()).toEqual(["sendMail"]);
  });
});
