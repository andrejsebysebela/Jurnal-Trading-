"use client";
import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { getDictionary } from "./dictionaries";
import { createFormatter } from "./format";

const Ctx = createContext<Locale>("en");

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

/** Dictionary + formatter for client components (both dictionaries are bundled; they are small). */
export function useI18n() {
  const locale = useContext(Ctx);
  return useMemo(() => ({ locale, t: getDictionary(locale), f: createFormatter(locale) }), [locale]);
}
