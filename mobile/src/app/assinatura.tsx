import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { TelaDaAssinatura } from "~/componentes/assinatura/tela";
import { vendaLigada } from "~/lib/assinatura/bancada";
import { destinoDepois } from "~/lib/assinatura/plano";
import { useSessao } from "~/lib/sessao";
import { veu } from "~/tema";

/**
 * O PLANO COMPLETO — a tela de venda (anual, mensal e vitalício, pela Apple).
 * O desenho e as regras moram em `componentes/assinatura/tela.tsx`.
 *
 * O CONTRATO com quem abre (o funil antes do cadastro, um portão, o Perfil):
 *
 *   router.replace({ pathname: "/assinatura", params: { depois: "<rota>", origem: "plano" | "portao" | "perfil" } })
 *
 * Fechar ("Agora não", o voltar) ou comprar → `router.replace(depois)`; sem
 * `depois` (ou um `depois` que não é rota do app), volta para quem abriu, e
 * sem ter para onde voltar, a trilha.
 *
 * Com a chave desligada (`ASSINATURA_NO_APP`) a tela não aparece: segue na
 * hora para o destino. No Modo Cuidado (luto), também: nunca há venda.
 * Abre sem conta (o funil vem antes do cadastro): ver `ABERTAS` em `_layout`.
 *
 * Bancada: /assinatura?bancada=1 [&gratis=1] [&semprodutos=1] [&carregando=1]
 * [&plano=1] — a bancada conta a chave como ligada (`lib/assinatura/bancada.ts`).
 */
export default function Assinatura() {
  const { depois } = useLocalSearchParams<{ depois?: string; origem?: string }>();
  const destino = destinoDepois(depois);
  const { perfil } = useSessao();

  const sair = useCallback(() => {
    if (destino) router.replace(destino as never);
    else if (router.canGoBack()) router.back();
    else router.replace("/jornada");
  }, [destino]);

  const semVenda = !vendaLigada() || perfil?.care_mode === true;
  useEffect(() => {
    if (semVenda) sair();
  }, [semVenda, sair]);

  if (semVenda) return <View style={{ flex: 1, backgroundColor: veu.fundoDoVeu }} />;
  return <TelaDaAssinatura aoSair={sair} />;
}
