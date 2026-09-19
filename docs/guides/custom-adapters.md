# Custom service adapters

Veap uses a port-and-adapter architecture for services that interact with external infrastructure. Storage, email delivery, caching, and cryptographic hashing are all defined by TypeScript interfaces (ports) and resolved through the IoC container. This guide demonstrates how to build and register production-ready custom adapters for Cloudflare R2 / AWS S3 storage, Resend email delivery, and Redis distributed caching.

## 1. Custom storage provider: S3 / Cloudflare R2

The file storage subsystem delegates file operations to registered `IStorageProvider` instances. While `@veap/core` includes `LocalFileProvider` for local filesystem storage, production applications usually store user-uploaded assets in S3-compatible cloud buckets.

### The `IStorageProvider` interface

Defined in `@veap/core/storage`:

```ts
export interface StorageData {
  name: string; // Unique identifier or filename
  url: string; // Publicly accessible URL
  type: string; // MIME type (e.g. "image/png")
  size: number; // Size in bytes
  service: string; // Provider ID (e.g. "s3")
  serviceId: string; // Remote bucket key/path for deletion
}

export interface IStorageProvider {
  id: string;
  name: string;
  upload(file: File, options?: any): Promise<StorageData | { error: string }>;
  delete?(serviceId: string): Promise<boolean>;
}
```

### Implementing `S3StorageProvider`

Below is an implementation using `@aws-sdk/client-s3`:

```ts
// src/infrastructure/storage/s3-storage.provider.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { IStorageProvider, StorageResult } from "@veap/core/storage";

export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string; // Required for Cloudflare R2 or MinIO
  accessKeyId: string;
  secretAccessKey: string;
  publicUrlPrefix: string; // E.g. "https://cdn.example.com" or R2 public bucket URL
}

export class S3StorageProvider implements IStorageProvider {
  public readonly id = "s3";
  public readonly name = "Amazon S3 / R2 Storage";

  private client: S3Client;
  private bucket: string;
  private publicUrlPrefix: string;

  constructor(config: S3Config) {
    this.bucket = config.bucket;
    this.publicUrlPrefix = config.publicUrlPrefix.replace(/\/$/, "");
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async upload(file: File): Promise<StorageResult> {
    try {
      const ext = file.name.split(".").pop() || "bin";
      const uniqueName = `${crypto.randomUUID()}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: uniqueName,
          Body: buffer,
          ContentType: file.type,
        }),
      );

      return {
        name: uniqueName,
        url: `${this.publicUrlPrefix}/${uniqueName}`,
        type: file.type,
        size: file.size,
        service: this.id,
        serviceId: uniqueName,
      };
    } catch (err: any) {
      return {
        error: err?.message || "Failed to upload file to S3.",
      };
    }
  }

  async delete(serviceId: string): Promise<boolean> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: serviceId,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
```

### Registering the storage provider

Create a custom `ServiceProvider` and register your provider with `StorageService` in the `boot()` phase:

```ts
// src/providers/s3-storage.provider.ts
import { ServiceProvider } from "@veap/core/core/server";
import { StorageService } from "@veap/core/storage";
import { S3StorageProvider } from "../infrastructure/storage/s3-storage.provider";

export class CloudStorageServiceProvider extends ServiceProvider {
  async boot(): Promise<void> {
    const storage = await this.container.resolve(StorageService);

    const s3 = new S3StorageProvider({
      bucket: process.env.S3_BUCKET!,
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT, // Optional for AWS, required for R2
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      publicUrlPrefix: process.env.S3_PUBLIC_URL!,
    });

    storage.registerProvider(s3);
    storage.setDefaultProvider(s3.id);
  }
}
```

Add your provider to `Application.configure().withProviders([...])` in `lib/veap.ts`.

---

## 2. Custom mail transport: Resend / Postmark

Veap separates message semantics (mailables) from the transmission mechanism (`IMailer`). The framework ships with SMTP (via Nodemailer) and console logger transports. You can route all emails through modern transactional API providers like Resend, Postmark, or AWS SES using the `CUSTOM_MAILER` token.

### The `IMailer` interface

Defined in `@veap/core/communication`:

```ts
export interface IMailer {
  sendMail(message: MailMessage): Promise<void>;
}
```

The `MailMessage` DTO contains normalized fields: `to`, `subject`, `text`, `html`, `from`, `cc`, `bcc`, `replyTo`, and `attachments`.

### Implementing `ResendMailService`

```ts
// src/infrastructure/mail/resend.mailer.ts
import { Resend } from "resend";
import type { IMailer, MailMessage } from "@veap/core/communication";

