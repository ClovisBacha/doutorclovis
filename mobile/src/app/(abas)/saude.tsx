import { mesclar } from "@/lib/fila-local";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { T, Tela } from "~/componentes/base";
import { ARTES } from "~/componentes/saude/pecas";
import { ehBancada, parametroDaBancada } from "~/lib/bancada";
import { sessoesDeExemplo } from "~/lib/saude/bancada";
import { chutesDeHoje, isoNormal } from "~/lib/saude/chutes";
import { lerFila } from "~/lib/saude/armazem-de-filas";
import { chaveDaFilaDeChutes, ehSessaoPendente } from "~/lib/saude/fila";
import { inicioDoDia } from "~/lib/saude/formato";
import { ferramentasDaGestacao, NOME_DOS_MOVIMENTOS } from "~/lib/ferramentas";
import { gestacaoDoPerfil } from "~/lib/gestacao";
import { Entrada, Flutuar, Inclinacao3D } from "~/componentes/movimento";
import { useSessao } from "~/lib/sessao";
import { supabase } from "~/servidor/supabase";
import { cor, espaco, fonte, raio, sombra } from "~/tema";
import { AvisoMedico } from "~/componentes/aviso-medico";
import { PortaDaAgenda } from "~/componentes/agenda/pecas";
import { useAgenda } from "~/componentes/agenda/usar-agenda";
import { proximo } from "~/lib/agenda/agenda";
import { IA_NO_APP } from "~/config";

/**
 * O HUB DA SAÚDE: blocos grandes com a peça 3D e o dado de cada um.
 *
 * ⚠️ 21/10/2026, decisão do dono: o app é rede social + gamificação, não
 * conselho médico. Saíram daqui a triagem de sintomas e o registro de peso,
 * pressão e glicemia; o cronômetro de contrações mora no SOS. Ficam os
 * Movimentos do bebê (acompanhar o bebê) e a agenda.
 *
 * ⚠️ Leitura que falhou volta o bloco ao RÓTULO, nunca a "0": "0 chutes hoje"
 * sobre uma leitura que não aconteceu seria o app afirmando que o bebê não se
 * mexeu. E zero de verdade também volta ao rótulo — zero contagens não é zero
 * movimentos.
 *
 * Modo Cuidado: o bloco dos Movimentos SAI (é sobre o bebê).
 */

/** `undefined` = ainda lendo ou falhou → o bloco mostra o rótulo. */
type Dados = { chutes?: number };

export default function HubDaSaude() {
  const { sessao, cuidado, perfil } = useSessao();
  const semanas = gestacaoDoPerfil(perfil)?.weeks ?? null;
  const nasceu = !!perfil?.birth_date;
  const ferramentas = ferramentasDaGestacao({ semanas, cuidado, nasceu });
  const uid = sessao?.user.id ?? null;
  const [dados, setDados] = useState<Dados>({});

  const carregar = useCallback(async () => {
    if (ehBancada()) {
      if (parametroDaBancada("estado") === "falhou") {
        setDados({});
        return;
      }
      setDados({ chutes: chutesDeHoje(sessoesDeExemplo(Date.now()), Date.now()) });
      return;
    }
    if (!uid) return;
    const agora = Date.now();
    const desdeHoje = new Date(inicioDoDia(agora)).toISOString();
    const [kicks, filaK] = await Promise.all([
      supabase
        .from("kick_sessions")
        .select("started_at, ended_at, kick_count")
        .gte("started_at", desdeHoje),
      lerFila(chaveDaFilaDeChutes(uid), ehSessaoPendente),
    ]);
    const novo: Dados = {};
    if (!kicks.error && kicks.data) {
      const doServidor = (
        kicks.data as { started_at: string; ended_at: string | null; kick_count: number }[]
      ).map((k) => ({ ...k, id: k.started_at, started_at: isoNormal(k.started_at) }));
      novo.chutes = chutesDeHoje(mesclar(doServidor, filaK), agora);
    }
    setDados(novo);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar]),
  );

  const blocos: Bloco[] = [
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
    /* A Nutrição é a nutricionista com IA: some com a IA desligada. */
    ...(!IA_NO_APP
      ? []
      : [
          {
            chave: "nutricao",
            rotulo: "Nutrição",
            dado: "O que comer e beber",
            arte: "nutricao" as const,
            tinta: cor.nutricao,
            fundo: cor.nutricaoFundo,
            rota: "/nutricao",
          },
        ]),
  ];
  /* Antes das 24 semanas a grade fica vazia: diz quando os Movimentos chegam,
     em vez de deixar um buraco. No Modo Cuidado e depois do parto, nada. */
  const movimentosChegam = !cuidado && !nasceu && semanas != null && semanas < 24;

  return (
    <Tela>
      <T tipo="titulo">Saúde</T>
      {blocos.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: espaco.md }}>
          {blocos.map((b, i) => (
            <BlocoDaGrade key={b.chave} bloco={b} ordem={i} />
          ))}
        </View>
      ) : movimentosChegam ? (
        <T tipo="apagado">Os Movimentos do bebê chegam aqui na semana 24.</T>
      ) : null}
      <AgendaNaSaude />
      <AvisoMedico />
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

/** A agenda do pré-natal: a folhinha da próxima consulta, ou o convite. */
function AgendaNaSaude() {
  const { lista, pronto } = useAgenda();
  if (!pronto) return null;
  const agora = new Date();
  return <PortaDaAgenda c={proximo(lista, agora)} agora={agora} />;
}
