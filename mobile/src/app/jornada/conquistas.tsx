import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { Check, Lock } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Botao, Cartao, Carregando, NaoConsegueLer, T, Tela, toque } from "~/componentes/base";
import { corDaRaridade, corJornada } from "~/componentes/jornada/cores";
import { lerConquistas, resgatar, type LeituraDasConquistas } from "~/componentes/jornada/economia";
import {
  BarraDoTopo,
  Confete,
  Folha,
  Pulsando,
  voltarParaJornada,
} from "~/componentes/jornada/pecas";
import { Inclinacao3D } from "~/componentes/movimento";
import { useDiaDaJornada } from "~/componentes/jornada/usarJornada";
import {
  montarGrade,
  paraResgatar,
  placar,
  prateleiras,
  type Cartao as CartaoDaGrade,
} from "~/lib/jornada/conquistas";
import { dataCurta } from "~/lib/jornada/dia";
import { cor, espaco, fonte, raio } from "~/tema";

/**
 * AS CONQUISTAS — a grade inteira, como no Duolingo: o servidor desbloqueia,
 * e a conquista ESPERA o toque para pagar ("Resgatar +15 🌱").
 *
 *   bloqueada  → apagada, com cadeado
 *   resgatar   → pulsa, pedindo o toque
 *   resgatada  → mostra a data
 *
 * ⚠️ `resgatadas: null` (falha de leitura) não vira "Resgatar" em tudo: o
 * estado é neutro e a tela diz que não conseguiu conferir.
 *
 * Bancada: /jornada/conquistas?bancada=1 [&estado=falhou|neutro] [&pos=1] [&luto=1]
 */
