import { useFocusEffect } from "expo-router";
import { Bell } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { sombraDe } from "~/componentes/jornada/atividade";
import type { DiaDaJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { desafioDaGestacao } from "~/lib/jornada/desafios-no-app";
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
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

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
    desafio: (D) => desafioDaGestacao(D)?.label ?? null,
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

/**
 * O CONVITE, na tela Hoje — depois do primeiro cuidado feito (o momento em que
 * o lembrete faz sentido para ela), até ela ligar ou dispensar. É o "lembrar
 * do app" do dono, pedido do jeito certo: o iPhone só pergunta pelas
 * notificações quando ela toca em "Às 20h".
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
          gap: espaco.sm,
          borderRadius: 18,
          backgroundColor: "#eef7ff",
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Bell size={18} color="#0369a1" />
        <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 14, color: "#0c3a5a" }}>
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

  return (
    <View
      style={{
        borderRadius: 22,
        backgroundColor: cor.branco,
        padding: espaco.lg,
        gap: espaco.sm,
        ...sombraDe("#b0708d", 0.6),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#eef7ff",
          }}
        >
          <Bell size={20} color="#0369a1" />
        </View>
        <Text style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 16, color: "#3a2230" }}>
          Quer que eu te lembre do cuidado de hoje?
        </Text>
      </View>
      <Text style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 20, color: "#7d5a72" }}>
        Um aviso por dia, na hora que você escolher — e silêncio no dia em que você já cuidou.
      </Text>
      <View style={{ flexDirection: "row", gap: espaco.sm, marginTop: 2 }}>
        <BotaoPilula
          rotulo={`Às ${HORA_PADRAO_DA_JORNADA.replace(":00", "h")}`}
          cheio
          aoTocar={() => void ligar(HORA_PADRAO_DA_JORNADA)}
        />
        <BotaoPilula rotulo="Outro horário" aoTocar={() => setEscolhendo(true)} />
      </View>
      {semPermissao ? <AvisoSemPermissao /> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          toque();
          setPref({ ...pref, dispensado: true });
          if (!ehBancada()) void definirLembretesDaJornada(uid, { dispensado: true }, null);
        }}
        style={{ minHeight: ALVO_MINIMO, justifyContent: "center", alignSelf: "flex-start" }}
      >
        <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: "#9a7486" }}>Agora não</Text>
      </Pressable>
      <FolhaDoHorario
        aberta={escolhendo}
        hora={null}
        titulo="Lembrar do cuidado de hoje às"
        aoFechar={() => setEscolhendo(false)}
        aoEscolher={(h) => {
          setEscolhendo(false);
          void ligar(h);
        }}
      />
    </View>
  );
}

export function AvisoSemPermissao() {
  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{ fontFamily: fonte.normal, fontSize: 13, lineHeight: 18, color: cor.atencaoForte }}
      >
        As notificações do app estão desligadas no iPhone. Ative nos Ajustes para o lembrete chegar.
      </Text>
      {Platform.OS !== "web" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void Linking.openSettings().catch(() => {})}
          style={{ minHeight: ALVO_MINIMO, justifyContent: "center", alignSelf: "flex-start" }}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: "#0369a1" }}>
            Abrir os Ajustes ›
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function BotaoPilula({
  rotulo,
  cheio,
  aoTocar,
}: {
  rotulo: string;
  cheio?: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: ALVO_MINIMO + 4,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        backgroundColor: cheio ? "#0284c7" : "#eef7ff",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{ fontFamily: fonte.titulo, fontSize: 15, color: cheio ? cor.branco : "#0369a1" }}
      >
        {rotulo}
      </Text>
    </Pressable>
  );
}

/** A folha das horas: de meia em meia hora, das 6h às 23h30 (as mesmas da meditação). */
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
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={aoFechar}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(20,10,30,0.35)",
          }}
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "70%",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: cor.branco,
            paddingTop: 20,
          }}
        >
          <Text
            style={{
              textAlign: "center",
              fontFamily: fonte.forte,
              fontSize: 13,
              letterSpacing: 0.65,
              textTransform: "uppercase",
              color: "#0369a1",
            }}
          >
            {titulo}
          </Text>
          <ScrollView
            contentContainerStyle={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: espaco.sm,
              padding: espaco.xl,
              paddingBottom: 40,
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
                    toque();
                    aoEscolher(h);
                  }}
                  style={{
                    width: "23%",
                    minHeight: ALVO_MINIMO,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: raio.md,
                    backgroundColor: ativa ? "#0284c7" : "#eef7ff",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonte.titulo,
                      fontSize: 15,
                      color: ativa ? cor.branco : "#0c3a5a",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {h}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
