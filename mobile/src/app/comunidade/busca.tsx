import { MINIMO_DA_BUSCA } from "@/lib/rede-social";
import { router } from "expo-router";
import { Search, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Carregando, NaoConsegueLer, T } from "~/componentes/base";
import { Cabecalho } from "~/componentes/comunidade/cabecalho";
import { Avatar } from "~/componentes/comunidade/imagem";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { api } from "~/lib/comunidade/api";
import type { PerfilNaTela } from "~/servidor/rede";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/**
 * BUSCAR PESSOAS.
 *
 * ⚠️ A busca só encontra perfil PÚBLICO (e nunca quem está em Modo Cuidado) —
 * é a regra do servidor, e o vazio diz isso, senão "ninguém encontrado" soa
 * como "ela não está aqui".
 */
export default function Busca() {
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
            style={{ flex: 1, minHeight: ALVO_MINIMO, fontFamily: fonte.normal, fontSize: 16, color: cor.texto }}
          />
          {termo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar a busca"
              onPress={() => setTermo("")}
              style={{ width: ALVO_MINIMO, height: ALVO_MINIMO, alignItems: "center", justifyContent: "center" }}
            >
              <X size={18} color={cor.textoApagado} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {estado === "parado" ? (
        <View style={{ paddingHorizontal: espaco.lg, gap: espaco.xs }}>
          <T tipo="apagado">Digite pelo menos {MINIMO_DA_BUSCA} letras.</T>
          <T tipo="apagado">A busca encontra só perfis públicos. Quem tem o perfil fechado não aparece aqui.</T>
        </View>
      ) : null}
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
                <Text numberOfLines={1} style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}>
                  {item.nome}
                </Text>
                <Text numberOfLines={1} style={{ fontFamily: fonte.normal, fontSize: 14, color: cor.textoApagado }}>
                  {[item.handle ? `@${item.handle}` : null, item.bio].filter(Boolean).join(" · ")}
                </Text>
              </View>
              {item.meuVinculo === "ativo" ? (
                <Text style={{ fontFamily: fonte.media, fontSize: 13, color: cor.textoApagado }}>Seguindo</Text>
              ) : null}
            </Pressable>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}
