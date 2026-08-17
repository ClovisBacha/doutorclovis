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

## A influenciadora passou a existir do lado dela (ago/2026)

Proposta do dono: modelo híbrido (link inteligente + código manual com bônus).
A estrutura estava certa — e metade dela **já rodava**: `?ref=CODIGO` guardado
90 dias, `ref_code` carimbado, metadata na Stripe, 50% por fatura paga em
`affiliate_earnings`. Faltavam três coisas, e duas da proposta precisaram mudar.

### ⚠️ O código NÃO pode morar em `referred_by`

A proposta original gravava ali. `referred_by` **não é registro de origem — é o
grafo de amizade**: `saoAmigas` decide quem enxerga o Cantinho de quem por
`minha.referred_by === outra || dela.referred_by === eu`.

Uma criadora com três mil seguidoras viraria **amiga de três mil gestantes**:
na lista de Amigas de cada uma, com acesso ao Cantinho, dupla de sequência e
presente. E como `referred_by` é fixado UMA VEZ, o código dela **queimaria** a
indicação de uma amiga real — ou o contrário, conforme quem chegasse antes.

Vai em `ref_code`, que já existia com índice. Há teste proibindo a string
`referred_by` em `influenciadora.functions.ts`.

### ⚠️ 500 🌱 quebrariam a mecânica de conversão — o valor é 150

Medido com a régua do próprio app (704 🌱 de loja grátis, 38,6 🌱/dia):

| bônus   | % da loja | parede sem médico | com médico |
| ------- | --------- | ----------------- | ---------- |
| 0       | 0%        | 19 dias           | 16 dias    |
| **150** | **21%**   | **15 dias**       | 12 dias    |
| 500     | 71%       | 6 dias            | 3 dias     |

500 entregaria 71% da loja grátis no cadastro e derrubaria a parede do 15º para
o 6º dia. A parede é a decisão de monetização inteira — um bônus de boas-vindas
não pode desfazer o desenho que ele deveria alimentar. 150 é o maior valor que
mantém a parede no 15º dia, e é 1,5× a indicação entre pacientes.

`BONUS_INFLUENCIADORA` entra em `entradaDeGraca`: sem isso os testes de teto
mediriam uma paciente que não existe.

### O que passou a existir

- **`ref_code` é escrito no CADASTRO**, não só no checkout. Antes, quem chegava
  pela influenciadora e não assinava não existia para ela — o relatório contava
  só quem pagou, e "quantas pessoas eu trouxe?" não tinha resposta.
- **Campo no onboarding**, pré-preenchido pelo link. Vindo do link ele só
  confirma (o efeito da página já atribuiu); digitado, é enviado DEPOIS de o
  perfil salvar — o servidor precisa da linha em `patient_profiles`.
- **Rede de segurança no Perfil** (`CodigoDaEmbaixadora`). ⚠️ **A janela NÃO é
  de 48h**, ao contrário da proposta: o que decide é `ref_code` estar vazio, e a
  comissão prende na assinatura, que pode acontecer no dia 40. O cartão SOME
  quando ela já tem código.
- **`/influenciadora`** — a tela dela, no site. ⚠️ Resolvida pelo **e-mail da
  sessão**, nunca por um código vindo do cliente: bastaria trocar uma letra na
  requisição para ler o faturamento de outra criadora. "Não é afiliada" é
  `painel: null`, não erro — é o caso mais comum.

**Aplicar:** `supabase/APLICAR_INFLUENCIADORA.sql` (só `affiliates.email`).

## O presente virou escolha, e a entrada ganhou o terceiro papel (ago/2026)

### Ela escolhe quanto dá

Pedido do dono: "a amizade ali ela pode escolher o quanto que ela dá".

⚠️ **O servidor JÁ aceitava `quantidade` e já validava contra o bolso** — o que
faltava era a tela, que mandava `PRESENTE_ENTRE_AMIGAS` fixo no primeiro toque.
`FolhaDePresente` (`amigas.tsx`) não afrouxa trava nenhuma: o teto continua
sendo `mesada.restante`, conferido em `presentearAmiga`.

- **Degraus, não campo livre.** Campo aberto obriga a inventar um número, e
  presente entre amigas é gesto, não transferência bancária.
- ⚠️ **Degrau que não cabe no bolso nem aparece**, e **o bolso inteiro entra
  como último degrau**: sem isso, quem tem 25 🌱 não veria degrau nenhum (todos
  acima de 25) e o recurso sumiria da tela com saldo disponível.
- **A folha é a MESMA nas duas portas** (lista e tela da amiga) — duas cópias
  divergiriam no primeiro ajuste de degraus. A tela da amiga recebeu
  `restanteDoBolso` da aba, que já o carregou.

### `/auth` passou a ter três papéis

Paciente · médico · **acompanhante**. A influenciadora fica de fora de propósito
(decisão do dono: só no site — a tela dela é `/influenciadora`).

⚠️ **O ACOMPANHANTE NÃO CRIA CONTA**, e isso é uma decisão tomada na ausência do
dono. Ele perguntou se o acompanhante teria conta própria e saiu antes de
responder; escolhi o mecanismo que **já existe** — a gestante gera um convite
(`companion_invites`) e ele abre `/acompanhar/<token>`, sem senha. Inventar login
de acompanhante significa tabela nova, RLS nova e uma decisão de privacidade
(o que ele passa a ver, e por quanto tempo) que é dele. Se a resposta for "sim,
conta própria", o botão já está no lugar certo para crescer.

- **O campo aceita o LINK INTEIRO ou só o código**, e limpa query e fragmento:
  quem recebe link no WhatsApp copia o link, e ele vem com `?utm_...` grudado.
- ⚠️ **Nada é validado no cliente.** Quem confere o token é `getCompanionView`,
  que já distingue "inválido" de "expirado" — uma segunda régua aqui diria
  "código inválido" para convite que o servidor aceitaria.

⚠️ **DUAS ARMADILHAS MEDIDAS, e as duas viraram teste:**

1. **Eu quase quebrei o login do médico.** Ao excluir o acompanhante do
   formulário, colapsei a condição num `role !== "medico"` solto — o que tira o
   formulário de LOGIN dele e deixa o painel do consultório inalcançável. Só o
   CADASTRO tem fluxo próprio. A forma certa é
   `role !== "acompanhante" && (login || (signup && role !== "medico"))`, e
   `perfis-do-auth.test.ts` cobra exatamente essa string.
2. **`break-words` não basta para uma palavra longa num botão.**
   `overflow-wrap: break-word` permite quebrar durante o layout mas **não reduz
   a largura mínima** do elemento — num pai `items-center` (shrink-to-fit) o
   rótulo continuava medindo "Acompanhante" inteiro e transbordava a 320px
   (106px de texto numa caixa de 88). Quem conserta é **`w-full` no rótulo**;
   `hyphens-auto` + `lang="pt-BR"` deixam a quebra bonita.

⚠️ **E um comentário JSX não pode ser o segundo filho de `{cond && (…)}`** —
custou um `TS1005` apontando para a linha do `<div>`, não para o comentário.

### ⚠️ O ritual de boas-vindas ganhou bancada, e ela faltava fazia tempo

O `OnboardingRitual` só aparece para uma paciente recém-criada e SEM perfil, uma
vez só: salvou, acabou. Enquanto ele pedia nome, DUM e foto, isso era um
incômodo de revisão.

**No dia em que ele ganhou o campo do código da embaixadora, virou outra coisa**:
um controle no PRIMEIRO MINUTO de toda paciente nova — e que decide se uma
influenciadora recebe ou não a indicação — escrito às cegas e entregue sem
ninguém nunca ter olhado. É exatamente o defeito que a skill `/tela` existe para
impedir, cometido no mesmo dia em que a skill foi escrita.

⚠️ **E A MESMA BANCADA COBRE AS DUAS PORTAS DO CÓDIGO**: `?tela=perfil` mostra o
cartão da rede de segurança (`CodigoDaEmbaixadora`), que vive dentro de uma aba
que exige sessão e estava tão invisível quanto o campo do ritual. Ele se esconde
sem sessão — comportamento certo em produção, e exatamente o que o tornava
impossível de fotografar —, então a bancada o liga por prop.

`/preview-onboarding?passo=4` mostra o campo; `&ref=MARIA` mostra o estado de
quem chegou pelo link (confirmação verde, sem pedir ação). ⚠️ A bancada escreve
o `localStorage` ANTES de montar o ritual e segura a montagem por um render — o
ritual lê o código na primeira renderização, então sem essa espera a bancada
mostraria sempre o campo vazio, que é o único estado que ela não precisava
provar.

## A auditoria do menu ☰, e a tela que faltava (ago/2026)

Pedido do dono: auditar tudo dentro do menu da área do bebê, nota por item.
Deu **7,4** — a navegação estava bem resolvida (nenhum dos 8 destinos quebrado,
nenhum alvo abaixo de 44px, contraste de 14 a 18:1). O problema era o que não
estava lá.

### ⚠️ NÃO HAVIA COMO CANCELAR A ASSINATURA

`openBillingPortal` e `getMyBilling` estavam escritas em `billing.functions.ts`
há meses. O ÚNICO chamador do portal era `painel.tsx` — o painel do **médico**.
`getMyBilling` não tinha chamador nenhum.

A paciente assinava, era cobrada todo mês, e o app não tinha tela dizendo quanto
ela paga, quando renova nem como parar. É quebra de confiança (quem não acha
como cancelar faz chargeback), risco de conformidade (o CDC espera cancelar tão
fácil quanto contratar) e, com o IAP, item que a revisão da Apple cobra.

`AssinaturaTab` fecha isso — **só UI, servidor já pronto**.

- ⚠️ **A ORIGEM decide o botão.** `source` vindo da loja da Apple/Google não
  abre no portal do Stripe; um botão que abre portal vazio faz ela concluir que
  o app quebrou em vez de procurar no lugar certo. `null`/vazio conta como
  Stripe — é o que as assinaturas antigas têm gravado.
- ⚠️ **"TEM ACESSO" ≠ "ESTÁ PAGANDO"**, e a bancada pegou: uma assinatura
  CANCELADA com período pago até setembro mostrava título "Plano gratuito" e,
  logo abaixo, "seu acesso vai até 16 de setembro" — duas frases se
  contradizendo na mesma tela. Um booleano fazia dois trabalhos.
- ⚠️ **E separar os dois criou um beco sem saída** que também precisou de porta:
  cancelada + com acesso ficava sem botão nenhum, e é exatamente quem pode
  querer voltar atrás. Virou "Reativar assinatura", pelo mesmo portal.
- **Quem nunca assinou não lê texto de cancelamento** — mas lê a frase do limite
  ético ("nada do seu cuidado depende da assinatura"), que vale ainda mais para
  quem está decidindo.

### ⚠️ "Sair" ficava abaixo da dobra

Medido com a área segura injetada: com a folha rolando inteira, num **iPhone SE
(375×667)** saíam da vista Pós-parto, Painel e **Sair**; num 320px, também as
Dúvidas. Sair do app exigia descobrir que a lista rolava.

A folha virou **coluna com rodapé fixo**: só a lista rola, Painel e Sair vivem
num irmão `shrink-0`. Medido depois nos três aparelhos: Sair sempre visível sem
rolar, lista rolando, último item alcançável.

### Três acertos menores

- **A foto real no cabeçalho.** `avatar_url` estava preenchida (o mesmo campo
  que a aba Amigas usa) e o menu desenhava um ícone genérico — era a única tela
  que conhecia a pessoa e não a reconhecia.
- **O ponto das Notificações saiu.** Ele e o contador apareciam pela MESMA
  condição e diziam a mesma coisa; o número é estritamente mais informativo. O
  ponto fica no Perfil, onde é a única informação possível.
- **`?pendente=1` na bancada do menu.** O ponto do Perfil era um estado escrito
  às cegas.

**Bancadas:** `/preview-conta?pendente=1` · `/preview-assinatura?estado=ativa`
(`loja` · `cancelada` · `gratuito`). ⚠️ A da assinatura **nasceu junto com a
tela** — é a lição do dia aplicada na hora, depois de o campo do onboarding e o
cartão do Perfil terem sido escritos às cegas e só ganharem bancada num remendo.

## Resquícios do Lovable (opcional remover)

- `@lovable.dev/vite-tanstack-config` — preset de build (funciona; remover é
  refator grande).
- `src/lib/lovable-error-reporting.ts` — no-op fora do Lovable (usa
  `window.__lovableEvents`).
- `.lovable/project.json` — metadados do template.

## Fluxo de agenda + ciclo/cérebro (IMPLEMENTADO — jul/2026)

Estas eram pendências de backlog; já estão em produção. Precisam do
`supabase/APLICAR_AGENDA.sql` rodado no banco (contraproposta + fila de espera).

### Agenda (contraproposta + fila de espera)

- **Contraproposta**: o médico sugere outro horário (`proposeAppointmentTime`,
  status `counter_proposed`); a paciente aprova/recusa (`respondToProposedTime`).
  Colunas `proposed_date/time` em `appointment_requests`. Backstop de
  double-booking: índice único parcial `appt_confirmed_slot`.
- **Fila de espera por semana** (`appointment_waitlist`): sem horário, a paciente
  entra na fila; ao cancelar uma consulta confirmada, `offerFreedSlot` oferta à
  1ª da fila com prazo de **4h**; sem resposta → cascata pra próxima
  (`sweepWaitlist`). Cascata roda preguiçosa (ao abrir Consultas/Fila) e por cron
  seguro `/api/waitlist-tick` (`CRON_SECRET`). Ver `src/lib/waitlist.functions.ts`.

### Calendário único do mês (ago/2026)

Uma tela só, do mês, juntando as **três** fontes que viviam em abas separadas:
pedidos (`appointment_requests`), teleconsultas e consultas particulares. Régua
em `src/lib/agenda-unificada.ts` (funções puras, sem JSX); grade em
`src/components/calendario-do-mes.tsx`. Legenda por **tipo** — azul presencial,
laranja teleconsulta, roxo particular —, porque o tipo é o que muda o dia dele;
status vira texto ao abrir o dia. O que **não** tem hora combinada aparece
tracejado, nunca como compromisso.

A consulta particular ganhou `scheduled_for timestamptz`
(`supabase/APLICAR_HORA_DA_CONSULTA.sql`, idempotente) — era a única fonte que
não sabia dizer quando acontece. **Uma coluna com fuso, não duas de texto:**
`confirmed_time` aceitar "manhã" já quebrou ordenação. O médico marca no campo
`datetime-local`, que devolve hora sem fuso — a conversão passa por
`deCampoLocal`/`paraCampoLocal` e o servidor recusa string sem fuso
(`z.string().datetime({ offset: true })`). Mandar o valor cru para `timestamptz`
é o erro de três horas que a teleconsulta já teve aqui.

### Painel do médico: quatro grupos de abas (ago/2026)

Eram quinze abas numa fita rolável de uma linha. Hoje são **quatro grupos**
(`src/lib/abas-do-painel.ts` — sem JSX, testado; fita em
`src/components/abas-do-painel.tsx`):

| Grupo            | Telas                                                   |
| ---------------- | ------------------------------------------------------- |
| **Painel 📊**    | Painel, Engajamento, Lives                              |
| **Cérebro 🧠**   | Cérebro, Perguntas                                      |
| **Pacientes 👩‍🍼** | (uma só — pré-consultas e exames são seções dela)       |
| **Agenda 📅**    | (uma só — o Calendário, com pedidos/teles/pagas dentro) |

"Meu Perfil" e "Clínica 🏥" saem da fita e vivem no menu da bolinha
(`FORA_DA_FITA`).

**O Painel é a aba de entrada** (`ABA_DE_ENTRADA`), e isso inverteu a decisão
anterior (Cérebro primeiro). O que mudou não foi gosto: a **fila de trabalho**
saiu do cabeçalho que se repetia em todas as telas e passou a morar dentro do
Painel — com ela dentro, o Painel deixou de ser "o que aconteceu" e virou "o que
ainda precisa dele". O Cérebro é o segundo grupo.

Três regras que os testes cobram (`abas-do-painel.test.ts`, `cota-ia.test.ts`):

1. **O contador sobe para o grupo** (`somaDoGrupo`). O emblema de Pacientes soma
   `novasPacientes + unseenForms` — sem isso o número que faz o médico ir ler
   uma pré-consulta sumiria da fita, e a fusão passaria a esconder trabalho.
2. **A fila de trabalho fica FORA** da `div` que o app nativo esconde para
   mostrar `PainelNoApp`. Lá dentro, ela não existiria no celular.
3. **Toda aba da fita tem bloco de renderização**, e `onIr` do resumo do celular
   é tipado como `PanelTab` — apagar uma aba quebra o build em vez de deixar um
   botão que não faz nada.

Receituário e pedido de exame **não são mais uma aba**: abrem dentro do cartão
da paciente (`AcoesDaPaciente`), com a paciente já escolhida. A dica do painel de
exames vem de `exame-sugerido.ts`, que lê a faixa de semanas **do próprio título
do painel** em vez de duplicá-la; entre as faixas (14–17, 29–31) não há sugestão,
de propósito.

### O calendário é a agenda inteira (ago/2026)

`Agendamentos`, `Teleconsultas` e `Consultas Pagas` deixaram de ser abas: o
Calendário é a tela, e as três listas viraram seções abaixo dele, inteiras.

- **Clicar num dia abre `DiaDaAgenda`** (`src/components/dia-da-agenda.tsx`):
  tela grande com tudo do dia, botão de **marcar consulta** e, nas
  teleconsultas, **abrir a sala e mandar o link**.
- **Marcar funciona para quem NÃO tem conta no app.** `marcarConsultaNoDia`
  (`admin.functions.ts`) insere em `appointment_requests` já `confirmed` —
  nascer `pending` faria a consulta que ele acabou de marcar aparecer na fila
  pedindo que ele a confirmasse.
- **Teleconsulta é a exceção, e ela é dita**: a sala pendura na conta da
  paciente, então exige paciente vinculada. Régua em `validarNovaConsulta`
  (`agenda-unificada.ts`), testada em `marcar-no-dia.test.ts`.
- **O e-mail da paciente vinculada é resolvido no SERVIDOR** — ele mora em
  `auth.users` e nenhuma lista do painel o carrega. A tela manda o `pacienteId`;
  o servidor confere o vínculo (`patient_profiles.doctor_id`) antes de ler o
  e-mail. Sem essa conferência, qualquer `pacienteId` no corpo do pedido
  devolveria o e-mail de qualquer paciente da plataforma.
- **Cores:** 🟢 presencial, 🟠 teleconsulta, 🟣 particular (`CORES_DO_TIPO`).
  O que não tem hora combinada aparece tracejado.

### Duração, contato automático e passado bloqueado (ago/2026)

O calendário virou a agenda inteira; faltavam três coisas para marcar direto
por ele: duração real, telefone da paciente e não deixar marcar no passado.

- **`duracaoMinutos` é campo próprio** (`EventoDaAgenda.duracaoMinutos`,
  coluna `duration_minutes` em `appointment_requests`,
  `supabase/APLICAR_DURACAO_DA_CONSULTA.sql`), não um segundo horário em texto
  — é a mesma lição do `confirmed_time` aceitar "manhã" que já custou três
  horas aqui. `faixaHoraria` (`agenda-unificada.ts`) formata "10:00–10:30" a
  partir de `hora` + `duracaoMinutos`; nunca duas colunas de hora.
- **O choque de horário compara FAIXA, não instante exato.** `validarNovaConsulta`
  (cliente) e `marcarConsultaNoDia` (servidor, `admin.functions.ts`) leem o
  dia inteiro e testam sobreposição de intervalo
  (`inicioNovo < fimExistente && inicioExistente < fimNovo`) — a checagem
  antiga por igualdade de minuto deixava passar uma consulta de 30 min que
  começa 15 minutos depois de outra. As DUAS colunas novas
  (`patient_user_id`, `duration_minutes`) têm recuo próprio contra
  `PGRST204`, uma de cada vez — um recuo que só soubesse tirar a primeira
  quebraria de novo assim que a segunda faltasse num banco que só rodou meio
  SQL.
- **Nada no passado.** `validarNovaConsulta` ganhou um terceiro parâmetro
  (`agora: Date`) e recusa qualquer `dia+hora` anterior a ele — cobre "o dia
  inteiro já passou" e "é hoje, mas a hora já passou" com a mesma comparação,
  sem fuso: `datetime-local` já devolve hora local, e `new Date("YYYY-MM-DDTHH:MM:00")`
  é lida como local pelo ECMAScript.
- **`contatoDaPaciente`** (`admin.functions.ts`) resolve e-mail (de
  `auth.users`, só o servidor lê) e telefone (`patient_profiles.phone`) da
  paciente escolhida no formulário de `DiaDaAgenda`, confirmando o vínculo
  ATUAL antes — nunca antes de conferir, ou qualquer `pacienteId` forjado no
  pedido devolveria o contato de qualquer paciente da plataforma. Um
  `useRef` descarta resposta atrasada se a paciente escolhida mudar no meio
  da busca.
- **A aba virou "Calendário 📅"** (`abas-do-painel.ts`), e o `CalendarioDoMes`
  é o primeiro elemento do corpo da aba — as três seções (Pedidos,
  Teleconsultas, Particulares) continuam abaixo, inteiras.
- **O título duplicado de Teleconsultas** (a seção externa e o componente
  interno mostravam "Teleconsultas" duas vezes) virou um só, na seção
  externa — o texto sobre pré-consulta e nota clínica com IA foi para lá
  também, para não perder a informação.
- **`sendDoctorBroadcast` ganhou filtro por paciente** (`patientIds`
  opcional em `BroadcastSchema`): sem ele, manda para todas, como sempre;
  com ele, o `ids` já recortado pelo médico (`scopedBy`) é **interseção**
  com o `Set` de escolhidas — nunca `ids = data.patientIds` direto, ou um id
  forjado no corpo do pedido mandaria aviso a paciente de outro médico.
  Testado em `agenda-servidor.test.ts`.
- **Aplicar no Supabase:** `supabase/APLICAR_DURACAO_DA_CONSULTA.sql`.

### Lembretes de consulta (24 h e 4 h) — ago/2026

Falta em consultório de alto risco é vaga perdida duas vezes: o médico fica com
o buraco e quem estava na fila não foi chamada.

- **A régua é pura e testada**: `src/lib/lembretes.ts`. A janela é ABERTA
  ("faltam 24 h ou menos e ainda não mandei"), e não uma faixa estreita — cron
  atrasado manda tarde em vez de não mandar, e a ausência de um lembrete não
  deixa rastro nenhum.
- **A de 24 h só vale enquanto faltam mais de 4 h.** Sem isso, uma consulta
  marcada de véspera dispararia as duas no mesmo minuto.
- **O que impede o spam são DUAS coisas**: a régua não repete o que está em
  `appointment_reminders`, e o índice único dessa tabela recusa a segunda
  gravação numa corrida entre dois crons. O registro é gravado ANTES do envio:
  um push perdido é melhor que um push de hora em hora — é o mesmo canal por
  onde chega o aviso de emergência.
- **A pré-consulta usa a MESMA máquina** (espécie `48h_pre`): dois dias antes,
  push pedindo que ela responda. Só para quem tem conta (o formulário vive no
  app) e só se ela ainda não respondeu — pedir o que ela acabou de mandar ensina
  que os avisos deste app não valem leitura. Falha ao ler as respostas trata
  como "já respondeu": errar para o lado de não incomodar.
- **A consulta aponta para a paciente** (`appointment_requests.patient_user_id`,
  `supabase/APLICAR_CONSULTA_DA_PACIENTE.sql`). A tabela nasceu identificando
  por e-mail DIGITADO, e sem esse elo nada downstream funciona — saber se a
  pré-consulta chegou, juntar o que ela registrou entre consultas, pôr a
  consulta na linha do tempo clínica. `NULL` continua válido: consulta de quem
  não tem conta é caso legítimo. O INSERT **repete sem a coluna** (PGRST204) se
  o banco ainda não a tem, para não derrubar o que funcionava antes.
- **Aplicar:** `supabase/APLICAR_LEMBRETES.sql` (rode de novo se você já o
  tinha rodado — o CHECK antigo recusa `48h_pre`) e
  `supabase/APLICAR_CONSULTA_DA_PACIENTE.sql`. **Agendar:** cron de hora em
  hora apontando para `/api/lembretes-tick` com
  `Authorization: Bearer <CRON_SECRET>`. Não está no `vercel.json` de propósito
  — intervalo menor que diário exige plano Pro, e o `waitlist-tick` já segue
  esse mesmo caminho (serviço externo grátis).

### Horários disponíveis e bloqueios (ago/2026)

`doctor_slots` (grade semanal) e `doctor_blocks` (férias, congresso, uma tarde),
em `supabase/APLICAR_DISPONIBILIDADE.sql`. Nascem com `doctor_id NOT NULL` e RLS
própria — as tabelas anteriores foram revogadas por nascerem sem dono e com
política que deixava qualquer autenticado reescrever a agenda do médico.

- Régua em `src/lib/disponibilidade.ts` (pura, sem banco): expandir a grade,
  subtrair bloqueios (**início inclusivo, fim exclusivo**), subtrair o que já
  está marcado, subtrair o passado. Cada borda vale um encaixe por dia.
- **A paciente NÃO calcula os livres no navegador**: saber o que está livre
  exige subtrair consultas de outras pacientes. `horariosLivresDoMedico`
  (service role) devolve só `{dia, hora}`.
- Tela do médico: `GradeDeHorarios`, na aba Calendário. Tela da paciente:
  `EscolherHorario`, em `/agendamento` — só para quem está logada e vinculada;
  visitante continua com os campos livres, porque sem saber o médico não há
  agenda para consultar.
- **Pedido não confirmado NÃO ocupa horário** (é um "quem sabe"). Falha ao ler
  os ocupados devolve erro, e nunca "está tudo livre".

### Gráficos clínicos no prontuário (ago/2026)

`GraficoClinico` (`src/components/grafico-clinico.tsx`) desenha peso, pressão e
glicemia como série temporal, ao lado dos três cartões de "último valor".
Os cartões respondem "como ela está"; o gráfico responde "para onde isso vai" —
peso subindo 200 g/semana e 900 g/semana têm o mesmo último peso na tela.

- **Um gráfico por medida, nunca dois eixos.** Duas escalas fazem qualquer par
  de linhas parecer correlacionado. As duas linhas que dividem um gráfico são
  sistólica e diastólica, que são a mesma unidade.
- **`seriesDePressao` emparelha o PAR do mesmo evento** e calcula a gravidade
  uma vez, para os dois pontos. Duas séries independentes já casaram uma
  sistólica de hoje com uma diastólica de anteontem nesta base. **Nunca** chame
  `sinalPressao(sistolica, 70)` para tirar a gravidade de uma só — 90/70 dispara
  "diferença implausível" e pinta de laranja uma pressão normal.
- **Cor de linha = identidade; cor de ponto = gravidade** (de `sinais-clinicos`,
  nunca uma cópia). A paleta passou nas seis checagens do validador nos dois
  modos, com passo PRÓPRIO para o escuro (a banda dele é L 0,48–0,67).
- **Coordenadas em pixels com proporção mantida** (`viewBox` 600×190,
  `w-full h-auto`): `preserveAspectRatio="none"` esticado deforma os pontos em
  elipses.

### O cartão da paciente (ago/2026)

Abrir uma paciente entregava uma rolagem de ~440 linhas. Hoje são **três abas**
(`src/lib/abas-da-paciente.ts`, testado):

| Aba          | Pergunta                      | Conteúdo                                   |
| ------------ | ----------------------------- | ------------------------------------------ |
| **Agora**    | "o que eu faço com ela hoje?" | quem é, o que pede olhar, o que mudou, SOS |
| **História** | "como ela chegou aqui?"       | gráficos e linha do tempo                  |
| **Ficha**    | "quem ela é?"                 | perfil clínico e a conversa com a IA       |

- **O contador sobe para a aba** (`contadorDaAba`): pendentes + SOS sem
  desfecho, em "Agora". Sem isso a divisão esconderia trabalho clínico.
- "Quem é ela" fica em **Agora**, não em Ficha: 135/88 em 22 e em 38 semanas são
  conversas diferentes.
- `ProntuarioPaciente` ganhou a prop `secoes` em vez de virar três componentes —
  dividir o componente dividiria as chamadas ao servidor.

**A consulta abre pré-preenchida** (`resumo-da-consulta.ts`) com o que ela
registrou desde a última — **só no campo de ACHADOS**. Nunca nos campos de
medida: `consultas.systolic` é o que o médico aferiu, e preenchê-lo com a
pressão que ela mediu em casa faria o prontuário afirmar uma aferição que não
aconteceu.

**A paciente comparada com ela mesma** (`sinalPressaoComBase` em
`sinais-clinicos.ts`): +30/+15 sobre a média das PRIMEIRAS medidas dela. Base
móvel faria a subida lenta arrastar a referência junto. A gravidade final é
sempre a MAIOR entre absoluta e delta — o delta nunca rebaixa um 165/105.

**Quem parou de registrar** entra na fila (`silencio.ts`), no nível mais baixo:
`sinais-clinicos` declara que silêncio NÃO é sinal clínico. Prazo por fase
(7 d ≥36s, 12 d ≥28s, 21 d antes). Recém-cadastrada sem registro não entra.

**Folha para levar** (`folha-da-paciente.tsx`): impressão do navegador, sem
biblioteca de PDF. Carimba data, hora e a origem dos números.

**Modo consulta** (`modo-consulta.tsx` + régua em `src/lib/modo-consulta.ts`):
tela cheia para os quinze minutos com a paciente na frente — idade gestacional
em DIAS no corpo grande, alergias/medicações/risco/sangue, o que mudou desde a
última consulta, e o formulário. Sem gráfico, sem linha do tempo, sem IA.

- **Alergia e medicação aparecem SEMPRE**, mesmo vazias: espaço em branco onde
  deveria estar "alergias" é lido como "não tem alergia".
- **"Nada relatado" ≠ "desconhecido".** Com `ficha.degradada` (ou ficha nula) o
  valor é DESCONHECIDO, em âmbar e com ⚠️ — a diferença entre os dois é uma
  prescrição.
