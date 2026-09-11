/**
 * A LINHA DO TEMPO CLÍNICA — a régua pura por trás do prontuário.
 *
 * ⚠️ **ELA SAIU DO COMPONENTE PORQUE A GARANTIA PRECISAVA SER EXECUTADA.**
 * `itensDaLinha` é o que impede uma noite de trabalho de parto de afogar a tela
 * do médico: a view projeta UMA LINHA POR CONTRAÇÃO e o prontuário desenha as
 * quarenta primeiras — catorze contrações bastam para a pressão alterada e a
 * pré-consulta da mesma semana saírem da tela sem nenhum sinal.
 *
 * Enterrada num `.tsx` que importa `grafico-clinico` e meia dúzia de ícones, a
 * única forma de exercitá-la era ler o FONTE e procurar palavras — e este
 * repositório registra dezesseis vezes em que um teste de texto ficou verde
 * sobre o defeito que ele existia para pegar. Aqui, `agrupar` e `não agrupar`
 * são duas listas diferentes, e o teste compara as duas.
 *
 * É a mesma lição de `analise-de-contracoes.ts`, `assinatura.ts` e
 * `gratidao.ts`: **régua pura em `lib/`, componente só desenha.**
 */
import type { EventoClinico } from "@/lib/clinical.functions";
import type { Gravidade } from "@/lib/sinais-clinicos";
import { nivelDeForca } from "@/lib/forca-do-movimento";
import { nivelDeIntensidade } from "@/lib/intensidade-da-contracao";
import { episodiosDeContracao, fraseDoEpisodio } from "@/lib/episodios-de-contracao";

export const ROTULO_ESPECIE: Record<string, string> = {
  medida: "Medida",
  sintoma: "Sintomas",
  emergencia: "SOS",
  exame: "Exame",
  contracao: "Contração",
  humor: "Humor",
  movimento: "Movimentos",
  consulta: "Pré-consulta",
  pergunta: "Pergunta",
};

export type ItemDaLinha = {
  chave: string;
  rotulo: string;
  /** ISO do instante que ordena o item. */
  em: string;
  resumo: string;
  texto?: string;
  gravidade: Gravidade;
};

/**
 * A LINHA DO TEMPO, COM AS CONTRAÇÕES AGRUPADAS EM EPISÓDIOS.
 *
 * ⚠️ **UMA NOITE DE TRABALHO DE PARTO AFOGAVA A TELA INTEIRA.** A view projeta
 * uma linha POR CONTRAÇÃO — certo, ela entrega números crus — e este render
 * mostra as quarenta primeiras. Bastava uma noite cronometrada para as
 * quarenta serem contrações, e a pressão alterada, o sintoma e a pré-consulta
 * da mesma semana saírem da tela **sem nenhum sinal de que existiam**.
 *
 * É o mesmo mecanismo que tirou `contracao` da fila de trabalho. Lá a resposta
 * foi excluir; aqui excluir esconderia dado dela, então o que se faz é o que a
 * tela DELA já fazia: ler o episódio.
 *
 * ⚠️ **A GRAVIDADE DO EPISÓDIO É A MAIOR das contrações dele.** Hoje a view
 * não classifica contração e todas saem `normal`; pegar a primeira, ou cravar
 * `normal`, faria o dia em que essa régua mudar passar em branco aqui.
 */
export function itensDaLinha(eventos: readonly EventoClinico[]): ItemDaLinha[] {
  const contracoes = eventos.filter((e) => e.especie === "contracao");
  const resto: ItemDaLinha[] = eventos
    .filter((e) => e.especie !== "contracao")
    .map((e) => ({
      chave: `${e.fonte}-${e.fonte_id}`,
      rotulo: ROTULO_ESPECIE[e.especie] ?? e.especie,
      em: e.ocorrido_em,
      resumo: resumo(e),
      texto: e.texto ?? undefined,
      gravidade: e.gravidade,
    }));

  const episodios: ItemDaLinha[] = episodiosDeContracao(
    contracoes.map((e) => ({
      em: e.ocorrido_em,
      intensidade: e.dados.intensidade ?? null,
      duracaoSeg: e.dados.duracao_seg ?? null,
    })),
  ).map((ep) => {
    const doEpisodio = contracoes.filter(
      (e) => e.ocorrido_em >= ep.inicio && e.ocorrido_em <= ep.fim,
    );
    const pior: Gravidade = doEpisodio.some((e) => e.gravidade === "grave")
      ? "grave"
      : doEpisodio.some((e) => e.gravidade === "atencao")
        ? "atencao"
        : "normal";
    return {
      /* ⚠️ A chave é o INSTANTE do fim do episódio, e não o índice: com
         índice, um episódio novo no topo remontaria a lista inteira. */
      chave: `episodio-${ep.fim}`,
      rotulo: ep.quantas === 1 ? "Contração" : "Episódio de contrações",
      em: ep.fim,
      resumo: fraseDoEpisodio(ep),
      gravidade: pior,
    };
  });

  return [...resto, ...episodios].sort((a, b) => b.em.localeCompare(a.em));
}

