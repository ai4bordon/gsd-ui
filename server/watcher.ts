import { watch } from "chokidar"
import type { FileEvent } from "./types.ts"

/**
 * Create a debounced file watcher for a .planning/ directory.
 * Emits batched file change events after a quiet period.
 *
 * @param planningPath - The .planning/ directory to watch
 * @param onChange - Callback invoked with batched file events
 * @param debounceMs - Debounce period in ms (default: 300)
 */
export function createWatcher(
  planningPath: string,
  onChange: (events: FileEvent[]) => void,
  debounceMs = 300
): ReturnType<typeof watch> {
  const pending: FileEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    if (pending.length === 0) return
    const batch = [...pending]
    pending.length = 0
    onChange(batch)
  }

  function enqueue(type: FileEvent["type"], path: string) {
    // Only watch markdown and json files
    if (!path.endsWith(".md") && !path.endsWith(".json")) return

    pending.push({ type, path })

    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, debounceMs)
  }

  const watcher = watch(planningPath, {
    ignoreInitial: true,
    persistent: true,
    // Ignore dependency directories. Do not ignore dot-paths globally,
    // because the watched root itself is usually `.planning`.
    ignored: [
      /node_modules/,
    ],
    // Use polling as a fallback for network filesystems
    usePolling: false,
    // Don't follow symlinks into other directories
    followSymlinks: false,
  })

  watcher.on("add", (path) => enqueue("add", path))
  watcher.on("change", (path) => enqueue("change", path))
  watcher.on("unlink", (path) => enqueue("unlink", path))

  return watcher
}
