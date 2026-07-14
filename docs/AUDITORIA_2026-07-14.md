# Auditoria geral do site — 14/07/2026

Segunda rodada da varredura diária (a de 13/07 está em
`docs/AUDITORIA_2026-07-13.md`). Foco de hoje: (1) achar bugs, com atenção
especial aos 10 commits que entraram *depois* da auditoria de ontem — login
Google, teleconsulta "nível 2" (cada médico com a própria Agenda), hardening
de OAuth e a página de Termos; (2) mapear o que está pronto x bloqueado em
cada aba do app; (3) dar uma leitura de negócio (marketing, dados, gestão de
projeto) e de produto (na pele do médico-cliente e da gestante-usuária).

Rodada só de diagnóstico — nenhum código de aplicação foi alterado hoje
(convenção já registrada no PR #3: a rotina diária publica relatório, não
mexe em produção sem pedido explícito).

---

## 1. Bugs encontrados hoje

### 🔴 Alta — a funcionalidade mais nova dos últimos 2 dias está inutilizável pelo público-alvo

**Teleconsulta "nível 2" (Google Agenda por médico) não é alcançável por
médico assinante.** O card "Conectar Google Agenda" fica em "Meu Perfil"
(`painel.tsx`, aba visível a assinantes) e promete *"as salas de teleconsulta
são criadas na SUA conta Google"*. Mas:

- A aba **"Teleconsultas"** (onde fica o botão "Abrir sala") só existe em
  `PANEL_TABS` (equipe interna) — **não está em `DOCTOR_TABS`** (assinantes).
- A função server-side que efetivamente abre a sala,
  `openTeleconsultaRoom` (`src/lib/teleconsulta.functions.ts:356-368`), usa
  um `requireAdmin` local que checa **só `ADMIN_EMAILS`** — não o padrão
  `requireScope`/`doctors.active` já usado em `admin.functions.ts` para as
  demais abas escopadas por médico.

Resultado prático: um médico assinante conecta a própria Agenda, o
`refresh_token` é salvo, e nunca é lido — porque ele nunca chega na tela nem
na função que o usaria. É o recurso central dos últimos 10 commits e hoje
ele só funciona para a equipe interna, não para quem paga o plano.
**Correção: incluir "Teleconsultas" em `DOCTOR_TABS` e trocar o gate de
`openTeleconsultaRoom` para o padrão `requireScope` por `doctor_id`.**

### 🟡 Média

- **`requireDoctorUser` (`google-calendar.functions.ts:28-39`) não checa
  `doctors.active`** — diferente de `requireScope`, que exige isso. Um
  médico com trial vencido ou conta desativada ainda consegue
  conectar/desconectar a própria Agenda Google. Baixo impacto hoje (a
  feature nem é usável, ver bug acima) mas vira problema assim que ele for
  corrigido.
- **`openTeleconsultaRoom` usa o id de quem clicou o botão, não um
  `doctor_id` da sessão** (`teleconsulta.functions.ts:374-375`). A coluna
  `teleconsulta_sessions.doctor_id` existe mas nunca é preenchida em
  `createTeleconsulta`. Se `ADMIN_EMAILS` tiver mais de uma pessoa, a sala
  sempre vai para a Agenda de quem clicou "Abrir sala", não
  necessariamente do médico responsável pela paciente.

### 🟢 Baixa

- `sendPatientMeetEmail` interpola `patientName`/data direto em HTML sem
  escapar (`teleconsulta.functions.ts:250-259`) — pré-existente, risco baixo
  (o destinatário é a própria dona do nome), mas vale escapar já que o
  e-mail agora também roda no fluxo nível 2.
- `docs/GOOGLE_MEET.md` descreve o fluxo "nível 2" como se qualquer médico
  já visse a aba — a documentação está desalinhada com o gate real, sinal de
  que a lacuna acima passou despercebida por quem escreveu os commits.

### ✅ O que foi checado e está correto

O anti-CSRF do OAuth do Google (`state` assinado com HMAC-SHA256,
fail-closed sem `SUPABASE_SERVICE_ROLE_KEY`, `timingSafeEqual`, TTL de 10
min, `redirect_uri` fixado no servidor via `SITE_URL`, state amarrado ao
usuário logado) está bem implementado. Nenhum vazamento de token entre
médicos, sem segredos hardcoded, sem `TODO`/`console.log` esquecido nos
arquivos alterados.

---

## 2. Status das features (visão geral)

