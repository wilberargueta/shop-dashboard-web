interface CacheEntry {
  xml: string;
  expiresAt: number;
}

/** 1 hora (PROJECT_SPEC.md §9). Instancia única del servidor, sin Redis — mismo criterio que el backend usa para su límite de peticiones (ARQUITECTURA.md §7). */
const TTL_MS = 3_600_000;

let cache: CacheEntry | null = null;

export async function getCachedSitemapXml(build: () => Promise<string>, now: () => number = Date.now): Promise<string> {
  const currentTime = now();
  if (cache && cache.expiresAt > currentTime) {
    return cache.xml;
  }
  const xml = await build();
  cache = { xml, expiresAt: currentTime + TTL_MS };
  return xml;
}

/** Solo para tests: evita que el estado de un caso se filtre al siguiente. */
export function resetSitemapCacheForTests(): void {
  cache = null;
}
