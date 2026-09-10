export interface StorageData {
  name: string;
  url: string;
  type: string;
  size: number;
  service: string;
  serviceId: string;
}

export interface StorageError {
  error: string;
}

export type StorageResult = StorageData | StorageError;

export interface IStorageProvider {
  id: string;
  name: string;
  upload(file: File, options?: any): Promise<StorageResult>;
  delete?(serviceId: string): Promise<boolean>;
}
