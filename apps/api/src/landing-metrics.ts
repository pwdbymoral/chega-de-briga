import { isAcquisitionSource, isPublicPage, type AcquisitionSource, type PublicPage } from "@chega-de-briga/domain";
import type { Pool } from "pg";

export function parseLandingEvent(body: Record<string, unknown>) {
  const page = body.page === undefined ? "landing" : body.page;
  const source = body.source === undefined ? "unknown" : body.source;
  if (!isPublicPage(page) || !isAcquisitionSource(source)
    || body.channel !== undefined && body.channel !== "email" && body.channel !== "whatsapp") return null;
  if (body.event === "form_start" && page === "landing") return { event: "form_start", page, source };
  if (body.event === "view") return { event: page === "landing" ? "landing_view" : "guide_view", page, source };
  return null;
}

export async function readAcquisitionAnalytics(database: Pick<Pool, "query">, period: number) {
  const [sources, pages] = await Promise.all([
    database.query<{ source: AcquisitionSource; page_loads: number; guide_views: number; form_starts: number; signups: number }>(
      `SELECT acquisition_source AS source,
        count(*) FILTER (WHERE event_type='landing_view')::int AS page_loads,
        count(*) FILTER (WHERE event_type='guide_view')::int AS guide_views,
        count(*) FILTER (WHERE event_type='form_start')::int AS form_starts,
        count(*) FILTER (WHERE event_type='waitlist_signup')::int AS signups
       FROM public_landing_events WHERE occurred_at>=now()-($1::int*interval '1 day')
       GROUP BY acquisition_source ORDER BY signups DESC,page_loads DESC,source`, [period],
    ),
    database.query<{ page: PublicPage; views: number }>(
      `SELECT page_key AS page,count(*)::int AS views FROM public_landing_events
       WHERE event_type='guide_view' AND occurred_at>=now()-($1::int*interval '1 day')
       GROUP BY page_key ORDER BY page_key`, [period],
    ),
  ]);
  return {
    bySource: sources.rows.map((row) => ({
      source: row.source, pageLoads: row.page_loads, guideViews: row.guide_views,
      formStarts: row.form_starts, signups: row.signups,
      conversion: row.page_loads ? row.signups / row.page_loads : null,
    })),
    byGuide: pages.rows,
  };
}
