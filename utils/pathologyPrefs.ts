/**
 * Preferencias locales de patologías: favoritos y recientes.
 * Se guardan en localStorage (por dispositivo), sin depender del backend.
 */

const FAVORITES_KEY = 'pathology_favorites';
const RECENTS_KEY = 'pathology_recents';
const MAX_RECENTS = 6;

function readList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function getFavoritePathologies(): string[] {
  return readList(FAVORITES_KEY);
}

export function isFavoritePathology(id: string): boolean {
  return getFavoritePathologies().includes(id);
}

/** Alterna el estado de favorito y devuelve la lista actualizada. */
export function toggleFavoritePathology(id: string): string[] {
  const current = getFavoritePathologies();
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  writeList(FAVORITES_KEY, next);
  return next;
}

export function getRecentPathologies(): string[] {
  return readList(RECENTS_KEY);
}

/** Registra una patología como reciente (más reciente primero, sin duplicados). */
export function addRecentPathology(id: string): string[] {
  const current = getRecentPathologies().filter((x) => x !== id);
  const next = [id, ...current].slice(0, MAX_RECENTS);
  writeList(RECENTS_KEY, next);
  return next;
}
