import { comPacote, ehLocal, mesclar } from "@/lib/fila-local";
import { FORCA_PADRAO, NIVEIS_DE_FORCA, nivelDeForca } from "@/lib/forca-do-movimento";
import type { SessaoDeChutes } from "@/lib/serie-de-chutes";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { CloudOff, Minus, Phone } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { Grupo, Ladrilho, Seta } from "~/componentes/ajustes";
import {
  Botao,
  Carregando,
  NaoConsegueLer,
  TituloDaSecao,
  toque,
} from "~/componentes/base";
import { BotaoDeVidro, TelaDaPilha } from "~/componentes/cabecalho";
import { useAviso } from "~/componentes/comunidade/folha";
import { useMovimentoReduzido } from "~/componentes/movimento";
import { ARTES, Escolha } from "~/componentes/saude/pecas";
import { apagar, gravarJson, lerJson } from "~/lib/armazem";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { clarear, comAlfa, escurecer } from "~/lib/cor";
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
import { cor, escala, espaco, fonte, fonteDoNumero, margem } from "~/tema";
import { pedirSocorro, ROTULO_DO_SOCORRO } from "~/lib/socorro";

type Contagem = SessaoDeChutes & { id: string; strength?: number | null };

/**
 * OS MOVIMENTOS DO BEBÊ — acompanhar o bebê, e não protocolo.
 *
 * ⚠️ 21/10/2026, decisão do dono (rede social + gamificação, não conselho
 * médico): saíram a meta de 10, o alarme das 2 horas, "o seu normal" e o
 * gráfico do tempo até 10. Ela conta quando quiser, pelo tempo que quiser, e
 * o histórico fica. O que o app diz sobre um bebê diferente é uma linha fixa
 * que abre o SOS — o único lugar com sinais de alerta.
 *
 * 18/11/2026 (a vistoria: "o círculo, que é a alma dela, só aparece depois de
 * Começar"): o círculo está SEMPRE na tela. Parado, mostra os pés e
 * "Começar"; tocado, vira o contador ali mesmo, e cada toque dá uma mola. O
 * relógio da contagem mora num componente só (`Cronometro`), para o segundo
 * que passa não redesenhar a tela inteira.
 *
 * Bancada: /saude/chutes?bancada=1 [&estado=contando|falhou]
 */
export default function Chutes() {
  const { sessao, perfil, cuidado, estadoDoPerfil } = useSessao();
  const uid = sessao?.user.id ?? null;

  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const [historico, setHistorico] = useState<Contagem[]>([]);
  const [pendentes, setPendentes] = useState<SessaoPendente[]>([]);
  const [emCurso, setEmCurso] = useState<SessaoEmCurso | null>(null);
  const sincronizando = useRef(false);
  const aviso = useAviso();
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
      aviso.mostrar("Contagem cancelada. Nada foi guardado.");
      return;
    }
    const pacote = pacoteDaSessao(emCurso, fim, FORCA_PADRAO);
    const resumo = `${pacote.kick_count} ${pacote.kick_count === 1 ? "movimento" : "movimentos"} em ${duracaoFalada((fim - new Date(pacote.started_at).getTime()) / 1000)}`;
    if (ehBancada() || !uid) {
      setHistorico((h) => [{ ...pacote }, ...h]);
      guardar(null);
      aviso.mostrar(`Contagem guardada: ${resumo}.`);
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
    if (aindaAqui || ficaram === -1)
      aviso.mostrar(
        `Guardada no aparelho: ${resumo}. Ela sobe para a sua conta quando a internet voltar.`,
        true,
      );
    else aviso.mostrar(`Contagem guardada: ${resumo}.`);
    void buscar();
  }

  const todas = useMemo(() => mesclar(historico, pendentes) as Contagem[], [historico, pendentes]);

  if (estadoDoPerfil === "carregando")
    return (
      <TelaDaPilha titulo="Movimentos do bebê" voltarPara="/inicio">
        <Carregando />
      </TelaDaPilha>
    );
  if (cuidado || perfil?.birth_date) return <Redirect href="/inicio" />;

  const forca = emCurso?.forca ?? FORCA_PADRAO;

  return (
    <TelaDaPilha titulo="Movimentos do bebê" voltarPara="/inicio" sobre={aviso.elemento}>
      <View style={{ alignItems: "center", gap: espaco.md, paddingTop: espaco.sm }}>
        <Circulo
          contagem={emCurso?.count ?? null}
          aoComecar={comecar}
          aoSomar={() => somar(1)}
        />
        {emCurso ? (
          <>
            <Text
              style={{
                ...fonte.normal,
                ...escala.legenda,
                color: cor.textoCorpo,
                textAlign: "center",
              }}
            >
              Toque no círculo a cada movimento que sentir.
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.lg }}>
              <BotaoDeVidro
                rotulo="Contei um a mais. Tirar 1"
                desabilitado={emCurso.count === 0}
                aoTocar={() => somar(-1)}
              >
                <Minus size={20} strokeWidth={2.4} color={cor.texto} />
              </BotaoDeVidro>
              <Cronometro inicio={emCurso.startedAt} />
              <View style={{ width: 44 }} />
            </View>
          </>
        ) : (
          <View style={{ gap: espaco.xs, paddingHorizontal: espaco.lg }}>
            <Text
              style={{
                ...fonte.normal,
                ...escala.corpo,
                color: cor.textoCorpo,
                textAlign: "center",
              }}
            >
              Conte as mexidinhas quando quiser, pelo tempo que quiser.
            </Text>
            <Text
              style={{
                ...fonte.normal,
                ...escala.legenda,
                color: cor.textoApagado,
                textAlign: "center",
              }}
            >
              Valem chutes, socos, rolamentos e cutucadas. Soluços não contam.
            </Text>
          </View>
        )}
      </View>

      {emCurso ? (
        <View style={{ gap: espaco.md }}>
          <View style={{ gap: espaco.sm }}>
            <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
              Como estão os movimentos?
            </Text>
            <Escolha
              opcoes={NIVEIS_DE_FORCA.map((n) => ({ valor: n.valor, rotulo: n.rotulo }))}
              valor={forca}
              corAtiva={cor.chutes}
              rotuloAcessivel="Força dos movimentos"
              aoEscolher={(v) => guardar({ ...emCurso, forca: v })}
            />
          </View>
          <BotaoEncerrar emCurso={emCurso} aoTocar={() => void encerrar()} />
        </View>
      ) : null}

      <LinhaDoSos />

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
          <TituloDaSecao>Contagens</TituloDaSecao>
          <Historico todas={todas} />
        </View>
      ) : null}
    </TelaDaPilha>
  );
}

