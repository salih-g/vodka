// showSaveFilePicker is not in the standard DOM lib. Declare just the surface
// this project uses; the returned handle/stream are kept loose on purpose.
export {};

declare global {
  interface SaveFilePickerType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: SaveFilePickerType[];
    excludeAcceptAllOption?: boolean;
  }

  interface Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<{
      readonly name: string;
      createWritable(options?: {
        keepExistingData?: boolean;
        mode?: 'exclusive' | 'siloed';
      }): Promise<{
        write(
          data: ArrayBufferView | ArrayBuffer | Blob | string,
        ): Promise<void>;
        seek(position: number): Promise<void>;
        truncate(size: number): Promise<void>;
        close(): Promise<void>;
        abort(reason?: unknown): Promise<void>;
      }>;
    }>;
  }
}
