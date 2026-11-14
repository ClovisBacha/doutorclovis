import { Text, View } from "react-native";
import { Botao, Cartao, T, Tela } from "~/componentes/base";
import { CabecalhoDaPilha } from "~/componentes/cabecalho";
import { CONTATO_EMAIL } from "~/config";
import { DATA_DOS_TERMOS } from "~/lib/juridico/aceite";
import type { DocumentoJuridico } from "~/lib/juridico/documento";
import { abrir } from "~/lib/links";
import { cor, espaco, fonte } from "~/tema";

/**
 * Um documento jurídico do app (os Termos, a Privacidade) na tela: o resumo
 * num cartão, as seções com títulos e listas, e o contato no pé. O texto mora
 * em `lib/juridico/*` — o mesmo que vai para `docs/juridico/` e para a página
 * hospedada.
 */
export function TelaDoDocumento({ doc }: { doc: DocumentoJuridico }) {
  return (
    <Tela bordas={["top", "bottom"]}>
      <CabecalhoDaPilha titulo={doc.titulo} voltarPara="/perfil" />
      <T tipo="apagado">Versão de {DATA_DOS_TERMOS}.</T>
      <Cartao fundo={cor.destaque}>
        <T>{doc.resumo}</T>
      </Cartao>
      {doc.secoes.map((s) => (
        <View key={s.titulo} style={{ gap: espaco.sm }}>
          <T tipo="subtitulo">{s.titulo}</T>
          {s.blocos.map((b, i) =>
            typeof b === "string" ? (
              <T key={i} estilo={{ lineHeight: 23 }}>
                {b}
              </T>
            ) : (
              <View key={i} style={{ gap: 6 }}>
                {b.lista.map((item) => (
                  <View key={item} style={{ flexDirection: "row", gap: espaco.sm }}>
                    <Text style={{ fontFamily: fonte.forte, fontSize: 16, color: cor.primaria }}>
                      •
                    </Text>
                    <T estilo={{ flex: 1, lineHeight: 23 }}>{item}</T>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ))}
      <Cartao>
        <T tipo="rotulo">Dúvidas ou pedidos</T>
        <T tipo="apagado">{CONTATO_EMAIL}</T>
        <Botao
          rotulo="Escrever um e-mail"
          tipo="texto"
          aoTocar={() => abrir(`mailto:${CONTATO_EMAIL}`)}
        />
      </Cartao>
    </Tela>
  );
}
