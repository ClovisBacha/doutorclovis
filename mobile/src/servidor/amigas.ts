import type { EnfeitePosto, EstadoDaDupla, PerfilDeAmiga } from "@/lib/amigas";
import { funcaoDoServidor } from "~/servidor/ponte";

/**
 * As amigas — src/lib/amigas.functions.ts, o servidor do site (pronto, com as
 * tabelas `amizades`, `amizades_encerradas` e `duplas` em produção).
 *
 * O grafo é o do CONVITE (indicação, nos dois sentidos) mais os pedidos entre
 * contas que já existem: não há busca nem estranhos, então não há o que
 * moderar. Toda função confere o vínculo antes de ler, e o Modo Cuidado tira a
 * pessoa da lista das outras sem dizer por quê — o servidor já faz os dois.
 */

export type { EnfeitePosto, EstadoDaDupla, PerfilDeAmiga };

/** A dupla como a tela recebe (`DuplaNaTela` do site). */
export type DuplaNaTela = {
  estado: EstadoDaDupla;
  amigaId: string | null;
  nome: string | null;
  /** Dias seguidos em que as DUAS apareceram (só na dupla ativa). */
  sequencia: number;
  /** A maior sequência que já tiveram, inclusive uma quebrada. */
  recorde: number;
  /** Quantos dias, no total, as duas apareceram no mesmo dia. */
  juntas: number;
  /** Há quantos dias a OUTRA não aparece (a tela diz "em pausa", nunca por quê). */
  paradaHa: number | null;
};

/** Conta o mesmo conjunto que a lista (as em Modo Cuidado ficam de fora). */
export const contarAmigas = funcaoDoServidor<
  Record<string, never>,
  { ok: true; amigas: number } | { ok: false; amigas: number }
>("src/lib/amigas.functions.ts", "contarAmigas");

export const minhasAmigas = funcaoDoServidor<
  Record<string, never>,
  | { ok: true; careMode: boolean; amigas: PerfilDeAmiga[]; dupla: DuplaNaTela | null }
  | { ok: false }
>("src/lib/amigas.functions.ts", "minhasAmigas");

export type CantinhoDaAmiga = {
  possui: string[];
  fundo: string | null;
  skin: string | null;
  postos: EnfeitePosto[];
};

export const perfilDaAmiga = funcaoDoServidor<
  { amigaId: string },
  | { ok: true; perfil: PerfilDeAmiga; cantinho: CantinhoDaAmiga }
  | { ok: false; error: "sem_permissao" | "sem_vinculo" | "indisponivel" }
>("src/lib/amigas.functions.ts", "perfilDaAmiga");

export const convidarDupla = funcaoDoServidor<
  { amigaId: string },
  { ok: true } | { ok: false; error: string }
>("src/lib/amigas.functions.ts", "convidarDupla");

export const responderDupla = funcaoDoServidor<
  { amigaId: string; aceitar: boolean },
  { ok: true; aceita: boolean } | { ok: false; error: string }
>("src/lib/amigas.functions.ts", "responderDupla");

export const desfazerDupla = funcaoDoServidor<Record<string, never>, { ok: boolean }>(
  "src/lib/amigas.functions.ts",
  "desfazerDupla",
);

/** O bônus da dupla (+10 🌱 por dia que as DUAS fecharam): cada uma cobra o seu. */
export const cobrarBonusDaDupla = funcaoDoServidor<
  Record<string, never>,
  { ok: boolean; ganho: number }
>("src/lib/amigas.functions.ts", "cobrarBonusDaDupla");

export const encerrarAmizade = funcaoDoServidor<
  { amigaId: string },
  { ok: true } | { ok: false; error: string }
>("src/lib/amigas.functions.ts", "encerrarAmizade");

/**
 * Pede amizade pelo CÓDIGO de convite dela (ou pelo e-mail — a resposta do
 * e-mail é a mesma com e sem acerto, para o campo não virar verificador de
 * contas: `achou: null`).
 */
export const convidarAmiga = funcaoDoServidor<
  { termo: string },
  | { ok: true; achou: true | null; nome: string | null }
  | {
      ok: false;
      error:
        | "sessao"
        | "indisponivel"
        | "instavel"
        | "muitos_convites"
        | "termo_curto"
        | "nao_encontrada"
        | "falhou";
    }
>("src/lib/amigas.functions.ts", "convidarAmiga");

export const pedidosDeAmizade = funcaoDoServidor<
  Record<string, never>,
  { ok: boolean; pedidos: { id: string; nome: string; diasNoApp: number }[] }
>("src/lib/amigas.functions.ts", "pedidosDeAmizade");

export const responderAmizade = funcaoDoServidor<
  { amigaId: string; aceitar: boolean },
  { ok: true } | { ok: false; error: string }
>("src/lib/amigas.functions.ts", "responderAmizade");

/** "Vista há 2h" na lista das amigas: no máximo uma escrita por hora, e só isso. */
export const carimbarQueApareceu = funcaoDoServidor<Record<string, never>, { ok: boolean }>(
  "src/lib/amigas.functions.ts",
  "carimbarQueApareceu",
);
