import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { seloDasAmigas } from "~/lib/selos";
import {
  codigoLimpo,
  lerResultadoDaIndicacao,
  type ResultadoDaIndicacao,
  type RespostaDoPedido,
} from "~/lib/jornada/amigas";
import {
  carimbarQueApareceu,
  cobrarBonusDaDupla,
  convidarAmiga,
  convidarDupla,
  desfazerDupla,
  encerrarAmizade,
  minhasAmigas,
  pedidosDeAmizade,
  perfilDaAmiga,
  responderAmizade,
  responderDupla,
  type CantinhoDaAmiga,
  type DuplaNaTela,
  type PerfilDeAmiga,
} from "~/servidor/amigas";
import { ligarPelaIndicacao } from "~/servidor/ganhos";

/**
 * As amigas, do servidor do site — ou, na bancada, de exemplo, pelos MESMOS
 * caminhos (a tela não sabe a diferença). Falha de leitura é `null`, nunca
 * uma lista vazia que afirmaria "você não tem amigas".
 *
 * Bancada: `&amigas=0` (sem nenhuma), `&dupla=sem|enviado|recebido|ativa|pausa`,
 * `&pedidos=0`; no perfil, `&postos=0` (Cantinho sem nada posto) e
 * `&perfil=fechado` (a amiga em Modo Cuidado).
 */

const espera = (ms = 350) => new Promise((r) => setTimeout(r, ms));

/**
 * O que ela já fez NESTA abertura da bancada: sem isto, aceitar um pedido e
 * recarregar trazia o pedido de volta, e o toque parecia não ter feito nada.
 * Só memória — a bancada não grava em lugar nenhum.
 */
const naBancada = {
  respondidos: new Set<string>(),
  aceitos: new Set<string>(),
  saiu: new Set<string>(),
  dupla: null as
    | null
    | { estado: "sem" }
    | { estado: "convite-enviado" | "ativa"; amigaId: string },
};

const HORA = 3600_000;

function amigasDaBancada(): PerfilDeAmiga[] {
  const agora = Date.now();
  const base = { avatarUrl: null, possoPresentear: false, jaPresenteada: false };
  const aceitas: PerfilDeAmiga[] = [...naBancada.aceitos].map((id) => ({
    ...base,
    id,
    nome: "Bianca Lima",
    bebe: null,
    sequencia: 0,
    trofeus: 0,
    itens: 0,
    diasNoApp: 14,
    vistaEm: new Date(agora - 30 * 60_000).toISOString(),
  }));
  if (parametroDaBancada("amigas") === "0") return aceitas;
  const todas: PerfilDeAmiga[] = [
    {
      ...base,
      id: "0b6e1f2a-1111-4c11-8a11-111111111111",
      nome: "Juliana Almeida",
      bebe: "Theo",
      sequencia: 9,
      trofeus: 14,
      itens: 12,
      diasNoApp: 63,
      vistaEm: new Date(agora - 2 * HORA).toISOString(),
    },
    {
      ...base,
      id: "0b6e1f2a-2222-4c22-8a22-222222222222",
      nome: "Camila Souza",
      bebe: null,
      sequencia: 3,
      trofeus: 5,
      itens: 4,
      diasNoApp: 21,
      vistaEm: new Date(agora - 26 * HORA).toISOString(),
    },
    {
      ...base,
      id: "0b6e1f2a-3333-4c33-8a33-333333333333",
      nome: "Marina Costa",
      bebe: "Alice",
      sequencia: 0,
      trofeus: 2,
      itens: 1,
      diasNoApp: 8,
      vistaEm: null,
    },
  ];
  return [...todas, ...aceitas].filter((a) => !naBancada.saiu.has(a.id));
}

