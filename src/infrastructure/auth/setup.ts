import { User } from "./models";
import { eventBus } from "../../application/events/event-bus";
import { logger } from "../logging/console-logger";

/**
 * Checks if the system is installed.
 * A system is considered installed if at least one user exists in the database.
 * This function also has a side-effect: it publishes the 'system:not-installed' event
 * if it detects the system is not installed.
 */
export async function isSystemInstalled(): Promise<boolean> {
  try {
    const count = await User.query().count();

    if (count === 0) {
      logger.debug("veap:setup", "System not installed. Publishing event.");
      await eventBus.publish("system:not-installed", { timestamp: Date.now() });
    }

    return count > 0;
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      // Re-throw redirect errors to let Next.js handle them
      throw error;
    }

    // This typically happens on the very first run when the users table doesn't exist yet.
    logger.debug(
      "veap:setup",
      "isSystemInstalled check failed (most likely table does not exist)",
      error.message,
    );

    // If an error occurs (e.g., table not found), assume not installed and publish the event.
    await eventBus.publish("system:not-installed", { timestamp: Date.now() });
    return false;
  }
}
