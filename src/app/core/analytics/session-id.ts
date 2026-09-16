const STORAGE_KEY = 'analytics_session_id';

/**
 * "El `session_id` lo genera el navegador y vive en `sessionStorage`"
 * (ARQUITECTURA.md §4.7). Asume contexto de navegador — igual que
 * `selection-storage.ts` — porque quien la llama (`AnalyticsEventService`) ya
 * comprobó `isPlatformBrowser` antes de invocarla.
 */
export function getOrCreateSessionId(): string {
  const existing = sessionStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const generated = crypto.randomUUID();
  sessionStorage.setItem(STORAGE_KEY, generated);
  return generated;
}
