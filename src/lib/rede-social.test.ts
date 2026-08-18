import { describe, expect, test } from "bun:test";
import {
  aoReagir,
  aoSeguir,
  avisoMandaPush,
  emojiDaReacao,
  LIMITE_DA_BIO,
  LIMITE_DO_TEXTO,
  MINIMO_DA_BUSCA,
  normalizarBusca,
  ordenarFeed,
  PERFIL_PUBLICO_PADRAO,
  podeAparecerNaBusca,
  podeVerPost,
  postEhValido,
  REACOES,
  reacaoConhecida,
  redeDisponivel,
  resumoDeReacoes,
  textoDoAviso,
  totalDeReacoes,
  VISIBILIDADES,
  type Perfil,
  type TipoDeReacao,
  type Visibilidade,
  haQuantoPublicou,
  aulaValida,
  enqueteValida,
  LIMITE_DA_OPCAO,
  limparOpcoes,
  rotuloDeVotos,
  TEMAS_DA_AULA,
  temaDoDia,
} from "./rede-social";

function perfil(p: Partial<Perfil> = {}): Perfil {
  return {
    id: "ana",
    nome: "Ana",
    bio: null,
    avatarUrl: null,
    publico: false,
    emCuidado: false,
    ...p,
  };
}

/* ─── 1 · PERFIL ────────────────────────────────────────────────────────── */

describe("perfil", () => {
  test("⚠️ o padrão é PRIVADO", () => {
    // O grafo desta aba nasceu fechado por indicação, e é isso que a torna
    // segura SEM MODERAÇÃO. Nascer público exporia milhares de gestantes de
    // alto risco por omissão, sem nunca terem pedido plateia.
    expect(PERFIL_PUBLICO_PADRAO).toBe(false);
  });

  test("a bio é curta", () => {
    expect(LIMITE_DA_BIO).toBeLessThanOrEqual(200);
  });
});

/* ─── 2 · SEGUIR ────────────────────────────────────────────────────────── */

describe("aoSeguir", () => {
  test("perfil público entra direto; privado vira pedido", () => {
    expect(aoSeguir({ euId: "eu", alvo: perfil({ publico: true }), fuiBloqueada: false })).toBe(
      "ativo",
    );
    expect(aoSeguir({ euId: "eu", alvo: perfil({ publico: false }), fuiBloqueada: false })).toBe(
      "pendente",
    );
  });

  test("⚠️ as três recusas devolvem o MESMO null", () => {
    // Distinguir contaria a quem foi bloqueada que ela foi bloqueada (o
    // bloqueio é calado) e contaria a perda de quem entrou em Modo Cuidado.
    const base = { euId: "eu", fuiBloqueada: false };
    expect(aoSeguir({ ...base, alvo: perfil({ id: "eu", publico: true }) })).toBeNull();
    expect(aoSeguir({ ...base, alvo: perfil({ publico: true }), fuiBloqueada: true })).toBeNull();
    expect(aoSeguir({ ...base, alvo: perfil({ publico: true, emCuidado: true }) })).toBeNull();
  });

  test("⚠️ Modo Cuidado vence até o perfil público", () => {
    expect(
      aoSeguir({
        euId: "eu",
        alvo: perfil({ publico: true, emCuidado: true }),
        fuiBloqueada: false,
      }),
    ).toBeNull();
  });
});

/* ─── 3 e 4 · POST E VISIBILIDADE ───────────────────────────────────────── */

describe("postEhValido", () => {
  test("ou tem foto, ou tem texto", () => {
    expect(postEhValido({ texto: null, temImagem: true })).toBe(true);
    expect(postEhValido({ texto: "oi", temImagem: false })).toBe(true);
    expect(postEhValido({ texto: null, temImagem: false })).toBe(false);
    expect(postEhValido({ texto: "   ", temImagem: false })).toBe(false);
  });

  test("as três visibilidades têm rótulo", () => {
    expect(VISIBILIDADES).toHaveLength(3);
    for (const v of VISIBILIDADES) {
      expect(v.rotulo.length).toBeGreaterThan(0);
      expect(v.sub.length).toBeGreaterThan(0);
    }
    expect(LIMITE_DO_TEXTO).toBeGreaterThan(100);
  });
});