Das 11 abas do portal da paciente listadas no `CLAUDE.md`, **10 continuam
bloqueadas** pelas migrations não aplicadas em produção (mesmo achado de
ontem — nada mudou aqui, é o item que mais trava o produto):

| Aba | Status |
| --- | --- |
| Contrações, Pré-consulta, Exames, Ciclo Menstrual, Plano de Parto, Teleconsulta, Álbum, Pós-parto, Escola, Conquistas | Código pronto, **bloqueado** por migration não aplicada |
| Linha do Tempo | Parcial — funciona a parte que usa tabelas originais |
| Vínculo paciente↔médico (multi-tenant) | Código pronto, **bloqueado** por migration |

Nenhuma dessas abas é stub — são server functions reais com queries
Supabase reais. O gap é 100% de infraestrutura (rodar
`supabase/APLICAR_PENDENTES.sql`), não de código faltando.

Outros achados de completude:

- **Página pública por médico (`/dr/slug`) não existe** — é citada
  literalmente no `painel.tsx` como *"páginas por médico chegam na próxima
  etapa"*, um placeholder confesso.
- **Entitlements `dashboardAdvanced` e `clinicalToolsAdvanced`** (prometidos
  no plano Pro) estão declarados em `entitlements.ts` mas sem nenhum uso em
  `painel.tsx` — feature vendida, não gateada nem construída.
- **`/empresas` é lead-gen puro.** Promete "Dashboard de saúde para RH" e
  "Relatório de Alta Pré-natal"; no código só existe o formulário que grava
  um lead. Não há rota, tabela ativa ou componente de relatório corporativo.

---

## 3. Cinco pontos fracos (precisam de desenvolvimento)

1. **Migrations pendentes em produção** — trava 10 de 11 abas do app e todo
   o multi-tenant. Continua sendo o item #1 do roadmap, e é ação do dono
   (fora do código), não falta de desenvolvimento.
2. **Teleconsulta nível 2 inalcançável pelo assinante** (bug ALTA acima) — a
   feature mais recente do produto está, na prática, funcionando só para a
   equipe interna.
3. **Zero instrumentação/analytics** — nenhum GA/Pixel/PostHog, nenhum UTM
   nos formulários de lead, nenhum dashboard de conversão. Hoje é
   impossível saber qual página de marketing traz assinante ou onde o
   funil vaza.
4. **Sem página pública por médico** — sem ela, um médico assinante não tem
   link próprio para mandar a uma paciente; toda aquisição depende do
   diretório genérico `/encontrar-medico`.
5. **`/empresas` vende o que não existe** — "Dashboard de RH" e "Relatório
   de Alta Pré-natal" são só copy; se um cliente B2B fechar hoje, não há
   nada para entregar.

## 4. Cinco pontos fortes (não precisam de foco agora)

1. **Segurança do OAuth Google** — CSRF/HMAC fail-closed, redirect fixado
   no servidor, bem implementado e verificado linha a linha hoje.
2. **Padrão de isolamento multi-tenant** (`requireScope`/`assertOwnsRow`/
   `scopedBy`) — já validado na auditoria de ontem; quando seguido, é
   sólido (o bug de hoje é justamente um trecho novo que fugiu do padrão).
3. **Sistema de entitlements por plano é aplicado de verdade** — limite de
   pacientes, IA no app/WhatsApp e convites premium são checados no
   servidor, não é só a página de preços.
4. **Gamificação "Conquistas"** — 20 conquistas bem modeladas em 5
   categorias, prontas para ativar assim que as tabelas existirem em prod.
5. **Infra de e-mail transacional + SEO técnico** — Resend com layout
   reutilizável já plugado em vários fluxos; sitemap e meta tags (OG/
   Twitter) completos no `__root.tsx`.

---

## 5. Dez oportunidades de novidade (alinhadas ao negócio)

1. Construir de verdade o dashboard de RH do `/empresas` (a promessa já está
   sendo vendida).
2. Página pública por médico (`/dr/slug`) com agenda, especialidades e
   avaliações — motor de aquisição para cada assinante divulgar.
3. Instrumentação mínima de funil (UTM nos leads + tabela de eventos) antes
   de qualquer investimento maior em growth.
4. Programa de indicação paciente-para-paciente (hoje o "convite" só existe
   como benefício de plano Elite/Black, não como motor de crescimento).
5. Notificações push / lembretes proativos (hoje só e-mail e WhatsApp
   reativo) — lembrete de consulta, de diário, de medicação.
