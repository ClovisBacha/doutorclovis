import { router } from "expo-router";
import CalendarPlus from "lucide-react-native/icons/calendar-plus";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import FlaskConical from "lucide-react-native/icons/flask-conical";
import Pin from "lucide-react-native/icons/pin";
import ScanLine from "lucide-react-native/icons/scan-line";
import Stethoscope from "lucide-react-native/icons/stethoscope";
import Syringe from "lucide-react-native/icons/syringe";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Grupo, type IconeDaLinha } from "~/componentes/ajustes";
import { toque } from "~/componentes/base";
import { rota } from "~/componentes/jornada/bancada";
import {
  CHAVE_AGENDA,
  faltaQuanto,
  horaDe,
  lerAgenda,
  nomeDo,
  nomeDoMes,
  paraData,
  proximo,
  quandoPorExtenso,
  type Compromisso,
  type TipoDeCompromisso,
} from "~/lib/agenda/agenda";
import { reagendarAgenda } from "~/lib/agenda/lembretes";
import type { EstadoDaLoja } from "~/lib/jornada/loja";
import { useSessao } from "~/lib/sessao";
import { comAlfa } from "~/lib/cor";
import { canto, cor, curva, escala, espaco, fonte, luz, margem, sombra } from "~/tema";

/**
 * As peças da agenda: a folhinha do dia (a cara do ícone de calendário do
 * iPhone), o ícone de cada tipo, a linha de cada compromisso e as portas que
 * levam à agenda (a linha do Bebê e o cartão do Início).
 *
 * 18/11/2026 (a vistoria: "emoji como ícone é uma das marcas mais claras de
 * protótipo gerado"): na tela, cada tipo tem um ícone de traço; o emoji
 * (`emojiDo`) fica só no texto das notificações.
 *
 * Modo Cuidado: o nome que o app escolhe não diz "pré-natal" (`nomeDo(c, {
 * cuidado })`). Quem desenha a porta pode passar `cuidado`; sem ele, a peça o
 * lê da sessão.
 */

/** O ícone de cada tipo de compromisso. */
export const ICONE_DO_TIPO: Record<TipoDeCompromisso, IconeDaLinha> = {
  consulta: Stethoscope,
  ultrassom: ScanLine,
  exame: FlaskConical,
  vacina: Syringe,
  outro: Pin,
};

/** O ícone do tipo num ladrilho (36 no destaque, sobre o índigo; na cor da agenda nas listas). */
export function LadrilhoDoTipo({
  tipo,
  tamanho = 36,
  fundo = cor.agendaFundo,
  tinta = cor.agenda,
}: {
  tipo: TipoDeCompromisso;
  tamanho?: number;
  fundo?: string;
  tinta?: string;
}) {
  const Icone = ICONE_DO_TIPO[tipo];
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: Math.round(tamanho * 0.3),
        ...curva,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: fundo,
      }}
    >
      <Icone size={Math.round(tamanho * 0.52)} color={tinta} strokeWidth={2.2} />
    </View>
  );
}

