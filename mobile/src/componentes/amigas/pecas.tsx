import {
  Check,
  ChevronRight,
  Ellipsis,
  Heart,
  Send,
  Share as IconeDeCompartilhar,
} from "lucide-react-native";
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActionSheetIOS,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { tempoNoApp, ultimaVez } from "@/lib/amigas";
import { linkDeIndicacao } from "@/lib/indicacao";
import { Botao, Campo, Cartao, Tocavel, TituloDaSecao } from "~/componentes/base";
import { ChamaDaSequencia } from "~/componentes/caminho/pecas";
import { Avatar } from "~/componentes/comunidade/imagem";
import { Folha } from "~/componentes/jornada/pecas";
import { Painel, RAIO_DENTRO_DO_PAINEL } from "~/componentes/painel";
import { lerAIndicacao } from "~/componentes/recompensas/economia-do-cantinho";
import { lerMeuPerfilSocialSePreciso, useMeuPerfilSocial } from "~/lib/comunidade/meu-perfil";
import {
  BONUS_DA_DUPLA,
  chamaDaDupla,
  corDaUltimaVez,
  fraseDoErroDaDupla,
  fraseDoPedido,
  mensagemDeConviteDoApp,
  primeiroNomeDaAmiga,
} from "~/lib/jornada/amigas";
import { useSessao } from "~/lib/sessao";
import type { DuplaNaTela, PerfilDeAmiga } from "~/servidor/amigas";
import {
  chamarParaDupla,
  desfazerADupla,
  pedirAmizade,
  responderConviteDaDupla,
  type Pedido,
} from "~/componentes/amigas/economia";
import {
  ALVO_MINIMO,
  canto,
  cor,
  curva,
  escala,
  espaco,
  fonte,
  fonteDoNumero,
  sombraFlutuante,
} from "~/tema";

/**
 * As peças da aba das Amigas e do perfil de uma amiga.
 *
 * NÃO é placar: a lista mostra o que cada uma CONSTRUIU (troféus, a chama
 * dela), nunca lado a lado com a minha, e nada clínico.
 *
 * O desenho de 18/11/2026 (a vistoria): tudo nas cores e nos materiais do tema
 * (a paleta paralela `tinta` saiu), um avatar só para o app inteiro (o de
 * `comunidade/imagem.tsx`), a lista agrupada do iOS, a dupla com cara de
 * conquista, a confirmação nativa e o convite num painel só. Digitar no campo
 * não redesenha a aba (`ChamarUmaAmiga` guarda o próprio estado) e as linhas
 * só se redesenham quando a amiga muda (`memo`).
 */

/* ── Quem sou eu (para os dois rostos da dupla) ─────────────────────────── */

/** Ela mesma, como o botão do perfil a mostra: a foto, ou a inicial na cor dela. */
export function useEu(): { id: string; nome: string; url: string | null } {
  const { sessao, perfil } = useSessao();
  const uid = sessao?.user.id ?? null;
  const meu = useMeuPerfilSocial(uid);
  useEffect(() => {
    if (uid) void lerMeuPerfilSocialSePreciso(uid);
  }, [uid]);
  return {
    id: uid ?? "eu",
    nome: meu?.nome ?? perfil?.display_name ?? perfil?.full_name ?? "Você",
    url: meu?.avatarUrl ?? null,
  };
}

/** O título de um painel das Amigas: a serifada do tema, alinhada ao cartão de dentro. */
export function CabecalhoDaSecao({ titulo, direita }: { titulo: string; direita?: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 4 }}>
      <TituloDaSecao direita={direita}>{titulo}</TituloDaSecao>
    </View>
  );
}

/* ── Dois rostos juntos ─────────────────────────────────────────────────── */

/**
 * Os dois rostos sobrepostos, com o que as une na emenda: a chama (a dupla
 * ativa) ou o coração (o convite). O anel branco separa um rosto do outro.
 */