- **`idadeGestacional` mora aqui**, e não mais duplicada no prontuário: uma
  régua que arredonda num dos dois lugares faz a mesma paciente aparecer como
  36s numa tela e 36s6d noutra.
- O formulário é o MESMO `RegistrarConsulta`, e o "o que mudou" é o MESMO texto
  que entra no campo de achados — duas versões divergiriam, e ele leria uma e
  assinaria a outra.

### O bebê bolha ocupou o canto da home, e virou a voz do app (ago/2026)

Pedido do dono: "adicione no canto superior direito o bebê bolha; ele será o
personagem que vai ficar falando as notificações, entre outras interações, e vai
introduzir o app através de um tutorial no primeiro acesso".

A personagem já existia inteira (`bolha.tsx`) — o que faltava era ONDE morar na
tela principal e COMO falar. `mascote-da-home.tsx` é o lugar e a boca; nenhuma
arte nova.

- **O canto direito é o mesmo que a pílula do clima desocupou**, e ele cumpre a
  régua que ela não cumpria: "numa tela cujo assunto é o bebê, o canto tinha de
  dizer algo sobre ele, ou não dizer nada".
- **Duas bolhas na mesma tela é o risco real da mudança** — se as duas lerem
  como a mesma coisa, o app passa a ter dois filhos e o do canto fala. Três
  coisas separam: **tamanho** (88px contra ~236px), **rosto** (a do centro tem
  um FETO, sem olhos; esta pisca) e **lugar** (esta na fileira de ferramentas,
  aquela sozinha no céu). Ele **dobrou de 44 para 88px** a pedido do dono; o
  que segura a leitura é a proporção continuar de quase 1 para 3.
- **Ele NÃO fica mais quieto sem recado — ele conforta.** Pedido do dono na
  mesma noite: sem notificação, o personagem escreve conforto e motivação, "e
  também frases determinadas pela hora do dia e pelo clima". A régua está em
  `src/lib/frases-do-mascote.ts`, e o que impede o ruído deixou de ser o
  silêncio e passou a ser **uma frase por DIA** (`fraseDoDia` é determinística
  no dia local). Um balão novo a cada toque em "Bebê" viraria letreiro.
- ⚠️ **A frase é decidida UMA vez e congela.** O clima chega depois da primeira
  pintura, e as frases de clima entram e saem do sorteio conforme ele: o balão
  nascia com uma frase e trocava por outra sob os olhos de quem lia. A home
  espera o clima por até 2,5 s (prazo, para quem está sem rede) e então
  congela. O recado continua vencendo o conforto, mas por RENDER — some o
  recado, volta a mesma frase, sem sortear outra.
