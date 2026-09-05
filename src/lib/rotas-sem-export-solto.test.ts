import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";

/**
 * ⚠️ UM ARQUIVO DE ROTA SÓ EXPORTA A ROTA.
 *
 * ─── O QUE ISTO CONSERTA, E COMO ELE APARECEU ──────────────────────────────
 *
 * A varredura das 52 bancadas (abrir cada `/preview-*` num navegador e LER O
 * CONSOLE) devolveu o MESMO aviso em todas elas:
 *
 *   [tanstack-router] These exports from "src/routes/influenciadora.tsx" will
 *   not be code-split and will increase your bundle size: PainelDaEmbaixadora
 *
 * Um export não-rota num arquivo de rota sai do pedaço DAQUELA rota e entra no
 * da árvore de rotas — que é o que TODA página carrega antes de qualquer coisa
 * aparecer na tela. É a mesma família do `ChatbotWidget`, que o app baixava
 * inteiro (com `@ai-sdk/react`, `ai` e o `react-markdown` junto) só para
 * decidir não desenhá-lo: 255 KB de JavaScript para interpretar em toda
 * abertura, e é enquanto a linha principal está ocupada com isso que o toque
 * não responde.
 *
 * ⚠️ **`Route` é o único export permitido.** Componentes, constantes e réguas
 * que precisem ser compartilhados moram em `src/components` ou `src/lib` — que
 * é onde o resto do projeto já os põe.
 */
const PASTA = "src/routes";

/**
 * A DÍVIDA CONHECIDA, nomeada de propósito.
 *
 * ⚠️ **O plugin NÃO reclama destes cinco**, e foi medido: depois de tirar o
 * export de `influenciadora.tsx`, a varredura devolveu ZERO avisos de
 * code-split. Eles são importados por outros módulos (bancadas, o painel, o
 * outro roteador), então já vivem em pedaços compartilhados.
 *
 * A lista existe para o teste ser HONESTO: ele impede export solto NOVO — que é
 * como a dívida cresce — sem exigir esta noite um refator grande que ninguém
 * pediu. Arrumar qualquer um deles é mexer aqui junto.
 */
const CONHECIDOS: Record<string, string[]> = {
  "src/routes/__root.tsx": [
    "storedAffiliateCode",
    "storedReferralCode",
    "clearStoredAffiliateCode",
    "clearStoredReferralCode",
    "triggerPWAInstall",
  ],
  "src/routes/api/chat.ts": [
    "criarTetoAnonimo",
    "sinaisDeUrgencia",
    "buildClinicalBlock",
    "buildPendenciasBlock",
    "textoDaPaciente",
    "TETO_ANONIMO_POR_MINUTO",
    "AUTH_POR_IP_POR_MINUTO",
  ],
  "src/routes/_authenticated/admin-sections.tsx": [
    "CrescimentoTab",
    "AlertasTab",
    "NpsTab",
    "ComunicadosTab",
    "FlagsTab",
    "AuditoriaTab",
    "ReembolsosTab",
    "ConsultorTab",
    "DoctorThinkTab",
  ],
  "src/routes/_authenticated/minha-conta.tsx": [
    "mostrarSaudeDaMulher",
    "HubSaude",
    "BEMESTAR_SUBTABS",
    "REGISTROS_SUBTABS",
    "BEBE_SUBTABS",
    "CONSULTAS_SUBTABS",
  ],
  "src/routes/_authenticated/painel.tsx": ["DashboardView"],
};

/**
 * ⚠️ **A LISTA SÓ PODE ENCOLHER — e é este teste que faz dela uma catraca.**
 *
 * `CONHECIDOS` é uma TOLERÂNCIA, e uma tolerância que sobra depois de a dívida
 * ser paga aceita o defeito de volta em silêncio: `OnboardingRitual` e
 * `CodigoDaEmbaixadora` saíram de `minha-conta.tsx` em set/2026, e enquanto os
 * nomes ficassem aqui, reexportá-los amanhã passaria verde.
 *
 * Se este teste falhar, o conserto é APAGAR o nome da lista — nunca o
 * contrário.
 */
