/**
 * A FOTO DA NUTRIÇÃO — o que o prompt pode e não pode pedir.
 *
 * ⚠️ O risco desta régua é de TEXTO, e ele é maior que o das outras
 * ferramentas: aqui o modelo olha a comida de uma gestante de alto risco e
 * responde sobre ela. Caloria e veredito são as duas coisas que este produto
 * decidiu não ter, e as duas caberiam aqui sem ninguém reparar.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

import { CANAIS_DA_COTA } from "./cota-ia.server";
import { semComentarios } from "./sem-comentarios";

import {
  FOTO_BYTES_MAX,
  FOTO_LADO_MAX,
  IMAGEM_TIPOS,
  ehImagemAceita,
  promptDaFoto,
  promptDoPrato,
  promptDoRotulo,
  tituloDaFoto,
} from "./foto-da-nutricao";

describe("o que o prompt NUNCA pode pedir", () => {
  test("⚠️ nenhum dos dois pede caloria, dieta ou emagrecimento", () => {
    /* `nutricao-perfil.ts` cola "NUNCA proponha restrição calórica" ao número
       do ganho de peso porque solto o modelo transforma "acima da faixa" num
       plano de emagrecimento. Uma ferramenta que devolve um número de
       calorias seria a porta dos fundos daquela decisão. */
    for (const p of [promptDoPrato(), promptDoRotulo()]) {
      expect(p).toMatch(/NUNCA estime calorias/);
      expect(p).not.toMatch(/quantas calorias|estime as calorias|conte as calorias/i);
    }
  });
  test("⚠️ nenhum dos dois pede diagnóstico nem dose", () => {
    for (const p of [promptDoPrato(), promptDoRotulo()]) {
      expect(p).toMatch(/NUNCA dê diagnóstico nem prescreva dose/);
    }
  });
  test("⚠️ o prato não julga a refeição que ela já comeu", () => {
    const p = promptDoPrato();
    expect(p).toMatch(/Não julgue o que ela comeu/);
    /* A sugestão olha para a PRÓXIMA refeição — "o que faltou aqui" é cobrança
       sobre uma comida que já acabou. */
    expect(p).toMatch(/PRÓXIMA refeição/);
  });
  test("⚠️ o rótulo LÊ, e nunca decide se pode comer", () => {
    const p = promptDoRotulo();
    expect(p).toMatch(/NUNCA diga simplesmente 'pode comer' ou 'não pode comer'/);
    /* Chutar um número de um rótulo ilegível é o defeito exato que fez o
       catálogo aberto ser recusado. */
    expect(p).toMatch(/nunca chute um valor/);
  });
  test("a alergia vem PRIMEIRO na leitura do rótulo", () => {
    /* É a única coisa nesta tela que pode fazer mal de verdade, e ela chega
       pelo bloco da paciente que o servidor cola no fim do prompt. */
    const p = promptDoRotulo();
    const iAlergia = p.indexOf("alergia");
    const iTabela = p.indexOf("tabela nutricional");
    expect(iAlergia).toBeGreaterThan(-1);
    expect(iTabela).toBeGreaterThan(-1);
    expect(iAlergia).toBeLessThan(iTabela);
    expect(p).toMatch(/diga ISSO PRIMEIRO/);
  });
  test("a sugestão do prato tem teto — duas, nunca uma lista", () => {
    expect(promptDoPrato()).toMatch(/ATÉ DUAS coisas/);
    expect(promptDoPrato()).toMatch(/Nunca mais de duas/);
  });
});

describe("o arquivo que entra", () => {
  test("só o que a câmera do celular produz", () => {
    for (const t of IMAGEM_TIPOS) expect(ehImagemAceita(t)).toBe(true);
    expect(ehImagemAceita("image/jpeg; charset=utf-8")).toBe(true);
    expect(ehImagemAceita("IMAGE/JPEG")).toBe(true);
    expect(ehImagemAceita("image/heic")).toBe(false);
    expect(ehImagemAceita("application/pdf")).toBe(false);
    expect(ehImagemAceita("")).toBe(false);
    expect(ehImagemAceita(null)).toBe(false);
  });
  test("⚠️ o lado é 1024, e não os 512 do avatar", () => {
    /* A 512 o modelo não lê a tabela nutricional de um rótulo, que é texto
       miúdo — e uma leitura de rótulo que erra o número é o defeito que esta
       ferramenta existe para não ter. */
    expect(FOTO_LADO_MAX).toBe(1024);
  });
  test("o teto do servidor é folgado em relação ao que a tela manda", () => {
    /* Apertá-lo até o tamanho esperado faria a ferramenta quebrar no aparelho
       cuja câmera devolve um arquivo maior do que a redução previu. */
    expect(FOTO_BYTES_MAX).toBeGreaterThan(2 * 1024 * 1024);
  });
  test("o título diz o que ela mandou", () => {
    expect(tituloDaFoto("prato")).toMatch(/prato/i);
    expect(tituloDaFoto("rotulo")).toMatch(/rótulo/i);
    expect(promptDaFoto("prato")).toBe(promptDoPrato());
    expect(promptDaFoto("rotulo")).toBe(promptDoRotulo());
  });
});

