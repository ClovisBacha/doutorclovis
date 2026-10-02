import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada } from "~/lib/bancada";
import { ymdLocal } from "~/lib/gestacao";

/**
 * OS MOMENTOS "LIVRES" — o que ela fez hoje quando não há jornada para marcar.
 *
 * No Modo Cuidado não há jornada, estrela nem placar (a régua do site), e sem
 * a semana da gestação não há dia D para marcar. Mas a tela ainda precisa
 * dizer "feito hoje" ao lado do que ela fez — senão a mesma respiração parece
 * nunca ter acontecido. Fica só no aparelho, FORA do prefixo `dc-path-` (não
 * sobe para a jornada nem acende chama), e some no sair da conta como todo
 * `dc-`.
 */

const memoriaDaBancada = new Set<string>();

const chave = (uid: string) => `dc-livres:${uid}:${ymdLocal()}`;

export async function marcarLivre(uid: string, atividade: string): Promise<void> {
  if (ehBancada()) {
    memoriaDaBancada.add(atividade);
    return;
  }
  const atuais = await lerJson<string[]>(chave(uid), []);
  if (!atuais.includes(atividade)) await gravarJson(chave(uid), [...atuais, atividade]);
}

export function useLivresDeHoje(uid: string | null): Set<string> {
  const [feitos, setFeitos] = useState<Set<string>>(() => new Set());
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      if (ehBancada()) {
        setFeitos(new Set(memoriaDaBancada));
        return;
      }
      let vivo = true;
      void lerJson<string[]>(chave(uid), []).then((l) => {
        if (vivo) setFeitos(new Set(Array.isArray(l) ? l : []));
      });
      return () => {
        vivo = false;
      };
    }, [uid]),
  );
  return feitos;
}
