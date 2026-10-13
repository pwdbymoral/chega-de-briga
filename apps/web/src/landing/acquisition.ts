import { campaignTag, isAcquisitionSource, type AcquisitionSource } from "@chega-de-briga/domain";

export type Campaign = { utm_source?: string; utm_medium?: string; utm_campaign?: string };
export type Acquisition = Campaign & { source: AcquisitionSource };
export type Attribution = { acquisition: Acquisition; expiresAt: number };
const storageKey = "cdb-acquisition";
export const attributionLifetime = 30 * 60 * 1000;
const aliases: Record<string, AcquisitionSource> = {
  google: "google", "google.com": "google", "google.com.br": "google",
  bing: "bing", "bing.com": "bing",
  chatgpt: "chatgpt", "chatgpt.com": "chatgpt", "chat.openai.com": "chatgpt",
  perplexity: "perplexity", "perplexity.ai": "perplexity",
  copilot: "copilot", "copilot.microsoft.com": "copilot",
  gemini: "gemini", "gemini.google.com": "gemini",
  claude: "claude", "claude.ai": "claude",
};
// Specific assistant hosts precede their parent search domains.
const hosts: [string, AcquisitionSource][] = [
  ["gemini.google.com", "gemini"], ["copilot.microsoft.com", "copilot"],
  ["chatgpt.com", "chatgpt"], ["chat.openai.com", "chatgpt"],
  ["perplexity.ai", "perplexity"], ["claude.ai", "claude"],
  ["google.com", "google"], ["google.com.br", "google"], ["bing.com", "bing"],
];

function campaignFrom(values: Record<string, unknown>): Campaign {
  return Object.fromEntries(["utm_source", "utm_medium", "utm_campaign"].flatMap((key) => {
    const value = campaignTag(values[key]);
    return value ? [[key, value]] : [];
  }));
}

export function resolveAcquisition(
  href: string,
  referrer: string,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  now = Date.now(),
): Attribution {
  const url = new URL(href);
  const campaign = campaignFrom(Object.fromEntries(url.searchParams));
  const hasCampaign = Object.keys(campaign).length > 0;
  let externalHost = "";
  try {
    const ref = new URL(referrer);
    if (["http:", "https:"].includes(ref.protocol) && ref.origin !== url.origin) externalHost = ref.hostname;
  } catch { /* No usable referrer. */ }

  if (!hasCampaign && !externalHost) {
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) ?? "null") as Record<string, unknown> | null;
      if (saved && isAcquisitionSource(saved.source) && typeof saved.expiresAt === "number"
        && saved.expiresAt > now && saved.expiresAt <= now + attributionLifetime) {
        return { acquisition: { source: saved.source, ...campaignFrom(saved) }, expiresAt: saved.expiresAt };
      }
      storage?.removeItem(storageKey);
    } catch { /* Storage is optional; attribution must not block the page. */ }
  }

  const alias = campaign.utm_source?.toLowerCase() ?? "";
  const source = Object.hasOwn(aliases, alias) ? aliases[alias]!
    : externalHost
      ? hosts.find(([host]) => externalHost === host || externalHost.endsWith(`.${host}`))?.[1] ?? (hasCampaign ? "other_campaign" : "other_referral")
      : hasCampaign ? "other_campaign" : "direct_unknown";
  const result = { source, ...campaign };
  try { storage?.setItem(storageKey, JSON.stringify({ ...result, expiresAt: now + attributionLifetime })); }
  catch { /* The current page still reports its available context. */ }
  return { acquisition: result, expiresAt: now + attributionLifetime };
}

export function activeAcquisition(context: Attribution, now = Date.now()): Acquisition {
  return context.expiresAt > now ? context.acquisition : { source: "direct_unknown" };
}

export function browserAcquisition(): Attribution {
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch { /* Disabled by browser policy. */ }
  return resolveAcquisition(window.location.href, document.referrer, storage);
}
