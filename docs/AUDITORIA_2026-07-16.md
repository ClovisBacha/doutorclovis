# Auditoria geral do site — 16/07/2026

Revisão diária (recorrente, pedida pelo dono) do código inteiro em busca de bugs,
seguida de avaliação de produto sob quatro óticas: marketing, análise de dados,
gestão de projeto e — trocando de cadeira — médico-cliente e gestante-usuária.
Quatro agentes auditores independentes cobriram: (1) rotas e componentes da
paciente, (2) lógica de backend do médico/SaaS (billing, WhatsApp, convites,
Google), (3) segurança (RLS, migrations, webhooks), (4) IA clínica e cálculos
de gestação.

Branch: `claude/kind-keller-ihmkj3`.

---

## 1. Bugs encontrados

### Críticos (agir logo)

| #   | O quê                                                                                                                                                                                                                                                              | Onde                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | **Webhook do WhatsApp não verifica assinatura da Meta** (`X-Hub-Signature-256`). Qualquer pessoa que descubra a URL forja mensagens de qualquer número e aciona o agente de IA (marca consulta, lê o cérebro do médico, gasta cota de envio).                     | `src/routes/api/whatsapp.ts:45`                                |
| 2   | **Agenda de horários (`doctor_availability`/`blocked_dates`) é global, não por médico.** RLS permite qualquer usuário autenticado escrever, e não existe coluna `doctor_id` nem pós multi-tenant. Um médico assinante pode ver/bloquear a agenda de outro.        | `supabase/migrations/20260610010000_doctor_scheduling.sql:27` + `painel.tsx:3190-3252` |
| 3   | **Card "Seu médico" na home da paciente mostra sempre o Dr. Clóvis** (objeto fixo `doctor.config.ts`), não o médico realmente vinculado (`profile.doctor_id`). Qualquer paciente de outro médico assinante vê nome/foto/CRM errados — quebra a proposta central do SaaS. | `src/components/app-mobile-shell.tsx:714-730`                  |
| 4   | **Flag de autoagressão do EPDS (Q10) pode não chegar ao médico**: a UI marca "enviado" antes/independente do `savePpdScreening` confirmar. Falha de rede = tela mostra sucesso, banco não grava o alerta.                                                          | `minha-conta.tsx` (PpdSection, ~10029-10038)                    |
| 5   | **Banco de produção ainda sem ~28 tabelas** (migrations desde `20260608120000` pendentes) — já sinalizado em 13/07, confirmado ainda pendente. Bloqueia proteções (`protect_doctor_billing`, `doctor_verified`) e várias abas.                                     | ação do dono: rodar `supabase/APLICAR_PENDENTES.sql`            |

### Médios

- **Stripe pode rebaixar assinante ativo para `free`** se dois eventos de assinatura chegarem fora de ordem (o branch `doctor_plan` não checa "outra assinatura ativa" como o branch `quiz_premium` já faz). `stripe-webhook.ts:137-145`
- **Corrida no limite mensal de convites**: `generateInviteCode` lê `used` e insere sem transação — dois cliques concorrentes furam o limite do plano. `invites.functions.ts:83-91`
- **Automação de WhatsApp roda mesmo em plano sem direito**: `handleWhatsAppMessage` executa o agendamento completo independente de `ent.aiWhatsapp`; só o conteúdo do "cérebro" é gateado. `whatsapp-agent.server.ts:262-267`
- **Sem idempotência de mensagem no WhatsApp**: reentrega da Meta pode duplicar `createAppointmentRequest` ou corromper o estado da conversa. `whatsapp.ts:44-64`
- **Corrida no limite de pacientes por médico** (`chooseDoctor`): contagem e upsert não são atômicos — cadastros simultâneos furam o teto de 5 pacientes do plano Free. `doctors.functions.ts:410-419`
- **Diretório de médicos ranqueia por `plan` cru**: trial vencido continua rankeado acima do Free porque a busca não olha `plan_expires_at`. `doctors.functions.ts:351-357`
- **MP/PIX nunca reverte em estorno/chargeback** — só trata `status === "approved"`; reembolso deixa a consulta marcada como confirmada para sempre. `mp-webhook.ts:30-37`
- **Webhook do MP sem HMAC** (mitigado por sempre reconferir na API do MP, mas sem defesa em profundidade).
- **DPP calculator com bug de fuso horário** (off-by-one dia): parseia `<input type="date">` como UTC-meia-noite, diferente do resto do app que usa `+"T00:00:00"`. `dpp.tsx:36,40`
- **Calculadora de insulina gestacional aceita IG inválida** (ex.: 0.2 ou 60 semanas digitado manualmente) e ainda assim imprime dose recomendada. `diabetes-gestacional.tsx:396-409`
- **Botão de pânico não é ao vivo para o acompanhante** — busca uma vez no mount, sem polling; só atualiza com F5. `acompanhar.$token.tsx:106-122`
- **Palavras-chave de urgência do WhatsApp incompletas**: várias frases de sintomas vermelhos (visão turva+dor de cabeça, bolsa rota, feto parado) caem só no julgamento do LLM, sem o mesmo freio determinístico do `triage.ts`. `whatsapp-agent.server.ts:258`
- **Transcrição de consulta grava direto no prontuário sem disclaimer** — diferente de triagem/nutrição, que avisam "não substitui avaliação médica". `transcribe.ts` + `minha-conta.tsx:~5410`

