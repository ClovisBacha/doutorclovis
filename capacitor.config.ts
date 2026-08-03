import type { CapacitorConfig } from "@capacitor/cli";

/**
 * A casca nativa da Obstétrica.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUE ELA CARREGA O SITE PUBLICADO EM VEZ DE EMPACOTAR OS ARQUIVOS
 *
 * O Capacitor normalmente embala os arquivos do build e serve tudo de dentro do
 * aparelho. Aqui, não — e a razão é medida, não preferência:
 *
 *   242 chamadas de `createServerFn` em 45 arquivos.
 *   O app da paciente importa `.functions` em 51 pontos.
 *
 * Este projeto é TanStack **Start**, não um SPA: metade da lógica roda no
 * servidor e é chamada como se fosse função local. Empacotar exigiria reescrever
 * essa camada inteira em chamadas HTTP — semanas de trabalho, com risco em cada
 * uma das 242, antes de o app abrir uma vez.
 *
 * Então a casca carrega `https://www.obstetrica.com.br`, e a ponte nativa é
 * injetada na página remota: os plugins funcionam igual. É um caminho
 * documentado do Capacitor, não uma gambiarra.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ISSO CUSTA — e não dá para fingir que não custa
 *
 *  · SEM OFFLINE. Sem rede, o app mostra a tela de `webDir` e nada mais. Para um
 *    app de gestação de alto risco isso é sério: a paciente que precisa do SOS
 *    num lugar sem sinal não tem app.
 *
 *  · RISCO NA REVISÃO DA APPLE. A diretriz 4.2 reprova app que é só um site
 *    embrulhado. A defesa precisa estar IMPLEMENTADA na primeira submissão —
 *    haptics no exercício de respiração, push nativo, localização em segundo
 *    plano no SOS. É por isso que a Fase 3 do plano não é opcional: ela é o que
 *    torna a submissão defensável.
 *
 *  · PRIMEIRA PINTURA MAIS LENTA que um bundle local, porque depende da rede.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O CAMINHO DE SAÍDA
 *
 * Isto é o PRIMEIRO passo, não o destino. A migração para bundle local acontece
 * por partes: cada `.functions` que virar endpoint HTTP de verdade tira um
 * pedaço da dependência do servidor embutido. Quando sobrarem poucas, troca-se
 * `server.url` por `webDir` e o app passa a funcionar offline.
 *
 * Enquanto isso não acontece, `webDir` guarda uma tela de "sem conexão" — que é
 * o mínimo honesto para quem abrir o app no elevador.
 */
const config: CapacitorConfig = {
  appId: "br.com.obstetrica.app",
  appName: "Obstétrica",

  /* Existe mesmo com `server.url`: o Capacitor exige a pasta, e é ela que
     aparece quando a rede falha. Ver `native/shell/index.html`. */
  webDir: "native/shell",

  server: {
    url: "https://www.obstetrica.com.br/minha-conta",
    /* Só HTTPS. `cleartext: true` abriria o app para conteúdo sem criptografia,
       e isto carrega dado de saúde de gestante. */
    cleartext: false,
    /* O app só navega dentro do próprio domínio. Qualquer link para fora abre
       no navegador do sistema, que é o comportamento certo: a paciente vê a
       barra de endereço e sabe que saiu do app. */
    allowNavigation: ["www.obstetrica.com.br", "obstetrica.com.br"],
  },

  ios: {
    /* O app desenha SOB a barra de status. É o que resolve a faixa branca do
       print — no PWA isso dependia de o iOS obedecer a uma meta tag; aqui é
       configuração do contêiner. */
    contentInset: "never",
    /* Rolagem elástica desligada na raiz: com ela, puxar a página revela o fundo
       do WebView acima do conteúdo — exatamente a faixa clara que aparecia. */
    scrollEnabled: true,
    backgroundColor: "#0b0b17",
  },

  android: {
    backgroundColor: "#0b0b17",
    /* `https` em vez de `http`: o Android trata a origem como segura, e as APIs
       que exigem contexto seguro (geolocalização, notificação, câmera) passam a
       funcionar igual ao iOS. */
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    /* A splash sai no primeiro quadro útil — quem esconde é `esconderSplash()`
       em `src/lib/nativo.ts`, assim que a página remota responde. Tempo fixo ou
       corta cedo (tela em branco) ou demora à toa.
       Mas `launchAutoHide: false` sozinho é armadilha: se o JavaScript que
       esconde não rodar — rede caída, bundle que não carregou, plugin que não
       respondeu —, a splash fica PARA SEMPRE e o app parece travado no primeiro
       uso. Por isso o auto-hide fica LIGADO com um teto de 6s: o lado nativo
       esconde sozinho, sem depender de nada da página. O JavaScript só antecipa
       — ele deixou de ser a única saída. */
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 6000,
      backgroundColor: "#0b0b17",
      showSpinner: false,
    },
  },
};

export default config;
