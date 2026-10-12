# Auditoria geral diária — 12 de outubro de 2026

Revisão recorrente (pedida pelo dono). Cinco agentes leram: app React Native
(`mobile/`), servidor/pagamentos/LGPD, telas da paciente na web, painel do
médico/admin e chatbot/WhatsApp. Só leitura: **nenhum código mudou**.
`bash scripts/verificar.sh` está verde (tsc, lint, 6.884 testes, 0 falhas).

Só o achado 1.1 foi reconferido por mim no SQL; os demais foram confirmados
pelos agentes lendo o código (arquivo:linha abaixo), sem execução.

## 0. Pendências da auditoria de 28/09 — NENHUMA foi corrigida

Reconferido hoje no código: EPDS duplicado (`clinical.functions.ts:140-146`),
PA duplicada (`triage.ts:57,60`), ilustração do bebê fora de `!careMode`
(`baby-tab.tsx:409-424`), `confirmAppointment` sem choque por faixa
(`admin.functions.ts:349`), chave de lembrete sem data (`lembretes.ts:69`),
`toISOString().slice(0,10)` em presentes/dashboard/retrospectiva/exportar-dados
e promessa "Registrei a sua pergunta" sem aguardar a gravação (`chat.ts:1102`).
Os últimos 14 dias de commits foram só do app RN.

## 1. Bugs novos, por severidade

### 🔴 Crítico / alto

1. **`buy_cantinho_item` permite criar Sementinhas ilimitadas** —
   `supabase/APLICAR_GAMIFICACAO.sql:102` (e `APLICAR_PENDENTES.sql:2500`,
   `migrations/20260722130000_cantinho.sql:57`). `SECURITY DEFINER`, com
   `REVOKE ... FROM anon, authenticated` mas **sem `FROM PUBLIC`**; o EXECUTE de
   PUBLIC continua valendo (o próprio `APLICAR_SOS_VINCULO.sql:73` documenta essa
   armadilha). A função não valida `p_price > 0` nem `p_user = auth.uid()`:
   `POST /rest/v1/rpc/buy_cantinho_item` com `p_price` negativo grava crédito no
   ledger. Mesmo defeito, menor: `contar_visita_de_convite`
   (`APLICAR_VISITAS_DE_CONVITE.sql:73`). **Correção:** `REVOKE ... FROM PUBLIC`
   - validar preço > 0. Se a economia já foi usada, vale conferir o ledger por
     créditos anômalos.
2. **Vínculo médico–paciente reativado por pedido antigo** —
   `patientlink.functions.ts:350-440`, `doctors.functions.ts:1151`,
   `invites.functions.ts:145`. Paciente pede A, escolhe B; semanas depois A
   aceita o pedido pendente e volta a ler chat/SOS/prontuário dela sem
   consentimento. `chooseDoctor`/`redeemInviteCode` não cancelam pendentes.
3. **Exclusão de conta não cancela a assinatura Stripe** —
   `conta.functions.ts:102`. Premium exclui a conta e segue cobrada; dado de
   pagamento órfão (LGPD).
4. **Chat sem escalonamento determinístico de urgência / ideação suicida** —
   `chat.ts:153,317-320`. `BANDEIRA_VERMELHA` (`pergunta-clinica.ts:43`) já
   reconhece "quero morrer", sangramento, "bebê não mexe", mas no chat só decide
   fila; nada força o 192/CVV. Tudo depende do LLM obedecer ao prompt. Nenhum
   `suic|CVV|188` em `chat.ts`/`whatsapp-agent.server.ts`.
5. **Plano Free: resposta fixa tem lista de urgência incompleta** —
   `chat.ts:1102,1106`. Falta redução de movimentos, perda de líquido, cefaleia
   com visão turva, pressão alta; no Modo Cuidado ainda cita "movimentos do
   bebê".
6. **WhatsApp fica mudo quando o Gemini falha, inclusive em urgência** —
   `whatsapp-agent.server.ts:209,428`; `routes/api/whatsapp.ts:89,111-175`. Sem
   try/catch nem texto fixo "ligue 192"; uma falha aborta o lote.
