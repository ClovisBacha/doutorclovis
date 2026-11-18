import { ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Linking, Pressable, Share, Text, View } from "react-native";
import { BONUS_INFLUENCIADORA } from "@/lib/economia-sementinhas";
import { linkDeIndicacao, linkDoWhatsApp } from "@/lib/indicacao";
import { Botao, Campo, Cartao, toque } from "~/componentes/base";
import { useMolaDeToque, useMovimentoReduzido } from "~/componentes/movimento";
import {
  aplicarOCodigo,
  lerAIndicacao,
  lerExtrato,
  lerODepoimento,
  mandarDepoimento,
  type Depoimento,
  type Indicacao,
  type Lancamento,
} from "~/componentes/recompensas/economia-do-cantinho";
import { Broto, vibrar } from "~/componentes/recompensas/pecas";
import { mensagemDeConviteDoApp } from "~/lib/jornada/amigas";
import { RECOMPENSA_DA_INDICACAO, RECOMPENSA_DO_DEPOIMENTO } from "~/lib/jornada/recompensas";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, canto, cor, curva, escala, espaco, fonte } from "~/tema";

/**
 * "GANHE MAIS SEMENTINHAS" — a sanfona do fim do Meu Cantinho, recolhida por
 * padrão. Também abre pela pílula do saldo, no alto da tela.
 *
 * O que entra no app: indicar uma amiga, o depoimento e o código de quem a
 * trouxe — e, no fim, o extrato e a frase que traça o limite do produto, que no
 * site moram na loja paga de sementinhas (que o app não tem: lá se compra com
 * dinheiro, e no app só a Apple vende).
 *
 * ⚠️ O que NÃO entra: a recompensa por avaliar o app (a Apple proíbe pagar pela
 * nota) e o Instagram (desligado no servidor; no site o cartão se esconde).
 *
 * Desenho (18/11/2026): UM cartão do tema, com as partes separadas por fios —
 * antes eram três cartões dentro de uma sanfona menta, cada um num degradê
 * Tailwind (rosa, violeta) e com o seu botão de outra cor.
 */

export function GanheMais({
  aberta,
  aoAlternar,
  aoGanhar,
  avisar,
}: {
  aberta: boolean;
  aoAlternar: () => void;
  aoGanhar: (n: number) => void;
  avisar: (texto: string) => void;
}) {
  return (
    <Cartao estilo={{ padding: 0, gap: 0 }}>
      <CabecaDaSanfona
        aberta={aberta}
        aoAlternar={aoAlternar}
        rotulo="Ganhe mais sementinhas"
        icone={
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: cor.sementinhaFundo,
            }}
          >
            <Broto tamanho={18} />
          </View>
        }
        sub="Indique amigas e conte como está sendo."
      />
      {aberta ? (
        <View>
          <CartaoDaIndicacao avisar={avisar} />
          <CartaoDoDepoimento avisar={avisar} />
          <CodigoDeQuemIndicou aoGanhar={aoGanhar} avisar={avisar} />
          <Extrato />
          <Text
            style={{
              paddingHorizontal: espaco.lg,
              paddingTop: espaco.md,
              paddingBottom: espaco.lg,
              ...fonte.normal,
              ...escala.nota,
              textAlign: "center",
              color: cor.textoApagado,
            }}
          >
            As sementinhas compram só enfeites do Meu Cantinho. Nenhuma aula depende delas.
          </Text>
        </View>
      ) : null}
    </Cartao>
  );
}

/** A cabeça de uma sanfona: o toque com mola e a seta que gira 90°. */
function CabecaDaSanfona({
  aberta,
  aoAlternar,
  rotulo,
  sub,
  icone,
  compacta,
}: {
  aberta: boolean;
  aoAlternar: () => void;
  rotulo: string;
  sub?: string;
  icone?: ReactNode;
  compacta?: boolean;
}) {
  const mola = useMolaDeToque(0.98);
  const reduzido = useMovimentoReduzido();
  const giro = useRef(new Animated.Value(aberta ? 1 : 0)).current;
  useEffect(() => {
    if (reduzido) {
      giro.setValue(aberta ? 1 : 0);
      return;
    }
    const a = Animated.timing(giro, {
      toValue: aberta ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [aberta, giro, reduzido]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: aberta }}
      accessibilityLabel={rotulo}
      onPressIn={mola.aoPressionar}
      onPressOut={mola.aoSoltar}
      onPress={() => {
        toque();
        aoAlternar();
      }}
    >
      <Animated.View
        style={{
          minHeight: compacta ? ALVO_MINIMO : ALVO_MINIMO + 20,
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          paddingHorizontal: espaco.lg,
          paddingVertical: compacta ? espaco.sm : espaco.md,
          transform: [{ scale: mola.escala }],
        }}
      >
        {icone}
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              ...fonte.forte,
              ...(compacta ? escala.legenda : escala.manchete),
              color: cor.texto,
            }}
          >
            {rotulo}
          </Text>
          {sub ? (
            <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>{sub}</Text>
          ) : null}
        </View>
        <Animated.View
          style={{
            transform: [
              { rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] }) },
            ],
          }}
        >
          <ChevronRight size={18} color={cor.chevron} strokeWidth={2.6} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

