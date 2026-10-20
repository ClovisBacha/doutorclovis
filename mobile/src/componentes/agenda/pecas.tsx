import { router } from "expo-router";
import { CalendarPlus, ChevronRight, MapPin } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { toque } from "~/componentes/base";
import { rota } from "~/componentes/jornada/bancada";
import {
  CHAVE_AGENDA,
  emojiDo,
  faltaQuanto,
  horaDe,
  lerAgenda,
  nomeDo,
  nomeDoMes,
  paraData,
  proximo,
  quandoPorExtenso,
  type Compromisso,
} from "~/lib/agenda/agenda";
import { reagendarAgenda } from "~/lib/agenda/lembretes";
import type { EstadoDaLoja } from "~/lib/jornada/loja";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * As peças da agenda: a folhinha do dia (a cara do ícone de calendário do
 * iPhone), o cartão de cada compromisso e as portas que levam à agenda — a
 * linha da tela Hoje e o cartão da Saúde.
 */

/** A folhinha: o mês em cima, o dia grande embaixo. */
export function FolhaDoDia({ quando, tamanho = 56 }: { quando: string; tamanho?: number }) {
  const d = paraData(quando);
  if (!d) return null;
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho + 4,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: cor.branco,
        borderWidth: 1,
        borderColor: cor.agendaFundo,
      }}
    >
      <View style={{ backgroundColor: cor.agenda, paddingVertical: 2, alignItems: "center" }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: 11,
            letterSpacing: 1,
            color: cor.branco,
            textTransform: "uppercase",
          }}
        >
          {nomeDoMes(d.getMonth()).slice(0, 3)}
        </Text>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text
          style={{
            fontFamily: fonte.titulo,
            fontSize: tamanho * 0.44,
            color: cor.texto,
            fontVariant: ["tabular-nums"],
          }}
        >
          {d.getDate()}
        </Text>
      </View>
    </View>
  );
}

/** Um compromisso na lista da agenda. Tocar abre para editar. */
export function CartaoDoCompromisso({
  c,
  agora,
  passado,
}: {
  c: Compromisso;
  agora: Date;
  passado?: boolean;
}) {
  const d = paraData(c.quando);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nomeDo(c)}, ${quandoPorExtenso(c.quando, agora)}${c.onde ? `, ${c.onde}` : ""}. Abrir`}
      onPress={() => {
        toque();
        router.push(rota(`/agenda/marcar?id=${encodeURIComponent(c.id)}`) as never);
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          backgroundColor: cor.cartao,
          borderRadius: raio.lg,
          padding: espaco.md,
          opacity: pressed ? 0.85 : passado ? 0.8 : 1,
        },
        sombra,
      ]}
    >
      <FolhaDoDia quando={c.quando} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonte.titulo, fontSize: 16, color: cor.texto }}
        >
          {emojiDo(c.tipo)} {nomeDo(c)}
        </Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.agenda }}>
          {d ? horaDe(d) : ""}
          {passado ? "" : ` · ${faltaQuanto(c.quando, agora)}`}
        </Text>
        {c.onde ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <MapPin size={13} color={cor.textoApagado} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}
            >
              {c.onde}
            </Text>
          </View>
        ) : null}
        {passado ? (
          <Text
            numberOfLines={2}
            style={{ fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}
          >
            {c.nota ? `📝 ${c.nota}` : "Toque para anotar o que foi dito"}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={20} color={cor.textoApagado} />
    </Pressable>
  );
}

/**
 * A linha da tela Hoje: a próxima consulta, ou o convite para marcar uma. É
 * o "calendário pra pessoa lembrar do app" do dono, na tela que ela abre todo dia.
 */
export function ProximaNaHoje({ c, agora }: { c: Compromisso | null; agora: Date }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        c
          ? `Próxima consulta: ${nomeDo(c)}, ${quandoPorExtenso(c.quando, agora)}. Abrir a agenda`
          : "Marcar minha próxima consulta na agenda"
      }
      onPress={() => {
        toque();
        router.push(rota(c ? "/agenda" : "/agenda/marcar") as never);
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        borderRadius: 20,
        backgroundColor: cor.branco,
        padding: 12,
        opacity: pressed ? 0.85 : 1,
        shadowColor: cor.agenda,
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      })}
    >
      {c ? (
        <FolhaDoDia quando={c.quando} tamanho={46} />
      ) : (
        <View
          style={{
            width: 46,
            height: 50,
            borderRadius: 12,
            backgroundColor: cor.agendaFundo,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CalendarPlus size={22} color={cor.agenda} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonte.titulo, fontSize: 15, color: "#3a2230" }}
        >
          {c ? nomeDo(c) : "Minha próxima consulta"}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonte.media, fontSize: 13, color: "#9a7486" }}>
          {c ? quandoPorExtenso(c.quando, agora) : "Marque e eu te lembro na véspera"}
        </Text>
      </View>
      <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.agenda }}>
        {c ? "Agenda ›" : "Marcar ›"}
      </Text>
    </Pressable>
  );
}

/**
 * A agenda na tela Hoje: a linha da próxima consulta e, por trás, os lembretes
 * reagendados sempre que a lista muda — inclusive quando o pull trouxe uma
 * consulta marcada noutro aparelho, sem ela abrir a agenda.
 */
export function AgendaNaHoje({ loja }: { loja: EstadoDaLoja }) {
  const bruto = loja.blob[CHAVE_AGENDA];
  const lista = useMemo(() => lerAgenda(bruto), [bruto]);
  const assinatura = JSON.stringify(lista);
  useEffect(() => {
    if (!loja.pronto || loja.bancada) return;
    void reagendarAgenda(lista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, loja.pronto, loja.bancada]);
  const agora = new Date();
  return <ProximaNaHoje c={proximo(lista, agora)} agora={agora} />;
}

/** O cartão da Saúde: a folhinha da próxima e o atalho para a agenda. */
export function PortaDaAgenda({ c, agora }: { c: Compromisso | null; agora: Date }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        c
          ? `Minha agenda. Próxima: ${nomeDo(c)}, ${quandoPorExtenso(c.quando, agora)}`
          : "Minha agenda. Marcar consultas e exames"
      }
      onPress={() => {
        toque();
        router.push(rota("/agenda") as never);
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          minHeight: ALVO_MINIMO + 36,
          backgroundColor: cor.agendaFundo,
          borderRadius: raio.lg,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
          opacity: pressed ? 0.85 : 1,
        },
        sombra,
      ]}
    >
      {c ? (
        <FolhaDoDia quando={c.quando} />
      ) : (
        <View
          style={{
            width: 56,
            height: 60,
            borderRadius: 14,
            backgroundColor: cor.branco,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CalendarPlus size={26} color={cor.agenda} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 19, color: cor.agenda }}>
          Minha agenda
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 19, color: cor.texto }}
        >
          {c
            ? `${nomeDo(c)} · ${quandoPorExtenso(c.quando, agora)}`
            : "Consultas, ultrassons e exames, com lembrete"}
        </Text>
      </View>
      <ChevronRight size={22} color={cor.agenda} />
    </Pressable>
  );
}
