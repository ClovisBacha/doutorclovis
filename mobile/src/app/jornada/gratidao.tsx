import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { periodoDaHora } from "@/lib/frases-do-mascote";
import {
  cartaAcabouDeNascer,
  ehDiaDificil,
  ehDomingoDeResumo,
  falaDaBolha,
  gratidaoParaReler,
  gratidoesDaSemana,
  haQuantoTempo,
  HUMOR_GRATIDAO,
  marcoAtingido,
  MINIMO_PARA_CARTA,
  perguntaDoDia,
  PREFIXO_GRATIDAO,
  textoDaGratidao,
  type Gratidao,
} from "@/lib/gratidao";
import { paraLike } from "@/lib/like-seguro";
import { Botao, Cartao, Carregando, T, Tela, toque } from "~/componentes/base";
import {
  BolhaComBalao,
  FundoDaAtividade,
  type PaletaDaAtividade,
} from "~/componentes/jornada/atividade";
import { corGratidao } from "~/componentes/jornada/cores";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { BarraDoTopo } from "~/componentes/jornada/pecas";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * GRATIDÃO — o `GratitudeBlock` do app antigo: a pergunta do dia (por fase, e
 * de outro tom no dia difícil), fichinhas de um toque para os dias em que
 * escrever é demais, a lista de tudo o que ela guardou, o resumo de domingo, a
 * releitura de algo de semanas atrás, a festa do número redondo e — na oitava
 * — o aviso de que já dá para fazer uma carta pro bebê.
 *
 * Grava em `journal_entries` com o MESMO formato do site ("Gratidão: …", 🙏),
 * então o diário mostra o que ela escreveu aqui. Escrita que falhou NUNCA vira
 * "guardado": o texto fica na tela para tentar de novo.
 *
 * Bancada: /jornada/gratidao?bancada=1 [&etapa=guardado|lista|resumo|feita|erro]
 *          [&marco=25] [&carta=1] [&dificil=1] [&luto=1]
 */

const PALETA: PaletaDaAtividade = {
  fundo: [corGratidao.fundoTopo, corGratidao.fundoMeio, corGratidao.fundoBase],
  forte: corGratidao.forte,
  titulo: corGratidao.titulo,
  secao: corGratidao.secao,
  borda: corGratidao.borda,
  vidro: corGratidao.vidro,
  discreto: corGratidao.discreto,
  brancoSuave: corGratidao.brancoSuave,
};

/** O limite do site: uma coisa boa, não um diário inteiro. */
const LIMITE = 300;

type Etapa = "escrever" | "lista" | "resumo" | "guardado";

function diaDoAno(d: Date): number {
  return Math.floor(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) /
      86_400_000,
  );
}

/* As gratidões de exemplo da bancada (as datas contam para trás a partir de hoje). */
function exemplosDaBancada(): Gratidao[] {
  const dias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  return [
    { texto: "O Rafael fez um chá e ficou comigo no sofá.", quando: dias(1) },
    { texto: "Senti o bebê mexer no meio da reunião.", quando: dias(3) },
    { texto: "A consulta foi tranquila e o coração está forte.", quando: dias(5) },
    { texto: "Consegui dormir a tarde inteira.", quando: dias(26) },
    { texto: "Minha mãe veio almoçar e trouxe bolo de fubá.", quando: dias(40) },
  ];
}

