import { useFocusEffect } from "expo-router";
import Bell from "lucide-react-native/icons/bell";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import X from "lucide-react-native/icons/x";
import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Botao, selecao, toque } from "~/componentes/base";
import { Folha } from "~/componentes/jornada/pecas";
import { RAIO_DENTRO_DO_PAINEL } from "~/componentes/painel";
import type { DiaDaJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { tituloDaAulaDoApp } from "~/lib/jornada/aulas-do-app";
import {
  HORA_PADRAO_DA_JORNADA,
  horaValida,
  type ContextoDoLembrete,
} from "~/lib/jornada/lembrete-da-jornada";
import { HORARIOS } from "~/lib/jornada/lembrete";
import type { EstadoDaLoja } from "~/lib/jornada/loja";
import { contarMomentos, flagsDoDia, type Blob } from "~/lib/jornada/momentos";
import { desafioDoPos, tarefasFeitas } from "~/lib/jornada/pos-parto";
import { chama } from "~/lib/jornada/trilha";
import {
  definirLembretesDaJornada,
  lerLembretesDaJornada,
  reagendarLembretesDaJornada,
  type PreferenciaGuardada,
} from "~/lib/lembretes-da-jornada";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, luz, sombra, vidro } from "~/tema";

/**
 * Os lembretes da jornada na tela: o contexto que a régua precisa (de onde ela
 * está na jornada), o gancho que refaz a agenda quando esse estado muda, o
 * convite da tela Hoje e a folha de escolher a hora.
 */

/** O que a régua dos lembretes precisa saber, tirado do dia e do blob da jornada. */
export function contextoDoLembrete(
  dia: DiaDaJornada,
  blob: Blob,
  agora = new Date(),
): ContextoDoLembrete | null {
  if (dia.modo === "carregando" || dia.modo === "falhou") return null;
  const nome = (dia.perfil.baby_name ?? "").trim() || null;
  const base = { agora, chama: 0, feitosHoje: 0, totalDoDia: 0, desafio: () => null };
  if (dia.cuidado) {
    return {
      ...base,
      modo: "cuidado",
      D: dia.modo === "gestacao" || dia.modo === "pos" ? dia.D : null,
      nomeDoBebe: null,
    };
  }
  if (dia.modo === "sem-data") return { ...base, modo: "sem-data", D: null, nomeDoBebe: nome };
  if (dia.modo === "pos") {
    return {
      agora,
      modo: "pos",
      D: dia.D,
      idadeDias: dia.idadeDias,
      nomeDoBebe: nome,
      chama: chama(blob, dia.D, true).dias,
      feitosHoje: tarefasFeitas(flagsDoDia(blob, dia.D, true)),
      totalDoDia: 3,
      desafio: (D) => desafioDoPos(D)?.label ?? null,
    };
  }
  return {
    agora,
    modo: "gestacao",
    D: dia.D,
    semana: dia.semana,
    diaNaSemana: dia.diaNaSemana,
    nomeDoBebe: nome,
    chama: chama(blob, dia.D).dias,
    feitosHoje: contarMomentos(flagsDoDia(blob, dia.D)),
    totalDoDia: 5,
    /* Na gestação não há desafio: todo dia de 7 a 300 tem aula do app, e o
       aviso fala do assunto dela — o desafio do site levava conduta clínica
       para a notificação. */
    desafio: () => null,
    aula: (D) => {
      return tituloDaAulaDoApp(D);
    },
  };
}

/**
 * Refaz a agenda dos lembretes sempre que muda o que eles dizem: o dia, o modo,
 * o nome, a chama, quantos cuidados já foram feitos hoje. Só com a jornada já
 * lida do aparelho (um blob vazio diria "nada feito hoje" a quem fez tudo).
 */
