/**
 * AS DENÚNCIAS DA REDE — a régua.
 *
 * Pedido do dono: "a plataforma tem que ter o conhecimento dos perfis
 * denunciados, e por que foi denunciado".
 *
 * ⚠️ **E isto deixou de ser melhoria quando a aba ganhou conteúdo publicado por
 * usuária.** Pela diretriz **1.2** da App Store, um app com conteúdo gerado por
 * usuário precisa de quatro coisas: filtrar o censurável, oferecer denúncia,
 * permitir bloquear, e **agir sobre a denúncia**. As três primeiras existiam; a
 * quarta era um botão que consolava — as denúncias de POST caíam numa fila que
 * só a caixinha alimentava, e denúncia de PERFIL não existia.
 *
 * ─── POR QUE O MOTIVO É CATÁLOGO FECHADO, E NUNCA TEXTO LIVRE ──────────────
 *
 * ⚠️ Campo aberto numa denúncia de app de gestação é onde alguém escreve a
 * informação clínica de OUTRA pessoa ("ela teve um aborto e está mentindo") —
 * e esse texto iria parar numa tela de administração, gravado, sobre alguém que
 * nunca soube. O catálogo responde "por quê" sem abrir essa porta, e ainda
 * torna a fila triável: dá para ver de relance se é assédio ou spam.
 *
 * É a mesma decisão de `desafio-em-grupo.ts` (catálogo fechado de atividades) e
 * pela mesma razão: campo livre num canal com alcance é risco, não flexibilidade.
 */

export type AlvoDaDenuncia = "post" | "perfil";

export type MotivoDaDenuncia = "assedio" | "saude" | "imagem" | "spam" | "outro";

export const MOTIVOS: { motivo: MotivoDaDenuncia; rotulo: string; explica: string }[] = [
  {
    motivo: "assedio",
    rotulo: "Assédio ou agressão",
    explica: "Ofensa, ameaça ou insistência depois de eu pedir para parar",
  },
  {
    motivo: "saude",
    /* ⚠️ Este é o motivo que só existe num app de saúde, e é o mais grave da
       lista: de 1.098 respostas com conselho em fóruns de gestação, 5,5% eram
       potencialmente danosas. A régua clínica pega o vocabulário; o que ela não
       pega é a frase bem escrita que diz a coisa errada. */
    rotulo: "Conselho de saúde perigoso",
    explica: "Está dizendo o que fazer com sintoma, remédio ou exame",
  },
  {
    motivo: "imagem",
    rotulo: "Foto que não é dela",
    explica: "Usou imagem de outra pessoa, ou publicou foto minha sem eu saber",
  },
  { motivo: "spam", rotulo: "Spam ou propaganda", explica: "Vende alguma coisa, ou é robô" },
  { motivo: "outro", rotulo: "Outro motivo", explica: "Alguma coisa que não cabe acima" },
];

export function motivoConhecido(m: string): m is MotivoDaDenuncia {
  return MOTIVOS.some((x) => x.motivo === m);
}

export function rotuloDoMotivo(m: string): string {
  return MOTIVOS.find((x) => x.motivo === m)?.rotulo ?? "Motivo desconhecido";
}

/** Uma linha da fila, do jeito que a plataforma a lê. */
export type DenunciaDaRede = {
  id: string;
  alvo: AlvoDaDenuncia;
  /** Quem foi denunciada. É o que a plataforma precisa saber. */
  denunciadaId: string;
  denunciadaNome: string;
  motivo: MotivoDaDenuncia;
  /** O texto do post denunciado, quando o alvo é um post. */
  trecho: string | null;
  quando: string;
  /**
   * Quantas denúncias essa MESMA pessoa acumula, somando post e perfil.
   *
   * ⚠️ **É o número que decide.** Uma denúncia isolada pode ser desavença; três
   * pessoas diferentes denunciando a mesma conta em dois dias é padrão. Sem a
   * contagem, o administrador lê cada linha como se fosse a primeira.
   */
  reincidencias: number;
};

/**
 * Ordena a fila por quem precisa de olhar primeiro.
 *
 * ⚠️ **Reincidência ANTES de recência.** Uma conta com quatro denúncias de
 * ontem importa mais que uma com uma de hoje — e ordenar só por data faria a
 * reincidente descer na lista a cada dia sem que ninguém a visse.
 */
export function ordenarFila(fila: DenunciaDaRede[]): DenunciaDaRede[] {
  return [...fila].sort(
    (a, b) => b.reincidencias - a.reincidencias || String(b.quando).localeCompare(String(a.quando)),
  );
}

/**
 * Quantas denúncias distintas cada pessoa acumula.
 *
 * ⚠️ **Conta por QUEM DENUNCIOU, não por linha.** A mesma pessoa denunciando o
 * mesmo perfil cinco vezes é uma pessoa incomodada, não cinco — e sem isso um
 * único denunciante levaria qualquer conta ao topo da fila.
 */
export function reincidenciasPorPessoa(
  linhas: { denunciadaId: string; quemId: string }[],
): Map<string, number> {
  const porAlvo = new Map<string, Set<string>>();
  for (const l of linhas) {
    if (!porAlvo.has(l.denunciadaId)) porAlvo.set(l.denunciadaId, new Set());
    porAlvo.get(l.denunciadaId)!.add(l.quemId);
  }
  return new Map([...porAlvo].map(([id, quem]) => [id, quem.size]));
}
