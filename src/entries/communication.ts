// Domain (port + DTOs + tokens)
export * from "../domain/communication/mailer";
export * from "../domain/communication/mail-message";

// Application (context + mailables + translator hook)
export * from "../application/communication/context";
export * from "../application/communication/mail";
export * from "../application/communication/translator";

// Infrastructure - swappable transports
export { NodemailerMailService } from "../infrastructure/communication/providers/nodemailer.provider";
export { ConsoleMailService } from "../infrastructure/communication/providers/console.provider";
export { CommunicationServiceProvider } from "../infrastructure/communication/provider";

// Backwards compatibility: `MailService` was the concrete Nodemailer class
// name before the multi-transport refactor. Plugins doing `app(MailService)`
// or `import { MailService } from "@veap/core/communication"` keep working.
export { NodemailerMailService as MailService } from "../infrastructure/communication/providers/nodemailer.provider";

// Deprecated type alias: the port used to speak Nodemailer's vocabulary.
// `SendMailOptions` is now an alias of the framework-neutral `MailMessage`.
export type { MailMessage as SendMailOptions } from "../domain/communication/mail-message";
