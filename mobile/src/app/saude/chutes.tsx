import { comPacote, ehLocal, mesclar } from "@/lib/fila-local";
import { FORCA_PADRAO, NIVEIS_DE_FORCA, nivelDeForca } from "@/lib/forca-do-movimento";
import type { SessaoDeChutes } from "@/lib/serie-de-chutes";
import { Redirect, router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
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
import { Cabecalho, Escolha } from "~/componentes/saude/pecas";
import { apagar, gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
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
import { duracaoFalada, quandoFoi, relogio } from "~/lib/saude/formato";
import { usarRelogio, usarRetorno, usarTelaAcesa } from "~/lib/saude/usar-retorno";
import { useSessao } from "~/lib/sessao";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

type Contagem = SessaoDeChutes & { id: string; strength?: number | null };
type Aviso = { texto: string; tom: "ok" | "aparelho" | "neutro" } | null;

/**
 * OS MOVIMENTOS DO BEBÊ — acompanhar o bebê, e não protocolo.
 *
 * ⚠️ 21/10/2026, decisão do dono (rede social + gamificação, não conselho
 * médico): saíram a meta de 10, o alarme das 2 horas, "o seu normal" e o
 * gráfico do tempo até 10. Ela conta quando quiser, pelo tempo que quiser, e
 * o histórico fica. O que o app diz sobre um bebê diferente é uma linha fixa
 * que abre o SOS — o único lugar com sinais de alerta.
 */
export default function Chutes() {
  const { sessao, perfil, cuidado, estadoDoPerfil } = useSessao();
  const uid = sessao?.user.id ?? null;

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

  if (estadoDoPerfil === "carregando")
    return (
      <Tela>
        <Carregando />
      </Tela>
    );
  if (cuidado || perfil?.birth_date) return <Redirect href="/saude" />;

  const todas = mesclar(historico, pendentes) as Contagem[];
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
          </Pressable>
          <T tipo="apagado" centro>
            Toque no círculo a cada movimento que sentir.
          </T>
          <T tipo="subtitulo" cor={cor.chutes} estilo={{ fontVariant: ["tabular-nums"] }}>
            {relogio(agora - new Date(emCurso.startedAt).getTime())}
          </T>
        </Cartao>
      ) : null}

      {emCurso ? (
        <View style={{ gap: espaco.md }}>
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
          <T>Conte as mexidinhas do bebê quando quiser, pelo tempo que quiser.</T>
          <T tipo="apagado">Valem chutes, socos, rolamentos e cutucadas. Soluços não contam.</T>
          <Botao rotulo="Começar a contar" aoTocar={comecar} corFundo={cor.chutes} />
        </Cartao>
      )}

      <LinhaDoSos />

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

/**
 * A LINHA FIXA: o que o app diz a quem sente o bebê diferente. Sem número, sem
 * régua — abre o SOS, onde moram os sinais de alerta e o socorro.
 */
function LinhaDoSos() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sentiu o bebê diferente? Abra o SOS"
      onPress={() => {
        toque();
        router.push("/sos");
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.sm,
        minHeight: ALVO_MINIMO + 4,
        paddingHorizontal: espaco.lg,
        borderRadius: raio.md,
        borderWidth: 1,
        borderColor: cor.urgenteBorda,
        backgroundColor: cor.cartao,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 15, color: cor.texto }}>
        Sentiu o bebê diferente?{" "}
        <Text style={{ fontFamily: fonte.forte, color: cor.urgente }}>Abra o SOS</Text>
      </Text>
      <ChevronRight size={20} color={cor.urgente} />
    </Pressable>
  );
}