7. **Regex de urgência do WhatsApp estreita e duplicada** —
   `whatsapp-agent.server.ts:423-424` (não pega "hemorragia", "bolsa rompeu",
   "mexendo menos", "visão turva", "falta de ar"…). Deveria reusar
   `pergunta-clinica.ts`.
8. **`/dpp` calcula a DPP um dia adiantada** — `routes/dpp.tsx:36,40`
   (`new Date("AAAA-MM-DD")` lê UTC). `calculadora.tsx:115` faz certo.
9. **Painel: aviso de leitura incompleta apagado logo após aceso** —
   `painel.tsx:601` vs `:621` (`consultasEPerguntas: false` incondicional). O
   médico lê "nada a responder" quando a leitura falhou.
10. **`getEngagementData` sem `.limit/.order`; teto de 1000 do PostgREST corta
    em silêncio** — `admin.functions.ts:1114-1140`. Pacientes ativas aparecem
    como "sumidas" na lista de silêncio.
11. **Dashboard: `safe()` só pega exceção; erro do Supabase vira zero** —
    `dashboard.functions.ts:183-190, 258, 263, 308-370, 434-480`. 0 pacientes /
    0 em risco com `ok:true`; `.limit(3000)` tira gente do `churnRisk`.
12. **Modo Cuidado vaza o bebê** — (a) Checklist "Para o bebê" e Consultas
    (`minha-conta.tsx:3762-3773, 3785, 3914`); (b) convite do Acompanhante cita
    o nome do bebê (`:5271, 5316-5343`); (c) SOS no app RN usa
    `perfil?.care_mode === true` em vez do `cuidado` da sessão
    (`mobile/src/app/sos.tsx:306`) — com perfil não lido, mostra "movimentos do
    bebê"; (d) `recarregarPerfil` do RN rebaixa "pronto" a "falhou" e liga o
    modo luto para todo mundo (`mobile/src/lib/sessao.tsx:110`).
13. **Escritas que falham mostrando sucesso** (`minha-conta.tsx`): convite do
    Acompanhante e `revoke()` — o link com SOS/localização continua ativo
    (`:5300-5313`); plano de parto: leitura que falha abre `DEFAULTS` e o save
    **sobrescreve o plano real** (`:14732-14751`); `HomeMoodCheckin`
    (`baby-tab.tsx:184-197`) e `ChecklistTab.add` (`:3879`).
14. **App RN: "Sair da conta" apaga contrações/chutes ainda não sincronizados**
    — `mobile/src/app/perfil.tsx:182`, `lib/armazem.ts:39-46`.

### 🟠 Médio

- **Admin/painel:** `getPatientReport` trata falha como "sem registros"
  (`admin.functions.ts:1369-1410`); `getPreConsultaForms` corta `.limit(100)`
  antes do filtro e descarta o erro de perfis (`:1278-1303`); perguntas e
  pré-consultas recortadas por `doctor_id` carimbado, não pelo vínculo atual
  (`:159-176, 230, 1020, 1214-1254, 1319`; `clinical.functions.ts:1370`;
  `dashboard.functions.ts:173`); `consultasDaPaciente`/`minhasConsultas`
  devolvem vazio em erro (`clinical.functions.ts:983,1132`); lembretes não
  conferem `consultas.error`/`teles.error` (`lembretes.server.ts:49-80`) — falha
  vira "nada a enviar"; horários livres ignoram duração
  (`disponibilidade.ts:198-202,244`) — consulta de 60 min às 10:00 deixa 10:30
  livre; `updateAppointmentStatus` aceita `confirmed` sem checar choque
  (`admin.functions.ts:271`); equipe: choque sem escopo e `doctor_id NULL` fora
  do índice único (`:349,560`); `quemEstaQuieta` recebe `reference_weeks` como
  semanas atuais (`painel.tsx:1027`); `postParto` = `due_date < agora` marca
  gestante de 40+3 como pós-parto (`dashboard.functions.ts:202`).
