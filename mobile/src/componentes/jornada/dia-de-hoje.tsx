import { LinearGradient } from "expo-linear-gradient";
import { Check, ChevronRight, Lock } from "lucide-react-native";
import { useState, type ComponentType, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { T, toque } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { Estrelas, Folha } from "~/componentes/jornada/pecas";
import { diaCurto, dataDoDia, diaNaSemana, quandoAbre, temaDoDia } from "~/lib/jornada/dia";
import { flagsDoDia, type Blob } from "~/lib/jornada/momentos";
import { estadoDoNo } from "~/lib/jornada/trilha";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

type Icone = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export type ItemDoDia = {
  chave: string;
  titulo: string;
  sub: string;
  Icone: Icone;
  feito: boolean;
  aoTocar: () => void;
  /** O desafio é marcado por toque: o rótulo pede mais linhas. */
  linhasDoSub?: number;
  rotuloDoFeito?: string;
  /** Feito na vida real e marcado aqui com um toque (o desafio): mostra um
   *  círculo para marcar em vez da seta de "abrir". */
  marcaPorToque?: boolean;
};

/** O cartão do dia: cabeçalho roxo + os momentos tocáveis + o rodapé. */
export function CartaoDoDia({
  sobre,
  titulo,
  linha,
  feitos,
  total,
  itens,
  rodape,
  mostrarEstrelas = true,
}: {
  sobre: string;
  titulo: string;
  linha?: string | null;
  feitos: number;
  total: number;
  itens: ItemDoDia[];
  rodape?: ReactNode;
  mostrarEstrelas?: boolean;
}) {
  return (
    <View style={[{ borderRadius: raio.lg, backgroundColor: cor.cartao, overflow: "hidden" }, sombra]}>
      <LinearGradient
        colors={[corJornada.roxoEscuro, corJornada.roxo, corJornada.roxoMedio]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: espaco.lg, gap: 6 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.22)",
              borderRadius: raio.pilula,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: cor.branco, letterSpacing: 0.6 }}>
              HOJE
            </Text>
          </View>
          <Text style={{ flex: 1, fontFamily: fonte.forte, fontSize: 15, color: "#ede9fe" }}>{sobre}</Text>
          {mostrarEstrelas ? <Estrelas feitos={feitos} total={total} tamanho={17} /> : null}
        </View>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 24, color: cor.branco, letterSpacing: -0.3 }}>
          {titulo}
        </Text>
        {linha ? (
          <Text style={{ fontFamily: fonte.media, fontSize: 14, color: "#ddd6fe" }}>{linha}</Text>
        ) : null}
      </LinearGradient>
      <View style={{ paddingVertical: espaco.xs }}>
        {itens.map((it, i) => (
          <LinhaDoMomento key={it.chave} item={it} ultimo={i === itens.length - 1} />
        ))}
      </View>
      {rodape ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: cor.borda,
            paddingHorizontal: espaco.lg,
            paddingVertical: espaco.md,
            backgroundColor: corJornada.roxoNevoa,
          }}
        >
          {rodape}
        </View>
      ) : null}
    </View>
  );
}

function LinhaDoMomento({ item, ultimo }: { item: ItemDoDia; ultimo: boolean }) {
  const { Icone } = item;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.titulo}. ${item.sub}`}
      accessibilityState={{ checked: item.feito }}
      accessibilityHint={item.feito ? "Já feito hoje" : item.marcaPorToque ? "Toque quando tiver feito" : undefined}
      onPress={() => {
        toque();
        item.aoTocar();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.md,
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.md,
        minHeight: ALVO_MINIMO + 16,
        backgroundColor: pressed ? corJornada.roxoNevoa : "transparent",
        borderBottomWidth: ultimo ? 0 : 1,
        borderBottomColor: "#f3ece8",
      })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: item.feito ? corJornada.feito : corJornada.roxoFundo,
        }}
      >
        {item.feito ? (
          <Check size={24} color={cor.branco} strokeWidth={3} />
        ) : (
          <Icone size={22} color={corJornada.roxo} strokeWidth={2.2} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}>{item.titulo}</Text>
        <Text
          numberOfLines={item.linhasDoSub ?? 1}
          style={{ fontFamily: fonte.normal, fontSize: 14, lineHeight: 19, color: cor.textoApagado }}
        >
          {item.sub}
        </Text>
      </View>
      {item.feito ? (
        <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corJornada.feito }}>
          {item.rotuloDoFeito ?? "Feito"}
        </Text>
      ) : item.marcaPorToque ? (
        <View
          style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2.5, borderColor: corJornada.roxoClaro }}
        />
      ) : (
        <ChevronRight size={22} color={corJornada.roxoClaro} />
      )}
    </Pressable>
  );
}

/* ── A trilha da semana ────────────────────────────────────────────────── */

export function TrilhaDaSemana({
  blob,
  dias,
  hojeD,
  hoje,
}: {
  blob: Blob;
  dias: number[];
  hojeD: number;
  hoje: Date;
}) {
  const [folha, setFolha] = useState<number | null>(null);
  const noAberto = folha != null ? estadoDoNo(blob, folha, hojeD) : null;
  return (
    <View style={{ gap: espaco.sm }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        {/* As linhas ficam numa camada ATRÁS dos nós: desenhadas dentro de cada
            nó, a do seguinte passava por cima do anterior. */}
        {dias.slice(1).map((D, i) => (
          <View
            key={`l${D}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 22,
              left: `${((i + 0.5) / dias.length) * 100}%`,
              width: `${100 / dias.length}%`,
              height: 3,
              backgroundColor: D <= hojeD ? corJornada.roxoClaro : corJornada.estrelaApagada,
            }}
          />
        ))}
        {dias.map((D) => {
          const no = estadoDoNo(blob, D, hojeD);
          const data = dataDoDia(D, hojeD, hoje);
          return (
            <View key={D} style={{ flex: 1, alignItems: "center", gap: 4 }}>
              <No
                D={D}
                no={no}
                aoTocar={() => setFolha(D)}
                rotulo={`${diaLongoAcessivel(data)}${
                  no.tipo === "futuro"
                    ? `, abre ${quandoAbre(D, hojeD, hoje)}`
                    : `, ${no.momentos} de 5 momentos`
                }`}
              />
              <Text
                style={{
                  fontFamily: no.tipo === "hoje" ? fonte.titulo : fonte.media,
                  fontSize: 13,
                  color: no.tipo === "hoje" ? corJornada.roxo : cor.textoApagado,
                }}
              >
                {no.tipo === "hoje" ? "hoje" : diaCurto(data)}
              </Text>
            </View>
          );
        })}
      </View>

      <Folha
        aberta={folha != null}
        aoFechar={() => setFolha(null)}
        titulo={folha != null ? tituloDaFolha(folha, hojeD, hoje) : undefined}
      >
        {folha != null && noAberto ? (
          noAberto.tipo === "futuro" ? (
            <View style={{ gap: espaco.sm }}>
              <T>
                Este dia abre {quandoAbre(folha, hojeD, hoje)}. A jornada anda um dia de cada vez, junto
                com a sua gestação.
              </T>
              <T tipo="apagado">
                Tema: {temaDoDia(folha).emoji} {temaDoDia(folha).rotulo}
              </T>
            </View>
          ) : (
            <ResumoDoDia blob={blob} D={folha} hoje={noAberto.tipo === "hoje"} />
          )
        ) : null}
      </Folha>
    </View>
  );
}

