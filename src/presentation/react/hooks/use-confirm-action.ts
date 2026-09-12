"use client";

import { eventBus } from "../../../application/events/event-bus";
import { useCallback, useEffect, useRef } from "react";

type ConfirmOptions = {
  action?: string;
  title?: string;
  description?: string;
  preferredMethod?: string;
  rememberMinutes?: number;
  metadata?: Record<string, any>;
};

type ConfirmResult = {
  confirmed: boolean;
  method?: string;
};

type PendingEntry = {
  resolve: (result: ConfirmResult) => void;
  timeout: ReturnType<typeof setTimeout>;
};

/**
 * Hook for confirming sensitive actions via password/passkey.
 *
 * If the action-confirm plugin is enabled, shows an action verification dialog.
 * If it's disabled, falls back to the native browser confirm().
 *
 * Usage:
 * ```tsx
 * const confirmAction = useConfirmAction();
 *
 * const { confirmed } = await confirmAction({
 *   action: "plugin:toggle",
 *   title: "Zatwierdź zmianę stanu wtyczki",
 *   rememberMinutes: 5, // Zapamiętaj na 5 minut!
 * });
 * if (confirmed) { await togglePlugin(); }
 * ```
 */
export function useConfirmAction() {
  const pendingRequests = useRef<Map<string, PendingEntry>>(new Map());

  const subscriberId = useRef(
    `use-confirm-action-${Math.random().toString(36).slice(2, 9)}`,
  ).current;

  // Listen for full responses (from the action-confirm dialog)
  useEffect(() => {
    const responseHandler = (event: any) => {
      const { requestId, confirmed, method } = event.payload;
      const pending = pendingRequests.current.get(requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingRequests.current.delete(requestId);
        pending.resolve({ confirmed, method });
      }
    };

    eventBus.subscribe(
      "action:confirm:response",
      subscriberId,
      responseHandler,
    );

    return () => {
      eventBus.unsubscribe("action:confirm:response", subscriberId);
      for (const [, pending] of pendingRequests.current) {
        clearTimeout(pending.timeout);
      }
      pendingRequests.current.clear();
    };
  }, [subscriberId]);

  const confirmAction = useCallback(
    (options: ConfirmOptions): Promise<ConfirmResult> => {
      return new Promise((resolve) => {
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        // Unique subscriber IDs per call to prevent collisions
        const ackSubId = `${subscriberId}-ack-${requestId}`;

        // Step 1: Wait for ACK from the dialog (or timeout to fallback)
        const fallbackTimeout = setTimeout(() => {
          // Cleanup the ACK subscriber
          eventBus.unsubscribe("action:confirm:ack", ackSubId);

          // No ACK received - action-confirm plugin is not available
          // Fall back to native browser confirm()
          const confirmed = window.confirm(
            options.description || options.title || "Confirm action?",
          );
          resolve({ confirmed });
        }, 500);

        // Step 2: If ACK arrives, dialog is handling it
        const ackHandler = (event: any) => {
          if (event.payload?.requestId !== requestId) return;

          // Dialog confirmed it will handle this request
          eventBus.unsubscribe("action:confirm:ack", ackSubId);
          clearTimeout(fallbackTimeout);

          // Now wait for the full response (verification dialog)
          const responseTimeout = setTimeout(
            () => {
              pendingRequests.current.delete(requestId);
              resolve({ confirmed: false });
            },
            5 * 60 * 1000,
          );

          pendingRequests.current.set(requestId, {
            resolve,
            timeout: responseTimeout,
          });
        };

        eventBus.subscribe("action:confirm:ack", ackSubId, ackHandler);

        // Step 3: Publish the request
        eventBus.publish("action:confirm:request", {
          requestId,
          action: options.action ?? "confirm",
          title: options.title ?? "Confirm action",
          description: options.description,
          preferredMethod: options.preferredMethod,
          rememberMinutes: options.rememberMinutes,
          metadata: options.metadata,
        });
      });
    },
    [subscriberId],
  );

  return confirmAction;
}
