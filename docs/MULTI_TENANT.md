# Plataforma multi-médico — estado e roadmap

O produto deixou de ser o app do Dr. Clóvis: é uma **plataforma SaaS** para
qualquer médico assinante. Princípio: **todo dado pertence a um perfil** —
o cérebro ao médico; a gestação, a jornada e a gamificação à paciente; e cada
paciente pertence a um médico.

## ✅ Já implementado

| Peça                           | Onde                                                                                                                                                                                                                                                                    | Status                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Segundo Cérebro por médico     | `brain_settings`/`brain_entries` chaveadas por `doctor_id`; 9 operações escopadas; `getBrainContext(msg, doctorId?)`                                                                                                                                                    | ✅ validado                |
| Perfil do médico               | Tabela `doctors` (nome, CRM, especialidade, WhatsApp, PIX, slug, plano) com RLS própria                                                                                                                                                                                 | ✅ schema                  |
| Vínculo paciente→médico        | `patient_profiles.doctor_id` (+ índice); `null` = médico dono da instalação (compat)                                                                                                                                                                                    | ✅ schema                  |
| Jornada/gamificação por perfil | `journey_state` (blob jsonb por user) com RLS own-row; `gestacao-path.tsx` sincroniza: nuvem primeiro no mount, push com debounce a cada mudança, localStorage vira cache offline                                                                                       | ✅                         |
| Resolução do médico dono       | RPC `get_user_id_by_email` (SECURITY DEFINER, só service_role) + cache apenas de sucesso                                                                                                                                                                                | ✅                         |
| Dados clínicos da paciente     | Todas as tabelas de paciente já são por `user_id` com RLS own-row                                                                                                                                                                                                       | ✅ desde o início          |
| Painel escopado por médico     | `admin.functions.ts` (`requireScope` + `scopedBy` nas leituras, `assertOwnsRow` fail-closed nas mutações) e `dashboard.functions.ts` filtram pacientes/perguntas/consultas/pré-consultas pelo `doctor_id` do assinante; equipe (`ADMIN_EMAILS`) vê a instalação inteira | ✅ validado (2 auditorias) |
| Consulta vinculada ao médico   | `submitAppointmentRequest` resolve `doctor_id` pelo e-mail da paciente (RPC → perfil) e grava em `appointment_requests`                                                                                                                                                 | ✅                         |
| Colunas `doctor_id`            | `appointment_requests`, `doctor_questions`, `preconsulta_forms`, `teleconsulta_sessions` + índices (migration `20260713010000`)                                                                                                                                         | ✅ schema                  |

## 🔜 Próximas etapas (em ordem)

1. ~~**Onboarding do médico**~~ ✅ — `/medicos/cadastro` (conta + perfil
   profissional → linha em `doctors`, plano trial); painel aceita médicos
   assinantes (abas já escopadas: Cérebro 🧠 e Meu Perfil); o Cérebro é gateado
   por `doctors` OU `ADMIN_EMAILS`, e cada médico assinante treina o SEU
   cérebro (equipe da instalação treina o do dono); CTAs dos planos apontam
   para o cadastro.
2. ~~**Escopar o painel por médico**~~ ✅ — `admin.functions.ts` e
   `dashboard.functions.ts` filtram `appointment_requests`, `doctor_questions`,
   `preconsulta_forms`, `patient_profiles` pelo `doctor_id` do chamador
   (leituras via `scopedBy`, mutações via `assertOwnsRow` fail-closed); abas
   Agendamentos/Perguntas/Pré-consultas/Engajamento liberadas para o assinante.
   **Pendente ainda:** `teleconsulta.functions.ts` (Teleconsultas segue só para
   a equipe); backfill do `doctor_id` das linhas antigas (hoje `null` = dono da
   instalação, visível só para a equipe).
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
