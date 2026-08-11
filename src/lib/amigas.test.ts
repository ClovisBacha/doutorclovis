/**
 * A ABA DAS AMIGAS — as réguas, e as três decisões que elas guardam.
 *
 * Num app de idioma, comparar é inofensivo. Aqui, comparar é comparar cuidado
 * com o próprio bebê — e uma das duas pode perder a gestação. Estes testes
 * existem para que essas decisões sobrevivam à próxima pessoa que mexer aqui:
 *
 *  1. nada clínico atravessa o perfil;
 *  2. a dupla é cooperativa (ninguém perde por causa da outra);
 *  3. o Modo Cuidado tira a pessoa da aba SEM anunciar o motivo.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  aOutra,
  diaLocal,
  diasDeAtividade,
  estadoDaDupla,
  parOrdenado,
  saneiaEnfeites,
  sequenciaDaDupla,
  tempoNoApp,
} from "./amigas";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const servidor = semComentarios("src/lib/amigas.functions.ts");
const sql = readFileSync("supabase/APLICAR_DUPLAS.sql", "utf8");

/** Uma linha de ledger de bem-estar naquele instante. */
const fez = (iso: string) => ({ dedupe_key: "wellness:movement:2026-03-07:65", created_at: iso });

describe("os dias vêm do CALENDÁRIO, não do dia gestacional", () => {
  test("a data sai do created_at", () => {
    /* Às segundas, uma pode estar no dia 65 e a outra no 190. Intersectar
       números de dia gestacional juntaria terças com sábados. */
    const dias = diasDeAtividade([fez("2026-08-10T14:00:00.000Z")]);
    expect(dias.has(diaLocal(new Date("2026-08-10T14:00:00.000Z")))).toBe(true);
  });

  test("várias atividades no mesmo dia contam UM dia", () => {
    const d = diasDeAtividade([
      fez("2026-08-10T09:00:00.000Z"),
      fez("2026-08-10T20:00:00.000Z"),
      fez("2026-08-11T09:00:00.000Z"),
    ]);
    expect(d.size).toBe(2);
  });

  test("linha que não é de bem-estar não vira dia", () => {
    /* Check-in diário e presente também moram no ledger, e nenhum dos dois é
       "ela apareceu e cuidou de si". */
    const d = diasDeAtividade([
      { dedupe_key: "checkin:2026-08-10", created_at: "2026-08-10T09:00:00.000Z" },
      { dedupe_key: "presente:m:p:tok", created_at: "2026-08-10T09:00:00.000Z" },
    ]);
    expect(d.size).toBe(0);
  });

  test("created_at ausente ou torto é descartado", () => {
    const d = diasDeAtividade([
      { dedupe_key: "wellness:movement:c:1", created_at: null },
      { dedupe_key: "wellness:movement:c:1", created_at: "ontem" },
    ]);
    expect(d.size).toBe(0);
  });
});

describe("a chama da dupla só conta o dia em que AS DUAS apareceram", () => {
  const D = (...ds: string[]) => new Set(ds);

  test("três dias seguidos das duas", () => {
    const a = D("2026-08-09", "2026-08-10", "2026-08-11");
    const b = D("2026-08-09", "2026-08-10", "2026-08-11");
    expect(sequenciaDaDupla(a, b, "2026-08-11")).toBe(3);
  });

  test("o dia em que só UMA apareceu não conta", () => {
    const a = D("2026-08-09", "2026-08-10", "2026-08-11");
    const b = D("2026-08-09", "2026-08-11");
    expect(sequenciaDaDupla(a, b, "2026-08-11")).toBe(1);
  });

  test("hoje ainda em aberto conta a partir de ONTEM", () => {
    /* O mesmo perdão da chama individual, e aqui ele importa mais: sem ele,
       cada uma abriria o app de manhã e acharia que a OUTRA deixou cair. */
    const a = D("2026-08-09", "2026-08-10");
    const b = D("2026-08-09", "2026-08-10");
    expect(sequenciaDaDupla(a, b, "2026-08-11")).toBe(2);
  });

  test("atravessa a virada do mês e do ano", () => {
    const a = D("2025-12-30", "2025-12-31", "2026-01-01");
    expect(sequenciaDaDupla(a, a, "2026-01-01")).toBe(3);
  });

  test("ninguém apareceu: zero, e não erro", () => {
    expect(sequenciaDaDupla(new Set(), new Set(), "2026-08-11")).toBe(0);
  });

  test("conjuntos enormes não viram laço infinito", () => {
    /* A contagem anda um dia por vez; sem teto, dois conjuntos coincidentes e
       grandes travariam a requisição. */
    const todos = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const d = new Date(Date.UTC(2026, 7, 11) - i * 86400000);
      todos.add(d.toISOString().slice(0, 10));
    }
    expect(sequenciaDaDupla(todos, todos, "2026-08-11", 400)).toBe(400);
  });
});