- **Servidor:** `submitAppointmentRequest` público, sem rate limit, confia no
  e-mail digitado (spam em nome do app; `appointments.functions.ts:75-91`);
  reserva de presente não atômica (`presentes.functions.ts:474-520`); webhook do
  Mercado Pago falha **aberto** sem secret (`api/mp-webhook.ts:13`); WhatsApp sem
  deduplicação por `messageId` (resposta e agendamento duplicados;
  `whatsapp-agent.server.ts:402`) e `preferred_date` com `toISOString`
  (`:362`); cota de convites com race e código por `Math.random()`
  (`invites.functions.ts:22-27,125-135`).
- **WhatsApp:** resposta sai sempre do `WHATSAPP_PHONE_NUMBER_ID` global, não do
  número do médico (`whatsapp.server.ts:11-26`); sem `thinkingBudget:0` — JSON
  vazio/truncado vira texto cru para a paciente (`whatsapp-agent.server.ts:209-261`).
- **Chat:** `catch { return "" }` sem log tira PA/triagem do prompt em silêncio
  (`chat.ts:570,666,889`); `resolvePatientDoctor` rebaixa logada ao bot público
  (`:270`); 500 expõe nome da variável de ambiente.
- **Triagem:** cefaleia forte isolada sai **verde** (`triage.ts:18`) — quadro
  clássico de pré-eclâmpsia.
- **Telas web:** Perguntas ao médico / Acompanhante / "Do seu médico" mostram
  vazio quando a leitura falhou (`minha-conta.tsx:5039,5276,7390`); Amigas,
  Grupos e Conversas sem `NaoConsegueLer` (`amigas.tsx:135,188`,
  `rede-grupo.tsx:76`, `rede-conversa.tsx:2216`).
- **RN:** limite de movimentos divergente — ferramenta na semana 24, texto "a
  partir da 26", alarme só na 28 (`ferramentas.ts:23`, `chutes.tsx:56`,
  `sinais-clinicos.ts`); ponte sem timeout ao ler o corpo (`ponte.ts:78`) deixa
  o SOS em "Pegando a localização…" para sempre; bônus das 5 estrelas perdido
  se a rede cai (`jornada.tsx:161`); arquivar post volta duas telas
  (`post/[id].tsx:97-102`).

### 🟡 Baixo

Upload de vídeo sem teto (`rede-social.functions.ts:2992`); IA sem teto de
entrada (`teleconsulta.functions.ts:271`); admin só por e-mail sem
`email_confirmed_at` (`platform-admin.server.ts:19`; depende da config do
Supabase); handle do Instagram reivindicável (`instagram.functions.ts:175`);
RN: relógio de 1 s fixo nas contrações (`contracoes.tsx:64`), `/bebe` abre em
"semana 20" para puérpera (`bebe.tsx:38`), rótulos de PA sem a palavra
"pressão" (`registros.tsx:163`), temporizadores por `Date.now()` concluem
momento em segundo plano (`meditar.tsx:219`, `mexer.tsx:344`); hub de saúde sem
tratamento de falha (`saude.tsx:15-52`).

## 2. Cinco pontos fracos (o que desenvolver)

1. **Integridade da economia e dos RPCs.** Item 1.1 mostra que a moeda do app
   é forjável; falta uma varredura de todo `SECURITY DEFINER` (EXECUTE de PUBLIC)
   e um teste que a barre, como `tabelas-que-existem.test.ts`.
2. **Escalonamento clínico determinístico fora do prompt.** Chat Free, chat
   Premium e WhatsApp dependem do LLM (ou de listas curtas e diferentes entre
   si) para mandar ao 192/CVV. Uma função única sobre `pergunta-clinica.ts` que
   prefixa a resposta, usada nos três canais.
3. **"Falha ≠ vazio" no painel do médico.** Dashboard, relatório, engajamento,
   consultas e lembretes ainda convertem erro em zero — num painel pago, é o
   que corrói a confiança do médico.
4. **Receita.** Sem IAP a paciente não paga; exclusão de conta nem cancela o
   Stripe. Dono: conta Apple/entitlements; código: IAP + cancelamento.
5. **Verificação antes da paciente.** Produção segue a branch de trabalho, a CI
   não barra o deploy e as 27/128 tabelas tipadas deixam colunas erradas passar
   (item 2.9/2.10 acima são desse tipo).