export function ParDeRostos({
  eu,
  ela,
  tamanho,
  emenda,
}: {
  eu: { id: string; nome: string; url: string | null };
  ela: { id: string; nome: string; url: string | null };
  tamanho: number;
  emenda: "chama-acesa" | "chama-apagada" | "coracao";
}) {
  const sobra = tamanho >= 56 ? 12 : 8;
  const anel = 3;
  const largura = tamanho * 2 - sobra;
  const meio = tamanho - sobra / 2;
  const chama = emenda !== "coracao";
  /* A arte da chama tem folga em volta: 42 pt de arte enchem um disco de 46. */
  const disco = chama ? Math.round(tamanho * 0.72) : 26;
  return (
    <View
      accessible
      accessibilityLabel={`Você e ${primeiroNomeDaAmiga(ela.nome)}`}
      style={{ width: largura, height: tamanho + disco / 2 - 2 }}
    >
      <View style={{ flexDirection: "row" }}>
        <Avatar id={eu.id} nome={eu.nome} url={eu.url} tamanho={tamanho} anel={anel} />
        <Avatar
          id={ela.id}
          nome={ela.nome}
          url={ela.url}
          tamanho={tamanho}
          anel={anel}
          estilo={{ marginLeft: -sobra }}
        />
      </View>
      <View
        style={{
          position: "absolute",
          left: meio - disco / 2,
          top: tamanho - disco / 2 - 2,
          width: disco,
          height: disco,
          borderRadius: disco / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: cor.branco,
          ...sombraFlutuante,
        }}
      >
        {chama ? (
          <ChamaDaSequencia acesa={emenda === "chama-acesa"} tamanho={Math.round(disco * 0.92)} />
        ) : (
          <Heart size={14} color={cor.primaria} fill={cor.primaria} strokeWidth={2} />
        )}
      </View>
    </View>
  );
}

/* ── A lista das amigas ─────────────────────────────────────────────────── */

/** A linha tem 64 pt; o divisor começa depois do rosto (16 + 44 + 12). */
const RECUO_DO_DIVISOR = 72;

/**
 * Uma amiga na lista agrupada: o rosto, o nome e, embaixo, "vista há 2h · 14
 * troféus" (nunca "online", e o troféu como texto da linha: uma coluna de
 * números, com a lista ordenada pela chama, lia-se como ranking).
 */
