import { mesclar } from "@/lib/fila-local";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { ChevronRight, Siren } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { T, Tela, toque } from "~/componentes/base";
import { ARTES } from "~/componentes/saude/pecas";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { contracoesDeExemplo, registrosDeExemplo, sessoesDeExemplo } from "~/lib/saude/bancada";
import { chutesDeHoje, isoNormal } from "~/lib/saude/chutes";
import { resumoDeContracoes } from "~/lib/saude/contracoes";
import { lerFila } from "~/lib/saude/armazem-de-filas";
import {
  chaveDaFilaDeChutes,
  chaveDaFilaDeContracoes,
  ehContracaoPendente,
  ehSessaoPendente,
} from "~/lib/saude/fila";
import { inicioDoDia } from "~/lib/saude/formato";
import { resumoParaOHub, type RegistroDeSaude } from "~/lib/saude/registros";
import { ferramentasDaGestacao, NOME_DOS_MOVIMENTOS } from "~/lib/ferramentas";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { Entrada, Flutuar, Inclinacao3D } from "~/componentes/movimento";
import { useSessao } from "~/lib/sessao";
import { supabase } from "~/servidor/supabase";
import { ALVO_MINIMO, cor, espaco, fonte, raio, sombra } from "~/tema";

/**
 * O HUB DA SAÚDE: blocos grandes com a peça 3D e o dado de cada um.
 *
 * ⚠️ Leitura que falhou volta o bloco ao RÓTULO, nunca a "0": "0 chutes hoje"
 * sobre uma leitura que não aconteceu seria o app afirmando que o bebê não se
 * mexeu. E zero de verdade também volta ao rótulo — zero contagens não é zero
 * movimentos.
 *
 * Modo Cuidado: o bloco de Chutes SAI (é sobre o bebê); Contrações FICA
 * (quem perdeu a gestação pode estar em trabalho de parto).
 */

/** `undefined` = ainda lendo ou falhou → o bloco mostra o rótulo. */
type Dados = { saude?: string | null; chutes?: number; contracoes?: string | null };

export default function HubDaSaude() {
  const { sessao, cuidado, perfil } = useSessao();
  const ferramentas = ferramentasDaGestacao({
    semanas: gestacaoDoPerfil(perfil)?.weeks ?? null,
    cuidado,
    nasceu: !!perfil?.birth_date,
  });
  const uid = sessao?.user.id ?? null;
  const [dados, setDados] = useState<Dados>({});

  const carregar = useCallback(async () => {
    if (ehBancada()) {
      if (parametroDaBancada("estado") === "falhou") {
        setDados({});
        return;
      }
      const agora = Date.now();
      setDados({
        saude: resumoParaOHub(registrosDeExemplo(agora)),
        chutes: chutesDeHoje(sessoesDeExemplo(agora), agora),
        contracoes: resumoDeContracoes(contracoesDeExemplo(agora, null), agora),
      });
      return;
    }
    if (!uid) return;
    const agora = Date.now();
    const desdeHoje = new Date(inicioDoDia(agora)).toISOString();
    const [regs, kicks, contr, filaK, filaC] = await Promise.all([
      supabase
        .from("health_logs")
        .select("id, log_date, weight_kg, systolic, diastolic, glucose_mg_dl, created_at")
        .order("log_date", { ascending: false })
        .limit(20),
      supabase
        .from("kick_sessions")
        .select("started_at, ended_at, kick_count")
        .gte("started_at", desdeHoje),
      supabase
        .from("contraction_logs")
        .select("id, started_at, ended_at, intensity")
        .gte("started_at", desdeHoje),
      lerFila(chaveDaFilaDeChutes(uid), ehSessaoPendente),
      lerFila(chaveDaFilaDeContracoes(uid), ehContracaoPendente),
    ]);
    const novo: Dados = {};
    if (!regs.error && regs.data) novo.saude = resumoParaOHub(regs.data as RegistroDeSaude[]);
    if (!kicks.error && kicks.data) {
      const doServidor = (
        kicks.data as { started_at: string; ended_at: string | null; kick_count: number }[]
      ).map((k) => ({ ...k, id: k.started_at, started_at: isoNormal(k.started_at) }));
      novo.chutes = chutesDeHoje(mesclar(doServidor, filaK), agora);
    }
    if (!contr.error && contr.data) {
      const doServidor = (
        contr.data as {
          id: string;
          started_at: string;
          ended_at: string | null;
          intensity: number | null;
        }[]
      ).map((c) => ({ ...c, started_at: isoNormal(c.started_at) }));
      novo.contracoes = resumoDeContracoes(mesclar(doServidor, filaC), agora);
    }
    setDados(novo);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const blocos: Bloco[] = [
    {
      chave: "saude",
      rotulo: "Saúde",
      dado: dados.saude ?? "Peso, pressão e glicemia",
      arte: "saude",
      tinta: cor.saude,
      fundo: cor.saudeFundo,
      rota: "/saude/registros",
    },
    ...(!ferramentas.movimentos
      ? []
      : [
          {
            chave: "chutes",
            rotulo: NOME_DOS_MOVIMENTOS,
            dado: dados.chutes ? `${dados.chutes} hoje` : "Contar movimentos",
            arte: "chutes" as const,
            tinta: cor.chutes,
            fundo: cor.chutesFundo,
            rota: "/saude/chutes",
          },
        ]),
    ...(!ferramentas.contracoes
      ? []
      : [
          {
            chave: "contracoes",
            rotulo: "Contrações",
            dado: dados.contracoes ?? "Cronometrar",
            arte: "contracoes" as const,
            tinta: cor.contracoes,
            fundo: cor.contracoesFundo,
            rota: "/saude/contracoes",
          },
        ]),
    {
      chave: "nutricao",
      rotulo: "Nutrição",
      dado: "O que comer e beber",
      arte: "nutricao",
      tinta: cor.nutricao,
      fundo: cor.nutricaoFundo,
      rota: "/nutricao",
    },
  ];

  return (
    <Tela>
      <T tipo="titulo">Saúde</T>
      <BlocoDoSintoma />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.md }}>
        {blocos.map((b, i) => (
          <BlocoDaGrade key={b.chave} bloco={b} ordem={i} />
        ))}
      </View>
    </Tela>
  );
}

