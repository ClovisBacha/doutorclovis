import type { EventoClinico } from "./clinical.functions";
import { episodiosDeContracao, fraseDoEpisodio } from "./episodios-de-contracao";

/**
 * O QUE ELA REGISTROU DESDE A ÚLTIMA CONSULTA, EM TEXTO.
 *
 * ─── O QUE ISTO RESOLVE ─────────────────────────────────────────────────────
 *
 * `RegistrarConsulta` abre em branco. O médico acabou de ler, na tela ao lado,
 * que ela teve duas pressões em faixa de atenção, ganhou 1,8 kg e relatou dor
 * de cabeça — e então digita tudo de novo, de memória, num campo de texto. Ou
 * não digita, e o prontuário fica sem o contexto que existia a um centímetro
 * dali.
 *
 * ─── A LINHA QUE ESTE ARQUIVO NÃO CRUZA ─────────────────────────────────────
 *
 * Ele preenche ACHADOS — texto, história, o que ela contou. Nunca os campos de
 * MEDIDA da consulta (pressão, peso, altura uterina, BPM).
 *
 * Isso não é conservadorismo: `consultas.systolic` é o que o MÉDICO aferiu no
 * consultório. Preenchê-lo com a pressão que ela mediu em casa faria o
 * prontuário afirmar uma aferição que não aconteceu — e num processo, ou numa
 * conduta tomada meses depois por outro profissional, essa linha é lida como
 * medida de consultório. O produto inteiro já separa as duas coisas ("informados
 * por ela no app, não aferidos em consultório"); seria aqui que a separação
 * vazaria.
 *
 * Por isso tudo o que sai daqui é texto, editável, e diz de onde veio.
 */

