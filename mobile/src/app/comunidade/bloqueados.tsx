import { useCallback, useEffect, useState } from "react";
import { FlatList, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao, Carregando, NaoConsegueLer, T } from "~/componentes/base";
import { Cabecalho } from "~/componentes/comunidade/cabecalho";
import { useAviso } from "~/componentes/comunidade/folha";
import { Avatar } from "~/componentes/comunidade/imagem";
import { api } from "~/lib/comunidade/api";
import { mensagemDoErro } from "~/lib/comunidade/regras";
import type { PessoaNaLista } from "~/servidor/rede";
import { cor, espaco, fonte } from "~/tema";

/** Quem eu bloqueei, com o desbloquear. */
export default function Bloqueados() {
  const [pessoas, setPessoas] = useState<PessoaNaLista[]>([]);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "falhou">("carregando");
  const aviso = useAviso();

  const carregar = useCallback(async () => {
    setEstado("carregando");
    const r = await api.meusBloqueados();
    if (!r.ok) {
      setEstado("falhou");
      return;
    }
    setPessoas(r.pessoas);
    setEstado("pronto");
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const desbloquear = (p: PessoaNaLista) => {
    setPessoas((x) => x.filter((k) => k.id !== p.id));
    void api.bloquear(p.id, false).then((r) => {
      if (!r.ok) {
        setPessoas((x) => [p, ...x]);
        aviso.mostrar(mensagemDoErro(r.motivo, r.recado, "perfil"), true);
        return;
      }
      aviso.mostrar("Desbloqueado. Para voltar a acompanhar, siga de novo.");
    });
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: cor.fundo }}>
      <Cabecalho titulo="Pessoas bloqueadas" />
      {estado === "carregando" ? <Carregando /> : null}
      {estado === "falhou" ? (
        <View style={{ padding: espaco.lg }}>
          <NaoConsegueLer sossego="Quem você bloqueou continua bloqueado." aoTentar={() => void carregar()} />
        </View>
      ) : null}
      {estado === "pronto" ? (
        <FlatList
          data={pessoas}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: espaco.lg, gap: espaco.md }}
          ListHeaderComponent={
            <T tipo="apagado" estilo={{ marginBottom: espaco.sm }}>
              Quem está aqui não vê o seu perfil nem as suas publicações, e você não vê as dela.
            </T>
          }
          ListEmptyComponent={<T tipo="apagado">Você não bloqueou ninguém.</T>}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
              <Avatar id={item.id} nome={item.nome} url={item.avatarUrl} tamanho={44} />
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonte.forte, fontSize: 16, color: cor.texto }}>
                {item.nome}
              </Text>
              <Botao rotulo="Desbloquear" tipo="secundario" aoTocar={() => desbloquear(item)} estilo={{ paddingHorizontal: espaco.lg }} />
            </View>
          )}
        />
      ) : null}
      {aviso.elemento}
    </SafeAreaView>
  );
}
