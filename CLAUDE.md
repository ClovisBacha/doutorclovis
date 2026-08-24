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

`minha-conta.tsx` tem **20.367 linhas, 29 estados e zero memoização**: qualquer
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

**A maior peça que resta continua sendo `minha-conta.tsx`** — 20.367 linhas,
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
