import { useMemo } from "react";
import { useJornada } from "~/componentes/jornada/usarJornada";
import {
  CHAVE_AGENDA,
  comCompromisso,
  lerAgenda,
  semCompromisso,
  type Compromisso,
} from "~/lib/agenda/agenda";
import { reagendarAgenda } from "~/lib/agenda/lembretes";
import { estadoAtual, gravarChave } from "~/lib/jornada/loja";

/**
 * A agenda da paciente, lida da loja da jornada (`dc-path-agenda`). Gravar
 * reagenda os lembretes na hora; a primeira consulta marcada é quando o
 * iPhone pergunta pelas notificações — o momento em que o pedido faz sentido.
 */
export function useAgenda() {
  const { dia, loja } = useJornada();
  const bruto = loja.blob[CHAVE_AGENDA];
  const lista = useMemo(() => lerAgenda(bruto), [bruto]);
  const pronto = loja.pronto && dia.modo !== "carregando";
  return { dia, loja, lista, pronto };
}

/** Lê a agenda do estado ATUAL da loja (e não da renderização): duas gravações seguidas não se apagam. */
const agendaAgora = () => lerAgenda(estadoAtual().blob[CHAVE_AGENDA]);

export async function salvarCompromisso(c: Compromisso): Promise<"ok" | "sem-permissao"> {
  const nova = comCompromisso(agendaAgora(), c);
  gravarChave(CHAVE_AGENDA, nova);
  return reagendarAgenda(nova, true);
}

export async function apagarCompromisso(id: string): Promise<void> {
  const nova = semCompromisso(agendaAgora(), id);
  gravarChave(CHAVE_AGENDA, nova);
  await reagendarAgenda(nova);
}