export function useLembretesDaJornada(dia: DiaDaJornada, loja: EstadoDaLoja) {
  const uid = dia.modo === "carregando" || dia.modo === "falhou" ? null : dia.uid;
  const precisaDaLoja = dia.modo === "gestacao" || dia.modo === "pos";
  const pronto = !!uid && (!precisaDaLoja || loja.pronto) && !loja.bancada && !ehBancada();
  const ctx = pronto ? contextoDoLembrete(dia, loja.blob) : null;
  const assinatura = ctx
    ? [ctx.modo, ctx.D, ctx.nomeDoBebe, ctx.chama, ctx.feitosHoje, ctx.semana, ctx.diaNaSemana]
        .map(String)
        .join("|")
    : null;
  useEffect(() => {
    if (!uid || !ctx) return;
    void reagendarLembretesDaJornada(uid, ctx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, assinatura]);
}

/** A preferência, relida a cada foco (ela pode ter mudado na tela de lembretes). */
export function usePreferenciaDosLembretes(uid: string | null) {
  const [pref, setPref] = useState<PreferenciaGuardada | null>(null);
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      if (ehBancada()) {
        /* Bancada: `&lembrete-jornada=20:00` (ligado) ou `=nao` (dispensado). */
        const p = parametroDaBancada("lembrete-jornada");
        setPref({
          hora: p && horaValida(p) ? p : null,
          semanaNova: !!p && horaValida(p),
          dispensado: p === "nao",
        });
        return;
      }
      if (!uid) return;
      void lerLembretesDaJornada(uid).then((p) => {
        if (vivo) setPref(p);
      });
      return () => {
        vivo = false;
      };
    }, [uid]),
  );
  return [pref, setPref] as const;
}

/** O material dos cartões dentro de um painel (o mesmo dos cuidados e dos atalhos). */
const MATERIAL = {
  backgroundColor: luz.cartao,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: vidro.borda,
  borderRadius: RAIO_DENTRO_DO_PAINEL,
  ...curva,
  ...sombra,
} as const;

/**
 * O CONVITE, na tela Hoje — depois do primeiro cuidado feito (o momento em que
 * o lembrete faz sentido para ela), até ela ligar ou dispensar. É o "lembrar
 * do app" do dono, pedido do jeito certo: o iPhone só pergunta pelas
 * notificações quando ela toca em "Às 20h".
 *
 * 18/11/2026 (a vistoria): no material do app, com a ação na cor de agir (era
 * um azul de outro app), e o "Agora não" virou o X do canto (deixava um vão
 * branco embaixo).
 */