function diaLongoAcessivel(d: Date): string {
  return `${diaCurto(d)} ${d.getDate()}`;
}

function tituloDaFolha(D: number, hojeD: number, hoje: Date): string {
  const d = dataDoDia(D, hojeD, hoje);
  const quando = D === hojeD ? "Hoje" : `${diaCurto(d)}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${quando} · dia ${diaNaSemana(D)}`;
}

/** O que foi feito num dia (passado ou hoje) — dia passado não reabre a aula. */
export function ResumoDoDia({ blob, D, hoje }: { blob: Blob; D: number; hoje: boolean }) {
  const f = flagsDoDia(blob, D);
  const no = estadoDoNo(blob, D, D);
  const itens: [string, boolean][] = [
    ["Aula (ou desafio)", !!f.desafio],
    ["Mexer", !!f.w_movement],
    ["Meditar", !!f.w_meditation],
    ["Carta para o bebê", !!f.w_bonding],
    ["Gratidão", !!f.w_gratitude],
  ];
  return (
    <View style={{ gap: espaco.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <Estrelas feitos={no.tipo === "futuro" ? 0 : no.momentos} tamanho={24} />
        <T tipo="rotulo">
          {no.tipo !== "futuro" && no.fechado
            ? "Cinco estrelas ⭐"
            : `${no.tipo === "futuro" ? 0 : no.momentos} de 5 momentos`}
        </T>
      </View>
      <View style={{ gap: 4 }}>
        {itens.map(([rotulo, ok]) => (
          <View key={rotulo} style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm, minHeight: 30 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: ok ? corJornada.feito : cor.apagado,
              }}
            >
              {ok ? <Check size={14} color={cor.branco} strokeWidth={3} /> : null}
            </View>
            <Text style={{ fontFamily: fonte.media, fontSize: 15, color: ok ? cor.texto : cor.textoApagado }}>
              {rotulo}
            </Text>
          </View>
        ))}
      </View>
      {!hoje ? (
        <T tipo="apagado">
          {temaDoDia(D).emoji} Tema do dia: {temaDoDia(D).rotulo}. Os momentos valem no dia em que
          acontecem — o de hoje está esperando por você.
        </T>
      ) : null}
    </View>
  );
}

function No({
  D,
  no,
  aoTocar,
  rotulo,
}: {
  D: number;
  no: ReturnType<typeof estadoDoNo>;
  aoTocar: () => void;
  rotulo: string;
}) {
  const hoje = no.tipo === "hoje";
  const tam = hoje ? 46 : 40;
  const fechado = no.tipo !== "futuro" && no.fechado;
  const parcial = no.tipo !== "futuro" && !no.fechado && no.momentos > 0;
  const fundo =
    no.tipo === "futuro"
      ? cor.apagado
      : fechado
        ? corJornada.roxo
        : hoje
          ? cor.cartao
          : parcial
            ? corJornada.roxoFundo
            : cor.cartao;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={() => {
        toque();
        aoTocar();
      }}
      hitSlop={4}
      style={({ pressed }) => ({
        width: ALVO_MINIMO + 2,
        height: ALVO_MINIMO + 2,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: tam,
          height: tam,
          borderRadius: tam / 2,
          backgroundColor: fundo,
          borderWidth: hoje ? 3 : fechado ? 0 : 2,
          borderColor: hoje ? corJornada.roxo : parcial ? corJornada.roxoClaro : cor.borda,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {no.tipo === "futuro" ? (
          <Lock size={16} color={cor.textoApagado} />
        ) : fechado ? (
          <Check size={20} color={cor.branco} strokeWidth={3} />
        ) : (
          <Text
            style={{
              fontFamily: fonte.titulo,
              fontSize: hoje ? 15 : 13,
              color: hoje || parcial ? corJornada.roxo : cor.textoApagado,
            }}
          >
            {no.momentos > 0 ? `${no.momentos}/5` : diaNaSemana(D)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
