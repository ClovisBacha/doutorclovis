import { MOTIVOS } from "@/lib/denuncias";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Botao, Cartao, Linha, T, toque } from "~/componentes/base";
import { Folha, LinhaDeOpcao } from "~/componentes/comunidade/folha";
import type { CartaoDaComunidade } from "@/lib/onboarding-da-comunidade";
import { PONTOS_DAS_REGRAS } from "~/lib/comunidade/regras";
import { ALVO_MINIMO, cor, espaco, fonte, raio } from "~/tema";

/** A folha "Regras da Comunidade" (Apple 1.2): tolerância zero e "Concordo". */
export function FolhaDasRegras({
  aberta,
  aoConcordar,
  aoFechar,
}: {
  aberta: boolean;
  aoConcordar: () => void;
  aoFechar: () => void;
}) {
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="Regras da Comunidade" presa>
      <T tipo="apagado">
        Antes de publicar, comentar ou reagir pela primeira vez, leia o combinado. Ele vale para
        todas, e é o que mantém este lugar seguro.
      </T>
      {PONTOS_DAS_REGRAS.map((p, i) => (
        <View
          key={p.titulo}
          style={{
            flexDirection: "row",
            gap: espaco.md,
            backgroundColor: cor.cartao,
            borderRadius: raio.md,
            padding: espaco.md,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: cor.destaque,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: fonte.titulo, fontSize: 14, color: cor.textoDestaque }}>
              {i + 1}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <T tipo="rotulo">{p.titulo}</T>
            <T tipo="apagado">{p.texto}</T>
          </View>
        </View>
      ))}
      <Botao rotulo="Concordo" aoTocar={aoConcordar} estilo={{ marginTop: espaco.sm }} />
      <Botao rotulo="Agora não" tipo="texto" aoTocar={aoFechar} />
    </Folha>
  );
}

/**
 * Os cartões de boas-vindas (texto de `@/lib/onboarding-da-comunidade`), um
 * por vez, no topo do feed. Some no "Entendi" do último e não volta.
 */
export function BoasVindas({
  cartoes,
  aoTerminar,
}: {
  cartoes: CartaoDaComunidade[];
  aoTerminar: () => void;
}) {
  const [passo, setPasso] = useState(0);
  const c = cartoes[passo];
  if (!c) return null;
  const ultimo = passo >= cartoes.length - 1;
  return (
    <Cartao fundo={cor.rosaMarca} estilo={{ marginHorizontal: espaco.lg, marginBottom: espaco.md }}>
      <Linha estilo={{ alignItems: "flex-start" }}>
        <Text style={{ fontSize: 28 }} accessible={false}>
          {c.emoji}
        </Text>
        <View style={{ flex: 1, gap: 4 }}>
          <T tipo="rotulo" cor={cor.textoDestaque}>
            {c.titulo}
          </T>
          <T tipo="apagado" cor={cor.texto}>
            {c.texto}
          </T>
        </View>
      </Linha>
      <Linha estilo={{ justifyContent: "space-between", marginTop: espaco.xs }}>
        <Linha estilo={{ gap: 6 }}>
          {cartoes.map((k, i) => (
            <View
              key={k.id}
              style={{
                width: i === passo ? 18 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === passo ? cor.primaria : cor.primariaSuave,
              }}
            />
          ))}
        </Linha>
        <Linha>
          {!ultimo ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pular as boas-vindas"
              onPress={aoTerminar}
              style={{ minHeight: ALVO_MINIMO, justifyContent: "center", paddingHorizontal: espaco.sm }}
            >
              <Text style={{ fontFamily: fonte.media, fontSize: 15, color: cor.textoApagado }}>
                Pular
              </Text>
            </Pressable>
          ) : null}
          <Botao
            rotulo={ultimo ? "Entendi" : "Continuar"}
            aoTocar={() => (ultimo ? aoTerminar() : setPasso((p) => p + 1))}
            estilo={{ paddingHorizontal: espaco.lg, minHeight: ALVO_MINIMO }}
          />
        </Linha>
      </Linha>
    </Cartao>
  );
}

/**
 * A folha de denúncia: o motivo (catálogo do site, com a explicação de cada
 * um) e o envio. Quem chama passa a função do alvo (post, perfil, comentário).
 */
export function FolhaDeDenuncia({
  aberta,
  aoFechar,
  oQue,
  aoEnviar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  oQue: string;
  aoEnviar: (motivo: string) => void;
}) {
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={`Denunciar ${oQue}`}>
      <T tipo="apagado">
        A denúncia é anônima. A equipe revê em até 24 horas e remove o que quebrar as Regras.
      </T>
      {MOTIVOS.map((m) => (
        <LinhaDeOpcao
          key={m.motivo}
          opcao={{
            rotulo: m.rotulo,
            sub: m.explica,
            aoTocar: () => {
              toque(false);
              aoEnviar(m.motivo);
            },
          }}
          aoEscolher={aoFechar}
        />
      ))}
      <LinhaDeOpcao opcao={{ rotulo: "Cancelar", aoTocar: () => {} }} aoEscolher={aoFechar} />
    </Folha>
  );
}

/** Confirmação de bloqueio — diz o que acontece antes de acontecer. */
export function FolhaDeBloqueio({
  aberta,
  aoFechar,
  nome,
  aoConfirmar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  nome: string;
  aoConfirmar: () => void;
}) {
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={`Bloquear ${nome}?`}>
      <T tipo="apagado">
        Essa pessoa deixa de ver o seu perfil e as suas publicações, e você deixa de ver as dela.
        Ninguém é avisado. Dá para desbloquear depois, no seu perfil.
      </T>
      <Botao
        rotulo="Bloquear"
        tipo="perigo"
        aoTocar={() => {
          aoFechar();
          aoConfirmar();
        }}
      />
      <Botao rotulo="Cancelar" tipo="texto" aoTocar={aoFechar} />
    </Folha>
  );
}