export function ConviteDosLembretes({
  uid,
  contexto,
  mostrar,
}: {
  uid: string;
  contexto: ContextoDoLembrete | null;
  /** Ela já cuidou hoje (ou tem chama): é a hora de oferecer. */
  mostrar: boolean;
}) {
  const [pref, setPref] = usePreferenciaDosLembretes(uid);
  const [escolhendo, setEscolhendo] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);
  const [ligado, setLigado] = useState<string | null>(null);

  if (!pref) return null;
  if (ligado) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
          ...MATERIAL,
        }}
      >
        <FichaDoSino />
        <Text style={{ flex: 1, ...fonte.media, ...escala.legenda, color: cor.textoCorpo }}>
          Combinado: eu te lembro às {ligado.replace(":00", "h")}. Dá para mudar no Perfil, em
          Lembretes.
        </Text>
      </View>
    );
  }
  if (!mostrar || pref.hora || pref.semanaNova || pref.dispensado) return null;

  async function ligar(hora: string) {
    setSemPermissao(false);
    if (ehBancada()) {
      setLigado(hora);
      return;
    }
    const r = await definirLembretesDaJornada(uid, { hora, semanaNova: true }, contexto);
    if (r === "sem-permissao") setSemPermissao(true);
    else setLigado(hora);
  }

  const dispensar = () => {
    setPref({ ...pref, dispensado: true });
    if (!ehBancada()) void definirLembretesDaJornada(uid, { dispensado: true }, null);
  };

  return (
    <View style={{ padding: espaco.lg, gap: espaco.md, ...MATERIAL }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <FichaDoSino />
        <Text style={{ flex: 1, ...fonte.forte, ...escala.chamada, color: cor.texto }}>
          Quer que eu te lembre do cuidado de hoje?
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agora não"
          onPress={() => {
            toque();
            dispensar();
          }}
          style={({ pressed }) => ({
            width: ALVO_MINIMO,
            height: ALVO_MINIMO,
            marginVertical: -8,
            marginRight: -10,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: canto.pilula,
            backgroundColor: pressed ? cor.apagado : "transparent",
          })}
        >
          <X size={18} color={cor.textoApagado} strokeWidth={2.4} />
        </Pressable>
      </View>
      <Text style={{ marginTop: -4, ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
        Eu aviso uma vez por dia, na hora que você escolher. Se você já cuidou, eu fico quieta.
      </Text>
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        <Botao
          rotulo={`Às ${HORA_PADRAO_DA_JORNADA.replace(":00", "h")}`}
          estilo={{ flexGrow: 1 }}
          aoTocar={() => void ligar(HORA_PADRAO_DA_JORNADA)}
        />
        <Botao
          rotulo="Outro horário"
          tipo="suave"
          estilo={{ flexGrow: 1 }}
          aoTocar={() => setEscolhendo(true)}
        />
      </View>
      {semPermissao ? <AvisoSemPermissao /> : null}
      <FolhaDoHorario
        aberta={escolhendo}
        hora={null}
        titulo="Lembrar do cuidado às"
        aoFechar={() => setEscolhendo(false)}
        aoEscolher={(h) => {
          setEscolhendo(false);
          void ligar(h);
        }}
      />
    </View>
  );
}

function FichaDoSino() {
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: canto.campo,
        ...curva,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: cor.destaque,
      }}
    >
      <Bell size={20} color={cor.primaria} strokeWidth={2.2} />
    </View>
  );
}

export function AvisoSemPermissao() {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ ...fonte.normal, ...escala.nota, color: cor.atencaoForte }}>
        As notificações do app estão desligadas no iPhone. Ligue nos Ajustes para o lembrete chegar.
      </Text>
      {Platform.OS !== "web" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openSettings().catch(() => {})}
          style={{
            minHeight: ALVO_MINIMO,
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.primariaEscura }}>
            Abrir os Ajustes
          </Text>
          <ChevronRight size={16} color={cor.primariaEscura} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A folha das horas: de meia em meia hora, das 6h às 23h30 (as mesmas da
 * meditação). É a `Folha` do app (a mesma alça, o mesmo X, o mesmo véu), e não
 * um Modal desenhado à parte.
 */
export function FolhaDoHorario({
  aberta,
  hora,
  titulo,
  aoFechar,
  aoEscolher,
}: {
  aberta: boolean;
  hora: string | null;
  titulo: string;
  aoFechar: () => void;
  aoEscolher: (h: string) => void;
}) {
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={titulo}>
      <ScrollView
        style={{ maxHeight: 420 }}
        contentContainerStyle={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: espaco.sm,
          paddingBottom: espaco.sm,
        }}
      >
        {HORARIOS.map((h) => {
          const ativa = h === hora;
          return (
            <Pressable
              key={h}
              accessibilityRole="button"
              accessibilityLabel={`Às ${h}`}
              accessibilityState={{ selected: ativa }}
              onPress={() => {
                selecao();
                aoEscolher(h);
              }}
              style={({ pressed }) => ({
                width: "23%",
                minHeight: ALVO_MINIMO,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: canto.campo,
                ...curva,
                backgroundColor: ativa ? cor.primaria : pressed ? cor.destaque : cor.apagado,
              })}
            >
              <Text
                style={{
                  ...fonte.titulo,
                  ...escala.legenda,
                  color: ativa ? cor.branco : cor.texto,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {h}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Folha>
  );
}
