/**
 * i18n helpers – typed lookup with dot-notation key paths and fallback
 * to the key itself when a translation is missing.
 */
import { useCallback } from "react";
import { messages, type Locale, type Messages } from "./messages";

type Path<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: Path<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>;
    }[keyof T & string]
  : Prefix;

export type MessageKey = Path<Messages>;

/**
 * Resolve a dot-path against an object.
 * Returns the string value, or the key itself as a fallback.
 */
function resolve(obj: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return path;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : path;
}

/**
 * Pure translation helper.
 * @param locale  BCP 47 locale tag (e.g. "en")
 * @param key     Dot-separated key path into the messages catalog
 * @returns       Translated string, or the key as fallback
 */
export function t(key: MessageKey, locale: Locale = "en"): string {
  const catalog = messages[locale] ?? messages.en;
  return resolve(catalog as unknown as Record<string, unknown>, key);
}

/**
 * React hook that returns a locale-bound `t()` function.
 * @param locale  BCP 47 locale tag (defaults to "en")
 */
export function useTranslations(locale: Locale = "en") {
  const translate = useCallback(
    (key: MessageKey) => t(key, locale),
    [locale],
  );
  return translate;
}