### Menores / UX

- Votação de nome do bebê: um token pode votar em todos os nomes (dedup só por `entry_id`+token); dedup client-side via `localStorage` trava sem recuperação se o nome for removido.
- Páginas por token (`acompanhar`, `album`, `votar-nome`) sem `try/catch` — erro deixa spinner girando pra sempre; botões de submit ficam travados após falha (sem `finally`).
- `height_cm = 0` sem validação quebra o gráfico de ganho de peso (BMI vira `Infinity`/`NaN`).
- DPP sempre calculado por DUM, nunca cai para USG mesmo quando só a data de USG existe.
- Notas de teleconsulta compartilham um único `state` entre sessões — trocar de aba descarta rascunho não salvo.
- Gráfico semanal de humor perde entradas de borda dependendo da hora do dia em que a página carrega.
- Exportação de "Cards da gestação" gera SVG sem CSS inline — baixa sem estilo.
- Abas de exames/plano de parto dependem 100% de RLS ainda não aplicada em produção (`exam_files`, `birth_plans`) — sem teste de regressão para confirmar o escopo quando a migration subir.
- Padrão recorrente: escrita otimista sem checar `res.ok` (Checklist, Companion, Álbum, Marcos/Vacinas) — falha de rede finge sucesso na UI.

---

## 2. Cinco pontos fracos (precisam de esforço)

1. **Zero testes automatizados.** CI só roda `tsc --noEmit` e `eslint`; nenhum arquivo `*.test.ts`/`*.spec.ts` no repo. Para um app que mexe com dinheiro (Stripe/PIX), WhatsApp e dados clínicos, mudanças dependem só de revisão manual.
2. **Isolamento multi-tenant ainda tem rachaduras silenciosas.** Card do médico errado na home, agenda de horários global, ranking de diretório ignorando expiração de trial — nenhum desses "vaza dado" no sentido de RLS, mas quebra a promessa central de "cada médico com sua própria operação".
3. **Webhooks de pagamento/mensageria frágeis.** WhatsApp sem assinatura, PIX sem reversão em estorno, Stripe com corrida de downgrade, convites com corrida de cota — nenhuma camada de idempotência/transação nesses pontos de dinheiro real.
4. **Blindagem clínica da IA inconsistente entre canais.** O núcleo determinístico (`triage.ts`) é sólido, mas WhatsApp, transcrição e pré-consulta não herdam o mesmo freio/disclaimer — a cobertura depende de qual caminho a paciente usou.
5. **Sem observabilidade de produção.** Não há Sentry/PostHog/equivalente; o único "monitoramento de erro" é um buffer em memória de 5 segundos para a página de erro SSR. Bug em produção só aparece se um usuário reclamar.

## 3. Cinco pontos fortes (não precisam de foco agora)

1. **Lógica clínica de triagem determinística e robusta** (`triage.ts`) — nível de risco vem de regra fixa, vermelho sempre vence amarelo, limiares de PA sensatos; a camada de IA está travada para nunca contradizer o nível pré-calculado.
2. **Defesa anti-prompt-injection do Segundo Cérebro** — mensagem da paciente só pontua relevância, nunca é interpolada no bloco de sistema.
3. **Webhook do Stripe é referência de boa prática**: verifica assinatura E sempre busca o status vivo na API do Stripe em vez de confiar no payload — replay não engana o sistema.
4. **Arquitetura de RLS/escopo nas tabelas centrais do multi-tenant** (`doctors`, `journey_state`, `patient_link_requests`, `subscriptions`, `invite_codes`, `google_tokens`, `whatsapp_numbers`) está correta, com `SECURITY DEFINER` bem restrito — nenhum vazamento cruzado encontrado aí.
5. **Amplitude do portal da paciente já entregue** — gestação, batimentos, DPP, EPDS, teleconsulta, álbum, ciclo menstrual, plano de parto, escola, conquistas, corporativo. O trabalho aqui é de robustez, não de escopo novo.

