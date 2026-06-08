-- Fix: RLS policies missing for baby_name_entries and baby_name_votes
-- These tables had RLS enabled but no policies, blocking all access

-- Allow service_role to manage entries and votes (for server functions)
-- Public can insert entries/votes if they know a valid session (controlled at app layer)
CREATE POLICY "Service manages name entries"
  ON public.baby_name_entries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service manages name votes"
  ON public.baby_name_votes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant authenticated read on entries and votes for potential future direct queries
GRANT SELECT ON public.baby_name_entries TO authenticated;
GRANT SELECT ON public.baby_name_votes    TO authenticated;
