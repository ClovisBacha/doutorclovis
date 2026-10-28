import { ROTULO_DO_FILTRO, VAZIO_DO_FILTRO } from "@/lib/fase-parecida";
import { MINIMO_DA_BUSCA } from "@/lib/rede-social";
import { router, useLocalSearchParams } from "expo-router";
import { Search, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, Carregando, Linha, NaoConsegueLer, T } from "~/componentes/base";
import { Cabecalho } from "~/componentes/comunidade/cabecalho";
import { useAviso } from "~/componentes/comunidade/folha";
import { Avatar } from "~/componentes/comunidade/imagem";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import { mensagemDoErro, rotuloDoBotaoSeguir } from "~/lib/comunidade/regras";
import type { PerfilNaTela, PessoaNaLista } from "~/servidor/rede";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * BUSCAR PESSOAS — e, com a caixa vazia, a DESCOBERTA: "Pessoas para seguir",
 * com o filtro "Quem está numa fase parecida com a sua".
 *
 * ⚠️ A busca só encontra perfil PÚBLICO (e nunca quem está em Modo Cuidado) —
 * é a regra do servidor, e o vazio diz isso, senão "ninguém encontrado" soa
 * como "ela não está aqui".
 * ⚠️ O FILTRO DE FASE (`@/lib/fase-parecida`): nasce DESLIGADO — ligado por
 * padrão, ele viraria um dado publicado sobre terceiros. Só liga com o toque
 * dela: na chave, ou no atalho do Bebê que diz exatamente isso (`?fase=1`). O
 * rótulo fala da fase DELA ("parecida com a sua"), nunca das outras; ninguém
 * aparece marcado com a fase; e o vazio explica a régua.
 */
