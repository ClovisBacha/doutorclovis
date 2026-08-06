/**
 * AS TRAVAS MECÂNICAS.
 *
 * Este arquivo não testa uma funcionalidade — testa que dois padrões que já
 * mataram recursos inteiros nesta base não voltem a existir. Comentário
 * explicando "por que isto é errado" não impede ninguém: os dois padrões abaixo
 * foram diagnosticados, documentados em prosa longa, corrigidos… e
 * ressuscitaram em outro arquivo semanas depois.
 *
 * Um teste que CONTA é a única coisa que faz o número só poder cair.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import divida from "./divida-tecnica.json";
import { CANAIS_DA_COTA } from "./cota-ia.server";

/** Todo `.ts`/`.tsx` de `src/`, exceto os próprios testes. */
function arquivosDoProjeto(dir = "src", saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDoProjeto(caminho, saida);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

/** Sem comentários: a prosa deste repo cita os padrões que ela condena. */
function codigoDe(caminho: string): string {
  return readFileSync(caminho, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "");
}

/** Código que roda no SERVIDOR — é onde o congelamento acontece. */
const DO_SERVIDOR = arquivosDoProjeto().filter(
  (f) => /\.server\.ts$/.test(f) || /\.functions\.ts$/.test(f) || f.startsWith("src/routes/api/"),
);

describe("dispare-e-esqueça não volta ao servidor", () => {
  /**
   * `void (async () => {…})()` em servidor sem servidor é uma promessa que
   * ninguém guarda: a invocação congela quando a resposta sai, e o trabalho
   * morre antes de acontecer — sem erro, sem log, sem nada.
   *
   * Custou três recursos nesta base, um de cada vez:
   *
   *   · `curarLacunasSemVetor` — as lacunas nunca ganhavam vetor;
   *   · `backfillBrainEmbeddings` — as ENTRADAS nunca ganhavam vetor, e a
   *     busca semântica inteira ficou parada sem ninguém perceber;
   *   · `notifyDoctorOfGap` — o e-mail "sua IA tem perguntas sem resposta"
   *     disparava no instante mais próximo do congelamento.
   *
   * Os dois primeiros foram consertados com um comentário explicando o padrão.
   * O terceiro nasceu depois desse comentário, no mesmo arquivo.
   */
  test("todo dispare-e-esqueça de servidor é AUTORIZADO por escrito", () => {
    /* Não é proibição cega: telemetria pura (`logBrainHit`, o medidor de uso,
       a marca de chave usada) é exatamente onde disparar-e-esquecer está
       certo — perder uma linha não muda nada para ninguém, e aguardar poria
       uma escrita no caminho da resposta da paciente.
       O que o teste cobra é a DECISÃO EXPLÍCITA: quem escreve o padrão tem que
       declarar por que ele é seguro ali. Foi assim que o kit de partida do
       médico novo apareceu — ninguém decidiu que ele podia morrer, ele só
       herdou a forma do vizinho. */
    const semJustificativa = DO_SERVIDOR.filter((f) => {
      const bruto = readFileSync(f, "utf8");
      const marcas = (bruto.match(/DISPARA-E-ESQUECE AUTORIZADO/g) ?? []).length;
      /* DUAS FORMAS, e a regex só via uma. `void (async () => {…})()` é a que
         o repo escreveu três vezes; `void minhaFuncao(...)` faz exatamente a
         mesma coisa e passava livre — inclusive no `void avisarMedicoDaCota()`
         que eu tinha acabado de escrever no caminho quente do chat. */
      const codigo = codigoDe(f);
      const usos =
        (codigo.match(/void \(async \(\) =>/g) ?? []).length +
        (codigo.match(/^\s*void [a-zA-Z_$][\w$]*\(/gm) ?? []).length;
      return usos > marcas;
    });
    expect(semJustificativa).toEqual([]);
  });

  test("a lista de arquivos de servidor não está vazia (o teste testa algo)", () => {
    /* Se o filtro quebrar, o teste acima passa com zero arquivos e vira
       decoração — que é exatamente o tipo de teste que este arquivo existe
       para não ser. */
    expect(DO_SERVIDOR.length).toBeGreaterThan(20);
  });
});

/**
 * Este código grava no canal `nome`?
 *
 * Uma JANELA depois de `canal:`, e não o literal grudado: o chat escreve
 * `canal: soSuporte ? "suporte" : patient ? "app" : "site"`, e a regex exigindo
 * `canal: "app"` respondia "ninguém grava em app" — verde por não enxergar, que
 * é o pior tipo de teste verde.
 */
function gravaNoCanal(codigo: string, nome: string): boolean {
  const re = /canal:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(codigo))) {
    if (codigo.slice(m.index, m.index + 140).includes(`"${nome}"`)) return true;
  }
  return false;
}

describe("chamada paga de modelo tem que ser medida", () => {
  /**
   * ─── O DEFEITO QUE ISTO IMPEDE DE VOLTAR ─────────────────────────────────
   *
   * O agente de WhatsApp chamava `generateText` a cada mensagem de paciente e
   * NUNCA passava por `registrarUsoAgora`. O consumo daquele canal simplesmente
   * não existia em `ai_usage`: nem no card de consumo, nem em "quem consome
   * mais", nem na projeção do mês. Um consultório podia estar gastando o dobro
   * do que a tela mostrava, indefinidamente, sem um único sinal.
   *
   * E não foi por descuido de quem escreveu: o arquivo é de AGENDA, e medir uso
   * de IA "é assunto do chat". É exatamente assim que o próximo endpoint que
   * chamar um modelo vai nascer — perto do problema dele, longe deste.
   *
   * Por isso a trava é sobre o PADRÃO, não sobre o arquivo: todo `generateText`
   * / `streamText` / `generateObject` de servidor precisa ter uma medição por
   * perto, ou uma isenção escrita por quem decidiu que ali não se mede.
   */
  const CHAMADAS_DE_MODELO = /\b(generateText|streamText|generateObject|embedContent)\s*\(/g;

  test("todo modelo chamado no servidor é medido, ou tem isenção declarada", () => {
    /* Isenções legítimas existem: o próprio medidor, o gerador de embeddings
       (que já tem contabilidade própria por espécie) e o transcritor. O que a
       trava cobra é que a isenção esteja ESCRITA — a decisão aparece no diff,
       em vez de ser herdada por acidente do arquivo vizinho. */
    const semMedicao = DO_SERVIDOR.filter((f) => {
      const codigo = codigoDe(f);
      const chamadas = (codigo.match(CHAMADAS_DE_MODELO) ?? []).length;
      if (chamadas === 0) return false;
      const bruto = readFileSync(f, "utf8");
      const isencoes = (bruto.match(/SEM MEDICAO AUTORIZADO/g) ?? []).length;
      const medicoes = (codigo.match(/registrarUso(Agora)?\s*\(/g) ?? []).length;
      return medicoes + isencoes === 0;
    });
    expect(semMedicao).toEqual([]);
  });

  test("só os chats clínicos da paciente gravam num canal que a cota conta", () => {
    /* ─── O OUTRO LADO DA MOEDA ────────────────────────────────────────────
       A cota virou lista de PERMISSÃO. Isso impede um canal novo de entrar na
       franquia por omissão — mas não impede alguém de ROTULAR o canal novo com
       um dos nomes que contam, que produz o mesmo estrago numa linha de
       aparência inocente.
       Uma busca de médico ou uma carta do bebê marcadas como "app" comeriam a
       franquia de dúvidas clínicas da gestante, e ela ficaria sem resposta
       clínica por causa disso. Só os dois chats clínicos podem cobrar. */
    const PODEM_COBRAR = ["src/routes/api/chat.ts", "src/routes/api/nutrition.ts"];
    const infratores = DO_SERVIDOR.filter(
      (f) => !PODEM_COBRAR.includes(f) && CANAIS_DA_COTA.some((c) => gravaNoCanal(codigoDe(f), c)),
    );
    expect(infratores).toEqual([]);
  });

  test("cada canal da cota é gravado por alguém (a lista não é decoração)", () => {
    /* Um canal na lista que ninguém grava seria uma franquia contando algo que
       não existe — e o médico veria "0 de 500" para sempre, achando que não
       usou. Foi o que a lista de exclusões produzia ao contrário. */
    const todoCodigo = DO_SERVIDOR.map(codigoDe).join("\n");
    for (const c of CANAIS_DA_COTA) expect(gravaNoCanal(todoCodigo, c)).toBe(true);
  });

  test("a varredura acha chamadas de modelo de verdade (o teste testa algo)", () => {
    /* Se a regex parar de casar — porque a SDK renomeou, porque alguém passou a
       chamar via variável — o teste acima passa com zero arquivos e vira
       decoração. Este é o mesmo par de segurança do bloco de cima. */
    const comModelo = DO_SERVIDOR.filter((f) => CHAMADAS_DE_MODELO.test(codigoDe(f)));
    expect(comModelo.length).toBeGreaterThan(2);
  });
});

describe("o modo cuidado não pode sumir num caminho de degradação", () => {
  /**
   * `api/chat.ts` lê o perfil da paciente em DOIS lugares: a consulta rica e o
   * fallback que existe para o chat não cair quando uma coluna não foi migrada.
   *
   * O fallback é o caminho da falha — e é justamente ali que esquecer
   * `care_mode` teria o efeito de RELIGAR as semanas gestacionais para a
   * paciente em luto. O pior desfecho do produto acontecendo dentro do
   * mecanismo que existe para proteger.
   *
   * Medido: remover `care_mode` só do fallback não quebrava teste nenhum.
   */
  test("toda leitura de patient_profiles no chat traz care_mode", () => {
    const codigo = codigoDe("src/routes/api/chat.ts");
    const re = /\.from\("patient_profiles"\)/g;
    let m: RegExpExecArray | null;
    let leituras = 0;
    while ((m = re.exec(codigo))) {
      const janela = codigo.slice(m.index, m.index + 500);
      /* Só as que montam o CONTEXTO da resposta. Uma leitura de outra coisa
         (contagem, vínculo) não precisa do campo. */
      if (!janela.includes("lmp_date")) continue;
      leituras++;
      expect(janela).toContain("care_mode");
    }
    // Se a regex parar de casar, o teste passa com zero e vira decoração.
    expect(leituras).toBeGreaterThanOrEqual(2);
  });
});

describe("o Segundo Cérebro vive só no chat do app", () => {
  /**
   * Decisão de produto do Clóvis (ago/2026), e ela precisa de trava porque o
   * caminho de volta é fácil: "é só passar o bloco de estilo para o WhatsApp
   * também".
   *
   * O cérebro é conduta clínica assinada com o nome do médico, e isso pede o
   * ciclo inteiro — cobertura medida, lacuna que vira resposta, 👎 que vira
   * revisão, correção que volta para quem reclamou. Esse ciclo só existe dentro
   * do app. No WhatsApp, o cérebro gravava lacunas a partir de conversa de
   * marcação, prometia "registrei aqui para ele ver" sem ter onde entregar a
   * resposta, e não tinha 👎 nenhum.
   */
  test("o agente de WhatsApp não importa o cérebro", () => {
    const wa = readFileSync("src/lib/whatsapp-agent.server.ts", "utf8");
    expect(wa).not.toContain("secondbrain.server");
    expect(wa).not.toContain("getBrainContext");
  });
});

describe("escrita no banco não pode falhar em silêncio", () => {
  /**
   * O `supabase-js` NÃO lança quando o Postgres recusa: devolve `{ error }`.
   * Uma escrita que ignora esse campo é uma escrita que pode não ter
   * acontecido, e o código segue como se tivesse.
   *
   * O caso mais caro foi o webhook do Stripe: cinco escritas sem checagem, o
   * `catch` que devolveria 500 nunca disparando, e a Stripe recebendo 200. A
   * médica pagava, o plano não era concedido, e não havia retry.
   *
   * A contagem abaixo é um teto que só pode DESCER. Não é uma meta de zero:
   * há escritas de enriquecimento onde silêncio é a decisão certa (telemetria,
   * `logBrainHit`). O que não pode é o número subir sem ninguém olhar.
   */
  /* O TETO MORA EM ARQUIVO VERSIONADO, não numa constante aqui dentro.
     Um avaliador mutou `TETO = 66` para `500` e nenhum teste quebrou — a
     catraca podia ser afrouxada sem resistência nenhuma, e o diff de uma
     constante num arquivo de teste passa despercebido em revisão.
     Em `divida-tecnica.json`, subir o número é uma mudança deliberada, com
     data, que aparece no code review ao lado do código que a causou. */
  const TETO = (divida as { escritasSemChecagemDeError: number }).escritasSemChecagemDeError;

  function escritasSemChecagem(fonte: string): number {
    const linhas = fonte.split("\n");
    let n = 0;
    linhas.forEach((linha, i) => {
      if (!/\.(insert|upsert|update|delete)\(/.test(linha)) return;
      /* A checagem pode estar na mesma linha (`const { error } = await …`) ou
         logo abaixo (`if (error)`); oito linhas de janela cobrem as duas. */
      const janela = linhas.slice(Math.max(0, i - 6), i + 8).join("\n");
      if (/\berror\b/.test(janela) || /\bgravar\(/.test(janela)) return;
      /* `createHmac().update()`, `cipher.update()` e `Map.delete()` casam com a
         regex e não são banco — 9 dos 55 contados eram falso positivo, o que
         inflava o teto e escondia a dívida real.
         E o encadeamento quebrado em duas linhas escapava dessa checagem:
         `createHmac(...)` numa linha, `.update(raw, "utf8")` na seguinte. A
         janela para trás resolve — um `.update` que não é banco é sempre
         encadeado logo depois de quem o produziu. */
      const antes = linhas.slice(Math.max(0, i - 2), i + 1).join("\n");
      if (/createHmac|createHash|cipher|decipher|hits\.delete/.test(antes)) return;
      n++;
    });
    return n;
  }

  test("o número de escritas sem checagem não sobe", () => {
    const total = DO_SERVIDOR.reduce((soma, f) => soma + escritasSemChecagem(codigoDe(f)), 0);
    /* Se este teste falhar porque você BAIXOU o número: abaixe o teto junto.
       É a única forma de a dívida não voltar a crescer em silêncio. */
    /* IGUALDADE, não `<=`: folga é dívida pré-aprovada, e uma catraca com
       vagas livres deixa o número subir sem ninguém olhar. Baixou? Baixe o
       `divida-tecnica.json` junto — é uma linha, e é o registro de que a
       dívida diminuiu. */
    expect(total).toBe(TETO);
  });

  test("no webhook de cobrança, toda CONCESSÃO é conferida", () => {
    /* Aqui quase toda linha é dinheiro ou acesso: assinatura, plano do médico,
       premium da paciente, comissão de afiliado, +30 dias de indicação. As
       oito CONCESSÕES passam por `gravar()`, que lança e faz o handler
       devolver 500 — fazendo a Stripe reenviar.

       Sobram três, e as três estão certas assim:
       · duas em `recordPaymentIncident` — registro de uma cobrança que JÁ
         falhou. Não concedem nada, e derrubar o webhook por causa do registro
         de um incidente faria a Stripe reenviar um evento cuja parte
         importante já foi aplicada.
       · uma é a reivindicação de `referral_rewarded`, que já FALHA SEGURO: o
         resultado é lido (`data: claimed`) e, sem linha de volta, a função
         retorna sem recompensar. Checar o `error` ali não mudaria nada. */
    expect(escritasSemChecagem(codigoDe("src/routes/api/stripe-webhook.ts"))).toBeLessThanOrEqual(
      3,
    );
  });
});
