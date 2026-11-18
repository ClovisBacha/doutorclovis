import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
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
  PREFIXO_GRATIDAO,
  textoDaGratidao,
  type Gratidao,
} from "@/lib/gratidao";
import { paraLike } from "@/lib/like-seguro";
import { Cartao, T, toque } from "~/componentes/base";
import {
  BolhaComBalao,
  BotaoDaAtividade,
  CarregandoAtividade,
  fecharAtividade,
  FundoDaAtividade,
  PilulaComRelevo,
  TituloDaAtividade,
  TopoDaAtividade,
  TrocaDeEtapa,
} from "~/componentes/jornada/atividade";
import { corDaAtividade } from "~/componentes/jornada/cores";
import { perguntaDoDiaNoApp } from "~/lib/jornada/gratidao";
import { concluirMomento, FimDoMomento, type Desfecho } from "~/componentes/jornada/fim";
import { useAtividade } from "~/componentes/jornada/usarJornada";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte, luz, margem, sombra } from "~/tema";

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

const PALETA = corDaAtividade.gratidao;
/** A carta é do Momento com o bebê: o aviso dela vem na cor de quem recebe a visita. */
const CARTA = corDaAtividade.carta;

/** O cartão claro de uma gratidão guardada (a releitura, a lista, o resumo). */
const CARTAO_DA_GRATIDAO = {
  width: "100%",
  borderRadius: canto.dentro,
  ...curva,
  backgroundColor: luz.cartao,
  borderWidth: 0.5,
  borderColor: "rgba(255,255,255,0.9)",
  paddingHorizontal: espaco.lg,
  paddingVertical: espaco.md,
  ...sombra,
} as const;

/** O limite do site: uma coisa boa, não um diário inteiro. */
const LIMITE = 300;

type Etapa = "escrever" | "lista" | "resumo" | "guardado";

function diaDoAno(d: Date): number {
  return Math.floor(
    (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) /
      86_400_000,
  );
}

/** "há 3 dias" → "Há 3 dias": a data em frase, e não em maiúsculas. */
const emFrase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* As gratidões de exemplo da bancada (as datas contam para trás a partir de hoje). */
function exemplosDaBancada(): Gratidao[] {
  const dias = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  return [
    { texto: "O Rafael fez um chá e ficou comigo no sofá.", quando: dias(1) },
    { texto: "Senti o bebê mexer no meio da reunião.", quando: dias(3) },
    { texto: "As amigas do grupo mandaram um áudio cantando.", quando: dias(5) },
    { texto: "Consegui dormir a tarde inteira.", quando: dias(26) },
    { texto: "Minha mãe veio almoçar e trouxe bolo de fubá.", quando: dias(40) },
  ];
}

