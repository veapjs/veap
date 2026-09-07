import { Injectable } from "../ioc/decorators";
import type { ILogger } from "../../domain/contracts/logger";

const colors = [
  "\x1b[32m", // Green
  "\x1b[33m", // Yellow
  "\x1b[34m", // Blue
  "\x1b[35m", // Magenta
  "\x1b[36m", // Cyan
  "\x1b[91m", // Light Red
  "\x1b[92m", // Light Green
  "\x1b[93m", // Light Yellow
  "\x1b[94m", // Light Blue
  "\x1b[95m", // Light Magenta
  "\x1b[96m", // Light Cyan
];

const cssColors = [
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#ef4444", // Red
  "#22c55e", // Green
  "#eab308", // Yellow
  "#0ea5e9", // Sky
  "#d946ef", // Fuchsia
  "#14b8a6", // Teal
];

const reset = "\x1b[0m";

/**
 * Generates a stable index for a given string group.
 */
function getHashIndex(group: string) {
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = group.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

const isBrowser = typeof window !== "undefined";

function isSilent() {
  return process.env.VEAP_CLI === "1" && process.env.DEBUG !== "1";
}

export function debug(group: string, message: string, ...args: any[]) {
  if (isSilent()) return;
  if (process.env.NODE_ENV === "production" && !process.env.DEBUG) return;

  const idx = getHashIndex(group);
  if (isBrowser) {
    console.debug(
      `%c[${group}]`,
      `color: ${cssColors[idx % cssColors.length]}; font-weight: bold;`,
      message,
      ...args,
    );
  } else {
    const color = colors[idx % colors.length];
    console.debug(`${color}[${group}]${reset}`, message, ...args);
  }
}

export function info(group: string, message: string, ...args: any[]) {
  if (isSilent()) return;
  const idx = getHashIndex(group);
  if (isBrowser) {
    console.info(
      `%c[${group}]`,
      `color: ${cssColors[idx % cssColors.length]}; font-weight: bold;`,
      message,
      ...args,
    );
  } else {
    const color = colors[idx % colors.length];
    console.info(`${color}[${group}]${reset}`, message, ...args);
  }
}

export function warn(group: string, message: string, ...args: any[]) {
  const idx = getHashIndex(group);
  if (isBrowser) {
    console.warn(
      `%c[${group}]`,
      `color: ${cssColors[idx % cssColors.length]}; font-weight: bold;`,
      message,
      ...args,
    );
  } else {
    const color = colors[idx % colors.length];
    console.warn(
      `${color}[${group}]${reset}`,
      `\x1b[33m${message}${reset}`,
      ...args,
    );
  }
}

export function error(group: string, message: string, ...args: any[]) {
  const idx = getHashIndex(group);

  // Format AppError automatically
  let formattedArgs = args;
  let formattedMessage = message;

  if (
    args.length > 0 &&
    typeof args[0] === "object" &&
    args[0] !== null &&
    "isAppError" in args[0]
  ) {
    const appError =
      args[0] as import("../../domain/errors/app-error").AppError;
    formattedMessage = `${message} [${appError.code}]`;
    // We keep the original error in args so it logs the stack trace correctly
  }

  if (isBrowser) {
    console.error(
      `%c[${group}]`,
      `color: ${cssColors[idx % cssColors.length]}; font-weight: bold;`,
      formattedMessage,
      ...formattedArgs,
    );
  } else {
    const color = colors[idx % colors.length];
    console.error(
      `${color}[${group}]${reset}`,
      `\x1b[31m${formattedMessage}${reset}`,
      ...formattedArgs,
    );
  }
}

/**
 * Default console adapter for the {@link ILogger} port.
 *
 * It is the single logging implementation in the kernel; both the `logger`
 * singleton and the named functions delegate to it.
 */
@Injectable()
export class ConsoleLogger implements ILogger {
  debug(group: string, message: string, ...args: any[]) {
    debug(group, message, ...args);
  }
  info(group: string, message: string, ...args: any[]) {
    info(group, message, ...args);
  }
  warn(group: string, message: string, ...args: any[]) {
    warn(group, message, ...args);
  }
  error(group: string, message: string, ...args: any[]) {
    error(group, message, ...args);
  }
}

/**
 * Backwards-compatible alias. Prefer `ConsoleLogger` in new code.
 */
export const LoggerService = ConsoleLogger;

const globalForLogger = globalThis as unknown as {
  __VEAP_LOGGER__: ConsoleLogger | undefined;
};

export const logger = globalForLogger.__VEAP_LOGGER__ ?? new ConsoleLogger();

globalForLogger.__VEAP_LOGGER__ = logger;