const DEGRADE_DO_CIRCULO = [
  clarear(cor.chutes, 0.24),
  cor.chutes,
  escurecer(cor.chutes, 0.12),
] as const;
const TAMANHO_DO_CIRCULO = 220;

/**
 * O CÍRCULO, sempre presente. Parado: os pés e "Começar". Contando: o número,
 * e cada toque dá uma mola (1 → 1,06 → 1, no fio nativo; parada com "reduzir
 * movimento").
 */
function Circulo({
  contagem,
  aoComecar,
  aoSomar,
}: {
  contagem: number | null;
  aoComecar: () => void;
  aoSomar: () => void;
}) {
  const escala_ = useRef(new Animated.Value(1)).current;
  const reduzido = useMovimentoReduzido();
  const contando = contagem != null;

  function afundar() {
    if (reduzido) return;
    Animated.spring(escala_, {
      toValue: 0.96,
      speed: 50,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  }
  function soltar() {
    if (reduzido) return;
    Animated.sequence([
      Animated.spring(escala_, { toValue: 1.06, speed: 40, bounciness: 0, useNativeDriver: true }),
      Animated.spring(escala_, { toValue: 1, speed: 18, bounciness: 10, useNativeDriver: true }),
    ]).start();
  }

  return (
    <View
      style={{
        width: TAMANHO_DO_CIRCULO + 32,
        height: TAMANHO_DO_CIRCULO + 32,
        borderRadius: (TAMANHO_DO_CIRCULO + 32) / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: comAlfa(cor.chutes, 0.1),
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          contando ? `Senti um movimento. Contados: ${contagem}` : "Começar a contar os movimentos"
        }
        onPressIn={afundar}
        onPressOut={soltar}
        onPress={contando ? aoSomar : () => {
          toque();
          aoComecar();
        }}
      >
        <Animated.View
          style={{
            width: TAMANHO_DO_CIRCULO,
            height: TAMANHO_DO_CIRCULO,
            borderRadius: TAMANHO_DO_CIRCULO / 2,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0px 18px 36px -14px ${comAlfa(cor.chutes, 0.7)}`,
            transform: [{ scale: escala_ }],
          }}
        >
          <LinearGradient
            colors={DEGRADE_DO_CIRCULO}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
          {contando ? (
            <>
              <Text
                style={{
                  ...fonteDoNumero,
                  fontSize: 76,
                  lineHeight: 84,
                  color: cor.branco,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {contagem}
              </Text>
              <Text style={{ ...fonte.media, ...escala.legenda, color: comAlfa(cor.branco, 0.86) }}>
                {contagem === 1 ? "movimento" : "movimentos"}
              </Text>
            </>
          ) : (
            <>
              <Image
                source={ARTES.chutes}
                style={{ width: 96, height: 96 }}
                contentFit="contain"
                accessible={false}
              />
              <Text style={{ ...fonte.forte, ...escala.titulo3, color: cor.branco, marginTop: 4 }}>
                Começar
              </Text>
            </>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** O relógio da contagem: o ÚNICO dono do segundo que passa. */
function Cronometro({ inicio }: { inicio: string }) {
  const agora = usarRelogio(true);
  const t = relogio(agora - new Date(inicio).getTime());
  return (
    <Text
      accessibilityLabel={`Tempo de contagem: ${t}`}
      style={{
        minWidth: 110,
        textAlign: "center",
        ...fonteDoNumero,
        ...escala.titulo2,
        color: cor.texto,
        fontVariant: ["tabular-nums"],
      }}
    >
      {t}
    </Text>
  );
}

/**
 * "Cancelar contagem" enquanto nada foi contado (e por pouco tempo), e
 * "Encerrar e guardar" depois. Sem relógio por segundo: confere de minuto em
 * minuto, só enquanto o rótulo ainda pode mudar sozinho.
 */
function BotaoEncerrar({ emCurso, aoTocar }: { emCurso: SessaoEmCurso; aoTocar: () => void }) {
  const [, conferir] = useState(0);
  const descarta = encerrarDescarta(emCurso, Date.now());
  useEffect(() => {
    if (!descarta) return;
    const t = setTimeout(() => conferir((n) => n + 1), 60_000);
    return () => clearTimeout(t);
  });
  return (
    <Botao
      rotulo={descarta ? "Cancelar contagem" : "Encerrar e guardar"}
      tipo={descarta ? "secundario" : "primario"}
      aoTocar={aoTocar}
    />
  );
}

const maiuscula = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** As últimas contagens, num grupo só. Só se redesenha quando a lista muda. */
const Historico = memo(function Historico({ todas }: { todas: readonly Contagem[] }) {
  const agora = Date.now();
  return (
    <Grupo recuo={margem.tela + 44 + espaco.md}>
      {todas.slice(0, 8).map((s) => {
        const f = nivelDeForca(s.strength ?? null);
        const dur =
          s.ended_at != null
            ? duracaoFalada(
                (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000,
              )
            : "sem fim";
        const local = ehLocal(s.id);
        return (
          <View
            key={s.id}
            accessible
            accessibilityLabel={`${s.kick_count} ${s.kick_count === 1 ? "movimento" : "movimentos"}, ${quandoFoi(s.started_at, agora)}, ${dur}${f?.chip ? `, ${f.chip}` : ""}${local ? ", guardada no aparelho" : ""}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.md,
              minHeight: 56,
              paddingHorizontal: margem.tela,
              paddingVertical: espaco.sm,
            }}
          >
            <Text
              style={{
                width: 44,
                textAlign: "center",
                ...fonteDoNumero,
                ...escala.titulo2,
                color: cor.chutes,
                fontVariant: ["tabular-nums"],
              }}
            >
              {s.kick_count}
            </Text>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
                {s.kick_count === 1 ? "movimento" : "movimentos"}
              </Text>
              <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
                {maiuscula(quandoFoi(s.started_at, agora))}
                {f?.chip ? ` · ${f.chip}` : ""}
              </Text>
            </View>
            {local ? <CloudOff size={15} strokeWidth={2.2} color={cor.atencao} /> : null}
            <Text
              style={{
                ...fonte.normal,
                ...escala.legenda,
                color: cor.textoApagado,
                fontVariant: ["tabular-nums"],
              }}
            >
              {dur}
            </Text>
          </View>
        );
      })}
    </Grupo>
  );
});

/**
 * A LINHA FIXA: o que o app diz a quem sente o bebê diferente. Sem número, sem
 * régua — abre o SOS, onde moram os sinais de alerta e o socorro; com o SOS
 * desligado, liga para o 192 (`lib/socorro.ts`).
 */
function LinhaDoSos() {
  return (
    <Grupo>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sentiu o bebê diferente? ${ROTULO_DO_SOCORRO}`}
        onPress={() => {
          toque();
          pedirSocorro();
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          minHeight: 60,
          paddingHorizontal: margem.tela,
          paddingVertical: espaco.sm + 2,
          backgroundColor: pressed ? cor.apagado : "transparent",
        })}
      >
        <Ladrilho Icone={Phone} tinta={cor.urgente} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.texto }}>
            Sentiu o bebê diferente?
          </Text>
          <Text
            numberOfLines={1}
            style={{ ...fonte.forte, ...escala.legenda, color: cor.urgente }}
          >
            {ROTULO_DO_SOCORRO}
          </Text>
        </View>
        <Seta />
      </Pressable>
    </Grupo>
  );
}
