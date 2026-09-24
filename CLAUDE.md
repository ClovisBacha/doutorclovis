# Dr. Clóvis Bacha — Site

Site institucional e portal do paciente do Dr. Clóvis Bacha, ginecologista e
obstetra especialista em gestação de alto risco. Migrado do Lovable para
desenvolvimento no Claude Code.

## Stack

- **React 19** + **TanStack Start / Router** (SSR, file-based routing)
- **Tailwind CSS 4** + **shadcn/ui** (componentes em `src/components/ui`)
- **Supabase** (auth + banco Postgres)
- **AI SDK** (`ai`) para o chatbot
- **Vite 7** com `@lovable.dev/vite-tanstack-config` (preset de build)
- **Bun** como gerenciador de pacotes

## Comandos

```bash
bun install            # instalar dependências
bun run dev            # servidor de dev (porta 8080)
bun run build          # build de produção
bun run preview        # preview do build
bun run lint           # eslint
bun run format         # prettier --write
```

> **Ambiente sandbox (Claude Code na web):** o Vite tenta escutar em IPv6
> (`:::8080`), que não é suportado aqui. Rode com `bun run dev --host
127.0.0.1 --port 8080`.

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os segredos:

```bash
cp .env.example .env
```

- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` (+ versões `VITE_`): públicas,
  já preenchidas no `.env.example` (vão para o bundle do navegador).
- `SUPABASE_SERVICE_ROLE_KEY`: **secreto**, usado server-side.
- `GOOGLE_GENERATIVE_AI_API_KEY`: **secreto**, usado pelo chatbot e pela triagem
  de sintomas (ver abaixo).
- `CHAT_MODEL`: opcional, modelo do chatbot (padrão `gemini-2.5-flash`).
- `ADMIN_EMAILS`: e-mails (separados por vírgula) que acessam o **Painel do
  médico** (`/painel`) e recebem aviso de novos agendamentos.
- `RESEND_API_KEY` / `MAIL_FROM`: opcionais, envio de e-mail de confirmação de
  consulta via Resend. Sem a chave, o agendamento funciona, mas não envia e-mail.

O `.env` está no `.gitignore` — nunca commite chaves reais.

> **Banco em dia (ago/2026).** O dono aplicou todos os `APLICAR_*.sql`.
> Conferido por sondagem ao PostgREST: `doctor_slots`, `doctor_blocks`,
> `appointment_reminders` e `private_consultations` respondem 200, e
> `clinical_acks` responde 401 (existe, e a RLS barra o anon — o esperado).
>
> Os `APLICAR_*.sql` continuam idempotentes: rodar de novo é seguro, e é o que
> se faz depois de acrescentar uma migration.
>
> ⚠️ **O nome da tabela é `preconsulta_forms`**, não `pre_consultation_forms`.
> Escrever o segundo custou um pedido de pré-consulta que nunca era enviado, sem
> erro nem log — o chamador tratava a falha de leitura como "todas já
> responderam". `src/lib/tabelas-que-existem.test.ts` confere cada `.from()`
> contra o schema e contra os `APLICAR_*.sql`.

## Deploy (Vercel)

O build usa o preset **vercel** do Nitro e gera `.vercel/output` (Build Output
API), que a Vercel detecta automaticamente. Configurado em `vite.config.ts` e
`vercel.json` (`buildCommand: bun run build`).

Passo a passo (uma vez):

1. Acesse https://vercel.com e entre com o GitHub
2. **Add New → Project** e importe `clovisbacha/doutorclovis`
3. Em **Environment Variables**, adicione as chaves do `.env` (todas as
   `VITE_*` são necessárias no build; `GOOGLE_GENERATIVE_AI_API_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY` no runtime)
4. **Deploy**

Depois disso, cada `git push` atualiza o site: a branch de produção vira a URL
principal e as outras branches ganham uma URL de **preview** automática.

> ⚠️ **MEDIDO EM AGO/2026: `www.obstetrica.com.br` ESTÁ SERVINDO A BRANCH DE
> TRABALHO `claude/determined-edison-XSh9l`, e não a `main`.** Conferido contra
> a fonte primária, e não deduzido do painel: `/pub/<CODIGO>` é uma rota que
> existe SÓ nesta branch, e a produção responde 200 com o texto dela; e
> `origin/main` não contém os commits. A PR #117 está ABERTA e EM RASCUNHO.
>
> Isso muda três coisas para quem trabalhar aqui:
>
> 1. **Não existe preview.** Todo push desta branch vai ao ar para as pacientes
>    no minuto seguinte — não há degrau entre "empurrei" e "está em produção".
> 2. **O `APLICAR_*.sql` chega DEPOIS do código, sempre e para valer.** Não é
>    hipótese de sala de aula: é o estado normal desta produção. Os degraus de
>    recuo são a única coisa entre uma coluna que falta e um recurso antigo
>    apagado em silêncio.
> 3. **A régua de "posso empurrar isto?" fica mais dura**: o que estiver pela
>    metade fica pela metade NA MÃO DA PACIENTE, não numa URL de teste.
>
> ⚠️ **E A CI NÃO BARRA O DEPLOY — MEDIDO EM SET/2026.** São dois sistemas
> independentes: o GitHub Actions roda os testes, a Vercel constrói e publica, e
> nenhum dos dois consulta o outro. A linha do tempo do commit `b467f1a`:
>
> | 11:41:01 | o job `Testes` REPROVOU |
> | 11:41:54 | a Vercel publicou `www.obstetrica.com.br` — **o mesmo commit** |
>
> Cinquenta e três segundos. Ou seja: **`bun run verificar` verde é a ÚNICA
> coisa entre um defeito e a paciente** — a CI é um segundo par de olhos que
> chega TARDE, e a varredura de bancadas, que é a checagem mais valiosa que
> existe aqui, termina depois de o código já estar no ar.
>
> Isso muda a régua de "posso empurrar isto?" mais uma vez: não basta o portão
> local passar; o que estiver em dúvida não deve ser empurrado esperando que a
> CI pegue, porque quando ela pegar já é tarde.
>
> Quem quiser fechar isto: exigir os checks no GitHub e ligar a proteção de
> branch, ou apontar a Vercel para publicar só depois deles. É configuração do
> dono, nos dois painéis — não se resolve pelo repositório.

> Se a intenção era que a produção seguisse a `main`, quem conserta é o dono, no
> painel da Vercel (a branch de produção do projeto, ou o domínio apontado para
> esta branch). Não mexa nisso pelo repositório.
>
> ⚠️ **E ISSO DESTAPA UM BURACO DE VERIFICAÇÃO QUE JÁ EXISTIA:** a varredura de
> bancadas da CI abre o servidor de DESENVOLVIMENTO, nunca o build de produção.
> Enquanto havia preview isso era aceitável; sem preview, o build que a paciente
> recebe é o único que ninguém abre num navegador.
>
> O que dá para conferir daqui, e foi conferido (ago/2026): as seis rotas
> públicas respondem 200 e o HTML do SSR não traz a fronteira de erro ("Algo deu
> errado"). O que **NÃO** dá: hidratação no build de produção — o Chromium não
> atravessa o proxy do agente (`ERR_CONNECTION_RESET`), e o preset do Nitro é
> `vercel`, cuja saída o `vite preview` não serve. Um `useSyncExternalStore`
> devolvendo `[]` novo já deixou este app SEM ABRIR, e essa classe de defeito
> mora exatamente aí.
>
> Quem quiser fechar o buraco: um preset `node-server` paralelo, servido em
> 127.0.0.1 (que não passa pelo proxy), com a mesma varredura por cima. Não fiz
> porque mexe na configuração de build para uma capacidade que ninguém pediu —
> fica escrito para ser uma decisão, e não um esquecimento.

## Estrutura

```
src/
  routes/              # páginas (file-based routing do TanStack)
    index.tsx          # home
    sobre, agendamento, gestacao, batimentos, dpp, calculadora,
    hospitais, lives, mural, depoimentos, mitos, bastidores,
    primeira-consulta, tamanho-real, cards, modo-acompanhante...
    _authenticated/    # rotas que exigem login (minha-conta)
    api/chat.ts        # endpoint do chatbot (streaming)
    __root.tsx         # shell, head/SEO, error boundary, layout
  components/          # componentes do site
    ui/                # shadcn/ui
  integrations/supabase/  # client (browser), client.server, auth middleware
  lib/                 # utils, gestacao, appointments, ai-gateway, config
  server.ts            # wrapper de SSR com tratamento de erro
  start.ts             # middlewares (auth + erro)