---

## 4. Dez novidades sugeridas (fazem sentido com o negócio)

1. **Lembretes proativos** (push/WhatsApp) de exame, vacina, próxima consulta e medicação — hoje tudo depende da paciente abrir o app.
2. **Resumo clínico exportável em PDF** (peso, PA, exames, vacinas) para o médico levar a um hospital ou outra consulta.
3. **NPS automático pós-consulta via WhatsApp** alimentando a página de depoimentos — fecha o ciclo de prova social sem esforço manual do médico.
4. **Painel financeiro por médico** (LTV, churn, MRR da própria carteira) no `/painel` — hoje só o super-admin tem essa visão agregada.
5. **Evolução do botão de pânico**: geolocalização + hospital/UPA mais próximo, além de só notificar o acompanhante.
6. **Segunda opinião/triagem assíncrona por foto/exame**, com fila priorizada pela mesma lógica de urgência do `triage.ts`.
7. **Onboarding guiado** (checklist/vídeo) para o médico configurar sozinho WhatsApp, Google Agenda, PIX e Stripe — reduz a dependência de suporte manual descrita no `CONFIGURACAO.md`.
8. **Comunidade moderada de gestantes por médico** (fórum/grupo) — hoje o "mural" é essencialmente estático; aumenta retenção e diferencia do WhatsApp genérico.
9. **Entregar os relatórios de RH prometidos em `/empresas`** — a página já vende isso como "em breve" desde a auditoria anterior; fechar essa lacuna converte um risco de honestidade em receita B2B real.
10. **Exportação padrão para prontuário eletrônico** (PDF estruturado ou FHIR) — reduz o atrito de um médico que já usa outro sistema migrar para a plataforma.

---

## 5. Visão por perfil

**Marketing** — o SEO recente (schema `Physician`, sitemap, FAQPage) é um bom investimento; o próximo ganho barato é fechar o loop de prova social (item 3 acima) e usar o programa de indicação médico→médico já existente como modelo para uma indicação paciente→paciente ("indique uma amiga grávida").

**Análise de dados** — o console super-admin ganhou analytics de ativação/retenção recentemente, mas não há instrumentação de eventos de produto (funil de agendamento, abandono de tab, uso do chat) nem exportação para o médico entender a própria base. Sem uma ferramenta de observabilidade (item 5 dos pontos fracos), qualquer decisão de produto hoje é no escuro quanto a erros reais em produção.

**Gestão de projeto** — maior risco de processo é a ausência de testes automatizados combinada com um roadmap (`docs/MULTI_TENANT.md`) que já está desatualizado frente ao que foi entregue (billing, WhatsApp por médico e convites já existem, mas o documento ainda lista como "próxima etapa"). Vale um hábito de manter esse doc como fonte única de verdade, e um pente-fino recorrente tipo este.

**Médico-cliente (o que faria eu pagar)** — como médico avaliando o plano: a agenda global entre médicos (bug #2) é inaceitável — não pagaria um SaaS que mistura minha agenda com a de outro médico. O painel financeiro (novidade #4) e o onboarding autoguiado (novidade #7) seriam decisivos para eu confiar que não preciso de suporte manual toda semana. A confiabilidade do WhatsApp automatizado (sem duplicar agendamento, respeitando meu plano) também pesa diretamente no quanto eu pagaria por um Tier mais caro.

**Gestante-usuária** — como paciente, o que mais afeta minha confiança no app é ver o médico certo na tela (bug #3) e saber que o botão de emergência realmente notifica alguém na hora (bug do painic sem polling). Lembretes proativos (novidade #1) e uma comunidade de outras gestantes do mesmo médico (novidade #8) tornariam o app parte da rotina, não só algo que abro quando lembro.

---

*Relatório gerado por revisão automatizada diária (4 agentes especializados: rotas/componentes, backend do médico/SaaS, segurança/RLS, IA clínica).*
