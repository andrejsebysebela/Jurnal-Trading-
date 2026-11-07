export const LOCALES = ["sk", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "edgelog_locale";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Pick a locale from an Accept-Language header (Slovak and Czech speakers get Slovak). */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  const langs = (acceptLanguage ?? "").toLowerCase().split(",").map((p) => p.split(";")[0].trim());
  for (const l of langs) {
    if (l.startsWith("sk") || l.startsWith("cs")) return "sk";
    if (l.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

/** Plural forms: Slovak needs one / few (2–4) / other (5+, 0). */
export type Plural = { one: string; few?: string; other: string };

export function plural(locale: Locale, n: number, forms: Plural): string {
  const rule = new Intl.PluralRules(locale === "sk" ? "sk-SK" : "en-US").select(n);
  const s = rule === "one" ? forms.one : rule === "few" ? forms.few ?? forms.other : forms.other;
  return s.replace("{n}", String(n));
}

/** Replace {name} placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
