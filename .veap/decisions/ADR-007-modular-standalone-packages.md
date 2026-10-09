# Plan Implementacji: Nowa Architektura Modularna Veap („A la Carte”)

> **Wersja:** 1.0 (Draft)  
> **Gałąź Git:** `dev` (Monorepo & `packages/veap`)  
> **Cel:** Przekształcenie `@veap/framework` w niezależne, modularne pakiety („klocki LEGO”), umożliwiające korzystanie z samej bazy (Express/Fastify), samego auth i bazy (natywny Next.js), aż po pełny kombajn z pluginami.

---

## 1. Wizja i Założenia Architektoniczne

1. **Zasada „A la Carte”**: Deweloper instaluje i uruchamia wyłącznie to, czego potrzebuje. Brak narzutu niepotrzebnych bibliotek i pamięci.
2. **Knex jako jedyny, stabilny silnik SQL**: Jeden sprawdzony standard: Knex.js (SQLite + PostgreSQL), ambientowe transakcje `AsyncLocalStorage` i wbudowany ORM ActiveRecord (`Model`).
3. **Acykliczny graf zależności (DAG)**: Zależności biegną ściśle w jednym kierunku:
   - `@veap/kernel` nie zależy od bazy ani HTTP.
   - `@veap/database` może działać całkowicie standalone (np. w Express, skryptach CLI).
   - `@veap/auth` wymaga wyłącznie `@veap/database` (i opcjonalnie kernela).
   - `@veap/plugins` i `@veap/router` są opcjonalnymi dodatkami dla aplikacji z wtyczkami.
   - `@veap/framework` spina wszystko jako metapakiet z `ApplicationBuilder` i re-eksportami dla 100% wstecznej kompatybilności.

---

## 2. Docelowy Podział Pakietów w Monorepo

```text
packages/
├── kernel/            ──► @veap/kernel (DI, ServiceProvider, EventBus, Config, Logger)
├── database/          ──► @veap/database (Knex, ActiveRecord ORM, Migracje, Transakcje)
├── storage/           ──► @veap/storage (Local Disk, S3, Vercel Blob)
├── auth/              ──► @veap/auth (Tożsamość, Modele User/Session, Szyfrowanie, RBAC)
├── plugins/           ──► @veap/plugins (IPlugin, PluginRegistry, ExtensionPoint, Widgets, Hooks)
├── router/            ──► @veap/router (VeapRouter, discoverRoutes, ApiPipeline)
├── ui/                ──► @veap/ui (Komponenty Tailwind / Shadcn UI)
├── create-veap/       ──► create-veap (Oficjalny CLI scaffolding)
└── veap/              ──► @veap/framework (Metapakiet: ApplicationBuilder + re-eksporty)
```

---

## 3. Szczegółowy Harmonogram Frazowy (Fazy Implementacji)

### Faza 1: `@veap/kernel` – Czyste Jądro Frameworka
- [ ] Utworzenie `packages/kernel` (`package.json`, `tsconfig.json`).
- [ ] Przeniesienie kontenera IoC: `@Injectable()`, `@Inject()`, `Token<T>`, symbole `Symbol.for("veap:...")`.
- [ ] Przeniesienie kontraktu `ServiceProvider` (`register()`, `boot()`).
- [ ] Przeniesienie magistrali zdarzeń `EventBus` (`IEventBus`, silnie typowane subskrypcje).
- [ ] Przeniesienie serwisów pomocniczych: `ConfigService` (`.env`), `ConsoleLogger` (`ILogger`), `MemoryCacheProvider`.
- [ ] Testy jednostkowe: weryfikacja działania IoC i EventBus w czystym środowisku Bun/Node bez Next.js.

### Faza 2: `@veap/database` – Samodzielna Baza Danych i ActiveRecord ORM
- [ ] Utworzenie `packages/database` (`package.json`, `tsconfig.json`).
- [ ] Implementacja bezpośredniej funkcji startowej `initDatabase(url: string)` dla aplikacji standalone (Express, Fastify, CLI):
  - Automatyczne ładowanie `better-sqlite3` lub `pg` na podstawie `DATABASE_URL`.
  - Obsługa parametrów SSL.
- [ ] Przeniesienie ActiveRecord ORM:
  - Klasa bazowa `Model<Attributes>` ze `static table` i `static primaryKey`.
  - `QueryBuilder`, mapowanie polimorficzne `MorphMap`.
  - Relacje (`belongsTo`, `hasMany`, `belongsToMany`, `morphMany`).
  - Rzutowanie typów atrybutów (`casts.ts`).
- [ ] Przeniesienie transakcji `AsyncLocalStorage`: `transaction(async () => ...)`.
- [ ] Przeniesienie silnika migracji: `runMigrations()`, obsługa tabeli `veap_migrations`.
- [ ] Implementacja `DatabaseServiceProvider` dla aplikacji używających `@veap/kernel`.
- [ ] Test weryfikacyjny: Skrypt w czystym Node/Bun wykonujący `initDatabase`, tworzący tabelę i wykonujący `Model.create()` oraz `transaction()` bez żadnych innych pakietów Veap.

### Faza 3: `@veap/storage` – Niezależny Magazyn Plików
- [ ] Utworzenie `packages/storage`.
- [ ] Standalone fasada: `storage.put()`, `storage.get()`, `storage.url()`, `storage.delete()`.
- [ ] Sterowniki: `LocalDiskStorage`, `S3Storage`, `VercelBlobStorage`.
- [ ] Helper do serwowania plików w Route Handlers Next.js / Express.
- [ ] `StorageServiceProvider`.

