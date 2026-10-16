import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ARTE_DO_CONJUNTO, ARTE_DO_ITEM } from "@/components/arte-do-cantinho";
import {
  CANTINHO_COMPLETION_MIN,
  CANTINHO_COMPLETIONIST_ID,
  cantinhoCategoriasCompletas,
  isCantinhoCollectionComplete,
  type CantinhoItem,
  type CantinhoType,
} from "@/lib/cantinho";
import { CONJUNTO_POR_ID } from "@/lib/conjuntos";
import { SKIN_KEY } from "@/lib/trilha-skins";
import { faltamTrofeus, trofeusExigidos } from "@/lib/trofeus";
import { NaoConsegueLer, toque } from "~/componentes/base";
import { Confete } from "~/componentes/jornada/pecas";
import { useJornada } from "~/componentes/jornada/usarJornada";
import { corRecompensas } from "~/componentes/recompensas/cores";
import {
  comprarItem,
  equiparOCenario,
  lerOCantinho,
  type CantinhoOk,
} from "~/componentes/recompensas/economia-do-cantinho";
import { GanheMais } from "~/componentes/recompensas/ganhe-mais";
import {
  Botao3D,
  Esqueleto,
  pares,
  SilencioDoCuidado,
  sombraDeCartao,
  vibrar,
} from "~/componentes/recompensas/pecas";
import { categoriasDaLoja, conjuntosDaLoja, itensDaLoja } from "~/lib/jornada/enfeites";
import { gravarChave } from "~/lib/jornada/loja";
import { cor, espaco, fonte } from "~/tema";

/**
 * O MEU CANTINHO — a lojinha de sementinhas do site (`CantinhoTab`, em
 * src/components/cantinho-tab.tsx), no mesmo desenho: o cartão verde com o
 * saldo, "Ganhe mais Sementinhas", os conjuntos, as fichas de categoria e a
 * grade de enfeites em escada de preço.
 *
 * O que é diferente do site, e por quê:
 *  · Sem os itens Premium e sem nenhuma porta de compra com dinheiro (a pílula
 *    do saldo abre o "Ganhe mais", e não a Loja de Sementinhas paga). Ver
 *    `itensDaLoja`.
 *  · Sem o "Céu do app": ele veste a tela inicial do SITE.
 *  · Os botões têm desenho de 30 px e alvo de 44 pt (`Botao3D`).
 *
 * O cantinho em si mora no Caminho: o que ela compra aqui aparece lá.
 */
