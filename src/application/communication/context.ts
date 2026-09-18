import { AppError } from "../../domain/errors/app-error";
import type { IMailer } from "../../domain/communication/mailer";

/**
 * Typed boundary between the communication use cases and their consumers
 * (facades, application services). The same pattern as
 * `application/auth/context.ts` and `application/plugins/context.ts`.
 *
 * The composition root (`CommunicationServiceProvider`) selects the mail
 * transport once at boot and binds it here.
 */
export interface CommunicationContext {
  mailer: IMailer;
}

const globalForCommunicationContext = globalThis as unknown as {
  __VEAP_COMMUNICATION_CONTEXT__?: CommunicationContext;
};

/**
 * Binds the resolved communication services. Called once by the composition root.
 */
export function bindCommunicationContext(context: CommunicationContext): void {
  globalForCommunicationContext.__VEAP_COMMUNICATION_CONTEXT__ = context;
}

/**
 * Returns the bound communication services.
 *
 * @throws If the communication service provider has not booted yet.
 */
export function communicationContext(): CommunicationContext {
  const context = globalForCommunicationContext.__VEAP_COMMUNICATION_CONTEXT__;
  if (!context) {
    throw AppError.Internal(
      "[Communication] Context is not bound. CommunicationServiceProvider must boot before the communication facades are used.",
    );
  }
  return context;
}