export default function GratidaoTela() {
  const at = useAtividade("gratitude");
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("escrever");
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  /* `null` = não conseguimos ler (a escrita continua: ler nunca impede de registrar). */
  const [gratidoes, setGratidoes] = useState<Gratidao[] | null>(null);
  const [total, setTotal] = useState(0);
  const [diaDificil, setDiaDificil] = useState(false);
  const [marco, setMarco] = useState<number | null>(null);
  const [cartaNova, setCartaNova] = useState(false);
  const [favorita, setFavorita] = useState<string | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);

  const pergunta = useMemo(
    () =>
      perguntaDoDia({
        dia: at.D ?? diaDoAno(new Date()),
        semanas: at.semana,
        posParto: at.pos,
        careMode: at.cuidado,
        diaDificil,
      }),
    [at.D, at.semana, at.pos, at.cuidado, diaDificil],
  );
  const periodo = useMemo(() => periodoDaHora(new Date().getHours()), []);

  /* O que ela já guardou (a lista, o contador que só sobe) e os humores de
     hoje: num dia difícil a pergunta muda de tom inteiro. */
  useEffect(() => {
    if (!at.uid || !at.pronto) return;
    if (ehBancada()) return;
    let vivo = true;
    void (async () => {
      const meiaNoite = new Date();
      meiaNoite.setHours(0, 0, 0, 0);
      const [minhas, hoje] = await Promise.all([
        supabase
          .from("journal_entries")
          .select("content, created_at", { count: "exact" })
          .eq("user_id", at.uid)
          .ilike("content", `${paraLike(PREFIXO_GRATIDAO)}%`)
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("journal_entries")
          .select("mood")
          .eq("user_id", at.uid)
          .gte("created_at", meiaNoite.toISOString())
          .limit(30),
      ]);
      if (!vivo) return;
      if (!minhas.error && minhas.data) {
        const lidas = (minhas.data as { content: string; created_at: string }[]).map((r) => ({
          texto: textoDaGratidao(r.content),
          quando: r.created_at,
        }));
        setGratidoes(lidas);
        setTotal(minhas.count ?? lidas.length);
        /* O resumo de domingo entra ANTES de escrever, e só para quem ainda não
           escreveu hoje — quem já registrou não é interrompida na volta. */
        if (!at.jaFeita && ehDomingoDeResumo(new Date(), gratidoesDaSemana(lidas, new Date())))
          setEtapa("resumo");
      }
      if (!hoje.error && hoje.data) {
        setDiaDificil(ehDiaDificil((hoje.data as { mood: string | null }[]).map((h) => h.mood)));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [at.uid, at.pronto, at.jaFeita]);

  useEffect(() => {
    if (aplicouBancada || !at.pronto || !ehBancada()) return;
    setAplicouBancada(true);
    const lista = exemplosDaBancada();
    const t = Number(parametroDaBancada("total") ?? 23) || 23;
    setGratidoes(lista);
    setTotal(t);
    if (parametroDaBancada("dificil") === "1") setDiaDificil(true);
    const e = parametroDaBancada("etapa");
    if (e === "lista" || e === "resumo") setEtapa(e);
    if (e === "guardado") {
      const m = Number(parametroDaBancada("marco") ?? 0) || null;
      setTexto("A consulta de hoje foi tranquila.");
      setMarco(at.cuidado ? null : m);
      setTotal(m ?? t);
      setCartaNova(!at.cuidado && parametroDaBancada("carta") === "1");
      setEtapa("guardado");
      setDesfecho({
        ganhou: at.cuidado || at.pos ? null : 5,
        fechou: false,
        bonus: null,
        semPagamento: at.cuidado || at.pos,
      });
    }
    if (e === "erro") {
      setTexto("A consulta de hoje foi tranquila.");
      setErro(true);
    }
  }, [at.pronto, at.cuidado, at.pos, aplicouBancada]);

  async function guardar() {
    const t = texto.trim();
    if (t.length < 2 || !at.uid || salvando) return;
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
    /* O número sobe no mesmo instante em que ela guarda: recarregar para ver o
       próprio registro entrar é a espera que faz o número parecer quebrado. */
    const nova = { texto: t, quando: new Date().toISOString() };
    setGratidoes((antes) => [nova, ...(antes ?? [])]);
    const novoTotal = total + 1;
    setTotal(novoTotal);
    const m = at.cuidado ? null : marcoAtingido(novoTotal);
    setMarco(m);
    if (m && Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setCartaNova(!at.cuidado && cartaAcabouDeNascer(novoTotal));
    setSalvando(false);
    setEtapa("guardado");
    setDesfecho(
      await concluirMomento({
        uid: at.uid,
        D: at.D,
        momento: "gratitude",
        cuidado: at.cuidado,
        pos: at.pos,
      }),
    );
  }

  if (!at.pronto) {
    return (
      <Tela bordas={["top", "bottom"]}>
        <Carregando />
      </Tela>
    );
  }

  const irParaCarta = () => router.push({ pathname: "/jornada/bebe", params: { delas: "1" } });
  /* A carta mora no Momento com o bebê, que não existe no Modo Cuidado. */
  const temCarta = !at.cuidado && total >= MINIMO_PARA_CARTA;

  if (etapa === "guardado") {
    /* A releitura usa o total como semente, como no site: cada nova guardada
       traz outra lembrança. Nunca a de hoje nem a de ontem — isso é eco. */
    const releitura = gratidoes ? gratidaoParaReler(gratidoes, new Date(), total) : null;
    const frase = falaDaBolha({ tela: "guardado", total, marco, temReleitura: !!releitura });
    return (
      <FundoDaAtividade paleta={PALETA}>
        <ScrollView
          contentContainerStyle={{ padding: espaco.lg, paddingBottom: 120, gap: espaco.md }}
        >
          <FimDoMomento
            titulo="Guardei 💛"
            /* O confete GRANDE só no número redondo — no dia comum, a estrela. */
            confete={marco ? "grande" : false}
            fala={frase.replace(/^Guardei 💛\s*/, "")}
            desfecho={desfecho}
            D={at.D}
            cuidado={at.cuidado}
            pos={at.pos}
            extra={
              <View style={{ alignItems: "center", gap: espaco.md }}>
                {/* O NÚMERO GRANDE — só no marco: nos dias comuns o contador já
                    está na fala, e repeti-lo em fonte gigante seria ruído. */}
                {marco ? (
                  <Text
                    accessibilityLabel={`${marco} coisas boas`}
                    style={{
                      fontFamily: fonte.titulo,
                      fontSize: 60,
                      lineHeight: 66,
                      color: corGratidao.marco,
                    }}
                  >
                    {marco}
                  </Text>
                ) : null}
                {releitura ? (
                  <View
                    style={{
                      width: "100%",
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: corGratidao.borda,
                      backgroundColor: corGratidao.vidroForte,
                      paddingHorizontal: espaco.lg,
                      paddingVertical: espaco.md,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonte.normal,
                        fontSize: 15,
                        lineHeight: 21,
                        color: corGratidao.titulo,
                      }}
                    >
                      “{releitura.texto}”
                    </Text>
                    <Text style={estiloDoQuando}>
                      {haQuantoTempo(releitura.quando, new Date())}
                    </Text>
                  </View>
                ) : null}
                {/* A carta deixou de ficar escondida: o aviso aparece UMA vez, na
                    oitava, na cor rosa de quem recebe a visita. */}
                {cartaNova && !at.cuidado ? (
                  <View
                    style={{
                      width: "100%",
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: corGratidao.cartaBorda,
                      backgroundColor: corGratidao.cartaFundo,
                      paddingHorizontal: espaco.lg,
                      paddingVertical: espaco.md,
                      gap: 10,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        fontFamily: fonte.normal,
                        fontSize: 14,
                        lineHeight: 19,
                        color: corGratidao.cartaTexto,
                      }}
                    >
                      Agora já dá pra fazer uma carta pro bebê com tudo isso que você me contou.
                    </Text>
                    <Botao
                      rotulo="Ver carta 💌"
                      corFundo={corGratidao.cartaBotao}
                      aoTocar={irParaCarta}
                    />
                  </View>
                ) : null}
                {total > 1 ? <Link texto="Ver todas" aoTocar={() => setEtapa("lista")} /> : null}
                {/* Fora do instante da oitava, a carta não pode depender de estar
                    bem naquele dia: o link fica, sem duplicar o anúncio acima. */}
                {!cartaNova && temCarta ? (
                  <Link
                    texto="💌 Ver a carta pro bebê"
                    tinta={corGratidao.cartaLink}
                    sublinhado={corGratidao.cartaSublinhado}
                    aoTocar={irParaCarta}
                  />
                ) : null}
              </View>
            }
          />
        </ScrollView>
      </FundoDaAtividade>
    );
  }

  if (etapa === "lista") {
    return (
      <FundoDaAtividade paleta={PALETA}>
        <View style={{ paddingHorizontal: espaco.lg }}>
          <BarraDoTopo aoSair={() => setEtapa("escrever")} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: espaco.xl, paddingBottom: 40 }}>
          <Text
            accessibilityRole="header"
            style={{
              textAlign: "center",
              fontFamily: fonte.media,
              fontSize: 24,
              lineHeight: 30,
              color: corGratidao.titulo,
            }}
          >
            Suas coisas boas
          </Text>
          <Text
            style={{
              marginTop: 4,
              textAlign: "center",
              fontFamily: fonte.normal,
              fontSize: 13,
              color: corGratidao.texto,
            }}
          >
            {total} {total === 1 ? "guardada" : "guardadas"} até aqui 💛
          </Text>
          <View style={{ marginTop: 20, gap: espaco.sm }}>
            {(gratidoes ?? []).map((g) => (
              <View
                key={`${g.quando}-${g.texto.slice(0, 12)}`}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: corGratidao.bordaSuave,
                  backgroundColor: corGratidao.vidroForte,
                  paddingHorizontal: espaco.lg,
                  paddingVertical: espaco.md,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonte.normal,
                    fontSize: 14,
                    lineHeight: 19,
                    color: corGratidao.titulo,
                  }}
                >
                  {g.texto}
                </Text>
                <Text style={estiloDoQuando}>{haQuantoTempo(g.quando, new Date())}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: espaco.xl }}>
            <Botao
              rotulo="Escrever uma nova"
              corFundo={corGratidao.forte}
              aoTocar={() => setEtapa("escrever")}
            />
          </View>
        </ScrollView>
      </FundoDaAtividade>
    );
  }

  if (etapa === "resumo") {
    const semana = gratidoesDaSemana(gratidoes ?? [], new Date());
    return (
      <FundoDaAtividade paleta={PALETA}>
        <View style={{ paddingHorizontal: espaco.lg }}>
          <BarraDoTopo />
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: espaco.xl,
            paddingBottom: 40,
            alignItems: "center",
          }}
        >
          <BolhaComBalao
            humor="feliz"
            fala={falaDaBolha({ tela: "resumo", total: semana.length })}
          />
          <Text
            accessibilityRole="header"
            style={{
              marginTop: espaco.lg,
              textAlign: "center",
              fontFamily: fonte.titulo,
              fontSize: 24,
              lineHeight: 30,
              color: corGratidao.titulo,
            }}
          >
            Antes de escrever, olha a sua semana
          </Text>
          <Text
            style={{
              marginTop: espaco.sm,
              maxWidth: 320,
              textAlign: "center",
              fontFamily: fonte.normal,
              fontSize: 14,
              lineHeight: 20,
              color: corGratidao.texto,
            }}
          >
            Não precisa escolher nada — é só pra reler. 💛
          </Text>
          <View style={{ marginTop: 20, width: "100%", gap: espaco.sm }}>
            {semana.map((g) => {
              const escolhida = favorita === g.texto;
              return (
                <Pressable
                  key={`${g.quando}-${g.texto.slice(0, 12)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: escolhida }}
                  onPress={() => {
                    toque();
                    setFavorita(g.texto);
                  }}
                  style={({ pressed }) => ({
                    minHeight: ALVO_MINIMO,
                    justifyContent: "center",
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: escolhida ? corGratidao.escolhidaBorda : corGratidao.borda,
                    backgroundColor: escolhida
                      ? corGratidao.escolhidaFundo
                      : corGratidao.vidroForte,
                    paddingHorizontal: espaco.lg,
                    paddingVertical: espaco.md,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: fonte.normal,
                      fontSize: 14,
                      lineHeight: 19,
                      color: corGratidao.titulo,
                    }}
                  >
                    {g.texto}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {favorita ? (
            <Text
              style={{
                marginTop: espaco.md,
                fontFamily: fonte.titulo,
                fontSize: 13,
                color: corGratidao.forte,
              }}
            >
              Boa escolha 💛
            </Text>
          ) : null}
          <View style={{ marginTop: espaco.xl, width: "100%" }}>
            <Botao
              rotulo={at.jaFeita ? "Fechar" : "Escrever a de hoje"}
              corFundo={corGratidao.forte}
              aoTocar={() => (at.jaFeita ? router.back() : setEtapa("escrever"))}
            />
          </View>
        </ScrollView>
      </FundoDaAtividade>
    );
  }

  const fala = at.jaFeita
    ? "Você já me contou uma coisa boa hoje. Se quiser, conta outra — eu guardo também."
    : falaDaBolha({ tela: "escrever", total, diaDificil, periodo });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FundoDaAtividade paleta={PALETA}>
        <View style={{ paddingHorizontal: espaco.lg }}>
          <BarraDoTopo />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: espaco.xl,
            paddingBottom: 40,
            alignItems: "center",
          }}
        >
          <BolhaComBalao humor="feliz" fala={fala} />
          {/* A pergunta do dia é o título — a bolha não a repete. */}
          <Text
            accessibilityRole="header"
            style={{
              marginTop: espaco.lg,
              textAlign: "center",
              fontFamily: fonte.titulo,
              fontSize: 24,
              lineHeight: 30,
              color: corGratidao.titulo,
            }}
          >
            {pergunta.texto}
          </Text>
          <Text
            style={{
              marginTop: espaco.sm,
              maxWidth: 320,
              textAlign: "center",
              fontFamily: fonte.normal,
              fontSize: 14,
              lineHeight: 20,
              color: corGratidao.texto,
            }}
          >
            {diaDificil
              ? "Pode ser mínimo. Isso fica no seu diário. 💛"
              : "Pode ser bem pequeno. Isso vai pro seu diário. 💛"}
          </Text>
          {/* Fichinhas de um toque — destravam a escrita nos dias cansados. */}
          <View
            style={{
              marginTop: espaco.lg,
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {pergunta.fichas.map((f) => (
              <Pressable
                key={f}
                accessibilityRole="button"
                onPress={() => {
                  toque();
                  setTexto((t) => (t.trim() ? `${t.trim()} · ${f}` : f).slice(0, LIMITE));
                }}
                hitSlop={{ top: 4, bottom: 4 }}
                style={({ pressed }) => ({
                  minHeight: 36,
                  paddingHorizontal: espaco.md,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: corGratidao.borda,
                  backgroundColor: corGratidao.vidroForte,
                  justifyContent: "center",
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ fontFamily: fonte.media, fontSize: 13, color: corGratidao.forte }}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={texto}
            onChangeText={(v) => {
              setTexto(v.slice(0, LIMITE));
              if (erro) setErro(false);
            }}
            placeholder="Hoje eu fiquei grata por…"
            placeholderTextColor={corGratidao.discreto}
            accessibilityLabel={pergunta.texto}
            multiline
            maxLength={LIMITE}
            textAlignVertical="top"
            style={{
              marginTop: espaco.md,
              width: "100%",
              minHeight: 110,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: corGratidao.borda,
              backgroundColor: cor.branco,
              padding: espaco.md,
              fontFamily: fonte.normal,
              fontSize: 15,
              lineHeight: 21,
              color: cor.texto,
            }}
          />
          {erro ? (
            <View style={{ marginTop: espaco.md, width: "100%" }}>
              <Cartao fundo={cor.atencaoFundo}>
                <T tipo="rotulo" cor={cor.atencao}>
                  Não consegui guardar agora
                </T>
                <T tipo="apagado">O texto continua aqui — tente de novo.</T>
              </Cartao>
            </View>
          ) : null}
          <View style={{ marginTop: espaco.lg, width: "100%" }}>
            <Botao
              rotulo={erro ? "Tentar guardar de novo" : "Guardar"}
              corFundo={corGratidao.forte}
              carregando={salvando}
              desabilitado={texto.trim().length < 2}
              aoTocar={() => void guardar()}
            />
          </View>
          {/* A coleção: o número já está na fala da bolha; aqui fica só a ação. */}
          {total > 0 && gratidoes ? (
            <Link texto="Ver todas" aoTocar={() => setEtapa("lista")} />
          ) : null}
        </ScrollView>
      </FundoDaAtividade>
    </KeyboardAvoidingView>
  );
}

const estiloDoQuando = {
  marginTop: 4,
  fontFamily: fonte.forte,
  fontSize: 13,
  letterSpacing: 0.4,
  textTransform: "uppercase" as const,
  color: corGratidao.quando,
};

function Link({
  texto,
  aoTocar,
  tinta = corGratidao.forte,
  sublinhado = corGratidao.sublinhado,
}: {
  texto: string;
  aoTocar: () => void;
  tinta?: string;
  sublinhado?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        toque();
        aoTocar();
      }}
      style={({ pressed }) => ({
        marginTop: espaco.sm,
        minHeight: ALVO_MINIMO,
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: fonte.forte,
          fontSize: 13,
          color: tinta,
          textDecorationLine: "underline",
          textDecorationColor: sublinhado,
        }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}
