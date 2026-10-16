import { blocosDe, type Trecho } from "@/lib/texto-leve";
import { Text, View } from "react-native";
import { cor, espaco, fonte } from "~/tema";

/**
 * Negrito e lista simples, desenhados em <Text> — nunca HTML, nunca Markdown
 * inteiro. A régua que quebra o texto em blocos é a do site (`texto-leve.ts`):
 * a mesma resposta aparece igual no site e no app.
 */
export function TextoLeve({ texto, corTexto = cor.texto }: { texto: string; corTexto?: string }) {
  const blocos = blocosDe(texto);
  const base = { fontFamily: fonte.normal, fontSize: 16, lineHeight: 23, color: corTexto };
  const trechos = (linha: Trecho[]) =>
    linha.map((t, i) => (
      <Text key={i} style={t.negrito ? { fontFamily: fonte.forte } : null}>
        {t.texto}
      </Text>
    ));
  return (
    <View style={{ gap: espaco.sm }}>
      {blocos.map((b, i) =>
        b.tipo === "paragrafo" ? (
          <Text key={i} style={base}>
            {b.linhas.map((l, j) => (
              <Text key={j}>
                {j > 0 ? "\n" : ""}
                {trechos(l)}
              </Text>
            ))}
          </Text>
        ) : (
          <View key={i} style={{ gap: 6 }}>
            {b.itens.map((item, j) => (
              <View key={j} style={{ flexDirection: "row", gap: espaco.sm }}>
                <Text style={[base, { fontFamily: fonte.forte, minWidth: 14 }]}>
                  {b.ordenada ? `${j + 1}.` : "•"}
                </Text>
                <Text style={[base, { flex: 1 }]}>{trechos(item)}</Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}
