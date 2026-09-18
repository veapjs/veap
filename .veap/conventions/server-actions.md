# Server Actions & Mutations

Veap relies on Next.js Server Actions for processing form submissions and data mutations.

## 1. Zod Validation

Never trust client inputs. Every Server Action must validate its payload using a Zod schema before processing the request.

```typescript
import { z } from "zod";

const CreateItemSchema = z.object({
  name: z.string().min(2),
});

export async function createItemAction(formData: FormData) {
  const parsed = CreateItemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Invalid data", details: parsed.error.flatten() };
  }
  // proceed...
}
```

## 2. Normalized Responses

Server actions should return a consistent payload object rather than throwing raw errors (which Next.js intercepts as unhandled exceptions).

Recommended standard format:

```typescript
type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};
```

## 3. Transactions

If a Server Action performs multiple database writes, it MUST be wrapped in the `transaction()` helper from `@veap/core/database`.
