import { comPacote, ehLocal, mesclar, semPacote } from "@/lib/fila-local";
import { INTENSIDADE_PADRAO, NIVEIS_DE_INTENSIDADE } from "@/lib/intensidade-da-contracao";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Carregando, Cartao, Linha, NaoConsegueLer, T, Tela, toque } from "~/componentes/base";
import { Cabecalho, Confirmacao, Escolha } from "~/componentes/saude/pecas";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { gravarFila, lerFila } from "~/lib/saude/armazem-de-filas";
import { contracoesDeExemplo } from "~/lib/saude/bancada";
import { isoNormal } from "~/lib/saude/chutes";
import {
  fecharContracao,
  linhasDaLista,
  novaContracao,
  perguntaParaApagarContracao,
  resumoDeContracoes,
  type ContracaoDaTela,
  type LinhaDaLista,
} from "~/lib/saude/contracoes";
import {
  chaveDaFilaDeContracoes,
  contracaoPronta,
  ehContracaoPendente,
  sincronizarFila,
  type ContracaoPendente,
} from "~/lib/saude/fila";
import { relogio } from "~/lib/saude/formato";
import { usarRelogio, usarRetorno, usarTelaAcesa } from "~/lib/saude/usar-retorno";
import { useSessao } from "~/lib/sessao";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * O CRONÔMETRO DE CONTRAÇÕES — um cronômetro simples, aberto de dentro do SOS.
 *
 * ⚠️ 21/10/2026, decisão do dono (rede social + gamificação, não conselho
 * médico): saiu a régua — o status ("ligue para o seu médico agora"), o
 * 5-1-1, o alerta de prematuro, a tendência da intensidade e a lista "vá à
 * maternidade se". O app não diz quando ligar. Ficam o Começou/Terminou, a
 * dor de cada uma, a tabela (hora, duração, intervalo, intensidade) e a conta
 * crua do dia. Os sinais de alerta moram no SOS, que é de onde ela chega.
 *
 * Fica no Modo Cuidado: quem perdeu a gestação pode estar em trabalho de parto.
 */