export const LinhaDaAmiga = memo(function LinhaDaAmiga({
  a,
  aoAbrir,
  primeira,
  ultima,
}: {
  a: PerfilDeAmiga;
  aoAbrir: (id: string) => void;
  primeira: boolean;
  ultima: boolean;
}) {
  const vista = ultimaVez(a.vistaEm);
  const quando = vista ? `vista ${vista}` : tempoNoApp(a.diasNoApp);
  const trofeus = a.trofeus > 0 ? `${a.trofeus} ${a.trofeus === 1 ? "troféu" : "troféus"}` : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${a.nome}. ${quando}${trofeus ? `. ${trofeus}` : ""}. Abrir o Cantinho dela`}
      onPress={() => aoAbrir(a.id)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingVertical: 10,
        paddingLeft: 16,
        paddingRight: 14,
        backgroundColor: pressed ? cor.apagado : "transparent",
        borderTopLeftRadius: primeira ? RAIO_DENTRO_DO_PAINEL : 0,
        borderTopRightRadius: primeira ? RAIO_DENTRO_DO_PAINEL : 0,
        borderBottomLeftRadius: ultima ? RAIO_DENTRO_DO_PAINEL : 0,
        borderBottomRightRadius: ultima ? RAIO_DENTRO_DO_PAINEL : 0,
      })}
    >
      <Avatar id={a.id} nome={a.nome} url={a.avatarUrl} tamanho={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
          {a.nome}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
          {vista ? (
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: corDaUltimaVez(vista),
              }}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={{ flexShrink: 1, ...fonte.normal, ...escala.nota, color: cor.textoApagado }}
          >
            {trofeus ? `${quando} · ${trofeus}` : quando}
          </Text>
        </View>
      </View>
      <ChevronRight size={16} color={cor.textoApagado} strokeWidth={2.4} />
      {ultima ? null : (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: RECUO_DO_DIVISOR,
            right: 0,
            bottom: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: cor.divisor,
          }}
        />
      )}
    </Pressable>
  );
});

/** As amigas num cartão só, como uma lista dos Ajustes ou dos Contatos. */
export function ListaDeAmigas({
  amigas,
  aoAbrir,
}: {
  amigas: readonly PerfilDeAmiga[];
  aoAbrir: (id: string) => void;
}) {
  return (
    <Cartao estilo={{ padding: 0, gap: 0, borderRadius: RAIO_DENTRO_DO_PAINEL }}>
      {amigas.map((a, i) => (
        <LinhaDaAmiga
          key={a.id}
          a={a}
          aoAbrir={aoAbrir}
          primeira={i === 0}
          ultima={i === amigas.length - 1}
        />
      ))}
    </Cartao>
  );
}

/* ── Um pedido de amizade ───────────────────────────────────────────────── */

export const CartaoDoPedido = memo(function CartaoDoPedido({
  p,
  respondendo,
  aoResponder,
}: {
  p: Pedido;
  /** Qual dos dois ela tocou (os dois param até a resposta voltar). */
  respondendo: "sim" | "nao" | null;
  aoResponder: (p: Pedido, aceitar: boolean) => void;
}) {
  return (
    <Cartao estilo={{ borderRadius: RAIO_DENTRO_DO_PAINEL, padding: 14, gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar id={p.id} nome={p.nome} url={null} tamanho={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ ...fonte.forte, ...escala.manchete, color: cor.texto }}>
            {p.nome}
          </Text>
          <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
            {primeiraMaiuscula(tempoNoApp(p.diasNoApp))}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: espaco.sm }}>
        <Botao
          rotulo="Aceitar"
          tamanho="compacto"
          icone={<Check size={16} color={cor.branco} strokeWidth={2.8} />}
          carregando={respondendo === "sim"}
          desabilitado={!!respondendo}
          estilo={{ flex: 1 }}
          aoTocar={() => aoResponder(p, true)}
        />
        <Botao
          rotulo="Agora não"
          tipo="suave"
          tamanho="compacto"
          carregando={respondendo === "nao"}
          desabilitado={!!respondendo}
          estilo={{ flex: 1 }}
          aoTocar={() => aoResponder(p, false)}
        />
      </View>
    </Cartao>
  );
});

/* ── O botão "•••" ──────────────────────────────────────────────────────── */

/** O "•••" de 44 pt: a saída mora atrás dele, e não num botão do tamanho da tela. */
export function BotaoMais({
  rotulo,
  aoTocar,
  estilo,
}: {
  rotulo: string;
  aoTocar: () => void;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <Tocavel
      rotulo={rotulo}
      aoTocar={aoTocar}
      estilo={[
        {
          width: ALVO_MINIMO,
          height: ALVO_MINIMO,
          borderRadius: ALVO_MINIMO / 2,
          alignItems: "center",
          justifyContent: "center",
        },
        estilo,
      ]}
    >
      <Ellipsis size={22} color={cor.textoApagado} strokeWidth={2.4} />
    </Tocavel>
  );
}

/* ── A dupla ────────────────────────────────────────────────────────────── */

/** A regra da dupla, para quem ainda vai decidir (sem dupla, ou convidada). */
function RegraDaDupla() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
      <ChamaDaSequencia acesa={false} tamanho={30} />
      <Text style={{ flex: 1, ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>
        Vocês seguram uma chama juntas: o dia conta quando as duas aparecem, e cada uma ganha{" "}
        {BONUS_DA_DUPLA} sementinhas por dia juntas.
      </Text>
    </View>
  );
}

/**
 * A DUPLA DE SEQUÊNCIA — os quatro estados do site: sem dupla (chamar uma
 * amiga), convite enviado (cancelar), convite recebido (aceitar / agora não) e
 * ativa. Uma dupla ativa por pessoa: o banco garante, e é de propósito — duas
 * viram placar.
 *
 * Ativa, ela é a conquista (18/11/2026): os dois rostos com a chama na
 * emenda e o número grande, como a ofensiva de um jogo. A regra sai (quem
 * volta todo dia não precisa relê-la), e desfazer vai para o "•••".
 */
export const CartaoDaDupla = memo(function CartaoDaDupla({
  dupla,
  amigas,
  aoMudar,
  avisar,
  confirmar,
}: {
  dupla: DuplaNaTela | null;
  amigas: readonly PerfilDeAmiga[];
  aoMudar: () => void;
  avisar: (t: string) => void;
  confirmar: (p: PedidoDeConfirmacao) => void;
}) {
  const eu = useEu();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const estado = dupla?.estado ?? "sem";
  const dela = dupla
    ? {
        id: dupla.amigaId ?? "ela",
        nome: dupla.nome ?? "",
        url: amigas.find((a) => a.id === dupla.amigaId)?.avatarUrl ?? null,
      }
    : null;
  const nomeDela = primeiroNomeDaAmiga(dupla?.nome);

  async function agir(
    qual: string,
    acao: () => Promise<{ ok: true } | { ok: false; error?: string }>,
    sucesso: string | null,
  ) {
    setOcupado(qual);
    const r = await acao();
    setOcupado(null);
    if (!r.ok) {
      avisar(fraseDoErroDaDupla(r.error));
      return;
    }
    if (sucesso) avisar(sucesso);
    aoMudar();
  }

  if (estado === "ativa" && dupla && dela) {
    const c = chamaDaDupla(dupla);
    return (
      <Cartao
        estilo={{
          borderRadius: RAIO_DENTRO_DO_PAINEL,
          paddingTop: espaco.xl,
          paddingBottom: espaco.lg + 2,
          alignItems: "center",
          gap: espaco.md,
        }}
      >
        <BotaoMais
          rotulo={`Mais opções da dupla com ${nomeDela}`}
          estilo={{ position: "absolute", top: 4, right: 4 }}
          aoTocar={() =>
            confirmar({
              titulo: `Desfazer a dupla com ${nomeDela}?`,
              texto: `A dupla some da tela das duas e o bônus de ${BONUS_DA_DUPLA} sementinhas por dia juntas para. Ela não é avisada. Se mudarem de ideia, é só chamar de novo.`,
              sim: "Desfazer a dupla",
              nao: "Manter",
              aoConfirmar: () => void agir("desfazer", desfazerADupla, "A dupla foi desfeita."),
            })
          }
        />
        <ParDeRostos
          eu={eu}
          ela={dela}
          tamanho={64}
          emenda={c.acesa ? "chama-acesa" : "chama-apagada"}
        />
        {c.numero !== null ? (
          <View
            accessible
            accessibilityLabel={`${c.numero} ${c.unidade} ${c.com}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <Text
              style={{
                ...fonteDoNumero,
                fontSize: 44,
                lineHeight: 50,
                letterSpacing: -1,
                color: cor.atencao,
                fontVariant: ["tabular-nums"],
              }}
            >
              {c.numero}
            </Text>
            <View>
              <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
                {c.unidade}
              </Text>
              <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>{c.com}</Text>
            </View>
          </View>
        ) : (
          <Text
            style={{
              textAlign: "center",
              paddingHorizontal: espaco.sm,
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoCorpo,
            }}
          >
            {c.frase}
          </Text>
        )}
        {c.memoria ? (
          <Text
            style={{
              textAlign: "center",
              paddingHorizontal: espaco.sm,
              ...fonte.normal,
              ...escala.nota,
              color: cor.textoApagado,
            }}
          >
            {c.memoria}
          </Text>
        ) : null}
      </Cartao>
    );
  }

  return (
    <Cartao estilo={{ borderRadius: RAIO_DENTRO_DO_PAINEL, gap: espaco.lg }}>
      {estado === "convite-enviado" && dela ? (
        <View style={{ alignItems: "center", gap: espaco.md }}>
          <ParDeRostos eu={eu} ela={dela} tamanho={52} emenda="coracao" />
          <Text
            style={{
              textAlign: "center",
              ...fonte.normal,
              ...escala.legenda,
              color: cor.textoCorpo,
            }}
          >
            Você chamou <Text style={{ ...fonte.forte, color: cor.texto }}>{nomeDela}</Text> para a
            dupla. Agora é com ela.
          </Text>
          <Botao
            rotulo="Cancelar o convite"
            tipo="texto"
            tamanho="compacto"
            carregando={ocupado === "cancelar"}
            desabilitado={!!ocupado}
            aoTocar={() => void agir("cancelar", desfazerADupla, null)}
          />
        </View>
      ) : null}

      {estado === "convite-recebido" && dupla && dela ? (
        <>
          <View style={{ alignItems: "center", gap: espaco.md }}>
            <ParDeRostos eu={eu} ela={dela} tamanho={52} emenda="coracao" />
            <Text
              style={{
                textAlign: "center",
                ...fonte.normal,
                ...escala.corpo,
                color: cor.texto,
              }}
            >
              <Text style={fonte.forte}>{nomeDela}</Text> te chamou para uma dupla.
            </Text>
          </View>
          <RegraDaDupla />
          <View style={{ flexDirection: "row", gap: espaco.sm }}>
            <Botao
              rotulo="Aceitar"
              tamanho="compacto"
              icone={<Check size={16} color={cor.branco} strokeWidth={2.8} />}
              carregando={ocupado === "aceitar"}
              desabilitado={!!ocupado}
              estilo={{ flex: 1 }}
              aoTocar={() =>
                void agir(
                  "aceitar",
                  () => responderConviteDaDupla(dupla.amigaId!, true),
                  `Dupla formada. A chama de vocês começa hoje.`,
                )
              }
            />
            <Botao
              rotulo="Agora não"
              tipo="suave"
              tamanho="compacto"
              carregando={ocupado === "recusar"}
              desabilitado={!!ocupado}
              estilo={{ flex: 1 }}
              aoTocar={() =>
                void agir("recusar", () => responderConviteDaDupla(dupla.amigaId!, false), null)
              }
            />
          </View>
        </>
      ) : null}

      {estado === "sem" ? (
        <>
          <RegraDaDupla />
          {amigas.length === 0 ? (
            <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
              Quando uma amiga entrar pelo seu convite, vocês podem formar uma dupla.
            </Text>
          ) : (
            <View style={{ gap: espaco.sm }}>
              <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
                Chamar para a dupla
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.sm }}>
                {amigas.slice(0, 8).map((a) => (
                  <Tocavel
                    key={a.id}
                    rotulo={`Chamar ${a.nome} para a dupla`}
                    desabilitado={!!ocupado}
                    aoTocar={() =>
                      void agir(
                        a.id,
                        () => chamarParaDupla(a.id),
                        `Convite enviado para ${primeiroNomeDaAmiga(a.nome)}.`,
                      )
                    }
                    estilo={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: espaco.sm,
                      minHeight: ALVO_MINIMO,
                      borderRadius: canto.pilula,
                      ...curva,
                      paddingLeft: 4,
                      paddingRight: 14,
                      backgroundColor: cor.apagado,
                      opacity: ocupado && ocupado !== a.id ? 0.5 : 1,
                    }}
                  >
                    <Avatar id={a.id} nome={a.nome} url={a.avatarUrl} tamanho={36} />
                    <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.texto }}>
                      {primeiroNomeDaAmiga(a.nome)}
                    </Text>
                  </Tocavel>
                ))}
              </View>
            </View>
          )}
        </>
      ) : null}
    </Cartao>
  );
});

