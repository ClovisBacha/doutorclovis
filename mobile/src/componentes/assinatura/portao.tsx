import { router } from "expo-router";
import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Botao, Sobrelinha } from "~/componentes/base";
import {
  ColunaDaEntrada,
  FundoDaEntrada,
  LinkNoVeu,
  TextoNoVeu,
  TituloNoVeu,
} from "~/componentes/entrada";
import { FecharDeVidro } from "~/componentes/assinatura/tela";
import { rota } from "~/componentes/jornada/bancada";
import { voltarParaJornada } from "~/componentes/jornada/pecas";
import { BolhaViva, Entrada } from "~/componentes/movimento";
import { portaoLigado } from "~/lib/assinatura/bancada";
import {
  decidirPortao,
  TEXTO_DO_CONVITE,
  tituloDoConvite,
  type Recurso,
} from "~/lib/assinatura/plano";
import { usePlano } from "~/lib/assinatura/usar-plano";
import { useSessao } from "~/lib/sessao";
import { espaco, margem, veu } from "~/tema";

/**
 * O PORTÃO DO PLANO, na porta de cada atividade do plano completo (respirar,
 * os sons da noite, mexer, ler para o bebê, "Para vocês dois").
 *
 * Fica NA TELA da atividade, e não em cada botão que a abre: assim vale para
 * todo caminho (a aba do Bebê, a folha do dia, a trilha, o aviso agendado,
 * um link), sem um esquecido.
 *
 * - Com a chave desligada (`ASSINATURA_NO_APP`), devolve a atividade do jeito
 *   que ela é, sem um hook a mais: nada muda para quem usa o app.
 * - No Modo Cuidado (luto), a atividade abre: nunca há venda para quem perdeu
 *   o bebê.
 * - Sem o plano, o CONVITE: gentil, com o que continua aberto, o "Conhecer o
 *   plano completo" (a tela de venda por cima) e o "Agora não".
 *
 * Comprou lá na tela de venda? Ela volta para cá, e o portão já abre a
 * atividade (o estado do plano é um só, `usePlano`).
 */
export function PortaoDoPlano({ recurso, children }: { recurso: Recurso; children: ReactNode }) {
  if (!portaoLigado()) return <>{children}</>;
  return <PortaoLigado recurso={recurso}>{children}</PortaoLigado>;
}

function PortaoLigado({ recurso, children }: { recurso: Recurso; children: ReactNode }) {
  const { cuidado, perfil } = useSessao();
  const plano = usePlano();
  const decisao = decidirPortao({
    chaveLigada: true,
    /* "Não sei ainda" conta como cuidado: o pior caso é abrir uma vez de graça. */
    emCuidado: cuidado,
    recurso,
    conhecido: plano.conhecido,
    temPlano: plano.temPlano,
  });
  if (decisao === "liberado") return <>{children}</>;
  if (decisao === "esperando") return <EsperandoOPlano />;
  return <ConviteDoPlano recurso={recurso} nomeDoBebe={perfil?.baby_name ?? null} />;
}

/** Um instante, enquanto o StoreKit responde (no máximo 4 s). */
function EsperandoOPlano() {
  return (
    <FundoDaEntrada veu="inteiro">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={veu.textoNoVeu} accessibilityLabel="Abrindo" />
      </View>
    </FundoDaEntrada>
  );
}

/**
 * O CONVITE: a Bolha apaixonada, o que esta atividade é, o que continua
 * aberto, e duas saídas claras. Sem preço aqui: o preço mora só na tela de
 * venda, vindo da Apple.
 */
export function ConviteDoPlano({
  recurso,
  nomeDoBebe,
}: {
  recurso: Recurso;
  nomeDoBebe: string | null;
}) {
  const fora = useSafeAreaInsets();
  const conhecer = () => router.push(rota("/assinatura?origem=portao") as never);
  return (
    <FundoDaEntrada veu="inteiro">
      <View
        style={{
          flex: 1,
          paddingTop: fora.top + espaco.sm,
          paddingBottom: Math.max(fora.bottom, espaco.lg),
          paddingHorizontal: margem.foco,
        }}
      >
        <ColunaDaEntrada>
          <FecharDeVidro aoTocar={voltarParaJornada} />
        </ColunaDaEntrada>
        <ColunaDaEntrada
          estilo={{ flex: 1, justifyContent: "center", alignItems: "center", gap: espaco.lg }}
        >
          <Entrada>
            <BolhaViva humor="apaixonado" tamanho={156} />
          </Entrada>
          <Entrada atraso={80} estilo={{ alignItems: "center", gap: espaco.sm }}>
            <Sobrelinha tinta={veu.textoNoVeu}>Plano completo</Sobrelinha>
            <TituloNoVeu centro nivel="titulo1">
              {tituloDoConvite(recurso, nomeDoBebe)}
            </TituloNoVeu>
            <TextoNoVeu centro>{TEXTO_DO_CONVITE}</TextoNoVeu>
          </Entrada>
        </ColunaDaEntrada>
        <ColunaDaEntrada estilo={{ gap: espaco.xs }}>
          <Botao rotulo="Conhecer o plano completo" tamanho="grande" aoTocar={conhecer} />
          <LinkNoVeu rotulo="Agora não" apagado aoTocar={voltarParaJornada} />
        </ColunaDaEntrada>
      </View>
    </FundoDaEntrada>
  );
}