export function AbaDoCantinho({
  saldo,
  cuidado,
  aoLerSaldo,
  aoMudarSaldo,
  aoVerCaminho,
  avisar,
}: {
  /** O saldo da tela (dono: Recompensas), para as duas abas concordarem. */
  saldo: number | null;
  cuidado: boolean;
  /** O saldo que a leitura do Cantinho trouxe — vale se a tela ainda não tem um. */
  aoLerSaldo: (n: number) => void;
  /** O saldo depois de uma compra ou de um bônus: este vale sempre. */
  aoMudarSaldo: (n: number) => void;
  aoVerCaminho: () => void;
  avisar: (texto: string) => void;
}) {
  /* Abre a jornada dela: a pele das bolinhas mora no blob (`dc-path-skin`). */
  const { loja } = useJornada();
  const skinAtiva =
    typeof loja.blob[SKIN_KEY] === "string" ? (loja.blob[SKIN_KEY] as string) : null;

  const [leitura, setLeitura] = useState<CantinhoOk | null | "carregando">("carregando");
  const [owned, setOwned] = useState<string[]>([]);
  const [equipado, setEquipado] = useState<string | null>(null);
  const [colecao, setColecao] = useState({ tem: 0, total: CANTINHO_COMPLETION_MIN });
  const [trofeus, setTrofeus] = useState(0);
  const [cat, setCat] = useState<CantinhoType | "all">("all");
  const [comprando, setComprando] = useState<string | null>(null);
  const [ganheAberto, setGanheAberto] = useState(false);
  const [festa, setFesta] = useState(0);

  const ler = useCallback(() => {
    setLeitura("carregando");
    void lerOCantinho().then((r) => {
      setLeitura(r);
      if (!r) return;
      setOwned(r.owned);
      setEquipado(r.equippedFundo);
      setColecao({ tem: r.collectionOwned, total: r.collectionTotal || CANTINHO_COMPLETION_MIN });
      setTrofeus(r.trofeus);
      if (!r.careMode) aoLerSaldo(r.balance);
    });
  }, [aoLerSaldo]);
  useEffect(() => {
    ler();
  }, [ler]);

  const itens = useMemo(() => itensDaLoja(owned), [owned]);
  const categorias = useMemo(() => categoriasDaLoja(itens), [itens]);
  const conjuntos = useMemo(() => conjuntosDaLoja(owned), [owned]);
  const daCategoria = useMemo(
    () => (cat === "all" ? itens : itens.filter((i) => i.type === cat)),
    [itens, cat],
  );

  /* Modo Cuidado: a prateleira inteira se cala, não só o saldo (o servidor já
     devolve nada possuído; a tela não mostra o catálogo à venda). */
  if (cuidado || (leitura && leitura !== "carregando" && leitura.careMode)) {
    return <SilencioDoCuidado />;
  }
  if (leitura === "carregando") return <Esqueleto rotulo="Carregando o Meu Cantinho" />;
  /* A falha vem ANTES da vitrine: com o saldo em zero por falha, todo preço
     viraria "faltam N 🌱" e todo item dela viraria comprável de novo. */
  if (!leitura) {
    return (
      <NaoConsegueLer
        sossego="As suas Sementinhas e os seus itens continuam lá — isso aqui é a nossa conexão."
        aoTentar={ler}
      />
    );
  }

  const possui = new Set(owned);
  const enfeitesDela = itens.filter(
    (i) => possui.has(i.id) && i.type !== "fundo" && i.type !== "tema",
  );

  async function comprar(item: CantinhoItem) {
    if (comprando) return;
    if (saldo != null && saldo < item.price) {
      avisar("Sementinhas insuficientes 🌱");
      return;
    }
    setComprando(item.id);
    const r = await comprarItem(item.id);
    setComprando(null);
    if (!r) {
      vibrar("erro");
      avisar("Não consegui comprar agora — tente de novo em instantes.");
      return;
    }
    if (r.ok) {
      aoMudarSaldo(r.balance);
      /* A Coroa e a contagem de categorias pela MESMA régua do servidor. Lê o
         `owned` do fechamento: `comprando` impede duas compras ao mesmo tempo. */
      const comEle = owned.includes(item.id) ? owned : [...owned, item.id];
      const prox =
        isCantinhoCollectionComplete(comEle) && !comEle.includes(CANTINHO_COMPLETIONIST_ID)
          ? [...comEle, CANTINHO_COMPLETIONIST_ID]
          : comEle;
      setOwned(prox);
      setColecao((c) => ({ ...c, tem: cantinhoCategoriasCompletas(prox) }));
      vibrar("sucesso");
      if (r.conjuntosNovos?.length) {
        const nomes = r.conjuntosNovos
          .map((id) => CONJUNTO_POR_ID[id]?.nome)
          .filter(Boolean)
          .join(" · ");
        setFesta((n) => n + 1);
        avisar(`Conjunto completo: ${nomes}! +${r.bonusNovo ?? 0} 🌱`);
      } else {
        avisar("Adicionado ao seu cantinho! 💛");
      }
      return;
    }
    vibrar("erro");
    avisar(r.error || "Não foi possível comprar");
    /* Só a recusa por saldo traz o saldo de verdade; nas outras o servidor
       devolve 0 por padrão, e zero sobre uma falha é uma afirmação falsa. */
    if (r.motivo === "saldo_insuficiente" && typeof r.balance === "number") aoMudarSaldo(r.balance);
    /* Comprado noutro aparelho: basta refletir (o código, nunca a frase). */
    if (r.motivo === "ja_possui") setOwned((o) => (o.includes(item.id) ? o : [...o, item.id]));
  }

  /* A pele das bolinhas NÃO vai ao servidor: mora no blob da jornada, que já
     sincroniza entre aparelhos — no site e no app, a mesma chave. */
  function usarBolinhas(id: string | null) {
    gravarChave(SKIN_KEY, id);
    avisar(id ? "Bolinhas trocadas! 🌱" : "Bolinhas de volta ao normal");
  }

  async function usarCenario(id: string | null) {
    const antes = equipado;
    setEquipado(id);
    const ok = await equiparOCenario(id);
    if (!ok) {
      setEquipado(antes);
      vibrar("erro");
      avisar("Não foi possível trocar o cenário");
      return;
    }
    avisar(id ? "Cenário aplicado! 🌄" : "Cenário removido");
  }

  return (
    <View style={{ gap: espaco.xl }}>
      {festa > 0 ? <Confete key={festa} /> : null}

      {/* Cabeçalho + saldo */}
      <LinearGradient
        colors={[corRecompensas.esmeralda50, corRecompensas.lima50]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          borderRadius: 28,
          borderWidth: 1,
          borderColor: corRecompensas.esmeralda200,
          padding: 20,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontFamily: fonte.media, fontSize: 15, color: corRecompensas.esmeralda700 }}
          >
            Meu Cantinho
          </Text>
          <Text
            style={{
              marginTop: 2,
              fontFamily: fonte.normal,
              fontSize: 14,
              lineHeight: 19,
              /* O peso mais leve do app (500) é mais largo que o 400 do site:
                 sem este aperto a frase quebra num iPhone de 393 pt. */
              letterSpacing: -0.2,
              color: corRecompensas.esmeralda800_80,
            }}
          >
            Um cantinho que cresce com você.
          </Text>
        </View>
        {/* O saldo é botão: é onde ela toca querendo saber como se ganha. No
            site abre a Loja de Sementinhas (com pacotes pagos); aqui abre o
            "Ganhe mais", logo abaixo. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            saldo == null
              ? "Ver como ganhar Sementinhas"
              : `${saldo} Sementinhas. Ver como ganhar mais`
          }
          onPress={() => {
            toque();
            setGanheAberto(true);
          }}
          hitSlop={6}
          style={({ pressed }) => ({
            minHeight: 40,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 999,
            backgroundColor: corRecompensas.branco70,
            paddingHorizontal: espaco.md,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 18 }}>🌱</Text>
          <Text
            style={{
              fontFamily: fonte.titulo,
              fontSize: 16,
              color: corRecompensas.esmeralda600,
              fontVariant: ["tabular-nums"],
            }}
          >
            {saldo ?? "—"}
          </Text>
          <Text
            style={{ fontFamily: fonte.forte, fontSize: 13, color: corRecompensas.esmeralda500 }}
          >
            +
          </Text>
        </Pressable>
      </LinearGradient>

      {/* Quem ainda não comprou nada: o convite, e o caminho até a trilha. */}
      {enfeitesDela.length === 0 ? (
        <View style={{ gap: espaco.sm, paddingHorizontal: 4 }}>
          <Text
            style={{
              fontFamily: fonte.normal,
              fontSize: 14,
              lineHeight: 20,
              color: cor.textoApagado,
            }}
          >
            Ganhe Sementinhas cuidando de você e traga vida pro seu Caminho — uma plantinha de cada
            vez. 💛
          </Text>
          <View style={{ alignSelf: "flex-start" }}>
            <Botao3D tipo="cheio" rotulo="Ver o meu Caminho →" aoTocar={aoVerCaminho} />
          </View>
        </View>
      ) : null}

      <GanheMais
        aberta={ganheAberto}
        aoAlternar={() => setGanheAberto((v) => !v)}
        aoGanhar={(n) => {
          if (saldo != null) aoMudarSaldo(saldo + n);
        }}
        avisar={avisar}
      />

      {/* OS CONJUNTOS — os completos primeiro, e a contagem é "3 de 4", que é
          estado, nunca "falta 1!", que é dívida. Só os que dá para fechar aqui:
          todo conjunto tem um item premium, então para quem nunca comprou no
          site a fileira não aparece. */}
      {conjuntos.length > 0 ? (
        <View>
          <Text style={estilo.rotuloDeSecao}>CONJUNTOS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: espaco.sm, paddingBottom: 4 }}
          >
            {conjuntos.map((p) => (
              <View
                key={p.conjunto.id}
                accessible
                accessibilityLabel={`${p.conjunto.nome}: ${p.completo ? "completo" : `${p.tem} de ${p.total}`}`}
                style={{
                  minWidth: 152,
                  maxWidth: 260,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: p.completo ? corRecompensas.esmeralda300 : cor.borda,
                  backgroundColor: p.completo
                    ? corRecompensas.esmeralda50
                    : corRecompensas.secundaria20,
                  paddingHorizontal: espaco.md,
                  paddingVertical: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {ARTE_DO_CONJUNTO[p.conjunto.id] ? (
                    <Image
                      source={ARTE_DO_CONJUNTO[p.conjunto.id] as never}
                      style={{ width: 36, height: 36 }}
                      contentFit="contain"
                    />
                  ) : (
                    <Text style={{ fontSize: 18 }}>{p.conjunto.emoji}</Text>
                  )}
                  <Text style={{ fontFamily: fonte.titulo, fontSize: 13, color: cor.texto }}>
                    {p.conjunto.nome}
                  </Text>
                </View>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: fonte.normal,
                    fontSize: 13,
                    lineHeight: 18,
                    color: cor.textoApagado,
                  }}
                >
                  {p.conjunto.descricao}
                </Text>
                <Text
                  style={{
                    marginTop: 6,
                    fontFamily: fonte.forte,
                    fontSize: 13,
                    color: p.completo ? corRecompensas.esmeralda600 : cor.textoApagado,
                  }}
                >
                  {p.completo ? "completo ✓" : `${p.tem} de ${p.total}`}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* A loja */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: espaco.sm, paddingBottom: espaco.md }}
          accessibilityRole="tablist"
        >
          {[{ key: "all" as const, label: "Tudo" }, ...categorias].map((c) => {
            const ativa = cat === c.key;
            return (
              <Pressable
                key={c.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativa }}
                onPress={() => {
                  toque();
                  setCat(c.key);
                }}
                hitSlop={{ top: 6, bottom: 6 }}
                style={{
                  minHeight: 32,
                  justifyContent: "center",
                  borderRadius: 999,
                  paddingHorizontal: espaco.lg,
                  backgroundColor: ativa ? corRecompensas.esmeralda100 : "transparent",
                }}
              >
                <Text
                  style={{
                    fontFamily: fonte.media,
                    fontSize: 13,
                    color: ativa ? corRecompensas.esmeralda700 : corRecompensas.texto60,
                  }}
                >
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ gap: espaco.md }}>
          {pares(daCategoria).map((par) => (
            <View
              key={par.map((i) => i.id).join("+")}
              style={{ flexDirection: "row", gap: espaco.md }}
            >
              {par.map((i) => (
                <Ladrilho
                  key={i.id}
                  item={i}
                  tem={possui.has(i.id)}
                  saldo={saldo}
                  trofeus={trofeus}
                  colecao={colecao}
                  emUso={i.type === "trilha" ? skinAtiva === i.id : equipado === i.id}
                  comprando={comprando === i.id}
                  aoComprar={() => void comprar(i)}
                  aoUsar={() =>
                    i.type === "trilha"
                      ? usarBolinhas(skinAtiva === i.id ? null : i.id)
                      : void usarCenario(equipado === i.id ? null : i.id)
                  }
                />
              ))}
              {par.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Um enfeite da prateleira: objeto com corpo (sombra de cartão), não só contorno. */
function Ladrilho({
  item: i,
  tem,
  saldo,
  trofeus,
  colecao,
  emUso,
  comprando,
  aoComprar,
  aoUsar,
}: {
  item: CantinhoItem;
  tem: boolean;
  saldo: number | null;
  trofeus: number;
  colecao: { tem: number; total: number };
  emUso: boolean;
  comprando: boolean;
  aoComprar: () => void;
  aoUsar: () => void;
}) {
  const coroa = i.id === CANTINHO_COMPLETIONIST_ID;
  const coroaTrancada = coroa && !tem;
  /* O troféu diz QUANDO a prateleira abre; ela continua pagando em sementinhas. */
  const exigidos = trofeusExigidos(i.id);
  const faltamTrof = tem ? 0 : faltamTrofeus(i.id, trofeus);
  /* Saldo desconhecido (`null`) não tranca nada: o servidor é quem decide. */
  const naoAlcanca = !tem && saldo != null && saldo < i.price;
  const apagado = coroaTrancada || faltamTrof > 0;
  const arte = ARTE_DO_ITEM[i.id];

  const conteudo = (
    <>
      {coroa ? <Selo texto="COLEÇÃO" fundo={corRecompensas.ambar200} lado="direita" /> : null}
      {exigidos > 0 && !tem ? (
        <Selo
          texto={`${faltamTrof > 0 ? "🔒" : "✓"} ${exigidos} 🏆`}
          fundo={corRecompensas.ambar200_85}
          lado="esquerda"
        />
      ) : null}
      {/* A caixa da arte tem a altura do site: 40 para o emoji (`text-4xl`) e
          56 para a peça 3D. Com selo no canto, ela desce um pouco — no site o
          selo cobre a ponta da arte. */}
      <View
        style={{
          height: arte ? 56 : 40,
          marginTop: coroa || (exigidos > 0 && !tem) ? 12 : 0,
          justifyContent: "center",
          opacity: apagado ? 0.4 : 1,
        }}
      >
        {arte ? (
          <Image source={arte as never} style={{ width: 56, height: 56 }} contentFit="contain" />
        ) : (
          <Text style={{ fontSize: 36, lineHeight: 42 }}>{i.emoji}</Text>
        )}
      </View>
      <Text
        numberOfLines={2}
        style={{
          marginTop: espaco.sm,
          fontFamily: fonte.media,
          fontSize: 13,
          lineHeight: 17,
          textAlign: "center",
          color: cor.texto,
        }}
      >
        {i.name}
      </Text>
      <View style={{ marginTop: espaco.sm, alignItems: "center" }}>
        {tem ? (
          i.type === "trilha" || i.type === "fundo" ? (
            <Botao3D
              tipo={emUso ? "cheio" : "claro"}
              rotulo={emUso ? "Em uso ✓" : "Usar"}
              acessivel={emUso ? `${i.name}: em uso. Tocar para tirar` : `Usar ${i.name}`}
              aoTocar={aoUsar}
            />
          ) : (
            <Botao3D tipo="claro" rotulo={coroa ? "Conquistado! 👑" : "No cantinho ✓"} />
          )
        ) : coroaTrancada ? (
          <>
            <Botao3D
              tipo="selo"
              fundo={corRecompensas.ambar100}
              tinta={corRecompensas.ambar700}
              rotulo={`🔒 ${colecao.tem}/${colecao.total} categorias`}
            />
            <Text style={estilo.legendaAmbar}>Um enfeite de cada tipo</Text>
          </>
        ) : faltamTrof > 0 ? (
          <>
            <Botao3D
              tipo="selo"
              fundo={corRecompensas.ambar100}
              tinta={corRecompensas.ambar700}
              rotulo={`🔒 faltam ${faltamTrof} 🏆`}
            />
            <Text style={estilo.legendaAmbar}>1 troféu por dia de 5 estrelas</Text>
          </>
        ) : naoAlcanca ? (
          <>
            <Botao3D
              tipo="selo"
              fundo={corRecompensas.ardosia100}
              tinta={corRecompensas.ardosia400}
              rotulo={`🌱 ${i.price}`}
              acessivel={`${i.name}, ${i.price} Sementinhas`}
            />
            {/* Quantas faltam: a diferença entre "amanhã eu compro" e "isso não
                é pra mim", sem ela fazer a conta de cabeça. */}
            <Text
              style={{
                marginTop: 4,
                fontFamily: fonte.media,
                fontSize: 13,
                color: corRecompensas.ardosia400,
              }}
            >
              faltam {i.price - (saldo ?? 0)} 🌱
            </Text>
          </>
        ) : (
          <Botao3D
            tipo="cheio"
            rotulo={comprando ? "🌱 …" : `🌱 ${i.price}`}
            acessivel={`Comprar ${i.name} por ${i.price} Sementinhas`}
            desligado={comprando}
            aoTocar={aoComprar}
          />
        )}
      </View>
    </>
  );

  const caixa = {
    flex: 1,
    alignItems: "center" as const,
    borderRadius: 16,
    borderWidth: 1,
    padding: espaco.lg,
    ...sombraDeCartao,
  };
  return coroa ? (
    <LinearGradient
      colors={[corRecompensas.ambar50, cor.branco]}
      style={[caixa, { borderColor: corRecompensas.ambar300 }]}
    >
      {conteudo}
    </LinearGradient>
  ) : (
    <View style={[caixa, { borderColor: cor.borda, backgroundColor: cor.cartao }]}>{conteudo}</View>
  );
}

function Selo({
  texto,
  fundo,
  lado,
}: {
  texto: string;
  fundo: string;
  lado: "esquerda" | "direita";
}) {
  return (
    <View
      style={{
        position: "absolute",
        top: espaco.sm,
        ...(lado === "esquerda" ? { left: espaco.sm } : { right: espaco.sm }),
        borderRadius: 999,
        backgroundColor: fundo,
        paddingHorizontal: espaco.sm,
        paddingVertical: 2,
        zIndex: 1,
      }}
    >
      <Text
        style={{
          fontFamily: fonte.forte,
          fontSize: 13,
          letterSpacing: 0.4,
          color: corRecompensas.ambar800,
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

const estilo = {
  rotuloDeSecao: {
    marginBottom: espaco.sm,
    fontFamily: fonte.forte,
    fontSize: 13,
    letterSpacing: 1,
    color: cor.textoApagado,
  },
  legendaAmbar: {
    marginTop: 4,
    fontFamily: fonte.media,
    fontSize: 13,
    textAlign: "center" as const,
    color: corRecompensas.ambar700_70,
  },
} as const;
