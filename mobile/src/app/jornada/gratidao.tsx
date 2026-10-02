import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { periodoDaHora } from "@/lib/frases-do-mascote";
import {
  falaDaBolha,
  gratidaoParaReler,
  haQuantoTempo,
  HUMOR_GRATIDAO,
  marcoAtingido,
  perguntaDoDia,
  PREFIXO_GRATIDAO,
  textoDaGratidao,
  type Gratidao,
} from "@/lib/gratidao";
import { Botao, Campo, Cartao, Carregando, T, Tela } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { BarraDoTopo, BolhaFalando, Ficha } from "~/componentes/jornada/pecas";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { supabase } from "~/servidor/supabase";
import { cor, espaco } from "~/tema";

/**
 * GRATIDÃO — a pergunta do dia (por fase), fichinhas de um toque para os dias
 * em que escrever é demais, e a releitura de algo que ela escreveu há tempo.
 *
 * Grava em `journal_entries` com o MESMO formato do site ("Gratidão: …", 🙏),
 * então o diário do site mostra o que ela escreveu aqui. Escrita que falhou
 * NUNCA vira "guardado": o texto fica na tela para tentar de novo.
 *
 * Bancada: /jornada/gratidao?bancada=1 [&etapa=guardado|feita|erro] [&luto=1]
 */

type Lidas = { total: number; lista: Gratidao[] } | null;

function diaDoAno(d: Date): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86_400_000);
}

export default function GratidaoTela() {
  const at = useAtividade("gratitude");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);
  const [etapa, setEtapa] = useState<"escrever" | "guardado">("escrever");
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  const [lidas, setLidas] = useState<Lidas | "carregando">("carregando");
  const [aplicouBancada, setAplicouBancada] = useState(false);

  const pergunta = useMemo(
    () =>
      perguntaDoDia({
        dia: at.D ?? diaDoAno(new Date()),
        semanas: at.semana,
        posParto: at.pos,
        careMode: at.cuidado,
      }),
    [at.D, at.semana, at.pos, at.cuidado],
  );

  /* O que ela já escreveu: o contador da bolha e a releitura. Falhou = não sabemos (null). */
  useEffect(() => {
    if (!at.uid) return;
    if (ehBancada()) {
      const dias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
      setLidas({
        total: 23,
        lista: [
          { texto: "O Rafael fez um chá e ficou comigo no sofá.", quando: dias(1) },
          { texto: "Consegui dormir a tarde inteira.", quando: dias(26) },
        ],
      });
      return;
    }
    let vivo = true;
    void (async () => {
      const { data, error, count } = await supabase
        .from("journal_entries")
        .select("content, created_at", { count: "exact" })
        .eq("user_id", at.uid)
        .like("content", `${PREFIXO_GRATIDAO}%`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!vivo) return;
      if (error || !data) {
        setLidas(null);
        return;
      }
      const lista = (data as { content: string; created_at: string }[]).map((r) => ({
        texto: textoDaGratidao(r.content),
        quando: r.created_at,
      }));
      setLidas({ total: count ?? lista.length, lista });
    })();
    return () => {
      vivo = false;
    };
  }, [at.uid]);

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    const e = parametroDaBancada("etapa");
    if (e === "guardado") {
      setTexto("A consulta de hoje foi tranquila.");
      setEtapa("guardado");
      setDesfecho({ ganhou: at.cuidado || at.pos ? null : 5, fechou: false, bonus: null, semPagamento: at.cuidado || at.pos });
    }
    if (e === "erro") {
      setTexto("A consulta de hoje foi tranquila.");
      setErro(true);
    }
  }, [at.pronto, at.cuidado, at.pos, aplicouBancada]);

  async function guardar() {
    const t = texto.trim();
    if (!t || !at.uid || salvando) return;
    setSalvando(true);
    setErro(false);
    if (!ehBancada()) {
      const { error } = await supabase
        .from("journal_entries")
        .insert({ user_id: at.uid, content: `${PREFIXO_GRATIDAO}${t}`, mood: HUMOR_GRATIDAO });
      if (error) {
        setSalvando(false);
        setErro(true);
        return;
      }
    }
    setSalvando(false);
    setEtapa("guardado");
    setDesfecho(await concluirMomento({ uid: at.uid, D: at.D, momento: "gratitude", cuidado: at.cuidado, pos: at.pos }));
  }

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  const conhecidas = lidas && lidas !== "carregando" ? lidas : null;

  if (etapa === "guardado") {
    const total = conhecidas ? conhecidas.total + 1 : null;
    const releitura = conhecidas ? gratidaoParaReler(conhecidas.lista, new Date(), at.D ?? 0) : null;
    return (
      <Tela bordas={["top", "bottom"]}>
        <FimDoMomento
          titulo="Guardado 💛"
          fala={
            total != null
              ? falaDaBolha({ tela: "guardado", total, marco: marcoAtingido(total), temReleitura: !!releitura })
              : "Guardei 💛"
          }
          desfecho={desfecho}
          D={at.D}
          cuidado={at.cuidado}
          pos={at.pos}
          extra={
            releitura ? (
              <Cartao fundo={corJornada.roxoNevoa}>
                <T tipo="apagado">Você me contou {haQuantoTempo(releitura.quando, new Date())}:</T>
                <T tipo="subtitulo" cor={corJornada.roxoEscuro}>
                  “{releitura.texto}”
                </T>
              </Cartao>
            ) : null
          }
        />
      </Tela>
    );
  }

  const fala = at.jaFeita
    ? "Você já me contou uma coisa boa hoje. Se quiser, conta outra — eu guardo também."
    : conhecidas
      ? falaDaBolha({ tela: "escrever", total: conhecidas.total, periodo: periodoDaHora(new Date().getHours()) })
      : "Me conta uma coisa boa? Eu guardo pra você.";

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Tela bordas={["top", "bottom"]}>
        <BarraDoTopo titulo={at.cuidado ? "Escrever" : "Gratidão"} />
        <BolhaFalando humor={at.cuidado ? "feliz" : "orgulhosa"} fala={fala} />
        <T tipo="titulo" estilo={{ fontSize: 23, lineHeight: 30 }}>
          {pergunta.texto}
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
          {pergunta.fichas.map((f) => (
            <Ficha
              key={f}
              rotulo={f}
              ativa={texto.includes(f)}
              aoTocar={() =>
                setTexto((t) => (t.includes(f) ? t : t.trim() ? `${t.trim()}, ${f}` : f))
              }
            />
          ))}
        </View>
        <Campo
          rotulo="Sua resposta"
          value={texto}
          onChangeText={(v) => {
            setTexto(v);
            if (erro) setErro(false);
          }}
          placeholder="Pode ser bem pequeno."
          multiline
          maxLength={500}
        />
        {erro ? (
          <Cartao fundo={cor.atencaoFundo}>
            <T tipo="rotulo" cor={cor.atencao}>
              Não conseguimos guardar agora
            </T>
            <T tipo="apagado">Isso é a nossa conexão. O seu texto continua aqui — é só tentar de novo.</T>
          </Cartao>
        ) : null}
        <Botao
          rotulo={erro ? "Tentar guardar de novo" : "Guardar"}
          corFundo={corJornada.roxo}
          carregando={salvando}
          desabilitado={!texto.trim()}
          aoTocar={() => void guardar()}
        />
      </Tela>
    </KeyboardAvoidingView>
  );
}
