# Custom service providers

Service providers are the extension mechanism of the composition root. A provider registers services in the container at boot; plugins and application code then resolve them by token. This page shows how to write your own provider, how to listen to domain events during bootstrap, and how to bind custom implementations of framework ports.

## The ServiceProvider contract

```ts
import { ServiceProvider, type Container } from "@veap/framework/core/server";

export class MyServiceProvider extends ServiceProvider {
  register(): void {
    // Bind services into this.container (no runtime dependencies yet)
  }

  async boot(): Promise<void> {
    // Optional: wire event listeners or start logic depending on other providers
  }
}
```

`register()` runs for every provider first, then `boot()` runs in registration order. Keep `register()` free of side effects; resolve other services or register event subscriptions in `boot()`.

## Writing a provider

```ts
// src/providers/search-provider.ts
import { ServiceProvider } from "@veap/framework/core/server";
import { SEARCH_CLIENT } from "../domain/ports/search-client";
import { MeilisearchClient } from "../infrastructure/meilisearch-client";

export class SearchServiceProvider extends ServiceProvider {
  register(): void {
    this.container.register({
      token: SEARCH_CLIENT,
      useFactory: () => new MeilisearchClient(),
      singleton: true,
    });
  }
}
```

Register it in the composition root:

```ts
// lib/veap.ts
Application.configure()
  // ...
  .withProviders([SearchServiceProvider])
  .create();
```

Token conventions used by the framework: class tokens for concrete services, typed `Token<T>` symbol constants (upper snake case, for example, `PASSWORD_HASHER`, `CACHE_PROVIDER`, `CUSTOM_MAILER`) for swappable ports. Bind providers using `this.container.register({ token, useClass, useValue, useFactory, singleton: true })`.

## Handling domain events in a provider

Service providers are the recommended pattern in clean architectures to attach side-effect listeners without coupling business logic to presentation layers or third-party plugins.

Because `boot()` executes after all kernel and application providers finish their `register()` phase, you can safely subscribe to system events (like user authentication or database model mutations) and trigger notifications:

```ts
// src/providers/app-events-provider.ts
import { ServiceProvider } from "@veap/framework/core/server";
import { eventBus } from "@veap/framework/core";
import { sendMail } from "@veap/framework/communication";

export class AppEventsServiceProvider extends ServiceProvider {
  register(): void {
    // No container bindings required for this provider
  }

  boot(): void {
    // Listen for authentication events fired by AuthService
    eventBus.subscribe(
      "system:auth:login",
      "app:login-notifier",
      async (event) => {
        const { user } = event.payload;

        await sendMail({
          to: user.email,
          subject: "New login detected",
          text: `Hello ${user.name || user.email}, a new sign-in to your account was detected.`,
        });
      },
    );
  }
}
```

Register your custom provider in `lib/veap.ts`:

```ts
// lib/veap.ts
import { Application } from "@veap/framework/core/server";
import { AppEventsServiceProvider } from "./providers/app-events-provider";

export const app = Application.configure()
  .withDatabase()
  .withAuth()
  .withCommunication()
  .withProviders([AppEventsServiceProvider])
  .create();
```

## Replacing a framework port

Every framework service that touches the outside world does so through a port bound to a token. Common ones:

| Port              | Token                             | Registration Mechanism                                            | Default                  |
| ----------------- | --------------------------------- | ----------------------------------------------------------------- | ------------------------ |
| Password hashing  | `PASSWORD_HASHER`                 | `container.register({ token: PASSWORD_HASHER, useClass })`        | bcrypt-based hasher      |
| Token generation  | `TOKEN_GENERATOR`                 | `container.register({ token: TOKEN_GENERATOR, useClass })`        | oslo-based generator     |
| Secret encryption | `SECRET_CIPHER`                   | `container.register({ token: SECRET_CIPHER, useClass })`          | AES-GCM cipher           |
| Cookies / request | `COOKIE_STORE`, `REQUEST_CONTEXT` | Registered by Kernel provider                                     | Next.js request adapters |
| Mail transport    | `CUSTOM_MAILER`                   | `container.register({ token: CUSTOM_MAILER, useClass/useValue })` | `MAIL_TRANSPORT=smtp`    |
| Storage           | `StorageService`                  | `storage.registerProvider(new MyStorageProvider())`               | `LocalFileProvider`      |
| Cache             | `CACHE_PROVIDER`                  | `container.register({ token: CACHE_PROVIDER, useValue })`         | `MemoryCacheProvider`    |

Bind before providers boot - the safest place is a custom provider listed in `withProviders`, or an explicit `container.register(...)` right after `Application.configure().create()` and before `bootstrap()`:

```ts
import { PASSWORD_HASHER } from "@veap/framework/auth";
import { Argon2Hasher } from "./argon2-hasher";

const application = Application.configure().withAuth().create();

container.register({
  token: PASSWORD_HASHER,
  useClass: Argon2Hasher,
  singleton: true,
});

void application.bootstrap();
```

For complete, copy-pasteable implementations of S3 storage, custom mailers (Resend), and Redis caching, see the [Custom service adapters guide](../guides/custom-adapters.md).

## Custom providers in plugins

A plugin does not need its own provider class: declare services in the plugin's `init()` hook (see [Plugin lifecycle](../plugins/hooks.md)). Use a standalone provider when the service must exist even with the plugin disabled, or when multiple plugins share it.

## Rules to keep the container sane

- Bind in `register()`, resolve in `boot()`.
- Never call `container.clear()` in application code; it is a test utility.
- Do not resolve request-scoped ports (`REQUEST_CONTEXT`, `COOKIE_STORE`) outside a request.
- Prefer constructor injection (declare dependencies as constructor parameters) over `app(...)` inside business logic; use `app(...)` at composition edges (pages, actions, handlers).
