import { comPacote, ehLocal, mesclar } from "@/lib/fila-local";
import { FORCA_PADRAO, NIVEIS_DE_FORCA, nivelDeForca } from "@/lib/forca-do-movimento";
import {
  faixaPessoal,
  FRASE_DA_LINHA_PLANA,
  leituraDeHoje,
  MINIMO_PARA_FAIXA,
  serieDeChutes,
  ultimaContagem,
  type SessaoDeChutes,
} from "@/lib/serie-de-chutes";
import { sinalMovimentosReduzidos } from "@/lib/sinais-clinicos";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Botao,
  Carregando,
  Cartao,
  Linha,
  NaoConsegueLer,
  Pilula,
  T,
  Tela,
  toque,
} from "~/componentes/base";
import { GraficoDeLinha } from "~/componentes/saude/grafico";
import { Cabecalho, CartaoDeSocorro, Escolha } from "~/componentes/saude/pecas";
import { apagar, gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { gravarFila, lerFila } from "~/lib/saude/armazem-de-filas";
import { sessaoEmCursoDeExemplo, sessoesDeExemplo } from "~/lib/saude/bancada";
import {
  chaveDaSessaoDeChutes,
  encerrarDescarta,
  isoNormal,
  pacoteDaSessao,
  sanearSessao,
  type SessaoEmCurso,
} from "~/lib/saude/chutes";
import {
  chaveDaFilaDeChutes,
  ehSessaoPendente,
  inserirComRecuo,
  sincronizarFila,
  type SessaoPendente,
} from "~/lib/saude/fila";
import { duracaoFalada, numeroBR, quandoFoi, relogio } from "~/lib/saude/formato";
import { usarRelogio, usarRetorno, usarTelaAcesa } from "~/lib/saude/usar-retorno";
import { useSessao } from "~/lib/sessao";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/** A partir daqui se OBSERVA (o piso numérico da régua continua nas 28). */
const SEMANA_DE_OBSERVAR = 26;

type Contagem = SessaoDeChutes & { id: string; strength?: number | null };
type Aviso = { texto: string; tom: "ok" | "aparelho" | "neutro" } | null;

export default function Chutes() {
  const { sessao, perfil, cuidado, estadoDoPerfil } = useSessao();
  const uid = sessao?.user.id ?? null;
  /* Bancada sem ?semana= abre já na fase de contar (30 semanas); `&semana=22` mostra o antes. */
  const semanaDaBancada = ehBancada() && !parametroDaBancada("semana") ? 30 : null;
  const semanas = semanaDaBancada ?? gestacaoDoPerfil(perfil)?.weeks ?? null;
  const fase = semanas == null || semanas >= SEMANA_DE_OBSERVAR;

  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [historico, setHistorico] = useState<Contagem[]>([]);
  const [pendentes, setPendentes] = useState<SessaoPendente[]>([]);
  const [emCurso, setEmCurso] = useState<SessaoEmCurso | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const sincronizando = useRef(false);
  const agora = usarRelogio(!!emCurso);
  usarTelaAcesa(!!emCurso, "dc-chutes");

  const buscar = useCallback(async () => {
    const { data, error } = await supabase
      .from("kick_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(30);
    if (error || !data) {
      setEstado("falhou");
      return;
    }
    setHistorico((data as Contagem[]).map((k) => ({ ...k, started_at: isoNormal(k.started_at) })));
    setEstado("pronto");
  }, []);

  /** Sobe a fila. Devolve quantas ficaram. */
  const sincronizar = useCallback(async (): Promise<number> => {
    if (ehBancada() || !uid || sincronizando.current) return -1;
    sincronizando.current = true;
    const chave = chaveDaFilaDeChutes(uid);
    try {
      const r = await sincronizarFila<SessaoPendente>({
        ler: () => lerFila(chave, ehSessaoPendente),
        gravar: (f) => gravarFila(chave, f),
        pronto: () => true,
        agora: () => Date.now(),
        conferir: async (p) => {
          const { data, error } = await supabase
            .from("kick_sessions")
            .select("id")
            .eq("started_at", p.started_at)
            .limit(1);
          if (error) return "falhou";
          return data?.length ? "ja-esta" : "nao-esta";
        },
        inserir: async (p) => {
          const { error } = await inserirComRecuo(
            async (linha) => supabase.from("kick_sessions").insert(linha),
            {
              user_id: uid,
              started_at: p.started_at,
              ended_at: p.ended_at,
              kick_count: p.kick_count,
              strength: p.strength,
            },
            "strength",
          );
          return !error;
        },
      });
      setPendentes(await lerFila(chave, ehSessaoPendente));
      return r.ficaram;
    } finally {
      sincronizando.current = false;
    }
  }, [uid]);

  const carregar = useCallback(async () => {
    if (ehBancada()) {
      const est = parametroDaBancada("estado");
      const t = Date.now();
      setEmCurso(sessaoEmCursoDeExemplo(t, est));
      if (est === "falhou") setEstado("falhou");
      else {
        setHistorico(
          sessoesDeExemplo(t).map((s, i) => ({
            ...s,
            id: `exemplo-${i}`,
            strength: i === 1 ? 1 : 2,
          })),
        );
        setEstado("pronto");
      }
      return;
    }
    if (!uid) return;
    const bruto = await lerJson<unknown>(chaveDaSessaoDeChutes(uid), null);
    const s = sanearSessao(bruto, Date.now());
    if (!s && bruto != null) await apagar(chaveDaSessaoDeChutes(uid));
    setEmCurso(s);
    setPendentes(await lerFila(chaveDaFilaDeChutes(uid), ehSessaoPendente));
    await sincronizar();
    await buscar();
  }, [uid, sincronizar, buscar]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  usarRetorno(() => {
    void sincronizar().then((n) => {
      if (n >= 0) void buscar();
    });
  }, pendentes.length > 0);

  function guardar(s: SessaoEmCurso | null) {
    setEmCurso(s);
    if (ehBancada() || !uid) return;
    if (s) void gravarJson(chaveDaSessaoDeChutes(uid), s);
    else void apagar(chaveDaSessaoDeChutes(uid));
  }

  function comecar() {
    setAviso(null);
    guardar({ startedAt: new Date().toISOString(), count: 0, forca: FORCA_PADRAO });
  }

  function somar(delta: number) {
    if (!emCurso) return;
    toque(delta > 0 ? false : true);
    guardar({ ...emCurso, count: Math.max(0, emCurso.count + delta) });
  }

  async function encerrar() {
    if (!emCurso) return;
    const fim = Date.now();
    if (encerrarDescarta(emCurso, fim)) {
      guardar(null);
      setAviso({ texto: "Contagem cancelada. Nada foi guardado.", tom: "neutro" });
      return;
    }
    const pacote = pacoteDaSessao(emCurso, fim, FORCA_PADRAO);
    const resumo = `${pacote.kick_count} ${pacote.kick_count === 1 ? "movimento" : "movimentos"} em ${duracaoFalada((fim - new Date(pacote.started_at).getTime()) / 1000)}`;
    if (ehBancada() || !uid) {
      setHistorico((h) => [{ ...pacote }, ...h]);
      guardar(null);
      setAviso({ texto: `Contagem guardada: ${resumo}.`, tom: "ok" });
      return;
    }
    /* Primeiro o aparelho, depois o banco: sem rede, nada se perde. */
    const chave = chaveDaFilaDeChutes(uid);
    const fila = comPacote(await lerFila(chave, ehSessaoPendente), pacote, Date.now());
    await gravarFila(chave, fila);
    setPendentes(fila);
    guardar(null);
    const ficaram = await sincronizar();
    const aindaAqui = (await lerFila(chave, ehSessaoPendente)).some((p) => p.id === pacote.id);
    setAviso(
      aindaAqui || ficaram === -1
        ? {
            texto: `Contagem guardada no aparelho: ${resumo}. Ela sobe para a sua conta quando a internet voltar.`,
            tom: "aparelho",
          }
        : { texto: `Contagem guardada: ${resumo}.`, tom: "ok" },
    );
    void buscar();
  }

  if (estadoDoPerfil === "carregando") return <Carregando />;
  if (cuidado || perfil?.birth_date) return <Redirect href="/saude" />;

  const minutos = emCurso ? (agora - new Date(emCurso.startedAt).getTime()) / 60000 : 0;
  const alarme = emCurso
    ? sinalMovimentosReduzidos({ semanas, movimentos: emCurso.count, minutos })
    : null;
  const todas = mesclar(historico, pendentes) as Contagem[];
  const serie = serieDeChutes(todas);
  const faixa = faixaPessoal(serie);
  const leitura = leituraDeHoje(serie, faixa);
  const ultima = ultimaContagem(todas);
  const forca = emCurso?.forca ?? FORCA_PADRAO;

  return (
    <Tela>
      <Cabecalho titulo="Movimentos do bebê" arte="chutes" fundo={cor.chutesFundo} />

      {emCurso ? (
        <Cartao fundo={cor.chutesFundo} estilo={{ alignItems: "center", gap: espaco.md }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Senti um movimento. Contados: ${emCurso.count}`}
            onPress={() => somar(1)}
            style={({ pressed }) => ({
              width: 210,
              height: 210,
              borderRadius: 105,
              backgroundColor: pressed ? "#075985" : cor.chutes,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.97 : 1 }],
              shadowColor: cor.chutes,
              shadowOpacity: 0.3,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
            })}
          >
            <Text
              style={{
                fontFamily: fonte.titulo,
                fontSize: 72,
                color: cor.branco,
                fontVariant: ["tabular-nums"],
              }}
            >
              {emCurso.count}
            </Text>
            <Text style={{ fontFamily: fonte.forte, fontSize: 17, color: cor.branco }}>de 10</Text>
          </Pressable>
          <T tipo="apagado" centro>
            Toque no círculo a cada movimento que sentir.
          </T>
          <T tipo="subtitulo" cor={cor.chutes} estilo={{ fontVariant: ["tabular-nums"] }}>
            {relogio(agora - new Date(emCurso.startedAt).getTime())}
          </T>
          {emCurso.count >= 10 && !alarme ? (
            <T centro cor={cor.chutes} estilo={{ fontFamily: fonte.forte }}>
              Chegou a 10. Pode encerrar para guardar.
            </T>
          ) : null}
        </Cartao>
      ) : null}

      {alarme ? (
        <CartaoDeSocorro
          titulo="Menos movimentos que o esperado"
          texto={`Você sentiu ${emCurso!.count} ${emCurso!.count === 1 ? "movimento" : "movimentos"} em 2 horas, e o esperado são 10. Ligue para o 192 ou procure a maternidade agora.`}
          grande
        />
      ) : null}

      {emCurso ? (
        <View style={{ gap: espaco.md }}>
          {!alarme ? (
            <View style={{ gap: espaco.sm }}>
              <T tipo="rotulo">Como estão os movimentos?</T>
              <Escolha
                opcoes={NIVEIS_DE_FORCA.map((n) => ({ valor: n.valor, rotulo: n.rotulo }))}
                valor={forca}
                corAtiva={cor.chutes}
                rotuloAcessivel="Força dos movimentos"
                aoEscolher={(v) => guardar({ ...emCurso, forca: v })}
              />
            </View>
          ) : null}
          <Botao
            rotulo={encerrarDescarta(emCurso, agora) ? "Cancelar contagem" : "Encerrar e guardar"}
            aoTocar={() => void encerrar()}
            corFundo={cor.chutes}
          />
          {emCurso.count > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Contei um a mais — tirar 1"
              onPress={() => somar(-1)}
              style={{
                minHeight: ALVO_MINIMO,
                alignItems: "center",
                justifyContent: "center",
                marginTop: espaco.lg,
              }}
            >
              <Text
                style={{
                  fontFamily: fonte.media,
                  fontSize: 14,
                  color: cor.textoApagado,
                  textDecorationLine: "underline",
                }}
              >
                Contei um a mais — tirar 1
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Cartao fundo={cor.chutesFundo}>
          {fase ? (
            <>
              <T>
                Conte quanto tempo o bebê leva para fazer 10 movimentos. Deitada de lado, no começo
                da noite — para a maioria são uns 20 minutos.
              </T>
              <T tipo="apagado">Valem chutes, socos, rolamentos e cutucadas. Soluços não contam.</T>
              <T tipo="apagado">
                Passadas 2 horas sem chegar a 10, ligue para o 192 ou procure a maternidade.
              </T>
              <Botao rotulo="Começar a contar" aoTocar={comecar} corFundo={cor.chutes} />
            </>
          ) : (
            <>
              <T>
                Você está com {semanas} semanas. Antes da semana {SEMANA_DE_OBSERVAR} é normal não
                sentir o bebê todos os dias nem chegar a 10 — o bebê se mexe muito, mas ainda não dá
                para confiar no que se sente.
              </T>
              <T tipo="apagado">A contagem começa por volta da semana {SEMANA_DE_OBSERVAR}.</T>
              <Botao rotulo="Contar mesmo assim" tipo="secundario" aoTocar={comecar} />
            </>
          )}
        </Cartao>
      )}

      {aviso ? (
        <Cartao
          fundo={
            aviso.tom === "aparelho"
              ? cor.atencaoFundo
              : aviso.tom === "ok"
                ? cor.chutesFundo
                : cor.apagado
          }
        >
          <T tipo="rotulo" cor={aviso.tom === "aparelho" ? cor.atencao : cor.texto}>
            {aviso.texto}
          </T>
        </Cartao>
      ) : null}

      {estado === "carregando" ? <Carregando texto="Lendo suas contagens…" /> : null}
      {estado === "falhou" ? (
        <NaoConsegueLer
          sossego="A contagem funciona mesmo assim, e o que você contar fica guardado no aparelho até subir."
          aoTentar={() => {
            setEstado("carregando");
            void buscar();
          }}
        />
      ) : null}

      {estado === "pronto" && ultima ? (
        <Cartao>
          <T tipo="subtitulo">A última contagem</T>
          <T>
            {ultima.estado === "completa"
              ? `10 movimentos em ${numeroBR(ultima.minutos, 0)} min — ${quandoFoi(ultima.em, Date.now())}.`
              : ultima.estado === "incompleta"
                ? `${ultima.movimentos} ${ultima.movimentos === 1 ? "movimento" : "movimentos"}, sem chegar a 10 — ${quandoFoi(ultima.em, Date.now())}.`
                : `${quandoFoi(ultima.em, Date.now())}, sem uma duração que dê para usar.`}
          </T>
          {faixa ? (
            <T tipo="apagado">
              O seu normal: de {numeroBR(faixa.de, 0)} a {numeroBR(faixa.ate, 0)} min até 10
              movimentos, nas últimas {faixa.sessoes} contagens.
              {ultima.estado === "completa"
                ? leitura === "dentro"
                  ? " A última ficou dentro dele."
                  : leitura === "acima"
                    ? " A última levou mais tempo que o seu normal."
                    : leitura === "abaixo"
                      ? " A última foi mais rápida que o seu normal."
                      : ""
                : ""}
            </T>
          ) : (
            <T tipo="apagado">
              Com {MINIMO_PARA_FAIXA} contagens completas, eu mostro o seu normal.
            </T>
          )}
          <T tipo="apagado">
            Se você sentir o bebê diferente do que costuma, não espere um número: ligue para o 192
            ou procure a maternidade.
          </T>
          {serie.length >= 2 ? (
            <View style={{ gap: espaco.xs, marginTop: espaco.sm }}>
              <T tipo="rotulo">Minutos até 10 movimentos</T>
              <GraficoDeLinha
                pontos={serie.slice(-14).map((p) => ({
                  rotulo: quandoFoi(p.em, Date.now()).replace(/ às .*/, ""),
                  valor: p.valor,
                  gravidade: "normal",
                }))}
                corDaSerie={cor.chutes}
                rotuloAcessivel={`Gráfico do tempo até 10 movimentos nas últimas ${Math.min(14, serie.length)} contagens`}
              />
              <T tipo="apagado">{FRASE_DA_LINHA_PLANA}</T>
            </View>
          ) : null}
        </Cartao>
      ) : null}

      {estado === "pronto" && todas.length ? (
        <View style={{ gap: espaco.sm }}>
          <T tipo="subtitulo">Contagens</T>
          {todas.slice(0, 8).map((s) => {
            const f = nivelDeForca(s.strength ?? null);
            const dur =
              s.ended_at != null
                ? duracaoFalada(
                    (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000,
                  )
                : "sem fim";
            return (
              <View
                key={s.id}
                style={{
                  backgroundColor: cor.cartao,
                  borderRadius: raio.md,
                  borderWidth: 1,
                  borderColor: cor.borda,
                  padding: espaco.md,
                  gap: 4,
                }}
              >
                <Linha estilo={{ justifyContent: "space-between" }}>
                  <T tipo="rotulo">{quandoFoi(s.started_at, Date.now())}</T>
                  <T tipo="apagado">{dur}</T>
                </Linha>
                <Linha estilo={{ flexWrap: "wrap" }}>
                  <T>
                    {s.kick_count} {s.kick_count === 1 ? "movimento" : "movimentos"}
                  </T>
                  {f?.chip ? (
                    <Pilula texto={f.chip} fundo={cor.chutesFundo} corTexto={cor.chutes} />
                  ) : null}
                  {ehLocal(s.id) ? (
                    <Pilula texto="no aparelho" fundo={cor.atencaoFundo} corTexto={cor.atencao} />
                  ) : null}
                </Linha>
              </View>
            );
          })}
        </View>
      ) : null}
    </Tela>
  );
}
