import { diaLocalDe, periodoDaHora } from "@/lib/frases-do-mascote";
import { Image } from "expo-image";
import { router } from "expo-router";
import CalendarDays from "lucide-react-native/icons/calendar-days";
import Check from "lucide-react-native/icons/check";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import PenLine from "lucide-react-native/icons/pen-line";
import Phone from "lucide-react-native/icons/phone";
import Wind from "lucide-react-native/icons/wind";
import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { AvisoMedico } from "~/componentes/aviso-medico";
import { useAgenda } from "~/componentes/agenda/usar-agenda";
import { Cartao, Tela, TituloDaSecao, toque } from "~/componentes/base";
import { rota } from "~/componentes/jornada/bancada";
import { useLivresDeHoje } from "~/componentes/jornada/livres";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { CVV, SAMU, SOS_NO_APP } from "~/config";
import { nomePadrao, proximo, quandoPorExtenso, type Compromisso } from "~/lib/agenda/agenda";
import { parametroDaBancada } from "~/lib/bancada";
import { fraseDoDiaNoApp } from "~/lib/frase-do-dia";
import { primeiroNome } from "~/lib/gestacao";
import { dataDeHoje, saudacao } from "~/lib/jornada/hoje";
import { ligar } from "~/lib/links";
import { useSessao } from "~/lib/sessao";
import { pedirSocorro } from "~/lib/socorro";
import { canto, cor, curva, escala, espaco, fonte, luz, sombra } from "~/tema";

/**
 * O MODO CUIDADO (luto) — UMA TELA SÓ (18/11/2026, a vistoria de design).
 *
 * Antes eram três abas para duas ações: o "Hoje" (respirar e escrever, num
 * cartão de cabeçalho violeta de jogo, com a pílula "HOJE"), o "Início" (o
 * acolhimento, um atalho que só levava de volta ao Hoje, a agenda) e as Amigas
 * com uma frase. As duas primeiras falavam de socorro com textos diferentes, e
 * a bolha sorrindo com brilhos ficava ao lado de "Estamos aqui com você".
 *
 * Agora, de cima para baixo: a data e o bom-dia; a frase do dia, como texto
 * calmo (sem balão e sem mascote); o acolhimento, com os dois números de ajuda
 * TOCÁVEIS (o CVV e o 192); "Para hoje" numa lista só (respirar, escrever, a
 * agenda); e, no pé, as Amigas que voltam e o aviso médico. Sem bebê, sem
 * gestação, sem placar, sem festa — e uma cor de agir só, a framboesa, nos
 * telefones.
 *
 * É a mesma tela no "Hoje" (`(abas)/jornada.tsx`) e no "Início"
 * (`(abas)/inicio.tsx`), até a casca deixar só uma aba no luto.
 */
