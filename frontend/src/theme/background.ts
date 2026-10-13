/* ============================================================================
   Custom site background.

   The file itself lives in IndexedDB (localStorage can't hold a 25 MB video);
   the theme only stores a small descriptor pointing at it. Like the rest of the
   theme, it is per-browser.
   ========================================================================== */

export type BackgroundKind = 'image' | 'gif' | 'video';

/** What the theme remembers about the chosen background. */
export interface BackgroundInfo {
  /** Changes whenever a new file is chosen, so listeners know to reload it. */
  id: number;
  kind: BackgroundKind;
  name: string;
  size: number;
  width: number;
  height: number;
}

export const VIDEO_MAX_BYTES = 25 * 1024 * 1024;
export const BACKGROUND_ACCEPT = 'image/*,video/mp4,video/webm';

/** Shown next to the picker, and used to warn about undersized files. */
export const RECOMMENDED = {
  minWidth: 1280,
  minHeight: 720,
  tips: [
    ['Image', '1920 × 1080 or larger (16:9), up to 3840 × 2160. JPG, PNG or WebP.'],
    ['GIF', '1280 × 720, a few seconds long. GIFs get heavy fast — a video looks better at a fraction of the size.'],
    ['Video', '1920 × 1080 MP4 or WebM, a 10–30 second seamless loop. Plays muted. 25 MB maximum.'],
  ] as const,
};

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Reads the type and pixel size of a picked file, or throws a message fit to show the user. */
export async function inspectBackground(file: File): Promise<Omit<BackgroundInfo, 'id'>> {
  const isVideo = file.type === 'video/mp4' || file.type === 'video/webm';
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) {
    throw new Error('Pick an image, a GIF, or an MP4/WebM video.');
  }
  if (isVideo && file.size > VIDEO_MAX_BYTES) {
    throw new Error(`That video is ${formatBytes(file.size)}. Videos must be 25 MB or smaller.`);
  }

  const url = URL.createObjectURL(file);
  try {
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      if (isVideo) {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight });
        v.onerror = () => reject(new Error('This browser cannot play that video. Try an H.264 MP4.'));
        v.src = url;
      } else {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('That file could not be read as an image.'));
        img.src = url;
      }
    });
    return {
      kind: isVideo ? 'video' : file.type === 'image/gif' ? 'gif' : 'image',
      name: file.name,
      size: file.size,
      ...dims,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ------------------------------------------------------------------ storage */

const DB = 'palace.background';
const STORE = 'files';
const KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveBackgroundFile(file: Blob): Promise<void> {
  await run('readwrite', (s) => s.put(file, KEY));
}

export async function loadBackgroundFile(): Promise<Blob | null> {
  return (await run<Blob | undefined>('readonly', (s) => s.get(KEY))) ?? null;
}

export async function clearBackgroundFile(): Promise<void> {
  await run('readwrite', (s) => s.delete(KEY));
}