/* ── A confirmação ──────────────────────────────────────────────────────── */

export type PedidoDeConfirmacao = {
  titulo: string;
  texto: string;
  /** A saída (destrutiva): "Desfazer a dupla", "Sair da amizade". */
  sim: string;
  /** Ficar como está: "Manter", "Ficar". */
  nao: string;
  aoConfirmar: () => void;
};

/**
 * A CONFIRMAÇÃO de uma saída. No iPhone, a folha de ações do sistema (a que
 * todo mundo conhece, com a saída em vermelho e o "Manter" embaixo). Fora do
 * iOS (Android e a bancada), a `Folha` do app como reserva.
 */
export function useConfirmar(): {
  confirmar: (p: PedidoDeConfirmacao) => void;
  folha: ReactNode;
} {
  const [pedido, setPedido] = useState<PedidoDeConfirmacao | null>(null);
  const confirmar = useCallback((p: PedidoDeConfirmacao) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: p.titulo,
          message: p.texto,
          options: [p.sim, p.nao],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
          userInterfaceStyle: "light",
        },
        (i) => {
          if (i === 0) p.aoConfirmar();
        },
      );
      return;
    }
    setPedido(p);
  }, []);
  const fechar = useCallback(() => setPedido(null), []);
  return { confirmar, folha: <FolhaDeConfirmar pedido={pedido} aoFechar={fechar} /> };
}

