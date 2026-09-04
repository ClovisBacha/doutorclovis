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

### ⚠️ A loja do celular ganha LINK, não instrução

Pergunta do dono: "na Apple o plano não deve cancelar dentro da aba de
assinaturas?". Sim — e por regra da Apple/Google **o app não consegue cancelar**
uma assinatura comprada pela loja. A primeira versão desta tela já detectava a
origem, mas mandava "use Ajustes → Apple ID → Assinaturas" **em texto**. Navegar
quatro níveis de menu do sistema de cabeça é o atrito que faz a paciente pedir
estorno no cartão em vez de cancelar.

Virou botão para o endereço oficial (`apps.apple.com/account/subscriptions` e o
equivalente da Play Store).

⚠️ **`https://`, NUNCA `itms-apps://`**: o esquema nativo não existe no
navegador nem no Android, e num PWA instalado o link simplesmente não faria
nada — sem erro nenhum. O `https` da Apple redireciona para a tela nativa no
iPhone e continua sendo página útil em qualquer outro lugar.

### ⚠️ A PACIENTE NUNCA ASSINA PELO STRIPE — e a tela assumia o contrário

Confirmação do dono: **Stripe é só do site, e só o MÉDICO assina lá; a paciente
assina pela App Store / Play Store.** `canal-de-venda.ts` já dizia exatamente
isso (`CANAL_DE.premium_paciente === "app"`), e a tela que eu tinha acabado de
fazer assumia o oposto.

A régua era um booleano "é Stripe?" que tratava vazio como SIM. Errava de dois
jeitos, e o segundo já existia em produção:

1. **O padrão estava invertido.** Esta tela vive no app da PACIENTE — "não sei a
   origem" tem de significar LOJA, nunca Stripe.
2. **Faltava o `convite`.** O webhook grava `source: "convite"` para a paciente
   que ganhou um ano de Premium pelo convite do médico
   (`plan: "convite_medico_1ano"`). Ela não paga nada e não tem o que gerenciar
   — e o botão do portal devolvia `sem_assinatura` para ela, um erro numa tela
   que deveria explicar um presente.

Virou `origemDaAssinatura` com três casos: **loja** (padrão) · **stripe** (só
explícito) · **presente**.

⚠️ **E o presente NÃO renova — ele vence.** O `status` dele é `active`, então a
tela dizia "renova automaticamente em 16 de setembro" logo acima de "vale até 16
de setembro": a mesma data descrita como cobrança e como fim, na mesma tela.

⚠️ **A RÉGUA MORA EM `src/lib/assinatura.ts`, E ISSO CUSTOU UMA VOLTA.** Ela
nasceu dentro de `assinatura-tab.tsx`; o teste a importava de lá, e importar do
componente puxa `sonner`, que toca `document` ao carregar. O `bun test` inteiro
caiu com `document.getElementsByTagName is not a function` e **nove testes de
outros arquivos foram junto**. É a mesma lição de `buscar-paciente.ts`,
`frases-do-mascote.ts` e `gratidao.ts`: **régua pura em `lib/`, componente só
desenha.** Há teste cobrando que o componente não a defina.

⚠️ **E isto aponta para uma mudança maior, que ainda não aconteceu:** hoje a
assinatura da paciente é do Stripe apenas por herança. Pela diretriz **3.1.1**,
conteúdo digital vendido dentro do app iOS passa por IAP — quando o app for para
a loja, o fluxo migra, e é para isso que `IAP_ATIVO` já existe desligado.

**Bancadas:** `/preview-conta?pendente=1` · `/preview-assinatura?estado=loja`
(`presente` · `ativa` · `cancelada` · `gratuito`). ⚠️ O padrão dela é `loja`, e
não `ativa`: bancada que abre no caso raro ensina o caso errado. ⚠️ A da assinatura **nasceu junto com a
tela** — é a lição do dia aplicada na hora, depois de o campo do onboarding e o
cartão do Perfil terem sido escritos às cegas e só ganharem bancada num remendo.

## O som do app inteiro, e a bancada que faltava (ago/2026)

Pedido do dono: vistoriar todos os efeitos sonoros, acrescentar muitos, cuidar
especialmente da meditação, e "fazer um estudo profundo sobre os Hertz",
começando pelos 432 Hz.

O que existia: **vinte e um sons** — quatro paisagens sintetizadas (chuva, mar,
coração, pad), um tom de respiração do marco semanal, um chime de conquista, e
536 mp3 que são todos VOZ (a Isabella narrando meditação, histórias e a sessão
do casal). **Nenhuma música.** Nenhum sino. Nenhum som de interface além do
chime.

### ⚠️ A BANCADA DE OUVIR VEIO PRIMEIRO, e a razão é a de sempre

Este arquivo conta, com números, como os sons foram consertados: "crista 4,25 →
8,30", "auto-similaridade 0,997 → −0,002", "o degrau na emenda do coração era
0,0443". Cada número decidiu uma linha de código — e **nenhum era
reproduzível**. As medições foram feitas à mão, uma vez, e morreram no terminal.

Quem acrescentasse o quinto som não tinha como saber se ele estava no padrão dos
quatro. E quem escreve este código NÃO OUVE o resultado. É a lacuna que a skill
`/tela` nomeia para layout ("se você não consegue verificar, não entregue"),
aplicada a som.

**`scripts/ouvir.mjs`** renderiza num Chromium de verdade (`OfflineAudioContext`
não existe em Node), lê o WAV CRU — `decodeAudioData` reamostra e INVENTA um
degrau nas bordas, que é exatamente o que se quer medir — e mede sete coisas,
cada uma ligada a um defeito já pago. Modos: sem argumento mede os vinte;
`--niveis` imprime a tabela de ganho ao vivo; `--musica` mede a peça inteira.

⚠️ **Ela já corrigiu TRÊS métricas minhas, e as três mentiam:**

1. **O percentil da emenda** descreve a POSIÇÃO na fila, nunca o tamanho — e
   quem estala é o tamanho. Num pad todos os degraus são minúsculos, então um
   degrau inaudível cai no percentil 100 e "reprova"; numa chuva cheia de gotas,
   um degrau grande cai em 60 e "passa". Provado variando só o aquecimento: o
   percentil pulou 91,5 → 10,4 → 33,4 → 78,7 → 89,5 → 95% enquanto o degrau
   absoluto ficava entre 0,0025 e 0,084, todos muito abaixo do p99. O critério
   virou **degrau contra o p99 dos degraus do próprio sinal** — tamanho contra
   tamanho, autocalibrado por som.
2. **A repetição** era medida no maior período DECLARADO pelo módulo. Falha de
   dois jeitos: quando o período declarado é o trecho inteiro não sobra lag e a
   coluna vira "—", parecendo aprovação; e um som que repita num período que
   ninguém declarou passa batido. Agora ela VARRE os lags.
3. ⚠️ **E ela APROVOU NaN.** O primeiro render da música saiu inteiro em NaN e o
   relatório imprimiu "✅ dentro dos limites": toda comparação com NaN é falsa,
   então nenhum limite disparou. **Ferramenta de verificação que falha ABERTO é
   pior que não existir — ela dá permissão.** Não-finito é a primeira coisa
   conferida agora, nos dois modos.

### A afinação: A = 432 Hz, e o que NÃO pode ser dito

`src/lib/afinacao.ts`. Antes havia três sistemas que não concordavam: o pad em
173,4/174,6/260,1/261,9, a respiração do marco semanal em 174/261, e o chime da
conquista num acorde de números soltos.

⚠️ **O arquivo existe tanto para AFINAR quanto para BARRAR.** Este é um app
médico de gestação de alto risco: "432 Hz acalma" ao lado de uma triagem de
pré-eclâmpsia ensina a paciente que o app afirma coisas sem evidência, e a
próxima afirmação que ela vai desacreditar é a que importa. Há catraca varrendo
o `src/` inteiro, nas duas formas (dura e mole) e contra as alegações nomeadas.

O que a pesquisa em fontes primárias achou:

- **440 Hz é de 1834** (Scheibler, congresso de Stuttgart), ISO R16 em 1955.
  "Os nazistas impuseram o 440" é falso por um século de distância.
- ⚠️ **VERDI QUERIA 435, NÃO 432.** A carta de 1884 diz: "se a comissão acredita
  que devemos reduzir as 435 vibrações do diapasão francês para 432, a diferença
  é tão pequena, QUASE IMPERCEPTÍVEL AO OUVIDO, que me associo de bom grado."
  Ele pediu o padrão francês e aceitou o 432 como arredondamento.
- **"Schumann 8 × 54 = 432" se autodestrói**: a fundamental é 7,83 Hz (7,83 × 54
  = 422,8), e aceitando o 8 arredondado, **8 × 55 = 440**. Os dois são múltiplos
  exatos de 8. Não há nada ali que distinga o 432.
- ⚠️ **"A=432 e C=256" são INCOMPATÍVEIS** no temperamento igual: C=256 implica
  A=430,54, e A=432 implica C=256,87. Só valem juntos num sistema pitagórico que
  ninguém aplica.
- **As Solfeggio** foram inventadas por Joseph Puleo nos anos 1970, publicadas
  por Horowitz em 1999, por redução numerológica (todas reduzem a 3, 6 ou 9).
  Não vêm de Guido d'Arezzo — o solfejo dele é RELATIVO, e não havia como medir
  frequência absoluta antes de 1834. E 528 Hz não é dó em afinação nenhuma.
- **O estudo-âncora é piloto**: Calamassi & Pomponi 2019, _Explore_, n = 33,
  frequência cardíaca −4,79 bpm com **p = 0,05 exato** em 12+ desfechos sem
  correção. Sem replicação independente.
- **E o achado mais decisivo é de percepção**: Van Hedger & Bongiovanni 2023 —
  ouvintes caem ao NÍVEL DO ACASO ao julgar afinação absoluta quando o estímulo
  tem pistas de altura relativa, isto é, quando é música. Ninguém identifica a
  afinação ouvindo música.

⚠️ **E EU TINHA ESCRITO A JUSTIFICATIVA ERRADA.** A primeira versão dizia "mais
grave, centroide mais baixo, percebido como menos tenso". A primeira metade é
verdade (Ilie & Thompson 2006) e a aplicação é falsa: aquelas manipulações são
de SEMITONS A OITAVAS, e aqui a diferença é de 0,32 de semitom. A razão que
sobra é de engenharia — **uma referência só, para drone, sinos, música e
interface não brigarem entre si** —, e ela basta. É gosto, não é remédio.

⚠️ **O que move fisiologia de verdade** (Bernardi, _Heart_ 2006) é ANDAMENTO,
dinâmica e SILÊNCIO — a pausa derruba frequência cardíaca e pressão abaixo do
basal. O desenho da sessão importa mais que a afinação dela.

**A GRADE DO LAÇO:** `noLaco()` encaixa qualquer frequência em múltiplos de
1/30 Hz, que é o que o laço de 30 s exige. O erro segue **28,85/f cents** —
0,72 a 40 Hz, 0,07 a 432. Pior no GRAVE, que é onde estes sons vivem; a prosa
antiga afirmava "0,11 cents", certo para 257 Hz e falso como afirmação geral.

### Os trinta e dois sons

`som-primitivas.ts` (as peças) · `som-receitas.ts` (as trinta e duas) ·
`som-continuo.ts` (WAV, render, tocador). A divisão é por PERGUNTA.

**Águas (8)** chuva · chuva forte · chuva no telhado · chuva no carro ·
tempestade · riacho · cachoeira · mar · lago
**Ar e fogo (4)** vento nas folhas · vento na janela · lareira · fogueira
**Vida (4)** floresta à noite · passarinhos · sapos · cigarras
**Corpo (2)** coração do bebê · ventre
**Tons (5)** pad · drone grave · tigela tibetana · sino de vento · piano esparso
**O quieto (8)** cabine de avião · ventilador · ar-condicionado · secador ·
máquina de lavar · ruído branco · rosa · marrom

⚠️ **Secador, máquina de lavar e ar-condicionado não são enfeite**: são o
repertório clássico de acalmar recém-nascido. Num app de gestação, quem procura
"som de secador" está procurando exatamente isso — e hoje procurava fora do app.

⚠️ **O trovão da tempestade é LONGE de propósito**, e é decisão de produto: um
estouro perto acorda quem estava adormecendo e assusta quem está ansiosa, que
são as duas pessoas para quem esta tela existe. Ataque de 900 ms, corte descendo
de 260 para 70 Hz ao longo de sete segundos — trovão longe não tem estouro.

#### O que separa um som bom de um chiado

⚠️ **O que separa um som bom de um chiado** não é o filtro: é o EVENTO. Chuva é
densidade de impactos; riacho é a BOLHA (frequência de Minnaert, com o deslize
ASCENDENTE — sem ele soa como sino minúsculo); fogo é o AGRUPAMENTO dos estalos
(2,5/s uniformes soam como relógio quebrado); pássaro é a AUSÊNCIA de ruído
(canto é tom puro com trajetória, e quem acrescenta ruído erra).

⚠️ **140 bpm É O CORAÇÃO DO BEBÊ, não o do útero.** O que o feto ouve é dominado
pelo coração MATERNO, 70 a 80 bpm; 140 a 160 é a fetal, do doppler. Hoje há os
dois com nomes que não mentem: `coracao` (o do bebê, o apelo emocional) e
`ventre` (o materno, com o whoosh TRAVADO na batida — a diferença inteira entre
ruído marrom e útero). 140 bpm é rápido demais para induzir sono, e induzir sono
é o uso do segundo.

⚠️ **E o passa-alta em 28 Hz do ventre é obrigatório**: alto-falante de celular
não reproduz abaixo de ~60 Hz, e sem o corte ~40% da energia é inaudível E conta
na normalização, derrubando o volume do arquivo por causa de uma banda que
ninguém ouve.

### ⚠️ Os defeitos que a medição achou no que já existia

- **A CHUVA SE REPETIA A CADA 10 s, e era isso que se ouvia.** Varrendo os lags:
  ~0 em todos, 0,993 em 10 s. E decompondo o render, a cama vale **99% da
  energia** (RMS 0,0126 contra 0,0012) — o comentário do código afirmava o
  contrário. A cama passou a durar o laço INTEIRO: 0,993 → 0,007. Custo medido
  antes de decidir: gerar 30 s de ruído rosa a 48 kHz leva 45 ms.
- **AS GOTAS SAÍAM CEM VEZES MAIS FRACAS** do que o envelope pedia. `pico` é o
  ganho de um nó de GANHO, e o que passa por ele é ruído ROSA já cortado por um
  passa-faixa de Q 3–9 — e o rosa cai 3 dB por oitava, então entre 700 e 5000 Hz
  não sobrava quase nada. Fonte virou BRANCO, mais um ganho acertado na bancada.
- **AO VIVO, A CHUVA REPETIA AS MESMAS GOTAS A CADA 20 s.** `montar` sorteia com
  semente fixa; offline é chamada uma vez, ao vivo uma por janela. A semente
  passou a somar o instante da janela.
- **O BATIMENTO TROPEÇAVA A CADA 20 s** — o pior defeito da meditação. As
  batidas eram agendadas a partir do começo de cada janela, e 20 s não é
  múltiplo de 0,42857 s: a primeira batida de cada janela saía **139 ms
  adiantada** (32% do período), **trinta vezes numa sessão de dez minutos**.
  `naGrade` ancora no zero absoluto — e a correção não podia ser "escolher uma
  janela múltipla", porque qualquer mudança em `JANELA_SEGS` traria de volta.
- **VAZAMENTO DE BUFFER**, que a cama de 30 s PIOROU: o mar criava 2,6 MB a cada
  20 s, uns 79 MB numa meditação de dez minutos. Cache num `WeakMap` por
  CONTEXTO (morre com a sessão) e por TAXA (servir o buffer errado daria o som
  com a altura trocada).
- **31,5 dB DE DIFERENÇA ENTRE OS SONS AO VIVO.** A normalização só existe no
  render offline. ⚠️ E igualar o RMS de todos seria errado: uma lareira é
  silêncio com estalos (crista 15) e um pad é contínuo (crista 3,2) — para a
  lareira alcançar o RMS do pad, o estalo sairia a 3,7 de amplitude. O ganho é o
  MENOR entre "chega no RMS alvo" e "não passa do pico". **31,5 → 9,7 dB.**
- **A SESSÃO PODIA RODAR MUDA** e nada avisava: `start()` nunca chamava
  `resume()`, e um contexto que nasce suspenso fazia `agendarJanelas` desistir
  em silêncio — meditação inteira sem som, com o chip aceso.
- **`stop()` FECHAVA O CONTEXTO NO ATO** — um clique, e o pior caminho é trocar
  de som no MEIO da sessão. Agora há rampa de 80 ms.
- **LAREIRA E FOGUEIRA SAÍAM IDÊNTICAS**: um `lowpass(1200)` escrito depois do
  `lowpass(4200 ou 9000)` anulava a única diferença entre elas.
- **O RESSOADOR DO TELHADO ESTAVA EM PARALELO** — três filtros de realce em
  paralelo somam três cópias do sinal, o que é volume e não ressoador. Em série:
  crista 21,3 → 11,5.

⚠️ **E A REGRA DO AQUECIMENTO ERA FALSA.** O arquivo afirmava que ele "tem de
ser múltiplo inteiro de todo período, senão desloca a fase e o problema volta".
Medido variando só o aquecimento (4·7·10·11·13·30 s), o degrau pula sem padrão
nenhum. A conta explica: num sinal de período p, o trecho [w, w+L] fecha quando
**L** é múltiplo de p — w não entra. O aquecimento serve para os FILTROS saírem
do estado zerado, e só. Hoje a emenda fecha por **costura**: renderiza-se 20 ms
a mais e mistura-se a sobra na cabeça do trecho. (Isso NÃO é o "fade dentro do
trecho" que o `renderizar` proíbe: ali é rampa de volume que vira pulso a cada
volta; aqui a amplitude não muda.)

#### ⚠️ CINCO SONS TINHAM MODULAÇÃO MORTA, e o `tsc` não pegava

`bandaLenta` devolvia um `GainNode` cujo PARÂMETRO de ganho era modulado pelas
senoides — e a saída de ÁUDIO dele era silêncio, porque nada era ligado à
entrada. Os cinco usos faziam `bandaLenta(...).connect(algo.gain)`, ou seja
**ligavam SILÊNCIO a um parâmetro**. Nenhum modulava coisa nenhuma.

A fogueira nunca tremeluziu, o drone nunca evoluiu, o avião e o
ar-condicionado nunca respiraram, e as cigarras — cujo envelope inteiro dependia
disso — saíram com **pico 0,02** e pediram ganho de **37×** para chegar ao nível
das outras. Foi esse número absurdo, no relatório de `--niveis`, que denunciou o
resto.

⚠️ **`GainNode.connect(AudioParam)` é assinatura VÁLIDA**, então o código estava
certo em tipo e vazio em efeito — a classe de defeito que só a medição pega.
`moduladorLento` é o que sempre foi preciso: um nó cuja SAÍDA é a soma das
senoides. Ligado a um parâmetro ele SOMA ao valor dele, então o centro vai em
`param.value` e a amplitude no modulador.

### A música — o app não tinha nenhuma

`musica.ts` (régua pura) + `musica-audio.ts` (grafo). Generativa, porque só
assim dez minutos de sessão dão dez minutos de música.

⚠️ **A ESCALA NÃO É GOSTO — É UM TEOREMA.** Proibir segunda menor e trítono é
pedir um conjunto independente no grafo circulante C₁₂(1,6), e em Z₁₂ os únicos
independentes de seis são os dois alternados, que contêm trítonos. **Logo o
máximo é CINCO.** O teste varre os 4096 subconjuntos e prova: existem
exatamente doze conjuntos seguros, as doze transposições da pentatônica.
Escolher pentatônica é a única família que existe.

A emoção vem da **rotação do drone**: um conjunto só (lá·dó·ré·mi·sol) dá cinco
cores conforme onde o drone pousa. ⚠️ A mais escura (sobre mi) é barrada no Modo
Cuidado — a diferença entre "recolhido" e "escuro" é a diferença entre acolher e
afirmar a perda.

O mecanismo é o do Eno em _Music for Airports_: seis vozes com períodos PRIMOS
(19·23·29·31·37·41), MMC de **595.973.171 s ≈ dezenove anos**. ⚠️ 17 foi
descartado de propósito: contra o ciclo de 16 s ele deriva um segundo por
respiração e atravessa o ciclo em 16 delas — uma varredura que o ouvido pega.
⚠️ E o ganho é proporcional ao período: quem fala mais, fala mais baixo, senão a
voz de 19 s vira ostinato.

⚠️ **As janelas vêm da SESSÃO**, não de uma cópia: `JANELAS` era privada em
`meditacao-sessao.ts` e foi exportada. Com tabelas próprias, o silêncio musical
e o silêncio da voz cairiam em instantes diferentes.

⚠️ **A PEÇA SAÍA INTEIRA EM NaN — 73,5% das amostras.** O reverb de Schroeder
(comb realimentado com passa-baixa no laço) diverge no Web Audio. Medido:
Q=1,00/fb=0,90 → NaN aos 35,4 s; Q=0,707/fb=0,85 → pico 4,5×10²⁸; Q=0,50/fb=0,85
→ 2,3×10⁸; só fb=0,70 fica estável — e aí a cauda cai para ~0,6 s quando o arco
pede 4 a 9. A primeira leitura foi o Q (um passa-baixa com Q=1, **o padrão do
`BiquadFilterNode`**, tem pico de +1,25 dB, e dentro de um laço isso põe o ganho
de volta acima de 1) — verdade, e não bastou. A saída foi **convolução com
resposta gerada**: FIR não pode divergir por construção e entrega exatamente o
RT60 pedido. O argumento contra era estético e perde para "o outro caminho
produz NaN".

⚠️ **O FECHO É COMPOSTO, NÃO UM FADE** — fade diz "acabou o tempo", e a sessão
precisa dizer "chegamos". E ele precisou virar função de MÓDULO porque só
existia ao vivo: o render offline montava a peça sem ele, e o relatório dizia "o
fim não desce" sobre um caminho que não tinha fecho nenhum. **Uma coisa que só
existe ao vivo é uma coisa que ninguém confere.**

Medido, dez minutos: pico 0,720 · crista 6,06 · centroide 221 Hz · o RMS cai de
0,127 para 0,00013 no último segundo, exatamente os −60 dB que τ = 3,2 s
promete.

### O som de interface, e a sessão de áudio do iOS

⚠️ **MINHA PREMISSA ESTAVA INVERTIDA.** Eu escrevia que "Web Audio ignora o
botão de silêncio do iPhone". É o CONTRÁRIO — o WebKit trata isso como o bug
237322: Web Audio É silenciado pelo botão, e quem o ignora são os `<audio>`.

⚠️ **E o perigo real é outro, e já estava no repositório.** Desde o iOS 17 o
`navigator.audioSession.type` começa em `ambient` e **escala para `playback`
quando um `<audio>` toca — e nunca volta**. Este app toca `<audio>` em quatro
lugares. O caso concreto do desastre: ela ouve uma história para dormir às 22h,
a sessão sobe para `playback`, e o som das 3h da manhã herda isso e sai alto com
o telefone no silencioso. `sessao-de-audio.ts` devolve ao repouso no boot e no
DESMONTE das três telas de áudio longo — o desmonte é o `finally`.

⚠️ **NUNCA embarcar o `unmute-ios-audio`**: ele existe para desfazer exatamente
a proteção que este app quer.

**O som de interface nasce DESLIGADO**, e a decisão é sobre quem paga o erro:
ligar custa um toque; o erro custa um incidente, e o incidente não é "ela
desliga o som", é **"ela silencia o app inteiro nas Configurações do iPhone"** —
o mesmo canal do aviso de emergência.

⚠️ **O critério do que merece som NÃO é importância:** é **som só onde os olhos
NÃO estão.** Isso descarta a categoria que quase todo app sonoriza — toque,
navegação, curtir, salvar, publicar. E **erro não merece som**: já está na tela
em vermelho, som de erro é PUNITIVO, e erro é o que mais se repete num
formulário.

Ficaram seis espécies. Duas são **ALARME** (SOS enviado, SOS falhou) e ignoram a
preferência, o Modo Cuidado e o teto — quem perdeu a gestação continua podendo
passar mal. ⚠️ E o SOS é o único que SOBE, e o que o separa é o BRILHO, não o
fundamental — a foto da bancada desmentiu a primeira redação disto: as notas
dele são 432 e 864 Hz, abaixo do teto. Quem atravessa a faixa de 2–4 kHz (pico
de sensibilidade do ouvido, e o que a IEC 60601-1-8 exige de um alarme médico) é
o CORTE do filtro dele, 2600 Hz contra 900–1100 dos outros.

⚠️ **O ataque é o parâmetro mais importante da lista.** A resposta de
sobressalto cai monotonicamente com o tempo de subida entre 2 e 100 ms: abaixo
de ~15 ms é a diferença entre informar e assustar. Nenhum som daqui sobe em
menos de 20 ms.

⚠️ **`celebrateChime` NÃO passa pela preferência**, e isso é decisão: ele já
existia e já tocava, e aplicar "desligado por padrão" a ele seria TIRAR uma
coisa que o app tem. Nada é retirado — o que muda é a afinação (era dó-mi-sol-dó
de A=440) e os três portões que ele nunca teve: aba escondida, ausência de gesto
recente, e teto de três por dia.

#### ⚠️ A REVISÃO ADVERSARIAL ACHOU DEZESSEIS COISAS, e sete sobreviveram

Três agentes leram o trabalho da noite com lentes diferentes (risco clínico ·
técnica de Web Audio · testes que mentem) e um verificador cético tentou
refutar cada achado. Dez foram refutados; os que sobreviveram estavam todos
CERTOS, e vários matavam funções inteiras:

- ⚠️ **`comVolta` ESTOURAVA AO VIVO em dez dos trinta e dois sons.** Ele agenda
  a cópia de emenda em `t − 30`, que ao vivo (janela de 20 s, `t0` = o
  `currentTime` de um contexto recém-criado) é tempo NEGATIVO —
  `RangeError`, não um evento ignorado. A exceção subia ANTES de o agendador ser
  armado e caía num `catch` que engole: a paciente escolhia "Chuva", ouvia vinte
  segundos com gotas, e **o resto da sessão só a cama de ruído**. Sem erro na
  tela, sem log, com o chip do som aceso. Medido: seis dos dez estouravam em 6
  de 6 aberturas. Hoje `montar` recebe `paraLaco`, e há
  `node scripts/ouvir.mjs --aovivo` para isto nunca mais passar.
- ⚠️ **O WHOOSH DO VENTRE CONGELAVA aos vinte segundos.** O nó nascia dentro do
  `if (base)`, que só é verdadeiro na primeira janela — 48 rampas na primeira,
  ZERO na segunda. Numa sessão de dez minutos eram vinte segundos de útero e
  quase dez minutos de ruído marrom com um thump por cima, no som cujo
  comentário diz "estático, é ruído marrom; travado na batida, é útero".
- ⚠️ **O FECHO DA MÚSICA ERA SEMPRE AGENDADO NO PASSADO.** `agendar` só o
  chamava depois da última janela, e `setTargetAtTime` com tempo passado vale
  `alvo · e^(−Δ/3,2)` NA HORA: um degrau instantâneo de −16 dB (−27 nas sessões
  curtas). Exatamente o "fade de player" que o comentário dizia existir para
  evitar. ⚠️ E `--musica` não podia ver: a bancada mede `montarPeca`, que é o
  único caminho que estava correto.
- ⚠️ **CINCO SONS TINHAM MODULAÇÃO MORTA** — ver a seção acima.
- ⚠️ **UM PÁSSARO CANTAVA nos primeiros dois segundos de TODA janela de 20 s**,
  para sempre: a frase reancorava em `t0`. É o defeito de 139 ms do coração,
  sobrevivendo noutro lugar.
- ⚠️ **Grilos e sapos disparavam DUAS VEZES** no meio-segundo de sobreposição
  entre janelas, em fase — +6 dB no mesmo chirp.
- ⚠️ **O CORO DOS SAPOS voltava a cada 10 s**: os cinco contadores eram
  múltiplos de três. Com máximo divisor comum 1 caiu para 0,627 — e ainda
  reprovava, porque três eram PARES e voltavam na metade do laço. Com todos
  ímpares: **0,139**.
- ⚠️ **A RAJADA DO VENTO tem pico 2,27, não 1** (é soma de senoides). Os ganhos
  estavam dimensionados pelo RMS: o corte do passa-faixa ia a −418 Hz, o Web
  Audio clampava em zero, e **o vento SUMIA na rajada mais forte**. A folhagem
  tinha só um dos dois estágios modulados, então aparecia igualmente quando o
  vento MORRIA.
- ⚠️ **O SOS NÃO TINHA TETO DE TEMPO.** Num wi-fi de hospital com portal
  cativo, a promessa não resolve, o `catch` nunca roda, e `panic` fica em
  "sending" PARA SEMPRE — com o botão desabilitado exibindo "Localizando e
  avisando…". Ela não conseguia nem tentar de novo. O repositório já tinha
  aplicado esta correção ao vizinho MENOS importante (o endereço tem teto de
  2 s, "um enfeite não pode segurar a emergência"); a chamada que É a
  emergência ficou sem.
- ⚠️ **E O ÁUDIO DO ALARME NASCIA FORA DO GESTO.** O contexto é criado na
  primeira nota, e no SOS ela só acontece depois do GPS, do endereço e do
  servidor — depois do `await` o gesto já passou e o iOS recusa em silêncio. O
  único som que ignora preferência e Modo Cuidado seria justamente o mudo.
  `destravarSomDeUI()` no prefixo síncrono do toque, como `destravar()` dos
  Sons para dormir já fazia.
- ⚠️ **"Coração do bebê — o batimento dele, do doppler" AFIRMAVA PROCEDÊNCIA.**
  O som é um oscilador a 140 bpm. Redução de movimento fetal é um dos nove
  sintomas VERMELHOS: a paciente podia abrir os Sons para dormir, ouvir um
  batimento regular e se tranquilizar com uma senoide. Virou "Ritmo de ninar —
  batida regular, 140 por minuto". A catraca de `afinacao.test.ts` não alcança
  essa linha (não há contexto de altura nela), então a proteção é o texto.
- ⚠️ **A CATRACA DA BOCA ERA DERROTADA PELO PRETTIER.** Ela casava LINHA A
  LINHA, e o prettier quebra JSX em cem colunas — que é como uma frase de
  interface é escrita. O gatilho ficava numa linha e a alegação na seguinte, e
  as quatro varreduras passavam. Hoje o arquivo é achatado e a pergunta é de
  PROXIMIDADE; há teste que injeta exatamente a frase que a atravessou.
- **O convite prometia um tom que cala das 22h às 7h** sem dizer isso, e a
  amostra tocava mesmo de madrugada — o app oferece lembrete de meditação às
  21h, então a sessão que começa 22h05 é o caso comum.
- **O contexto de som de interface nunca fechava**, mantendo a sessão de áudio
  do iOS ativa pela vida da aba — contra tudo que `sessao-de-audio.ts` existe
  para fazer. Fecha sozinho depois de 8 s ocioso.
- **As chaves de contagem do `localStorage` não eram apagadas** (~2.200 por
  ano). Neste app, estourar a cota derruba a PRÓXIMA gravação de qualquer
  coisa, inclusive o `journey_state`.
- **`setVolume` era a única automação sem âncora.** `cancelScheduledValues` não
  segura o valor corrente; durante o fade de entrada não há evento anterior, só
  o `value` intrínseco 0,0001 — mexer no volume no começo fazia o som CAIR A
  ZERO e voltar.

⚠️ **E UMA LIÇÃO DE MÉTODO, cara:** um dos agentes de revisão EDITOU a árvore de
trabalho enquanto eu escrevia nela — um `cp` de restauração apagou duas funções
recém-escritas, e ele as reconstruiu a partir do contrato dos chamadores.
Revisão adversarial em repositório vivo pede `isolation: "worktree"`.

#### ⚠️ E A SEGUNDA VARREDURA — o app, aba por aba

O dono esclareceu que "site" sempre quis dizer o APLICATIVO, e pediu a vistoria
completa. Ela achou quatro furos de Modo Cuidado e onze momentos mudos.

**OS QUATRO FUROS DE MODO CUIDADO — e o primeiro é o pior defeito de som que o
app já teve:**

1. ⚠️ **A segunda meditação FALAVA EM VOZ ALTA sobre o bebê, no luto.**
   `MeditacoesTab` manda o roteiro inteiro para o `speechSynthesis`, e os
   roteiros contêm "Conexão com o bebê", "Você está segura. Seu bebê está
   seguro.", "Agradeça ao seu bebê por este dia de companhia." A prop `careMode`
   nunca foi passada — as duas vizinhas na MESMA linha recebiam. É exatamente o
   defeito que a meditação do Caminho corrigiu em ago/2026 e que está registrado
   lá como "o pior que a revisão encontrou"; aqui é pior, porque lá o texto era
   LIDO NA TELA e aqui é FALADO.
2. ⚠️ **O batimento do bebê tocava na aba Bebê, no luto.** O portão `!careMode`
   existia três linhas ABAIXO do `HeartbeatFeel`, e ele estava fora. Som lub-dub
   a 140 bpm mais vibração no ritmo, com o texto "O coração de {nome}".
3. ⚠️ **E no painel do ACOMPANHANTE também** — o marido ou a mãe abria o link e
   ouvia o batimento de um bebê que não existe mais, com ela sem estar do lado
   para explicar. `care_mode` precisou atravessar `getCompanionView` até lá.
4. **A folha de sons oferecia "Coração do bebê" e "Ventre"** — resolvido com
   `ofertaveis(luto)`.

**OS MOMENTOS MUDOS QUE GANHARAM SOM:**

- ⚠️ **O TROFÉU** — a única animação de 5,5 s do app, e não tinha uma nota. O
  chime do dia toca ~1 s antes e já acabou quando ele aparece: a paciente via o
  clímax do jogo em silêncio. Som próprio, mais LENTO que a conquista (1,7 s
  contra 0,65) — um arpejo rápido acabaria antes do desenho.
- ⚠️ **O FIM DA SESSÃO DE MOVIMENTO** — o caso mais forte de todos. Ela termina
  no chão, de olhos fechados, depois de a voz gravada ter guiado a sessão
  inteira, e o único sinal do fim era VISUAL. Usa o mesmo `fim` da meditação, de
  propósito: dois sons diferentes para "acabou" ensinariam a decodificar.
- ⚠️ **O MARCO DE SEMANA ESTAVA INVERTIDO** — o confete estourava na ABERTURA e
  o chime só tocava quando ela FECHAVA o modal. O clímax visual acontecia mudo e
  a nota chegava no gesto de sair.
- ⚠️ **A AULA TINHA A HIERARQUIA INVERTIDA** — acertar UMA questão tinha som e
  terminar a aula inteira não. O app fazia mais barulho pela parte que pelo
  todo.
- **A GRATIDÃO do dia comum** — só o marco redondo soava; "Guardei 💛", que é a
  promessa central da atividade, era silêncio. ⚠️ E o som DESCE: guardar é
  fechar, não conseguir. A paciente que escreveu uma gratidão num dia difícil
  não conquistou nada.
- **AS SEMENTINHAS** — o CLAUDE.md já dizia que "o contador É a recompensa", e
  um "+5 🌱" mudo é indistinguível de nada. O som mora no funil único
  (`creditarSementinhas`), com teto de cinco por dia: ela cai em seis ou mais
  pontos, e sem teto o app vira caixa registradora.
- **COMPRAR NO CANTINHO** — mudo, EXCETO o caso raro do conjunto completo. O
  comum em silêncio e o excepcional com festa faz o comum parecer ter falhado.

**E O ÚLTIMO MOTOR SAIU DA AFINAÇÃO SOLTA:** `breath-audio.ts` tocava 174 e
261 Hz. O 174 é, por coincidência, a primeira das "frequências Solfeggio" —
números inventados nos anos 1970 por numerologia. Agora é fá 3 e dó 4 em A=432,
o MESMO par do pad. Eram três motores em três afinações; hoje é um sistema.

**O CONTROLE GLOBAL, e a tensão que ele resolve.** Havia cinco interruptores
locais, nenhum lembrado, e a comemoração não passava por nenhum: era **o único
som do app impossível de desligar**, e um dos que tocam sem ela pedir.

⚠️ Mas aplicar "desligado por padrão" à festa seria TIRAR uma coisa que o app
tem. A régua separa **"não escolheu"** de **"escolheu desligar"**: quem nunca
mexeu continua ouvindo a festa exatamente como antes; quem toca em "Não" na
folha de sons silencia tudo menos o ALARME. E `celebrateChime` passou a
respeitar `prefers-reduced-motion` — `fireConfetti` já respeitava, então quem
pedia menos estímulo tinha a tela quieta e o arpejo tocando.

#### ⚠️ E DOIS DEFEITOS QUE OS SONS NOVOS CRIARAM

- **O FECHAMENTO DO DIA DISPARAVA TRÊS SONS EM CADEIA.** O chime da conquista
  na hora, a moeda quando o servidor confirma o bônus, e o troféu quando a
  carteira volta — separados só pela LATÊNCIA DA REDE. Num wi-fi bom eles se
  atropelam, e o momento mais bonito do jogo vira caixa registradora.
  ⚠️ Um teto por espécie não pega isso: cada um está dentro do próprio limite.
  O que resolve é uma régua ENTRE espécies — um som só cala outro se o outro
  for MENOS importante (`PRIORIDADE`), com janela de 1,2 s. O troféu passa por
  cima do chime de propósito: ele é o clímax, e se a régua fosse "o primeiro
  cala todos", a única animação de 5,5 s do app seria engolida pelo som que veio
  um segundo antes.
- ⚠️ **A MOEDA TOCAVA SEM SABER DO LUTO**, e não havia como passar `careMode`
  até lá: `creditarSementinhas` é o funil de DEZESSETE pontos de concessão, num
  módulo que de propósito não importa nada. Passar por dezessete chamadas seria
  a "segunda régua no chamador" que o projeto já pagou em `AvisoDePresente` — e
  a décima oitava, escrita amanhã, esqueceria.
  `carimbarModoCuidado()` inverte o padrão: quem NÃO passa herda o estado real
  em vez de herdar `false`. Há teste cobrando `?? lutoAtual` e proibindo
  `!!o?.careMode`, que é o portão aberto.

#### ⚠️ E A SEGUNDA REVISÃO ADVERSARIAL — o dia SIMULADO com a régua de verdade

Um agente rodou `podeSoar` num dia inteiro de paciente engajada (aula, quatro
atividades, dia fechado, troféu, marco, compra, gratidão) em vez de estimar. O
que ele achou:

- ⚠️ **OS ACERTOS DA AULA COMIAM O TETO E O DIA FECHADO FICAVA MUDO.** O acerto
  de UMA questão usava a espécie `conquista`, cujo teto é 3 — então os três
  primeiros acertos gastavam a cota inteira, e depois ficavam mudos o fim da
  aula, o marco de cinquenta gratidões e **o fechamento do dia**. O pequeno e
  repetido engolindo o grande e raro, que é a hierarquia ao contrário. Virou
  espécie `acerto`, com teto e prioridade próprios.
- ⚠️ **O FECHAMENTO DO DIA DISPARAVA DUAS VEZES**, e isto não era defeito de
  som. `onEarn` chama `markDayTask` duas vezes no mesmo tick, e a guarda era
  `!doneDays.includes(D)` — estado de React, congelado no fecho do render. O
  bloco inteiro rodava duas vezes: 2× confete, 2× vibração, 2× `grantDayStarsBonus`,
  2× `getWallet`, 2× `setTrofeuNovo`, 2× figurinha coletada. A régua da vez
  calou o segundo chime — o som foi a única coisa que NÃO dobrou, e foi por isso
  que o defeito apareceu. `useRef` resolve porque não é congelado pelo render.
- ⚠️ **O SOM MAIOR SOAVA POR CIMA DO MENOR.** A régua da vez cala o menos
  importante que chega depois; o caso inverso não estava resolvido. Medido nos
  pares reais: `guardado → conquista` com 275 ms sobrepostos, `fim → conquista`
  com 245, `moeda → conquista` com 128. E o do meio é estrutural, não de rede —
  `finish()` chama `onEarn()` antes de qualquer `await`, então os dois saem no
  MESMO tick. Conserto: **roubo de voz**, o que todo sintetizador faz há
  cinquenta anos.
- ⚠️ **`MeditacoesTab` recebia `careMode` e ele era PROP MORTA.** Eu a passei na
  rodada anterior e nunca a usei — a voz do sistema continuou lendo em voz alta
  "Seu bebê já te ouve" no luto. Seis dos sete roteiros citam bebê ou parto, e
  filtrar por conteúdo deixaria um: a porta fecha, e a meditação do Caminho (que
  tem tratamento próprio de luto) continua ali.
  ⚠️ E o portão é um EMBRULHO, não um `return` no meio do componente — a
  primeira versão quebrou a regra dos hooks e o lint pegou.
- ⚠️ **HAVIA UM TERCEIRO `HeartbeatFeel`, e ele é PÚBLICO.** `/batimentos` está
  no cabeçalho do site, sem portão nenhum, com um SEGUNDO motor de batimento
  próprio. Paciente em Modo Cuidado saía da área logada e ouvia o coração fetal
  a 140 bpm. A página passou a perguntar ao cliente se há sessão e a não
  desenhar nada disso no luto.
- **`celebrate()` tinha zero chamadores e chamava `celebrateChime()` sem
  `careMode`** — uma porta aberta esperando o primeiro chamador. Saiu.

⚠️ **E A CATRACA DE COLUNAS ME PEGOU:** escrevi `.eq("user_id", …)` em
`patient_profiles`, que **não tem essa coluna** — a chave é `id`. Não daria
erro: o PostgREST devolveria 42703, o perfil viria nulo, `luto` ficaria `false`
e o batimento tocaria no luto. É exatamente a classe de defeito que a catraca
existe para impedir, cometida por mim, no conserto de um defeito de luto.

⚠️ **E DOIS TESTES MEUS TRAVAVAM A ASSINATURA em vez da intenção** — um cobrava
`createSoundscape(somAgora)` com o parêntese, outro a guarda exata do
fechamento do dia. Os dois reprovaram sobre código que continuava certo, e o
segundo reprovou sobre um código que estava CONSERTANDO um defeito.

**Bancadas:** `/preview-som` (os vinte, a música e os sons de interface, todos
num toque) · `/preview-sons` (a tela dos Sons para dormir).
**Medir:** `node scripts/ouvir.mjs` · `--niveis` · `--musica --min=10` ·
`--aovivo` (o caminho da meditação, que NÃO é o do render).

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

## A Comunidade entrou na barra, e o Chat virou a boca da bolha (ago/2026)

Pedido do dono: "o chat não pode ser hoje um dos produtos principais na minha
navbar — quanto mais eu expandir, ele vai ser um elemento que não vai ter em
todos os países; hoje a gente só está usando ele no Brasil. Então o chat vai
abrir quando você clicar no bebê bolha, e você vai criar um novo botão da
comunidade, pode pegar o nosso ícone da gamificação pras amigas".

- **O chat NÃO perdeu nada** — nenhuma funcionalidade mudou, só a porta. E a
  porta nova é melhor que a antiga: a bolha já era "a voz do app", então o
  lugar onde se conversa com ela é ela mesma.
- ⚠️ **O BALÃO E O PERSONAGEM PASSARAM A TER DESTINOS DIFERENTES**, e a
  pergunta só existe agora — antes os dois toques iam para a central de
  recados. `oBalaoAbreOsRecados` (`fala-do-mascote.ts`, testada) decide pela
  ORIGEM do texto: quando o balão É o anúncio dos recados, ele promete um lugar
  e leva lá; quando quem fala é a frase do dia, o toque é o mesmo do
  personagem. Errar custava nos dois sentidos — balão de conforto abrindo uma
  central vazia, ou balão de recado abrindo o chat e perdendo o que acabou de
  anunciar.
- ⚠️ **O `aria-label` do personagem virou FIXO.** Ele acompanhava o texto do
  balão; com dois destinos, um leitor de tela anunciaria "Abrir 3 recados" num
  botão que abre o chat. Quem descreve o recado é o balão, que é o botão que
  leva até ele.
- **`IconeDaBarra` substituiu `LucideIcon`** em `NAV_ITEMS`: o `IconeAmigas` é
  silhueta CHEIA (`fill`, não `stroke`), então a assinatura comum aceita
  `strokeWidth` e o nosso o ignora. Dar a `icones-jogo.tsx` uma prop que ele não
  usa espalharia a gambiarra por doze ícones para servir a um.

### A aba reúne o que já existia solto

Álbum Familiar (`/album/<token>`), votação de nomes, painel do acompanhante
(`/acompanhar/<token>`) e Amigas viviam em quatro caminhos diferentes, nenhum
deles onde alguém procuraria "as pessoas que estão comigo nisso". São
**ATALHOS, nunca cópias** — abrem a tela onde ela já mora, pelo mesmo
`consultasSub` que o hub da Saúde usa para Chutes e Contrações.

⚠️ **Em Modo Cuidado, "Nome do bebê" sai e as outras três ficam**
(`portasDaComunidade`, testada). Não é tom, é tempo verbal: votar num nome é
decidir sobre um bebê que vai nascer. Amigas e Acompanhante ficam porque são a
rede de apoio, e tirá-las seria isolá-la no pior momento; o Álbum fica porque as
fotos são a memória do que houve, e escondê-las seria o app apagar o bebê dela —
a mesma decisão que manteve `exam_files` de pé quando o envio de exames saiu do
produto.

### O bolão do nascimento — CONSTRUÍDO E REMOVIDO no mesmo dia

Cada pessoa da torcida palpitava dia, peso e hora do nascimento; a mãe
registrava o parto e o app apontava quem chegou mais perto. Régua pura testada,
SQL, servidor, tela e bancada — tudo pronto e verificado.

⚠️ **O dono olhou e não gostou** ("não gostei do bolão"), e ele saiu inteiro. A
lição não é sobre o bolão: é que a aposta era MINHA. Eu escolhi a função de
melhor relação entre interação e trabalho por um argumento de mecânica — ela se
auto-relança no parto — e a mecânica estava certa e o produto não. Numa aba cujo
assunto é a rede de apoio de uma gestante de alto risco, apostar na data do
parto é um jogo sobre o evento que ela mais teme.

Está em `git log` (commit `1bcd571`) se um dia fizer sentido. O que ficou de
útil: `diaEmNumero`/`diaEmTexto` (ler `YYYY-MM-DD` sem passar por `new Date`) e
o padrão de conferir o vínculo com `saoAmigas`, hoje exportado.

## O chá de bebê e a lista de presentes (ago/2026)

Pedido do dono, depois de rejeitar o bolão: "vamos pensar em questões do chá do
bebê, questão também de presentes que pode enviar". Das seis ideias que
levantei, ele aprovou cinco (a rejeitada foi "presente que é trabalho —
faxina, marmita, babá").

⚠️ **AS CINCO NÃO SÃO CINCO RECURSOS. São um objeto e quatro propriedades
dele:** fralda e cota são TIPOS de item; áudio e agendamento são campos da
RESERVA; agradecimento é uma LEITURA das reservas. Como cinco recursos,
virariam cinco tabelas, cinco telas e cinco portas — e a paciente teria de
entender cinco coisas para usar uma. Como um objeto, são três tabelas e uma
página pública por token, no molde de `/album/$token`.

⚠️ **E NÃO HÁ DINHEIRO NA v1.** Reserva é PROMESSA, combinada por fora como
num chá de verdade; o app conta, não cobra. Isso dispensa de uma vez merchant
of record, endereço de entrega (que não existe em `patient_profiles` e é
decisão de LGPD à parte), estorno — e a armadilha de `createOneTimeCheckout`
cravar `metadata[product] = "sementinhas"`, que faria o webhook creditar moeda
em vez de registrar presente.

### As fraldas: o erro universal, quantificado

| tamanho | dura          | % do volume do 1º ano |
| ------- | ------------- | --------------------- |
| RN      | 2–3 SEMANAS   | ~6 %                  |
| P       | ~2 meses      | ~19 %                 |
| M       | 3º ao 7º mês  | ~37 %                 |
| G       | 8º ao 13º mês | ~29 %                 |

**M e G são dois terços do ano e quase ninguém dá.** Chegam quando o chá acabou
e a mãe paga sozinha, no mês em que a renda da casa caiu.

- ⚠️ **`teto` é coluna SEPARADA de `meta`, e é o recurso inteiro.** `meta` é
  "quanto eu quero"; `teto` é "acima disto o servidor RECUSA". RN tem teto 6
  porque é o único tamanho que pode durar ZERO dias — 3,8 kg usa RN por dez
  dias, 2,8 kg por dois meses, e não há como saber antes. Sem o teto, a lista
  mostra "RN completo" e a próxima amiga reserva RN assim mesmo.
- ⚠️ **`ordemDeUrgencia` desempata pela MAIOR META, não pelo maior tamanho.**
  A primeira versão desempatava por tamanho, e a bancada mostrou o resultado
  renderizado: com a lista zerada, o primeiro cartão era **XG** — um tamanho
  que o bebê só usa depois de um ano, num chá que acontece na 32ª semana.
  Certo na letra ("na dúvida, empurra o que dura mais"), errado no espírito. E
  o teste passava, porque eu o tinha escrito para bater com a implementação.
  Foi olhar a tela desenhada que pegou.
- **A meta já É a régua de volume** (M tem 18 pacotes porque M é 37% do ano),
  então ordenar por ela põe M e G na frente sem uma segunda tabela que um dia
  discordaria da primeira.
- O teste trava a soma das metas entre 1.200 e 1.600 fraldas: o chá cobre ~8
  meses, não o ano.

### As cotas

⚠️ **R$ 1.200 ÷ 7 é o caso que quebra.** `Math.round(120000/7)` é 17143, e sete
delas somam 120001 — um centavo a mais, todo chá, para sempre; para baixo, um a
menos. A última cota absorve o resto, e o resto vai para a ÚLTIMA e não
espalhado: espalhar deixaria as primeiras um centavo mais caras e a tela
mostraria dois preços para a mesma cota.

⚠️ **`sugerirCotas` nunca sugere cota abaixo de R$ 25.** "12x de R$ 8"
transforma o carrinho numa vaquinha de trocado.

### O token é PRÓPRIO, e essa é a decisão de segurança do recurso

⚠️ `companion_invites.token` abre **três portas**: o álbum, o painel do
acompanhante e — via `getRecentPanicByToken` — os SOS dos últimos 30 minutos,
com latitude e longitude. Reusá-lo faria o link do chá de bebê, que ela manda
para o grupo do trabalho, abrir junto o painel de emergência dela. O próprio
comentário de `escola.functions.ts` já dizia quem tem esse token: "a cunhada, a
vizinha, o grupo da família".

⚠️ **E a RLS NÃO copia a de `companion_invites`**, que dá `SELECT` ao papel
`anon` — um `anon` que possa varrer `presente_listas` lê a lista e o token de
toda gestante da plataforma.

Outras travas, todas testadas por mutação (`presentes-servidor.test.ts`):

- `listaPorToken` nunca devolve `user_id` nem `quem_nome`. A amiga precisa
  saber que o item está reservado, não POR QUEM — revelar cria comparação entre
  as convidadas ("a Fulana deu o carrinho e eu dei fralda").
- **A dona LÊ as reservas e NÃO escreve nelas.** Sem esse recorte, o navegador
  dela governaria `revelar_em` (revelando hoje o presente marcado para a 36ª
  semana) e `quantidade`.
- **O saldo é `SUM` das reservas vivas, nunca uma coluna.** Contador
  materializado vira "faltam 3 M" numa tela e "faltam 5 M" na outra na primeira
  corrida. Mesma lição do troféu contar o LEDGER e não `doneDays`.
- Colidir na `idem_key` é SUCESSO REPETIDO: devolver erro faria a amiga tentar
  de novo com chave nova e aí sim reservar duas vezes.
- Cancelar MARCA, arquivar RECUSA item com reserva, e nenhuma função chama
  `.delete()`.

⚠️ **DOIS TESTES MEUS ERAM FALSOS, e a mutação provou.** O de Modo Cuidado
procurava as palavras `care_mode` e `return null` soltas no corpo — apagar a
linha do portão passava verde, porque `care_mode` continua no `.select(...)` e
`return null` na linha de cima. O de "o saldo é relido antes de decidir"
comparava `indexOf` de duas strings, e um `jaReservado2 = 0` introduzido no
meio passava verde. **Teste que procura palavra é teste que mente**: hoje o
primeiro cobra a guarda inteira e o segundo amarra a CADEIA (a soma vem do
select das vivas, e é esse identificador que as duas réguas recebem).

### Modo Cuidado tem TRÊS portões, e o da tela é o menos importante

Este é o recurso com o maior risco de Modo Cuidado do app, porque **o objeto
vive FORA do aparelho dela**: o link já está na mão de trinta pessoas.

1. `portasDaComunidade` tira a porta (junto com "Nome do bebê" — mesma razão de
   tempo verbal: lista de presentes é preparo para a chegada).
2. `ChaDeBebe` recusa desenhar.
3. **`listaViva`, no servidor** — e é este que conta. Devolve o mesmo `null`
   para "token inválido", "lista fechada" e "a dona está em Modo Cuidado".

⚠️ **A página pública NÃO conta o que aconteceu.** Uma frase — "Esta lista não
está disponível no momento" — e nada mais. Nem motivo, nem emoji de luto.
Contar a perda dela para o grupo de WhatsApp da família inteira é o app tomando
a decisão mais íntima que existe no lugar dela. E **nada é apagado**: se ela
desligar o modo, tudo volta como estava.

### O agradecimento

⚠️ O texto é RASCUNHO e o app NUNCA manda — abre o WhatsApp com a mensagem
escrita e quem aperta enviar é ela. Mesma decisão da transcrição do diário. E
ele nunca inventa: "Obrigada pelo carrinho" para quem deu fralda destruiria o
recurso na primeira vez.

⚠️ `wa.me/?text=` vai **sem número**: o app não tem o telefone de quem deu (é
terceiro sem conta) e um link com número errado mandaria o agradecimento da tia
para outra pessoa.

⚠️ **`agradecida` só é verdadeira quando TODAS as reservas da pessoa foram
agradecidas.** Com um `||`, agradecer a fralda tiraria da fila quem também deu
o carrinho.

⚠️ **E o nome do bebê vai SEM ARTIGO.** "A Helena vai crescer sabendo" viraria
"A Miguel". É exatamente a armadilha que o bolão tinha ("Quando o Helena
nasce?"), reaparecendo num arquivo diferente no mesmo dia — o que prova que ela
não é sobre aquele arquivo.

**Aplicar no Supabase:** `supabase/APLICAR_CHA_DE_BEBE.sql` (idempotente; cria
também o balde privado `presentes`).
**Bancada:** `/preview-presentes` · `?rn=cheio` (o cartão completo e a ordem) ·
`?cota=11` · `?vazio=1`. Sem ela, conferir o cartão de RN cheio exigiria montar
um chá real e reservar seis pacotes com seis nomes diferentes.

## "Bugado e lerdo na hora de clicar": quatro causas, todas medidas (ago/2026)

Relato do dono, no aparelho. **Nada aqui foi deduzido** — deduzir a partir de
screenshot já tinha custado três rodadas no dia anterior. O método foi sempre o
mesmo: abrir num navegador, estrangular a CPU em 6× (que aproxima um celular
real) e medir.

### O que NÃO era, e ficou descartado com número

| suspeita                  | medida                                                    |
| ------------------------- | --------------------------------------------------------- |
| o vidro da barra (`blur`) | 58 fps; desligar `backdrop-filter` e sombra: 58 / 57 / 58 |
| defeito de tela           | **48 bancadas** varridas com o console à vista: 0 erros   |
| resposta ao toque isolada | 34 ms para abrir as reações                               |

⚠️ **A varredura das 48 bancadas é o hábito que faltava**, e ela nasceu do
defeito do dia anterior: `/preview-home` reproduzia o laço da barra desde o
commit que o criou, e ninguém tinha aberto. Vale repetir depois de qualquer
leva grande — o script viveu no scratchpad, e o que importa é o método:
abrir cada `/preview-*` num navegador e LER O CONSOLE.

### 1 · O app baixava o chatbot do site para não mostrá-lo

`__root.tsx` importava `ChatbotWidget` de forma ESTÁTICA. Ele já sabia se
esconder em `/minha-conta` (`return null`) — e por isso parecia inofensivo.
⚠️ **Esconder não é não baixar**: um import estático no root entra no chunk de
ENTRADA, que toda página carrega antes de qualquer coisa aparecer. E ele
arrasta `@ai-sdk/react`, `ai` e o `react-markdown` inteiro.

|                   | antes       | depois               |
| ----------------- | ----------- | -------------------- |
| pacote de entrada | 1.181.019 B | **925.486 B**        |
| comprimido        | 356.248 B   | **283.441 B** (−20%) |

São **255 KB a menos de JavaScript para interpretar** em toda abertura — e é
enquanto a linha principal está ocupada com isso que o toque não responde.

⚠️ Ficaram **dois portões, por razões diferentes**: o de fora
(`semChromePublico`, no root) decide se BAIXA; o de dentro (o `return null` do
componente) decide se DESENHA, e continua sendo a fonte da verdade sobre onde
ele aparece.

### 2 · A trilha do Jogo remontava inteira na hidratação

Único aviso das 48 bancadas. O diff que o próprio React imprime:

```
+ left: "31.615223689149722%"   (o cliente calculou)
- left: "31.6152%"              (o que voltou do atributo)
```

`50 + 26 * Math.sin(...)` devolve float de 17 dígitos; o navegador **arredonda**
ao ler o atributo `style` de volta (a CSSOM não guarda dezessete casas). O React
compara, vê que não bate e **descarta a árvore para redesenhá-la** — numa trilha
de centenas de nós.

`casaDaTrilha` arredonda para três casas: em porcentagem, numa tela de 393px,
**0,004px**. ⚠️ Vale para toda posição calculada com `Math.sin`/`Math.cos` que
vá parar num `style`.

### 3 · O cartão do post redesenhava a lista inteira a cada reação

**232 ms → 61 ms** (19 posts, 6×). `setPosts` já preservava a identidade de quem
não mudou, mas a lista montava CINCO FECHOS por post
(`aoReagir={(t) => aoReagir(p, t)}`) — então as props mudavam de identidade a
cada pintura e `memo` nunca acertaria.

Três partes, e nenhuma sozinha resolve:

1. as ações recebem o POST (`aoReagir(post, tipo)`), para quem chama passar a
   MESMA referência a todos os cartões — o portão de quem pode apagar/denunciar
   mudou-se para dentro do cartão, que já tem `post.souAAutora`;
2. `memo` no cartão;
3. **`acoes`**, em `RedeNoApp`: objeto criado uma vez (`useMemo` vazio) cujos
   métodos encaminham para a versão mais recente, guardada num `ref`.
   Referência estável por fora, fecho fresco por dentro — sem `useCallback` em
   cascata. ⚠️ O `ref` é reescrito no **corpo do render**, nunca num efeito:
   efeito roda depois da pintura, e o toque no meio chamaria a versão anterior.

### ⚠️ 4 · E DUAS MEDIÇÕES MINHAS FORAM FALSAS — a bancada mentia

As duas pela mesma razão, e esta é a lição mais reaproveitável do dia.
Estabilizei só `aoReagir` e o número não se mexeu (232 → 278). O motivo: a
BANCADA continuava passando `aoAbrirPerfil`, `aoSalvar`, `aoVotar`, `aoApagar`
e `aoDenunciar` como fechos inline, então o `memo` errava em todos os cartões
de qualquer jeito.

**Uma bancada que passa props num formato diferente do da produção mede um app
que não existe.** É a irmã da regra que já estava escrita ("a bancada injeta o
DADO nos mesmos `useState` da produção"): agora vale também para a FORMA das
props. `preview-instagram` tem `acoesDaBancada` (um `useMemo` vazio) pela mesma
razão que a produção tem `acoes`.

⚠️ E a bancada **passou a guardar a reação**. Com `aoReagir={() => {}}` era
impossível ver a mecânica inteira — o emoji pousando, o pulo, o resumo se
reordenando. A tela desenhava e nunca respondia, que é o estado em que uma tela
passa meses sem ninguém perceber que não funciona.

### O que sobrou, e não foi feito

⚠️ **O NÚMERO AQUI JÁ ENVELHECEU UMA VEZ, e a favor do argumento.** Este
parágrafo dizia 20.367 linhas; medido em set/2026, são **21.478** — ele cresceu
1.111 linhas enquanto a nota dizia que ele estava parado. Toda leva nova entra
nele, e a cirurgia fica mais cara a cada semana. Quem mexer aqui, remeça:
`wc -l < src/routes/_authenticated/minha-conta.tsx`.

`minha-conta.tsx` tem **21.478 linhas, 29 estados e zero memoização**: qualquer
toque repinta a árvore inteira. É a maior peça estrutural que resta, e ficou
parada de propósito — é cirurgia grande, e o dono precisa dizer se a lentidão
sobreviveu às quatro correções acima antes de valer o risco.

## As oito ideias da Comunidade, aplicadas (ago/2026)

Pedido do dono, na ordem dele: **9, 10, 8, 7, 6, 4, 3, 2** — "são muitas, então
programe para fazer cada uma com perfeição". Cada uma saiu com régua pura
testada, mutantes conferidos em vermelho, bancada própria e verificação no
navegador antes do commit.

### 9 · A legenda sugerida pela IA (`legenda-sugerida.ts` + `/api/legenda-da-foto`)

⚠️ **A chave `mostrar_semana` é o portão, e virou o teste mais importante do
arquivo.** Se ela escondeu a semana no perfil e o número entra no prompt, o
modelo escreve o número — e a legenda publica, com o dedo dela no botão, o dado
que a chave existe para esconder. O nome do bebê tem chave PRÓPRIA
(`mostrar_bebe`): são duas decisões dela, e uma não governa a outra.

⚠️ **A régua clínica roda ANTES de sugerir.** Sem ela, o botão entregaria uma
frase bonita e o "Compartilhar" a recusaria depois — o app escrevendo o que o
app proíbe.

⚠️ **O que volta é RASCUNHO e ACRESCENTA**, nunca apaga. E a foto é reduzida a
**512px** antes de sair (contra os 1080 do post) e não fica guardada — a tela
**diz isso antes de ela tocar**, e não numa política. É foto de gestação, às
vezes ultrassom.

### 10 · Marcar quem estava junto (`marcacoes.ts`, `rede_marcacoes`)

⚠️ **Só dentro do grafo já conectado, e NUNCA uma busca.** Buscar por nome
transformaria a base de pacientes numa lista navegável.

⚠️ **A marcada pode tirar a marcação**, e ninguém é avisado — "Fulana tirou"
transformaria um gesto privado numa briga.

⚠️ **A marcação NÃO amplia a visibilidade.** Se escancarasse o post para a rede
da marcada, viraria a porta dos fundos da camada — que é o recurso.

⚠️ **Não manda push**: não há prazo nem decisão presa, e o canal é o do aviso de
emergência.

### 8 · O rascunho do compositor (`rascunho-do-post.ts`)

⚠️ **AS FOTOS NÃO ENTRAM, e não é economia — é proteção.** Dez data URLs de
~300 KB encostariam nos ~5 MB de cota do `localStorage`, e o que quebra quando a
cota estoura é a PRÓXIMA gravação de qualquer coisa — incluindo o
`journey_state`, que carrega a jornada inteira dela.

⚠️ **Oferece, nunca preenche sozinho**, e a chave carrega o id da conta (o
aparelho é compartilhado). Visibilidade desconhecida cai no MAIS FECHADO.

⚠️ **E o apagar vem ANTES do fechar**: fechando primeiro, o efeito com atraso de
700 ms regravaria o texto recém-publicado.

### 7 · Quem reagiu, e com quê

⚠️ **Só a autora, e a conferência do DONO vem ANTES da leitura** — há teste
sobre a ORDEM, e o mutante que a inverte fica vermelho. E o resumo só vira botão
no post dela.

⚠️ **Não filtra por Modo Cuidado nem bloqueio**, ao contrário da Atividade: aqui
é o REGISTRO de quem reagiu ao post dela, e esconder uma linha faria o número
discordar da lista logo abaixo.

### 6 · A retrospectiva da semana (`retrospectiva.ts`)

⚠️ **Não é placar, e por isso não compara semanas** — "mais que a semana
passada" viraria esteira, e bastaria uma internação para o cartão dizer que ela
caiu. Há teste com lista de palavras proibidas.

⚠️ **Só aparece quando há o que mostrar**: "você não publicou nada" é cobrança
com cara de resumo, e chega a quem teve a semana pior.

⚠️ **O dia da semana é conferido no CLIENTE** — "é domingo" depende do fuso
dela, e o servidor roda em UTC.

### 4 · Enquete e caixinha dentro do story

⚠️ **As réguas são as MESMAS** — `limparOpcoes`/`enqueteValida` do post, e a
pergunta cai na MESMA `rede_perguntas` com a MESMA `decidirPergunta`. O story é
outra PORTA, nunca uma segunda caixinha.

⚠️ **A triagem clínica corre nas OPÇÕES da enquete**, não só no texto: enquete é
exatamente o formato que faz meia dúzia de leigas responderem com conduta.

⚠️ **Um de cada vez** (ocupam o mesmo pedaço da tela), e as duas vivem **acima**
das metades invisíveis de avançar/voltar — sem `z-20`, tocar numa opção
avançaria o story.

### 3 · O selo do obstetra

⚠️ **Resolvido pelo vínculo ATUAL, e visível SÓ na lista que a autora abre.** Um
selo no feed contaria a terceiros que aquela pessoa é a médica dela.

⚠️ **E ele fechou um buraco:** o médico não tem linha em `patient_profiles`,
então a reação dele SUMIA da lista — o mais importante dos reagentes era o único
invisível.

**Falta uma decisão do dono:** dar ao médico uma porta para reagir de dentro do
painel exigiria decidir se ele VÊ as publicações sociais da paciente.

### 2 · "Então e agora" (`entao-e-agora.ts`, `rede_posts.comparacao_de`)

⚠️ **O carimbo é derivado na leitura, nunca guardado** — mesma decisão do
carimbo do story: texto guardado sobrevive à decisão dela.

⚠️ **A chave manda nos DOIS carimbos.** Fazer a metade antiga escapar dela seria
publicar a semana pela porta dos fundos — o passado dela é tão dela quanto o
presente.

⚠️ **A foto antiga NÃO é reenviada** (aponta para o mesmo arquivo), e a coluna é
`ON DELETE SET NULL`: apagar o post antigo não pode derrubar o novo.

⚠️ **28 dias de distância mínima**, e **semanas iguais não viram carimbo** —
"28s → 28s" faz a comparação parecer quebrada.

### O que o SQL passou a precisar

`supabase/APLICAR_REDE_SOCIAL.sql` cresceu com: `rede_marcacoes`,
`rede_story_votos`, `rede_posts.comparacao_de`, `rede_stories.enquete_opcoes`,
`rede_stories.pergunta_aberta`, o CHECK de `rede_reacoes` com treze tipos e o de
`rede_atividade.especie` com `'marcou'` — os dois por `ALTER` idempotente,
porque `CREATE TABLE IF NOT EXISTS` não toca em tabela existente.

## As reações do feed: treze, com toque duplo (ago/2026)

Pedido do dono: "adicione recursos de reação mais legais na imagem, como like
clicando duas vezes, risada 😂, 😇🥹😍🥰😘🥳🤩😎😱😋😚☺️🙏… menos com cara de vibe
code, mais com cara de app caro e profissional".

**Treze**, na ordem em que se sentem: amor → carinho → emoção → apoio → festa →
riso. ❤️ 😍 🥰 😘 🤗 🥹 ☺️ 😇 🙏 👏 🥳 🤩 😂

- ⚠️ **😱 ficou de fora, e a razão é CLÍNICA**: embaixo do relato de um
  sangramento ou de uma internação ele devolve pânico a quem está com medo — e
  numa base de alto risco é justamente esse post que mais recebe reação.
  😎 · 😋 · 😚 saíram por não terem trabalho próprio ao lado das treze.
- ⚠️ **Sobre 😂, a ressalva fica registrada uma vez**: ela entra contra a
  recomendação original (embaixo de um post sobre uma perda é indefensável), por
  decisão explícita do dono, e é o primeiro item a sair se alguma paciente
  reclamar. O teste que a proibia foi **reescrito, nunca apagado** — os outros
  oito proibidos continuam, com a razão de cada um.
- ⚠️ **NUNCA renomeie um `tipo`** (está gravado em `rede_reacoes`), e
  **acrescentar um exige o SQL**: o CHECK lista os treze, com `ALTER`
  idempotente, porque `CREATE TABLE IF NOT EXISTS` não toca em tabela existente.
  Sem rodar, a reação nova é aceita pelo servidor e RECUSADA pelo banco — a tela
  mostra e nada grava.

**Toque duplo na foto = ❤️**, com o coração branco estourando no meio.

- ⚠️ **SEMPRE dá, nunca TIRA.** Quem toca duas vezes está dizendo "gostei", não
  "mudei de ideia". Alternando, tocar duas vezes num post já curtido apagaria a
  reação com uma animação de coração — a tela mostrando o oposto do que acabou
  de acontecer.
- ⚠️ **Duas travas, porque a foto TAMBÉM desliza**: dedo que andou mais de 12px
  é arrasto de carrossel, não toque; e o relógio zera ao disparar, para o
  terceiro toque não formar um segundo par com o segundo.
- ⚠️ **A chave do elemento muda a cada batida** — sem isso o segundo toque duplo
  seguido não desenha coração nenhum, porque o CSS não recomeça sozinho.
- `REACAO_DO_TOQUE_DUPLO` é `amei` e não uma décima quarta coisa: dois caminhos
  para o mesmo gesto criariam duas contagens para ele.

**A barra virou uma fileira que rola.** Eram treze pílulas "emoji + rótulo" em
`flex-wrap` — três linhas de etiquetas, que leem como formulário. Treze alvos de
44px somam 572px, mais que a largura de um iPhone, então ela rola de propósito.

**O resumo mostra os emojis que o post DE FATO recebeu** (`principaisReacoes`,
pura e testada). "12 reações" conta a mesma história para doze corações e doze
risadas, que são notícias diferentes. ⚠️ Só devolve o que tem contagem maior que
zero (treze em cinza fariam a ausência de reação ocupar espaço), e **o empate
desempata pela ordem de `REACOES`** — sem desempate fixo o mesmo post troca de
cara entre duas aberturas.

**A enquete** virou pílula com barra que CRESCE (`scaleX`, no compositor — animar
`width` repintaria a linha a cada quadro), ✓ na escolhida, e porcentagem **ao
lado** do número absoluto: a porcentagem sozinha transforma três pessoas numa
maioria, e o absoluto sozinho não diz a proporção.

**Os dois corações são DESENHADOS.** 🤍 sai cinza no Android e quase invisível no
escuro do iOS — mesma lição do 📞 e do 📅 —, e ele é o botão que a tela inteira
existe para fazer alguém tocar.

## A barra de baixo perdeu os nomes (ago/2026)

Pedido do dono. Ícone de 22 → 27px, num lugar só (`ALTURA_ICONE`), e o
espaçador invisível do botão do bebê lê a MESMA constante — senão ele desalinha
dos vizinhos no primeiro ajuste.

- ⚠️ **O bebê NÃO usa a tabela**, de propósito: ele é um círculo de 56px sobre a
  borda da barra, e a distância entre ele e os outros é o que diz qual é o
  destino principal. Crescer os dois juntos apagaria essa diferença.
- ⚠️ **`min-h-[44px]` no botão.** Tirar o rótulo tirou 20px de altura; sem o
  mínimo o alvo caía para ~35px. Medido depois: os cinco em 69×44.
- O rótulo saiu da TELA, não do app — o `aria-label` continua dizendo "Saúde",
  "Jogo", "Comunidade", e agora é a única fonte.

## ⚠️ O APP PAROU DE ABRIR: um array vazio novo a cada leitura (ago/2026)

O dono, no aparelho: _"agora quando eu tento entrar no aplicativo aparece essa
tela"_ — a de "Algo deu errado" —, e depois _"agora n está nem abrindo"_.

**A causa foi medida no navegador, em `/preview-home`:**

```
The result of getServerSnapshot should be cached to avoid an infinite loop
Error: Maximum update depth exceeded.
Warning: Error in route match: __root__/
```

`atalhosDe` (o registro dos atalhos da barra de baixo) terminava em
`registro[secao] ?? []`, e quem o lê é `useSyncExternalStore`. O contrato dele é
que `getSnapshot` devolva a **mesma referência** enquanto nada muda: o React
relê o instantâneo depois de cada pintura e compara por `Object.is`. Um `[]`
literal é objeto novo toda vez — então "mudou" era sempre verdade, e a barra
repintava em laço até o React estourar.

⚠️ **E o caso que estourava era o COMUM.** Só a Comunidade publica atalhos; toda
outra seção cai no `?? []` — inclusive a **home**, que é onde o app abre.

⚠️ **A barra vive FORA de qualquer `TabErrorBoundary`** — ela é a moldura do
app, não o conteúdo de uma aba. Não havia nada entre o defeito e a paciente: o
erro subia até a raiz da rota, e a raiz é a tela "Algo deu errado". Foi por isso
que envolver `AppHomeScreen` numa fronteira não resolveu nada — o `throw` nunca
esteve lá dentro.

- **`SEM_ATALHOS`** (uma lista congelada, exportada) substitui os dois literais:
  o `??` da leitura **e** o `getServerSnapshot` da barra. ⚠️ O segundo é lido na
  **hidratação** — um `[]` só ali reproduz o laço no primeiro instante da
  abertura.
- ⚠️ **O `tsc` NÃO cobra isto**: `() => []` é `never[]`, atribuível a
  `readonly AtalhoDaAba[]`. Quem cobra são dois testes — o de identidade
  (`atalhosDe(x) === atalhosDe(x)`, e a vazia é sempre `SEM_ATALHOS`) e um que
  lê os três argumentos do `useSyncExternalStore` na barra e recusa `[]`. Os
  três mutantes (o `??`, a seção nula e o `getServerSnapshot`) foram conferidos
  em vermelho.
- **A régua vale para o outro store também**: `hero-theme.ts` devolve um
  **booleano**, e primitivo é estável por natureza. O perigo é só quando o
  instantâneo é objeto ou array.

⚠️ **E a lição de método é mais cara que o conserto.** Passei três rodadas
deduzindo a causa a partir de screenshots — chunk que sumiu, régua clínica no
pacote, recuo do service worker, o portão da rota. **Nenhuma era esta.** O que
resolveu em minutos foi ABRIR A BANCADA NUM NAVEGADOR e ler o console: a
`/preview-home` reproduzia o defeito desde o commit que o criou, e ninguém tinha
olhado. É exatamente o que a skill `/tela` existe para dizer — _se você não
consegue verificar, não entregue_ —, aplicada a defeito e não a layout.

## A rede social: as dez estruturas (ago/2026)

Pedido do dono: "crie toda essa estrutura que existe de uma rede social, as dez
estruturas principais — perfis públicos e privados, seguir, postar fotos,
reações. Por enquanto vamos tirar os comentários."

Perfil · Seguir · Post · Visibilidade · Feed · Reações · Avisos · Descoberta ·
Bloqueio · Modo Cuidado. Régua em `src/lib/rede-social.ts` (34 testes), servidor
em `rede-social.functions.ts` (22 travas, verificadas por mutação), telas em
`src/components/rede-social.tsx`.

### ⚠️ NÃO HÁ COMENTÁRIO, e o número que decidiu

De **1.098 respostas com conselho** analisadas em fóruns de gestação, **20,9%
estavam erradas ou enganosas e 5,5% eram potencialmente danosas** — dez mulheres
que precisavam de avaliação urgente não foram encaminhadas a ninguém. E o grupo
**não se autocorrige**: só 5,2% das mensagens ruins foram retificadas.

Num app que carrega o nome do consultório, "comigo foi assim, não precisa ir ao
pronto-socorro" é responsabilidade do médico. Reação dá quase toda a sensação de
comunidade com uma fração do risco, e é **reversível**: dá para abrir texto
depois. O contrário não dá.

### As decisões que vão doer se forem desfeitas

- ⚠️ **O perfil nasce PRIVADO.** O grafo desta aba nasceu fechado por indicação,
  e é isso que a torna segura SEM MODERAÇÃO. Nascer público exporia milhares de
  gestantes de alto risco por omissão, sem nunca terem pedido plateia.
- ⚠️ **Seguir é o PRIMEIRO GRAFO ASSIMÉTRICO do app.** `amizades` e `duplas` usam
  par ordenado (`menor < maior`) porque a relação é mútua; aqui **não se pode** —
  (A segue B) e (B segue A) são duas linhas válidas, e copiar o par ordenado
  faria "seguir de volta" apagar o seguir original.
- ⚠️ **A visibilidade do POST é separada da do PERFIL**, e a separação é o
  recurso: um perfil público com um post `amigas` é o caso NORMAL. A
  influenciadora publica a ultrassom para o mundo e o desabafo de terça para as
  seis pessoas que ela conhece. Sem camada, o post é dirigido a "todo mundo que
  me segue" — que inclui a sogra e a chefe —, e é o motivo número um de as
  pessoas não postarem nada (colapso de contexto).
- ⚠️ **O feed é CRONOLÓGICO.** Um feed por "relevância" precisaria de engajamento
  como sinal — e numa comunidade de gestação de alto risco o post que gera mais
  reação é o da EMERGÊNCIA. Um algoritmo que aprende isso põe o susto de uma
  paciente como primeira coisa que todas veem.
- ⚠️ **As cinco reações são o vocabulário emocional do app**, e três do Facebook
  seriam catastróficas: **😂** embaixo do relato de um sangramento é
  indefensável; **😮** é ambíguo (metade lê "que lindo", metade "que horror"); e
  **😢** lê como PENA, que é a coisa que ela menos quer receber. Ficaram
  ❤️ 🙏 🥹 👏 🤗 — e `abraco` é a que faz o conjunto funcionar: sem ela, quem
  posta uma coisa dura só recebe coração, que soa comemorativo no momento errado.
- ⚠️ **UMA reação por pessoa por post**, trocável. É o que impede alguém de
  encher um post com cinco emojis, o que num post sobre notícia difícil pareceria
  deboche.
- ⚠️ **Reação NÃO manda push — só o pedido para seguir manda.** O push deste app
  é o mesmo canal do aviso de emergência, e quem desliga as notificações por
  causa de um coraçãozinho de madrugada desliga o resto junto. O pedido manda
  porque PEDE uma ação dela.
- ⚠️ **Não existe contador público de seguidores.** Ele mede popularidade num
  momento em que ela já está sendo medida clinicamente. O contador de reações de
  um POST fica, e a diferença não é de grau: reação num post é calor sobre uma
  coisa específica; contagem de seguidores é um ranking de pessoas. No perfil que
  os outros veem o campo é `null`, e o servidor nem o calcula.
- ⚠️ **A busca só encontra perfil público**, e o filtro está na CONSULTA
  (`.eq("perfil_publico", true)`), não num filtro depois. Quem não abriu o perfil
  não pode nem viajar pela rede.
- ⚠️ **O bloqueio é CALADO e de efeito DUPLO.** Guardado numa direção, lido nos
  dois. Anunciar transforma a proteção num ato de confronto, e num app onde as
  pessoas se conhecem da vida real isso piora a situação que o motivou.

### Por que a leitura não é RLS

Saber se eu posso ver um post cruza QUATRO coisas: Modo Cuidado do autor,
bloqueio nos dois sentidos, o seguir, e o grafo de amizade que já existe. Uma
policy que fizesse isso duplicaria `podeVerPost` em SQL, e as duas divergiriam no
primeiro conserto — com a divergência aparecendo como **post vazando**, não como
erro. E `contextoDe` carrega tudo de uma vez: perguntar por post faria um feed de
vinte posts custar oitenta consultas.

### ⚠️ A ORDEM DO BLOQUEIO substituiu um rollback

Bloquear são DUAS escritas — desfazer o seguir e gravar o bloqueio — sem
transação entre elas. A primeira versão gravava o bloqueio e desfazia o seguir
depois, com rollback no erro. Mas **rollback é mais uma escrita que pode falhar,
e falhando deixa exatamente o estado que veio evitar**.

Desfazendo o seguir PRIMEIRO, os dois estados intermediários viram assimétricos:
falha no primeiro não escreve nada; falha no segundo deixa ela tendo deixado de
seguir sem bloquear — o gesto MENOR, com erro na tela. O estado que não pode
existir (bloqueio de pé com o seguir vivo, ressuscitando o vínculo no dia do
desbloqueio) deixou de ser alcançável. **Meio bloqueio é pior que nenhum, porque
ela acha que está protegida.**

E a mutação que INVERTIA a ordem passava verde, porque nenhuma asserção falava de
ordem. Hoje há uma.

### Modo Cuidado

Some inteira, sem anunciar, sem apagar nada: o perfil não é encontrável, os posts
não são visíveis, ela não aparece na busca, e quem já a seguia simplesmente para
de ver posts novos — sem nenhuma mensagem. "Fulana saiu" contaria a perda dela
para todo mundo que a seguia.

⚠️ **E ela continua vendo os PRÓPRIOS posts** (`podeVerPost` devolve `true` para
a autora mesmo em luto). Escondê-los dela seria o app apagar o bebê dela — a
mesma decisão que manteve `exam_files` de pé e o Álbum na Comunidade. O que some
é a rede em volta, não a memória dela.

**Aplicar no Supabase:** `supabase/APLICAR_REDE_SOCIAL.sql` (cria as quatro
tabelas, duas colunas em `patient_profiles` e o balde privado `rede`).
**Bancada:** `/preview-rede` · `?tela=perfil&pedidos=3` · `?vazio=1` · `?luto=1`.

## O modelo Instagram, e o básico inteiro (ago/2026)

Pedido do dono: "vamos copiar exatamente o modelo do Instagram — as dimensões,
tudo tem que estar igual", e depois "faça uma varredura de tudo que é o básico e
aplique", tirando reels e contas profissionais.

Telas em `src/components/rede-instagram.tsx`; as medidas, com a origem de cada
uma, em `src/lib/medidas-instagram.ts` (testado).

### As medidas, MEDIDAS no navegador a 393px

|                  |                                                          |
| ---------------- | -------------------------------------------------------- |
| bolinha de story | **72×72** (64 de foto + 2 de vão + 2 de anel, cada lado) |
| grade            | 3 colunas, gap 2px                                       |
| célula da grade  | 130×173 → razão **0,750 = 3:4 exato**                    |
| post do feed     | 393×491 → razão **0,800 = 4:5 exato**                    |
| avatar do perfil | 86px                                                     |

⚠️ **A grade é 3:4, não quadrada.** Mudou em 2025. Quem construir 1:1 hoje faz
um Instagram de 2024 e corta a foto vertical, que é a maioria.

⚠️ **O post do feed tem TETO de 4:5.** Sem ele o `<img>` sai na altura natural,
e a bancada mostrou fotos 3:4 virando posts de ~524px num aparelho de 393 — a
pessoa rola a tela inteira e vê UM post. Com foto de celular em pé seria o
dobro. Isso veio de OLHAR a tela, não de ler a especificação.

⚠️ **Os números não saíram de decompilador nem de régua sobre print** — são as
proporções publicadas mais a documentação de design. A ESTRUTURA e as PROPORÇÕES
batem; um pixel de padding pode diferir. Para o encaixe fino: print do dono +
`scripts/comparar-com-referencia.mjs`.

### Três coisas NÃO copiadas, todas deliberadas

1. ⚠️ **O degradê do anel.** Laranja-rosa-roxo é a marca deles e a coisa mais
   reconhecível da interface — um app de gestação com aquele anel lê como
   imitação. Copia-se a ESTRUTURA (anel aceso = tem coisa nova), que é convenção
   e funciona porque todo mundo já sabe ler. Há teste recusando os cinco hex.
2. ⚠️ **Quatro abas viram DUAS.** Eles têm quatro porque têm quatro TIPOS de
   conteúdo; este app tem um. Três abas vazias ao lado de uma cheia não copiam o
   Instagram — copiam a aparência dele e entregam a sensação de um app pela
   metade. A segunda é "Do bebê".
3. ⚠️ **Seguidores e seguindo não são públicos**, e a LISTA também não. No
   Instagram qualquer um abre a lista de seguidores de um perfil público; aqui a
   lista de quem acompanha uma gestante de alto risco é o CÍRCULO SOCIAL dela.
   `NUMEROS_PUBLICOS` guarda a decisão, e o teste diz por quê.

### Uma coisa que o Instagram NÃO faz e nós fazemos

**"Sugerido para você"** é obrigatório no post que não veio de quem ela segue.
Sem o rótulo, o feed mistura estranhos sem avisar — e num app de gestação de
alto risco a pessoa precisa saber se está lendo uma amiga ou uma desconhecida
antes de decidir o peso do que leu.

### O básico, e as armadilhas de cada peça

- **Stories.** ⚠️ A fileira já existia DESENHADA e era decorativa: anel aceso, e
  tocar não fazia nada. `animationPlayState` pausa a barrinha JUNTO com o
  `setTimeout` — sem isso o dedo para o relógio e a barra continua correndo,
  chegando ao fim antes de a foto trocar, o que lê como travamento. Marca como
  visto ao ENTRAR, não ao sair: quem fecha no meio já viu, e marcar na saída
  deixaria o anel aceso para sempre em quem sempre fecha antes do fim.
  `object-contain`, nunca `cover` — cortar as bordas engole o texto que a pessoa
  escreveu na foto.
- **Carrossel.** ⚠️ Rolagem NATIVA com `scroll-snap`, nunca `transform` por
  estado: o deslizar tem inércia e resistência de borda que o sistema calcula, e
  reimplementar dá sempre um arrasto que parece quase certo e nunca é. Os
  pontinhos saem do `scrollLeft`, não de um índice — com índice próprio, arrastar
  até a metade e soltar deixaria o ponto num lugar e a foto noutro. Se UMA foto
  falhar ao subir, o post inteiro é recusado: quatro de cinco entregaria um
  carrossel com buraco e ela não saberia qual sumiu.
- **Editar perfil.** ⚠️ A foto só sobe se MUDOU — reenviar a mesma a cada
  salvamento deixaria o arquivo antigo órfão no balde, e cem edições de bio
  virariam cem fotos. E ela vai para o BALDE, não como data URL na coluna: o
  avatar viaja em toda leitura de lista, e em base64 custa ~35% a mais em cada
  linha. Depois de salvar, a tela RECARREGA do servidor — a foto volta como URL
  assinada, e pintar a data URL deixaria a tela certa e o banco diferente.
- **Salvar.** ⚠️ `meusSalvos` passa pela régua de visibilidade DE NOVO na
  leitura: ela pode ter salvado e a autora ter fechado o perfil depois. Salvo é
  marcador, não cópia — e marcador não sobrevive à decisão de quem escreveu.
- **Atividade.** ⚠️ É TABELA e não view, porque uma view não teria onde guardar
  o VISTO — e sem visto não há emblema, e sem emblema ninguém abre a aba. Índice
  único sobre (dono, quem, espécie, post): sem ele, tirar e pôr a reação cinco
  vezes encheria a caixa com cinco avisos e ela abriria achando que cinco pessoas
  reagiram. ⚠️ **Abrir a aba marca TUDO**, ao contrário da central de recados
  onde o toque em cada item é quem marca — lá são recados que podem exigir ação
  dela, aqui são coraçõezinhos.

### ⚠️ A aba abre no FEED, não no hub

Pedido do dono: "essa é a primeira tela que tem que ter quando se entra na aba da
comunidade". Uma aba social que abre num menu de seções cobra um toque a mais
para chegar na única coisa que muda sozinha. O hub virou o botão ⊞ do cabeçalho.
`comunidade.test.ts` trava o mapeamento.

**Aplicar no Supabase:** `supabase/APLICAR_REDE_SOCIAL.sql` — o MESMO arquivo,
que foi crescendo porque o dono ainda não o rodou. Oito tabelas, e a conferência
do fim tem dez colunas.

**Bancadas:** `/preview-instagram` · `?tela=perfil&meu=1` · `?tela=editar` ·
`?tela=lista` · `?tela=post` · `?tela=story` · `?tela=atividade` · `?vazio=1`.

### As sete portas que não existiam, e a catraca que impede a próxima (ago/2026)

A rede nasceu de trás para a frente — servidor, régua, telas — e ninguém tinha
conferido se dava para CHEGAR nelas. Não dava: **sete funções de servidor
prontas e testadas não tinham chamador nenhum no app.**

- `publicarPost` — o compositor existia em `rede-social.tsx`, arquivo que o app
  parou de renderizar quando o feed virou o modelo Instagram. Dava para ler o
  feed e era impossível publicar.
- `apagarPost` — nada, em lugar nenhum. Publicar sem poder apagar, num app onde
  a publicação é sobre a gestação dela.
- `responderPedido` — a pior. O perfil nasce FECHADO (`PERFIL_PUBLICO_PADRAO =
false`), então **todo** seguir vira "pendente", e a única porta estava
  enterrada numa seção de ajustes. A rede parava aí, por construção.
- `salvarPost`/`meusSalvos`, `minhaAtividade`/`marcarAtividadeVista`,
  `buscarPerfis`, `bloquear` — nenhuma tela chamava.

É a mesma família de `proximoDesbloqueio`/`escadaDeTrofeus` (escritas, testadas,
zero chamadores) e das três conquistas da Escola do Bebê que liam uma tabela que
nada escrevia. **`src/lib/rede-tem-porta.test.ts` é a catraca**: toda função de
servidor da rede tem de ser alcançável a partir do app. Bancada não conta — é
justamente onde estas viviam. Três coisas que ela aprendeu na primeira hora:

1. ⚠️ **Casa PALAVRA INTEIRA, nunca `includes`.** `bloquear` passava por
   `bloquearPeriodo`, da grade de horários do médico.
2. ⚠️ **Só nos arquivos que IMPORTAM o módulo.** Nome de função é palavra comum
   em português — "bloquear" aparece em `entitlements.ts` e em meia dúzia de
   comentários.
3. ⚠️ **Tira os COMENTÁRIOS antes de procurar.** `publicarPost` voltou a passar
   no instante em que escrevi, num comentário, que ele tinha ficado sem porta:
   um teste que aceita a própria prosa fica verde exatamente quando o defeito
   está documentado.

O que ganhou porta: **＋ Nova publicação** (fotos a 1080 — o avatar é 512, aqui
a foto ocupa a largura da tela —, legenda com contador e a camada À VISTA, com
padrão no mais fechado: o erro possível é publicar para menos gente do que ela
queria, nunca para mais) · **⋯ Apagar** com confirmação em mensagem separada, a
mesma decisão do cancelar consulta · **marcador de salvar** (desenhado, porque
🔖 é colorido em todo sistema) e a coleção privada em tela própria · **♡
Atividade** com emblema, buscada JUNTO com o feed (o emblema é o que faz alguém
tocar) e com **aceitar/recusar ali mesmo** · **🔍 Busca** com vazio que EXPLICA
a régua ("só aparece quem deixou o perfil público" — senão procurar a irmã e não
achar lê como app quebrado) · **Bloquear** dizendo antes o que faz.

⚠️ `FeedDaRede`/`Publicar`/`CartaoDoPost` **saíram**: duas telas de publicar
divergem no primeiro conserto. `ConfiguracoesDoPerfil` ficou — é o que a outra
não faz (chave do perfil público, bio, fila de pedidos).

⚠️ **`pendente` vem do SERVIDOR** (`minhaAtividade`), cruzando com
`rede_seguidores`: a linha da atividade é gravada quando o pedido chega e nunca
muda, então sem esse campo um pedido já aceito mostraria "Aceitar" para sempre —
botão que promete uma ação e não faz nada, porque o `update` filtra por
`estado = "pendente"` e não acha mais linha.

⚠️ **`salvo` também vem do servidor**, de uma consulta recortada por
`quem_id = eu`. Um `salvo` que viesse do post seria o mesmo para todo mundo — o
marcador de uma acenderia na tela das outras.

### A hora do post, o feed que continua, e o story que agora tem público

- **A hora não existia em post nenhum.** É a única informação que o modelo põe
  em TODOS, e aqui pesa mais: as notícias deste feed têm data biológica — "o
  ultrassom de hoje" de quem estava com 28 semanas naquela semana é outra frase
  hoje, com 31. `haQuantoPublicou` (`rede-social.ts`, pura) faz
  agora→min→h→d→sem e depois de **quatro semanas vira DATA CHEIA**, sem passar
  por "meses": um post de dois meses é de outro trimestre, e "há 2 meses"
  obriga a paciente a fazer a conta de quando foi. ⚠️ `agora` é PARÂMETRO
  (teste que depende do relógio do contêiner falha às terças), futuro por
  relógio dessincronizado vira "agora", e **sem caixa alta** — "3 h" virava
  "3 H".
- **O feed parava no vigésimo.** `meuFeed` devolvia o cursor `proximo` desde o
  primeiro dia e nenhuma tela o usava — servidor pronto sem porta que a catraca
  NÃO pegaria, porque o nome da função é chamado; o que ninguém usava era o
  retorno. Sentinela por `IntersectionObserver` (⚠️ não ouvinte de `scroll`: a
  aba vive dentro de `minha-conta` e quem rola pode ser a janela ou um
  contêiner interno), `rootMargin` de 600px, trava de pedido duplo em `useRef`
  (⚠️ `useState` só valeria no render seguinte, e a sentinela dispara duas vezes
  no mesmo tranco), e junção **sem repetir por id** — a régua filtra depois de
  ler, duas páginas podem se sobrepor, e chave repetida derruba a lista inteira.
- **"Visto por" e a lixeira do story.** Publicar um story sem saber se alguém
  viu é falar sozinha para uma parede que some em 24 h. ⚠️ Em
  `quemViuMeuStory` a conferência de dono vem ANTES da leitura, e o teste cobra
  a ORDEM. ⚠️ E a lista **não** é filtrada por Modo Cuidado nem por bloqueio,
  ao contrário da caixa de atividade: lá a linha é um gesto dirigido a ela,
  aqui é o registro de que a foto DELA foi vista — esconder uma linha faria o
  número discordar da lista logo abaixo. ⚠️ **A folha PARA o relógio** (o
  `setTimeout` e a barrinha), senão o story passa por baixo dela.

A catraca dos DELETE subiu de seis para **sete** (`apagarStory`), com o motivo
escrito ao lado dos outros. O POST continua sendo a exceção: arquivado, nunca
apagado, porque as reações apontam para ele.

**Bancadas novas:** `/preview-instagram?tela=novo` · `?tela=salvos` ·
`?tela=busca` · `?tela=story&meu=1`. E `/preview-rede` encolheu: virou só as
configurações do perfil (a chave do público, a bio e a fila de pedidos), porque
a do feed apontava para componentes que o app não abre mais.

### "Sugerido para você" — e a peça do modelo que ficou de fora (ago/2026)

Pedido do dono depois de rodar o SQL: "faça mostrar sugeridos para você, pense e
aplique o modelo do Instagram". O rótulo existia desde o começo e **nunca teve
produtor**: o feed só continha quem ela segue.

⚠️ **ENGAJAMENTO NÃO É SINAL AQUI. NENHUM.** É o que o Instagram usa acima de
tudo, e é exatamente o que não pode ser usado numa comunidade de gestação de
alto risco: **o post que gera mais reação numa base assim é o da EMERGÊNCIA** —
o sangramento, o susto, a internação. Um ranqueamento que aprende engajamento
aprende a pôr o pior dia de uma paciente como a primeira coisa que todas as
outras veem, e a fazer isso com quem elas NÃO conhecem. O feed de quem ela segue
já é cronológico por essa razão; a zona de sugestões seria a porta dos fundos
dessa decisão. Há teste varrendo `sugestoes.ts` atrás de qualquer menção a
reação.

⚠️ **E NÃO ENTRA "MESMO MÉDICO".** `patient_profiles.doctor_id` está ali, daria
um sinal ótimo e é **dado de saúde**. Montar grafo social a partir de com quem
ela se trata é usar o prontuário para sugerir amizade — mesmo que a tela nunca
diga o motivo, o efeito é esse.

**O que entra:** elos em comum (quantas pessoas que eu sigo seguem aquela
autora — o sinal de verdade do modelo) e recência dentro de cada faixa.
⚠️ **Os elos ORDENAM e nunca vão à tela**: "seguida por Marina e mais 3"
entregaria quem ela segue a quem só abriu o feed, e a lista de seguidores deste
app não é pública de propósito. Há teste cobrando que `elosEmComum` não apareça
no componente.

**O arranjo é o "você está em dia"**, e não a interlaçada moderna: a zona só
abre quando o feed de quem ela segue ACABOU, com o divisor no meio. Não é
estética — misturar desconhecidas entre as pessoas que ela escolheu faz a
paciente ler um relato duro sem saber de quem veio. Com o aviso, tudo abaixo
dele tem procedência, e cada publicação ainda leva o rótulo.

Régua em `src/lib/sugestoes.ts` (pura, 18 testes):

- **perfil PÚBLICO e post PÚBLICO** — as duas camadas são separadas, e a
  separação é o recurso (perfil aberto com post `amigas` é o caso normal).
- Fora: quem ela segue, quem bloqueou ou a bloqueou, **quem já tem pedido
  pendente dela** (sugerir quem ela acabou de pedir é o app esquecendo o que ela
  fez), e ela mesma.
- `podeAparecerNaBusca`, a **mesma régua da busca** — quem não pode ser achada
  não pode ser sugerida, senão a sugestão vira a porta dos fundos da busca (e o
  Modo Cuidado volta à tela pela lateral).
- ⚠️ **Duas publicações por autora.** Sem o teto, uma pessoa pública que publica
  muito enche a zona — e numa base pequena isso não lê como sugestão, lê como
  "o app está me empurrando essa desconhecida".
- ⚠️ **Trinta dias de validade**, e o corte é de gestação: quatro meses atrás é
  OUTRO TRIMESTRE. O feed de quem ela segue não tem esse corte de propósito.
- ⚠️ **Teto de 60 autoras na consulta** — limite de URL, não de gosto: o `in()`
  do PostgREST vai na query string, e 400 uuids são ~15 KB de endereço.
- ⚠️ O post é montado por **`montarPosts`**, nunca à mão: é ela que aplica
  `podeVerPost`, assina as URLs e traz reações e salvos. E a ordem final é a da
  RÉGUA — `ordenarFeed` aqui desfaria o ranqueamento em silêncio.

**A fileira de pessoas sugeridas** é ordenada por elos e depois por quem
apareceu por último no app — ⚠️ **nunca por audiência**, que transformaria a
fileira num ranking de popularidade, a coisa que este app decidiu não ter. Na
conta NOVA ela é a única coisa útil na tela, e por isso aparece mesmo sem
divisor. ⚠️ O cartão **não some ao seguir**: sumir no toque tira da tela a única
confirmação de que o toque funcionou, e ela toca de novo.

**Bancada:** `/preview-instagram` (rolar até o fim) · `?vazio=1` (conta nova) ·
`?sugeridas=0` (o feed sem a zona).

## As dez funções sociais, em seis fases (ago/2026)

Pedido do dono depois de aprovar as dez sugestões: "monte a ordem para
aplicarmos de maneira que fique harmônica e usual no nosso site sem confusões,
pense como um profissional de mapeamento de processo; depois rode um loop de
agentes verificando cada etapa e se ela conecta com o resto do site".

A ordem saiu de um mapeamento com 14 agentes (um por função, um de ordenação,
três críticas adversariais), e **três achados mudaram o que eu ia fazer**:

1. **O espelho tinha de ser um MODO de `verPerfil`, não uma segunda montagem.**
   A prévia seria um modo de `podeVerPost` — mas o selo, a pílula do código e a
   linha do bebê são campos de `PerfilNaTela`, montados a partir do `eu` REAL:
   nunca passariam pelo filtro. A tela afirmaria, como visão de uma estranha,
   três coisas que jamais filtrou.
2. **O código de embaixadora saiu da fase 1.** Ele colhia consentimento no
   começo e o gastava na fase 5, quando o mesmo `ref_code` vira canal de
   presente de uma criadora.
3. **A fase 1 é inerte para a paciente comum** (`perfil_publico` nasce falso), e
   por isso o espelho diz isso em voz alta em vez de desenhar um perfil que
   ninguém alcança.

| Fase | O quê                                                 | SQL                         |
| ---- | ----------------------------------------------------- | --------------------------- |
| 1    | Espelho + duas chaves (semana, nome do bebê)          | 2 colunas                   |
| 2    | A aba "Do bebê" deixa de prometer                     | —                           |
| 3    | Carimbo da semana no story                            | 1 coluna                    |
| 4    | Aula compartilhável + enquete no post                 | 2 colunas + 1 tabela        |
| 5    | Influenciadora: código no perfil · presente · desafio | (parcial)                   |
| 6    | Caixinha de perguntas                                 | pendente de decisão do dono |

### ⚠️ A régua da semana pública, e a regra que ela reabre

`src/lib/selo-do-perfil.ts` é a régua única. Ela **reabre** a proibição de
`amigas.ts` ("nada clínico: sem semanas, sem DPP"), e a reabertura é declarada:
a razão escrita lá **não é privacidade, é LUTO** — nas Amigas o perfil continua
visível quando uma gestação termina mal, então o dado do corpo não pode estar
lá. Na rede social o Modo Cuidado já torna o perfil inteiro `indisponivel`, e o
selo some junto sem uma linha nova. Há teste cobrando que `amigas.functions.ts`
continue sem `lmp_date`/`computeGestation`.

A régua cala em cinco casos, e cada um é um defeito que existiria sem ele: Modo
Cuidado · já nasceu (`computeGestation` conta para sempre — quem pariu na 39ª
apareceria como "47 semanas") · sem DUM · acima de 42 semanas · chave desligada.
⚠️ E "0 semanas" não é silêncio: a régua devolvia número onde promete calar.

⚠️ **DUAS chaves, nunca uma.** Uma só obrigaria quem quer publicar o NOME do
bebê a publicar junto a SEMANA, que é o dado clínico.

⚠️ **O "hoje" é o de São Paulo, não o do contêiner.** O servidor roda em UTC;
das 21h à meia-noite ele já está no dia seguinte, e num dia de cada sete isso é
a virada de semana — o perfil dizia "28 semanas" e a home da mesma sessão dizia
27, porque a home calcula no navegador dela.

### ⚠️ `OLHO_DA_PREVIA` — o `===` que separava a prévia da mentira

`podeVerPost` curto-circuita em `euId === post.autorId` ("a dona sempre vê os
dela"). Montar a prévia com o MEU id faria TODO post passar — inclusive os da
camada `amigas` — e a tela afirmaria que uma seguidora vê o desabafo de terça,
sem erro e sem log. O sentinela é uma string que nunca casa com uuid.

⚠️ E `somenteLeitura` desliga as ações **num lugar só**, dentro de
`TelaDePerfil` — nunca pelo chamador. O sexto controle que alguém acrescentar
amanhã nasce desligado; um dos previstos grava `ref_code`, que nunca é
reescrito.

### ⚠️ O portão de alcance não existia — e o espelho jurava que sim

`verPerfil` **nunca** conferiu `perfil_publico`. Com o uuid em mãos — e ele
viaja em toda reação, todo story visto, todo pedido de seguir — qualquer
paciente autenticada abria qualquer perfil, fechado ou não. Enquanto o perfil
tinha só nome, foto e bio era exposição pequena; a Fase 1 pôs ali a idade
gestacional e o nome do bebê. E o espelho AFIRMAVA a tranca: a paciente lia "ela
não consegue abrir o seu perfil" e ligava o selo confiando naquilo.

**Uma tela de verificação que erra para o lado de "você está protegida" é pior
que não existir.** Hoje `alcancaOPerfil` é uma régua só, chamada pelos dois
caminhos.

### ⚠️ O select novo quebrou a produção em silêncio

As colunas nascem num `APLICAR_` que o dono roda à mão, e o deploy chega antes:
`42703` derrubava `perfisPorId`, que devolvia um Map vazio — e `montarPosts`
descarta todo post cujo autor não está no Map. Feed vazio, nenhum perfil
abrindo, busca sem resultado, e `verPerfil` respondendo `indisponivel` para a
própria dona. Sem erro na tela, sem log. **Todo select de coluna nova da rede
tem recuo**, e o mesmo vale para `publicarStory` e `publicarPost` — sem eles,
PUBLICAR pararia de funcionar para todo mundo, não só o recurso novo.

### ⚠️ `aula.dia` era a semana disfarçada

A Fase 4 ia anexar `{ dia, titulo }` ao post. O dia gestacional **é** a semana:
`D = semana × 7 + diaDaSemana`. "Aula do dia 139" publica "estou de 19 semanas"
para quem souber dividir por sete — **passando por cima da chave que a Fase 1
criou exatamente para essa decisão ser dela**. Seria o pior tipo de vazamento: o
que entra pela porta dos fundos de um recurso feito para fechar a da frente.

Sobrou o TEMA (`bebê · corpo · nutrição · sinais · exames · vínculo · revisão`),
que gira igual para todo mundo. A conversão dia→tema acontece no APARELHO dela
(`aula-compartilhavel.ts`), e o número nunca sai.

E continua fora: a NOTA (seria o placar público que a aba das Amigas gastou um
arquivo inteiro para não ter) e enunciado, alternativas e gabarito (vazam
conteúdo premium pelo `quizPremium`).

### A enquete

- ⚠️ **NÚMERO, nunca porcentagem.** "67%" são dois votos de três, e numa base
  pequena a porcentagem transforma três pessoas numa maioria.
- ⚠️ **Ninguém vê quem votou em quê — nem a autora.** No Instagram ela vê, e
  esse é o dado que este app decidiu não expor (a mesma razão de `rede_salvos`
  ser privado inclusive para a autora).
- ⚠️ **O voto não se troca, e ela sabe ANTES.** A PK garante um por pessoa;
  descobrir tocando é o tipo de surpresa que faz alguém desconfiar do app.
  Colidir na PK é sucesso repetido, nunca erro.
- ⚠️ `voto`/`enquete`/`rede_votos` entraram na lista de palavras proibidas de
  `sugestoes.ts`: "mais votada" é "mais reagida" com outro nome.

### O carimbo do story

⚠️ **Sobreposição DERIVADA, nunca tinta no JPEG.** O banco guarda um booleano; a
semana sai da régua na leitura. Queimado no pixel, o arquivo no balde ficaria
com "28 semanas" para sempre.

⚠️ **E ele NÃO passa pela chave do perfil, de propósito.** A aritmética é a
mesma e os silêncios também; o que muda é o portão — a chave do perfil é
permanente, o carimbo é por publicação e some em 24h. Amarrar os dois obrigaria
quem quer mandar UMA foto com a semana a publicá-la no perfil para sempre.

⚠️ E ele consertou um defeito que ninguém pediu: o story subia por
`prepararAvatar` (512px QUADRADO, recorte central) num formato 9:16 exibido
inteiro.

### ⚠️ Meus próprios testes eram atravessáveis

O agente encarregado de prová-lo rodou seis mutações no bloco do espelho e
**todas passaram verdes** — inclusive cravar `mostrarSemana: true` no adaptador,
que desliga o consentimento inteiro. Eram `toContain` sobre o texto do fonte.

O conserto não foi escrever mais `toContain`: `entradaDoSelo` e
`contextoDaPersona` saíram do servidor para `selo-do-perfil.ts`, onde são puros
e testados por COMPORTAMENTO. **Régua pura é régua testável; adaptador escondido
no servidor não é.**

⚠️ E a prosa quebra teste nos DOIS sentidos: na catraca de portas um comentário
meu fazia o teste PASSAR; no teste do código de embaixadora, um comentário meu o
fazia FALHAR. Tira-se o comentário antes de procurar, sempre.

### ⚠️ A bancada mentiu três vezes, sempre do mesmo jeito

A bio de exemplo dizia "· 32 semanas" (desligar o selo continuava mostrando a
semana); o espelho desenhava outra pessoa e "Seguir" nas três personas; e a
Carol, "Mãe do Bento 🧸 · pós-parto", carregava selo de 32 semanas — o par
exato que `semanaPublica` recusa. Bancada que aprova o que o servidor não
produz é pior que bancada nenhuma.

**Aplicar:** `supabase/APLICAR_REDE_SOCIAL.sql` (idempotente).
**Bancadas:** `/preview-instagram?tela=espelho` · `?tela=espelho&trancado=1` ·
`?tela=perfil&meu=1&selo=1` (os dois selos e a aba do bebê) · `&selo=2` (uma
chave sozinha) · `&selo=0` · `?tela=conferir` (o carimbo) · `?tela=novo`
(enquete e anexo da aula) · `?tela=perfil` (a pílula do código).

### Fase 5 — a criadora ganhou o que dar, e o grupo ganhou uma semana

Três peças, todas do lado da influenciadora, e as três brigaram com uma regra
que já existia.

**O código de embaixadora no perfil.** A pílula do código aparece no perfil de
OUTRA pessoa (no meu ela ofereceria que eu me indicasse), e o botão só existe
para quem ainda não tem `ref_code`. ⚠️ **Falso sob a PRÉVIA, sempre**: o campo é
gravado UMA VEZ e nunca reescrito, e é o MESMO campo que carrega o código da
médica dela — um toque numa tela que o app apresenta como inerte queimaria a
indicação para sempre, sem erro e sem volta. O `somenteLeitura` do espelho já
desliga o botão; `possoAplicarOCodigo: !persona && …` é o cinto, porque tela e
servidor discordarem aqui custa caro.

**A criadora presenteia quem ela trouxe** (`minhasIndicadas`,
`presentearIndicada`). ⚠️ **A régua é `ref_code`, nunca `referred_by`** — a
mesma decisão que criou o campo: `referred_by` é o grafo de AMIZADE, e uma
criadora com três mil seguidoras viraria amiga de três mil gestantes.
`MESADA_DA_INFLUENCIADORA` (300 🌱) e `PRESENTE_DA_INFLUENCIADORA` (30 🌱)
moram em `economia-sementinhas.ts`, com todo número da economia — é o que
permite os testes de teto somarem as torneiras todas. Medido com o
`diasParaZerarLoja` de verdade: a parede cai de 19 para 18 dias sem médico, e
de 16 para 15 com ele; o teto continua em 2.

**O desafio da semana em grupo** (`desafio-em-grupo.ts`, puro e testado).

- ⚠️ **OPT-IN, e é ele que impede o grupo compulsório.** A tentação óbvia é
  juntar automaticamente quem tem o `ref_code` da criadora — e isso recria por
  fora exatamente o grupo que o código foi tirado do grafo de amizade para não
  criar. Pior: `ref_code` é fixado UMA VEZ, então não haveria como sair.
  `desafio_participantes` guarda CONSENTIMENTO, não contagem, e sair MARCA.
- ⚠️ **Três dias, não sete.** Sete significa "não faltar um dia", e a semana da
  internação existe: um desafio que quebra na primeira noite no pronto-socorro
  ensina a não participar.
- ⚠️ **O contador é NÚMERO ABSOLUTO, nunca fração** — "3 de 300 fecharam" diz ao
  grupo inteiro que quase ninguém veio. E abaixo de duas pessoas a tela não fala
  do grupo: com uma só, o "1 fechou" é ela mesma se olhando no espelho.
  **Nunca a lista de quem fechou** (seria a lista de seguidoras da criadora, que
  este app decidiu não ter) — nem a de quem NÃO fechou, que seria pior.
- ⚠️ **O título é de CATÁLOGO FECHADO** — as quatro atividades que o Caminho já
  grava no ledger, e mais nenhuma. Campo livre aqui é conselho de saúde de leiga
  distribuído em massa com o nome do consultório em volta. Há teste conferindo
  que as quatro batem com `ATIVIDADES_DO_DIA` de `conquistas.ts`: uma quinta
  seria um desafio que nunca fecha, porque nada escreve aquela chave.
- ⚠️ **`domingoDaSemana` quase entrou com off-by-one**: `getUTCDay()` devolve 0
  para domingo, e recuar `dia - 1` daria −1, jogando o domingo para a semana
  seguinte. Há teste.
- **O bônus não retroage** (confere hoje e ontem), a chave carrega o desafio E a
  pessoa (duas criadoras podem propor na mesma semana), e a cobrança roda junto
  com a leitura — o mesmo desenho de `cobrarBonusDaDupla`, que passou meses só
  pagando quem abria a aba Amigas.

### Fase 6 — a caixinha de perguntas, e a régua nos DOIS textos

⚠️ **É a função mais arriscada da aba**, e pela mesma razão que fechou os
comentários: de 1.098 respostas com conselho em fóruns de gestação, **20,9%
estavam erradas e 5,5% eram potencialmente danosas**, e o grupo não se
autocorrige (5,2% de retificação).

A diferença é que aqui o texto perigoso é a **RESPOSTA**. `triarTexto`
(`src/lib/pergunta-clinica.ts`) roda na pergunta E na resposta: uma caixinha que
triasse só a entrada publicaria "no seu lugar eu esperava" com o nome do
consultório em volta.

**A régua saiu de `secondbrain.server.ts`** e virou módulo próprio — as duas
listas (`BANDEIRA_VERMELHA`, `TERMOS_CLINICOS`) viviam dentro do roteador do
chat, e uma segunda cópia divergiria no primeiro conserto, aparecendo como
pergunta clínica virando post público. Uma lista, dois usos.

⚠️ **O nome é "REDUZ risco", nunca "impede".** `TERMOS_CLINICOS` é allowlist, e
allowlist de vocabulário clínico nunca fica pronta: medido no chat, **61 de 85
termos comuns eram invisíveis** — inclusive `aborto`, `pré-eclâmpsia`,
`convulsão`, `desmaio` e `bolsa rota`. Há teste proibindo o arquivo de se
chamar de garantia.

**Duas regras novas, e as duas nasceram de medição:**

- ⚠️ **`PEDIDO_DE_CONDUTA` é FORMA, não vocabulário.** "Comigo foi assim, não
  precisa ir ao pronto-socorro" não tem bandeira vermelha nenhuma e é a frase
  mais perigosa que uma paciente pode escrever para outra. O padrão pega o
  pedido ("posso tomar?") e a entrega ("não precisa ir"), e é conferido ANTES do
  vocabulário — invertido, ela cairia em `publicavel`, porque não tem termo
  clínico nenhum.
- ⚠️ **`TERMOS_CLINICOS` sozinho NÃO roteia.** Medido: "vocês fizeram chá de
  bebê?" ia para a fila do médico, porque `bebê` está na lista. Numa caixinha de
  gestante, `bebê`, `barriga`, `parto` e `semana` são o ASSUNTO — rotear tudo
  isso mataria o recurso e afogaria o consultório. Só roteia acompanhado de
  `SINTOMA_EM_PRIMEIRA_PESSOA`: o que importa não é falar de corpo, é falar do
  PRÓPRIO corpo agora.

#### ⚠️ Anonimato na TELA, nunca no banco

`rede_perguntas.quem_id` é gravado sempre e devolvido nunca. A caixa ser anônima
para a dona é o que faz alguém perguntar; o servidor saber quem é permite as
quatro coisas que a impedem de virar canal de assédio: rotear a dúvida clínica
ao médico DE QUEM PERGUNTOU, o teto diário, recusar quem foi bloqueada, e
bloquear a partir de uma pergunta.

- **`minhaCaixinha` não LÊ a coluna.** Pedir e descartar no `.map()` funcionaria
  hoje e falharia no dia em que alguém devolvesse a linha inteira por
  conveniência. O que não é lido não vaza. Há catraca de CONTAGEM: só duas
  funções do módulo podem tocar em `quem_id`.
- ⚠️ **Sem policy de `authenticated` na tabela**, e aqui isso pesa mais que nas
  outras: uma policy de LINHA (`auth.uid() = dona_id`) daria à dona a linha
  INTEIRA, com o autor dentro. **RLS não esconde coluna.**
- ⚠️ **E ela NÃO passa por `rede_atividade`.** A caixa do coração tem
  `quem_id NOT NULL` e a tela dela RESOLVE O NOME de cada gesto — uma espécie
  "perguntou" ali entregaria, na primeira renderização, exatamente o que a caixa
  existe para não entregar. O emblema sai da contagem de não respondidas.
- ⚠️ **Denunciar e BLOQUEAR moram juntos**, e é a única defesa possível: pedir
  que ela "descubra quem foi e bloqueie no perfil" é pedir o impossível, e sem
  essa porta a anonimidade viraria impunidade. Ela continua sem saber quem é — o
  `toast` não nomeia ninguém, e o retorno é `{ ok: true }` pelado.

#### Só o `publicavel` vira linha

As outras duas saem por canais que já existem e são melhores:

- **emergência** → a Central de Emergência, que avisa médico e contato dela com
  localização. Ninguém responde "estou sangrando" com um coraçãozinho, e deixar
  essa frase esperando a boa vontade de outra paciente é o pior desfecho
  possível desta tela. ⚠️ A folha é a MESMA da barra de baixo, por PROP
  (`onAbrirSOS`) e nunca por evento global: quem governa esse estado é
  `minha-conta`, e um segundo dono é o defeito que `voltarDaBarra` já pagou.
- **clínica** → `doctor_questions` com o `doctor_id` de QUEM PERGUNTOU. ⚠️ Nunca
  o da dona da caixa: a pergunta é sobre o corpo de quem escreveu, e mandá-la ao
  obstetra de outra pessoa é entregar dado de saúde a um médico que não a
  acompanha. Falhar ao gravar é ERRO na tela, e não um "enviado 💛" mentiroso.

**Opt-in, padrão NÃO** (`aceita_perguntas`): caixa anônima aberta por omissão
numa base de gestantes de alto risco é um canal que ninguém pediu. É a mesma
decisão de `perfil_publico`, `mostrar_semana` e `mostrar_bebe`. E **fechar não
apaga o que já chegou** — a tela diz isso, senão quem fecha acha que perdeu as
perguntas e não fecha.

#### ⚠️ Um recuo que FALTAVA em `salvarPerfilSocial`

Sem a coluna nova no banco, um `42703` derrubava o salvamento INTEIRO: ela
trocava a foto, mudava a bio, tocava em salvar e recebia "não foi possível" —
sem nada na tela dizendo que o que quebrou foi um interruptor que ela nem
mexeu. Agora grava o que dá e devolve `parcial: true`, para a tela não afirmar
que o interruptor pegou.

#### A catraca de portas virou LISTA de módulos

`caixinha.functions.ts` nasceu separado para `rede-social.functions.ts` parar de
crescer — e um módulo novo fora da lista de `rede-tem-porta.test.ts` é
exatamente o buraco que ela existe para fechar.

#### Oito mutações, e dois defeitos do próprio teste

Todas as oito ficaram vermelhas (caixa lendo `quem_id`, resposta sem triagem,
médico da dona, erro virando caixa vazia, sem teto, arquivar sem `dona_id`,
ordem do bloqueio invertida, emergência virando linha).

⚠️ **E a primeira execução achou dois defeitos MEUS**, os dois da mesma família:
um comentário meu com a palavra `quemId` reprovava um tipo que está correto, e
o recorte de corpo (`até o próximo \nexport`) engolia o bloco de doc da função
seguinte, acusando três funções tocando numa coluna onde só duas tocam. Quem
conserta os dois é a mesma linha: **tira-se o comentário antes de procurar.**

#### ⚠️ E o servidor de dev velho mentiu por meia hora

O `⋯` da caixinha não abria o menu na bancada, sem erro nenhum no console. Não
era o React: era um `vite` de uma sessão anterior ainda ocupando a porta, e o
`bun run dev` novo tinha subido em outra ("Port 8080 is in use, trying another
one") servindo módulo velho. `console.log` no render não aparecia porque aquele
render não era o meu. **Antes de investigar um componente que "não responde",
confira em que porta o servidor subiu.** E dê ~1,8 s depois do primeiro seletor:
clique antes da hidratação se perde em silêncio.

⚠️ **A primeira medição de contraste "aprovou" seis textos a 1,03:1.** O projeto
escreve cor em `oklch`, e `getComputedStyle` devolve `oklch(...)` — um parser de
regex lê 0.62/0.19/29 e chama de RGB. Converte-se pelo **canvas**
(`ctx.fillStyle = cor` e lê o pixel), como o CLAUDE.md já registrava. Medido de
verdade: 4,54 a 16,83.

**Aplicar:** `supabase/APLICAR_REDE_SOCIAL.sql` (agora com `aceita_perguntas`,
`rede_perguntas` e `rede_posts.pergunta`).
**Bancadas:** `/preview-instagram?tela=caixinha` (`&perguntas=0` o vazio,
`&caixinha=0` a fechada) · `?tela=perfil` (o campo de perguntar, e os três
desfechos digitando "to sangrando…", "estou com muita dor nas costas" e uma
pergunta comum) · `?tela=perfil&caixinha=0`.

### ⚠️ A revisão do meu próprio trabalho, e o que só o OLHAR pegou (ago/2026)

Sete achados de uma revisão adversarial das 3.664 linhas que eu tinha acabado de
escrever. Nenhum aparecia em teste, `tsc` ou lint — e **dois só apareceram na
foto da bancada**, depois de todo o resto estar verde.

- ⚠️ **A CAPA DA CAIXA ♡ FALHAVA ABERTA.** `!!autor?.care_mode` com `autor`
  indefinido é `false` — "não está em luto" —, então uma falha ao ler o perfil
  AUTORIZAVA a capa de quem entrou em Modo Cuidado. Virou `if (!autor) return
false`, o mesmo `!a` que o quadro do repost já tinha ganhado no dia anterior:
  o mesmo defeito, na função ao lado, sobrevivendo ao conserto do irmão.
- ⚠️ **`comentar` lia `responde_a` SEM DEGRAU.** A coluna nasce num `APLICAR_`
  que o dono roda à mão, e o deploy chega antes: num banco sem ela o `select`
  devolve `42703` e a função responde "banco" — **comentar pararia para todo
  mundo** por causa de um recurso que ninguém ainda usa. O recuo lê sem a coluna
  e trata o alvo como raiz, que é o que ele é num banco sem árvore.
- ⚠️ **"Responder" existia com os comentários FECHADOS.** A dona fecha quando
  quer, e o botão continuava em toda linha: ela tocava, escrevia, e o servidor
  recusava DEPOIS de ela ter escrito. `aoResponder` virou opcional — `undefined`
  não desenha nada.
- ⚠️ **`avisarMencionadas` era N+1, e em SÉRIE.** Até dez menções × duas viagens
  cada (o "ela me segue?" e o contexto dela), uma esperando a outra: vinte idas
  ao banco penduradas na resposta de PUBLICAR. Os portões baratos recortam
  antes, o "quem me segue" virou UMA consulta em lote e os contextos rodam em
  `Promise.all`. ⚠️ Falha ao ler o lote vira conjunto VAZIO — sem saber quem me
  segue, quem escolheu "só quem eu sigo" não recebe aviso: fecha, nunca abre.
- **O filtro de palavras pintava a lista CRUA.** Palavra repetida entrava e
  sumia meio segundo depois; setenta coladas viravam sessenta na volta do
  servidor. A pintura otimista passa por `limparPalavrasOcultas`, a mesma régua
  do servidor — importada, nunca reescrita.

#### ⚠️ O FILTRO ENTREGAVA A PALAVRA QUE ELA MANDOU ESCONDER

O pior dos sete, e ele estava escrito com todas as letras no comentário do
próprio código: _"se eu escondi 'perdi', eu não quero ler 'perdi' em lugar
nenhum"_ — e a linha logo abaixo devolvia `mostra: true` para a dona do post,
com uma etiqueta embaixo dizendo que aquilo devia estar escondido.

**Entregar o texto e avisar depois é o pior desfecho possível de um filtro: ela
já leu.** Numa base de gestação de alto risco a palavra escondida é "perdi",
"aborto", "pequeno demais" — a decisão dela sobre o que não aguenta ler hoje.

`verDoComentario` ganhou um terceiro campo: `mostra` · `marca` · **`revelavel`**.
Recolhido é `mostra: false` + `revelavel: true` — a linha existe, o texto não, e
ela abre no toque. Vale igual para a RESTRIÇÃO, pela mesma razão: quem restringe
alguém não quer o texto na frente, quer poder conferir.

- ⚠️ **Para TERCEIROS não sobra nem a linha recolhida.** Uma linha "comentário
  escondido" visível para a conversa faria restringir ANUNCIAR a restrição — que
  é exatamente o que separa restringir de bloquear.
- ⚠️ **O estado de revelar é LOCAL e POR LINHA**, e morre ao fechar a folha:
  revelar uma não pode revelar as outras, e ela escondeu aquela palavra de
  propósito. Conferido no navegador — um toque revela uma, a outra continua
  recolhida.

#### ⚠️ E DUAS COISAS SÓ A FOTO PEGOU

Com os 4.436 testes verdes, o `tsc` limpo e o lint zerado, a bancada mostrou:

1. **O mesmo recado duas vezes.** A etiqueta antiga (`c.oculto`) continuava
   desenhada embaixo da linha recolhida: "Comentário escondido pelo seu filtro
   de palavras. Ver mesmo assim" e, logo abaixo, "Escondido pelo seu filtro de
   palavras." Ela só vale com o texto À MOSTRA — depois de revelar, é a única
   coisa que lembra por que aquilo estava escondido.
2. **♡, × e "Responder" oferecidos sobre um texto que ela não leu.** Curtir um
   comentário recolhido é pedir uma decisão sobre o que ela não viu. Recolhido
   não oferece ação nenhuma; revelou, as ações voltam inteiras.

**Nenhuma asserção estava perto disso.** É a skill `/tela` outra vez: _se você
não consegue verificar, não entregue_ — e verificar é fotografar.

#### Os alvos, medidos e corrigidos

Medido a 393px: `×`/`⋯` **32×44** · avatar da linha **28×28** · "Fechar
comentários" **118×19** · "Ver mais N respostas" **119×36** · "Publicar"
**84×36**.

⚠️ **`w-11` nos três primeiros roubaria largura do TEXTO**, e a coluna do nome
já trunca "Marina Costa" a 393px — é a medição que fixou o `gap-1.5` na linha da
amiga. A área do dedo cresce por `after:absolute` com `-inset`, que estende o
alvo sem mover um pixel do desenho. Os dois que podiam crescer de verdade
("Publicar", "Ver mais") foram a `h-11`/`min-h-[44px]`.

⚠️ **E o meu primeiro medidor mentiu:** ele somava só o eixo HORIZONTAL do
`after` e "reprovou" alvos que eu já tinha corrigido (44×28 num alvo de 44×44).
Depois de corrigido: nenhum alvo abaixo de 44 na folha.

#### ⚠️ E o medidor de ondas reprovava por 1 ms de jitter

`ondas-do-perfil` contava **carimbos `t` distintos**. Duas chamadas do MESMO
`Promise.all` saem com microssegundos de diferença e podem cair em 79 e 80 ao
arredondar — a mesma árvore deu 10 e 11 em execuções seguidas, e o teto reprovou
uma cascata que não existe. Onda passou a ser AGRUPAMENTO POR FOLGA: uma onda de
verdade custa `LATENCIA` inteira, então tudo a menos de meia latência do carimbo
anterior é a mesma onda. Conferido por mutação — desmontando um `Promise.all` de
verdade, o medidor volta a acusar 11 e reprova.

#### ⚠️ E `node_modules` quebrado parece defeito do código

O servidor de dev subia e servia HTML, mas a hidratação morria com 500 em
`virtual:tanstack-start-client-entry`, e o Playwright media a página SEM
JavaScript — clicando em botões que ainda não existiam. A causa era
`Yallist is not a constructor`: um `lru-cache` antigo do Babel resolvendo para o
`yallist@5` hasteado, colisão de um `bun install` que a rede interrompeu.
**Antes de investigar um componente que "não responde", leia o log do servidor
de dev** — a bancada estava certa o tempo todo.

#### A varredura das duas classes, e o que ela achou depois de tudo verde

Com 4.436 testes verdes, `tsc` limpo e lint zerado, uma varredura mecânica pelos
cinco módulos da aba achou mais quatro — porque **estas duas classes não têm
como falhar num teste**: as duas passam por tudo e só aparecem quando o banco
tosse ou quando alguém cronometra.

- ⚠️ **A CAIXINHA PULAVA O MODO CUIDADO SEM A COLUNA NOVA.** O `select` era
  `aceita_perguntas, care_mode`; sem `aceita_perguntas` ele falha inteiro,
  `perfil` fica `null`, e `?.care_mode` vira `false` — a caixa abria com as
  perguntas para quem acabou de perder a gestação. O recuo lê só `care_mode`
  (que existe desde a primeira migration) e trata a chave como DESLIGADA: a
  caixa é opt-in, e "não sei" tem de significar o padrão, nunca o
  consentimento. Se nem `care_mode` responder, a caixa não abre.
- ⚠️ **O portão do repost fechava POR ACIDENTE.** `!!x?.perfil_publico &&
!x?.care_mode`: com `x` indefinido a segunda metade dá `true`, e o que
  segurava a corrente era a primeira dar `false`. Depender de um acidente para
  fechar um portão é como ele reabre no próximo conserto. Virou `!!x &&` na
  frente, explícito.
- **`emCuidado` de `meuPerfilSocial` não tem consumidor NENHUM** e falhava
  aberto. Não foi apagado: um campo morto que falha aberto é armadilha para
  quem for ligá-lo amanhã, e fechá-lo custa uma linha.
- **Duas gravações em série que são independentes** (as marcações e os avisos de
  menção) viraram `Promise.all` — vinte idas somadas penduradas na resposta de
  PUBLICAR.

**`src/lib/portoes-da-rede.test.ts` é a varredura virando catraca**, no dia em
que ela chegou a zero. Duas regras, e o desenho delas importa:

- ⚠️ **A regra é só sobre `care_mode`.** `perfil_publico` caindo para `false` é a
  direção SEGURA ("não sei" = perfil fechado); `care_mode` caindo para `false` é
  a perigosa ("não sei" = não está de luto). Cobrir os dois exigiria onze
  exceções, e **catraca com onze exceções é catraca que ninguém lê**.
- ⚠️ **O que ela cobra é modesto de propósito**: que exista tratamento de falha
  por perto. Não dá para provar estaticamente que o valor fecha — dá para provar
  que ninguém leu `?.care_mode` de uma consulta cujo erro passou em branco, que
  é a forma exata dos três defeitos reais.
- ⚠️ **Quando ela acusa, o conserto é o CÓDIGO, não a regex.** Os dois últimos
  casos viraram código explícito e ficaram melhores de ler.
- ⚠️ **E ela tem prova de que morde**: dois testes montam o padrão ruim e cobram
  que a varredura o pegue. Catraca que passa em vazio é catraca que mente. Os
  três defeitos reais foram reintroduzidos um a um — os três ficam vermelhos.

⚠️ **E um teste meu travou a GRAFIA outra vez — a sexta nesta leva.**
`toContain("donoDoOriginal?.perfil_publico")` reprovou o conserto que APERTA o
portão (pôr `!!donoDoOriginal &&` na frente permite largar o `?.`). Hoje o
`select` é recortado do trecho e o que se cobra é o USO das duas colunas na
decisão: as duas grafias passam, e trocar qualquer uma por `true` continua
reprovando — conferido por mutação.

**Bancada:** `?silenciado=1` passou a existir. O campo estava cravado em
`false`, então "Deixar de silenciar Fulana" — metade do controle — nunca tinha
sido olhado. Mesma falta que o `?restrito=1` ao lado já cobria.

### ⚠️ DOIS DEFEITOS QUE SÓ APARECIAM NO BANCO DO DONO (ago/2026)

Uma revisão adversarial de 45 agentes sobre as 3.664 linhas da noite confirmou
três achados. Um já estava consertado; os outros dois são desta seção, e os dois
têm a mesma assinatura: **o teste não tinha como pegá-los, porque o defeito só
existe num estado que a máquina de desenvolvimento nunca está.**

#### ⚠️ A LEITURA DE POST DESPENCAVA AO PISO POR UMA COLUNA

`postsCrus` é o caminho único de TODA leitura de post — seis chamadores
(`meuFeed`, `verPerfil`, `sugestoesDoFeed`, `verPost`, `meusSalvos`,
`postsDaTag`). O recuo tinha DUAS posições e nada no meio: a lista cheia, ou o
piso de sete colunas.

`alt_texto` entrou no TOPO da lista e só existe em
`APLICAR_COMENTARIOS_E_LIMITES.sql` — o SQL que o dono ainda não rodou. Nesse
banco, o primeiro `select` devolve `42703` por causa de UMA coluna e o recuo
apagava ONZE que o banco TEM, nas seis leituras ao mesmo tempo: enquete, aula,
pergunta respondida, o carimbo "28s → 34s", o selo de editado, a miniatura (a
grade voltava a baixar a foto de 1080), o marco do bebê, o VÍDEO de todo post e
o quadro de toda republicação.

⚠️ **E o dano passava de enfeite.** Um post de vídeo tem `imagem_path` nulo; com
`video_path` nulado junto, o carrossel e o player ficam os dois falsos e a
publicação renderiza **sem mídia nenhuma**. A republicação sem texto próprio
some inteira, porque `ehRepost` sai de `!!repost_de`.

É o defeito que `publicarPost` consertou no lado da ESCRITA na mesma noite ("o
recuo desce uma camada de cada vez") deixado de pé na LEITURA, que tem seis
chamadores em vez de um — e a mesma lição de `perfisPorId` e de
`marcarConsultaNoDia`: **um recuo que só sabe tirar a primeira coluna quebra de
novo assim que a segunda faltar num banco que rodou meio SQL.**

`DEGRAUS_DO_POST` são quatro camadas, uma por `APLICAR_`, do SQL mais NOVO para
o mais antigo — a ordem em que o dono os aplica. ⚠️ **Cada degrau é DERIVADO da
lista única por remoção, nunca escrito à mão**: duas listas escritas à mão
divergem no primeiro ajuste, e aqui a divergência apareceria como recurso
sumindo sem erro nenhum, que é exatamente o que a lista única existe para
impedir.

⚠️ **`degraus-do-post.test.ts` RODA A FUNÇÃO** contra um Supabase de mentira que
conhece um conjunto de colunas escolhido — é a única forma de provar a escada,
porque o defeito só existe num banco que rodou meio SQL. Sete testes, e o mais
importante é o do banco do dono HOJE (tudo menos `alt_texto`): as outras onze
sobrevivem. Repondo o recuo de dois passos, quatro dos sete ficam vermelhos.
E há teste cobrando que nenhum degrau mande `select` com vírgula solta — a
derivação é por remoção de texto, e um `, ` sobrando faria o recuo passar a
falhar por SINTAXE em vez de por coluna.

#### ⚠️ A ZONA DE "PUBLICAÇÕES SUGERIDAS" DUPLICAVA O FEED INTEIRO

`sobrouSugestao = soSeguindo ? false : sugestoes.length > 0` — e `soSeguindo`
nasce `false`, que é o modo de toda paciente. No modo misturado
`intercalarDescobertas` **empurra todas as sobras para o fim do feed**, então
quando ela chega ao rodapé as sugestões já estão inteiras na tela: a zona
mostrava a MESMA publicação duas vezes na mesma rolagem, com a mesma chave de
React.

⚠️ **A zona não tinha estado válido em modo NENHUM**, e por isso saiu:

- **misturado (o padrão)**: já foram costuradas lá em cima — duplicata pura.
- **"Só quem eu sigo" ligado**: a tela promete por escrito "Seu feed mostra
  apenas quem você segue", e a zona entregava o contrário. **O interruptor
  tornava as estranhas mais visíveis.**

A fileira de PESSOAS fica — ela é descoberta de gente para seguir, não conteúdo
do feed, e sem ela quem ligou a chave nunca teria como fazer o feed fechado ter
conteúdo. ⚠️ **E o convite ganhou condição própria**: ele vivia pendurado na
mesma condição da zona, e tirar `sobrouSugestao` de lá o faria sumir para quem
não tem nenhuma pessoa sugerida — justamente quem mais precisa trazer alguém.

⚠️ **TRÊS TESTES MEUS TRAVAVAM A GRAFIA DE UM DESENHO DEFEITUOSO**, e os três
reprovaram a remoção. Um deles já tinha envelhecido DUAS vezes pela mesma razão
(`toHaveLength(1)` → `>= 2` → e agora 1 de novo), sempre por contar LISTAS em
vez de cobrar a promessa. Hoje o que se cobra é: nenhuma publicação de fora sem
o rótulo, a zona do rodapé não existe, a fileira fica, o convite fica.

⚠️ **E uma asserção minha do conserto passava em vazio**: `toMatch(/pessoas
.length > 0 \|\| mesmaFase/)` casava com a condição da zona de FORA, que tem a
mesma string — trocar a condição da fileira por `false` ficava verde. Ancorada
na `<FileiraDePessoas`, a mutação morde.

⚠️ **E a prosa quebrou teste pela TERCEIRA vez nesta base**: o `not.toContain
("Publicações sugeridas")` ficava vermelho exatamente porque o comentário que
EXPLICA a remoção contém a string removida. `semComentarios` subiu para o
escopo do módulo — toda busca de texto do arquivo passa por ele agora.

#### ⚠️ A varredura de CI cobria 5 das 20 telas da Comunidade

O job "Bancadas — abre as telas e lê o console" nasceu de um defeito que deixou
o app SEM ABRIR e sobreviveu a `tsc` limpo, lint limpo e 3.900 testes verdes —
porque nenhum deles abre uma página. A lição estava certa e a cobertura não:

`preview-instagram` é **UMA rota com vinte sub-telas** atrás de `?tela=`. A
varredura lê as rotas do disco, então pegava a rota e desenhava só o padrão (o
feed). As outras dezenove ficavam de fora — e é exatamente onde a aba cresceu:
comentários, filtro de palavras, conversa, story, espelho, busca, salvos,
atividade, arquivados, esboço. **Ter o job e não ter a cobertura.**

Agora são 70 páginas (de 45), com os estados que a prosa documenta como
impossíveis de fotografar: `?conversa=fechados`, `?restrito=1`,
`?silenciado=1`, `?perguntas=0`, `?caixinha=0`, `?trancado=1`, `?remover=0`,
`?sugeridas=0`. Medido: 70 varridas, 0 com problema, ~2 min de job.

⚠️ **Sub-tela nova entra na lista à mão** — a varredura de disco não tem como
adivinhar um valor de `?tela=`. `comunidade.test.ts` cobra que todo destino do
hub exista; quem ABRE a página é esta lista.

#### ⚠️ E o contêiner rebobinou de novo, para `ee24f25`

Terceira vez. O remoto tinha os três commits da noite; a árvore local voltou a
um estado de outra sessão, com cinco arquivos "modificados" que eram na verdade
trabalho VELHO ressuscitado. **A conferência é sempre a mesma: contar
marcadores do trabalho recente antes de tocar em qualquer coisa** (`portoes-da
-rede`: 0 local; `revelavel`: 0 local) e, confirmada a rebobinada, recuperar do
remoto — nunca commitar por cima.

### O story ganhou camada, arquivo e destaque (ago/2026)

Pedido do dono: "aplique o que ainda falta". A varredura achou quatro lacunas
reais; duas valiam a pena e são estas.

### ⚠️ 1. O STORY ERA O ÚNICO CONTEÚDO SEM CAMADA — e é o mais íntimo

O post escolhe entre `publico`, `seguidores` e `amigas` desde o primeiro dia. O
story não escolhia nada: ia sempre para `sigo ∪ amigas`, ou seja, para o público
MAIS LARGO que ela tem. Num app de gestação de alto risco isso é o contrário do
que a natureza do formato pede — o story é onde ela põe a ultrassom que acabou
de sair e o dia ruim, coisas que se contam para seis pessoas e não para
trezentas.

- ⚠️ **O padrão é `seguidores`, e é o CONTRÁRIO do padrão do post (`amigas`).**
  A diferença é deliberada: lá a camada nasceu com o recurso e nasceu fechada;
  aqui ela está chegando a um formato que já era aberto. Fechar por padrão faria
  as publicações futuras dela alcançarem menos gente que as de ontem sem ela ter
  pedido — e ela descobriria pelo silêncio.
- ⚠️ **NÃO existe `publico` no story.** Um story público seria visto por quem ela
  não conhece — e a fileira de bolinhas não tem rótulo de procedência nenhum: a
  paciente abriria achando que é de alguém que ela segue. O post pode ser público
  porque toda publicação de fora carrega "Sugerido para você"; o story não
  carrega, então não pode.
- ⚠️ **O RECORTE POR AUTORA NÃO BASTA, e este é o caso inteiro.** A leitura monta
  a lista de autoras (`sigo ∪ amigas`) e busca os stories delas — mas dentro
  dessa lista há gente que eu SIGO sem ser amiga, e é dessa gente que o story
  `amigas` tem de se esconder. `storyAlcanca` roda POR STORY.
- ⚠️ **E REAGIR E VOTAR também precisavam do portão.** A fileira já escondia,
  mas o servidor aceitava a ação: o afago chegava à caixa ♡ da autora vindo de
  alguém que nunca devia ter visto aquilo.
- ⚠️ **A autora sempre vê o próprio**, inclusive o fechado — sem isto, publicar
  em "só amigas" faria o story sumir da fileira dela mesma, e ela concluiria que
  a publicação falhou.
- ⚠️ **Desconhecido cai no PADRÃO, nunca no mais aberto** (`camadaDoStory`).
- ⚠️ **E O RASCUNHO GUARDA A CAMADA.** Sem isso, ela escreve um story marcado "só
  amigas", é interrompida, recupera — e publica ABERTO sem reparar. É o pior
  desfecho possível de um recurso de conveniência.
- ⚠️ **Sem a coluna, descer o degrau é RECUSA quando ela escolheu `amigas`**: um
  story fechado publicado aberto é o oposto exato do que ela pediu, e o tipo de
  falha que ela só descobre quando a pessoa errada comenta.

### 2. O arquivo e o destaque — e o arquivo JÁ EXISTIA

⚠️ **Os stories expirados nunca foram apagados.** A fileira filtra por
`expira_em > now()` e a linha fica no banco — a decisão está escrita em
`storiesDoFeed` ("apagar na leitura faria uma consulta de tela virar escrita").
O que faltava não era guardar: era uma tela que devolvesse a ela o que ela
publicou. **Nenhuma coluna nova foi preciso para o arquivo.**

E isto importa mais aqui que num app de fotos: um story de gestação é a ultrassom
que saiu naquela manhã, a primeira vez que o bebê mexeu. Sumir em 24 horas sem
rastro é o app apagar a gestação dela um pedaço por dia.

- ⚠️ **É PRIVADO: não existe `alvoId`.** O recorte é a sessão e nada mais — um
  parâmetro aqui seria a porta para ler o arquivo de qualquer paciente trocando
  um uuid, incluindo os stories que ela publicou em "só amigas".
- ⚠️ **Falha de leitura devolve ERRO, e nunca arquivo vazio.** "Você nunca
  publicou nada" é a frase mais errada que esta tela pode dizer a quem publicou
  trinta stories.
- ⚠️ **"No ar" é DERIVADO na leitura**: um booleano gravado ficaria mentindo 24 h
  depois. E ele muda o que ela faz — um story ainda dentro das 24 h pode ser
  apagado do visor; um que já saiu, não.
- ⚠️ **O destaque NÃO mexe em `expira_em`.** Duas colunas dizendo quanto tempo a
  coisa vive divergiriam no primeiro ajuste. `expira_em` decide a FILEIRA;
  `destacado_em` decide o PERFIL. Um story destacado sai da fileira em 24 h como
  qualquer outro — o que ele ganha é uma segunda casa.
- **Grade QUADRADA, e não a 3:4 do perfil**: ali as células são recortes de fotos
  de post; aqui cada célula é um story inteiro (9:16), e o recorte 3:4 come a
  metade de cima — que num story de gestação é onde fica o texto que ela
  escreveu.
- ⚠️ **A estrela é DESENHADA**, cheia quando acesa: o emoji ⭐ tem cor própria em
  cada sistema e não tem dois estados. Mesma lição do pino e do 📞.

### ⚠️ E o medidor de ondas piscava sob carga

Depois de subir a latência simulada de 5 para 25 ms, ele ainda acusou uma
cascata inexistente **uma vez em cerca de seis execuções** — sempre quando a
suíte rodava junto com a varredura das bancadas (um Chromium com dezenas de
páginas). Subiu para 50: a folga de agrupamento virou 25 ms, mais que qualquer
jitter medido, e uma onda de verdade continua custando os 50 inteiros.

**Um teste que falha uma vez em seis é pior que teste nenhum**: as pessoas
passam a re-rodar sem ler, e no dia em que o vermelho for de verdade ele é
ignorado junto. Conferido depois: três execuções da suíte inteira sob a mesma
carga, zero falhas.

**Aplicar no Supabase:** `supabase/APLICAR_STORY_CAMADA_E_DESTAQUE.sql`.
**Bancadas:** `?tela=arquivo` · `?tela=arquivo&vazio=1` ·
`?tela=arquivo&instavel=1` · `?tela=conferir` (os dois chips da camada).

## As três que faltavam de verdade — e as três que já existiam (ago/2026)

Pedido do dono: aplicar seis funcionalidades que eu tinha listado como
faltando. **Conferindo antes de construir, TRÊS já existiam inteiras** —
comentário avisando na caixa ♡, `@` dentro do comentário e contagem de
visualizações do post, com texto próprio em `textoDoAviso` e tudo. Eu as tinha
listado sem verificar, que é o mesmo defeito de prosa desatualizada que este
arquivo registra três vezes.

### 1. O story ganhou TEXTO — e o servidor esperava por ele desde o dia um

⚠️ **`publicarStory` aceita 200 caracteres, roda a régua clínica neles e grava
a coluna. A tela mandava `texto: null` CRAVADO.** Era o gênero inteiro
faltando: um story sem legenda é uma foto muda, e a régua que existe para
impedir conselho clínico corria sobre uma string vazia.

`TEXTO_DO_STORY_MAX` mora em `rede-social.ts` e é lido pelos DOIS lados — o
`200` já estava cravado no `zod`, e um segundo `200` na tela seria a
divergência que aparece como ela digitando até o fim e o servidor recusando sem
dizer por quê.

### 2. O rascunho do story (`rascunho-do-story.ts`)

O post tinha rascunho; o story, não — e aqui a perda dói MAIS, porque o story
expira em 24 h: perder o texto de um post custa reescrever, perder o de um
story custa a janela em que aquilo fazia sentido.

- ⚠️ **A FOTO NÃO ENTRA**, pela mesma razão do post: o data URL de um story vai
  a 1,5 MB, e a cota de ~5 MB do `localStorage` é compartilhada com o
  `journey_state`. A gravação é CAMPO A CAMPO — com espalhamento, uma foto
  acrescentada ao objeto entraria mesmo sem existir no TIPO.
- ⚠️ **A validade é de UM dia, e não de sete.** Um story é coisa de HOJE; um
  texto de quatro dias atrás oferecido de volta não é memória, é confusão — e
  pior aqui, porque ela pode publicá-lo sem reler achando que é o de agora.
- ⚠️ **Os dois interruptores sozinhos não contam**: oferecer "você tinha um
  rascunho" para devolver um booleano é como a tela perde a credibilidade.
- ⚠️ **O PREFIXO DA CHAVE É PRÓPRIO**, e o teste pegou: `dc-rede-rascunho-story-`
  COMEÇA com a chave do post, e qualquer varredura por prefixo levaria os dois.
- ⚠️ **E o nome da função também**: `guardarRascunhoDoStory`, nunca
  `guardarRascunho` — esse já existe no arquivo e é o do POST. Reusá-lo gravaria
  o story na chave da publicação.

⚠️ **E A FOTO COBRIA O PAINEL — só a bancada pegou.** Com o campo e a faixa do
rascunho, o painel de baixo cresceu e a imagem passou a pintar por cima da
primeira coisa dele: a faixa aparecia cortada ao meio e o botão "Recuperar"
ficava **inalcançável**, porque a foto interceptava o toque. `max-h-full` num
item flexível só resolve depois do layout; quem conserta é `overflow-hidden`.

### 3. Fixar publicação no perfil — e a armadilha é a PAGINAÇÃO

A grade é cronológica pura, e é isso que faz o primeiro ultrassom afundar.

- **Três**, e o número é de LAYOUT: a grade tem três colunas, então a primeira
  fileira inteira é o recorte dela. Com quatro, sobra uma sozinha e o recorte
  deixa de ser legível como recorte.
- ⚠️ **É um INSTANTE, não um booleano**: com booleano não há como ordenar três
  fixadas entre si, e a grade mostraria as três em ordem arbitrária. Entre elas
  a ordem é a de FIXAÇÃO, nunca a de publicação — quem acabou de fixar espera
  ver aquilo na frente.
- ⚠️ **AS FIXADAS SÃO UMA CONSULTA À PARTE.** Ordenar a página que chegou faria
  a fixada flutuar para o topo DA PÁGINA em que ela caiu: uma foto de abril
  apareceria no meio da rolagem, com o pino, depois de duzentas outras.
- ⚠️ **Buscadas em TODA página, desenhadas só na primeira.** Elas precisam ser
  conhecidas sempre para sair da lista cronológica das seguintes — sem isso a
  mesma foto aparecia no topo E de novo quando a paginação chegasse à data
  dela, com a mesma chave de React.
- ⚠️ **E O CURSOR TEVE DE MUDAR DE FONTE.** `brutos` passou a ser "as fixadas na
  frente + a página", então `brutos.length === POSTS_POR_PAGINA` daria `false`
  na primeira tela e **a paginação morreria depois da primeira página, em
  silêncio**. Sai de `cronologicos`.
- ⚠️ **O teto é conferido no SERVIDOR, contando o que o BANCO tem** — entre a
  abertura da tela e o toque cabem outros aparelhos. Falha ao contar RECUSA.
- ⚠️ **O pino é DESENHADO**, e cheio quando aceso: o emoji 📌 tem cor própria em
  cada sistema e não tem dois estados — e aqui ele precisa distinguir "fixado"
  de "fixar", que é a diferença entre um toque inofensivo e desfixar sem
  querer.
- **E ele aparece na CÉLULA da grade**, para quem visita: sem marca, as três
  primeiras parecem só as mais recentes, e quem abre o perfil não tem como
  saber que aquilo é um recorte escolhido. Mesma razão do rótulo "Sugerido
  para você".

### 4. Compartilhar uma publicação dentro de um story

O risco é de VISIBILIDADE, e tem duas pontas.

- ⚠️ **NA ESCRITA**: um story alcança todas as seguidoras. Só publicação
  PÚBLICA, **de perfil PÚBLICO** — a camada sozinha não basta, porque um post
  `publico` de perfil privado alcança apenas quem segue, e o perfil nasce
  privado. É exatamente o vazamento que o quadro do repost teve e que eu
  declarei "falso" antes de conferir a régua inteira. E `!!dono &&` vem na
  FRENTE, para o portão não fechar por acidente.
- ⚠️ **NA LEITURA**: o quadro passa por `montarPosts` com o contexto de QUEM
  ABRE — quem assiste pode ter bloqueado a autora, ou ela pode ter fechado o
  perfil depois. Em LOTE e fora do laço; falha ao ler não derruba a fileira.
- ⚠️ **O banco guarda SÓ o id**, com `ON DELETE SET NULL`. Copiar texto ou foto
  faria o quadro sobreviver à decisão de quem escreveu — a mesma decisão do
  carimbo da semana. E o `SET NULL` é obrigatório: sem ele, apagar o post
  derrubaria o story de OUTRA pessoa por violação de chave.
- ⚠️ **A régua do botão é a do ↻ republicar, e não a do ↗**: o ↗ tira a FOTO do
  app e por isso só vale na própria; isto põe o ENDEREÇO dentro de um story,
  onde quem abrir passa por `podeVerPost` como em qualquer lugar.
- ⚠️ **A foto do post vira o FUNDO, e a cópia é deliberada**: a coluna é
  `SET NULL`, então sem a cópia o story de outra pessoa ficaria em branco por
  uma decisão que não é dela.

### ⚠️ E as catracas do repositório pegaram TRÊS coisas minhas

1. **`porId.delete(f.id)` entrou na conta de DELETEs de tabela.** A catraca casa
   `.delete(` por TEXTO, e essa conta é o que impede alguém de apagar dado de
   paciente sem ninguém reparar. `idsDasAmigas` já usava filtro por esta razão,
   e eu reintroduzi o `.delete` — virou filtro de novo.
2. **A dívida de escritas sem checagem subiu**, pelo mesmo `.delete`.
3. **O medidor de ondas acusou uma cascata que não existe.** Com a latência
   simulada em 5 ms, a folga de agrupamento era 2,5 ms e o jitter do contêiner
   (1 a 3 ms dentro do MESMO `Promise.all`) a atravessava. Subiu para 25 ms — e
   aí o que sempre foram NOVE ondas parou de ser lido como dez. O teto desceu
   junto, porque folga é dívida pré-aprovada.

⚠️ **E TRÊS TESTES MEUS TRAVARAM A GRAFIA de novo** — o do cursor
(`brutos.length === …`), o do `porId.delete`, e o do `dono.perfil_publico` sem
o `as any`. Os três reprovaram consertos que eram obrigatórios. É a sétima vez
nesta base; a regra continua sendo cobrar a GARANTIA, nunca a escrita.

⚠️ **E o meu script de mutação pegou a ocorrência no COMENTÁRIO**, não no
código: `!!dono &&` está escrito na prosa que explica por que ele existe. Toda
mutação por texto ancora no corpo da função, e a prosa sai antes.

**Aplicar no Supabase:** `supabase/APLICAR_FIXAR_E_STORY_DE_POST.sql`.
**Bancadas:** `?tela=conferir&rascunhoStory=1` · `?tela=perfil&fixados=1` ·
`?tela=story&quadro=1` — as três entraram na varredura de CI.

## ⚠️ SILENCIAR TINHA QUATRO PORTAS, E FECHAVA DUAS (ago/2026)

Pedido do dono: "aplique o silenciar sem deixar de seguir". **Ele já existia** —
tabela, `contextoDe` carregando `silenciados`, servidor, botão no perfil e
bancada. O que faltava não era o recurso: era ele valer nas outras portas do
feed.

Silenciar tirava as publicações do FEED e os stories da FILEIRA (os dois blocos
"O SILÊNCIO É APLICADO AQUI"). Mas o feed tem mais entradas, e nenhuma conhecia
o silêncio:

- a zona de **publicações sugeridas** (`sugestoesDoFeed`),
- a **fileira de pessoas** (a mesma função, mesmo predicado),
- a fileira de **conversas sugeridas** — a porta do direct.

As três ofereciam de volta exatamente quem ela pediu para não ouvir.

⚠️ **E a porta por onde o defeito entra é a pior.** A fileira sugere quem ela
NÃO segue — então o caso comum não é "silenciei e continuo seguindo", é
"silenciei alguém da zona de descoberta", e a resposta do app era insistir. Numa
base de gestação de alto risco, o motivo de silenciar costuma ser o conteúdo
doer.

- **Um predicado `fora` só governa as DUAS listas de `sugestoesDoFeed`** — por
  isso um termo fecha as duas. Duas condições separadas divergiriam no primeiro
  ajuste, e a divergência apareceria como a silenciada sumindo de uma lista e
  ficando na outra.
- ⚠️ **`bloqueadas` virou `foraDaSugestao` na régua do direct, e o nome É o
  conserto.** Com o nome antigo, quem lesse a chamada concluiria que só o
  bloqueio recorta — foi exatamente assim que a silenciada continuou sendo
  oferecida ali. Renomear quebrou o `tsc` em todos os chamadores, que é o
  ponto: obriga cada um a ser relido.
- ⚠️ **A união é POR PROXY, nunca `new Set([...bloqueio, ...silenciados])`.**
  `ctx.bloqueio` é `ConjuntoDeBloqueio`, que FALHA FECHADO: leitura degradada
  responde `true` para todo mundo e ninguém é sugerido. Espalhá-lo num `Set`
  perderia isso — o embrulho degradado não tem membros para espalhar, então o
  `Set` sairia VAZIO e responderia `false` para todas, que é o oposto exato. É
  por isso que a assinatura da régua aceita `{ has }` e não `Set`.
- ⚠️ **O PERFIL continua de fora, e é deliberado.** Visitar o perfil da
  silenciada mostra tudo — ela foi até lá para ver. Silenciar é preferência de
  FEED, não régua de visibilidade: se entrasse em `podeVerPost`, viraria um
  bloqueio de um lado só e a palavra passaria a mentir. Há teste cobrando que
  `rede-social.ts` não contenha a string.

`silenciar.test.ts` cobra as quatro portas de uma vez, e os três mutantes
(tirar o termo dos sugeridos, trocar o proxy por `Set`, pôr o silêncio na régua)
ficam vermelhos.

⚠️ **E UM TESTE MEU TRAVOU A CORRENTE INTEIRA NUMA STRING SÓ** — a quarta vez
nesta leva. `toContain("id === eu || ctx.sigo... || jaPedi...")` reprovou o
acréscimo que FECHA a porta. Um teste que exige a lista exata de termos torna
impossível acrescentar um sem editá-lo, e **quem edita um teste vermelho com
pressa apaga a asserção em vez de entendê-la**. Hoje cada termo é cobrado por
si: trocar qualquer um por `true` reprova, acrescentar um sexto passa.

⚠️ **E o meu script de mutação pegou o `const fora =` de OUTRA função** do mesmo
arquivo (um `new Map()`), então as quatro mutações "passavam" sem nunca terem
sido aplicadas. Toda mutação por texto tem de ancorar na função (`indexOf` a
partir do `export const`) e **falhar alto se o texto não mudou** — é a mesma
armadilha de substring que `minhaColuna`/`minhaColunaDeLeitura` já custou aqui.

### A conversa embaixo do post: menção, ordem e rascunho (ago/2026)

⚠️ **PRECISO CORRIGIR A MINHA PRÓPRIA AUDITORIA: a menção JÁ EXISTIA no
servidor.** `comentar` chama `avisarMencionadas` desde o primeiro dia — quem
escreve `@fulana` num comentário sempre avisou a mencionada. O que faltava era
a outra metade: na tela, o `@` continuava TEXTO CRU, no lugar onde a menção é
mais usada. Metade do recurso funcionava e a outra metade não tinha como ser
tocada. Minha varredura procurou por `acharMencoes` perto de `coment` e não
achou o que estava escrito com outro nome — terceira vez nesta leva que listo
como ausente uma coisa que existe.

- **`TextoComLinks` foi EXPORTADA, nunca copiada** (`rede-instagram.tsx`). Duas
  implementações do mesmo `@` divergiriam no primeiro conserto, e a divergência
  apareceria como a menção virando link na legenda e não no comentário — sem
  erro nenhum.
- ⚠️ **Sem `aoAbrirArroba`, ela desenha texto.** A prop é opcional de propósito
  (ver o comentário dela: `@` é handle, nunca id), então a bancada precisou
  passar as duas — senão aprovaria uma menção que não vira link, que é
  exatamente o que faltava.

**A ordem por curtidas** (`ordenarComentarios`, `comentarios.ts`).

- ⚠️ **É a única peça desta aba que ordena por ENGAJAMENTO, e é defensável
  porque o alcance é UM POST.** A régua que proíbe ranqueamento (o feed, o
  Explorar, as tags) existe para o post da EMERGÊNCIA não virar descoberta; um
  comentário nunca sai do post onde vive.
- ⚠️ **O padrão continua sendo o TEMPO.** Conversa se lê na ordem em que
  aconteceu, e num post com poucos comentários — quase todos — as duas ordens
  desenham a mesma lista.
- ⚠️ **O FIXADO fica no topo nas DUAS ordens.** Ele é curadoria explícita da
  dona; deixá-lo cair ao trocar a ordem faria a ordenação desfazer a escolha
  dela. Por isso a relevância roda ANTES de `ordenarComentariosComFixado`.
- ⚠️ **O desempate é o tempo, sempre** — sem ele, dois comentários com a mesma
  contagem trocam de lugar entre duas aberturas, e uma conversa que se mexe
  sozinha faz a leitora perder a linha.
- ⚠️ **E o COMPONENTE desfazia a ordem do servidor.** A montagem da conversa
  ordenava as raízes por `criadoEm` de forma incondicional, depois da resposta:
  o seletor mudaria de cor e a lista ficaria idêntica. Foi LER a cadeia inteira
  que pegou — cada metade estava certa sozinha, e nenhuma asserção chegava
  perto. Hoje a régua da ordem é aplicada na montagem, com a ordem dentro.
- **O seletor só aparece com 3+ comentários**: controle que não muda nada
  ensina que os controles desta tela não valem — a mesma régua do "Hoje eu não
  desço ao chão" da aba de exercícios.

**O rascunho** (`chaveDoRascunhoDeComentario`).

- ⚠️ **A chave carrega os DOIS ids.** O post, porque o texto reaparecer noutra
  publicação faria ela mandar para a pessoa errada; a conta, porque o aparelho
  é compartilhado.
- ⚠️ **APAGA ANTES de limpar o campo.** O efeito de gravar tem 700 ms de
  atraso: limpando primeiro, ele regravaria o comentário RECÉM PUBLICADO, que
  reapareceria na próxima abertura. Mesmo defeito que o rascunho do post pagou.
- ⚠️ **Não preenche por cima do que ela já digitou**, e o modo EDIÇÃO fica de
  fora — ali o campo já carrega o comentário que ela está corrigindo.
- ⚠️ **Guarda o texto e o INSTANTE — nunca `respondeA`, nunca foto.** Guardar a
  resposta pendente faria o rascunho reabrir apontando para um comentário que
  pode ter sido apagado, e o texto iria para a conversa errada.
- ⚠️ **E ELE VENCE, porque é uma chave POR PUBLICAÇÃO.** Quem começa a escrever
  em quarenta posts e desiste deixava quarenta chaves, para sempre — e o que
  quebra quando a cota do `localStorage` estoura é a PRÓXIMA gravação de
  qualquer coisa, inclusive o `journey_state`. A validade é a MESMA
  `VALIDADE_DIAS` do rascunho do post, importada e nunca recopiada. Instante no
  FUTURO também vence: relógio adiantado e depois corrigido deixaria um rascunho
  eterno.
- ⚠️ **A VARREDURA PRECISA DISCRIMINAR, e a mutação provou que faltava
  asserção.** Ela apaga toda chave que reconhece e cujo pacote venceu; com o
  reconhecedor devolvendo `true` para tudo — o que passava no meu teste, que só
  cobrava que a função fosse CHAMADA — ela varreria o `localStorage` inteiro:
  as chaves `dc-path-` da JORNADA, o rascunho do story, o passo do tutorial.
  Apagaria a jornada da paciente para limpar rascunho de comentário. Conferido
  também no navegador, com as chaves postas à mão antes de recarregar.

⚠️ **E A BANCADA MENTIU DE DUAS FORMAS, as duas achadas na FOTO:** o efeito do
rascunho começava com `if (bancada || …)`, então ela mostrava sempre o campo
vazio — o único estado que não precisava provar; e os dados de exemplo já vinham
em curtidas DECRESCENTES, então as duas ordens desenhavam a mesma lista e o
seletor parecia inerte. Bancada que não consegue provar o recurso é bancada que
aprova qualquer coisa.

**Bancada:** `/preview-instagram?tela=comentarios` · `&ordem=relevantes` ·
`&rascunhoComent=1` · `&conversa=fechados`.

### O primeiro minuto na Comunidade (ago/2026)

⚠️ **DAS TRÊS COISAS QUE EU TINHA LISTADO COMO FALTANDO NESTA ONDA, DUAS JÁ
EXISTIAM INTEIRAS** — e é a quarta vez nesta leva. `vistasDosMeus` já contava
quem viu cada publicação minha (e a tela já desenhava "N pessoas viram"), e
`favoritar` já tinha botão no perfil, tela própria e `ctx.favoritas`. O que
faltava mesmo era UMA coisa: a aba não tinha uma linha explicando como ela
funciona.

**A régua e os quatro textos moram em `src/lib/onboarding-da-comunidade.ts`**,
nunca no JSX — é o que o dono relê e corrige.

- ⚠️ **NÃO É UM PASSEIO PELOS ÍCONES.** Onde as coisas estão se descobre
  tocando. O que não se descobre tocando é: que o perfil dela **já nasce
  fechado** (então publicar não é publicar para o mundo), que **cada publicação
  escolhe o seu público**, e que **conduta clínica não se pede nem se dá aqui**.
  Esta última é a razão de a aba não ter conselho livre, e era o único fato
  central do produto sem nenhum texto no app explicando-o a quem chega.
- ⚠️ **"Não sei" NÃO abre.** Enquanto o perfil não chegou (`careMode`
  indefinido), `deveVerOnboarding` devolve `false`: abrir e descobrir o luto
  meio segundo depois mostraria os quatro cartões para exatamente quem eles não
  podem alcançar. Falha fechada, como o resto da aba.
- ⚠️ **A chave leva o prefixo `dc-path-`, e isso é o que faz o "já vi"
  VIAJAR.** Com uma chave comum de `localStorage`, quem usa celular e computador
  veria os quatro cartões em cada um — e tutorial que reaparece ensina que os
  avisos deste app não valem leitura.
- ⚠️ **E O PULL DA NUVEM RODA ANTES DE LER E DE GRAVAR.** `lsSet` de uma chave
  `dc-path-` agenda um PUSH do blob da jornada, e `journey-sync` avisa em prosa
  que empurrar antes do pull **sobrescreve a jornada real por um blob
  incompleto**. Esta tela vive numa aba irmã, que pode ser a primeira que a
  paciente abre no dia — era o defeito mais caro possível aqui, e não teria
  aparecido em teste nenhum.
- ⚠️ **O VÉU PARA EM `z-38`; a barra de baixo vive em `z-40`.** Mesma solução do
  tutorial do mascote, e aqui ela conserta também uma incoerência de TEXTO: o
  terceiro cartão diz "use o SOS na barra de baixo", e com o véu por cima ele
  apontava para uma barra apagada e coberta pelo próprio cartão. Foi a FOTO que
  pegou.
- **Só sobre o FEED**: o componente é renderizado depois de todos os
  `if (onde.t === …) return`, então nunca abre por cima do perfil, do direct ou
  da caixinha — telas para as quais ela NAVEGOU, onde quatro cartões de
  boas-vindas seriam interrupção do que ela foi fazer. Há teste comparando as
  posições.
- ⚠️ **ELE ESPERA O RITUAL DE BOAS-VINDAS**, e isso era alcançável de verdade:
  `OnboardingRitual` não tem portão de aba nenhum, então uma paciente
  recém-criada que tocasse em Comunidade antes de terminá-lo receberia os quatro
  cartões por baixo dele. Mesma decisão que `TutorialDaBolha` já toma com
  `!showOnboarding` — e o tutorial não some: quem adiou o encontra na abertura
  seguinte, com o app já personalizado.
- **"Pular" fica visível o tempo todo, e marca como visto**: senão ela é
  interrompida de novo tendo dito não. E os pontinhos existem porque quatro
  telas seguidas sem fim à vista fazem qualquer pessoa sair no primeiro toque.
- ⚠️ **O PASSO NÃO MORA SÓ NO COMPONENTE — é o defeito que o dono já viu no
  tutorial do mascote, chegando por outro caminho.** A barra de baixo continua
  clicável de propósito; tocar num item troca a aba, desmonta `RedeNoApp`, e com
  o índice num `useState` lá dentro voltar à Comunidade recomeçava do primeiro
  cartão. ⚠️ **E a chave do passo é `localStorage` COMUM, nunca `dc-path-`**: o
  "já vi" precisa viajar entre aparelhos, o passo não — subir um índice de
  tutorial no `journey_state` seria empurrar lixo para a nuvem a cada toque em
  "Continuar". Ele é apagado ao terminar.
- ⚠️ **`passoValido` é função PRÓPRIA porque `lerPassoDaComunidade` toca
  `window`**, e num teste de Node ela sai por `typeof window === "undefined"`
  antes de chegar à conta: a mutação que APAGAVA o limite passava verde. Régua
  pura em `lib/`, de novo e pela mesma razão de sempre.
- ⚠️ **Nenhum cartão cobra publicação nem promete resposta de outra paciente** —
  há teste com regex. Ler o tempo que ela quiser é um uso legítimo da aba, e
  "alguém vai te responder" é a promessa que a triagem clínica existe para não
  fazer.

**Bancada:** `/preview-instagram?onboarding=1` — sem ela, conferir os quatro
cartões exigiria uma conta recém-criada, e depois de olhar uma vez a tela nunca
mais apareceria.

### ⚠️ A CONFERÊNCIA ITEM A ITEM, e as TRÊS que estavam pela metade (ago/2026)

Pedido do dono depois de eu declarar as 28 aplicadas: _"Verifique se todos os
novos mais de 20 foram aplicados"_. A conferência mecânica — cada item precisa
de **régua/servidor E chamador no app**, com bancada não contando — achou três
recursos que eu tinha reportado como prontos e que **não existiam na tela**.

⚠️ **E os três estavam no MESMO arquivo, `conversa.ts`, porque ele não estava na
lista da catraca de réguas.** Ela cobria onze módulos e a rede tem muito mais.
**Catraca com lista à mão dá sensação de cobertura exatamente onde não há** — é
a lição, e ela vale mais que os três consertos. `conversa.ts`, `comentarios.ts`
e `onboarding-da-comunidade.ts` entraram; módulo de régua novo entra no mesmo
commit que o cria.

**1. FIXAR CONVERSA gravava e a lista NÃO se mexia.** O ⋯ dizia "Fixar no topo",
o servidor gravava a coluna, a leitura devolvia `fixadaEm` — e `minhasConversas`
ordenava só por `ultima_em`. `ordenarConversasComFixadas` existia, testada, com
zero chamadores. Ela fixava e nada acontecia. É o defeito do seletor de ordem
dos comentários outra vez: cada metade certa sozinha, a corrente quebrada.
⚠️ A ordem entra no SERVIDOR — na tela, a lista pularia depois da primeira
pintura.

**2. A BUSCA NA CONVERSA era régua morta.** `acharNaConversa` estava escrita,
testada e documentada em prosa ("a busca é LOCAL, e é por isso que ela existe
assim") — sem uma linha de tela. Agora há lupa no cabeçalho, campo e destaque.
⚠️ **DESTACA, nunca filtra**: esconder as outras arrancaria cada achado do redor
que lhe dá sentido. ⚠️ E o texto diz o que a régua faz ("procura no que já está
carregado"), senão quem sobe procurando uma frase antiga conclui que a conversa
se perdeu.

**3. A VOZ NO DIRECT NÃO TINHA TELA NENHUMA.** Servidor aceitando `audio_path` e
`duracao_seg` com degraus, leitura assinando a URL, `AUDIO_TIPOS` e
`extensaoDoAudio` prontos — e **nem gravador, nem player**. Um recurso inteiro
existindo só do lado que ninguém vê.

- ⚠️ **`gravar()` roda DENTRO do toque, sem `await` antes** — `getUserMedia`
  exige gesto no iOS, e depois de uma espera o gesto já passou. Mesma armadilha
  do `destravar()` dos Sons para dormir e do gravador do diário.
- ⚠️ **A gravação PARA sozinha no teto**: um toque esquecido gravaria até
  estourar o tamanho, e a mensagem seria recusada depois de ela ter falado.
- ⚠️ **Áudio grande é recusado ANTES de enviar, com recado ESPECÍFICO** — o
  genérico de rede não diz o que fazer diferente.
- ⚠️ **Sobe pela MESMA `urlParaSubirNaConversa` da foto** (renomeada, porque
  "Foto" passou a mentir): a regra da PASTA é o que impede o uuid da paciente de
  vazar na URL assinada, e duas funções divergiriam nela no primeiro conserto.
- ⚠️ **O player é `controls` NATIVO**, com `preload="none"`: um player próprio
  teria de reimplementar arrastar e o card da tela de bloqueio, e numa conversa
  com trinta áudios o `metadata` dispararia trinta requisições ao abrir.
- ⚠️ **O microfone some quando ela começa a digitar** — duas saídas para o mesmo
  toque —, e só aparece onde `podeGravar()`.

⚠️ **E A BANCADA NÃO DESENHAVA NENHUM ÁUDIO** — foi por isso que o buraco
sobreviveu. Bancada que não consegue provar o recurso é bancada que aprova
qualquer coisa; agora há uma mensagem de voz na lista.

⚠️ **Uma asserção minha sobreviveu à mutação pela SÉTIMA vez pelo mesmo
mecanismo:** `audio.size > AUDIO_BYTES_MAX` aparece em `subirAudio` E em
`pararEEnviar`, então o `toContain` ficava verde com a checagem da segunda
apagada. Ancore no corpo da função, nunca no arquivo.

#### ⚠️ E O MICROFONE QUEBROU A HIDRATAÇÃO — só o navegador pegou

Com `tsc` limpo, lint limpo e 4.915 testes verdes, abrir a bancada num navegador
devolveu **"Hydration failed because the server rendered HTML didn't match the
client"**.

A causa: eu chamei `podeGravar()` DENTRO do JSX. Ela toca `navigator`, então no
SSR devolve `false` e no cliente `true` — o HTML do servidor sai SEM o microfone
e a primeira pintura do cliente sai COM ele, e o React **descarta a árvore
inteira**. Num app que já ficou SEM ABRIR por um defeito de hidratação, isto não
é detalhe.

⚠️ **O guarda `typeof window === "undefined"` NÃO resolve** — ele evita o CRASH
no servidor; a DIVERGÊNCIA continua, porque as duas execuções são exatamente as
que precisam concordar. Mesma lição do `location.origin` no render, que este
repositório já pagou duas vezes.

⚠️ **E o padrão certo estava a três arquivos de distância**: o gravador do
diário (`gestacao-path.tsx`) já fazia `useState(false)` +
`useEffect(() => setTemMicrofone(podeGravar()), [])`, com o comentário
explicando por quê. Eu escrevi a versão errada mesmo assim.

`capacidade-fora-do-render.test.ts` é a catraca: nenhuma função de capacidade do
navegador (`podeGravar`, `podeCompartilhar`, `ehNativo`) pode ser chamada dentro
de JSX, em `src/components` ou `src/routes`. Ela tem contraprova de que morde —
catraca que passa em vazio é catraca que mente.

**Bancada:** `/preview-instagram?tela=conversa` (a lupa, a busca, o áudio).

### As nove que faltavam — parte 1: rastro, arquivar e editar (ago/2026)

Pedido do dono depois de eu levantar dez lacunas verificadas: aplicar todas.
⚠️ **UMA SAIU DA LISTA NA HORA:** ele pediu que "quem pode me mandar mensagem"
virasse solicitação como no Instagram — e **a solicitação já existe e já é
exatamente esse modelo**. `podeIniciarConversa` devolve `comoPedido: !alvoMeSegue`
desde o primeiro dia, com caixa separada e o emblema excluindo os pedidos que EU
mandei. Quinta vez nesta leva que listo como ausente algo que existe.

**Aplicar:** `supabase/APLICAR_NOVE_DA_REDE.sql` (idempotente).

#### ⚠️ A TRIAGEM CLÍNICA RECUSAVA E NÃO DEIXAVA RASTRO

`triarTexto` barra o post, a paciente vê o recado, e a tentativa desaparece.
Numa base onde 20,9% do conselho leigo em fóruns de gestação está errado e 5,5%
é potencialmente danoso, alguém tentando publicar conduta cinco vezes seguidas é
o sinal mais forte que esta aba produz — e ninguém o via.

- **Sete pontos de barragem registram**: post, bio, edição de post, story, os
  dois de comentário e a nota. A régua é uma só — **texto PÚBLICO que foi
  RECUSADO**.
- ⚠️ **A MENSAGEM DO DIRECT NÃO DEIXA RASTRO, e é a linha do recurso.** Ela é
  ENVIADA — a régua não censura conversa privada entre duas adultas, só lembra
  quem escreveu. Registrar mesmo assim seria a plataforma guardando trecho de
  conversa privada que nem foi barrada.
- ⚠️ **A EMERGÊNCIA NUNCA CONTA COMO REINCIDÊNCIA.** Quem escreve "estou
  sangrando" está pedindo socorro no lugar errado, não dando conselho. Se
  contasse, a paciente que passou mal três vezes apareceria como reincidente na
  fila de moderação.
- ⚠️ **UMA TENTATIVA ISOLADA NÃO É CASO.** Toda paciente um dia escreve uma
  frase que a régua barra — foi para isso que ela foi calibrada contra 40 frases
  reais. Uma fila de eventos soltos afogaria o administrador em ruído e ensinaria
  a ignorá-la, que é como uma fila de moderação morre. `agruparPorPessoa` só
  chama atenção a partir de três.
- ⚠️ **A PACIENTE NÃO É AVISADA E NÃO PERDE NADA.** Isto é observação, não
  punição: ela vê o mesmo recado de sempre, e `anotarBarrada` **falha em
  silêncio** — derrubar a publicação porque o registro não gravou seria trocar um
  sinal de moderação por uma avaria certa na tela dela.
- ⚠️ **É MÓDULO PRÓPRIO** (`triagem-barrada.server.ts`) porque a triagem do
  comentário roda ANTES de qualquer cliente existir — mover a régua para depois
  do cliente seria o mesmo que não tê-la.
- ⚠️ **A tabela é SEPARADA de `rede_denuncias`.** Lá `quem_id` é quem denunciou;
  aqui não há denunciante — é o sistema barrando. Juntar faria a fila misturar
  "alguém reclamou dela" com "ela tentou publicar algo que a régua barra".
- ⚠️ **Sem policy nenhuma, e `REVOKE`**: uma policy de linha daria à paciente a
  própria linha, e saber exatamente o que a régua barra é o mapa para contorná-la.

#### Arquivar a conversa — o meio-termo que faltava

"Sair" já existia e é nuclear. Arquivar tira da lista e **a conversa volta
sozinha quando a outra escreve**.

- ⚠️ **É por isso que a coluna guarda um INSTANTE, e não um booleano.** É a
  comparação com `ultima_em` que faz a volta acontecer; com booleano, arquivar
  seria um sumiço permanente — ou seja, o "sair" de novo.
- ⚠️ **Duas colunas, uma por lado** (`arquivada_a`/`arquivada_b`), a mesma razão
  de `fixada_*`: isto é preferência de quem OLHA a lista, e uma coluna só faria a
  decisão de uma sumir a conversa da tela da outra.
- ⚠️ **A ARQUIVADA SAI DA LISTA NORMAL, NUNCA DA CAIXA DE PEDIDOS.** Um pedido
  arquivado sumiria das duas e ela nunca mais o veria — e pedido é justamente o
  que precisa de decisão.
- ⚠️ **Sem `ultima_em` legível, a marca VALE.** O pior caso é a conversa ficar
  guardada; o oposto é ela reaparecer sozinha, que é o defeito.
- **A gaveta só aparece com algo dentro**, e o texto diz que elas voltam — senão
  "Arquivada" lê como o "Sair" que está logo acima no mesmo menu.

#### Editar a mensagem

- ⚠️ **A RÉGUA CLÍNICA RODA DE NOVO** — sem ela, editar seria a porta dos fundos
  do envio: manda-se "que lindo" e troca-se depois por conduta.
- ⚠️ **SÓ O TEXTO.** Foto, áudio, figurinha e anexo não se editam: trocar a mídia
  depois de a outra ter visto é outra mensagem, não uma correção. Quem decide é
  `podeEditarMensagem`, a MESMA régua que a tela usa para oferecer o botão — uma
  segunda régua ofereceria e o servidor recusaria depois de ela reescrever.
- ⚠️ **O SELO "editada" É PARA A OUTRA**, não para mim: uma mensagem que muda de
  texto depois de lida é o app reescrevendo a conversa por baixo dela.
- ⚠️ **Sem a coluna do selo, a edição VALE** — recusar seria tirar uma correção
  por causa de um carimbo. Mesma decisão de `editarComentario`.
- ⚠️ **A dona e a forma são conferidas no BANCO**, nunca no corpo do pedido.

#### O aviso de conteúdo sensível, e a legenda do vídeo

**Uma publicação sobre uma perda embosca quem rola o feed às três da manhã.** O
filtro de palavras já existia e resolve outro problema: ele exige que a leitora
ADIVINHE a palavra antes de doer.

- ⚠️ **QUEM MARCA É QUEM PUBLICA, e o app NUNCA marca sozinho.** A tentação é
  marcar o que a régua clínica reconhece, ou todo post de quem está em luto — e a
  segunda **contaria o luto dela para quem visse a marca**. `MARCA_AUTOMATICA`
  existe desligada, com teste.
- ⚠️ **BORRA, NUNCA ESCONDE.** Esconder seria o app decidindo que aquilo não deve
  ser lido, e a experiência de quem perdeu uma gestação é exatamente o que esta
  comunidade não pode calar. O que ele faz é dar UM SEGUNDO para a leitora
  decidir. Há teste proibindo `filter`/`esconder` na régua.
- ⚠️ **SOB O VÉU NÃO HÁ IMAGEM NENHUMA — nem borrada.** Borrar com CSS ainda
  BAIXA a foto e a deixa no DOM: quem quisesse a leria pelo inspetor, e o 4G dela
  pagaria por uma foto que ela decidiu não ver. Entra uma caixa do MESMO tamanho
  (`aspect-[4/5]`), e o carrossel só é montado no toque. ⚠️ O tamanho tem de
  bater: menor, revelar empurraria o feed e ela perderia o lugar onde estava
  lendo.
- ⚠️ **O TEXTO TAMBÉM ENTRA NO VÉU.** Numa publicação sobre uma perda é a LEGENDA
  que carrega a notícia — borrar a foto e deixar a frase à mostra entregaria
  exatamente o que o aviso existe para poupar. **O NOME fica de fora**: quem
  publicou não é a parte sensível, e escondê-lo faria o post parecer anônimo.
- ⚠️ **A AUTORA NUNCA VÊ O PRÓPRIO POST BORRADO** — ela sabe o que escreveu, e
  borrá-lo seria tratá-la como quem precisa ser protegida do que ela decidiu
  contar. Mesma razão de o filtro de palavras não valer para o que EU escrevi.
- ⚠️ **"Revelado" é POR LEITURA, e nunca gravado.** Guardar faria o aviso valer
  uma vez só — e o segundo encontro com o mesmo post, numa noite pior, chegaria
  sem aviso nenhum.
- ⚠️ **O motivo é CATÁLOGO FECHADO.** Campo livre aqui vira o lugar onde alguém
  escreve o diagnóstico de outra pessoa, ou o detalhe que o aviso existia para
  poupar. E o rótulo diz o assunto **sem contar a história** — é o que ela lê
  antes de escolher.

**A legenda do vídeo** é TEXTO no banco, e não um `.vtt` no balde: um arquivo
exigiria segundo upload, segunda URL assinada e segunda varredura na exclusão de
conta — três superfícies novas para o que é uma frase. ⚠️ Ela fica ABAIXO do
vídeo, nunca sobreposta: sobre o quadro, cobre justamente o que a paciente está
olhando. E o campo só aparece com vídeo escolhido.

#### ⚠️ O CICLO VIROU RÉGUA ÚNICA, e a razão está no próprio CLAUDE.md

A expressão do ciclo (`lmp_date ?? reference_date ?? birth_date ?? "x"`) vivia
privada em `loadCycleAndGestation`, e este arquivo já avisava: **"se divergir, a
contagem procura um ciclo que nunca foi gravado e devolve zero"**.

As MEMÓRIAS passaram a carimbar o ciclo na publicação, e ali a divergência é
pior: uma publicação carimbada com um ciclo e comparada com outro faria a foto de
uma gestação ANTERIOR voltar como memória da de agora. Virou
`ciclo-da-gestacao.ts`.

⚠️ **E `cicloParaCarimbo` devolve `null` onde `cicloDoPerfil` devolve `"x"`.** No
ledger, `"x"` é chave válida — todo mundo precisa de uma. Numa memória, "não sei
de que gestação isto é" tem de significar NÃO MOSTRAR: carimbar `"x"` faria as
publicações de todas as gestações sem marco caírem no mesmo balde e voltarem umas
para as outras.

### ⚠️ DOIS VAZAMENTOS DE VISIBILIDADE NO STORY, e o vídeo (ago/2026)

Achados ao começar o vídeo no story. Os dois estavam de pé com a suíte inteira
verde, `tsc` limpo e as bancadas bonitas — e os dois falham em SILÊNCIO.

#### ⚠️ 1. A FILEIRA NUNCA LEU `visibilidade`

A escada de leitura de `storiesDoFeed` era escrita à mão, quatro degraus, e
**nenhum deles pedia a coluna**: todos preenchiam `visibilidade: "seguidores"`
por conta própria. **O story marcado "só amigas" era entregue, na fileira, a
TODA seguidora** — ela abria, lia e via a foto.

⚠️ **E o portão existia.** `storyQueEuVejo` — o caminho da AÇÃO (votar, reagir,
denunciar) — lê a coluna certinho, e o comentário dele diz com todas as letras
que a régua única existe para o afago não chegar "vindo de quem nunca devia ter
visto aquilo". O caminho da ação foi consertado e **o caminho de VER ficou de
pé**. Consertar metade de uma régua é como um vazamento sobrevive a uma
auditoria.

Hoje a leitura passa por `COLUNAS_DO_STORY` + `DEGRAUS_DO_STORY` +
`storiesCrus`, no mesmo desenho de `postsCrus`: uma lista só, degraus derivados
dela por remoção.

#### ⚠️ 2. `publicarStory` GRAVAVA DUAS VEZES — uma mina armada pelo SQL

Um `insert` com uma leva de colunas e, logo abaixo, **outro** com uma leva
diferente, sem conferir se o primeiro tinha dado certo. Num banco com as duas
levas os dois passam: **todo story publicado em duplicata**.

⚠️ **E a segunda cópia não levava `visibilidade`**, então caía no
`DEFAULT 'seguidores'` do banco: um story marcado "só amigas" ia inteiro para
TODAS as seguidoras — exatamente o vazamento que o comentário do degrau dizia
estar impedindo, entrando pela porta do degrau de cima.

⚠️ **Hoje não dispara porque o dono ainda não rodou
`APLICAR_CONTEUDO_DA_REDE.sql`. Ele se arma no instante em que ele rodar o SQL
que a documentação manda rodar.** É a forma mais cara de defeito deste
repositório: uma coluna nova que, CHEGANDO, quebra um recurso antigo.

`inserirDescendo` é a escada única: começa cheia, tira uma camada de SQL por
vez, e **exatamente um insert dá certo**, porque o laço para no primeiro que não
devolve erro. ⚠️ E cada degrau sabe se descer é RECUSA — descer por cima de uma
escolha dela (camada fechada, vídeo, carrossel de quatro fotos) publica outra
coisa em silêncio.

#### `semAsColunas` — a remoção que INVENTAVA coluna, e a catraca que passava

As duas escadas tinham a própria cópia do par de `replace`. A do story era
segura **por ACIDENTE**: `motivo_sensivel` calha de ser a última da lista, então
a forma `alvo, ` não encontrava a vírgula que a arma — e a mutação que tira o
`\b` **passou verde**. A primeira coluna acrescentada depois dela traria o
defeito de volta, em silêncio.

Uma função para as duas, e o par adversarial mora sobre ELA, onde a ordem da
lista é escolhida para expor o defeito.

#### O vídeo no story

- ⚠️ **A CAPA NÃO É ENFEITE.** `imagem_path` é `NOT NULL`: sem ela o story de
  vídeo não grava. E é ela que a BOLINHA da fileira desenha — a decisão de tocar
  acontece ali, e um quadrado preto no convite é um story que ninguém abre.
- ⚠️ **O quadro da capa é o de 0,1 s, nunca o de zero**: em muitos arquivos o
  primeiro quadro é preto (fade de abertura do próprio celular).
- ⚠️ **A capa tem TETO DE TEMPO**: arquivo que o navegador não decodifica
  deixaria a tela presa em "enviando" para sempre, sem erro nenhum. E capa
  impossível RECUSA o vídeo — nunca um story sem capa.
- ⚠️ **A régua do arquivo é a MESMA do post** (`recusaDoVideo`): duas réguas
  para "que vídeo cabe aqui" fariam o app aceitar no story o que recusa no post.
  A duração vem do decodificador, então a capa (que a devolve) roda ANTES da
  recusa.
- ⚠️ **O arquivo vai DIRETO para o Storage**, com URL assinada — 50 MB pelo
  servidor estouraria o limite de corpo. E o caminho é conferido contra a PASTA
  dela no servidor: sem isso, um corpo montado à mão penduraria no story dela o
  vídeo de outra paciente.
- ⚠️ **Com vídeo, o carrossel não é oferecido**: um story é ou o vídeo, ou a
  sequência de fotos, e a segunda foto viraria um story que nunca aparece.
- ⚠️ **`playsInline` e `muted`**: sem o primeiro o iOS abre o player de tela
  cheia do sistema e o story some por baixo dele; sem o segundo o navegador
  recusa tocar sozinho, e ela veria um quadro parado sem saber que era vídeo.
- ⚠️ **O VÍDEO manda no relógio** — cinco segundos cravados cortariam ao meio um
  vídeo de vinte —, só se a duração for FINITA (`Infinity` faria o story nunca
  avançar), e a duração ZERA na troca, senão o story seguinte herdaria o relógio
  do vídeo anterior.

#### ⚠️ E O VÉU DO STORY: dois defeitos que só a FOTO pegou

Com `tsc` limpo, dezenove testes verdes e o console sem uma linha:

1. ⚠️ **Tocar em "Toque para ver" AVANÇAVA o story.** O botão invisível
   "Próximo" (`inset-y-0 right-0 w-2/3`) fica por cima do véu e engole o toque:
   ela toca querendo decidir, o story passa, e o seguinte aparece sem véu
   nenhum. **A decisão que a tela pede nunca acontecia.** É a mesma trava `z-20`
   que a enquete e a caixinha já tinham, e o véu nasceu sem ela.
2. ⚠️ **A fileira de emojis ficava à mostra sob o véu.** Ela reagiria a um story
   que não viu, e o afago chegaria à caixa da autora vindo de quem não leu nada.
   Sob o véu a tela pede UMA decisão, e mais nada é oferecido — nem reagir, nem
   votar, nem perguntar, nem responder, nem o texto.

E o véu SEGURA o relógio: um story sensível não pode passar sozinho enquanto ela
decide se quer ver.

#### ⚠️ APAGAR COMENTÁRIO POR TEXTO NÃO FUNCIONA NUM `.tsx` — as três formas

Este arquivo já registra dez vezes que a prosa quebra teste de texto nos dois
sentidos. Esta rodada mostrou que o CONSERTO usual também quebra:

1. ⚠️ **Por regex** (`/\/\*[\s\S]*?\*\//g`): `accept="image/*,video/*"` tem um
   `/*` DENTRO de uma string. O padrão abre um "comentário" ali e o fecha no
   próximo fim de comentário de verdade, centenas de linhas abaixo. **Medido: o
   bloco inteiro do vídeo do story sumia do fonte, e sete asserções ficavam
   vermelhas sobre código correto.**
2. ⚠️ **Por varredor que conhece strings**: em JSX, `'` e `"` aparecem como
   TEXTO ("a capa é o primeiro quadro"), e o varredor abre uma string ali,
   engolindo o que vier até a próxima aspa. **Medido: o `z-20` do véu
   desaparecia da varredura estando no arquivo.**
3. ⚠️ **E sem apagar nada, a prosa mente igual**: a fatia `<video …>` começava
   DENTRO do comentário que escreve `<video>` para explicar o véu, engolindo o
   elemento inteiro — a mutação que tirava `playsInline` passava verde.

O que serve é mais barato e mais honesto: **ancorar em texto que só existe no
CÓDIGO** — um `className=` inteiro, uma condição de JSX com as chaves, uma
chamada com os parênteses. A prosa não escreve `className="absolute inset-0
z-20`; ela fala de `z-20`. E o arquivo só faz asserção POSITIVA de propósito:
um `not.toContain` ali é exatamente o caso em que a prosa mente.

#### ⚠️ E a catraca de N+1 ganhou a primeira exceção NOMEADA

`inserirDescendo` tem `await sb…` dentro de um `for`, e não é N+1: é um RECUO —
a mesma gravação repetida tirando colunas, no máximo tantas vezes quantos
degraus, **parando na primeira que dá certo**.

⚠️ **A exceção é escrita porque `postsCrus` e `storiesCrus` escapam por
ACIDENTE** (chamam `await monta(...)`, e o padrão procura `await sb`). Acidente
não é proteção: nomear é o que impede alguém de "consertar" um falso positivo
renomeando a variável. E há contraprova de que a varredura continua mordendo.

⚠️ **Nove testes meus travavam a GRAFIA da escada antiga** — `.insert(`,
`const base = {`, "são TRÊS degraus", a ordem entre os inserts. Os nove
reprovaram sobre um conserto que só apertou a garantia. É a décima primeira vez
nesta base; a régua continua sendo cobrar a GARANTIA, nunca a escrita.

**Aplicar no Supabase:** `supabase/APLICAR_NOVE_DA_REDE.sql`.
**Bancadas:** `/preview-instagram?tela=story&videoStory=1` ·
`?tela=story&sensivelStory=1`.

### Responder o story com foto (ago/2026)

A última das nove que eu tinha deixado explicitamente pendente, com a razão
escrita: _"o caminho existe inteiro — a resposta já é uma mensagem do direct, e
a mensagem já aceita foto; falta ligar o seletor no visor."_ Era isso mesmo.

- ⚠️ **`subirFoto` foi EXPORTADA, nunca copiada.** Uma segunda função de subir
  foto divergiria dela no primeiro ajuste — e a divergência apareceria como a
  foto indo para a PASTA errada, que é a trava que faz `fotoEhDeQuemMandou`
  valer alguma coisa.
- ⚠️ **A foto sobe DEPOIS de a conversa existir.** O caminho no balde é
  conferido contra a conversa (`minhaConversa`): sem o id não há como pedir a
  URL assinada.
- ⚠️ **Foto que não sobe NÃO derruba a mensagem** — sai só o texto, com o recado
  dizendo. Perder o que ela escreveu por causa do anexo seria o pior desfecho, e
  o story some em 24 h.
- ⚠️ **ANEXAR PARA O STORY**, e este é o defeito que o recurso teria sem
  pensar: sem parar o relógio, o story avança enquanto ela olha a prévia, e a
  foto sai grudada num story que ela já não está vendo — o `refId` da mensagem
  apontaria para outra coisa, para sempre. A barrinha congela junto, senão ela
  chega ao fim antes de a foto trocar, que lê como travamento. Mesma razão da
  enquete e da folha de "visto por".
- ⚠️ **Trocar de story LARGA a foto**: ela a escolheu para AQUELE.
- ⚠️ **A prévia é obrigatória, e dá para desistir.** Sem ela, escolher a foto
  mandaria a mensagem às cegas.
- ⚠️ **`URL.createObjectURL` precisa de `revokeObjectURL`**: sem isso cada foto
  trocada deixa o arquivo inteiro preso na memória da aba.
- ⚠️ **A foto SOZINHA já é mensagem** — o servidor aceita corpo só com imagem.
  Exigir texto faria o anexo virar enfeite de uma frase obrigatória.
- ⚠️ **O ícone é DESENHADO, e não 📷** (cor própria em cada sistema, e ele fica
  sobre a foto de outra pessoa), e **o `alt` nunca é vazio**: `alt=""` faz o
  leitor de tela PULAR a imagem, e quem navega assim não saberia que há um anexo
  pendurado na resposta que está prestes a mandar. A mutação que o esvaziava
  passou verde na primeira versão do teste.
- **Os três controles da barra foram a 44px** — medido a 393px: campo 231×44,
  Enviar 74×44, anexar 44×44. ⚠️ **Os dois primeiros já estavam em 40 ANTES
  deste recurso**; foi a medição do novo que os encontrou.

⚠️ **E a foto da bancada me enganou uma vez:** a barra de resposta _parecia_
cortada embaixo. Medida, ela vai de y=708 a 752 num viewport de 852 — dentro da
tela, com folga. **Impressão de captura não é medida**; o que decide é o
`boundingBox`.

**Bancada:** `/preview-instagram?tela=story` (o clipe, a prévia, o × e o relógio
parando).

### As memórias, e a quinta trava que a própria promessa exigiu (ago/2026)

`memorias.ts` já existia — régua pura, quatro travas, testada — e **sem
servidor e sem tela**. É a mesma família das sete funções de servidor que
ficaram sem porta, chegando pelo outro lado.

⚠️ **E relendo a promessa do arquivo antes de ligá-lo, apareceu um buraco.** O
cabeçalho dele diz: _"Se alguma das travas não puder ser garantida, o recurso
não deve existir"_ — e a que impede o pior caso não estava garantida.

#### ⚠️ TRAVA 5 — o Modo Cuidado é OPT-IN

A Trava 1 (luto) e a Trava 2 (ciclo atual) parecem fechar o caso terrível. Não
fecham: **uma mulher que perdeu a gestação e não contou ao app fica com o
`lmp_date` intacto.** O ciclo continua o mesmo, a Trava 2 não morde, e ~300 dias
depois ela receberia "Há um ano, você publicou isto" com a foto da barriga.

O conserto não é esperar que ela ligue o Modo Cuidado: é exigir um sinal
**POSITIVO** de que a gestação terminou em nascimento. `birth_date` é isso, e é
escrito à mão por ela no Perfil.

⚠️ **E ele não estreita o recurso.** Uma memória precisa de 300 dias e uma
gestação dura ~280 — então a única pessoa que já pode ter memória do ciclo ATUAL
é justamente quem já pariu. A trava torna explícito o que a aritmética já dizia,
e fecha o caso em que a aritmética se enganava.

#### ⚠️ A MARCA DE "VISTA" SAI DA TELA, e não do cálculo

A primeira versão gravava `rede_memorias_vistas` dentro de `memoriaDoFeed`. Mas
a tela mostra **um cartão de cada vez** e a retrospectiva de domingo ganha da
memória: marcando no CÁLCULO, uma memória suprimida pela tela seria queimada sem
nunca ter aparecido — e a **Trava 4 vale para a vida toda**, então ela não
voltaria nunca.

`marcarMemoriaVista` é função própria, chamada quando o cartão MONTA. ⚠️ E é no
montar, não no dispensar: quem rolou por cima sem tocar em nada não pode
reencontrá-la amanhã, e depois de amanhã, até a janela de três dias fechar.

#### ⚠️ A Trava 3 estaria MORTA, e o motivo é uma coluna que ninguém pede

`COLUNAS_DO_POST` não traz `arquivado_em` — nenhuma leitura da rede precisa
dele, porque todas filtram na consulta. Sem o `.is("arquivado_em", null)`,
`p.arquivado_em` seria `undefined`, `arquivada` viraria `false` para todo mundo,
e **o que ela tirou do ar voltaria como memória**. O filtro entrou na consulta; a
trava fica de pé na régua como segunda linha, para o chamador que amanhã
esquecer.

#### A ordem dos cartões é por QUEM VOLTA

Três podem cair no mesmo dia. A retrospectiva ganha de todos (só existe aos
domingos). A **memória** vem em seguida, e nunca depois do lembrete: ela tem
janela de três dias e **não volta nunca**, enquanto o "então e agora" reaparece
por conta própria. **Perder a memória é perder para sempre; perder o lembrete é
adiá-lo.**

#### ⚠️ E a proporção do cartão foi MEDIDA, não escolhida

Com o 4:5 do feed o cartão dava ~460px e empurrava o primeiro post para **y=839
num aparelho de 852** — treze pixels de publicação visível, ou seja, o feed
inteiro fora da dobra. É exatamente o arranjo que o dono pediu para corrigir.
Com 16:10: **y=614**.

⚠️ E `cover`, não `contain`: num recorte de 245px o `contain` deixaria a foto
vertical com 160px de largura no meio de 393, cercada de vazio. O recorte
CENTRAL de uma foto de barriga mostra a barriga.

#### E a falha vira `null` — o lado seguro DESTE recurso

Ao contrário de quase toda a rede, onde "não consegui ler" tem de virar ERRO:
aqui o pior caso de calar é um agrado que não aconteceu, e o pior caso de
mostrar é devolver a foto de uma perda.

**Bancada:** `/preview-instagram?memoria=1` — a memória só nasce de uma
publicação de um ano atrás, do mesmo ciclo, de quem já registrou o nascimento, e
some para sempre depois de aparecer uma vez. Sem ela, olhar este cartão exigiria
uma conta com um ano de uso e acertar a janela de três dias.

### O álbum da gestação — a grade lida do começo (ago/2026)

A grade do perfil é cronológica INVERSA, como toda grade: o mais novo primeiro.
Isso serve para "o que ela andou publicando" e é péssimo para a pergunta que
este app promete responder — **"como foi a minha gestação?"**. O álbum é a mesma
coleção lida do começo, agrupada pela semana em que cada publicação nasceu.

#### ⚠️ É SÓ DELA, e isso não é preferência: é o que impede um vazamento

Agrupar por semana carimba uma linha do tempo GESTACIONAL em cada publicação.
Num perfil que outra pessoa abre, os títulos "22 semanas" / "30 semanas"
publicariam a semana de TODO post — **passando por cima da chave
`mostrar_semana`**, que existe exatamente para essa decisão ser dela, por
publicação.

A corrente fecha em TRÊS pontos, e os três têm teste: `meuAlbum` **não tem
`alvoId`** (o recorte é a sessão e nada mais), a tela **não pede** o álbum
quando o perfil aberto não é o dela, e a **prop não é passada** nesse caso.

⚠️ **E a semana é calculada no SERVIDOR.** `lmp_date` nunca viaja para o
navegador — é o que sustenta a chave. A tela recebe títulos prontos.

#### As recusas da régua

- ⚠️ **`semanaDoPost` devolve `null` em vez de chutar.** Publicação anterior à
  DUM (a conta é mais velha que a gestação) ou posterior à 42ª semana não tem
  semana gestacional; chutar uma poria "38 semanas" numa foto tirada depois do
  parto.
- ⚠️ **O título é "Depois", e NUNCA "Pós-parto".** O app não sabe se houve
  parto: só que a publicação nasceu passada a 42ª semana. Nomear o desfecho é o
  tipo de afirmação que este app não faz.
- ⚠️ **Semana VAZIA não vira seção.** Um "17 semanas" em branco transforma a
  ausência em cobrança — houve semanas em que ela não teve o que publicar.
- ⚠️ **Sem DUM não há álbum**: toda semana seria chute.
- **Uma seção por SEMANA, não por trimestre**: trimestre daria três blocos
  gigantes, ou seja, a mesma grade com três títulos.

#### ⚠️ NADA em Modo Cuidado — e a distinção importa

As publicações dela continuam na grade: esconder o que ela escreveu seria o app
apagar o bebê dela (a mesma linha que manteve `podeVerPost` devolvendo `true`
para a autora em luto). O que não é oferecido é o app **ORGANIZAR** aquilo numa
narrativa gestacional semana a semana. O que some é a moldura, não a memória.

#### Um SELETOR, e não uma terceira aba

Uma aba que só existisse no perfil dela mudaria a barra entre um perfil e
outro — e este repositório já decidiu que a barra tem DUAS abas, porque "três
abas vazias ao lado de uma cheia entregam a sensação de um app pela metade". O
álbum é a MESMA coleção lida de outro jeito, que é exatamente a relação que o
seletor de ordem dos comentários já modela.

⚠️ **E ele só aparece com duas seções ou mais**: com uma, o álbum é a grade com
um título em cima, e um controle que não muda nada ensina que os controles desta
tela não valem. ⚠️ **Começa em GRADE** — o álbum é a escolha, não o padrão.

⚠️ **A MESMA `GradeDePosts` por seção**, nunca uma grade nova: a proporção da
célula já mudou uma vez (1:1 → 3:4, em 2025), e duas cópias divergiriam na
próxima.

⚠️ **E uma lição de verificação:** a primeira checagem no navegador varria a
PÁGINA INTEIRA atrás de "pós-parto" e acusou — era o rodapé do site ("do
positivo ao pós-parto"). A asserção certa olha os **títulos das seções**, não o
documento. Medir a coisa errada dá o mesmo vermelho que medir a certa.

**Bancada:** `/preview-instagram?tela=perfil&meu=1&album=1` — o álbum só nasce
de uma conta com uma gestação inteira publicada, e as seções saem da DUM, que
nunca chega ao navegador. `?album=1` SEM `?meu=1` prova que a lista não é
oferecida a terceiros.

#### ⚠️ E a varredura pós-verde achou uma escada que PULAVA um degrau

Com as nove no ar e tudo verde, a pergunta mecânica de sempre — _toda coluna
nova tem degrau?_ — encontrou o defeito em `rede_conversas`.

`minhaConversa` (a **singular**) descia do topo direto para `silenciada+saiu`,
**pulando `fixada_*`**, enquanto `minhasConversas` (a plural) descia de um em
um. E o comentário da singular mandava "ver `minhasConversas`" — afirmando uma
coisa que o código não fazia.

⚠️ **Nada lia `fixada_*` daquela função, então o defeito era LATENTE — e latente
é como um defeito sobrevive à revisão.** Ele acordaria no dia em que o dono
rodasse `APLICAR_DIRECT_COMPLETO` sem `APLICAR_NOVE_DA_REDE`, ou no dia em que
alguém lesse `c.fixada_a`.

`DEGRAUS_DA_CONVERSA` é a lista única, e `degraus-da-conversa.test.ts` a catraca
— com uma invariante que vale para qualquer escada desta base: **cada degrau é
PREFIXO do de cima**, o que garante que descer só TIRA colunas. Uma lista
escrita à mão podia trocar uma coluna por outra sem ninguém ver.

⚠️ E a primeira versão da própria catraca contou errado (cinco degraus onde há
quatro, somando a definição de `BASE_DA_CONVERSA` à conta) e reprovou sobre a
escada certa. **Teste que conta tem de contar a coisa certa** — é a mesma
lição do "pós-parto" achado no rodapé do site, no mesmo dia.

## ⚠️ A AUDITORIA DA COMUNIDADE, e os dezoito defeitos que ela achou (ago/2026)

Pedido do dono: _"rode um loop de agentes verificando cada etapa e se ela conecta
com o resto do site"_ e _"só parar depois de estarem com perfeição e aprovadas
pelos agentes"_. Quatro auditorias em paralelo (vazamento · ponta a ponta ·
testes que mentem · produto e luto), mais um workflow de 28 agentes.

**A aba não estava pronta, e nada disso aparecia em teste, `tsc` ou tela.** Os
3.313 testes passavam, o `tsc` estava limpo, e as bancadas mostravam telas
bonitas. Todos os defeitos abaixo falhavam em SILÊNCIO.

### O padrão, que vale mais que a lista

Este projeto tinha catraca para **"existe chamador?"** e nenhuma para **"a
chamada funciona?"**. Os piores achados são caminhos que nunca foram percorridos
com dado real de ponta a ponta — e as bancadas ESCONDIAM justamente os estados
que a produção sempre produz.

### Os que derrubavam funções inteiras

- ⚠️ **A ABA FICARIA PRETA NO DIA DO DEPLOY.** `COLUNAS_DO_POST` pede
  `enquete_opcoes` e `aula` em CINCO leituras (feed, perfil, sugeridos, post
  avulso, salvos), e as cinco descartavam o `error`. Num banco sem essas colunas
  — o do dono agora — o `42703` devolve `data: null` nas cinco ao mesmo tempo.
  `publicarPost` tinha recuo; a LEITURA não tinha. Toda leitura passa por
  `postsCrus`.
- ⚠️ **`carimbo_semana` NÃO PODIA SER CRIADA.** Ela nasceu dentro do
  `CREATE TABLE IF NOT EXISTS`: num banco que já tinha `rede_stories`, o
  `CREATE` é no-op e a coluna nunca nasce — e rodar o SQL de novo não conserta.
  A conferência do fim relatava `carimbo_ok = false` sem que houvesse comando
  capaz de mudar isso, e a fileira ficava com uma bolinha só, para sempre.
- ⚠️ **A CAIXA ♡ NUNCA RECEBEU UMA LINHA.** `upsert` com
  `onConflict: "dono_id,quem_id,especie,post_id"` contra um índice de EXPRESSÃO
  (`coalesce(post_id, dono_id)`, assim de propósito porque cada NULL é distinto
  no Postgres). `ON CONFLICT` não infere índice de expressão: `42P10`, engolido
  num `console.warn`. Virou `insert` — quem dedupa é o índice, e `23505` é
  sucesso repetido.
- ⚠️ **PUBLICAR COM A AULA ANEXADA FALHAVA SEMPRE.** O validador pedia
  `{ dia, titulo }` e o compositor manda `{ tema }`. O `.parse()` é do objeto
  inteiro. Nem `tsc` nem teste viam: `inputValidator` recebe `unknown`.
- ⚠️ **A CAMADA "TODO MUNDO" ERA A MAIS FECHADA DE TODAS.** `podeVerPost`
  devolvia `autor.publico` sozinho, e o perfil NASCE privado — quem publicava em
  "Qualquer pessoa no app" fazia um post que ninguém via, nem as amigas, enquanto
  o mesmo texto em "Quem me segue" apareceria. Hoje há teste de MONOTONIA nas
  oito combinações.

### Os de vazamento

- ⚠️ **`%` e `_` DO E-MAIL VIRAVAM CURINGAS.** `maria_silva@hotmail.com` casava
  `maria.silva@hotmail.com` e abria faturamento, código e a lista de 200
  indicadas de uma criadora. O repo JÁ tinha consertado isso inline em
  `appointments.functions.ts`, com o comentário certo; três chamadas novas
  nasceram sem. Virou `like-seguro.ts`, com catraca varrendo todo `.ilike(`.
- ⚠️ **O BLOQUEIO FALHAVA ABERTO.** `data ?? []` transformava um timeout em
  conjunto vazio, e como todo ponto de uso pergunta `has()` para ESCONDER, nada
  era escondido. Três linhas abaixo, na mesma função, o grafo de amigas já
  falhava fechado com o comentário certo ao lado. `conjuntoDeBloqueio` responde
  `true` para todo mundo quando degradado — **seguro por construção**, inclusive
  para o ponto de uso que alguém escrever amanhã.
- ⚠️ **A AMIZADE ENCERRADA VOLTAVA A VER A CAMADA `amigas`.** A justificativa
  escrita dizia que o servidor conferia de novo — verdade na aba Amigas, falsa
  desde que a rede passou a consumir `idsDasAmigas`.
- ⚠️ **A CAIXA ANÔNIMA IGNORAVA A PRIVACIDADE DO PERFIL.** `perguntar` não
  conferia `alcancaOPerfil`. Fechar o perfil não fechava nada.
- ⚠️ **A FOTO DE PERFIL DE TODA PACIENTE QUEBRARIA NO OITAVO DIA.** URL assinada
  por 7 dias gravada na coluna, com um comentário dizendo "a próxima leitura
  renova" — e nada renovava. E o dano não era da Comunidade: a aba Amigas lê a
  MESMA coluna.

### O que a régua clínica deixava passar

Medido rodando `triarTexto` contra 32 frases que uma gestante escreveria:

- **Ela não rodava em `publicarPost` nem em `publicarStory`** — protegia o canal
  secundário e deixava a porta da frente aberta.
- **A enquete era conduta clínica com PLACAR.** "[Vai pro PS · Espera passar ·
  Liga pro médico]" faz catorze desconhecidas emitirem uma conduta obstétrica em
  forma de maioria. `desafio-em-grupo` já tinha resolvido isso com catálogo
  fechado; a enquete repetiu o erro que ele evitou.
- ⚠️ **O `&&` era VAZIO**: `sinto` e `senti` estão nas DUAS listas, então a mesma
  palavra satisfazia os dois lados — "senti muito amor quando vi o rostinho
  dele" virava caso clínico.
- ⚠️ **`posso`, `devo` e `é normal`** são as três aberturas mais comuns do
  português, e mandavam "posso levar minha mãe na sala de parto?" ao consultório.
- ⚠️ **Nenhuma variante natural de "comigo foi assim, não precisa ir" era pega**
  — só a forma exata. "No meu caso eu não fui", "ficaria em casa", "melhor
  esperar amanhã": todas publicáveis.
- ⚠️ **Faltavam bandeiras que a paciente de verdade escreve**: pressão em NÚMEROS
  ("15 por 10"; ninguém escreve "pressão alta"), movimento REDUZIDO e não só
  ausente, "perdi líquido", vista estranha, ideação por eufemismo.

O conserto separa **PEDIR** de **ENTREGAR** conduta — entregar é incondicional,
pedir precisa do objeto certo — e usa duas sublistas (`SINTOMAS_DO_CORPO`,
`COISAS_DE_CONDUTA`), com `TERMOS_CLINICOS` intacta porque ela é o contrato do
chat. ⚠️ E `12/8` continua sendo data, não pressão.

### Modo Cuidado

- ⚠️ **A aba ficava EM BRANCO e sem saída.** `return null`, e o único caminho
  para o hub era o atalho ⊞ que essa mesma tela publica. Ela tocava, via nada,
  tocava de novo e nada subia — na semana em que menos tem paciência.
- ⚠️ **E o portão do feed era só do CLIENTE.** As quatro leituras não conferiam
  o `care_mode` de quem chama; o perfil chega depois de duas rodadas de rede, e
  o feed voltando antes dava um FLASH do feed completo — ultrassons, selos de
  "28 semanas", enquetes de nome.
- ⚠️ **E era inferível na lista da criadora.** `minhasIndicadas` removia quem
  entrou em luto — certo numa lista de milhares, errado numa de sete, onde o
  SUMIÇO é a informação. A linha fica; o presente é que some, com um traço
  neutro.

### As promessas que a tela fazia e o código não cumpria

- ⚠️ **"Fica registrada para a gente olhar"** — `denunciado_em` era gravada e
  NENHUMA consulta a lia. Denúncia que não chega + bloqueio cego é o par mais
  perigoso do recurso. Hoje há `FilaDeDenuncias` no Painel, e ela **não mostra
  quem escreveu nem para o administrador**: o que ele precisa é o TEXTO e a
  REINCIDÊNCIA.
- ⚠️ **`parcial: true` tinha ZERO leitores** — a tela dizia "Salvo 💛" e acendia
  a chave sobre nada.
- ⚠️ **O consentimento não dizia o que acontece**: o código faz o primeiro nome
  dela aparecer numa lista de terceiro, e as duas portas falavam só das 150 🌱.
- **"0 seguidores"** era literal cravado, com a lista abrindo com doze pessoas.
- **A bolinha "Seu story"** usava `perfil`, que é o ÚLTIMO PERFIL ABERTO.
- **`reagir` e `guardar` esqueciam a lista `sugestoes`** — o servidor gravava e
  a tela não mudava.

### ⚠️ E DEZ ASSERÇÕES MINHAS MENTIAM

Uma auditoria por mutação rodou **88 quebras** e **18 sobreviveram** — dez no
arquivo que abria dizendo "todas foram conferidas por mutação". Os quatro
mecanismos, todos já registrados no `caixinha.ts`:

- `indexOf` devolve **−1** quando a linha é APAGADA, e `−1 < x` passa;
- `slice(-1, x)` devolve **string vazia**, e `not.toContain` sobre vazio passa;
- `indexOf("aceita_perguntas")` acha o `.select(...)`, nunca a guarda — então
  **MOVER** a guarda passava;
- `toContain('.eq("dona_id", eu)')` passa quando existe uma SEGUNDA ocorrência.

**As mutações que resistiram foram, sem exceção, as comportamentais.** O
conserto não foi escrever mais `toContain`: a decisão saiu do handler para
`src/lib/caixinha.ts`, onde é pura. Sete mutações refeitas — inclusive as que
apagam e movem guardas — e todas ficam vermelhas.

⚠️ **E a catraca de portas tinha três buracos**, dois deles meus: não cobria os
módulos da Fase 5; aceitava o nome dentro de uma STRING e uma VARIÁVEL LOCAL
homônima; e **a minha primeira correção quebrou a catraca** — a regex que tirava
strings não excluía `\n`, e como `codigo` é a junção de todos os arquivos, uma
aspa desemparelhada em qualquer prosa deslocava o pareamento e comia
identificadores. Quatro funções que TÊM porta ficaram vermelhas: uma trava
contra falso positivo virou máquina de falso negativo.

### O que ganhou capacidade

- **Tirar um seguidor** sem bloquear (a única saída era nuclear), e é CALADO.
- **Denunciar um post** — a caixinha tinha denúncia e o canal com MAIS alcance
  não tinha.
- **Teto por PESSOA** na caixinha (3/dia): o teto global não protege contra
  assédio dirigido, e o precedente é o ask.fm.
- **A emergência deixa rastro**: era o único dos três desfechos que não gravava
  nada — a hierarquia estava invertida.

**Aplicar no Supabase:** `supabase/APLICAR_REDE_SOCIAL.sql` (agora com
`aceita_perguntas`, `rede_perguntas`, `rede_posts.pergunta`, `resolvido_em` e o
`ALTER` que finalmente cria `carimbo_semana`).
**Bancadas novas:** `/preview-instagram?tela=caixinha` (`&perguntas=0`,
`&caixinha=0`) · `?tela=lista&remover=0` · `?tela=perfil` (o campo de perguntar,
e os três desfechos da triagem).

## A auditoria de 36 agentes, e as oito ideias novas (ago/2026)

Pedido do dono, em duas partes: aplicar oito ideias novas (1, 2, 3, 4, 5, 6, 7 e
10 — **a 8, limite de publicação, ele recusou**: "não queremos limitar nossos
usuários"), e depois diagnosticar a aba inteira.

### ⚠️ A AUDITORIA ACHOU 22 DEFEITOS, E QUATRO ERAM RECURSOS MORTOS

Todos falhavam em SILÊNCIO, com 3.504 testes verdes, `tsc` limpo e bancadas
bonitas. O padrão vale mais que a lista: este projeto tinha catraca para
**"existe chamador?"** e nenhuma para **"a chamada funciona?"**.

- **A legenda da IA ignorava a régua única da semana pública.** Conferia só
  `mostrar_semana` e reescrevia metade de `semanaPublica`: passavam a paciente
  que **já pariu** (`computeGestation` conta para sempre — duas semanas depois
  do parto o prompt dizia "41 semanas de gestação" e o modelo escrevia na voz
  de uma grávida, sobre a foto do recém-nascido) e a de DUM corrigida acima de 42. `ContextoDaLegenda.semana` virou `string | null` — a FRASE já passada pela
  régua — porque dois campos que precisam concordar um dia discordam.
- **O carimbo do "então e agora" nunca nasceu**: `publicarPost` resolvia o post
  antigo, conferia o dono, punha a foto na frente do carrossel e DESCARTAVA o
  id. `montarPosts` já sabia ler `comparacao_de` e nunca achava um post
  comparado.
- **A caixinha do story era um controle morto**: o 💬 grava `pergunta_aberta` e
  a tela desenha o campo, mas quem decidia era `aceita_perguntas`, que nasce
  DESLIGADA. Virou consentimento POR PUBLICAÇÃO (`consentiuReceber`), com o
  story conferido no banco — e ele **não liga a chave permanente**, que é a
  mesma distinção de `semanaParaCarimbo`.
- **O único post de estranha era o único sem denúncia**: a zona "Publicações
  sugeridas" não passava `aoDenunciar`. Toda prop de ação é opcional em
  `PostInstagram` (tem de ser — a gaveta dos arquivados não reage nem vota),
  então esquecer uma não quebra nada: some um botão, em silêncio.

**`hojeEmSaoPaulo` saiu de `rede-social.functions.ts` para `selo-do-perfil.ts`**
— era privado, e a legenda, escrita depois noutro arquivo, simplesmente não o
chamou.

⚠️ **E o bloco final de `APLICAR_REDE_SOCIAL.sql` não cobria NADA disto.** Dez
verificações novas. Cada coluna faltando apaga um recurso INTEIRO em silêncio,
porque a leitura tem recuo: nada quebra, o recurso deixa de existir.

### Os oito médios, e sete deles mentiam na tela

- **`marcacoesDe` não conhecia o bloqueio** — a linha "com Fulana" embaixo da
  foto de uma TERCEIRA continuava dizendo o nome de quem ela bloqueou.
- **`gravarMarcacoes` decidia por `saoAmigas`, que falha ABERTO** na amizade
  encerrada (o `referred_by` sobrevive, de propósito), enquanto
  `amigasParaMarcar` já usava `idsDasAmigas` e falhava fechado. As duas metades
  do mesmo recurso, para lados opostos.
- **O selo do médico nunca apareceu**: `perfis` era montado só com QUEM REAGIU e
  logo abaixo se lia `perfis.get(eu)?.doctor_id`.
- **`editarPost` acusava a dona** — sem recuo, o `42703` de `enquete_opcoes`
  virava "esta publicação não é sua" SOBRE O PRÓPRIO POST.
- **`tirarMinhaMarcacao`, `publicarStory` e `guardar`** diziam "pronto" sobre o
  que o servidor recusou.
- ⚠️ **O compositor APAGAVA o rascunho ao abrir**: o efeito rodava na montagem
  com os campos vazios e, 700 ms depois, `paraGuardar` devolvia
  `guardar: false` (rascunho vazio apaga — a regra certa). A faixa continuava na
  tela porque o texto já estava em memória, então quem tocasse em "Recuperar" na
  hora não via nada de errado — e quem voltasse depois perdia o texto para
  sempre, com a única prova sumindo junto.
- **A enquete do story** mostrava só a porcentagem ("67%" são dois votos de
  três) e não pausava o relógio, embora o comentário do bloco prometesse.

### ⚠️ E CINCO TESTES MEUS MENTIAM, pelos mecanismos já catalogados

1. `.gte("criado_em"` casava a ocorrência dos TETOS DIÁRIOS, não a do story.
2. "as fotos NÃO existem no rascunho" era TAUTOLÓGICO — olhava as chaves do
   `base()` do próprio teste. Refeito, ele achou um defeito real: `paraGuardar`
   fazia `{ ...r }` e gravaria uma foto acrescentada ao objeto mesmo sem ela
   existir no TIPO (`JSON.stringify` não conhece tipo). Virou cópia campo a
   campo.
3. "só o TEXTO muda" fazia `slice(indexOf(...))` sem conferir a âncora: inlinar
   o helper dava −1, `slice(-1)` devolvia UM caractere e os quatro
   `not.toContain` passavam.
4. "a aba do Feed desenha SÓ o feed" media 260 caracteres num bloco de milhares.
5. E um teste NOVO ficou vermelho sobre código CERTO, porque o comentário que
   explica a decisão contém a string proibida. **Tira-se o comentário antes de
   procurar** — nas duas direções.

### As oito ideias, e o que cada uma não pode ser

- **N1 · Editar a legenda** — só o TEXTO muda; a visibilidade de um post já
  lido não se reescreve pela porta dos fundos.
- **N2 · O lembrete do "então e agora"** (`lembreteDoEntao`, pura). O recurso
  estava escondido atrás do botão de comparar, dentro da tela de publicar. ⚠️ O
  cartão MOSTRA a foto (texto é mais uma frase; a barriga dela responde
  sozinha), ⚠️ o carimbo é escrito quando ele APARECE — não quando ela dispensa,
  senão volta em toda abertura para quem rolou por cima —, ⚠️ um cartão de cada
  vez (a retrospectiva de domingo ganha) e ⚠️ o compositor abre JÁ comparando,
  zerando ao fechar.
- **N3 · Silenciar sem deixar de seguir** — é preferência de FEED, e não régua
  de visibilidade: em `podeVerPost` viraria bloqueio de um lado só.
- **N4 · O feed guarda onde ela parou** (`lugar-no-feed.ts`, pura). ⚠️ O lugar é
  um POST e nunca pixels (as fotos chegam por URL assinada depois da primeira
  pintura), ⚠️ `sessionStorage` e não `localStorage` ("onde eu parei" morre com
  a aba), ⚠️ volta UMA vez por montagem (senão cada página da rolagem infinita
  puxa a tela de volta) e ⚠️ `behavior: "instant"`, nunca `"auto"` — medido:
  `styles.css` põe `scroll-behavior: smooth` no `<html>`, e a volta saía como
  uma rolagem animada de 2.500 px.
- **N5 · Reação ao story** — treze emojis, e o afago chega na autora.
- **N6 · Arquivar em vez de apagar** — isto SEMPRE foi arquivar; a tela é que
  chamava de apagar, e ela tomava uma decisão que achava irreversível.
- **N7 · Denunciar perfil + a fila da plataforma** (`denuncias.ts`). ⚠️ Motivo é
  CATÁLOGO FECHADO: campo aberto numa denúncia de app de gestação é onde alguém
  escreve a informação clínica de outra pessoa. ⚠️ Reincidência conta por QUEM
  DENUNCIOU, não por linha. Fila em `ADMIN_EMAILS`, nunca "qualquer médico".
- **N10 · Convidar pelo WhatsApp** — a MESMA `linkDeIndicacao`, senão é o
  defeito que ela existe para não deixar voltar (o "Convidar" que mandava
  `/auth` puro e não ligava ninguém a ninguém). ⚠️ `https://wa.me`, nunca
  `whatsapp://`; ⚠️ sem número; ⚠️ sem código o cartão NÃO aparece; ⚠️ nada
  disto em Modo Cuidado (a mensagem diz "na minha gestação" na primeira pessoa);
  ⚠️ e `location.origin` no RENDER quebrou a hidratação — vai `SITE`.

### O diagnóstico: a varredura das 52 bancadas

Abrir cada `/preview-*` num navegador e LER O CONSOLE — o método que achou o
laço da barra em minutos depois de três rodadas de dedução.

**Zero `PAGEERROR`, zero tela vazia, zero aviso de hidratação, zero "Maximum
update depth"** nas 52. E UM aviso, repetido em TODAS:

⚠️ **`influenciadora.tsx` exportava `PainelDaEmbaixadora`.** Um export não-rota
num arquivo de rota sai do pedaço DAQUELA rota e entra no da árvore de rotas —
que é o que toda página carrega antes de qualquer coisa aparecer. Mesma família
do `ChatbotWidget`. Medido em dois builds: entrada **925.902 → 914.648 B**
(gzip 283.571 → 280.044). E a mesma medição mostrou que as oito ideias da noite
custaram **+416 B crus** no pacote de entrada.

`rotas-sem-export-solto.test.ts` é a catraca, e ela **nomeia a dívida antiga**
(32 exports em 5 arquivos, que o plugin não acusa) em vez de exigir um refator
que ninguém pediu: export solto NOVO fica vermelho.

**Aplicar no Supabase:** `supabase/APLICAR_REDE_SOCIAL.sql` (idempotente).
**Bancadas novas:** `/preview-instagram?vazio=1&sugeridas=0` (o convite no
vazio) · `?semcodigo=1` (o estado em que ele não aparece) · `?entao=1` (o
lembrete, que implica `retro=0`).

## As nove ideias de conversão (ago/2026)

Pedido do dono depois das dez sugestões: aplicar **1, 2, 3, 4, 5, 6, 7, 9 e 10**
— e, na 5, "fazer um mapeamento de tudo que existe no aplicativo e que a gente
pode usar pra ser compartilhável, tanto na aba da comunidade como no próprio
Instagram".

### ⚠️ O MAPEAMENTO MUDOU O PLANO EM TRÊS PONTOS

Nove agentes, 462 leituras de arquivo. O que ele achou:

1. **A máquina de imagem JÁ EXISTIA.** `share-card.ts` gera PNG 1080×1350 em
   canvas, com `navigator.share` de ARQUIVO e recuo para download — só estava
   cravado na semana. **Dos 34 momentos de conquista do app, DOIS saíam, e os
   dois eram a mesma coisa.**
2. **`getGrowthMetrics` já existia** (super-admin), com funil por canal de
   afiliada — P10 virou "estender", não "construir".
3. **P6 tinha um bloqueador de PRODUTO**, não de código: a conta do médico
   esbarra na decisão pendente do dono sobre ele ver o feed das pacientes.

E três defeitos que viraram conserto obrigatório: os sprites de check/estrela/
cinco sem portão de Modo Cuidado, o marco de semana com portão só no gatilho, e
seis artes de tema órfãs em `src/assets/social/`.

### O que cada ponto não pode ser

- **P1 · A landing diz quem convidou.** ⚠️ PRIMEIRO NOME e FOTO, e mais nada —
  o `select` não pede semana, DPP nem sobrenome. ⚠️ É a primeira função da rede
  **sem sessão**, e pode ser: o código é uma capacidade (32⁷), não um segredo.
  ⚠️ Modo Cuidado devolve o mesmo `null` de "código não existe". ⚠️
  `sessionStorage`, nunca o `localStorage` de 60 dias da ATRIBUIÇÃO — são duas
  perguntas, e a segunda faria a faixa aparecer por dois meses.
- **P2 · O convite nas QUATRO páginas públicas** (`/presente`, `/album`,
  `/acompanhar` e `/votar-nome`, que eu tinha perdido). ⚠️ Uma linha no PÉ: a
  página é DELA. ⚠️ O botão diz "Conhecer o app", nunca "crie sua conta" —
  metade de quem abre não é gestante.
- **P3 · Seguir depois do convite.** ⚠️ Pode ser automático porque seguir é
  ESTRITAMENTE MENOS que o `referred_by` que acabou de ser fixado. ⚠️ `ativo`
  nos dois sentidos. ⚠️ A ORDEM dos pares é a régua (se a segunda falhar, sobra
  o que ela pediu ao convidar).
- **P4 · `/p/<codigo>`.** ⚠️ `perfil_publico` é o portão e nasce FALSO. ⚠️ Um
  `null` só para três motivos. ⚠️ Só a camada `publico`, e o filtro está na
  CONSULTA. ⚠️ Nenhum contador. ⚠️ `noindex`.
- **P5 · Compartilhar as vitórias.** ⚠️ O portão de luto mora em `momentoDe`.
  ⚠️ O de dentro ABRE o compositor e nunca publica. ⚠️ O bilhete guarda o
  MOMENTO, nunca a imagem (cota de ~5 MB). ⚠️ JPEG para o post, PNG para fora.
  ⚠️ A marca não leva o código. ⚠️ Os botões ficam nas folhas PERMANENTES, nunca
  dentro das comemorações que se fecham sozinhas.
- **P6 · A conta oficial.** ⚠️ Ela PUBLICA e é SEGUIDA; **ela não lê** — é assim
  que a decisão pendente do dono continua intocada. ⚠️ E **não é seguida
  automaticamente**: seguir é um gesto. ⚠️ Fixada no topo das sugeridas
  (`ordenarPessoas` a jogaria no fim justamente na conta nova). ⚠️ Coluna
  própria, nunca nome reconhecido por texto.
- **P7 · O resumo da criadora.** ⚠️ E-MAIL, e não push (ela pode não ter o app,
  e o push é o canal da emergência). ⚠️ NÚMEROS, e nunca nomes — `count` com
  `head: true`, então os nomes nem chegam à memória. ⚠️ Semana vazia não manda.
- **P9 · O convite no momento de orgulho**, dentro da mesma folha — nunca uma
  segunda mecânica.
- **P10 · O funil.** ⚠️ O primeiro degrau diz **"não medido"** em vez de
  estimar: um número inventado no topo faria todas as taxas abaixo mentirem
  juntas. `taxa()` devolve `null` sobre não medido e sobre zero.

### ⚠️ TRÊS DEFEITOS GRAVES QUE ESTAVAM EM PRODUÇÃO, E QUE NINGUÉM VIA

Os três falham em SILÊNCIO, e pelo mesmo mecanismo: o PostgREST responde
`42703` a coluna desconhecida, e este projeto engole erro de leitura de
propósito para o recurso degradar em vez de derrubar a tela.

1. **A legenda sugerida nunca funcionou.** `patient_profiles` se filtra por
   `id`; **`user_id` não existe**. Os dois selects (o principal e o recuo)
   falhavam com o MESMO filtro errado, `perfil` vinha `null` e o handler caía em
   `sugestoes: []`. O botão dizia "não consegui pensar em nada" para toda
   paciente desde o primeiro dia. 76 chamadas usam `id`; duas usavam `user_id`,
   e as duas eram minhas.
2. **Abrir o perfil de uma amiga nunca funcionou.** `perfilDaAmiga` pedia
   `journey_state` de `patient_profiles` — é TABELA, não coluna. `p` vinha
   `null` e a função devolvia `sem_vinculo`: "não foi possível abrir este
   perfil", para todo mundo.
3. **O resumo da criadora leria `amount_cents`**; a coluna é `commission_cents`.

**`colunas-que-existem.test.ts`** confere cada `select("…")` literal contra o
que os `.sql` declaram. Foi ele que achou o segundo.
⚠️ E ele mentiu DUAS vezes antes de ficar de pé: um `ALTER TABLE` pode trazer
vários `ADD COLUMN` (acusava código correto), e um COMENTÁRIO entre `.from()` e
`.select()` quebrava a adjacência — depois de eu documentar a correção, a
mutação que reintroduzia o defeito passou verde.
**`patient-profiles-por-id.test.ts`** cobra a chave certa; a confusão é fácil,
porque quase toda outra tabela tem mesmo `user_id`.

**Aplicar:** `supabase/APLICAR_CONTA_OFICIAL.sql` (idempotente; o passo manual
de criar a conta está escrito nele).
**Bancadas novas:** `/preview-convite` · `/preview-momento?tudo=1` (`?luto=1`,
`?semcodigo=1`) · `/preview-instagram?oficial=0`.

## A auditoria de 28 agentes, e os onze defeitos desta leva (ago/2026)

Quatro lentes adversariais sobre os nove pontos de conversão (vazamento ·
ponta a ponta · testes que mentem · produto e luto), mais uma fase de
refutação. 41 achados brutos. **Todos falhavam em silêncio, com 3.741 testes
verdes e `tsc` limpo.**

### ⚠️ O CONSENTIMENTO DIZIA "NO APP" E A PÁGINA ABRIA NA INTERNET

A tela onde ela liga o perfil público diz "qualquer pessoa **no app** pode te
achar". `/p/<codigo>` não é no app: abre sem conta nenhuma, com bio, selo da
semana, nome do bebê e doze fotos. Autorizar isso com a chave de dentro é
alargar, pela porta dos fundos, um consentimento dado para outra coisa — o
oposto exato de "não podemos expor a paciente sem ela saber".

- **`vitrine_publica` é chave PRÓPRIA**, nasce falsa, e a tela dela diz que o
  endereço abre fora do app. Mesma lei de `mostrar_semana`/`mostrar_bebe`.
- ⚠️ **As DUAS precisam estar ligadas.** A vitrine sozinha não vale: desligar
  "perfil público" tem de continuar fechando o perfil em todo lugar.
- **E o ENDEREÇO ficou à vista, ligado ou não.** Ele era a única coisa que o
  app não contava a ninguém: a página existia e nenhuma tela dizia onde. Uma
  vitrine que a dona não sabe achar não é vitrine. `linkDaVitrine`
  (`perfil-publico.ts`) é o único lugar que monta `/p/`.

### ⚠️ `conta_oficial` APAGARIA O SELO E A CAIXINHA DA REDE INTEIRA

Ela entrou em `COLUNAS_DO_PERFIL` num `APLICAR_` **separado** do das colunas
do selo. Existe portanto um banco real — o do dono agora — que TEM
`mostrar_semana`/`mostrar_bebe`/`aceita_perguntas` e ainda NÃO tem
`conta_oficial`: com um recuo só, ele caía direto no degrau de baixo e a rede
inteira perdia os dois selos e a caixinha. Três recursos já ligados, apagados
em silêncio por uma coluna que ele nem sabia que existia.

**O recuo virou um degrau POR COLUNA** — a mesma lição de
`marcarConsultaNoDia`, que precisou de um recuo para `patient_user_id` e outro
para `duration_minutes`. E `COLUNAS_SEM_OFICIAL` é DERIVADA da lista cheia:
duas listas à mão divergem no primeiro ajuste, e aqui a divergência aparece
como recurso sumindo.

### ⚠️ E A CONTA OFICIAL NUNCA CHEGAVA AO TOPO

Duas causas somadas: `conta_oficial` não estava no select das candidatas
(então `ehContaOficial` era sempre falso), e a busca acontecia **depois** do
corte de `PESSOAS_SUGERIDAS` — e a conta oficial cai no fim do ranking por não
ter elo com ninguém, ou seja, era a primeira a ser cortada. `comOficialNoTopo`
virava no-op silencioso: o recurso inteiro do dia um não existia.

⚠️ **E o teste do servidor cobrava `pessoas.find((p) => p.oficial)`** — ele
travava o defeito no lugar, verde, porque descrevia o CÓDIGO em vez do que o
código precisa fazer. A régua virou `fileiraComOficial`, pura e testada por
comportamento.

⚠️ **O select das candidatas tem recuo PRÓPRIO**: ele não herda o de
`perfisPorId`, e sem recuo a zona de sugestões inteira sumiria num banco sem a
coluna — nem publicações, nem fileira de pessoas, nem o convite do fim do feed.

### Os outros seis

- **A foto de quem convidou quebrava no 8º dia** (URL assinada não renovada),
  na faixa da landing e na vitrine pública. O comentário dizia "já é data URL
  no banco" — verdade até o editor de perfil passar a subir para o balde.
  ⚠️ Comentário desatualizado é a forma mais barata de um defeito sobreviver a
  uma revisão.
- **O funil media duas coisas que o rótulo não prometia**: contava post
  ARQUIVADO como "publicaram" e pedido PENDENTE como "seguem alguém" — e este
  último passou a medir a escrita do PRÓPRIO app (P3 grava o seguir na
  atribuição), então daria ~100% para sempre. Conta a partir do SEGUNDO seguir
  (`SEGUIR_AUTOMATICO`).
- ⚠️ **E o degrau de cima somava `porAmiga + porCriadora`**, contando duas
  vezes quem tem os dois campos (entrou pelo link de uma amiga e digitou depois
  o código de uma embaixadora) — **inflando o denominador de todas as taxas
  abaixo**. `chegaram` é contagem própria, com `OR`.
- ⚠️ **Código de criadora com hífen não mostrava faixa nenhuma.** A captura de
  `?ref=` aceita `[a-zA-Z0-9_-]{3,24}`, guarda 90 dias, atribui a assinatura e
  paga a comissão — e a faixa usava a régua ESTREITA da paciente
  (`[A-Z0-9]{3,12}`). `DRA-ANA` funcionava de ponta a ponta na economia e a
  faixa não aparecia, no link que ela pôs na bio para trinta mil pessoas.
  São duas formas: `codigoDeCriadoraLimpo` é a MESMA da captura, e há teste
  comparando as duas regex.
- ⚠️ **O auto-seguir do convite ressuscitava o vínculo que `bloquear` desfaz**
  de propósito, sem aviso, porque o bloqueio é calado. A leitura falha
  FECHADA (erro vale "bloqueada").
- **`/votar-nome` mostrava o rodapé do ÁLBUM** para quem tinha acabado de votar
  num nome e nunca viu foto nenhuma. Ganhou variante `nome`, e há catraca
  cobrando que cada rota pública use a variante dela.

### ⚠️ CINCO DAS OITO ESPÉCIES DE MOMENTO NÃO TINHAM CHAMADOR

Régua testada, cartão pronto, e a paciente sem porta nenhuma: **semana ·
conquista · marco de gratidão · página do álbum · aula**. O pedido era "um
mapeamento de TUDO que existe no aplicativo e que a gente pode usar pra ser
compartilhável" — cinco oitavos não entregues, sem nada quebrado para mostrar.
Mesma família do `escadaDeTrofeus` com zero chamadores.

As cinco ganharam tela:

| espécie          | onde                                          |
| ---------------- | --------------------------------------------- |
| `semana`         | marco de nova semana **e** o hero da aba Bebê |
| `conquista`      | folha que abre no RESGATE (nunca no estado)   |
| `marco_gratidao` | tela de guardado, **só** no marco             |
| `album_semana`   | pé da página do álbum da semana               |
| `aula`           | resultado do quiz — leva o TEMA, nunca o dia  |

- ⚠️ **O marco da semana tinha caminho próprio** (`shareMilestoneCard` direto),
  que não conhecia a Comunidade nem o convite e não passava pelo portão de
  `momentoDe`. Virou o mesmo componente das outras sete — o desenho é idêntico
  (chapéu, fruta, número gigante, unidade), e o que ele ganha é a segunda saída.
- ⚠️ **A aula leva o TEMA, nunca o dia nem a nota**: o dia gestacional é a
  semana disfarçada, e a nota seria o placar público que a aba das Amigas
  gastou um arquivo inteiro para não ter.
- ⚠️ **A conquista nasce do RESGATE, nunca do estado da grade** — com o estado,
  a folha abriria toda vez que ela viesse olhar as conquistas que já tem. Mesma
  distinção que faz os sprites do Caminho nascerem da TRANSIÇÃO.
- ⚠️ **A gratidão só compartilha NO MARCO**, e o cartão leva o NÚMERO: um botão
  em toda gratidão guardada transformaria o exercício mais íntimo do app numa
  cobrança diária de publicar, e o texto dela nunca vai junto.
- **Catraca:** `momento.test.ts` cobra que toda espécie seja alcançável a
  partir de `src/components` e `src/routes` — **bancada não conta**, que é
  exatamente onde as portas da rede social viveram enquanto ninguém as
  alcançava.

**Aplicar no Supabase:** `supabase/APLICAR_REDE_SOCIAL.sql` (agora com
`vitrine_publica`) e `supabase/APLICAR_CONTA_OFICIAL.sql`.
**Bancada:** `/preview-rede` (a chave da vitrine e o endereço).

## As dez ideias de conversão, em cinco fases (ago/2026)

O dono aprovou as dez e pediu que fossem aplicadas "com perfeição". Uma delas
(a #8) era decisão dele, e ele respondeu — desfazendo uma decisão minha.

### Fase A · O dia um

⚠️ **A VITRINE NÃO TINHA PRÉVIA, E A CAUSA ERA O `useEffect`.** WhatsApp,
Instagram e Telegram **não rodam JavaScript** quando buscam o cartão de um
link: pedem o HTML e leem as `<meta>` que vierem nele. `/p/<codigo>` buscava o
perfil no cliente, então o robô recebia página vazia — no link que a criadora
põe na bio, a única superfície de conversão que o app tem fora dele mesmo.
Virou `loader` + `head({ loaderData })`.

- ⚠️ **O MESMO CARTÃO PARA OS QUATRO SILÊNCIOS** (código inexistente, perfil
  fechado, vitrine desligada, Modo Cuidado). Um cartão "perfil indisponível"
  contaria, para quem colou o link no grupo da família, que ali existe alguém.
- ⚠️ **A BIO E A FOTO NÃO ENTRAM.** A página é pública, mas o cartão é COPIADO
  e fica no histórico de toda conversa em que o link for colado, muito depois
  de ela desligar a chave.
- ⚠️ **`noindex` não impede a prévia** — o robô do WhatsApp não é buscador. São
  duas coisas diferentes, e a rota precisa das duas.

**O rodapé da vitrine passou a dizer de quem ela é** — quem abriu veio por causa
de UMA pessoa. ⚠️ Continua sem prometer "seguir": a página pública não tem esse
botão. Sem nome, volta à frase antiga — nunca "Alguém está no Obstétrica".

**O ritual de boas-vindas oferece a Comunidade.** O feed nasce vazio e o perfil
nasce fechado; este é o único minuto em que ela está disposta a mexer nisso.
⚠️ **Oferece e nunca liga sozinho** · ⚠️ **liga `perfil_publico`, NUNCA
`vitrine_publica`** · ⚠️ **não segue ninguém por ela** (seguir é um gesto) ·
⚠️ **nunca em Modo Cuidado**.

⚠️ **E o texto da chave mudou de casa** (`chaves-do-perfil.ts`): ele é o
CONSENTIMENTO e passou a ter duas portas. Há catraca cobrando que as duas telas
leiam a constante.

### Fase B · A conta oficial é uma conta como qualquer outra

⚠️ **UMA DECISÃO MINHA FOI DESFEITA PELO DONO.** `conta-oficial.ts` abria
dizendo "ela publica e é seguida; ela NÃO lê". Palavras dele:

> "o que o médico vê não tem limitação diferente de qualquer pessoa que acessa
> a plataforma, mesmo modelo do Instagram — existem perfil aberto e privado, e
> isso vai da paciente."

Ela publica E lê, e não ganha nada: perfil privado continua privado para ela, a
camada `amigas` continua fora, Modo Cuidado a esconde como esconde de todo
mundo, e **ela não tem porta a partir do painel** — o médico entra nela pelo
`/auth`, como numa conta qualquer.

⚠️ **O que mudou é o ALCANCE, nunca a RÉGUA.** Há catraca cobrando que
`rede-social.ts` e `perfil-publico.ts` não conheçam `conta_oficial`.

⚠️ **E o selo era montado e nunca desenhado onde importa** — existia só na
fileira de sugeridas. No feed e no perfil ela lia como mais uma paciente
chamada "Obstétrica". ⚠️ O selo é IRMÃO do nome, nunca filho do `truncate`.

### Fase C · Medir

**"Abriram o link"** virou `visitas_de_convite`, contador AGREGADO por (código,
tipo, dia). ⚠️ **Sem IP, sem user agent, sem hora** — é contador de alcance, não
rastreador: quem abre o link de uma gestante pode ser a chefe, a sogra ou o ex.
⚠️ **Uma por sessão, com chave própria que guarda o CÓDIGO** (não um booleano):
quem abre outro link na mesma sessão chegou por outro convite.

⚠️ **E O DEGRAU É UMA JANELA enquanto os de baixo são de sempre.** Comparar "12
visitas" com "380 contas desde o começo" daria taxa acima de 3.000% — e um
painel com um número desses é um painel que ninguém volta a acreditar.
`taxaDaJanela` sai PRONTA da régua; deixar a conta na tela é deixar a armadilha
na tela.

**"Quantas viram o post"** — o story tinha "visto por" e o post não tinha nada.
⚠️ **SÓ O NÚMERO, NUNCA A LISTA**, e a diferença em relação ao story é
deliberada: o story some em 24h; o post é permanente e pode ser um desabafo.
Entregar QUEM leu produz "por que a fulana viu e não reagiu?".
⚠️ **A tabela não tem policy nenhuma** — uma policy de LINHA daria a linha
inteira com `quem_id` dentro, e **RLS não esconde coluna**.
⚠️ **O recorte por autora acontece ANTES da consulta.** ⚠️ **`null` para as
outras, e não `0`.** ⚠️ **Metade do cartão visível, e o observador desliga no
primeiro cruzamento.**

### Fase D · Recorrência

**A live no topo do feed**, lendo `listLivesPublic`, que já recorta pelo médico
dela. ⚠️ **A MAIS PRÓXIMA, e não `lives[0]`** — a lista vem em ordem
DECRESCENTE. ⚠️ Sete dias de antecedência · ⚠️ a que acabou some sozinha (90 min
supostos) · ⚠️ a que começou há dez minutos ENTRA, marcada como ao vivo.

**O resumo semanal da rede**, no cron que já roda. A rede mandava UM push só (o
pedido para seguir), e é deliberado — este é o canal do aviso de emergência.
⚠️ **Duas publicações no mínimo** · ⚠️ **NÚMERO e nunca NOME** (o push chega na
tela de bloqueio, e quem estiver ao lado lê) · ⚠️ **não cobra** · ⚠️ **duas
consultas para a base inteira**, nunca uma por paciente.

### Fase E · "Quem está numa fase parecida com a sua"

⚠️ **POR FASE, E NUNCA POR DIAGNÓSTICO.** Fase é biografia; diagnóstico é
prontuário — e um recorte "pré-eclâmpsia" é o fórum de conselho leigo que a
decisão de não ter comentários existe para impedir.

⚠️ **E NINGUÉM É ROTULADO — é a diferença entre um RECORTE e um GRUPO.** Um
"grupo da reta final" com lista visível conta a fase de cada uma que está lá, e
desfaz pela lateral a chave `mostrar_semana`. A fase é calculada no SERVIDOR e
não viaja; `PessoaNaLista` não tem campo de fase, e o rótulo fala da fase DELA.

⚠️ **LIGADO E SEM NINGUÉM PRECISOU DE SAÍDA**: `pessoas.length > 0` fechava a
fileira inteira, levando junto o interruptor que a desligaria.

### ⚠️ E eu previ um defeito no comentário e o escrevi assim mesmo

O endereço da vitrine lia `window.location.origin` no RENDER, com um
`typeof window === "undefined"` que eu achei que bastava. Não basta: o servidor
renderiza `SITE` e o cliente renderiza `127.0.0.1:8080` na primeira passada, e o
React descarta a árvore. O guarda evita o CRASH no servidor; não evita a
DIVERGÊNCIA, porque as duas execuções são exatamente as que precisam concordar.
Achado abrindo `/preview-rede` num navegador e lendo o console.

**Aplicar no Supabase:** `APLICAR_REDE_SOCIAL.sql` (com `vitrine_publica`) ·
`APLICAR_CONTA_OFICIAL.sql` · `APLICAR_VISITAS_DE_CONVITE.sql` ·
`APLICAR_VISTAS_DO_POST.sql`.
**Bancadas:** `/preview-rede` · `/preview-onboarding?passo=4` ·
`/preview-instagram` (selo, vistas, live) · `?live=agora` · `?fase=1` ·
`?fase=vazio`.

## A noite da lentidão: 18 esperas em fila viraram 10 (ago/2026)

Relato do dono, no aparelho: _"clico na foto do paciente que fez a postagem, e
às vezes demora muito tempo pra ler lá pra área do perfil, demora ali cinco
segundos, ou até mais"_.

**Eram DUAS causas somadas**, e a segunda é a que fazia a espera parecer um
travamento.

### ⚠️ 1. A TELA NÃO TINHA ESTADO DE CARREGAMENTO — NENHUM

`abrirPerfil` faz `setPerfil(null)` e troca o destino. Só que a tela do perfil
só é renderizada em `onde.t === "perfil" && perfil`: com `perfil` nulo, **nenhum
ramo casava e a árvore caía de volta no FEED**.

Ela tocava no avatar e a tela não mudava. Nada piscava, nada carregava, nenhum
sinal de que o toque foi registrado — e segundos depois a tela saltava. Do lado
de quem usa isso não lê como "está carregando", lê como "o app travou", e a
reação natural é tocar de novo, o que dispara outra busca e piora o que já
estava ruim. O mesmo valia para a tela do post.

⚠️ **Uma tela sem estado de carregamento transforma qualquer latência em defeito
percebido.** Meio segundo com resposta visual é rápido; meio segundo de tela
imóvel é um app quebrado.

`PerfilCarregando` monta o cabeçalho com o que a tela **já sabia**: nome, foto e
selo saem das listas em memória (feed, sugeridos, grade, salvos, gaveta,
stories, gente, atividade), que acabaram de desenhar essas três coisas no cartão
em que ela tocou.

⚠️ **E SÓ essas três.** Semana, nome do bebê, bio, contadores e publicações
ficam de fora até o servidor responder: quem decide o que aparece num perfil é
`verPerfil`, cruzando Modo Cuidado, bloqueio nos dois sentidos e a camada de
cada post. Um esboço que mostrasse mais seria uma segunda régua de visibilidade.

⚠️ E `aoAbrirPerfil` continua recebendo só o `id` — a prévia é procurada nas
listas que o componente já tem. Passá-la por prop criaria fecho novo a cada
pintura em `acoes`, que é o que faz `memo()` nunca acertar (já custou 232 ms no
cartão do post).

### ⚠️ 2. UMA IDA À REDE POR IMAGEM

`createSignedUrl` (singular) é um `POST` ao Storage **por arquivo**. Contado no
código: uma abertura de perfil com doze publicações de até cinco fotos chegava a
sessenta requisições antes de a primeira imagem aparecer. E três desses laços
eram **sequenciais** (`for … await`): a fileira de stories, a lista de amigas e
as capas da caixa de atividade.

- `urlsAssinadas` usa `createSignedUrls` (**plural**): um `POST` por balde.
  ⚠️ A resposta é casada por **caminho**, nunca por índice — depender da ordem
  seria a classe de defeito que entrega a foto de uma paciente no lugar da de
  outra.
- `renovarUrlsAssinadas` **não renova o que ainda está fresco**, lendo o `exp` de
  dentro do token. ⚠️ Não decifrou vale RENOVAR: o pior caso é uma requisição a
  mais, nunca uma foto quebrada.

### ⚠️ E A RENOVAÇÃO SE REALIMENTAVA

`salvarPerfilSocial` grava o avatar com SETE DIAS; a renovação usava a validade
padrão (uma hora) e não grava de volta na coluna. A partir do dia em que a URL
entra na margem, toda leitura produzia uma URL de UMA HORA, que na leitura
seguinte já estava dentro da margem — e a partir daí **toda leitura da rede
voltava a assinar todos os avatares, para sempre**, com data marcada (~6,6 dias
depois de cada troca de foto) e sem nada quebrado para avisar.

E há um segundo custo, no NAVEGADOR: a URL assinada é a chave do cache de
imagem. Se ela muda a cada leitura, a mesma foto é baixada de novo em toda tela.
`VALIDADE_AVATAR_SEG` é a mesma dos dois lados, nos cinco leitores.

### As quatro cascatas, medidas

`medicoes/ondas-do-perfil.test.ts` roda `verPerfil` contra um Supabase de mentira
e conta cada ida **e o instante em que ela começa**:

|        | idas | ondas seriais | @50 ms/ida |
| ------ | ---- | ------------- | ---------- |
| antes  | 24   | **18**        | 941 ms     |
| depois | 22   | **10**        | 471 ms     |

⚠️ **O que importa é a ONDA, não a consulta.** Vinte consultas em paralelo custam
uma latência; cinco em fila custam cinco. Uma consulta a mais dentro de uma onda
que já existe é de graça; uma a menos numa onda nova é regressão — a conta que um
teste de "quantas queries" não veria.

1. **`idsDasAmigas` fazia quatro consultas em fila** e nenhuma depende da outra:
   as quatro são recortadas pelo mesmo `eu`. Como ela é chamada por `contextoDe`,
   que abre TODA leitura da rede, a espera aparecia em seis telas.
2. **`contextoDe` buscava o grafo depois das outras quatro**, também em série.
3. **`perfisPorId` era chamada DUAS vezes com o mesmo id** — o cabeçalho e o
   autor das publicações, que é a mesma pessoa. Ganhou memória de **uma
   requisição**. ⚠️ Parâmetro, e nunca módulo: a linha carrega `care_mode`,
   `perfil_publico` e as chaves do selo, e servir a versão velha dessas colunas a
   outra pessoa é mostrar o perfil de quem acabou de entrar em Modo Cuidado.
4. **O fim de `verPerfil` eram cinco `await` em fila** — o último escondido
   dentro do objeto literal, que é o mais fácil de não ver.

⚠️ **O PORTÃO DE ALCANCE NÃO SE MOVEU.** As publicações continuam sendo lidas
DEPOIS dele — ler o que a régua vai recusar é trabalho jogado fora e, pior, é a
ordem que um dia alguém "otimiza" movendo o portão para baixo.

⚠️ **A medição mora FORA de `src/`** (`bun run medir:ondas`). `mock.module` do
bun escreve num registro COMPARTILHADO entre arquivos de teste, e todos são
importados antes de qualquer um rodar: a bancada media o Supabase do vizinho e
mudava de resposta conforme a ordem. Um teste intermitente é pior que teste
nenhum. Quem protege no dia a dia são as asserções de FORMA em
`rede-social-servidor.test.ts` (os três `Promise.all`), conferidas por mutação.

### O cache de memória da Comunidade

As abas de `minha-conta` são montadas com `{tab === "X" && <X/>}` — bom (aba fora
da tela não custa render) e com um preço que ninguém tinha pago: trocar de aba
DESMONTA o componente e joga o estado fora. Ir ao Bebê e voltar refazia o feed
inteiro. É a metade da lentidão que mais irrita: não é a primeira abertura, é a
quinta.

⚠️ **Memória, e NUNCA disco.** O cache guarda fotos, textos e nomes de OUTRAS
pacientes: no `localStorage` viraria uma segunda cópia desse conteúdo no aparelho
dela, que sobrevive ao logout, aparece em backup e não é apagada pela varredura
da LGPD. ⚠️ E é **apagado no logout**, antes de derrubar a sessão — num aparelho
compartilhado, que num consultório é o caso comum, a próxima conta não pode
encontrar o feed da anterior.

### O que descia sem precisar

- **`@tanstack/react-query` nunca foi usado** — vinha do template, criava um
  `QueryClient`, viajava no contexto e envolvia a árvore num provider, e NENHUM
  componente chama `useQuery`/`useMutation`. Estava no chunk de ENTRADA, que toda
  página baixa: 923.489 → 902.501 B crus, 283.545 → 277.416 gzip.
- **A Comunidade virou `lazy()`** (120,8 kB crus / 30,9 gzip). Conferido no
  bundle: agora é `import("./rede-instagram-*.js")`, sem nenhum import estático.
- **`qrcode` saiu do preload** (folha de emergência: 49,2 → 24,7 kB).
- **A fileira de stories parou de repintar à toa** — vinte dos trinta e oito
  renders de uma reação eram as bolinhas. ⚠️ `memo` no componente **sem**
  `useMemo` na lista seria trabalho perdido. E ⚠️ o `useMemo` entrou depois de um
  `return` antecipado: `rules-of-hooks`, que o eslint pegou — sem ele viraria um
  defeito que só aparece ao trocar de tela.

## A auditoria das dez, e os três defeitos que ela achou (ago/2026)

### ⚠️ QUALQUER PACIENTE PODIA SE DAR O SELO DO CONSULTÓRIO

`patient_profiles` é escrita direto do navegador com a chave anon em vários
pontos do app (a chave do perfil público, a bio, a foto, o Modo Cuidado) — e a
policy de LINHA não distingue COLUNA. `conta_oficial` entrou sem o `REVOKE` que
este repo já usa três vezes, então uma paciente autenticada podia rodar
`UPDATE patient_profiles SET conta_oficial = true WHERE id = auth.uid()` e passar
a aparecer com o selo e **fixada em primeiro** na fileira de sugeridas de toda
conta nova.

Num app que carrega o nome de um consultório de alto risco, isso não é vandalismo
de rede social: é alguém falando com autoridade médica emprestada para quem
acabou de chegar. `colunas-do-servidor.test.ts` é a catraca, e diz por que cada
coluna está lá.

### ⚠️ O MODO CUIDADO FALHAVA ABERTO NOS DOIS RESUMOS SEMANAIS

Os dois pushes de domingo consultam quem está em luto DEPOIS de somar — recorte
certo. Mas o `error` era descartado, e `data` vem `null` na falha: o conjunto
saía VAZIO e o portão virava no-op. Toda paciente em Modo Cuidado recebia o push
comemorando "coisas boas". Mesma classe do `conjuntoDeBloqueio`, na superfície em
que dói mais. Erro ao ler o luto agora devolve zero e **não manda nada** — o
resumo é um agrado, não uma necessidade.

### ⚠️ O BOTÃO DA VITRINE LEVAVA A `/auth` SEM O CÓDIGO

`/p/<codigo>` é a única página em que o código chega pelo CAMINHO, e as três
capturas do app leem só a QUERY. Com `PublicBottomNav` por cima, o CTA dominante
(botão gradiente de largura inteira, só no celular — onde um link do WhatsApp
abre) apontava para `/auth` puro: `referred_by` ficava nulo e as 100 🌱 não eram
pagas a ninguém. É palavra por palavra o defeito que `indicacao.ts` documenta.

### ⚠️ E A PRÉVIA DIZIA "Alguém está no Obstétrica"

`metaDaVitrine` tinha um `split(/\s+/)[0] || "Alguém"` com um comentário
afirmando ser "a mesma régua de `primeiroNome`". Não era: `primeiroNome` recusa
nome de um caractere e devolve `null`. E o placeholder é justamente o que
`perfilPublicoPorCodigo` grava com `display_name` vazio — que nasce do trecho
antes do @ do e-mail. ⚠️ **Não se conserta depois: o título é o que o WhatsApp
COPIA e guarda no histórico de toda conversa em que o link foi colado.**

### O resíduo do recorte por fase, escrito para não ser esquecido

O rótulo descreve o FILTRO, nunca uma pessoa, e a conversão semana→fase roda no
servidor a partir de `lmp_date`, que nunca viaja. ⚠️ **Ainda assim sobra uma
inferência**: com o filtro ligado, quem aparece está na mesma faixa de ~13
semanas. É grosseira e voluntária — e o que a tornaria inaceitável são três
coisas que o teste agora trava: selo por pessoa, agrupamento com cabeçalho de
fase, e o filtro ligado por PADRÃO.

## A grade do perfil parava na vigésima, e a folha de estilo não era o problema (ago/2026)

Os dois últimos itens da leva de desempenho. O primeiro era capacidade
faltando; o segundo, uma suspeita minha que a medição derrubou.

### ⚠️ Uma paciente com cem publicações via vinte

`verPerfil` devolvia uma página (`POSTS_POR_PAGINA = 20`) e nenhum cursor. As
outras oitenta não tinham caminho nenhum no app — do PRÓPRIO perfil dela. Não
era lentidão: era função ausente, em silêncio, na tela onde ela guarda a
gestação inteira.

- ⚠️ **O cursor entra na MESMA `verPerfil`, e não numa `maisDoPerfil` própria.**
  Uma segunda função teria de repetir o portão de alcance
  (`alcancaOPerfil`), e portão duplicado é portão que um dia diverge — aqui a
  divergência apareceria como **back door para ler as publicações de um perfil
  que a régua recusa**. Reler o perfil custa uma consulta; separar custaria a
  garantia.
- ⚠️ **Ele recorta as DUAS fontes** (próprios e marcados). Sem o cursor nos
  marcados, cada página traria os mesmos posts de marcação de volta e a grade
  repetiria fotos.
- ⚠️ **`proximo` sai de `brutos`, NUNCA de `daGrade`.** A régua de visibilidade
  filtra DEPOIS de ler: uma página em que `podeVerPost` recusou tudo devolveria
  lista vazia, o cursor viraria `null` e a grade pararia ali — escondendo para
  sempre o que vem depois. É a mesma armadilha da paginação do feed.
- **A sentinela é componente próprio** (`SentinelaDaGrade`), para o `useEffect`
  não morar dentro de um retorno condicional — a lição de rules-of-hooks que já
  custou uma volta aqui. E a trava de reentrada é **`useRef`**: a sentinela
  dispara duas vezes no mesmo tranco de rolagem, e um estado só valeria no
  render seguinte.
- **A junção não repete por id**, como no feed: duas páginas podem se sobrepor
  porque a régua filtra depois de ler, e chave repetida derruba a lista inteira.

### ⚠️ EU IA PARTIR `styles.css`, E A MEDIÇÃO DISSE PARA NÃO

Eu tinha proposto dividir a folha (298 kB) por achar que ela pesava na abertura.
Medido no build de produção, com o número que atravessa a rede:

| peça                     | gzip         |
| ------------------------ | ------------ |
| `index.js` (**entrada**) | **276,8 kB** |
| `daily-quizzes.data`     | 151,2 kB     |
| `minha-conta`            | 125,5 kB     |
| `painel`                 | 117,8 kB     |
| `gestacao-path`          | 96,0 kB      |
| `chatbot-widget`         | 72,4 kB      |
| **`styles.css`**         | **42,3 kB**  |

**A folha é 15% do JS de entrada** — e é cache de primeira visita, enquanto o JS
é baixado, interpretado E EXECUTADO antes de o toque responder. Partir a folha
em duas exigiria dois `@source`, e um utilitário usado por um componente
compartilhado que caísse em só uma delas vira **tela sem estilo em produção,
invisível em dev** (o dev serve tudo). Risco alto, ganho fracionário de 42 kB,
numa página da qual o dono nunca reclamou.

**Varredura de CSS morto: praticamente nada.** Das 43 classes `.dc-*`, duas não
tinham referência — e uma delas (`.dc-glass-text`) já não existe: o nome só
aparece na PROSA que documenta a remoção dela. ⚠️ Sobrou `.dc-float`, ~20 linhas
que valem ~100 bytes comprimidos, e ela **fica**: o comentário dela explica por
que a animação não carrega posicionamento, e o bloco do `.dc-rec-dot` a cita
como o caso de contraste da regra de segurança (`prefers-reduced-motion` pode
apagar um enfeite, nunca o único sinal de que o microfone está aberto). Trocar
duas lições documentadas por cem bytes é o mau negócio deste repositório.

⚠️ **E uma varredura de `.dc-*` órfãs NÃO pode ser automatizada por nome:**
`figura-movimento.tsx` monta `dc-mv-${fecha ? "fecha" : "respira"}` em template
literal, e `chama-sequencia.tsx` monta a classe por interpolação. Um script que
apagasse toda classe sem ocorrência literal quebraria as duas animações sem
erro nenhum.

**A maior peça que resta continua sendo `minha-conta.tsx`** — 21.478 linhas,
125 kB comprimidos, zero memoização —, e ela segue parada de propósito: é
cirurgia grande, e o dono precisa dizer se a lentidão sobreviveu às correções
desta leva antes de valer o risco.

## A segunda catraca, e a régua que ninguém chamava (ago/2026)

`legendaSugerida` (`entao-e-agora.ts`) tinha **uma** ocorrência no repositório
inteiro: a própria definição. Escrita, testada, com o comentário explicando que
"cai no campo como rascunho" — e nenhuma tela, nenhum servidor e nem o próprio
módulo a usavam. O compositor tinha o seletor de "então e agora" e nunca
oferecia a legenda.

⚠️ **A catraca de portas não podia pegar**: ela cobra `createServerFn`, e esta é
uma régua PURA. É `proximoDesbloqueio`/`escadaDeTrofeus` chegando pelo outro
lado do `lib/`. `rede-tem-porta.test.ts` ganhou um segundo bloco para as réguas.

- ⚠️ **A régua é "zero usos em qualquer lugar", e não "zero chamadores no
  app".** Confundir as duas daria seis falsos positivos de uma vez
  (`aindaVale`, `podeSerMarcada`, `daSemana`, `semanaPublica`,
  `temTermoClinicoAlemDaAbertura`, `vigente`): todas são usadas DENTRO do
  próprio módulo e exportadas para o teste alcançá-las, que é o padrão da casa.
- ⚠️ **O `import` NÃO É USO — e sem tirá-lo a catraca não morde nada.** Medido:
  com a linha de import contando, as três mutações que apagam a CHAMADA
  passavam TODAS verdes, porque o nome continuava no import do componente. Uma
  catraca de função morta que aceita o import aprova exatamente o defeito que
  existe para pegar: **importar sem chamar É o defeito.**
- ⚠️ **Arquivo por arquivo, nunca sobre a junção**, e **o template literal não
  é removido**: tirá-lo junto com as aspas derrubou catorze funções vivas —
  `${chamada(x)}` é call site de verdade e mora dentro de crase.
- **A exceção é uma só, com razão escrita** (`tamanhoDoCache`, introspecção do
  `Map` de módulo do cache). Exceção sem razão é o buraco que a catraca fecha.

### ⚠️ E LIGAR A FUNÇÃO PRODUZIU DOIS DEFEITOS, os dois vistos na BANCADA

- **A legenda entrava DUAS vezes por toque.** Eu tinha posto o `setTexto`
  dentro do updater de `setEntao` — e um updater de estado é reexecutado de
  propósito (o React confere pureza), então efeito colateral lá dentro roda em
  dobro. **Vale para qualquer `setX(prev => …)` do repositório.**
- **E empilhava a cada liga/desliga** (medido: quatro linhas iguais em três
  toques). `aplicarSugestao` ACRESCENTA — certo para o botão da IA, onde ela
  PEDE a sugestão; errado para uma oferta automática. Agora só entra com o
  campo vazio: oferecer, nunca escrever por cima do que ela digitou.

⚠️ **O carimbo aqui é SEMPRE `null`, e tem de continuar sendo.**
`CandidatoAoEntao` não carrega semana de propósito: as duas semanas saem de
`lmp_date`, que **nunca viaja para o navegador** — é o que sustenta a chave
`mostrar_semana`. Quem monta "12s e 32s" é o SERVIDOR, na leitura, com
`carimboDaComparacao`. Mandar a semana para o cliente "para melhorar a
sugestão" publicaria o dado clínico pela porta dos fundos da tela que existe
para fechá-la. Há teste cobrando que o tipo continue sem semana.

⚠️ **A bancada não alcançava o controle**, e é por isso que ele nunca tinha
sido olhado: o botão exige as DUAS pontas (foto antiga E foto de hoje) e a
bancada só fabricava a antiga. `?comFoto=1` usa `momentoInicial`, que é prop de
PRODUÇÃO — a bancada injeta o DADO nos mesmos estados, nunca o desenho.
⚠️ E ela **segura a MONTAGEM, não a prop**: `fotos` é semeada no INICIALIZADOR
do `useState`, então gatear a prop fez o botão sumir de vez — o compositor
montava sem foto e nunca mais relia.

⚠️ **Duas lições de método, as duas pagas nesta rodada:**

1. **Restaurar mutação com `cp`, NUNCA com `git checkout`**, em arquivo não
   commitado: o `checkout` reverteu o arquivo inteiro para o HEAD e apagou a
   catraca recém-escrita junto com a mutação.
2. **A prosa quebra teste nos DOIS sentidos.** Este teste ficou vermelho na
   primeira execução porque o MEU comentário, explicando que o carimbo mora no
   servidor, contém a palavra `carimboDaComparacao`. Na catraca de portas a
   prosa fazia o contrário: aprovava função morta. Tira-se o comentário antes
   de procurar, sempre.

**Bancada:** `/preview-instagram?tela=novo&comFoto=1`.

## ⚠️ A TELA DE ASSINATURA NÃO TINHA COMO ASSINAR (ago/2026)

Achado ao começar a leva de conversão. Para quem **nunca assinou** — a maioria
das pacientes — `AssinaturaTab` mostrava uma frase de prosa e nada mais: o bloco
de botões inteiro estava atrás de `temAcesso`, ou seja, só aparecia para quem
**já pagava**. A única tela do app cujo assunto é a assinatura era um beco sem
saída exatamente para quem poderia assinar.

- **A frase virou lista** (`VANTAGENS_DO_PREMIUM`, fora do JSX pela razão de
  sempre — é texto que o dono relê). Três linhas concretas no lugar de uma
  vaga.
- ⚠️ **Nenhuma vantagem pode vender CUIDADO.** Diário, registros, SOS, conversa
  com o médico e lembretes são do plano gratuito e continuam sendo. Há teste com
  lista de palavras proibidas: uma linha que insinuasse acesso clínico
  transformaria a assinatura em pedágio de saúde, e a frase do limite ético
  ("nada do seu cuidado depende da assinatura") passaria a mentir na mesma tela.
- ⚠️ **UM primário só, e a primeira versão desta correção errou isso.** Eu
  acrescentei um "Assinar o Premium" ao lado do "Conhecer o Premium" que já
  existia — dois primários empilhados dizendo a mesma coisa, e o de cima
  **morto**, porque com `IAP_ATIVO = false` não há compra em canal nenhum. É o
  defeito de duas portas que o presente entre amigas já pagou. Hoje é o MESMO
  botão, e o veredito escolhe o rótulo.
- ⚠️ **O canal sai de `podeComprarAqui`, nunca de um `if` local.** A paciente
  assina pela loja da Apple/Google (`CANAL_DE.premium_paciente === "app"`),
  nunca pelo Stripe. Uma segunda régua aqui diria "abra pela App Store" sobre um
  app que não está em loja nenhuma — o defeito exato que `canal-de-venda.ts`
  documenta ter cometido uma vez. Quando o IAP virar, o mesmo botão vira a
  compra de verdade, sem uma linha de tela nova.
- **O layout é funcional AGORA**, com o IAP desligado — a mesma lição já escrita
  para a Loja de Sementinhas: benefícios e botão sempre aparecem, só o que o
  botão FAZ muda. Esconder tudo até o app entrar na loja significaria que a tela
  só existiria depois, e "depois" é quando ninguém volta para conferir.

Quatro mutações conferidas em vermelho. Medido nos cinco estados: um botão por
estado, limite ético em todos, zero erros de console.

## ⚠️ UM COMENTÁRIO INVENTAVA UM CANAL DE RECEITA (ago/2026)

O cabeçalho do `QuizPaywall` (`gestacao-path.tsx`) afirmava, por escrito:
_"pagamento assistido: PIX + comprovante no WhatsApp e o consultório ativa o
acesso (toggle no painel do médico)"_.

**Nada disso existe.** Varrido o `src/` inteiro: não há PIX, não há `wa.me`, não
há comprovante. O caminho real é `createSubscriptionCheckout` mais o resgate de
código, com `podeComprarAqui` decidindo se a compra pode acontecer — e como
`CANAL_DE.premium_paciente === "app"` e `IAP_ATIVO = false`, hoje ela não
acontece em canal nenhum.

⚠️ **Isto quase me fez afirmar ao dono que existe um caminho de receita da
paciente funcionando por fora da loja.** Um comentário que inventa CANAL não é
detalhe de prosa: o próximo leitor conclui que o app já sabe cobrar, e a decisão
de negócio seguinte sai daí. É a terceira vez que prosa desatualizada engana
alguém neste repositório — as três constantes de preço mortas ("parece
autoridade, e alguém a usa achando que é a fonte") e o comentário do avatar que
continuava afirmando "já é data URL no banco" depois de o editor passar a subir
para o balde.

⚠️ **E `dc-path-premium-pending` NÃO TEM QUEM ESCREVA.** Era o flag de
"comprovante enviado" desse fluxo. As duas únicas linhas que o tocam são a
leitura e a limpeza (gravando `""`). A limpeza fica — blob de jornada de versão
antiga pode carregar a chave —, mas ninguém deve escrever nela sem reconstruir
o fluxo inteiro: **meio fluxo de pagamento é pior que nenhum, porque a paciente
acha que pagou.**

### ⚠️ E O TESTE NÃO POLICIA PROSA — isso foi decidido depois de tentar

A primeira versão de `paywall-da-aula.test.ts` tinha a regra "se a palavra PIX
aparece, o código tem de tê-la". Ficou vermelha na hora, por causa do comentário
que eu **acabara de escrever** explicando que o PIX não existe: para dizer que a
afirmação é falsa, é preciso citá-la.

É a terceira vez que casar texto engana aqui, **nos dois sentidos**: na catraca
de portas a prosa APROVAVA função morta; no teste do "então e agora" ela
REPROVAVA código certo. O que sobrou são duas asserções de COMPORTAMENTO, sobre
o fonte com os comentários removidos: por onde a compra passa, e que o flag
continua sem escritor. Três mutações em vermelho, inclusive a que deixa só o
comentário citando o portão.

## ⚠️ AS COTAS DO CHÁ NÃO TINHAM COMO NASCER (ago/2026)

Achada por uma varredura de funções exportadas sem nenhum uso — a mesma que
pegou `legendaSugerida`, agora sobre o `src/lib/` inteiro.

`sugerirCotas` (`cotas.ts`) não tinha CHAMADOR NENHUM. Investigando: o servidor
aceita `tipo: "cota"`, a régua está inteira e testada (com o caso do
R$ 1.200 ÷ 7 que quebra em ponto flutuante), e a página pública desenha a
reserva de cota — mas **o único lugar do `src/` que escrevia `tipo: "cota"` era
a BANCADA**. O formulário da gestante mandava `tipo: "item"` cravado.

Das três espécies de item, a **fralda** nasce semeada com a lista e o **item
comum** tem formulário; a **cota** era uma função documentada como pronta e
inalcançável. Mesma família das sete funções de servidor sem porta — e, como
elas, era a bancada que a fazia parecer entregue.

- **A divisão sai de `sugerirCotas`, nunca de um campo livre.** É ela que
  garante o piso de R$ 25 por cota: "12x de R$ 8" transforma o carrinho numa
  vaquinha de trocado, o oposto do que a cota existe para fazer. Abaixo de
  R$ 50 a tela diz **o piso**, e não "valor inválido" — sem o número ela não
  sabe o que corrigir.
- **Centavos inteiros, com a conversão num lugar só.** `Math.round` no total,
  uma vez; nunca aritmética de reais espalhada pela tela.
- ⚠️ **A conferência vai no caminho do ENVIO, não só no botão desabilitado.**
  `ItemSchema` exige `meta >= 1` e `centavosTotal` até R$ 100.000 — fora disso
  volta um erro de banco genérico, que não diz à mãe o que corrigir.
- **Desligado por padrão**: a maioria dos itens de um chá é item simples, e
  abrir o formulário em modo cota faria toda mãe decidir sobre divisão para
  acrescentar uma mamadeira.

### ⚠️ E A TELA DA DONA NÃO TINHA BANCADA — foi por isso que ninguém viu

`/preview-presentes` cobria só a página PÚBLICA. `ChaDeBebe` já aceitava a prop
`bancada` e nenhuma rota a usava. `?dona=1` fecha isso.

**E a primeira SSR dessa tela revelou um defeito que já estava lá:** o link do
chá lia `window.location.origin` no RENDER. O guarda
`typeof window === "undefined"` evita o CRASH e **não evita a DIVERGÊNCIA** — o
servidor desenhava `/presente/<token>` e o cliente o endereço absoluto, e o
React descartava a árvore. **É o mesmo defeito que o endereço da vitrine já
pagou aqui, num arquivo diferente**, invisível porque em produção a tela é
alcançada por navegação do cliente.

⚠️ E `SITE` é mais certo por um segundo motivo: este link é COPIADO para o
WhatsApp da família — `origin` num preview da Vercel gravaria o endereço do
preview na conversa, para sempre.

**Bancada:** `/preview-presentes?dona=1`.

## ⚠️ O PAINEL DO MÉDICO QUASE NÃO TEM BANCADA (ago/2026)

Depois de dois defeitos seguidos aparecerem em telas sem bancada (as cotas que
não nasciam e o link com `location.origin`), fiz a varredura que faltava: o
**fecho transitivo dos imports** a partir de todas as `/preview-*`.

⚠️ **A contagem ingênua mente.** Procurar o NOME do componente dentro dos
arquivos de bancada dá 64 de 86 "sem bancada" — e está errado, porque
`ceu-do-dia`, `baby-illustration` e `grafico-clinico` são desenhados DENTRO de
telas que têm bancada e nunca aparecem por nome. Pelo alcance real são **41**.

E o padrão é nítido: **o app da paciente tem bancadas; o painel do médico quase
nenhuma.** Prontuário (689 linhas), agenda do dia (512), registrar consulta
(427), grade de horários (372), mesada do médico (387), calendário do mês (321),
fila de denúncias (258) e o alerta de SOS (249) — nenhum deles era olhável.

### A tela de maior risco do produto, e o que ela escondia

`AlertaSosMedico` é o que o médico vê quando uma paciente aperta o SOS, com a
localização dela. Recebe tudo por prop e não busca nada — sempre foi
bancada-ável, e nunca teve rota. Para olhá-la era preciso uma paciente de
verdade apertando o botão de emergência.

⚠️ **E olhar achou um defeito na hora.** No estado sem telefone, o aviso dizia
_"Use o WhatsApp ou o contato de emergência abaixo"_ — e os dois dependem de
dados que naquele ramo podem não existir: o botão do WhatsApp é gated pelo
**mesmo `telPaciente`** que acabou de faltar (então nunca aparece ali), e o
contato vem da ficha, que pode ser nula. Medido em `?magro=1`: o aviso mandava
o médico usar dois caminhos, e **nenhum dos dois estava desenhado**.

Numa tela de emergência isso não é texto impreciso — é o médico procurando um
botão que não existe enquanto uma paciente espera. O aviso passou a ter três
casos (contato de emergência · mapa · nem um nem outro) e a citar só o que está
na tela.

⚠️ **O que NÃO era defeito, e ficou como está:** o botão "Já atendi" parece
apagado ao lado do "Ligar", e isso é hierarquia deliberada — medido, ele dá
4,54:1, acima do mínimo. As cinco ações da folha passam (4,53 · 5,29 · 17,20 ·
4,54 · 6,52). Mexer nele por impressão visual seria desfazer a decisão de que a
única coisa que importa nos primeiros dez segundos é LIGAR para ela.

⚠️ **Medir contraste aqui exige o CANVAS**, nunca regex: o projeto escreve cor
em `oklch`, e um parser de expressão regular lê 0.62/0.19/29 como se fosse RGB.
É a mesma armadilha que já "aprovou" seis textos a 1,03:1 neste repositório.

**Bancada:** `/preview-sos-medico` · `?magro=1` (sem ficha, sem GPS, sem
telefone — o caso real de quem apertou o SOS com o perfil incompleto) ·
`?atendendo=1` · `?fila=0` · `?falhou=1` (um canal de aviso não saiu).

### E a de registrar consulta, que é onde o dado clínico é ESCRITO

Depois do SOS, é a de maior consequência: um defeito aqui não some da tela —
fica no prontuário, e outro profissional o lê meses depois.

O que a bancada existe para provar é a decisão central do componente:
⚠️ **o rascunho entra SÓ no campo de ACHADOS.** `consultas.systolic` é o que o
MÉDICO aferiu no consultório; preenchê-lo com a pressão que ela mediu em casa
faria o prontuário afirmar uma aferição que não aconteceu. Medido nos três
estados: o campo de achados recebe o resumo e **os cinco campos de medida ficam
vazios**. (A régua já tinha teste, e ele morde — conferido por mutação.)

⚠️ **Uma armadilha de bancada, que NÃO é defeito do produto:** o campo de data
aparece como `mm/dd/yyyy` na foto. `<input type="date">` desenha no formato do
**navegador**, não da página, e o Chromium do contêiner roda em `en-US` — numa
máquina brasileira sai `dd/mm/yyyy`, e a página não tem como mandar nisso. Vale
lembrar antes de "consertar" um formato de data a partir de uma captura.

**Bancada:** `/preview-registrar-consulta` (retorno) · `?primeira=1` (sem
consulta anterior — o rascunho pega tudo) · `?vazio=1` (nada no período).

**Custo medido:** cada rota de bancada acrescenta pouco à árvore de rotas, que
toda página carrega — a do SOS custou **+660 bytes crus / +143 comprimidos** na
entrada. É o preço de uma tela olhável.

### E o prontuário, a maior tela clínica do app (689 linhas)

Também prop-driven — "ele desenha, quem chama age" —, então a bancada não custou
uma linha de mudança na produção. Os três estados que ninguém consegue fabricar
numa conta de teste:

- ⚠️ **`?degradada=1` — "NADA RELATADO" ≠ "DESCONHECIDO".** Quando o banco não
  tem as colunas do perfil rico, os campos ausentes são DESCONHECIDOS, não
  vazios. Espaço em branco onde deveria estar "alergias" é lido como "não tem
  alergia", e a diferença entre os dois é uma prescrição. Medido: a tela abre
  com o aviso âmbar dizendo isso e mandando aplicar o SQL antes de decidir.
- ⚠️ **`?incompleto=1`** — alguma fonte não pôde ser lida, e a tela avisa em vez
  de fingir completude. Um prontuário que parece inteiro e não está é pior que
  um que assume a falha.
- **`?semficha=1`** e **`?carregando=1`** — os dois vazios.

**Bancada:** `/preview-prontuario` · `?degradada=1` · `?incompleto=1` ·
`?carregando=1` · `?semficha=1` · `?secao=quem` (as abas do cartão da paciente
usam uma seção de cada vez).

⚠️ **UMA OBSERVAÇÃO QUE NÃO VIROU MUDANÇA:** o bloco "Desde a última consulta"
tem quatro contadores, e um deles é **"exames enviados"** — de um recurso que
saiu do produto. Varrido: nada escreve em `exam_files` hoje. Para toda paciente
que entrou depois da remoção o contador é **permanentemente 0**, ocupando um
quarto do bloco mais importante da tela. Não mexi porque quem enviou exame ANTES
ainda tem contagem de verdade ali, e apagar o contador esconderia esse histórico
— é decisão do dono, não minha. Aparece em `prontuario-paciente.tsx` e em
`painel-no-app.tsx`.

### ⚠️ MEDIR CONTRASTE SOBRE FUNDO TRANSLÚCIDO — a segunda armadilha

Ao varrer o alerta de SOS, os links do rodapé do site mediram **2,30:1** e eu
quase os reportei como reprovados. Refeita a medição na página real, eles dão
**6,15:1 — zero reprovações**. O 2,30 era artefato do meu método.

A causa: o rodapé tem `background` com **alfa 0,4**
(`oklab(0.96 … / 0.4)`). Ler `getComputedStyle(el).backgroundColor` e jogar
direto no canvas compõe a cor sobre o **preto transparente** do canvas, e não
sobre o que está de fato atrás dela na página. O número sai escuro demais e o
texto claro parece reprovar.

O jeito certo é **empilhar todos os fundos até achar um opaco e compor de baixo
para cima** (e compor a própria cor do texto, que também pode ter alfa):

```js
const pilha = []; // sobe até o primeiro fundo opaco
let n = el;
while (n) {
  const c = parse(getComputedStyle(n).backgroundColor);
  if (c.a > 0) pilha.push(c);
  if (c.a >= 1) break;
  n = n.parentElement;
}
let base = { r: 255, g: 255, b: 255 }; // o branco do canvas do navegador
for (let i = pilha.length - 1; i >= 0; i--) base = sobre(pilha[i], base);
```

⚠️ **São DUAS armadilhas diferentes na mesma medição, e as duas já custaram
aqui:** o `oklch` lido por regex (que "aprovou" seis textos a 1,03:1) e o alfa
não composto (que "reprovou" vinte a 2,30:1). A primeira erra para o lado de
aprovar; a segunda, para o de reprovar. **Cor sai do canvas E o fundo é
composto** — as duas coisas, sempre.

## ⚠️ A PACIENTE PODIA MARCAR DENTRO DAS FÉRIAS DO MÉDICO (ago/2026)

Achado ao conferir a regra que o próprio arquivo documenta: _"falha na leitura
dos ocupados NÃO vira 'está tudo livre'"_.

`horariosLivresDoMedico` conferia **só `g.error`** (a grade semanal). A leitura
de `doctor_blocks` — férias, congresso, uma tarde bloqueada — não era conferida:
falhando, `bloqueios` virava `[]`, `horariosLivres` **não subtraía nada**, e a
paciente recebia horários dentro do bloqueio e marcava neles.

⚠️ **É a MESMA falha do comentário dos ocupados, aplicada à outra entrada que
também só REMOVE disponibilidade.** Grade, bloqueios e ocupados são três
leituras cujo silêncio faz a agenda parecer MAIS livre do que está — e as três
têm de falhar fechadas.

⚠️ **E a prova de que era esquecimento, não decisão, está no MESMO ARQUIVO:** a
função irmã (`gradeDoMedico`, a que o MÉDICO usa) já fazia `g.error || b.error`.
O médico via a própria agenda falhar fechada; a paciente, não. Quando duas
funções do mesmo arquivo tratam o mesmo erro de formas diferentes, a mais
recente costuma ser a errada.

Três mutações conferidas em vermelho — inclusive a que deixa só o COMENTÁRIO
citando `g.error || b.error`, porque o teste tira a prosa antes de procurar.

⚠️ **A régua que fica:** ao acrescentar uma quarta fonte que subtraia
disponibilidade, ela entra na mesma conferência. Uma fonte nova que falhe aberta
não quebra nada visivelmente — ela só oferece horários que não existem, e o
defeito aparece como duas pacientes na mesma sala.

### E a varredura que isso motivou achou o irmão dele

Se a classe se repete (bloqueio, luto, amigas, conquistas, agora agenda), ela
merece varredura e não só conserto. Procurei toda leitura de TABELA cujo
resultado vira exclusão e cujo `error` não é olhado.

⚠️ **A varredura ingênua dá 523 e é inútil** — quase tudo é `auth.getSession()`,
que não é risco (sem sessão não há token, e todo chamador confere). Estreitada
para leituras de tabela que viram exclusão, dá **66**; e desses, quase todos são
leitura para EXIBIR, não para barrar. **O que importa é a direção da falha:**
só é defeito quando o silêncio faz a coisa parecer MAIS disponível.

Sobrou **um**, e é gêmeo do da agenda: **`reservarPorToken`**, no chá de bebê. O
saldo é relido imediatamente antes de decidir — e o comentário dela já dizia por
quê: _"duas amigas na última cota no mesmo segundo é o caso real"_. A releitura
existia e **falhava aberta**: o `error` era descartado e `vivas ?? []` fazia
`jaReservado` virar ZERO, ou seja, a régua recebia "ninguém reservou nada" e
liberava o item inteiro. **Duas amigas comprariam o mesmo berço, e a lista diria
que estava tudo certo para as duas.**

Dois falsos positivos que valem registro, porque explicam a régua de triagem:
`disponibilidade.functions.ts:198` é um DELETE com erro conferido (não é leitura
nenhuma), e `cantinho.functions.ts:274` falha **fechada** — menos itens lidos
significa menos conjuntos completos e menos bônus pago, que erra para o lado de
não dar.

⚠️ **A pergunta de triagem, para a próxima vez:** não é "o erro foi olhado?" —
é **"se esta leitura voltar vazia, alguma coisa fica mais permitida?"**. Se a
resposta for sim, ela falha fechada.

## ⚠️ DOIS RECURSOS ESTAVAM ESCUROS PORQUE O CRON NUNCA FOI AGENDADO (ago/2026)

`vercel.json` declara **um** cron: `push-weekly-tick`. Os outros três endpoints
(`lembretes-tick`, `meditacao-tick`, `waitlist-tick`) dependem de serviço
externo — decisão registrada, porque intervalo menor que diário exige plano Pro.

Só que a fila de espera tinha previsto isso e os outros dois não:

| endpoint         | tinha chamador fora do cron? | consequência                   |
| ---------------- | ---------------------------- | ------------------------------ |
| `waitlist-tick`  | **sim** (ao abrir a fila)    | degrada, funciona              |
| `lembretes-tick` | **não**                      | 24 h, 4 h e pré-consulta MUDOS |
| `meditacao-tick` | **não**                      | lembrete diário MUDO           |

O comentário da fila já dizia a régua: _"a fila avança de duas formas
(redundância proposital): proativamente pelo cron, e preguiçosamente toda vez
que alguém lê/mexe na fila — **assim ela progride mesmo que o cron não esteja
configurado**"_. Os outros dois passaram a ter a mesma redundância.

- ⚠️ **O que torna seguro chamar de forma preguiçosa NÃO é a varredura — é a
  IDEMPOTÊNCIA.** Os lembretes gravam em `appointment_reminders` **antes** de
  enviar, com índice único; a meditação carimba antes de enviar e conta em
  HORAS. Chamar dez vezes por minuto manda no máximo uma. Se alguém tirar a
  gravação-antes-do-envio, a chamada preguiçosa vira spam **no mesmo canal por
  onde chega o aviso de emergência** — há teste sobre a ordem.
- ⚠️ **Estrangulador de 10 min, porque a varredura é GLOBAL.** Sem ele, cada
  paciente que abrisse "minhas consultas" leria os compromissos da plataforma
  inteira. O relógio é de módulo (best-effort de propósito): quem garante a
  correção continua sendo o índice único.
- ⚠️ **O CRON FORÇA, o preguiçoso não.** Ele é a fonte proativa; estrangulá-lo
  porque uma paciente abriu a tela um minuto antes inverteria o desenho.
- **Ganchos:** lembretes em `getMyAppointments` (onde a fila já varre) e
  meditação em `carimbarQueApareceu` (abertura do app, já rara por natureza).

### ⚠️ E DUAS CATRACAS PEGARAM O MEU PRÓPRIO CONSERTO

1. **`rotas-sem-export-solto`**: eu tinha exportado `varrerLembretes` do arquivo
   de ROTA. Export não-rota ali sai do pedaço daquela rota e entra no da árvore
   de rotas, que toda página carrega — foi assim que `PainelDaEmbaixadora` custou
   11 kB. O trabalho mudou-se para `lib/lembretes.server.ts` e
   `lib/meditacao.server.ts`.
2. **`tabelas-que-existem`**: ela cobra que o cron leia `preconsulta_forms` (e
   não `pre_consultation_forms`, o nome que já custou um pedido nunca enviado) —
   e lia o arquivo da rota, que deixou de ter a consulta. O alvo acompanhou.
   ⚠️ Ao acrescentar "a rota não tem `.from(`", a asserção casou `Buffer.from(a)`
   do comparador de segredo. **Com a ASPA** (`.from("`): leitura de tabela sempre
   tem o nome entre aspas.

⚠️ **E uma asserção minha mentiu na primeira tentativa:** "o registro vem antes
do envio" ancorava em `.from("appointment_reminders")`, que casava a LEITURA do
que já foi enviado — três consultas antes, e legitimamente antes do push. A
mutação que movia a GRAVAÇÃO para depois passou verde. Hoje ancora no
`const { error: erroRegistro }`. Quinta vez que "outra ocorrência do mesmo nome"
engana um teste aqui.

### ⚠️ E UMA TERCEIRA CATRACA IMPEDIU QUE O CONSERTO NASCESSE MORTO

Escrevi a chamada da meditação como `void (async () => {…})()`, para não pôr uma
varredura no caminho da resposta. `travas-do-servidor.test.ts` reprovou, e estava
certa: **no servidor a invocação CONGELA quando a resposta sai**, e a promessa
que ninguém guarda morre antes de rodar — sem erro, sem log, sem nada. Esta base
já perdeu três recursos exatamente assim (`curarLacunasSemVetor`,
`backfillBrainEmbeddings`, `notifyDoctorOfGap`).

O conserto teria ficado bonito no diff, passado no `tsc`, e **não mandado um
lembrete sequer** — que é a mesma classe de defeito que ele veio consertar.

Virou `await`, depois do carimbo. O custo é pequeno porque o estrangulador faz
quase toda chamada voltar `null` na hora: só uma a cada dez minutos toca o banco.

## Exportar os dados existe (LGPD Art. 18, II e V) — ago/2026

`conta.functions.ts` tinha `excluirMinhaConta` e `apagarMinhasConversas`, e mais
nada. A paciente só tinha a opção **destrutiva**: para levar o que é dela,
apagava tudo. Num app de saúde isso pesa mais que na média — o que ela registrou
aqui é a gestação inteira.

### ⚠️ LISTA DE PERMISSÃO, NUNCA VARREDURA

**Um export que vaze dado de TERCEIRO é pior que não ter export.** A tentação é
varrer toda tabela com o `user_id` dela — e essa varredura um dia acha uma
tabela onde "o id dela" significa outra coisa: `presente_reservas` tem o NOME de
quem deu, `rede_perguntas` tem o `quem_id` da caixinha ANÔNIMA (gravado
justamente para nunca ser devolvido), `amizades` e `duplas` têm o id da outra,
`rede_denuncias` tem quem foi denunciado.

Cada fonte entra à mão em `FONTES` (`exportar-dados.ts`), com `porque` escrito.
Há teste proibindo as onze tabelas compartilhadas por nome.

- ⚠️ **`sementinhas_ledger` entra SEM `dedupe_key`** — ela carrega o id de quem
  deu o presente (`presente:<medico>:<paciente>:<token>`). É o caso mais fácil
  de deixar passar, porque a tabela é dela.
- ⚠️ **`consultations` entra pela METADE**, e a metade é a que o produto já
  separou: `resumo_paciente` é o campo rotulado "o que ela vai ler", escrito
  para ela. `achados` e `conduta` são o registro profissional do médico —
  liberá-los por botão automático é decisão de prontuário, não de software.
- ⚠️ **A SESSÃO É O ÚNICO RECORTE.** Não há `pacienteId` no corpo: bastaria
  trocar um uuid para baixar a gestação de outra pessoa. E conta de MÉDICO é
  recusada antes de qualquer leitura — o dado dele é de terceiros.
- ⚠️ **Falha de leitura vira `falhas`, nunca bloco vazio**, e a tela DIZ.
  Export silenciosamente incompleto é pior que nenhum: ela acredita que levou
  tudo, apaga a conta, e o que faltou some junto. Tabela ausente (`42P01`) não
  é falha — num banco atrás das migrations não há o que levar.
- ⚠️ **O que fica de fora vai DENTRO do arquivo** (`FORA_DO_EXPORT`), com o
  motivo. Omitir em silêncio seria fingir completude.
- ⚠️ **O nome do arquivo não carrega o nome dela**: downloads é pasta
  compartilhada. E o aviso diz que o arquivo tem dado de saúde e **não tem
  senha** — quem exporta manda por WhatsApp sem pensar, e é o único momento em
  que dá para dizer isso.
- **A caixa vem ANTES da de excluir**: muita gente que chega ali quer o DADO,
  não o fim da conta.

Cinco mutações em vermelho. **Bancada:** `/preview-conta?privacidade=1` — as
duas caixas nunca tinham sido olhadas juntas.

⚠️ **E a prosa me enganou pela SEXTA vez**: o teste "não existe alvo vindo do
cliente" ficou vermelho por causa do meu próprio comentário, que diz "não há
`pacienteId` no corpo do pedido". **A partir daqui, tirar comentário antes de
procurar é padrão em qualquer teste que leia fonte** — não só nas catracas.

## As bancadas passaram a ser abertas pelo CI (ago/2026)

⚠️ **Este job existe por um defeito concreto:** um `getServerSnapshot`
devolvendo `[]` novo a cada leitura pôs a barra de navegação em laço infinito e
**deixou o app sem abrir**. Ele viveu vários commits com `tsc` limpo, lint
limpo e 3.900 testes verdes — porque **nenhum deles abre uma página**. A
varredura que o achou era manual, e por isso não acontecia.

`scripts/varrer-bancadas.mjs` (`bun run varrer:bancadas`) abre as 42 bancadas
num Chromium e lê o console. Pega o que teste unitário não pega: erro de
hidratação, laço de render, `undefined` no caminho de desenho, import quebrado,
e a tela que simplesmente não desenha nada.

- **As rotas saem do DISCO**, não de uma lista à mão — bancada nova entra na
  varredura sozinha, que é o ponto.
- ⚠️ **`networkidle`, e não `domcontentloaded`.** Medido: com
  `domcontentloaded` a varredura passava por cima de um mismatch de hidratação
  real (foi assim que o `location.origin` do chá de bebê escapou de uma
  varredura anterior).
- ⚠️ **Tela que não desenha nada é defeito**, mesmo sem erro no console — daí
  a checagem de que o `body` tem texto.
- ⚠️ **O servidor de DESENVOLVIMENTO, não o build:** o build gera
  `.vercel/output` (Build Output API), que o `vite preview` não serve — medido.

### ⚠️ E UMA SEGUNDA CHANCE, EM SÉRIE — que não é leniência

A primeira execução acusou mismatch de hidratação em
`/preview-instagram?vazio=1`. Repetido oito vezes em série: **zero**. Ele só
aparecia dentro do lote paralelo — artefato de carga do servidor de
desenvolvimento, não defeito da tela.

**Um teste que falha uma vez em vinte por carga é pior que teste nenhum:** as
pessoas passam a re-rodar sem ler, e no dia em que o vermelho for de verdade ele
é ignorado junto. A segunda chance roda SOZINHA, sem concorrência — defeito
determinístico falha nas duas, artefato de carga não.

⚠️ **E ela é UMA só.** Três tentativas começariam a esconder defeito de corrida
de verdade, que é coisa que este app tem: o laço do `useSyncExternalStore`
nasceu exatamente assim.

### ⚠️ E O JOB FALHOU NA PRIMEIRA VEZ — por dois erros MEUS

1. **A espera pelo servidor procurava um texto que não existe.** O passo fazia
   `grep -q "Local:"` no log do Vite, e a saída COLORIDA insere um escape ANSI
   entre `Local` e `:` (`\e[1mLocal\e[22m:`). O servidor subia em 1,8 s, o laço
   esperava os 120 s inteiros, e o job falhava com "o servidor não subiu"
   impresso logo acima da linha do log dizendo que ele subiu. É a mesma família
   dos casamentos frouxos que este repositório já pagou várias vezes — procurar
   um texto que não está literalmente lá. Virou `curl -sf`, que testa a
   condição que importa: **ele está servindo?**
2. **O caminho do Chromium era do contêiner de desenvolvimento.**
   `/opt/pw-browsers/chromium` existe aqui; no runner quem instala é
   `playwright install`, que põe em `~/.cache/ms-playwright`. Agora o caminho só
   é passado quando o arquivo EXISTE.

⚠️ **E o 429 entrou na lista de ruído, como decisão.** A varredura abre 42
páginas em lotes contra os MESMOS serviços externos (clima, Supabase) e eles
limitam taxa — medido. Um recurso barrado por excesso de chamadas simultâneas da
própria varredura não diz nada sobre a tela. **O que NÃO foi ignorado:** 4xx que
não seja 429, 5xx, e qualquer erro de JavaScript.

### ⚠️ E UM TERCEIRO ERRO MEU: o runner não tem `.env`

Depois dos dois primeiros consertos o job continuou vermelho, agora com **42 de
42 bancadas quebradas** e sempre a mesma linha:

> `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY`

O cliente do Supabase **lança na importação** sem elas, então nenhuma página
desenha. Aqui na máquina de desenvolvimento existe um `.env` e a varredura
passava; no runner, não — **eu tinha validado a varredura numa condição que o
CI não tem.**

O passo `cp .env.example .env` resolve, e não expõe nada: ⚠️ **as duas chaves são
públicas por desenho** — vão para o pacote do navegador em todo deploy, e o
`.env.example` (versionado) as traz preenchidas justamente por isso. Conferido
antes de usar: os quatro segredos de verdade (`SERVICE_ROLE`,
`GOOGLE_GENERATIVE_AI`, `RESEND`, `STRIPE`) estão **vazios** nesse arquivo.

**Reproduzido localmente antes de commitar** — `.env` movido para fora, só o
`.env.example` no lugar: 43 bancadas, zero problemas. É a condição do runner,
e é assim que se confere um conserto de CI sem gastar três rodadas de push.

## ⚠️ O PLANO DO IAP DIZIA O CONTRÁRIO DA REALIDADE (ago/2026)

`docs/plano-iap.md` é o documento que o dono lê para decidir se destrava a
receita da paciente. A tabela de estado dele afirmava:

> Capacitor instalado — **Não** — nem `ios/`, nem `android/`, nem `@capacitor/*`
> no `package.json`

**Os três existem.** `@capacitor/core` 8.5.0, `cli`, `ios` e `android` no
`package.json`; as pastas `ios/` e `android/` no repositório; e um workflow de
CI (`app-nativo.yml`) compilando os dois — com um comentário próprio explicando
que build para simulador não exige conta de desenvolvedor.

⚠️ **Não é detalhe de documentação: é estimativa para baixo do que já está
pronto, num documento que decide investimento.** Mesma classe do comentário do
`QuizPaywall` que inventava um canal de PIX inexistente — e a terceira vez que
prosa desatualizada engana alguém aqui. Eu mesmo repeti a estimativa errada ao
dono antes de conferir.

### O que falta de verdade, conferido item por item

1. **Cadastrar os produtos** nas duas lojas — é a única etapa que **só o dono
   faz**, e ela bloqueia as outras: sem id de produto não há o que comprar nem
   o que validar.
2. **Instalar um plugin de compra** — varrido o `package.json`: não há nenhum
   (`purchase`, `revenuecat`, `billing`, `storekit`).
3. **Validar o recibo no servidor** — varrido o `src/`: nenhum `verifyReceipt`,
   nenhum Pub/Sub, nenhum `purchaseToken`.

⚠️ **E `IAP_ATIVO` é a ÚLTIMA coisa a virar, não a primeira.** Com os produtos
ausentes, ligá-la troca "a compra ainda não está aberta" por **um erro de loja
no meio do checkout** — pior, porque a paciente já decidiu pagar.

**O que NÃO fiz, de propósito:** instalar o plugin e escrever a validação de
recibo. Sem produto cadastrado não há como exercitar nenhum dos dois, e código
de pagamento que nunca rodou é a pior coisa para se ter no repositório com cara
de pronto. `plano-iap-atualizado.test.ts` amarra o documento aos fatos do
repositório, para ele não envelhecer de novo em silêncio — inclusive virando
sozinho o texto do plugin no dia em que alguém rodar o `bun add`.

### ⚠️ E EU COMMITEI COM VERMELHO DUAS VEZES — `bun run verificar`

Duas vezes nesta sessão o commit saiu com teste ou `tsc` vermelho, e as duas
pela MESMA causa: encadear `npx tsc … ; npx eslint … ; bun test … && git commit`
verifica o **`git`**, não as checagens. Elas imprimem o problema e saem com
código **0** — o `&&` passa.

`scripts/verificar.sh` (`bun run verificar`) roda as três e **sai com erro** se
qualquer uma falhar. `bun run verificar && git commit` passa a ser verdade.

## ⚠️ O ACIONAMENTO DE SOS NÃO ERA GRAVADO (ago/2026)

Achado ao escrever a catraca do recuo de coluna ausente — item 7 da leva.

`panic_events` tem uma escada de três tentativas: linha completa → sem a ficha
congelada → só o básico. Ela existe **para o banco atrás das migrations**, que é
o caso normal aqui. O teste era:

```ts
if ((error as { code?: string }).code !== "42703") break;
```

⚠️ **E `42703` nunca sai de um INSERT.** O cabeçalho de `postgrest.ts` já
documentava: **42703** é do Postgres, num SELECT; **PGRST204** é do PostgREST,
num INSERT/UPDATE cujo payload tem coluna fora do schema cache — nem chega ao
Postgres. A primeira tentativa falhava, o `break` disparava, e as duas
tentativas com menos colunas **nunca aconteciam**.

Num banco sem as colunas mais novas, a paciente apertava o SOS, **os avisos
saíam** (push, e-mail, WhatsApp) e o **registro que o médico vê depois, não**.
Falha silenciosa no caminho mais caro do produto.

É a terceira vez que este mesmo erro custa aqui — o "Salvar perfil" do médico
falhava SEMPRE pelo mesmo motivo, e a devolutiva de exame sumia enquanto a tela
dizia "✓".

### A catraca, e o que ela deliberadamente NÃO cobra

`recuo-de-coluna.test.ts` acusa `"42703"` cru **apenas em caminho de escrita**
(há `.insert/.update/.upsert` na janela e não há `.select`).

- ⚠️ **`42703` num SELECT está CERTO** — é literalmente o código que o Postgres
  devolve ali. Proibir o literal em todo lugar viraria migração de **39 sítios
  para consertar 3**, e catraca que obriga refator grande é catraca que alguém
  desliga.
- ⚠️ **Ambíguo não acusa.** Janela com `select` E escrita passa: o falso
  positivo mandaria alguém mexer em código correto, que é pior que o falso
  negativo aqui.
- O SOS tem asserção PRÓPRIA, por ser o caminho mais caro.

Junto saiu o `embeddings.server.ts`, que pelo mesmo engano **registrava erro no
log a cada entrada do cérebro** num banco sem a coluna `embedding` — gritando
sobre uma situação esperada. Alarme que grita sempre é alarme que se ignora.

Três mutações em vermelho, inclusive a que deixa só o comentário citando a régua.

## ⚠️ DUAS ESCRITAS FALHAVAM E A TELA DIZIA QUE DEU CERTO (ago/2026)

A varredura das LEITURAS ("se voltar vazia, algo fica mais permitido?") achou
dois defeitos graves. Esta é a outra metade — gravações cujo desfecho é
descartado.

⚠️ **O `try/catch` NÃO basta, e é o engano central.** Estas funções de servidor
devolvem `{ ok: false }` numa resposta **200 normal** — não lançam. Um `catch`
em volta pega a queda de rede e deixa passar exatamente o caso mais comum, que é
o INSERT recusado pelo banco. É preciso **ler o valor**.

### 1. A triagem de sintomas

`saveTriageLog` era chamada com `void … .catch(() => {})`. E `triage_logs` é uma
das onze fontes de `clinical_events` — é por ela que uma triagem **vermelha**
entra em `eventosQuePedemOlhar`, a fila de trabalho do painel. Sem a linha,
"sangramento" ou "redução dos movimentos do bebê" (dois dos nove sintomas
vermelhos de `triage.ts`) **não chegam ao obstetra**, e nem ela nem ele têm como
saber.

- ⚠️ **O "não atrapalha a orientação" do comentário antigo estava CERTO e
  continua**: a conduta aparece inteira, com o 192 no vermelho, mesmo que a
  gravação falhe — e há teste sobre a ORDEM, provando que nenhuma falha de
  registro pode esconder o encaminhamento.
- ⚠️ **O aviso só sai quando a triagem NÃO é verde.** Numa verde o registro é
  histórico, e assustar sem dar o que fazer é ruído; no amarelo e no vermelho é
  justamente a que deveria entrar na fila do médico, e ela precisa saber que não
  entrou — senão fica esperando um retorno que ninguém vai dar.
- **Texto na CAIXA, nunca `toast`**: ela rola a tela lendo a orientação, e um
  aviso que some em cinco segundos é um aviso que não aconteceu.
- **O servidor passou a registrar a falha.** `assessSymptoms`, no mesmo arquivo,
  já registrava a falha da IA — a ESCRITA clínica estava calada onde a chamada
  de modelo não estava.

### 2. A caderneta de vacinas

`markVaccineGiven`/`removeVaccine` devolvem `{ ok }` e o resultado era jogado
fora: a vacina aparecia marcada, a mãe fechava o app, e na abertura seguinte o
quadradinho estava vazio. Numa caderneta isso é pior que um contador errado — é
a tela que diz **o que ainda falta aplicar no bebê**. Agora a lista só muda
depois do desfecho.

⚠️ **E uma asserção minha mentiu de novo — SÉTIMA vez.** O teste "o servidor
registra a falha" casava `console.error` genérico, e o arquivo já tinha um (o da
IA). A mutação que apagava o log da GRAVAÇÃO passou verde. Hoje ancora na
mensagem exata. **A régua, mais uma vez: ancore no específico, nunca no nome que
o arquivo pode ter duas vezes.**

Quatro mutações em vermelho.

## A acessibilidade do app da paciente foi MEDIDA (ago/2026)

`scripts/acessibilidade.mjs` (`bun run acessibilidade`) abre 15 bancadas da
paciente e mede o que dá para medir sem opinião: contraste, tamanho de alvo,
botão de ícone sem nome, imagem informativa sem `alt`.

⚠️ **AS DUAS ARMADILHAS DE MEDIÇÃO ESTÃO DENTRO DO SCRIPT**, porque as duas já
custaram aqui: o `oklch` lido por regex (que "aprovou" seis textos a 1,03:1) e o
fundo TRANSLÚCIDO não composto (que "reprovou" vinte links de rodapé a 6,15:1).
Cor sai do canvas **e** o fundo é empilhado até um opaco.

### O que a varredura achou, e o que dela é real

Bruto: **124 de contraste, 49 de alvo, 0 sem nome, 0 sem alt.** ⚠️ **O número
bruto não é a resposta** — a mesma lição das varreduras de 523 e de 64. Duas
classes dominam e são falso positivo:

- **"Pular para o conteúdo principal", 1×1** — é o link de salto, escondido de
  propósito e visível ao receber foco. Está CERTO.
- **"Abrir menu", 36×36** — é a navbar do site institucional, que aparece em
  toda bancada e não faz parte do app da paciente.

### O que era real, e foi corrigido

⚠️ **O ✕ que fecha uma sessão de tela cheia**: `text-slate-400` sem
preenchimento, dando **20×24 px a 2,54:1** — abaixo do mínimo nas duas contas.
E é o **único** jeito de sair de uma meditação, de um exercício ou de uma aula
que ocupa a tela inteira.

Seis botões com a mesma classe. Agora `-m-2 flex h-11 w-11` (o `-m-2` cresce a
área do dedo sem mover o desenho) e `text-slate-600`. **Medido depois: 44×44 e
7,32:1** nas duas telas.

O resto do contraste é texto auxiliar entre 3,4 e 4,5:1 — real, porém de outra
natureza (legenda, não controle), e mexer nele é decisão de paleta que atravessa
o app inteiro. Fica levantado, e o script está no `package.json` para ser rodado
de novo.

### E a agenda do consultório ganhou bancada

`CalendarioDoMes` + `DiaDaAgenda` somam 833 linhas e decidem o que o médico vê
do próprio mês. Também prop-driven — bancada sem uma linha de mudança na
produção.

O que ela existe para provar, e que só se confere olhando:

- ⚠️ **`firme: false` aparece TRACEJADO.** Um pedido não confirmado e uma
  particular sem horário aparecem para ele não esquecer que existem — mas
  pintá-los como compromisso faria o médico contar com uma hora que ninguém
  combinou. **Medido: os dias 25 e 27 saem com o ponto vazado**, os outros
  cheios.
- **As três cores por TIPO** (🟢 presencial · 🟠 teleconsulta · 🟣 particular),
  porque é o tipo que muda o dia dele.
- ⚠️ **O mês é FIXO na bancada** (`2026-08`), nunca `new Date()`: uma bancada
  que muda de conteúdo conforme o dia da execução não serve para comparar duas
  fotos.

Nenhum defeito encontrado desta vez — a tela está certa, e agora dá para
conferir.

**Bancada:** `/preview-agenda` · `?vazio=1` · `?firme=0` (só o que não tem hora).

## ⚠️ O CONTÊINER DEVOLVE INSTANTÂNEOS ANTIGOS — e o conserto (ago/2026)

Pedido do dono: _"alguns erros se repetem — esses erros de commit, que aí a
gente sempre volta, e toda vez pega uma versão antiga do código"_.

### A causa, medida

O contêiner **não clona o repositório do zero** quando reinicia: ele restaura um
**instantâneo** do espaço de trabalho. Cinco vezes numa única noite ele voltou ao
MESMO commit (`ee24f25`, de 19/ago) com arquivos "modificados" que eram versões
**anteriores** às do remoto — num caso medido, **4.572 linhas a menos**.

⚠️ **O perigo não é perder trabalho** (ele está no remoto, porque eu empurro a
cada item). **É COMMITAR AQUELES ARQUIVOS.** Um `git add -A && git commit` ali
reverte a sessão inteira, e o diff parece legítimo — nada acusa.

### As duas defesas

1. **`.claude/hooks/session-start.sh`** — na abertura da sessão, compara com o
   remoto e age **só no caso INEQUÍVOCO**:

   | situação                     | o que faz                                    |
   | ---------------------------- | -------------------------------------------- |
   | igual                        | nada                                         |
   | **atrás** (HEAD é ancestral) | guarda a árvore em `restos-*.patch` e alinha |
   | **à frente**                 | NÃO TOCA — avisa que falta empurrar          |
   | **divergiu**                 | NÃO TOCA — avisa alto                        |

   ⚠️ Nos dois últimos há trabalho local que só uma pessoa pode julgar, e um
   hook que decide sozinho ali destrói exatamente o que veio proteger. E mesmo
   no caso seguro **nada é apagado**: vai para um `.patch` com o nome impresso.

2. **`bun run verificar` ganhou a quarta checagem** — recusa commit com a árvore
   atrás do remoto. O hook cobre a abertura; esta trava cobre o reinício **no
   meio** do trabalho, que foi como aconteceu todas as vezes.

### ⚠️ O limite honesto desta solução

Uma proteção que mora no repositório **não se defende de uma cópia do
repositório sem ela**. O instantâneo que volta é de 19/ago e não tem o hook —
então ele só passa a funcionar quando um instantâneo NOVO for tirado, depois
desta mudança. Não é conserto retroativo, e dizer o contrário seria vender o que
não entrego.

### ⚠️ E duas lições de método, ganhas errando aqui

- **`bun install` falhando NÃO é a sessão quebrada.** Medido: três tentativas
  seguidas morrem em `ConnectionClosed downloading tarball` e o `node_modules`
  está inteiro — ele vem na imagem. A pergunta certa não é "o install passou?",
  é **"dá para trabalhar?"**, e quem responde é a presença do `node_modules`.
- ⚠️ **Não se testa uma trava NÃO COMMITADA com operações que resetam a
  árvore.** Passei três tentativas achando que a trava estava quebrada: cada
  `git reset --hard` do meu próprio teste apagava a trava junto, e o script que
  rodava era o antigo. Commite primeiro, teste depois.

## A aba Comunidade era um MENU, não um hub (ago/2026)

Pedido do dono: ela _"não tem o acabamento que a aba do Instagram tem"_.

Fotografadas lado a lado, a diferença **não é de estilo — é de INFORMAÇÃO**:

| aba do Instagram                               | Comunidade             |
| ---------------------------------------------- | ---------------------- |
| stories de quem ela conhece, com anel e nome   | seis cartões idênticos |
| a próxima live, com horário e botão            | que nunca mudam        |
| "você entrou na 29ª semana, publicou 3 vezes…" | —                      |

Agora cada porta diz **se aconteceu algo atrás dela** ("3 presentes
reservados", "12 fotos no álbum", "7 sugestões de nome"), que é o que faz
alguém abrir. Régua em `src/lib/estado-das-portas.ts`, busca em uma ida só.

- ⚠️ **"NÃO CONSEGUI LER" NÃO É "ZERO".** Contagem ilegível vira `null`, e
  `null` **não desenha nada** — a porta volta a ser só a porta. Zero AFIRMARIA
  que não há nada, e ela deixaria de abrir onde havia. Mesma régua da fila de
  denúncias, da disponibilidade da agenda e do saldo do chá de bebê. Fotografado
  em `?ilegivel=1`: Chá e Álbum voltam ao subtítulo, só Amigas traz número.
- ⚠️ **A frase SUBSTITUI o subtítulo, não se soma a ele.** Duas linhas de texto
  miúdo num cartão de 170px viram bloco cinza — e o FATO vale mais que a
  descrição, que ela já leu nas visitas anteriores.
- ⚠️ **A ordem NÃO é por contagem.** Quem tem novidade sobe; entre si, mantêm a
  ordem original. Ordenar por tamanho transforma o hub num PLACAR — a
  comparação que a aba das Amigas gastou um arquivo inteiro para não ter. E é
  estável: sem isso o cartão pula de lugar enquanto ela olha.
- ⚠️ **Nenhuma frase cobra.** Há teste com lista de palavras proibidas
  ("falta", "você não", "não perca"). Num app de gestação de alto risco, um hub
  que cobra é um hub que ela fecha.
- **O FEED fica de fora de propósito**: contá-lo exigiria guardar a última
  visita e varrer o feed inteiro, para um número que o próprio feed já mostra —
  e seria a única porta a empurrar consumo em vez de relatar um fato.
- **A aba não espera o servidor para desenhar**: os cartões aparecem na hora e o
  estado chega depois. Um esqueleto trocaria uma tela pobre por uma vazia.

### ⚠️ E DOIS ERROS MEUS, os dois pegos por olhar

1. **O teto `9+` era mentira.** A bancada mostrou o cartão do Álbum com o
   emblema **9+** ao lado da frase **"12 fotos no álbum"** — dois números para a
   mesma coisa, se contradizendo a um centímetro. Virou `99+`, o mesmo teto do
   contador de amigas, que cobre o caso real sem nunca contradizer a frase.
2. ⚠️ **EU SOBRESCREVI UM ARQUIVO QUE JÁ EXISTIA.** Criei a régua como
   `resumo-da-comunidade.ts` — que **já era** o push semanal ("três pessoas que
   você acompanha publicaram"). O `tsc` acusou, e o `git checkout` restaurou;
   mas o `Write` num caminho sem conferir antes é como se apaga trabalho sem
   perceber. A régua nova chama-se `estado-das-portas.ts`, e os dois arquivos
   dizem no cabeçalho que não devem ser confundidos.

Cinco mutações em vermelho. **Bancada:** `/preview-comunidade?vivo=1` ·
`?ilegivel=1` (o caso que mais importa) · `?luto=1`.

## ⚠️ QUATRO FRASES FALTAVAM NO `Info.plist` — e a falta delas FECHA O APP (ago/2026)

Achado na preparação para o trabalho de iOS. É o defeito mais caro que restava,
e nada no repositório o pegava.

**No iOS, usar câmera, microfone ou galeria sem a frase correspondente no
`Info.plist` NÃO é permissão negada — é o sistema ENCERRAR o processo**, na
hora, sem diálogo e sem erro.

O `Info.plist` tinha **uma** declaração (localização). E o app usa três recursos:

| recurso          | onde                                                           |
| ---------------- | -------------------------------------------------------------- |
| câmera / galeria | 8 campos de foto — avatar, álbum, publicações, "então e agora" |
| microfone        | `gravador.ts`, o ditado do diário                              |
| localização      | o SOS (essa estava lá)                                         |

A paciente que tocasse no microfone para ditar o diário, ou na câmera para pôr
foto no perfil, **veria o app sumir**. `tsc`, lint e 4.000 testes: todos verdes.

Entraram `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`,
`NSPhotoLibraryAddUsageDescription` e `NSMicrophoneUsageDescription` — mais
`UIBackgroundModes: remote-notification`, sem o qual **o iOS não entrega push
com o app fechado**, e esse é o mesmo canal do aviso de consulta e do retorno do
SOS.

⚠️ **O TEXTO É LIDO PELA REVISÃO DA APPLE.** Frase genérica ("este app precisa
da câmera") é rejeição pela diretriz 5.1.1 — ela exige dizer PARA QUÊ. As
quatro dizem, e há teste recusando abertura genérica.

### A catraca, e o que ela deliberadamente faz

`permissoes-do-ios.test.ts` roda **no Linux, sem Xcode**, e é a única coisa
entre esse defeito e a loja.

- ⚠️ **O gatilho é o USO REAL, não uma lista à mão.** Se amanhã alguém
  acrescentar um campo de foto num lugar novo, a exigência continua valendo sem
  ninguém lembrar de atualizar o teste; se um recurso SAIR do produto, ela cai
  sozinha.
- ⚠️ **Ela NÃO substitui o Xcode.** Ligar "Push Notifications" nas Capabilities
  e o certificado APNs continuam sendo necessários — os três são, e nenhum avisa
  quando falta. Este teste cobre o único que mora no repositório.

Quatro mutações em vermelho (tirar a do microfone, tirar a da câmera, deixar uma
frase genérica, trocar o modo de push).

## ⚠️ DIÁLOGO DO SISTEMA NO APP DA PACIENTE (ago/2026)

Achado na varredura de preparação para o iOS.

`alert()` e `window.confirm()` no app instalado abrem com **"www.obstetrica.com.br
diz:"** — o nome do domínio, dentro do app. É a cara de "site embrulhado" que a
**diretriz 4.2** da Apple reprova, e ela aparecia justamente nas telas de apagar
coisa, que é onde a paciente menos precisa duvidar de onde está. Além disso o
`confirm` TRAVA a linha principal.

⚠️ **E contrariava uma decisão já tomada pelo dono:** no cancelar consulta ele
pediu, explicitamente, confirmação em **mensagem separada** com Sim/Não — nunca
o mesmo botão virando "tem certeza?".

⚠️ **A lição já estava escrita numa tela e não tinha sido aplicada às outras.**
`minha-conta.tsx` tinha, desde antes, um comentário dizendo _"era um `alert()`
do sistema; num app instalado isso é um diálogo modal"_ — e **três outros**
`alert`/`confirm` seguiam vivos no MESMO arquivo. É a mesma forma do `42703` em
caminho de escrita: consertado num lugar, deixado em cinco.

Trocados os quatro:

| onde                           | era              | virou                        |
| ------------------------------ | ---------------- | ---------------------------- |
| apagar conversas com a IA      | `window.confirm` | confirmação na tela, Sim/Não |
| apagar histórico de contrações | `window.confirm` | idem                         |
| falha do microfone             | `alert`          | `toast.error`                |
| "Copiado!"                     | `alert`          | `toast.success`              |

⚠️ **O texto do microfone também mudou**: "verifique as permissões do navegador"
não ajuda quem está no app instalado, onde o caminho é **Ajustes → Obstétrica →
Microfone**.

### O recorte da catraca, e por que ele é esse

`sem-dialogo-do-sistema.test.ts` cobre o **app da paciente** e os componentes —
é ele que vira app de iPhone. O **painel do médico fica de fora**: é usado no
computador, onde um `confirm` é feio mas não é problema de revisão, e proibir
ali obrigaria a mexer em oito lugares para resolver zero. As **bancadas** também
ficam de fora: `alert` numa `/preview-*` é o jeito mais direto de mostrar para
onde um toque levaria, e elas não vão para a loja.

## A varredura de preparação para o iOS — o que ela achou e o que ela LIMPOU (ago/2026)

Pedido do dono: _"pesquisa ampla sobre o que pode ser melhorado dentro do
código, pra deixar tudo preparado, pra não houver erros"_ — antes de levar o app
para o iPhone.

Orientei a varredura pelo que **o travaria amanhã**, e não por revisão genérica.

### O que ela achou (os dois já consertados acima)

1. **Quatro frases faltando no `Info.plist`** — o app FECHAVA ao tocar no
   microfone ou na câmera.
2. **Diálogo do sistema** (`alert`/`confirm`) no app da paciente — abre com o
   nome do domínio, que é a cara de "site embrulhado" da diretriz 4.2.

### O que ela varreu e estava CERTO — e vale registrar para não ser refeito

- **`100vh`** — quatro usos, todos legítimos: uma página HTML injetada, um valor
  de RESERVA no CSS (`var(--dc-fim, 100vh)`) e um bloco `md:` de desktop. O app
  da paciente já usa `svh`/`lvh` com a razão escrita.
- **`new Date("YYYY-MM-DD")`** — nenhuma ocorrência real; a única casada é um
  COMENTÁRIO explicando por que não se faz isso. A lição já pegou.
- **`console.log`** no app da paciente e na trilha: **zero**.
- **Segredo commitado: NENHUM.** Quatro arquivos casaram no padrão e os quatro
  são documentação ou validação — o texto que explica o formato da chave
  (`sk_live_…`) e um `includes("BEGIN PRIVATE KEY")` que confere um PEM colado
  pelo dono. ⚠️ **Casar padrão não é achar segredo**; conclui-se olhando cada um.
  E o `.env` está fora do versionamento.
- **A tela SEM CONEXÃO já oferece o 192 e o consultório em texto puro**, que
  funciona sem rede. É a pior cara possível do app e já foi pensada.
- **O ícone** usa o formato moderno de entrada única (1024×1024), aceito pelo
  Xcode.

### ⚠️ O que o projeto usa, e que quase todo tutorial erra

**SPM, não CocoaPods.** `ios/App/CapApp-SPM/Package.swift`; não existe `Podfile`.
Um `pod install` falha com um erro que parece grave e não é. `npx cap sync ios`
rodou aqui em 0,39 s e encontrou os seis plugins.

### O que ficou de fora, e por quê

- **Peso do pacote**: entrada em 277 kB comprimidos (react-dom, router,
  supabase, sonner, lucide — todos legítimos em quase toda página). O que
  sobra de verdade é o `minha-conta` com 122 kB, e ele é o item bloqueado na
  decisão do dono.
- **Painel do médico**: os `confirm` dele ficaram. É desktop, não vai para a
  loja, e proibi-los obrigaria a mexer em oito lugares para resolver zero.

### ⚠️ E EU INVENTEI TRÊS NOMES DE COLUNA no contador da Comunidade

Conferindo o meu próprio trabalho contra o schema, achei o defeito que esta
noite inteira passou consertando — cometido por mim, no código novo:

| escrevi                        | existe                           |
| ------------------------------ | -------------------------------- |
| `amizades.de_id` / `.para_id`  | `menor` / `maior` (par ordenado) |
| `amizades.estado`              | `aceita` (boolean)               |
| `companion_invites.revoked_at` | `expires_at`                     |

⚠️ **Nada teria acusado.** `tsc` não conhece o schema, o lint não olha string, e
o `.eq()` errado volta `42703` em tempo de execução: o contador viraria `null`,
e `null` — pela régua que eu mesmo acabara de escrever — **não desenha nada**. O
recurso ficaria invisível **sem nunca dar erro**.

⚠️ **E o conserto certo não era trocar os nomes: era não fazer a consulta.**
`idsDasAmigas` já existe e resolve os DOIS lados do grafo (indicação +
amizade aceita − encerradas), falhando fechada. Minha consulta a uma tabela só
daria um número MENOR do que a lista que ela encontra ao abrir a porta — e
emblema que não bate com a tela é pior que emblema nenhum.

### ⚠️ A catraca de colunas NÃO É CONSTRUÍVEL HOJE, e isso é um achado

Tentei automatizar a conferência. A fonte natural é `types.ts`, que é gerado do
banco. **Medido: ele conhece 27 tabelas de 112 e não sabe o que é
`doctor_id`.** Uma varredura sobre ele acusou **37 falsos positivos**, entre
eles `patient_profiles.doctor_id`, que o app inteiro usa.

⚠️ **Catraca com falso positivo é catraca que alguém desliga** — e aí ela deixa
de pegar o defeito de verdade. Preferi não ter a essa, e deixei escrito em
`tabelas-que-existem.test.ts` o que destrava: **regenerar o `types.ts`**
(`supabase gen types typescript`). Feito isso, a varredura vale a pena, e o
recorte certo é só `.eq("col", …)` colado num `.from("tabela")` — casar qualquer
coluna com qualquer tabela dá falso positivo em cascata.

Enquanto isso a defesa é humana: **conferir a coluna no `supabase/*.sql` antes
de escrever o filtro.** Foi assim que este erro foi achado.

⚠️ **Isto entra na lista de coisas para o dono:** o `types.ts` desatualizado não
é só um teste que não dá para escrever — é o autocompletar e a checagem de tipo
do Supabase valendo para um quarto do banco.

## O `@` e a `#` (ago/2026)

Pedido do dono, junto com o compartilhar e o vídeo/repost — e sobre as duas
decisões de política ele foi específico: **"Como o Instagram faz hj? Aplique
exatamente como ele faz"** (troca de apelido) e **"Faça exatamente como o
Instagram faz hj"** (quem pode marcar). Sobre a hashtag: **"Sim, só posts
públicos."**

Régua em `src/lib/mencoes.ts` (pura, 18 testes); servidor em
`mencoes.functions.ts`; tela no cartão "Seu @" das configurações, na legenda do
post e em `TelaDaTag`.

### A regra da troca é a do Instagram, conferida e não lembrada

Duas trocas por **14 dias**, e o apelido antigo fica **reservado por mais 14**
(`rede_handles_antigos`). A reserva não é cortesia: sem ela, trocar de `@`
**quebraria toda menção já publicada** — quem escreveu `@marina` ontem apontaria
para quem quer que tomasse o nome hoje. Por isso `perfilPorHandle` lê **duas**
tabelas: o apelido atual e, se não achar, a reserva ainda válida.

⚠️ **`_` É CURINGA NO `LIKE`, E `_` É LETRA VÁLIDA NUM `@`.** Sem escapar,
`@marina_c` casaria `marinaXc` e o toque na menção abriria o perfil de OUTRA
PESSOA. É o vazamento do e-mail da influenciadora de novo, aqui com mais chance
de acontecer, porque `_` é comum em apelido. Passa por `paraLike`, e a catraca
de `like-seguro.test.ts` cobra.

⚠️ **O `23505` aqui é RECUSA, não sucesso repetido** — ao contrário de
`rede_atividade`. Duas pacientes podem pedir `@marina` no mesmo segundo, e a
conferência de disponibilidade é uma LEITURA: entre ela e a gravação cabe a
outra. Quem decide é o índice único; uma segunda régua no cliente diria "livre"
sobre um apelido que o servidor recusaria.

### O texto vira link sem virar HTML

⚠️ **`TextoComLinks` NÃO usa `dangerouslySetInnerHTML`.** Legenda é texto de
terceiro; a única forma segura de destacar pedaços dela é quebrar em nós de
React.

⚠️ **O `@` recebe uma prop PRÓPRIA (`aoAbrirArroba`), e não `aoAbrirPerfil`.**
A primeira versão reaproveitava aquela, que espera um **uuid**: o toque numa
menção pediria o perfil de id `"marina"` e a tela responderia "indisponível" — a
menção existe, a pessoa existe, e o app diz que não.

⚠️ **E as duas entram em `acoes`, com referência estável.** Um fecho novo por
render faria o `memo` do cartão errar em TODO post do feed — e a legenda está em
cada um deles. É o defeito que já custou 232 ms por reação nesta lista.

### A `#` é grade, e só de post público

O recorte está na **consulta** (`postsDaTag`), antes de `montarPosts`, nunca num
filtro depois: um post de camada `amigas` aparecendo ali seria a porta dos
fundos da visibilidade. **E a régua é DITA na tela** — sem a frase, quem
publicou para as amigas conclui que a tag está quebrada, e quem publicou em
público não sabe que a foto virou vitrine aberta.

⚠️ **Grade e não feed.** Uma tag reúne desconhecidas por assunto; em formato de
feed, com legenda e reações à mostra, leria como "pessoas que eu sigo" — a
confusão que o rótulo "Sugerido para você" existe para impedir.

### ⚠️ O degrau do `@`, e o teste que o cobra

`handle` e `quem_pode_mencionar` nascem num `APLICAR_` que o dono roda à mão, e
**o deploy chega primeiro, sempre**. Sem degrau, o `42703` derruba
`perfisPorId` e `montarPosts` descarta todo post cujo autor não está no Map:
feed vazio, nenhum perfil abrindo, busca sem resultado. É o defeito de
`miniatura_path` inteiro. `semAColunaDoArroba` é o degrau 1,25, e todos os
degraus abaixo preenchem `handle: null` + o padrão da régua.

⚠️ **E o teste da escada quase virou mentira nas MINHAS mãos.** Escrevi
`CODIGO.includes("handle, ")` — e ele passava com ZERO degraus, porque
`handle, ` está escrito na própria `COLUNAS_DO_PERFIL` três linhas acima. Um
teste que casa a palavra em qualquer lugar do arquivo fica verde exatamente
quando a coluna nova é acrescentada sem degrau, que é o defeito que ele existe
para pegar. Hoje ele procura **dentro dos `replace(...)`**, e não é "um
`replace` por coluna": as duas nascem no mesmo SQL e saem juntas num recorte só.
Conferido por mutação (tirar o degrau → vermelho).

### ⚠️ A BANCADA DESENHAVA O CASO QUE NUNCA FALHA

A primeira verificação no navegador, com o recurso inteiro pronto, achou **zero
links na legenda** e **nenhum `@` no perfil**. Nada estava quebrado no app: a
bancada não passava `aoAbrirArroba`/`aoAbrirTag` e o perfil de exemplo não tinha
`handle` — então ela pintava texto puro e uma linha vazia, que são os dois
únicos estados que já eram certos.

É a irmã da regra que já estava escrita ("a bancada injeta o DADO nos mesmos
`useState` da produção"), agora valendo também para a FORMA das props — a mesma
lição que já tinha produzido uma medição de desempenho falsa.

**Medido depois:** os dois toques levam ao destino certo, `@marina.costa` e
`@carol.andrade` aparecem nos dois perfis, `Marina.C` vira `@marina.c` (a
normalização é do servidor), `obstetrica` é recusado como reservado com o botão
desabilitado, os quatro alvos têm 44px e o console fica limpo.

⚠️ **E o servidor de dev estava quebrado por `node_modules`, não por código**
("Yallist is not a constructor": `lru-cache@5` do Babel com o `yallist@5`
içado). Antes de investigar uma tela que não responde, leia o log do `vite` —
e confira em que porta ele subiu, que é a armadilha já registrada aqui.

**Aplicar:** `supabase/APLICAR_MENCOES_E_TAGS.sql`.
**Bancadas:** `/preview-rede` (o cartão "Seu @", as três opções de quem marca) ·
`/preview-instagram` (a legenda com `@` e `#` clicáveis) ·
`/preview-instagram?tela=tag&tag=trigemeas`.

## O direct ficou 100%, e ganhou o que o WhatsApp não tem (ago/2026)

Pedido do dono: _"como hoje está nossa interação de texto entre seguidores,
estilo nosso direct, temos que deixar isso 100%"_ e _"pensar em diferenciais de
por que eles conversariam aqui e não no Instagram ou no WhatsApp"_.

A auditoria achou **sete buracos**. O direct funcionava — abria, mandava,
apagava, avisava por push — e ainda assim não era um direct.

### ⚠️ 1. A CONVERSA NÃO SE ATUALIZAVA SOZINHA

`carregar()` rodava UMA vez, na montagem. Se a outra respondesse com a tela
aberta — que é o caso normal de uma conversa —, **nada aparecia**. A paciente
ficava olhando a própria mensagem sem saber se a amiga tinha lido, sumido ou se
o app tinha quebrado. Uma caixa de entrada que só mostra o passado não é
conversa.

⚠️ **É SONDAGEM, e não `realtime`, e a escolha é deliberada.** O canal ao vivo
do Supabase abre um WebSocket por conversa, exige **RLS de leitura em
`rede_mensagens`** — que essa tabela NÃO TEM de propósito, porque ali o texto é
o segredo inteiro — e morre em segundo plano no iOS sem avisar, deixando a tela
parada com cara de funcionando.

⚠️ **E ela PARA quando o app sai da frente** (`visibilitychange`). Sem isso, um
celular no bolso com a conversa aberta consultaria o servidor a noite inteira.
Ao voltar, busca IMEDIATAMENTE e só então retoma o ritmo — senão ela abre o app
e espera seis segundos olhando o estado velho.

⚠️ **`juntarMensagens` é o que impede a sondagem de ENCOLHER a conversa.** Ela
devolve só as últimas 50; sobrescrever apagaria as antigas que a paciente
carregou ao subir, e o trecho que ela estava lendo sumiria debaixo dela. A
versão NOVA de cada id vence — uma mensagem apagada pela outra volta como
`apagada: true`, e manter a antiga deixaria na tela o texto que ela apagou.

### ⚠️ 2. A RÉGUA CLÍNICA NÃO RODAVA NA MENSAGEM

O comentário passa por `triarTexto`. A caixinha passa. A mensagem direta — o
canal **mais íntimo** e o mais provável de carregar "no seu lugar eu esperava" —
não passava por nada. É exatamente o cenário dos 5,5% de respostas
potencialmente danosas.

⚠️ **E o desfecho aqui é DIFERENTE do do comentário.** Lá a régua RECUSA. Aqui
só a **emergência** é recusada: conversa privada entre duas adultas que se
escolheram não é um comentário público, e bloquear "toma chá de camomila" ali
seria o app censurando as duas. O que ele faz é mandar e **avisar quem
escreveu**. A recusa da emergência dá o caminho ("use o botão de emergência"),
nunca só o "não".

⚠️ **Falha ao TRIAR não impede a mensagem** — trocar um risco por uma avaria
certa seria pior.

### 3 a 7 — o resto do que faltava

- **✓✓** — `lida_a`/`lida_b` sempre existiram e alimentavam só o emblema; do
  lado de quem MANDOU não havia nada. ⚠️ Nunca na mensagem DELA: seria o app
  afirmando que EU li. ⚠️ E o mesmo instante conta como lida — com `>` estrito, a
  última mensagem de toda conversa ficaria eternamente sem ✓✓.
- **Foto** — balde `conversas` PRÓPRIO e privado (nunca o `rede`, cuja régua é
  `podeVerPost`), URL assinada de uma hora, e `fotoEhDeQuemMandou` conferindo a
  pasta. ⚠️ **NÃO corta em quadrado** como o avatar: a foto mais provável é uma
  ULTRASSOM em pé, e o recorte central comeria o bebê inteiro.
- **Paginação** — eram 50 e acabou; uma dupla que se escreve todo dia passa
  disso na primeira semana. ⚠️ Pede UMA a mais para saber se há mais, em vez de
  um `count: exact` que varre a tabela a cada abertura. ⚠️ E carregar o antigo
  **não rola para o fim**: a dependência era `mensagens.length`, que sobe nos
  dois casos e jogava a paciente fora do trecho que ela subiu para ler.
- **Silenciar** — ⚠️ e ele **desliga o push de verdade**: sem ler
  `colunaDoOutro("silenciada")` no envio, seria um interruptor decorativo, que é
  pior que não ter o botão. ⚠️ A coluna sai de `minhaColuna`/`colunaDoOutro`,
  nunca de um `? :` à mão — invertida, eu silencio o celular DELA.
- **Sair** — ESCONDE, nunca apaga: apagar as mensagens apagaria as dela junto. E
  a conversa **volta se a outra escrever** — quem quer que ela não escreva mais
  tem o bloqueio, que a folha oferece com o nome certo.

### Os três diferenciais, escolhidos pelo dono

**1. "Estão na mesma fase que você"** (`conversa-sugerida.ts`) — é a única coisa
que este app sabe e que o WhatsApp e o Instagram não têm como saber.

⚠️ **A FASE, NUNCA A SEMANA**, e por duas razões: semana é dado clínico
governado por `mostrar_semana`, e emparelhar por semana exata cria uma coorte de
poucas pessoas onde **a ausência vira informação** — quem some da semana 31
sumiu por um motivo adivinhável.

⚠️ **Engajamento não é sinal — nenhum.** A mesma proibição de `sugestoes.ts`:
numa base de alto risco, o post que mais engaja é o da EMERGÊNCIA.

⚠️ **`doctor_id` nunca vira grafo social** — seria usar o prontuário para
sugerir amizade.

⚠️ **Mínimo de DUAS candidatas.** Com uma, a fileira deixa de ser sobre a fase e
vira identificação.

⚠️ **A assinatura de `bloqueadas` é `{ has }`, e não `ReadonlySet`** — o
`ConjuntoDeBloqueio` do app FALHA FECHADO, e exigir um `Set` obrigaria uma
conversão que perde exatamente essa propriedade.

**2. A conversa que nasce do app** — responder ao story (a origem nº 1 de DM no
modelo, e ela não existia: o direct só nascia pelo botão do PERFIL, ou seja, ela
precisava decidir escrever ANTES de ter assunto) e mandar uma publicação.

⚠️ **A folha de mandar só oferece conversas que JÁ EXISTEM.** Uma busca ali
abriria um segundo caminho para escrever a desconhecidas, contornando a trava de
pedido pela porta mais inocente do app.

⚠️ **E o anexo NÃO amplia a visibilidade**: quem abrir passa por `postQueEuVejo`
como em qualquer lugar. ⚠️ O anexo é um CARTÃO, não o conteúdo — um story vive
24 h, e desenhá-lo deixaria um buraco na conversa no dia seguinte. Só o POST
abre; o story não, porque o id deixa de resolver.

**3. Foto na conversa** — ver acima.

### ⚠️ Dois testes MEUS travavam implementação, e os dois reprovavam código melhor

- `expect(trecho).toContain("if (aceitaAgora)")` ficou vermelho no dia em que a
  guarda virou `if (aceitaAgora && !outroSilenciou)` — **estritamente mais
  forte**. Hoje ele cobra o portão por regex.
- `expect(juntarMensagens([], novas)).toBe(novas)` cobrava a IDENTIDADE do array
  e reprovava a versão sem o atalho, que é comportamentalmente idêntica.

Um teste que reprova código igualmente correto é um teste que ensina a
relaxá-lo — e é assim que ele começa a mentir.

⚠️ **E a mutação achou duas travas novas SEM TESTE NENHUM** (a pasta da foto e a
recusa da emergência), no mesmo commit que as criou. As duas ganharam cobertura,
com o corpo de `enviarMensagem` recortado e **sem os comentários** — a prosa
deste arquivo cita o que ele proíbe.

⚠️ **Uma armadilha de substring no meu próprio script**: `minhaColuna` casou
dentro de `minhaColunaDeLeitura` e o import saiu faltando. Mesma família do
`bloquear`/`bloquearPeriodo` da catraca de portas.

**Aplicar no Supabase:** `supabase/APLICAR_DIRECT_COMPLETO.sql` (idempotente).
Sem ele nada quebra — todo caminho novo tem degrau de recuo, inclusive
`minhaConversa`, que é a porta de TODAS as outras funções.

**Bancadas:** `/preview-instagram?tela=conversa` (✓✓, foto, anexo, ⋯) ·
`?tela=conversas` (a fileira da mesma fase) · `?tela=conversas&sugeridas=0` ·
`?tela=mandar` · `?tela=mandar&vazio=1`.

### ⚠️ O `tsc` LOCAL NÃO É O `tsc` DA CI

O portão local passou verde e a CI reprovou:
`TS2339: Property 'toMatchObject' does not exist on type 'Matchers'`.

`toMatchObject` **não é tipado no `bun:test`** — e isso já estava escrito em
`lacunas-parecidas.test.ts`, com a razão ao lado. Eu o reintroduzi num arquivo
novo, e o `tsc` daqui não reclamou porque resolve o mesmo nome de tipo
(`Matchers`) a partir de **`playwright/types/test.d.ts`**, que vive no
`node_modules` de desenvolvimento e não existe do mesmo jeito na instalação
limpa da CI.

É o pior caso possível de portão: **verde onde eu olho, vermelho onde importa.**
Da mesma família do `node_modules` remendado que quebrou o `vite` nesta sessão
(`Yallist is not a constructor`).

**`src/lib/matchers-do-bun.test.ts`** é a catraca: varre todo `*.test.ts(x)` do
`src/`, tira os comentários antes de procurar (os dois arquivos CITAM o nome
proibido para explicar a regra) e falha em segundos no `bun test`, que é o
portão que eu de fato rodo. Conferida por mutação.

⚠️ **Se o `bun:test` um dia tipar um destes, TIRE-O da lista** — nunca relaxe a
asserção. Catraca que proíbe o que já é permitido é catraca que a próxima pessoa
aprende a contornar.

## As cinco da noite: responder, curtir, restringir, filtrar e descrever (ago/2026)

Pedido do dono depois do inventário da aba: aplicar as cinco que faltavam, e
auditar a Comunidade inteira. Duas são de conversa, três são de controle.

**Aplicar:** `supabase/APLICAR_COMENTARIOS_E_LIMITES.sql` (idempotente).

### 1 e 2 · O comentário virou conversa

Era uma lista PLANA. Com três pessoas comentando num post sobre um susto e a
autora respondendo, ninguém sabia a quem cada resposta se dirigia — e conversa
cruzada num assunto sensível é o que gera mal-entendido.

⚠️ **UM NÍVEL SÓ, e a trava é do SERVIDOR.** `raizDoComentario` puxa a resposta
de uma resposta de volta para a raiz. A coluna aceita qualquer uuid: um pedido
montado à mão criaria o segundo nível, e a tela — que só desenha raiz e filha —
deixaria essa resposta ÓRFÃ: gravada, contada, e invisível para todo mundo.
Árvore infinita num celular de 393px tem 40px de largura no quarto nível.

⚠️ **E o alvo tem de ser do MESMO post.** Sem a conferência, responder a um
comentário de outro post gravaria uma resposta que aparece numa conversa onde
ela não faz sentido — e o texto dela vazaria para quem vê aquele outro post.

⚠️ **A resposta órfã ENTRA como raiz, nunca some.** Se a raiz foi apagada ou
escondida por restrição, a resposta continua existindo; descartá-la faria um
comentário gravado desaparecer sem nada explicando.

**A curtida é como a autora agradece dez comentários sem escrever dez
respostas.** Sem ela, ou responde a todos ou ignora todos — e no segundo caso a
comunidade esfria. ⚠️ **UM tipo só**, contra os treze do post: treze emojis
embaixo de cada comentário viraria uma parede, e o comentário JÁ É a resposta com
nuance. ⚠️ A PK garante uma por pessoa; `23505` é sucesso repetido. ⚠️ O número
só aparece a partir de 1 — um "0" ao lado de todo comentário transforma a
conversa num placar de quem foi ignorada.

### 3 · Restringir — o degrau que faltava entre silenciar e bloquear

⚠️ **EXISTE POR UM MOTIVO SOCIAL, não técnico:** bloquear a cunhada tem custo —
ela descobre, e vira briga de família. Numa comunidade onde as pessoas se
conhecem da vida real, é esse custo que faz a paciente não usar o bloqueio e
continuar recebendo o que a machuca.

⚠️ **A ORDEM DE `verDoComentario` É O RECURSO INTEIRO.** A checagem de autoria
vem PRIMEIRO: quem foi restringida continua vendo o próprio comentário
exatamente como antes. Com ela depois, a pessoa escreveria, o comentário sumiria
da tela dela, e ela descobriria na hora — restringir viraria um bloqueio
anunciado.

⚠️ **A DONA DO POST VÊ, MARCADO.** Esconder dela seria pior que não ter o
recurso: um comentário que ninguém lê e nem ela sabe que existe é um canal cego.

⚠️ **E a leitura da restrição falha ABERTA — a exceção que precisa ser dita.**
No bloqueio, falhar fechado é o lado seguro. Aqui, "fechado" esconderia
comentários de gente que ninguém restringiu, e a dona veria a conversa dela
encolher sem motivo visível.

### 4 · O filtro de palavras

⚠️ **CASA PALAVRA INTEIRA, e é isso que faz o recurso servir.** Com `includes`,
esconder "parto" esconderia "departamento"; "mal" esconderia "mala", "malha",
"animal". Ela veria comentários sumindo sem entender e desligaria o filtro — o
mesmo que não tê-lo, só que depois de ter confiado nele. A tela DIZ a régua.

⚠️ **A palavra que dói é ESPECÍFICA de cada uma**, e por isso o app NÃO sugere
palavras: para uma é "perdi", para outra é o nome de um hospital. Sugerir seria
o app escrevendo na tela dela justamente o que ela está tentando não ler.

⚠️ **ESCONDE, NUNCA APAGA**, e vale para a tela DELA — a mesma linha some para
uma e aparece para outra. ⚠️ A expressão com espaço casa como FRASE. ⚠️ O
caractere especial é escapado: sem isso, um "(" derruba a construção da
expressão e o filtro inteiro para em silêncio, dentro de um laço.

⚠️ **A faixa das marcas combinantes vai por ESCAPE (`̀-ͯ`), nunca com
os caracteres literais** — elas são invisíveis no editor, e quem reformatar o
arquivo pode apagá-las sem ver.

### 5 · A descrição da foto

⚠️ **`alt` NUNCA VAZIO.** `alt=""` faz o leitor de tela PULAR a imagem: quem
navega assim nem saberia que existe uma publicação com foto ali. Sem descrição,
entra o genérico com o nome de quem publicou — que é pouco, mas é verdade.

⚠️ **Recolhido e só com FOTO.** Um segundo campo aberto entre a foto e o botão
faria parte das pacientes achar que precisa preencher os dois; e vídeo não tem
`alt`, então oferecer o campo ali prometeria o que o elemento não entrega.

⚠️ **Uma coluna, não uma por foto do carrossel.** A descrição vale a PUBLICAÇÃO;
o `alt` de cada imagem repete a frase com "foto 2 de 3".

### ⚠️ Duas lições de método desta rodada

**O `ComentarioNaTela` que eu quase duplicei.** Escrevi o tipo em
`comentarios.ts` sem conferir — ele já existia em `comentarios.functions.ts`.
Dois tipos com o mesmo nome é a segunda régua que este projeto proíbe desde
`podeVerPost`, e aqui a divergência apareceria como campo que a tela lê e o
servidor nunca manda.

⚠️ **E EU ACUSEI UM DEFEITO QUE NÃO EXISTIA.** Procurei
`setConfirmandoBloqueio(true)`, não achei, e conclui que o painel de segurança
(bloquear, silenciar, denunciar, restringir) era inalcançável. O botão `⋯`
existe e usa a **forma funcional** `setConfirmandoBloqueio((v) => !v)`. Grep de
chamada literal não prova ausência de chamador — foi o navegador que corrigiu,
como sempre.

**Bancadas:** `/preview-instagram?tela=comentarios` (a conversa, o coração, "ver
mais", as duas marcas de oculto) · `?tela=filtro` e `?tela=filtro&vazio=1` ·
`?tela=perfil` → `⋯` (restringir) · `?tela=perfil&restrito=1` → `⋯` (o estado
ligado) · `?tela=novo&comFoto=1` (a descrição).

### A auditoria da aba, e os primeiros consertos (ago/2026)

Oito auditores em paralelo, cada um numa dimensão, com um cético tentando
REFUTAR cada achado. **50 candidatos brutos.** O que segue é o que sobreviveu à
verificação — e um que NÃO sobreviveu, registrado porque é instrutivo.

#### ⚠️ Quatro defeitos na régua clínica, e dois eram falsos POSITIVOS

Achados rodando `triarTexto` contra frases que uma gestante escreve de verdade —
não lendo o código.

1. **"se eu fosse você" passava inteira.** A regex tinha a pessoa trocada: só
   reconhecia "se fosse eu" e "se fosse comigo", e a forma mais comum em
   português era a que faltava.
   ⚠️ **E a primeira correção falhou pela metade**: com `\b` no fim, a forma COM
   acento continuava passando — `\b` do JavaScript é ASCII e não enxerga
   fronteira depois do `ê`. É a mesma armadilha que `temPalavraOculta` documenta
   em `comentarios.ts`, num arquivo diferente, no mesmo dia.
2. **O imperativo AFIRMATIVO passava.** A lista só tinha a negativa ("não tome").
   "Toma buscopan que resolve" saía publicável. ⚠️ O conserto EXIGE objeto de
   tratamento: sem isso, "toma um café comigo" iria para o consultório.
3. ⚠️ **O POST DE NASCIMENTO ERA RECUSADO.** `deu tudo certo` estava na lista de
   tranquilização anedótica — e é também, e sobretudo, a frase com que se
   anuncia um nascimento. O momento mais feliz da paciente, barrado com um
   recado que a acusa de dar conselho médico.
4. ⚠️ **Qualquer `N por N` virava EMERGÊNCIA.** O ramo do par solto não tinha
   faixa nenhuma: "marcamos o chá pra 12 por 10 pessoas" abria a Central. Esse é
   o falso positivo mais caro da régua — ela aprende que o alarme dispara por
   qualquer coisa e passa a ignorá-lo. Hoje há faixa (falada e escrita) e o par
   não pode ser seguido de palavra.

#### ⚠️ A MINA DO CHECK QUE SÓ EXPLODE NA SEGUNDA VEZ

Três `APLICAR_*.sql` reescrevem `rede_atividade_especie_check` com
`DROP CONSTRAINT` + `ADD CONSTRAINT`. As listas eram cumulativas, então rodar na
ordem certa deixava o banco correto.

Mas `APLICAR_REDE_SOCIAL.sql` é o que a documentação manda **RE-RODAR** sempre
que a rede ganha alguma coisa — e a lista dele estava congelada em seis
espécies. Re-rodar apagaria `comentou` e `mencionou`, e a partir daí toda linha
de atividade de comentário e de menção seria recusada pelo banco.

⚠️ **E EM SILÊNCIO:** `registrarAtividade` grava dentro de um `try/catch` que
engole — de propósito, porque um aviso não pode derrubar o comentário. A
paciente comentaria, o comentário apareceria, e a caixa ♡ da autora ficaria
vazia para sempre, sem erro em lugar nenhum.

**Toda lista passou a ser a COMPLETA**, e `especies-da-atividade.test.ts` cobra
isso nos dois sentidos (nenhuma menor, nenhuma com espécie que o app não grava,
e o `EspecieDeAviso` do TypeScript batendo com o SQL).

#### ⚠️ A FOTO DE UMA PACIENTE SOBRE A FALA DE OUTRA

`comentariosDoPost` montava as URLs dos avatares sobre a lista COMPLETA e as lia
pelo índice do `.map()` — que roda **depois** do `.filter()` do bloqueio.
`.filter()` devolve array NOVO: um comentário removido desloca todos os índices
seguintes, e o avatar de quem ela bloqueou aparece no comentário de baixo.

⚠️ **E ficou pior com o filtro novo**, porque `verDoComentario` também remove
linhas. Hoje a URL é indexada por AUTOR.

⚠️ **Os outros três leitores da rede estavam certos**, e a razão é fina: eles
usam `forEach` com `return` cedo, e o índice do `forEach` **não se move** quando
uma volta sai. Só a cadeia `.filter().map((x, i))` desalinha —
`avatar-por-indice.test.ts` proíbe a cadeia inteira nos módulos da rede.

#### ⚠️⚠️ EU DECLAREI UM VAZAMENTO REAL COMO "FALSO", E ELE ERA VERDADEIRO

Um auditor afirmou, com gravidade ALTA, que "a republicação contorna a camada do
post: perfil privado vira público pelo repost". Eu li o código, encontrei
`visibilidade === "publico"` nos dois caminhos — escrita e leitura —, **declarei
o achado falso e escrevi isso aqui.**

**Estava errado, e o vazamento era real.**

A régua é `autor.publico || sigoAtivo || somosAmigas`. Um post da camada
`publico` publicado por um **perfil PRIVADO** alcança só quem segue — e o perfil
**nasce privado** (`PERFIL_PUBLICO_PADRAO = false`). A camada estava conferida;
o PERFIL não. O quadro do repost entregava o texto, a foto assinada e o NOME da
autora a toda pessoa que visse o post de quem republicou, inclusive estranhas
que ela nunca aceitou.

⚠️ **E `a?.care_mode` FALHAVA ABERTO**: com `a` indefinido (o perfil da autora
não veio na leitura), `undefined` é falsy e o conteúdo era montado. O resto do
arquivo falha FECHADO (`if (!a) return false` na régua principal); ali a exceção
era silenciosa.

**A lição não é sobre o repost.** É que **conferir metade de uma régua e dizer
"está coberto" é como um vazamento sobrevive a uma auditoria** — e foi a minha
conferência parcial, não a do auditor, que quase deixou isso passar. O
comentário que estava ali prometia por escrito a checagem que não existia; eu li
o comentário e o `visibilidade`, e parei.

Hoje as duas pontas conferem `perfil_publico` **e** `care_mode`, e há teste com
mutação para cada uma. A ponta da ESCRITA precisou de duas voltas: a primeira
asserção procurava `perfil_publico` no trecho e o `select` que traz a coluna já
a continha — trocar o termo da condição por `true` passava verde.

#### E quatro achados que de fato NÃO sobreviveram

Fica registrado porque é o motivo de a fase de refutação existir: **quatro dos
primeiros dezesseis verificados foram descartados**, e aplicar os 50 sem
verificar teria "consertado" comportamento correto. O saldo da rodada: 50
candidatos, 24 confirmados, 8 sem verificação (a sessão dos agentes esbarrou no
limite antes de terminá-los).

#### Mais cinco confirmados, e um deles vazava FOTO

**⚠️ A CAPA DA ATIVIDADE ERA ENTREGUE SEM RÉGUA DE VISIBILIDADE.** O bloco que
monta as capas em `minhaAtividade` filtrava só por `arquivado_em IS NULL`. Quem
fosse MENCIONADA num post da camada `amigas` recebia a linha na caixa ♡ **com a
imagem**, sem poder abrir o post.

⚠️ **E a imagem era a de 1080**, não um recorte: o caminho é
`miniatura_path ?? imagem_path`, e publicação anterior ao recurso de miniatura
não tem a primeira. O que vazava era a foto inteira.

O conserto é `podeVerPost` por post — a régua ÚNICA, com o contexto de quem
pergunta. Um filtro em SQL aqui seria a segunda versão dela.

**⚠️ E o outro lado do mesmo defeito:** `avisarMencionadas` nunca conferia a
visibilidade do post. Agora confere, **com o contexto DA MENCIONADA** — a
pergunta é "ela pode ver?", e responder com o contexto de quem escreveu seria
responder outra pergunta.

**⚠️ `postsDaTag` tinha a SEXTA cópia de `COLUNAS_DO_POST`, e ela já divergira.**
Faltava `alt_texto` — o defeito que o comentário de `COLUNAS_DO_POST` descreve
("acrescentar uma coluna significava lembrar das cinco") acontecendo de novo, num
arquivo novo. Sem degrau e descartando o `error`: num banco sem alguma das
colunas, a página da tag ficava VAZIA em silêncio. A causa era banal —
`postsCrus` era privada, então quem precisou dela copiou o `select`. Passou a ser
exportada.

**⚠️ A PRÉVIA DA CONVERSA ERA UMA LINHA EM BRANCO, e o defeito era MEU.** O
select da última mensagem não trazia `imagem_path` nem `ref_tipo`, então toda
mensagem que é só foto ou só anexo caía em `""`: a linha saía com avatar, nome,
hora e nada no meio. `previaDaMensagem` já sabia responder "📷 Foto" desde o
primeiro dia — o parâmetro `carrega` existia, o único chamador de produção não o
passava, e **a suíte ficava verde sobre um ramo que só os testes exercitavam.**

**⚠️ `publicarPost` tinha UM degrau, e ele pulava direto ao mínimo.** As colunas
do INSERT vêm de QUATRO `APLICAR_` diferentes. Num banco que rodou três dos
quatro, uma coluna faltando derrubava todas as outras: a enquete que ela acabou
de montar, o vídeo que ela subiu e o marco do bebê sumiam da publicação, em
silêncio. Agora desce **uma camada por vez**, da mais nova para a mais velha —
que é o desenho que `publicarStory` já tinha, com o comentário certo ao lado.

#### ⚠️ E OUTRO TESTE MEU REPROVAVA CÓDIGO MELHOR

`expect(recuo).not.toContain("comparacao_de")` era verdade com o degrau único e
ficou vermelho sobre a correção. É o **terceiro** desta leva (os outros dois
foram `if (aceitaAgora)` e o `toBe` da junção de mensagens).

O padrão é sempre o mesmo: a asserção descreve **como** o código está escrito em
vez de **o que** ele garante, e então qualquer melhoria a quebra. Hoje ele cobra
a intenção — existe um piso mínimo com as fotos, o carimbo não está nele, e o
recuo cita as quatro origens de coluna.

#### Mais três: a bio sem régua, o `memo` que nunca acertava, e o lint

**⚠️ A BIO ERA O ÚNICO TEXTO LIVRE SEM A RÉGUA CLÍNICA — e é o que vai mais
longe.** Post, story, comentário, caixinha e opção de enquete passam por
`triarTexto`. A bio não passava por nada, e ela aparece na vitrine
`/p/<codigo>`, que abre **na internet aberta, sem conta nenhuma**.

Medido: `triarTexto("Sangrei na 12s e não fui no PS, passou sozinho 💛")` devolve
`clinica`. A mesma frase que `publicarPost` RECUSA, a bio gravava — e a publicava
fora do app, com o nome do consultório em volta.

⚠️ **RECUSA, e não "manda e avisa"**: é a decisão do comentário público, não a da
mensagem privada — a bio é vitrine permanente, lida por quem nunca conversou com
ela. ⚠️ **Só quando a bio MUDA**, senão trocar a FOTO ficaria impossível para
quem escreveu algo antes desta trava existir. ⚠️ **E as duas telas mostram o
recado**: um `false` mudo faz o botão de salvar não fazer nada.

**⚠️ O `memo` DO FEED NUNCA ACERTAVA, e é a lentidão que o dono relatou.**
`republicar`, `compartilhar` e `verStory` são declarações de função no corpo de
`RedeNoApp` — identidade nova a cada pintura — e eram passadas a `TelaPrincipal`
FORA do objeto estável. `PostInstagram` e `FileiraDeStories` são `memo` sem
comparador: uma prop com identidade nova basta para a comparação rasa falhar, e
ela falhava em TODO cartão, a cada render. As três entraram em `acoes`.
**Medido depois: 24 ms para responder ao toque, com a CPU estrangulada em 6×.**

⚠️ **E EU QUEBREI O LINT NO COMMIT ANTERIOR** (`prefer-const` num `let` que o
recuo não reatribuía). A primeira correção foi pior que o defeito: eu troquei o
`let` por um objeto falso que deixava `erroMsgs` sempre nulo — **o recuo nunca
dispararia.** Um lint verde sobre lógica quebrada é o pior desfecho possível.
Hoje é `const comCorpo = await …` e um ternário.

#### ⚠️ "NÃO CARREGOU" TINHA A CARA DE "NÃO HÁ NADA"

`ContextoDaRede.degradado` nasceu com o contrato escrito no próprio tipo —
_"quem lê isto devolve ERRO, e nunca a tela de 'não há nada'"_ — e **nenhum dos
28 chamadores lia o campo.**

Com a leitura de bloqueio ou de amizade falhando, `conjuntoDeBloqueio` responde
"bloqueado" para todo mundo (falha fechada, correta), o recorte do feed colapsa
para `[eu]`, a consulta volta `ok: true` — e a tela pintava
"Ainda não há nada por aqui 💛", **com o convite embaixo**. Ou seja: o app
mandava a paciente trazer uma amiga por causa de uma falha de rede.

⚠️ **A BUSCA ERA O PIOR CASO**, porque o vazio dela EXPLICA um motivo errado
("só aparece quem deixou o perfil público"): a paciente concluiria que a irmã
fechou o perfil quando o que houve foi um timeout.

É o mesmo defeito de `parcial: true`, que este projeto já registrou entre os
dezoito da auditoria anterior — campo escrito, documentado, sem leitor.

Hoje `meuFeed`, `sugestoesDoFeed` e `buscarPerfis` devolvem `motivo: "instavel"`,
e a tela tem estado próprio: a frase certa e um **"Tentar de novo"**.

⚠️ **E as props precisaram ser LIGADAS no ponto de uso** — a mesma falta que a
auditoria achou em `aoEditar` e nas três ações da tela do post. Sem isso eu teria
trocado um vazio silencioso por outro.

**Bancada:** `/preview-instagram?vazio=1&sugeridas=0&instavel=1`. O estado só
nasce de uma falha de leitura no servidor, que não se fabrica numa conta de
teste — sem a bancada ele ficaria sem ninguém nunca ter olhado, que é como ele
nasceu.

⚠️ E um lembrete de método que já custou uma volta hoje: **clique antes da
hidratação se perde em silêncio.** A primeira verificação deste botão registrou
"nenhum alerta" e o botão estava certo — faltava esperar o `waitForSelector`
mais ~1,2 s.

#### O chá de bebê ganhou o convite, e dois testes pararam de mentir

**⚠️ TÍTULO, RECADO E DATA DA LISTA EXISTIAM E NÃO TINHAM PORTA.** `salvarItens`
aceitava os três, o handler os gravava, `minhaLista` os devolvia — e o único
chamador mandava só `itens`. A lista abria com o texto padrão para todo mundo, e
a página que a amiga recebe é justamente onde essas três informações fazem o
convite parecer um convite.

⚠️ **`itens` virou OPCIONAL no servidor**, e isso separa os dois assuntos:
ausente = "não mexi na lista". Com ele obrigatório, salvar o convite obrigaria a
tela a reenviar a lista inteira, e qualquer diferença de forma apagaria itens que
ninguém pediu para apagar.

⚠️ **E `type="date"`**, nunca texto — a coluna é `date`, e campo livre de data já
custou três horas nesta base (`confirmed_time` aceitando "manhã").

**⚠️ E EU REINTRODUZI A ARMADILHA DO ARTIGO, na mesma rodada em que reli a
regra.** O exemplo do campo saiu como **"Chá de bebê do Helena"** — medido no
navegador. Escolhi "o"/"a" pela PRIMEIRA LETRA, e inicial não é sinal de gênero
em português; `baby_name` não carrega gênero nenhum.

É a **terceira** aparição: o bolão ("Quando o Helena nasce?"), o agradecimento do
chá, e agora o título da lista. `artigo-do-nome.test.ts` é a catraca — e ela
precisou de duas voltas, porque o primeiro padrão casava `` `dc-path-day-d${D}` ``
da trilha. **Catraca que reprova código correto é catraca que a próxima pessoa
desliga.**

**Dois testes que mentiam:**

- ⚠️ **"não existe comentário em lugar nenhum"** — o nome afirmava isso e o
  escopo era UM arquivo. Os comentários entraram no produto por decisão do dono,
  com régua clínica própria; o teste seguia verde por acidente da separação de
  módulos. Um teste verde afirmando o contrário do produto é pior que nenhum.
  Virou a afirmação verdadeira ("este arquivo não conhece comentário") mais a
  contraprova.
- ⚠️ **O `return` da primeira pintura do rascunho** era prometido no comentário e
  nunca asserido: apagando a linha, as três asserções continuavam verdadeiras e o
  rascunho guardado era apagado ao abrir o compositor. Hoje a guarda inteira é
  cobrada por regex, com mutação verificada.

#### ⚠️ Os alvos de toque: o ‹ media 8 PIXELS de largura

A auditoria apontou três; medidos no navegador, eram piores e havia mais. Todos
dentro da aba, com o rodapé e a navbar do site fora da conta (têm régua própria).

| controle                  | media           | onde       |
| ------------------------- | --------------- | ---------- |
| **‹ Voltar**              | **8×20 / 8×28** | seis telas |
| **Republicar**            | **13×15**       | feed       |
| Salvar / Tirar dos salvos | 22×22           | feed, post |
| **⋯ do perfil**           | **26×18**       | perfil     |
| Ver quem reagiu           | 37×22           | feed       |
| ⋯ da publicação           | 36×44           | feed       |
| ⋯ da pergunta             | 41×33           | caixinha   |

⚠️ **O ‹ é o controle mais usado da aba, e era o menor.** Sem caixa, o botão mede
o GLIFO — e "‹" é um caractere estreito. O padrão certo já existia no mesmo
arquivo (`flex h-11 w-11 items-center justify-center`); ele só não tinha sido
aplicado nas telas que nasceram depois.

⚠️ **E o ⋯ do perfil é a porta ÚNICA de bloquear, silenciar, restringir e
denunciar** — os quatro controles de segurança da aba, atrás de um alvo de
26×18.

⚠️ **`-ml-2` COMPENSA o padding**, senão o desenho anda para dentro da tela: o
alvo cresce, o glifo fica onde estava.

**O que NÃO foi mexido, e por quê:** botões de largura total com 36–40px de
altura (`Sim`/`Não`, `Seguindo`, `Publicar`) e nomes clicáveis inline. Os
primeiros são a convenção do app inteiro — mudá-los é uma revisão de design, não
um conserto; os segundos são links de texto dentro de um parágrafo, e esticá-los
quebraria o cartão. Ficam registrados para o dono decidir.

#### ⚠️ O interruptor "Só quem eu sigo" fazia o OPOSTO do que promete

A condição estava invertida: `soSeguindo === false ? false : sugestoes.length > 0`.
Com o feed MISTURADO a zona de sugeridas sumia (certo — elas já foram costuradas
no meio); com a chave **LIGADA**, ela aparecia no rodapé.

O caminho é o normal: ela abre a aba no modo misturado (as sugestões são
buscadas), liga a chave, o feed principal para de interlaçar — e as publicações
de desconhecidas, que já estavam em estado, **reaparecem todas juntas embaixo**.
O interruptor tornava as estranhas MAIS visíveis.

E a tela promete por escrito: _"Seu feed mostra apenas quem você segue."_

⚠️ **A fileira de PESSOAS fica**, e a distinção é a do próprio texto: ela é
descoberta de gente para seguir, não conteúdo do feed. Sem ela, quem ligou a
chave nunca teria como fazer o feed fechado ter conteúdo.

⚠️ **E a bancada nunca desenhou o estado LIGADO — foi por isso que a inversão
sobreviveu.** `?fechado=1` existe agora. Medido: misturado mostra 3 rótulos
"Sugerido para você"; fechado mostra **zero**.

**E as datas da bancada voltaram a ser cravadas.** Quatro `Date.now()` /
`new Date()` rodavam no RENDER de `preview-instagram` — servidor e cliente
calculam instantes diferentes, e o texto derivado ("há 34 dias") diverge na
virada do minuto: o React descarta a árvore. O cabeçalho do próprio arquivo
declara a regra três seções acima ("datas cravadas, nunca `Date.now()`"). É a
mesma família do mismatch que já derrubou o app inteiro.

#### ⚠️ A BATERIA DE 40 FRASES achou o que os testes pontuais não pegaram

Depois de consertar os quatro defeitos da régua clínica, rodei-a contra **40
frases que uma gestante brasileira escreveria de verdade** — posts de
nascimento, chá de bebê, dúvidas comuns, desabafos, conselho perigoso
disfarçado, pressão em números, medidas de móveis, preços, horários.

Zero falsos positivos. **Um falso negativo: `"deu 15 por 10 agora"` saía
publicável.**

A trava que eu tinha escrito exigia que o par de números **terminasse ali**
(`(?!\s*[a-zà-ÿ])`) — e quem relata pressão quase sempre põe uma palavra de
tempo depois: "agora", "hoje", "de manhã". Quem escreve QUANTIDADE é que põe o
substantivo: "12 por 10 pessoas", "3 por 2 na farmácia".

Hoje o que desqualifica é uma **lista curta de substantivos de quantidade**
(`NAO_E_QUANTIDADE`), e não "ter palavra depois". Errar para o lado de rotear
uma quantidade é muito mais barato que deixar passar 16 por 11.

**A lição de método:** régua de texto se prova em VOLUME, contra frases reais.
Um teste por regra pega o caso que o autor imaginou; quarenta frases pegam o que
ele não imaginou. A bateria virou teste permanente, nas duas direções — e a de
falso POSITIVO importa mais, porque o custo dela é a paciente aprender que o
alarme deste app não vale leitura.

#### ⚠️ A revisão do MEU PRÓPRIO conserto achou quatro defeitos nele

Uma segunda leva de agentes revisou adversarialmente as 3.664 linhas escritas
nesta noite. Na régua clínica — que eu tinha acabado de "consertar" e coberto com
uma bateria de 40 frases — havia **mais quatro**:

1. ⚠️ **"faz um chá de bebê pra mim" era RECUSADO como conduta clínica.** O
   imperativo novo usava `chá de \w+`, e `\w+` casa "bebê". Eu recusei **o nome
   de um recurso inteiro deste app**. Virou lista fechada de chás com efeito
   obstétrico.
2. ⚠️ **"o berço é 130 por 70" abria a Central de Emergência.** O par cai dentro
   da faixa plausível de pressão, e a lista de quantidade não ajuda quando não há
   unidade. Móvel, quadro e tapete têm nome ANTES da medida; pressão não tem —
   entrou um lookbehind com janela larga. ⚠️ **A primeira tentativa usou
   `\s{1,3}` e não cobria "o berço **é** 130 por 70"**; a segunda não chegou a
   entrar na expressão, e só o `.source` compilado mostrou isso. Ler o regex
   FONTE, e não o código que o monta.
3. ⚠️ **"tomei buscopan e resolveu" passava inteiro.** Eu cobri o imperativo
   ("toma") e esqueci o PASSADO em primeira pessoa — que é a forma **mais**
   persuasiva, e exatamente o padrão dos 20,9% de conselho errado.
4. ⚠️ **Tirar "deu tudo certo" abriu buraco:** "comigo deu tudo certo" — a
   tranquilização sobre o risco alheio — passou a sair publicável. Ela voltou
   **com o enquadramento anedótico colado** ("comigo"/"no meu caso"), e o post de
   nascimento, que não tem esse enquadramento, continua passando.

**A lição de método, e é a mais cara da noite:** _consertar sob teste próprio não
basta_. Eu tinha os quatro defeitos originais medidos, corrigidos e cobertos por
uma bateria de 40 frases — e ainda assim introduzi quatro novos, dois deles
falsos positivos sobre conversa banal. **Quem revisa o conserto não pode ser
quem o escreveu**, e é para isso que a fase adversarial existe.

#### E mais quatro defeitos MEUS, achados pela mesma revisão

**⚠️ A CAPA DA ATIVIDADE VOLTOU A MOSTRAR POST ARQUIVADO.** Ao mover o filtro do
`.is("arquivado_em", null)` para o `.filter()` — parte do conserto do vazamento
—, eu tirei a condição e **esqueci de pedir a coluna**. `x.arquivado_em` passou a
ler `undefined`, que é falsy, e todo post que ela tirou do ar voltou a mostrar a
foto na caixa ♡.

**Mover uma condição de camada obriga a mover o DADO junto.**

**⚠️ O QUADRO DO REPOST NÃO CONFERIA BLOQUEIO.** Ele checava arquivo,
visibilidade, Modo Cuidado e (depois do meu conserto) `perfil_publico` — e não o
bloqueio. Se uma TERCEIRA republicasse, o nome, o texto e a foto de quem ela
bloqueou voltavam para a tela dela. É o mesmo defeito que a marcação já teve, e
que o CLAUDE.md registra: _"bloquear não pode ser uma proteção que a marcação de
outra pessoa desfaz"_.

**⚠️ `altTexto` ERA ACEITO NO VALIDADOR DE `editarPost` E NUNCA GRAVADO.** A tela
mandava, o `zod` aceitava, o `update` não o carregava: ela corrigia a descrição,
via "salvo", e o leitor de tela continuava lendo a antiga. **Campo aceito e
descartado é pior que campo ausente** — ausente a tela não oferece; aceito, ela
promete.

**⚠️ E o `altTexto` não passava pela régua clínica**, nem no publicar nem no
editar. É texto público lido em voz alta: sem isso, quem fosse recusada na
legenda escreveria a mesma frase ali.

#### ⚠️ Duas catracas do repo pegaram MINHAS edições — e as duas estavam certas

1. **A dívida de escritas sem checagem subiu de 6 para 7.** Não porque eu criei
   uma escrita insegura, mas porque meu reformato **afastou o `gravar(` da
   janela de oito linhas** do detector. A escrita sempre esteve checada; o que
   faltava era a checagem morar perto o bastante para se enxergar. O `error` foi
   nomeado DENTRO do helper — assim não depende de quantas linhas o chamador
   ocupa.
2. **Dois testes travavam listas literais** (`[data.texto ?? "", ...opcoes]` e
   `gravar({ texto`) e ficaram vermelhos sobre coberturas **estritamente
   maiores**. É o quarto e o quinto desta noite. Os dois passaram a cobrar o
   CONJUNTO em vez da string — e o segundo mudou de nome, porque "só o TEXTO
   muda" deixou de ser verdade quando a descrição da foto virou editável.

## As dez que faltavam na rede — direct, segurança, story, comentário e conta (ago/2026)

Pedido do dono: aplicar as dez que eu tinha levantado, e depois levantar e
aplicar outras dez. Estas são as primeiras dez.

**Aplicar no Supabase:** `supabase/APLICAR_DEZ_DA_REDE.sql` (idempotente).

⚠️ **TUDO POR `ALTER ... ADD COLUMN IF NOT EXISTS`, e nunca dentro de um
`CREATE TABLE IF NOT EXISTS`.** As tabelas já existem no banco do dono, e num
banco assim o `CREATE` é no-op: a coluna nova nunca nasce, e rodar de novo não
conserta. Foi exatamente assim que `carimbo_semana` passou a existir só no papel.

### 1 a 3 · O direct: responder, reagir, denunciar

- ⚠️ **A CITAÇÃO NÃO SE ANINHA — um nível só** (`alvoDaCitacao`). Responder a
  uma resposta cita a MESMA mensagem original. Numa tela de 393px a citação da
  citação vira uma faixa de 40px que ninguém lê. É a régua de `raizDoComentario`
  de novo, e a coluna é `ON DELETE SET NULL`: apagar a citada não pode levar
  junto a resposta de OUTRA pessoa.
- ⚠️ **Alvo inválido NÃO recusa a mensagem.** A citação é contexto, não
  conteúdo: derrubar o envio por causa dela seria perder o texto que ela
  escreveu. `respondeA` nasce `null` e só é preenchido quando o alvo confere —
  e ele tem de ser da MESMA conversa, senão o trecho de uma conversa privada de
  terceiros apareceria citado aqui.
- ⚠️ **SEIS reações, e não as treze do post.** Embaixo de uma publicação a
  reação é pública e escolhe o tom; numa conversa entre duas pessoas ela é um
  aceno, e treze opções transformam um aceno numa decisão. **Sem 😢 nem 😱** —
  a primeira lê como PENA, a segunda devolve pânico a quem está com medo.
- ⚠️ **A DENÚNCIA DO DIRECT era o buraco mais sério.** Post, comentário, perfil
  e caixinha já tinham; o canal mais privado, onde o assédio de verdade
  acontece, não tinha. Bloquear existe, mas **bloquear não deixa rastro nenhum
  para a plataforma**: a próxima paciente recebe a mesma coisa da mesma pessoa,
  e ninguém nunca soube. O trecho é congelado (500 caracteres) para a fila
  continuar sabendo o que foi denunciado se ela apagar depois.
- ⚠️ **Citação e reações são lidas EM LOTE**, fora do `.map()`: uma consulta por
  mensagem seriam cinquenta idas ao banco por página, na tela que a paciente
  abre mais que qualquer outra desta aba.

### 4 e 5 · Segurança: a lista de bloqueados e quem pode comentar

⚠️ **BLOQUEAR ERA UM BECO SEM SAÍDA.** Não havia nenhuma tela listando quem ela
bloqueou — e, por construção, essa pessoa está escondida dela em todo lugar.
Desbloquear era impossível sem lembrar o nome e achar o perfil por busca (que
também a esconde).

- ⚠️ **`meusBloqueados` usa `perfisPorId`, e NÃO a régua de visibilidade.** É a
  única leitura da aba que ignora o próprio bloqueio, e é de propósito.
- ⚠️ **Falha de leitura devolve ERRO, e nunca lista vazia.** "Você não bloqueou
  ninguém" faria ela concluir que o bloqueio não pegou — e bloquear de novo, ou
  desistir.
- **`ListaDeBloqueados` virou componente PRÓPRIO por causa da bancada.** Era a
  única tela de segurança da aba sem bancada, e os três estados que mais
  importam (falhou · carregando · ninguém) não se fabricam numa conta de teste.
  Ela não busca nada — recebe tudo por prop, como o alerta de SOS.

**Quem pode comentar** (`quem_comenta`): todos · seguidores · amigas.

- ⚠️ **NUNCA mais aberto que a visibilidade** (`apertarQuemComenta`). Um post
  `amigas` com "todo mundo comenta" é uma combinação sem sentido — as pessoas a
  quem "todo mundo" se refere não veem a publicação —, e oferecê-la faria a
  autora acreditar que abriu a conversa quando não abriu nada.
- ⚠️ **O padrão é `todos`**, o comportamento de hoje: fechar por padrão
  emudeceria as conversas já existentes sem ninguém ter pedido.
- ⚠️ **`possoComentar` vem do SERVIDOR.** Uma segunda régua na tela ofereceria o
  campo e o servidor recusaria depois de ela ter escrito — o defeito que
  "Responder" com os comentários fechados já teve aqui.

### 6 e 7 · O story: encaminhar, e silenciar separado

- ⚠️ **O ✈ do story é do DONO, e só.** Encaminhar o story de OUTRA pessoa
  entregaria a foto dela a quem ela não escolheu, passando por cima da camada de
  visibilidade que o story acabou de ganhar. O portão é o EMBRULHO
  `{souEu && atual && (…)}` do rodapé, e não uma condição na prop — quem passa
  `aoMandarStory` é a tela de fora, que não sabe de quem é o story aberto.
- **A folha de mandar é a MESMA do post** (`alvo: {tipo, id}`): duas folhas
  divergiriam no primeiro ajuste, e é ela que carrega a trava de só oferecer
  conversas que já existem.
- ⚠️ **Silenciar calava os DOIS de uma vez.** Quem quer descansar só dos stories
  — o formato mais frequente e mais invasivo — perdia as publicações junto, e
  acabava não silenciando ninguém. Hoje são `cala_posts` e `cala_stories`, e
  **as duas nascem `true`**, que é exatamente o comportamento atual: migrar para
  "só posts" mudaria o silêncio de quem já tinha escolhido.
- ⚠️ **O teste é `!== false`, e nunca `=== true`.** Num banco sem as colunas o
  valor é `undefined`, e `=== true` faria toda linha existente deixar de calar.
- ⚠️ **E o recuo AVISA** (`parcial`): se ela pediu para calar só os stories e o
  banco calou os dois, dizer "pronto" seria mentir sobre o alcance do próprio
  silêncio dela — ela concluiria que a amiga parou de publicar.
- ⚠️ **`ctx.silenciados` virou DOIS conjuntos**, e o feed de stories lê o dele.
  Um conjunto só faria a escolha existir no banco e não existir na tela.

### 8 e 9 · O comentário: fixar, e quem curtiu o meu

⚠️ **UM COMENTÁRIO FIXADO, e não três como o Instagram.** Lá o pin é curadoria
de uma grade; aqui a lista é uma CONVERSA, e três comentários grudados no topo
de uma tela de 393px empurram a conversa de verdade para fora da dobra. E há uma
razão que só existe neste app: **fixar é ENDOSSO** — num post sobre gestação, o
comentário que a autora põe no topo é o que as outras leem como "ela concorda
com isto", e este produto gastou a decisão de não ter comentário aberto por
causa dos 20,9% de conselho errado. Endossar uma coisa é escolha; endossar três
é distribuir o endosso.

- ⚠️ **SÓ RAIZ SE FIXA.** Fixar uma resposta a arrancaria da conversa a que
  responde: subiria ao topo sozinha, citando um comentário que ficou lá embaixo.
  E `ordenarComentariosComFixado` recusa subir uma resposta mesmo com a coluna
  preenchida — por uma versão anterior, ou por um pedido montado à mão.
- ⚠️ **Nem comentário ESCONDIDO se fixa.** Pôr no topo para todo mundo ler um
  texto que a régua acabou de esconder seria a dona do post desfazendo, sem
  saber, a restrição que ela mesma pôs.
- ⚠️ **DESAFIXA O ANTERIOR PRIMEIRO**, e a ordem é o oposto da do bloqueio: ali
  o intermediário ruim é meio bloqueio; aqui é DOIS fixados, e a tela mostraria
  dois topos. Limpando primeiro, uma falha deixa nenhum fixado — reversível com
  um toque. E a limpeza é recortada pelo POST: sem isso, fixar um comentário
  desafixaria os fixados de todas as publicações da plataforma.
- ⚠️ **E A TELA DESFAZIA A ORDEM DO SERVIDOR — só a FOTO pegou.** `comentariosDoPost`
  devolve o fixado na frente, e o `useMemo` das conversas reordenava tudo por
  `criadoEm`, jogando-o de volta ao lugar cronológico: o selo "Fixado" aparecia
  no meio da conversa e o recurso não funcionava. Nenhuma asserção estava perto
  disso, porque **cada metade estava certa sozinha**.
- ⚠️ **A lista de quem curtiu é de quem ESCREVEU o comentário, não da dona do
  post.** `quemReagiuAoPost` é da autora do post porque as reações são sobre a
  publicação dela; aqui as curtidas são sobre a frase de quem comentou. Dar a
  lista à dona do post transformaria a conversa embaixo das fotos dela num
  painel de quem apoia quem. E quem ela bloqueou não aparece — a curtida
  continua contando, porque o número é do comentário, não da lista.

### 10 · Pausar a conta — e a régua única que ela criou

⚠️ **O MEIO-TERMO QUE NÃO EXISTIA.** Havia apagar (a LGPD, irreversível) e o
Modo Cuidado, que é para o luto e vale no app inteiro. Faltava a coisa mais
comum: sumir da Comunidade por um tempo e voltar inteira.

- ⚠️ **NADA É APAGADO**, e a tela diz isso. Quem não tem certeza de que as fotos
  ficam não pausa — vai embora de vez, ou fica sem descansar.
- ⚠️ **A coluna é REVOGADA do `authenticated`.** `patient_profiles` é escrita
  direto do navegador com a chave anon em vários pontos do app; sem o `REVOKE`,
  um pedido montado à mão REATIVARIA a conta sem passar pelo servidor — e quem
  pausou por um motivo sério é justamente quem não pode ser reativada por
  acidente.
- ⚠️ **NINGUÉM É AVISADO**, e a tela diz isso também: sem a frase, ela pausa
  imaginando que a amiga vai receber "Fulana pausou" — e não pausa.
- ⚠️ **A FAIXA NO FEED É OBRIGATÓRIA.** A pausa esconde ela dos OUTROS, e o feed
  é o que ela vê: sem a faixa nada muda na tela dela, a conclusão razoável é que
  a pausa não pegou, e ela publica imaginando que está invisível. A faixa vem
  ANTES do desafio — ela muda o significado de tudo que vem abaixo.
- **Ela continua LENDO enquanto pausada, de propósito.** Cortar a leitura
  derrubaria conversas abertas com quem está apoiando ela, e é o mesmo desenho
  que o Modo Cuidado já tem: o que some é ela na rede dos outros, não a rede
  para ela.

#### ⚠️ `foraDaRede` — vinte e seis decisões viraram uma

`care_mode` (o luto) e `rede_pausada_em` (a pausa) produzem **exatamente o mesmo
efeito** nesta aba: o perfil não abre, os posts não aparecem, a busca não acha,
os stories somem. Eram vinte e seis pontos de decisão lendo `care_mode` solto —
**um `if` a mais em cada um é como um deles fica de fora e a pausa vaza por
ali.**

- ⚠️ **FALHA FECHADO, e é por isso que o `!perfil` mora dentro da função.** O
  pior caso é uma publicação não aparecer; o oposto é a publicação de quem
  acabou de perder a gestação aparecendo no feed de todo mundo por causa de um
  `undefined`.
- ⚠️ **E ELA VEM PRIMEIRO NA CORRENTE.** `foraDaRede(x) &&` curto-circuita antes
  de tocar em `x.perfil_publico`, que num `undefined` ESTOURA. Ao trocar
  `!!dono && !!dono.perfil_publico && !dono.care_mode` por uma função só, eu
  inverti a ordem e reintroduzi o estouro — **quem pegou foi o teste que existia
  para essa exata linha**.
- ⚠️ **O MOTIVO NUNCA VIAJA.** Quem chama recebe um booleano; a tela responde
  "indisponível" e nada mais. Contar a perda dela — ou o fato de ela ter pausado
  — é o app tomando por ela uma decisão que é dela. Por isso `meuPerfilSocial`
  devolve `pausada` como campo PRÓPRIO: uma tela de luto para quem pausou seria
  o app dizendo a ela que perdeu a gestação.
- **Catraca:** `pausar-a-conta.test.ts` varre `rede-social.functions.ts` e
  recusa `care_mode` entrando numa CONDIÇÃO fora da régua — com três exceções
  nomeadas e justificadas, e com contraprova de que a varredura morde.

#### ⚠️ O degrau da pausa é o mais ALTO da escada, e os de baixo derivam DELE

`COLUNAS_SEM_PAUSA` é derivada por remoção, e `COLUNAS_SEM_OFICIAL`/
`COLUNAS_SEM_FEED`/`COLUNAS_SEM_ARROBA` derivam dela — **um degrau que
continuasse pedindo `rede_pausada_em` falharia pela mesma coluna que o degrau
acima já provou não existir, e a escada inteira desceria até o chão por causa de
um `42703` só.**

⚠️ E `postQueEuVejo` (em `comentarios.functions.ts`) precisou de recuo próprio:
sem `rede_pausada_em` o `42703` cai em `erroAutor` e a função RECUSA — ou seja,
**COMENTAR pararia de funcionar para todo mundo** por causa de uma coluna que
ainda não existe naquele banco.

### ⚠️ E DEZ TESTES MEUS TRAVAVAM A GRAFIA, não a garantia

A unificação em `foraDaRede` deixou **treze** testes vermelhos, e **nenhum deles
apontava um defeito** — todos descreviam COMO o código estava escrito
(`ctx.silenciados.has(id)`, `!!p.care_mode`, `if (!a ||`,
`COLUNAS_DO_PERFIL.replace`) em vez do que ele garante. Um deles reprovou uma
correção que APERTA o portão.

É a oitava vez neste repositório. A régua continua sendo: **cobre a garantia, e
aceite mais de uma grafia** — `toMatch(/ctx\.silenciados(Stories)?\.has/)` em vez
de `toContain`, "deriva de ALGUMA lista" em vez de "deriva desta".

⚠️ **A exceção que vale ouro:** o teste do `!!dono &&` estava certo travando a
ORDEM, e foi o único que pegou um defeito de verdade. Ordem em corrente de `&&`
não é grafia — é o que impede um `undefined.propriedade`.

**Bancadas novas:** `/preview-instagram?tela=bloqueados` (`&vazio=1`,
`&instavel=1`) · `?tela=comentarios` (o fixado no topo, "Fixar"/"Desafixar", e o
número que só vira botão no comentário dela) · `/preview-rede?pausada=1`.

## E mais dez na rede — as que sobraram (ago/2026)

Pedido do dono, na mesma noite: aplicar as dez acima e **levantar e aplicar
outras dez**. Estas são as segundas dez, e cada uma foi CONFERIDA contra o
código antes de entrar na lista — a lição das "três de seis que já existiam".

**Aplicar no Supabase:** `supabase/APLICAR_MAIS_DEZ_DA_REDE.sql` (idempotente).

### 1 · Denunciar um story — a última superfície sem denúncia

Post, perfil, comentário, pergunta e mensagem já tinham. ⚠️ **E o story é o que
MAIS precisa, porque ele EXPIRA:** o que não for denunciado em 24 h nunca chega
à plataforma, e a próxima paciente recebe a mesma coisa da mesma pessoa.
Bloquear existe, e bloquear não deixa rastro nenhum.

- ⚠️ **O TRECHO é congelado, e aqui isso é o recurso inteiro** — sem a cópia, a
  linha da administração apontaria para uma coisa que não existe mais.
- ⚠️ **Sem o CHECK novo o banco recusa o alvo `story` com `23514`**, e a tela
  DIZ isso em vez de prometer "fica registrada". É a promessa que este app já
  quebrou uma vez, com `denunciado_em` gravado e nunca lido.

⚠️ **E ela obrigou a régua do story a virar UMA.** O portão de visibilidade
(vinte linhas cruzando `foraDaRede`, bloqueio, o vínculo e a CAMADA) vivia
DUPLICADO em `votarNoStory` e `reagirAoStory`, e a terceira cópia ia nascer
aqui. Virou `storyQueEuVejo` — e três testes que travavam o bloco inline ficaram
vermelhos sobre uma unificação que só apertou a garantia.

### 2 · O filtro de palavras passou a valer no DIRECT

A lista que ela escreveu ("perdi", o nome de um hospital) existia só para a
conversa PÚBLICA embaixo das fotos. ⚠️ **A mensagem privada é justamente onde o
texto duro chega** — e onde ela não tem como saber o que vem antes de abrir.

- **A MESMA lista e a MESMA régua** (`temPalavraOculta`), nunca uma segunda.
- ⚠️ **O texto NÃO viaja recolhido**: mandá-lo com uma marca "esconda isto"
  deixaria a palavra dentro da resposta da rede.
- ⚠️ **A LINHA continua**, ao contrário do comentário: a conversa é de duas
  pessoas, e uma mensagem que desaparece faz a conversa deixar de fazer sentido.
- ⚠️ **Não vale para o que EU escrevi** — ela sabe o que digitou.
- ⚠️ **Falha ao ler a lista NÃO esconde nada.** O pior caso é ela ver uma
  palavra que preferia não ver, contra a conversa inteira recolhida por uma
  falha de rede.

### 3 · Editar um comentário

⚠️ **APAGAR E ESCREVER DE NOVO NÃO É A MESMA COISA:** apagar leva junto as
RESPOSTAS que penduraram nele, e o comentário volta ao fim da lista. Quem
digitou "12 semanas" no lugar de "21" embaixo de um post sobre saúde tinha de
escolher entre deixar o erro ou desmontar a conversa.

- ⚠️ **A régua clínica roda DE NOVO** — sem ela, editar seria a porta dos fundos
  do `comentar`: publica-se "que lindo" e troca-se depois por conduta.
- ⚠️ **SÓ O TEXTO muda**, e **só quem escreveu edita** (nem a dona do post: ela
  pode APAGAR, que é a decisão dela sobre a própria conversa).
- ⚠️ **Sem a coluna do selo a edição VALE** — recusar seria tirar uma correção
  por causa de um carimbo.

### 4 · Marcar a conversa como não lida — e ela não precisou de coluna

⚠️ **É a LIMPEZA do carimbo de leitura.** `lida_a`/`lida_b` guardam o INSTANTE
da última leitura; apagá-lo é literalmente o que "não lida" significa, e um
booleano ao lado seria uma segunda verdade sobre a mesma coisa. O caso de uso é
o desta base: ela lê às três da manhã, não consegue responder, e quer lembrar.

### 5 · As Notas — o recado curto que vive 24 h no topo do direct

⚠️ **É o formato de MENOR risco da aba, e ele faltava.** "Não consigo dormir 😅"
às três da manhã é exatamente o que ninguém publica como POST — post é para
sempre e tem plateia — e é o que começa uma conversa.

- ⚠️ **UMA por pessoa** (a chave primária é o autor): uma lista viraria um
  segundo feed.
- ⚠️ **Passa pela régua clínica** — é texto curto em que "toma buscopan que
  passa" cabe inteiro.
- ⚠️ **A validade é CALCULADA no `upsert`**, e não deixada no `DEFAULT`: o
  `DEFAULT` só vale no INSERT, então a nota nova herdaria o `expira_em` da
  anterior e sumiria antes da hora.
- ⚠️ **60 caracteres**, e não 200: com 200 ela vira um post pequeno, e aí
  concorre com o post.
- ⚠️ **As vencidas nunca são apagadas na leitura** — abrir o direct viraria uma
  escrita. Mesma decisão de `storiesDoFeed`.
- ⚠️ **O BALÃO FICA ACIMA DO AVATAR, e não por cima dele.** A primeira versão o
  pendurava em `absolute -top-3` sobre uma coluna de 68px: o texto quebrava em
  cinco linhas, cobria o avatar inteiro e deixava o nome ilegível atrás.
  **Foi a FOTO da bancada que pegou** — nenhuma asserção estava perto disso.

### 6 · Favoritos — "ver primeiro", o oposto de silenciar

Silenciar já existia; num feed CRONOLÓGICO, quem segue trinta pessoas perde a
publicação da amiga que está passando por alguma coisa.

⚠️ **E ele NÃO reordena o feed.** O feed continua cronológico, e isso é decisão
escrita: um feed por "relevância" precisaria de engajamento como sinal, e numa
base de alto risco **o post que mais engaja é o da EMERGÊNCIA**. Favoritar abre
uma LISTA À PARTE, também cronológica, e a escolha é dela — explícita, nunca
inferida do que ela toca.

- ⚠️ **A lista não inclui os posts DELA**: no feed normal eles entram; aqui a
  pergunta é "o que as minhas favoritas publicaram".
- ⚠️ **É CALADO**, como o silenciar e o bloqueio.

### 7 · Coleções nos salvos

⚠️ **UMA COLUNA, e não uma tabela de coleções.** A coleção é um RÓTULO que ela
escreve; uma tabela exigiria criar a pasta antes de salvar, e o gesto de salvar
tem de continuar sendo um toque só. `NULL` = "Salvos", onde tudo que já foi
salvo continua.

⚠️ **E ela viaja À PARTE do post** (`colecaoDe`): `PostNaTela` é o mesmo tipo do
feed, e um campo "colecao" ali sugeriria que a pasta é propriedade da
PUBLICAÇÃO — ela é da linha de salvos, e é privada dela.

### 8 · O título do destaque

⚠️ **DESTAQUE SEM NOME É UMA GRADE DE IMAGENS.** O recurso existia desde
ago/2026 e o perfil mostrava só os quadradinhos; "Ultrassons" e "Chá de bebê"
são o que faz alguém tocar.

- ⚠️ **Tirar do destaque LIMPA o título** — guardá-lo faria o nome antigo
  reaparecer no dia em que ela destacasse outra coisa.
- ⚠️ **O nome é pedido NO ATO de destacar**, nunca depois: um segundo passo é um
  passo que a maioria pula.
- ⚠️ **E numa FOLHA da própria tela, nunca `window.prompt`.** Eu escrevi o
  `prompt` primeiro — no app instalado o diálogo do sistema abre com o nome do
  domínio em cima, que é a cara de "site embrulhado" da diretriz 4.2 da Apple, e
  é a lição que este repositório já tinha registrado para `alert`/`confirm`.

### 9 · Marcar alguém num story

⚠️ **TABELA PRÓPRIA, e não `story_id` em `rede_marcacoes`.** Lá o `post_id` é
`NOT NULL` e faz parte da CHAVE PRIMÁRIA: torná-lo opcional exigiria trocar a
chave, e a chave é o que impede a marcação duplicada.

- ⚠️ **A régua de permissão é a MESMA do post** (`marcadasPermitidas`): copiá-la
  faria as duas divergirem, e a divergência apareceria como o nome de quem
  encerrou a amizade voltando a aparecer embaixo de uma foto de barriga.
- ⚠️ **O story NÃO grava linha na caixa ♡**: ele vive 24 h, e um aviso
  permanente sobre uma coisa que some no dia seguinte deixaria a caixa cheia de
  linhas que não resolvem em nada.
- ⚠️ **O `id` volta do INSERT**, e não de uma leitura depois: reler "o story mais
  novo dela" seria uma corrida, e dois aparelhos publicando no mesmo instante
  marcariam a pessoa no story errado.

### 10 · A busca de hashtag — e ela não precisou de tabela

Quem ouviu falar de `#trigemeas` numa conversa não tinha caminho nenhum até lá:
a página da tag existia e só se chegava nela tocando numa legenda que já a
continha — **só quem já a tinha encontrado conseguia encontrá-la**.

⚠️ **`tagDaBusca` responde pelo FORMATO do termo, e não consulta o servidor.**
Uma consulta "existe esta tag?" por tecla digitada seria uma ida ao banco para
uma pergunta que a própria página da tag responde melhor — com o vazio dela, que
explica a régua ("só publicações públicas").

⚠️ **E a mutação achou uma regra DUPLICADA que eu tinha acabado de escrever:** o
teste de "tem letra?" já mora em `acharTags`, então a linha repetida aqui nunca
mudava a resposta. Regra duplicada que ninguém exercita é a que diverge no
primeiro conserto — saiu.

### ⚠️ E a nona vez do mesmo erro de teste

Três testes travavam o bloco inline do portão do story e ficaram vermelhos sobre
a unificação em `storyQueEuVejo`. **Nona vez neste repositório.** A régua não
muda: cobre a GARANTIA (o portão roda antes da escrita, e a régua única cruza os
quatro termos), nunca a grafia.

⚠️ **A exceção que vale ouro** continua sendo a ORDEM numa corrente de `&&`:
`foraDaRede(x) && x.perfil_publico` não é estética — é o que impede um
`undefined.propriedade`. Esse teste pegou um defeito real duas vezes.

### ⚠️ E A VARREDURA ADVERSARIAL ACHOU UMA REGRESSÃO QUE EU CRIEI

Depois de tudo verde — 4.685 testes, `tsc` limpo, 83 bancadas varridas, CI verde
—, uma varredura das colunas novas atrás de degrau achou o pior defeito da
noite, e ele era **uma regressão num recurso que já funcionava**.

`contextoDe` lia `.select("silenciado_id, cala_posts, cala_stories")` **sem
degrau**. Num banco sem as colunas — o do dono agora, antes de rodar o SQL — o
`42703` derruba o select inteiro, `calados.data` vem `null`, e os DOIS conjuntos
saem vazios: **o silenciar que funciona há meses simplesmente deixaria de
valer.** A silenciada voltaria ao feed e aos stories de todo mundo, sem erro
nenhum na tela.

⚠️ **É a forma mais cara de defeito deste repositório:** uma coluna nova que,
faltando, apaga um recurso ANTIGO. E ela não aparece em teste nenhum, porque a
máquina de desenvolvimento tem o banco em dia. O que a achou foi uma pergunta
mecânica — _toda coluna nova tem degrau?_ — feita DEPOIS de o resto estar verde.

**A régua que fica:** ao acrescentar coluna a um `select` que já existia,
pergunte o que a função devolve quando ela falta. Se a resposta for "menos do
que devolvia antes", o degrau não é opcional.

**Bancadas novas:** `/preview-instagram?tela=conversas&notas=1` (a fileira de
notas) · `?tela=conversa&oculta=1` (a mensagem recolhida pelo filtro) ·
`?tela=perfil&favorita=1` (o "Tirar dos favoritos").

## ⚠️ OS DOIS BURACOS DE LGPD DA COMUNIDADE (ago/2026)

Achados numa varredura pedida pelo dono ("veja tudo que ainda pode estar
faltando"). Os dois são a mesma forma de defeito: **a aba nasceu depois das duas
funções e ninguém voltou a elas.**

### 1 · A exclusão de conta não apagava as fotos da Comunidade

`excluirMinhaConta` varria `exames` e `album`. A Comunidade usa **`rede`** (fotos
e vídeos das publicações e dos stories) e **`conversas`** (as fotos do direct) —
nenhum dos dois. As linhas somem pelo `ON DELETE CASCADE`; os arquivos ficavam.
A paciente pedia a exclusão, o produto respondia que apagou, e a ultrassom dela
continuava no nosso disco.

⚠️ **É literalmente o defeito que o comentário ao lado descreve** ("a linha some,
o arquivo fica"), acontecendo de novo com os baldes criados depois dele.

⚠️ **E existem DUAS CONVENÇÕES DE PASTA.** `guardarImagem` põe tudo em
`pastaDoDono` (sha256 do uuid); o VÍDEO do post e a FOTO da conversa sobem por
URL assinada, e ali a pasta era o **uuid cru**. Varrer só uma apagaria as fotos e
deixaria os vídeos — com o produto dizendo "apagamos" do mesmo jeito. Daí
`apagarTudoDoDono`, que varre as duas.

#### ⚠️ E isso destapou uma regra que dois handlers violavam

`imagens.test.ts` cobra desde a migração das imagens que **o caminho no balde
NÃO carrega o uuid da paciente** — ele vaza para a URL assinada, e é o mesmo
buraco que `AlbumPostPublico` foi criado para fechar. `urlParaSubirVideo` e
`urlParaSubirFotoDaConversa` nasceram DEPOIS da regra e subiam em `${eu}/…`.

Os dois passaram para `pastaDoDono`. ⚠️ **E `fotoEhDeQuemMandou` teve de
acompanhar**: ela comparava com `autorId` e recusaria TODA foto nova. Hoje
recebe a PASTA pronta — a régua vive em `conversa.ts`, que roda no navegador, e
`pastaDoDono` usa `node:crypto`. Os arquivos antigos continuam na pasta crua, e
é por isso que a varredura continua olhando as duas.

### 2 · O exportador LGPD ignorava a rede inteira

Vinte e sete tabelas `rede_*` no banco, **zero** no export. Ela baixava "todos os
meus dados" e não vinha uma publicação, um comentário, uma mensagem nem um story.
O direito de portabilidade cobre o que ela ESCREVEU, e a Comunidade é hoje onde
ela mais escreve.

Entraram cinco, **sempre por AUTORIA dela** e coluna a coluna (nunca `*`): um
recorte por `dona_id` traria o que outras pessoas escreveram PARA ela, num
arquivo que ela pode mandar por WhatsApp.

⚠️ **A caixinha fica de fora INTEIRA, e a catraca já a proibia.** É a tabela mais
sensível da aba porque o anonimato é o recurso; exportar até a metade dela cria
mais uma superfície por onde o autor pode vazar — hoje, ou no dia em que alguém
trocar a coluna do recorte por engano.

⚠️ **E a exclusão NÃO era uma lacuna**: o `CASCADE` para `auth.users` já derruba
as linhas. Conferir isso antes de afirmar evitou um "achado" falso — a lição do
"três de seis que já existiam", aplicada na direção contrária.

## A rede era quase muda, e "ou tudo, ou nada" era a única escolha (ago/2026)

### O push existia em DOIS eventos, com o texto escrito para OITO

`textoDoAviso` tinha frase pronta para as oito espécies. `avisoMandaPush`
devolvia `true` só para `pediu_para_seguir`, e o bloco de envio vivia **solto
dentro de `seguir`** — então comentar, mencionar e marcar gravavam na caixa ♡ e
não avisavam ninguém. Numa aba cuja graça inteira é alguém te responder.

- ⚠️ **A correção é CENTRALIZAR, e não repetir o bloco em cada chamador.** O push
  mudou-se para dentro de `registrarAtividade` — o único caminho por onde um
  aviso nasce. A espécie que alguém acrescentar amanhã já sai avisando, e quem
  decide continua sendo uma régua pura.
- **A ordem é: gravou → fora da rede? → régua → push.** Avisar sobre uma linha
  que não gravou manda a paciente abrir uma caixa onde não há nada.
- ⚠️ **O corte não é "o que é importante", é "o que PEDE".** `reagiu` e
  `reagiu_story` ficam de fora — são afago, e afago espera ela abrir. O push
  deste app é o mesmo canal do aviso de emergência.
- ⚠️ **`aceitou` também ficou de fora, e o teste pegou minha inconsistência.** Eu
  escrevi o critério "o que PEDE" e em seguida incluí `aceitou`, que não pede
  nada: ela mandou o pedido e vai encontrar a resposta quando abrir. A decisão já
  estava tomada e testada; o critério novo, aplicado direito, chega nela sozinho.

### As preferências, e a frase que faz elas serem usadas

Até aqui, parar de receber aviso da Comunidade significava desligar a
notificação do app INTEIRO — o mesmo canal do aviso de emergência e do lembrete
de consulta. Numa gestação de alto risco, "ou tudo, ou nada" é uma escolha que
ninguém deveria ter de fazer.

- ⚠️ **A lista é do que ela DESLIGOU, e não do que ligou.** Guardar o que está
  ligado faria toda espécie nova nascer desligada para quem já usa o app.
- ⚠️ **Só aparece o que MANDA push.** Um interruptor ao lado de um aviso que
  nunca sai prometeria controle sobre coisa nenhuma.
- ⚠️ **E a tela DIZ o que não passa por ali.** Sem a frase, desligar aqui parece
  desligar o aviso do médico junto — e aí ela não desliga nada.
- **`podeAvisar` falha ABERTO**: sem saber o que ela desligou, o aviso vai. O
  pior caso é um push indesejado; o oposto é silêncio, que some sem rastro.

### O aviso de quem publicou — só para FAVORITAS

⚠️ **"Fulana publicou" para todo mundo que segue é o pior push possível aqui.**
Quem segue trinta pessoas receberia trinta interrupções por dia e desligaria a
notificação inteira — com ela o SOS. Favoritar é a única forma de pedir por ele.

⚠️ **A camada `amigas` não avisa ninguém**: quem favoritou pode não ser amiga, e
o push carregaria o NOME de quem publicou um desabafo restrito para fora da
camada que o restringe. E quem me bloqueou não recebe — o bloqueio vale nos dois
sentidos, e um push meu chegando nela seria o bloqueio falhando pelo caminho
mais visível possível.

### ⚠️ O link da bio, e o XSS que só a mutação achou

O `href` é **o único lugar do app onde texto de uma paciente vira comportamento
na tela de outra**. Quem limpa é o servidor (`limparLinkDaBio`); a tela pinta o
que chega e não confere nada — uma segunda régua divergiria da primeira.

⚠️ **A minha primeira versão deixava passar `javascript://exemplo.com/%0aalert(1)`.**
Ele tem hostname `exemplo.com`, então passa pela conferência de "tem ponto?" e
pela de "tem esquema?" — só o teste de PROTOCOLO o pega. A mutação que apagava
essa linha ficou verde, e foi assim que o caso apareceu.

- **Campo PRÓPRIO, e não um link solto dentro da bio**: varrer a bio atrás de
  `http` transformaria qualquer texto com endereço num link.
- **`rel="noopener"`**: sem ele, a página aberta ganha `window.opener` e pode
  navegar a NOSSA aba para onde quiser, com a paciente achando que continua no
  app.

**Aplicar no Supabase:** `supabase/APLICAR_AVISOS_E_DESCOBERTA.sql`.

## O direct ficou completo: grupo, voz, busca, fixar, encaminhar (ago/2026)

### ⚠️ O grupo é APERTADO, e cada trava responde a um jeito de dar errado

Num app de gestação de alto risco, um grupo aberto é onde o conselho de leiga se
multiplica — os 20,9% de respostas erradas em fóruns de gestação são o número que
fechou os comentários deste app. O grupo entra com as travas que aquela decisão
implica:

1. **Só a CRIADORA convida**, e só de dentro do grafo dela. Sem isso, uma pessoa
   entra e traz outras cinco que ninguém conhece.
2. **Teto de oito.** Acima disso ninguém lê tudo, e o que sobra é quem fala mais
   alto.
3. ⚠️ **Quem entra vê a partir de `entrou_em`.** É a régua que separa "entrar num
   grupo" de "ler a conversa dos outros": o que veio antes pode ser um susto, um
   resultado ou uma perda, e quem escreveu escolheu contar para quem estava lá
   naquele momento. O filtro é aplicado na CONSULTA — o que não é lido não vaza.
4. **A criadora saindo ENCERRA.** Um grupo sem dona é um grupo sem ninguém
   responsável por quem entra. Encerrar MARCA; as mensagens ficam, porque são o
   que as OUTRAS escreveram.

⚠️ **`rede_conversas` NÃO foi mexida.** Ela tem `a_id`/`b_id` `NOT NULL`, um
`CHECK (a_id < b_id)` e um índice único por par: a forma inteira dela É "duas
pessoas", e é nela que mora a garantia de que ninguém entra numa conversa de
duas. Espremer um grupo ali exigiria afrouxar os três.

⚠️ **Mas as MENSAGENS são as mesmas.** `rede_mensagens` ganhou `grupo_id`, com
`CHECK ((conversa_id IS NULL) <> (grupo_id IS NULL))`. Reusar não é economia: é o
que faz a citação, as reações, o apagar e a **régua clínica** valerem igual nos
dois. Uma tabela separada seria seis lugares para divergir, e a divergência
apareceria como conduta passando no grupo e sendo recusada no direct — no canal
que tem OITO leitoras em vez de uma.

⚠️ **Quem é reconvidada VOLTA vendo a partir de agora** (`entrou_em` reescrito no
`upsert`), e **quem saiu não ocupa vaga** — senão um grupo que perdeu metade
nunca mais aceitaria ninguém.

### A voz

- ⚠️ **`audio/mp4` é o PRIMEIRO da lista.** É o único que o Safari do iPhone
  grava; uma lista começando em `webm` funciona em toda máquina de
  desenvolvimento e falha no aparelho onde o app é instalado.
- ⚠️ **Dois minutos**, e o teto separa recado de monólogo: sem limite, o áudio de
  doze minutos vira a coisa que a outra adia ouvir.
- ⚠️ **A duração é GRAVADA, e não medida na leitura.** Sem o número, a bolha
  nasce sem largura e a tela pula quando o áudio carrega — num histórico longo, é
  a conversa inteira dançando.
- ⚠️ **Sem a coluna, a mensagem de VOZ é RECUSADA** — nunca vira linha sem áudio,
  que seria uma bolha em branco com ela achando que mandou.
- **O áudio passa pela MESMA trava de pasta da foto**, e é assinado na MESMA onda.

### A busca é LOCAL, e é por isso que ela existe assim

⚠️ Buscar no servidor mandaria o TERMO pela rede — e o termo é o que ela está
procurando numa conversa privada. "sangramento", o nome de um hospital, o nome de
uma pessoa: tão sensível quanto o que ela escreveu. A busca roda sobre as
mensagens que a tela JÁ tem, e não acha o que está apagado nem recolhido.

### Fixar, encaminhar e denunciar a conversa

- **Fixar é preferência de quem OLHA a lista** — por isso são duas colunas, e a
  tela diz "só na sua lista": sem a frase, ela imagina que a conversa sobe também
  na tela da outra.
- ⚠️ **Encaminhar é SÓ TEXTO.** A foto e o áudio que alguém me mandou numa
  conversa privada não saem dali — a mesma razão do ✈ do story ser do dono. E o
  texto vai **sem autoria**: "Fulana disse:" transformaria o encaminhar num
  print. A régua clínica roda DE NOVO no destino, senão encaminhar seria a porta
  dos fundos de `triarTexto`.
- ⚠️ **Denunciar mensagem a mensagem não serve para assédio**, e é isso que
  faltava: o que caracteriza assédio é o PADRÃO — vinte mensagens que, uma a uma,
  não dizem nada. A denúncia da conversa leva as dez últimas **dela**; as minhas
  não são prova de nada contra ela, e mandá-las entregaria o meu lado de uma
  conversa privada a quem não precisa dele.

### ⚠️ Três testes meus travavam a grafia, e um deles a DISTÂNCIA

- Um media 500 caracteres entre duas linhas para achar o degrau de recuo — e
  ficou vermelho quando o degrau do ÁUDIO entrou no meio. **A distância nunca foi
  a garantia.**
- Outro travava o tipo `{ tipo: "post" | "story" }` e reprovou a MESMA folha
  passando a servir o encaminhar — uma união a mais, que só ampliou o que ela
  cobre.
- E a catraca de portas pegou uma **chamada indireta**: eu escolhia a função numa
  variável (`const chamar = … ? mod.encaminhar : mod.enviar`), e ela ficou
  vermelha com razão — uma chamada assim é invisível para quem lê o arquivo
  procurando quem usa o quê, que é exatamente o defeito que ela existe para pegar.

### ⚠️ E a catraca de escritas sem checagem cobrou quatro

O teto ficou em **6** — nenhuma subiu. As quatro escritas novas (a ordem da lista,
a marca de lida, o encerramento e o rollback do grupo órfão) passaram a
REGISTRAR a falha: silêncio para a paciente, registro para quem investigar. É a
resposta do meio que `registrarAtividade` já documenta — _silêncio TOTAL é o que
a catraca proíbe_.

**Aplicar no Supabase:** `supabase/APLICAR_DIRECT_COMPLETO.sql`.

## A descoberta: Explorar, tags em alta, parecidas e recentes (ago/2026)

⚠️ **AS TRÊS PRIMEIRAS, no modelo do Instagram, SAEM DE ENGAJAMENTO. Aqui
NENHUMA sai.** Numa base de gestação de alto risco, o post que mais engaja é o da
EMERGÊNCIA — o sangramento, o susto, a internação. Um ranking que aprende isso põe
o pior dia de uma paciente como a primeira coisa que as outras veem, e com
desconhecidas. É a mesma decisão que fez o feed ser cronológico e a zona de
sugestões existir sem placar.

### Explorar

A grade sai de `sugestoesDoFeed` — que **já é** a régua desta aba: perfil
público, publicação pública, `podeVerPost` por cima, e ordenação por elos em
comum e recência. Uma consulta própria aqui abriria a porta para "o que está
bombando".

- ⚠️ **A régua é DITA na tela** ("nada aqui é escolhido por número de reações").
  Sem a frase, a paciente lê o Explorar como o Explorar que ela conhece.
- ⚠️ **As tags vêm ANTES da grade**: elas são o caminho para um assunto, a grade é
  o acaso. Quem abre com uma pergunta na cabeça encontra a pergunta primeiro.
- ⚠️ **Post só de texto não vira quadrado cinza** — `postEhValido` aceita post sem
  foto, e sem o ramo do texto ele apareceria vazio na grade.

### As tags em alta

⚠️ **"Em alta" aqui é FREQUÊNCIA** — quantas publicações usaram a tag. Uma tag é
um assunto; quantas pessoas escreveram sobre ele é a única pergunta que a lista
responde.

- ⚠️ **PISO de duas publicações.** Uma tag usada uma vez não é assunto: é a frase
  de uma pessoa, e pô-la numa lista de "em alta" a expõe a desconhecidas por
  acidente.
- ⚠️ **O empate desempata pela TAG.** Sem desempate fixo, a mesma lista troca de
  ordem entre duas aberturas — e uma lista que se mexe sozinha ensina que ela não
  significa nada.
- ⚠️ **SÓ CONTA O QUE ELA PODERIA VER**, e a contagem passa por `montarPosts`.
  Sobre a tabela inteira, a lista diria "#trigemeas (14)" e a página da tag
  mostraria três — as outras onze são de perfis fechados, de quem a bloqueou ou de
  quem está em luto. **O número tem de bater com o que a página entrega.**
- Falha vira lista vazia, nunca erro: é acessório do Explorar.

### ⚠️ "Contas parecidas" NÃO derivam do perfil aberto

O Instagram monta essa fileira a partir de **quem a pessoa que você seguiu
segue** — e isso, aqui, vazaria o grafo dela. A lista de seguidores deste app não
é pública de propósito: num app de gestação de alto risco, quem acompanha quem é
o círculo social da pessoa, e **"parecidas com a Ana" é a lista de amigas da Ana
com outro nome**.

O que chega são as sugeridas do MEU feed, ordenadas por elos COMIGO. É menos
preciso, e é o único que não conta a vida de terceiro.

⚠️ **E só aparecem DEPOIS de seguir.** Num perfil que ela ainda está decidindo se
acompanha, a fileira vira uma vitrine de outras pessoas e a decisão que ela veio
tomar fica em segundo plano.

### As buscas recentes ficam no APARELHO

⚠️ O que ela procura é nome de pessoas e de assuntos — e "quem eu procurei" é um
dado que não precisa existir em lugar nenhum além da tela dela. É a mesma decisão
da busca DENTRO da conversa.

- ⚠️ **A chave carrega o id da conta**: o aparelho é compartilhado, e a lista de
  quem a mãe procurou não pode aparecer para a filha que usa o mesmo celular.
- ⚠️ **Guarda só o que ACHOU alguém.** Guardar toda tecla encheria o histórico com
  prefixos ("a", "an", "ana"), e ele existe para ela voltar a uma busca que valeu.
- **O histórico só aparece com o campo vazio** — enquanto ela digita, o que
  importa é o resultado.

**Sem SQL:** as quatro saem de tabelas e colunas que já existem.

## O conteúdo: carrossel de story, lugar e figurinhas (ago/2026)

### O carrossel de story

**O mesmo desenho do post** — `imagens` como coluna de array, com `imagem_path`
continuando a ser a primeira. ⚠️ **Mas o teto é CINCO, e não dez:** o story é
folheado com o dedo em pé, com a barrinha correndo, e dez fotos viram uma
sequência que ninguém termina.

- ⚠️ **`imagens` é um DEGRAU PRÓPRIO, e o teste dos três degraus pegou.** A
  primeira versão a pôs no `base` — e `base` é o que o degrau MÍNIMO insere: num
  banco sem a coluna, publicar story falharia INTEIRO, inclusive o de foto
  única, que é o caso de todo mundo hoje.
- ⚠️ **Uma foto que não sobe RECUSA o story.** Um carrossel com buraco é pior
  que foto única: ela escolheu quatro, veria três, e não saberia qual sumiu.
- ⚠️ **O deslize horizontal não avança o story.** Ele vive dentro de uma tela
  cujas metades avançam e voltam; sem `stopPropagation`, folhear as fotos
  pularia o story inteiro.
- **Rolagem NATIVA com `scroll-snap`**, como no post: reimplementar o arrasto dá
  sempre um deslize que parece quase certo e nunca é.

### ⚠️ O lugar é um RÓTULO, e nunca coordenada

Guardar latitude e longitude de uma gestante — e devolvê-las a quem abre o post —
é dado de localização precisa numa base de alto risco: **é o que permite a alguém
saber onde ela mora.** "Maternidade Santa Casa" diz o que ela quer dizer e não
localiza ninguém.

⚠️ **E NÃO há autocompletar de lugares.** Um catálogo de endereços transformaria
o campo numa lista de maternidades com as pacientes de cada uma — exatamente o
cruzamento que a régua de "nada clínico no perfil" existe para impedir. Na tela
ele é TEXTO, e não link para mapa: transformá-lo em endereço convidaria a tela a
resolver a localização.

### ⚠️ As figurinhas são NOSSAS, e não um GIF de fora

Três razões, e a terceira decide:

1. **CSP** — um host externo de imagem precisaria ser aberto, e ele passa a poder
   servir qualquer coisa.
2. **Custo** por chamada, no formato que mais se usa por conversa.
3. ⚠️ **Conteúdo NÃO MODERADO.** A busca por "grávida" no Giphy devolve piada de
   parto e imagem de teor sexual. Num app de gestação de alto risco, onde a
   paciente pode estar internada, isso não é risco aceitável por conveniência.

- ⚠️ **NENHUMA fala de corpo, exame ou conduta.** Um catálogo de gestação tenta
  naturalmente incluir "contração", "pressão alta", "dilatação" — e uma figurinha
  é um jeito de dizer uma coisa sem escrever, o que a torna o pior formato
  possível para conteúdo clínico. Aqui elas dizem AFETO e PRESENÇA. Sem 😱 e sem
  😢, pela mesma razão das reações do post.
- ⚠️ **O catálogo é PEQUENO de propósito** (dezoito). Um catálogo grande vira
  busca, busca vira campo de texto, e aí o formato deixou de ser o gesto rápido
  que ele existe para ser.
- ⚠️ **Ela viaja como TEXTO MARCADO** (`:dc-fig:abraco:`), e por isso passa pela
  citação, pelo encaminhar, pela busca local, pelo apagar e pela prévia da lista
  sem uma linha nova em nenhum desses lugares. Uma coluna própria exigiria tocar
  em seis leituras e num CHECK.
- ⚠️ **E a prévia da lista NUNCA mostra o marcador cru** — sem a régua, a
  paciente veria um código onde deveria ver o que a amiga mandou.
- **Na tela ela SUBSTITUI a bolha**: um emoji de 44px dentro de um balão com
  fundo lê como texto grande; solto, lê como figurinha.

### ⚠️ Duas coisas da lista original que NÃO foram feitas — e por quê

- **"Comentar no story" saiu**, e o erro foi meu na hora de listar: **o Instagram
  não tem isso.** O que existe lá é resposta privada, que este app já tem
  (`responderStory`) junto com a reação. Um comentário público num conteúdo que
  expira em 24 h seria uma superfície de conselho de leiga com menos rastro que
  a do post — o oposto do que a decisão de fechar os comentários protegeu.
- **"Responder story com foto" ficou de fora desta onda.** O caminho existe
  inteiro (a resposta já é uma mensagem do direct, e a mensagem já aceita foto);
  falta ligar o seletor no visor. É a única das 28 que fica pendente, e ela está
  registrada aqui em vez de silenciosamente esquecida.

⚠️ **Três testes MEUS mediram distância entre linhas nesta onda** — 400
caracteres do texto com indentação, uma ordem entre inserts, e uma âncora num
campo que aparece antes. **A distância e a ordem nunca são a garantia.** O que
quebra a publicação num banco atrasado é a coluna nova estar no objeto que o
ÚLTIMO insert manda, e é isso que o teste passou a cobrar.

⚠️ **E a prosa do SQL quebrou um teste de texto pela décima vez**: a busca por
"latitude" achava justamente o comentário que explica por que ela NÃO é guardada.

**Aplicar no Supabase:** `supabase/APLICAR_CONTEUDO_DA_REDE.sql`.

## As sete da rede, e a contagem de seguidores que eu tinha escondido (ago/2026)

Pedido do dono depois das dez sugestões, e ele **recusou uma delas por escrito**:

> "vai ter sim vantagem de seguidores em nenhum momento é pra esconder isso, vai
> ter contagem de seguidores sim, se tiver isso está errado. (…) a lista de
> pessoas seguindo também é para estar aparente. Em nenhum momento vamos
> bloquear isso, é pra usar as mesmas coisas que tem no Instagram."

### ⚠️ UMA DECISÃO MINHA FOI DESFEITA, e ela estava escrita em três lugares

`NUMEROS_PUBLICOS` guardava a decisão de não mostrar seguidores/seguindo, com o
argumento registrado ("ele mede popularidade num momento em que ela já está
sendo medida clinicamente") — e `listaDeGente` só aceitava a lista do PRÓPRIO
perfil. Os números e a lista voltaram, no modelo do Instagram.

⚠️ **E "aparente" NÃO quer dizer "sem régua".** Quem decide é `alcancaOPerfil`,
que é literalmente a regra do Instagram: **perfil público → qualquer pessoa;
perfil privado → só quem já foi aceita, mais a dona.** Sem esse portão, a lista
de quem acompanha uma gestante de alto risco ficaria legível para qualquer
paciente autenticada trocando um uuid — e o perfil NASCE privado. O argumento
antigo fica no arquivo ao lado do novo, porque a decisão é do dono e o
contra-argumento continua valendo se ele quiser revê-la.

⚠️ **Bloqueio e `foraDaRede` vêm ANTES**, e respondem `indisponivel` — nunca
"lista vazia", que faria a paciente concluir que a pessoa não tem ninguém.

### O filtro de palavras chegou ao FEED — e o véu passou a ter dois motivos

A lista que ela escreveu ("perdi", o nome de um hospital) valia no comentário e
no direct, e **não valia na publicação** — que é o texto mais longo e o mais
provável de carregar a palavra. `veuDoPost` (`conteudo-sensivel.ts`) unificou os
dois casos numa régua só, e ela tem ORDEM:

1. **a autora nunca vê o próprio post velado** — ela sabe o que escreveu;
2. revelado é revelado;
3. `sensivel` (o aviso que a autora marcou) ganha de `palavra`, porque é o que
   ela quis dizer sobre o conteúdo dela.

⚠️ **E o véu do filtro NÃO diz qual palavra bateu.** Ele diz "Escondido pelo seu
filtro de palavras", e mais nada: escrever a palavra na tela é entregar
exatamente o que ela mandou esconder — o mesmo defeito que o filtro do
comentário já pagou aqui.

⚠️ **`palavrasOcultas` entra em `contextoDe`, na MESMA onda** do resto: uma
consulta por post seriam vinte idas ao banco por página. E `batePalavraMinha` é
calculado no servidor, nunca na tela — a lista dela não precisa viajar.

### Esconder o story de pessoas específicas

⚠️ **A exclusão acontece ANTES da leitura** — `storiesDoFeed` monta a lista de
quem me escondeu (busca reversa em `escondido_id = eu`) e essas autoras nem
entram na consulta. Filtrar depois deixaria o story viajar pela rede.

⚠️ **E é CALADO**, como o silenciar e o bloqueio: a pessoa some da fileira e não
é avisada de nada.

### ⚠️ "STORY ESCONDIDO DE…" NÃO TINHA PORTA — e só a bancada mostrou

A lista de quem eu escondi (o desfazer do recurso acima) vivia dentro do menu ⋯
do perfil. E o ⋯ era gateado por `bloquear`, que no MEU perfil é `undefined`:
**a lista sobre os MEUS stories era oferecida num menu que só existe no perfil
DOS OUTROS.** Escrita, testada, alcançável em zero telas.

⚠️ **`tsc`, lint e a suíte inteira estavam verdes**, e `rede-tem-porta.test.ts`
não tinha como pegar: o botão É renderizado no código — ele só nunca aparece
onde é oferecido. É a família do `escadaDeTrofeus` com zero chamadores, chegando
por dentro de um `&&`.

O ⋯ passou a existir sempre que houver o que oferecer (`temOpcoes`), e **a
confirmação de bloqueio continua sendo a única parte que exige `bloquear`** — no
meu próprio perfil o painel abre sem ela.

⚠️ **E o texto da lista MENTIA**: ela reusa `ListaDeBloqueados`, cujo padrão diz
"quem está aqui não vê você na Comunidade". Quem está nesta lista continua vendo
o perfil, as publicações e tudo o mais — perde só o story. Herdar a frase do
bloqueio faria a paciente achar que escondeu muito mais do que escondeu.

### O link público da publicação

`/pub/<CODIGO>` — dez caracteres de um alfabeto de 32 sem `I`, `O`, `0` e `1`
(`link-da-publicacao.ts`), que são os quatro que alguém erra ao ler em voz alta.

- ⚠️ **`loader`, e não `useEffect`**: WhatsApp e Instagram **não rodam
  JavaScript** ao buscar o cartão de um link. É a mesma lição da vitrine.
- ⚠️ **O cartão é GENÉRICO — sem legenda e sem foto.** Ele é COPIADO e fica no
  histórico de toda conversa em que o link for colado, muito depois de ela
  arquivar o post.
- ⚠️ **O mesmo silêncio para todos os motivos** (código inexistente, post
  arquivado, perfil fechado, Modo Cuidado): "publicação indisponível" contaria,
  a quem colou o link no grupo da família, que ali existe alguma coisa.
- ⚠️ **`noindex`**, e ele NÃO impede a prévia — são duas coisas diferentes, e a
  rota precisa das duas.

### O aviso do story de quem ela favoritou

`avisarQuemMeFavoritou` já existia para o POST e ganhou `especie`. ⚠️ **Quem eu
escondi não recebe** — o push carregaria o meu nome anunciando um story que ela
não pode ver, que é o esconder falhando pelo caminho mais visível possível.

### O rascunho no servidor

O rascunho da publicação vivia só no aparelho. ⚠️ **E o do aparelho continua
vencendo** (`if (doAparelho) return;`): ele é mais novo por construção — foi
escrito no aparelho em que ela está agora.

⚠️ **As FOTOS não entram**, aqui pela mesma razão de sempre e mais uma: subir a
foto de um rascunho é subir um arquivo que talvez nunca vire publicação.

### A denunciante fica sabendo o desfecho

⚠️ **Denúncia sem retorno é a que ninguém faz duas vezes.** `resolverDenuncia`
ganhou `desfecho` (removido · avisado · sem_ação) e a paciente tem tela.

⚠️ **"Ainda não olhamos" é um estado à mostra**, e não uma linha ausente: sem
ele, a denúncia de ontem seria indistinguível de uma que se perdeu.
⚠️ **E o nome de quem foi denunciada NUNCA aparece** — a denúncia é justamente o
caminho de quem não quer confrontar.

### O que ela reagiu

⚠️ **É OUTRA coisa que os salvos**, e por isso tem botão próprio: salvar é o
gesto deliberado de guardar; reagir é o gesto rápido de quem passou por ali. É
por esta lista que se reencontra a publicação que ela viu, achou linda e não
guardou. A régua de visibilidade roda DE NOVO na leitura — ela pode ter reagido
e a autora ter fechado o perfil depois.

### ⚠️ E a bancada anunciava um controle que nunca desenhou

`?tela=perfil&favorita=1` está documentado aqui como "o 'Tirar dos favoritos'"
desde que o favoritar existe — e a bancada cravava a bandeira **sem passar
`aoFavoritar`**, então o botão nunca apareceu. Bancada que anuncia um controle
que ela não desenha é pior que bancada nenhuma; foi ao ligar as props do perfil
que o defeito do ⋯ apareceu.

**Aplicar no Supabase:** `supabase/APLICAR_MAIS_DA_REDE.sql` (idempotente).
**Bancadas:** `?palavraOculta=1` (o véu do filtro no feed) · `?tela=escondidos`
(`&vazio=1`, `&instavel=1`) · `?tela=curtidos` · `?tela=desfechos` (os quatro
estados, inclusive o "ainda não olhamos") · `?tela=perfil&meu=1` (o ♡ e o ⋯ que
não existia) · `/pub/<CODIGO>`.

## A conta do byte: quatro decisões que baixam o custo da Comunidade (ago/2026)

Pergunta do dono, em duas voltas: _"como as redes sociais fazem hj, como iríamos
reduzir o custo"_ e _"hoje o que o Instagram faz para conseguirmos minimizar os
custos"_.

⚠️ **O QUE CUSTA NÃO É GUARDAR — É BAIXAR.** Guardar uma foto de 267 KB custa
frações de centavo por mês; **entregá-la** custa toda vez que alguém abre a
tela. Uma paciente que rola trinta publicações baixa ~8 MB; trezentas pacientes
fazendo isso duas vezes por dia são ~144 GB/mês de egresso. É esse número que
cresce junto com a base, e é nele que as quatro mudanças mordem.

Régua e catraca: **`src/lib/conta-do-byte.test.ts`** — as quatro moram num
arquivo só de propósito. Elas não têm nada em comum no código (um TTL, um teto,
um `remove`, um número de qualidade) e têm tudo em comum no efeito, e quem for
mexer em qualquer uma precisa encontrar o argumento das outras três. Onze
mutantes conferidos em vermelho.

### 1 · A foto do feed é assinada por DIAS — e a URL passou a ser ESTÁVEL

⚠️ **E AQUI EU ERREI, E O ERRO É A LIÇÃO.** Eu disse ao dono que era "uma linha":
subir `expiresIn` de 3600 para sete dias. **Não era, e sozinho não resolveria
nada.** `expiresIn` é RELATIVO: assinar de novo produz outro `exp`, outro token
e portanto **outro endereço** — e a URL assinada É A CHAVE DE CACHE do
navegador. Com validade de sete dias e re-assinatura a cada leitura, a segunda
visita continua baixando tudo igual.

- **`separarGuardadas`** é a régua, e a memória (`Map` de módulo, teto de 5.000)
  devolve a MESMA URL enquanto ela durar. É isso que faz a segunda visita não
  custar banda.
- ⚠️ **`aindaServe`, e não "existe"**: uma URL perto de vencer serviria a leitura
  de agora e **quebraria a foto no meio da rolagem** de quem está com o feed
  aberto. A margem é `MARGEM_DE_RENOVACAO_SEG` (12 h).
- ⚠️ **AS DUAS MUDANÇAS SÃO INSEPARÁVEIS, e isso não estava escrito em lugar
  nenhum antes deste teste:** com validade de UMA HORA a memória seria **código
  morto** — a URL já nasce dentro da margem de doze horas, `aindaServe` responde
  `false` na leitura seguinte, e tudo é re-assinado como antes. TTL sem memória
  não muda nada; memória sem TTL também não.
- ⚠️ **O STORY NÃO HERDA OS SETE DIAS** (`VALIDADE_STORY_SEG` = 24 h). Ele
  **promete sumir em um dia**, e a URL assinada não pode sobreviver à promessa:
  sete dias dariam a quem guardou o endereço mais seis dias de acesso a uma coisa
  que a tela diz ter acabado.
- ⚠️ **A régua saiu de dentro do `for` por causa do TESTE.** Provar que a memória
  é lida exigiria trocar o módulo do Supabase, e `mock.module` do bun escreve num
  registro COMPARTILHADO entre arquivos — um teste que muda de resposta conforme
  a ordem é pior que teste nenhum (é por isso que a medição de ondas mora fora do
  `src/`). Enterrada, a única asserção possível era sobre o TEXTO, e **um
  `if (false && …)` passava por ela**. Pura, a mutação morre. Mesma lição de
  `assinatura.ts` e `buscar-paciente.ts`.

### 2 · O teto do vídeo caiu de 50 MB para 15

⚠️ **Um story de 50 MB visto por vinte pessoas é 1 GB de egresso por
publicação** — pago toda vez que alguém abre. 15 MB cobrem um minuto de 720p bem
comprimido, que é o que um celular de verdade produz; é o mesmo teto do WhatsApp,
e ninguém reclama dele.

⚠️ **A DURAÇÃO SOZINHA NÃO LIMITA NADA**: sessenta segundos podem ser 3 MB ou
400, conforme o bitrate. Os dois tetos medem coisas diferentes — tempo de atenção
e tamanho de download.

E o recado passou a dizer **o que fazer diferente** ("tente um trecho mais
curto"), com o número derivado da constante: "vídeo muito pesado" sozinho deixa
ela tentando o mesmo arquivo de novo.

### 3 · O story apagado leva o ARQUIVO junto

`apagarStory` apagava a linha e deixava ~270 KB no balde, **para sempre**, com um
comentário dizendo que "a varredura de exclusão de conta é quem limpa" — o que só
acontece se ela apagar a conta.

- ⚠️ **É AQUI QUE O STORY DIFERE DO POST, e o nome da função mente sobre isso:**
  `apagarPost` **ARQUIVA** — as reações apontam para a linha, e o arquivo tem de
  continuar existindo. Um story é apagado de verdade: nada aponta para ele, e ele
  já prometia sumir em 24 h.
- ⚠️ **Os caminhos são lidos ANTES do DELETE**, e por `storiesCrus` (a escada):
  depois do DELETE não há mais como saber que arquivos eram dela, e um `select` à
  mão com `imagens`/`video_path` falharia inteiro num banco atrasado — apagar um
  story deixaria de funcionar por causa de uma coluna que ninguém usou.
- ⚠️ **O `remove` vem DEPOIS do DELETE.** Invertido, um `remove` que desse certo
  com o DELETE falhando deixaria a linha viva apontando para um arquivo que não
  existe: o story vira um retângulo quebrado no visor.
- ⚠️ **Falha ao ler NÃO impede o DELETE, e falha no balde é SILENCIOSA.** Ela
  pediu para o story sumir; um arquivo órfão é infinitamente melhor que um story
  que ela mandou apagar e continua na tela.
- ⚠️ **A trava que torna isto seguro é a NOMEAÇÃO.** `guardarImagem` usa
  `crypto.randomUUID()`, nunca hash do conteúdo, e o story feito a partir de uma
  publicação **sobe uma cópia** (`storyComPost` refaz a foto pelo canvas) — então
  nenhum caminho é compartilhado com um post. No dia em que a nomeação virar
  endereçamento por conteúdo, este bloco passa a apagar a foto da publicação
  junto, e há teste onde isso aparece.

### 4 · A qualidade da foto: 0,80 → 0,72

Medido codificando a mesma imagem no canvas: **266 KB a 0,80 contra 197 KB a
0,72 — 26% a menos**, numa foto que a paciente vê a 393 pontos de largura. A
diferença entre as duas existe num monitor, com a imagem ampliada; na tela onde
esta foto de fato aparece, não.

- ⚠️ **Abaixo de 0,70 o JPEG mostra blocagem em PELE e em CÉU**, que é do que uma
  foto de gestação é feita. Por isso 0,72 e não menos.
- ⚠️ **O LADO CONTINUA EM 1080**, e essa foi uma sugestão minha que a verificação
  derrubou: 1080 é o que uma tela de densidade 3 pede a 393 pontos. Reduzir
  entregaria foto de bebê borrada, que é exatamente o que ela veio ver. O ganho
  seguinte não vem de espremer mais — vem de mandar menos PIXELS para quem tem
  tela de densidade 2, que é a escada de versões, e ela ainda não existe.
- ⚠️ **Um número só para as TRÊS** (publicação, story e capa de vídeo): aparecem
  no mesmo tamanho de tela, e três constantes divergiriam no primeiro ajuste.

### ⚠️ E TRÊS ASSERÇÕES MINHAS PASSARAM EM VAZIO — as três já catalogadas aqui

Os onze mutantes pegaram as três na primeira rodada:

1. **`indexOf` devolve −1 quando a linha é APAGADA, e `-1 < x` é verdadeiro.** A
   asserção "lê os caminhos antes do delete" ficou VERDE sobre um `apagarStory`
   sem leitura nenhuma. Quem conserta é `onde()`, que reprova o −1.
2. **Outra ocorrência do mesmo nome.** "O feed pede a validade longa" procurava
   `VALIDADE_FOTO_SEG` no corpo da função — e ela aparece também no `import`
   destruturado lá dentro, então tirá-la do ARGUMENTO passava verde. **Décima vez
   nesta base.**
3. ⚠️ **E `\([^)]*\)` para no primeiro `)`** — a chamada de `storiesDoFeed` tem
   um `.flatMap((l) => [...])` no meio, e a asserção "passa a validade certa"
   ficava verde sem nunca ter chegado ao argumento. Quem resolve é
   `argumentosDe`, que **conta parênteses**: exato, três linhas, e sem medir
   distância — que seria a armadilha de sempre.

### O que foi conferido e NÃO virou mudança

- **Reduzir o lado da foto do feed** — ver acima: 1080 está certo.
- **Apagar story vencido** — o ARQUIVO de stories lê justamente os vencidos;
  varrer seria apagar o recurso.
- **WebP em vez de JPEG** — medido 9% MAIOR aqui, mas a imagem do meu teste é
  cheia de ruído, o que é injusto com o WebP. É o único número desta leva do qual
  não se deve decidir; refazer com uma foto de verdade antes de mexer.
- ⚠️ **`createSignedUrls` (o plural) NÃO aceita `transform`** — só o singular
  aceita. Uma escada de versões por densidade de tela passa por aí, e é a próxima
  economia grande; ela não cabia nesta leva sem desfazer o ganho do lote.

## Duas economias que NÃO custam qualidade (ago/2026)

Pedido do dono: _"faça o que podemos para otimizarmos porém não perder a
qualidade"_. As duas abaixo são as únicas da lista de custo que passam nessa
régua — baixar o lado ou a qualidade da foto custa nitidez; estas não custam
nada.

### 1 · WebP no lugar de JPEG — mesma imagem, 30% a menos

Régua em **`src/lib/codificar-imagem.ts`**, que virou o único caminho por onde
uma foto do app vira bytes. Medido com imagem parecida com foto (degradê de
pele e céu, detalhe fino de cabelo e tecido):

| onde                             | JPEG   | WebP      |      |
| -------------------------------- | ------ | --------- | ---- |
| foto da publicação (1080 · 0,72) | 122 kB | **85 kB** | −30% |
| capa do vídeo (1080 · 0,72)      | 122 kB | **85 kB** | −30% |
| foto do álbum (800 · 0,75)       | 78 kB  | **62 kB** | −20% |
| miniatura da grade (480 · 0,75)  | 30 kB  | 28 kB     | −7%  |
| avatar (512 · 0,82)              | 55 kB  | 54 kB     | −2%  |

⚠️ **O ganho mora nas GRANDES.** Miniatura e avatar quase não mudam — não
custam nada e também não rendem nada. Quem paga a banda é a foto de 1080.

⚠️ **`toDataURL` FALHA EM SILÊNCIO, e é isso que obriga a sonda.** Um navegador
que não sabe codificar WebP **não devolve erro** — devolve um **PNG**, com o
mesmo formato de data URL. PNG de foto são megabytes: estouraria o teto do
servidor e a publicação seria **recusada**, com a paciente sem entender por
quê. A decisão nunca é "o navegador é moderno?", é **codificar 1×1 e ler o que
voltou**.

⚠️ **QUEM DECODIFICA NÃO É QUEM CODIFICA** — é o risco de verdade. O piso é
iOS 14 / Safari 14 (set/2020); Chrome e Android desde 2014, Firefox desde 2019.
E **este app já exige mais que isso**: o push só funciona em iOS 16.4+, dois
anos e meio DEPOIS do WebP. O formato não estreita o público — o push já
estreitou antes.

⚠️ **O NÚMERO DA QUALIDADE NÃO MUDA.** No WebP o mesmo número costuma entregar
imagem igual ou melhor; manter é o lado conservador — ganha-se banda sem
apostar em nitidez. Mexer nele é outra decisão, e é a que custa qualidade.

⚠️ **`share-card.ts` fica de FORA, de propósito.** Ele desenha o cartão que a
paciente MANDA PARA FORA — WhatsApp, Instagram, a galeria. Ali o destino é
outro app, às vezes outro sistema, e economizar 29% de uma imagem que sai uma
vez não paga o risco de ela não abrir do outro lado. Há teste cobrando que ele
continue em JPEG.

⚠️ **E EU TINHA DESCARTADO ISTO POR MEDIR ERRADO.** A primeira medição usou uma
imagem de RUÍDO puro e deu "9% maior" — ruído é o único conteúdo em que o WebP
perde, porque não há o que prever. **Medida de compressão com imagem sintética
mente**; use conteúdo com degradê e textura, ou uma foto de verdade.

### 2 · ⚠️ `loading="lazy"` NÃO SEGURA O EIXO HORIZONTAL

Medido no Chromium, numa página com o mesmo formato do carrossel: em seis
publicações de cinco fotos, ele baixa **três fotos de cada uma das cinco
primeiras** — **quinze arquivos** — enquanto a paciente vê UMA. O `lazy`
funciona descendo (as publicações lá embaixo não vêm) e não funciona para o
lado: as fotos 2 e 3 estão fora da tela e vêm assim mesmo.

⚠️ **`width`/`height` no `<img>` não muda nada** — medido com e sem, quinze nos
dois. O comentário que existia no repo sugerindo o contrário vale para outra
coisa (o pulo de layout), não para isto.

Quem segura é **não ter `src`**: `src={n <= ate + 1 ? u : undefined}`. O `<div>`
continua ocupando a largura inteira, então a geometria do encaixe não muda e o
carrossel não pula. **Medido depois: 15 → 10 downloads, −33%.**

⚠️ **A régua é "a da vez MAIS a seguinte", nunca só a da vez.** Segurar tudo
menos a primeira economizaria o dobro e cobraria em outra moeda: a foto
seguinte apareceria EM BRANCO durante o deslize numa rede ruim — e o deslize é
o gesto com que ela descobre que há mais foto. Numa publicação de ultrassom
isso é péssimo, e **"sem perder qualidade" inclui a resposta ao dedo**.

⚠️ **O limite só SOBE** (`Math.max(v, n + 1)`): com `setAte(n + 1)` cru, voltar
para a primeira descarregaria as outras, e folhear para trás baixaria tudo de
novo.

### O efeito somado, medido

Uma publicação de carrossel de cinco fotos, na abertura do feed:

|                | antes      | agora             |
| -------------- | ---------- | ----------------- |
| fotos baixadas | 3          | **2**             |
| bytes por foto | 122 kB     | **85 kB**         |
| **total**      | **366 kB** | **170 kB** — −54% |

Nenhum pixel a menos, nenhum lado reduzido, nenhuma qualidade rebaixada.

### ⚠️ E a catraca de ontem travava a GRAFIA — décima primeira vez

`toDataURL("image/jpeg", QUALIDADE_DA_FOTO)` × 3 ficou vermelha no dia em que
as três passaram por `codificarFoto` — **uma melhoria**: mesmo número de
qualidade, 30% menos bytes. Um teste que reprova código melhor é um teste que
ensina a relaxá-lo. Hoje ela cobra que as três usem o mesmo número e que
ninguém volte a codificar por fora.

**Catraca:** `src/lib/codificar-imagem.test.ts` — sete mutantes em vermelho,
inclusive o do PNG silencioso e o do carrossel voltando a baixar tudo.

## A NOITE PRÉ-LANÇAMENTO: dez pontos, e sete eram defeitos que ninguém via (ago/2026)

Pedido do dono antes de dormir: revisar o código inteiro, achar o que ainda pode
estar falhando ou pela metade, citar dez pontos e aplicá-los — com foco na aba
da paciente e em dar controle de verdade ao admin, "inclusive na visualização de
custos".

O método foi uma auditoria de dez lentes em paralelo (abas da paciente · porta e
chamador · coluna sem degrau · falha aberta · testes que mentem · painel do
médico · LGPD · iOS e hidratação · segurança clínica · custo), com céticos
independentes tentando REFUTAR cada achado. Ela produziu **49 achados brutos**.

⚠️ **E a fase de refutação estourou o limite de sessão** — 150 dos 178 agentes
morreram. Os achados que sobreviveram com três céticos são ouro; os outros eu
conferi um a um à mão, e **um deles era falso** (ver o fim desta seção).

### 1 · ⚠️ O LINK DO ÁLBUM CARREGAVA O TOKEN QUE ABRE O SOS COM GPS

O link que a paciente cola no grupo da família ia com o `token` do
acompanhante — que abre `getRecentPanicByToken`, ou seja, os SOS dos últimos 30
minutos **com latitude e longitude**. Em produção, para todas.

A causa era uma palavra: o select pedia `.select("token")`, então
`invites[0].album_token` era **sempre `undefined`** e o `??` caía sempre no
recuo — que não era recuo nenhum, era o caminho de todo mundo. O comentário ao
lado afirmava o contrário ("depois do SQL, `album_token` está preenchido"): está,
no BANCO; a consulta é que não o trazia.

E o mesmo defeito quebrava o álbum: `getFamilyAlbum` busca por `album_token`,
então o link com o token do acompanhante **não abria nada**. O recuo trocava um
álbum que não abre por um vazamento de GPS.

⚠️ **E A CATRACA QUE JÁ EXISTIA APROVAVA ISTO.** `sos-nao-vaza.test.ts` fazia
`slice(i, i+90).toContain("album_token")` — e a expressão defeituosa
`album_token ?? invites[0].token` **contém** essa string. Um teste com o nome
certo dando cobertura ao defeito que ele existia para impedir: as duas armadilhas
já catalogadas ("outra ocorrência do mesmo nome" e "cobre a garantia, nunca a
grafia") somadas.

Sem `album_token` o link **não sai**, e a tela explica: o álbum indisponível é
recuperável; o GPS espalhado no WhatsApp não é. E a frase da tela — "a família
acessa o álbum com o MESMO link do acompanhante" — **ensinava o defeito**.

### 2 · ⚠️ CINCO COLUNAS DO DIRECT EXISTIAM SÓ NO CÓDIGO

`silenciada_a/b`, `saiu_a/b` (em `rede_conversas`) e `imagem_path`, `ref_tipo`,
`ref_id` (em `rede_mensagens`) eram lidas e gravadas pelo app e criadas por
**nenhum arquivo SQL**. O código chegava a NOMEAR o responsável
(`APLICAR_CONVERSA_SILENCIAR`) em dois comentários; o arquivo nunca foi escrito.

⚠️ **Nada quebrava, e é isso que fez durar**: toda leitura do direct tem degrau
de recuo, então o app degradava em silêncio e três recursos ficavam
permanentemente mortos — **silenciar** uma conversa (o interruptor gravava no
nada e o push continuava chegando pelo mesmo canal do aviso de emergência),
**sair** de uma conversa, e a **foto e o anexo** da mensagem.

Escrito `supabase/APLICAR_CONVERSA_SILENCIAR.sql`.

**Catraca:** `coluna-tem-sql.test.ts`. Ela pergunta "esta coluna existe em ALGUMA
tabela do schema?" em vez de "existe NESTA tabela?" — a precisa é cega
justamente aqui, porque o `select` da conversa recebe uma VARIÁVEL montada numa
escada de degraus. ⚠️ **E ela passou em vazio DUAS vezes antes de morder**:
primeiro por só ler `.select("…")` com aspas (a conversa usa template literal),
depois porque a interpolação vira uma vírgula e deixa um pedaço vazio que
reprovava o literal inteiro.

### 3 · ⚠️ O PAINEL MOSTRAVA UM CUSTO DE IA INVENTADO

O cartão "Custo e margem de IA" fazia `brain_hits × 1 centavo` — contava só o
Segundo Cérebro (deixando de fora chat, triagem, transcrição, nota clínica e
advisor) e multiplicava por uma constante chutada, com um rodapé admitindo "é
uma estimativa". E `ai_usage` guarda `input_tokens`, `output_tokens`, `modelo`,
`canal` e `especie` desde que existe: **o dado do custo sempre esteve lá;
faltava alguém multiplicar.**

`custo-da-plataforma.ts` (régua pura) + `custo.functions.ts` + a aba **Custo** no
admin. Três avisos são obrigatórios na tela, e cada um existe porque um painel
financeiro erra numa direção só que importa — **para menos**:

- **`degradado`** — alguma leitura falhou. "Custo zero" parece lucro.
- **`truncado`** — o teto de linhas cortou o período.
- **`semPreco`** — modelo fora da tabela. O custo dele **não está no total**, e
  sem o aviso o painel some com uma fatia inteira justamente no dia em que
  alguém trocou o modelo.

⚠️ **`null` NUNCA vira zero**, a tabela de preço tem **data de conferência** (sem
ela, alguém lê "custo de agosto" seis meses depois e conclui que a margem
melhorou), e a **projeção não roda no dia 1** (regra de três sobre algumas horas
× trinta abriria o mês anunciando um custo dez vezes maior).

⚠️ E eu escrevi `.from("doctor_profiles")` — tabela que **não existe**, é
`doctors`. O PostgREST devolveria 42P01 e TODO médico apareceria como "(sem
nome)", sem erro nenhum.

### 4 · ⚠️ "A FILA CLÍNICA ESTÁ COMPLETA?" — o controle que cobre o pior desfecho

A view `clinical_events` é montada com doze guardas `to_regclass`: cada fonte só
entra se a tabela existir **no instante em que o SQL roda**. Desenho certo (um
`CREATE VIEW` sobre tabela ausente falharia inteiro), com um preço que nada
verificava — uma dependência de ORDEM entre arquivos que o dono roda à mão.

`saudeClinica` compara, fonte a fonte: a tabela tem linhas E a view devolve
linhas daquela fonte? Tem e não devolve = view velha, com a instrução do que
rodar.

⚠️ **"Sem dados" NUNCA vira "ok"** — tabela vazia não prova nada sobre a view. E
a caixa verde precisou de uma segunda volta: ela dizia "nenhuma fonte com dado
ficou de fora" numa base com tudo vazio — verdade literal, lida como aprovação
sobre uma checagem que não checou nada.

### 5 · ⚠️⚠️ O BOTÃO DE EMERGÊNCIA NÃO ABRIA PARA QUEM ESTÁ EM LUTO

`{emergencyOpen && !careMode && <EmergencySheet …/>}`. A paciente em Modo
Cuidado tocava no SOS da barra — que continua **aceso** —, o estado virava
`true`, e a folha simplesmente não montava. **O botão de emergência do app não
fazia nada, exatamente para quem mais precisa dele.**

Quem acabou de perder uma gestação está em risco clínico ALTO (hemorragia,
infecção, pré-eclâmpsia de pós-parto) e em risco psiquiátrico.

⚠️ **E A DECISÃO JÁ ESTAVA ESCRITA DENTRO DA PRÓPRIA FOLHA**, no comentário do
som do alarme: _"`podeSoar` deixa passar mesmo com o som desligado e mesmo em
Modo Cuidado — quem perdeu a gestação continua podendo passar mal"_. O
componente sabia; a tela que o monta fazia o oposto.

**A regra que fica: o Modo Cuidado existe para o app parar de FALAR DO BEBÊ,
nunca para parar de SOCORRER.** Ele governa conteúdo, nunca o acesso a um
caminho de emergência.

### 6 · ⚠️⚠️ A EPDS RESPONDIDA DENTRO DO APP NUNCA CHEGAVA AO MÉDICO

O pior defeito clínico que este repositório teve, e o único achado que os três
céticos independentes confirmaram sem ressalva.

A Escala de Edinburgh tem dez perguntas, e **a décima é ideação de autolesão**.
Havia DUAS telas rodando o mesmo questionário validado:

- **`/epds`**, a página PÚBLICA — chama `saveEpdsLog`, que carimba `doctor_id`,
  dispara o e-mail "🚨 EPDS URGENTE — {nome} relatou pensamentos de autolesão" e
  entra em `clinical_events` como gravidade GRAVE.
- **A aba Pós-parto** do app — chamava só `savePpdScreening`, que grava em
  `ppd_screenings`: uma tabela **sem coluna `doctor_id`**, fora da view, que
  nenhum caminho do médico lê.

Ou seja: a puérpera abria Pós-parto → Bem-estar (a sub-tela de ABERTURA),
respondia **"sim, tive pensamentos de me machucar"**, via a caixa vermelha com o
188 — e o obstetra dela não recebia nada. A mesma resposta, na página pública,
alertava.

E a tela prometia o contrário: _"o resultado deve ser compartilhado com o seu
médico"_.

⚠️ **A causa estrutural era de ARQUITETURA**: a régua do nível era a função
`interpret` DENTRO de `src/routes/epds.tsx`. A aba não podia importá-la — a
catraca `rotas-sem-export-solto` proíbe export não-rota num arquivo de rota, e
com razão. Foi assim que as duas telas divergiram.

`src/lib/epds.ts` é a régua pura (o nível, o índice da questão 10, os cortes 10
e 13), usada pelas duas. ⚠️ **A questão 10 GANHA do escore total, sempre**: uma
paciente pode somar 8 e ainda assim ter respondido que pensou em se machucar.

⚠️ E o retorno é **LIDO**: `saveEpdsLog` devolve `{ ok: false }` num 200 normal,
que um `try/catch` não pega. A tela diz "avisamos o seu médico agora" **ou** "não
conseguimos avisar" — e nos dois casos manda ligar 188 sem esperar a resposta
dele. "Avisamos" sobre um envio que falhou é a mentira mais cara desta tela: ela
para de procurar ajuda achando que já pediu.

### 7 · ⚠️ O PAINEL DO ACOMPANHANTE MOSTRAVA A GESTAÇÃO INTEIRA NO LUTO

O portão cobria SÓ o batimento — com o comentário certo e alcance curto.
Continuavam de pé: o título "Helena de Marina Costa", "Semana 28 e 3 dias · 81
dias para a DPP", a aba Bebê, a aba "Para o parto", e as dicas de "Apoiar
mamãe"/"Tarefas", que são **todas de gestação** ("acompanhe às consultas do
pré-natal", "lanches leves para o enjoo matinal").

No Modo Cuidado a fita fica vazia e entra um cartão sóbrio.

⚠️ **O texto NÃO conta o que aconteceu.** O Modo Cuidado pode ser ligado pelo
MÉDICO, e quem tem o link pode não saber de nada — um painel que anunciasse a
perda seria o app dando, por ela, a notícia mais íntima que existe.

⚠️ **A EMERGÊNCIA FICA**, e já vivia fora das abas: o alerta de SOS com
localização e o botão do SAMU.

⚠️ **E o TÍTULO só foi pego pela BANCADA.** Esta tela nasce de um token e nunca
teve uma: conferir o luto exigia conta de gestante, convite gerado e o luto
ligado numa conta real. Foi por isso que o portão ficou meses cobrindo só o
batimento. Agora: `/acompanhar/x?bancada=luto`.

### 8 · ⚠️ TRÊS LEITURAS QUE FALHAVAM ABERTAS

A pergunta de triagem: **"se esta consulta voltar vazia ou com erro, alguma coisa
fica mais PERMITIDA?"** Se sim, o erro tem de RECUSAR.

- **Marcar consulta** — a leitura do dia descartava o `error` e ia para
  `(doDia ?? [])`: falha de rede, ou `duration_minutes` faltando, devolvia lista
  vazia e **a consulta era marcada por cima de outra**. ⚠️ E o backstop do banco
  não cobre: o índice único parcial pega o INSTANTE exato, e a sobreposição
  (10:00–10:30 marcado, 10:15 pedido) passa por ele. A única coisa entre duas
  pacientes na mesma sala era essa leitura.
- **Cota de convites Premium** — `return count ?? 0` com o erro descartado
  virava "zero usados": `0 >= 25` é falso e o convite saía. Cada convite é **um
  ano de Premium grátis**.
- **Chá de bebê** — `if (p?.care_mode)` com `p` nulo é `undefined`: a lista
  continuava no ar depois de uma perda, para as trinta pessoas que já têm o
  link. É o recurso em que isso dói mais, porque o objeto vive FORA do aparelho
  dela.

### 9 · ⚠️ LGPD: o export sumia com dado dela, e apagar a conta deixava a agenda

- **O export engolia COLUNA ausente.** `if (code !== "42P01" && code !== "42703")`
  juntava duas coisas opostas: tabela ausente é normal num banco atrás das
  migrations (não há o que levar); **coluna ausente é o contrário** — a tabela
  está lá, com o que ela escreveu, e o select é que pediu errado. O bloco inteiro
  sumia com `falhas: []`: ela baixava um arquivo que PARECE completo, sem o
  perfil, e apagava a conta confiando nele.
- **Apagar a conta deixava nome, e-mail, telefone e observações** em
  `appointment_requests`. ⚠️ Apagar a linha seria a correção ERRADA (é o registro
  de que houve consulta naquele horário — dado do médico, legítimo);
  **anonimizar** é o que a LGPD pede. ⚠️ E `patient_email`/`patient_phone` são
  `NOT NULL`: mandar `null` faria a exclusão inteira falhar — um vazamento
  trocado por um bloqueio.

### 10 · ⚠️ A FILA DE DENÚNCIAS ERA INALCANÇÁVEL

As duas pontas estavam certas sozinhas: `denunciasAbertas` só admite
`ADMIN_EMAILS` (correto — a fila mistura texto denunciado de pacientes de vários
médicos), e `/painel` redireciona o super-admin para `/admin` (correto — a conta
da plataforma não é médico). **Somadas, a única pessoa autorizada a ver a fila
era expulsa da única tela que a mostrava.** Ela mudou para `/admin` → Moderação.

A catraca cobra as QUATRO pontas, porque afrouxar qualquer uma "conserta" o
sintoma e reabre o problema pelo outro lado.

### ⚠️ E UM DOS DEZ ERA FALSO — o que me fez conferir todos à mão

A auditoria afirmou que "não existe jeito de desligar os avisos dentro do app — a
função que faz isso tem zero chamadores". **É falso**: `ConfiguracoesDoPerfil`,
onde vivem os interruptores, é renderizada em `tab === "Comunidade"`, e o
servidor É chamado. A fase de refutação nunca rodou nesse achado (limite de
sessão), e ele teria me feito "consertar" algo que funciona.

**A régua que fica: achado sem cético é hipótese.** Nesta base, conferir custa
minutos e acreditar custa mexer em código correto num app que roda em produção.

### As armadilhas de teste que apareceram nesta noite

Todas já catalogadas, todas cometidas de novo — por mim:

1. **`slice(i, i+90).toContain("album_token")`** aprovava
   `album_token ?? invites[0].token`, porque a expressão CONTÉM a string.
2. **Janela de 1.200 caracteres** para achar um bloco — medir distância mente no
   dia em que alguém acrescenta uma linha.
3. **`.select("token")` só com aspas** deixava a catraca cega para template
   literal.
4. **A interpolação vira vírgula** e deixa um pedaço VAZIO que reprova o literal
   inteiro — a catraca ficava vazia justamente para a tabela que a criou.
5. **`handleSubmit` sem âncora de seção** pegou a função do ÁLBUM num arquivo de
   vinte mil linhas.
6. **`toContain("saveEpdsLog")`** passava com o import trocado por uma função de
   mentira — hoje se cobra o MÓDULO.
7. **`profile.care_mode && (`** casa dentro de `!profile.care_mode && (`.
8. **`"sos-falhou"` aparece três vezes**, uma na prosa — a mutação da CHAMADA
   passava verde.
9. **Proibir "espere a resposta dele"** reprovava "**não** espere a resposta
   dele", que é a instrução certa.
10. **Duas catracas antigas travavam a GRAFIA** (`.select("…")` literal e
    `if (p?.care_mode)` exato) e **reprovaram consertos estritamente mais
    fortes** — a décima segunda vez nesta base.

⚠️ **E a catraca de recuo me pegou**: escrevi `42703` no tratamento de um
UPDATE, e em caminho de ESCRITA o código é `PGRST204`.

### ⚠️ E o portão local pode reprovar por motivo alheio ao código

`bun run verificar` falhou uma vez com o `tsc` "vermelho" e a linha dele
AUSENTE da saída: era um `npm notice` atropelando a captura. Um portão que
reprova por motivo alheio ao código é um portão que as pessoas aprendem a
ignorar — e no dia em que o vermelho for de verdade, ele é ignorado junto.

**Aplicar no Supabase:** `supabase/APLICAR_CONVERSA_SILENCIAR.sql` (as cinco
colunas do direct — sem ele, silenciar, sair, a foto e o anexo continuam
mortos).

## A auditoria das promessas da Comunidade (ago/2026)

Pedido do dono: rever se tudo que a aba PROMETE está de fato certo. O método foi
mecânico de propósito — este arquivo registra cinco vezes em que afirmei de
memória e errei —: extrair as promessas que a tela faz POR ESCRITO e conferir
cada uma contra o código.

**Sete promessas de silêncio conferidas e cumpridas.** Silenciar, restringir,
favoritar, esconder story, bloquear, tirar seguidor e denunciar dizem "ela não é
avisada", e nenhuma das sete toca `registrarAtividade` ou `sendPushToUser`.

⚠️ **E uma acusação minha caiu na conferência:** eu ia reportar que o CHECK de
`rede_atividade.especie` estava incompleto. Estava completo — meu `grep` era por
LINHA e a lista é multi-linha. A prosa do CLAUDE.md estava certa.

### ⚠️ 1. "A GENTE VAI OLHAR" — e ninguém olhava

`denunciarComentario` gravava `rede_comentarios.denunciado_em`, **coluna que
nenhuma consulta do repositório lia**, e a tela respondia "Denunciado. A gente
vai olhar."

É palavra por palavra o defeito que o post e o perfil já pagaram aqui
("`denunciado_em` era gravada e NENHUMA consulta a lia") — consertado num
caminho e deixado de pé no outro. E no pior lugar possível: **o comentário é
onde mora o conselho clínico de leiga**, que é a razão inteira de esta aba quase
não ter comentários.

⚠️ **`rede-tem-porta.test.ts` não tinha como pegar**: a função TEM porta e TEM
chamador. O que faltava era leitor do que ela grava — outra pergunta, outra
catraca (`denuncia-tem-leitor.test.ts`).

- Agora entra em `rede_denuncias`, que é o que `denunciasAbertas` lê.
- ⚠️ **O motivo virou catálogo fechado**, como nas outras três portas: é ele que
  ordena a fila, e campo livre numa denúncia de app de gestação é onde alguém
  escreve a informação clínica de outra pessoa. A folha passou a ser a MESMA
  `EscolherMotivo` — duas folhas divergiriam no primeiro ajuste de catálogo.
- ⚠️ **O trecho é congelado**, senão a linha da administração apontaria para um
  texto que ela pode ter editado ou apagado.
- ⚠️ **O carimbo sem leitor SAIU.** A catraca nova o acusou no mesmo instante em
  que nasceu — é o mesmo `avisada_em` removido no dia anterior, e manter os dois
  critérios diferentes seria incoerência. A repetição é barrada pelo índice
  único de `rede_denuncias` (alvo, alvo_id, quem_id), não por um carimbo mudo.

### ⚠️ 2. A FILA CHAMAVA MENSAGEM PRIVADA DE "PUBLICAÇÃO"

`fila-de-denuncias.tsx` rotulava `d.alvo === "perfil" ? "perfil" : "publicação"`
— escrito quando só existiam esses dois alvos. Depois a rede ganhou comentário,
pergunta, story, mensagem e conversa.

⚠️ **Uma denúncia de MENSAGEM PRIVADA — onde o assédio de verdade acontece —
chegava ao administrador como "publicação".** Ele procuraria um post público,
não acharia nada, e descartaria. A denúncia era registrada e ilegível.

`rotuloDoAlvo` dá nome aos sete. ⚠️ **Desconhecido devolve o próprio valor**,
nunca "publicação": alvo novo mal rotulado é ruído; alvo novo rotulado como
OUTRA COISA é o defeito de novo com outro nome.

⚠️ **E `AlvoDaDenuncia` ainda era `"post" | "perfil"`** — a união estreita que
causou tudo isto. Virou a completa, e a catraca cobra TypeScript e SQL juntos.

### ⚠️ 3. A MINA DO CHECK, DE NOVO — e o arquivo que a NOMEIA a cometia

Três `APLICAR_*.sql` reescrevem `rede_denuncias_alvo_check` com DROP+ADD, com
**três listas diferentes**: 5, 6 e 7 alvos. O dono os roda à mão, em qualquer
ordem, e a documentação manda re-rodar. O último a rodar manda:

- `APLICAR_MAIS_DEZ` depois de `APLICAR_DIRECT_COMPLETO` → perde `'conversa'`, e
  denunciar uma CONVERSA passa a ser recusado pelo banco;
- `APLICAR_DEZ_DA_REDE` por último → perde `'story'` também.

⚠️ **E a ironia está escrita no arquivo:** o comentário de `APLICAR_DEZ_DA_REDE`
diz "o CHECK é reescrito COM A LISTA COMPLETA … é o defeito que
`rede_atividade_especie_check` já teve aqui" — e a lista dele envelheceu, porque
`especie` tinha catraca e `alvo` não.

**A régua vale para qualquer CHECK reescrito por mais de um arquivo: toda lista
é a COMPLETA, e existe catraca.** `alvos-da-denuncia.test.ts` é a irmã de
`especies-da-atividade.test.ts` — cobra as três listas, a união do TypeScript, o
que o app de fato grava, e os rótulos da fila. Dez mutações conferidas em
vermelho.

### 4. A folha de motivo abria fora da dobra

Medido na bancada: tocar no ⋯ do PRIMEIRO comentário de dez punha a folha em
y≈840 num viewport de 852 — a paciente toca e nada acontece à vista, e a leitura
razoável é "o botão não funcionou". `scrollIntoView` no efeito: **y=205**.

**Bancada:** `/preview-instagram?tela=comentarios` → ⋯ em qualquer comentário
que não seja seu.

### ⚠️ 5. ARQUIVAR UMA CONVERSA NÃO FAZIA NADA

A segunda varredura — promessas de TEMPO — achou o gêmeo do defeito acima.

`arquivarConversa` gravava `arquivada_a`/`arquivada_b`, o `select` de
`minhasConversas` trazia as duas colunas, e **nenhum leitor as consultava**. O
filtro da lista tratava `saiu_*` e ignorava `arquivada_*`.

A paciente tocava em "Arquivar", recebia **"Arquivada. Volta se ela escrever."**
— e a conversa continuava exatamente onde estava. Recurso inteiro decorativo,
com confirmação de sucesso por cima. E não havia gaveta: nada, em lugar nenhum.

- A régua é a MESMA do "sair", e por isso mora ao lado dele: some da lista
  enquanto nada novo chegar, e volta sozinha quando a outra escrever. ⚠️ É por
  isso que a coluna guarda um INSTANTE — com booleano, arquivar seria o "sair"
  de novo.
- ⚠️ **O PEDIDO não é arquivável** (`c.aceita` no portão): quem ainda não foi
  aceita mora na caixa de pedidos, e sumir de lá tiraria da vista justamente o
  que precisa de decisão.

⚠️ **E a primeira versão do teste passou verde sobre a mutação que troca a
comparação por um booleano** — a janela de 200 caracteres alcançava o
`ultima_em` do `saiu_*` vizinho. A âncora começa na declaração e para no
`return false` dela. É a armadilha de substring, pela enésima vez: **janela
larga é asserção que mente.**

### O que a varredura NÃO achou

As promessas de **privacidade** e **alcance** estão cumpridas, conferidas uma a
uma: a busca filtra `perfil_publico` na CONSULTA (mais `podeAparecerNaBusca`
depois), `escondeuDeMim` recorta os stories ANTES da leitura, e
`conjuntoDeBloqueio` falha FECHADO. As de TEMPO também: `alvo_id` não tem
`REFERENCES`, então "o story some em 24 horas; a denúncia fica" é verdade mesmo
quando ela apaga o story.

### ⚠️ 6. E A VARREDURA DO PADRÃO — porque ele apareceu QUATRO vezes

Quatro defeitos da mesma família numa noite não é coincidência: é classe. Duas
varreduras mecânicas sobre a rede inteira.

**"Coluna escrita e nunca lida"** — uma só sobreviveu, e ela NÃO é defeito:
`rede_perguntas.respondido_em`. O que a torna diferente de `denunciado_em` é que
`resposta` é escrita no mesmo `update` e É lida — o estado "respondida" aparece
na tela por ela. Metadado sem leitor, não promessa quebrada; e removê-la
custaria um `ALTER` sobre dado vivo. Fica registrada, sem mexer.

**"A tela diz 'pronto' sem olhar a resposta"** — duas, e uma era real.

⚠️ **`desarquivarPost` descartava o resultado, e o `try/catch` NÃO pega
`{ ok: false }`** — ele vem numa resposta 200 NORMAL. A pintura otimista tirava
a publicação da gaveta, o `catch` não disparava, o feed recarregava sem ela: a
paciente ficava sem a publicação nas DUAS listas, **sem nenhum recado**, e a
conclusão razoável é que ela a perdeu.

A outra (`denunciarComentario`) descarta de propósito e continua assim — o
comentário ao lado explica: dizer "não deu para denunciar" ensina que a denúncia
pode falhar, e quem denuncia um comentário duro não precisa dessa dúvida.

⚠️ **E duas acusações minhas caíram na conferência** — o CHECK de `especie`
(meu `grep` era por linha, a lista é multi-linha) e o portão da busca (meu
`head -3` cortou a ocorrência que importava). **Varredura mecânica também erra;
o que não erra é abrir o arquivo antes de acusar.**

## A noite da moderação: o ciclo fecha, e o admin passa a enxergar (ago/2026)

Pedido do dono: aplicar as sugestões, ampliar o controle de dados no admin, e
varrer a aba inteira — "que quando eu acordar ela esteja 100% sem erros".

⚠️ **E UMA SUGESTÃO MINHA FOI CANCELADA ANTES DE VIRAR CÓDIGO.** Eu tinha
sugerido "unificar as duas filas de denúncia, que estão em duas telas". Elas já
estão numa tela só, em duas seções, separadas de propósito: a da caixinha é
ANÔNIMA por contrato, e fundi-las obrigaria a esconder o nome de metade das
linhas sem explicar por quê. Conferir antes de construir, mais uma vez.

### O ciclo da moderação não fechava em três pontos

1. ⚠️ **O DESFECHO NUNCA ERA MANDADO.** O servidor aceita
   `removido | avisado | sem_acao`; a tela chamava sem nenhum. Toda denúncia era
   resolvida como "sem ação", e a tela "Suas denúncias" da paciente dizia "ainda
   não olhamos" **para sempre**.
2. ⚠️ **"REMOVIDO" NÃO REMOVIA NADA.** O desfecho volta para quem denunciou:
   dizer "a publicação saiu do ar" sem tirá-la do ar é a plataforma mentindo
   para quem confiou nela — e a paciente veria, no feed, a mesma publicação.
   Agora ele dá baixa no alvo, **ARQUIVA e nunca apaga** (remoção por engano tem
   de ser desfazível), e **falhar em remover NÃO vira "removido"**: a denúncia
   fica na fila e o administrador sabe.
3. ⚠️ **A FILA NÃO TINHA CONTADOR.** Ela vive dentro da aba de entrada, então
   quem estivesse noutra aba não sabia que ela cresceu. `contarDenunciasAbertas`
   conta as DUAS filas com os mesmos filtros das telas (um número que diga 3
   sobre uma lista de 2 faz o médico procurar uma denúncia fantasma), com
   `head: true` — o trecho do que foi dito não precisa viajar para virar um
   número — e devolve **`null`, nunca zero**.

⚠️ **"Remover" só aparece onde HÁ publicação a tirar do ar** (`PODE_REMOVER`):
num perfil, numa pergunta ou numa mensagem não há. E o mapa alvo→tabela é DADO
em `denuncias.ts`, porque `rede-social.functions.ts` **não conhece comentário** —
o teste que guarda essa separação pegou a primeira versão.

### O controle do admin, e a linha que ele NÃO atravessa

⚠️ **A tentação óbvia ao "dar mais controle de dados" é uma tela com tudo que a
paciente publicou.** Seria fácil, e transformaria moderação em VIGILÂNCIA: a
Comunidade é onde ela escreve para o público que ELA escolheu.

A régua: o admin vê **o que foi denunciado** (e que ele já veria na fila), **o
estado da conta** e **contagens**. Nada mais. O select do perfil não traz bio,
foto nem semana; a ficha não lê `rede_posts`, `rede_stories` nem
`rede_mensagens`; e a tela DIZ o que não está ali. Há catraca com mutação.

- **Ficha de moderação** — quantas denúncias, como terminaram, desde quando a
  conta existe, e em que estado está. Decidir "avisar" ou "remover" sem isso é
  decidir às cegas: a fila mostra UMA linha, e a conta pode ter cinco resolvidas
  na semana passada.
- **Números da Comunidade** — seis contagens no painel. A aba mais movimentada
  do app não tinha NENHUM número ali, e uma aba social que esfria esfria em
  silêncio. ⚠️ Só as denúncias são alerta quando sobem; os outros cinco são bons
  quando crescem, e pintar todos igual ensinaria a não olhar nenhum.

### Suspender uma conta — o degrau acima de remover uma peça

⚠️ **SUSPENSA ≠ EM LUTO ≠ PAUSADA, e as três somem pela MESMA régua.**
`foraDaRede` ganhou a terceira razão em vez de um `if` em cada um dos vinte e
seis pontos de decisão. O que as separa é QUEM DECIDIU — e por isso a suspensão
é a ÚNICA em que o app FALA: pausa e luto são escolha dela, e calar é a decisão
certa; uma conta suspensa que some sem uma palavra faz a paciente concluir que o
app quebrou.

- ⚠️ **NUNCA suspende quem está em Modo Cuidado**: ela já está fora da rede, e
  suspender seria punir quem acabou de perder a gestação por algo escrito antes.
  O estado é conferido no BANCO, e **não conseguir lê-lo NÃO suspende**.
- ⚠️ **O texto da paciente diz o FATO, diz que nada foi apagado, diz que o resto
  do app não muda, e dá um caminho — sem uma palavra de acusação.** Há teste com
  termos proibidos: um texto de tribunal numa tela de app de saúde é crueldade
  desnecessária.
- ⚠️ **A coluna é REVOGADA de `authenticated`** — `patient_profiles` é escrita
  direto do navegador, e sem o REVOKE quem foi suspensa levantaria a própria
  suspensão sem passar pelo servidor.
- ⚠️ **O push não diz o motivo**: a tela de bloqueio é o pior contexto que
  existe. O motivo fica na FICHA, para quem revir a decisão.

### ⚠️ Dois portões de aviso falhavam ABERTOS, e um era desmentido pelo comentário

- **O push da favorita ignorava o bloqueio quando a leitura falhava.** O
  comentário dizia, com todas as letras, que "um push meu chegando nela seria o
  bloqueio falhando pelo caminho mais visível possível" — e o erro era
  descartado. Push é enfeite; o bloqueio, não.
- **O aviso de menção tratava perfil ilegível como "não está de luto"**: com
  `autor` nulo, `emCuidado` virava `false` e o aviso saía sobre uma publicação de
  quem acabou de perder a gestação.

⚠️ **E DOIS FALSOS ALARMES MEUS, medidos em vez de deduzidos:**
`patient_profiles` usa `id` corretamente (o `user_id` que meu grep pegou era de
`health_logs`), e o tempo relativo **não sai no HTML do servidor** — a Comunidade
é cliente, então não há risco de hidratação ali. Varredura mecânica também erra.

### ⚠️ A VARREDURA PASSOU A TOCAR NOS CONTROLES

`varrer-bancadas` abre cada tela e lê o console. Não pega o que só existe depois
de um toque — e foi ali que a **barrinha do story** escondeu um defeito: o objeto
de estilo misturava o atalho `animation` com o longhand `animationPlayState`, e
numa REPINTURA o atalho REESCREVE o play-state: a barra voltava a correr sozinha
enquanto o dedo a segurava, chegando ao fim antes de a foto trocar — exatamente
o travamento que o comentário do bloco diz impedir. Virou cinco longhands.

`scripts/varrer-interacao.mjs` (`bun run varrer:interacao`, e na CI) roda onze
roteiros e cobra o CONSOLE durante a interação. ⚠️ **Os passos são OPCIONAIS de
propósito**: um roteiro que exija um controle que mudou de nome fica vermelho
sobre código correto, e catraca que reprova o certo é catraca que alguém desliga.

### ⚠️ A catraca do padrão, e ela me pegou em minutos

Cinco defeitos da mesma família numa auditoria não é coincidência: é classe.
`escrita-tem-leitor.test.ts` cobra que toda coluna de estado escrita pelos
módulos da rede tenha ALGUÉM que a leia — `rede-tem-porta` não pega, porque lá a
pergunta é "existe chamador?" e nestes casos existia.

⚠️ **Ela reprovou `rede_suspensa_motivo`, que eu tinha criado minutos antes.**
Virou leitura (a ficha mostra por que a conta foi suspensa — sem isso, rever a
decisão dias depois vira adivinhação) e o motivo passou a ser ESCOLHIDO, catálogo
fechado como nas outras quatro portas.

⚠️ **E isso destapou uma restrição de arquitetura:** importar `EscolherMotivo` de
`rede-instagram.tsx` puxaria a régua clínica para o pacote do PAINEL — ela tem
`(?<!` nas fronteiras e derruba Safari antigo. A catraca que guarda isso ficou
vermelha na hora, e o componente virou `escolher-motivo.tsx`.

**Aplicar no Supabase:** `supabase/APLICAR_SUSPENDER_DA_REDE.sql`.
**Bancadas novas:** `/preview-moderacao` (`?ficha=1`, `?ficha=1&suspensa=1`,
`?falhou=1`, `?instavel=1`, `?vazio=1`) · `/preview-instagram?suspensa=1`.
**Medido:** 106 bancadas · 64 telas da Comunidade · 11 roteiros de interação ·
5.210 testes · zero problemas.

## A noite pré-apresentação, parte 2: sete recursos que não existiam (ago/2026)

Continuação da varredura da noite. O que segue não são melhorias — são recursos
que o app **prometia e não entregava**, e defeitos que faziam a tela afirmar
coisas falsas. Todos falhavam em silêncio, com a suíte verde e o `tsc` limpo.

### ⚠️ A classe que dominou a noite: "não consegui ler" com cara de "não há nada"

Ela apareceu **quatro vezes**, em telas diferentes, e a régua de triagem é
sempre a mesma: **"se esta leitura voltar vazia, o app AFIRMA alguma coisa que
ela não tem como saber que é falsa, e que muda o que ela faz a seguir?"**

| onde               | o que a tela dizia                  | o custo                               |
| ------------------ | ----------------------------------- | ------------------------------------- |
| busca de obstetra  | "Nenhum médico com esse nome"       | ela para de procurar o próprio médico |
| cartão da agenda   | "Nenhuma consulta marcada ainda"    | ela falta à consulta                  |
| aba Consultas      | "Agende a primeira — leva 1 minuto" | ela marca uma SEGUNDA                 |
| emissões do médico | lista vazia                         | receita repetida, exame repetido      |

⚠️ **A da busca é a pior**, porque a afirmação é sobre o MUNDO REAL: o obstetra
dela existe, está cadastrado, e o app diz que não. E o servidor já distinguia
(`{ ok: false, error }`) — a tela é que jogava fora. É a correção que a
Comunidade ganhou meses antes (`motivo: "instavel"`), deixada de pé em todo o
resto do app.

⚠️ **A da agenda contradizia o próprio app:** o push do servidor continuaria
dizendo "consulta amanhã" enquanto a tela dizia que não havia nenhuma.

**Os textos novos dizem de quem é a culpa** ("isso é a nossa conexão") e o que
continua valendo ("se você tem consulta marcada, ela continua marcada"). Há
teste com lista de termos proibidos: o app pode dizer que ELE falhou, nunca
induzir a conclusão cujo custo é uma falta.

### ⚠️ E a outra classe: função de servidor sem porta — pela SEXTA vez

`generateInviteCode`, `getMyInviteInfo`, `listDoctorAddresses`,
`emissoesDaPaciente`, `shouldAskNps`, `submitNps` — seis funções escritas,
testadas, e **inalcançáveis no app**. Cada uma era um recurso inteiro que não
existia:

- ⚠️ **O app pedia um código que ninguém conseguia gerar.** Três telas da
  paciente dizem "Digite o código do seu médico" e prometem um ano de Premium.
  Ela pedia, ele procurava no painel e não achava, e a conclusão razoável dela
  era que ele não quis dar.
- ⚠️ **A paciente nunca via onde o médico atende.** Ele cadastra vários
  consultórios; ela via um campo de texto solto — e, depois de vinculada,
  endereço NENHUM. O custo é ela ir ao lugar errado.
- ⚠️ **O médico não via o que ele mesmo receitou.** Na consulta seguinte ele
  decide o que pedir sem enxergar o que pediu no mês passado.
- ⚠️ **O NPS não tinha como receber uma resposta.** O relatório do admin ficava
  em ZERO para sempre — o painel parecia funcionar e media o vazio.

**`src/lib/servidor-tem-porta.test.ts` fecha a classe inteira.** Ela varre todos
os `*.functions.ts` (`rede-tem-porta` só cobria a rede), **nomeia** a dívida que
já existia em vez de exigir um mutirão, e a lista **só pode encolher** — há
teste recusando uma entrada que já ganhou porta. Ela mordeu duas vezes no mesmo
turno, cobrando a remoção das que acabaram de ser ligadas.

### As decisões de produto que essas telas exigiram

- ⚠️ **O botão de gerar convite DESLIGA na cota esgotada e NÃO na ilegível** — e
  isso é o oposto da decisão do presente entre amigas, de propósito: lá o
  servidor não tem limite, e desabilitar pela contagem seria "o limite de volta,
  agora só na tela". Aqui o servidor recusa, então o botão aceso mente. Na
  contagem ilegível ninguém sabe se acabou.
- ⚠️ **`cota_ilegivel` não é dito como "acabou"** — faria o médico parar de
  tentar num mês em que ele ainda tem convites.
- ⚠️ **Sem endereço cadastrado a seção não existe** — nunca "nenhum consultório
  cadastrado": ela não pode fazer nada com essa frase, e ela insinua um problema
  com o médico dela que provavelmente não existe.
- ⚠️ **O mapa abre por `https://`**, nunca `geo:`/`maps:` — o esquema nativo não
  existe no navegador e num PWA instalado o link não faria nada. Mesma lição do
  `itms-apps://`.
- ⚠️ **O NPS NÃO aparece depois de uma conquista.** A tentação é perguntar no
  momento bonito porque a nota sobe — e é por isso que não se faz: **NPS é
  instrumento de MEDIDA**, e uma medida enviesada para cima é pior que medida
  nenhuma, porque o dono decide com ela achando que é real.
- ⚠️ **Agradecimento ÚNICO.** "Avalie na loja" para quem deu 10 é o _review
  gating_ que a diretriz 1.1.7 da App Store proíbe; e texto diferente por nota
  ensina que a nota mudou o tratamento que ela recebe.
- ⚠️ **Conta nova não é perguntada** (14 dias). O único corte era "90 dias desde
  a última resposta": quem criava a conta era perguntada na primeira abertura, e
  a resposta mediria a expectativa dela, não o produto.

### ⚠️ E o Modo Cuidado ainda tinha buracos

- **A grade da aba Bebê era usada crua**: no luto a paciente continuava vendo
  **Contagem** (regressiva para o parto), **Nomes** (a votação do nome) e
  **Enxoval**. O componente já RECEBIA `careMode` e o repassava para dentro de
  duas sub-telas; o que faltava era a própria grade olhar para ele.
  ⚠️ **O álbum FICA** — as fotos são a memória do que houve. ⚠️ **E o
  `initialSub` passa pela mesma régua**: sem isso o ladrilho sumia e a tela abria
  assim mesmo, por link.
- ⚠️ **"Não sei" tinha de virar `undefined`, e não `false`.** A prop `careMode`
  do Perfil é `boolean` puro: antes de o perfil carregar ela vale "não está de
  luto". Quem sabe a diferença é `profile === null`.

### ⚠️ Os marcos do bebê diziam "pronto" sem olhar a resposta

`setMilestone`/`removeMilestone`/`addBabyWeight` devolvem `{ ok: false }` numa
resposta **200 NORMAL** — um `try/catch` não pega. A tela pintava o ✓ e nunca
corrigia: a mãe registrava o primeiro sorriso, fechava o app, e na abertura
seguinte não havia nada. **É o livro de memórias do bebê** — quando ela
descobre, a data já passou.

⚠️ **E a irmã ao lado — a caderneta de VACINAS — já estava consertada**, com o
comentário do conserto visível na mesma tela. É a forma mais comum de defeito
deste repositório: a régua aplicada num lugar e deixada de pé no vizinho.

### ⚠️ Duas travas de contrato falhavam abertas

- **A vaga corporativa**: `count ?? 0` fazia `0 >= max_seats` ser falso, e
  qualquer falha de leitura CONCEDIA a vaga. Cada vaga é um acesso pago que a
  empresa não comprou.
- **A cota de convites Premium** (consertada na primeira metade da noite): cada
  convite é um ano de acesso gratuito.

### ⚠️ E as armadilhas de teste, de novo — com uma nova

Todas as antigas reapareceram (outra ocorrência do mesmo nome ×3, janela de
distância ×2, prosa quebrando busca de texto, `indexOf` devolvendo −1). E duas
novas, do **extrator de corpo por contagem de chaves**:

1. ⚠️ **`createServerFn({ method: "POST" })`** — o primeiro `{` é o objeto de
   opções, e o extrator devolvia `{ method: "POST" }`: a mutação passou VERDE.
2. ⚠️ **`.handler(async ({ data }) => {`** — devolvia `{ data }`: a asserção
   ficou VERMELHA sobre código certo.
3. ⚠️ **E o marcador COM a chave junto** (`"=> {"`) começa a contagem na chave
   SEGUINTE. Três voltas pelo mesmo extrator, nas duas direções do mesmo engano.
4. ⚠️ **Num `return (` de JSX o primeiro `{` é uma EXPRESSÃO** — ali o que
   garante o lugar é a CONTENÇÃO entre esta função e a próxima, não a extração.

⚠️ **E a mutação achou uma guarda MINHA que não fazia nada:** o `if (quando >
agora) return false` do adiamento do NPS era código morto — a subtração já dá
negativo e reprova. **Código morto com um comentário afirmando uma proteção é
armadilha para quem ler depois.** A guarda saiu, a prosa passou a dizer a
verdade, e o teste ganhou o caso de 120 dias, que é o único que morde se alguém
puser um `Math.abs` ali.

### ⚠️ E duas medições minhas mentiram

- A checagem de "a página carregou" era **sensível a caixa** (o título vem em
  maiúsculas por CSS) e contava como defeito o `ERR_FAILED` do **abort de fontes
  do próprio instrumento**. Seis telas certas foram reprovadas.
- Antes disso, uma varredura imprimiu **✅ sobre um `ERR_CONNECTION_REFUSED`**:
  o servidor de dev tinha caído e o script só olhava exceções de página.
  **Marcar sucesso sem conferir que a página carregou é a mesma falha aberta que
  a noite inteira passou consertando.**

### O que a FOTO pegou, e nenhum teste pegaria

- **O botão de gerar convite ficava ACESO com a cota esgotada** — a tela dizia
  "0 de 25 disponíveis" e ele tocava para o servidor recusar.
- **Onze notas do NPS numa linha davam 26px de largura** (11 × 44 = 484px numa
  tela de 393). Duas fileiras: 50×44.

**Aplicar no Supabase:** nada novo — tudo sai de tabelas e colunas que já
existem. Continua pendente `supabase/APLICAR_CONVERSA_SILENCIAR.sql`.

**Bancadas novas:** `/preview-convites?estado=normal · esgotada · ilegivel ·
semplano · falhou · carregando` · `/preview-consultorios?estado=dois · um ·
magro · vazio · falhou · carregando` · `/preview-emissoes?estado=algumas ·
muitas · vazio · degradado · falhou · carregando` · `/preview-nps?fase=…&nota=9`.

**Medido ao fim:** 5.406 testes · 112 bancadas · 11 roteiros de interação · zero
problemas.

### ⚠️ A varredura da falha aberta: SETE numa noite, e a régua que as separa

A classe apareceu tantas vezes que virou varredura mecânica da forma exata
(`const { count } = await` e `const { data } = await` sem o `error`). **Treze
sítios de contagem no `src/` inteiro; onze são NÚMERO INFORMATIVO** — quatro
deles já dizem isso no próprio comentário ("contagem é informativa — não derruba
o perfil"). Mexer nos onze seria churn.

⚠️ **A régua de triagem NÃO é "o erro foi olhado?".** É:
**"se esta leitura voltar vazia, alguma coisa fica mais PERMITIDA?"**

As sete que ficam:

| onde                                  | o que a falha permitia                                       |
| ------------------------------------- | ------------------------------------------------------------ |
| vaga corporativa                      | uma vaga acima do contrato — acesso pago que ninguém comprou |
| cupom da plataforma                   | resgate acima de `max_redemptions`                           |
| cota de convites Premium              | um ano de acesso grátis por clique                           |
| teto diário de convites (amigas)      | o campo de e-mail virando ferramenta de spam                 |
| mesada da criadora                    | distribuir sem teto enquanto a leitura não voltasse          |
| arquivar item do chá                  | apagar um item por cima de uma reserva viva                  |
| **interruptor de emergência do dono** | **o kill switch ficando inoperante**                         |

⚠️ **O do kill switch é o mais fino, e o pior.** A ausência de linha vale
"ligado" — certo, uma feature nova não pode quebrar num banco atrás das
migrations. O defeito era tratar **falha de leitura** como ausência e **GRAVAR
essa falha no cache por trinta segundos**: o dono desliga algo que está causando
dano, o banco oscila, e cada expiração re-grava a mesma mentira. Hoje a tabela
ausente continua valendo "ligado" e é cacheada; qualquer outro erro **serve o
último valor conhecido e não escreve no cache**.

⚠️ **E cada falha ganhou TEXTO PRÓPRIO.** "Limite de vagas atingido", "alguém já
reservou", "tente de novo amanhã", "o seu bolso acabou" — todas eram a frase da
recusa LEGÍTIMA, ditas sobre uma leitura que falhou. Cada uma faz a pessoa parar
de tentar por um dia, um mês, ou de vez.

### ⚠️ E o grupo avisava menos que a conversa de duas

`enviarMensagem` (o direct 1-a-1) devolve `avisoClinico` quando a triagem
reconhece conduta: manda a mensagem — não é papel do app censurar conversa
privada entre adultas — e **lembra quem escreveu**. `mandarNoGrupo` rodava a
MESMA `triarTexto`, recusava só a emergência, e jogava o resto fora.

**O canal com UMA leitora avisava; o canal com até SETE, não.**

⚠️ **E o conserto não é recusar.** Um grupo aqui é criado por uma pessoa, só com
gente do grafo dela, teto de oito, leitura a partir de `entrou_em`: é conversa
privada, não publicação. A catraca cobra os dois canais JUNTOS — se um dia o
direct passar a recusar, ela fica vermelha e obriga a decidir os dois de uma vez.

### ⚠️ Suspender e remover não deixavam rastro

Trocar o plano de um médico, criar um cupom, publicar um comunicado — tudo grava
em `audit_log`. **Tirar uma paciente da Comunidade, não.** Importa quando ela
pergunta por que sumiu, quando é preciso reverter, e **numa disputa, onde a
ausência de linha é lida como "a ação não aconteceu"** — que é o que o log existe
para desmentir.

### ⚠️ SEIS achados meus NÃO sobreviveram à conferência

A suspensão já era reversível · a ficha já lia o motivo · o filtro de esconder
story já era lido · a denúncia da caixinha já tinha fila própria no mesmo
arquivo · o aviso clínico do direct já chegava à tela · e o `if (error) return`
do `embeddings` já estava certo.

⚠️ **Achado sem cético é hipótese.** Conferir custa minutos; acreditar custa
mexer em código correto num app que está em produção. E a forma de conferir é
sempre a mesma: **abrir o arquivo e ler a função certa** — o achado do grupo
quase morreu porque `enviarMensagem` estava certa, e quem falhava era a função
irmã.

**Medido ao fim da noite:** 5.434 testes · 112 bancadas · 11 roteiros de
interação · zero problemas.

## A vistoria de convergência da Comunidade (ago/2026)

Pedido do dono: aplicar o que ainda falta na aba, verificar se todos os fluxos
têm caminhos de verdade e convergem, e se o admin está com todas as
informações. O método foi mecânico — e a lista de tarefas estava VELHA: as seis
"pendentes" (véu sensível, legenda do vídeo, vídeo no story, responder com
foto, memórias, álbum) existem todas no código há semanas. **Lista de tarefas
não é fonte; o código é.**

### O que a vistoria MEDIU e estava certo

- **25 destinos da aba, 25 desenhados E alcançáveis** — `onde.t ===` contra
  `setOnde({ t:` cruzados, zero órfãos nos dois sentidos.
- 245 asserções das quatro catracas da rede verdes; `getAuditLog` tem leitor;
  admin com 21 abas.

### ⚠️ A REINCIDÊNCIA CLÍNICA ERA GRAVADA EM SETE PONTOS E LIDA EM NENHUM

`anotarBarrada` registra desde que o rastro nasceu, `agruparPorPessoa` existia
pura e testada com o limiar de três — e **nenhuma função de servidor lia
`rede_triagem_barrada`**. O sinal mais forte de moderação da aba era gravado
para ninguém. É o `denunciado_em` outra vez, e as catracas não pegavam por
desenho: `servidor-tem-porta` acusa função de LEITURA órfã (ela nem existia), e
a lista de réguas de `rede-tem-porta` não alcançava o módulo. As duas mudaram.

`filaDeBarradas` + seção na fila de moderação:

- ⚠️ **Só os grupos ACIMA do limiar viajam** — mandar trechos de quem não é
  caso despejaria texto quase-clínico de pacientes inocentes na tela do admin.
- ⚠️ **O vazio verdadeiro diz o agregado** ("a régua barrou N vezes, ninguém
  passou do limiar") — sem o número, "nenhum grupo" é indistinguível de "o
  rastro está morto", que é o estado em que a tabela viveu até aqui.
- ⚠️ **Aqui o NOME aparece — o oposto da seção da caixinha, de propósito.** Lá
  o anonimato é contrato do recurso; aqui a linha é tentativa de publicação
  PÚBLICA, e a identidade é o que o admin precisa para agir pela ficha.
- ⚠️ Tabela ausente nomeia o SQL; falha diz "não quer dizer que ninguém
  reincide"; emergência não entra nem no agregado.

### ⚠️ OS NÚMEROS DA COMUNIDADE MORAVAM NUMA TELA DE ONDE O DONO É EXPULSO

`NumerosDaComunidade` montava só no `/painel` — que redireciona o super-admin
para `/admin` antes de desenhar qualquer coisa. **A mesma forma do defeito da
fila de denúncias, pago uma segunda vez.** E a bancada da moderação sempre
montou números + fila juntos: ela aprovava uma composição que a produção nunca
teve — bancada certa, produção errada, a direção inversa da mentira usual.

### As três telas do GRUPO nunca tinham sido fotografadas

`?tela=grupo` (mensagem apagada marcada) · `?tela=grupo-novo` ·
`?tela=grupo-chamar` (a folha esconde quem já está no grupo — provado na foto).
Entraram na varredura de CI (115 páginas agora).

⚠️ **Registrado SEM conserto:** Explorar e Favoritas são as duas únicas
sub-telas sem bancada — são INLINE no componente de vinte mil linhas, e
extraí-las é cirurgia. Ficam nomeadas para ser decisão, não esquecimento.

### E a simetria da auditoria

O resolver da REDE deixava linha de auditoria; o da CAIXINHA — mesma tela,
mesma classe de ação — não. Numa disputa, a ausência de linha da caixinha
seria lida como "ninguém nunca olhou". As duas agora gravam, depois do update.

**Medido ao fim:** 5.451 testes · 115 bancadas · 11 roteiros · zero problemas.
Sete mutantes em vermelho nesta vistoria.

## A noite dos vazios mentirosos, e a tela que diz qual SQL falta (ago/2026)

Pedido do dono: verificar o que ainda pode faltar no app inteiro e aplicar
durante a noite. O método foi o de sempre — **três verificadores céticos em
paralelo, cada um obrigado a citar arquivo, linha e trecho** —, e ele importa:
das quatro afirmações que eu tinha levantado sobre Modo Cuidado, **uma era
falsa** (o painel do acompanhante já estava inteiro, com portão em quatro
pontos). Achado sem cético é hipótese.

### ⚠️ A CLASSE QUE DOMINOU A NOITE: "não consegui ler" com cara de "não há nada"

Seis telas do app da paciente descartavam o erro da leitura — `data ?? []`, ou
um `{ ok: false }` que chega numa **resposta 200 NORMAL** e que nenhum
`try/catch` pega — e desenhavam um vazio que AFIRMA um fato falso.

⚠️ **A régua de triagem não é "o erro foi olhado?".** É: **se esta leitura
voltar vazia, o app afirma alguma coisa que ela não tem como saber que é falsa,
e que muda o que ela faz a seguir?**

| tela             | o que dizia                    | o que ela faz com isso             |
| ---------------- | ------------------------------ | ---------------------------------- |
| **contrações**   | (o cartão some)                | **o botão do 192 desaparece**      |
| teleconsulta     | "Nenhuma consulta agendada"    | perde a consulta com a sala aberta |
| consultas salvas | "Nenhuma consulta salva ainda" | toma o remédio sem a posologia     |
| ciclo            | "Nenhum ciclo registrado"      | informa uma DUM errada ao médico   |
| diário           | "Seu diário começará aqui"     | acredita que perdeu meses          |
| álbum            | "Álbum (0 memórias)"           | acha que as fotos foram apagadas   |

⚠️ **A DAS CONTRAÇÕES É A PIOR, e ela silenciava um caminho de emergência.** O
banner de análise vive atrás de `analysisWindow.length >= 2`, e é o ÚNICO lugar
da tela com "Ligar 192 (SAMU)": com a lista vazia ele não renderiza. Uma
oscilação de rede apagava o alerta **em trabalho de parto** — e a contração
aberta não era retomada, então o cronômetro voltava para "Iniciar" com uma
contração em curso no banco.

⚠️ **O conserto NÃO pode inventar a análise que não existe.** O que o app pode,
e deve, é dizer que não conseguiu ler E dar o telefone. Errar para o lado de
mandar ligar é o único lado seguro aqui.

⚠️ **DUAS ERAM DE DUAS CAMADAS.** `getRecentCycles` e `getMyAlbumPosts`
devolviam `ok: true` com lista vazia sobre um erro — um vazio AUTENTICADO COMO
VERDADE, que nenhuma correção só de tela alcançaria.

⚠️ **E a correção já existia, aplicada em UM fluxo.** Os agendamentos
distinguem instável de vazio desde ago/2026, com o comentário explicando o
custo. É a forma mais comum de defeito deste repositório: a régua num lugar e
deixada de pé em cinco vizinhos.

- **`NaoConsegueLer` é UM componente**, e não cinco cópias — cinco divergiriam
  no primeiro ajuste, e a que divergisse seria a menos olhada.
- ⚠️ **A frase de sossego é PROP, nunca fixa.** "O que você registrou continua
  salvo" é verdade no diário e MENTIRA na teleconsulta, onde quem marcou foi o
  consultório. Uma frase genérica seria a segunda mentira no lugar da primeira.
- ⚠️ **E o contador conta como afirmação:** "Álbum (0 memórias)" mente antes da
  prosa, então ele some junto.

### ⚠️ O PORTAL PÓS-PARTO FALAVA DE UM BEBÊ QUE MORREU

`care_mode` **não limpa `birth_date`**. Numa perda depois do nascimento
(natimorto, óbito neonatal), a data está preenchida e a aba abria inteira:
_"Helena nasceu! 3 semanas de vida"_, com o convite a marcar o primeiro sorriso
e o calendário de 24 vacinas. Era a única aba da lista sem a prop — as quatro
vizinhas já recebiam.

⚠️ **E O CONSERTO NÃO É ESCONDER A ABA**, porque duas coisas ali importam MAIS
depois de uma perda: **Bem-estar (a EPDS**, cuja décima pergunta é ideação de
autolesão, no momento de risco máximo de depressão perinatal**)** e **Retorno**
(a consulta de puerpério, onde hemorragia, infecção e pré-eclâmpsia de
pós-parto são pegas). O corpo dela passou pelo parto do mesmo jeito.

Saem as três que falam do bebê. O cabeçalho fica sóbrio e **não narra a perda**
— o Modo Cuidado pode ter sido ligado pelo médico. E a catraca cobra as DUAS
metades, senão ela aprovaria alguém "consertando" o luto ao custo do socorro.

### ⚠️ A ficha do SOS dizia GESTANTE, com o nome do bebê e a DPP

A ficha que o SOCORRISTA lê. Ela abre a Central — a tela que se abre quando
alguma coisa está errada — e lê o nome do bebê que perdeu e uma data de parto
que não vai acontecer.

⚠️ **Também não se apaga a ficha.** Quem perdeu uma gestação continua sendo
paciente obstétrica. Tipo sanguíneo, alergias, medicações, contato e médico
ficam INTEIROS; sai o que é FALSO — e falso não só emocionalmente: um bebê que
não vai nascer e uma DPP que não existe são informação errada para quem vai
atendê-la. "GESTANTE" vira "PACIENTE OBSTÉTRICA".

⚠️ **O portão vive no ponto de MONTAGEM, e o título chega como STRING.** Um
booleano de luto dentro da folha seria, um dia, um `if (emLuto) return null` — o
defeito que `socorro-nao-e-gateado` acabou de consertar. Uma string não tem como
desligar nada.

⚠️ **A idade gestacional sai junto, e é a única linha em que se troca
informação por exatidão.** "28s 3d" afirma uma gestação de hoje. Se o dono
quiser a semana de volta, ela precisa de outro rótulo — é decisão clínica dele.

### O grupo não avisava ninguém, e o voto se perdia

- ⚠️ **Uma mensagem de grupo para até sete pessoas fazia duas escritas e
  parava**: sem push, e sem acender o emblema da aba Mensagens, que conta só as
  conversas de DUAS. A bolinha do grupo vive DENTRO da lista de grupos — ou
  seja, o aviso só chegava a quem já tinha ido olhar. O direct de duas mandava
  push desde o primeiro dia; o de oito, não.
  ⚠️ **E o push respeita `silenciado_em`, por membro** — este é o mesmo canal do
  aviso de emergência, e um push impossível de calar é como ela desliga a
  notificação do app inteiro e leva o SOS junto. O TEXTO não vai: ele chega na
  tela de bloqueio, e quem estiver ao lado lê.
- ⚠️ **O voto no nome do bebê gravava "já votou" sem ler a resposta.** A
  votação podia estar encerrada; o voto da avó nunca entrava na contagem **E** o
  `localStorage` a impedia de tentar de novo. A régua certa mora quinze linhas
  abaixo, no mesmo arquivo.
- ⚠️ **O 👎 da nutrição prometia "seu médico vai ver" sem confirmar.** Ele só
  enfileira quando há `entryId` — a cota pode ter estourado, o cérebro pode
  estar desligado. O chat principal já tinha exatamente esta correção, com o
  comentário do conserto à vista.
- ⚠️ **A suspensão vazava em `postQueEuVejo`**: o select do autor nunca pedia
  `rede_suspensa_em`, então mesmo num banco COM a coluna o post de uma autora
  suspensa continuava comentável. Virou escada de três degraus, um por SQL.
- ⚠️ **A conferência no CFM era gravada e lida por ninguém.** Três colunas, zero
  selects — e o selo "verificado", que ORDENA a busca de médicos que a paciente
  usa, é um booleano apertado à mão. A plataforma pagava a consulta e mostrava
  como verificado quem ninguém verificou. **`verified` continua manual de
  propósito** (situação regular no conselho ≠ aprovado nesta plataforma), e há
  teste que fica vermelho se alguém casar os dois.

### A tela de saúde do banco — o remédio para o defeito mais repetido daqui

`/admin → Banco 🗄️` pergunta ao banco quais `APLICAR_*.sql` ainda não foram
rodados. Até agora a única forma de descobrir era alguém reparar que um recurso
não fazia nada — porque **nada quebra**: toda leitura tem degrau de recuo, e o
recurso simplesmente deixa de existir.

- ⚠️ **O mapa é GERADO** (`scripts/gerar-mapa-do-banco.ts`, 54 arquivos · 127
  tabelas · 192 conferências). Uma lista à mão envelhece no primeiro `APLICAR_`
  novo — e envelhecer aqui significa a tela dizer "tudo aplicado" sobre um
  arquivo que ela não conhece, que é pior que não ter a tela.
- ⚠️ **O gerador FORMATA o que escreve**, senão o teste que regenera e compara
  fica eternamente vermelho contra o arquivo que o prettier reformatou — e um
  teste que reprova o estado correto é um teste que a próxima pessoa ignora.
- ⚠️ **Coluna de tabela que o próprio arquivo CRIA não vira conferência**: se a
  tabela existe, ela nasceu com as colunas.
- ⚠️ **"Não consegui conferir" NUNCA vira "ok"**, e sem `SUPABASE_SERVICE_ROLE_KEY`
  a tela RECUSA em vez de medir a RLS e chamar de schema.
- ⚠️ **Nenhuma linha de paciente viaja** (`head: true`): um painel de
  diagnóstico não é motivo para trafegar prontuário.

### ⚠️ E as armadilhas de teste, de novo — com duas cometidas por mim

Onze mutantes ficaram verdes na primeira rodada desta noite, e nenhum por
motivo novo:

1. **A asserção descrevia a TELA e não a LEITURA** — apagar a checagem do erro
   não tira `instavel` do render. Três mutantes de uma vez.
2. **Janela de distância**: `ContracoesTab` tem um SEGUNDO `tel:192` a menos de
   1400 caracteres, e a mutação que apagava o botão do aviso passava verde.
3. **"Outra ocorrência do mesmo nome"**, duas vezes: `crm_conferido_em` aparece
   no tipo e no `.map()`, e `{false ? (` mantém `d.crm` nos dois ramos.
4. **`f.indexOf("});", i)`** parava no `.order(..., { ascending: false });` e
   cortava a função ANTES da linha que o teste existia para cobrar.
5. **O primeiro `{` depois de `deixarDeSeguir(` é o ARGUMENTO**, não um corpo.

⚠️ **E DUAS CATRACAS DO REPOSITÓRIO ME PEGARAM, as duas certas:**
`travas-do-servidor` recusou um `void (async () => …)()` que eu tinha acabado de
escrever (**no servidor a invocação congela quando a resposta sai**, e esta base
já perdeu três recursos assim), e `servidor-tem-porta` recusou `saudeDoBanco`
antes de a tela existir.

⚠️ **E uma asserção antiga travava a GRAFIA do recuo** (`lerAutor("id,
care_mode, perfil_publico")`, numa janela de 500 caracteres) e ficou VERMELHA
sobre o degrau novo — ou seja, reprovou uma mudança que só APERTOU a garantia.
Décima segunda vez nesta base. **Cobre a garantia, nunca a escrita.**

⚠️ **E EU APAGUEI O MEU PRÓPRIO TRABALHO com `git checkout`** num arquivo não
commitado, restaurando o HEAD por cima de um degrau recém-escrito. A lição já
estava neste arquivo: **restaurar mutação com `cp`, NUNCA com `git checkout`.**

**Medido ao fim:** 5.507 testes · 121 bancadas · 11 roteiros de interação ·
zero problemas. **Aplicar no Supabase:** os dois que estavam pendentes
(`APLICAR_CONVERSA_SILENCIAR.sql` e `APLICAR_DURACAO_DA_CONSULTA.sql`) **já
foram rodados** — conferido por sondagem ao PostgREST em 04/set: `silenciada_a`,
`imagem_path` e `duration_minutes` respondem 200. A aba Banco continua sendo
quem diz isso sozinha para os próximos.

## A bolha responde, os blocos têm número, e a Saúde ganhou ícones 3D (set/2026)

Direção do dono, depois de dois dias de detalhe: _"a bolha vira o avatar do
chat"_, _"faça essas aplicações"_ (o dado dentro dos blocos e a consulta real),
e _"se for necessário gere imagens novas… faça alterações de alguns ícones, na
aba de saúde"_. Quatro frentes, todas fotografadas antes de subir.

### A bolha É o avatar do chat

`AiAvatar` era um orbe roxo genérico com duas faíscas. A paciente toca na
BOLHA na home para chegar ao chat, e chegava numa tela onde ela não estava.
Agora `AiAvatar` desenha `<Bolha humor="feliz" flutua={false}>` — 36px no
cabeçalho, 28px em cada mensagem.

- ⚠️ **`flutua={false}` não é gosto.** A bolha da home flutua porque é UMA,
  sozinha no céu. Numa conversa ela aparece a cada mensagem: trinta bolhas
  flutuando são ruído, e a repintura contínua num histórico longo custa
  bateria. Parada, é avatar; flutuando, são trinta personagens.
- **`humor="feliz"` fixo**, pelo padrão de `estudiosa`/`exercicio` — identidade
  da tela, não estado da jornada. `careMode` passa adiante porque `Bolha` já
  rebaixa humor festivo no luto sozinha; `WABubble` precisou ganhar a prop.

### O dado dela dentro dos blocos da Saúde

O dono tinha pedido blocos que "preencham a tela inteira" (`preencherTela`), e
eles preenchiam com gradiente vazio — 175×300 com ícone de 40px e rótulo no
pé. **O que dá sentido ao tamanho é o número.** `HubSaude` faz três leituras
em paralelo (`health_logs`, `kick_sessions`, `contraction_logs`) e cada bloco
recebe `dado: { valor, legenda }`: "68,4 kg / pressão 118/76", "12 / chutes
hoje", "3 hoje / última às 14:20".

- ⚠️ **QUALQUER FALHA VIRA `null`, E `null` NÃO DESENHA NADA.** "Não consegui
  ler" e "ela nunca registrou" caem no mesmo lugar, porque um "0" afirmaria um
  fato que a tela não sabe — a régua de `estado-das-portas`. O bloco volta ao
  rótulo, que sempre foi verdade.
- ⚠️ **VALOR grande e LEGENDA pequena, e não uma frase.** A primeira versão
  mandava "3 hoje · última 14:20" numa string só: em serif 22px, numa coluna
  de 175px, quebrava em TRÊS linhas e o número — que é o que ela veio ver —
  tinha o mesmo tamanho que "última". Medido na foto, não deduzido.
- **Nutrição fica sem número**, e isso também é informação: é conteúdo, não
  medição.
- **Bancada:** `/preview-saude?w=20&dados=1` injeta os três pelo MESMO
  `useState` da produção. Sem isso ela só mostraria o bloco vazio — o único
  estado que não precisava provar.

### A consulta real chegou à aba Bebê

`minha-conta` JÁ resolvia `nextAppt` (`{dateLabel, typeLabel}`) para o menu ☰ e
nunca o passava para baixo. Agora desce por `BebeHub` → `BabyTab`, e o cartão
volta a poder se chamar **"Próxima consulta"** quando há uma confirmada; sem
ela, continua "Ritmo das consultas". Bancada: `/preview-bebe-tab?consulta=1`.

### Os cinco ícones 3D da Saúde

`recraft_v4_1`, `standard`, 1k, fundo `#FFFFFF`: **6,25 créditos** pelos cinco
(coração com pulso · pezinhos · cronômetro · tigela de salada · tulipa). Todos
da mesma família — vidro, cor NATURAL do objeto, luz ambiente uniforme.

⚠️ **O que mudou em relação à rodada que o dono recusou ("muito brilho, pouca
qualidade")**, e que agora está escrito para não voltar:

1. **Nenhuma cor cravada.** A rodada anterior forçava "coral e creme" num
   cacto e destruía a identidade do objeto. Aqui a cor vem do SUJEITO ("coração
   verde-água", "pezinhos azul-céu") — descrever é diferente de pinçar hex.
2. **Sem `soft key light from upper left`.** Luz dura de um lado é o que
   produzia o brilho estourado. Virou "gentle even ambient studio lighting".
3. **Sem `muted, calm, low-contrast`** — isso drenava a cor. Virou "vibrant
   natural color".
4. **SEM COMPRIMIR PARA OLHAR.** A "pouca qualidade" da rodada anterior era a
   MINHA compressão a 420px para caber no artefato. Desta vez as artes foram
   lidas em 1024 nativos.

O recorte de fundo é o `scripts/bebes/do-drive.mjs` de sempre (croma + brilho

- conexão com a borda, depois des-premultiplica): PSNR **46–50 dB**, 264 KB os
  cinco. ⚠️ A tigela é de VIDRO e a tulipa tem pétala translúcida — os dois
  casos que o CLAUDE.md nomeia como onde a inundação "come o miolo". Não comeu: o
  brilho branco dentro da pétala é cercado por contorno e não alcança a borda,
  que é exatamente a propriedade que o algoritmo explora.

`Ladrilho` ganhou `imagem?: string`; com ela, `GradeHub` desenha a arte em
96px no bloco grande **sem o círculo branco** — o círculo existe para dar corpo
a um traço de 1,7px, e só atrapalharia uma peça com volume próprio. As grades
de quadrados (seis destinos) continuam com o Lucide de 40px, inalteradas.

### ⚠️ E um defeito de hidratação que era de TODA aba com `Stagger`

`useReducedMotion()` devolve `false` no servidor e `true` na primeira pintura de
quem ligou "Reduzir movimento" no iOS. Com a decisão no render, o servidor
mandava `<motion.div style="opacity:0">` e o cliente montava `<div>` — atributos
divergentes, em toda aba com `Stagger`/`Reveal`, para toda paciente com essa
opção. Medido: `reducedMotion: "reduce"` → 1 aviso; sem → 0.

`useReduzDepoisDeMontar` decide DEPOIS de montar — a régua de `podeGravar`
(`capacidade-fora-do-render`). Eram **quatro** usos, não dois: o meu primeiro
`assert ==2` estava errado, e foi o regex que pegou todos.

⚠️ **Isto só apareceu porque a bancada rodou com `reducedMotion: "reduce"`** —
que eu tinha ligado para fotografar o `Stagger` sem esperar o observador. A
flag não era gambiarra: era o estado real de uma paciente, e ele estava
quebrado.

**Bancadas:** `/preview-chat` (a bolha no cabeçalho e nas mensagens) ·
`/preview-saude?w=20&dados=1` · `/preview-bebe-tab?consulta=1` ·
`/preview-saude?w=38` (a tulipa, em "Saúde da mulher").

### A quinta frente: o material 3D dos botões — começou pelo Cantinho

Direção do dono: _"sem cara de que foi usado o Claude Code… cara mais 3D de
aplicativo tecnológico… alguns botões, alguns elementos"_. Antes de opinar,
medi o app da paciente:

| tell de desenho gerado                                     | quantos |
| ---------------------------------------------------------- | ------- |
| **pílula com CONTORNO** (`rounded-full border`, sem fundo) | **176** |
| **cartão idêntico** (`rounded-3xl` + borda + `bg-card`)    | **129** |
| rótulo em CAIXA ALTA espaçado ("eyebrow")                  | 61      |
| botão primário `rounded-full` chapado                      | 133     |

A pílula de contorno é o tell número um — e são 176 escritas à mão em
Tailwind. Não há alavanca central: `<Button>` do shadcn tem 4 usos, e `.press`
(542 botões) é só a animação de toque e **diz por escrito que não carrega
sombra** — "sombras pertencem a cada superfície".

**`.btn-3d` e `.pill-3d`** (`styles.css`, ao lado do `.press`): brilho suave no
topo, sombra macia (`--shadow-card`), gradiente vertical quase imperceptível —
o mesmo vocabulário dos ícones 3D aprovados. ⚠️ **Compõem com qualquer
`bg-*`/`text-*`**: o material não escolhe cor, dá corpo à cor que o botão já
tem. `.pill-3d` é a pílula com SUPERFÍCIE que substitui a de contorno: fundo
quase branco e quente, borda que é luz e não linha; o texto continua na cor da
família, então a categoria segue legível.

- ⚠️ **Opt-in, botão a botão, tela a tela — NUNCA no `.press`.** O `.press` está
  no painel do médico também, e o comentário dele é uma decisão. Pôr material
  ali seria desfazê-la por atacado.
- **Primeira tela: o Cantinho**, 13 botões — os três toggles "Usar / Em uso ✓"
  (skin, céu e fundo), "No cantinho ✓", o preço, "Ver o Premium", e os sete dos
  cartões de ganhar Sementinhas. Medido no pixel: **5,32:1** em `pill-3d`
  (texto emerald-700) — passa.
- ⚠️ **Sete dos treze NÃO foram fotografados**: os cartões de indicação,
  avaliação e depoimento exigem sessão real e a bancada não os fabrica (dois
  cliques em "Ganhe mais Sementinhas", inclusive depois da hidratação, não os
  abrem). Levam a MESMA classe já fotografada nos outros 88 elementos da tela, e
  o `tsc` cobre a forma. Fica escrito como dívida de bancada, não como feito.
- ⚠️ **A foto do "antes" se perdeu com o reinício do contêiner** (`/tmp/fotos`
  é apagado). O antes está descrito pelo diff — `border border-emerald-300`
  sobre fundo nenhum — e não foi fabricado.

**Segunda leva do material (mesma noite):** a Comunidade e a Bebê.

- **Comunidade: 25 botões.** Duas famílias do mesmo tell: a pílula neutra
  `press … rounded-full border border-border` (17 — "Tentar de novo",
  "Seguir de volta", os pedidos) e a retangular `press … rounded-lg border
border-border` (5 — "Editar perfil", "Usar este código", "Mandar uma
  pergunta"), que é a convenção do próprio Instagram para ação secundária. As
  duas viraram `pill-3d`, mantendo cada uma o seu raio.
  ⚠️ **TRÊS ESTAVAM DENTRO DE TERNÁRIO** e o regex não pegou: `jaSegue ?
"border border-border" : "bg-primary text-primary-foreground"`. O literal
  fica numa string ANINHADA, e `[^"]*` para na aspa de dentro. Esses ramos
  foram patchados à parte — e o ramo primário ("Seguir") ganhou `btn-3d`, senão
  o toggle teria volume só desligado.
- **`CompartilharMomento`**, o botão de compartilhar de oito telas: a variante
  compacta (contorno) → `pill-3d`; a cheia (`bg-primary`) → `btn-3d`.
- **Os cinco chips de humor da Bebê** (`rounded-2xl border border-border`) —
  a mesma família, vista na foto da aba.
- ⚠️ **O `btn-3d` CHEIO passa POR POUCO onde o brilho clareia:** medido no
  pixel, o preço `🌱 22` (`bg-emerald-700`, 11px) dá **4,61:1** na faixa de
  cima, contra 5,36 sem o brilho. Passa, e é o limite prático do brilho de
  topo (0,16). Se um dia um botão cheio reprovar, o ajuste é ESSE número, não
  a cor.
- ⚠️ **O cabeçalho "Obstétrica" que aparece nas fotos das bancadas é a moldura
  do SITE**, que `/minha-conta` esconde — já custou um falso diagnóstico uma
  vez; fica repetido aqui porque toda foto de bancada o mostra.

**Próximas telas, nesta ordem:** Saúde (as sub-telas de registrar) · Bebê ·
Comunidade · chat. Cada uma com foto antes de subir. E os **129 cartões
idênticos** são a mesma pergunta em outra forma: o material do cartão é um
token só (`--shadow-card`), então a resposta é provavelmente uma classe, não
129 edições.

## A aba Bebê ganhou bancada — e a fruta parou de ser sempre morango (set/2026)

O dono disse que "as informações do bebê, quando você clica nele, não estão cem
por cento". **Eu não conseguia olhar essa tela**: `BabyTab` exige conta, perfil
com DUM e médico vinculado, e enquanto ela morava dentro de `minha-conta.tsx`
nem dava para importá-la — exportar de um arquivo de ROTA põe o código no
pedaço da árvore de rotas que TODA página do site carrega
(`rotas-sem-export-solto`).

**Por isso o corte veio antes do desenho**, e não por arrumação:
`src/components/baby-tab.tsx` (`BabyTab` + `WeeklyRecapCard` + `HomeMoodCheckin`

- `DoctorPresenceCard` + `MOOD_CHOICES`), **631 linhas**, byte a byte —
  os cinco blocos conferidos por SHA-256 contra o que estava em produção.
  `minha-conta.tsx`: **18.637 → 18.006**.

⚠️ **`dayGreeting` e `MOOD_LABEL` foram para `src/lib/humor-e-saudacao.ts`**,
porque cada uma era usada dos DOIS lados do corte: a primeira é definida no meio
do bloco que saiu e chamada fora dele; a segunda é definida fora e lida dentro.

⚠️ **`Gest` virou `export type`, e a distinção é o ponto:** a catraca casa
`export function|const|let|class` e **nunca `export type`** — tipo é apagado na
compilação e não custa um byte ao pacote.

### ⚠️ E OLHAR ACHOU O DEFEITO NA PRIMEIRA FOTO: 🍓 Abóbora

A pílula da fruta tinha o emoji **CRAVADO** em `"🍓"`. Ele nunca mudava: a
paciente de 28 semanas lia "🍓 Abóbora" e a de 40, "🍓 Abóbora moranga" — o
desenho contradizendo a palavra ao lado, na pílula principal da tela.

E o mais caro: **`fruitEmojiForWeek` já estava importada e já era usada dez
linhas abaixo**, no cartão de compartilhar. A função certa existia; só esta
pílula não a chamava. Medido depois: 🍓 Morango · 🍌 Banana · 🎃 Abóbora ·
🍈 Mamão · 🎃 Abóbora moranga.

⚠️ **E EU QUASE ACUSEI DEZ DEFEITOS QUE NÃO EXISTEM.** Cruzando emoji com
palavra em todas as semanas, dez "discordavam" (🫘 lentilha, 🍐 figo, 🥬 aipo).
São DELIBERADAS, e o comentário de `gestacao.ts` diz por quê: _"algumas semanas
usam o parente mais próximo porque o emoji exato não existe"_. Não há emoji de
lentilha nem de aipo. Ler o comentário antes de acusar.

### ⚠️ QUATRO ARMADILHAS DE MEDIÇÃO, todas pagas nesta tela

1. **A FOTO ESTAVA VELHA.** Escrevi duas vezes no MESMO caminho e li a primeira
   versão — passei quatro rodadas concluindo que a aba renderizava em branco,
   enquanto `elementFromPoint` mostrava o conteúdo em todos os pontos. **Foto de
   verificação vai para um caminho NOVO**, com carimbo de tempo no nome.
2. **`textContent` é CRU; `innerText` reflete `text-transform`.** Procurar
   "2º TRIMESTRE" por `textContent` não acha nada, porque o texto real é
   minúsculo e quem maiúsculiza é o CSS.
3. **`Stagger`/`StaggerItem` usam `whileInView` com `once: true`**, e no headless
   o observador pode não disparar antes da foto — os blocos ficam em
   `opacity: 0`. Um contexto com `reducedMotion: "reduce"` os renderiza
   estáticos, e isso NÃO é gambiarra: é o estado real de quem pede menos
   movimento.
4. **Opacidade zero no PAI apaga os filhos, e os filhos reportam `opacity: 1`.**
   Contar elementos invisíveis subestima o estrago.

**Bancada:** `/preview-bebe-tab?w=20&d=3` · `?w=40` (a reta final) ·
`?luto=1` (Modo Cuidado) · `?semmedico=1` (sem o cartão de presença, que é quem
nunca usou o código do consultório) · `?magro=1` (recém-cadastrada, sem nome do
bebê nem histórico — onde os vazios aparecem).

## Os botões passaram a ser legíveis (set/2026)

Pedido do dono na varredura de detalhes: melhorar "especialmente os botões e as
interfaces pequenas". Medido em 17 bancadas, com a cor saindo do CANVAS e o
fundo COMPOSTO até o primeiro opaco (as duas armadilhas que este arquivo já
registra): **67 botões abaixo do mínimo de 4,5:1**.

O pior não era um botão grande — era a **pílula de preço da Loja**, `11px`
branco sobre `emerald-500`, **2,47:1**, repetida nos 111 itens. É o número que
a paciente lê para decidir a compra, na aba que o dono chamou de feia.

**A decisão foi dele**, entre três caminhos medidos, e ele escolheu **escurecer
para -700** — mantém a cor que ele desenhou, só mais funda. Resultado nos
elementos reais:

|                        | antes | agora |
| ---------------------- | ----- | ----- |
| pílula de preço (11px) | 2,47  | 5,36  |
| "Guardar" (âmbar)      | 2,13  | 5,03  |
| "Começar a mexer"      | 2,47  | 5,36  |
| "Começar a meditar"    | 4,40  | 7,30  |

Oito famílias, 93 botões: emerald 5,36 · amber 5,03 · sky 5,86 · green 4,95 ·
rose 6,03 · violet 7,30 · pink 5,91 · fuchsia 6,27. **Indigo ficou de fora** —
mede 4,58 e já passava.

⚠️ **A TROCA É DENTRO DO `className`, e só onde há `text-white` NELE.** Um
`bg-emerald-500` que pinta uma barrinha, um ponto ou um marcador não pode
escurecer — ali não há texto para ficar legível, e mudar seria mexer no desenho
sem motivo.

⚠️ **E A CONFERÊNCIA POR `grep` DE UMA LINHA MENTE NOS DOIS SENTIDOS.** Ela
acusou três conversões como "sem texto branco" e as três eram legítimas: o
`text-white` estava em OUTRA LINHA do mesmo `className` (uma delas é a caixinha
de "feito" da trilha, com o ✓ branco dentro). Quem decide é o literal inteiro.

### ⚠️ O chip NÃO-ESCOLHIDO da Loja estava a 2,9:1 — e ele NÃO é desabilitado

Os 11 chips de categoria (Plantas, Bichinhos, Luzes…) usavam
`text-foreground/45`. Botão ativo a 2,9:1 é falha; controle **desabilitado**
seria isento, e este não é.

Medido sobre o creme da página: `/45` → 2,9 · `/55` → 3,88 · **`/60` → 4,56** ·
`/65` → 5,41.

⚠️ **É `/60` E NUNCA `/65`**: o chip ESCOLHIDO mede **4,72**, então `/65` daria
mais contraste ao que ela não escolheu do que ao que ela escolheu — a
hierarquia ao contrário. Quem separa os dois estados é o FUNDO verde do ativo;
a opacidade só precisa ser legível, não discreta.

### O que NÃO foi mexido, com a razão

- **As 12 pílulas de preço DESABILITADAS** (cinza sobre cinza, 2,4:1). Controle
  desabilitado é isento pela norma, e escurecer faria um item que ela **não
  pode comprar** parecer disponível. A informação acionável ("faltam N 🌱") já
  vive embaixo.
- **Indigo**, que já passava.

### ⚠️ DUAS ARMADILHAS DE MEDIÇÃO NOVAS, e as duas produzem número falso

1. **O Tailwind só gera a classe que o CÓDIGO usa.** Montar `bg-rose-700` no
   navegador para medir devolve `rgba(0,0,0,0)` — a classe não existe no CSS —
   e o medidor computa contra PRETO, imprimindo um confortável **21:1**. Foi
   assim que emerald-800, sky-600 e green-700 "mediram" 21:1 numa tabela minha.
   Só se pode medir o tom que já está em uso; para os outros, **aplica-se e
   mede-se depois**.
2. **`elementFromPoint` responde `null` fora do viewport**, e o alvo de toque
   sai **0×0** sem nada avisando. Rolar o elemento até a vista ANTES de sondar.

### ⚠️ E EU PIOREI UM ALVO DE TOQUE TENTANDO CONSERTÁ-LO

O ✕ que tira um item do chá de bebê tinha um comentário prometendo "Alvo de
44px" e o código entregava **29×32** desenhado, **28×18** efetivo. Apliquei o
`after:-inset` que este arquivo recomenda — e a medição mostrou o resultado:
**44×6**, porque o pseudo-elemento do vizinho passa a pintar por cima.

⚠️ E medindo o ORIGINAL apareceu o defeito de verdade, que é anterior a mim: o
toque **10px abaixo do centro já acerta o ✕ da LINHA DE BAIXO**. Num controle
que tira item da lista, isso tira o item errado. A causa é o `-my-2`, que
encavala as caixas dos botões.

**Foi revertido**, e o achado ficou escrito no componente com os números. O
conserto de verdade é a ALTURA DA LINHA, que muda o desenho da lista — decisão
do dono, não remendo. **Truque de pseudo-elemento não conserta encavalamento.**

## O primeiro corte do `minha-conta.tsx` (set/2026)

O arquivo tem **21.478 linhas** — e o número deste parágrafo já envelheceu uma
vez, dizendo 20.367 enquanto ele crescia 1.111 linhas. É a única dívida do
repositório que fica mais cara a cada semana, porque toda leva nova entra nela.

O primeiro corte foi `OnboardingRitual` + `CodigoDaEmbaixadora` →
`src/components/onboarding-ritual.tsx` (**−665 linhas**, 20.813).

⚠️ **A ESCOLHA DO PRIMEIRO CORTE NÃO FOI PELO TAMANHO.** Os dois eram
`export function` num arquivo de ROTA, e isso tem custo medido: um export
não-rota sai do pedaço daquela rota e entra no da ÁRVORE DE ROTAS, que toda
página do site carrega antes de qualquer coisa aparecer — foi assim que
`PainelDaEmbaixadora` custou 11 kB. Ou seja, o corte paga a dívida estrutural
E fecha uma entrada de `rotas-sem-export-solto.test.ts` de uma vez. E os dois
têm bancada (`/preview-onboarding`), então dá para PROVAR que a tela não mudou.

⚠️ **É UM MOVE, e nada mais** — nenhuma linha do corpo foi tocada, e isso é
conferido por HASH: os dois blocos são byte a byte idênticos ao que estava em
`minha-conta`. Um move que também "melhora" é uma reescrita, e aí a mudança de
comportamento se esconde num diff de 650 linhas. As melhorias vêm depois, num
commit que só faça isso.

⚠️ **`Profile` viaja por `import type`**, e por isso não há ciclo em tempo de
execução: o tipo é apagado na compilação. O lugar certo dele é `src/lib/`, junto
das outras formas de linha de banco — mas mover `Profile` toca dezenas de
referências, e um primeiro corte que também faz isso deixa de ser um move.

### ⚠️ E A CATRACA DE EXPORT SOLTO NÃO ERA UMA CATRACA

`CONHECIDOS` é uma TOLERÂNCIA — e uma tolerância que sobra depois de a dívida
ser paga **aceita o defeito de volta em silêncio**: com os dois nomes ainda na
lista, reexportá-los amanhã passaria verde. Agora há teste cobrando que nenhum
nome sobre (`nomesQueSobraram`), e a contagem caiu de 32 para 30.

⚠️ E o teste da contagem usava `toBe(32)`, então ele **reprovava também quando a
dívida ENCOLHIA** — a armadilha de sempre. A igualdade é a régua certa; o que
faltava era o comentário dizer para que lado ela morde: subiu, tire o export;
caiu, abaixe o número aqui.

### ⚠️ E EU QUASE REPORTEI UMA MEDIÇÃO DE UM BUILD QUE NÃO ERA O MEU

⚠️ **E A CAUSA QUE EU REGISTREI AQUI ESTAVA ERRADA.** Escrevi que o `pkill -f
vite` do mesmo comando tinha matado o build; testado depois, uma consulta que
saiu 144 com o `pkill` **também saiu 144 com ele na forma `[v]ite`, e rodou
limpa quando eu tirei tudo o mais** — ou seja, o `pkill` não era o culpado. O
FATO continua de pé e é o que importa (os artefatos medidos eram de duas horas
antes, conferido pelo relógio), mas a explicação não. **Atribuir causa sem
testá-la é a mesma pressa que a nota abaixo existe para condenar.**

O `bun run build` saiu com 144 num comando que também tinha um `pkill`, e
os artefatos que sobraram eram de duas horas antes — de um estado anterior à
mudança. Eu já tinha lido números deles. **Conferir o RELÓGIO do artefato antes
de acreditar num build** é a versão desta armadilha para medição de pacote.

**Medido de verdade, com o "antes" construído numa `git worktree` do commit em
produção:** o build inteiro caiu de **1.254.433 para 1.250.735 gzip (−3.698)**, e
`minha-conta` de 124.583 para 121.118. O ritual virou pedaço próprio de 4.666.

⚠️ **O `index` mostra −50.705 e isso NÃO é atribuído a esta mudança**: um pedaço
`proxy` de 39.984 apareceu ao lado dele (7 arquivos a mais no total), ou seja o
divisor reorganizou. Contar uma reorganização como ganho seria o mesmo tipo de
número inventado que o painel de custo de IA tinha.

**Verificado:** hash idêntico nos dois blocos · 5.508 testes · 121 bancadas ·
11 roteiros · as três telas de `/preview-onboarding` fotografadas com zero erro
de console.

### O que vem depois, em ordem

Os candidatos seguintes, medidos (linhas · dependências de módulo):
`ConquistasTab` 676 · `CantinhoTab` 610 · `CicloMenstrualTab` 418 ·
`ExerciciosTab` 387 · `ContracoesTab` 364. Os três primeiros também são export
solto hoje, então pagam as duas dívidas juntas.

⚠️ **`MinhaContaPage` (1.864 linhas) fica por último**, e não por primeiro: é
ela que segura os 29 estados que todo o resto lê por prop. Cortá-la é o único
pedaço que NÃO é um move.

### ⚠️ E A CATRACA DO MAPA ERA INSTÁVEL POR CONSTRUÇÃO

Ela conferia a sincronia **rodando o gerador** e comparando os bytes do arquivo
— e o gerador roda `npx prettier` por dentro. Dois processos externos por
execução da suíte: 905 ms na máquina de desenvolvimento, **mais de 5 s no
runner limpo da CI**, onde o teste ESTOUROU O TEMPO LIMITE com tudo verde aqui.
Das duas execuções daquele commit, uma passou e a outra não.

⚠️ **O conserto não é aumentar o limite** — seria manter um teste que sai do
processo em toda execução. A leitura da pasta virou módulo
(`src/lib/mapa-do-banco.gerar.ts`) e a catraca compara o DADO em memória:
5.007 ms → **73 ms**, e nenhum teste do `src/` chama `execFileSync` agora.

⚠️ **E o mutante não contou na primeira tentativa**: a âncora não casou (o
prettier reformata o JSON gerado em uma coluna por linha), e o `assert` acusou
em vez de deixar passar um "✅ vermelho" sobre uma edição que nunca aconteceu.

## A leva de artes 3D: barra, hubs e a vitrine do Cantinho (set/2026)

Autorização do dono: _"pode fazer tudo que quiser que você acredita que irá
deixar esse app ainda melhor, te dou um limite agora de 300 créditos"_. Esta
leva gastou **77,75** (115,25 acumulados dos 300): 3 ícones da barra a 2k e
41 peças a 1k, todas na fórmula aprovada dos cinco da Saúde — cor NATURAL do
objeto, luz ambiente uniforme, sem paleta cravada, lidas em 1024 nativos.

### Onde cada família mora

| família                    | peças | onde entra                                       |
| -------------------------- | ----- | ------------------------------------------------ |
| barra de baixo             | 3     | `NAV_ITEMS` (Saúde · Jogo · Comunidade)          |
| portas da Comunidade       | 6     | `ARTE_DA_PORTA` em `comunidade.tsx`              |
| quadrados do Bebê          | 6     | `imagem:` em `BEBE_SUBTABS` (álbum reusa a peça) |
| itens grátis do Cantinho   | 17    | `ARTE_DO_ITEM` (`arte-do-cantinho.tsx`)          |
| conjuntos (domos de vidro) | 13    | `ARTE_DO_CONJUNTO`                               |

- ⚠️ **O BEBÊ DO CENTRO E O SOS NÃO MUDARAM, de propósito.** O centro é a
  Bolha — personagem do ilustrador, e uma gerada não casaria com ela. O SOS
  ficou porque o dono pediu que ele não mudasse; o ícone da barra é parte dele.
- ⚠️ **E A BARRA VOLTOU AO TRAÇO NO MESMO DIA, por decisão do dono** ("a barra
  antiga era bem melhor, a nav bar volte para ela"). Os três ícones 3D da
  barra saíram do repositório; `NAV_ITEMS` usa Heart, Gamepad2 e `IconeAmigas`
  de novo. A família 3D vale para HUB e VITRINE — dentro de uma barra de vidro
  com traços ao lado, ela não convenceu quem olhou no aparelho. Não reintroduza
  sem uma foto que ele aprove.
- ⚠️ **SÓ A VITRINE do Cantinho recebe arte.** A TRILHA continua com emoji
  (`DecorSprite`, a bandeja do Arrumar, os layouts gravados): trocar o sprite
  mexeria no tamanho, na animação e nos cantinhos que as pacientes já montaram.
  Aqui é onde ela DECIDE comprar, e é onde o objeto precisa ter volume.
- **Mapa por ID, emoji como recuo.** São 94 itens e 17 têm arte; os outros
  seguem com o emoji, e item novo entra no mapa só quando a arte dele existir.
  Os mapas moram em `components/` porque importam `.webp` — em `lib/` um teste
  do `bun` morreria no primeiro `import`.
- **Os conjuntos são DOMOS de vidro**, e os itens são o objeto solto: é o que
  separa "uma cena que se completa" de "uma peça" sem uma palavra.

### ⚠️ Três coisas que só a FOTO pegou

1. **A nuvem foi COMIDA pelo recorte** — branco sobre branco, e a inundação
   por semelhança de cor atravessou. Conferir os recortes sobre ROSA, nunca
   sobre branco: sobre branco uma peça comida e uma inteira são idênticas. Ela
   foi refeita "em vidro azul-claro, nunca branca" (1,25 cr).
2. **A câmera lia como pílula** com um olho. Refeita "vista de frente, com
   lente, visor e flash, claramente uma câmera". Descrever o que torna o
   objeto reconhecível vale mais que descrever o material.
3. **A ARTE É MAIOR QUE A CAIXA DO TRAÇO, nos dois lugares em que ela entrou
   numa caixa desenhada para o Lucide.** Um traço de 1,7px preenche a caixa;
   uma peça 3D tem volume, sombra no chão e perspectiva. Na barra, a 28px ela
   saía com metade do tamanho visual do aro do SOS ao lado — virou
   `transform: scale(1.5)` (não entra no layout, o alvo de 44px fica igual, e o
   `scale-110` do ativo é a propriedade `scale`, que compõe sem brigar). No
   quadrado da grade, a 44px num ladrilho de 175px ela era um selo perdido no
   canto — virou 64px, a mesma proporção que o ícone-no-círculo já tinha.

### ⚠️ O que o gerador recusou, e como se contorna

Sete pedidos falharam no backend (não no limite de taxa) e três deles falharam
DUAS vezes com o mesmo texto: "gift box", "two hands clasped" e "birdhouse with
bird". Reescritos com outras palavras ("wrapped present", "two hearts leaning",
"bluebird on a fence") passaram de primeira. **Falha repetida do mesmo prompt
não é azar — é o texto.** E o limite de taxa aparece a partir da terceira dúzia
em sequência: espere o lote anterior terminar antes de reenviar.

⚠️ **Não há `sharp` nem `PIL` neste contêiner.** Folha de contato e
redimensionamento passam pelo Chromium do Playwright (canvas → `toDataURL`),
que é o mesmo caminho de `do-drive.mjs`. Um `require("sharp")` falha em
qualquer diretório.

**Bancadas:** `/preview-home?w=20` (a barra, de dia e de noite — a noite pelo
`page.clock`) · `/preview-comunidade?vivo=1` · `/preview-cantinho` ·
`/preview-grades` (⚠️ é um `fixed inset-0` que rola POR DENTRO: `scrollTo` na
janela não move nada e a captura de página inteira mostra o site por baixo —
fotografe o ELEMENTO da grade).

### O material dos cartões, e os rótulos que saíram da caixa alta (set/2026)

A etapa sem crédito da mesma leva. Medido antes: **153 cartões** escritos à
mão como `rounded-*xl border border-border bg-card` (contorno de 1px + fundo
chapado — o tell número um de tela gerada) e **40 rótulos** em
`text-xs uppercase tracking-[0.22em]` (o "eyebrow" espaçado, o tell número
dois).

- **`.card-material`** (`styles.css`) é a superfície: brilho de topo, borda que
  é luz e não linha, a sombra macia do token. Substitui `border border-border
bg-card` no literal — nada mais disputa fundo e borda com ela.
  ⚠️ **NÃO é o `.card-3d` que já existia**: aquele é o cartão TÁTIL do painel
  do admin, com lábio de 4px e `translateY` no hover. Reusá-lo em 153 cartões
  de leitura poria salto de botão em superfície de texto. A colisão de nome
  foi pega por um `assert` antes de qualquer edição — **conferir se a classe
  existe antes de criá-la**, sempre.
  ⚠️ Quem carrega `shadow-[var(--shadow-float)]` (os dois modais) ficou de
  fora: a classe vive FORA de `@layer` e a sombra dela venceria a flutuante.
- **Os rótulos viraram serif 15px semibold**, na mesma cor. "2º TRIMESTRE ·
  HELENA ESTA SEMANA" espaçado em caixa alta lia como etiqueta de template;
  em serif lê como título pequeno, que é o que ele é. ⚠️ O `font-serif` já
  existia (`--font-serif`), o que foi conferido ANTES da troca: sem ele a
  substituição cairia em Times.
- **O anel de raridade** das conquistas ganhou o mesmo brilho de topo; a COR
  continua sendo a identidade (o teste cobra `slate`/`sky`/`amber`, e só isso).
- **As nove pílulas de contorno das Amigas** ("Desfazer", os pedidos) viraram
  `pill-3d` — tinham ficado de fora da varredura da Comunidade.

Sobraram **4** literais de contorno no app, todos com variante própria
(`border-slate-200`), e o **site institucional e o painel do médico não foram
tocados** — o pedido é sobre o APP.

**Bancadas:** `/preview-bebe-tab` · `/preview-conquistas?tudo=1` ·
`/preview-amigas?dupla=ativa&dias=12` · `/preview-assinatura?estado=loja`.

### As três grades que faltavam: Consultas, Bem-estar e Registros (set/2026)

Depois da Saúde e do Bebê, eram as últimas grades com o traço de 40px num
círculo branco dentro de ladrilhos de 300px — "o lugar onde a ilustração ainda
não chegou", nas palavras deste arquivo. **16 ladrilhos**, 14 peças novas a 1k
(17,5 cr; 132,75 acumulados dos 300) e duas REUSADAS da Saúde.

- ⚠️ **Chutes e Contrações reusam a arte da Saúde de propósito.** O hub da
  Saúde abre `Registros` já na sub-tela certa — é o MESMO destino por duas
  portas, e duas artes ensinariam que são coisas diferentes.
- ⚠️ **`const` DE MÓDULO NÃO É IÇADO, e isso derrubou o app inteiro por dois
  minutos no servidor de dev.** `ARTE_GRADE` foi declarado ao lado de
  `CONSULTAS_SUBTABS` (linha 9919) e `BEMESTAR_SUBTABS` o lê na 2984: o
  módulo estourava com "antes de inicializar" na AVALIAÇÃO, e **toda página do
  app respondia 500** — `/preview-grades` voltou "This page didn't load".
  `tsc` não acusa (o símbolo existe), lint não acusa, e o portão estava
  rodando verde em cima disso. Quem pegou foi a FOTO da bancada. A regra:
  **um mapa de arte mora antes da PRIMEIRA constante que o lê**, e num arquivo
  de vinte mil linhas isso se confere com `grep -n`, nunca de memória.
- **Quatro peças falharam no backend e voltaram com outras palavras** —
  "calendar page with check" → "desk calendar block with a tick"; "scroll" →
  "rolled parchment tied with a ribbon"; "wallet with card" → "coin purse
  with clasp"; "heart wrapped in blanket" → "heart resting in a cushion
  nest". Mesma lição da leva anterior: falha repetida é o texto.

**Bancada:** `/preview-grades` (fotografe o ELEMENTO de cada grade; a página
rola por dentro de um `fixed inset-0`).

### A vitrine inteira: os 90 itens que faltavam (set/2026)

Depois dos 17 grátis, a vitrine do Cantinho misturava peças de vidro com
emojis chapados NA MESMA GRADE — inconsistência dentro de uma tela só, pior
que tudo emoji. Os 90 restantes entraram: **107 itens vivos, 107 artes**, e
`ARTE_DO_ITEM` é gerado a partir da pasta `src/assets/cantinho/`. Custo:
112,5 cr nas peças mais as refeitas (255 acumulados dos 300, medido pelo saldo).

- ⚠️ **BRANCO SOBRE BRANCO É COMIDO PELO RECORTE**, e desta vez foram quatro
  de uma vez: o berço branco, a ovelha branca, a nuvem e o ladrilho de neve.
  Sobre a folha branca do gerador eles parecem inteiros; sobre ROSA sobra um
  fantasma. A regra que fica no prompt: **"clearly colored, never white"** —
  berço em menta, lã creme sombreada, neve em azul-gelo. Conferir SEMPRE
  sobre rosa, e o PSNR abaixo de 42 é o primeiro aviso (o script de recorte
  REPROVA ali, e ele tem razão).
- ⚠️ **O gerador emoldura PLANTA em cartão de vidro** sem ninguém pedir:
  girassol, tulipa, cerejeira, roseira e palmeira vieram dentro de um
  ladrilho — que é a forma reservada aos FUNDOS. Refeitas com "the plant
  alone with nothing around it, no card, no border". Descrever o que NÃO
  pode existir em volta vale tanto quanto descrever o objeto.
- ⚠️ **Falha repetida do mesmo texto é o texto** — pela terceira leva:
  "cactus" falhou duas vezes e passou como "round green desert plant";
  "snowman" passou como "two stacked pale-blue snowballs"; "hot air balloon"
  como "striped air balloon shape". A lista de palavras que o backend recusa
  não é publicada, e o contorno é sempre descrever a FORMA.
- ⚠️ **O limite de taxa aceita ~3 lotes de 12 e depois recusa tudo** por um
  minuto. O ritmo que funcionou: um lote, `jobs_wait`, pipeline do lote
  anterior, próximo lote — a espera do pipeline É o intervalo.
- ⚠️ **O pipeline tem de tolerar o REPROVA do recorte**: `do-drive.mjs` sai
  com código 1 quando o PSNR fica abaixo de 42 — e o `.webp` está escrito. A
  primeira versão derrubava o lote inteiro por causa de UM ladrilho de neve.
  Hoje anota `⚠️` e segue; a decisão de refazer é humana, na folha.
- **A trilha continua com emoji**, e a decisão está no cabeçalho de
  `arte-do-cantinho.tsx`: só a VITRINE mudou.
- ⚠️ **OS 17 GRÁTIS VOLTARAM AO EMOJI, por decisão do dono** ("os itens grátis
  da loja quero que fique os antigos, os novos podem ser assim"). A arte fica
  só nos 90 premium — o que, de quebra, separa visualmente a prateleira grátis
  da paga sem uma palavra. Item grátis novo entra em emoji.

**Pipeline reproduzível:** `scratchpad/arte4/{mapa.txt,pipeline.mjs}` —
`node pipeline.mjs lote.txt` (linhas "índice url") baixa, recorta, redimensiona
a 144px com o nome do item e monta a folha sobre rosa. Vive no scratchpad
porque depende de URLs efêmeras do gerador; a versão que vale é a descrição
acima mais `scripts/bebes/do-drive.mjs`.

**Bancada:** `/preview-cantinho` (rolar a vitrine: nenhum `span.text-4xl`
deve sobrar — medido: 0).

### A estética virou a do dono: o coração de referência do Drive (set/2026)

Depois de ver os ícones 3D no aparelho, o dono disse que estavam "muito
tecnológicos, com vários efeitos" — e mandou pelo Drive a imagem que ELE
queria ("Imagem referência coração saúde"): um coração rosa-doce, brilho
suave, formas simples, sem rosto, sem textura. Onze variações minhas
(argila, guache, pelúcia, kawaii, Pixar, toon…) não chegaram lá; a referência
dele chegou de primeira.

- **O coração da Saúde É a imagem dele**, recortada por `do-drive.mjs` (alfa
  real, PSNR 49). Os outros quatro (chutes, contrações, nutrição, mulher)
  foram gerados com **`nano_banana_pro` + `image_references`** (2 cr cada),
  com o prompt pedindo "EXACTLY the same illustration style as the reference
  image" e descrevendo o estilo em palavras junto (glossy candy-like, soft
  white highlights, simple rounded shapes, no outline, no face).
- ⚠️ **Referência de imagem vale mais que dez prompts de estilo.** O `recraft`
  com prompt sozinho oscilou entre vidro, argila e feltro; com a imagem dele
  como referência, os quatro saíram na mesma família de primeira. Para as
  próximas famílias (grades, Cantinho), o caminho é este: pedir a referência
  ao dono e gerar a partir dela — não descrever de memória o que ele gosta.
- ⚠️ **O arquivo do Drive baixa por link direto**
  (`drive.google.com/uc?export=download&id=…`), sem passar o base64 pelo
  contexto: 900 KB de PNG virariam ~300 mil tokens numa leitura.
  `media_import_url` do Higgsfield aceita a mesma URL.

**Bancada:** `/preview-saude?w=38` (as cinco) · `?w=20&dados=1`.

### O ícone pousou num pratinho, no centro do bloco (set/2026)

Pedido do dono, depois do hub da Saúde com o coração dele: "cada ícone
centralizado e com um efeito atrás gradiente mais bonito, está muito básico".
Feito em CSS, em `GradeHub`, para TODAS as grades com imagem — zero crédito.

- **Três camadas atrás da peça**: um brilho grande desfocado na COR DA
  FAMÍLIA do bloco (`tinta` via `currentColor` — verde no Saúde, azul nos
  Chutes: a família continua sendo uma decisão só), um **disco branco nítido**
  com anel de luz (o "pratinho" onde a peça pousa) e, no bloco inteiro, uma luz
  radial branca vinda de cima. A peça fica centrada, e no bloco alto ocupa o
  espaço livre (`flex-1`) em vez de colar no topo.
- ⚠️ **A primeira versão era só o brilho desfocado, e sobre pastel ele não se
  via** — a foto mostrou o mesmo bloco de antes com o ícone deslocado para o
  meio. O que dá corpo é o disco NÍTIDO; o desfoque sozinho é sugestão.
- ⚠️ **A peça no quadrado é 56px num pratinho de 68px**: a 48 ela parecia um
  selo perdido no prato. E o número do bloco alto ganhou `mb-3`, senão o
  `flex-1` da peça empurrava "68,4 kg" para cima do rótulo.
- As peças antigas em vidro (Bebê, Consultas…) ficam pequenas no prato porque
  a arte delas tem margem própria; a hora de acertar é quando forem refeitas
  na referência do dono, não com um tamanho por grade.

**Bancadas:** `/preview-saude?w=20&dados=1` · `/preview-grades` (a do Bebê).

### As grades e a Comunidade seguiram o coração (set/2026)

Pedido do dono: "esses outros — semana, álbum etc. — estão muito ruins, devem
ficar no design desse de saúde". As 26 peças que ainda eram do vidro
tecnológico foram refeitas com a MESMA referência e o MESMO prompt da Saúde
(`nano_banana_pro` + `image_references`, 2 cr cada, 52 no total): Bebê (6),
Consultas (7), Bem-estar (5), Registros (2 — chutes e contrações já eram os da
Saúde) e as seis portas da Comunidade. Nenhuma precisou ser refeita: com a
referência, 26 de 26 saíram na família de primeira.

- O `pipeline.mjs` desta leva vive em `scratchpad/ref-grades/` e grava direto
  com o caminho do asset (`bebe/semana`, `grades/agenda`…), então instalar é
  um `cp` por pasta. Os nomes NÃO mudaram: nenhum `import` foi tocado.
- ⚠️ **`generate_image_batch` aceita 12 por chamada, e eu contei 13 duas
  vezes.** A validação recusa a chamada inteira, sem submeter nada — barato,
  mas custa uma volta. Contar antes de mandar.
- O que continua em vidro: o Cantinho (90 premium) e os domos dos conjuntos
  (13). Refazer os dois na referência custa ~206 cr, fora do teto atual.

**Bancadas:** `/preview-grades` (as quatro grades) · `/preview-comunidade?vivo=1`.

### Dentro de cada sub-tela, o bloco que a abriu (set/2026)

Pedido do dono: "dentro de cada aba, ver como mudar para ficar no design
daquela aba — a da Saúde é um coração com fundo verde; lá dentro tem de estar
similar. Faça isso com todos."

- **`VoltarDaGrade` virou o cabeçalho da sub-tela**, alimentado pelo MESMO
  `ladrilho` que desenha o bloco: o degradê da família, a peça no pratinho, o
  rótulo e a linha de baixo, com a seta de voltar dentro. Quem toca no coração
  verde chega numa tela que começa com o coração verde — por construção, não
  por alguém lembrar de pintar cada tela. Vale para as quatro grades (Bebê,
  Consultas, Bem-estar, Registros) e para as três abas que o hub da Saúde abre
  (Saúde, Nutrição, Saúde da mulher — `CabecalhoDaSaude`, sem seta, porque
  ali a barra de cima é quem volta).
- ⚠️ **Chutes e Contrações eram AZUL e LARANJA na Saúde e ROSA e ROXO em
  Registros** — o mesmo destino por duas portas, com duas cores. Quem tocava no
  bloco azul chegava numa tela rosa. Registros passou a emprestar a família da
  Saúde para os dois.
- **Bancadas:** `/preview-grades?cabecalhos=1` (os 22 cabeçalhos) ·
  `/preview-saude?w=38&cabecalhos=1` (os cinco). O cabeçalho só existe depois
  de um toque que a bancada não dá, então ele ganhou uma porta própria.
- **Fica para a segunda passada:** as portas da Comunidade abrem telas com
  cabeçalho próprio (Amigas tem o herói pintado do Drive; Chá de bebê,
  Acompanhante e o Feed têm os seus) — decidir se ganham o mesmo cabeçalho é
  olhar cada uma.

#### E as portas da Comunidade ganharam família (set/2026)

Segunda passada do mesmo pedido. As seis portas eram cartões brancos com a
peça no canto; agora cada uma tem `caixa`/`tinta` em `PORTAS` (rosa no chá,
laranja no feed, lilás nas amigas, verde-água no acompanhante) e desenha a
peça no pratinho, como as grades. **Álbum e Nome repetem a família dos
quadrados do Bebê** que abrem — mesmo destino por duas portas, mesma cor.
`CabecalhoDaPorta` abre Chá de bebê e Acompanhante com o bloco da porta; o
`<h2>🎁 Chá de bebê</h2>` do componente saiu (seria eco). Amigas (herói
pintado do Drive) e Feed (modelo do Instagram) ficam como estão, de propósito.

**Bancadas:** `/preview-comunidade?cabecalhos=1` · `/preview-presentes?dona=1`.

#### ⚠️ Dois portões no MESMO log, e um "NÃO COMMITE" que era de outro

Um `bun run verificar` em segundo plano (disparado antes de um conserto de
tipo) e outro em primeiro plano escreveram no MESMO arquivo de log. O primeiro
terminou "tudo verde", o segundo trouxe um "Parsing error" de um arquivo que o
prettier ainda estava reformatando naquele instante — e o `grep "tudo verde"`
que guardava o commit casou o bloco do OUTRO processo. O commit saiu; o
portão rodado de novo, sozinho, deu verde, e a árvore estava certa. Mas foi
sorte: **um portão por vez, com log próprio, e `pkill` do anterior antes de
começar o seguinte.** Log compartilhado é portão que mente nas duas direções.

## A letra do app: Nunito, e o piso de 13 px (set/2026)

Pedido do dono: _"faça um estudo profundo… veja qual fonte deveríamos usar…
cor tamanho etc"_. O estudo mediu antes de opinar, e a resposta à sensação de
"as fontes estão um pouco ruins" era esta: **o app não tinha fonte, tinha o
padrão de cada aparelho** — SF Pro no iPhone, DM Sans no Android —, e a página
ainda pedia DM Sans + Nunito + Inter ao Google (482 KB referenciados, nenhum
usado no iPhone; Inter sem um uso no código).

Quatro telas renderizadas em quatro sistemas (atual · Nunito · Plus Jakarta ·
Figtree+Fraunces), lado a lado; o dono escolheu a **Nunito**.

- **Uma família, quatro pesos**: 500 texto · 600 rótulos e botões (e o corpo
  no escuro) · 700 subtítulos · 800 títulos e números. Self-hosted em
  `public/fontes/` (variável, latim, ~40 KB por estilo), preload do normal,
  `font-display: swap` + "Nunito Reserva" com `size-adjust` para a tela não
  pular. ⚠️ **O arquivo "latin" do Google cobre U+0000-00FF** — ã, ç, é, ê,
  ô, ú, º estão lá; não é preciso o latin-ext.
  ⚠️ **Baixe o subconjunto CERTO**: a primeira tentativa pegou o
  `cyrillic-ext` por um `awk` frouxo. Confira o `unicode-range` do bloco antes
  de gravar, sempre.
- `--font-sans` e `--font-serif` apontam para a mesma família. **`font-serif`
  (341 usos) ficou como nome**: hoje quer dizer "peso de título", não serifa.
  Renomear é churn puro.
- Títulos em 800 com **−0,01 em** — a Nunito pede menos aperto que a SF; os
  −0,022 em de antes a deixavam grudada. Corpo em 1,55 de entrelinha e
  `tabular-nums` global.

### ⚠️ O PISO É 13 px, e ele foi aplicado pelo TOKEN

Medido antes: **1.112 textos do app em 10, 11 ou 12 px** e 39 no tamanho de
leitura — quase 400 abaixo do que o iOS chama de legenda (11 pt).

- **`--text-xs` virou 0,8125 rem (13 px)** no `@theme inline`. Redefinir o
  token subiu os 491 `text-xs` de uma vez, sem tocar em linha nenhuma.
- **Os literais de 10/11/12 px do app da paciente viraram `text-xs`** (473
  em 51 arquivos), e os fracionários (12,5 · 11,5 · 10,5 · 9,5 px · 0,65 rem)
  também. ⚠️ **Escopo: o app da paciente** — `minha-conta`, os componentes
  dela, `acompanhar`, `votar-nome`, `epds`. O painel do médico e o site
  institucional ficaram (327 literais): é desktop, e o pedido era sobre o
  APP. Os `text-xs` deles subiram junto pelo token, o que não faz mal.
- ⚠️ **Ficam em 9 px só GLIFOS de emblema** — o ✓ numa bolinha de 16 px, o
  "9+" do contador, o selo do médico em `size="xs"`. Não são texto de
  leitura; a 13 px estourariam a bolinha. As etiquetas em caixa alta
  ("PREMIUM", "NOVO") e as legendas âmbar da loja subiram.
- **Medido depois, em 393 e em 320 px**, doze telas: `scrollWidth` igual ao
  viewport em todas, nenhum texto de leitura abaixo de 13 px, zero erros de
  console. Os "transbordos" que a sonda acusou são os `-mx-5` deliberados da
  fita do Caminho e halos decorativos absolutos — já existiam.
- ⚠️ **Trocar classe encurta linha, e o prettier cobra**: 55 arquivos
  reformatados depois da troca. Rode `bun run format` ANTES do portão, senão
  ele reprova por espaçamento sobre código certo.
- ⚠️ **`pgrep -f "verificar.sh"` mata o PRÓPRIO shell** que o invocou (a
  string está na linha de comando dele) — é de onde vinha o exit 144 do
  portão. Use um colchete no padrão: `pgrep -f "scripts/verifica[r].sh"`.

**Onde 13 px não couber, muda-se o DESENHO** (duas linhas, uma palavra a
menos, o número sozinho), nunca a letra para baixo.

## Os caminhos: o estudo de navegação e as três camadas (set/2026)

Pedido do dono: _"sinto que hoje o app tem muitas funções porém é muito
complexo para chegar em todas — a pessoa pode viver o tempo inteiro usando o
app e nem sequer sabendo da existência de algumas funções"_. Um agente mapeou
toda porta da paciente (arquivo e linha para cada afirmação), e eu conferi no
código os achados que decidiam as propostas antes de escrever — **um deles
seria falso** se não tivesse sido conferido (a lista de interruptores de
aviso tinha chamador, sim).

**O que o mapa mediu:** 24 abas e 60+ destinos atrás de 5 portas; 14 funções
da Comunidade só atrás de um gesto que nada anunciava (tocar de novo no ícone
da barra); a aba **Bem-estar** inteira sem porta no celular fora do Modo
Cuidado; **Saúde da mulher** sumindo por nove meses com um comentário
garantindo acesso por um menu que é `hidden md:flex`; a grade do **Bebê** só
alcançável apertando "voltar"; o **tutorial** destacando um item `chat` que a
barra não tem desde ago/2026. Estudo publicado como artefato; as decisões que
importam estão abaixo.

### Camada A — as portas, sem mudar o desenho

- **O tutorial ensina a barra REAL** (`tutorial-do-mascote.ts`): o cartão do
  chat virou o da Comunidade, e entraram os cartões do ☰ e da bolha.
  `DestaqueDoTutorial` ganhou `"menu" | "bolha"`, e os dois pulsam **acima do
  véu** (`z-[39]` contra o véu em `z-38`) — sem isso o cartão apontava para um
  borrão. A bancada `/preview-tutorial` ganhou o topo da home (☰ + bolha),
  senão ela mostraria um cartão falando de um botão que não está na tela.
- **O ☰ ganhou quatro linhas**: "Estou com um sintoma" (`Alertas`),
  "Carteirinha de emergência", "Bem-estar" e "Meu Cantinho" (`Recompensas`,
  some no luto — `MenuDaConta` ganhou `careMode`). ⚠️ **A grade da Saúde NÃO
  recebeu Bem-estar nem Alertas**: o dono pediu por escrito que ela não os
  tivesse. O ☰ é a lista completa; a grade é a curta. E a Carteirinha VOLTOU
  ao ☰, desfazendo uma decisão anterior — a paciente só descobria que ela
  existe depois de apertar o SOS.
- **Saúde da mulher fica sempre na grade**; `mostrarSaudeDaMulher` decide só a
  LEGENDA ("O que fica para depois do parto"). Uma garantia escrita que o
  aparelho não cumpre é pior que nenhuma.
- **A bolinha ⊞ "Mais" abre o hub da Comunidade**, e ela é a **PRIMEIRA** da
  fileira de stories (`FileiraDeStories.aoAbrirMais`). O cabeçalho do feed
  saiu a pedido do dono, então a porta entra onde o dedo já olha. ⚠️ Medido: em
  último lugar ela caía em x=544 num viewport de 393 — uma porta que só
  aparece rolando é o defeito que ela veio consertar. O onboarding da
  Comunidade ganhou o quinto cartão, "Onde ficam as coisas".
- **O bebê da home abre a GRADE do Bebê** (`onNavigate("Bebê")`), e
  `?tab=Bebê` abre a aba: `mobileHome` nasce
  `initialTab === "Bebê" && !tabPedidaNaUrl`, porque "Bebê" é a aba padrão E
  a aba do bebê, e `initialTab === "Bebê"` não distinguia as duas.
- **A grade das sete sub-telas de Consultas subiu para o topo**, acima do
  calendário.
- **Limpeza**: `"Exames"` saiu de `AppTab`/`SECTION_TABS` (não tinha tela), o
  import morto de `CodigoDaEmbaixadora` em `minha-conta` saiu, e o comentário
  descrevendo um "bolão do nascimento" que não existe no repositório saiu.

### Camada B — a bolha vira guia, e o app ganha um mapa

`src/lib/mapa-do-app.ts` é a **lista única** (34 funções: id, título,
descrição, `dica`, `tab`, `sub`, grupo, `noLuto`, `semanaMin`), e duas coisas
a leem — por isso ela é uma:

1. **"Tudo o que o app faz"** (`mapa-do-app.tsx`, primeira linha do ☰):
   agrupada por PERGUNTA ("Estou bem?", "E o bebê?", "Quem está comigo",
   "Meu dia", "Minha conta"), com busca sem acento. O que ela nunca abriu
   ganha "novo para você"; o que já abriu não ganha selo nenhum — marcar o
   visto viraria placar.
2. **O "Você sabia?"** (`dicaDaSemana`): uma vez por semana, no dia em que não
   há recado, a bolha apresenta UMA função que ela nunca abriu, e o toque no
   balão leva lá (`FalaDoMascote.aoTocar`, que vence os recados no toque do
   balão). Precedência da FALA: recado > dica > frase do dia.

- ⚠️ **Nunca no Modo Cuidado** — nem as funções permitidas viram dica: quem
  está de luto não abre o app para um passeio guiado.
- ⚠️ **"Já abriu" é alimentado por `goToTab`**, o único ponto por onde toda
  navegação passa (`idDaFuncao`, o id mais específico do destino). Chaves
  `dc-path-` (`CHAVE_VISITADAS`, `CHAVE_DICA`), para viajarem no
  `journey_state` — senão a bolha repetiria a mesma dica no outro aparelho.
- ⚠️ **O efeito espera `ensureInitialJourneyPull()` antes de ler e gravar**:
  `lsSet` numa chave `dc-path-` agenda um PUSH, e empurrar antes do pull
  sobrescreve a jornada real por um blob incompleto. Mesma regra do
  onboarding da Comunidade.
- ⚠️ **A dica é marcada como mostrada quando é DECIDIDA, não no toque** —
  quem leu e não tocou não a reencontra amanhã; senão a bolha vira letreiro
  da mesma frase por sete dias. E é decidida num EFEITO, nunca no render:
  ela lê `localStorage` e `Date.now()`, os dois divergem entre servidor e
  cliente.
- **`mapa-do-app.test.ts` confere o catálogo contra o fonte**: toda `tab`
  está em `TABS`, toda `sub` existe no hub daquela aba, toda dica termina em
  "?" e nenhuma cobra (regex). Função apontando para tela que não existe é o
  defeito que o teste existe para pegar.

### Camada C — as decisões do dono, aplicadas

- **Triagem e carteirinha fora do SOS**: pelo ☰ (acima). O SOS continua sendo
  o caminho da mão tremendo.
- **As três lojas com nomes que não se confundem**: "Loja de produtos" (☰,
  dinheiro) · "Meu Cantinho" (☰ e fita do Jogo, enfeites) · "Loja de
  Sementinhas" (a folha do saldo — o nome está PINTADO no herói do Drive, e
  fica). O Cantinho ganhou porta no ☰ para não depender do botão flutuante do
  Jogo, que some em dois estados.
- **Bem-estar e Jogo continuam duplicando meditação e exercício**, com papéis
  distintos: no Jogo é a atividade do dia, que pontua; no Bem-estar é a
  biblioteca inteira, sem pontuação.

**Bancadas:** `/preview-tutorial?nome=Ana` (os nove cartões; o 6º acende o ☰,
o 7º a bolha) · `/preview-instagram` (a bolinha ⊞ em x=16) ·
`/preview-conta` (o ☰ com as cinco linhas novas) · `/preview-mapa`
(`?luto=1` · `?w=38` · `?abertas=saude,chutes`) · `/preview-home?w=20&dica=1`.

## A noite de 3 para 4 de setembro: o chat, o SOS e os Sons na mesma família (set/2026)

Pedido do dono antes de dormir: "quando eu acordar, que esse app esteja com
uma cara sensacional" — varrer a identidade visual do app inteiro, refazer o
chat ("o design dele não está interessante" e "quando eu clico para digitar,
desce o texto, a tela se desloca"), e não mexer nos itens do Jogo além de
conferir que entram certo.

### O chat saiu de `minha-conta.tsx` e ganhou a cara do app

- **O move veio ANTES do redesenho**, como sempre: `src/components/chat-tab.tsx`
  nasceu com o corpo byte a byte igual (SHA-256 conferido) e um commit só de
  move. Seis testes liam o chat pelo fonte de `minha-conta`; quatro conferem
  os DOIS arquivos e passaram a ler os dois juntos. ⚠️ Um deles passava por
  acidente — procurava `content: acc }` do primeiro
  `streamAbertoRef.current = false;` até o fim do arquivo e achava no chat da
  NUTRIÇÃO, que vinha depois. Décima terceira vez da armadilha de substring.
- ⚠️ **O deslocamento ao digitar tinha DUAS causas somadas**: o chat era uma
  caixa de 72vh DENTRO da página rolável (o iOS rola a página para trazer o
  campo à vista), e o campo tinha **15px — abaixo de 16px o Safari do iPhone
  dá ZOOM ao focar**. No celular o painel agora é `fixed` e mede o
  `visualViewport` (com o teclado aberto ele encolhe junto; a lista rola por
  dentro; o compositor pousa em cima do teclado; o `body` fica travado
  enquanto o chat está montado). O campo tem 16px. No computador continua uma
  caixa estática de 72vh.
- **O desenho**: creme, Nunito, bolha da IA em `card-material`, bolha da
  paciente no rosa primário, chips `pill-3d`, botões `btn-3d`, cabeçalho com a
  Bolha e a seta de voltar (`onVoltar`, porque o painel cobre a barra da
  página). O céu de madrugada com três auroras saiu: era bonito e dizia "isto
  é outra coisa".

### As duas famílias de emoji que sobravam viraram peças

- **A Central de Emergência**: 🚑 e 🚒 eram os únicos emojis de uma tela em que
  tudo o mais é desenhado. Viraram `src/assets/sos/{ambulancia,bombeiros}.webp`
  na referência do dono. ⚠️ **A ambulância é azul-clara de propósito**: a
  primeira saiu branca e o recorte a comeu — a lição da nuvem e do berço,
  paga de novo.
- **Os Sons para dormir**: 32 sons + 2 histórias, todos emoji numa tela escura.
  `src/components/arte-dos-sons.tsx` é o mapa (`ARTE_DO_SOM`, chave do som ou
  da história → arte) e `IconeDoSom` é o ícone: **a peça quando existe, o
  emoji quando não** — som novo entra com emoji e ganha peça quando a arte for
  feita, nunca com um buraco. Usado na folha de Sons, nos chips de som da
  meditação e na tela da história. O pipeline vive em
  `scratchpad/nav/sons/{chaves.txt,urls.txt,pipeline.sh}`: 68 cr, 34 peças,
  PSNR 47–50, zero refeitas.

### O que a varredura visual MEDIU e estava certo

33 bancadas da paciente a 393px, lidas por script: **100% Nunito** (o único
`ui-monospace` é código de indicação e link, de propósito), **zero texto de
leitura abaixo de 13px** fora das legendas das bancadas e de dois glifos de
emblema, nenhuma página rolando na horizontal, zero erros de console.

### A madrugada continuou: avisos, o cartão que sai do app e os últimos rótulos

- **As notificações e o ritual** — os quatro avisos derivados da central
  (médico, convite, localização, contato) e a festa do último passo do ritual
  eram emoji. Viraram peças em `src/assets/avisos/`. ⚠️ O mapa da central é por
  EMOJI (`ARTE_DO_AVISO`), porque `Notificacao.icone` é o campo que viaja: uma
  notificação nova nasce com emoji e aparece com ele até ganhar peça.
- **O cartão de compartilhar era a única peça do produto em Georgia** — e é a
  que sai para o WhatsApp e o Instagram com o nome do consultório. Agora
  desenha em Nunito (`LETRA` em `share-card.ts`), nos pesos da régua da letra.
  ⚠️ **O canvas NÃO espera fonte**: `fillText` com família ainda não carregada
  desenha na reserva e não avisa. Os dois caminhos assíncronos chamam
  `garantirLetra()` (`document.fonts.load`, teto de 1,5 s) antes de desenhar;
  o síncrono roda depois de a tela já estar pintada em Nunito. O chapéu deixou
  de ser caixa alta espaçada letra a letra.
- **Doze rótulos em caixa alta espaçada** que a passada do material dos
  cartões não alcançou viraram o serif de 15 px semibold. ⚠️ O Jogo
  (`gestacao-path.tsx`, quatro deles) e o site institucional ficaram como
  estavam, de propósito — o dono pediu para não mexer no Jogo. A sonda
  `[class*='uppercase'][class*='tracking-']` nas cinco bancadas afetadas volta
  vazia; o que sobra com esse padrão está no site, no painel do médico e numa
  legenda de bancada.
- **Medido ao fim desta leva:** 124 bancadas varridas e 11 roteiros de
  interação, zero problemas; 5.523 testes verdes.

### ⚠️ NENHUM CAMPO DO APP DÁ ZOOM NO IPHONE — uma regra, não 155 edições

Abaixo de 16px o Safari do iPhone AMPLIA a página ao focar um campo, e não
volta sozinho. Foi metade da causa do "a tela se desloca" do chat — e o chat
era UM de **161 campos do app: 155 estavam em 13, 14 ou 15px** (medido).

A regra vive no fim de `styles.css`, **fora de @layer** (regra sem camada
vence qualquer utilitário sem `!important`) e recortada por
`(max-width: 767px) and (pointer: coarse)` — no computador nada muda.
`max(16px, 1em)` só SOBE. Medido em oito telas no modo toque: zero campos
abaixo de 16, nenhuma rolando na horizontal.

⚠️ **Campo novo com `text-sm` continua CERTO no código** — a regra o sobe no
aparelho. Não "conserte" um campo pondo `text-[16px]` à mão fora do chat: a
regra já faz isso, e o 16 à mão só estraga o computador.

**E o `/auth`** — a porta de entrada — era a última tela com a cara antiga:
rótulo espaçado, cinco cartões de contorno, papéis a 12,5px, botões chapados.
Ganhou o material do app e o piso de 13px; "Acompanhante" continua cabendo a
320px pela hifenização que já estava lá.

**E as páginas que a FAMÍLIA abre** — o painel do acompanhante, a lista
pública do chá e o batimento — ainda tinham cartão de contorno e botão
chapado. São a cara do app para quem nunca o instalou (chegam pelo link do
WhatsApp). Entraram no material; medido nas quatro bancadas: zero pílulas e
zero cartões de contorno.

**Fechamento da noite (medido):** 5.527 testes verdes · 124 bancadas e 11
roteiros de interação sem problema · a varredura de acessibilidade caiu de
124 para 113 achados de contraste e de 49 para 40 de alvo (os que ficam são
texto auxiliar do Jogo e o ✕ do chá, ambos já registrados como decisão do
dono) · nas bancadas da paciente fora do Jogo, zero pílulas de contorno e
zero cartões de contorno restantes.

## O leque da Comunidade voltou a caber na tela (set/2026)

O dono, com a foto do aparelho: _"muitas opções e muito confuso"_. O leque
que sobe do ícone da Comunidade tinha **catorze bolinhas numa coluna só** —
nasceu com seis e cada função nova entrou ali. Com catorze ele passava por
cima do relógio e do sinal do celular, três ícones se repetiam (a grade três
vezes, a pessoa três vezes) e ele misturava três naturezas de coisa: o que ela
faz todo dia, o que é dela, e segurança.

- **O leque ficou com QUATRO de uso diário** (Atividade · Mensagens ·
  Publicar · Meu perfil) **e a quinta bolinha é "Mais"** (⋯), que abre
  `MaisDaComunidade` — uma folha em três grupos com ícone PRÓPRIO por item:
  Minhas coisas (Salvos, Arquivados, Meus stories, Favoritas) · Descobrir
  (Explorar, Buscar) · Segurança (Bloqueados, Suas denúncias, Caixinha).
- ⚠️ **Função nova entra na FOLHA, num grupo — nunca no leque.** O leque
  chegou a catorze exatamente porque era o lugar mais fácil de acrescentar.
- ⚠️ **Chá de bebê, álbum, amigas e acompanhante saíram do leque.** A porta
  deles é a bolinha ⊞ da fileira de stories, que já existia: dois "Mais" na
  mesma tela com destinos parecidos era metade da confusão.
- **O emblema da Caixinha sobe para a bolinha "Mais"**: sem isso, uma pergunta
  sem resposta ficaria invisível até ela abrir a folha.
- **A folha fecha sozinha ao sair do feed** e fecha ANTES de agir, como a
  nuvem de atalhos.
- ⚠️ **A folha recebe tudo por prop**, e é isso que a torna fotografável:
  `/preview-instagram?tela=mais`. O leque nunca teve bancada, e foi assim que
  ele chegou a catorze sem ninguém olhar. Medido: nove alvos de 357×54, zero
  erros de console.
- **A ambulância e o caminhão do SOS voltaram a ser emoji**, por decisão do
  dono ("preferia a antiga"). As duas peças ficaram em `src/assets/sos/` sem
  uso; o comentário do arquivo diz para não reintroduzi-las sem foto aprovada.

## A abertura do app e a fita do Jogo pararam de esperar o servidor (set/2026)

O dono, no aparelho: _"a primeira tela está demorando muito para carregar"_ e
_"na aba do Jogo o número de sementinhas e o da ofensiva demoram"_. Medido no
código, não deduzido:

- **A home esperava DUAS funções serverless para pintar.** O portão `loading`
  só abria depois de `checkIsAdmin` e `getMyDoctor` — duas idas ao servidor de
  funções da Vercel, que acorda frio — para uma gestante que já tem DUM no
  perfil e cuja resposta só pode confirmar que ela é paciente. Agora **quem
  tem âncora gestacional e não carrega a marca de médico é liberada assim que
  o perfil chega** (`liberarCedo`); o papel continua sendo aplicado quando
  responde. Quem NÃO tem âncora espera como antes — é ali que mora o médico
  sem marca, e a espera existia para o painel dele não piscar como app de
  gestante.
- **O perfil esperava o `getUser`** (uma ida ao servidor de auth) só para ter
  o `user.id`, que a SESSÃO local já tem. Agora sai junto. ⚠️ **O construtor
  do PostgREST é preguiçoso**: guardado cru numa variável ele só dispara no
  `await`; é o `Promise.resolve(...)` que o faz sair na hora. Sem isso a
  "rodada junta" seria em série de novo, com o comentário dizendo o contrário.
- **O 🌱 da fita nem era desenhado** até `claimDailyAndGetWallet` voltar (sete
  idas ao banco em série, dentro de uma função fria), e o `getCantinho` só saía
  DEPOIS dela. Agora a fita **pinta do cache** (`fita-cache.ts`: último saldo,
  troféus e amigas por uid, chave `dc-cache-fita:<uid>`) e as duas funções
  saem juntas. ⚠️ A chave NÃO é `dc-path-` (isso viajaria no blob da jornada e
  dispararia um push por escrita), e `saldo: null` é gravado como valor — é o
  Modo Cuidado, e a abertura seguinte já esconde o 🌱 em vez de piscá-lo.
- **A jornada usava `getUser` no pull e no push** — mais uma ida ao servidor
  de auth na frente da chama num aparelho novo. Virou `getSession`; a RLS de
  `journey_state` continua decidindo o que volta.

**O que NÃO foi feito, e depende do dono:** a função de servidor roda em
`iad1` (Washington). Se o projeto Supabase estiver em São Paulo
(`sa-east-1`), cada ida ao banco atravessa o continente e o conserto certo é
`vercel.functions.regions: ["gru1"]` no `nitro` do `vite.config.ts`. Se
estiver nos EUA, mudar pioraria. A região está em Supabase → Project Settings
→ General.
