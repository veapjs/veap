export interface SystemEventsMap {
  /**
   * Emitted when a plugin/component requests confirmation for a sensitive action.
   */
  "action:confirm:request": {
    requestId: string;
    action: string;
    title: string;
    description?: string;
    preferredMethod?: string;
    rememberMinutes?: number;
    metadata?: Record<string, any>;
  };

  /**
   * Emitted by the confirmation UI (e.g. ActionConfirmDialog) to acknowledge
   * receipt of an `action:confirm:request`. Indicates that a dialog will handle it.
   */
  "action:confirm:ack": {
    requestId: string;
  };

  /**
   * Emitted as a response to a confirmation request.
   */
  "action:confirm:response": {
    requestId: string;
    confirmed: boolean;
    method?: "password" | "passkey" | "2fa" | "totp" | "remembered" | string;
    metadata?: Record<string, any>;
  };

  [key: string]: any;
}

export interface SystemEvent<T = any> {
  type: string;
  payload: T;
  timestamp: number;
  source: string;
}

export type EventHandler<T = any> = (
  event: SystemEvent<T>,
) => Promise<void> | void;
