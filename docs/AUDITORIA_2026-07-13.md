# Auditoria geral do site — 13/07/2026

Varredura completa do site nas duas óticas — **paciente** (marcar consulta,
achar médico, todas as abas do app) e **médico assinante** (encontrar
pacientes, mandar link, gerenciar a própria carteira, comprar plano) — em busca
de bugs, funcionalidades quebradas e promessas não cumpridas. Cada correção foi
verificada com `tsc` + `build` + `eslint` e, nas mudanças sensíveis de
segurança, por **agentes auditores independentes** (e agentes que auditam os
auditores).

Branch: `claude/determined-edison-XSh9l` · PR #1.

---

## 1. Correções entregues nesta rodada

Ordenadas por área. Todas commitadas e com CI verde.

### Integração paciente ↔ médico (multi-tenant) — o coração do pedido

| #   | O quê                                                                                                                                                                                                                                                                              | Commit    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | **Dashboard do assinante recortado por `doctor_id`** — antes qualquer médico fora de `ADMIN_EMAILS` via pacientes/perguntas/consultas VAZIAS; agora vê a própria carteira.                                                                                                         | `9e78ced` |
| 2   | **Consulta vinculada ao médico** — `submitAppointmentRequest` resolve o `doctor_id` pelo e-mail da paciente (RPC → perfil) e grava em `appointment_requests`.                                                                                                                      | `1c87cec` |
| 3   | **Painel de gestão para o assinante** — abas Agendamentos, Perguntas, Pré-consultas e Engajamento liberadas e recortadas no servidor (`requireScope` + `scopedBy` nas leituras, `assertOwnsRow` fail-closed nas mutações). A equipe da instalação segue vendo tudo, sem regressão. | `96b5cf5` |

### Segurança (encontradas pelos agentes auditores)

| #   | O quê                                                                                                                                                                                                                                                  | Sev.  | Commit    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | --------- |
| 4   | **Fail-open no dashboard** — num erro transitório, o `doctor_id` do assinante caía no do médico DONO da instalação, vazando nomes de pacientes, texto de perguntas e a próxima consulta de outro perfil. Corrigido: fallback vira o próprio `user.id`. | Média | `0251b3e` |
| 5   | **Mesmo fail-open no Segundo Cérebro** — o assinante podia LER e GRAVAR o cérebro (persona, regras, Q&A) do dono, que alimenta o chat/WhatsApp público dele. Corrigido igual.                                                                          | Média | `f7176c6` |
| 6   | **Busca de médico na conta furava o selo** — a RPC `search_doctors` (usada em minha-conta) não filtrava `verified`, então uma paciente logada achava médicos não verificados. RPC re-definida com `AND verified = true`.                               | Média | `b31c43e` |
| 7   | **Vínculo direto sem selo** — `chooseDoctor` e `requestDoctor` passam a exigir `verified` (defense-in-depth do gate do selo).                                                                                                                          | Baixa | `0540c31` |

### Infra / CI

| #   | O quê                                                                                                                                                                                             | Commit    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 8   | **Falha recorrente do Lint no CI** — `prettier` local havia derivado para 3.9.5 enquanto o lockfile/CI usam 3.8.3; formatações divergiam a cada commit. Fixado `"prettier": "3.8.3"` (sem caret). | `ce0635d` |

### Correções das rodadas anteriores (contexto)

Reset de senha que era bounceado; formulários de `/empresas` e
`/encontrar-medico` com skeleton infinito; injeção de HTML nos e-mails de
consulta (escape aplicado); vazamento de jornada entre contas no logout; cópia
premium honesta; trial do médico expira em 14 dias; limite de pacientes por
plano aplicado; consistência do `quiz_premium` (toggle manual + webhook Stripe);
gate de auto-promoção do médico bloqueado; médico só aparece na busca depois de
verificado; colunas `doctor_id` + índices; e o super-admin ganhou botão de
verificar/remover selo.

---

## 2. Verificação por agentes

Conforme pedido ("rode agentes que verifiquem cada etapa e agentes que
verifiquem se os agentes fizeram o trabalho certo"):

- **Auditor de segurança multi-tenant** — varreu leituras/mutações do painel em
  busca de vazamento cruzado ou escalonamento. Achou **1 defeito** (fail-open do
  dashboard, #4). Resto: fail-closed correto.
- **Auditor de regressão da equipe** — confirmou que o caminho do dono
  (instalação) é byte-a-byte idêntico ao anterior e que o contrato
  frontend/backend (`isTeam`) é coerente. **Sem regressões.**
- **Verificador-do-verificador** — confirmou a correção do #4 e encontrou o
  **mesmo padrão no Segundo Cérebro** (#5), que também foi corrigido.
- **Verificador final** — confere os fixes do selo (#6, #7) e varre o restante
  do fluxo de diretório/vínculo.

`tsc --noEmit` limpo e `build` passando em todos os commits.

---

## 3. O que AINDA falta (com severidade)

### Precisa de ação do dono (fora do código)

1. **Aplicar `supabase/APLICAR_PENDENTES.sql`** no SQL Editor do Supabase.
   **Bloqueante:** sem isso, as colunas `doctor_id`, `verified`, a RPC
   `search_doctors` e ~28 tabelas não existem em produção — todo o multi-tenant
   e várias abas do app ficam inertes. O arquivo é idempotente (pode rodar de
   novo).
2. **Configurar o Stripe** — criar a conta, os Prices (inclusive o Black),
   variáveis de ambiente, webhook e o Customer Portal. Sem isso a compra de
   plano do médico não fecha.
3. **Verificar os médicos** — no console do super-admin, marcar `verified` nos
   médicos legítimos (o selo agora é obrigatório para aparecer na busca e ser
   escolhido). Apagar as contas de teste (`teste.e2e.obstetrica@gmail.com`,
   "Paciente Teste E2E").

### Roadmap de código (não bloqueante)

| Item                                                                    | Sev.  | Nota                                                                                                                                                       |
| ----------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teleconsulta por médico**                                             | Média | `teleconsulta.functions.ts` segue só para a equipe (não vaza — está travado); falta escopar por `doctor_id` para liberar a aba ao assinante.               |
| **Backfill de `doctor_id`**                                             | Baixa | Linhas antigas têm `doctor_id = null` (= dono da instalação, visível só para a equipe). Correto por padrão; um backfill explícito deixa o histórico limpo. |
| **WhatsApp / PIX por médico**                                           | Média | Hoje single-tenant (infra externa: número Meta e chave PIX por médico).                                                                                    |
| **Vincular paciente no cadastro** (slug `/dr/...` ou código de convite) | Média | Etapa 3 do `MULTI_TENANT.md`.                                                                                                                              |
| **Relatórios de RH em `/empresas`**                                     | Baixa | A página vende relatórios que ainda não existem.                                                                                                           |
| **Re-cadastro do médico**                                               | Baixa | `registerDoctor` pode sobrescrever campos do perfil com branco num re-registro.                                                                            |

Detalhes de arquitetura e o roadmap completo em `docs/MULTI_TENANT.md`.
