import { router } from "expo-router";
import { Bell, CalendarDays, Sprout, Wind } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Carregando, T, Tela, toque } from "~/componentes/base";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import { rota } from "~/componentes/jornada/bancada";
import {
  AvisoSemPermissao,
  contextoDoLembrete,
  FolhaDoHorario,
  usePreferenciaDosLembretes,
} from "~/componentes/jornada/lembretes";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { ehBancada } from "~/lib/bancada";
import { HORA_PADRAO_DA_JORNADA } from "~/lib/jornada/lembrete-da-jornada";
import { definirLembretesDaJornada } from "~/lib/lembretes-da-jornada";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * LEMBRETES — os avisos do app num lugar só: o cuidado de hoje (com a hora),
 * a semana nova, e os que moram nas suas telas (a meditação, as consultas da
 * agenda). Todos são notificações do próprio iPhone: nada sai do aparelho.
 *
 * Bancada: /lembretes?bancada=1 [&lembrete-jornada=20:00]
 */
export default function Lembretes() {
  const { dia, loja } = useJornada();
  const uid = dia.modo === "carregando" || dia.modo === "falhou" ? null : dia.uid;
  const [pref, setPref] = usePreferenciaDosLembretes(uid);
  const [escolhendo, setEscolhendo] = useState(false);
  const [semPermissao, setSemPermissao] = useState(false);

  if (!uid || !pref) {
    return (
      <Tela>
        <CabecalhoDaPilha titulo="Lembretes" voltarPara="/perfil" />
        <Carregando />
      </Tela>
    );
  }
  const cuidado = "cuidado" in dia && dia.cuidado;
  const pos = dia.modo === "pos";

  async function mudar(m: { hora?: string | null; semanaNova?: boolean }) {
    if (!uid || !pref) return;
    const antes = pref;
    setPref({ ...pref, ...m });
    setSemPermissao(false);
    if (ehBancada()) return;
    const r = await definirLembretesDaJornada(uid, m, contextoDoLembrete(dia, loja.blob));
    if (r === "sem-permissao") {
      setPref(antes);
      setSemPermissao(true);
    }
  }

  return (
    <Tela>
      <CabecalhoDaPilha
        titulo="Lembretes"
        subtitulo="Avisos do próprio iPhone, no seu ritmo"
        voltarPara="/perfil"
      />

      <Bloco
        icone={<Bell size={20} color="#0369a1" />}
        titulo={cuidado ? "Um minuto para você" : "O cuidado de hoje"}
        sub={
          cuidado
            ? "Um aviso gentil por dia, sem placar e sem bebê."
            : "Um aviso por dia — e silêncio no dia em que você já cuidou."
        }
        direita={
          <Switch
            accessibilityLabel="Lembrete do cuidado de hoje"
            value={!!pref.hora}
            onValueChange={(on) => void mudar({ hora: on ? HORA_PADRAO_DA_JORNADA : null })}
            trackColor={{ true: "#0284c7", false: cor.borda }}
          />
        }
      >
        {pref.hora ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Horário: ${pref.hora}. Toque para trocar`}
            onPress={() => {
              toque();
              setEscolhendo(true);
            }}
            style={({ pressed }) => ({
              minHeight: ALVO_MINIMO,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: raio.md,
              backgroundColor: "#eef7ff",
              paddingHorizontal: espaco.md,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: "#0c3a5a" }}>
              Todos os dias às
            </Text>
            <Text
              style={{
                fontFamily: fonte.titulo,
                fontSize: 17,
                color: "#0369a1",
                fontVariant: ["tabular-nums"],
              }}
            >
              {pref.hora} ›
            </Text>
          </Pressable>
        ) : null}
      </Bloco>

      {cuidado ? null : (
        <Bloco
          icone={<Sprout size={20} color="#15803d" />}
          titulo={pos ? "Cada semana de vida" : "A semana nova"}
          sub={
            pos
              ? "Às 9h do dia em que o bebê completa mais uma semana, com o que vale nela."
              : "Às 9h do dia em que começa a semana, com o tamanho do bebê."
          }
          direita={
            <Switch
              accessibilityLabel="Aviso da semana nova"
              value={pref.semanaNova}
              onValueChange={(on) => void mudar({ semanaNova: on })}
              trackColor={{ true: "#16a34a", false: cor.borda }}
            />
          }
        />
      )}

      {semPermissao ? <AvisoSemPermissao /> : null}

      <T tipo="subtitulo" estilo={{ marginTop: espaco.sm }}>
        Nas suas telas
      </T>
      <Atalho
        icone={<Wind size={20} color="#7008e7" />}
        titulo="Meditação"
        sub="O “Lembrar todo dia” fica na tela da meditação."
        aoTocar={() => router.push(rota("/jornada/meditar") as never)}
      />
      <Atalho
        icone={<CalendarDays size={20} color={cor.agenda} />}
        titulo="Consultas da agenda"
        sub="Na véspera, às 19h, e duas horas antes — sozinhos, para cada consulta."
        aoTocar={() => router.push(rota("/agenda") as never)}
      />
      <T tipo="apagado" centro>
        Se você ficar duas semanas sem abrir o app, os avisos param sozinhos.
      </T>

      <FolhaDoHorario
        aberta={escolhendo}
        hora={pref.hora}
        titulo="Lembrar às"
        aoFechar={() => setEscolhendo(false)}
        aoEscolher={(h) => {
          setEscolhendo(false);
          void mudar({ hora: h });
        }}
      />
    </Tela>
  );
}

function Bloco({
  icone,
  titulo,
  sub,
  direita,
  children,
}: {
  icone: ReactNode;
  titulo: string;
  sub: string;
  direita: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View
      style={[
        { backgroundColor: cor.cartao, borderRadius: raio.lg, padding: espaco.lg, gap: espaco.md },
        sombra,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: cor.apagado,
          }}
        >
          {icone}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: cor.texto }}>{titulo}</Text>
          <Text
            style={{
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 18,
              color: cor.textoApagado,
            }}
          >
            {sub}
          </Text>
        </View>
        {direita}
      </View>
      {children}
    </View>
  );
}

function Atalho({
  icone,
  titulo,
  sub,
  aoTocar,
}: {
  icone: ReactNode;
  titulo: string;
  sub: string;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${sub}`}
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          backgroundColor: cor.cartao,
          borderRadius: raio.lg,
          padding: espaco.lg,
          opacity: pressed ? 0.85 : 1,
        },
        sombra,
      ]}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cor.apagado,
        }}
      >
        {icone}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 16, color: cor.texto }}>{titulo}</Text>
        <Text
          style={{
            fontFamily: fonte.normal,
            fontSize: 13,
            lineHeight: 18,
            color: cor.textoApagado,
          }}
        >
          {sub}
        </Text>
      </View>
      <Text style={{ fontFamily: fonte.titulo, fontSize: 20, color: cor.textoApagado }}>›</Text>
    </Pressable>
  );
}
