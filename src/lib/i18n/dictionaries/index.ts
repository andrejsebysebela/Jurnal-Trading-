import type { Locale } from "../config";
import en, { type Dictionary } from "./en";
import sk from "./sk";

const DICTS: Record<Locale, Dictionary> = { en, sk };
export const getDictionary = (locale: Locale): Dictionary => DICTS[locale];
export type { Dictionary };