/** Uma parte da sanfona: o fio em cima, o título (com algo à direita) e o corpo. */
function Parte({
  titulo,
  direita,
  children,
}: {
  titulo: string;
  direita?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: cor.divisor,
        paddingHorizontal: espaco.lg,
        paddingVertical: espaco.lg,
        gap: espaco.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, ...fonte.forte, ...escala.manchete, color: cor.texto }}
        >
          {titulo}
        </Text>
        {direita}
      </View>
      {children}
    </View>
  );
}

/** Uma etiqueta pequena (o bônus, o estado do depoimento). */
function Etiqueta({
  texto,
  fundo,
  tinta,
  icone,
}: {
  texto: string;
  fundo: string;
  tinta: string;
  icone?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderRadius: canto.pilula,
        ...curva,
        backgroundColor: fundo,
        paddingHorizontal: espaco.sm + 2,
        paddingVertical: 3,
      }}
    >
      {icone}
      <Text style={{ ...fonte.forte, ...escala.nota, color: tinta }}>{texto}</Text>
    </View>
  );
}

const corpo = { ...fonte.normal, ...escala.legenda, color: cor.textoCorpo } as const;
const miudo = { ...fonte.normal, ...escala.nota, color: cor.textoApagado } as const;

/* ── Indique uma amiga ──────────────────────────────────────────────────── */

