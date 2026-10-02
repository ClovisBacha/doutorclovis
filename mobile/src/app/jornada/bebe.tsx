import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  cartaComNome,
  cartaDoDia,
  fraseDeUltimaLeitura,
  registrarLeitura,
  ultimaLeitura,
  type LeiturasDeCartas,
} from "@/lib/cartas-do-bebe";
import { Botao, Carregando, T, Tela, toque } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { BarraDoTopo, BolhaFalando, voltarParaJornada } from "~/componentes/jornada/pecas";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { estadoAtual, gravarChave } from "~/lib/jornada/loja";
import { CHAVE_CARTAS_LIDAS } from "~/lib/jornada/momentos";
import { cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * A CARTA PARA O BEBÊ — um minuto lendo em voz alta, linha a linha.
 *
 * As cartas e a régua (por fase, nunca cruzando gestação com pós-parto) são
 * do site (`@/lib/cartas-do-bebe`). O rastro de leitura viaja na jornada
 * (`dc-path-cartas-lidas`), então "você leu esta carta há 2 semanas" vale nos
 * dois aparelhos.
 *
 * ⚠️ NÃO EXISTE NO MODO CUIDADO: não há versão suavizada de um convite para
 * falar com o bebê. A tela, se aberta por algum caminho, não fala dele.
 *
 * Bancada: /jornada/bebe?bancada=1 [&etapa=leitura|fim|feita]
 */
export default function Bebe() {
  const at = useAtividade("bonding");
  const [etapa, setEtapa] = useState<"intro" | "leitura" | "fim">("intro");
  const [linha, setLinha] = useState(0);
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);

  const carta = useMemo(() => {
    if (!at.pronto || at.cuidado) return null;
    const c = cartaDoDia({ dia: at.D ?? new Date().getDate(), semanas: at.semana, posParto: at.pos });
    return cartaComNome(c, at.perfil?.baby_name ?? null);
  }, [at.pronto, at.cuidado, at.D, at.semana, at.pos, at.perfil?.baby_name]);

  const leituras = (estadoAtual().blob[CHAVE_CARTAS_LIDAS] ?? {}) as LeiturasDeCartas;
  const fraseDeLeitura = carta ? fraseDeUltimaLeitura(ultimaLeitura(leituras, carta.id), new Date()) : null;

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    const e = parametroDaBancada("etapa");
    if (e === "leitura") {
      setEtapa("leitura");
      setLinha(2);
    }
    if (e === "fim") {
      setEtapa("fim");
      setDesfecho({ ganhou: 5, fechou: true, bonus: 20, semPagamento: false });
    }
  }, [at.pronto, aplicouBancada]);

  async function terminar() {
    setEtapa("fim");
    if (!carta || !at.uid) return;
    gravarChave(CHAVE_CARTAS_LIDAS, registrarLeitura(leituras, carta.id, new Date()));
    setDesfecho(await concluirMomento({ uid: at.uid, D: at.D, momento: "bonding", cuidado: at.cuidado, pos: at.pos }));
  }

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  if (at.cuidado || !carta) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo="Jornada" />
        <T>Hoje a jornada é sobre cuidar de você. Respirar, mexer devagar e escrever continuam aqui.</T>
        <Botao rotulo="Voltar" aoTocar={voltarParaJornada} corFundo={corJornada.roxo} />
      </Tela>
    );
  }

  if (etapa === "fim") {
    return (
      <Tela bordas={["top", "bottom"]}>
        <FimDoMomento
          titulo="Carta lida 💛"
          fala="Guardei esse minuto com você. Cada leitura é a sua voz chegando mais perto."
          desfecho={desfecho}
          D={at.D}
          cuidado={false}
          pos={at.pos}
        />
      </Tela>
    );
  }

  if (etapa === "leitura") {
    const ultima = linha >= carta.lines.length - 1;
    return (
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo fechar progresso={(linha + 1) / carta.lines.length} aoSair={() => setEtapa("intro")} />
        <T tipo="apagado" centro>
          Leia em voz alta, sem pressa. Toque para a próxima linha.
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ultima ? "Última linha" : "Próxima linha"}
          onPress={() => {
            if (ultima) return;
            toque();
            setLinha((l) => l + 1);
          }}
          style={[
            {
              backgroundColor: cor.cartao,
              borderRadius: raio.lg,
              padding: espaco.xl,
              gap: espaco.md,
              borderWidth: 1,
              borderColor: "#fbcfe8",
              minHeight: 360,
            },
            sombra,
          ]}
        >
          <Text style={{ fontSize: 34, textAlign: "center" }}>{carta.emoji}</Text>
          <Text style={{ fontFamily: fonte.titulo, fontSize: 19, color: corJornada.roxoEscuro, textAlign: "center" }}>
            {carta.title}
          </Text>
          {carta.lines.slice(0, linha + 1).map((l, i) => (
            <Text
              key={i}
              style={{
                fontFamily: i === linha ? fonte.forte : fonte.media,
                fontSize: i === linha ? 22 : 17,
                lineHeight: i === linha ? 31 : 25,
                color: i === linha ? cor.texto : cor.textoApagado,
                opacity: i === linha ? 1 : 0.7,
                textAlign: "center",
              }}
            >
              {l}
            </Text>
          ))}
        </Pressable>
        <Botao
          rotulo={ultima ? "Terminei de ler" : "Próxima linha"}
          corFundo={ultima ? corJornada.feito : corJornada.roxo}
          aoTocar={() => (ultima ? void terminar() : setLinha((l) => l + 1))}
        />
      </Tela>
    );
  }

  return (
    <Tela bordas={["top", "bottom"]}>
      <BarraDoTopo titulo={at.perfil?.baby_name?.trim() ? `Carta para ${at.perfil.baby_name.trim()}` : "Carta para o bebê"} />
      <BolhaFalando
        humor="apaixonado"
        fala={
          at.jaFeita
            ? "Você já leu a carta de hoje. Ler de novo também vale cada segundo."
            : fraseDeLeitura
              ? `${fraseDeLeitura} Bora ler de novo?`
              : "Toda vez que você lê em voz alta, o bebê vai conhecendo a sua voz."
        }
        tamanho={110}
      />
      <View
        style={[
          {
            backgroundColor: "#fdf2f8",
            borderRadius: raio.lg,
            padding: espaco.xl,
            alignItems: "center",
            gap: espaco.sm,
            borderWidth: 1,
            borderColor: "#fbcfe8",
          },
          sombra,
        ]}
      >
        <Text style={{ fontSize: 46 }}>{carta.emoji}</Text>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 22, color: cor.texto, textAlign: "center" }}>{carta.title}</Text>
        <T tipo="apagado" centro>
          Uma carta de 1 minuto · {carta.lines.length} linhas
        </T>
      </View>
      <Botao rotulo="Começar a ler" corFundo={corJornada.roxo} aoTocar={() => setEtapa("leitura")} />
    </Tela>
  );
}