export default function Contracoes() {
  const { sessao } = useSessao();
  const uid = sessao?.user.id ?? null;

  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [historico, setHistorico] = useState<ContracaoDaTela[]>([]);
  const [pendentes, setPendentes] = useState<ContracaoPendente[]>([]);
  const [intensidade, setIntensidade] = useState<number>(INTENSIDADE_PADRAO);
  const [aberta, setAberta] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroLinha, setErroLinha] = useState<string | null>(null);
  const sincronizando = useRef(false);

  const ativa = pendentes.find((c) => c.ended_at == null) ?? null;
  const agora = usarRelogio(true);
  usarTelaAcesa(!!ativa, "dc-contracao");

  const buscar = useCallback(async () => {
    const { data, error } = await supabase
      .from("contraction_logs")
      .select("id, started_at, ended_at, intensity")
      .order("started_at", { ascending: false })
      .limit(30);
    if (error || !data) {
      setEstado("falhou");
      return;
    }
    setHistorico(
      (data as ContracaoDaTela[]).map((c) => ({ ...c, started_at: isoNormal(c.started_at) })),
    );
    setEstado("pronto");
  }, []);

  const sincronizar = useCallback(async () => {
    if (ehBancada() || !uid || sincronizando.current) return;
    sincronizando.current = true;
    const chave = chaveDaFilaDeContracoes(uid);
    try {
      await sincronizarFila<ContracaoPendente>({
        ler: () => lerFila(chave, ehContracaoPendente),
        gravar: (f) => gravarFila(chave, f),
        pronto: contracaoPronta,
        agora: () => Date.now(),
        conferir: async (p) => {
          const { data, error } = await supabase
            .from("contraction_logs")
            .select("id")
            .eq("started_at", p.started_at)
            .limit(1);
          if (error) return "falhou";
          return data?.length ? "ja-esta" : "nao-esta";
        },
        inserir: async (p) => {
          const { error } = await supabase.from("contraction_logs").insert({
            user_id: uid,
            started_at: p.started_at,
            ended_at: p.ended_at,
            intensity: p.intensity,
          });
          return !error;
        },
      });
      setPendentes(await lerFila(chave, ehContracaoPendente));
    } finally {
      sincronizando.current = false;
    }
  }, [uid]);

  const carregar = useCallback(async () => {
    if (ehBancada()) {
      const est = parametroDaBancada("estado");
      const t = Date.now();
      if (est === "contando") {
        setPendentes([{ ...novaContracao(t - 38000, 2) }]);
      }
      if (est === "falhou") setEstado("falhou");
      else {
        setHistorico(contracoesDeExemplo(t));
        setEstado("pronto");
      }
      return;
    }
    if (!uid) return;
    const fila = await lerFila(chaveDaFilaDeContracoes(uid), ehContracaoPendente);
    setPendentes(fila);
    const abertaLocal = fila.find((c) => c.ended_at == null);
    if (abertaLocal) setIntensidade(abertaLocal.intensity);
    await sincronizar();
    await buscar();
  }, [uid, sincronizar, buscar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  usarRetorno(() => {
    void sincronizar().then(() => (ehBancada() ? undefined : buscar()));
  }, pendentes.some(contracaoPronta));

  /** Grava a fila no aparelho (ou só na memória, na bancada) e repinta. */
  async function mudarFila(f: (fila: ContracaoPendente[]) => ContracaoPendente[]) {
    if (ehBancada() || !uid) {
      setPendentes((p) => f(p));
      return;
    }
    const chave = chaveDaFilaDeContracoes(uid);
    const nova = f(await lerFila(chave, ehContracaoPendente));
    await gravarFila(chave, nova);
    setPendentes(nova);
  }

  async function comecar() {
    toque(false);
    setIntensidade(INTENSIDADE_PADRAO);
    const c = novaContracao(Date.now(), INTENSIDADE_PADRAO);
    await mudarFila((fila) => comPacote(fila, c, Date.now()));
  }

  async function terminar() {
    if (!ativa) return;
    toque(false);
    const fechada = fecharContracao(ativa, Date.now(), intensidade);
    await mudarFila((fila) => comPacote(fila, fechada, Date.now()));
    if (!ehBancada()) {
      await sincronizar();
      await buscar();
    }
  }

  async function corrigir(id: string, valor: number) {
    setErroLinha(null);
    if (ehLocal(id) || ehBancada()) {
      if (ehLocal(id)) {
        await mudarFila((fila) => {
          const c = fila.find((x) => x.id === id);
          return c ? comPacote(fila, { ...c, intensity: valor }, Date.now()) : fila;
        });
      }
      setHistorico((h) => h.map((c) => (c.id === id ? { ...c, intensity: valor } : c)));
      setAberta(null);
      return;
    }
    const antes = historico;
    setHistorico((h) => h.map((c) => (c.id === id ? { ...c, intensity: valor } : c)));
    const { error } = await supabase
      .from("contraction_logs")
      .update({ intensity: valor })
      .eq("id", id);
    if (error) {
      setHistorico(antes);
      setErroLinha("Não conseguimos corrigir agora. Tente de novo.");
      return;
    }
    setAberta(null);
  }

  async function apagar(id: string) {
    setErroLinha(null);
    if (ehLocal(id)) {
      await mudarFila((fila) => semPacote(fila, id));
    } else if (!ehBancada()) {
      setOcupado(true);
      const { error } = await supabase.from("contraction_logs").delete().eq("id", id);
      setOcupado(false);
      if (error) {
        setErroLinha(
          "Não conseguimos apagar agora. A contração continua guardada — tente de novo.",
        );
        return;
      }
    }
    setHistorico((h) => h.filter((c) => c.id !== id));
    setApagando(null);
    setAberta(null);
  }

  const todas = mesclar(historico, pendentes) as ContracaoDaTela[];
  const linhas = linhasDaLista(todas.filter((c) => c.id !== ativa?.id)).slice(0, 12);
  /* A conta crua do dia — "3 hoje · última às 14:20". Nenhum julgamento. */
  const resumo = resumoDeContracoes(todas, agora);

  return (
    <Tela>
      <Cabecalho
        titulo="Contrações"
        arte="contracoes"
        fundo={cor.contracoesFundo}
        voltarPara="/sos"
      />

      <Cartao fundo={cor.contracoesFundo} estilo={{ alignItems: "center", gap: espaco.md }}>
        {ativa ? (
          <>
            <T tipo="rotulo" cor={cor.contracoes}>
              Contração em curso
            </T>
            <Text
              accessibilityLabel={`Duração ${relogio(agora - new Date(ativa.started_at).getTime())}`}
              style={{
                fontFamily: fonte.titulo,
                fontSize: 64,
                color: cor.contracoes,
                fontVariant: ["tabular-nums"],
              }}
            >
              {relogio(agora - new Date(ativa.started_at).getTime())}
            </Text>
            <View style={{ alignSelf: "stretch", gap: espaco.sm }}>
              <T tipo="rotulo">Como está a dor?</T>
              <Escolha
                opcoes={NIVEIS_DE_INTENSIDADE.map((n) => ({
                  valor: n.valor as number,
                  rotulo: n.rotulo,
                }))}
                valor={intensidade}
                corAtiva={cor.contracoes}
                rotuloAcessivel="Intensidade da contração"
                aoEscolher={(v) => {
                  setIntensidade(v);
                  void mudarFila((fila) => {
                    const c = fila.find((x) => x.id === ativa.id);
                    return c ? comPacote(fila, { ...c, intensity: v }, Date.now()) : fila;
                  });
                }}
              />
            </View>
            <BotaoRedondo rotulo="Terminou" aoTocar={() => void terminar()} cheio />
          </>
        ) : (
          <>
            <BotaoRedondo rotulo="Começou" aoTocar={() => void comecar()} />
            <T tipo="apagado" centro>
              Toque quando a contração começar e de novo quando ela terminar.
            </T>
          </>
        )}
      </Cartao>

      {resumo ? (
        <T tipo="rotulo" centro>
          {resumo}
        </T>
      ) : null}

      {estado === "carregando" ? <Carregando texto="Lendo suas contrações…" /> : null}
      {estado === "falhou" ? (
        <NaoConsegueLer
          sossego="O cronômetro continua funcionando: o que você marcar fica guardado no aparelho e sobe depois."
          aoTentar={() => {
            setEstado("carregando");
            void buscar();
          }}
        />
      ) : null}

      {linhas.length ? (
        <View style={{ gap: espaco.xs }}>
          <T tipo="subtitulo">As últimas</T>
          <T tipo="apagado">Toque numa linha para corrigir a intensidade ou apagar.</T>
          <Linha estilo={{ paddingHorizontal: espaco.md, paddingTop: espaco.sm }}>
            {["Hora", "Duração", "Intervalo", "Intensidade"].map((c, i) => (
              <Text
                key={c}
                style={[
                  COLUNAS[i],
                  { fontFamily: fonte.forte, fontSize: 13, color: cor.textoApagado },
                ]}
              >
                {c}
              </Text>
            ))}
          </Linha>
          {linhas.map((l) => (
            <LinhaDaContracao
              key={l.id}
              linha={l}
              aberta={aberta === l.id}
              apagando={apagando === l.id}
              ocupado={ocupado}
              erro={aberta === l.id ? erroLinha : null}
              aoTocar={() => {
                setErroLinha(null);
                setApagando(null);
                setAberta(aberta === l.id ? null : l.id);
              }}
              aoCorrigir={(v) => void corrigir(l.id, v)}
              aoPedirApagar={() => setApagando(l.id)}
              aoApagar={() => void apagar(l.id)}
              aoCancelar={() => setApagando(null)}
            />
          ))}
        </View>
      ) : null}
    </Tela>
  );
}

const COLUNAS = [{ width: 56 }, { width: 72 }, { width: 80 }, { flex: 1 }] as const;

function BotaoRedondo({
  rotulo,
  aoTocar,
  cheio,
}: {
  rotulo: string;
  aoTocar: () => void;
  cheio?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      style={({ pressed }) => ({
        width: cheio ? "100%" : 180,
        height: cheio ? 64 : 180,
        borderRadius: cheio ? raio.pilula : 90,
        backgroundColor: pressed ? "#9a3412" : cor.contracoes,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: cor.contracoes,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      })}
    >
      <Text style={{ fontFamily: fonte.titulo, fontSize: cheio ? 22 : 28, color: cor.branco }}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

function LinhaDaContracao({
  linha: l,
  aberta,
  apagando,
  ocupado,
  erro,
  aoTocar,
  aoCorrigir,
  aoPedirApagar,
  aoApagar,
  aoCancelar,
}: {
  linha: LinhaDaLista;
  aberta: boolean;
  apagando: boolean;
  ocupado: boolean;
  erro: string | null;
  aoTocar: () => void;
  aoCorrigir: (v: number) => void;
  aoPedirApagar: () => void;
  aoApagar: () => void;
  aoCancelar: () => void;
}) {
  const intervalo =
    l.intervaloSeg == null
      ? "—"
      : l.intervaloSeg >= 3600
        ? `${Math.floor(l.intervaloSeg / 3600)} h ${String(Math.round((l.intervaloSeg % 3600) / 60)).padStart(2, "0")}`
        : `${Math.max(1, Math.round(l.intervaloSeg / 60))} min`;
  const texto = {
    fontFamily: fonte.media,
    fontSize: 15,
    color: cor.texto,
    fontVariant: ["tabular-nums" as const],
  };
  return (
    <View
      style={{
        backgroundColor: aberta ? cor.contracoesFundo : cor.cartao,
        borderRadius: raio.md,
        borderWidth: 1,
        borderColor: aberta ? cor.contracoes : cor.borda,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Contração das ${l.hora}. Toque para corrigir ou apagar.`}
        onPress={() => {
          toque();
          aoTocar();
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          minHeight: ALVO_MINIMO + 4,
          paddingHorizontal: espaco.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={[COLUNAS[0], texto, { fontFamily: fonte.forte }]}>{l.hora}</Text>
        <Text style={[COLUNAS[1], texto]}>
          {l.duracaoSeg != null ? relogio(l.duracaoSeg * 1000) : "sem fim"}
        </Text>
        <Text style={[COLUNAS[2], texto]}>{intervalo}</Text>
        <Text style={[COLUNAS[3], texto, { color: cor.contracoes, fontFamily: fonte.forte }]}>
          {l.intensidade ?? "—"}
        </Text>
      </Pressable>
      {aberta ? (
        <View style={{ padding: espaco.md, paddingTop: 0, gap: espaco.sm }}>
          <T tipo="rotulo">Corrigir a intensidade</T>
          <Escolha
            opcoes={NIVEIS_DE_INTENSIDADE.map((n) => ({
              valor: n.valor as number,
              rotulo: n.rotulo,
            }))}
            valor={l.valorIntensidade}
            corAtiva={cor.contracoes}
            rotuloAcessivel="Corrigir a intensidade"
            aoEscolher={aoCorrigir}
          />
          {erro && !apagando ? (
            <T tipo="apagado" cor={cor.urgente}>
              {erro}
            </T>
          ) : null}
          {apagando ? (
            <Confirmacao
              pergunta={perguntaParaApagarContracao(l)}
              rotuloSim="Apagar"
              carregando={ocupado}
              erro={erro}
              aoConfirmar={aoApagar}
              aoCancelar={aoCancelar}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={aoPedirApagar}
              style={{ minHeight: ALVO_MINIMO, justifyContent: "center", alignSelf: "flex-start" }}
            >
              <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: cor.urgente }}>
                Apagar esta contração
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}