type Bloco = {
  chave: string;
  rotulo: string;
  dado: string;
  arte: keyof typeof ARTES;
  tinta: string;
  fundo: string;
  rota: string;
};

function BlocoDaGrade({ bloco, ordem }: { bloco: Bloco; ordem: number }) {
  /* Cada bloco é um objeto com profundidade: entra em cascata, inclina com o
     celular e afunda na direção do dedo; a peça 3D flutua no seu ritmo. */
  return (
    <Inclinacao3D
      aoTocar={() => router.push(bloco.rota as never)}
      rotuloAcessivel={`${bloco.rotulo}: ${bloco.dado}`}
      raio={raio.lg}
      estiloDeFora={{ flexBasis: "46%", flexGrow: 1 }}
      estilo={[
        {
          minHeight: 176,
          backgroundColor: bloco.fundo,
          borderRadius: raio.lg,
          padding: espaco.lg,
          justifyContent: "space-between",
        },
        sombra,
      ]}
    >
      <Entrada atraso={120 + ordem * 70}>
        <Flutuar periodo={2800 + ordem * 450} amplitude={4}>
          <Image
            source={ARTES[bloco.arte]}
            style={{ width: 76, height: 76 }}
            contentFit="contain"
          />
        </Flutuar>
      </Entrada>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 19, color: bloco.tinta }}>
          {bloco.rotulo}
        </Text>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonte.media, fontSize: 14, lineHeight: 19, color: cor.texto }}
        >
          {bloco.dado}
        </Text>
      </View>
    </Inclinacao3D>
  );
}

/** A porta da triagem: em cima de tudo, porque é a que pode ser urgente. */
function BlocoDoSintoma() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Estou com um sintoma. Veja o que fazer agora."
      onPress={() => {
        toque();
        router.push("/saude/sintomas");
      }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: espaco.md,
          minHeight: ALVO_MINIMO + 28,
          backgroundColor: cor.urgenteFundo,
          borderRadius: raio.lg,
          paddingHorizontal: espaco.lg,
          paddingVertical: espaco.md,
          borderWidth: 1,
          borderColor: cor.urgenteBorda,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: cor.urgente,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Siren size={22} color={cor.branco} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonte.titulo, fontSize: 18, color: cor.urgente }}>
          Estou com um sintoma
        </Text>
        <Text style={{ fontFamily: fonte.media, fontSize: 14, color: cor.texto }}>
          Veja o que fazer agora
        </Text>
      </View>
      <ChevronRight size={22} color={cor.urgente} />
    </Pressable>
  );
}