export class ResendMailService implements IMailer {
  private resend: Resend;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string) {
    this.resend = new Resend(apiKey);
    this.defaultFrom = defaultFrom;
  }

  async sendMail(message: MailMessage): Promise<void> {
    const from = message.from
      ? typeof message.from === "string"
        ? message.from
        : `${message.from.name} <${message.from.address}>`
      : this.defaultFrom;

    const to = Array.isArray(message.to)
      ? message.to.map((t) => (typeof t === "string" ? t : t.address))
      : typeof message.to === "string"
        ? [message.to]
        : [message.to.address];

    const { error } = await this.resend.emails.send({
      from,
      to,
      subject: message.subject,
      text: message.text,
      html: message.html || undefined,
    });

    if (error) {
      throw new Error(`[ResendMailService] Send failed: ${error.message}`);
    }
  }
}
```

### Binding `CUSTOM_MAILER` in IoC

Register the adapter under `CUSTOM_MAILER` and enable it by setting `MAIL_TRANSPORT=custom` in `.env`:

```ts
// src/providers/mail.provider.ts
import { ServiceProvider } from "@veap/core/core/server";
import { CUSTOM_MAILER } from "@veap/core/communication";
import { ResendMailService } from "../infrastructure/mail/resend.mailer";

export class CustomMailServiceProvider extends ServiceProvider {
  register(): void {
    const apiKey = process.env.RESEND_API_KEY || "";
    const from = process.env.MAIL_FROM_ADDRESS || "noreply@example.com";

    this.container.register({
      token: CUSTOM_MAILER,
      useValue: new ResendMailService(apiKey, from),
      singleton: true,
    });
  }
}
```

In `.env`:

```env
MAIL_TRANSPORT=custom
RESEND_API_KEY=re_123456789
MAIL_FROM_ADDRESS="Veap App <noreply@example.com>"
```

All system mailables (`sendVerifyEmail`, `sendResetPassword`, `send2FACode`, custom `sendMail`) now route through Resend.

---

## 3. Custom cache provider: Redis

The kernel provides in-memory caching by default (`MemoryCacheProvider`). In multi-instance or serverless environments, an external distributed cache like Redis or Upstash ensures settings and routes remain synchronized across all workers.

### The `ICacheProvider` interface

Defined in `@veap/core`:

```ts
export interface ICacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

### Implementing `RedisCacheProvider`

```ts
// src/infrastructure/cache/redis-cache.provider.ts
import Redis from "ioredis";
import type { ICacheProvider } from "@veap/core";

export class RedisCacheProvider implements ICacheProvider {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.redis.set(key, serialized, "EX", ttlSeconds);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      console.error("[RedisCacheProvider] Failed to set cache key:", error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error("[RedisCacheProvider] Failed to delete cache key:", error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      console.error("[RedisCacheProvider] Failed to clear cache:", error);
    }
  }
}
```

### Binding `CACHE_PROVIDER` in IoC

Register the custom provider under `CACHE_PROVIDER` before kernel services boot:

```ts
// src/providers/redis-cache.provider.ts
import { ServiceProvider } from "@veap/core/core/server";
import { CACHE_PROVIDER } from "@veap/core";
import { RedisCacheProvider } from "../infrastructure/cache/redis-cache.provider";

export class RedisCacheServiceProvider extends ServiceProvider {
  register(): void {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    this.container.register({
      token: CACHE_PROVIDER,
      useValue: new RedisCacheProvider(redisUrl),
      singleton: true,
    });
  }
}
```

---

## 4. Registering providers in `lib/veap.ts`

To activate your custom providers, add them using `.withProviders([...])` in the application composition root:

```ts
// lib/veap.ts
import { cache } from "react";
import { Application } from "@veap/core/core/server";
import { appMigrations } from "../migrations";
import { plugins } from "./plugins.gen";

// Import your custom service providers
import { CloudStorageServiceProvider } from "../src/providers/s3-storage.provider";
import { CustomMailServiceProvider } from "../src/providers/mail.provider";
import { RedisCacheServiceProvider } from "../src/providers/redis-cache.provider";

export const app = Application.configure()
  .withDatabase()
  .withAuth()
  .withStorage()
  .withCommunication()
  .withIntl()
  .withRouter()
  .withSettings()
  .withMigrations(appMigrations)
  .withPlugins(plugins)
  // Register custom infrastructure adapters:
  .withProviders([
    RedisCacheServiceProvider,
    CustomMailServiceProvider,
    CloudStorageServiceProvider,
  ])
  .create();

export const initializeSystem = cache(async () => {
  return app.bootstrap();
});
```

When `app.bootstrap()` runs, the IoC container binds and boots your custom providers in order, routing uploads to S3, email to Resend, and caching to Redis.
