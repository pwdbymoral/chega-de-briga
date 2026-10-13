ALTER TABLE public_landing_events
  ADD COLUMN acquisition_source text NOT NULL DEFAULT 'unknown'
    CHECK (acquisition_source IN ('unknown','google','bing','chatgpt','perplexity','copilot','gemini','claude','other_campaign','other_referral','direct_unknown')),
  ADD COLUMN page_key text NOT NULL DEFAULT 'landing'
    CHECK (page_key IN ('landing','tasks_guide','shopping_guide'));

ALTER TABLE public_landing_events DROP CONSTRAINT public_landing_events_event_type_check;
ALTER TABLE public_landing_events ADD CONSTRAINT public_landing_events_event_type_check
  CHECK (event_type IN ('landing_view','guide_view','form_start','waitlist_signup'));
ALTER TABLE public_landing_events ADD CONSTRAINT public_landing_events_page_event_check
  CHECK ((event_type='guide_view' AND page_key IN ('tasks_guide','shopping_guide'))
    OR (event_type<>'guide_view' AND page_key='landing'));
