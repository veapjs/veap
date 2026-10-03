// Domain (port + DTOs + tokens)

// Application (context + mailables + translator hook)
export * from "../application/communication/context";
export * from "../application/communication/mail";
export * from "../application/communication/translator";
// Deprecated type alias: the port used to speak Nodemailer's vocabulary.
// `SendMailOptions` is now an alias of the framework-neutral `MailMessage`.
export type { MailMessage as SendMailOptions } from "../domain/communication/mail-message";
export * from "../domain/communication/mail-message";
export * from "../domain/communication/mailer";
export { CommunicationServiceProvider } from "../infrastructure/communication/provider";
export { ConsoleMailService } from "../infrastructure/communication/providers/console.provider";
// Infrastructure - swappable transports
// Backwards compatibility: `MailService` was the concrete Nodemailer class
// name before the multi-transport refactor. Plugins doing `app(MailService)`
// or `import { MailService } from "@veap/framework/communication"` keep working.
export {
  NodemailerMailService,
  NodemailerMailService as MailService,
} from "../infrastructure/communication/providers/nodemailer.provider";