6. Upload/leitura de exame laboratorial (PDF) com extração automática de
   valores para a Linha do Tempo — a aba "Exames" já existe, falta essa
   ponte.
7. Score de risco gestacional visível ao médico, cruzando pressão, glicemia
   e sintomas registrados — encaixa direto no posicionamento "alto risco".
8. App/portal com a cara de cada médico (white-label leve: nome, cor, logo)
   — próximo passo natural do roadmap multi-tenant já documentado.
9. Trilhas educativas segmentadas na aba "Escola" (diabetes gestacional,
   gemelar, etc.), vendável como diferencial de cada assinante.
10. Vínculo com convênio/plano de saúde (reembolso vs. particular) — dor
    comum em prática obstétrica que hoje o app não endereça.

---

## 6. Olhares multidisciplinares

**Marketing** — sem tracking, o time está voando às cegas: não dá para
saber qual página traz assinante. A página de preços tem **um único
depoimento**, e é do próprio fundador — para vender o plano a outros
médicos falta prova social real de assinantes pagantes. `/empresas`
promete relatório que não existe, o que é risco de marca assim que virar
venda ativa. O nicho (gestação de alto risco) é muito buscável — falta um
motor de conteúdo (a página "Mitos" já existe, mas isolada, sem estratégia
de SEO por trás).

**Analista de dados** — recomendação mínima: uma tabela de eventos
(`page_view`, `lead_submit`, `doctor_signup`, `plan_upgrade`) e UTM nos
formulários de lead, antes de qualquer ferramenta mais sofisticada. O
modelo de dados já é consistentemente escopado por `doctor_id`, então
métricas por médico (receita, engajamento, retenção) são viáveis assim que
essa base existir — hoje simplesmente não há como calcular CAC, conversão
por página ou retenção de nenhum tipo.

**Gestão de projeto** — o maior risco do roadmap continua sendo uma ação
manual fora do código (rodar `APLICAR_PENDENTES.sql`) segurando ~metade do
produto; deveria estar no topo do board, não em nota de rodapé. O bug de
hoje mostra um padrão a corrigir no processo: a feature "teleconsulta nível
2" foi fechada sem testar com o perfil de usuário real (médico assinante),
só com `ADMIN_EMAILS`. Sugestão de Definition of Done por feature: (1) gate
de autorização testado com o perfil-alvo real, não com conta admin; (2)
migration aplicada em produção antes de marcar como "pronta para uso".

**Médico assinante (cliente pagante)** — o preço (R$197 a R$1.999) parece
justo pelo pacote prometido, mas hoje ele pagaria por features que, em
produção, não fazem nada — 10 de 11 abas da paciente bloqueadas e a
teleconsulta nível 2 inacessível. Isso é o maior risco de churn no primeiro
mês. O que faltaria para ele ficar satisfeito: página própria para
divulgar, dashboard de engajamento que o plano Pro já promete (mas não
existe na tela), e confirmação de que os dados de suas pacientes nunca
aparecem para outro médico — isso já está bem resolvido e validado por
auditoria. O selo de verificação manual também não escala: um fluxo de
auto-verificação por CRM evitaria atrito na entrada de novos assinantes.

**Gestante (usuária final)** — a experiência real em produção hoje é bem
mais pobre do que o marketing promete: cadastro, agendamento e um diário
básico funcionam, mas contrações, exames, plano de parto, ciclo menstrual,
álbum, pós-parto, escola e conquistas — tudo pronto no código — está
invisível até a migration rodar. Ela valorizaria lembretes proativos (push
ou WhatsApp) em vez de precisar abrir o app sozinha, e sente falta de uma
forma fácil de descobrir e escolher o médico certo — sem página pública por
médico, a descoberta é rasa. A gamificação e o álbum de família, quando
ativados, tendem a ser um diferencial forte de retenção para esse público.

---

## 7. Ação prioritária de hoje

1. **Aplicar `supabase/APLICAR_PENDENTES.sql`** (ação do dono, fora do
   código) — segue sendo o bloqueador nº 1, sem mudança desde ontem.
2. **Corrigir o gate da teleconsulta nível 2** — incluir "Teleconsultas" em
   `DOCTOR_TABS` e trocar `requireAdmin` por `requireScope` em
   `openTeleconsultaRoom`, ou a feature mais nova do produto continua
   inutilizável por quem paga por ela.