export function TelaDoCuidado({
  uid,
  direita,
}: {
  uid: string | null;
  /** O canto direito do topo: a foto dela, que abre o Perfil. */
  direita?: ReactNode;
}) {
  const { perfil } = useSessao();
  const feitos = useLivresDeHoje(uid);
  const agora = new Date();
  const hora = horaDaTela(agora);
  const nome = primeiroNome(perfil?.display_name ?? perfil?.full_name);
  const frase = fraseDoDiaNoApp({
    dia: diaLocalDe(agora),
    periodo: periodoDaHora(hora),
    nome,
    careMode: true,
    hora,
    semanas: null,
  });
  /* A frase do dia às vezes já abre com o bom-dia ("Boa noite. Hoje já
     foi…"): aí o título não repete a saudação. */
  const titulo = frase?.startsWith(saudacao(hora, null)) ? "Cuidar de você" : saudacao(hora, nome);

  /* Um fade só, de 200 ms, e nenhuma cascata: a tela chega quieta. */
  const reduzido = useMovimentoReduzido();
  const chegada = useRef(new Animated.Value(reduzido ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) {
      chegada.setValue(1);
      return;
    }
    Animated.timing(chegada, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [reduzido, chegada]);

  return (
    <Tela>
      <Animated.View style={{ opacity: chegada, gap: espaco.lg }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: espaco.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                ...fonte.forte,
                ...escala.nota,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: cor.textoApagado,
              }}
            >
              {dataDeHoje(agora)}
            </Text>
            <Text
              accessibilityRole="header"
              style={{ ...fonte.display, ...escala.titulo1, letterSpacing: -0.2, color: cor.texto }}
            >
              {titulo}
            </Text>
            <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
              Um momento por dia, no seu ritmo.
            </Text>
          </View>
          {direita}
        </View>

        {frase ? (
          <Text
            style={{
              ...fonte.media,
              fontSize: 17,
              lineHeight: 25,
              color: cor.texto,
              paddingHorizontal: 2,
            }}
          >
            {frase}
          </Text>
        ) : null}

        <Acolhimento />

        <View style={{ gap: espaco.sm }}>
          <TituloDaSecao>Para hoje</TituloDaSecao>
          <View style={GRUPO}>
            <LinhaDoCuidado
              Icone={Wind}
              titulo="Respirar"
              sub="Um minuto de respiração lenta"
              feito={feitos.has("meditation")}
              aoTocar={() => ir("/jornada/meditar")}
            />
            <Divisor />
            <LinhaDoCuidado
              Icone={PenLine}
              titulo="Escrever"
              sub="Uma linha sobre o seu dia"
              feito={feitos.has("gratitude")}
              aoTocar={() => ir("/jornada/gratidao")}
            />
            <Divisor />
            <LinhaDaAgenda />
          </View>
        </View>

        <View style={{ gap: espaco.sm, paddingTop: espaco.sm }}>
          <Text
            style={{
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoApagado,
              textAlign: "center",
              paddingHorizontal: espaco.lg,
            }}
          >
            As Amigas voltam quando você quiser. Está tudo guardado.
          </Text>
          <AvisoMedico curto />
        </View>
      </Animated.View>
    </Tela>
  );
}

/**
 * O ACOLHIMENTO: a arte parada (o coração na almofada) e os dois números de
 * ajuda, tocáveis. Sem mascote e sem `Flutuar`: no luto nada pula na tela.
 */
function Acolhimento() {
  return (
    <Cartao estilo={{ gap: espaco.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Image
          source={require("../../../../src/assets/grades/apoio.webp")}
          style={{ width: 56, height: 56 }}
          contentFit="contain"
          accessible={false}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
            Estamos aqui com você
          </Text>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            Se o dia pesar, tem gente para ouvir você, a qualquer hora.
          </Text>
        </View>
      </View>
      <AjudaAgora />
    </Cartao>
  );
}

/**
 * OS NÚMEROS DE AJUDA, como linhas tocáveis: o CVV (188, para conversar) e a
 * emergência (o 192 — ou o SOS, se ele voltar ao app). Um número que só se lê
 * obriga a decorar e discar à mão, justo na hora mais difícil. O pós-parto usa
 * as mesmas linhas no apoio do "Triste".
 */
export function AjudaAgora() {
  return (
    <View>
      <LinhaDeAjuda
        titulo="Conversar com o CVV"
        sub={`${CVV} · 24 horas, gratuito`}
        rotulo={`Ligar para o CVV, ${CVV}`}
        aoTocar={() => ligar(CVV)}
      />
      <View
        style={{ height: StyleSheet.hairlineWidth, marginLeft: 52, backgroundColor: cor.borda }}
      />
      <LinhaDeAjuda
        titulo="Emergência"
        sub={SOS_NO_APP ? "Abrir o SOS" : `SAMU ${SAMU}`}
        rotulo={SOS_NO_APP ? "Abrir o SOS" : `Ligar para o SAMU, ${SAMU}`}
        aoTocar={pedirSocorro}
      />
    </View>
  );
}

function LinhaDeAjuda({
  titulo,
  sub,
  rotulo,
  aoTocar,
}: {
  titulo: string;
  sub: string;
  rotulo: string;
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
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: 56,
        paddingVertical: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cor.rosaMarca,
        }}
      >
        <Phone size={20} color={cor.primaria} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>{titulo}</Text>
        <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>{sub}</Text>
      </View>
      <ChevronRight size={20} color={cor.chevron} strokeWidth={2.4} />
    </Pressable>
  );
}

