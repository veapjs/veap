import { ConfigService } from "../config/config.service";
import { logger } from "../logging/console-logger";
import { getTranslation } from "../intl/translation-getter";
import { ServiceProvider } from "../providers/service-provider";
import { bindCommunicationContext } from "../../application/communication/context";
import type { IMailer } from "../../domain/communication/mailer";
import { CUSTOM_MAILER, MAILER } from "../../domain/communication/mailer";
import { ConsoleMailService } from "./providers/console.provider";
import { NodemailerMailService } from "./providers/nodemailer.provider";
import { setMailTranslatorFactory } from "../../application/communication/translator";

/**
 * Composition root of the communication context.
 *
 * Selects the mail transport exactly once (in `boot()`) from `MAIL_TRANSPORT`
 * and binds it into `CommunicationContext`, so facades and services never
 * look transports up themselves:
 *
 * - `smtp` (default) - Nodemailer (`MAIL_SERVICE`, `MAIL_USERNAME`/`MAIL_PASSWORD`
 *   or `GOOGLE_SMTP_APP_*`, `MAIL_FROM_ADDRESS`)
 * - `console` - logs the message; dev/test with zero mail configuration
 * - `custom` - resolves `CUSTOM_MAILER`; bring your own SES/Postmark/Resend…
 */
export class CommunicationServiceProvider extends ServiceProvider {
  register(): void {
    // Default registration: the Nodemailer transport under the port token,
    // with config getters wired here at the composition root (the adapter
    // itself takes plain functions, so it stays container-agnostic).
    // Replaced with a `useValue` binding in `boot()` when MAIL_TRANSPORT
    // selects another transport.
    this.container.register({
      token: MAILER,
      useFactory: (config: ConfigService) =>
        new NodemailerMailService({
          getService: () => config.get("MAIL_SERVICE"),
          getUsername: () =>
            config.get("GOOGLE_SMTP_APP_USERNAME") ??
            config.get("MAIL_USERNAME"),
          getPassword: () =>
            config.get("GOOGLE_SMTP_APP_PASSWORD") ??
            config.get("MAIL_PASSWORD"),
          getFromAddress: () => config.get("MAIL_FROM_ADDRESS"),
        }),
      inject: [ConfigService],
      singleton: true,
    });
  }

  async boot(): Promise<void> {
    // Bind the intl translation factory for transport templates (adapters
    // must not import the package's own entry points - ADR-006). It is
    // invoked per send, so the locale reflects the current request.
    setMailTranslatorFactory(async () => (await getTranslation()).t);

    const config = await this.container.resolve(ConfigService);
    const mailer = await this.selectTransport(config);

    // Rebind the port token to the selected transport and expose it through
    // the typed context boundary.
    this.container.register({
      token: MAILER,
      useValue: mailer,
      singleton: true,
    });
    bindCommunicationContext({ mailer });

    logger.debug(
      "veap:communication",
      `Mail transport bound: ${mailer.constructor.name}`,
    );
  }

  private async selectTransport(config: ConfigService): Promise<IMailer> {
    const transport = config.get("MAIL_TRANSPORT")?.trim().toLowerCase();

    if (transport === "custom") {
      if (!this.container.has(CUSTOM_MAILER)) {
        throw new Error(
          "[Communication] MAIL_TRANSPORT=custom but no provider is registered under the CUSTOM_MAILER token (register an IMailer in a ServiceProvider).",
        );
      }
      return this.container.resolve<IMailer>(CUSTOM_MAILER);
    }

    if (transport === "console") {
      return new ConsoleMailService((line) => logger.info("veap:mail", line));
    }

    // Default ("smtp" / unset): whatever register() wired - Nodemailer.
    return this.container.resolve<IMailer>(MAILER);
  }
}
