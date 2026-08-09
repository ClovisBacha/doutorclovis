import type { FichaClinica } from "./clinical.functions";

/**
 * MODO CONSULTA — o que cabe nos quinze minutos com ela na frente.
 *
 * ─── O PROBLEMA QUE ISTO RESOLVE ────────────────────────────────────────────
 *
 * O cartão da paciente foi desenhado para ser LIDO: três abas, gráficos, linha
 * do tempo, conversa com a IA. Durante a consulta ele é outra coisa — o médico
 * está falando com uma pessoa, olhando a tela de lado, e precisa de quatro
 * coisas em letra grande: em que semana ela está, o que ele não pode
 * prescrever, o que mudou desde a última vez, e onde registrar.
 *
 * O resto não é só desnecessário: é o que faz ele não abrir o sistema durante a
 * consulta e registrar tudo depois, de memória — que é como o prontuário fica
 * pela metade.
 *
 * ─── A REGRA QUE ESTE ARQUIVO EXISTE PARA GARANTIR ──────────────────────────
 *
 * Alergia e medicação em uso aparecem SEMPRE, mesmo vazias. Um espaço em branco
 * onde deveria estar "alergias" é lido como "não tem alergia" — e a diferença
 * entre "não tem" e "eu não sei" é uma prescrição.
 *
 * E "não sei" tem texto próprio: quando o banco não tem as colunas do perfil
 * (`ficha.degradada`), o valor é DESCONHECIDO, não "nenhuma". O produto já
 * carrega essa distinção; é aqui que ela não pode se perder.
 */

/** `36s4d`. Em obstetrícia os DIAS decidem conduta — nunca arredonda. */
export function idadeGestacional(dias: number | null): string {
  if (dias == null || dias < 0) return "—";
  return `${Math.floor(dias / 7)}s${dias % 7}d`;
}

export type LinhaEssencial = {
  rotulo: string;
  valor: string;
  /**
   * `true` quando o valor não é "nada relatado", e sim "não consegui saber".
   * A tela pinta diferente — e é a diferença entre prescrever e perguntar.
   */
  desconhecido: boolean;
};

/**
 * As linhas que a tela de consulta mostra, sempre, nesta ordem.
 *
 * A ordem é a da urgência de quem prescreve: o que impede uma receita vem antes
 * do que a contextualiza.
 */
export function essenciais(ficha: FichaClinica | null): LinhaEssencial[] {
  /* Sem ficha nenhuma, TUDO é desconhecido — e não "nada relatado". Uma ficha
     que não carregou parecendo uma paciente sem alergias é o pior desfecho
     possível desta tela. */
  const cego = !ficha || ficha.degradada;

  const linha = (rotulo: string, bruto: string | null | undefined): LinhaEssencial => {
    if (cego)
      return { rotulo, valor: "desconhecido — o banco não tem este campo", desconhecido: true };
    const v = (bruto ?? "").trim();
    return { rotulo, valor: v || "nada relatado", desconhecido: false };
  };

  const riscos: LinhaEssencial = cego
    ? { rotulo: "Risco", valor: "desconhecido — o banco não tem este campo", desconhecido: true }
    : {
        rotulo: "Risco",
        valor: ficha!.riscos?.length ? ficha!.riscos.join(", ") : "nada relatado",
        desconhecido: false,
      };

  return [
    linha("Alergias", ficha?.alergias),
    linha("Em uso", ficha?.medicamentos),
    riscos,
    linha("Sangue", ficha?.tipoSanguineo),
  ];
}

/**
 * Quantas das linhas essenciais estão em "não sei".
 *
 * A tela usa isto para dizer, num aviso único e no topo, que o perfil está
 * incompleto — em vez de repetir quatro vezes o mesmo alerta e virar paisagem.
 */
export function quantasDesconhecidas(linhas: LinhaEssencial[]): number {
  return linhas.filter((l) => l.desconhecido).length;
}