function duplaDaBancada(amigas: PerfilDeAmiga[]): DuplaNaTela | null {
  const feito = naBancada.dupla;
  if (feito?.estado === "sem") return null;
  if (feito) {
    const com = amigas.find((x) => x.id === feito.amigaId);
    if (!com) return null;
    const base = { amigaId: com.id, nome: com.nome, recorde: 0, juntas: 0, paradaHa: null };
    return feito.estado === "ativa"
      ? { ...base, estado: "ativa", sequencia: 0, paradaHa: 0 }
      : { ...base, estado: "convite-enviado", sequencia: 0 };
  }
  const p = parametroDaBancada("dupla") ?? "ativa";
  /* A dupla de exemplo é sempre com a Juliana: se ela saiu da amizade, a dupla
     acaba junto (como no servidor), e não pula para a próxima da lista. */
  const a = amigas.find((x) => x.id === "0b6e1f2a-1111-4c11-8a11-111111111111");
  if (!a || p === "sem") return null;
  const base = { amigaId: a.id, nome: a.nome, sequencia: 0, recorde: 0, juntas: 0, paradaHa: null };
  if (p === "enviado") return { ...base, estado: "convite-enviado" };
  if (p === "recebido") return { ...base, estado: "convite-recebido" };
  if (p === "pausa") return { ...base, estado: "ativa", recorde: 12, juntas: 20, paradaHa: 6 };
  return { ...base, estado: "ativa", sequencia: 6, recorde: 12, juntas: 20, paradaHa: 0 };
}

export type LeituraDasAmigas = {
  careMode: boolean;
  amigas: PerfilDeAmiga[];
  dupla: DuplaNaTela | null;
};

export async function lerAmigas(): Promise<LeituraDasAmigas | null> {
  if (ehBancada()) {
    await espera();
    const amigas = amigasDaBancada();
    return { careMode: parametroDaBancada("luto") === "1", amigas, dupla: duplaDaBancada(amigas) };
  }
  try {
    const r = await minhasAmigas();
    return r.ok ? { careMode: r.careMode, amigas: r.amigas, dupla: r.dupla } : null;
  } catch {
    return null;
  }
}

export type Pedido = { id: string; nome: string; diasNoApp: number };

/**
 * O número do selo das Amigas na barra: os pedidos que esperam resposta e o
 * convite da dupla (`seloDasAmigas`). `null` quando a leitura falhou — o selo
 * fica como estava, em vez de zerar sem saber.
 */
export async function contarParaOSelo(pos: boolean): Promise<number | null> {
  if (ehBancada()) {
    const [l, p] = await Promise.all([lerAmigas(), lerPedidos()]);
    return l ? (l.careMode ? 0 : seloDasAmigas(p.length, l.dupla, pos)) : null;
  }
  try {
    const [l, p] = await Promise.all([minhasAmigas(), pedidosDeAmizade()]);
    if (!l.ok || !p.ok) return null;
    return l.careMode ? 0 : seloDasAmigas(p.pedidos?.length ?? 0, l.dupla, pos);
  } catch {
    return null;
  }
}

export async function lerPedidos(): Promise<Pedido[]> {
  if (ehBancada()) {
    await espera();
    return parametroDaBancada("pedidos") === "0"
      ? []
      : [{ id: "0b6e1f2a-4444-4c44-8a44-444444444444", nome: "Bianca Lima", diasNoApp: 14 }].filter(
          (p) => !naBancada.respondidos.has(p.id),
        );
  }
  try {
    const r = await pedidosDeAmizade();
    return r.pedidos ?? [];
  } catch {
    return [];
  }
}

/** `indisponivel` nunca diz o motivo — dizer contaria a perda dela. */
export type LeituraDoPerfil =
  | { ok: true; perfil: PerfilDeAmiga; cantinho: CantinhoDaAmiga }
  | { ok: false; indisponivel: boolean };

export async function lerPerfilDaAmiga(id: string): Promise<LeituraDoPerfil> {
  if (ehBancada()) {
    await espera();
    const perfil = amigasDaBancada().find((a) => a.id === id) ?? amigasDaBancada()[0];
    if (!perfil) return { ok: false, indisponivel: false };
    if (parametroDaBancada("perfil") === "fechado") return { ok: false, indisponivel: true };
    const vazio = parametroDaBancada("postos") === "0";
    return {
      ok: true,
      perfil,
      cantinho: {
        possui: [
          "bicho-coelho",
          "luz-vela",
          "fundo-amanhecer",
          "planta-girassol",
          "bicho-gato",
          "planta-tulipa",
        ],
        fundo: "fundo-amanhecer",
        skin: "trilha-lotus",
        /* `y` é px ao longo da trilha dela, como o servidor devolve. */
        postos: vazio
          ? []
          : [
              { id: "planta-girassol", x: 12, y: 330, s: 1.3 },
              { id: "bicho-gato", x: 78, y: 150, s: 1.1 },
              { id: "luz-vela", x: 40, y: 120, s: 0.9 },
              { id: "planta-tulipa", x: 88, y: 560, s: 1.1 },
              { id: "bicho-coelho", x: 22, y: 640, s: 1.2 },
            ],
      },
    };
  }
  try {
    const r = await perfilDaAmiga({ amigaId: id });
    return r.ok
      ? { ok: true, perfil: r.perfil, cantinho: r.cantinho }
      : { ok: false, indisponivel: r.error === "indisponivel" };
  } catch {
    return { ok: false, indisponivel: false };
  }
}

