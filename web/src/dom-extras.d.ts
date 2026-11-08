// Browser APIs present in supported engines but not yet declared by the project's ES2023 libraries.

/** Atomics.waitAsync, of ES2024: used for the renderer, network and I/O worker doorbells. */
interface Atomics {
  waitAsync(typedArray: Int32Array, index: number, value: number, timeout?: number):
    { async: false; value: 'not-equal' | 'timed-out' } | { async: true; value: Promise<'ok' | 'timed-out'> };
}

/** Synchronous file handles used inside dedicated workers. */
interface FileSystemFileHandle {
  createSyncAccessHandle(options?: { mode?: 'readwrite' | 'read-only' | 'readwrite-unsafe' }): Promise<FileSystemSyncAccessHandle>;
}
