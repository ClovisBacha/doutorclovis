-- Store the Google Meet (or Jitsi fallback) URL for each teleconsulta session
ALTER TABLE teleconsulta_sessions
  ADD COLUMN IF NOT EXISTS meet_url TEXT;