/* ── "Para hoje": uma lista só ──────────────────────────────────────────── */

const GRUPO = {
  borderRadius: canto.cartao,
  ...curva,
  paddingVertical: 4,
  backgroundColor: luz.cartao,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: "rgba(255,255,255,0.9)",
  ...sombra,
} as const;

/** A divisória da lista, alinhada ao texto (16 de margem + 44 do ícone + 12 de vão). */
function Divisor() {
  return (
    <View
      style={{ height: StyleSheet.hairlineWidth, marginLeft: 72, backgroundColor: cor.borda }}
    />
  );
}

type Icone = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function LinhaDoCuidado({
  Icone,
  titulo,
  sub,
  feito = false,
  linhasDoSub = 1,
  rotulo,
  aoTocar,
}: {
  Icone: Icone;
  titulo: string;
  sub: string;
  feito?: boolean;
  linhasDoSub?: number;
  rotulo?: string;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo ?? `${titulo}. ${feito ? "Feito hoje" : sub}`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        minHeight: 64,
        paddingVertical: 10,
        paddingLeft: espaco.lg,
        paddingRight: 14,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cor.apagado,
        }}
      >
        <Icone size={22} color={cor.texto} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...fonte.forte, ...escala.chamada, color: cor.texto }}>{titulo}</Text>
        <Text
          numberOfLines={linhasDoSub}
          style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}
        >
          {sub}
        </Text>
      </View>
      {feito ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Check size={16} color={cor.textoApagado} strokeWidth={2.6} />
          <Text style={{ ...fonte.forte, ...escala.nota, color: cor.textoApagado }}>
            Feito hoje
          </Text>
        </View>
      ) : (
        <ChevronRight size={20} color={cor.chevron} strokeWidth={2.4} />
      )}
    </Pressable>
  );
}

/** A agenda, como a terceira linha: a próxima consulta, ou o convite para marcar. */
function LinhaDaAgenda() {
  const { lista, pronto } = useAgenda();
  const agora = new Date();
  const c = pronto ? proximo(lista, agora) : null;
  const sub = c
    ? `${nomeNoCuidado(c)} · ${quandoPorExtenso(c.quando, agora)}`
    : "Suas consultas, com lembrete";
  return (
    <LinhaDoCuidado
      Icone={CalendarDays}
      titulo="Minha agenda"
      sub={sub}
      linhasDoSub={2}
      rotulo={c ? `Minha agenda. Próxima: ${sub}` : "Minha agenda. Marcar uma consulta"}
      aoTocar={() => ir("/agenda")}
    />
  );
}

/**
 * O nome do compromisso no luto: o que ela escreveu fica como escreveu, mas o
 * nome que o APP inventa não diz "pré-natal" (a consulta sem título vira só
 * "Consulta"). ⚠️ Quando `nomeDo(c, { cuidado })` existir em
 * `lib/agenda/agenda.ts`, esta função dá lugar a ele.
 */
function nomeNoCuidado(c: Pick<Compromisso, "tipo" | "titulo">): string {
  const escrito = c.titulo?.trim();
  if (escrito) return escrito;
  return c.tipo === "consulta" ? "Consulta" : nomePadrao(c.tipo);
}

const ir = (caminho: string) => router.push(rota(caminho) as never);

/** A hora que escolhe o bom-dia (`&hora=` na bancada). */
function horaDaTela(agora: Date): number {
  const p = parametroDaBancada("hora");
  const h = Number(p);
  return p != null && Number.isFinite(h) && h >= 0 && h < 24 ? h : agora.getHours();
}
