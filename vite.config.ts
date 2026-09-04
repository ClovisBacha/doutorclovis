// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Build for Vercel (Nitro vercel preset). Override the Lovable defaults so the
  // output matches Vercel's Build Output API layout (.vercel/output), which Vercel
  // auto-detects: config.json + static/ + functions/__server.func/.
  nitro: {
    preset: "vercel",
    output: {
      dir: ".vercel/output",
      publicDir: ".vercel/output/static",
      serverDir: ".vercel/output/functions/__server.func",
    },
    /* Teto de execução da função de servidor.
    
       Precisa ser AQUI e não em `vercel.json`: com a Build Output API a Vercel
       lê `functions/__server.func/.vc-config.json`, e a chave `functions` do
       vercel.json não casa com nada — o deploy falha com erro de padrão que não
       corresponde a nenhuma função. (Foi o que aconteceu: build local verde,
       deploy vermelho.) O preset vercel do Nitro escreve este valor no
       .vc-config.json.
    
       30s porque o disparo do SOS é sequencial e pode falar com cinco serviços
       externos (push, e-mail do médico, e-mail do contato, WhatsApp Cloud e um
       webhook de SMS configurado pelo usuário). No teto padrão de 10s a função
       era cortada no meio: o médico já tinha recebido push e e-mail, e a tela
       dizia "não consegui avisar — ligue 192". */
    /* O cast existe porque o tipo do preset do Lovable declara só
       `preset`/`output`/`cloudflare` — mas o Nitro repassa o objeto inteiro para
       o preset, e o `vercel.functions.maxDuration` é honrado (conferido no
       `.vc-config.json` gerado). Sem o cast, `tsc --noEmit` reprova uma
       configuração que funciona. */
    /* ⚠️ **A CASCA DO APP É GUARDADA NA BORDA, e não montada a cada
       abertura (set/2026).**

       O dono: "a primeira tela está demorando muito para carregar quando abro
       o app". O app instalado abre em `/minha-conta` (o `start_url` do
       manifesto), e toda abertura acordava uma função em Washington para
       montar um HTML que é IDÊNTICO para todo mundo — conferido: a rota não
       tem `loader` nem `beforeLoad`, o `head()` é fixo, e o portão que
       decide se ela está logada roda no TELEFONE (`getSession` lê o
       armazenamento local, ver `_authenticated/route.tsx`). Não há nada por
       usuária naquele HTML.

       Com `isr`, a Vercel guarda a resposta na rede de distribuição — que tem
       ponto em São Paulo — e passa a servi-la de lá. O ganho maior não é a
       distância: é que **a borda nunca fica fria**. Função fria é o pior caso
       da abertura, e é o que faz a demora ser às vezes muito maior que a
       média: a paciente espera um Node subir do outro lado do continente
       antes de o navegador saber sequer o que baixar.

       ⚠️ **E continua em TEMPO REAL, que foi a condição do dono** ("acho que
       tem que ser em tempo real"). O cache da borda é POR PUBLICAÇÃO: cada
       deploy começa com ele vazio, então o que ela recebe é sempre o último
       commit. Isto NÃO é o cache no telefone, que deixaria a paciente uma
       abertura atrás — essa ideia foi levantada e recusada, e a diferença
       entre as duas está registrada no CLAUDE.md.

       ⚠️ **`allowQuery` fica sem valor de propósito** (o padrão guarda cada
       query separadamente). O app recebe link profundo com `?tab=` do push,
       e o router serializa a localização no HTML: uma casca guardada sem a
       query servida para uma URL com query é a receita do erro de hidratação
       que já deixou este app SEM ABRIR uma vez.

       ⚠️ **Só a casca do app.** O site institucional é renderizado no servidor
       de propósito (é o que os buscadores leem) e o painel do médico não é o
       caminho que a paciente abre todo dia.

       ⚠️ E `nitro.prerender` NÃO serve aqui, foi tentado: neste arranjo
       (Vite 7 + TanStack Start) o prerenderer roda ANTES de o ambiente de
       servidor ser construído, e a rota volta 404 — "Prerendered 0 routes". */
    ...({
      routeRules: { "/minha-conta": { isr: { expiration: false } } },
      /* ⚠️ **A FUNÇÃO RODA EM SÃO PAULO, e não em Washington (set/2026).**

         O banco está em `sa-east-1` (São Paulo) — conferido no painel do
         Supabase, em Project Settings. A função de servidor rodava em `iad1`
         (Washington), o padrão da Vercel. Então toda chamada de dado fazia o
         caminho: telefone no Brasil → função nos EUA → banco no Brasil → volta
         → volta. Duas travessias do continente para buscar um dado que estava
         na mesma cidade da paciente.

         E o custo se multiplica pelo número de idas ao banco DENTRO da função:
         `claimDailyAndGetWallet`, que é quem devolve o saldo da fita do Jogo,
         faz sete consultas em série. Cada uma pagava a ida e a volta
         EUA↔Brasil.

         ⚠️ **Não é ajuste fino, é a maior alavanca que sobrou** — bem maior
         que qualquer corte de pacote, porque o número de idas ao banco é alto
         e elas são em série.

         ⚠️ E o SITE institucional passa a ser renderizado no Brasil também.
         Para quem abre de fora do país isso é um pouco pior; o público é
         brasileiro, então é o negócio certo. */
      vercel: { functions: { maxDuration: 30, regions: ["gru1"] } },
    } as Record<string, unknown>),
  },
});