export default function Busca() {
  const { fase } = useLocalSearchParams<{ fase?: string }>();
  const [termo, setTermo] = useState("");
  const [perfis, setPerfis] = useState<PerfilNaTela[]>([]);
  const [estado, setEstado] = useState<"parado" | "buscando" | "pronto" | "instavel">("parado");
  const pedido = useRef(0);

  useEffect(() => {
    if (ehBancada()) setTermo(parametroDaBancada("termo") ?? "jul");
  }, []);

  const buscar = async (t: string) => {
    const n = ++pedido.current;
    setEstado("buscando");
    const r = await api.buscarPerfis(t);
    if (n !== pedido.current) return;
    if (!r.ok) {
      setEstado("instavel");
      return;
    }
    setPerfis(r.perfis);
    setEstado("pronto");
  };

  useEffect(() => {
    const t = termo.trim();
    if (t.length < MINIMO_DA_BUSCA) {
      pedido.current++;
      setEstado("parado");
      setPerfis([]);
      return;
    }
    const relogio = setTimeout(() => void buscar(t), 350);
    return () => clearTimeout(relogio);
  }, [termo]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Cabecalho titulo="Buscar pessoas" />
      <View style={{ padding: espaco.lg, paddingBottom: espaco.sm }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: espaco.sm,
            minHeight: ALVO_MINIMO + 4,
            borderRadius: raio.pilula,
            backgroundColor: cor.cartao,
            borderWidth: 1,
            borderColor: cor.borda,
            paddingLeft: espaco.lg,
          }}
        >
          <Search size={20} color={cor.textoApagado} />
          <TextInput
            value={termo}
            onChangeText={setTermo}
            autoFocus={!ehBancada()}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            placeholder="Nome ou @"
            placeholderTextColor={cor.textoApagado}
            accessibilityLabel="Buscar por nome ou @"
            style={{
              flex: 1,
              minHeight: ALVO_MINIMO,
              fontFamily: fonte.normal,
              fontSize: 16,
              color: cor.texto,
            }}
          />
          {termo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar a busca"
              onPress={() => setTermo("")}
              style={{
                width: ALVO_MINIMO,
                height: ALVO_MINIMO,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} color={cor.textoApagado} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {estado === "parado" ? <Descoberta faseNoInicio={fase === "1"} /> : null}
      {estado === "buscando" ? <Carregando texto="Buscando…" /> : null}
      {estado === "instavel" ? (
        <View style={{ paddingHorizontal: espaco.lg }}>
          <NaoConsegueLer sossego="A busca volta já." aoTentar={() => void buscar(termo.trim())} />
        </View>
      ) : null}
      {estado === "pronto" ? (
        <FlatList
          data={perfis}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: espaco.lg, paddingBottom: 80 }}
          ListEmptyComponent={
            <View style={{ gap: espaco.xs, paddingTop: espaco.sm }}>
              <T tipo="rotulo">Ninguém encontrado com “{termo.trim()}”</T>
              <T tipo="apagado">
                A busca só mostra perfis públicos. Quem tem o perfil fechado não aparece, mesmo
                procurando pelo nome certo.
              </T>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir o perfil de ${item.nome}`}
              onPress={() => router.push(`/comunidade/perfil/${item.id}`)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: espaco.md,
                paddingVertical: espaco.sm,
                minHeight: ALVO_MINIMO + 12,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Avatar id={item.id} nome={item.nome} url={item.avatarUrl} tamanho={48} />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}
                >
                  {item.nome}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}
                >
                  {[item.handle ? `@${item.handle}` : null, item.bio].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {item.meuVinculo === "ativo" ? (
                <Text style={{ fontFamily: fonte.media, fontSize: 13, color: cor.textoApagado }}>
                  Seguindo
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * A descoberta: as sugestões do servidor (perfis públicos que ela ainda não
 * segue) e o filtro de fase. O texto do vazio muda com o filtro: com ele, diz
 * a régua (`VAZIO_DO_FILTRO`); sem ele, diz o que ela pode fazer.
 */
function Descoberta({ faseNoInicio }: { faseNoInicio: boolean }) {
  const [mesmaFase, setMesmaFase] = useState(faseNoInicio);
  const [pessoas, setPessoas] = useState<PessoaNaLista[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "instavel">("carregando");
  const [vinculos, setVinculos] = useState<Record<string, PessoaNaLista["sigo"]>>({});
  const aviso = useAviso();

  const carregar = useCallback(async (comFase: boolean) => {
    setEstado("carregando");
    const r = await api.sugestoesDoFeed(comFase);
    if (!r.ok) {
      setEstado("instavel");
      return;
    }
    setPessoas(r.pessoas.filter((p) => !p.souEu));
    setEstado("pronto");
  }, []);

  useEffect(() => {
    void carregar(mesmaFase);
  }, [carregar, mesmaFase]);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: espaco.lg, paddingBottom: 80, gap: espaco.md }}
    >
      <T tipo="apagado">
        Digite pelo menos {MINIMO_DA_BUSCA} letras. A busca encontra só perfis públicos: quem tem o
        perfil fechado não aparece aqui.
      </T>
      <T tipo="subtitulo" estilo={{ marginTop: espaco.sm }}>
        Pessoas para seguir
      </T>
      <Linha estilo={{ minHeight: ALVO_MINIMO }}>
        <T tipo="rotulo" estilo={{ flex: 1 }}>
          {ROTULO_DO_FILTRO}
        </T>
        <Switch
          value={mesmaFase}
          onValueChange={setMesmaFase}
          trackColor={{ true: cor.primaria, false: cor.borda }}
          accessibilityLabel={ROTULO_DO_FILTRO}
        />
      </Linha>
      {estado === "carregando" ? <Carregando /> : null}
      {estado === "instavel" ? (
        <NaoConsegueLer
          sossego="As sugestões voltam já."
          aoTentar={() => void carregar(mesmaFase)}
        />
      ) : null}
      {estado === "pronto" && pessoas.length === 0 ? (
        <T tipo="apagado">
          {mesmaFase
            ? VAZIO_DO_FILTRO
            : "Ainda não há sugestões por aqui. Conte como você está hoje na Comunidade: é assim que as pessoas se encontram."}
        </T>
      ) : null}
      {estado === "pronto"
        ? pessoas.map((p) => {
            const v = p.id in vinculos ? vinculos[p.id] : p.sigo;
            return (
              <Linha key={p.id} estilo={{ gap: espaco.md }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir o perfil de ${p.nome}`}
                  onPress={() => router.push(`/comunidade/perfil/${p.id}`)}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: espaco.md,
                    minHeight: ALVO_MINIMO + 12,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Avatar id={p.id} nome={p.nome} url={p.avatarUrl} tamanho={48} />
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}
                    >
                      {p.nome}
                    </Text>
                    {p.bio ? (
                      <Text
                        numberOfLines={1}
                        style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}
                      >
                        {p.bio}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                <Botao
                  rotulo={rotuloDoBotaoSeguir(v)}
                  tipo={v ? "secundario" : "primario"}
                  desabilitado={!!v}
                  estilo={{ paddingHorizontal: espaco.md, minHeight: ALVO_MINIMO }}
                  aoTocar={() => {
                    void api.seguir(p.id).then((r) => {
                      if (!r.ok)
                        return aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "perfil"), true);
                      setVinculos((x) => ({ ...x, [p.id]: r.estado }));
                    });
                  }}
                />
              </Linha>
            );
          })
        : null}
      {aviso.elemento}
    </ScrollView>
  );
}