supabase/migrations/   # schema do banco
```

## Banco de dados (Supabase)

Tabelas (ver `supabase/migrations/`):
`appointment_requests`, `patient_profiles`, `journal_entries`,
`kick_sessions`, `checklist_items`, `health_logs`, `doctor_questions`,
`companion_invites`.

## Chatbot (AI)

`src/routes/api/chat.ts` usa o **Google Gemini** via Vercel AI SDK
(`streamText` + `@ai-sdk/google`). Configuração em
`src/lib/ai-gateway.server.ts`. Requer `GOOGLE_GENERATIVE_AI_API_KEY`; o modelo
é definido por `CHAT_MODEL` (padrão `gemini-2.5-flash`).

## Conteúdo diário da jornada (Caminho)

Cada dia da jornada tem **duas** peças de conteúdo, ambas indexadas pelo dia
gestacional `D = semana * 7 + diaDaSemana` (0–6):

| Peça                          | Arquivo                              | Cobertura                                                          |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| **Aula da professora** (quiz) | `src/lib/daily-quizzes.data.json`    | gestação D 7–300 (semanas 1–42), 294 dias, 1331 perguntas          |
| **Desafio do dia**            | `src/lib/daily-challenges.data.json` | gestação D 7–300 + pós-parto D 7–90 (12 semanas de vida), 378 dias |

No pós-parto, `D = idade do bebê em dias + 7`.

Ritmo pedagógico por `D % 7` — vale para as duas peças:
`0 bebê · 1 corpo · 2 nutrição · 3 sinais · 4 exames · 5 vínculo · 6 revisão`.

`challengeForDay` / `challengeForPosDay` (em `gestacao-path.tsx`) leem a tabela
primeiro; as listas `CHALLENGES_T1/T2/T3/POSDATA/POS_*` só entram como rede de
segurança para dias fora da faixa (DUM corrigida, gestação além de 42s).

**Desenho da trilha:** todo dia é um nó, inclusive os anteriores à entrada na
jornada — o que separa grátis de premium é o portão da aula (`quizPremium`),
nunca o desenho. A cada 7 dias entra uma `WeekBar` (barra da semana com fruta,
marco, placar de 7 pontinhos), e é nela que mora o álbum da semana — antes era
uma moeda "memória" solta na trilha.

Ao editar o conteúdo, rode a auditoria antes de commitar — ela cobra cobertura
completa, gabarito dentro da faixa, "marque todos" sem todas as alternativas
corretas e enunciado repetido dentro de 14 dias:

```bash
bun run audit:conteudo
```

## Fluxo unificado de eventos clínicos (jul/2026)

O painel do médico enxergava **seis** tabelas. Triagem de sintomas, contrações,
SOS, exames, glicemia, biometria fetal, EPDS e a série pós-parto inteira eram
gravados pela paciente e nunca lidos por ninguém.

Agora existe um contrato só: a view **`clinical_events`** une onze fontes em
`(fonte, fonte_id, user_id, ocorrido_em, especie, dados jsonb, texto)`.

- **É view, não tabela.** Metade das fontes é escrita direto do navegador com a
  chave anon, então materializar a gravidade exigiria trigger em SQL — e a régua
  clínica passaria a viver em dois lugares. A view entrega números CRUS; a
  gravidade sai de `src/lib/sinais-clinicos.ts`, a mesma régua do app da
  paciente. **Nunca duplique um limite clínico fora desse arquivo.**
- **É montada dinamicamente** (`DO` + `to_regclass`): produção tem menos tabelas
  que o repo, e `CREATE VIEW` sobre tabela ausente falharia inteiro. Rode o SQL
  de novo depois de aplicar migrations — a view se amplia sozinha.
- **`security_invoker = true`**: a view respeita a RLS de quem consulta.
- `clinical_acks` guarda o DESFECHO que o médico registra ("já cuidei"), não a
  leitura.
- ⚠️ **Um contrato só quer dizer UMA LEITURA por fonte.** O painel ainda tinha
  `listarTriagens`, um segundo caminho para `triage_logs`: buscava a cada
  abertura, guardava a lista em estado e NENHUMA tela a desenhava — só o
  sinalizador de falha sobrevivia, pondo "alertas de sintomas" na faixa de
  fontes com problema sobre um dado que chegava inteiro por `clinical_events`.
  Saiu (ago/2026). Se a triagem merecer tela própria, ela nasce da view.

Leitura: `src/lib/clinical.functions.ts` (`eventosQuePedemOlhar`,
`prontuarioDaPaciente`, `fichaClinica`, `registrarDesfecho`, `serieDe`).
Tela: `src/components/prontuario-paciente.tsx`.
Recorte: **sempre** pelo vínculo ATUAL (`patient_profiles.doctor_id`), nunca por
`doctor_id` carimbado na linha de origem.

**Aplicar no Supabase:** `supabase/APLICAR_EVENTOS_CLINICOS.sql` (idempotente).
Ele também traz seis índices que faltavam, as faixas plausíveis (CHECK) e o
`ON DELETE CASCADE` — sem o qual apagar a conta de uma paciente falhava com
violação de chave, tornando a LGPD inexequível.

A IA lê as medidas em `buildMedidasBlock` (`src/routes/api/chat.ts`): última
pressão, última glicemia e até três registros alterados dos últimos 14 dias.
Contexto, não conduta — o portão de cobertura do cérebro continua mandando.

## ⚠️ TELA NOVA A PARTIR DE UMA REFERÊNCIA: use `/tela` (ago/2026)

Pedido do dono depois de duas telas saírem "completamente diferentes e
desconexas" da referência que ele desenhou: pesquisar o que existe para isso não
se repetir.

O que a pesquisa achou é que **a falha não era de capacidade, era de
verificação** — e a própria documentação do Claude Code nomeia o defeito
("trust-then-verify gap": _se você não consegue verificar, não entregue_) e
prescreve o conserto: **fotografar o resultado e compará-lo com a referência,
listando as diferenças, antes de dizer que acabou.** Eu nunca tinha feito isso.

- **`.claude/skills/tela/SKILL.md`** é o processo, e ele abre com os quatro
  erros concretos que criaram o problema (reconstruir arte em CSS · trocar dado
  que falta por genérico em silêncio · nunca comparar lado a lado · acrescentar
  o que ninguém pediu).
- **`scripts/comparar-com-referencia.mjs`** é a verificação: monta a foto lado a
  lado e imprime altura relativa, paleta dominante e tinta por faixa. ⚠️ Os
  números apontam onde olhar; **não substituem olhar**.
  - `--seletor=` fotografa só o componente. Sem ele a bancada traz cabeçalho e
    rodapé do site e todo número vira ruído — a primeira execução acusou "3,33×
    mais alta" comparando página inteira com componente.
  - `--recorte=y0,y1` apara barra de status e navbar do mockup.
  - **A área segura é injetada por padrão** (59px): o Chromium devolve zero em
    `env(safe-area-inset-*)`, e foi por isso que os controles da Loja passaram
    meses embaixo do relógio do iOS sem ninguém ver.

**O conector do Figma existe e NÃO está instalado** (`get_design_context`,
`get_screenshot`, `get_variable_defs`, `create_design_system_rules`). Ele é a
resposta padrão do mercado — mas só compensa se as referências passarem a nascer
no Figma. Hoje elas nascem como IMAGEM, e para imagem o que resolve é a colagem
mais a comparação acima.

## Como trabalhar neste repositório (as regras que valem sempre)

O diário de bordo com o porquê de cada decisão está em `docs/diario/` (ver a
última seção deste arquivo). O que segue é o que não muda de sessão para
sessão. Cada linha aqui já custou um defeito em produção; a história de cada
uma está no diário, e `grep` acha.

**Antes de commitar**

- `bash scripts/verificar.sh` é o portão único: tsc, lint, `bun test src/`,
  cobertura de arquivos e a conferência de que a árvore não está atrás do
  remoto. Ele sai com erro se qualquer passo falhar. Vermelho não se commita;
  um portão de cada vez (dois juntos dão tsc vermelho falso e suíte pela
  metade).
- As bancadas (`/preview-*`) são o portão dinâmico: `cp .env.example .env`,
  `bun run dev --host 127.0.0.1 --port 8080`, depois `bun run varrer:bancadas`
  e `bun run varrer:interacao`. O CI roda as duas. `bun run acessibilidade`
  e `bun run audit:conteudo` complementam.
- Mensagem de commit em português, dizendo o porquê. Nunca `git add -A &&
commit` numa árvore que o contêiner restaurou de instantâneo antigo: o hook
  de início e o portão avisam.

**Código**

- Tela nova a partir de uma referência visual: use `/tela`
  (`.claude/skills/tela`), nunca de memória.
- `src/routes/_authenticated/minha-conta.tsx` é a rota da paciente e tem
  15 mil linhas: aba nova vai em arquivo próprio, atrás de `lazy()`, e não
  inline. `GestacaoPath`, `RedeNoApp`, `CantinhoTab` e `SonsParaDormir` já são
  assim, por medição.
- "Hoje" no cliente é `ymdLocal()`; carimbo de data no servidor é
  `ymdBrasilia()`. Nunca `toISOString().slice(0, 10)` para "hoje": das 21h à
  meia-noite ele já está em amanhã (`data-civil.test.ts` proíbe nas telas).
- Limite clínico mora só em `src/lib/sinais-clinicos.ts`. Nunca duplique um
  limite fora dele.
- Recorte de pacientes é sempre pelo vínculo ATUAL
  (`patient_profiles.doctor_id`), nunca por histórico de consulta.
- Vazio não é falha: leitura que falhou mostra `NaoConsegueLer`, nunca uma
  lista vazia que afirma algo. Escrita que falhou nunca mostra sucesso — o
  servidor devolve `{ ok: false }` numa resposta 200 normal, então `try/catch`
  sozinho não pega.
- Modo Cuidado (`patient_profiles.care_mode`): as telas param de FALAR DO
  BEBÊ, nunca de socorrer. O SOS e o cronômetro de contrações ficam; o
  contador de movimentos, o batimento e as artes do bebê saem.
- Bancada injeta dados nos MESMOS `useState` da produção, nunca num desenho à
  parte. Parâmetro booleano de bancada lê-se
  `q.x === true || String(q.x ?? "") === "1"` (o router faz JSON-parse da
  query; `q.x === "1"` nunca é verdade).
- Testes: regra de negócio vira função pura com teste; catraca que lê o fonte
  passa por `semComentarios()`. O fuso dos testes é `America/Sao_Paulo`
  (`bunfig.toml`). Zero testes renderizam componentes hoje — a rede dinâmica
  são as bancadas.

**Banco e servidor**

- `APLICAR_*.sql` (idempotentes) chegam DEPOIS do código, e o dono os roda à
  mão no SQL Editor. O app tem recuos ("o banco do app ainda não aceita…") e
  `/admin → Banco` diz qual falta. O nome da tabela é `preconsulta_forms`, e
  `tabelas-que-existem.test.ts` confere cada `.from()`.
- `src/integrations/supabase/types.ts` cobre 27 de ~128 tabelas: o `tsc` não
  pega nome de coluna errado. Regenerar com `supabase gen types` antes de
  refatorar.
- Funções de servidor validam o token com `auth.getUser` uma a uma; agregar
  chamadas da abertura é melhoria, não regressão.

**Casca nativa (Capacitor)**

- Só `cap sync`, nunca `cap add`: o projeto nativo tem mão humana
  (permissões, `Info.plist`, `AppDelegate`). O CI `App nativo` compila os
  dois alvos a cada push que toca `ios/`, `android/` ou o config.
- Plugins entram por `import()` dinâmico em `src/lib/nativo.ts`;
  `Capacitor.Plugins` não existe na ponte injetada. `ehNativo()` é a pergunta
  certa (PWA instalado não é nativo).
- A classe `.nativo` no `<html>` (posta antes de hidratar) esconde o cromo do
  site; `src/lib/voltar.ts` é a pilha do voltar; toda folha registra
  `useVoltar`.
- Alvo de toque mínimo 44 px (`min-h-11`, classe `.press`), letra mínima 13 px,
  cores pelos tokens da marca. A casca carrega o site publicado
  (`capacitor.config.ts`, `server.url`); o pacote local é o destino, não o
  presente.

**LGPD**

- Cache da Comunidade só em memória; caches locais por `uid`, limpos no
  `signOut`. Exportar dados e excluir conta existem e funcionam para a
  paciente; a do médico passa pelo suporte.

## Estado em 24/09/2026

- Site e app da paciente em produção na Vercel; a casca nativa compila no CI e
  nunca foi assinada nem rodou num iPhone (sem Team, sem entitlements).
- Avaliação completa do app contra o padrão de um app iOS bem feito feita em
  23/09 (35 itens, com esforço): o que reprova na loja, o que denuncia site
  embrulhado, e o que falta de recurso. Lotes 1 a 4 saíram como PRs
  (#119, #120, #121 e o seguinte): bugs de código puro, casca em arquivos de
  texto, volta ao app, e polimento da casca.
- Pendências que só o dono destrava: conta Apple e entitlements (push, Sign
  in with Apple, universal links), produtos e IAP, os SQL de setembro, o cron
  dos três ticks, conta de demonstração e capturas para a revisão.
- Decisões em aberto: `WKAppBoundDomains` (service worker na casca), esconder
  as portas de compra até o IAP existir, e o áudio em segundo plano por
  plugin.

## O diário de bordo

O histórico de cada decisão, medição e defeito (jul a set/2026, ~17.800
linhas) está em `docs/diario/2026-jul-set.md`. Foi movido para cá em 24/09/2026
sem uma linha editada: dentro do `CLAUDE.md` ele entrava inteiro em toda sessão
e consumia o contexto antes de o trabalho começar. Sessões novas registram no
diário, não aqui; este arquivo guarda só o que vale sempre e o estado atual.
