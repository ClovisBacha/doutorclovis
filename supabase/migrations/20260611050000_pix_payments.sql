-- Add Mercado Pago PIX fields to private_consultations
ALTER TABLE private_consultations
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code TEXT,
  ADD COLUMN IF NOT EXISTS pix_qr_code_base64 TEXT,
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER;

-- Index for webhook lookup
CREATE INDEX IF NOT EXISTS idx_private_consultations_mp_payment_id
  ON private_consultations(mp_payment_id)
  WHERE mp_payment_id IS NOT NULL;