## 3. Cinco pontos fortes (pode gastar menos esforço)

1. Suíte de testes (6.884, fuso fixo, regras puras) e portão único.
2. Conteúdo do Caminho: 294 dias de gestação + 378 de pós-parto, com auditoria.
3. Réguas clínicas (PA, glicemia, EPDS q10) corretas em `sinais-clinicos.ts`/
   `epds.ts` — o problema é só quem não as usa.
4. Segurança de borda: webhooks Stripe/WhatsApp/Instagram e crons assinados;
   sem segredo literal nos arquivos lidos; autenticação em `conversa.functions`
   e `secondbrain.functions`.
5. Modo Cuidado como conceito e o SOS/contrações que nunca somem — os vazamentos
   acima são pontuais, não de arquitetura.

## 4. Dez novidades que fazem sentido

(Mantidas as 10 de 28/09 que seguem em aberto — painel de risco agregado,
resumo pré-consulta, fila de teleconsulta × sinais, indicação, selo "alto
risco", gemelar, subgrupos por condição, alerta ao acompanhante, pós-parto de
sono/alimentação, IAP+restaurar. Abaixo, as novas, ainda não propostas:)

1. **Funil de conversão instrumentado** (instalou → cadastrou → tocou
   "assinar" → pagou → renovou): hoje não há métrica de retenção/conversão.
2. **Briefing diário do médico por push/e-mail:** "3 pacientes pioraram, 2
   consultas hoje, 1 pergunta sem resposta há 48 h".
3. **Exportar prontuário/relatório para PDF e FHIR-like** — o médico leva ao
   hospital e à maternidade.
4. **Plano de parto → resumo da maternidade** (QR/PDF, com o contato do
   acompanhante) para a bolsa.
5. **Lembrete de vacinas e exames por semana gestacional** (dTpa, influenza,
   TOTG 24–28s, GBS 35–37s) com confirmação no calendário.
6. **Mala da maternidade e rota até a maternidade** com tempo estimado e
   alerta de "hora de sair" ligado ao cronômetro de contrações.
7. **Pós-parto: triagem de sono/EPDS com trilha de apoio** e encaminhamento ao
   médico quando q10 > 0.
8. **Teleconsulta com resumo automático (IA) já em rascunho de evolução** — o
   médico só revisa; justifica o plano de topo.
9. **Painel multi-médico/clínica** (secretária com permissão limitada,
   agenda compartilhada) para vender a consultórios com mais de um médico.
10. **Versão em espanhol/inglês do onboarding** para expandir a comunidade de
    brasileiras no exterior, que o Instagram/Rede já alcançam.

## 5. Óticas

- **Marketing:** a mensagem é forte; falta prova social B2B e uma página de
  médico parceiro com resultado real. Indicação médico→médico é o canal mais
  barato.
- **Dados:** instrumentar o funil agora (ver novidade 1); medir "dias até o
  primeiro registro clínico" como indicador de ativação.
- **Gestão de projeto:** dois trilhos — o do dono (conta Apple, IAP, SQL) e o de
  código. Sugestão de ordem para o código: **1.1 (hoje, é um `REVOKE`)**,
  1.4/1.5/1.6/1.7 (escalonamento), 1.2/1.3 (vínculo e Stripe), depois o bloco
  "falha ≠ vazio" do painel.
- **Médico que paga:** quer não perder o alarme real e não ver zero falso. Os
  achados 1.9–1.11 são exatamente isso; sem eles o plano pago não se sustenta.
  Pagaria por: briefing diário, risco agregado, resumo pré-consulta.
- **Gestante:** em luto, o app ainda mostra o bebê (1.12); com gêmeos não fala
  com ela; sem rede, perde contrações ao sair (1.14). Quer: mala/rota da
  maternidade, vacinas por semana, e que o parceiro seja avisado na contração.

## Plano de teste

- [x] `bash scripts/verificar.sh` — verde; só documentação foi adicionada.
- [ ] Dono decide a ordem das correções (sugestão acima).
