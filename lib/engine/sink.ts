/**
 * A streamed output file. Writes go straight to disk (File System Access API),
 * so peak memory stays bounded no matter how long the video is.
 */
export interface FileSink {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export class PickerAbortError extends Error {
  constructor() {
    super('Save dialog was dismissed');
    this.name = 'PickerAbortError';
  }
}

/**
 * Prompt for a save location and open a streaming writable. MUST be called
 * synchronously from a user gesture (a click) — awaiting anything before the
 * picker consumes the gesture and throws.
 */
export async function pickFileSink(suggestedName: string): Promise<FileSink> {
  let handle: Awaited<ReturnType<Window['showSaveFilePicker']>>;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new PickerAbortError();
    }
    throw err;
  }

  const writable = await handle.createWritable();

  return {
    write: (chunk) => writable.write(chunk),
    close: () => writable.close(),
    abort: async () => {
      try {
        await writable.abort();
      } catch {
        // Nothing to clean up if the stream never opened.
      }
    },
  };
}

/** Turn a title into a safe .mp4 filename. */
export function toFileName(title: string | undefined): string {
  const base = (title ?? 'kick-vod')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/\s/g, '_');
  return `${base || 'kick-vod'}.mp4`;
}
