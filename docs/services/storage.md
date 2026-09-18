# File storage

Storage is provider-based: `StorageService` keeps a registry of `IStorageProvider` implementations, one of them default, and delegates uploads and deletes. The default provider is the local filesystem; plugins can register cloud providers (the vercel-blob plugin is a working example).

## Uploading and deleting

```ts
import { StorageService } from "@veap/core/storage";

const storage = await app(StorageService);

// typical Server Action: the File comes from formData
export async function uploadAvatar(formData: FormData) {
  const file = formData.get("file") as File;
  const result = await storage.upload(file); // default provider
  if ("error" in result) {
    throw AppError.BadRequest(result.error);
  }
  return result; // StorageData
}
```

```ts
interface StorageData {
  name: string; // stored file name (uniquified)
  url: string; // public URL (local: /storage/<name>)
  type: string; // MIME type
  size: number; // bytes
  service: string; // provider id that stored it
  serviceId: string; // provider-specific key/path
}

type StorageResult = StorageData | { error: string };
```

Delete by URL or key; the local provider maps `/storage/...` web paths back to disk and blocks directory traversal outside the storage folder:

```ts
await storage.delete(result.url);
await storage.delete(keyOrUrl, "vercel-blob"); // target a specific provider
```

## Providers

```ts
import type { IStorageProvider } from "@veap/core/storage";

export class S3StorageProvider implements IStorageProvider {
  id = "s3";
  name = "Amazon S3";

  async upload(file: File): Promise<StorageResult> {
    /* ... */
  }
  async delete(serviceId: string): Promise<boolean> {
    /* ... */
  }
}
```

Register in a service provider's `boot()`:

```ts
const storage = await container.resolve(StorageService);
storage.registerProvider(new S3StorageProvider());
storage.setDefaultProvider("s3"); // optional; first non-local registration becomes default
```

`registerProvider` makes the first registered provider the default unless a default is already set to something other than `"local"`; `unregisterProvider(id)` removes one and re-falls-back to local. `getProviders()` lists registered ids and names (used by settings UI).

<!-- prettier-ignore -->
> [!TIP]
> For a full, production-ready S3 and Cloudflare R2 implementation using `@aws-sdk/client-s3`, see the [Custom service adapters guide](../guides/custom-adapters.md#1-custom-storage-provider-s3--cloudflare-r2).

## The local provider

`LocalFileProvider` (registered automatically on first boot when the system is installed):

- Writes into `FILE_STORAGE_FOLDER` (default `public/storage`), creating it if needed.
- Names files `<slug>-<random>.<ext>`.
- Returns `url` as `/storage/<name>` (the `public` prefix stripped).
- Serves files through the host route `app/storage/[...path]/route.ts`, which sets long-lived immutable cache headers and rejects traversal outside the storage root.

## Configuration

| Variable              | Default          | Meaning                                                           |
| --------------------- | ---------------- | ----------------------------------------------------------------- |
| `FILE_STORAGE_FOLDER` | `public/storage` | local provider folder (relative to the process working directory) |

## Choosing between providers at upload time

`upload(file, providerId?)` and `delete(keyOrUrl, providerId?)` accept an explicit provider id; without one the default is used, and an unknown id falls back to `local`. Store `service`/`serviceId` from the result if you need to delete reliably across providers later.
