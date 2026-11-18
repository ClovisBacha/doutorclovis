import { Check } from "lucide-react-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { T } from "~/componentes/base";
import { ChamaDaSequencia, IconeSementinha, TrofeuParado } from "~/componentes/caminho/pecas";
import { CompartilharConquista } from "~/componentes/jornada/cartao-de-conquista";
import { Folha } from "~/componentes/jornada/pecas";
import { CHAMA_PARA_COMPARTILHAR, cartaoDaChama } from "~/lib/jornada/cartoes";
import { BolhaViva } from "~/componentes/movimento";
import { itensDaLoja } from "~/lib/jornada/enfeites";
import { explicacaoDaChama } from "~/lib/jornada/trilha";
import { escadaDosTrofeus } from "~/lib/jornada/trofeus";
import { canto, cor, curva, escala, espaco, fonte } from "~/tema";

export type FolhaDoPlacar = null | "sementes" | "chama" | "trofeus";

/**
 * As três folhas que explicam os números do placar da trilha — a chama (com o
 * perdão), as sementinhas (o que rende quanto) e os troféus: número sem
 * explicação é número que ninguém persegue. (O placar de pílulas que as abria
 * no pós-parto saiu com a tela nova do 4º trimestre.)
 *
 * Os títulos vão sem emoji (18/11/2026): a arte do placar abre cada folha, ao
 * lado da primeira frase.
 */
export function FolhasDoPlacar({
  aberta,
  aoFechar,
  chama,
  perdoes,
  trofeus,
  pos = false,
}: {
  aberta: FolhaDoPlacar;
  aoFechar: () => void;
  chama: number;
  perdoes: number;
  trofeus: number | null;
  pos?: boolean;
}) {
  return (
    <>
      <Folha aberta={aberta === "chama"} aoFechar={aoFechar} titulo="A sua chama">
        {chama > 0 ? (
          <View style={{ alignItems: "center" }}>
            <BolhaViva humor="chama" tamanho={120} />
          </View>
        ) : null}
        {explicacaoDaChama(chama, perdoes).map((l, i) =>
          i === 0 ? (
            <ComArte key={i} arte={<ChamaDaSequencia acesa={chama > 0} tamanho={32} />}>
              <T tipo="rotulo">{l}</T>
            </ComArte>
          ) : (
            <T key={i} tipo="corpo">
              {l}
            </T>
          ),
        )}
        {chama >= CHAMA_PARA_COMPARTILHAR ? (
          <CompartilharConquista
            d={cartaoDaChama(chama, pos)}
            tinta={cor.atencao}
            fundoDoBotao={cor.atencaoFundo}
          />
        ) : null}
      </Folha>

      <Folha aberta={aberta === "sementes"} aoFechar={aoFechar} titulo="Sementinhas">
        {pos ? (
          <>
            <ComArte arte={<IconeSementinha cor={cor.sementinha} tamanho={30} />}>
              <T>
                No pós-parto, os momentos do dia são só seus: eles acendem a chama, sem somar
                sementinhas. O calendário continua rendendo:
              </T>
            </ComArte>
            <View style={{ gap: 6 }}>
              <LinhaDeGanho rotulo="O nascimento" valor="+100" />
              <LinhaDeGanho rotulo="Cada mês do bebê" valor="+25" />
              <LinhaDeGanho rotulo="Resgatar uma conquista" valor="+15, +40 ou +120" />
            </View>
          </>
        ) : (
          <>
            <ComArte arte={<IconeSementinha cor={cor.sementinha} tamanho={30} />}>
              <T>Você ganha sementinhas cuidando de você e aprendendo, todo dia:</T>
            </ComArte>
            <View style={{ gap: 6 }}>
              <LinhaDeGanho rotulo="Abrir a trilha no dia" valor="+5" />
              <LinhaDeGanho rotulo="A aula de hoje" valor="+5, e +3 por acerto" />
              <LinhaDeGanho rotulo="Mexer, meditar, a carta e a gratidão" valor="+5 cada" />
              <LinhaDeGanho rotulo="Fechar as cinco estrelas do dia" valor="+20" />
              <LinhaDeGanho rotulo="Resgatar uma conquista" valor="+15, +40 ou +120" />
              {/* Os marcos do calendário: o servidor paga sozinho, e a festa
                  deles abre na trilha (`FestaDoMarco`). */}
              <LinhaDeGanho rotulo="Cada semana nova da gestação" valor="+25" />
              <LinhaDeGanho rotulo="O fim de cada trimestre" valor="+100" />
            </View>
          </>
        )}
        {pos ? null : <T tipo="apagado">Os momentos valem no dia em que acontecem.</T>}
      </Folha>

      <Folha aberta={aberta === "trofeus"} aoFechar={aoFechar} titulo="Troféus">
        <ComArte arte={<TrofeuParado largura={34} />}>
          <T>
            Cada dia em que você faz as quatro atividades vira um troféu: mexer o corpo, meditar, o
            momento com o bebê e a gratidão.
          </T>
        </ComArte>
        <T tipo="apagado">
          {trofeus == null
            ? "Não conseguimos carregar a sua contagem agora."
            : trofeus === 0
              ? "O primeiro vem no dia em que as quatro se fecham."
              : `Você já tem ${trofeus} ${trofeus === 1 ? "troféu" : "troféus"}.`}
        </T>
        {/* A escada: para que os troféus servem, e quanto falta para o próximo
            degrau — antes era um número sem destino. */}
        {trofeus != null ? <EscadaDosTrofeus trofeus={trofeus} /> : null}
      </Folha>
    </>
  );
}

