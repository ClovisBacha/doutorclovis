import { useFocusEffect } from "expo-router";
import { ChevronRight, UserPlus } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Tocavel } from "~/componentes/base";
import { irParaAba } from "~/componentes/cabecalho";
import {
  cobrarOBonusDoDia,
  depoisDaTransicao,
  lerAmigas,
  lerPedidos,
  mudancasNasAmigas,
  type LeituraDasAmigas,
} from "~/componentes/amigas/economia";
import { Avatar } from "~/componentes/comunidade/imagem";
import { rota } from "~/componentes/jornada/bancada";
import { linhaDaDuplaNoHoje, rodaDeAmigas, rostosDaFaixa } from "~/lib/jornada/amigas";
import { mudarSelos, seloDasAmigas } from "~/lib/selos";
import { canto, cor, curva, fonte } from "~/tema";

/** Quantos rostos a linha mostra, sobrepostos. */
const ROSTOS = 3;
const ROSTO = 28;
const SOBRA = 8;
/** Releitura no foco: no máximo uma por minuto (cada volta de uma atividade é um foco). */
const RELER_DEPOIS_DE_MS = 60_000;

/**
 * AS AMIGAS NO BEBÊ — uma LINHA do grupo de atalhos da aba do bebê (18/11/2026,
 * a vistoria): sem cartão nem sombra (o grupo é que é o cartão), 64 pt, os
 * rostos de quem apareceu por último sobrepostos no lugar da ficha, e embaixo
 * o que importa hoje: "6 dias juntas com Juliana", o convite da dupla, ou os
 * nomes da roda (no pós-parto a dupla não acende, decisão do dono). Com um
 * pedido esperando, o contador framboesa toma o lugar da seta. Tudo leva à
 * aba das Amigas, onde se responde.
 *
 * O bônus da dupla (+10 sementinhas quando AS DUAS fecharam o dia) é cobrado
 * aqui também, para quem não abre a aba das Amigas — uma vez por dia, venha
 * daqui ou de lá (`cobrarOBonusDoDia`). O servidor confere e não paga duas
 * vezes.
 *
 * As leituras esperam a transição (a volta de uma atividade anima primeiro) e
 * só se repetem depois de um minuto, ou quando algo mudou nas amigas. Leitura
 * que falhou não desenha nada: é um atalho, e a aba das Amigas diz "não
 * consegui ler" no lugar certo.
 */
export function AmigasNoHoje({ pos }: { pos: boolean }) {
  const [leitura, setLeitura] = useState<LeituraDasAmigas | null>(null);
  const [pedidos, setPedidos] = useState(0);
  const [ganho, setGanho] = useState(0);
  const lidoEm = useRef(0);
  const versaoLida = useRef(-1);
  const ultimaLeitura = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const recente = Date.now() - lidoEm.current < RELER_DEPOIS_DE_MS;
      if (recente && versaoLida.current === mudancasNasAmigas()) return;
      let vivo = true;
      const tarefa = depoisDaTransicao(() => {
        const versao = mudancasNasAmigas();
        void Promise.all([lerAmigas(), lerPedidos()]).then(([l, p]) => {
          if (!vivo) return;
          /* A mesma resposta de antes não redesenha a aba do bebê. */
          const assinatura = JSON.stringify([l, p.length]);
          if (assinatura !== ultimaLeitura.current) {
            ultimaLeitura.current = assinatura;
            setLeitura(l);
            setPedidos(p.length);
          }
          if (!l) return;
          lidoEm.current = Date.now();
          versaoLida.current = versao;
          mudarSelos({ amigas: l.careMode ? 0 : seloDasAmigas(p.length, l.dupla, pos) });
          if (!pos && !l.careMode && l.dupla?.estado === "ativa") {
            void cobrarOBonusDoDia().then((g) => {
              if (vivo && g > 0) setGanho((x) => x + g);
            });
          }
        });
      });
      return () => {
        vivo = false;
        tarefa.cancel();
      };
    }, [pos]),
  );

  if (!leitura || leitura.careMode) return null;
  const { amigas, dupla } = leitura;
  const { rostos } = rostosDaFaixa(amigas, ROSTOS);
  const sub =
    linhaDaDuplaNoHoje(dupla, amigas.length > 0, pos) ??
    rodaDeAmigas(rostosDaFaixa(amigas, amigas.length).rostos.map((a) => a.nome)) ??
    "Convide uma amiga pelo seu link";
  const pedidosTexto =
    pedidos > 0 ? `${pedidos} ${pedidos === 1 ? "pedido" : "pedidos"} de amizade esperando. ` : "";

  return (
    <Tocavel
      rotulo={`Suas amigas. ${sub}. ${pedidosTexto}Abrir as Amigas`}
      aoTocar={() => irParaAba(rota("/amigas") as never)}
      estilo={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        minHeight: 64,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 14,
      }}
    >
      {rostos.length ? (
        <View style={{ flexDirection: "row" }}>
          {rostos.map((a, i) => (
            <Avatar
              key={a.id}
              id={a.id}
              nome={a.nome}
              url={a.avatarUrl}
              tamanho={ROSTO}
              anel={2}
              estilo={{ marginLeft: i === 0 ? 0 : -SOBRA, zIndex: ROSTOS - i }}
            />
          ))}
        </View>
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: canto.campo,
            ...curva,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: cor.destaque,
          }}
        >
          <UserPlus size={22} color={cor.primaria} strokeWidth={2.2} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...fonte.forte, fontSize: 16, lineHeight: 21, color: cor.texto }}>
          Suas amigas
        </Text>
        <Text
          numberOfLines={2}
          style={{
            marginTop: 1,
            ...fonte.media,
            fontSize: 14,
            lineHeight: 19,
            color: cor.textoApagado,
          }}
        >
          {sub}
        </Text>
        {ganho > 0 ? (
          <Text
            style={{
              marginTop: 1,
              ...fonte.forte,
              fontSize: 13,
              lineHeight: 18,
              color: cor.sementinha,
            }}
          >
            +{ganho} sementinhas da dupla hoje
          </Text>
        ) : null}
      </View>
      {pedidos > 0 ? (
        <View
          style={{
            minWidth: 24,
            height: 24,
            borderRadius: 12,
            paddingHorizontal: 7,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: cor.primaria,
          }}
        >
          <Text style={{ ...fonte.forte, fontSize: 13, lineHeight: 16, color: cor.branco }}>
            {pedidos > 9 ? "9+" : pedidos}
          </Text>
        </View>
      ) : (
        <ChevronRight size={18} color={cor.chevron} strokeWidth={2.4} />
      )}
    </Tocavel>
  );
}
