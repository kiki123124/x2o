/**
 * Bookmarks GraphQL queryId.
 *
 * Previously fetched dynamically from X's main.js, but downloading large
 * pages through Tauri's HTTP plugin causes IPC serialization to explode
 * memory (JSON.stringify on MB-sized response buffers → 9GB+).
 *
 * Use a static known ID. If X rotates it, update here.
 */
const KNOWN_QUERY_ID = "-LGfdImKeQz0xS_jjUwzlA";

export async function resolveBookmarkQueryId(): Promise<string> {
  return KNOWN_QUERY_ID;
}