/** A reserva da confirmação: a `Folha` do app (alça e área segura), com a saída em vermelho. */
function FolhaDeConfirmar({
  pedido,
  aoFechar,
}: {
  pedido: PedidoDeConfirmacao | null;
  aoFechar: () => void;
}) {
  /* A folha desce com o último texto, e não vazia. */
  const ultimo = useRef(pedido);
  if (pedido) ultimo.current = pedido;
  const p = pedido ?? ultimo.current;
  return (
    <Folha aberta={!!pedido} aoFechar={aoFechar} titulo={p?.titulo}>
      <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoCorpo }}>{p?.texto}</Text>
      <View style={{ gap: espaco.sm, marginTop: espaco.xs }}>
        <Botao
          rotulo={p?.sim ?? ""}
          tipo="perigo"
          aoTocar={() => {
            aoFechar();
            p?.aoConfirmar();
          }}
        />
        <Botao rotulo={p?.nao ?? ""} tipo="secundario" aoTocar={aoFechar} />
      </View>
    </Folha>
  );
}

/* ── Chamar uma amiga ───────────────────────────────────────────────────── */

/**
 * CHAMAR UMA AMIGA — um painel só (antes eram dois blocos, um formulário e um
 * banner em degradê, que diziam quase a mesma coisa): o convite pelo link, o
 * código dela à mão e o pedido por código ou e-mail para quem já está no app.
 * O que se digita mora AQUI, e não na aba: cada tecla redesenhava a bolha, a
 * dupla e a lista inteira.
 */
