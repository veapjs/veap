# Custom service providers

Service providers are the extension mechanism of the composition root. A provider registers services in the container at boot; plugins and application code then resolve them by token. This page shows how to write your own provider and how to bind custom implementations of framework ports.

## The ServiceProvider contract

```ts
import type { ServiceProvider } from "@veap/core/core/server";

export class MyServiceProvider implements ServiceProvider {
  register(container: Container): void {
    // bind services (no runtime dependencies yet)
  }
  async boot(container: Container): Promise<void> {
    // optional: start things that depend on other providers
  }
}
```

`register()` runs for every provider first, then `boot()` runs in registration order. Keep `register()` free of side effects; resolve other services only in `boot()`.

## Writing a provider

```ts
// src/providers/search-provider.ts
import { Container, type ServiceProvider } from "@veap/core/core/server";
import { SEARCH_CLIENT } from "../domain/ports/search-client";
import { MeilisearchClient } from "../infrastructure/meilisearch-client";

export class SearchServiceProvider implements ServiceProvider {
  register(container: Container): void {
    container.singleton(SEARCH_CLIENT, () => new MeilisearchClient());
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

Token conventions used by the framework: class tokens for concrete services, `InjectionToken`/Symbol constants (upper snake case, e.g. `PASSWORD_HASHER`) for swappable ports. Bind ports with `container.singleton(TOKEN, factory)` or `container.bind(TOKEN).to(Implementation)`.

## Replacing a framework port

Every framework service that touches the outside world does so through a port bound in a token. Common ones:

| Port              | Token                             | Default                      |
| ----------------- | --------------------------------- | ---------------------------- |
| Password hashing  | `PASSWORD_HASHER`                 | bcrypt-based hasher          |
| Token generation  | `TOKEN_GENERATOR`                 | oslo-based generator         |
| Secret encryption | `SECRET_CIPHER`                   | AES-GCM cipher               |
| Cookies / request | `COOKIE_STORE`, `REQUEST_CONTEXT` | Next.js adapters             |
| Mail transport    | `MAIL_TRANSPORT`                  | nodemailer (smtp) or console |
| Storage           | `STORAGE_PROVIDER`                | local file provider          |
| Cache             | cache token                       | in-memory cache              |

Bind before providers boot - the safest place is a custom provider listed _before_ the built-in one in `withProviders`, or an explicit `container.bind(...)` right after `Application.configure().create()` and before `bootstrap()`:

```ts
import { PASSWORD_HASHER } from "@veap/core/auth";
import { Argon2Hasher } from "./argon2-hasher";

const application = Application.configure().withAuth().create();

container.bind(PASSWORD_HASHER).to(Argon2Hasher);

void application.bootstrap();
```

Implementations must satisfy the port's interface exactly (`IPasswordHasher`, `IMailer`, `IStorageProvider`, ...), all exported from the matching entry point.

## Custom providers in plugins

A plugin does not need its own provider class: declare services in the plugin's `register()`/`boot()` hooks (see [Plugin lifecycle](../plugins/hooks.md)). Use a standalone provider when the service must exist even with the plugin disabled, or when multiple plugins share it.

## Rules to keep the container sane

- Bind in `register()`, resolve in `boot()`.
- Never call `container.clear()` in application code; it is a test utility.
- Do not resolve request-scoped ports (`REQUEST_CONTEXT`, `COOKIE_STORE`) outside a request.
- Prefer constructor injection (declare dependencies as constructor parameters) over `app(...)` inside business logic; use `app(...)` at composition edges (pages, actions, handlers).
