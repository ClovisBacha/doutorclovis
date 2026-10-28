import { useSyncExternalStore } from "react";
import { api } from "~/lib/comunidade/api";

/**
 * O MEU PERFIL SOCIAL EM MEMÓRIA — o nome e a foto que o botão do perfil, no
 * topo das abas, mostra.
 *
 * Um lugar só, lido do servidor (`meuPerfilSocial`) e acertado por quem muda o
 * perfil: sem isto, trocar a foto em "Editar perfil" deixava a foto antiga em
 * cima do Hoje até a próxima abertura do app.
 *
 * ⚠️ Só em memória e por `uid` (LGPD: nada de cache social no aparelho). Outra
 * conta no mesmo processo não enxerga o da anterior.
 */
export type MeuPerfilSocial = {
  uid: string;
  nome: string;
  avatarUrl: string | null;
  lidoEm: number;
};

/** Depois disto, o próximo botão que aparecer relê do servidor. */
const VALIDADE_MS = 10 * 60_000;

let atual: MeuPerfilSocial | null = null;
let lendo: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

function definir(novo: MeuPerfilSocial | null) {
  atual = novo;
  ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

const lerAtual = () => atual;

/** O perfil guardado, só se for desta conta. */
export function useMeuPerfilSocial(uid: string | null): MeuPerfilSocial | null {
  const p = useSyncExternalStore(assinar, lerAtual, lerAtual);
  return p && p.uid === uid ? p : null;
}

/** Quem acabou de ler ou salvar o perfil avisa aqui. */
export function guardarMeuPerfilSocial(uid: string, p: { nome: string; avatarUrl: string | null }) {
  if (atual && atual.uid === uid && atual.nome === p.nome && atual.avatarUrl === p.avatarUrl) {
    /* Nada que a tela mostre mudou: só a hora da leitura, sem trocar o objeto
       (trocar sem avisar os ouvintes faria cada tela enxergar uma cópia). */
    atual.lidoEm = Date.now();
    return;
  }
  definir({ uid, nome: p.nome, avatarUrl: p.avatarUrl, lidoEm: Date.now() });
}

/** Relê do servidor se o guardado é de outra conta ou passou da validade. */
export function lerMeuPerfilSocialSePreciso(uid: string): Promise<void> {
  if (atual && atual.uid === uid && Date.now() - atual.lidoEm < VALIDADE_MS) {
    return Promise.resolve();
  }
  if (lendo) return lendo;
  lendo = api
    .meuPerfilSocial()
    .then((r) => {
      if (r.ok) guardarMeuPerfilSocial(uid, { nome: r.perfil.nome, avatarUrl: r.perfil.avatarUrl });
    })
    .finally(() => {
      lendo = null;
    });
  return lendo;
}

/** Sair da conta esquece o perfil da memória. */
export function esquecerMeuPerfilSocial() {
  definir(null);
}