function EscadaDosTrofeus({ trofeus }: { trofeus: number }) {
  const { degraus, proximo } = escadaDosTrofeus(trofeus, ITENS_DA_LOJA_DO_APP);
  return (
    <View style={{ gap: espaco.sm }}>
      {degraus.map((d) => (
        <View
          key={d.trofeus}
          style={{ flexDirection: "row", alignItems: "flex-start", gap: espaco.md }}
        >
          <View
            accessible
            accessibilityLabel={`${d.trofeus} troféus${d.feito ? ", alcançado" : ""}`}
            style={{
              minWidth: 56,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: canto.pilula,
              paddingHorizontal: espaco.sm,
              paddingVertical: 4,
              backgroundColor: d.feito ? cor.jogoFundo : cor.apagado,
            }}
          >
            {d.feito ? <Check size={13} color={cor.jogo} strokeWidth={3} /> : null}
            <Text
              style={{
                ...fonte.titulo,
                ...escala.nota,
                fontVariant: ["tabular-nums"],
                color: d.feito ? cor.jogo : cor.textoApagado,
              }}
            >
              {d.trofeus}
            </Text>
          </View>
          <View style={{ flex: 1, paddingTop: 3 }}>
            {d.rotulos.map((r) => (
              <T key={r} tipo={d.feito ? "corpo" : "apagado"}>
                {r}
              </T>
            ))}
          </View>
        </View>
      ))}
      {proximo ? (
        <T tipo="rotulo" cor={cor.jogo}>
          {proximo.faltam === 1
            ? "Falta 1 dia completo para o próximo."
            : `Faltam ${proximo.faltam} dias completos para o próximo.`}
        </T>
      ) : null}
    </View>
  );
}

/** O que a lojinha do app vende (sem a loja por fase): é onde o troféu destrava a Borboleta. */
const ITENS_DA_LOJA_DO_APP = new Set(itensDaLoja([]).map((i) => i.id));

/** A arte do placar ao lado da primeira frase de uma folha (no lugar do emoji no título). */
function ComArte({ arte, children }: { arte: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: espaco.md }}>
      <View style={{ width: 36, alignItems: "center" }}>{arte}</View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function LinhaDeGanho({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: espaco.sm,
        paddingVertical: 8,
        paddingHorizontal: espaco.md,
        backgroundColor: cor.cartao,
        borderRadius: canto.campo,
        ...curva,
      }}
    >
      <Text style={{ flex: 1, ...fonte.media, ...escala.legenda, color: cor.texto }}>{rotulo}</Text>
      <Text style={{ ...fonte.forte, ...escala.legenda, color: cor.sementinha }}>{valor}</Text>
    </View>
  );
}
