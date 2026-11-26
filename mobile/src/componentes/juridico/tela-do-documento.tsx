import Mail from "lucide-react-native/icons/mail";
import { useRef } from "react";
import { Text, View, type ScrollView } from "react-native";
import { LinhaDeAjuste, SecaoDeAjustes } from "~/componentes/ajustes";
import { Cartao } from "~/componentes/base";
import { TelaDaPilha } from "~/componentes/cabecalho";
import { CONTATO_EMAIL } from "~/config";
import { DATA_DOS_TERMOS } from "~/lib/juridico/aceite";
import type { DocumentoJuridico } from "~/lib/juridico/documento";
import { abrir } from "~/lib/links";
import { useSessao } from "~/lib/sessao";
import { cor, escala, espaco, fonte } from "~/tema";

/**
 * Um documento jurídico do app (os Termos, a Privacidade) na tela: o resumo
 * num cartão, um ÍNDICE que leva a cada seção, as seções com títulos e
 * listas, e o contato no pé. O texto mora em `lib/juridico/*` — o mesmo que vai
 * para `docs/juridico/` e para a página hospedada — e NÃO muda aqui: esta tela
 * só o desenha.
 *
 * 18/11/2026 (a vistoria: "o documento vira uma parede de texto"): cada seção
 * respira (24 acima), o título é a serifada, e o índice rola até a seção.
 *
 * Sem sessão (aberto do cadastro ou do aceite), o voltar volta para quem abriu
 * (a casca o apresenta como folha) e é um X; com sessão, é a seta do Perfil.
 */
export function TelaDoDocumento({ doc }: { doc: DocumentoJuridico }) {
  const { sessao } = useSessao();
  const rolagem = useRef<ScrollView>(null);
  const posicoes = useRef<Record<string, number>>({});

  function irPara(titulo: string) {
    const y = posicoes.current[titulo];
    if (y == null) return;
    rolagem.current?.scrollTo({ y: Math.max(0, y - espaco.sm), animated: true });
  }

  return (
    <TelaDaPilha
      titulo={doc.titulo}
      grande
      voltarPara={sessao ? "/perfil" : "/entrar"}
      fechar={!sessao}
      refDaRolagem={rolagem}
    >
      <View style={{ gap: espaco.md }}>
        <Text style={{ ...fonte.normal, ...escala.nota, color: cor.textoApagado }}>
          Versão de {DATA_DOS_TERMOS}.
        </Text>
        <Cartao fundo={cor.destaque}>
          <Text style={{ ...fonte.normal, ...escala.corpo, color: cor.textoDestaque }}>
            {doc.resumo}
          </Text>
        </Cartao>
      </View>

      <SecaoDeAjustes titulo="Neste documento">
        {doc.secoes.map((s) => {
          const { numero, nome } = partir(s.titulo);
          return (
            <LinhaDeAjuste
              key={s.titulo}
              titulo={nome}
              rotulo={s.titulo}
              dica="Vai até a seção"
              esquerda={
                <Text
                  style={{
                    ...fonte.titulo,
                    ...escala.legenda,
                    color: cor.textoApagado,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {numero ?? "·"}
                </Text>
              }
              aoTocar={() => irPara(s.titulo)}
            />
          );
        })}
      </SecaoDeAjustes>

      {doc.secoes.map((s) => (
        <View
          key={s.titulo}
          onLayout={(e) => {
            posicoes.current[s.titulo] = e.nativeEvent.layout.y;
          }}
          style={{ gap: espaco.md }}
        >
          <Text
            accessibilityRole="header"
            style={{ ...fonte.display, ...escala.titulo2, letterSpacing: -0.2, color: cor.texto }}
          >
            {s.titulo}
          </Text>
          {s.blocos.map((b, i) =>
            typeof b === "string" ? (
              <Text key={i} style={{ ...fonte.normal, ...escala.corpo, color: cor.textoCorpo }}>
                {b}
              </Text>
            ) : (
              <View key={i} style={{ gap: espaco.sm }}>
                {b.lista.map((item) => (
                  <View key={item} style={{ flexDirection: "row", gap: espaco.sm + 2 }}>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        marginTop: 9,
                        backgroundColor: cor.primaria,
                      }}
                    />
                    <Text
                      style={{ flex: 1, ...fonte.normal, ...escala.corpo, color: cor.textoCorpo }}
                    >
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      ))}

      <SecaoDeAjustes titulo="Dúvidas ou pedidos" rodape={CONTATO_EMAIL}>
        <LinhaDeAjuste
          Icone={Mail}
          tinta={cor.chutes}
          titulo="Escrever para a gente"
          aoTocar={() => abrir(`mailto:${CONTATO_EMAIL}`)}
        />
      </SecaoDeAjustes>
    </TelaDaPilha>
  );
}

/** "3. O app não dá orientação médica" → o número à parte, para o índice. */
function partir(titulo: string): { numero: string | null; nome: string } {
  const m = /^(\d+)\.\s+(.*)$/.exec(titulo);
  return m ? { numero: m[1]!, nome: m[2]! } : { numero: null, nome: titulo };
}