function nomesQueSobraram(): string[] {
  const sobrando: string[] = [];
  for (const [arquivo, nomes] of Object.entries(CONHECIDOS)) {
    const codigo = readFileSync(arquivo, "utf8");
    for (const n of nomes) {
      const temExport = new RegExp(
        `^export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+${n}\\b`,
        "m",
      ).test(codigo);
      if (!temExport) sobrando.push(`${arquivo} → ${n}`);
    }
  }
  return sobrando;
}

function arquivosDeRota(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = `${dir}/${nome}`;
    if (statSync(caminho).isDirectory()) arquivosDeRota(caminho, saida);
    else if (/\.tsx?$/.test(nome) && !/\.test\./.test(nome)) saida.push(caminho);
  }
  return saida;
}

/** Sem comentários: prosa não é código — a lição das duas direções. */
function semComentarios(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("os arquivos de rota", () => {
  const arquivos = arquivosDeRota(PASTA);

  test("existem, e são muitos — senão este teste não mede nada", () => {
    expect(arquivos.length).toBeGreaterThan(30);
  });

  test("⚠️ exportam SÓ a `Route` — todo o resto engorda o pacote de entrada", () => {
    const culpados: string[] = [];
    for (const f of arquivos) {
      const codigo = semComentarios(readFileSync(f, "utf8"));
      const nomes = [
        ...[...codigo.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]),
        ...[...codigo.matchAll(/^export\s+(?:const|let|class)\s+(\w+)/gm)].map((m) => m[1]),
        ...[...codigo.matchAll(/^export\s+default\s+(?:async\s+)?function\s+(\w+)/gm)].map(
          (m) => m[1],
        ),
      ];
      /* `Route` é a rota. `ServerRoute` é o par dela nos endpoints de API. */
      const soltos = nomes.filter(
        (n) => n !== "Route" && n !== "ServerRoute" && !CONHECIDOS[f]?.includes(n),
      );
      if (soltos.length) culpados.push(`${f}: ${soltos.join(", ")}`);
    }
    expect(culpados).toEqual([]);
  });

  /* ⚠️ A lista de conhecidos não pode CRESCER sem alguém reparar — é ela que
     separa "dívida antiga, nomeada" de "defeito novo entrando sem ninguém
     ver". Se um destes arquivos for arrumado, o número desce e este teste
     cobra a atualização. */
  test("⚠️ a dívida conhecida não cresce", () => {
    /* ⚠️ **A IGUALDADE É PROPOSITAL, e ela morde nos DOIS sentidos.** Se este
       número SUBIU, entrou export solto novo: o conserto é tirar o export.
       Se CAIU, alguém pagou dívida — ótimo: abaixe o número aqui, no mesmo
       commit. Um teto frouxo (`<=`) deixaria a lista encolher sem ninguém
       reparar, e a tolerância voltaria a caber num export reintroduzido.
       Caiu de 32 → 30 → 29 → 28 em set/2026, à medida que `OnboardingRitual`,
       `CodigoDaEmbaixadora`, `ConquistasTab` e `ChatTab` saíram de
       `minha-conta.tsx`. */
    const total = Object.values(CONHECIDOS).reduce((n, l) => n + l.length, 0);
    expect(total).toBe(28);
    expect(Object.keys(CONHECIDOS)).toHaveLength(5);
  });
});

describe("a tolerância encolhe", () => {
  test("⚠️ nenhum nome sobra em `CONHECIDOS` depois de a dívida ser paga", () => {
    /* Um nome que ficou na lista depois de o export sair é a porta aberta para
       ele voltar sem ninguém ver — a catraca continuaria verde. */
    expect(nomesQueSobraram()).toEqual([]);
  });
});