describe("podeVerPost", () => {
  const base = {
    euId: "eu" as string | null,
    autor: { emCuidado: false, publico: true },
    bloqueado: false,
    sigoAtivo: false,
    somosAmigas: false,
  };
  const post = (v: Visibilidade) => ({ autorId: "ana", visibilidade: v });

  test("a dona vê tudo que é dela", () => {
    expect(
      podeVerPost({
        ...base,
        post: post("amigas"),
        euId: "ana",
        autor: { emCuidado: false, publico: false },
      }),
    ).toBe(true);
  });

  test("⚠️ a dona vê os PRÓPRIOS posts mesmo em Modo Cuidado", () => {
    // Escondê-los dela seria o app apagar o bebê dela — a mesma decisão que
    // manteve `exam_files` de pé e o Álbum na Comunidade.
    expect(
      podeVerPost({
        ...base,
        post: post("publico"),
        euId: "ana",
        autor: { emCuidado: true, publico: true },
      }),
    ).toBe(true);
  });

  test("⚠️ Modo Cuidado apaga o post da rede — inclusive o público", () => {
    expect(
      podeVerPost({ ...base, post: post("publico"), autor: { emCuidado: true, publico: true } }),
    ).toBe(false);
  });

  test("⚠️ quem está bloqueada não vê nem o que é público", () => {
    // Senão o bloqueio não bloquearia coisa nenhuma.
    expect(podeVerPost({ ...base, post: post("publico"), bloqueado: true })).toBe(false);
  });

  test("visitante deslogado não vê nada", () => {
    expect(podeVerPost({ ...base, post: post("publico"), euId: null })).toBe(false);
  });

  test("`seguidores` exige seguir de verdade", () => {
    expect(podeVerPost({ ...base, post: post("seguidores") })).toBe(false);
    expect(podeVerPost({ ...base, post: post("seguidores"), sigoAtivo: true })).toBe(true);
  });

  test("amiga vê o de `seguidores` sem precisar seguir", () => {
    // Quem já é do círculo não deve ter de fazer um segundo gesto para ver o
    // que o círculo inteiro vê.
    expect(podeVerPost({ ...base, post: post("seguidores"), somosAmigas: true })).toBe(true);
  });

  test("`amigas` NÃO se alcança só seguindo", () => {
    // É a camada restrita: seguir não entra nela, por definição.
    expect(podeVerPost({ ...base, post: post("amigas"), sigoAtivo: true })).toBe(false);
    expect(podeVerPost({ ...base, post: post("amigas"), somosAmigas: true })).toBe(true);
  });

  test("⚠️ fechar o perfil esconde os posts públicos ANTIGOS", () => {
    // A decisão nova manda sobre a antiga: quem fechou o perfil não quis
    // manter uma janela aberta para o que já tinha publicado.
    expect(
      podeVerPost({ ...base, post: post("publico"), autor: { emCuidado: false, publico: false } }),
    ).toBe(false);
  });
});

/* ─── 5 · FEED ──────────────────────────────────────────────────────────── */

