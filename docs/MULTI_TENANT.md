# Plataforma multi-médico — estado e roadmap

O produto deixou de ser o app do Dr. Clóvis: é uma **plataforma SaaS** para
qualquer médico assinante. Princípio: **todo dado pertence a um perfil** —
o cérebro ao médico; a gestação, a jornada e a gamificação à paciente; e cada
paciente pertence a um médico.

## ✅ Já implementado

| Peça | Onde | Status |
|---|---|---|
| Segundo Cérebro por médico | `brain_settings`/`brain_entries` chaveadas por `doctor_id`; 9 operações escopadas; `getBrainContext(msg, doctorId?)` | ✅ validado |
| Perfil do médico | Tabela `doctors` (nome, CRM, especialidade, WhatsApp, PIX, slug, plano) com RLS própria | ✅ schema |
| Vínculo paciente→médico | `patient_profiles.doctor_id` (+ índice); `null` = médico dono da instalação (compat) | ✅ schema |
| Jornada/gamificação por perfil | `journey_state` (blob jsonb por user) com RLS own-row; `gestacao-path.tsx` sincroniza: nuvem primeiro no mount, push com debounce a cada mudança, localStorage vira cache offline | ✅ |
| Resolução do médico dono | RPC `get_user_id_by_email` (SECURITY DEFINER, só service_role) + cache apenas de sucesso | ✅ |
| Dados clínicos da paciente | Todas as tabelas de paciente já são por `user_id` com RLS own-row | ✅ desde o início |

## 🔜 Próximas etapas (em ordem)

1. **Onboarding do médico** — fluxo de cadastro que cria a linha em `doctors`
   e substitui `ADMIN_EMAILS` por checagem na tabela (`requireDoctor(uid)`);
   `ADMIN_EMAILS` vira só o superadmin da plataforma.
2. **Escopar o painel por médico** — `admin.functions.ts` e afins filtram
   `appointment_requests`, `doctor_questions`, `teleconsultas` etc. pelo
   `doctor_id` do chamador; adicionar `doctor_id` a essas tabelas
   (backfill: tudo que existe pertence ao dono da instalação).
3. **Vincular paciente no cadastro** — convite/código do médico (ou slug na
   URL: `/dr/clovis-bacha`) define `patient_profiles.doctor_id`; o app da
   paciente exibe nome/foto/config do médico dela via tabela `doctors`
   (substituindo `doctor.config.ts`, que vira fallback do dono).
4. **Cérebro por conversa** — chat e WhatsApp passam o `doctor_id` da paciente
   para `getBrainContext`; cada número de WhatsApp (Meta) mapeado a um médico
   (tabela `doctor_whatsapp_numbers`).
5. **Billing** — assinatura do médico (campo `plan` já existe) + gate de
   funcionalidades Pro.

## Regras de segurança que valem para tudo

- RLS em toda tabela nova; paciente só lê o próprio dado; médico só lê os
  dados **das suas** pacientes (policies por `doctor_id`).
- Escrita administrativa sempre via server function com gate (nunca policy
  aberta a `authenticated`).
- Conteúdo de paciente jamais entra em prompt de sistema (anti-injection).