describe("o par é ordenado, senão nascem duas duplas para as mesmas duas", () => {
  test("(A,B) e (B,A) dão a mesma linha", () => {
    expect(parOrdenado("aaa", "bbb")).toEqual(parOrdenado("bbb", "aaa"));
  });

  test("e o SQL cobra a ordem", () => {
    expect(sql).toContain("CHECK (menor < maior)");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS duplas_par");
  });

  test("uma dupla ATIVA por pessoa", () => {
    /* Duas duplas simultâneas transformariam a chama compartilhada num placar
       de várias frentes — o desenho competitivo que a aba evita. */
    expect(sql).toContain("duplas_uma_por_menor");
    expect(sql).toContain("duplas_uma_por_maior");
    expect(sql).toMatch(/ON public\.duplas \(menor\) WHERE aceita/);
  });

  test("aOutra devolve null para quem não está no par", () => {
    const l = { menor: "a", maior: "b" };
    expect(aOutra(l, "a")).toBe("b");
    expect(aOutra(l, "b")).toBe("a");
    expect(aOutra(l, "c")).toBeNull();
  });
});

describe("quem convidou e quem foi convidada veem telas opostas", () => {
  const linha = (quem: string, aceita = false) => ({
    menor: "a",
    maior: "b",
    quem_convidou: quem,
    aceita,
  });

  test("quem mandou espera; quem recebeu decide", () => {
    /* Tratar os dois como um "pendente" só foi o que fez aparecer um botão
       "Aceitar" para quem tinha acabado de convidar. */
    expect(estadoDaDupla(linha("a"), "a")).toBe("convite-enviado");
    expect(estadoDaDupla(linha("a"), "b")).toBe("convite-recebido");
  });

  test("aceita é ativa para as duas", () => {
    expect(estadoDaDupla(linha("a", true), "a")).toBe("ativa");
    expect(estadoDaDupla(linha("a", true), "b")).toBe("ativa");
  });

  test("sem linha, ou linha de outras duas, é «sem»", () => {
    expect(estadoDaDupla(null, "a")).toBe("sem");
    expect(estadoDaDupla(linha("a", true), "c")).toBe("sem");
  });

  test("só quem RECEBEU pode aceitar", () => {
    /* Sem o `neq`, a convidadora aceitaria o próprio convite e a dupla
       nasceria sem a outra ter concordado. */
    expect(servidor).toMatch(/\.neq\("quem_convidou", eu\)/);
  });

  test("recusar APAGA a linha", () => {
    /* Marcar "recusada" deixaria o par bloqueado para sempre pela chave única,
       e quem mudasse de ideia não teria como convidar de novo. */
    const i = servidor.indexOf("if (!data.aceitar)");
    expect(i).toBeGreaterThan(-1);
    expect(servidor.slice(i, i + 220)).toContain(".delete()");
  });
});

describe("o vínculo é conferido antes de toda leitura", () => {
  test("o perfil da amiga passa por `saoAmigas`", () => {
    /* Sem isto, qualquer uuid no corpo do pedido devolveria o Cantinho e o
       perfil de qualquer paciente da plataforma. */
    const i = servidor.indexOf("export const perfilDaAmiga");
    const corpo = servidor.slice(i, i + 1200);
    expect(corpo).toContain("await saoAmigas(sb, eu, data.amigaId)");
    expect(corpo.indexOf("saoAmigas")).toBeLessThan(corpo.indexOf("cantinho_items"));
  });

  test("e o convite de dupla também", () => {
    const i = servidor.indexOf("export const convidarDupla");
    expect(servidor.slice(i, i + 900)).toContain("await saoAmigas(sb, eu, data.amigaId)");
  });

  test("amizade é mútua por indicação, e nunca consigo mesma", () => {
    expect(servidor).toContain("minha.referred_by === outra || dela.referred_by === eu");
    expect(servidor).toMatch(/if \(!outra \|\| outra === eu\) return false;/);
  });
});

