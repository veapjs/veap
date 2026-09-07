import { Injectable } from "../ioc/decorators";
import { z } from "zod";
import { AppError } from "../../domain/errors/app-error";
import type { IConfigService } from "../../domain/contracts/config";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().url().optional(),
  /**
   * Base64 key decoding to 16, 24 or 32 bytes (AES-128/192/256). No default:
   * a missing key fails validation here, before any encryption is attempted.
   */
  ENCRYPTION_KEY: z.string().min(1),
  FILE_STORAGE_FOLDER: z.string().default("public/storage"),

  // Mail
  /** Transport selection: `smtp` (default) | `console` | `custom`. */
  MAIL_TRANSPORT: z.string().optional(),
  MAIL_SERVICE: z.string().default("gmail"),
  MAIL_USERNAME: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM_ADDRESS: z.string().optional(),
  GOOGLE_SMTP_APP_USERNAME: z.string().optional(),
  GOOGLE_SMTP_APP_PASSWORD: z.string().optional(),

  // Next/Vercel specifics
  NEXT_PHASE: z.string().optional(),
  SKIP_VEAP_INIT: z.string().optional(),
  NEXT_RUNTIME: z.string().optional(),
  VERCEL: z.string().optional(),
  AWS_LAMBDA_FUNCTION_NAME: z.string().optional(),
  LAMBDA_TASK_ROOT: z.string().optional(),

  // Intl
  NEXT_PUBLIC_INTL_TIMEZONE: z.string().optional(),
  NEXT_PUBLIC_TIMEZONE: z.string().optional(),
  VEAPCONFIG_INTL_COOKIE: z.string().optional(),
  VEAPCONFIG_INTL_DEFAULT: z.string().optional(),
  VEAPCONFIG_INTL_TIMEZONE: z.string().optional(),
  TZ: z.string().optional(),

  // Logging
  VEAP_CLI: z.string().optional(),
  DEBUG: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Env/zod adapter. Satisfies the non-generic `IConfigService` port while
 * keeping typed keys for direct (type-level) consumers.
 */
@Injectable()
export class ConfigService implements IConfigService {
  private _env: EnvConfig;

  constructor() {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error("❌ Invalid environment variables:", result.error.format());
      throw AppError.Internal("Invalid environment variables");
    }

    this._env = result.data;
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K];
  get(key: string): any;
  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    return this._env[key];
  }

  getAll(): EnvConfig {
    return this._env;
  }
}