describe("ordenarFeed", () => {
  test("⚠️ é CRONOLÓGICO, do mais novo para o mais velho", () => {
    // Um feed por "relevância" precisaria de engajamento como sinal — e numa
    // comunidade de gestação de alto risco o post que gera mais reação é o da
    // emergência. Um algoritmo que aprende isso põe o susto de uma paciente
    // como primeira coisa que todas veem.
    const r = ordenarFeed([
      { id: "b", criadoEm: "2026-08-02T10:00:00Z" },
      { id: "a", criadoEm: "2026-08-03T10:00:00Z" },
      { id: "c", criadoEm: "2026-08-01T10:00:00Z" },
    ]);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  test("não muda a lista original", () => {
    const l = [{ criadoEm: "2026-08-01" }, { criadoEm: "2026-08-02" }];
    ordenarFeed(l);
    expect(l[0].criadoEm).toBe("2026-08-01");
  });
});

/* ─── 6 · REAÇÕES ───────────────────────────────────────────────────────── */

describe("as reações", () => {
  test("⚠️ NENHUMA pode ser lida como julgamento", () => {
    // 😂 embaixo do relato de um sangramento é indefensável. 😮 é ambíguo. 😢
    // lê como PENA, que é a coisa que ela menos quer receber.
    const proibidos = ["😂", "🤣", "😮", "😯", "😢", "😭", "😱", "👎", "🤔"];
    for (const r of REACOES) expect(proibidos).not.toContain(r.emoji);
  });

  test("⚠️ existe uma reação para o post DIFÍCIL", () => {
    // Sem ela, quem posta uma coisa dura só recebe coração — que soa
    // comemorativo no momento errado.
    expect(REACOES.some((r) => r.tipo === "abraco")).toBe(true);
  });

  test("são poucas, e todas têm emoji e rótulo únicos", () => {
    expect(REACOES.length).toBeGreaterThanOrEqual(3);
    expect(REACOES.length).toBeLessThanOrEqual(6);
    expect(new Set(REACOES.map((r) => r.emoji)).size).toBe(REACOES.length);
    expect(new Set(REACOES.map((r) => r.tipo)).size).toBe(REACOES.length);
    for (const r of REACOES) expect(r.rotulo.trim().length).toBeGreaterThan(0);
  });

  test("reacaoConhecida barra o que não está no catálogo", () => {
    expect(reacaoConhecida("amei")).toBe(true);
    expect(reacaoConhecida("haha")).toBe(false);
    expect(reacaoConhecida("")).toBe(false);
  });

  test("emojiDaReacao nunca devolve vazio", () => {
    for (const r of REACOES) expect(emojiDaReacao(r.tipo).length).toBeGreaterThan(0);
  });
});

describe("aoReagir", () => {
  test("⚠️ UMA por pessoa: tocar na mesma tira, tocar noutra troca", () => {
    // É o que impede alguém de encher um post com cinco emojis — que num post
    // sobre notícia difícil pareceria deboche.
    expect(aoReagir(null, "amei")).toBe("amei");
    expect(aoReagir("amei", "amei")).toBeNull();
    expect(aoReagir("amei", "abraco")).toBe("abraco");
  });
});

describe("contagem de reações", () => {
  test("soma e resume", () => {
    const c = { amei: 5, abraco: 2, torcendo: 9 } as Partial<Record<TipoDeReacao, number>>;
    expect(totalDeReacoes(c)).toBe(16);
    expect(resumoDeReacoes(c)).toEqual(["🙏", "❤️", "🤗"]);
  });

  test("⚠️ o resumo tem teto — a linha vive num celular", () => {
    const cheio = Object.fromEntries(REACOES.map((r, i) => [r.tipo, i + 1]));
    expect(resumoDeReacoes(cheio).length).toBeLessThanOrEqual(3);
  });

  test("sem reação, o resumo é vazio e o total é zero", () => {
    expect(resumoDeReacoes({})).toEqual([]);
    expect(totalDeReacoes({})).toBe(0);
  });
});

/* ─── 7 · AVISOS ────────────────────────────────────────────────────────── */

describe("avisoMandaPush", () => {
  test("⚠️ reação NÃO manda push", () => {
    // O push deste app é o mesmo canal do aviso de emergência. Um coraçãozinho
    // de madrugada gasta o canal que um dia vai avisar de uma consulta — e
    // quem desliga as notificações por causa dele desliga o resto também.
    expect(avisoMandaPush("reagiu")).toBe(false);
    expect(avisoMandaPush("seguiu")).toBe(false);
    expect(avisoMandaPush("aceitou")).toBe(false);
  });

  test("o pedido para seguir manda, porque PEDE uma ação dela", () => {
    expect(avisoMandaPush("pediu_para_seguir")).toBe(true);
  });

  test("todo aviso tem texto com o nome de quem foi", () => {
    for (const e of ["seguiu", "pediu_para_seguir", "reagiu", "aceitou"] as const) {
      expect(textoDoAviso(e, "Ana")).toContain("Ana");
    }
  });
});

/* ─── 8 · DESCOBERTA ────────────────────────────────────────────────────── */

describe("a busca", () => {
  test("⚠️ SÓ encontra perfil público", () => {
    // É o portão que preserva o desenho original da aba: quem não ligou o
    // perfil público continua invisível para estranhas.
    expect(podeAparecerNaBusca({ publico: true, emCuidado: false })).toBe(true);
    expect(podeAparecerNaBusca({ publico: false, emCuidado: false })).toBe(false);
  });

  test("⚠️ e nunca quem está em Modo Cuidado", () => {
    expect(podeAparecerNaBusca({ publico: true, emCuidado: true })).toBe(false);
  });

  test("acha sem acento e sem caixa", () => {
    expect(normalizarBusca("Vó Ana")).toBe("vo ana");
    expect(normalizarBusca("  MARINA  ")).toBe("marina");
    expect(MINIMO_DA_BUSCA).toBeGreaterThanOrEqual(3);
  });
});

/* ─── 10 · MODO CUIDADO ─────────────────────────────────────────────────── */

describe("redeDisponivel", () => {
  test("⚠️ some inteira no Modo Cuidado", () => {
    expect(redeDisponivel({ emCuidado: false })).toBe(true);
    expect(redeDisponivel({ emCuidado: true })).toBe(false);
  });
});

describe("há quanto tempo foi publicado", () => {
  /* Um instante cravado: a função recebe o `agora`, então nada aqui depende do
     relógio da máquina que roda o teste. */
  const AGORA = new Date("2026-08-18T12:00:00Z").getTime();
  const atras = (seg: number) => new Date(AGORA - seg * 1000).toISOString();

  test("a escada inteira", () => {
    expect(haQuantoPublicou(atras(0), AGORA)).toBe("agora");
    expect(haQuantoPublicou(atras(59), AGORA)).toBe("agora");
    expect(haQuantoPublicou(atras(60), AGORA)).toBe("1 min");
    expect(haQuantoPublicou(atras(59 * 60), AGORA)).toBe("59 min");
    expect(haQuantoPublicou(atras(60 * 60), AGORA)).toBe("1 h");
    expect(haQuantoPublicou(atras(23 * 3600), AGORA)).toBe("23 h");
    expect(haQuantoPublicou(atras(24 * 3600), AGORA)).toBe("1 d");
    expect(haQuantoPublicou(atras(6 * 24 * 3600), AGORA)).toBe("6 d");
    expect(haQuantoPublicou(atras(7 * 24 * 3600), AGORA)).toBe("1 sem");
    expect(haQuantoPublicou(atras(27 * 24 * 3600), AGORA)).toBe("3 sem");
  });

  test("⚠️ depois de quatro semanas vira DATA, e não 'meses'", () => {
    // Um post de dois meses é de outro trimestre. "há 2 meses" obriga a
    // paciente a fazer a conta de quando foi.
    const velho = haQuantoPublicou(atras(40 * 24 * 3600), AGORA);
    expect(velho).not.toContain("sem");
    expect(velho).toMatch(/de (julho|agosto) de 2026/);
  });

  test("⚠️ futuro por relógio dessincronizado vira 'agora'", () => {
    // "em -2 min" não é impreciso, é visivelmente quebrado.
    expect(haQuantoPublicou(new Date(AGORA + 90_000).toISOString(), AGORA)).toBe("agora");
  });

  test("data inválida não desenha lixo", () => {
    expect(haQuantoPublicou("nada disso", AGORA)).toBe("");
  });
});

describe("a enquete do post", () => {
  test("duas a quatro opções", () => {
    expect(enqueteValida(["Sim", "Não"])).toBe(true);
    expect(enqueteValida(["a", "b", "c", "d"])).toBe(true);
    expect(enqueteValida(["Só uma"])).toBe(false);
    expect(enqueteValida(["a", "b", "c", "d", "e"])).toBe(false);
  });

  test("⚠️ duas opções iguais não são uma enquete", () => {
    // Com "sim" e "sim" o resultado é ininteligível, e post não se edita.
    expect(enqueteValida(["Sim", "sim"])).toBe(false);
    expect(enqueteValida(["Menino", "Menina"])).toBe(true);
  });

  test("vazias não contam", () => {
    expect(enqueteValida(["Sim", "   "])).toBe(false);
    expect(limparOpcoes([" Sim ", "", "Não", "  "])).toEqual(["Sim", "Não"]);
  });

  test("opção longa demais é recusada, e `limparOpcoes` corta antes", () => {
    const longa = "x".repeat(LIMITE_DA_OPCAO + 5);
    expect(enqueteValida(["ok", longa])).toBe(false);
    expect(limparOpcoes(["ok", longa])[1].length).toBe(LIMITE_DA_OPCAO);
  });

  test("⚠️ o rótulo é NÚMERO, nunca porcentagem", () => {
    // "67%" são dois votos de três: numa base pequena a porcentagem transforma
    // três pessoas numa maioria.
    expect(rotuloDeVotos(1)).toBe("1 voto");
    expect(rotuloDeVotos(7)).toBe("7 votos");
    expect(rotuloDeVotos(0)).toBe("0 votos");
    expect(rotuloDeVotos(2)).not.toContain("%");
  });
});

describe("a aula anexada", () => {
  test("⚠️ o DIA não entra — ele é a semana dela disfarçada", () => {
    // D = semana × 7 + diaDaSemana. "Aula do dia 139" é "estou de 19 semanas"
    // para quem souber dividir por sete, e passaria por cima da chave
    // `mostrar_semana`, que existe exatamente para essa decisão ser dela.
    expect(aulaValida({ dia: 139, titulo: "Movimentos do bebê" })).toBe(false);
    expect(aulaValida({ tema: "nutrição", dia: 139 })).toBe(true);
    // E o tipo não tem onde guardar o dia: quem só passa o tema é válido.
    expect(aulaValida({ tema: "nutrição" })).toBe(true);
  });

  test("só os sete temas conhecidos", () => {
    for (const t of TEMAS_DA_AULA) expect(aulaValida({ tema: t })).toBe(true);
    expect(aulaValida({ tema: "qualquer coisa" })).toBe(false);
    expect(aulaValida({ tema: "" })).toBe(false);
    expect(aulaValida(null)).toBe(false);
  });

  test("o tema gira de sete em sete, para todo mundo igual", () => {
    expect(temaDoDia(0)).toBe("bebê");
    expect(temaDoDia(2)).toBe("nutrição");
    expect(temaDoDia(7)).toBe("bebê");
    expect(temaDoDia(139)).toBe(temaDoDia(139 + 7));
    // Negativo não estoura nem devolve `undefined`.
    expect(TEMAS_DA_AULA).toContain(temaDoDia(-3));
  });
});