type Resultado = { ok: true } | { ok: false; error?: string };

async function tentar(f: () => Promise<{ ok: boolean; error?: string }>): Promise<Resultado> {
  if (ehBancada()) {
    await espera();
    return { ok: true };
  }
  try {
    const r = await f();
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  } catch {
    return { ok: false, error: "falhou" };
  }
}

/** Na bancada, anota o que a ação faria no servidor; fora dela, não faz nada. */
function anotar(f: () => void) {
  if (ehBancada()) f();
}

export const chamarParaDupla = (amigaId: string) => {
  anotar(() => (naBancada.dupla = { estado: "convite-enviado", amigaId }));
  return tentar(() => convidarDupla({ amigaId }));
};
export const responderConviteDaDupla = (amigaId: string, aceitar: boolean) => {
  anotar(() => (naBancada.dupla = aceitar ? { estado: "ativa", amigaId } : { estado: "sem" }));
  return tentar(() => responderDupla({ amigaId, aceitar }));
};
export const desfazerADupla = () => {
  anotar(() => (naBancada.dupla = { estado: "sem" }));
  return tentar(() => desfazerDupla());
};
export const sairDaAmizade = (amigaId: string) => {
  anotar(() => {
    naBancada.saiu.add(amigaId);
    if (naBancada.dupla && "amigaId" in naBancada.dupla && naBancada.dupla.amigaId === amigaId) {
      naBancada.dupla = { estado: "sem" };
    }
  });
  return tentar(() => encerrarAmizade({ amigaId }));
};
export const responderPedido = (amigaId: string, aceitar: boolean) => {
  anotar(() => {
    naBancada.respondidos.add(amigaId);
    if (aceitar) naBancada.aceitos.add(amigaId);
  });
  return tentar(() => responderAmizade({ amigaId, aceitar }));
};

export async function pedirAmizade(termo: string): Promise<RespostaDoPedido> {
  if (ehBancada()) {
    await espera();
    return termo.includes("@")
      ? { ok: true, achou: null, nome: null }
      : termo.trim().length < 4
        ? { ok: false, error: "termo_curto" }
        : { ok: true, achou: true, nome: "Bianca" };
  }
  try {
    return await convidarAmiga({ termo });
  } catch {
    return { ok: false, error: "falhou" };
  }
}

/**
 * Liga a recém-chegada a quem a convidou, pelo código (`attributeReferral`).
 * Na bancada, "JULI…" liga e o resto não acha (`&indicacao=depois`, a conta
 * que ainda não ficou pronta).
 */
export async function ligarPeloCodigo(codigo: string): Promise<ResultadoDaIndicacao> {
  const limpo = codigoLimpo(codigo);
  if (ehBancada()) {
    await espera();
    if (parametroDaBancada("indicacao") === "depois") return "depois";
    return limpo.startsWith("JULI") ? "ligou" : "nao-encontrou";
  }
  try {
    return lerResultadoDaIndicacao(await ligarPelaIndicacao({ code: limpo }));
  } catch {
    return "falhou";
  }
}

/** O bônus da dupla de hoje (e de ontem): quanto entrou agora. */
export async function cobrarOBonus(): Promise<number> {
  if (ehBancada()) return 0;
  try {
    const r = await cobrarBonusDaDupla();
    return r.ok ? r.ganho : 0;
  } catch {
    return 0;
  }
}

/** "Vista há 2h" para as amigas: uma vez por abertura do app, e só isso. */
let carimbou = false;
export function carimbarPresenca() {
  if (carimbou || ehBancada()) return;
  carimbou = true;
  void carimbarQueApareceu().catch(() => {
    carimbou = false;
  });
}