/** O que a paciente registrou, resumido para o campo de achados. */
export function resumoParaAchados(
  eventos: EventoClinico[],
  desde: string | null,
  agora = new Date(),
): string {
  const corte = desde ? new Date(desde).getTime() : 0;
  const noPeriodo = eventos
    .filter((e) => {
      const t = new Date(e.ocorrido_em).getTime();
      return !Number.isNaN(t) && t > corte && t <= agora.getTime();
    })
    .sort((a, b) => a.ocorrido_em.localeCompare(b.ocorrido_em));

  if (noPeriodo.length === 0) return "";

  const linhas: string[] = [];
  const dia = (iso: string) =>
    new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  /* ─── PRESSÃO: O PAR, DO MESMO REGISTRO ───────────────────────────────────
     A mesma regra do gráfico. Compor a sistólica de um dia com a diastólica de
     outro inventa um par que nunca existiu — e aqui ele iria para dentro do
     prontuário, escrito. */
  const pressoes = noPeriodo.filter(
    (e) => typeof e.dados.systolic === "number" && typeof e.dados.diastolic === "number",
  );
  if (pressoes.length > 0) {
    const alteradas = pressoes.filter((e) => e.gravidade !== "normal");
    const ultima = pressoes[pressoes.length - 1];
    const texto =
      `PA em casa: ${pressoes.length} ${pressoes.length === 1 ? "registro" : "registros"}` +
      `, última ${ultima.dados.systolic}/${ultima.dados.diastolic} em ${dia(ultima.ocorrido_em)}` +
      (alteradas.length > 0
        ? ` — ${alteradas.length} fora da faixa (${alteradas
            .slice(0, 3)
            .map((e) => `${e.dados.systolic}/${e.dados.diastolic} em ${dia(e.ocorrido_em)}`)
            .join(", ")})`
        : " — todas na faixa");
    linhas.push(texto);
  }

  const pesos = noPeriodo.filter((e) => typeof e.dados.weight_kg === "number");
  if (pesos.length > 0) {
    const primeiro = Number(pesos[0].dados.weight_kg);
    const ultimo = Number(pesos[pesos.length - 1].dados.weight_kg);
    /* Só fala em variação com DOIS pesos. Com um só, "variou 0 kg" seria uma
       afirmação sobre um período que não foi medido. */
    const delta = pesos.length >= 2 ? ultimo - primeiro : null;
    linhas.push(
      `Peso: ${ultimo} kg em ${dia(pesos[pesos.length - 1].ocorrido_em)}` +
        (delta !== null
          ? ` (${delta >= 0 ? "+" : ""}${Math.round(delta * 10) / 10} kg no período)`
          : ""),
    );
  }

  const glicemias = noPeriodo.filter((e) => typeof e.dados.glucose_mg_dl === "number");
  if (glicemias.length > 0) {
    const alteradas = glicemias.filter((e) => e.gravidade !== "normal");
    const ultima = glicemias[glicemias.length - 1];
    linhas.push(
      `Glicemia: ${glicemias.length} ${glicemias.length === 1 ? "registro" : "registros"}` +
        `, última ${ultima.dados.glucose_mg_dl} mg/dL em ${dia(ultima.ocorrido_em)}` +
        (alteradas.length > 0 ? ` — ${alteradas.length} fora da faixa` : ""),
    );
  }

  const sintomas = noPeriodo.filter((e) => e.especie === "sintoma" && e.texto);
  if (sintomas.length > 0) {
    linhas.push(
      `Relatou: ${sintomas
        .slice(-4)
        .map((e) => `${e.texto} (${dia(e.ocorrido_em)})`)
        .join("; ")}`,
    );
  }

  /* ─── MOVIMENTOS: A NOITE DO ALARME, E A MUDANÇA DE FORÇA ────────────────
     ⚠️ Este bloco faltava, e ele é o que a consulta mais precisa ouvir sobre o
     contador: redução de movimentos fetais é um dos NOVE SINTOMAS VERMELHOS de
     `triage.ts`, e o texto que o médico assina não trazia uma palavra sobre
     ela. Ele lia "PA em casa: 4 registros" e nada sobre a noite em que ela
     contou duas horas sem chegar a dez.

     ⚠️ SÓ AS NOITES QUE A RÉGUA MARCOU, e nunca todas: uma paciente que conta
     todo dia geraria trinta linhas num campo que o médico lê em pé, e afogaria
     justamente a que importa. Quem separa é `gravidade`, que sai da régua única
     de `sinais-clinicos.ts` — não há limite escrito aqui. */
  const movimentos = noPeriodo.filter((e) => e.especie === "movimento");
  const semChegarADez = movimentos.filter((e) => e.gravidade !== "normal");
  if (semChegarADez.length > 0) {
    linhas.push(
      `⚠️ Movimentos: ${semChegarADez.length} ${
        semChegarADez.length === 1 ? "contagem" : "contagens"
      } sem chegar a 10 em 2h (${semChegarADez.map((e) => dia(e.ocorrido_em)).join(", ")})`,
    );
  }
  /* ⚠️ A FORÇA VAI COMO CONTAGEM, e nunca como veredito. Heazell 2017 dá aOR
     2,53 para redução de força — perto dos 2,97 da frequência —, mas nenhum
     corte de "quantas noites mais fracas importam" existe em `sinais-clinicos`,
     e inventá-lo aqui seria escrever limite clínico fora do único lugar onde
     eles moram. O que o médico recebe é o FATO com o denominador junto: 2 de 9
     é outra conversa que 2 de 2. */
  const maisFracos = movimentos.filter((e) => e.dados.forca === 1);
  if (maisFracos.length > 0) {
    linhas.push(
      `Movimentos mais fracos que o normal em ${maisFracos.length} de ${movimentos.length} ${
        movimentos.length === 1 ? "contagem" : "contagens"
      }`,
    );
  }

  /* ─── CONTRAÇÕES: O EPISÓDIO, E NÃO A CONTRAÇÃO ──────────────────────────
     ⚠️ Este bloco faltava inteiro — medido: `grep -ci contra` neste arquivo
     dava ZERO. O rascunho cobria pressão, peso, glicemia, sintomas, movimentos
     e SOS, e o cronômetro de contrações não existia no texto que o médico
     assina. A paciente que cronometrou uma noite de dor chegava à consulta
     sem nenhuma linha sobre ela.

     ⚠️ **E ELE ENTRA COMO EPISÓDIO.** Uma linha por contração encheria o campo
     com cinquenta iguais — o mesmo afogamento que a linha do tempo do
     prontuário sofria. O agrupamento é a régua única de
     `episodios-de-contracao.ts`, a mesma que o painel desenha.

     ⚠️ **NO MÁXIMO TRÊS, e as mais RECENTES.** O campo é lido em pé, e um
     histórico de dois meses de Braxton-Hicks empurraria para fora a pressão
     alterada que vem acima. O que sobra é dito ("+N episódios antes"), nunca
     cortado em silêncio — a régua da lista dela. */
  const contracoes = noPeriodo.filter((e) => e.especie === "contracao");
  if (contracoes.length > 0) {
    const episodios = episodiosDeContracao(
      contracoes.map((e) => ({
        em: e.ocorrido_em,
        intensidade: e.dados.intensidade ?? null,
        duracaoSeg: e.dados.duracao_seg ?? null,
      })),
    );
    const mostrar = episodios.slice(0, 3);
    const sobra = episodios.length - mostrar.length;
    linhas.push(
      `Contrações cronometradas: ${mostrar
        .map((ep) => `${dia(ep.inicio)} — ${fraseDoEpisodio(ep)}`)
        .join(
          "; ",
        )}${sobra > 0 ? `; +${sobra} ${sobra === 1 ? "episódio" : "episódios"} antes` : ""}`,
    );
  }

  const emergencias = noPeriodo.filter((e) => e.especie === "emergencia");
  if (emergencias.length > 0) {
    /* Emergência entra SEMPRE e por último, para ficar visível no fim do bloco:
       é a linha que não pode ser cortada por rolagem do textarea. */
    linhas.push(
      `⚠️ ${emergencias.length} ${
        emergencias.length === 1 ? "acionamento" : "acionamentos"
      } de emergência (${emergencias.map((e) => dia(e.ocorrido_em)).join(", ")})`,
    );
  }

  if (linhas.length === 0) return "";

  const cabecalho = desde
    ? `Desde a última consulta (${dia(desde)}), registrado por ela no app:`
    : "Registrado por ela no app:";
  /* O cabeçalho diz "por ela no app" e é isso que impede o bloco de ser lido
     como aferição de consultório quando alguém abrir o prontuário em 2029. */
  return [cabecalho, ...linhas.map((l) => `· ${l}`)].join("\n");
}
