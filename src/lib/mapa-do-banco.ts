/**
 * O QUE CADA `APLICAR_*.sql` PROMETE AO BANCO — GERADO, NÃO EDITE.
 *
 * ⚠️ Regenerar: `bun scripts/gerar-mapa-do-banco.ts`. A leitura da pasta mora
 * em `mapa-do-banco.gerar.ts`, com a explicação inteira;
 * `mapa-do-banco.test.ts` cobra que este arquivo esteja em dia.
 */
export type AlvoDoBanco = {
  tabela: string;
  /** Vazio = a tabela inteira nasce neste arquivo. */
  colunas: string[];
};
export type ArquivoDoBanco = { arquivo: string; alvos: AlvoDoBanco[] };

export const MAPA_DO_BANCO: readonly ArquivoDoBanco[] = [
  {
    arquivo: "APLICAR_ACOMPANHANTE.sql",
    alvos: [
      {
        tabela: "companion_notes",
        colunas: [],
      },
      {
        tabela: "companion_invites",
        colunas: [
          "aceito_em",
          "aceito_por",
          "apelido",
          "papel",
          "ver_consultas",
          "ver_humor",
          "ver_saude",
        ],
      },
    ],
  },
  {
    arquivo: "APLICAR_AGENDA.sql",
    alvos: [
      {
        tabela: "appointment_waitlist",
        colunas: [],
      },
      {
        tabela: "appointment_requests",
        colunas: ["confirmed_date", "confirmed_time", "proposed_date", "proposed_time"],
      },
    ],
  },
  {
    arquivo: "APLICAR_AMIZADES.sql",
    alvos: [
      {
        tabela: "amizades_encerradas",
        colunas: [],
      },
      {
        tabela: "duplas",
        colunas: ["avisada_em"],
      },
    ],
  },
  {
    arquivo: "APLICAR_AMIZADES_ENTRE_CONTAS.sql",
    alvos: [
      {
        tabela: "amizades",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_AVISOS_E_DESCOBERTA.sql",
    alvos: [
      {
        tabela: "patient_profiles",
        colunas: ["avisos_desligados", "bio_link"],
      },
    ],
  },
  {
    arquivo: "APLICAR_CHA_DE_BEBE.sql",
    alvos: [
      {
        tabela: "presente_itens",
        colunas: [],
      },
      {
        tabela: "presente_listas",
        colunas: [],
      },
      {
        tabela: "presente_reservas",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_COBERTURA.sql",
    alvos: [
      {
        tabela: "ai_usage",
        colunas: ["cobertura", "similaridade"],
      },
    ],
  },
  {
    arquivo: "APLICAR_COMENTARIOS_E_LIMITES.sql",
    alvos: [
      {
        tabela: "rede_comentario_curtidas",
        colunas: [],
      },
      {
        tabela: "rede_restricoes",
        colunas: [],
      },
      {
        tabela: "patient_profiles",
        colunas: ["palavras_ocultas"],
      },
      {
        tabela: "rede_comentarios",
        colunas: ["responde_a"],
      },
      {
        tabela: "rede_posts",
        colunas: ["alt_texto"],
      },
    ],
  },
  {
    arquivo: "APLICAR_COMUNIDADE_VIVA.sql",
    alvos: [
      {
        tabela: "patient_filhos",
        colunas: [],
      },
      {
        tabela: "patient_profiles",
        colunas: ["feed_so_seguindo"],
      },
      {
        tabela: "rede_posts",
        colunas: ["marco_dias", "marco_filho", "marco_tipo"],
      },
    ],
  },
  {
    arquivo: "APLICAR_CONSULTA.sql",
    alvos: [
      {
        tabela: "consultations",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_CONSULTA_DA_PACIENTE.sql",
    alvos: [
      {
        tabela: "appointment_requests",
        colunas: ["confirmed_date", "patient_user_id"],
      },
    ],
  },
  {
    arquivo: "APLICAR_CONTA_OFICIAL.sql",
    alvos: [
      {
        tabela: "patient_profiles",
        colunas: ["conta_oficial"],
      },
    ],
  },
  {
    arquivo: "APLICAR_CONTEUDO_DA_REDE.sql",
    alvos: [
      {
        tabela: "rede_posts",
        colunas: ["lugar"],
      },
      {
        tabela: "rede_stories",
        colunas: ["imagens"],
      },
    ],
  },
  {
    arquivo: "APLICAR_CONVERSA_E_COMENTARIOS.sql",
    alvos: [
      {
        tabela: "rede_comentarios",
        colunas: [],
      },
      {
        tabela: "rede_conversas",
        colunas: [],
      },
      {
        tabela: "rede_mensagens",
        colunas: [],
      },
      {
        tabela: "rede_posts",
        colunas: ["comentarios_abertos"],
      },
    ],
  },
  {
    arquivo: "APLICAR_CONVERSA_SILENCIAR.sql",
    alvos: [
      {
        tabela: "rede_conversas",
        colunas: ["saiu_a", "saiu_b", "silenciada_a", "silenciada_b"],
      },
      {
        tabela: "rede_mensagens",
        colunas: ["imagem_path", "ref_id", "ref_tipo"],
      },
    ],
  },
  {
    arquivo: "APLICAR_DEZ_DA_REDE.sql",
    alvos: [
      {
        tabela: "rede_mensagem_reacoes",
        colunas: [],
      },
      {
        tabela: "patient_profiles",
        colunas: ["rede_pausada_em"],
      },
      {
        tabela: "rede_comentarios",
        colunas: ["fixado_em"],
      },
      {
        tabela: "rede_mensagens",
        colunas: ["responde_a"],
      },
      {
        tabela: "rede_posts",
        colunas: ["quem_comenta"],
      },
      {
        tabela: "rede_silenciados",
        colunas: ["cala_posts", "cala_stories"],
      },
    ],
  },
  {
    arquivo: "APLICAR_DIRECT_COMPLETO.sql",
    alvos: [
      {
        tabela: "rede_grupo_membros",
        colunas: [],
      },
      {
        tabela: "rede_grupos",
        colunas: [],
      },
      {
        tabela: "rede_conversas",
        colunas: ["fixada_a", "fixada_b"],
      },
      {
        tabela: "rede_mensagens",
        colunas: ["audio_path", "duracao_seg", "grupo_id"],
      },
    ],
  },
  {
    arquivo: "APLICAR_DISPONIBILIDADE.sql",
    alvos: [
      {
        tabela: "doctor_blocks",
        colunas: [],
      },
      {
        tabela: "doctor_slots",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_DUPLAS.sql",
    alvos: [
      {
        tabela: "duplas",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_DURACAO_DA_CONSULTA.sql",
    alvos: [
      {
        tabela: "appointment_requests",
        colunas: ["duration_minutes"],
      },
    ],
  },
  {
    arquivo: "APLICAR_EVENTOS_CLINICOS.sql",
    alvos: [
      {
        tabela: "clinical_acks",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_FIXAR_E_STORY_DE_POST.sql",
    alvos: [
      {
        tabela: "rede_posts",
        colunas: ["fixado_em"],
      },
      {
        tabela: "rede_stories",
        colunas: ["post_de"],
      },
    ],
  },
  {
    arquivo: "APLICAR_FOTO_E_ULTIMA_VEZ.sql",
    alvos: [
      {
        tabela: "patient_profiles",
        colunas: ["avatar_url", "last_seen_at"],
      },
    ],
  },
  {
    arquivo: "APLICAR_GAMIFICACAO.sql",
    alvos: [
      {
        tabela: "cantinho_items",
        colunas: [],
      },
      {
        tabela: "sementinhas_ledger",
        colunas: [],
      },
      {
        tabela: "testimonials",
        colunas: [],
      },
      {
        tabela: "patient_profiles",
        colunas: [
          "cantinho_fundo",
          "care_mode",
          "care_mode_since",
          "instagram_handle",
          "referral_code",
          "referred_by",
        ],
      },
    ],
  },
  {
    arquivo: "APLICAR_HORA_DA_CONSULTA.sql",
    alvos: [
      {
        tabela: "private_consultations",
        colunas: ["scheduled_for"],
      },
    ],
  },
  {
    arquivo: "APLICAR_IDADE_DO_CONHECIMENTO.sql",
    alvos: [
      {
        tabela: "brain_entries",
        colunas: ["updated_at"],
      },
    ],
  },
  {
    arquivo: "APLICAR_IMAGENS_NO_STORAGE.sql",
    alvos: [
      {
        tabela: "exam_files",
        colunas: ["image_path"],
      },
      {
        tabela: "family_album_posts",
        colunas: ["image_path"],
      },
    ],
  },
  {
    arquivo: "APLICAR_INFLUENCIADORA.sql",
    alvos: [
      {
        tabela: "affiliates",
        colunas: ["email"],
      },
    ],
  },
  {
    arquivo: "APLICAR_LACUNAS_PARECIDAS.sql",
    alvos: [
      {
        tabela: "brain_gaps",
        colunas: ["embedding"],
      },
    ],
  },
  {
    arquivo: "APLICAR_LACUNA_VOLTA.sql",
    alvos: [
      {
        tabela: "brain_gaps",
        colunas: ["hits_ao_ignorar"],
      },
    ],
  },
  {
    arquivo: "APLICAR_LEMBRETES.sql",
    alvos: [
      {
        tabela: "appointment_reminders",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_LEMBRETE_DE_MEDITACAO.sql",
    alvos: [
      {
        tabela: "patient_profiles",
        colunas: ["med_reminder_offset", "med_reminder_sent_at", "med_reminder_utc_min"],
      },
    ],
  },
  {
    arquivo: "APLICAR_MAIS_DA_REDE.sql",
    alvos: [
      {
        tabela: "rede_rascunhos",
        colunas: [],
      },
      {
        tabela: "rede_story_escondido",
        colunas: [],
      },
      {
        tabela: "rede_denuncias",
        colunas: ["desfecho"],
      },
      {
        tabela: "rede_posts",
        colunas: ["codigo_publico"],
      },
    ],
  },
  {
    arquivo: "APLICAR_MAIS_DEZ_DA_REDE.sql",
    alvos: [
      {
        tabela: "rede_favoritos",
        colunas: [],
      },
      {
        tabela: "rede_notas",
        colunas: [],
      },
      {
        tabela: "rede_story_marcacoes",
        colunas: [],
      },
      {
        tabela: "rede_comentarios",
        colunas: ["editado_em"],
      },
      {
        tabela: "rede_salvos",
        colunas: ["colecao"],
      },
      {
        tabela: "rede_stories",
        colunas: ["destaque_titulo"],
      },
    ],
  },
  {
    arquivo: "APLICAR_MEDICO.sql",
    alvos: [
      {
        tabela: "doctor_addresses",
        colunas: [],
      },
      {
        tabela: "doctor_questions",
        colunas: ["answer", "answered_at"],
      },
      {
        tabela: "doctors",
        colunas: [
          "accepts_insurance",
          "accepts_private",
          "approach",
          "bio",
          "city",
          "consultation_currency",
          "consultation_price_brl",
          "consultation_price_cents",
          "crm_conferido_em",
          "crm_conferido_nome",
          "crm_conferido_situacao",
          "education",
          "focos",
          "has_doctorate",
          "has_masters",
          "hospitals",
          "instagram",
          "insurances",
          "languages",
          "offers_telehealth",
          "personal_phone",
          "photo_url",
          "plan_expires_at",
          "rqe",
          "state",
          "subspecialty",
          "verified",
          "years_experience",
        ],
      },
      {
        tabela: "panic_events",
        colunas: ["atendido_em", "atendido_por", "doctor_id", "ficha", "motivo"],
      },
    ],
  },
  {
    arquivo: "APLICAR_MENCOES_E_TAGS.sql",
    alvos: [
      {
        tabela: "rede_handles_antigos",
        colunas: [],
      },
      {
        tabela: "rede_tags",
        colunas: [],
      },
      {
        tabela: "patient_profiles",
        colunas: ["handle", "quem_pode_mencionar"],
      },
    ],
  },
  {
    arquivo: "APLICAR_NOVE_DA_REDE.sql",
    alvos: [
      {
        tabela: "rede_memorias_vistas",
        colunas: [],
      },
      {
        tabela: "rede_triagem_barrada",
        colunas: [],
      },
      {
        tabela: "rede_conversas",
        colunas: ["arquivada_a", "arquivada_b"],
      },
      {
        tabela: "rede_mensagens",
        colunas: ["editada_em"],
      },
      {
        tabela: "rede_posts",
        colunas: ["ciclo", "motivo_sensivel", "sensivel", "video_legenda"],
      },
      {
        tabela: "rede_stories",
        colunas: ["motivo_sensivel", "sensivel", "video_path"],
      },
    ],
  },
  {
    arquivo: "APLICAR_PENDENTES.sql",
    alvos: [
      {
        tabela: "affiliate_earnings",
        colunas: [],
      },
      {
        tabela: "affiliates",
        colunas: [],
      },
      {
        tabela: "announcement_dismissals",
        colunas: [],
      },
      {
        tabela: "appointment_waitlist",
        colunas: [],
      },
      {
        tabela: "audit_log",
        colunas: [],
      },
      {
        tabela: "baby_letters",
        colunas: [],
      },
      {
        tabela: "baby_milestones",
        colunas: [],
      },
      {
        tabela: "baby_name_entries",
        colunas: [],
      },
      {
        tabela: "baby_name_sessions",
        colunas: [],
      },
      {
        tabela: "baby_name_votes",
        colunas: [],
      },
      {
        tabela: "baby_vaccines",
        colunas: [],
      },
      {
        tabela: "baby_weights",
        colunas: [],
      },
      {
        tabela: "biometry_logs",
        colunas: [],
      },
      {
        tabela: "birth_plans",
        colunas: [],
      },
      {
        tabela: "blocked_dates",
        colunas: [],
      },
      {
        tabela: "brain_entries",
        colunas: [],
      },
      {
        tabela: "brain_feedback",
        colunas: [],
      },
      {
        tabela: "brain_gap_askers",
        colunas: [],
      },
      {
        tabela: "brain_gaps",
        colunas: [],
      },
      {
        tabela: "brain_hits",
        colunas: [],
      },
      {
        tabela: "brain_settings",
        colunas: [],
      },
      {
        tabela: "breastfeeding_logs",
        colunas: [],
      },
      {
        tabela: "cantinho_items",
        colunas: [],
      },
      {
        tabela: "chat_memory",
        colunas: [],
      },
      {
        tabela: "chat_messages",
        colunas: [],
      },
      {
        tabela: "clinics",
        colunas: [],
      },
      {
        tabela: "consultation_notes",
        colunas: [],
      },
      {
        tabela: "contraction_logs",
        colunas: [],
      },
      {
        tabela: "corporate_accounts",
        colunas: [],
      },
      {
        tabela: "corporate_leads",
        colunas: [],
      },
      {
        tabela: "course_progress",
        colunas: [],
      },
      {
        tabela: "doctor_accounts",
        colunas: [],
      },
      {
        tabela: "doctor_availability",
        colunas: [],
      },
      {
        tabela: "doctor_google_tokens",
        colunas: [],
      },
      {
        tabela: "doctor_leads",
        colunas: [],
      },
      {
        tabela: "doctor_whatsapp_numbers",
        colunas: [],
      },
      {
        tabela: "doctors",
        colunas: [],
      },
      {
        tabela: "doctorthink_api_keys",
        colunas: [],
      },
      {
        tabela: "doctorthink_usage",
        colunas: [],
      },
      {
        tabela: "epds_logs",
        colunas: [],
      },
      {
        tabela: "epds_screenings",
        colunas: [],
      },
      {
        tabela: "exam_files",
        colunas: [],
      },
      {
        tabela: "experience_leads",
        colunas: [],
      },
      {
        tabela: "family_album_posts",
        colunas: [],
      },
      {
        tabela: "glucose_diary",
        colunas: [],
      },
      {
        tabela: "invite_codes",
        colunas: [],
      },
      {
        tabela: "journey_state",
        colunas: [],
      },
      {
        tabela: "lives",
        colunas: [],
      },
      {
        tabela: "menstrual_cycles",
        colunas: [],
      },
      {
        tabela: "nps_responses",
        colunas: [],
      },
      {
        tabela: "panic_events",
        colunas: [],
      },
      {
        tabela: "patient_achievements",
        colunas: [],
      },
      {
        tabela: "patient_link_requests",
        colunas: [],
      },
      {
        tabela: "payment_incidents",
        colunas: [],
      },
      {
        tabela: "platform_announcements",
        colunas: [],
      },
      {
        tabela: "platform_coupon_redemptions",
        colunas: [],
      },
      {
        tabela: "platform_coupons",
        colunas: [],
      },
      {
        tabela: "platform_flags",
        colunas: [],
      },
      {
        tabela: "ppd_screenings",
        colunas: [],
      },
      {
        tabela: "preconsulta_forms",
        colunas: [],
      },
      {
        tabela: "preventive_reminders",
        colunas: [],
      },
      {
        tabela: "private_consultations",
        colunas: [],
      },
      {
        tabela: "push_subscriptions",
        colunas: [],
      },
      {
        tabela: "sementinhas_ledger",
        colunas: [],
      },
      {
        tabela: "subscriptions",
        colunas: [],
      },
      {
        tabela: "teleconsulta_sessions",
        colunas: [],
      },
      {
        tabela: "testimonials",
        colunas: [],
      },
      {
        tabela: "triage_logs",
        colunas: [],
      },
      {
        tabela: "whatsapp_conversations",
        colunas: [],
      },
      {
        tabela: "appointment_requests",
        colunas: [
          "confirmed_date",
          "confirmed_time",
          "doctor_id",
          "internal_notes",
          "payment_status",
          "price_brl",
          "proposed_date",
          "proposed_time",
        ],
      },
      {
        tabela: "doctor_questions",
        colunas: ["answer", "answered_at", "doctor_id"],
      },
      {
        tabela: "health_logs",
        colunas: ["glucose_mg_dl", "heart_rate_bpm", "sleep_hours", "spo2", "steps"],
      },
      {
        tabela: "patient_profiles",
        colunas: [
          "baby_skin_tone",
          "birth_date",
          "cantinho_fundo",
          "care_mode",
          "care_mode_since",
          "checklist_seeded",
          "corporate_account_id",
          "doctor_id",
          "fetal_bpm",
          "fetal_bpm_at",
          "height_cm",
          "home_city",
          "home_lat",
          "home_lon",
          "instagram_handle",
          "invite_code",
          "medications",
          "pre_pregnancy_weight_kg",
          "pregnancy_number",
          "prior_bp_elevated",
          "prior_bp_week",
          "prior_cesarean",
          "prior_gestational_diabetes",
          "prior_notes",
          "prior_preterm",
          "quiz_premium",
          "ref_code",
          "referral_code",
          "referred_by",
          "sky_theme",
        ],
      },
    ],
  },
  {
    arquivo: "APLICAR_PERGUNTA_DE_CADA_UMA.sql",
    alvos: [
      {
        tabela: "brain_gap_askers",
        colunas: ["pergunta"],
      },
    ],
  },
  {
    arquivo: "APLICAR_PUSH_NATIVO.sql",
    alvos: [
      {
        tabela: "native_push_tokens",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_QUEM_PERGUNTOU.sql",
    alvos: [
      {
        tabela: "brain_gap_askers",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_RECEITAS.sql",
    alvos: [
      {
        tabela: "doctor_orders",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_REDE_SOCIAL.sql",
    alvos: [
      {
        tabela: "desafio_participantes",
        colunas: [],
      },
      {
        tabela: "desafios_em_grupo",
        colunas: [],
      },
      {
        tabela: "rede_atividade",
        colunas: [],
      },
      {
        tabela: "rede_bloqueios",
        colunas: [],
      },
      {
        tabela: "rede_denuncias",
        colunas: [],
      },
      {
        tabela: "rede_marcacoes",
        colunas: [],
      },
      {
        tabela: "rede_perguntas",
        colunas: [],
      },
      {
        tabela: "rede_posts",
        colunas: [],
      },
      {
        tabela: "rede_reacoes",
        colunas: [],
      },
      {
        tabela: "rede_salvos",
        colunas: [],
      },
      {
        tabela: "rede_seguidores",
        colunas: [],
      },
      {
        tabela: "rede_silenciados",
        colunas: [],
      },
      {
        tabela: "rede_stories",
        colunas: [],
      },
      {
        tabela: "rede_stories_vistos",
        colunas: [],
      },
      {
        tabela: "rede_story_reacoes",
        colunas: [],
      },
      {
        tabela: "rede_story_votos",
        colunas: [],
      },
      {
        tabela: "rede_votos",
        colunas: [],
      },
      {
        tabela: "patient_profiles",
        colunas: [
          "aceita_perguntas",
          "bio",
          "mostrar_bebe",
          "mostrar_semana",
          "perfil_publico",
          "vitrine_publica",
        ],
      },
    ],
  },
  {
    arquivo: "APLICAR_REVISAO.sql",
    alvos: [
      {
        tabela: "brain_feedback",
        colunas: ["answer", "entry_id", "resolved_at", "status"],
      },
    ],
  },
  {
    arquivo: "APLICAR_SOS.sql",
    alvos: [
      {
        tabela: "panic_events",
        colunas: ["channels"],
      },
      {
        tabela: "patient_profiles",
        colunas: ["emergency_email"],
      },
    ],
  },
  {
    arquivo: "APLICAR_SOS2.sql",
    alvos: [
      {
        tabela: "patient_profiles",
        colunas: ["phone"],
      },
    ],
  },
  {
    arquivo: "APLICAR_SOS_SO_PARA_QUEM_DEVE.sql",
    alvos: [
      {
        tabela: "companion_invites",
        colunas: ["album_token"],
      },
    ],
  },
  {
    arquivo: "APLICAR_STORY_CAMADA_E_DESTAQUE.sql",
    alvos: [
      {
        tabela: "rede_stories",
        colunas: ["destacado_em", "visibilidade"],
      },
    ],
  },
  {
    arquivo: "APLICAR_STRIPE_MEDICO.sql",
    alvos: [
      {
        tabela: "doctors",
        colunas: ["ai_messages_per_cycle"],
      },
    ],
  },
  {
    arquivo: "APLICAR_SUSPENDER_DA_REDE.sql",
    alvos: [
      {
        tabela: "patient_profiles",
        colunas: ["rede_suspensa_em", "rede_suspensa_motivo"],
      },
    ],
  },
  {
    arquivo: "APLICAR_USO_IA.sql",
    alvos: [
      {
        tabela: "ai_usage",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_VIDEO_NO_POST.sql",
    alvos: [
      {
        tabela: "rede_posts",
        colunas: ["repost_de", "video_path", "video_segundos"],
      },
    ],
  },
  {
    arquivo: "APLICAR_VISITAS_DE_CONVITE.sql",
    alvos: [
      {
        tabela: "visitas_de_convite",
        colunas: [],
      },
    ],
  },
  {
    arquivo: "APLICAR_VISTAS_DO_POST.sql",
    alvos: [
      {
        tabela: "rede_post_vistas",
        colunas: [],
      },
    ],
  },
] as const;