export function resumo(e: EventoClinico): string {
  const d = e.dados;
  const partes: string[] = [];
  if (d.systolic != null && d.diastolic != null) partes.push(`PA ${d.systolic}/${d.diastolic}`);
  if (d.glucose_mg_dl != null) {
    partes.push(`glicemia ${d.glucose_mg_dl}${d.momento ? ` (${d.momento})` : ""}`);
  }
  if (d.weight_kg != null) partes.push(`peso ${d.weight_kg} kg`);
  if (d.spo2 != null) partes.push(`SpO₂ ${d.spo2}%`);
  if (d.heart_rate_bpm != null) partes.push(`FC ${d.heart_rate_bpm} bpm`);
  if (d.sintomas?.length) partes.push(d.sintomas.join(", "));
  /* `nivel` CARREGA DOIS VOCABULÁRIOS. A view projeta na mesma chave o `level`
     de `triage_logs` (vermelho/amarelo/verde) e o de `epds_logs`
     (baixo/moderado/alto/urgente) — e isto imprimia "triagem urgente" para um
     rastreio de DEPRESSÃO, nome de outro instrumento. Um EPDS 21 com ideação
     de autoagressão aparecia no prontuário rotulado como triagem de sintomas.

     A gravidade em si sempre esteve certa (sai de `epds_q10`, não daqui); o que
     mentia era o rótulo. A fonte desempata. */
  if (d.nivel) {
    partes.push(e.fonte === "epds_logs" ? `rastreio ${d.nivel}` : `triagem ${d.nivel}`);
  }
  /* ⚠️ **A FORÇA CHEGA AQUI, e antes ela não chegava a lugar nenhum.** Ela é
     escolhida pela paciente durante a sessão, gravada em
     `kick_sessions.strength` e projetada pela view — e o prontuário mostrava
     só a CONTAGEM. Metade de um recurso: ela via o chip, ele via um número.
     Heazell 2017 dá aOR 2,53 para redução de FORÇA contra 2,97 da frequência,
     ou seja quase o mesmo peso, e o eixo mais novo era o invisível.

     ⚠️ O RÓTULO SAI DO CATÁLOGO ÚNICO, nunca de um `if` de número aqui: é o
     mesmo que a tela dela usa, e duas tabelas divergiriam no primeiro ajuste
     — com a divergência aparecendo como o painel chamando de outra coisa o
     que ela marcou. E o nível do meio CALA (`frase` nula): "como sempre" em
     toda linha afogaria as duas que carregam notícia.

     ⚠️ E ela NÃO mexe na gravidade. O limite clínico mora em
     `sinais-clinicos.ts` e não se reescreve aqui; o que este eixo faz é
     APARECER na linha do tempo, que é o que faltava. */
  if (d.chutes != null || d.forca != null || d.duracao_min != null) {
    const forca = nivelDeForca(d.forca)?.frase;
    /* ⚠️ A DURAÇÃO ENTRA NA MESMA FRASE, e ela é o que separa duas notícias
       opostas: "4 movimentos" pode ser uma sessão de cinco minutos ou o alarme
       vermelho de duas horas que a paciente acabou de ler na tela dela. */
    const tempo = d.duracao_min != null ? ` em ${d.duracao_min} min` : "";
    const base = (d.chutes != null ? `${d.chutes} movimentos` : "movimentos") + tempo;
    partes.push(forca ? `${base} (${forca})` : base);
  }
  if (d.intensidade != null) {
    /* ⚠️ **ERA "intensidade 2".** O número cru saía direto da view, e o
       catálogo Leve/Moderada/Forte morava dentro do componente da PACIENTE —
       então ela via a palavra e ele via o código. É palavra por palavra o
       defeito que a FORÇA do movimento teve (duas linhas acima) e que foi
       consertado na leva anterior, deixado de pé no vizinho.

       ⚠️ E esta linha continua existindo para a contração AVULSA: a linha do
       tempo agrupa as contrações em episódios (ver `itensDaLinha`), mas o
       bloco "desde a última consulta" ainda pode imprimir uma. */
    const nivel = nivelDeIntensidade(d.intensidade);
    partes.push(
      `contração ${nivel?.frase ?? `intensidade ${d.intensidade}`}${
        d.duracao_seg ? ` · ${d.duracao_seg}s` : ""
      }`,
    );
  }
  if (d.nome) partes.push(d.nome);
  if (d.humor) partes.push(`humor: ${d.humor}`);
  if (d.epds != null) partes.push(`EPDS ${d.epds}`);
  if (d.medicamentos) partes.push(`medicações: ${d.medicamentos}`);
  if (d.emocional) partes.push(`emocional: ${d.emocional}`);
  if (e.especie === "emergencia") partes.push("acionou o SOS");
  if (e.especie === "pergunta") partes.push(d.respondida ? "respondida" : "sem resposta");
  return partes.join(" · ") || (ROTULO_ESPECIE[e.especie] ?? "Registro");
}

/**
 * O bloco das 13h50.
 *
 * Um valor isolado não decide nada: o que decide é o que ele já sabia contra o
 * que apareceu depois. Sem consulta registrada, este bloco convida a registrar
 * a primeira — porque a alternativa (não mostrar nada) esconde que a
 * funcionalidade existe.
 */
