const KEY = "mf-last-restaurant-slug";

export function setLastRestaurantSlug(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(KEY, slug);
  } catch {
    // ignore: storage indisponível (modo privado etc.)
  }
}

export function getLastRestaurantSlug(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
