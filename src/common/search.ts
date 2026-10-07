export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/\u0640/g, "")
    .replace(/ة/g, "ه")
    .toLocaleLowerCase("fr")
    .trim();
}