### Faza 4: `@veap/auth` – Silnik Autoryzacji i Tożsamości
- [ ] Utworzenie `packages/auth` (zależność wyłącznie do `@veap/database` i opcjonalnie `@veap/kernel`).
- [ ] Przeniesienie modeli ActiveRecord:
  - `User` (hasła, role, weryfikacje).
  - `Session` (powiązanie z użytkownikiem, wygasanie).
  - `Role`, `Permission`, `PasswordResetSession`, `EmailVerification`.
- [ ] Przeniesienie mechanizmów sesji i krypto:
  - Szyfrowanie AES-GCM tokenów w ciasteczkach `HttpOnly` (`setSessionTokenCookie`, `deleteSessionTokenCookie`).
  - Haszowanie haseł (Argon2id / Bcrypt).
- [ ] Przeniesienie silnika RBAC:
  - `checkSecurity(session, user, requiredRoles, requiredPermissions)`.
  - `getUserRbacData(userId)`, `assignRoleToUser()`.
- [ ] Server Actions i fasady użytkownika:
  - `getCurrentSession()`, `createUser()`, `validateSessionToken()`.
- [ ] `AuthServiceProvider`.
- [ ] Test weryfikacyjny: Natywna strona w Next.js używająca `@veap/auth` i `@veap/database` bez pluginów.

### Faza 5: `@veap/plugins` – System Wtyczek i Rozszerzeń
- [ ] Utworzenie `packages/plugins`.
- [ ] Interfejs `IPlugin` (manifest, zależności, cykl życia `init`, `onEnable`, `onDisable`).
- [ ] `PluginRegistry` – zarządzanie stanem i synchronizacja z bazą `SystemPlugin`.
- [ ] Rozszerzenia UI: komponenty `<ExtensionPoint />`, `<ExtensionPointClient />`, widżety pulpitu (`widgets`).
- [ ] System filtrów i hooków: `applyFilters()`, `addFilter()`, `doAction()`.
- [ ] `PluginsServiceProvider`.

### Faza 6: `@veap/router` – Wirtualny Router
- [ ] Utworzenie `packages/router`.
- [ ] `VeapRouter`, `discoverRoutes()`, dynamiczne łączenie drzew routingu wtyczek.
- [ ] Potok middleware'ów: `runApiPipeline()`, `ApiEnsuredAuth`.

### Faza 7: `@veap/framework` – Metapakiet i Wsteczna Kompatybilność
- [ ] Przepisanie `packages/veap` jako metapakietu łączącego:
  - `@veap/kernel`, `@veap/database`, `@veap/storage`, `@veap/auth`, `@veap/plugins`, `@veap/router`.
- [ ] `ApplicationBuilder` (`Application.configure()`) jako Composition Root.
- [ ] Zachowanie identycznych subpath exports w `package.json`:
  - `@veap/framework/core` ──► re-eksport z `@veap/kernel`
  - `@veap/framework/database` ──► re-eksport z `@veap/database`
  - `@veap/framework/auth` ──► re-eksport z `@veap/auth`
  - `@veap/framework/plugins` ──► re-eksport z `@veap/plugins`
  - `@veap/framework/router` ──► re-eksport z `@veap/router`
- [ ] Weryfikacja: Istniejące wtyczki (`@veap/blog-plugin`, `@veap/panel-plugin`) budują się bez żadnych zmian w kodzie!

---

## 4. Macierz Zależności Pakietów

| Pakiet | Zależy od pakietów Veap | Kluczowe biblioteki zewnętrzne |
| :--- | :--- | :--- |
| **`@veap/kernel`** | *Brak* | `@oslojs/binary`, `@oslojs/encoding` |
| **`@veap/database`** | `@veap/kernel` *(opcjonalnie)* | `knex`, `better-sqlite3`, `pg` |
| **`@veap/storage`** | `@veap/kernel` *(opcjonalnie)* | `@aws-sdk/client-s3`, `@vercel/blob` |
| **`@veap/auth`** | `@veap/database`, `@veap/kernel` | `@node-rs/argon2`, `bcrypt` |
| **`@veap/plugins`** | `@veap/kernel`, `@veap/database` | `react` |
| **`@veap/router`** | `@veap/kernel`, `@veap/plugins`, `@veap/auth` | `next` |
| **`@veap/framework`** | Wszystkie powyższe (metapakiet) | *Brak (tylko re-eksporty)* |

---

## 5. Przykłady Użycia w Praktyce

### Przykład 1: Samodzielny ORM w Express
```ts
import express from "express";
import { initDatabase, Model } from "@veap/database";

await initDatabase(process.env.DATABASE_URL!);

class Post extends Model {
  static override table = "posts";
}

const app = express();
app.get("/posts", async (req, res) => {
  res.json(await Post.all());
});
```

### Przykład 2: Natywny Next.js (tylko Auth + Database)
```tsx
// app/profile/page.tsx (Zwykły Server Component Next.js, zero pluginów)
import { getCurrentSession } from "@veap/auth";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const { session, user } = await getCurrentSession();
  if (!session) redirect("/login");
  return <h1>Profil użytkownika: {user.name}</h1>;
}
```

### Przykład 3: Pełny kombajn z wtyczkami
```ts
// lib/veap.ts
import { Application } from "@veap/framework";
import { plugins } from "./plugins.gen";

export const app = Application.configure()
  .withDatabase()
  .withAuth()
  .withStorage()
  .withRouter()
  .withPlugins(plugins)
  .create();
```
