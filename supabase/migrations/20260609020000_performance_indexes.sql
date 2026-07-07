-- Performance indexes for all tables added in recent feature migrations

-- private_consultations
CREATE INDEX IF NOT EXISTS idx_private_consultations_patient ON public.private_consultations(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_private_consultations_status ON public.private_consultations(status);
CREATE INDEX IF NOT EXISTS idx_private_consultations_created_at ON public.private_consultations(created_at DESC);

-- patient_achievements
CREATE INDEX IF NOT EXISTS idx_patient_achievements_user ON public.patient_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_achievements_key ON public.patient_achievements(achievement_key);

-- push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- menstrual_cycles
CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_user ON public.menstrual_cycles(user_id);
CREATE INDEX IF NOT EXISTS idx_menstrual_cycles_start_date ON public.menstrual_cycles(user_id, start_date DESC);

-- preventive_reminders
CREATE INDEX IF NOT EXISTS idx_preventive_reminders_user ON public.preventive_reminders(user_id);

-- corporate_leads
CREATE INDEX IF NOT EXISTS idx_corporate_leads_status ON public.corporate_leads(status);
CREATE INDEX IF NOT EXISTS idx_corporate_leads_created_at ON public.corporate_leads(created_at DESC);

-- corporate_accounts
CREATE INDEX IF NOT EXISTS idx_corporate_accounts_status ON public.corporate_accounts(status);
CREATE INDEX IF NOT EXISTS idx_corporate_accounts_access_code ON public.corporate_accounts(access_code);

-- Original tables that benefit from common query patterns
CREATE INDEX IF NOT EXISTS idx_appointment_requests_status ON public.appointment_requests(status);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_created_at ON public.appointment_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kick_sessions_user ON public.kick_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kick_sessions_started_at ON public.kick_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_user ON public.health_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_health_logs_date ON public.health_logs(user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_doctor_questions_user ON public.doctor_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_doctor_questions_answered ON public.doctor_questions(answered);
CREATE INDEX IF NOT EXISTS idx_checklist_items_user ON public.checklist_items(user_id);
