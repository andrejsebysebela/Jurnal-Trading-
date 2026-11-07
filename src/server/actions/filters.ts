"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { FILTER_COOKIE, parseFilters, type GlobalFilters } from "@/lib/db/filters";

export async function setGlobalFilters(next: Partial<GlobalFilters>) {
  const store = await cookies();
  const current = parseFilters(store.get(FILTER_COOKIE)?.value);
  const merged = parseFilters(JSON.stringify({ ...current, ...next }));
  store.set(FILTER_COOKIE, JSON.stringify(merged), { path: "/", sameSite: "lax", httpOnly: false, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