describe("o servidor", () => {
  const API = semComentarios(readFileSync("src/routes/api/prato.ts", "utf8"));
  test("sessão ANTES de tudo — visão é a chamada mais cara do app", () => {
    const iSessao = API.indexOf("usuarioDaRequisicao");
    const iFoto = API.indexOf('formData.get("foto")');
    expect(iSessao).toBeGreaterThan(-1);
    expect(iFoto).toBeGreaterThan(iSessao);
  });
  test("⚠️ o Modo Cuidado sai da MESMA régua da conversa, e não de uma cópia", () => {
    /* `consultorioDaPaciente` falha FECHADO: perfil ilegível vale LUTO. Uma
       segunda leitura aqui faria a resposta da foto falar da gestação de quem
       acabou de perdê-la. */
    expect(API).toMatch(/consultorioDaPaciente\(usuario\.id\)/);
    expect(API).toMatch(/blocoDaNutricao\(patientId, careMode\)/);
  });
  test("⚠️ assunto desconhecido cai em PRATO, o prompt que não lê números", () => {
    expect(API).toMatch(/bruto === "rotulo" \? "rotulo" : "prato"/);
  });
  test("tipo e tamanho conferidos no SERVIDOR", () => {
    expect(API).toMatch(/foto\.size > FOTO_BYTES_MAX/);
    expect(API).toMatch(/!ehImagemAceita\(foto\.type\)/);
  });
  test("⚠️ o pensamento está DESLIGADO e a saída tem teto — a mesma decisão da conversa", () => {
    /* Numa imagem, o raciocínio ligado é o que separa três segundos de vinte;
       e a função morre em 30. Sem isto a paciente recebia um 504 sem nome. */
    expect(API).toMatch(/thinkingConfig: \{ thinkingBudget: 0 \}/);
    expect(API).toMatch(/maxOutputTokens/);
    expect(API).toMatch(/BLOCK_ONLY_HIGH/);
    expect(API).toMatch(/AbortSignal\.timeout\(/);
  });
  test("⚠️ cada falha tem NOME — nunca um 'falhou' só", () => {
    /* A garantia é o NOME existir como valor devolvido — não a forma da linha
       (um deles sai de um ternário). */
    for (const motivo of [
      "demorou",
      "rede",
      "bloqueada",
      "vazio",
      "sem_foto",
      "formato",
      "grande",
    ]) {
      expect(API).toMatch(new RegExp(`motivo[^;]*"${motivo}"`));
    }
    expect(API).toMatch(/motivo: `gemini_\$\{resposta\.status\}`/);
    expect(API).not.toMatch(/motivo: "falhou"/);
  });
  test("⚠️ `File` não é `instanceof` — o global varia por runtime", () => {
    expect(API).not.toMatch(/instanceof File/);
  });
  test("todas as partes de texto, não só a primeira", () => {
    expect(API).not.toMatch(/parts\?\.\[0\]\?\.text/);
  });
  test("a resposta sai ASSINADA para voltar ao fio da conversa", () => {
    expect(API).toMatch(/assinarTurno\(chave, usuario\.id, texto\)/);
    expect(API).toMatch(/json\(\{ ok: true, texto, assinatura \}\)/);
  });
  test("⚠️ resposta vazia é ERRO, nunca sucesso mudo", () => {
    /* Sem isto a bolha renderiza "…" para sempre — o defeito que a conversa
       desta mesma aba já pagou. */
    expect(API).toMatch(/if \(!texto\) return json\(\{ ok: false, motivo: "vazio" \}/);
  });
  test("⚠️ mede sempre, e FORA da franquia clínica dela", () => {
    /* Visão custa uma ordem de grandeza mais que texto: três fotos de prato no
       canal da cota consumiriam a franquia de que ela precisa para perguntar
       sobre dor de cabeça com vista embaçada. A trava de
       `travas-do-servidor.test.ts` reprovou a primeira versão deste endpoint,
       e estava certa. */
    expect(API).toMatch(/registrarUsoAgora/);
    const m = API.match(/canal: "([^"]+)"/);
    expect(m).not.toBeNull();
    expect(CANAIS_DA_COTA).not.toContain(m![1]);
  });
  test("⚠️ a foto NÃO é guardada em lugar nenhum", () => {
    expect(API).not.toMatch(/\.storage\b|\.upload\(|from\("rede"\)|createSignedUrl/);
  });
  test("o limitador é muito mais apertado que o da conversa", () => {
    /* Imagem custa uma ordem de grandeza mais que texto, e o gesto real
       acontece de três em três horas. */
    const m = API.match(/makeRateLimiter\((\d+), ([^)]+)\)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(6);
  });
});

describe("a tela", () => {
  const TELA = semComentarios(readFileSync("src/components/nutricao-tab.tsx", "utf8"));
  test("⚠️ a imagem NÃO entra na conversa — vai por /api/prato", () => {
    /* É o que mantém `/api/nutrition` recebendo só texto, que é a decisão
       escrita no comentário dele. */
    expect(TELA).toMatch(/fetch\("\/api\/prato"/);
    const i = TELA.indexOf('fetch("/api/nutrition"');
    expect(i).toBeGreaterThan(-1);
    expect(TELA.slice(i, i + 400)).not.toMatch(/FormData|inline_data|foto/);
  });
  test("o que entra no histórico é o TÍTULO, nunca a foto", () => {
    expect(TELA).toMatch(/const titulo = tituloDaFoto\(assunto\);/);
  });
  test("⚠️ `{ ok: false }` chega em 200 — quem decide é o VALOR", () => {
    expect(TELA).toMatch(/if \(!res\.ok \|\| !r\?\.ok \|\| !r\.texto\)/);
  });
  test("⚠️ o valor do input é limpo ANTES de abrir a câmera", () => {
    /* Sem isso, escolher a MESMA foto duas vezes seguidas não dispara
       `change` e o toque não faz nada. */
    const i = TELA.indexOf("function escolherFoto");
    expect(i).toBeGreaterThan(-1);
    const corpo = TELA.slice(i, TELA.indexOf("\n  }", i));
    const iLimpa = corpo.indexOf('.value = ""');
    const iAbre = corpo.indexOf(".click()");
    expect(iLimpa).toBeGreaterThan(-1);
    expect(iAbre).toBeGreaterThan(iLimpa);
  });
  test("a tela DIZ que a foto não fica guardada, antes do toque", () => {
    expect(TELA).toMatch(/não fica guardada em lugar nenhum/);
  });
});

describe("⚠️ a catraca do apagador de comentários", () => {
  /* Esta armadilha já custou duas voltas neste repositório, e a segunda foi
     aqui: acrescentar `accept="image/(estrela)"` à tela CEGOU um arquivo de
     teste vizinho, que ficou vermelho sobre código que não tinha mudado. Numa
     asserção negativa ele teria ficado VERDE em silêncio, que é a direção
     perigosa. */
  const apagar = (t: string) =>
    t
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

  test("apagar comentário desta tela ENGOLE código — a prova de que a régua morde", () => {
    const cru = readFileSync("src/components/nutricao-tab.tsx", "utf8");
    /* ⚠️ A âncora é CÓDIGO que vive DEPOIS do seletor de foto — e escolhê-la
       custou uma volta: a primeira era código de ANTES dele, que o apagador
       não engole, e o teste ficou vermelho provando o contrário do que queria.
       Se um dia o `accept` sair da tela, este teste fica vermelho de novo — e
       aí a régua abaixo se revê com uma medição nova, nunca por conveniência. */
    const DEPOIS = "const a = limparAlimento(alimento);";
    expect(cru).toContain(DEPOIS);
    expect(apagar(cru)).not.toContain(DEPOIS);
  });

  test("todo teste que lê esta tela usa a régua única — nunca um apagador local", () => {
    const culpados: string[] = [];
    for (const f of readdirSync("src/lib")) {
      if (!f.endsWith(".test.ts")) continue;
      const t = readFileSync(`src/lib/${f}`, "utf8");
      /* ⚠️ Casa a CHAMADA com os parênteses, e não o nome do arquivo solto:
         a prosa deste repositório cita `nutricao-tab.tsx` em vários lugares. */
      const leituras = [
        ...t.matchAll(/(\w+)?\(?readFileSync\("src\/components\/nutricao-tab\.tsx"/g),
      ];
      for (const m of leituras) {
        const envolve = m[1];
        /* Ler CRUA é legítimo (é o que `chat-robusto` faz para fatiar o corpo
           do componente). O que não pode é passar por um apagador que não seja
           a régua única — é ele que engole o cartão da câmera inteiro. */
        if (envolve && envolve !== "semComentarios") culpados.push(`${f}:${envolve}`);
      }
    }
    expect(culpados).toEqual([]);
  });
});