- **Três recortes, e os três existem por um defeito concreto:** `periodos` (a
  faixa do dia), `horas` (⚠️ "já são quase onze" saía às 18h05, porque `noite`
  vai das 18h à meia-noite) e `desde` (⚠️ "já sentiu o bebê hoje?" saía na 11ª
  semana, quando ainda não há o que sentir — a pergunta diária vira "eu deveria
  estar sentindo e não estou"). **Sem o dado, a frase com recorte NÃO entra**:
  na dúvida, uma frase genérica.
- **As cinco expressões entraram em uso** (`humorDaJornada`): dormindo à noite
  sem pendência, surpresa de madrugada, orgulhosa (a piscadinha) quando há
  recado, feliz no resto.
- **O emblema mostra o NÚMERO, não um ponto**: "tem coisa" obriga a abrir para
  descobrir se vale a pena, e a pergunta que ela faz é quantos. Teto em `9+`,
  que é limite de LARGURA no canto da tela.
- ⚠️ **O ponto vermelho saiu do ☰.** Ele só quis dizer "há recado na central" a
  vida inteira, e agora a central tem um anunciante com rosto. Dois avisos para
  o mesmo fato lêem como assuntos diferentes ("o menu tem algo" · "a bolha tem
  algo"). O acesso pelo ☰ **não** mudou.
- **`fala` é a porta do tutorial**, e a precedência é regra testada: fala
  explícita VENCE recado. Um personagem que muda de assunto no meio da frase não
  ensina nada, e o recado continua lá quando ele terminar.
- **A régua mora em `src/lib/fala-do-mascote.ts`**, longe do JSX: o componente
  importa `bolha.tsx`, que importa cinco `.webp`, e um teste morreria no
  primeiro `import`.
- **O humor sai de `humorDaJornada`**, nunca de um `if` local — o portão de Modo
  Cuidado mora dentro dela, e uma segunda régua faria carinha festiva aparecer
  para quem perdeu a gestação.
- ⚠️ **`w-max` no balão não é estética.** Um absoluto com `right` e sem `left`
  decide a largura por shrink-to-fit contra o CONTAINER — 44px aqui. Sem
  `w-max`, "Tenho 3 recados 💌" saía em três linhas com o emoji sozinho na
  última; `max-w` não resolve, porque ele limita o teto e o problema era o piso.
- **Bancada:** `/preview-home?w=20&notif=3` (e `&clima=1` para ligar a consulta
  real de clima, que é a única forma de fotografar as frases de tempo).
  ⚠️ `quantos` lê o próprio campo antes de `notif`: o router serializa e
  revalida, e na segunda passada `s.notif` já é o booleano `true` — `Number(true)`
  é **1**, então `?notif=3` virava três e depois um. Terceira vez que esta
  armadilha aparece no repo (ver `preview-jogo` e `preview-saude`).

#### Duas contas que já existem podem virar amigas (ago/2026)

⚠️ **O buraco central da aba, e ele estava lá desde o primeiro dia.** O grafo
era EXCLUSIVAMENTE o da indicação: para duas contas se enxergarem, uma tinha de
mandar o link **antes de a outra existir**. Ficava de fora o caso mais comum —
as duas já usam o app. Duas grávidas do mesmo obstetra que se conheceram na sala
de espera e baixaram o app cada uma por conta própria não tinham caminho nenhum.

E o pior: se a amiga já tinha sido indicada por outra pessoa, era **irreversível
e silencioso** — `attributeReferral` devolve `attributed: false`, apaga o código
do storage e não diz nada. As duas ficavam achando que o app estava quebrado.

- **`convidarAmiga` resolve por CÓDIGO ou por E-MAIL**, com pedido + aceite
  (`amizades`). O código é o `referral_code` que cada paciente já tem.
- ⚠️ **NUNCA POR NOME.** Busca por nome transformaria a base de pacientes numa
  lista navegável, e num app de gestação de alto risco esse é o dado que menos
  pode vazar. O código é uma CAPACIDADE (32⁷ combinações, só se tem se a outra
  der); o e-mail exige saber o e-mail, que é a prova que o WhatsApp pede.
- ⚠️ **E o e-mail NUNCA revela se a conta existe** — a resposta é a mesma com e
  sem acerto. Sem isso o campo vira um verificador de contas: dá para descobrir
  se uma pessoa específica é paciente daqui, e isso é informação de saúde. O
  código PODE revelar, e é o que o torna gostoso de usar.
- **Teto de 20 convites/dia**, senão o campo de e-mail vira ferramenta de spam.
- ⚠️ **`saoAmigas` passou a conhecer os DOIS grafos.** Ele é o portão de tudo
  (perfil, Cantinho, dupla, presente): se só conhecesse a indicação, a amiga que
  entrou por aceite apareceria na lista e seria recusada em todas as ações — uma
  amiga de segunda classe, com botões que não funcionam. E `presentearAmiga`
  parou de reescrever a régua por conta própria (`saoAmigasParaPresente`).
- **Aplicar:** `supabase/APLICAR_AMIZADES_ENTRE_CONTAS.sql`.

#### ⚠️ `jaPresenteada` era SEMPRE falso — o defeito reintroduzido por dentro

`presenteadasNoCiclo` filtrava `.eq("user_id", eu)`, mas a linha do presente é
gravada com o `user_id` de **quem recebe** (`grantSementinhas(db, amigaId, …)`).
Nenhuma linha casava: o conjunto voltava vazio, o 🎁 reabilitava a cada visita e
o servidor recusava com "você já presenteou Fulana neste mês".

Era exatamente o defeito que a função foi escrita para consertar. E a irmã
`lerMesadaDaAmiga` sempre leu certo — os dois leitores do mesmo dado
discordavam entre si, sem que nenhum teste comparasse os dois lados. Agora há um.

#### O bolso de presentear ficou visível

Pedido do dono: "que tal aquele bônus de sementes ser elegível somente para
enviar para uma amizade?". **Isso já existia** — `MESADA_DA_ASSINANTE`, 120 🌱
que a assinante só pode DAR, nunca gastar consigo. O que faltava era a tela: o
bolso era invisível, então quem paga o Premium não sabia que tinha um, e o único
benefício visível da assinatura dentro da aba era um 🎁 sem explicação.

Um saldo que ela não sabe que tem não presenteia ninguém.

#### Cinco defeitos da aba de jogo, achados pela auditoria

- ⚠️ **A bolha `apaixonado` atravessava o Modo Cuidado.** Ela é usada com
  `humorFixo` na abertura de "Momento com o bebê", e `humorFixo` pula
  `humorDaJornada` — que é onde o portão mora. Medido: com o luto ligado, a
  bolha aparecia de coração nos olhos sobre "Pra você, que eu ainda não vi 💛".
  O portão virou `PROIBIDAS_NO_LUTO`, dentro do componente por onde toda arte
  passa.
- ⚠️ **E a atividade inteira era alcançável no luto.** "Uma carta de 1 minuto
  pra ler em voz alta pro bebê", na lista, para quem acabou de perder a
  gestação. `cartaDasGratidoes` já era barrada; a carta do DIA não. As outras
  três atividades ficam — elas cuidam DELA.
- ⚠️ **`/preview-jogo` não tinha `?luto=`.** São 124 gates de `careMode` em
  `gestacao-path.tsx` e nenhum era fotografável — as bancadas irmãs todas têm.
  Foi por essa falta que os dois defeitos acima sobreviveram: o primeiro só
  apareceu pela bancada do Bebê.
- **O bônus de conjunto era pago e o saldo não se movia.** `balance` vinha do
  RPC da compra, que roda ANTES do bônus. ⚠️ E somar a lista de conjuntos
  completos seria pior: `conjuntosCompletos` devolve TODOS os fechados, não os
  novos — quem já tem três receberia três bônus na tela a cada compra. Soma-se
  só o que nasceu agora (`conjuntosNovos`/`bonusNovo`), e a tela comemora.
- **`bancada.saldo` era prop morta**: a fita mostrava três itens em vez de
  quatro, e a Loja de Sementinhas era inalcançável na bancada.
- **A Escola do Bebê custava uma ida ao servidor por abertura.** `course_progress`
  é escrita só por `completeLesson`, que só abre por um nó `kind: "lesson"` que o
  construtor da trilha não emite desde que a Escola saiu do produto. A consulta
  saiu; o cache local continua sendo lido.
- **O `catch` do saldo engolia os enfeites.** "Secundário" descreve o saldo — não
  a decoração que ela comprou nem os troféus. Uma falha na carteira pulava o
  `getCantinho` inteiro, e a loja passava a dizer "faltam 10 🏆" a quem tem 30.

#### As Amigas passaram a chamar de volta (ago/2026)

Seis mudanças pedidas pelo dono. As três primeiras fecham laços que estavam
construídos e mudos; as três últimas dão história e saída ao vínculo.

**1. O empurrão da ofensiva.** Quando UMA fecha o dia e a outra ainda não, a
outra recebe push. É o mecanismo do Duolingo, e é o único que faz a dupla
existir fora do app — sem ele, as duas só descobrem se abrirem a aba por conta
própria. Sai de graça de dentro de `cobrarBonusDaDupla`, que já tem os dois
conjuntos de dias em mãos.

- ⚠️ **A direção importa**: avisa quem AINDA NÃO fechou. Invertido, vira
  parabéns para quem já fez a parte dela.
- ⚠️ **Um por par por dia** (`duplas.avisada_em`), e o carimbo vai ANTES do
  envio. Este é o mesmo canal por onde chega o aviso de emergência: gastá-lo com
  repetição ensina a ignorá-lo, e um push perdido é melhor que um push por
  abertura de tela.
- ⚠️ **O texto não cobra e não ameaça.** "Você vai perder a sequência" é o texto
  de todo app de streak e aqui cairia numa gestante que pode estar internada. Há
  teste com regex.

**2. O presente avisa a amiga.** Ele gravava, o saldo dela subia, e nenhuma tela
dizia de onde veio — o mesmo defeito que o presente do MÉDICO teve por meses, e
aqui pior, porque o ponto inteiro do presente entre amigas é o NOME de quem deu.
O `AvisoDePresente` do Caminho já sabia desenhar; faltava o empurrão que a traz.
Depois do `if (!gravou)`, nunca antes.

**3. A indicadora sabe que a amiga chegou.** As 100 🌱 caíam em silêncio. É o
momento de maior afeto do recurso e passava em branco — e é o push que faz ela
ABRIR a aba e encontrar a recém-chegada, que é onde a dupla e o presente vivem.

**4. A memória da dupla.** `sequencia` zera quando a chama quebra, e deve mesmo.
Mas uma dupla que segurou sessenta dias e parou numa semana de internação ficava
com **zero**, como se nunca tivesse existido. `maiorSequenciaDaDupla` e
`diasJuntas` (`amigas.ts`, puras) saem da mesma interseção de dias — **sem
coluna nova e retroativas**. Só aparecem quando o recorde é maior que a chama de
hoje, senão seria a mesma frase duas vezes.
⚠️ E "a chama começa quando as duas aparecerem" virou "a chama está esperando
vocês duas" quando há recorde: a primeira é frase de dupla NOVA, e aparecia numa
dupla com 41 dias de história.

**5. Uma amiga pode sair** (`encerrarAmizade`, `amizades_encerradas`).
⚠️ **A INDICAÇÃO NÃO É APAGADA.** `referred_by = NULL` faria o app esquecer uma
recompensa já paga — e, pior, `attributeReferral` só escreve quando o campo está
nulo, então o vínculo poderia ser RECLAMADO DE NOVO por outro código, pagando
duas vezes pela mesma amiga. A amizade sai de cena; o recibo fica.
⚠️ **O efeito é dos DOIS lados**, e no servidor: esconder só de quem pediu
deixaria a outra continuar convidando para dupla e presenteando — não é saída
nenhuma. ⚠️ **E ninguém é avisado**: "Fulana te removeu" transforma um gesto
privado numa briga. A dupla cai junto, senão a chama continuaria contando com
alguém que sumiu da lista.

**6. A pausa gentil.** Com a chama em zero e a outra sumida há 4+ dias, a tela
calava — e o silêncio tem uma leitura só: "ela me abandonou".
⚠️ **O texto diz o FATO e para aí.** O motivo mais provável de um sumiço longo
numa gestação de alto risco é justamente o que ninguém tem o direito de
insinuar: nada de "ela está de licença" ou "ela está bem?". Quatro dias e não
dois, porque dois é fim de semana.

⚠️ **A catraca de escritas sem checagem pegou uma armadilha que ela mesma já
documenta**: `Set.delete` casa com `.delete(` por texto e entra na conta como
DELETE de tabela. `idsDasAmigas` já usava filtro por essa razão, e eu reintroduzi
o `.delete` no bloco novo — voltou a ser filtro.

**Aplicar no Supabase:** `supabase/APLICAR_AMIZADES.sql` (idempotente). Sem ele,
o aviso da ofensiva não sai e a saída da amizade recusa — o resto da aba
continua inteiro.

**Bancada:** `/preview-amigas?dias=0&recorde=41&parada=9` (memória + pausa) ·
`?dias=12&recorde=41` (memória com chama viva) · o `⋯` na linha da amiga abre a
folha de sair.

#### ⚠️ O convite das Amigas não convidava ninguém (ago/2026)

O botão "Convidar" da aba mandava `${origin}/auth` — o link de LOGIN, puro,
sem código de indicação.

Não é detalhe de texto: **o grafo de amizade deste app É o de indicação**
(`referred_by`, nos dois sentidos). A amiga que entrasse por aquele link criava
a conta e nunca virava amiga dela — não aparecia na lista, não dava para formar
dupla, não dava para presentear, e as 100 🌱 da indicação não eram pagas a
ninguém. O botão da tela cujo assunto inteiro é trazer alguém era o único
caminho do app que não trazia.

E falhava em SILÊNCIO: as duas achariam que o app estava quebrado, semanas
depois, sem nada a que apontar.

- **`src/lib/indicacao.ts`** passou a ser o único lugar que monta o link, e o
  `ReferralCard` do Cantinho (que montava certo, à mão) usa o mesmo. Duas
  construções do mesmo link, e a que divergiu foi a mais nova — que é sempre
  como isto acontece.
- ⚠️ **`PARAM_INDICACAO` mora lá também.** `?amiga=` estava escrito na captura
  (`__root.tsx`), na prosa de `referral.functions.ts` e nas telas: trocar o nome
  em três lugares e esquecer o quarto quebraria a indicação inteira sem erro
  nenhum — todo mundo continuaria funcionando e nenhuma amiga seria atribuída.
- ⚠️ **Sem código, o convite NÃO SAI.** `linkDeIndicacao` devolve `null` e o
  botão pede que ela tente de novo. Um convite sem indicação é indistinguível de
  um bom para quem manda e para quem recebe; só o vínculo não acontece. E ela
  só tem a atenção da amiga uma vez.
- **O link aponta para a RAIZ, não para `/auth`.** O código é capturado em
  qualquer página, e a raiz é a que apresenta o app a quem nunca ouviu falar
  dele — mandar direto para o login pede que ela crie conta num produto que
  ainda não viu.
- **Vai o TEXTO para a área de transferência, não a URL crua.** Colado no
  WhatsApp, um "https://..." sozinho não diz de quem veio nem o que é, e é aí
  que a amiga decide se abre.
- **Bancada:** `/preview-amigas?n=2&premium=1` e `?semcodigo=1` (o único jeito
  de fotografar o estado sem código).

#### A caixa de entrada guarda sete dias, e o tutorial mora fora dela

- **Lida some em 7 dias; NÃO lida nunca some.** Pedido do dono: "sempre ficará
  guardado ali durante pelo menos 7 dias, depois elas somem (as que já foram
  lidas)". O formato virou `id → INSTANTE` (`Map`), porque sem o instante não há
  como saber quando os sete dias começam.
- ⚠️ **A janela do STORAGE (meio ano) é muito maior que a de EXIBIÇÃO (7 dias)**,
  e isso fecha um laço: quem esconde a lida é o carimbo — apagado o carimbo, a
  notificação VOLTA, não lida, com ponto vermelho. Como as derivadas renascem do
  estado da conta, ela voltaria para sempre.
- ⚠️ **A conversão do formato antigo (lista de ids) GRAVA na hora.** Sem gravar,
  `lerLidas` reconvertia a cada abertura com o instante daquele momento e o
  relógio dos sete dias reiniciava para sempre.
- **Abrir a caixa não é ler tudo**: quem marca é o toque em CADA item. Abrir e
  ver cinco recados sem tempo de ler perdia o rastro dos cinco de uma vez.
- ⚠️ **O texto da caixa vazia NÃO promete recado do médico.** Ele prometia, e não
  era verdade: as enviadas ainda não existem, e recado de médico chega pela
  conversa e por push. A paciente passaria a vir olhar uma caixa vazia esperando
  o obstetra dela — e o silêncio de um obstetra de alto risco não é detalhe de
  interface.
- **O tutorial guarda o PASSO fora do componente** (`passoDoTutorial` em
  `minha-conta`, e no `localStorage`): a barra continua clicável durante a aula,
  então tocar em "Jogo" desmonta a home e, com o índice em estado local, voltar
  recomeçava do primeiro cartão. Foi o defeito que o dono viu.
- ⚠️ **E ele só abre onde a barra existe** (`ehCelular`, `matchMedia` no mesmo
  corte do `md:hidden`). `mobileHome` é ESTADO; quem esconde a home e a barra num
  monitor é CSS. No computador ele abria sobre uma tela sem barra, apontando
  para ícones invisíveis, e no fim gravava "já viu" — quem entrou pelo
  computador perdia o tutorial do celular para sempre.

### As três animações de conquista, e um troféu que sumia (ago/2026)

Check verde (atividade feita) · estrela (uma por atividade) · cinco estrelas (o
dia fechado). Folha de sprites pelo mesmo motivo da chama: **WebM com alfa não
tem transparência no Safari**. As três em grade 6×4, para o par de keyframes ser
um só (`.dc-sprite`).

- **O gatilho é a TRANSIÇÃO**, nunca o estado: com o estado, a folha do dia
  explodiria confete em cinco linhas toda vez que ela abrisse a tela. `useRef`
  fotografa o que já estava feito na montagem.
- ⚠️ **`steps(n, jump-none)` em animação de UMA passada.** A fórmula do `to`
  esticado (100%·n/(n−1)) vale para LAÇO; com `forwards`, o valor segurado no
  fim é o `to` literal, que está FORA da folha. Medido: o troféu terminava em
  `111.111% 120%` sobre `background-size: 1000% 600%` e ficava **invisível** no
  último meio segundo — o quadro que a tela existe para mostrar. O teste dele
  travava a fórmula errada; agora cobra que o percurso termine dentro da folha.
- `scripts/sprite-de-video.mjs` ganhou janela de amostragem: o check tinha 3 s
  de vídeo com a ação no primeiro 1,25 s, e 20 quadros repetidos é peso sem
  imagem.

### O bebê bolha ficou maior e mais atento (ago/2026)

- **88px, o dobro** — deixou de ser ícone e virou personagem. Medido: não
  encosta no menu nem no nome do bebê, nem no iPhone SE.
- **As cinco expressões entraram em uso.** A régua continua sendo
  `humorDaJornada` (o portão de Modo Cuidado mora nela): dormindo depois das
  22h sem recado, surpresa de madrugada, orgulhosa quando há recado.
- **As frases conversam com o CLIMA**, do mesmo `useWeather` do cartão de
  saudação — e o limiar de chuva é o MESMO (`code >= 51`). Duas réguas para
  "está chovendo" na mesma tela é como o app começa a se contradizer.
- Sem clima conhecido, **nenhuma frase fala do tempo**: melhor calar que falar
  de uma chuva que não está caindo. Há teste.

### O bebê bolha ganhou voz, tutorial e caixa de entrada (ago/2026)

Pedido do dono, em três partes: tutorial no primeiro acesso pelos cinco itens
da barra; TODA notificação passando pelo personagem, com número em cima e
leitura por toque; e frases de conforto quando não há recado.

**Os textos ficam em `lib/`, nunca no JSX** — `tutorial-do-mascote.ts` (sete
cartões) e `frases-do-mascote.ts` (22 frases). São o que o dono reescreve; um
texto enterrado em componente é um texto que ele não edita.

- **O holofote sai do `z-index`, e não de máscara.** O véu para em `z-38` e a
  barra vive em `z-40`: a tela apaga, a barra segue acesa e o item pulsa
  (`dc-nav-destaque`). Um `clip-path` com furo precisaria ser recalculado toda
  vez que a barra encolhe ao rolar — e tutorial que aponta para o lugar errado
  é pior que nenhum.
- **A barra continua clicável durante a aula.** Tocar num ícone leva até lá:
  prender a paciente em sete telas para poder usar o app que ela acabou de
  instalar é a definição de tutorial ruim.
- ⚠️ **E por isso o PASSO não mora no tutorial.** Tocar num item troca a aba,
  tira a home do ar e DESMONTA o componente — com o índice em `useState` lá
  dentro, voltar para o Bebê recomeçava do primeiro cartão (o dono viu). O
  índice vive em `minha-conta` e é gravado em `chaveDoPassoDoTutorial`: o
  estado da página resolve a ida e volta, o storage resolve fechar o app no
  meio. Mesmo defeito do `sub` local do `RegistrosHub`, mesma solução.
- **Durante o tutorial o mascote do canto fica CALADO** (`mascoteCalado`). Sem
  isso ele falava a frase do dia por trás do véu: dois balões do mesmo
  personagem na mesma tela, dizendo coisas diferentes. O emblema fica — ele é
  informação, não fala.
- **O tutorial espera o ritual de boas-vindas.** Duas telas cheias no primeiro
  minuto seriam dois tutoriais. Quem ainda vai ver o ritual encontra o tutorial
  na abertura seguinte, com o app já personalizado.
- **Nunca em Modo Cuidado**: quem perdeu a gestação não abre o app para um
  passeio guiado pelas funcionalidades.
- **Abrir a caixa deixou de ser ler tudo.** Quem abria e via cinco recados sem
  tempo de ler perdia o rastro dos cinco, e o emblema zerava sem nada ter sido
  lido. Agora quem marca é o toque em CADA item — e a marcação acontece ANTES
  de executar a ação, porque a ação pode fechar a folha e desmontar tudo.
- **Lida some depois de 7 dias; NÃO lida nunca some.** `lidas` virou
  `Map<id, instante>` (`Map.has()` é a mesma chamada do `Set`, então a folha
  não mudou uma linha). O formato antigo — array de ids — é convertido com o
  instante de AGORA: com zero, tudo que ela já leu sumiria no primeiro
  carregamento da versão nova.
- **O emblema conta sobre a lista JÁ PODADA** (`visiveis`), senão uma
  notificação invisível continuaria puxando o número e ela abriria a caixa
  procurando um recado que não está lá.
- **Uma frase por DIA, não por abertura.** A home remonta a cada toque em
  "Bebê"; um balão novo a cada toque viraria letreiro.
- ⚠️ **A rotação é `dia % n`, e a versão "esperta" quebrou.** A primeira andava
  de 7 em 7, e o próprio comentário avisava que 7 só serve quando `n` não é
  múltiplo de 7 — a lista da MANHÃ tem exatamente 14 frases, e a paciente via
  duas, alternadas, para sempre. O teste pegou; o comentário tinha previsto.
- **As frases nunca cobram e nunca prometem clínica** — há teste com regex
  proibindo "você não fez", "está tudo bem", "vai passar". É a mesma razão pela
  qual a carinha `preocupada` saiu da personagem.
- **`PublicBottomNav` some nas bancadas** (`/preview-*`): ela cobria a navbar na
  bancada do tutorial. O mesmo defeito continua em `/auth`, onde o app
  instalado abre com um botão "Entrar no app" por cima do login.
- **Bancadas:** `/preview-tutorial?nome=Ana` (e `?escura=1`) ·
  `/preview-home?w=20&notif=3`.

### A aba Saúde da paciente ficou clínica (ago/2026)

A aba se chamava Saúde e as duas ferramentas de automonitoramento com mais peso
clínico da gestação estavam **fora** dela: contar movimentos e cronometrar
contrações moravam em Registros, no grupo Gestação. Isso não era arrumação: a
triagem de sintomas mora na Saúde e cita as duas **pelo nome** — "redução dos
movimentos do bebê" e "contrações regulares antes de 37 semanas" são dois dos
nove sintomas VERMELHOS de `triage.ts`. Quem sentia o bebê parado abria Saúde,
encontrava a pergunta, e não tinha como contar dali.

- **Chutes e Contrações entraram como ATALHOS**, não cópias: os ladrilhos
  abrem `Registros` já na sub-tela certa (`destino` + `subDestino` em
  `HUB_SAUDE`, e `RegistrosHub` ganhou `initialSub` como Consultas e Bebê já
  tinham). Duas implementações de contagem de chutes divergiriam no primeiro
  conserto. Testado em `hub-da-saude.test.ts`, que lê `RED_SYMPTOMS` de
  verdade — o teste cobra o VÍNCULO, não a existência do quadrado.
- ⚠️ **A seta de voltar precisou de estado novo** (`voltarAoHub`). O hub abre
  uma aba de outra seção, então `tabToSection("Registros")` não é "saude" e
  `origem` fica vazia — a seta caía na última regra e despejava a paciente na
  tela do bebê. É o mesmo defeito que a regra 2 do `voltarDaBarra` conserta,
  chegando por um caminho novo.
- **"Saúde da mulher" sai da grade durante a gestação** (`mostrarSaudeDaMulher`:
  aparece sem gestação ou a partir da 36ª semana, a régua do Portal Pós-parto).
  Ciclo menstrual não tem o que mostrar por nove meses, e Papanicolau,
  mamografia e perfil lipídico em geral não se faz grávida — dois dos cinco
  quadrados eram para uma mulher que não está grávida, ocupando 40% da tela
  mais clínica do app. **Não tira o acesso**: a aba continua no grupo "Saúde"
  do menu (`SECOES`). A diferença entre "não está aqui agora" e "não existe
  mais" é o que separa arrumar de apagar.
- **O bloco de wearable saiu inteiro** — quatro cartões (SpO₂ · FC · Passos ·
  Sono), os quatro campos e o guia que ensinava a abrir o Apple Health e
  DIGITAR cada número aqui. Nenhum muda conduta obstétrica: era trabalho diário
  da paciente para um dado que nenhuma decisão consulta, e o próprio guia
  admitia que "a integração automática requer aplicativo nativo". Não confundir
  com pressão e glicemia, que ficam — a diferença não é o esforço, é quem lê o
  resultado. As colunas seguem em `health_logs` e o que já foi registrado
  continua à mostra: parar de pedir é uma decisão, apagar o que ela mandou
  seria outra.
- **A lista de registros recolheu, e virou "✏️ Ver e corrigir meus registros".**
  Ela era a terceira cópia dos mesmos números na mesma tela, mas apagá-la
  tiraria uma CAPACIDADE: é o único lugar com o × que apaga um registro. Quem
  digitou 1200 em vez de 120 precisa dele, e o painel do médico pinta a
  gravidade desses números — valor errado que não se pode apagar vira alarme
  falso no consultório.
- **Quatro ladrilhos, e não seis** — pedido do dono na mesma noite: "nessa tela
  eu não quero que tenha as funções de alertas, e nem de bem-estar; tudo que é
  do bem-estar está dentro da aba do jogo". Ele está certo sobre o Jogo: o
  Caminho tem os quatro momentos do dia (`MovementBlock`, `MeditationBlock`,
  `BondingBlock`, `GratitudeBlock`), então Meditar e Mexer já vivem lá, com
  implementação própria. E os nove sintomas VERMELHOS continuam no SOS, que é o
  primeiro botão da barra (`emergency-sheet`, sob "Procure atendimento agora se
  sentir"). **A grade perdeu um atalho, não o conteúdo.**
- **A ordem da grade é clínica**: Saúde · Chutes · Contrações · Nutrição (e
  Saúde da mulher quando ela aparece). Primeiro "estou bem?" (números), depois
  "e o bebê?" (chutes, contrações), e por fim o que se come.
- **Bancada:** `/preview-saude?w=20` (grávida, quatro quadrados) · `?w=38` e sem
  parâmetro (cinco, com Saúde da mulher).
  ⚠️ `validateSearch` usa `q.w == null` e **não** `=== undefined`: o router
  serializa e revalida, então na segunda passada chega `null` — e `Number(null)`
  é **0**. Com o `===`, abrir sem parâmetro terminava em `?w=0` e a grade
  escondia Saúde da mulher como se fosse uma gestante de zero semanas. Mesma
  armadilha que `preview-jogo` documenta para `?tela=`.

### A aba Pacientes mais tecnológica, e a pré-consulta mudou de casa (ago/2026)

- **O quadro da paciente (`PatientMirrorCard`) ganhou rodapé.** Nome branco
  sobre o céu do bebê era bonito e ilegível em metade dos horários, e era a
  ÚNICA informação nítida do quadro. Agora nome da mãe e nome do bebê vivem
  fora da imagem, em texto normal do cartão — legíveis em qualquer hora do
  dia — e o selo de idade gestacional mostra semana **e dia** (`22s3d`), não
  só semana.
- **A pré-consulta saiu da lista solta na aba Pacientes** — pedido do dono:
  "não tem que estar escrito ali". Ela não sumiu: virou um selo "Pré-consulta
  nova" no quadro da paciente e o relatório completo (`PreConsultaCard`,
  reaproveitando o `ficha` que `PatientDetailModal` já carrega — mesma
  chamada que a seção antiga fazia por trás, sem pedir de novo) dentro da
  própria ficha dela, na aba **Agora**. `ContagensDaPaciente` ganhou
  `preConsultaNova` para o contador da aba somar 1 sem depender da seção
  antiga existir — é a mesma regra de "o contador sobe para a aba" aplicada
  de novo, e o teste (`abas-da-paciente.test.ts`) cobra que o valor venha de
  `preConsulta.seen_by_doctor`, não de `false` fixo.
- **A ficha da paciente é quase a tela inteira.** Era um modal de `max-w-3xl`
  centralizado; agora ocupa o viewport quase por completo
  (`h-[100dvh]`/`h-[95svh]` conforme o tamanho de tela) — pedido do dono: "eu
  quero uma tela que ocupe basicamente a tela inteira do computador".
- **"Pedir consulta" ganhou um atalho para o Calendário**, não um jeito novo
  de marcar. Quem escolhe o horário continua sendo SÓ a paciente, no
  Agendamento dela — o botão "🗓️ Ver na Agenda" só fecha a ficha e troca de
  aba, para o médico acompanhar onde o pedido dela vai aparecer quando ela
  responder.
- **A mesada de Sementinhas (`MesadaDoMedico`) mudou de "Meu Perfil" para
  Pacientes** — presentear é uma ação sobre uma paciente, e é ali que ele já
  está olhando a lista delas.

### Cancelar consulta, direto no dia da agenda (ago/2026)

O ✕ mora ao lado de cada compromisso — na faixa de leitura do
`CalendarioDoMes` e na tela grande do dia (`DiaDaAgenda`) — e abre uma
**mensagem** de confirmação ("Cancelar esta consulta com Fulana?" · Sim/Não),
não o mesmo botão virando "tem certeza?": pedido do dono foi por uma
confirmação separada, explicitamente.

- **As três fontes cancelam em três lugares diferentes**, e o prefixo do id
  (`ped:`/`tele:`/`part:`, o mesmo que já distinguia `aoEnviarLink`) decide
  qual: `updateAppointmentStatus` (`appointment_requests`, já existia),
  `updateTeleconsultaStatus` (`teleconsulta_sessions`, ganhou o status
  `cancelada`) e `confirmPaymentForDoctor` (`private_consultations`, já
  aceitava `cancelado`). Nenhuma função nova — só a teleconsulta precisou de
  um status a mais, porque era a única das três sem "cancelada" no enum E no
  CHECK do banco.
- **`podeCancelar`** (`agenda-unificada.ts`, pura, testada) recusa o X em
  situações que já são fim de linha (Cancelada, Recusada, Realizada,
  Encerrada) — um X numa consulta já cancelada seria um botão que promete
  uma ação e não faz nada.
- **`daTeleconsulta`/`daParticular` aprenderam a mostrar "Cancelada"**: sem
  isso, uma teleconsulta cancelada continuava caindo no `else` e aparecendo
  como "Agendada" — a mesma consulta que ele acabou de cancelar, com cara de
  ainda ia acontecer.
- **Aplicar no Supabase:** `supabase/APLICAR_CANCELAR_CONSULTA.sql` (só a
  teleconsulta precisa — as outras duas tabelas já aceitavam o valor).

### O envio de exame (arquivo) saiu do produto (ago/2026)

Pedido do dono: "essa opção de enviar exames em todo o site já não deve
existir mais, pois não vamos ter essa responsabilidade em guardar os
exames". Removida a CAPACIDADE DE ENVIAR — patient e médico — em todo ponto
de entrada:

- **Removidos por inteiro:** `src/lib/exame-do-chat.functions.ts` (upload
  pelo chat), `src/components/exames-recebidos.tsx` (aba "Exames que elas
  enviaram" do painel), a aba "Exames" inteira de `minha-conta.tsx`
  (`ExamesTab`, upload + galeria + preview) e o menu de anexo do chat da
  paciente (o botão "+" só existia para isto — sem outro item, o menu
  inteiro saiu, junto com `handleImage`/`enviarParaOMedico`). `src/lib/abrir-pdf.ts`
  saiu junto — só o preview do laudo em PDF o chamava.
- **`clinical.functions.ts` perdeu só o visualizador dedicado**
  (`examesRecebidos`/`imagemDoExame`/`devolutivaDoExame`) — `EspecieEvento`
  continua com `"exame"`, e `clinical_events` continua unindo `exam_files`:
  os laudos enviados ANTES desta mudança continuam aparecendo na linha do
  tempo genérica da paciente (`prontuarioDaPaciente`) e no resumo "o que
  mudou desde a última consulta", só sem o visor de imagem próprio.
- **A tabela `exam_files`, o balde `exames` e a limpeza de conta
  NÃO SAÍRAM.** Dado já enviado é dado de paciente — apagá-lo é uma decisão
  diferente da de parar de aceitar mais, e mais irreversível. `conta.functions.ts`
  continua varrendo o balde de exames na exclusão de conta (LGPD); é
  justamente esse dado histórico que a varredura protege. Se um dia a
  decisão for apagar o que já existe, é outra migration, deliberada.
- **O WhatsApp do consultório** parou de apontar para "envie pelo app em
  Exames" quando a paciente manda foto/PDF por lá — apontaria para um
  caminho que não existe mais. Agora pede que ela leve o exame na consulta
  ou descreva por texto.
- **Não confundir com "Pedir exame"** (`AcoesDaPaciente`, `TipoDeEmissao`):
  o médico PEDINDO um exame por mensagem de texto é outra função — sempre
  foi um modelo de texto, nunca guardou arquivo, e continua existindo.

### O presente do médico agora CHEGA na paciente (ago/2026)

O médico presenteava Sementinhas (`MesadaDoMedico`), o servidor gravava a linha
em `sementinhas_ledger`, a mesada dele descia e o botão dizia "Enviado ✓". Do
lado dela: **nada**. O saldo subia sozinho e nenhuma tela dizia de onde veio.

Do lado de quem dá o recurso parecia inteiro; do lado de quem recebe, saldo que
sobe sozinho é indistinguível de bug. O desenho da mesada inteira (ele dá, **ela
vê que foi ele**, ela volta) morria no silêncio. A economia tinha 1.300 testes;
a ENTREGA não tinha nenhum — a mesma armadilha de `bonus-e-mesada.test.ts`.

- **`walletPayload` devolve `presente`** (`sementinhas.functions.ts`): a linha
  mais recente de presente nos últimos 30 dias, já com o nome de quem deu.
  Reaproveita o `claimDailyAndGetWallet` que o Caminho já chamava — sem viagem
  nova ao servidor.
- **O portão do Modo Cuidado mora DENTRO de `presenteRecente`**, não em cada
  tela. `presentearPaciente` já recusa enviar no luto, mas o modo pode ser
  ligado DEPOIS de um presente legítimo, e confete para quem acabou de perder a
  gestação é o que o Modo Cuidado existe para impedir.
- **Lê as DUAS razões** (`RAZAO_PRESENTE_MEDICO` e `RAZAO_PRESENTE_AMIGA`): a
  assinante presenteia as amigas pelo mesmo ledger.
- **`AvisoDePresente`** (`gestacao-path.tsx`): bolha comemorando, o NOME de quem
  deu como título e o número embaixo. Nessa ordem — "100 Sementinhas" com o
  remetente em letrinha viraria extrato bancário, e o nome é o ponto inteiro.
  O "já vi" é gravado com prefixo `dc-path-`, então viaja no `journey_state` e
  não reaparece no outro aparelho. A chave é o **instante** da linha, nunca o
  valor: dois presentes de 100 no mesmo mês são duas notícias.
- **Push junto** (`sendPushToUser`), depois do `if (!gravou)` — avisar de um
  presente que não gravou é pior que não avisar. Deep-link `?tab=Caminho`, com
  a caixa exata: `minha-conta` compara com os rótulos de `TABS` e ignora em
  silêncio o que não bate.
- **`nome-do-medico.ts`** nasceu de dois erros simétricos no mesmo dia:
  `Dr(a). ${display_name}` deu "Dr(a). Dr. Clóvis Bacha", e `split(" ")[0]` deu
  "**Dr.** te mandou um presente". `display_name` é campo livre e quase todo
  mundo escreve o título dentro. Régua única, e `aiNameFrom` passou a usá-la.
- **O painel não esquece mais quem já recebeu**: `EstadoDaMesada.presenteadas`
  sai dos `dedupe_key` que a mesada já lia. Era memória do componente — bastava
  recarregar para o botão de uma paciente presenteada voltar a dizer "Dar 30 🌱"
  e o servidor recusar. O formato da chave (`presente:<medico>:<paciente>:<mês>`)
  virou construtor + leitor em `economia-sementinhas.ts`, porque estava escrito
  em três lugares que precisavam concordar.
- **Bancada:** `/preview-jogo?presente=100&quem=Dr.%20Clóvis%20Bacha` desenha o
  aviso sem conta e sem ledger — ele só nasce de uma linha real, e foi por essa
  tela ser impossível de olhar que ela passou tanto tempo não existindo.

Sem migration: tudo sai de colunas que já existem.

### O presente perdeu o limite mensal, e a chave mudou de sentido (ago/2026)

Pedido do dono: "aqui eu posso mandar quantos presentes eu quiser pra cada
paciente, então tira essa limitação". O teto que sobrou é a **mesada** — o
mesmo número que paga a conta. Duas travas para o mesmo risco só serviam para
o médico bater na que ele não escolheu.

- **A `dedupe_key` trocou o CICLO pelo TOKEN DO CLIQUE**
  (`presente:<medico>:<paciente>:<token>`), e essa troca é o ponto todo.
  `grantSementinhas` grava com `ignoreDuplicates`, então a chave é a ÚNICA
  coisa entre um toque nervoso e dois presentes: **apagar o campo faria "sem
  limite" virar "sem defesa"**. O token nasce no navegador, um por clique —
  idempotência por INTENÇÃO, e não por calendário.
- **Achar a linha deixou de ser recusa.** Com o ciclo na chave, `jaExistia`
  queria dizer "ela já ganhou este mês"; com o token, quer dizer "este mesmo
  envio já foi processado" — sucesso, marcado com `repetido: true` para a tela
  não festejar duas vezes. Devolver erro aqui faria ele mandar DE NOVO, com
  token novo, e aí sim gastar a mesada duas vezes.
- **`tokenDePresente` limpa o que vem do cliente** (só `[a-zA-Z0-9-]`): o token
  entra numa chave separada por `:`, e um token forjado com dois-pontos
  deslocaria o parser e creditaria o presente à paciente errada. Vazio depois
  da limpeza vira `null` e o servidor sorteia — string vazia faria todos os
  presentes daquela paciente colidirem numa chave só, o limite de volta pela
  porta dos fundos.
- **`presenteadas: string[]` virou `recebido: Record<string, number>`.** Deixou
  de ser "quem está bloqueada" e virou informação ("já recebeu 90 🌱 este
  mês"), porque não há mais bloqueio. O teste cobra que o número **não**
  desabilite o botão — seria o limite de volta, agora só na tela, que é o pior
  lugar: o servidor aceitaria e a tela recusaria.
- **A mesada da PACIENTE (amigas) mantém o limite de uma por ciclo.** Bolso
  muito menor, e é o que impede uma assinante de despejar o mês numa conta só.
- **Busca por nome** (`src/lib/buscar-paciente.ts`, puro e testado) em vez da
  lista inteira: sem acento, sem caixa, e o nome do BEBÊ também acha ("a mãe da
  Helena"). Mora em `lib/` e não no componente porque `mesada-do-medico.tsx`
  importa `sonner`, que toca `document` ao carregar e derruba o `bun test`
  inteiro — o teste chegou a fazer isso.
- **"Modo Cuidado" virou link azul** com explicação em quatro perguntas (o que
  é · quem liga · o que fica pausado · por que o presente não chega). É
  vocabulário NOSSO, e decidia se a paciente recebia sem nunca se apresentar.
  A explicação diz também o que **não** para (SOS, conversa, registros,
  lembretes), senão o médico lê como paciente desassistida.

### A chama da sequência (ago/2026)

O contador de dias seguidos no topo da trilha ganhou fogo animado — aceso
enquanto a sequência vive, apagado em zero dias.

- **A arte veio em `.webm` com alfa de verdade** (medido: cantos alpha 0, 86%
  transparente), e mesmo assim virou **folha de sprites**. O motivo é o
  iPhone: **WebM com alfa não tem transparência no motor do Safari**, e o app é
  instalado na tela de início — a chama sairia dentro de um retângulo preto, só
  nos iPhones, que é a categoria de defeito que nenhuma máquina de
  desenvolvimento mostra. A folha não passa por codec nenhum, não esbarra em
  política de autoplay e não deixa um `<video>` decodificando num canto.
- 36 quadros, grade 6×6, 128 px por quadro, 83 KB. Animada por DUAS `steps(6)`
  (X varre as colunas, Y desce as linhas — daí a de X durar um sexto da de Y).
  O `to` vai a **120%**, não 100%: `steps(6)` amostra em `i/6`, então 120%
  entrega 0/20/40/60/80/100% — os seis quadros. Parando em 100%, o último
  sumiria e o primeiro apareceria duas vezes.
- **Apagada NÃO carrega a folha**: quem está em zero dias é justamente quem
  acabou de chegar. O desenho de apagado é um contorno, nunca fogo cinza —
  fogo sem cor lê como imagem que falhou.
- **`prefers-reduced-motion` PARA a chama, não a esconde**: apagá-la diria à
  paciente que ela perdeu a sequência.
- **`src/lib/sequencia.ts` unificou TRÊS cópias** do mesmo laço que viviam
  soltas em `gestacao-path.tsx` (gestação, pós-parto e meditação), nenhuma
  testada. A regra que elas repetiam é a que mais importa: **hoje ainda não
  fechado conta a partir de ONTEM** — sem isso, quem tem 40 dias abre o app às
  7h e vê zero. `sequenciaDeDatas` converte ISO → dias inteiros em UTC a partir
  de ano/mês/dia LOCAIS; ler a string crua com `new Date` a trataria como UTC e
  em São Paulo tudo antes das 21h viraria o dia anterior.
- **UM momento já conta o dia** (`diasComAlgumMomento`), e não os cinco. A
  primeira versão lia `doneDays` — o dono fez um exercício, a chama não acendeu,
  e ele estava certo: quem fez três de cinco ficava com o mesmo zero de quem
  não abriu o app. **`doneDays` NÃO mudou** — ele pinta o nó da trilha, solta a
  figurinha da semana e alimenta o total; dar isso por um exercício faria o
  placar de cinco pontinhos mentir. São duas perguntas ("fechou o dia?" e "ela
  veio hoje?") com duas fontes.
- A lista sai das chaves `dc-path-day-<D>` que já existem, e não de uma lista
  nova: assim é **retroativo** (o dia que ela fez antes do deploy conta na
  hora), e uma lista nova nasceria vazia zerando a sequência de todo mundo. Os
  prefixos saem de `LS.dayTasks(0)`/`LS.posDayTasks(0)`, nunca escritos à mão —
  uma cópia divergente faria a chama parar de acender sem erro nenhum.
- **Reproduzível:** `node scripts/sprite-de-video.mjs <video.webm> <destino.webp>
[quadros] [colunas] [larguraDoQuadro]`. Ele ABORTA se a origem não tiver alfa
  (em vez de gravar uma folha opaca) e se os quadros não fecharem a grade (celas
  vazias fariam o desenho sumir por uma fração de segundo a cada volta).
- **Bancada:** `/preview-jogo?streak=7` acende a chama sem conta — ela só arde
  com dias fechados de verdade, e é assim que uma animação entra no app sem
  ninguém nunca ter olhado para ela rodando.

### O troféu das cinco estrelas (ago/2026)

O troféu roxo do topo mostrava `stickers.length` — figurinhas de ÁLBUM DA
SEMANA. O dono olhou e disse a coisa certa: "tenho três conquistas e ele marca
oito, não tem significado nenhum". Agora ele conta **dias de cinco estrelas** e
destranca três itens da loja.

- **A fonte é o LEDGER, e isso é o ponto todo.** Não é `doneDays.length`: esse
  mora no `localStorage` e sobe no blob do `journey_state`, então quem o escreve
  é o navegador — e ele destrancaria item pago.
- **E é a PROVA, não o recibo.** A primeira versão contava as linhas
  `day_stars:<ciclo>:<dia>`. Parecia certo e não era: o dono fechou as cinco
  estrelas e o contador ficou em **zero**. `grantDayStarsBonus` é chamada UMA
  vez, no instante do fechamento, dentro de um `try/catch` que engole erros —
  rede oscilando, sessão expirada ou app fechado antes da resposta e a linha
  nunca é gravada, sem rastro e sem segunda tentativa. Agora a contagem lê as
  linhas `wellness:<atividade>:<ciclo>:<dia>`, uma por atividade, gravadas no
  momento em que cada uma é feita — e que `grantDayStarsBonus` já consultava
  para decidir o bônus. **Sempre foram a prova; `day_stars` era o recibo.**
  Conta dias com as quatro; é retroativo, sem migration; e a força anti-fraude
  é a mesma, porque quem escreve continua sendo só o servidor.
- **O agrupamento carrega o CICLO** (`<ciclo>:<dia>`): sem ele o dia 65 de duas
  gestações viraria um dia só, apagando um troféu de quem já teve outro bebê
  no app. E `ATIVIDADES_POR_TROFEU` sai da mesma lista que grava — já foram
  seis, depois cinco (a respiração virou tema da meditação).
- **O gate é conferido NA COMPRA** (`cantinho.functions.ts`), não só na vitrine
  — cadeado que só existe na tela é decoração. Falha ao contar **recusa**:
  liberar por não ter conseguido contar entrega o item e gasta a Sementinha
  dela do mesmo jeito. **Uma contagem só** serve vitrine e compra (`contarTrofeus`),
  porque dois números para a mesma palavra foi o defeito que abriu isto.
- **A escada** (`TROFEUS_PARA`): Borboleta (74 🌱) → 10, Fim de tarde no deserto
  (240 🌱) → 20, Bolinhas Coração (400 🌱) → 30. O troféu **não substitui o
  preço** — ele diz QUANDO a prateleira aparece. A vitrine mostra "faltam 4 🏆",
  nunca "bloqueado": a segunda frase não dá o que fazer a seguir e faz a
  paciente achar que o item é pago em dinheiro.
- **A comemoração dispara no bloco do dia fechado, e não numa comparação de
  números.** A primeira versão só abria se `novo > antes` — e como a contagem
  daquele momento devolvia 0, `0 > 0` era falso e a animação simplesmente não
  aparecia. Aquele bloco já É o instante da conquista e já roda uma vez por dia
  (`!doneDays.includes(D)`); qualquer condição a mais entre ele e a tela é uma
  chance a mais de a conquista passar em branco. Servidor fora do ar mostra
  `trofeus + 1` — número que se corrige no próximo carregamento é melhor que
  conquista engolida.
- **A comemoração roda UMA vez e para no último quadro** (`forwards`): sem isso
  o troféu some no instante em que a última estrela acende, que é o quadro que a
  tela inteira existe para mostrar. Fecha sozinha em 5,5 s, e **um toque em
  qualquer lugar pula** — a área é a tela toda, não o troféu, porque mirar num
  desenho de 60px que está crescendo é pedir para errar o alvo. `useRef` no
  fechamento: dois toques rápidos avançariam dois troféus com uma conquista só.
- **O ícone do topo NÃO roda em laço**, e aqui ele difere da chama de propósito:
  o **quadro 0 da folha está 100% vazio** (medido) — é uma animação que
  CONSTRÓI o troféu, não um ciclo. Em laço, um ícone de 22px sumiria e
  renasceria a cada 5 s, que lê como imagem quebrada. Fica no último quadro.
- **A fita inteira pousa na LINHA DE BASE** (`src/lib/alinhar-na-linha.ts`).
  `items-center` centra a CAIXA, e cada arte tem margem interna própria — a
  tinta termina a 78,1% da caixa na chama, 89,4% no calendário e 98,3% no
  troféu (medidos). Centradas, as bases caíam em 33,3 · 37,0 · 39,1 numa fita
  cuja base do texto está em 31,5: o troféu ficava pendurado 7,5px abaixo dos
  números, e o dono viu. `deslocamentoDaLinha` recebe altura e fração e devolve
  o `translateY` — px cravado quebraria no primeiro ícone que mudasse de
  tamanho. Depois: 31,67 · 31,67 · 32,00.
  ⚠️ **`baseDaTinta: 1` é sinal de estimativa, não de medição.** Nenhuma das
  quatro artes da fita encosta na borda do quadro — chama acesa 0,7813, chama
  apagada 0,7879, amigas 0,9242, troféu 0,9833. Escrevi `1` duas vezes por
  suposição e as duas custaram uma volta: o ícone das Amigas nasceu 1,67px
  acima da linha (o dono viu) e o contorno da chama apagada, 5,5px. O teste
  `alinhar-na-linha.test.ts` agora recusa qualquer `1`.
  ⚠️ **Medir a tinta DENTRO da fita não funciona**: o `bg-background/95` dela é
  opaco e vira "tinta" em toda linha — foi assim que uma verificação minha
  "aprovou" três ícones desalinhados. Mede-se o ícone isolado sobre fundo
  transparente, ou por diferença de duas fotos **com a chama congelada**
  (`animation-play-state: paused`), senão ela anima entre os dois quadros e a
  diferença vira ruído.
- **O ícone tem caixa de 34px, não 24.** O desenho não preenche o quadro: no
  último quadro ele ocupa 108×89 de 150×120 (medido), 72% da largura. Com 24 o
  troféu saía com ~17px visíveis ao lado de uma chama de 26 — e o dono viu na
  hora. 34 × 0,72 ≈ 24px visíveis. Comparar caixas de arte com margens
  diferentes é comparar o que não se vê.
- **Nitidez:** a origem tem 150px de largura, então a comemoração desenha 200 e
  não 250 — em dsf 3 seriam 750 pixels reais de uma arte de 150. Ampliar o vídeo
  num upscaler NÃO serve: eles devolvem H.264, que não tem canal alfa. O ganho
  real está em exportar a animação em 512px; o conversor já aceita.
- **Bancada:** `/preview-jogo?trofeus=12` põe número no topo;
  `?trofeuNovo=12` abre os 5 segundos inteiros.

### As três animações de conquista (ago/2026)

Três `.webm` do dono: o **check** verde que completa a bolinha da atividade
recém-feita, a **estrela** que acende no placar a cada atividade, e as **cinco**
enfileiradas quando o dia fecha. Viraram folhas de sprite pela mesma razão da
chama e do troféu — **WebM com alfa não tem transparência no Safari**, e o app
é instalado na tela de início do iPhone.

- **As três moram DENTRO da folha do dia**, e não no nó da trilha. A folha é
  `fixed inset-0 z-[60]` com fundo opaco e não fecha sozinha ao ganhar: no nó, a
  estrela acendia atrás dela e se apagava em 2 s — a comemoração acontecia numa
  tela que a paciente não estava vendo. O cartão "⭐ Estrelas de hoje", no pé da
  folha, é literalmente o lugar que o dono descreveu.
- **Nascem de `handleEarn`**, o único ponto em que uma atividade ACABOU de ser
  feita — nunca de comparar contadores que chegam do servidor, que era o que
  fazia a bolinha "completar" de novo numa tarefa terminada de manhã.
- ⚠️ **`steps(n)` com `to: 100%·n/(n−1)` é para LAÇO, nunca para `forwards`.**
  Com `forwards` o valor retido é o `to` literal, que fica FORA da folha: os
  sprites simplesmente não apareciam. Uma tacada só precisa de
  `steps(n, jump-none)` com `to: 100%`. ⚠️ E o eixo X precisa de **contagem de
  iterações igual ao número de LINHAS** (`steps(6, jump-none) 4 forwards`), ou
  só a primeira linha toca — foram 9 dos 24 quadros. O mesmo defeito estava na
  animação do troféu, em produção (medido: `111.111% 120%` aos 5,6 s).
- ⚠️ **`onFim` é `setTimeout`, não `onAnimationEnd`**: são DUAS animações no
  mesmo elemento (X e Y), então o evento dispara duas vezes e a primeira chega
  com a animação em um quarto do caminho.
- **O check NÃO tem `onFim`**: o último quadro é o próprio check pousado, então
  ele vira o estado final. A estrela e as cinco voltam ao desenho estático.
- **Bancada:** `/preview-jogo?anim=check` · `?anim=estrela` · `?anim=cinco&feitos=5`.
  Elas só nascem no instante do ganho, então conferir o desenho exigia fazer a
  atividade numa conta de verdade e ainda acertar os dois segundos em que a
  animação existe. `?anim=` implica `tela=jogos`.

### A aba das Amigas (ago/2026)

Pedido do dono: o ícone de "adicionar amigos" substitui o calendário azul da
fita e abre uma aba social "como as amizades do Duolingo", com perfil em
formato de jogo. Três funções: **Cantinho visitável · presente entre amigas ·
dupla de sequência**.

- **O que separa isto do Duolingo é clínico, não estético.** Num app de idioma,
  comparar é ganhar um jogo; aqui é comparar cuidado com o próprio bebê. E
  existe o caso que nenhum app de idioma tem: **uma delas pode perder a
  gestação**. Daí as três regras que atravessam `amigas.ts` inteiro:
  **nada clínico no perfil** (sem semana, sem DPP, sem medida),
  **cooperativo e nunca competitivo** (não há placar), e
  **só quem já se conhece**.
- **O grafo é o da INDICAÇÃO, nos dois sentidos** (`referred_by`). Sem busca,
  sem pedido de estranho, sem aceitar/recusar amizade — para duas contas se
  enxergarem foi preciso que uma mandasse o convite para a outra FORA do app.
  Não é economia de trabalho: é o que torna a aba segura **sem moderação**, num
  lugar onde o risco é conselho médico de leiga e assédio ao mesmo tempo.
- **O vínculo é conferido ANTES de toda leitura** (`saoAmigas`). Sem isso,
  qualquer uuid no corpo do pedido devolveria o Cantinho e o perfil de qualquer
  paciente — o mesmo defeito que `contatoDaPaciente` teve no painel.
- **Modo Cuidado tira a pessoa da aba SEM anunciar.** Ela sai da lista **no
  servidor** (filtrar na tela deixaria o nome viajar pela rede), o perfil
  responde `indisponivel` e nunca o motivo, e a dupla some dos dois lados **sem
  apagar a linha** — quando ela voltar, a dupla volta com a chama que tinham.
  "Fulana saiu" contaria a perda dela para todo mundo.
- **A dupla conta pelo CALENDÁRIO, não pelo dia gestacional.** Às segundas, uma
  pode estar no dia 65 e a outra no 190: intersectar números de dia juntaria
  terças com sábados. A data sai do `created_at` da linha `wellness:`, que o
  servidor carimba. Herda o perdão da meia-noite — e aqui ele importa mais,
  porque sem ele cada uma acharia que a OUTRA deixou cair.
- **O par é ordenado** (`menor < maior`): (A,B) e (B,A) são a mesma linha, senão
  duas convidando uma à outra ao mesmo tempo criam duas duplas e cada tela lê a
  sua. **Uma dupla ATIVA por pessoa** (índice parcial) — duas seriam um placar
  de várias frentes. **Recusar APAGA** a linha: marcar "recusada" bloquearia o
  par para sempre pela chave única.
- **O blob da jornada dela NÃO vai inteiro para a tela**: ele carrega dias
  feitos, notas das aulas e progresso. Só a decoração sai, e **saneada**
  (`saneiaEnfeites`) — é blob escrito pelo navegador dela, e um `s: 900` viraria
  um enfeite cobrindo a tela de quem visita.
- **O "11º dia da jornada" que estava no calendário** não se perdeu: virou o
  "no app há X" do perfil, que conta a mesma história.
- **A fita mostra o NÚMERO de amigas, não a palavra** (`rotuloDeAmigas`), com
  teto em `99+`. O teto é de LARGURA: são quatro itens dividindo a tela de um
  celular, e um "137" empurraria a chama e o troféu de lugar. `tabular-nums` +
  largura mínima de dois dígitos mantêm a fita imóvel entre 1 e 99 (medido: a
  chama e o troféu ficam no mesmo x com 7 e com 12).
- **O contador tem consulta PRÓPRIA** (`contarAmigas`), e não a lista:
  `minhasAmigas` varre o ledger de todas as amigas para calcular chama e
  troféus de cada uma, e a fita abre em toda visita ao Caminho. Os dois contam
  o MESMO conjunto (as em Modo Cuidado fora dos dois) — um contador que diz 5 e
  uma lista que mostra 4 faria a paciente procurar a amiga que sumiu, e é o
  sumiço que não pode ser perguntado.
- **Aplicar no Supabase:** `supabase/APLICAR_DUPLAS.sql`. Só a dupla depende
  dele — `lerDupla` engole a falha e devolve `null`, então lista, perfil,
  Cantinho e presente funcionam antes de ele rodar.

#### ⚠️ A ARTE SE COLA; O DADO SE DESENHA (ago/2026)

O dono mandou quatro imagens — duas do app como estava, duas da referência que
ele desenhou — e a frase que abriu esta rodada: _"as duas abas estão
completamente diferentes e desconexas com o que eu te pedi. Uma tem cara que foi
feita aqui no Cloud Code, a outra tem cara que realmente é de profissional."_ E
a pergunta que resolveu: _"você só não consegue colar ela, já que é o mesmo
modelo de proporção, e depois só atribuir as funções?"_

**Consegue. E a causa da diferença era uma escolha minha, não uma limitação.**

Eu tinha RECONSTRUÍDO a arte em CSS: um `linear-gradient` de onze paradas no
lugar do fundo pintado, a bolha `feliz` que já existia no lugar da bolha de
olhos de coração, emoji 💗 no lugar dos corações desenhados. Gradiente não vira
pintura e emoji não vira ícone — a distância entre as duas telas não era layout,
era ARTE, e a arte estava no arquivo dele o tempo todo.

A regra que saiu disso, e que vale para toda tela nova a partir daqui:

| o que é                          | como entra                                  |
| -------------------------------- | ------------------------------------------- |
| **arte que nunca muda**          | UMA imagem, colada como o ilustrador compôs |
| **dado** (nome, preço, contador) | código, sempre                              |

- **Um recorte só, e não cinco.** A primeira extração tirou bolha, três corações
  e a bolhinha em arquivos separados para o CSS recompor. Funciona e responde à
  pergunta errada: nada ali é dado. Um recorte só preserva o que o ilustrador
  fez — as distâncias, as sobreposições, a sombra do balão sobre o coração.
- ⚠️ **A linha divisória é onde mora a verdade.** Preço pintado numa imagem vira
  mentira no dia em que ele mudar, e preço errado é o defeito mais caro que
  existe. Por isso o herói é colagem e a lista é código.
- ⚠️ **E o texto do herói vira `alt`, palavra por palavra**: o título e a frase
  do balão são pixels agora, e quem usa leitor de tela não pode perder as duas
  frases que explicam a aba inteira.
- **A colagem falha para vidro.** Recortar a bolha à parte não deu: ela é de
  VIDRO — o interior dela É o fundo, visto através. A inundação por semelhança
  de cor atravessa o contorno e come o miolo, e não há tolerância que separe
  "céu" de "céu visto através de uma bolha". Com o herói inteiro virando
  colagem, o problema desaparece.
- **`scripts/amigas-do-drive.mjs`** extrai o herói (`src/assets/amigas/heroi.webp`,
  87 KB, PSNR 42,0 dB) e imprime o gradiente do chão, AMOSTRADO linha a linha na
  coluna x=840 (a mais limpa da imagem) — não estimado.

**Os dois dados que faltavam, e que eu tinha trocado por genérico em silêncio.**
A referência mostra foto e status em cada linha; a primeira versão pôs a mesma
bolha para todas e nenhum status. O defeito que o dono viu — "uma lista em que
todo mundo é igual" — não era desenho: eram dois dados.

- ⚠️ **A FOTO JÁ EXISTIA, e eu quase construí uma segunda.** Escrevi um
  `APLICAR_` inteiro com balde `avatares` e RLS por pasta antes de conferir:
  `patient_profiles.avatar_url` está na PRIMEIRA migration do projeto, e o app
  já a preenche em dois lugares (o campo de foto do Perfil e o ritual de
  boas-vindas), como **data URL** (JPEG 256px reduzido no canvas). Um balde que
  nada escreve é infraestrutura morta com política de segurança para manter. O
  que faltava não era guardar a foto — era a aba LER a coluna.
- **Sem foto, a INICIAL num círculo colorido** (`inicialDoNome`, `corDoAvatar` —
  por id e não por nome, senão duas Marias saem idênticas lado a lado). **Nunca
  a Bolha**: ela é a personagem do app, a mesma para todas, e usá-la como avatar
  é o defeito original com outro desenho.
- ⚠️ **A tela NUNCA escreve "Online"** (`ultimaVez`, e há teste). Presença ao
  vivo exige conexão persistente, que o app não tem. Um ponto verde que na
  verdade diz "abriu nos últimos 5 minutos" parece exato e não é — e numa aba
  onde uma amiga espera a outra, "ela está online e não me respondeu" é uma
  conclusão que o app não pode induzir. `NULL` também não vira "Offline": a
  linha some e entra o "no app há X", que sempre existiu.
- **`carimbarQueApareceu` é chamada na ABERTURA do app** (`minha-conta.tsx`,
  solta, com `catch` vazio, no máximo uma gravação por hora). Sem essa linha o
  `last_seen_at` ficaria NULL para sempre e a faixa de status inteira seria
  código morto na produção — a mesma família do presente do médico que chegava
  sem aviso.

**Três medidas que decidiram o layout, e nenhuma delas era gosto:**

- **`gap-1.5` na linha da amiga, e nome em 15px.** Medido em 393px: com `gap-2`
  e 16px a coluna do nome dava 117,5px e "Marina Costa" pedia 119 — truncava por
  DOIS pixels, e só na linha que tem o 🎁. E 15px não é concessão: na referência
  de 852px o nome mede ~30px de caixa, que numa tela de 393 dá ~14px.
- ⚠️ **O "Sair da amizade" saiu da linha e foi para a TELA DA AMIGA.** Ele era um
  ⋯ de 44px no fim da linha, e a conta não fechava. Mudou para onde já
  pertencia: sair de uma amizade é decisão sobre uma pessoa, não item de lista —
  a mesma lição do receituário, que saiu de aba própria e passou a abrir dentro
  do cartão da paciente já escolhida. `FolhaDeSair` virou componente, porque
  agora há DOIS lugares que a abrem e duas cópias do JSX divergiriam no primeiro
  ajuste — e este texto é o que separa uma saída de uma briga.
- ⚠️ **E isso obrigou a bancada a alcançar a tela da amiga.** Ela pede perfil e
  Cantinho ao servidor, então sem sessão mostrava "não foi possível abrir este
  perfil": a bancada NUNCA tinha chegado lá. Passou despercebido enquanto a tela
  só mostrava dados; no dia em que um CONTROLE mudou para ela, mudou-se um botão
  para uma tela que ninguém consegue olhar sem duas contas reais e um convite
  aceito — exatamente o que as bancadas existem para impedir. Daí a prop
  `bancada` em `PerfilDaAmigaTela`, que continua fabricando só o DADO.
- **A dupla ficou VERTICAL** (dois rostos, "Você + Fulana", pílula), como na
  referência: na horizontal sobravam ~90px para o nome e saía "Você + M…". O
  círculo "Você" leva `relative z-10` — sem isso o avatar da amiga, que vem
  depois no DOM, cobria a ponta direita e a palavra saía cortada no "ê".
- ⚠️ **Singular no app, plural na referência.** A imagem mostra três cartões de
  dupla; o banco tem um índice parcial garantindo UMA dupla ativa por pessoa, e
  isso é deliberado (duas viram placar de várias frentes). Colar três cartões
  seria desenhar um estado que o banco recusa. **Fidelidade que contradiz o
  produto não é fidelidade.**

**Aplicar no Supabase:** `supabase/APLICAR_FOTO_E_ULTIMA_VEZ.sql` (só
`last_seen_at` importa; a coluna da foto é rede para banco antigo).

**Bancada:** `/preview-amigas?premium=1&foto=1&dupla=ativa&dias=41` (a tela
cheia) · `?foto=1` liga o avatar com FOTO, que sem ela só se via numa conta com
upload feito · `?n=0` o vazio que ensina · `?luto=1` o Modo Cuidado.

#### A ofensiva passou a pagar, e o presente mudou de casa (ago/2026)

Pedido do dono, em três partes: o layout do Drive; "vai ter a opção de dar
sementinhas pras amigas, dependendo do plano premium"; e "a gente vai ter a aba
que você consegue chamar as amigas pra uma ofensiva, e dentro dessa ofensiva, se
estiver completando, vocês ganham mais sementinhas juntas".

- ⚠️ **A dupla NÃO pagava nada.** Ela dava a chama compartilhada e mais nada —
  o incentivo existia no desenho e não existia na carteira. É a mesma armadilha
  de `bonus-e-mesada.test.ts`: a economia tinha teste, a ENTREGA não tinha
  nenhum. `cobrarBonusDaDupla` (`amigas.functions.ts`) paga `BONUS_DA_DUPLA`
  por dia em que **as duas** fecharam.
- **O valor mora em `economia-sementinhas.ts`**, com todo número da economia —
  é o que permite os testes de teto somarem as torneiras todas. E a TELA diz o
  número em voz alta lendo a MESMA constante: um bônus que ninguém sabe que
  existe não convida ninguém para nada, e um texto digitado à mão prometeria o
  que o servidor não dá. **10 🌱**, contra os 35 do ganho típico — mexe pouco na
  parede dos quinze dias, e ainda assim é quase um terço de um dia.
- ⚠️ **NÃO retroage.** Confere HOJE e ontem, nunca a sequência inteira (ontem
  entra pelo mesmo perdão da meia-noite da chama). Sem isso, ligar o recurso
  pagaria de uma vez todos os dias que a dupla já tinha somado — uma injeção de
  moeda que ninguém decidiu, na economia mais calibrada do app.
- ⚠️ **Cada sessão paga SÓ a si mesma.** A `dedupe_key` é do PAR
  (`dupla:<menor>:<maior>:<dia>`) e a conferência é por `user_id` + chave, então
  as duas têm direito ao mesmo dia sem uma tirar da outra — não é corrida.
  Creditar a amiga a partir da minha sessão poria Sementinhas na conta dela sem
  nenhuma tela dizendo de onde vieram, que é exatamente o defeito que o presente
  do médico teve por meses ("saldo que sobe sozinho é indistinguível de bug").
- ⚠️ **O PRESENTE SAIU DO CANTINHO.** Palavras do dono: "eu sei que tem outro
  lugar que você também consegue dar sementinhas, mas a gente tem que tirar de
  onde está esse outro lugar. Vai ser agora somente nas amizades."
  `presentear-amigas.tsx` foi **apagado**; o 🎁 é a linha da amiga. Duas portas
  para a mesma ação não era redundância inofensiva: a segunda vivia dentro da
  aba de COMPRAR enfeite para si, então a paciente encontrava a mecânica no
  lugar em que ela não está pensando em amiga nenhuma — e o `presenteadas` de
  uma tela não sabia do da outra, então dar por uma e voltar pela outra mostrava
  o botão de novo para o servidor recusar. `mesada-paciente.test.ts` varre o
  `src/` inteiro: `presentearAmiga` só pode aparecer em `amigas.tsx`.
- ⚠️ **`leading-tight` vai em CADA `<p>`, nunca no pai.** Medido: com a classe
  no pai, o parágrafo computava 26,25px (15 × 1,75) — há regra base de `p` no
  projeto, e **regra de ELEMENTO vence valor herdado**, por mais específica que
  seja a classe de quem herda.
- ⚠️ **👭 (um ponto de código), nunca 👩‍🤝‍👩 (sequência ZWJ).** Medido: o ZWJ
  desenha três bonecos e sai 3× mais largo que a bolinha de 32px, transbordando
  dos dois lados e comendo o `gap` — o título lia "👩‍🤝‍👩Suas amigas", colado.
- **Sem migration**: tudo sai de `sementinhas_ledger` e de colunas que já
  existem.
- **Bancada:** `/preview-amigas?n=4&dupla=ativa&dias=12&premium=1` ·
  `?n=0&dupla=sem` (o vazio que ensina) · `?dupla=convite-recebido` · `?luto=1`.
  A aba depende de coisas que não se fabricam numa conta de teste — uma amiga
  que entrou pelo convite DELA, uma dupla aceita dos dois lados e uma assinatura
  —, então conferir o layout exigia duas contas reais e um convite aceito.
  ⚠️ A bancada injeta o DADO nos mesmos `useState` da produção, nunca o desenho:
  é a lição do `?streak=41` da folha da chama, que cravava o NÚMERO e deixava o
  saldo vir de uma jornada vazia. E o guarda dos efeitos é um BOOLEANO
  (`ehBancada`), não o objeto — literal remontado a cada render faz os efeitos
  re-rodarem em toda pintura.

### A Central de Emergência segue o modelo do dono (ago/2026)

A primeira dobra do SOS (`emergency-sheet.tsx`) foi refeita a partir de uma
imagem de referência do Drive. **O que mudou não foi estilo: foi HIERARQUIA.**

Antes, a primeira coisa da tela eram dois botões lado a lado (192 e WhatsApp), e
o "pedir socorro" vinha depois como uma pílula fina. Agora o SOS é um círculo de
66% da largura e os outros números viram "Outras opções" abaixo dele.

A razão é o dedo em pânico: um alvo circular de ~250px acerta-se sem mirar, e é
o ÚNICO caminho da tela que avisa médico e contato de uma vez, com localização,
sem ela digitar nada. Os outros dois exigem que ela saiba o que dizer a um
estranho.

- **A ordem da tela**: título · círculo SOS · "avisa X e Y, **sem você precisar
  escrever nada**" · estado da localização · "Outras opções" · 192 e WhatsApp ·
  CVV. O 193 desceu para depois do CVV — não saiu do app, saiu da disputa pelo
  olho de quem está em pânico.
- **Telefone e pin são DESENHADOS, não emoji.** 📞 sai preto no iOS, e o modelo
  pede vermelho no cartão do 192 e verde no do WhatsApp. Mesma lição do
  calendário da fita: emoji tem cor própria em cada sistema.
- **Cores amostradas da referência**, não estimadas: vermelho do círculo
  `#fd1010→#e80709`, verde do WhatsApp `#2da348→#259941`.
- **O cartão do 192 é CLARO**, e não vermelho cheio: vermelho cheio ao lado do
  círculo do SOS faria dois "botões de emergência" disputando o olho.
- Nenhum estado se perdeu — `sending`/`sent`/`ninguem`, o recuo para 193 quando
  o médico não tem telefone, o aviso de perfil incompleto e o painel de "quem
  foi avisado" continuam iguais.
- **A tela de passagem SE RETIRA — e o WhatsApp continua abrindo sozinho.**
  No app instalado, `window.open` não abre aba: abre uma visão que toma a tela
  inteira, e sem barra de navegador não há botão de voltar. Navegar essa visão
  para `wa.me` a punha fora do nosso alcance, e ela ficava para sempre.
  ⚠️ **A correção NÃO é deixar de abrir.** Tentei isso primeiro e apaguei o
  recurso junto com o defeito — o dono foi claro: "estava funcionando
  perfeitamente, tinha que continuar abrindo e enviando; única coisa é que essa
  tela fica infinita".
  A entrega passou a usar o **esquema do aplicativo** (`esquemaWhatsApp`,
  `whatsapp://send`), que **não navega a página**: ela continua viva, percebe o
  WhatsApp assumir (`visibilitychange` → `document.hidden`) e se fecha. Ao
  voltar, a paciente encontra o app.
  O ouvinte é armado no CARREGAMENTO, não dentro de `__abrir`: entre abrir a
  tela e o servidor responder passam segundos, e sair do app nesse meio
  deixaria ela voltando para a tela verde.
- **Três redes, três falhas diferentes:** recuo para `wa.me` em 1,8 s (WhatsApp
  não instalado), botão "Voltar ao app" (a página web também não abriu), e cão
  de guarda de 12 s no pai (o envio nunca respondeu).
  ⚠️ **Nenhuma crase dentro do `<script>` injetado**: ele mora num template
  literal do TypeScript, e uma crase ali fecha a string. Custou uma volta, e há
  teste cobrando.
- **Bancada:** `/preview-sos` (e `?outro=1` para ver o cartão verde do WhatsApp,
  `?semtel=1` para o recuo, `?vazio=1` para o perfil incompleto).

### Ciclo menstrual + cérebro do paciente

- `buildCycleMoodBlock` em `src/routes/api/chat.ts` injeta no system prompt o
  ciclo (último período, ciclo médio, dia do ciclo, previsão, sintomas) + humor
  recente do diário (só o rótulo `mood`, nunca o conteúdo). É contexto de
  bem-estar (fonte confiável), NÃO conduta — o portão de cobertura do cérebro do
  médico continua mandando. LGPD: dado da própria paciente, na conversa dela.
- Ciclo visual estilo Apple Health: **feito** (anel de fases + calendário
  mensal na aba Ciclo Menstrual). Ver `CicloHero`/`CicloCalendario` em
  `minha-conta.tsx`.

## A tela principal do bebê — quatro céus e a composição nova (ago/2026)

Rebranding pedido pelo dono: "vai ficar muito mais simples". Dez artes em
`.webp` (700 KB, dez faixas de hora) e o ambiente animado por faixa saíram;
entraram **quatro cenas em SVG** (`src/components/ceu-do-dia.tsx`).

| Cena           | Quando (pelo sol)                      | `dark` |
| -------------- | -------------------------------------- | ------ |
| **Amanhecer**  | 50 min antes → 70 min depois do nascer | não    |
| **Dia**        | entre o nascer e o pôr                 | não    |
| **Pôr do sol** | 80 min antes → 30 min depois do pôr    | não    |
| **Anoitecer**  | o resto                                | sim    |

- **SVG e não imagem.** As cenas são malhas de gradiente com três elementos
  (astro, dunas, estrelas): ~2 KB cada em vez de ~70 KB, escalam sem borrar em
  qualquer densidade, e deixam a estrela cintilar (`.dc-estrela`) e o céu
  respirar (`.dc-sky-breathe`) sem um segundo arquivo.
- **A cena cobre a PRIMEIRA DOBRA, não o hero inteiro.** Com `inset-0` o
  `slice` ampliava tudo 1,155× para cobrir os 1104px do hero e a lua saía
  cortada pela borda direita — medido, não suposto. Daí `corDeBaixo`: a cor
  chapada que continua atrás da segunda dobra.
- **`dark` acompanha a ARTE, nunca o relógio** — é ele que decide texto claro
  ou escuro, o vidro dos cartões e a barra de status do iOS.
- **As estrelas têm posição DETERMINÍSTICA** (gerador congruente com semente).
  `Math.random()` daria mismatch de hidratação. E o brilho de cada uma vai em
  `fill-opacity`, porque `.dc-estrela` anima `opacity` e as duas se
  multiplicam — escritas na mesma propriedade, o CSS venceria o atributo e
  todas cintilariam igual.
- **O halo do astro tem quatro `stop`.** Dois caem linear e deixam uma borda
  de disco visível: o halo lê como círculo desenhado em vez de luz.

**A composição seguiu a referência aprovada:**

- Barra de topo: menu à esquerda, **nome do bebê no centro óptico da tela**,
  pílula do clima (ícone do céu + graus) à direita. O nome é posicionado em
  `absolute` com `-translate-x-1/2` e não no fluxo: o botão mede 40px e a
  pílula ~72px, então num `justify-between` ele nasceria fora do eixo — e
  andaria pela tela conforme a pílula do clima carregasse.
- **O cartão de vidro com as três medidas saiu.** Comprimento, peso e fruta
  continuam na aba do Bebê, que é onde ela vai quando quer o detalhe; aqui
  ficou o número da semana apoiado direto na cena.
- **A folga vertical é repartida por três espaçadores com pesos** (1.15 /
  0.72 / 0.85, e uma escala menor em `short:`), tirados das proporções da
  referência — bolha a ~39% da altura, número a ~68%. Antes o botão da bolha
  era `flex-1` e engolia toda a folga, empurrando o número para 90% da altura,
  a 21px da barra de baixo.
- **A barra de navegação inferior não mudou** — estava fora do escopo por
  pedido explícito.

**A barra de progresso MUDOU DE LUGAR (ago/2026)** — e não saiu. Ela mostra
Início · % concluído · Parto previsto, e hoje vive na **área clara**, logo
antes do cartão do médico.

⚠️ **Eu li "tirar da vista" como "apagar" e apaguei.** O dono corrigiu: "não
era tirar esse elemento, e sim posicionar mais embaixo para ficar fora da vista
da tela principal, antes dessa área do seu médico, porém já nessa outra parte
onde o fundo é mais claro". A primeira dobra é do bebê — a bolha e o número da
semana, nada mais; quem rola encontra o resto, e é aí que uma porcentagem cabe,
porque quem rolou escolheu olhar.

O cartão deixou de usar o `glass`: vidro precisa de céu atravessando, e sobre o
creme da página ele vira um retângulo cinza. Agora usa o mesmo material do
cartão do médico, que é o vizinho dele. Medido: a barra começa em 923px numa
tela de 852 (fora da dobra) e antes do médico, em 1012px.

**Os pesos dos espaçadores saíram de medição COM A ÁREA SEGURA injetada.** O
Chromium headless devolve 0 em `env(safe-area-inset-*)`, então a bancada media
uma tela sem a ilha dinâmica nem a barra de gestos — e é essa folga que empurra
a composição no aparelho de verdade. Com 59/34px (iPhone 15 Pro), as folgas
visíveis eram 100,5 / 75,8 / 111,6px; depois de mover 5,5px do último espaçador
para o primeiro (`1.20 / 0.72 / 0.80`), as de fora ficaram em 105,6 e 105,7. O
meio segue MENOR de propósito: elementos próximos lêem como um grupo, e três
folgas iguais fariam a bolha e o número parecerem dois assuntos soltos.

⚠️ **Os três espaçadores SAÍRAM em seguida** (ver a seção abaixo): eles
repartiam a folga entre bolha e número, e o número desceu para a área clara. A
medição fica registrada porque o método — injetar a área segura antes de medir —
continua valendo para tudo que se compõe nessa tela.

### A imagem do dia é o fundo, e a bolha é centrada nela (ago/2026)

Pedido do dono, com o arquivo do Drive na mão ("Referência Imagem Fundo Dia"):
"é literalmente colar lá no fundo… deixar a bolha do bebê centralizada nessa
imagem e maneirar o elemento dos 3 hambúrgueres… os outros elementos vão ficar
embaixo com o fundo rosa claro… **sem expandir a imagem**, ela já está no
tamanho exato que quero".

- **A arte é o fundo da PRIMEIRA TELA INTEIRA** (`.dc-hero-tela`), e o
  `object-cover` do `CeuDoDia` cobre o que falta. Medido: hero de 0 até o pé do
  viewport em 15 Pro, 16 Pro, 16 Pro Max, 13 mini e SE — fresta zero nos cinco.
- ⚠️ **`100svh` NÃO é "uma tela" em todo iOS.** Com `svh` a faixa creme voltou a
  aparecer no aparelho do dono, e a caixa começa em y=0 — então sobrar tela só é
  possível se o `svh` daquele iOS for menor que a tela visível, que é
  literalmente o que `svh` significa (viewport com TODAS as barras à mostra).
  `.dc-hero-tela` usa `lvh` com `svh` de reserva, nas duas declarações da mesma
  propriedade. **Não é `dvh`**: `dvh` muda enquanto se rola e faria a bolha
  pular de lugar. Sobrar céu é invisível; faltar céu é o defeito.
- **A EMENDA é a segunda defesa, e vale mesmo se a primeira falhar.** Logo
  abaixo do hero há uma faixa de 8rem que sai de `corDeBaixo` (o último pixel da
  arte, amostrado) e desmancha no `--background`. O que saltava aos olhos não
  era a faixa existir — era ela ser uma ARESTA entre a foto e o creme. Com a
  emenda, um aparelho que ainda feche o céu cedo mostra a cor do pé da cena
  continuando. O degradê termina em `var(--background)` explícito e não em
  `transparent`, que é preto-transparente e deixaria o meio acinzentado. O Céu
  Clássico fica de fora: ele não tem `corDeBaixo` amostrado, e inventar uma cor
  seria pintar a emenda errada.
- ⚠️ **"Colar sem expandir" e "preencher a tela" só são compatíveis num
  aparelho com EXATAMENTE a proporção da arte, e nenhum iPhone tem.** A caixa
  chegou a ser `aspect-[853/1844]` (a proporção do arquivo) para atender "ela já
  está no tamanho exato que quero"; o dono olhou no aparelho e devolveu o
  defeito: "embaixo ainda não está totalmente preenchido". A arte é 2,1618, um
  15 Pro é 2,168 e um 16 Pro é 2,174 — a caixa fechava alguns pixels antes do
  fim e o creme da página aparecia por baixo do céu. Com `100svh` o `cover`
  amplia **0,16% a 0,57%** nos iPhones reais (medido), que não é o "esticar"
  que o pedido barrava: aquilo era a arte puxada para um hero de altura
  arbitrária, com a lua saindo cortada.
- ⚠️ **`aspect-ratio` + `max-height` encolhe a LARGURA** se a largura for
  `auto`. No iPhone SE o hero nasceu com 308px em vez de 375 — a arte inteira
  deslocada para o meio da tela. Custou uma volta antes de a proporção sair de
  vez; não reintroduza `aspect-ratio` aqui.
- **Os quatro campos da cena foram MEDIDOS de novo** por
  `node scripts/ceu-do-drive.mjs <origem.png> <destino.webp> [largura]`, que
  converte e mede no mesmo passe. O dia virou a TERCEIRA cena a inverter o
  brilho entre as pontas: topo 0,118 (escuro) e base 0,524. Herdar o
  `topoEscuro: false` da arte antiga poria o nome do bebê em índigo sobre
  azul-cobalto — o defeito que fez estes serem dois booleanos e não um. Medido
  depois: o nome passa a 16,38:1 no dia novo.
- ⚠️ **A arte do dia tem 853 de largura**, e as outras três têm 1440. Ela não
  passou por upscale — o que salvou o anoitecer foi feito FORA (Higgsfield) e só
  depois reduzido aqui, e ampliar no script não inventa detalhe. Num iPhone Pro
  (densidade 3) o navegador estica a arte do dia em 1,38×.
- **`dc-sky-breathe` saiu do céu** (o CSS ficou, sem uso). O respiro era um zoom
  de 4% a 7,5% — recorte lento de uma imagem que o dono disse estar no tamanho
  exato. A vida da cena continua em `CeuEfeitos`, que anima o que está POR CIMA
  da arte.
- **Sobre a arte ficaram DUAS coisas**: a barra de topo (traço do menu + nome do
  bebê) e a bolha, centrada por uma camada `absolute inset-0` do hero.
  `inset-0` num filho de container com padding pega a caixa de preenchimento
  inteira, então o `px-5`/`pt` não desloca o centro — medido: o centro da bolha
  e o centro do hero batem em todos os aparelhos testados.
- **O botão do menu perdeu a pastilha de vidro** ("maneirar"). Ficou o traço,
  com o ALVO ainda de 40px: quem some é o desenho, não a área que o dedo acerta.
  A cor segue `topoEscuro` — branco sobre topo escuro, índigo sobre topo claro;
  branco fixo sumiria no amanhecer, que é a cena de topo mais claro.
- **Desceu para o fundo claro** o cartão de saudação do clima. Ele largou o
  `glass` pelo material do cartão, pela MESMA razão da barra de progresso —
  vidro precisa de céu atravessando, e sobre o creme vira retângulo cinza. Com
  ele saíram `glassLeve`, `glass`, `tracoDeVidro`, `cardText` e `cardMuted`,
  que existiam só para material sobre arte.
- **`scripts/contraste-hero.mjs` ganhou uma trava**: alvo fora do viewport
  REPROVA com o motivo escrito, em vez de o Playwright estourar num recorte
  vazio.

### O número voltou para o meio, entre a bolha e a barra (ago/2026)

Pedido do dono na volta seguinte: "coloque o número 20 semanas ali no meio
entre a bolha e a navbar". Ele tinha descido para o fundo claro por uma volta
só; voltou para cima da arte, e agora com lugar definido.

- **A bolha e o número são DUAS camadas, não uma coluna.** Tentei a coluna
  primeiro — dois `flex-1` em volta da bolha, com o `pb` da barra flutuante
  dentro do item de baixo — e a bolha saiu **65px acima do centro**, medido.
  ⚠️ **Num item flex, `flex-basis: 0%` mede a caixa de CONTEÚDO e o padding
  entra por fora**: os 130px reservados para a barra viraram 130px a mais no
  item de baixo. Padding não é neutro num item flexível.
- **A camada do número começa em `top-1/2`** e vai até `bottom-0`. Num bloco
  posicionado com topo E base presos, o padding não muda o tamanho de fora —
  só encolhe o miolo. Então `pt` de meia bolha + `pb` da barra recortam
  exatamente o vão, e `items-center` põe o número no meio dele. Medido no
  iPhone 15 Pro: bolha termina em 543,8 · número em 622,7 · barra em ~719,6.
- O `min(60vw,19.5rem,38svh)` do `pt` é o MESMO da caixa da bolha, e tem de
  continuar sendo: é meia bolha que ele reserva.
- O halo (`overArt`) e as cores de céu (`heroText`, `corDoCorpo`,
  `INDIGO_CORPO`) voltaram junto, e `contraste-hero.mjs` voltou a medir
  `numero` e `semanas`. No dia isso importa mais que antes: a faixa amarela do
  horizonte da arte nova passa bem atrás dos dígitos. Doze medições passam
  (o pior é 6,74:1 no amanhecer, contra 4,5 de mínimo).

### Os bebês são os cinco do Drive (ago/2026)

Pedido do dono: "tire todos os bebês e só coloque os que tem no drive, na
qualidade exata deles, não perca a qualidade".

Saíram DUAS séries: os cinco PNGs por estágio (`baby-embriao` e companhia) e os
39 `.webp` gerados semana a semana. Entraram cinco artes — 6, 10, 20, 30 e 40
semanas — em `src/assets/bebes/semana-NN.webp`.

- **Três das cinco chegaram SEM canal alfa**, com o XADREZ de transparência
  gravado como pixel (dois cinzas neutros, 254 e 241/243/246, em células
  grandes). É o que acontece quando o editor mostra transparência em xadrez e a
  exportação salva em RGB. No app viraria um retângulo quadriculado dentro da
  bolha — invisível no editor, só aparece sobre o céu.
- **O recorte não é limiar de brilho**, que comeria os reflexos claros da testa.
  São três testes juntos, em `scripts/bebes/do-drive.mjs`: **croma** (o xadrez é
  neutro, a pele nunca é), **brilho** (rampa de 250 a 220 no canal mais escuro,
  que dá borda suave e salva o cordão que se apaga em degradê por ~150px) e
  **conexão com a borda do quadro** (reflexo no meio da testa não alcança a
  borda, então fica opaco por construção). Depois a cor é
  DES-PREMULTIPLICADA — sem isso sobra auréola clara, que é o xadrez ainda
  misturado ao pixel.
- **"Não perca a qualidade" é medido, não afirmado.** O script não aceita
  largura de saída (nunca reduz) e imprime o PSNR contra a origem, reprovando
  abaixo de 42 dB. As cinco saíram entre **46,8 e 52,2 dB** — a mesma faixa com
  que os céus foram aprovados. Total: 548 KB, e só uma carrega por vez.
- **A semana escolhe a arte MAIS PRÓXIMA, com empate para a mais NOVA**
  (4–8 → 6 · 9–15 → 10 · 16–25 → 20 · 26–35 → 30 · 36–42 → 40). Empate para
  baixo não é detalhe: mostrar um bebê mais desenvolvido do que ele está
  antecipa marcos — cabelo, unhas, gordura — que ainda não existem.
  A régua mora em **`src/lib/arte-do-bebe.ts`** (pura, testada) e não no
  componente: `baby-illustration.tsx` abre com cinco `import` de `.webp` e um
  teste morreria na primeira linha — mesma razão de `frases-do-mascote.ts`.
- ⚠️ **A Jornada do Bebê pede a semana TÍPICA DO ESTÁGIO, nunca a semana real.**
  As cinco artes não têm as bordas dos cinco estágios: na 27ª (fim do "Feto") a
  arte mais próxima é a de 30, que é a do "Feto (reta final)" — a linha marcada
  "você está aqui" e a de baixo mostravam O MESMO desenho, numa tela cujo
  assunto inteiro é a mudança. Vale para 26–27 e para a 36.
  `semanaTipicaDoEstagio` devolve o meio da faixa, que cai na arte daquele
  estágio nos cinco casos; o teste cobra que as cinco linhas fiquem com cinco
  desenhos distintos. A semana real continua no cabeçalho e no tamanho/peso.
- **`tinta` é MEDIDA por arte** (58,6% · 64% · 81,3% · 71,1% · 91,4% do maior
  lado, α ≥ 128) e é ela que `escalaDoCorpo` divide. Sem isso a semana 36
  mostraria um bebê 56% maior que a 35 sem nada ter acontecido — o salto não
  seria crescimento, seria o enquadramento do arquivo mudando. **Trocar um
  arquivo obriga a medir de novo**; o script imprime o valor.
- **O que ainda muda toda semana é o TAMANHO**: `escalaDoCorpo` é contínuo na
  semana, então entre a 20 e a 21 o bebê cresce mesmo desenhado pela mesma
  arte. Cinco desenhos não viraram cinco tamanhos.
- `scripts/bebes/olhar.mjs` responde as três perguntas antes de qualquer
  conversão: tem alfa de verdade? o fundo é xadrez gravado? que fração da caixa
  a tinta ocupa?

**Bancada:** `/preview-home?w=20` renderiza a tela real sem login (`?clima=1`
liga o clima). Para medir composição, injete
`:root{--safe-area-inset-top:59px;--safe-area-inset-bottom:34px}` — sem isso
você mede uma tela que não existe em nenhum iPhone. O céu vem do relógio do navegador, então o Playwright o escolhe
com `page.clock.setFixedTime` — sempre com offset explícito (`-03:00`), senão
o fuso do contêiner (UTC) muda a cena.

**O Céu Clássico (`sky_theme = "v1"`) continua de pé.** É item pago da Loja
(150 🌱); as dez artes eram o tema padrão, este é a alternativa que alguém
comprou. Apagá-la seria tirar da paciente uma coisa que ela pagou.

⚠️ **E a moldura do iOS tem de seguir o tema dela.** No app instalado, o iOS não
pinta a página fora da área segura: pinta o fundo do DOCUMENTO. A home escrevia
ali a `corDeTopo` das cenas NOVAS mesmo no Clássico — duas paletas encostadas,
com a emenda passando exatamente atrás do relógio do sistema, num tema pago.
`corDeTopoClassica` (`weather-sky.tsx`) tira a cor do PRÓPRIO gradiente: uma
segunda tabela divergiria na primeira troca de paleta.

⚠️ **CELULAR DEITADO (`deitada:`, max-height 520px).** Em paisagem a bolha era
centrada na tela inteira enquanto a barra de baixo reserva 117px do pé, e o vão
para o número da semana ficava em ~5px: com `items-center` o número transbordava
para CIMA e pousava em cima do bebê (medido: 20px de sobreposição no 15 Pro
deitado, 12px no SE). O manifesto pede `portrait-primary`, mas **o iOS ignora
orientação de manifesto**. Deitada, a bolha se centra no espaço ACIMA da barra e
o `top` do número acompanha — **os dois descrevem o mesmo centro e mudam
juntos**. Em pé nada muda: a composição medida é a de todo dia. O corte de 520px
fica entre o menor iPhone em pé (SE, 667) e o maior deitado (Pro Max, 430) — e
`short` (849) não serve, porque pega os dois casos que já estavam certos.

## As conquistas ganharam raridade — e passaram a conhecer o app (ago/2026)

Pedido do dono: "verifique se as conquistas estão defasadas, acho que faltam
algumas; onde tem níveis de raridade — comum (cinza em volta), raro (azul) e
épico (dourado) — e cada conquista dá um pouco de semente: maior dificuldade,
mais sementes."

Estavam defasadas de um jeito específico: **eram 18, e nenhuma sabia da metade
do app**. Meditação com sequência, gratidão com marcos, cartas pro bebê,
exercício por queixa, dias de cinco estrelas, chama de dias seguidos, o
Cantinho — tudo isso entrou depois, e a aba de conquistas nunca soube. Dava
para meditar trinta dias seguidos sem que ela reparasse que você existia.

Hoje são **39** (`src/lib/conquistas.ts`).

### A raridade precisa de régua, ou vira gosto

⚠️ "Achei que essa é épica" não sobrevive à segunda pessoa que mexe no
arquivo, e o sintoma é a paciente ver duas conquistas de esforço parecido com
molduras diferentes — e concluir, com razão, que o sistema é aleatório. A
régua é sobre a NATUREZA do feito:

| Raridade  | Critério                                        | 🌱  | Cor     |
| --------- | ----------------------------------------------- | --- | ------- |
| **comum** | primeira vez que faz algo — é descoberta        | 15  | cinza   |
| **raro**  | repetição sustentada — voltou N vezes, é hábito | 40  | azul    |
| **épico** | marco de meses, não dá pra apressar nem repetir | 120 | dourado |

O teste aplica a régua ao catálogo: estreia nunca é épica, `_30`/`_50` nunca é
comum. ⚠️ A primeira versão dessa regex usava `_complete$` e exigia que
"preencher o perfil" fosse épica — sufixo genérico é o jeito rápido de um
teste começar a mentir. Hoje é `course_complete` cravado.

### A recompensa saiu da raridade, não de uma lista de exceções

Antes eram dois valores: `achievementBig` (100) para duas chaves num `Set`
e `achievementDefault` (20) para todo o resto — ou seja, "primeira mamada" e
"10 sessões de chutes" pagavam igual. Agora o número sai da MESMA régua que
pinta o anel, então cor e valor nunca podem discordar.

⚠️ **A economia é testada.** Desbloquear tudo paga 1.830 🌱 (era 520). A loja
inteira custa 10.969 🌱, então são ~17% do sink, diluídos em nove meses. O
teste reprova se o total passar de três lojas grátis — existe para avisar no
dia em que alguém acrescentar vinte épicas de uma vez.

### As novas são provadas pelo LEDGER, e isso não é conveniência

As linhas `wellness:<atividade>:<ciclo>:<dia>` são escritas só pelo servidor,
no instante em que a atividade acontece — as mesmas que `trofeusDasChaves` já
contava. Três consequências que nenhuma outra fonte daria:

- valem **retroativamente** (quem já meditou 30 vezes ganha na próxima
  abertura, sem migration nenhuma);
- não dá pra forjar do navegador, então **podem valer Sementinhas**;
- sobrevivem à troca de aparelho, porque não moram no `localStorage`.

⚠️ **O `<ciclo>` recorta tudo.** Sem ele, a segunda gestação de uma paciente
nasceria com as conquistas da primeira já dadas, e ela abriria a aba sem nada
a conquistar. É a mesma expressão de `loadCycleAndGestation` — se divergir, a
contagem procura um ciclo que nunca foi gravado e devolve zero.

⚠️ **`maiorSequencia` é a MAIOR já feita, não a atual.** Conquista é marco:
"você já conseguiu sete dias seguidos" é um fato que aconteceu, e tirá-la
porque a sequência quebrou seria transformar conquista em cobrança. A chama do
Caminho continua mostrando a sequência atual — são perguntas diferentes.

### Duas coisas na tela

- ⚠️ **O anel de raridade só pinta o que ela JÁ TEM.** Bloqueada continua
  cinza-neutra e apagada: um anel dourado numa conquista inalcançada vira
  vitrine do que falta, e a aba passaria a medir ausência. O rótulo
  ("ÉPICO · 120 🌱") aparece sempre — quem quiser saber o que perseguir lê.
- **O catálogo saiu de `achievements.functions.ts`** para `conquistas.ts`: a
  tela arrastava `typedDb`, `computeGestation` e `grantSementinhas` pro pacote
  do navegador só pra saber o título de um emblema. Os nomes antigos seguem
  re-exportados.
- **Bancada:** `/preview-conquistas?quantas=16` · `?tudo=1` (as três molduras)
  · `?luto=1`. Sem ela, conferir uma moldura épica exigiria meditar trinta
  vezes numa conta real — e foi por telas assim serem impossíveis de olhar que
  a aba passou tanto tempo desatualizada.

### Os conjuntos: itens que se completam (ago/2026)

Pedido do dono: "veja se os itens se sincronizam de maneira interessante, se
eles se complementam — por exemplo um item de emoji de golfinho e outro de um
lago, dá pra juntar".

Ele viu o que estava lá: 🐬 golfinho, 🐚 concha, 🐠 peixinho e 🌊 fundo-mar já
existiam, cada um sozinho na sua prateleira, sem nada no app dizendo que são a
mesma praia. **Não existia mecânica de combinação nenhuma** — varredura do
`src/` inteiro confirmou: nada lia dois ids do Cantinho juntos.

Agora são 8 conjuntos (`src/lib/conjuntos.ts`), de 3 a 4 itens, todos montados
com itens que JÁ existiam.

- **Não é a Coroa da Coleção.** Aquela pede um item pago de CADA categoria —
  é largura ("você passeou pelo cantinho inteiro"). O conjunto é profundidade:
  quatro coisas que contam a mesma história. As duas convivem.
- ⚠️ **O RISCO CLÍNICO É REAL, e o desenho tem três travas.** Conjunto é a
  mecânica que mais empurra compra em jogo comercial ("faltam 2 pra
  completar!"). Numa gestante de alto risco — sem dinheiro, sem disposição ou
  internada — isso é cobrança com cara de enfeite. Então: (1) o conjunto não
  se anuncia fora da prateleira dele; (2) não existe prazo; (3) a tela diz
  "3 de 4", que é ESTADO, nunca "falta 1!", que é dívida.
- ⚠️ **A ordem mostra os COMPLETOS primeiro.** "Quase lá" no topo é o padrão de
  todo jogo comercial e é exatamente o que transforma a prateleira num
  lembrete do que falta. Há teste.
- ⚠️ **Conjunto publicado não muda de itens.** Mesma lei da Coroa: um quinto
  item faria o selo virar "4 de 5" para quem já tinha fechado. Item novo entra
  em conjunto NOVO.
- ⚠️ **O emoji do conjunto não é o de NENHUM item** — a primeira versão usava
  🌊 pro mar e 🕯️ pras luzes, e o teste pegou: a prateleira mostrava o mesmo
  desenho duas vezes e o selo lia como cópia do item.
- **O bônus é 15 🌱 por item** (45–60 por conjunto, 435 no total, menos que uma
  loja grátis). Modesto de propósito: o prêmio é o RECONHECIMENTO. Se a
  Sementinha fosse o motivo, o conjunto viraria planilha — e quem monta uma
  cena bonita no cantinho não está fazendo planilha. Idempotente por
  `conjunto:<id>`, pago na compra, com `try/catch` que ENGOLE: a compra já
  aconteceu, e derrubá-la aqui diria "falha" sobre um item que já é dela.

### ⚠️ Três conquistas eram impossíveis, e "7 registros" se fazia numa tarde

Duas coisas que a auditoria noturna encontrou e que valem mais que qualquer
item novo:

**1. A Escola do Bebê está desconectada.** `first_course`, `course_5` e
`course_complete` liam `course_progress`. Nada escreve nessa tabela:
`completeLesson` só é chamada pelo `LessonSheet`, que só abre por um nó
`kind: "lesson"` — e **o construtor da trilha não emite mais esse nó** (o tipo
existe na linha 1002 de `gestacao-path.tsx`, o render na 2823, o emissor não
existe; `EscolaBebêTab` tem zero chamadores). Eram três conquistas
permanentemente impossíveis, uma delas ÉPICA (120 🌱), aparecendo como
"🔒 bloqueada" para sempre numa grade que a paciente lê como "o que ainda dá
pra fazer".

⚠️ **As chaves ficaram.** Apagá-las tiraria a medalha de quem por acaso já a
tivesse — o app não pode tirar de volta o que deu. O que mudou é PARA ONDE
apontam: a aula do dia, que é o que ela de fato faz, tem 294 edições e já
deixa rastro próprio no ledger. A escada virou 1 · 5 · 10 · 50 · 100, e o
texto delas foi reescrito para dizer a verdade nova.

**2. "Repetição sustentada" que se fazia numa tarde.** `health_7_days`,
`journal_10` e `kicks_10` são de raridade `raro`, cujo critério declarado é
"hábito, e hábito custa semanas" — e contavam LINHAS (`count: "exact"` sobre a
tabela). Dava para fechar as três salvando dez vezes seguidas numa tarde. A
régua e o código discordavam, e quem tinha razão era a régua. Agora contam
DIAS DISTINTOS (`diasDistintos`), no fuso de São Paulo — ⚠️ por UTC, dois
registros das 22h e 23h da mesma noite virariam dois dias, e a conquista de
sete dias sairia em quatro noites.

⚠️ **O teste desta régua já esteve errado DUAS vezes**, e as duas por adivinhar
dificuldade pelo NOME da chave (`_complete$` pegou `profile_complete`;
`_(30|50)$` reprovou `aula_50` quando a escada ganhou um degrau acima). Hoje as
escadas são escritas à mão no teste: o topo de cada uma é o épico, e nenhum
degrau abaixo pode ser.

## O app parou de baixar o jogo inteiro pra mostrar a consulta (ago/2026)

O dono relatou, no aparelho: "alguns dados demoram mais pra carregar que
outros, dá a sensação de que o app está estragado" e "às vezes puxa uma tela
passada por um segundo". Três causas medidas, três correções.

### 1. O banco de aulas saiu do pacote

`daily-quizzes.data.json` tem 674 KB e era `import` estático — o Vite o
embutia no chunk de `gestacao-path`. **Medido antes: 892 KB crus / 264 KB
comprimidos.** As 294 aulas desciam inteiras para entregar UMA.

- Virou `import()` dinâmico com a promessa em cache (`bancoEmVoo`). ⚠️ Guarda a
  PROMESSA, não o resultado: dois toques rápidos chegam antes de o primeiro
  `import()` resolver e baixariam duas vezes — mesma lição da fila `emVoo` do
  service worker.
- ⚠️ **`temQuizNoDia` é FAIXA, não conteúdo.** A tela precisa saber no TOQUE se
  existe aula (é o que decide se a intro roda e se o dia abre com aula ou
  desafio). Ler `Object.keys` do JSON traria o JSON de volta pro pacote e
  desfaria a mudança inteira — então são duas constantes, e
  `daily-quizzes.test.ts` as confere contra o arquivo real, inclusive cobrando
  que não haja buraco no meio. Constante que descreve um arquivo é constante
  que um dia diverge dele.
- ⚠️ **`undefined` (baixando) e `null` (não tem aula hoje) são estados
  DIFERENTES.** Juntá-los era o defeito à espera: a tela mostraria o desafio do
  dia por uma fração de segundo antes de a aula chegar — trocando peso de
  pacote por pisca de conteúdo errado, que é pior porque ela VÊ. Daí o
  `kind: "carregando"` em `WellnessLesson`.

### 2. `GestacaoPath` virou `lazy()`

Ele descia junto com a tela de Minha Conta INTEIRA, para toda paciente, toda
visita — mesmo quem só ia ver a próxima consulta e sair.

- ⚠️ **O `lazy()` sozinho não separava nada.** `lsGet`, `lsSet` e
  `ensureInitialJourneyPull` eram importados DELE por outras telas, e um import
  estático de uma função traz o módulo inteiro junto. Foi preciso mover o
  armazém local e a sincronização para `src/lib/journey-sync.ts` primeiro.
  `gestacao-path` re-exporta os três para não quebrar quem já os importava.
- ⚠️ `gatePrimed` virou `pullInicialJaArmado()` — uma FUNÇÃO. `export let`
  congela o valor no import de quem lê, e o Caminho pergunta isso DEPOIS de a
  barreira ser armada: exportando a variável ele leria `false` para sempre e
  re-hidrataria a cada montagem.
- A espera é a BOLHA, não um spinner: ela é a personagem desta aba, e um
  spinner genérico lê como "travou".

**Medido depois (gzip):** `gestacao-path` 264 → 91 KB, e o banco de aulas
virou um chunk próprio de 148 KB que só desce ao abrir um dia. A abertura de
Minha Conta caiu de ~662 KB para ~398 KB — **264 KB a menos, 40%.**

### 3. Quatro idas à rede em série viraram duas rodadas

- **Na abertura do app** (`minha-conta.tsx`): era getUser → perfil →
  getSession+checkIsAdmin → getMyDoctor, cada espera somando a anterior. O
  perfil precisa do `user.id`; `checkIsAdmin`/`getMyDoctor` precisam do token;
  e perfil e papel **não dependem um do outro**. Agora: getUser+getSession
  juntos, depois perfil+papel juntos.
  ⚠️ `getMyDoctor` passou a sair SEMPRE (antes só quando não-admin). É uma
  leitura, e o resultado continua ignorado para admin — a semântica de quem vê
  o quê não mudou, só a hora do pedido. Admin é raro; gestante é todo mundo.
- **No Caminho** (`gestacao-path.tsx`): `journey_state` e `course_progress` são
  tabelas diferentes e não dependem uma da outra, mas a segunda só era PEDIDA
  depois de a primeira responder.
  ⚠️ **O que não pode inverter é a APLICAÇÃO**: o merge das lições lê o
  `localStorage` que o pull da jornada acabou de reescrever — rodando antes,
  mesclaria por cima do cache velho e regravaria, apagando do aparelho as
  lições que só existiam na nuvem. Então dispara as duas juntas (rede em
  paralelo) e consome na ordem de sempre.

**O "flash de tela passada"** é o `hydrateFromLocal()` rodando duas vezes (o
cache do aparelho primeiro, o merge da nuvem depois) — comportamento
deliberado, mas que ficava sem explicação na tela. Continua de pé; o que ele
espera hoje é bem mais curto.

## Experiência "app de milhões" (IMPLEMENTADO — jul/2026)

- **Movimento**: primitivas `Reveal`/`Stagger`/`StaggerItem` em
  `src/components/motion-primitives.tsx` (usam `motion`, respeitam
  `prefers-reduced-motion`). Aplicadas na home (Bebê) e no Ciclo visual.
- **Onboarding**: `OnboardingRitual` (primeiro acesso, escreve nos campos do
  Perfil; sem coluna nova; "pular" lembrado em `localStorage`).
- **Celebração**: `src/lib/celebrate.ts` (confete em canvas + som Web Audio +
  vibração). Marco de nova semana em `WeekMilestoneModal`. Nunca em Modo Cuidado.

## Notificações push (IMPLEMENTADO — jul/2026)

Web Push **sem dependência externa** — o envio é 100% `node:crypto`
(`src/lib/push.server.ts`: aes128gcm RFC 8291/8188 + VAPID ES256 RFC 8292),
validado contra a lib `web-push` como oráculo. Cliente inscreve em
`src/lib/push.ts` → tabela `push_subscriptions` (RLS).

**Para ATIVAR (env vars):**

- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (servidor).
- `VITE_VAPID_PUBLIC_KEY` = **mesma** pública (vai pro navegador).
- Gere com `npx web-push generate-vapid-keys` (ou peça ao Claude). Sem as
  chaves, tudo vira no-op — nada quebra. iPhone só recebe push com o app
  **instalado na Tela de Início** (iOS 16.4+).

**Gatilhos:**

- **Consulta** (evento): confirmação, contraproposta e vaga liberada disparam
  push junto com o e-mail (`sendPushToEmail` em `admin.functions`/`waitlist`).
- **Dicas semanais**: `/api/push-weekly-tick` (cron diário no `vercel.json`,
  `CRON_SECRET`). Stateless — notifica quem tem `gest.days === 0`.
- **Envio manual**: `sendDoctorBroadcast` (painel → aba Agendamentos), escopado
  por `doctor_id`.

## Voz do app (DECIDIDO — ago/2026)

A voz guiada da meditação e da respiração é **Isabella no motor ElevenLabs**
(`text2speech_v2`, `variant: elevenlabs`, `voice_id`
`80924413-1ea8-4e64-9719-e00b86796f05`). Use essa mesma voz em tudo que precisar
falar — meditação, respiração, movimento, qualquer narração futura. Voz que muda
entre telas soa como outro produto.

Foram testados quatro caminhos antes: `seed_audio` (ByteDance) em duas vozes, e
`text2speech_v2` nos motores ElevenLabs e MiniMax. As 57 vozes do catálogo têm
nome inglês e nenhuma é pt-BR nativa, então **o sotaque vem do motor, não da
voz** — o `seed_audio` trata português como língua secundária e sai soando
europeu. A comparação que decidiu foi a mesma voz (Isabella) em dois motores.

O `speechSynthesis` do navegador (`src/lib/fala.ts`) **está para sair**. Ele só
toca vozes instaladas no sistema da paciente: não dá para escolher, não dá para
instalar, e no Android padrão é justamente a robótica. Como os textos de
meditação e respiração são fixos, o caminho é gerar os áudios uma vez e embarcar
os arquivos — igual às ilustrações. Ganha qualidade, fica previsível e funciona
offline.

## A meditação sobreviveu à vida real (ago/2026)

Cinco buracos que os apps grandes fecharam há anos e nós não. Nenhum deles é
conteúdo — é mecânica, e por isso saiu sem gastar um crédito de áudio.

### 1. O áudio ficou offline

`public/sw.js` cacheava `js|css|woff2|svg|png|ico|jpg|webp`. O `.mp3` estava
**fora** — os 16 MB de voz gravada dependiam de rede em toda sessão, e sem rede
a tela andava muda. Baixar para ouvir offline é recurso PAGO no Calm e no
Headspace.

- ⚠️ **O `Range` é o que faz o Safari tocar.** O `<audio>` pede
  `Range: bytes=0-`, e responder 200 com o arquivo inteiro faz o Safari
  desistir da faixa EM SILÊNCIO — o mesmo sintoma de arquivo inexistente. E não
  dá para guardar o 206 que a rede devolve: `cache.put` **lança** em resposta
  parcial. Por isso o worker guarda o arquivo inteiro e fatia na hora
  (`recorte`). Faixa múltipla (`bytes=0-50,100-150`) é o único caso em que ele
  responde 200 — a RFC permite, e nenhum navegador pede isso para um mp3 de
  150 KB tocado do começo ao fim.
- **São DOIS caches, e isso é decisão.** `activate` apaga tudo que não é a
  versão atual; com o áudio junto, subir de `v4` para `v5` por uma linha de CSS
  jogaria fora 16 MB que continuam válidos (os nomes têm hash de conteúdo e não
  mudam entre deploys). O áudio vive em `obstetricia-audio`, sem versão.
- ⚠️ **`IMUTAVEL_RE` é `^/assets/`, a MESMA régua do servidor** (a Vercel já
  carimba `immutable` nesse prefixo). A primeira versão tentava reconhecer o
  hash (`-[A-Za-z0-9_-]{8,}`) e era pior: um `logo-consultorio.png` colocado em
  `public/assets/` casaria e ficaria congelado PARA SEMPRE no aparelho da
  paciente. Há teste cobrando que `public/assets/` não exista.
- **Fila de download** (`emVoo`): o elemento de mídia sonda antes de tocar e o
  `preparar()` de `voz.ts` pode já ter pedido o mesmo arquivo — sem a fila, os
  dois baixavam.
- **Confere o tipo antes de guardar**: um mp3 que não existe mais cai na função
  de SSR e volta como PÁGINA. Como áudio não revalida, ela ficaria no lugar da
  fala até a próxima troca de versão.
- **Custo conhecido:** no primeiro toque de cada arquivo o worker baixa o
  inteiro antes do primeiro byte (~3 s no link de 400 kbps do pior arquivo,
  contra 0,97–1,80 s de antes). Quem paga é o `preparar()`, que busca a
  primeira fala enquanto ela escolhe e a próxima com 2,5 s de antecedência.
- **Teste:** `service-worker.test.ts` **executa** o worker com `self`, `caches`
  e `fetch` de mentira. Seis mutações que passavam na primeira versão hoje
  falham.

### 2 e 3. Pausar — e o app saindo da tela

Em dez minutos a campainha toca. Mas o defeito grave era outro: quando o app
saía da tela, o iOS **suspendia** o áudio sintetizado e congelava os relógios.
A sessão não morria — ficava parada, muda, e voltava sem som, sem nada dizer o
que houve.

- **Pausar guarda o MOTIVO** (`toque` | `fundo`), e o véu conta qual foi. "O app
  saiu da tela e a sessão parou aqui" responde a pergunta que ela faria antes de
  desconfiar do aplicativo.
- ⚠️ **`podeRetomar` é conferida DUAS vezes** (`pausa-da-sessao.ts`), antes e
  depois da espera do `AudioContext`. Entre o toque e a resposta cabem: fechar a
  folha (e aí o recuo criava som tocando num componente que já saiu da tela,
  sem nenhum botão que o desligasse), a sessão acabar, e sair do app — este
  último chega pelo ▶︎ da tela bloqueada, que dispara COM a página escondida.
- ⚠️ **`soundscapes.retomar()` reconfere o `ctx` depois do `await`.** `stop()`
  pode ter zerado; lia-se `ctx.state` de `null`, o TypeError subia pela promessa
  e quem chamou entendia "não voltou".
- ⚠️ **Pausar PARA o relógio do coração.** Em contexto suspenso o `currentTime`
  congela e o `setInterval` agendaria toda batida para o mesmo instante parado —
  ao voltar sairiam todas juntas.
- **A volta refaz a voz** (`retomada` nas deps dos dois efeitos): a deixa do
  ciclo foi cortada no meio e o texto dela continua na tela; e "Inspire" só
  sairia se a pausa tivesse caído fora da inspiração.
- **A faixa de cima é `z-30`, o véu é `z-20`** — o ✕ continua alcançável (ele
  hoje GUARDA a sessão). Por isso `trocarSom` não pode tocar pausada, e o
  conteúdo por baixo leva `aria-hidden`: o véu esconde do dedo, não do VoiceOver.
- **Testes:** `soundscapes.test.ts` roda o som com um `AudioContext` de mentira;
  `pausa-da-meditacao.test.ts` usa `trecho()`, que ESTOURA se um marcador sumir
  — a versão anterior ficava verde com o guarda do relógio apagado, porque a
  mesma linha existia 370 linhas abaixo.

### 5. O lembrete diário

Sequência + empurrão no horário escolhido é a metade do Headspace que o Calm não
tem. A chama existia desde o começo; o empurrão, não.

- Régua pura em `src/lib/lembrete-de-meditacao.ts`; cron em
  `/api/meditacao-tick` (`CRON_SECRET`, de hora em hora, janela de 70 min).
- **O horário é guardado em minutos depois da meia-noite UTC**: o cron compara
  com o próprio relógio, sem tabela de fuso. O deslocamento dela vai junto
  porque saber que dia é hoje no quarto dela é outra pergunta.
- ⚠️ **A repetição é contada em HORAS, nunca em dias do calendário.** Um
  lembrete às 21h de São Paulo é 00:00 UTC: contando por dia, ele sairia às
  23:55 (dia A) e de novo às 00:10 (dia B).
- ⚠️ **`getTimezoneOffset()` tem o sinal trocado** — ler direto é o mesmo erro
  de três horas que a agenda já teve.
- **Quem já meditou hoje não é incomodada** (lê o `dc-path-med-log` do
  `journey_state`). Blob em formato inesperado → manda; leitura que ERROU → não
  manda.
- **Grava o carimbo ANTES de mandar**, e a coluna é revogada do `authenticated`.
- Nada no Modo Cuidado.
- **Aplicar:** `supabase/APLICAR_LEMBRETE_DE_MEDITACAO.sql`. **Agendar:** cron
  de hora em hora em `/api/meditacao-tick` (mesmo caminho do `lembretes-tick`).

### 6. Sons para dormir

Chuva, mar, coração e pad existiam há meses e só tocavam DENTRO de uma sessão.
Quem acorda às três da manhã não abre dez minutos de meditação para chegar ao
som. Tela em `sons-para-dormir.tsx`, régua em `som-continuo.ts`.

- ⚠️ **NÃO é Web Audio.** O iOS suspende o `AudioContext` quando o aparelho
  bloqueia: um player de dormir feito assim para no segundo em que ela apoia o
  celular na mesa de cabeceira. O som é renderizado uma vez num
  `OfflineAudioContext`, empacotado em **WAV** e tocado num `<audio loop>` — que
  sobrevive à tela apagada e pendura o card na tela de bloqueio. Nenhum arquivo
  novo no repositório.
- **WAV e não MP3**: além de não haver codificador no navegador, **MP3 não fecha
  o loop** (carrega silêncio de codificação nas pontas).
- ⚠️ **A emenda é matemática, não crossfade.** O trecho é múltiplo EXATO de todo
  período interno (por isso a chuva passou de 0,07 Hz para 1/15 Hz e a onda do
  mar de 9 s para 10 s). E há **aquecimento descartado**, porque o filtro tem
  memória: medido, sem ele o degrau na emenda do CORAÇÃO era 0,0443 — maior que
  o maior degrau de qualquer outro ponto do arquivo. Com ele, 0,0001.
  O aquecimento também é múltiplo dos períodos (candidatos são divisores de 30),
  e é o menor que serve: 6 s no coração baixou o render de 812 ms para 315 ms.
- ⚠️ **Medir a emenda por `decodeAudioData` NÃO funciona** — ele reamostra e
  inventa um degrau nas bordas. Lê-se o WAV cru, e compara-se o degrau da emenda
  com a DISTRIBUIÇÃO de degraus do próprio sinal.
- **Pico normalizado em 0,89.** Medido antes: 1,10 na chuva — saturando. O
  `soundscapes.ts` nunca teve isso porque toca a 0,28; aqui o arquivo é a saída
  inteira, e no iPhone a página não controla volume nenhum.
- ⚠️ **`destravar()` toca 50 ms de silêncio DENTRO do toque.** Renderizar leva
  ~300 ms de `await`, e depois do `await` o gesto já passou: o `play()` volta
  recusado e o player fica mudo sem erro visível.
- **O elemento entra no documento**, invisível: é o elemento no documento que o
  iOS reconhece como mídia da página.
- **Esta tela NÃO pausa quando o app sai da frente** — o contrário da meditação,
  de propósito. E não tem `manterTelaAcesa`: a tela deve apagar.
- **Bancada:** `/preview-sons`.

## A noite ganhou conteúdo próprio (ago/2026)

Duas **histórias para dormir** e uma **sessão para o casal**: 65 mp3, 14min53s,
38,70 créditos, na mesma voz de tudo que fala no app.

### Histórias (`historias-para-dormir.ts` + `historia-da-noite.tsx`)

- **Blocos, não arquivo único.** O silêncio entre eles CRESCE de 3 s a 16 s
  (`pausaDepoisDo`) — é isso que faz a voz se afastar, e é a diferença entre
  uma história para dormir e um audiolivro lido devagar. Em blocos, a primeira
  fala toca em segundos e regravar uma frase ruim custa UM bloco.
- **Nenhuma pergunta** (pergunta convoca a cabeça a responder), **o texto não
  aparece na tela** (ler acorda), e a tela **escurece sozinha em 20 s** — com o
  toque REARMANDO o relógio, senão o primeiro toque acende a tela pelo resto da
  noite. Narração a **0,92× com `preservesPitch`**: a Isabella lê a ~150 ppm, e
  o gênero vive entre 100 e 130.
- ⚠️ **A história termina entregando ao SOM**, não ao silêncio. Onze minutos de
  voz que simplesmente param deixam o quarto mudo de repente. Por isso
  `abrirHistoria` chama `destravar()` no MESMO toque: a entrega acontece sem
  gesto nenhum, e no iOS ela seria recusada.
- **As duas atravessam o Modo Cuidado** — não citam bebê nem gestação. É o
  único conteúdo do app que serve a quem perdeu a gestação sem ressalva, e a
  noite de quem está de luto é exatamente uma noite ruim.

### Casal (`sessao-do-casal.ts` + `sessao-do-casal.tsx`)

- É **preparação de parto** disfarçada de exercício a dois: seguir o ritmo dela,
  a pressão no sacro, e a palavra combinada.
- **Todo bloco diz A QUEM fala** (`alvo`, em cor própria e letra grande) com um
  **desenho** mostrando onde a mão vai. Num aparelho só, não saber de quem é a
  vez é o defeito clássico do gênero.
- ⚠️ **Nenhuma fala pede que alguém SINTA nada** — há teste com regex. "Sintam
  a energia entre vocês" é o que faz um casal adulto fechar o app.
- ⚠️ **O acompanhante nunca tem gênero.** Pode ser o pai, a companheira, a mãe
  ou a irmã. A conferência antes de gastar crédito pegou dois "a mão dele" meus.
- O bloco de silêncio central tem **60 s: a duração de uma contração**.

## A aba de exercícios deixou de ser `day % 9` (ago/2026)

Eram nove movimentos, três por dia, ~100 segundos. Uma gestante de 8 semanas e
uma de 39 recebiam o mesmo trio. Régua e conteúdo agora em
`src/lib/exercicios.ts` (sem JSX, testado).

- **A pergunta mudou.** Ninguém abre um app de alongamento porque é terça —
  abre porque a lombar travou. A sessão começa em **"o que está incomodando?"**
  (oito queixas), e o que alivia AQUILO vem primeiro. Há teste cobrando que
  toda queixa oferecida tenha ao menos dois movimentos: ele reprovou "dor no
  osso da frente", que tinha um só.
- ⚠️ **Faltava o assoalho pélvico** — o exercício com melhor evidência da
  gestação inteira, e nenhum dos nove era ele. São três, porque são três
  habilidades: segurar, responder rápido, e SOLTAR (esta é a que ninguém ensina
  e a que o parto pede). Ele entra em TODA sessão de 5 min ou mais **mesmo sem
  ela pedir**: ninguém acorda com dor no assoalho pélvico, ele previne o que
  ainda não dói.
- **Preparação de parto a partir da 36ª** — e a fase `parto` **acrescenta** à
  t3, não substitui: uma fase que trocasse a lista faria a mulher de 38 semanas
  perder o alívio de lombar justamente quando ele mais dói.
- **25 movimentos**, com `alivia` / `fases` / `tipo` / `chao`. Duas poses novas
  (`deitada`, `parede`) porque oito dos novos ficariam sem desenho.
- **Duração escolhida** (2/5/10 min) e **pausa** — mesma régua da meditação: o
  relógio para e o anel congela junto (medido no navegador: 38 s → 38 s).
- ⚠️ **Os sinais de parada aparecem ANTES**, e não como "li e aceito": sem
  caixa de marcar, porque uma caixa vira toque automático na terceira vez.
- ⚠️ **O desfecho vai para o diário SEM `mood`.** "Piorou" aqui é sobre uma dor
  nas costas; carimbar como humor faria a curva emocional dela despencar por
  causa de uma lombalgia. `registrarExercicio` grava só `content`.
- **Bancada:** `/preview-exercicio?w=24` · `?w=38` (parto) · `?pos=1`.
- ⚠️ **Os 16 movimentos novos ainda rodam MUDOS** — as faixas de voz não foram
  gravadas. Eles funcionam (os passos estão na tela) e `faixaDoMovimento`
  devolve `null` sem quebrar nada. A fila de gravação está travada em
  `voz.test.ts`: mover um id para `COM_VOZ_GRAVADA` é o que fecha a pendência.

### A sessão virou uma varredura só (ago/2026)

Auditoria de seis chapéus na aba. **Nota 6,5** — o conteúdo e a régua clínica
valiam 8, a execução da SESSÃO valia 5. O número que decidiu:

| sessão de 10 min | movimentos | trocas de pose | **sobe/desce de nível** |
| ---------------- | ---------- | -------------- | ----------------------- |
| 24 semanas       | 12         | 10             | **6**                   |
| 38 semanas       | 11         | 9              | **7**                   |

O código orça **6 segundos** de troca. Sair do decúbito lateral para em pé com
38 semanas leva 20 a 30 — o alongamento virava o intervalo entre os
agachamentos, e o esforço da sessão passava a ser levantar do chão sete vezes.

Depois, nas 189 combinações de fase × duração × queixa: **49 sessões com zero
trocas, 133 com uma, 7 com duas** — e as sete são todas a CIÁTICA, cujo alívio
se espalha por três níveis. Nenhuma passa de duas.

- **A ordem de ESCOLHA não é a ordem de EXECUÇÃO.** A queixa continua mandando
  em QUEM entra; a posição manda em QUANDO. E o corte por tempo roda ANTES da
  ordenação — invertido, a sessão de dois minutos entregaria a ponta da fila em
  vez do que alivia a dor.
- ⚠️ **É uma VARREDURA CIRCULAR, e as três tentativas anteriores estão
  registradas em `ordenarPorPosicao` porque cada uma quebrou diferente:**
  ordenar tudo de cima para baixo jogava o alívio do PÚBIS (cujos movimentos
  são todos deitada) para o quarto minuto; inverter o sentido quebrava a AZIA,
  cujo alívio mora num nível do MEIO; e dois blocos ordenados em separado
  mediram TRÊS trocas — desciam, voltavam ao topo e desciam de novo. A
  varredura começa no nível do alívio e dá a volta: passa por cada nível uma
  vez. Das duas direções vale a que troca menos; empate DESCE, porque descendo
  a sessão termina deitada, que é onde o corpo relaxa.
- **O invariante testado não é a ordem absoluta** (ela pode começar deitada e
  terminar em pé) — é **uma pose, um bloco**. Sentar, deitar e sentar de novo
  é como as três trocas apareciam.
- **"Hoje eu não desço ao chão"** (`semChao`): cama de hospital, repouso, o
  tapete que não existe. Só SOMA ao corte automático — não há como pedir o chão
  de volta com 39 semanas —, e o botão **só aparece quando há chão a tirar**: da
  37ª em diante a régua já o tirou, e um botão que não muda nada ensina que os
  botões desta tela não valem.
- **O desfecho escolhe a sessão seguinte** (`ajustarNotas`, chave
  `dc-path-ex-notas`, viaja no `journey_state`). ⚠️ Três coisas que ela NÃO faz:
  não mexe no **assoalho pélvico** (ele entra por prevenção, não por dor —
  ninguém sente alívio de assoalho no mesmo dia, e uma nota negativa tiraria da
  sessão o exercício com melhor evidência da gestação por um resultado que ele
  nunca prometeu); **não tira nada do poço** (a nota só REORDENA, porque uma
  sessão ruim pode ter sido a noite mal dormida); e **"igual" não é nota
  negativa**. A nota é por QUEIXA (`lombar:gatocamelo`), nunca por movimento
  solto: o mesmo movimento serve a quatro queixas, e uma nota global carregaria
  a evidência de uma dor para outra que ela nem tinha.
- ⚠️ **"Dor no osso da frente" era um botão que não fazia nada no 1º
  trimestre.** Os dois movimentos que a tratam nasceram `t2+`, e o teste de
  cobertura olhava o catálogo INTEIRO — a paciente vive numa fase só. Agora há
  teste por fase, e a isometria de adutor com travesseiro ganhou `t1` (o que
  faltava era a fase, não a segurança).

## A Gratidão deixou de ser um `textarea` (ago/2026)

Auditoria das cinco atividades do jogo: Aula 8,0 · Meditar 7,5 · Mexer 7,0 ·
Bebê 6,0 · **Gratidão 5,0** — a única que perdia para aplicativo de graça
(Presently, Five Minute Journal, Finch). Era um campo de texto, cinco
fichinhas fixas e um título, do dia 1 ao dia 280. Régua e texto em
`src/lib/gratidao.ts` (sem JSX, testado), pelas razões de sempre.

- **A pergunta gira por FASE**: 16 universais + 6 por fase = 22 na roda, três
  semanas até repetir. As fichinhas vêm com a pergunta — fichas fixas embaixo
  de uma pergunta que muda dariam respostas que não respondem nada.
  ⚠️ A rotação é `dia % n`, nunca um passo de 7: a lista da manhã do mascote
  tinha 14 frases e mostrava duas, alternadas, para sempre.
- ⚠️ **QUEM CITA O BEBÊ É MARCADO NO CAMPO `bebe`**, e nunca adivinhado do
  texto. É a correção antecipada do defeito que a meditação tem: lá a regex
  sobre a prosa corta 3–4 falas boas por sessão (o `\bele\b` pega o AR e o
  DESENHO), e em "Só respirar" no luto derruba de 12 para 9 falas.
- **O dia difícil tem pergunta PRÓPRIA** (`PERGUNTAS_DIA_DIFICIL`), disparada
  pelo humor de HOJE no diário (`HUMORES_DIFICEIS` = os de valor 1 e 2 do
  gráfico dela). Ela ESTREITA, não consola: há teste com regex proibindo "vai
  passar", "está tudo bem", "lado positivo" — a mesma razão pela qual a
  carinha `preocupada` saiu do mascote.
- ⚠️ **A RELEITURA É ONDE ESTÁ A EVIDÊNCIA** do exercício: escrever ajuda,
  RELER é o que muda o afeto depois. Guardávamos tudo em `journal_entries` e
  nenhuma tela da atividade devolvia nada. `gratidaoParaReler` **nunca devolve
  a de hoje nem a de ontem** (reler o que se acabou de escrever é eco) e
  prefere o que já passou de 21 dias. Sem nada com três dias, a seção não
  existe — melhor não ter do que repetir a frase de cima.
- **O contador SÓ SOBE, e não é sequência.** "23 coisas boas nesta gestação"
  sai do `count` da consulta (a lista é cortada em 200 e o número travaria
  ali). Chama que zera puniria quem passou a noite no hospital.
- **As gratidões viram CARTA para o bebê** (`cartaDasGratidoes`), lida em voz
  alta na atividade Bebê. Resolve duas carências de uma vez: as 11 cartas se
  repetiam a cada 11 dias, e o que ela escrevia não voltava para lugar nenhum.
  ⚠️ As dez linhas saem espaçadas do PERÍODO INTEIRO, não as dez últimas (as
  recentes dariam a última semana — isso é diário, não é a história de quem
  cresceu junto), o texto é DELA sem uma palavra reescrita, e abaixo de oito
  gratidões a carta não existe. Fora do Modo Cuidado, sem exceção.

### Falar em vez de escrever, com transcrição (ago/2026)

Pedido do dono. Escrever no celular às onze da noite com o bebê no colo é
trabalho; falar não é. `src/lib/gravador.ts` + `/api/transcrever-diario`.

- ⚠️ **O ÁUDIO NUNCA É GUARDADO** — vira texto e some com a função. Não há
  balde, coluna nem URL. Mesma decisão que tirou o envio de exames do produto,
  e aqui mais fácil: o que ela quer registrar é o texto.
- ⚠️ **O que volta é RASCUNHO**, e cai no campo para ela conferir. A
  transcrição erra nome, corta o fim da frase e inventa pontuação — salvar
  direto poria no diário (que o médico lê no prontuário) palavras que ela não
  disse. E ACRESCENTA ao que já estava digitado, nunca apaga.
- ⚠️ **`audio/mp4` é o PRIMEIRO da lista de formatos**: é o único que o Safari
  do iPhone grava. Uma lista começando em webm funciona em toda máquina de
  desenvolvimento e falha no aparelho onde o app é instalado.
- ⚠️ **`gravar()` roda DENTRO do toque**, sem `await` antes — `getUserMedia`
  exige gesto do usuário no iOS, e depois de uma espera o gesto já passou. É a
  mesma armadilha do `destravar()` dos sons para dormir.
- **O botão só aparece onde o navegador grava** (`podeGravar`): microfone
  desenhado numa tela que não grava promete e não cumpre.
- **NÃO reaproveita `/api/transcribe`**, e as três razões estão no cabeçalho
  do endpoint novo: aquele tem prompt CLÍNICO (devolveria "hoje o café estava
  gostoso" como ficha médica), portão de PLANO PAGO (a maioria das pacientes
  levaria 402) e teto de 20 MB (aqui é uma frase, lá é uma consulta).
  Reaproveitados: sessão antes de tudo, limitador por IP, `inline_data` e a
  MEDIÇÃO — aquele endpoint passou meses sendo o único de IA sem
  `registrarUsoAgora`, e era o mais caro da base.
- **Medido em `canal: "diario"`**, fora de `CANAIS_DA_COTA`: não come a
  franquia clínica dela, mas aparece no custo da plataforma. Teto de 2 MB e
  90 s, conferidos NO SERVIDOR — relógio de navegador em segundo plano é
  estrangulado pelo sistema, e um corpo montado à mão nem passa pela tela.
- **`temperature: 0` e "não resuma, não corrija"**: o modelo aqui é um
  teclado, não um redator.
- **Bancada:** `/preview-gratidao?w=20&n=12` · `?tela=done` (a releitura) ·
  `?tela=lista` · `?dificil=1` · `?pos=1` · `?luto=1` · `?n=0` (paciente nova).
  A releitura e o contador vêm do diário no servidor, então sem a bancada
  conferir isso exigiria uma conta com semanas de uso — e é assim que uma tela
  passa meses sem ninguém nunca ter olhado para ela.

### E o bebê bolha virou o porta-voz desta tela também (ago/2026)

Pedido do dono: "coloque o bebê bolha nessa tela também comunicando essas
informações, ele é o nosso porta-voz do app". `BolhaComBalao`
(`gestacao-path.tsx`) + `falaDaBolha` (`gratidao.ts`, testado).

- **Ele NÃO repete a pergunta do dia** — há teste. A pergunta é o título
  grande; um balão dizendo o mesmo daria dois textos disputando o olho e a
  personagem viraria enfeite. O que ele entrega é o que era **rótulo seco**: o
  contador ("você já me contou 12 coisas boas") e a apresentação da releitura
  ("Guardei 💛 E olha o que você me contou antes:"), que antes era uma etiqueta
  em caixa alta sem voz nenhuma.
- ⚠️ **A CARA sai de `humorDaJornada`, nunca de um `if` local** — é lá que mora
  o portão de Modo Cuidado. Medido na bancada: `?tela=done` desenha
  `comemorando.webp`; `?tela=done&luto=1` desenha `feliz.webp`. Uma segunda
  régua faria festa na tela de quem perdeu a gestação.
- **No dia difícil ele diminui o pedido, não consola**: "Hoje pode ser bem
  pequeno. Eu guardo do mesmo jeito." Há teste proibindo "vai passar" e "está
  tudo bem" — a mesma razão pela qual a carinha `preocupada` saiu da
  personagem.
- **Na primeira vez ele explica a mecânica** ("Me conta uma coisa boa? Eu
  guardo pra você"): ninguém dizia para onde o texto ia.
- O balão aqui é centrado e **não precisa de `w-max`**: aquele defeito é de um
  absoluto com `right` e sem `left`, cujo shrink-to-fit media contra um
  container de 44px. Aqui ele está no fluxo, no eixo da tela.

### Marcos redondos, hora do dia, resumo de domingo, e o push que já existia (ago/2026)

Quatro ideias criativas para chegar mais perto de 10, pedidas pelo dono depois
da nota 8,5. Nenhuma gasta crédito; nenhuma pede SQL novo.

- **Marcos redondos** (`MARCOS`, `marcoAtingido` em `gratidao.ts`): 10, 25, 50,
  100, 200, 365. O contador subia sem festa nenhuma — "23 coisas boas" e "24
  coisas boas" liam exatamente igual, enquanto o troféu, a chama e as cinco
  estrelas do resto do jogo têm celebração própria. ⚠️ `marcoAtingido` compara
  por IGUALDADE, e isso só é seguro porque `total` sobe exatamente +1 por
  guardada — nunca pula. Quem já tinha mais gratidões que o primeiro marco
  antes deste recurso existir simplesmente não vê aquele marco: não dá para
  comemorar retroativamente uma travessia que já aconteceu em silêncio. A
  festa reaproveita `nivelDaSequencia` (`celebrate.ts`) para escalar
  confete/som/vibração pelo TAMANHO do marco — a mesma régua da chama, sem
  inventar uma segunda tabela de "quão grande é a festa". O balão prioriza o
  marco sobre a releitura (o cartão de reencontro continua embaixo do mesmo
  jeito), e o número aparece GIGANTE na tela — a mesma distinção que a Aula já
  faz com `<ConfettiBurst big={score === total} />`.
- **A bolha muda de assunto pela hora do dia**, reaproveitando `Periodo` e
  `periodoDaHora` de `frases-do-mascote.ts` — a mesma régua do mascote da
  home, nunca uma segunda cópia. ⚠️ **A madrugada é tratada à parte, SEM o
  contador**: é a mesma exceção que `humorDaJornada` já faz para a "surpresa"
  da madrugada — quem está acordada às 3h numa gestação de risco não precisa
  de mais ninguém contando número pra ela, precisa de companhia
  ("Você está acordada bem cedo. Eu fico aqui, é só falar."). Manhã, tarde e
  noite mudam só a abertura ("Bom dia!", "Antes de dormir —"); o contador
  continua. **Dia difícil e primeira vez continuam vencendo o período** — as
  duas já são a coisa mais importante a dizer naquele instante, e casar hora
  do dia com elas só alongaria a frase à toa. Sem período informado, a frase é
  byte a byte a de antes — nada quebrou para quem não passa o parâmetro.
- **O resumo de domingo** (`gratidoesDaSemana`, `ehDomingoDeResumo` em
  `gratidao.ts`; fase `"resumo"` em `GratitudeBlock`): nenhum app de gratidão
  do mercado faz isto — todos empurram o PRÓXIMO registro, nenhum comemora os
  que já existem. Aos domingos, com duas gratidões OU MAIS na janela corrida
  dos últimos 7 dias, e só se ela AINDA NÃO ESCREVEU HOJE, a tela para antes
  de pedir mais uma e mostra a semana inteira para ela escolher a favorita.
  ⚠️ **Não persiste nada** — não existe coluna de "favorita", e inventar uma
  seria migration por decoração; o valor do exercício é RELER, não o registro
  da escolha. "Boa escolha 💛" é feedback puramente local (`useState`), some ao
  fechar a folha. O mínimo é DOIS: escolher entre uma coisa só não é escolha,
  é reler o que ela acabou de ver na tela de guardado.
- **O push semanal já existia — a Gratidão entrou nele** (`push-weekly-tick.ts`,
  `nudgeGratidaoDaSemana`): sem SQL novo, porque usa o MESMO cron que já roda
  em produção e já está protegido. Stateless como `cobrarLacunasParadas` ao
  lado — sem tabela de "já mandei", o controle é o dia da semana: só dispara
  aos domingos, o mesmo dia do resumo dentro do app. ⚠️ **Nunca em Modo
  Cuidado** — filtra por `care_mode` DEPOIS de somar por paciente, para não
  varrer a base toda à toa. Reaproveita `PREFIXO_GRATIDAO` de `gratidao.ts` em
  vez de reescrever `"Gratidão: "` à mão — duas cópias do mesmo prefixo
  divergem no primeiro conserto, e aqui a divergência seria silenciosa: o cron
  contaria zero gratidões, sem erro nenhum. Deep-link `/minha-conta?tab=Caminho`
  — o mesmo rótulo exato que `mesada.functions.ts` já usa, porque `minha-conta`
  ignora em silêncio um `?tab=` que não bate com `TABS`.
- **Bancada:** `/preview-gratidao?tela=done&marco=50` (o marco) ·
  `?tela=write&periodo=noite` (madrugada/manha/tarde/noite) ·
  `?tela=resumo&n=5` (o resumo — o espaçamento das gratidões de exemplo cai
  para 1 em 1 dia só nesta tela, porque o padrão de 6 em 6 dias é pensado para
  a RELEITURA e deixaria a semana quase vazia).

### A carta deixou de ficar escondida (ago/2026)

Ela só existia dentro da atividade Bebê, na abertura — quem escreve na
Gratidão nunca ficava sabendo que aquilo virava carta. A descoberta dependia
de abrir OUTRA atividade por acaso e notar um botão novo.

- **`cartaAcabouDeNascer`** (`gratidao.ts`) marca o instante exato em que a
  carta passa a existir — a MESMA lógica de `marcoAtingido` (compara por
  IGUALDADE, e só é seguro porque `total` sobe +1 por guardada, nunca pula).
  Nesse instante, a tela de guardado mostra um cartão — cor rosa da atividade
  Bebê, não o amarelo daqui, porque é ela quem recebe a visita — com "Ver
  carta 💌", que abre a atividade Bebê direto (`aoIrParaBebe`, uma prop nova
  só em `GratitudeBlock`, no mesmo padrão que `babyName` já usa só em
  `BondingBlock` — as quatro atividades passam pelo MESMO `<Chosen>` genérico,
  e cada uma ignora o que não é dela).
- **Depois do instante exato, um link discreto continua** ("💌 Ver a carta pro
  bebê", perto de "Ver todas"): quem chegou a 8 num celular e volta a
  escrever no outro precisa achar a carta de novo, e a descoberta não pode
  depender de estar exatamente naquele dia.
- ⚠️ **`!careMode` é conferido DUAS VEZES** — em `save()`, antes de
  `cartaNova` nascer `true`, e de novo no RENDER do cartão. A bancada
  (`?carta=1&luto=1`) prova por que a segunda checagem importa: ela força o
  estado direto, por cima do portão de `save()`, e foi assim que o cartão
  apareceu para o Modo Cuidado numa captura de tela — a mesma classe de
  defeito que a régua de `humorDaJornada` existe para evitar em toda a
  personagem.
- **Bancada:** `/preview-gratidao?tela=done&carta=1&n=8`. Sem lista de
  atividades para trocar, o botão "Ver carta 💌" não aparece — só o texto do
  cartão, que é o que dava para conferir sem a árvore inteira do app.

### O Bebê aprendeu que o parto já aconteceu (ago/2026)

Auditoria das quatro atividades do jogo: depois do conserto da Gratidão (nota
9,5), o Bebê era a que sobrava mais baixa — nota 6,0. O motivo não era
estética: eram dez cartas fixas (`BONDING_LETTERS`, direto no componente),
giro `day % 10`, todas em tempo PRÉ-natal — e `BondingBlock` nunca recebia
`posParto`. `<Chosen posParto={ehPosParto} .../>` já mandava a bandeira; ela
só era ignorada. Uma mãe com o bebê no colo lia em voz alta "a gente ainda
não se viu" e "quando você nascer, eu canto de novo".

O texto saiu do componente para `src/lib/cartas-do-bebe.ts` — mesma razão de
`gratidao.ts` e `frases-do-mascote.ts`: é o que o dono relê e corrige, e
texto enterrado num componente de dez mil linhas é texto que ninguém revisa.

- ⚠️ **A FASE DECIDE O TEMPO VERBAL, e por isso o campo `fases` funciona ao
  CONTRÁRIO do de `gratidao.ts`.** Lá, pergunta sem `fases` serve em qualquer
  fase, INCLUSIVE pós-parto. Aqui isso incendiaria o defeito de novo — então
  ausente = qualquer fase da GESTAÇÃO, e uma carta de pós-parto só entra na
  roda se for marcada `["pos"]` explicitamente. `poolDaFase("pos")` filtra
  por essa marca, nunca por omissão: **as dez cartas gerais (que valem a
  gestação inteira) NUNCA aparecem no pós-parto**, porque são pré-natais por
  natureza. Testado (`cartas-do-bebe.test.ts` corre regex contra as trinta
  cartas: nenhuma de pós-parto pode conter "quando você nascer" ou variantes;
  nenhuma de gestação pode conter "seu primeiro banho" ou variantes).
- **Dez gerais + dez por trimestre (três em t1, três em t2, quatro em t3) +
  dez de pós-parto = trinta**, pedido explícito do dono. O poço de cada fase
  soma as gerais com as da fase (13 em t1/t2, 14 em t3); o do pós-parto é só
  as dez marcadas. A rotação continua `dia % n` — nunca um passo fixo, mesma
  razão de sempre (`perguntaDoDia`, a lista de manhã do mascote): um passo
  que não é coprimo com o tamanho do poço repete sempre os mesmos itens.
- **`faseDaGratidao` é REAPROVEITADA**, não reescrita: é a mesma pergunta
  ("em que fase da jornada ela está?", corte em 14 e 28 semanas) que a
  Gratidão já resolvia. Duas tabelas de corte divergiriam no primeiro ajuste
  de uma delas — e teria sido exatamente esse tipo de segunda régua que
  deixou o defeito do tempo verbal invisível por tanto tempo.
- **O nome do bebê entra nas cartas fixas** (`{bebe}` → `cartaComNome`), e
  cai em "meu amor" sem nome cadastrado — `babyName` já chegava no componente
  e não era usado por nenhuma das dez originais.
- **O rastro de leitura** (`LeiturasDeCartas`, chave `dc-path-cartas-lidas`,
  mesmo padrão de `EX_NOTAS_KEY`/`MED_LOG_KEY`): sem ele, a repetição
  inevitável (30 cartas para até 384 dias) era invisível — ela relia sem
  saber que estava relendo. `registrarLeitura` grava o instante ANTES de
  sobrescrever, e a frase que a tela mostra ("Você leu esta carta há 2
  semanas") lê o valor ANTERIOR — gravar primeiro e ler depois mostraria
  sempre "hoje". Só grava quando ela LÊ a carta do dia até o fim
  (`phase === "done"`), nunca a carta feita das gratidões dela (que não tem
  `id` estável), e fora de `canEarn`/`careMode` de propósito: é informação,
  não recompensa — a bancada (`canEarn={false}`) precisava continuar
  mostrando o rastro.
- **A bolha entrou nesta tela** — era a única das quatro atividades sem o
  porta-voz. Substitui o 💌 flutuante da abertura (decorativo, sem
  informação) e fala o que era mudo: o rastro de leitura, ou um convite
  sensível à hora do dia (madrugada/noite têm abertura própria, mesma régua
  de `frases-do-mascote.ts`). ⚠️ **No final ela NÃO repete "ele ouviu sua
  voz"** — o parágrafo do "Beijo entregue" já diz isso, e duplicar seria eco;
  a fala da bolha ali é complementar ("Guardei esse minuto com você. 💛"),
  pequena (72px, contra 96px na abertura), a mesma distinção de tamanho que
  separa clímax de acompanhamento em outras telas do jogo.
- **Bancada:** `/preview-bebe?w=20&dia=0&nome=Helena` (gestação) ·
  `?pos=1&dia=3` (pós-parto — prova que nenhuma carta pré-natal aparece) ·
  `?fase=done` (o fim) · `?fase=lista` (o álbum) · `?leitura=1` (força o
  rastro) · `?periodo=noite` (força a faixa do dia na fala da bolha). O
  rastro de leitura e a faixa do dia são as duas coisas que dependiam de
  `localStorage`/relógio e por isso eram impossíveis de fotografar sem a
  bancada.

### O álbum, e o pós-parto empatou com a reta final (ago/2026)

Nota 9 tinha três pontas soltas: sem "ver todas", o poço de pós-parto (dez
cartas pra noventa dias) mais raso que o de gestação, e o rastro de leitura
só falado, nunca mostrado. As três fecharam na mesma leva.

- **Pós-parto ganhou quatro cartas** (soluços, o bebê reconhecendo a mãe, o
  primeiro passeio, os detalhes físicos) — de dez para catorze, empatando
  com t3, o poço mais denso da gestação. Total do banco: **trinta e quatro**.
- **`poolDeHoje`** (`cartas-do-bebe.ts`) embrulha `faseDaGratidao` +
  `poolDaFase` numa chamada só — é a MESMA pergunta que `cartaDoDia` já
  fazia pra escolher a carta do dia, só que devolvendo o poço inteiro. O
  álbum (`phase === "lista"`) lê daqui: nunca duplica o corte de semanas, e
  nunca mistura fase — a mesma garantia contra vazar carta pré-natal pro
  pós-parto vale pro álbum inteiro, não só pra carta de hoje.
- **Tocar numa carta do álbum abre a leitura pautada DELA**, não um resumo:
  `abrirDoAlbum` é o mesmo preparo de `begin()` (zera o índice, arma a
  recompensa, liga o som ambiente) só que pulando a tela de intro — ela já
  decidiu o que ler ao tocar no título. `cartaEscolhida` guarda a carta
  personalizada; `close()` zera de novo, senão reabrir a atividade no dia
  seguinte ficaria "presa" na última escolhida do álbum em vez de mostrar a
  de hoje.
- ⚠️ **A legenda do álbum NÃO é `fraseDeUltimaLeitura`.** Escrevi assim
  primeiro e o teste ao vivo (ler uma carta, voltar pro álbum) pegou: essa
  função devolve `null` pra leituras de HOJE de propósito — é o que impede a
  bolha de cutucar "lê de novo" o que ela acabou de ler, na tela de abertura.
  Reaproveitada na legenda da LISTA, o mesmo `null` lia como "Ainda não
  lida" pra uma carta fechada trinta segundos antes — mentira no lugar
  errado. A legenda usa `haQuantoTempo` direto (que devolve "hoje" nesse
  caso): inventário mostra o que aconteceu, nudge evita repetir o óbvio —
  são funções diferentes por serem PERGUNTAS diferentes, não a mesma
  pergunta em dois textos. Testado com uma leitura de ponta a ponta
  (`cartas-do-bebe.test.ts` lê o trecho da fonte e recusa o uso errado).
- **Bancada:** `/preview-bebe?w=20&fase=lista` (o álbum da fase) ·
  `?pos=1&fase=lista` (o de pós-parto, agora com catorze).

### A bolha ganhou uma sexta expressão, pra Aula (ago/2026)

Pedido do dono: óculos, capelo e livro aberto — a "estudiosa" — no lugar do
ícone colorido que só repetia o emoji do card fechado na abertura do quiz.
Era a última das cinco atividades sem NENHUM porta-voz na tela de abertura.

- ⚠️ **Ela NÃO passa por `humorDaJornada`.** As outras cinco respondem "que
  cara ela faz pelo estado da jornada?" (comemorando, dia fechado, madrugada
  etc.); a Aula já decidia o humor do resultado por NOTA
  (`comemorando`/`orgulhosa`/`feliz`, sem tocar a régua da jornada) — a
  estudiosa segue o mesmo padrão local, só que na ABERTURA em vez do
  resultado. `humor="estudiosa"` direto no ponto de uso.
- **A arte veio do Drive numa folha PRÓPRIA** (1254×1254, RGB sem alfa,
  fundo quase-branco — boné de formatura, óculos, livro com coração
  dourado), sem as outras cinco do lado. Isso pediu um script novo,
  `scripts/bolha-do-drive.mjs`, porque o recorte de sheet 2×2
  (`recortar-bolha.mjs`) não serve para uma imagem sozinha.
  1. **Recorte de fundo**: mesmo algoritmo de `bebes/do-drive.mjs` — porta
     de croma + rampa de brilho + conexão com a borda (flood fill), depois
     des-premultiplica. Preserva os brancos ENCERRADOS (lente dos óculos,
     página do livro) porque eles não alcançam a borda sem atravessar
     contorno — a mesma lição do reflexo na testa do bebê.
  2. **Encaixe na MESMA esfera das outras cinco** (663px de diâmetro,
     centro 459×396 numa tela de 960×960 — sem isso a bolha muda de
     tamanho ao trocar de humor). ⚠️ **Medir por bounding box simples não
     funciona aqui**: boné (canto superior esquerdo) e livro (base) fazem
     a caixa do "não-fundo" inteiro ser bem maior que a bolha em si. A
     medida saiu de AJUSTE DE CÍRCULO por mínimos quadrados sobre a borda
     DIREITA — a única sem acessório sobreposto do topo à base — numa
     faixa vertical medida à mão (linha a linha, impressa no terminal): a
     rejeição de outlier automática sozinha convergia pro círculo errado
     (o brilho decorativo do lado direito, mais estreito, "vencia" a
     bolha), porque ela precisa de uma maioria limpa de pontos pra
     começar, e sem a faixa certa não tinha.
- **Conferido por sobreposição**: um canvas desenha feliz.webp e
  estudiosa.webp uma sobre a outra a 50% de opacidade, com um círculo
  vermelho na esfera-alvo — a borda da bolha nova acompanha o círculo de
  perto nos quatro lados. Visto também nos dois tamanhos que ela realmente
  usa (76px na bancada de humores, 104px na abertura da Aula).
- **Bancada:** `/preview-bolha` (chip "estudiosa" nas Ações, e a fileira de
  Humores no fim) · `/preview-jogo?tela=jogos&dia=139`, tocar em "Aula de
  hoje" → "Fazer a aula de hoje" (a única forma de ver o ícone de verdade,
  porque a tela de abertura do quiz só existe depois de abrir a atividade).

### A sétima expressão (exercício), e o script aprendeu sozinho (ago/2026)

Pedido do dono: faixa de cabelo, halter e bola de pilates — "exercício" —
na abertura do Mexer, que era a ÚLTIMA das cinco atividades do jogo sem
NENHUMA aparição da bolha (nem abertura, nem fim).

- **`humor="exercicio"` direto no ponto de uso**, mesmo padrão de
  `estudiosa`: não passa por `humorDaJornada` porque a pergunta aqui não é
  "que cara ela faz pela jornada", é "o que ela está fazendo agora".
  Colocada na tela de ESCOLHA (`phase === "escolha"`, onde ela pergunta "o
  que está incomodando?") — é o mesmo lugar onde `estudiosa` entrou na
  Aula, a abertura, não o resultado.
- ⚠️ **`scripts/bolha-do-drive.mjs` precisou de dois reforços** — a arte de
  `exercicio` tem acessórios grudados nos DOIS lados (halter à esquerda,
  bola de pilates à direita), e a faixa vertical fixa que serviu pra
  `estudiosa` (uma medida à mão, específica daquela arte) não existia
  aqui.
  1. **Componentes conexos**: antes de ajustar o círculo, o script rotula a
     máscara de alfa por 4-vizinhos e fica só com o MAIOR componente. Os
     brilhos, faíscas e bolhinhas soltas ao redor da bolha (que antes
     precisavam de uma faixa vertical escolhida à mão pra ficarem de fora)
     agora saem sozinhos — são componentes pequenos e separados. Isto NÃO
     separa halter/bola: eles encostam na bolha e continuam no mesmo
     componente que ela.
  2. **Faixa limpa por DETECÇÃO, não por medida manual**: o script varre a
     largura do componente principal linha a linha e acha a maior
     sequência contígua em que a largura muda pouco de uma linha pra
     outra — é exatamente aí que nenhum acessório grudado está alargando
     a silhueta naquela altura. Pra `exercicio` isso achou sozinho a faixa
     y=270–635 (o hemisfério de cima, entre a faixa de cabelo e onde
     halter/bola começam a contar); o valor bateu com uma conta manual de
     conferência quase pixel a pixel (609,6/582,7/696,3 medido à mão contra
     609,6/583,0/696,4 do script).
- ⚠️ **A escala teve que CEDER pra caber** — é a primeira vez que isso
  acontece por script, e a regra já existia em prosa desde as artes
  originais ("bolha um tico menor é melhor que chapéu cortado ao meio"),
  só nunca tinha sido CALCULADA: o halter e a bola sozinhos ocupam 92% da
  largura da arte original (1254px), bem mais que qualquer acessório
  anterior. Escalando pra bater o diâmetro exato (663px), os dois
  estourariam os 960px da tela. O script agora mede o bounding box do
  componente PRINCIPAL inteiro (não só da esfera) nos quatro lados e reduz
  a escala até ele caber, com 2% de folga — a bolha de `exercicio` saiu uns
  15% menor que as outras seis, e é um tico menor, não um acessório
  cortado.
- **Bancada:** `/preview-bolha` (chip "exercicio") ·
  `/preview-jogo?tela=jogos&dia=139`, tocar em "Movimento" → abre direto na
  tela de escolha.

### A Aula pedia dois toques, e a Meditação não tinha bolha nenhuma (ago/2026)

O dono testou no aparelho de verdade: o halter do Mexer apareceu, o boné da
Aula não. As duas expressões estavam OK no código e no deploy — o problema
era de CAMINHO, não de arte.

- ⚠️ **`DailyQuizBlock` nunca recebia `aoSair`.** As outras quatro atividades
  (Bebê, Gratidão, Movimento, Meditar) abrem `<Chosen aoSair={() =>
setOpenKey(null)} .../>` — e cada uma tem `useState(!!aoSair)`, que já
  nasce ABERTA na tela cheia quando vem da lista. A Aula é renderizada à
  parte (`openKey === "aula"`, fora do `<Chosen>` genérico) e nunca ganhou
  essa prop: tocar "Aula de hoje" só trocava pra visão da Aula, que ainda
  mostrava o CARTÃO RECOLHIDO dela (ícone colorido, botão "Fazer a aula de
  hoje") — a bolha só existe na tela cheia, um segundo toque adiante. Era a
  única das cinco atividades pedindo dois toques pra chegar onde a bolha
  mora. Testado (`img.bolha-corpo` aparece depois de UM toque só, igual às
  outras quatro).
- **Meditar ganhou a bolha que faltava** — era a única das cinco sem
  NENHUMA aparição na abertura (só a respiração silenciosa dela durante a
  sessão). Entrou em `humor="feliz"`, PROVISÓRIO: o dono vai mandar uma arte
  de "meditando" própria, e a troca é uma linha só (nenhuma outra tela
  referencia esse humor específico).
- ⚠️ **Regra que passou a valer pra sempre**: toda atividade do jogo mostra
  a bolha assim que abre — não é polimento de uma vez, é padrão. Uma
  atividade nova sem bolha na abertura é a exceção que quebra a regra, e a
  próxima a mexer aqui deve entrar já com ela.
- **Bancada:** `/preview-jogo?tela=jogos&dia=139`, um toque em "Aula de
  hoje" (antes precisava de dois) e um toque em "Meditar".

### A bolha cresceu e passou a falar em balão nas cinco abas (ago/2026)

O dono viu no aparelho: a bolha do Mexer estava pequena e a frase embaixo
dela era texto solto, não fala. "Ele que vai interagir com as pessoas."

- **`BolhaComBalao` ganhou `humorFixo`** — até aqui ela SÓ aceitava o humor
  de `humorDaJornada` (era a regra: nenhum ponto de uso escolhe a cara
  dela). `estudiosa`/`exercicio`/o `feliz` provisório do Meditar são
  identidade de ATIVIDADE, não estado da jornada — a mesma exceção que já
  valia pro `<Bolha humor="estudiosa">` cru antes desta mudança, só que
  agora com balão. ⚠️ **Nunca `"comemorando"` por aqui** — quem decide festa
  continua sendo só `humorDaJornada` — e mesmo se alguém usasse errado, o
  `Bolha` interno já rebaixa `comemorando` pra `feliz` sozinho no Modo
  Cuidado, então o pior caso continua seguro.
- **O parágrafo descritivo virou a FALA dela.** "Diga o que está
  incomodando, que eu monto a sequência pra você" (Mexer), "Vamos aprender
  uma coisa nova hoje?" (Aula, ou "Bora rever o que você já aprendeu?" na
  revisão), a sequência de dias ou o convite padrão (Meditar) — texto que
  antes era `<p>` descritivo agora sai da boca dela, em balão, do mesmo
  jeito que Gratidão e Bebê já faziam.
- **168px nas cinco abas** — o Mexer/Aula/Meditar novos já nasceram nesse
  tamanho; Bebê e Gratidão (que já tinham bolha+balão de rounds anteriores)
  subiram de 96 pra 168 pra não ficar menor que as três novas. Só a
  abertura de cada atividade mudou — as telas secundárias (a lista de
  cartas do Bebê, "Ver todas" da Gratidão, o resultado da Aula) mantêm o
  tamanho próprio que já tinham, com a razão de cada uma documentada onde
  está.
- **Bancada:** `/preview-jogo?tela=jogos&dia=139`, um toque em cada uma das
  cinco atividades.

### A oitava expressão (apaixonado), e o Bebê ganhou escolha de som (ago/2026)

Pedido do dono: coração-nos-olhos pro Momento com o bebê — "todas as
páginas têm que ter o bebê bolha quando entrar" continua valendo, e esta é
a primeira vez que uma atividade ganha uma expressão sua ANTES de precisar
de uma provisória (diferente do `humorFixo="feliz"` que a Meditação ainda
usa).

- **A arte já chegou com alfa de verdade** — diferente de `estudiosa` e
  `exercicio` (RGB, fundo quase-branco). `scripts/bolha-do-drive.mjs`
  ganhou a mesma checagem de `bebes/do-drive.mjs` (`temAlfaReal`, canal que
  varia de verdade) e PULA o recorte de fundo quando ela já existe —
  reestimar transparência por cima de uma real trocaria uma verdade por uma
  aproximação pior. O resto do script (isolar o maior componente, ajustar a
  esfera na faixa sem salto) funciona igual: os corações nos dois lados
  ocupam 94% da largura da arte original, e a escala cedeu (0,66) pra nada
  cortar.
- **Só a abertura do Bebê usa `humorFixo="apaixonado"`.** O "done" (fim da
  leitura) continua em `comemorando` — é o mesmo sinal de "você terminou"
  que Aula, Gratidão e o resto do jogo usam; trocar por `apaixonado` ali
  quebraria essa consistência sem ganhar nada.
- **O som de fundo passou a ser ESCOLHA, não liga/desliga.** Pedido do
  dono: "na aba de momento com o bebê tem o áudio também mas a gente não
  consegue escolher". Era `createBreathAudio` — um tom fixo (174 Hz +
  quinta), próprio desta tela, com um switch binário. Trocou pro MESMO
  motor da Meditação (`createSoundscape`/`SOUNDSCAPES`): dois lugares
  tocando "som de fundo" com dois motores diferentes era garantia de um dia
  divergirem, e a Meditação já tinha resolvido o problema de qualidade dos
  sons (`som-continuo.ts`) que valia a pena herdar de graça.
  ⚠️ `createBreathAudio` **não morreu** — `minha-conta.tsx` ainda usa pro
  marco de semana. Só o Bebê trocou de motor.
- **O ícone abre um sheet**, não alterna direto — mesmo padrão que a
  Meditação já tem (`somNaSessaoAberto`): tocar mostra as quatro opções +
  "Desligar som", em vez de ciclar um estado escondido que ninguém vê antes
  de escolher.
- **Bancada:** `/preview-bolha` (chip "apaixonado") ·
  `/preview-jogo?tela=jogos&dia=139` → "Momento com o bebê" → "Começar a
  ler" → ícone de som no topo da tela.

## A economia ganhou uma nova loja, e as conquistas passaram a esperar o toque (ago/2026)

Cinco pedidos do dono numa noite, na ordem em que ele os deu. Os cinco estão em
`P1`…`P5` no histórico; o que segue é o que sobreviveu à auditoria de cada um.

### P1 · O maior pacote deixou de comprar o catálogo inteiro

O pacote de topo entrega 15.000 🌱 com o bônus, e o catálogo custava **14.894** —
uma compra e não sobrava mais nada para querer. Os 90 itens pagos foram
reajustados por FAIXA e por TIPO (trilha/especial/fundo/clima × 2,14; o resto ×
1,56), e o catálogo foi a **28.979 🌱**: a mesma compra vale ~52%.

- ⚠️ **A loja grátis NÃO se moveu**: 15 itens somando 704 🌱, a parede do 15º
  dia intacta. O reajuste é sobre o que existe DEPOIS da parede.
- **A âncora subiu de 200 para 260** e os catorze degraus baratos desceram para
  a soma continuar 704. Com o premium indo a 1.000, uma âncora de 200 deixou de
  ficar dentro da faixa que ela existe para ensinar.
- ⚠️ **"Jogar perfeito" era medido no ritmo TÍPICO.** O teste tinha esse nome e
  usava `GANHO_DIA_TIPICO` (35); perfeito é `GANHO_DIA_TETO` (68). No teto o
  ganho orgânico da gestação passa de 81% do catálogo — o fim de jogo entrando
  pela porta da paciente mais engajada em vez da que paga. Hoje há um teste para
  cada um dos dois ritmos.
- ⚠️ **PREÇO NÃO SE ESCREVE EM PROSA.** Uma varredura achou 8 lugares afirmando
  valor que não existe mais, e o pior não era decorativo: `trofeus.ts`
  justificava a escada de desbloqueio com "74 · 240 · 400 🌱" e os itens valem
  65, 550 e 1.000 — a ordem sobreviveu, o argumento não. `loja-coerente.test.ts`
  varre o `src/` casando «"Nome do item" … N 🌱» contra o catálogo.
- **Nenhum conjunto passa de um sexto da jornada** (teste novo). O custo dos
  conjuntos dobrou com o reajuste e o bônus ficou parado — a proporção caiu de
  11% para 6,6% sem ninguém decidir. Importa porque `conjuntos.ts` declara que
  conjunto é a mecânica que mais empurra compra, e as travas contra isso são de
  desenho, não de preço.

### P2 · A conquista não paga mais sozinha — ela espera o toque

Pedido do dono: "a pessoa só vai conseguir pegar as sementinhas quando ela
clicar na conquista, como o Duolingo faz". `grants` nasce vazio e
`resgatarConquista` paga no toque.

- **Nada foi devido a quem já usava o app.** A `dedupe_key` `achievement:<key>`
  sempre existiu, e a versão antiga montava `grants` a partir de TODAS as
  conquistas satisfeitas na checagem (não só as novas) — então o pagamento se
  autocurava, e toda conquista desbloqueada tem a linha. Elas nascem "já
  resgatadas", que é o certo: ela já recebeu.
- ⚠️ **Falha ao LER o que já foi pago não pode virar "tudo por resgatar".**
  `chavesResgatadas` engolia o erro e devolvia `[]` — uma consulta que falhasse
  fazia as 39 conquistas voltarem a pulsar "Resgatar +120 🌱"; ela tocava, o
  servidor respondia certíssimo (`repetido`) e o cartão virava uma data. Hoje
  devolve `null`, e a tela distingue "nenhuma" de "não sei" (`semSaberPagas`).
  Mesma régua de `contarTrofeus` ("falha ao contar RECUSA").
- ⚠️ **O caminho repetido diz alguma coisa.** Todo o retorno visível vivia
  dentro de `if (r.granted > 0)`; no repetido ela tocava um botão que prometia
  moeda e a tela respondia com silêncio — que lê como app quebrado. Acontece de
  verdade com dois aparelhos abertos.
- **A trava de duplo toque é por CARTÃO**, não da grade: era `if
(resgatandoKey) return`, e tocar num segundo cartão sumia sem sinal.
- ⚠️ **Mutação: 5 de 6 passavam verde**, incluindo o **Modo Cuidado
  INVERTIDO** — a pior mutação que já passou nesta base, no teste que dizia
  cobri-la (ele provava só que a string `isCareModeActive` existia). E as fatias
  `slice(indexOf(...))` iam até o FIM do arquivo: a próxima função acrescentada
  passaria a satisfazer os `toContain` sozinha. Refeitos e conferidos por
  mutação, um a um.

### P3 · A Loja de Sementinhas, com o layout do Drive

Três pacotes (15.000 / 6.000 / 1.100 por R$ 99,90 / 59,90 / 14,90), o maior em
cima com a fita "MELHOR VALOR". Abre pelo toque no saldo dentro do Caminho.

- ⚠️ **O layout é funcional AGORA, com `IAP_ATIVO = false`.** A primeira versão
  trocava os três cartões por uma caixa de aviso — ou seja, o layout que o dono
  pediu não existiria até o app entrar na App Store. Hoje os cartões sempre
  aparecem e só o BOTÃO muda: ele explica em vez de cobrar. Há teste, porque
  essa é a afirmação central da tela e nada a travava.
- ⚠️ **A ilustração do pacote grande estava DECAPITADA** — 65% da primeira linha
  opaca, o topo do monte cortado reto. O script não tinha como saber: desenho
  cortado tem exatamente a mesma fração de tinta de um inteiro. A trava nova
  mede a **maior corrida contígua** na borda da caixa CRUA (antes de aparar) —
  contar o total dava falso positivo com as faíscas decorativas, e medir a
  aparada não responde nada, porque `apara()` encosta o enquadramento na tinta
  por definição.
- ⚠️ **A fita "MELHOR VALOR" da referência sai por GEOMETRIA, não por cor.** O
  verde chapado sai fácil; as letras brancas têm uma rampa inteira de
  antisserrilhado (medida: uma dúzia de tons entre o verde e o branco) que
  nenhuma tolerância pega sem comer o saco, que é verde da mesma família. Some
  o COMPONENTE conectado que toca o canto — o saco começa 65px para dentro e não
  toca canto nenhum.
- ⚠️ **Quatro contrastes reprovavam, e o pior era o PREÇO** (2,64:1, branco
  sobre o cinza do botão desabilitado): o texto menos legível da tela era o
  número que ela precisa ler, no estado que 100% das pacientes veem hoje.
  Nenhum texto desta tela é "grande" pela WCAG (o maior é 17px; o corte é
  18,66), então o mínimo é 4,5 — não 3.
- ⚠️ **A tela mandava a paciente comprar "pela loja da Apple ou do Google"** num
  app que não está em loja nenhuma. `ehNativo()` é falso para todas (o app é um
  PWA), então o veredito caía em `canal_errado`. Com a compra desligada ela não
  acontece em canal NENHUM — a ordem inverteu, e o "ainda não está pronta" vem
  primeiro.
- **`careMode` mora DENTRO da loja**, e não só nos dois chamadores: os dois já
  fechavam a porta antes, mas isso é a segunda régua que o projeto proíbe desde
  `humorDaJornada`.
- **Bancada:** `/preview-loja-sementinhas?saldo=118`.

### O bônus da compra virou bolso de presente (ago/2026)

Pedido do dono, no aparelho: "esse bônus, ele só pode ser usado pra você dar
outras sementinhas pras suas amizades, pras suas amigas, pra outras contas".
Mais os números: **10.000 + 2.500 · 5.000 + 1.000 · 1.000 + 100** (só o bônus
do topo mudou — era 5.000).

⚠️ **Isso muda o SIGNIFICADO dos números, não só o valor.** O campo `bonus`
virou **`bonusParaPresentear`**, e a renomeação foi de propósito: era a única
forma de obrigar cada leitor a ser relido. O pior desfecho aqui seria alguém
somar os dois bolsos sem reparar que agora são moedas diferentes.

- ⚠️ **SOMAR É MENTIRA, e por isso o número grande do cartão é a BASE.**
  "Total: 12.500" prometeria 12.500 de poder de compra e entregaria 10.000 —
  a categoria de erro mais cara que uma loja pode ter. `totalDoPacote` virou
  `totalEntregue` (só serve para comparar pacotes) e nasceu `gastavelDoPacote`.
- ⚠️ **A pílula diz PARA QUE SERVE, não só o número.** "+2.500" ao lado de
  "10.000 sementinhas" é somado na cabeça de quem lê mesmo sem estar escrito;
  quem impede isso é a frase, não o layout.
- ⚠️ **O webhook credita DUAS linhas**, com `dedupeKey` diferentes derivadas da
  mesma sessão (iguais, a segunda seria engolida como duplicata e o bônus nunca
  existiria — falha silenciosa). O bônus vai por último: se a segunda falhar,
  ela fica sem o bônus e não sem a base.
- **A fatia do catálogo caiu de ~52% para ~35%**, e a direção é a boa: a razão
  de a faixa existir é impedir que UMA compra feche a coleção. O piso do teste
  desceu de 40% para 30% com essa justificativa escrita.
- ⚠️ **E um teste MUDOU DE AFIRMAÇÃO.** "Os dois caminhos juntos FECHAM" era
  verdade (99,8%); com 2.500 fora da carteira, a soma é ~82%. Baixar o número
  mantendo o nome seria a mentira mais barata do arquivo — um teste verde
  afirmando um desenho que o produto não tem mais. Hoje ele se chama "chega
  perto, e já NÃO fecha", e fechar pede jogo acima do típico ou uma segunda
  compra.

**A tela também saiu de baixo da barra de status.** Ela é `fixed inset-0` e
nunca compensou `--safe-top`: no app instalado o relógio do iOS pousava no ← e
na pílula de saldo. ⚠️ **No navegador de desenvolvimento isso é INVISÍVEL** —
`env(safe-area-inset-top)` vale zero ali —, a mesma armadilha que obrigou os
espaçadores da home a serem medidos com a área segura injetada.

⚠️ **E os controles PINTADOS da referência estavam duplicando.** O comentário
antigo afirmava que os controles de verdade eram "desenhados exatamente por
cima e cobrem". Não cobriam: medido, o botão pintado ia de 21,6 a 68,6px dentro
da arte e o real de 9,8 a 53,8 — sobrava uma meia-lua branca sob ele e sob a
pílula. Casar dois retângulos em toda largura de tela é frágil por natureza, e
2px de erro trariam a meia-lua de volta; então o recorte passou a começar em
**y=155** (`loja-heroi-do-drive.mjs`), abaixo dos controles pintados e acima do
título — medido: nenhum pixel escuro entre y=105 e y=250. O herói caiu de
116 KB para 64 KB (PSNR 42,5 dB), e os controles ganharam **barra própria** na
cor da primeira linha da arte, que lê como continuação do céu.
⚠️ **Remedir essa cor ao mexer no recorte**: ela era a da barra de status do
mockup e ficou 25% azul demais quando o topo mudou.

**Dois textos saíram, a pedido do dono:** o aviso "a compra abre em breve" (a
informação continua — `podeComprar` barra o toque e o `toast` explica no
momento em que ela tenta) e o bloco verde "você ganha Sementinhas todo dia
jogando". ⚠️ **O parágrafo do limite ético FICA** — "Sementinhas compram só
enfeites; nenhuma aula, exame, alerta ou orientação do seu médico depende
delas". É ele que impede a loja de parecer que vende cuidado, e ele não sai.

### P4 · A ofensiva paga, e o presente só existe nas Amigas

Ver a seção própria acima ("A ofensiva passou a pagar, e o presente mudou de
casa"). O que a auditoria acrescentou:

- ⚠️ **O 🎁 aparecia em quem ela NUNCA pode presentear.** A lista é o grafo de
  indicação nos DOIS sentidos, mas `presentearAmiga` só aceita quem ELA trouxe.
  Quem entrou pelo convite de alguém via o botão na linha de quem a trouxe e
  levava "vocês precisam estar conectadas pelo convite" — falso: estão, pelo
  lado oposto. `possoPresentear` vem do servidor.
- ⚠️ **`jaPresenteada` sai do LEDGER**, não de um `Set` do componente. Trocar de
  aba desmontava `AmigasTab` e os 🎁 voltavam ao normal para o servidor recusar
  — o defeito que motivou tirar a porta antiga, sobrevivendo dentro da nova.
- **O botão do PERFIL não tinha portão de Premium nenhum**, e o teste que dizia
  cobrir isso provava só a linha da lista — enquanto o teste vizinho afirmava,
  com `toBe(2)`, que existem duas portas.
- ⚠️ **`ganho += BONUS` somava por fé.** `grantSementinhas` faz `upsert` com
  `ignoreDuplicates` e engole falha num `console.error`: a perdedora de uma
  corrida via "+10 🌱" e o saldo subindo sobre uma linha que não existe. Relê
  depois de gravar, como `presentearAmiga` já fazia.
- ⚠️ **A ofensiva só pagava a quem abrisse a aba Amigas.** Medido no desenho:
  uma dupla de 7 dias cujo lado visita a aba uma vez por semana coletava 20 de
  70 🌱 — e as duas metades recebiam valores diferentes pelo mesmo esforço, que
  é o placar que a aba existe para não ser. O Caminho cobra junto do contador da
  fita, de graça (já é uma ida ao servidor, e a função é idempotente).
- **"Convidar" a 3,69:1 → 5,06.** O 🎁 de 36px → 44 (é o único controle do
  recurso que o dono mandou trazer para cá).

### P5 · As duas lojas

Ver a seção própria abaixo. O que a auditoria acrescentou: esconder não bastava.

## As duas lojas pararam de se encostar (ago/2026)

O app vende duas coisas de naturezas opostas, e elas viviam como duas pílulas da
MESMA fita dentro de "Recompensas": o **Cantinho** vende enfeite por Sementinhas
(moeda que ela ganha cuidando de si, sem dinheiro nenhum) e a **Loja** vende
suplemento, conforto e enxoval por dinheiro de verdade.

Pedido do dono, sem meio-termo: "a loja não é pra estar ali de maneira alguma;
ela já está lá no perfil. A única aba que vai estar ali vai ser a de conquistas
e a própria aba onde compra os jogos".

- **A fita ficou com duas pílulas**: Meu Cantinho · Conquistas. Lado a lado, as
  duas lojas liam como duas prateleiras da mesma coisa — e é assim que uma
  paciente toca em "Loja" achando que vai gastar o que juntou e encontra um
  carrinho de compras.
- ⚠️ **Ela NÃO foi apagada — virou DESTINO PRÓPRIO** (`tab: "Loja"`, ao lado do
  Perfil), com porta no celular (`MenuDaConta`) e no computador (a categoria
  "Conta"). Apagar o caminho apagaria a loja inteira do app da paciente, que é
  outra decisão.
- ⚠️ **A PRIMEIRA VERSÃO ESCONDEU EM VEZ DE MUDAR DE LUGAR, e custou dois
  defeitos.** Ela virou uma sub-aba INVISÍVEL de "Recompensas", alcançada por
  `initialSub="loja"` vindo do menu. Uma auditoria mediu:
  1. **o computador ficou sem porta** — `MenuDaConta` inteiro vive dentro de um
     `md:hidden`, então a pílula ERA a única entrada do desktop;
  2. **a sub-aba grudava** — a fita de abas do desktop chamava `setTab` cru, que
     não limpa `consultasSub`: toda visita a "Recompensas" reabria a Loja, e com
     a fita escondida o Cantinho ficava inalcançável por ali.

  E a corrente do menu até a tela tinha TRÊS elos no meio (repassar a sub-aba,
  gravá-la, aceitá-la) que nenhum teste cobria — mutar qualquer um passava
  verde. Destino próprio mata os dois defeitos e some com os três elos.

- **A fita do desktop passou a navegar por `goToTab`**, e não por `setTab` — é
  ele que limpa a sub-aba pedida. Vale para todos os hubs, não só para este.
- `src/lib/duas-lojas.test.ts` cobra as **duas metades ao mesmo tempo** — fora
  da fita, e viva pelo menu. Uma sem a outra é o defeito de volta ou uma loja
  inteira desaparecida.

## O compasso da respiração, e uma voz de cada vez (ago/2026)

O dono ouviu a meditação e trouxe três coisas: que as frases se sobrepunham,
que "parece que algumas nem são lidas", e que o ritmo estava corrido. As três
foram medidas antes de qualquer mudança.

- **Todas as 191 falas têm áudio** — a impressão de "não lidas" tinha outra
  causa: ⚠️ **os dois canais tocavam ao mesmo tempo**. Medido: 11 das 24
  instruções de uma sessão de dez minutos saíam com "Inspire/Segure/Solte" por
  cima, e no primeiro minuto de QUALQUER sessão isso acontecia em todas. Dois
  canais existem para uma fala não CORTAR a outra; não para as duas falarem
  juntas. Agora a palavra do compasso cala quando há instrução na respiração.
- ⚠️ **Duas instruções não caem mais em respirações seguidas**
  (`ESPACO_MINIMO`). Antes caíam a cada 14 s em onze pontos. A exceção é
  estreita: se o espaçamento fizesse uma das cinco partes do arco ficar sem
  fala, ela entra colada — perder a volta ao corpo é pior.
- **O compasso passou de 4-2-6 (12 s) para 4-4-6 (14 s)**, que é o padrão de
  dormir do Headspace. Os outros: box 4-4-4-4 (16 s) e 4-7-8 (19 s) — o nosso
  era o mais curto de todos, e o "segure" de 2 s não dava tempo de o corpo
  fazer o que a palavra pediu.
- ⚠️ **O ritmo NÃO depende da duração escolhida**, e nunca dependeu: `RESPIRO`
  é constante. O que mudava com a duração era a DENSIDADE das instruções, e era
  isso que fazia a sessão de 1 min parecer acelerada. Há teste cobrando os dois.
- ⚠️ **`ciclosDe` arredonda para CIMA.** Com 14 s, um minuto virou 4,3
  respirações — e com `round` a sessão de 1 min perdia uma das cinco partes.
  Com `ceil` são 70 s, que é a duração que a antiga Respiração guiada tinha.
- **O compasso mora num lugar só** (`meditacao-sessao.ts`). Eram dois números
  que precisavam concordar, e nada obrigava isso.
- **O piso de densidade de voz caiu de 15% para 12%**, de propósito e
  documentado: o espaçamento tirou seis falas de uma sessão de dez minutos.
  Continua sendo 2,6× o que a auditoria mediu na versão original (5,5%).
- **A amostra de 10 s do som de fundo**: tocar no chip toca o som e ele para
  sozinho — dá para folhear os quatro antes de escolher. ⚠️ É uma instância
  PRÓPRIA, nunca o `audioRef` da sessão: se dividissem o objeto, o relógio da
  amostra pararia o som da meditação dez segundos depois de ela começar.

## A frase de fechamento passou a terminar de tocar (ago/2026)

O dono relatou: uma frase apareceu na tela ("Vamos voltar devagar. Comece
mexendo os dedos das mãos.") e não foi falada. `volta-1.mp3` existe e está
correto — o defeito era de TIMING, não de arquivo faltando.

- ⚠️ **A CAUSA:** `planejarSessao` garante "cada janela recebe pelo menos um
  ciclo", e para sessões de 1, 2 e 5 minutos a janela `volta` só tem espaço
  para UM ciclo — que é literalmente o ÚLTIMO da sessão inteira (medido
  rodando o planejador de verdade). O relógio da respiração termina a sessão
  no segundo exato em que aquele ciclo acaba, e o efeito "cala a voz ao sair
  da sessão" cortava os DOIS canais (`guia` e `pulso`) nesse instante — sem
  dar à fala de fechamento a chance de terminar, numa rede mais lenta ou só
  pela variação normal de quando o áudio termina de carregar.
- ⚠️ **O CONSERTO É NO RUNTIME, NÃO NO PLANO.** Alongar `totalCiclos` quebraria
  um teste deliberado ("o compasso é o mesmo em 1 e em 10 minutos" —
  `meditacao-sessao.test.ts`): a duração é `ciclosDe(minutos) * CICLO`, e
  nada mais. Reduzir o espaço da janela `volta` para reservar um ciclo de
  folga arriscava ESPREMER a fala de fechamento a zero nas sessões mais
  curtas — pior que o defeito original. A correção certa foi separar os dois
  canais: ao sair da sessão, só o `pulso` (as três palavras do compasso) é
  cortado na hora; o `guia` — a fala em si — termina sozinho. `tocar()` já
  para o canal anterior antes de tocar o próximo, então não há vazamento: a
  próxima fala guiada silencia esta sozinha quando chegar a vez dela.
- **Bancada:** `/preview-meditacao` (e `?w=` para a semana, `?luto=1` para o
  Modo Cuidado). `MeditationBlock` não busca nada do servidor para desenhar a
  sessão — o plano é montado no cliente —, então dá pra abrir a sessão
  inteira, do relógio ao sheet de sons, sem conta nenhuma. Foi assim que o
  defeito pôde ser reproduzido e confirmado: sem a bancada, teria sido
  medir às cegas.

### A tela da sessão, quatro pedidos numa noite (ago/2026)

- ⚠️ **"Encerrar por aqui" saiu — dos DOIS lugares onde existia** (a sessão
  ativa e o véu de pausa). Pedido do dono: "se a pessoa quiser sair é só
  clicar no X". Os dois botões faziam EXATAMENTE a mesma coisa que o ✕ já
  fazia (`encerrarGuardando`, guardando a sessão a partir de um minuto) — e o
  app cobrava dela saber a diferença entre dois caminhos para o mesmo lugar.
  O ✕ fica ACIMA do véu de pausa (`z-30` contra `z-20`), então continua
  alcançável enquanto ela está parada.
- **"Calma · 2 min restantes" saiu**, e um contador foi para o lado da barra
  de progresso — pedido do dono: "a barra já mostra a evolução". Formato
  "3m" enquanto falta um minuto ou mais; "59s", "58s"... segundo a segundo só
  depois disso.
  ⚠️ **É FLOOR, não CEIL** — e a diferença apareceu na primeira sessão
  testada ao vivo: `ciclosDe` arredonda o total para CIMA em ciclos inteiros
  (3 min viram 3min12s de verdade), e com CEIL o contador abria em "4m"
  enquanto ela tinha tocado em "3 min". Floor abre no número que ela
  escolheu.
  ⚠️ **NÃO É o contador regressivo que já saiu daqui uma vez** — aquele
  contava por FASE da respiração (4→1, depois 2→1, depois 6→1: três máximos
  diferentes por ciclo) e foi removido por isso. Este conta a SESSÃO INTEIRA
  por relógio de verdade (`Date.now()`), nunca reseta a cada respiração, e
  congela durante a pausa como a barra já fazia — a pausa desconta do
  relógio (`inicioSessaoRef` salta para a frente pelo tempo pausado), senão
  dez minutos atendendo a campainha descontariam dez minutos do contador.
- **O ícone da voz virou SVG desenhado** — pedido do dono: "mude o emoji, ele
  está muito feio". Um balão de fala com duas linhas por dentro, mesma
  lógica do 📞 preto no iOS: emoji renderiza diferente em cada sistema.
- **O ícone de som abre um sheet dentro da sessão**, em vez de alternar
  direto entre o som escolhido e o silêncio. Pedido do dono: "que a pessoa
  consiga abrir uma aba com os sons disponíveis para mudar dentro do
  exercício". Lista `SOUNDSCAPES` (sem o item "silêncio", que virou o botão
  "Desligar som" no final da lista, separado dos chips de trilha para não
  se confundir com mais uma escolha de som).

## Os sons foram refeitos, com medição (ago/2026)

O dono disse que os sons estavam ruins. A auditoria mediu, e ele tinha razão:

| medida                           | chuva              | mar               | coração       | pad               |
| -------------------------------- | ------------------ | ----------------- | ------------- | ----------------- |
| fator de crista (antes → depois) | 4,25 → **8,30**    | 6,49 → **9,89**   | 8,37 → 7,73   | 1,91 → **2,94**   |
| auto-similaridade a 2 s          | 0,997 → **−0,002** | 0,794 → **0,014** | 0,225 → 0,012 | 1,000 → **0,292** |
| energia acima de 1 kHz           | 92% → **61%**      | 26% → 22%         | 2% → 0,3%     | —                 |

O que cada número dizia:

- **Chuva com zero transientes e 92% da energia acima de 1 kHz** é chiado de TV,
  não chuva. Chuva é feita de GOTAS — milhares de impactos individuais.
- ⚠️ **Auto-similaridade de 0,997 a dois segundos**: o sinal era 99,7% idêntico
  a si mesmo dois segundos depois. Era o laço de 2 s do ruído, e o ouvido o
  reconhece em menos de um minuto. Agora o laço tem 10 s (6 no coração, cujo
  "shhh" é cortado em 320 Hz e não precisa de tanto).
- **Mar com 63% abaixo de 125 Hz e nenhum transiente** é ronco. Onda tem
  quebra: estouro largo, espuma decaindo, e a sucção (o corte SOBE enquanto o
  volume desce).
- **Pad com crista 1,91** é tom morto. São quatro vozes desafinadas em 0,6 Hz —
  o batimento entre elas é o que o ouvido lê como respiração do som.

Três correções de base: **ruído ROSA** (energia igual por oitava, que é como
soa tudo que a natureza faz) no lugar do branco, o laço 5× mais longo, e
**eventos** (gota, quebra) em vez de só filtros.

- ⚠️ **CURTOSE É A MÉTRICA ERRADA PARA CHUVA.** Passei uma rodada tentando subir
  a curtose do envelope, e ela mede ESPARSIDADE: o coração dá 15,6 porque é
  silêncio-silêncio-batida. Chuva é densa por natureza e nunca pontua alto
  nisso. O que mede chuva é a CRISTA e a razão envelope-máximo/mediano.
- ⚠️ **Três gotas por segundo, não doze.** A primeira tentativa pôs doze, e elas
  se sobrepõem (cada uma dura 25–70 ms) voltando a formar a cama contínua que
  vieram consertar.
- **Uma receita só** (`montar()` em `som-continuo.ts`), usada pelo render dos
  Sons para dormir E pelo som ao vivo da meditação. Eram duas cópias; consertar
  em dois lugares é garantir que um dia divergem. Ao vivo, os eventos são
  agendados por janelas de 20 s (`JANELA_SEGS`) — um `AudioContext` só aceita
  agendamento no futuro, e sem a janela a chuva pararia de pingar.
- **A amostra do som passou de 10 s para 5 s**, a pedido do dono: dez faziam
  folhear os quatro custar quase um minuto, e a decisão acontece nos primeiros
  dois segundos.

### O compasso foi a 16 s (4-4-8)

Pedido do dono: "aumente para 16 ou 19".

⚠️ **16 e não 19, e a razão é clínica.** Dezenove seria o 4-7-8, e o que faz
dele 19 é uma **apneia de sete segundos** — desconfortável para quem está
começando e, na gestação avançada (diafragma empurrado para cima, reserva de
oxigênio menor), é a parte que a gestante abandona primeiro. O que acalma não é
a pausa: é a EXPIRAÇÃO LONGA, que aciona o vago. Então os dois segundos a mais
foram todos para o "solte" — 4-4-8 tem a expiração com o dobro da inspiração.
Ir a 19 é uma linha: `{ in: 4, hold: 7, out: 8 }`.

⚠️ **Com 16 s, um minuto são quatro respirações — e cinco partes não cabem em
quatro.** A repartição antiga espremia a PRIMEIRA janela até zero, e a sessão
de 1 min abria em "deixe o ar entrar pelo nariz", sem acolhimento nenhum.
Agora, quando não cabem as cinco, caem as do MEIO (silêncio, depois ancoragem):
o acolhimento e a volta são as duas pontas do arco e ficam até o fim.

## O Cantinho foi a 111 itens, e ganhou um tipo que não é adesivo (ago/2026)

Pedido do dono: "veja todos os itens, se eles se complementam — por exemplo um
item de emoji de golfinho e outro de um lago, dá pra juntar; faça uma varredura
completa, veja quais não fazem sentido, classifique os melhores e os piores,
retire os piores, coloque mais 50% de itens, e veja se conseguimos criar outro
tipo de item".

O que a varredura achou nos 74:

- **Sete emojis repetidos**, e quatro deles eram o MESMO desenho vendido duas
  vezes por preços diferentes: 🎈 por 100 (`ceu-balao-ar`) e por 200
  (`especial-balao`); 🌈 por 150 e por 320; 💧 por 45 e por 300; 🌠 por 160 e
  por 250. Não havia como a paciente saber o que estava comprando.
- **Os dois itens MAIS CAROS prometiam comportamento no nome e não o tinham**:
  "Árvore que cresce" (350 🌱) não crescia e "Ciclo dia/noite" (400 🌱) não
  ciclava. "Chuva mansa" (200 🌱) era uma nuvem parada, e "Vaga-lumes" (220 🌱)
  tinha por emoji uma **varinha mágica** 🪄.

### `aposentado` — tirar da loja sem tirar de quem comprou

Quatro itens saíram da VITRINE e de mais nada: continuam em `CANTINHO_ITEMS`,
desenhando na trilha de quem os pagou, contando categoria para a Coroa.

⚠️ **Apagar a linha faria o enfeite sumir do cantinho de quem o comprou**, e
`CANTINHO_BY_ID[id]` devolver `undefined` — que é exatamente como um
`DecorSprite` desaparece sem erro nenhum. É a mesma lição do
`CANTINHO_COMPLETION_MIN`: o app não pode tirar de volta o que já deu.

A loja lê `CANTINHO_LOJA` (ou `CANTINHO_ITEMS` filtrando por `owned`, para o
item aposentado continuar aparecendo em "Meus itens"), e `buyCantinhoItem`
recusa no SERVIDOR — vitrine é cliente, e um pedido montado à mão compraria o
que saiu de circulação.

### O tipo novo: `clima` ("No ar")

Os dez tipos anteriores são todos a mesma coisa por baixo: uma figura POUSADA
num (x, y) com uma animação curta em volta. `clima` não tem lugar — enquanto o
item estiver no cantinho, a tela inteira ganha pétalas caindo, folhas girando,
bolhas subindo. Régua em `src/lib/clima-do-cantinho.ts` (pura, testada).

- **A régua "um tipo só existe se tiver comportamento próprio"** (a mesma que
  criou Luzes e Águas) foi obedecida — e de quebra ele resolveu o que travava a
  ampliação: as categorias de adesivo estão saturadas de emoji (não existe uma
  sexta "luz" reconhecível a 24px que não seja 🔥, ⭐ ou 💡, que são a chama da
  sequência, a estrela do dia e o "Você sabia?" da aula), e o ar estava vazio.
  Pétala, folha, bolha, peninha, neve e poeira de estrela fazem PÉSSIMO adesivo
  e ótimo ambiente.
- ⚠️ **A camada é uma tela grudada no topo (`sticky`), nunca a trilha inteira.**
  A primeira versão cobria a trilha toda e o navegador mediu: das 42 partículas,
  **UMA** estava dentro da tela — a trilha de uma gestação tem ~27.000px, e as
  outras 41 caíam a milhares de pixels dali. Depois: 31 a 33 na tela, e acompanha
  a rolagem.
- ⚠️ **O `overflow-hidden` vai na caixa STICKY**, nunca no invólucro de fora:
  `overflow` num ancestral vira o contêiner de rolagem do `sticky` e a caixa
  deixaria de acompanhar a tela — o defeito que ela veio consertar.
- ⚠️ **`--dc-fim` é um comprimento (`calc(100svh + 4rem)`), nunca `100%`**: numa
  `translate3d`, a porcentagem do eixo Y é da PRÓPRIA partícula, que tem 1rem.
  Idem a deriva lateral, que por isso vem em `vw`.
- **O atraso é NEGATIVO e vai até a duração inteira** — é o que faz a chuva já
  estar caindo quando a tela abre. Com atraso positivo, as catorze pétalas
  entram juntas e depois a tela fica vazia até a próxima volta.
- **`prefers-reduced-motion` PARA, não esconde**: apagar faria a paciente achar
  que o item que ela comprou não veio.
- ⚠️ **A camada é alimentada pelo que ela POSSUI, nunca pelos sprites
  espalhados.** Na primeira versão ela lia `visiblePlaced` — e o clima não tem
  lugar, é a definição do tipo. Com a trilha cheia (120 sprites, cada item
  não-`especial` custando dois), o item recém-comprado não era espalhado,
  `climasAtivos` recebia uma lista sem ele e a camada renderizava `null`: ela
  pagava 200 🌱 na Poeira de estrelas e NADA acontecia — o mesmo defeito que
  "Chuva mansa" e "Vaga-lumes" tinham, reintroduzido pela porta dos fundos.
  Hoje é `decor.filter(ehClima)`, com o portão do Modo Cuidado dentro.
- ⚠️ **E o tipo `clima` NÃO vai para a bandeja do Arrumar.** Ele virava dois
  adesivos parados (💮 🍁 🫧 🪶 🌨️ 💫), gastava duas das 120 vagas de `DECOR_MAX`,
  e apagar esse adesivo esquisito apagava o clima comprado junto. Os layouts já
  gravados também são filtrados. O corte é por TIPO — `especial-chuva` e
  `especial-vagalume` continuam sendo adesivos de verdade, com halo.
- **O mapa é por ID DE ITEM, e não por tipo** (`CLIMA_POR_ITEM`), e é isso que
  conserta `especial-chuva` e `especial-vagalume`: os dois continuam sendo
  `especial` na loja (halo, tamanho, preço) e ganham o ar. Mover um deles para
  o tipo `clima` faria quem só tinha aquele perder a categoria "especial" da
  Coroa — há teste.

### A árvore cresce e o ciclo cicla

`escalaDaArvore(week)` é **MULTIPLICADOR** do tamanho que a paciente escolheu no
modo Arrumar (0,70 a 1,30 entre a 4ª e a 40ª semana), nunca um tamanho absoluto:
um absoluto apagaria a escolha dela toda vez que a semana virasse. Sem semana
conhecida devolve **1**, e não o mínimo — uma muda inesperada lê como item
quebrado.

`faseDoDiaNoite(hora)` recebe a HORA LOCAL já extraída (0–23), nunca um `Date`:
o teste não pode depender do fuso do contêiner, que é o mesmo erro de três horas
que a agenda já pagou. ⚠️ **Nenhuma das quatro faces é emoji de item à venda** —
o teste mudou o código uma vez, quando as faces eram 🌙 (a `ceu-lua`, 140 🌱) e
☀️ (o `ceu-sol`, 120 🌱): a paciente veria na trilha o desenho exato de dois
itens que ela não comprou. Hoje são 🌄 🌞 🌆 🌃.

### ⚠️ OS 37 ITENS NOVOS SÃO TODOS PREMIUM

Escrevi a leva com sete itens sem assinatura ("toda categoria merece uma porta
grátis") e o teste da economia reprovou na hora:
`economia-sementinhas.ts` fixa a loja grátis em **15 itens somando 704 🌱**,
calibrados contra o ganho típico (35 🌱/dia) para a paciente zerá-la por volta
do 15º dia e então **acumular moeda sem ter no que gastar** — que é a decisão de
monetização do dono, escrita lá com todas as letras. Meus sete somariam 410 🌱 e
empurrariam a parede para o 30º dia: eu teria desfeito a mecânica de conversão
inteira enquanto "melhorava a loja".

Item novo entra na prateleira PAGA. A Coroa continua alcançável sem assinar (dez
categorias têm item grátis, e ela pede oito).

### Seis conjuntos novos, e o bônus caiu para 12

Beira do lago 🛶 · Recife 🤿 · Sem pressa 🐾 · Madrugada 🌉 · Chão de floresta 🪵 ·
Cantinho de costura 🪡. **Nenhum conjunto publicado ganhou item** — um quinto
item viraria o selo "4 de 4" de quem já fechou num "4 de 5". Item ANTIGO pode
entrar em conjunto NOVO (a Borboleta mora no "Canteiro florido" e no "Sem
pressa"): isso não desfaz nada.

`BONUS_POR_ITEM` caiu de 15 para 12 porque com catorze conjuntos o total ia a
795 🌱 — mais do que custa a loja grátis inteira, e aí o conjunto deixaria de ser
reconhecimento e viraria a principal fonte de Sementinhas do jogo. O teto do
teste passou a ser DERIVADO do catálogo, e não um 704 escrito à mão.

## A gamificação: cinco defeitos que o jogo tinha (ago/2026)

Varredura pedida pelo dono. Os cinco eram da mesma família — **o Caminho
concedia e não contava a ninguém**.

1. **O saldo não subia durante o dia.** `setSaldo` era chamado UMA vez, na
   montagem. Ela fazia a aula (+18 🌱), as quatro atividades (+20 🌱) e o bônus
   das cinco estrelas (+20 🌱), via os toasts de "+5 🌱", e o número no alto da
   tela ficava igual a tarde inteira. **O contador É a recompensa**: um "+5" que
   não move o número lê como erro do app.

2. ⚠️ **As conquistas do jogo nunca eram concedidas.**
   `checkAndAwardAchievements` rodava em cinco lugares: quatro telas de REGISTRO
   e a aba Conquistas. O Caminho não chamava em lugar nenhum — e é lá que ela
   medita, escreve a gratidão, lê a carta, fecha o dia e ganha troféu. As
   conquistas de meditação, gratidão, carta, exercício e troféu, mais o marco
   semanal de 25 🌱 e os dois de trimestre, só chegavam se ela por acaso abrisse
   a aba Conquistas ou registrasse uma pressão.

3. **O troféu não explicava nada.** Era um número roxo com
   `title="Figurinhas coletadas"` — texto de quando ele contava figurinhas, e
   mentira desde que passou a contar dias de cinco estrelas. E
   `proximoDesbloqueio`/`escadaDeTrofeus` existiam, com teste, e **zero
   chamadores**: a escada estava escrita e nunca foi mostrada a ninguém. Hoje o
   número abre `FolhaDosTrofeus`, com "faltam 4 🏆" (que dá o que fazer) em vez
   de "bloqueado" (que só informa que ela não pode).

4. **O bônus das cinco estrelas sumia numa falha de rede.**
   `grantDayStarsBonus` era chamada uma vez, num `try/catch` que engole — e
   `!doneDays.includes(D)` já marcava o dia como fechado no aparelho, então
   nunca havia segunda tentativa. Agora é reconferido na abertura seguinte (hoje
   e ontem; o servidor aceita ±1 dia). Seguro por construção: ele dedupa pela
   chave E reconfere as quatro linhas de bem-estar antes de pagar.

5. **Um dia perdido zerava a sequência.** Ver abaixo.

⚠️ **UMA CONQUISTA SÓ É COMEMORADA E CREDITADA UMA VEZ POR SESSÃO**
(`jaCelebradas`, em `minha-conta.tsx`). O ouvinte de `dc-sementinhas` agenda a
checagem, e a checagem termina em `creditarSementinhas` — que dispara o mesmo
evento. O que fechava o ciclo era só a expectativa de o `upsert` de
`patient_achievements` gravar, e esse caminho de falha está ESCRITO em
`achievements.functions.ts`, com um comentário admitindo que "na próxima
checagem ela é nova de novo". Era inofensivo quando a próxima checagem era a
próxima ação da paciente; depois que o Caminho passou a disparar, é 1,5 s
depois, para sempre. A trava é local e não depende do banco: sem chave nova não
há crédito, sem crédito não há evento, sem evento não há laço.

**O recado mora em `src/lib/evento-sementinhas.ts`**, arquivo próprio e sem
imports: os seis pontos que concedem estão em componentes distintos e fundos de
árvore diferentes, e uma prop por todos seria seis assinaturas novas e uma
sétima esquecida no bloco seguinte. ⚠️ E **arquivo separado, não uma constante
exportada de `gestacao-path.tsx`**: `minha-conta` carrega a trilha por `lazy()`,
e um `import` estático de qualquer símbolo dela puxaria os 91 KB do módulo de
volta ao pacote principal, desfazendo a divisão que a rodada de desempenho
acabou de fazer.

### A chama perdoa um dia

Um único dia em branco zerava tudo. Numa gestação de alto risco isso não é rigor
de jogo: é a paciente que passou a noite no pronto-socorro **perdendo quarenta
dias por causa da internação** — o app transformando o pior dia dela no dia em
que ele também a puniu.

A régua (`DIAS_POR_PERDAO = 7`, em `sequencia.ts`): um dia perdido é perdoado, e
ganha-se um perdão a cada sete dias já contados.

- **Um dia, não dois**: se ela sumiu por dois dias seguidos a sequência acabou
  mesmo, e dizer o contrário faria o número deixar de significar "eu vim quase
  todo dia".
- **Proporcional, não fixo**: quem tem três dias não precisa de proteção; quem
  tem duzentos precisa muito. O perdão cresce com o que há a perder.
- **Quem alterna um dia sim, um dia não nunca sai de 1** (`floor(1/7)` é 0). Há
  teste, e há teste para dois dias em branco quebrarem por mais longa que seja.
- A mudança só faz a sequência SUBIR. Voltar atrás é trocar a constante por
  `Infinity`.
- As três contagens (gestação, pós-parto, meditação) já delegavam à mesma
  função, então o perdão vale nas três sem uma linha a mais.

#### ⚠️ A PRIMEIRA VERSÃO NÃO PERDOAVA NADA — e o texto desta seção mentia

Escrito aqui na primeira redação: _"o saldo é conferido contra o que já foi
contado NESTE trecho"_. Era verdade sobre o código, e era exatamente o defeito:
o buraco que importa é o mais RECENTE, e nele o que já foi andado ainda vale 0.
`perdoados >= Math.floor(0/7)` é verdadeiro, e o laço quebrava. Medido:

```
sequenciaDeDias([1..40], 42)      → 0    (devia ser 40)
sequenciaDeDias([1..40, 42], 42)  → 1    (devia ser 41)
```

O perdão só valia para buracos com sete dias contados DEPOIS deles — nunca para
a noite no pronto-socorro, que é o único caso para o qual ele foi escrito. E a
`FolhaDaChama` dizia por escrito "você pode ficar até 5 dias de fora" enquanto a
conta zerava: **prometer e não cumprir é pior que não falar do perdão**.

Os sete testes da primeira versão punham o buraco 10+ dias atrás de hoje, e
todos passavam. O caso do produto não tinha teste. Achado por uma revisão
adversarial do diff, reproduzido antes de mexer numa linha.

**A régua deixou de ser "posso atravessar este buraco?"** e virou uma afirmação
sobre o trecho inteiro: _a sequência é o MAIOR trecho terminando em hoje (ou
ontem) em que os vazios são no máximo `floor(diasFeitos / 7)`, sem dois vazios
seguidos_. A varredura junta os BLOCOS de dias feitos e só depois pergunta
quantos cabem no saldo — e percorre TODOS, porque o saldo cresce em degraus de
sete e um bloco grande logo atrás pode pagar uma ponte que o pequeno da frente
não pagava.

⚠️ **E a chama explica isso** (`FolhaDaChama`, aberta pelo toque no número):
**perdão que ninguém sabe que existe não acalma ninguém**. O número de folgas
vem de `perdoesRestantes`, a MESMA varredura — a tela mostrava
`Math.floor(streak / 7)`, o saldo TOTAL, ignorando o que já tinha sido gasto.
Nenhuma frase cobra.

⚠️ **A bancada fabrica a LISTA, não o número.** `?streak=41` cravava só o
contador e deixava o saldo vir da jornada real (vazia), então a folha abria
sempre no texto de sequência curta — a bancada mostrava um estado que o app
nunca produz, que é o oposto do que ela existe para fazer.

**Bancada:** `/preview-jogo?trofeus=12` (a escada) · `?streak=41` e `?streak=3`
(as duas versões do texto do perdão) ·
`/preview-jogo?clima=clima-petalas,clima-folhas` (a camada No ar).