export default function Conquistas() {
  const dia = useDiaDaJornada();
  const cuidado = dia.modo === "carregando" || dia.modo === "falhou" ? true : dia.cuidado;
  const posParto = dia.modo === "pos";
  const [leitura, setLeitura] = useState<LeituraDasConquistas | null | "carregando">("carregando");
  const [resgatadasAgora, setResgatadasAgora] = useState<Set<string>>(() => new Set());
  const [aberta, setAberta] = useState<CartaoDaGrade | null>(null);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [falhouResgate, setFalhouResgate] = useState<string | null>(null);
  const [ganho, setGanho] = useState<{ chave: string; valor: number } | null>(null);

  const carregar = useCallback(async () => {
    setLeitura("carregando");
    setLeitura(await lerConquistas());
  }, []);
  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const grade = useMemo(() => {
    if (!leitura || leitura === "carregando") return null;
    const res = leitura.resgatadas === null ? null : [...leitura.resgatadas, ...resgatadasAgora];
    return montarGrade(leitura.unlocked, res);
  }, [leitura, resgatadasAgora]);

  async function aoResgatar(c: CartaoDaGrade) {
    if (resgatando) return;
    setResgatando(c.def.key);
    setFalhouResgate(null);
    const r = await resgatar(c.def.key);
    setResgatando(null);
    if (!r) {
      setFalhouResgate(c.def.key);
      return;
    }
    setResgatadasAgora((s) => new Set(s).add(c.def.key));
    setAberta(null);
    if (r.granted > 0) {
      setGanho({ chave: c.def.key, valor: r.granted });
      if (Platform.OS !== "web")
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }

  if (dia.modo === "carregando") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  if (cuidado) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Conquistas" />
        <T>
          As suas conquistas ficam guardadas. Hoje a jornada é sobre cuidar de você, sem placar.
        </T>
        <Botao rotulo="Voltar" aoTocar={voltarParaJornada} corFundo={corJornada.roxo} />
      </Tela>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Conquistas" />
        {leitura === "carregando" ? <Carregando texto="Conferindo as suas conquistas…" /> : null}
        {leitura === null ? (
          <NaoConsegueLer
            sossego="Tudo o que você já conquistou continua guardado."
            aoTentar={() => void carregar()}
          />
        ) : null}
        {grade && leitura && leitura !== "carregando" ? (
          <>
            <Resumo grade={grade} posParto={posParto} />
            {ganho ? (
              <Cartao fundo={corJornada.sementinhaFundo}>
                <T tipo="rotulo" cor={corJornada.sementinha} centro>
                  +{ganho.valor} sementinhas 🌱 na sua carteira!
                </T>
              </Cartao>
            ) : null}
            {leitura.resgatadas === null ? (
              <Cartao fundo={cor.atencaoFundo}>
                <T tipo="rotulo" cor={cor.atencao}>
                  Não conseguimos conferir quais você já resgatou
                </T>
                <T tipo="apagado">
                  As conquistas aparecem, mas o resgate volta quando a conexão voltar.
                </T>
                <Botao rotulo="Tentar de novo" tipo="secundario" aoTocar={() => void carregar()} />
              </Cartao>
            ) : null}
            {prateleiras(grade, posParto).map((p) => (
              <View key={p.titulo} style={{ gap: espaco.sm, marginTop: espaco.sm }}>
                <T tipo="subtitulo">{p.titulo}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
                  {p.cartoes.map((c) => (
                    <CartaoDeConquista
                      key={c.def.key}
                      c={c}
                      resgatando={resgatando === c.def.key}
                      aoAbrir={() => {
                        setFalhouResgate(null);
                        setAberta(c);
                      }}
                      aoResgatar={() => void aoResgatar(c)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        ) : null}
      </Tela>

      <Folha aberta={!!aberta} aoFechar={() => setAberta(null)}>
        {aberta ? (
          <View style={{ alignItems: "center", gap: espaco.sm }}>
            <Text style={{ fontSize: 54, opacity: aberta.estado === "bloqueada" ? 0.35 : 1 }}>
              {aberta.def.emoji}
            </Text>
            <T tipo="titulo" centro estilo={{ fontSize: 23 }}>
              {aberta.def.title}
            </T>
            <SeloDeRaridade c={aberta} />
            <T centro>{aberta.def.description}.</T>
            <T tipo="apagado" centro>
              {aberta.estado === "bloqueada"
                ? `Ainda não desbloqueada. Quando for, vale +${aberta.sementinhas} 🌱.`
                : aberta.estado === "resgatada"
                  ? `Conquistada em ${dataCurta(aberta.quando) ?? "—"} · +${aberta.sementinhas} 🌱 já resgatadas.`
                  : aberta.estado === "desbloqueada"
                    ? `Conquistada em ${dataCurta(aberta.quando) ?? "—"}.`
                    : `Conquistada em ${dataCurta(aberta.quando) ?? "—"}. Toque para resgatar.`}
            </T>
            {falhouResgate === aberta.def.key ? (
              <T tipo="rotulo" cor={cor.atencao} centro>
                Não deu para resgatar agora. A conquista continua esperando — tente de novo.
              </T>
            ) : null}
            {aberta.estado === "resgatar" ? (
              <Botao
                rotulo={`Resgatar +${aberta.sementinhas} 🌱`}
                corFundo={corJornada.roxo}
                carregando={resgatando === aberta.def.key}
                aoTocar={() => void aoResgatar(aberta)}
                estilo={{ alignSelf: "stretch" }}
              />
            ) : null}
          </View>
        ) : null}
      </Folha>
      {ganho ? <Confete key={ganho.chave} pecas={28} /> : null}
    </View>
  );
}

function Resumo({ grade, posParto }: { grade: CartaoDaGrade[]; posParto: boolean }) {
  const { feitas, total } = placar(grade, posParto);
  const n = paraResgatar(grade);
  const pct = total ? feitas / total : 0;
  return (
    <Cartao fundo={corJornada.roxoNevoa}>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 34, color: corJornada.roxoEscuro }}>
          {feitas}
        </Text>
        <Text style={{ fontFamily: fonte.forte, fontSize: 17, color: cor.textoApagado }}>
          de {total} conquistas
        </Text>
      </View>
      <View
        style={{
          height: 10,
          borderRadius: 5,
          backgroundColor: corJornada.estrelaApagada,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.round(pct * 100)}%`,
            height: "100%",
            backgroundColor: corJornada.roxoMedio,
            borderRadius: 5,
          }}
        />
      </View>
      <T tipo="apagado">
        {n > 0
          ? `${n} ${n === 1 ? "conquista espera" : "conquistas esperam"} o seu toque para virar sementinhas.`
          : "Comum vale 15 🌱, rara 40 🌱 e épica 120 🌱."}
      </T>
      {!posParto ? (
        <T tipo="apagado">As do pós-parto ficam lá embaixo, para depois do nascimento.</T>
      ) : null}
    </Cartao>
  );
}

function SeloDeRaridade({ c }: { c: CartaoDaGrade }) {
  const r = corDaRaridade[c.def.raridade];
  return (
    <View
      style={{
        backgroundColor: r.fundo,
        borderColor: r.anel,
        borderWidth: 1.5,
        borderRadius: raio.pilula,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: r.texto }}>
        {r.rotulo} · +{c.sementinhas} 🌱
      </Text>
    </View>
  );
}

function CartaoDeConquista({
  c,
  resgatando,
  aoAbrir,
  aoResgatar,
}: {
  c: CartaoDaGrade;
  resgatando: boolean;
  aoAbrir: () => void;
  aoResgatar: () => void;
}) {
  const r = corDaRaridade[c.def.raridade];
  const bloqueada = c.estado === "bloqueada";
  /* Conquistada ganha profundidade e brilho que corre com o celular (as
     trancadas ficam chapadas: é o contraste que dá vontade de ganhar). */
  const cartao = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.def.title}, ${r.rotulo.toLowerCase()}, ${
        bloqueada ? "bloqueada" : c.estado === "resgatar" ? "pronta para resgatar" : "conquistada"
      }`}
      onPress={() => {
        toque();
        aoAbrir();
      }}
      style={({ pressed }) => ({
        width: bloqueada ? "31.5%" : "100%",
        minHeight: 150,
        borderRadius: raio.md,
        borderWidth: bloqueada ? 1.5 : 2.5,
        borderColor: bloqueada ? cor.borda : r.anel,
        backgroundColor: bloqueada ? cor.apagado : r.fundo,
        padding: espaco.sm,
        alignItems: "center",
        gap: 4,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ height: 44, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 32, opacity: bloqueada ? 0.3 : 1 }}>{c.def.emoji}</Text>
        {bloqueada ? (
          <View
            style={{
              position: "absolute",
              right: -8,
              bottom: 0,
              backgroundColor: cor.cartao,
              borderRadius: 10,
              padding: 2,
            }}
          >
            <Lock size={14} color={cor.textoApagado} />
          </View>
        ) : null}
      </View>
      <Text
        numberOfLines={2}
        style={{
          fontFamily: fonte.forte,
          fontSize: 13,
          lineHeight: 17,
          textAlign: "center",
          color: bloqueada ? cor.textoApagado : cor.texto,
          minHeight: 34,
        }}
      >
        {c.def.title}
      </Text>
      <View style={{ flex: 1, justifyContent: "flex-end", alignSelf: "stretch" }}>
        {c.estado === "resgatar" ? (
          <Pulsando>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Resgatar ${c.sementinhas} sementinhas`}
              disabled={resgatando}
              onPress={() => {
                toque(false);
                aoResgatar();
              }}
              style={{
                minHeight: 44,
                paddingVertical: 4,
                borderRadius: raio.md,
                backgroundColor: corJornada.roxo,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 4,
                opacity: resgatando ? 0.6 : 1,
              }}
            >
              {resgatando ? (
                <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: cor.branco }}>…</Text>
              ) : (
                <>
                  <Text
                    style={{
                      fontFamily: fonte.forte,
                      fontSize: 13,
                      lineHeight: 16,
                      color: cor.jogoFundo,
                    }}
                  >
                    Resgatar
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonte.titulo,
                      fontSize: 13,
                      lineHeight: 16,
                      color: cor.branco,
                    }}
                  >
                    +{c.sementinhas} 🌱
                  </Text>
                </>
              )}
            </Pressable>
          </Pulsando>
        ) : c.estado === "resgatada" || c.estado === "desbloqueada" ? (
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 }}
          >
            <Check size={13} color={r.texto} strokeWidth={3} />
            <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: r.texto }}>
              {dataCurta(c.quando) ?? ""}
            </Text>
          </View>
        ) : (
          <Text
            style={{
              fontFamily: fonte.media,
              fontSize: 13,
              color: cor.textoApagado,
              textAlign: "center",
            }}
          >
            +{c.sementinhas} 🌱
          </Text>
        )}
      </View>
    </Pressable>
  );
  if (bloqueada) return cartao;
  return (
    <Inclinacao3D estilo={{ width: "31.5%" }} raio={raio.md}>
      {cartao}
    </Inclinacao3D>
  );
}
