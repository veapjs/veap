import fs from "node:fs";
import path from "node:path";
import { warn } from "../../logging";
import type {
  IStorageProvider,
  StorageResult,
} from "../../../domain/storage/types";
import { ConfigService } from "../../../infrastructure/config/config.service";

export class LocalFileProvider implements IStorageProvider {
  public id = "local";
  public name = "Local Filesystem";

  constructor(private config: ConfigService) {}

  private generateUniqueImageName(name: string) {
    const cleanName = name.replace(/\s+/g, "-").toLowerCase();
    const suffix = Math.floor(Math.random() * Date.now()).toString(36);
    const index = cleanName.lastIndexOf(".");

    return index < 0
      ? `${cleanName}-${suffix}`
      : `${cleanName.slice(0, index)}-${suffix}${cleanName.slice(index)}`;
  }

  public async upload(file: File): Promise<StorageResult> {
    try {
      const storageFolder = this.config.get("FILE_STORAGE_FOLDER");

      if (!fs.existsSync(/*turbopackIgnore: true*/ storageFolder)) {
        fs.mkdirSync(/*turbopackIgnore: true*/ storageFolder, {
          recursive: true,
        });
      }

      const name = this.generateUniqueImageName(file.name);
      const filePath = path.join(/*turbopackIgnore: true*/ storageFolder, name);
      const buffer = await file.arrayBuffer();
      fs.writeFileSync(/*turbopackIgnore: true*/ filePath, Buffer.from(buffer));

      const url = `${storageFolder}/${name}`.replace("public", "");

      return {
        name: name,
        url,
        type: file.type,
        size: file.size,
        service: "local",
        serviceId: filePath,
      };
    } catch (error) {
      warn("veap:storage", `Error uploading file: ${error}`);
      return { error: "Error uploading file" };
    }
  }

  public async delete(keyOrUrl: string): Promise<boolean> {
    try {
      const storageFolder = this.config.get("FILE_STORAGE_FOLDER");
      let filePath = keyOrUrl;

      // If it is a web path (starting with /), we map it back to the local storage path.
      if (keyOrUrl.startsWith("/")) {
        const relativeStorageFolder = storageFolder.startsWith("public")
          ? storageFolder.replace("public", "") // e.g. "/storage"
          : storageFolder;

        if (keyOrUrl.startsWith(relativeStorageFolder)) {
          filePath = path.join(
            /*turbopackIgnore: true*/ storageFolder,
            keyOrUrl.substring(relativeStorageFolder.length),
          );
        } else {
          filePath = path.join(/*turbopackIgnore: true*/ "public", keyOrUrl);
        }
      }

      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(/*turbopackIgnore: true*/ filePath);
      const absoluteStorageFolder = path.resolve(
        /*turbopackIgnore: true*/ storageFolder,
      );

      // Security check: ensure filePath is inside the storage folder to avoid directory traversal
      if (!absolutePath.startsWith(absoluteStorageFolder)) {
        warn(
          "veap:storage",
          `Directory traversal attempt blocked: ${absolutePath}`,
        );
        return false;
      }

      if (fs.existsSync(/*turbopackIgnore: true*/ absolutePath)) {
        fs.unlinkSync(/*turbopackIgnore: true*/ absolutePath);
        return true;
      }

      return false;
    } catch (error) {
      warn("veap:storage", `Error deleting file: ${error}`);
      return false;
    }
  }
}