/** A folhinha: o mês em cima, o dia grande embaixo. */
export function FolhaDoDia({ quando, tamanho = 56 }: { quando: string; tamanho?: number }) {
  const d = paraData(quando);
  if (!d) return null;
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho >= 52 ? canto.campo : 12,
        ...curva,
        overflow: "hidden",
        backgroundColor: cor.branco,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: cor.borda,
      }}
    >
      <View style={{ backgroundColor: cor.agenda, paddingVertical: 1, alignItems: "center" }}>
        <Text
          style={{
            ...fonte.forte,
            ...escala.nota,
            lineHeight: 16,
            letterSpacing: 0.4,
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
            ...fonte.titulo,
            fontSize: Math.round(tamanho * 0.42),
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

/** A altura de uma linha de compromisso, e o recuo do fio entre elas. */
const ALTURA_DO_COMPROMISSO = 72;
export const RECUO_DO_COMPROMISSO = margem.tela + 44 + espaco.md;

/**
 * Um compromisso numa lista agrupada: a folhinha, o nome, a hora e o lugar.
 * Tocar abre para editar. O que já passou fica com o texto apagado (e a
 * folhinha inteira: ela continua sendo uma data).
 */
export function LinhaDoCompromisso({
  c,
  agora,
  passado,
  cuidado,
}: {
  c: Compromisso;
  agora: Date;
  passado?: boolean;
  cuidado?: boolean;
}) {
  const d = paraData(c.quando);
  const nome = nomeDo(c, { cuidado });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${nome}, ${quandoPorExtenso(c.quando, agora)}${c.onde ? `, ${c.onde}` : ""}. Abrir`}
      onPress={() => {
        toque();
        router.push(rota(`/agenda/marcar?id=${encodeURIComponent(c.id)}`) as never);
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: ALTURA_DO_COMPROMISSO,
        paddingHorizontal: margem.tela,
        paddingVertical: espaco.sm + 2,
        backgroundColor: pressed ? cor.apagado : "transparent",
      })}
    >
      <FolhaDoDia quando={c.quando} tamanho={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            ...fonte.forte,
            ...escala.manchete,
            color: passado ? cor.textoApagado : cor.texto,
          }}
        >
          {nome}
        </Text>
        <Text
          numberOfLines={1}
          style={{
            ...fonte.media,
            ...escala.legenda,
            color: passado ? cor.textoApagado : cor.agenda,
          }}
        >
          {d ? horaDe(d) : ""}
          {passado ? "" : ` · ${faltaQuanto(c.quando, agora)}`}
        </Text>
        {c.onde ? (
          <Text
            numberOfLines={1}
            style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}
          >
            {c.onde}
          </Text>
        ) : null}
        {passado ? (
          <Text
            numberOfLines={2}
            style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}
          >
            {c.nota ? c.nota : "Toque para anotar o que foi dito"}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={16} strokeWidth={2.6} color={cor.chevron} />
    </Pressable>
  );
}

/** Uma lista de compromissos num grupo só (Depois, Já foram, o dia escolhido). */
export function ListaDeCompromissos({
  lista,
  agora,
  passados,
  cuidado,
}: {
  lista: readonly Compromisso[];
  agora: Date;
  /** Quais destes já passaram (o texto apaga). */
  passados?: (c: Compromisso) => boolean;
  cuidado?: boolean;
}) {
  return (
    <Grupo recuo={RECUO_DO_COMPROMISSO}>
      {lista.map((c) => (
        <LinhaDoCompromisso
          key={c.id}
          c={c}
          agora={agora}
          passado={passados?.(c) ?? false}
          cuidado={cuidado}
        />
      ))}
    </Grupo>
  );
}

/** Um compromisso sozinho, no material de um cartão (a mesma linha, num grupo de um). */
export function CartaoDoCompromisso({
  c,
  agora,
  passado,
  cuidado,
}: {
  c: Compromisso;
  agora: Date;
  passado?: boolean;
  cuidado?: boolean;
}) {
  return (
    <Grupo>
      <LinhaDoCompromisso c={c} agora={agora} passado={passado} cuidado={cuidado} />
    </Grupo>
  );
}

/**
 * A LINHA do Bebê: a próxima consulta, ou o convite para marcar uma. É o
 * "calendário pra pessoa lembrar do app" do dono, na tela que ela abre todo
 * dia. Sem cartão: quem a desenha a põe no grupo de atalhos (64 pt, a ficha de
 * 44, o fio recuado 70).
 */
export function ProximaNaHoje({
  c,
  agora,
  cuidado,
}: {
  c: Compromisso | null;
  agora: Date;
  cuidado?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        c
          ? `Próxima consulta: ${nomeDo(c, { cuidado })}, ${quandoPorExtenso(c.quando, agora)}. Abrir a agenda`
          : "Marcar a próxima consulta na agenda"
      }
      onPress={() => {
        toque();
        router.push(rota(c ? "/agenda" : "/agenda/marcar") as never);
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: 64,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: pressed ? cor.apagado : "transparent",
      })}
    >
      {c ? (
        <FolhaDoDia quando={c.quando} tamanho={44} />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: canto.campo,
            ...curva,
            backgroundColor: cor.agendaFundo,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CalendarPlus size={22} strokeWidth={2.2} color={cor.agenda} />
        </View>
      )}
      <View style={{ flex: 1, gap: 1 }}>
        <Text numberOfLines={1} style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>
          {c ? nomeDo(c, { cuidado }) : "A próxima consulta"}
        </Text>
        <Text
          numberOfLines={1}
          style={{ ...fonte.media, fontSize: 14, lineHeight: 19, color: cor.textoApagado }}
        >
          {c
            ? quandoPorExtenso(c.quando, agora)
            : cuidado
              ? "Suas consultas, com lembrete"
              : "Marque e eu te lembro na véspera"}
        </Text>
      </View>
      <ChevronRight size={18} strokeWidth={2.4} color={cor.chevron} />
    </Pressable>
  );
}

/**
 * A agenda na tela do Bebê: a linha da próxima consulta e, por trás, os
 * lembretes reagendados sempre que a lista muda — inclusive quando o pull
 * trouxe uma consulta marcada noutro aparelho, sem ela abrir a agenda.
 */
export function AgendaNaHoje({ loja, cuidado }: { loja: EstadoDaLoja; cuidado?: boolean }) {
  const daSessao = useSessao().cuidado;
  const bruto = loja.blob[CHAVE_AGENDA];
  const lista = useMemo(() => lerAgenda(bruto), [bruto]);
  const assinatura = JSON.stringify(lista);
  const noCuidado = cuidado ?? daSessao;
  useEffect(() => {
    if (!loja.pronto || loja.bancada) return;
    void reagendarAgenda(lista, false, { cuidado: noCuidado });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, loja.pronto, loja.bancada, noCuidado]);
  const agora = new Date();
  return <ProximaNaHoje c={proximo(lista, agora)} agora={agora} cuidado={noCuidado} />;
}

/** O cartão da agenda no Início: a folhinha da próxima e o atalho (em todo modo). */
export function PortaDaAgenda({
  c,
  agora,
  cuidado,
}: {
  c: Compromisso | null;
  agora: Date;
  cuidado?: boolean;
}) {
  const daSessao = useSessao().cuidado;
  const luto = cuidado ?? daSessao;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        c
          ? `Minha agenda. Próxima: ${nomeDo(c, { cuidado: luto })}, ${quandoPorExtenso(c.quando, agora)}`
          : luto
            ? "Minha agenda. Marcar as suas consultas"
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
          minHeight: 80,
          backgroundColor: pressed ? cor.apagado : luz.cartao,
          borderRadius: canto.cartao,
          ...curva,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: comAlfa(cor.branco, 0.9),
          paddingHorizontal: margem.tela,
          paddingVertical: espaco.md,
        },
        sombra,
      ]}
    >
      {c ? (
        <FolhaDoDia quando={c.quando} tamanho={52} />
      ) : (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: canto.campo,
            ...curva,
            backgroundColor: cor.agendaFundo,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CalendarPlus size={24} strokeWidth={2.2} color={cor.agenda} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>Minha agenda</Text>
        <Text
          numberOfLines={2}
          style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}
        >
          {c
            ? `${nomeDo(c, { cuidado: luto })} · ${quandoPorExtenso(c.quando, agora)}`
            : luto
              ? "Suas consultas, com lembrete"
              : "Consultas, ultrassons e exames, com lembrete"}
        </Text>
      </View>
      <ChevronRight size={18} strokeWidth={2.4} color={cor.chevron} />
    </Pressable>
  );
}