describe("nada clínico atravessa o perfil", () => {
  test("o perfil não carrega semana, DPP nem medida", () => {
    /* É o que permite a aba continuar de pé quando uma gestação termina mal. */
    const proibidos = [
      "lmp_date",
      "reference_date",
      "reference_weeks",
      "due_date",
      "weight",
      "systolic",
      "glicemia",
      "health_logs",
    ];
    for (const campo of proibidos) expect(servidor).not.toContain(campo);
  });

  test("o blob da jornada não vai inteiro para a tela", () => {
    /* Ele carrega dias feitos, notas das aulas e o progresso — nada disso é da
       conta de mais ninguém. Só decoração sai. */
    expect(servidor).toContain('blob["dc-path-decor"]');
    expect(servidor).toContain("saneiaEnfeites(");
    expect(servidor).not.toMatch(/cantinho:\s*\{[^}]*blob\s*[,}]/);
  });
});

describe("o Modo Cuidado tira a pessoa da aba, sem dizer por quê", () => {
  test("ela some da lista NO SERVIDOR", () => {
    /* Filtrar na tela deixaria o nome viajar pela rede — e o simples sumiço da
       lista já contaria à amiga o que aconteceu. */
    expect(servidor).toContain("filter((p) => !p.care_mode)");
  });

  test("o perfil dela responde «indisponivel», e não o motivo", () => {
    expect(servidor).toContain('error: "indisponivel"');
    expect(servidor).not.toContain("está em Modo Cuidado");
  });

  test("quem está em luto não vê a aba", () => {
    const i = servidor.indexOf("export const minhasAmigas");
    expect(servidor.slice(i, i + 900)).toContain("careMode: true as const");
  });

  test("e a dupla some dos dois lados sem apagar a linha", () => {
    /* Quando ela voltar, a dupla volta com a chama que tinham. */
    const i = servidor.indexOf("async function lerDupla");
    expect(servidor.slice(i, i + 1600)).toMatch(/care_mode.*\)\?\.care_mode\) return null;/s);
  });
});

describe("a aba sobrevive sem a tabela de duplas", () => {
  test("`lerDupla` engole a falha e devolve null", () => {
    /* `APLICAR_DUPLAS.sql` é do dono. Até ele rodar, o resto da aba (lista,
       perfil, Cantinho, presente) tem de continuar de pé. */
    const i = servidor.indexOf("async function lerDupla");
    const corpo = servidor.slice(i, i + 2400);
    expect(corpo).toContain("try {");
    expect(corpo).toMatch(/catch \{[\s\S]*?return null;/);
  });
});

describe("o layout do Cantinho dela chega saneado", () => {
  test("enfeite sem id é descartado", () => {
    expect(saneiaEnfeites([{ x: 1, y: 2, s: 1 }])).toEqual([]);
  });

  test("números fora da faixa são presos", () => {
    /* Um `s: 900` viraria um enfeite cobrindo a tela inteira de quem visita. */
    const [e] = saneiaEnfeites([{ id: "luz-vela", x: 900, y: -50, s: 900 }]);
    expect(e.x).toBe(100);
    expect(e.y).toBe(0);
    expect(e.s).toBe(3);
  });

  test("lixo não derruba a lista", () => {
    expect(saneiaEnfeites([null, 3, "x", { id: "ok", x: 10, y: 10, s: 1 }])).toHaveLength(1);
  });

  test("corta em 60", () => {
    const muitos = Array.from({ length: 200 }, () => ({ id: "a", x: 1, y: 1, s: 1 }));
    expect(saneiaEnfeites(muitos)).toHaveLength(60);
  });

  test("o que não é lista vira lista vazia", () => {
    for (const v of [null, undefined, {}, "x", 7]) expect(saneiaEnfeites(v)).toEqual([]);
  });
});

describe("«no app há»", () => {
  test("os primeiros dias têm nome próprio", () => {
    expect(tempoNoApp(0)).toBe("chegou hoje");
    expect(tempoNoApp(1)).toBe("chegou ontem");
    expect(tempoNoApp(20)).toBe("no app há 20 dias");
  });

  test("depois de dois meses vira meses", () => {
    /* "no app há 143 dias" é um número que ninguém converte de cabeça. */
    expect(tempoNoApp(143)).toBe("no app há 5 meses");
  });
});
