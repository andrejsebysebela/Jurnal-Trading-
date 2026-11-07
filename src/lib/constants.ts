/** Emotion keys stored in trades.emotional_state; labels come from the i18n dictionary. */
export const EMOTIONS = ["calm", "confident", "focused", "patient", "anxious", "fearful", "greedy", "impatient", "frustrated", "overconfident", "fomo", "revenge", "bored", "tired"] as const;
export type Emotion = (typeof EMOTIONS)[number];

/** Normalise legacy values ("Calm", "FOMO") to keys; unknown values are returned as-is. */
export function emotionKey(v: string | null | undefined): string | null {
  if (!v) return null;
  const k = v.trim().toLowerCase();
  return (EMOTIONS as readonly string[]).includes(k) ? k : v.trim();
}

export const PROP_PHASES = ["challenge", "verification", "funded"] as const;
export const PERSONAL_PHASES = ["live", "demo"] as const;
