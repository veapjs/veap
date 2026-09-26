# Export Boundaries (Public API)

In the Veap monorepo, strict package boundaries must be maintained.

## Rule: Only Import from `exports`

When Plugin A needs to use code from Plugin B (or from `@veap/framework`), it **must** import from the defined `exports` in Plugin B's `package.json`.

**Anti-pattern (Internal Import):**

```typescript
import { someHelper } from "@veap/auth-plugin/src/core/helper";
```

**Correct (Public API Import):**

```typescript
import { authService } from "@veap/auth-plugin";
```

If a function, type, or service is not exported in `package.json`, it is considered a private implementation detail of that plugin. Modifying or importing private details breaks encapsulation and can cause the build step to fail.

## `@veap/framework` Entry Barrels

Every public subpath of `@veap/framework` is backed by a barrel in `packages/veap/src/entries/` (plus the kernel entry points `src/index.ts` and `src/server.ts`). These barrels exist only to re-export from the layers; they contain no logic. Layer-internal files must import each other by relative path, never through an entry barrel, to keep the dependency direction one-way.
