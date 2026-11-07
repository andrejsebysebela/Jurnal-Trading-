import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "./config";
import { getDictionary } from "./dictionaries";
import { createFormatter } from "./format";

/** Locale from the cookie, else Accept-Language. Cached per request. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return negotiateLocale((await headers()).get("accept-language"));
});

export const getI18n = cache(async () => {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale), f: createFormatter(locale) };
});
