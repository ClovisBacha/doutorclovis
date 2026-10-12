import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { blobDaBancada } from "~/componentes/jornada/bancada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { gestacaoDoPerfil, ymdLocal } from "~/lib/gestacao";
import {
  diaDaJornada,
  diaDoPosParto,
  diaNaSemana,
  idadeEmDias,
  semanaDoDia,
} from "~/lib/jornada/dia";
import { abrirLoja, useLoja } from "~/lib/jornada/loja";
import { feito, flagsDoDia, type Momento } from "~/lib/jornada/momentos";
import { useSessao, type Perfil } from "~/lib/sessao";

/**
 * Em que dia da jornada ela está — a pergunta que TODAS as telas da Jornada
 * fazem primeiro. Gestação: D = clamp(totalDays, 7, 300). Pós-parto (com
 * `birth_date`): D = idade do bebê + 7. Sem DUM nem ultrassom: "sem-data".
 *
 * "Hoje" é relido ao voltar para a tela e ao voltar do segundo plano: quem
 * deixa o app aberto de um dia para o outro não pode ver o dia de ontem.
 */
export type DiaDaJornada =
  | { modo: "carregando" }
  | { modo: "falhou"; tentar: () => void }
  | { modo: "sem-data"; cuidado: boolean; uid: string; perfil: Perfil; hoje: Date }
  | {
      modo: "gestacao";
      cuidado: boolean;
      uid: string;
      perfil: Perfil;
      hoje: Date;
      D: number;
      semana: number;
      diaNaSemana: number;
    }
  | {
      modo: "pos";
      cuidado: boolean;
      uid: string;
      perfil: Perfil;
      hoje: Date;
      D: number;
      idadeDias: number;
    };

function useHoje(): Date {
  const [ymd, setYmd] = useState(() => ymdLocal());
  useFocusEffect(
    useCallback(() => {
      setYmd(ymdLocal());
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setYmd(ymdLocal());
    });
    return () => sub.remove();
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new Date(), [ymd]);
}

/** Na bancada, `&pos=1` dá um bebê de 20 dias ao perfil de exemplo. */
function perfilDaJornada(perfil: Perfil | null): Perfil | null {
  if (!perfil || !ehBancada() || parametroDaBancada("pos") !== "1") return perfil;
  const d = new Date();
  d.setDate(d.getDate() - 20);
  return { ...perfil, birth_date: ymdLocal(d) };
}

export function useDiaDaJornada(): DiaDaJornada {
  const { sessao, perfil: perfilBruto, estadoDoPerfil, recarregarPerfil, cuidado } = useSessao();
  const hoje = useHoje();
  const uid = sessao?.user.id ?? null;
  const perfil = perfilDaJornada(perfilBruto);

  return useMemo<DiaDaJornada>(() => {
    if (estadoDoPerfil === "falhou") return { modo: "falhou", tentar: () => void recarregarPerfil() };
    if (!uid || estadoDoPerfil === "carregando") return { modo: "carregando" };
    /* Sem linha de perfil ainda: a jornada não sabe a semana, mas a tela abre. */
    if (!perfil) return { modo: "sem-data", cuidado, uid, perfil: { id: uid }, hoje };
    if (perfil.birth_date) {
      const idade = idadeEmDias(perfil.birth_date, hoje);
      if (idade != null) {
        return { modo: "pos", cuidado, uid, perfil, hoje, D: diaDoPosParto(idade), idadeDias: idade };
      }
    }
    const g = gestacaoDoPerfil(perfil, hoje);
    if (!g) return { modo: "sem-data", cuidado, uid, perfil, hoje };
    const D = diaDaJornada(g.totalDays);
    return {
      modo: "gestacao",
      cuidado,
      uid,
      perfil,
      hoje,
      D,
      semana: semanaDoDia(D),
      diaNaSemana: diaNaSemana(D),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estadoDoPerfil, uid, perfil?.id, perfil?.birth_date, perfil?.lmp_date, perfil?.reference_date, perfil?.reference_weeks, perfil?.reference_days, cuidado, hoje]);
}

/**
 * O dia + a loja aberta para ele. Toda tela da Jornada usa este: abrir uma
 * atividade direto (sem passar pela aba) também abre a jornada dela.
 */
export function useJornada() {
  const dia = useDiaDaJornada();
  const loja = useLoja();
  const uid = dia.modo === "carregando" || dia.modo === "falhou" ? null : dia.uid;
  const D = dia.modo === "gestacao" || dia.modo === "pos" ? dia.D : null;
  const pos = dia.modo === "pos";
  useEffect(() => {
    if (!uid) return;
    /* Na bancada a loja recebe o exemplo e nunca toca o aparelho nem a nuvem. */
    void abrirLoja(uid, ehBancada() ? (D != null ? blobDaBancada(D, pos) : {}) : undefined);
  }, [uid, D, pos]);
  return { dia, loja };
}

/**
 * O que uma tela de atividade precisa saber ao abrir: o dia, se é pós-parto,
 * Modo Cuidado, e se este momento JÁ estava feito hoje — lido uma vez, quando
 * a loja fica pronta (fazer agora não pode trocar a tela do meio da
 * atividade pela de "já feito").
 *
 * Na bancada o "já feito" só vale com `&etapa=feita`: o dia de exemplo tem
 * momentos marcados, e a bancada precisa abrir a atividade em si.
 */
export function useAtividade(momento: Momento) {
  const { dia, loja } = useJornada();
  const D = dia.modo === "gestacao" || dia.modo === "pos" ? dia.D : null;
  const pos = dia.modo === "pos";
  const [jaFeita, setJaFeita] = useState<boolean | null>(null);
  useEffect(() => {
    if (jaFeita !== null || dia.modo === "carregando" || dia.modo === "falhou") return;
    if (ehBancada()) {
      setJaFeita(parametroDaBancada("etapa") === "feita");
      return;
    }
    if (D == null || dia.cuidado) {
      setJaFeita(false);
      return;
    }
    if (!loja.pronto) return;
    setJaFeita(feito(flagsDoDia(loja.blob, D, pos), momento));
  }, [jaFeita, dia, loja.pronto, loja.blob, D, pos, momento]);
  const aberto = dia.modo !== "carregando" && dia.modo !== "falhou";
  return {
    dia,
    loja,
    D,
    pos,
    pronto: aberto && jaFeita !== null,
    jaFeita: !!jaFeita,
    cuidado: aberto ? dia.cuidado : true,
    uid: aberto ? dia.uid : null,
    semana: dia.modo === "gestacao" ? dia.semana : null,
    perfil: aberto ? dia.perfil : null,
  };
}
