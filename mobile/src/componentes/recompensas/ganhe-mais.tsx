import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { Linking, Pressable, Share, Text, TextInput, View } from "react-native";
import { BONUS_INFLUENCIADORA } from "@/lib/economia-sementinhas";
import { linkDeIndicacao, linkDoWhatsApp, mensagemDeConvite } from "@/lib/indicacao";
import { toque } from "~/componentes/base";
import { corRecompensas } from "~/componentes/recompensas/cores";
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
import { CartaoMaterial, vibrar } from "~/componentes/recompensas/pecas";
import { RECOMPENSA_DA_INDICACAO, RECOMPENSA_DO_DEPOIMENTO } from "~/lib/jornada/recompensas";
import { useSessao } from "~/lib/sessao";
import { ALVO_MINIMO, cor, espaco, fonte } from "~/tema";

/**
 * "GANHE MAIS SEMENTINHAS" — a sanfona do Meu Cantinho do site, recolhida por
 * padrão (um bloco só no lugar de quatro cartões empilhados).
 *
 * O que entra no app: indicar uma amiga, o depoimento e o código de quem a
 * trouxe — e, no fim, o extrato e a frase que traça o limite do produto, que no
 * site moram na Loja de Sementinhas (que o app não tem: lá se compra com
 * dinheiro, e no app só a Apple vende).
 *
 * ⚠️ O que NÃO entra: a recompensa por avaliar o app (a Apple proíbe pagar pela
 * nota) e o Instagram (desligado no servidor; no site o cartão se esconde).
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
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: corRecompensas.esmeralda100,
        backgroundColor: corRecompensas.esmeralda50_40,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: aberta }}
        accessibilityLabel="Ganhe mais Sementinhas"
        onPress={() => {
          toque();
          aoAlternar();
        }}
        style={{
          minHeight: ALVO_MINIMO + 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: espaco.lg,
        }}
      >
        <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: corRecompensas.esmeralda800 }}>
          🌱 Ganhe mais Sementinhas
        </Text>
        <Text
          style={{
            fontFamily: fonte.forte,
            fontSize: 16,
            color: corRecompensas.esmeralda600,
            transform: [{ rotate: aberta ? "90deg" : "0deg" }],
          }}
        >
          ›
        </Text>
      </Pressable>
      {aberta ? (
        <View style={{ gap: espaco.sm, paddingHorizontal: espaco.md, paddingBottom: espaco.md }}>
          <CartaoDaIndicacao avisar={avisar} />
          <CartaoDoDepoimento avisar={avisar} />
          <CodigoDeQuemIndicou aoGanhar={aoGanhar} avisar={avisar} />
          <Extrato />
          <Text
            style={{
              marginTop: espaco.xs,
              paddingHorizontal: espaco.sm,
              fontFamily: fonte.normal,
              fontSize: 13,
              lineHeight: 19,
              textAlign: "center",
              color: corRecompensas.ardosia600,
            }}
          >
            Sementinhas compram só enfeites do Meu Cantinho. Nenhuma aula e nada do SOS dependem
            delas.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

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
  if (!link) return null;
  const msg = mensagemDeConvite(link);

  async function compartilhar() {
    toque();
    try {
      await Share.share({ message: msg });
    } catch {
      avisar("Não consegui abrir o compartilhamento.");
    }
  }

  return (
    <LinearGradient
      colors={[corRecompensas.rosa50, cor.branco, corRecompensas.rubi50]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: corRecompensas.rosa200,
        padding: 20,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm }}>
        <Text style={{ fontSize: 24 }}>👭</Text>
        <Text
          style={{ flex: 1, fontFamily: fonte.titulo, fontSize: 14, color: corRecompensas.rosa700 }}
        >
          Indique uma amiga → {RECOMPENSA_DA_INDICACAO} 🌱
        </Text>
        {ind.amigas > 0 ? (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: corRecompensas.rosa100,
              paddingHorizontal: espaco.md,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corRecompensas.rosa700 }}>
              {ind.amigas} {ind.amigas === 1 ? "amiga" : "amigas"} 💞
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={estilo.corpo}>
        Cada amiga que criar a conta pelo seu link te dá{" "}
        <Text style={{ fontFamily: fonte.forte }}>{RECOMPENSA_DA_INDICACAO} Sementinhas</Text>. Sem
        limite de amigas 💜
      </Text>
      <View
        style={{
          marginTop: espaco.md,
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.sm,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: cor.borda,
          backgroundColor: cor.branco,
          paddingLeft: espaco.md,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, fontFamily: fonte.normal, fontSize: 13, color: cor.textoApagado }}
        >
          {link}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Compartilhar o convite"
          onPress={() => void compartilhar()}
          style={{ minHeight: ALVO_MINIMO, justifyContent: "center", paddingHorizontal: espaco.md }}
        >
          <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: corRecompensas.rosa600 }}>
            Compartilhar
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          toque();
          /* `https://wa.me`, nunca `whatsapp://` — ver `linkDoWhatsApp`. */
          void Linking.openURL(linkDoWhatsApp(msg)).catch(() =>
            avisar("Não consegui abrir o WhatsApp."),
          );
        }}
        style={({ pressed }) => ({ marginTop: espaco.sm, opacity: pressed ? 0.85 : 1 })}
      >
        <LinearGradient
          colors={[corRecompensas.rosa500, corRecompensas.rubi500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            minHeight: ALVO_MINIMO,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
            Convidar pelo WhatsApp
          </Text>
        </LinearGradient>
      </Pressable>
    </LinearGradient>
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
    toque();
    setEnviando(true);
    const r = await mandarDepoimento(texto.trim(), nome.trim());
    setEnviando(false);
    if (r === true) {
      setDep({ texto: texto.trim(), nome: nome.trim() || null, status: "pending" });
      setEditando(false);
      vibrar("sucesso");
      avisar("Depoimento enviado! O Dr. Clóvis vai revisar 💛");
    } else {
      vibrar("erro");
      avisar(r);
    }
  }

  const selo =
    status === "approved"
      ? {
          texto: `Publicado ✓ +${RECOMPENSA_DO_DEPOIMENTO} 🌱`,
          fundo: corRecompensas.esmeralda100,
          tinta: corRecompensas.esmeralda700,
        }
      : status === "pending"
        ? {
            texto: "Em análise pelo médico ⏳",
            fundo: corRecompensas.ambar100,
            tinta: corRecompensas.ambar700,
          }
        : status === "rejected"
          ? {
              texto: "Não publicado — pode reescrever",
              fundo: corRecompensas.rubi100,
              tinta: corRecompensas.rubi600,
            }
          : null;

  return (
    <LinearGradient
      colors={[corRecompensas.violeta50, cor.branco, corRecompensas.fucsia50]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: corRecompensas.violeta200,
        padding: 20,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: espaco.sm, flexWrap: "wrap" }}
      >
        <Text style={{ fontSize: 24 }}>💬</Text>
        <Text
          style={{
            flex: 1,
            fontFamily: fonte.titulo,
            fontSize: 14,
            color: corRecompensas.violeta700,
          }}
        >
          Deixe seu depoimento
        </Text>
        {selo ? (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: selo.fundo,
              paddingHorizontal: espaco.md,
              paddingVertical: 4,
            }}
          >
            <Text style={{ fontFamily: fonte.forte, fontSize: 13, color: selo.tinta }}>
              {selo.texto}
            </Text>
          </View>
        ) : null}
      </View>
      {formulario ? (
        <>
          <Text style={estilo.corpo}>
            Conte como está sendo sua experiência 💜 Se o Dr. Clóvis aprovar, você ganha{" "}
            <Text style={{ fontFamily: fonte.forte }}>{RECOMPENSA_DO_DEPOIMENTO} Sementinhas</Text>{" "}
            e seu depoimento pode aparecer no site.
          </Text>
          <TextInput
            value={texto}
            onChangeText={(t) => setTexto(t.slice(0, 600))}
            multiline
            placeholder="Escreva aqui seu depoimento…"
            placeholderTextColor={cor.textoApagado}
            accessibilityLabel="Seu depoimento"
            style={[estilo.campo, { minHeight: 104, borderRadius: 18, textAlignVertical: "top" }]}
          />
          <TextInput
            value={nome}
            onChangeText={(t) => setNome(t.slice(0, 60))}
            placeholder="Como quer aparecer (ex.: Mariana, mamãe da Alice)"
            placeholderTextColor={cor.textoApagado}
            accessibilityLabel="Como quer aparecer"
            style={[estilo.campo, { borderRadius: 999 }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: enviando || curto }}
            disabled={enviando || curto}
            onPress={() => void enviar()}
            style={({ pressed }) => ({
              marginTop: espaco.sm,
              minHeight: ALVO_MINIMO,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: corRecompensas.violeta700,
              opacity: enviando || curto ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.branco }}>
              {enviando ? "Enviando…" : status ? "Reenviar para análise" : "Enviar depoimento"}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <View
            style={{
              marginTop: espaco.md,
              borderRadius: 18,
              backgroundColor: corRecompensas.branco70,
              padding: espaco.md,
            }}
          >
            <Text
              style={{
                fontFamily: fonte.normal,
                fontStyle: "italic",
                fontSize: 14,
                lineHeight: 21,
                color: cor.texto,
              }}
            >
              “{dep?.texto}”
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toque();
              setEditando(true);
            }}
            style={{ alignSelf: "flex-start", minHeight: ALVO_MINIMO, justifyContent: "center" }}
          >
            <Text
              style={{ fontFamily: fonte.forte, fontSize: 13, color: corRecompensas.violeta600 }}
            >
              Editar depoimento
            </Text>
          </Pressable>
        </>
      )}
    </LinearGradient>
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
    toque();
    setEnviando(true);
    const r = await aplicarOCodigo(limpo);
    setEnviando(false);
    if (r.tipo === "aplicado") {
      setAplicou(true);
      vibrar("sucesso");
      if (r.bonus > 0) {
        aoGanhar(r.bonus);
        avisar(`${r.bonus} Sementinhas de boas-vindas 🌱`);
      }
    } else if (r.tipo === "ja-tinha") {
      setAplicou(true);
    } else if (r.tipo === "invalido") {
      vibrar("erro");
      avisar("Não encontrei esse código. Confira com quem te indicou.");
    } else {
      vibrar("erro");
      avisar("Não foi possível agora. Tente de novo mais tarde.");
    }
  }

  return (
    <CartaoMaterial estilo={{ borderRadius: 24, padding: espaco.lg }}>
      <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.texto }}>
        Veio pela indicação de alguém?
      </Text>
      <Text style={estilo.miudo}>
        Coloque o código da sua médica ou da embaixadora que te trouxe e ganhe{" "}
        <Text style={{ fontFamily: fonte.media, color: cor.texto }}>
          {BONUS_INFLUENCIADORA} Sementinhas 🌱
        </Text>
        .
      </Text>
      {/* O consentimento diz o que acontece: o primeiro nome dela passa a
          aparecer numa lista da embaixadora (ver o mesmo aviso no site). */}
      <Text style={estilo.miudo}>
        Se for de uma embaixadora, ela passa a ver o seu primeiro nome numa lista, para poder te
        presentear. Nada mais do seu acompanhamento aparece para ela.
      </Text>
      <View style={{ marginTop: espaco.md, flexDirection: "row", gap: espaco.sm }}>
        <TextInput
          value={codigo}
          onChangeText={setCodigo}
          onSubmitEditing={() => void aplicar()}
          placeholder="Ex.: MARIA"
          placeholderTextColor={cor.textoApagado}
          accessibilityLabel="Código da médica ou embaixadora"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          style={[
            estilo.campo,
            { flex: 1, marginTop: 0, borderRadius: 999, backgroundColor: cor.fundo },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: enviando || codigo.trim().length < 3 }}
          disabled={enviando || codigo.trim().length < 3}
          onPress={() => void aplicar()}
          style={({ pressed }) => ({
            minHeight: ALVO_MINIMO,
            borderRadius: 999,
            paddingHorizontal: espaco.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: corRecompensas.embaixadora,
            opacity: enviando || codigo.trim().length < 3 ? 0.4 : pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: fonte.forte, fontSize: 14, color: cor.branco }}>
            {enviando ? "…" : "Aplicar"}
          </Text>
        </Pressable>
      </View>
    </CartaoMaterial>
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
    toque();
    const abrir = !aberto;
    setAberto(abrir);
    if (abrir) {
      setLista("lendo");
      void lerExtrato().then(setLista);
    }
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        onPress={alternar}
        style={({ pressed }) => ({
          minHeight: ALVO_MINIMO,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: cor.borda,
          backgroundColor: cor.branco,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ fontFamily: fonte.media, fontSize: 13, color: corRecompensas.ardosia600 }}>
          {aberto ? "Esconder" : "Ver"} minhas últimas movimentações
        </Text>
      </Pressable>
      {aberto ? (
        <View
          style={{
            marginTop: espaco.sm,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: cor.borda,
            backgroundColor: cor.branco,
            overflow: "hidden",
          }}
        >
          {lista === "lendo" ? (
            <Text style={[estilo.linhaDoExtrato, { color: cor.textoApagado }]}>Lendo…</Text>
          ) : lista === null ? (
            /* Falha não é lista vazia: "nenhuma movimentação" afirmaria algo. */
            <Text style={[estilo.linhaDoExtrato, { color: cor.textoApagado }]}>
              Não consegui ler as movimentações agora.
            </Text>
          ) : lista.length === 0 ? (
            <Text style={[estilo.linhaDoExtrato, { color: cor.textoApagado }]}>
              Nenhuma movimentação ainda.
            </Text>
          ) : (
            lista.slice(0, 8).map((l, i) => (
              <View
                key={`${l.quando}-${i}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: espaco.md,
                  paddingHorizontal: espaco.md,
                  paddingVertical: espaco.sm,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: cor.divisor,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontFamily: fonte.normal, fontSize: 13, color: cor.texto }}
                >
                  {l.motivo ?? "Movimentação"}
                </Text>
                <Text
                  style={{
                    fontFamily: fonte.normal,
                    fontSize: 13,
                    color: cor.textoApagado,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {diaMes(l.quando)}
                </Text>
                <Text
                  style={{
                    minWidth: 36,
                    textAlign: "right",
                    fontFamily: fonte.forte,
                    fontSize: 13,
                    fontVariant: ["tabular-nums"],
                    color: l.quantidade >= 0 ? corRecompensas.esmeralda600 : cor.textoApagado,
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

const estilo = {
  corpo: {
    marginTop: espaco.sm,
    fontFamily: fonte.normal,
    fontSize: 14,
    lineHeight: 22,
    color: cor.texto,
  },
  miudo: {
    marginTop: espaco.xs,
    fontFamily: fonte.normal,
    fontSize: 13,
    lineHeight: 18,
    color: cor.textoApagado,
  },
  campo: {
    marginTop: espaco.md,
    minHeight: ALVO_MINIMO,
    borderWidth: 1,
    borderColor: cor.borda,
    backgroundColor: cor.branco,
    paddingHorizontal: espaco.lg,
    paddingVertical: espaco.sm,
    fontFamily: fonte.normal,
    fontSize: 14,
    color: cor.texto,
  },
  linhaDoExtrato: {
    paddingHorizontal: espaco.md,
    paddingVertical: espaco.md,
    fontFamily: fonte.normal,
    fontSize: 13,
  },
} as const;