function CartaoDaIndicacao({ avisar }: { avisar: (t: string) => void }) {
  const [ind, setInd] = useState<Indicacao | null | "lendo">("lendo");
  useEffect(() => {
    void lerAIndicacao().then(setInd);
  }, []);
  /* Sem link não há cartão: ele existe para ser compartilhado, e um convite sem
     código não liga a amiga a ninguém (`linkDeIndicacao` devolve `null`). */
  if (!ind || ind === "lendo") return null;
  const link = linkDeIndicacao(ind.codigo);
  if (!link || !ind.codigo) return null;
  /* Com o código escrito: no app, a amiga o digita no cadastro. */
  const msg = mensagemDeConviteDoApp(ind.codigo, link);

  async function compartilhar() {
    toque();
    try {
      await Share.share({ message: msg });
    } catch {
      avisar("Não deu para abrir o compartilhamento.");
    }
  }

  return (
    <Parte
      titulo="Indique uma amiga"
      direita={
        <Etiqueta
          texto={`+${RECOMPENSA_DA_INDICACAO}`}
          fundo={cor.sementinhaFundo}
          tinta={cor.sementinha}
          icone={<Broto tamanho={13} />}
        />
      }
    >
      <Text style={corpo}>
        Cada amiga que criar a conta pelo seu link vale {RECOMPENSA_DA_INDICACAO} sementinhas para
        você. Sem limite de amigas.
      </Text>
      {ind.amigas > 0 ? (
        <Text style={miudo}>
          {ind.amigas === 1
            ? "Uma amiga já entrou pelo seu convite."
            : `${ind.amigas} amigas já entraram pelo seu convite.`}
        </Text>
      ) : null}
      <View
        style={{
          marginTop: espaco.xs,
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          borderRadius: canto.campo,
          ...curva,
          backgroundColor: cor.apagado,
          paddingLeft: espaco.md,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, ...miudo }}>
          {link}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compartilhar o convite"
          onPress={() => void compartilhar()}
          style={({ pressed }) => ({
            minHeight: ALVO_MINIMO,
            justifyContent: "center",
            paddingHorizontal: espaco.md,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.primariaEscura }}>
            Compartilhar
          </Text>
        </Pressable>
      </View>
      <Botao
        rotulo="Convidar pelo WhatsApp"
        estilo={{ marginTop: espaco.xs }}
        aoTocar={() => {
          /* `https://wa.me`, nunca `whatsapp://` — ver `linkDoWhatsApp`. */
          void Linking.openURL(linkDoWhatsApp(msg)).catch(() =>
            avisar("Não deu para abrir o WhatsApp."),
          );
        }}
      />
    </Parte>
  );
}

/* ── Deixe seu depoimento ───────────────────────────────────────────────── */

function CartaoDoDepoimento({ avisar }: { avisar: (t: string) => void }) {
  const [dep, setDep] = useState<Depoimento | undefined | "lendo">("lendo");
  const [texto, setTexto] = useState("");
  const [nome, setNome] = useState("");
  const [editando, setEditando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    void lerODepoimento().then((d) => {
      setDep(d);
      if (d) {
        setTexto(d.texto);
        setNome(d.nome ?? "");
      }
    });
  }, []);
  /* Leitura que falhou esconde o cartão: um formulário vazio diria a quem já
     escreveu que o depoimento dela sumiu. */
  if (dep === "lendo" || dep === undefined) return null;

  const status = dep?.status ?? null;
  const formulario = editando || !status;
  const curto = texto.trim().length < 10;

  async function enviar() {
    if (enviando || curto) return;
    setEnviando(true);
    const r = await mandarDepoimento(texto.trim(), nome.trim());
    setEnviando(false);
    if (r === true) {
      setDep({ texto: texto.trim(), nome: nome.trim() || null, status: "pending" });
      setEditando(false);
      vibrar("sucesso");
      avisar("Depoimento enviado. O Dr. Clóvis vai ler antes de publicar.");
    } else {
      vibrar("erro");
      avisar(r);
    }
  }

  const selo =
    status === "approved" ? (
      <Etiqueta
        texto={`Publicado · +${RECOMPENSA_DO_DEPOIMENTO}`}
        fundo={cor.sementinhaFundo}
        tinta={cor.sementinha}
      />
    ) : status === "pending" ? (
      <Etiqueta texto="Em análise" fundo={cor.atencaoFundo} tinta={cor.atencaoTexto} />
    ) : status === "rejected" ? (
      <Etiqueta texto="Não publicado" fundo={cor.quaseFundo} tinta={cor.atencaoTexto} />
    ) : null;

  return (
    <Parte titulo="Conte como está sendo" direita={selo}>
      {formulario ? (
        <>
          <Text style={corpo}>
            Se o Dr. Clóvis aprovar, você ganha {RECOMPENSA_DO_DEPOIMENTO} sementinhas e o seu
            depoimento pode aparecer no site.
          </Text>
          <Campo
            rotulo="Seu depoimento"
            value={texto}
            onChangeText={(t) => setTexto(t.slice(0, 600))}
            multiline
            placeholder="Escreva aqui"
          />
          <Campo
            rotulo="Como quer aparecer"
            value={nome}
            onChangeText={(t) => setNome(t.slice(0, 60))}
            placeholder="Mariana, mãe da Alice"
          />
          <Botao
            rotulo={status ? "Enviar de novo" : "Enviar depoimento"}
            desabilitado={curto}
            carregando={enviando}
            aoTocar={() => void enviar()}
          />
        </>
      ) : (
        <>
          {status === "rejected" ? (
            <Text style={corpo}>
              Este não foi publicado. Você pode reescrever e enviar de novo.
            </Text>
          ) : null}
          <View
            style={{
              borderRadius: canto.dentro,
              ...curva,
              backgroundColor: cor.apagado,
              padding: espaco.md,
            }}
          >
            <Text style={{ ...corpo, fontStyle: "italic", color: cor.texto }}>“{dep?.texto}”</Text>
          </View>
          <Botao
            rotulo="Editar depoimento"
            tipo="texto"
            tamanho="compacto"
            estilo={{ alignSelf: "flex-start", marginLeft: -espaco.md }}
            aoTocar={() => setEditando(true)}
          />
        </>
      )}
    </Parte>
  );
}

/* ── Veio pela indicação de alguém? ─────────────────────────────────────── */

