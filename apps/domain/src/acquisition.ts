export const acquisitionSources = [
  "unknown", "google", "bing", "chatgpt", "perplexity", "copilot", "gemini", "claude",
  "other_campaign", "other_referral", "direct_unknown",
] as const;
export type AcquisitionSource = typeof acquisitionSources[number];
export const publicPages = ["landing", "tasks_guide", "shopping_guide"] as const;
export type PublicPage = typeof publicPages[number];

export function isAcquisitionSource(value: unknown): value is AcquisitionSource {
  return typeof value === "string" && acquisitionSources.some((source) => source === value);
}

export function isPublicPage(value: unknown): value is PublicPage {
  return typeof value === "string" && publicPages.some((page) => page === value);
}

export function campaignTag(value: unknown) {
  if (typeof value !== "string") return null;
  const tag = value.trim();
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(tag) ? tag : null;
}