export default function GratidaoTela() {
  const at = useAtividade("gratitude");
  const [texto, setTexto] = useState("");
  const [foco, setFoco] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>("escrever");
  const [desfecho, setDesfecho] = useState<Desfecho | null>(null);
  /* `null` = não conseguimos ler (a escrita continua: ler nunca impede de registrar). */
  const [gratidoes, setGratidoes] = useState<Gratidao[] | null>(null);
  /* `null` = ainda não sei, ou não consegui ler: a tela nunca afirma "essa foi
     a primeira" a quem tem dezenas guardadas só porque a leitura falhou. */
  const [total, setTotal] = useState<number | null>(null);
  const [diaDificil, setDiaDificil] = useState(false);
  const [marco, setMarco] = useState<number | null>(null);
  const [cartaNova, setCartaNova] = useState(false);
  const [favorita, setFavorita] = useState<string | null>(null);
  const [aplicouBancada, setAplicouBancada] = useState(false);

  const pergunta = useMemo(
    () =>
      perguntaDoDiaNoApp({
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
      setTexto("Hoje o dia teve sol e uma conversa boa.");
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
      setTexto("Hoje o dia teve sol e uma conversa boa.");
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
    const novoTotal = total == null ? null : total + 1;
    setTotal(novoTotal);
    const m = at.cuidado || novoTotal == null ? null : marcoAtingido(novoTotal);
    setMarco(m);
    if (m && Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    setCartaNova(!at.cuidado && novoTotal != null && cartaAcabouDeNascer(novoTotal));
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

  if (!at.pronto) return <CarregandoAtividade paleta={PALETA} />;

  const irParaCarta = () => router.push({ pathname: "/jornada/bebe", params: { delas: "1" } });
  /* A carta mora no Momento com o bebê, que não existe no Modo Cuidado. */
  const temCarta = !at.cuidado && total != null && total >= MINIMO_PARA_CARTA;

  let miolo: ReactNode;
  if (etapa === "guardado") {
    /* A releitura usa o total como semente, como no site: cada nova guardada
       traz outra lembrança. Nunca a de hoje nem a de ontem — isso é eco. */
    const releitura =
      gratidoes && total != null ? gratidaoParaReler(gratidoes, new Date(), total) : null;
    const frase =
      total == null
        ? "Guardei 💛 Está no seu diário."
        : falaDaBolha({ tela: "guardado", total, marco, temReleitura: !!releitura });
    miolo = (
      <>
        <TopoDaAtividade />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: margem.tela, paddingBottom: espaco.xxl }}
        >
          <FimDoMomento
            momento="gratitude"
            cor={PALETA.acao}
            titulo="Guardei"
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
                      ...fonte.titulo,
                      fontSize: 60,
                      lineHeight: 66,
                      color: PALETA.acao,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {marco}
                  </Text>
                ) : null}
                {releitura ? (
                  <View style={CARTAO_DA_GRATIDAO}>
                    <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.texto }}>
                      “{releitura.texto}”
                    </Text>
                    <Text style={estiloDoQuando}>
                      {emFrase(haQuantoTempo(releitura.quando, new Date()))}
                    </Text>
                  </View>
                ) : null}
                {/* A carta deixou de ficar escondida: o aviso aparece UMA vez, na
                    oitava, na cor de quem recebe a visita. */}
                {cartaNova && !at.cuidado ? (
                  <View
                    style={{
                      width: "100%",
                      borderRadius: canto.dentro + 2,
                      ...curva,
                      backgroundColor: CARTA.luz,
                      padding: espaco.lg,
                      gap: espaco.md,
                    }}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        ...fonte.normal,
                        ...escala.legenda,
                        color: cor.texto,
                      }}
                    >
                      Já dá para fazer uma carta para o bebê com tudo o que você me contou.
                    </Text>
                    <BotaoDaAtividade cor={CARTA.acao} rotulo="Ver a carta" aoTocar={irParaCarta} />
                  </View>
                ) : null}
                {(total ?? 0) > 1 ? (
                  <Link texto="Ver todas" aoTocar={() => setEtapa("lista")} />
                ) : null}
                {/* Fora do instante da oitava, a carta não pode depender de estar
                    bem naquele dia: o link fica, sem duplicar o anúncio acima. */}
                {!cartaNova && temCarta ? (
                  <Link texto="Ver a carta para o bebê" tinta={CARTA.acao} aoTocar={irParaCarta} />
                ) : null}
              </View>
            }
          />
        </ScrollView>
      </>
    );
  } else if (etapa === "lista") {
    const n = total ?? gratidoes?.length ?? 0;
    miolo = (
      <>
        <TopoDaAtividade voltar aoFechar={() => setEtapa("escrever")} />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: margem.foco, paddingBottom: espaco.xxl }}
        >
          <TituloDaAtividade>Suas coisas boas</TituloDaAtividade>
          <Text
            style={{ marginTop: 4, ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}
          >
            {n} {n === 1 ? "guardada" : "guardadas"} até aqui
          </Text>
          <View style={{ marginTop: espaco.xl, gap: espaco.md }}>
            {(gratidoes ?? []).map((g) => (
              <View key={`${g.quando}-${g.texto.slice(0, 12)}`} style={CARTAO_DA_GRATIDAO}>
                <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.texto }}>
                  {g.texto}
                </Text>
                <Text style={estiloDoQuando}>{emFrase(haQuantoTempo(g.quando, new Date()))}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: espaco.xl }}>
            <BotaoDaAtividade
              cor={PALETA.acao}
              rotulo="Escrever uma nova"
              aoTocar={() => setEtapa("escrever")}
            />
          </View>
        </ScrollView>
      </>
    );
  } else if (etapa === "resumo") {
    const semana = gratidoesDaSemana(gratidoes ?? [], new Date());
    miolo = (
      <>
        <TopoDaAtividade />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: margem.foco,
            paddingTop: espaco.xs,
            paddingBottom: espaco.xxl,
          }}
        >
          <BolhaComBalao
            lado
            humor="feliz"
            fala={falaDaBolha({ tela: "resumo", total: semana.length })}
          />
          <TituloDaAtividade>Antes de escrever, olha a sua semana</TituloDaAtividade>
          <Text
            style={{
              marginTop: espaco.sm,
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoApagado,
            }}
          >
            Não precisa escolher nada. É só para reler.
          </Text>
          <View style={{ marginTop: espaco.xl, gap: espaco.sm }}>
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
                  style={({ pressed }) => [
                    CARTAO_DA_GRATIDAO,
                    {
                      minHeight: ALVO_MINIMO,
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: escolhida ? PALETA.acao : "transparent",
                      backgroundColor: escolhida ? PALETA.luz : luz.cartao,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.texto }}>
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
                textAlign: "center",
                ...fonte.forte,
                ...escala.legenda,
                color: PALETA.acao,
              }}
            >
              Boa escolha.
            </Text>
          ) : null}
          <View style={{ marginTop: espaco.xl }}>
            <BotaoDaAtividade
              cor={PALETA.acao}
              rotulo={at.jaFeita ? "Fechar" : "Escrever a de hoje"}
              aoTocar={() => (at.jaFeita ? fecharAtividade() : setEtapa("escrever"))}
            />
          </View>
        </ScrollView>
      </>
    );
  } else {
    const fala = at.jaFeita
      ? "Você já me contou uma coisa boa hoje. Se quiser, conta outra, que eu guardo também."
      : falaDaBolha({ tela: "escrever", total: total ?? 0, diaDificil, periodo });
    miolo = (
      <>
        <TopoDaAtividade />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            paddingHorizontal: margem.foco,
            paddingTop: espaco.xs,
            paddingBottom: espaco.xxl,
          }}
        >
          <BolhaComBalao lado humor="feliz" fala={fala} />
          {/* A pergunta do dia é o título — a bolha não a repete. */}
          <TituloDaAtividade>{pergunta.texto}</TituloDaAtividade>
          <Text
            style={{
              marginTop: espaco.sm,
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoApagado,
            }}
          >
            {diaDificil
              ? "Pode ser mínimo. Isso fica no seu diário."
              : "Pode ser bem pequeno. Vai para o seu diário."}
          </Text>
          {/* Fichinhas de um toque — destravam a escrita nos dias cansados. */}
          <View
            style={{
              marginTop: espaco.lg,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: espaco.sm,
            }}
          >
            {pergunta.fichas.map((f) => (
              <PilulaComRelevo
                key={f}
                paleta={PALETA}
                rotulo={f}
                aoTocar={() =>
                  setTexto((t) => (t.trim() ? `${t.trim()} · ${f}` : f).slice(0, LIMITE))
                }
              />
            ))}
          </View>
          {/* O campo preenchido do app (a névoa, sem borda), com o aro da
              atividade quando ela escreve. */}
          <TextInput
            value={texto}
            onChangeText={(v) => {
              setTexto(v.slice(0, LIMITE));
              if (erro) setErro(false);
            }}
            onFocus={() => setFoco(true)}
            onBlur={() => setFoco(false)}
            placeholder="Hoje eu fiquei grata por…"
            placeholderTextColor={cor.textoApagado}
            selectionColor={PALETA.acao}
            cursorColor={PALETA.acao}
            accessibilityLabel={pergunta.texto}
            multiline
            maxLength={LIMITE}
            textAlignVertical="top"
            style={{
              marginTop: espaco.lg,
              width: "100%",
              minHeight: 132,
              borderRadius: canto.dentro,
              ...curva,
              borderWidth: 2,
              borderColor: foco ? PALETA.acao : "transparent",
              backgroundColor: foco ? cor.branco : cor.apagado,
              paddingHorizontal: espaco.lg,
              paddingTop: 14,
              paddingBottom: 14,
              ...fonte.normal,
              fontSize: 17,
              lineHeight: 24,
              color: cor.texto,
            }}
          />
          {erro ? (
            <View style={{ marginTop: espaco.md, width: "100%" }}>
              <Cartao fundo={cor.atencaoFundo}>
                <T tipo="rotulo" cor={cor.atencao}>
                  Não consegui guardar agora
                </T>
                <T tipo="apagado">O texto continua aqui. Tente de novo.</T>
              </Cartao>
            </View>
          ) : null}
          <View style={{ marginTop: espaco.lg, width: "100%" }}>
            <BotaoDaAtividade
              cor={PALETA.acao}
              luz={PALETA.luz}
              rotulo={erro ? "Tentar guardar de novo" : "Guardar"}
              carregando={salvando}
              desabilitado={texto.trim().length < 2}
              aoTocar={() => void guardar()}
            />
          </View>
          {/* A coleção: o número já está na fala da bolha; aqui fica só a ação. */}
          {(total ?? 0) > 0 && gratidoes ? (
            <Link texto="Ver todas" aoTocar={() => setEtapa("lista")} />
          ) : null}
        </ScrollView>
      </>
    );
  }

  return (
    <FundoDaAtividade paleta={PALETA}>
      <TrocaDeEtapa chave={etapa}>{miolo}</TrocaDeEtapa>
    </FundoDaAtividade>
  );
}

const estiloDoQuando = {
  marginTop: 4,
  ...fonte.normal,
  ...escala.nota,
  color: cor.textoApagado,
};

function Link({
  texto,
  aoTocar,
  tinta = PALETA.acao,
}: {
  texto: string;
  aoTocar: () => void;
  tinta?: string;
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
        alignSelf: "center",
        minHeight: ALVO_MINIMO,
        paddingHorizontal: espaco.md,
        justifyContent: "center",
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Text style={{ ...fonte.forte, ...escala.legenda, color: tinta }}>{texto}</Text>
    </Pressable>
  );
}