function CodigoDeQuemIndicou({
  aoGanhar,
  avisar,
}: {
  aoGanhar: (n: number) => void;
  avisar: (t: string) => void;
}) {
  const { perfil, estadoDoPerfil } = useSessao();
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aplicou, setAplicou] = useState(false);
  /* Só para quem ainda não tem código — e só com o perfil LIDO: na dúvida, não
     oferece (ela digitaria um código que o servidor recusaria, e a tela teria
     prometido um bônus que não vem). */
  if (aplicou || estadoDoPerfil !== "pronto" || !perfil || perfil.ref_code) return null;

  async function aplicar() {
    const limpo = codigo.trim();
    if (limpo.length < 3 || enviando) return;
    setEnviando(true);
    const r = await aplicarOCodigo(limpo);
    setEnviando(false);
    if (r.tipo === "aplicado") {
      setAplicou(true);
      vibrar("sucesso");
      if (r.bonus > 0) {
        aoGanhar(r.bonus);
        avisar(`${r.bonus} sementinhas de boas-vindas.`);
      }
    } else if (r.tipo === "ja-tinha") {
      setAplicou(true);
    } else if (r.tipo === "invalido") {
      vibrar("erro");
      avisar("Não achei esse código. Confira com quem te indicou.");
    } else {
      vibrar("erro");
      avisar("Não deu agora. Tente de novo mais tarde.");
    }
  }

  return (
    <Parte titulo="Veio por indicação?">
      <Text style={corpo}>
        Coloque o código da sua médica ou da embaixadora que te trouxe e ganhe{" "}
        {BONUS_INFLUENCIADORA} sementinhas.
      </Text>
      {/* O consentimento diz o que acontece: o primeiro nome dela passa a
          aparecer numa lista da embaixadora (ver o mesmo aviso no site). */}
      <Text style={miudo}>
        Se for de uma embaixadora, ela passa a ver o seu primeiro nome numa lista, para poder te
        presentear. Nada mais do seu acompanhamento aparece para ela.
      </Text>
      <Campo
        rotulo="Código"
        value={codigo}
        onChangeText={setCodigo}
        onSubmitEditing={() => void aplicar()}
        placeholder="MARIA"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
      />
      <Botao
        rotulo="Aplicar o código"
        tipo="secundario"
        desabilitado={codigo.trim().length < 3}
        carregando={enviando}
        aoTocar={() => void aplicar()}
      />
    </Parte>
  );
}

/* ── O extrato ──────────────────────────────────────────────────────────── */

function diaMes(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * De onde vieram as que ela tem. Uma moeda cujo saldo se move sem explicação é
 * a receita para ela achar que perdeu alguma coisa. Lido ao abrir, e só ao
 * abrir — numa tela cujo assunto é a lojinha, a lista não rouba o olho.
 */
function Extrato() {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Lancamento[] | null | "lendo">(null);

  function alternar() {
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir) {
      setLista("lendo");
      void lerExtrato().then(setLista);
    }
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: cor.divisor }}>
      <CabecaDaSanfona
        aberta={aberto}
        aoAlternar={alternar}
        rotulo="Últimas movimentações"
        compacta
      />
      {aberto ? (
        <View style={{ paddingHorizontal: espaco.lg, paddingBottom: espaco.sm }}>
          {lista === "lendo" ? (
            <Text style={[miudo, { paddingVertical: espaco.sm }]}>Lendo…</Text>
          ) : lista === null ? (
            /* Falha não é lista vazia: "nenhuma movimentação" afirmaria algo. */
            <Text style={[miudo, { paddingVertical: espaco.sm }]}>
              Não deu para ler as movimentações agora.
            </Text>
          ) : lista.length === 0 ? (
            <Text style={[miudo, { paddingVertical: espaco.sm }]}>Nenhuma movimentação ainda.</Text>
          ) : (
            lista.slice(0, 8).map((l, i) => (
              <View
                key={`${l.quando}-${i}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: espaco.md,
                  paddingVertical: espaco.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: cor.divisor,
                }}
              >
                <Text numberOfLines={1} style={{ flex: 1, ...corpo, color: cor.texto }}>
                  {l.motivo ?? "Movimentação"}
                </Text>
                <Text style={{ ...miudo, fontVariant: ["tabular-nums"] }}>{diaMes(l.quando)}</Text>
                <Text
                  style={{
                    minWidth: 40,
                    textAlign: "right",
                    ...fonte.forte,
                    ...escala.legenda,
                    fontVariant: ["tabular-nums"],
                    color: l.quantidade >= 0 ? cor.sementinha : cor.textoApagado,
                  }}
                >
                  {l.quantidade >= 0 ? "+" : ""}
                  {l.quantidade}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}