export function ChamarUmaAmiga({ avisar }: { avisar: (t: string) => void }) {
  const [codigo, setCodigo] = useState<string | null>(null);
  const [termo, setTermo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<{ texto: string; ok: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    void lerAIndicacao().then((i) => {
      if (vivo) setCodigo(i?.codigo ?? null);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const pronto = termo.trim().length >= 3;

  async function enviar() {
    if (!pronto || enviando) return;
    setEnviando(true);
    setResposta(null);
    const r = await pedirAmizade(termo.trim());
    setEnviando(false);
    setResposta(fraseDoPedido(r));
    if (r.ok) setTermo("");
  }

  async function convidar() {
    const link = linkDeIndicacao(codigo);
    if (!link || !codigo) {
      avisar("Ainda estou preparando o seu link. Tente de novo em instantes.");
      return;
    }
    /* Com o código ESCRITO: quem baixa o app digita no cadastro ("Uma amiga
       te chamou?"); o link é do site, que o captura sozinho. */
    try {
      await Share.share({ message: mensagemDeConviteDoApp(codigo, link) });
    } catch {
      avisar("Não consegui abrir o compartilhamento.");
    }
  }

  return (
    <Painel>
      <CabecalhoDaSecao titulo="Chamar uma amiga" />
      <Botao
        rotulo="Convidar pelo link"
        icone={<Send size={18} color={cor.branco} strokeWidth={2.4} />}
        aoTocar={() => void convidar()}
      />
      {codigo ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ ...fonte.normal, ...escala.legenda, color: cor.textoApagado }}>
            Seu código
          </Text>
          <Tocavel
            rotulo={`Seu código, ${codigo.split("").join(" ")}. Compartilhar`}
            aoTocar={() => void convidar()}
            estilo={{
              flexDirection: "row",
              alignItems: "center",
              gap: espaco.sm,
              minHeight: ALVO_MINIMO,
              paddingHorizontal: 14,
              borderRadius: canto.pilula,
              ...curva,
              backgroundColor: cor.apagado,
            }}
          >
            <Text
              selectable
              style={{ ...fonte.titulo, fontSize: 17, letterSpacing: 1.5, color: cor.texto }}
            >
              {codigo}
            </Text>
            <IconeDeCompartilhar size={15} color={cor.textoApagado} strokeWidth={2.4} />
          </Tocavel>
        </View>
      ) : null}

      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: cor.borda }} />

      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: espaco.sm }}>
        <View style={{ flex: 1 }}>
          <Campo
            rotulo="Ela já está no app?"
            value={termo}
            onChangeText={setTermo}
            onSubmitEditing={() => void enviar()}
            placeholder="Código ou e-mail dela"
            accessibilityHint="O código de indicação ou o e-mail da conta dela"
            keyboardType="email-address"
            returnKeyType="send"
            enablesReturnKeyAutomatically
            autoCapitalize="none"
            autoCorrect={false}
            style={{ minHeight: 48 }}
          />
        </View>
        <Botao
          rotulo="Enviar"
          carregando={enviando}
          desabilitado={!pronto}
          aoTocar={() => void enviar()}
        />
      </View>
      {resposta ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{
            paddingHorizontal: 4,
            ...fonte.media,
            ...escala.nota,
            color: resposta.ok ? cor.sementinha : cor.atencaoForte,
          }}
        >
          {resposta.texto}
        </Text>
      ) : null}
      <Text
        style={{ paddingHorizontal: 4, ...fonte.normal, ...escala.nota, color: cor.textoApagado }}
      >
        Peça o código dela, que fica nas Recompensas, ou use o e-mail da conta dela. Ela recebe o
        pedido e escolhe se aceita.
      </Text>
    </Painel>
  );
}

function primeiraMaiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
