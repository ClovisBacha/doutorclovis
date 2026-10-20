import { Text, View } from "react-native";
import { T } from "~/componentes/base";
import { corJornada } from "~/componentes/jornada/cores";
import { Folha } from "~/componentes/jornada/pecas";
import { BolhaViva } from "~/componentes/movimento";
import { itensDaLoja } from "~/lib/jornada/enfeites";
import { explicacaoDaChama } from "~/lib/jornada/trilha";
import { escadaDosTrofeus } from "~/lib/jornada/trofeus";
import { cor, espaco, fonte, raio } from "~/tema";

export type FolhaDoPlacar = null | "sementes" | "chama" | "trofeus";

/**
 * As três folhas que explicam os números da faixa do Caminho — a chama (com o
 * perdão), as sementinhas (o que rende quanto) e os troféus: número sem
 * explicação é número que ninguém persegue. (O placar de pílulas que as abria
 * no pós-parto saiu com a tela nova do 4º trimestre.)
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
      <Folha aberta={aberta === "chama"} aoFechar={aoFechar} titulo="🔥 A sua chama">
        {chama > 0 ? (
          <View style={{ alignItems: "center" }}>
            <BolhaViva humor="chama" tamanho={120} />
          </View>
        ) : null}
        {explicacaoDaChama(chama, perdoes).map((l, i) => (
          <T key={i} tipo={i === 0 ? "rotulo" : "corpo"}>
            {l}
          </T>
        ))}
      </Folha>

      <Folha aberta={aberta === "sementes"} aoFechar={aoFechar} titulo="🌱 Sementinhas">
        {pos ? (
          <>
            <T>
              No pós-parto, os momentos do dia são só seus: eles acendem a chama, sem somar
              sementinhas. O calendário continua rendendo:
            </T>
            <View style={{ gap: 6 }}>
              <LinhaDeGanho rotulo="O nascimento" valor="+100" />
              <LinhaDeGanho rotulo="Cada mês do bebê" valor="+25" />
              <LinhaDeGanho rotulo="Resgatar uma conquista" valor="+15, +40 ou +120" />
            </View>
          </>
        ) : (
          <>
            <T>Você ganha sementinhas cuidando de você e aprendendo, todo dia:</T>
            <View style={{ gap: 6 }}>
              <LinhaDeGanho rotulo="Abrir a jornada no dia" valor="+5" />
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

      <Folha aberta={aberta === "trofeus"} aoFechar={aoFechar} titulo="🏆 Troféus">
        <T>
          Cada dia em que você faz as quatro atividades — mexer o corpo, meditar, o momento com o
          bebê e a gratidão — vira um troféu.
        </T>
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
            style={{
              minWidth: 52,
              borderRadius: 999,
              paddingHorizontal: espaco.sm,
              paddingVertical: 4,
              alignItems: "center",
              backgroundColor: d.feito ? corJornada.trofeuFundo : cor.apagado,
            }}
          >
            <Text
              style={{
                fontFamily: fonte.titulo,
                fontSize: 13,
                color: d.feito ? corJornada.trofeu : cor.textoApagado,
              }}
            >
              {d.feito ? "✓ " : ""}
              {d.trofeus} 🏆
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
        <T tipo="rotulo" cor={corJornada.trofeu}>
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
        borderRadius: raio.sm,
      }}
    >
      <Text style={{ flex: 1, fontFamily: fonte.media, fontSize: 15, color: cor.texto }}>
        {rotulo}
      </Text>
      <Text style={{ fontFamily: fonte.forte, fontSize: 15, color: corJornada.sementinha }}>
        {valor}
      </Text>
    </View>
  );
}
