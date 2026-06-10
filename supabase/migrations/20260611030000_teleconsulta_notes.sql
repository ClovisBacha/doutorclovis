-- Add clinical_note column to teleconsulta_sessions
ALTER TABLE teleconsulta_sessions
  ADD COLUMN IF NOT EXISTS clinical_note TEXT;

-- Index for quick admin retrieval of sessions with notes
CREATE INDEX IF NOT EXISTS idx_teleconsulta_status
  ON teleconsulta_sessions(status, scheduled_for DESC);
