import { describe, expect, test } from "bun:test";
import {
  ABAS_DO_PERFIL,
  ANEL_NOVO,
  AVATAR_DO_PERFIL,
  AVATAR_DO_POST,
  CAIXA_DO_STORY,
  COLUNAS_DA_GRADE,
  ESPESSURA_DO_ANEL,
  FOTO_DO_STORY,
  NUMEROS_PUBLICOS,
  RAZAO_DA_GRADE,
  RAZAO_DO_POST,
  RAZAO_DO_STORY,
  VAO_DA_GRADE,
  VAO_DO_ANEL,
} from "./medidas-instagram";

describe("as proporções publicadas", () => {
  test("⚠️ a grade é 3:4, e não mais quadrada", () => {
    // A mudança de 2025. Quem construir 1:1 hoje faz um Instagram de 2024 — e
    // as fotos verticais, que são a maioria, chegariam cortadas.
    expect(RAZAO_DA_GRADE).toBeCloseTo(0.75, 5);
    expect(RAZAO_DA_GRADE).not.toBe(1);
  });

  test("o post do feed é 4:5 e o story é 9:16", () => {
    expect(RAZAO_DO_POST).toBeCloseTo(0.8, 5);
    expect(RAZAO_DO_STORY).toBeCloseTo(0.5625, 5);
  });

  test("as três proporções são verticais", () => {
    // Nenhuma é paisagem: o app é de celular em pé.
    for (const r of [RAZAO_DA_GRADE, RAZAO_DO_POST, RAZAO_DO_STORY]) {
      expect(r).toBeLessThan(1);
    }
  });
});

describe("a bolinha do story", () => {
  test("⚠️ o anel fica FORA da foto, com vão", () => {
    // Sem o vão, o anel encosta na foto e lê como borda da imagem em vez de
    // anel — que é justamente o sinal de "tem coisa nova".
    expect(CAIXA_DO_STORY).toBe(FOTO_DO_STORY + 2 * (VAO_DO_ANEL + ESPESSURA_DO_ANEL));
    expect(CAIXA_DO_STORY).toBeGreaterThan(FOTO_DO_STORY);
    expect(VAO_DO_ANEL).toBeGreaterThan(0);
  });

  test("a bolinha é menor que o avatar do perfil e maior que o do post", () => {
    // A hierarquia de tamanho é o que diz o que é o quê sem nenhum rótulo.
    expect(AVATAR_DO_POST).toBeLessThan(FOTO_DO_STORY);
    expect(FOTO_DO_STORY).toBeLessThan(AVATAR_DO_PERFIL);
  });

  test("⚠️ o anel NÃO é o degradê do Instagram", () => {
    // O laranja-rosa-roxo é a marca deles, e é a coisa mais reconhecível da
    // interface. Um app de gestação com aquele anel lê como imitação.
    const proibidos = ["#f58529", "#feda77", "#dd2a7b", "#8134af", "#515bd4"];
    for (const c of ANEL_NOVO) {
      expect(proibidos).not.toContain(c.toLowerCase());
    }
  });
});

describe("a grade", () => {
  test("três colunas, com vão pequeno e não zero", () => {
    // Colado, o olho lê a grade como UMA imagem recortada em vez de nove fotos.
    expect(COLUNAS_DA_GRADE).toBe(3);
    expect(VAO_DA_GRADE).toBeGreaterThan(0);
    expect(VAO_DA_GRADE).toBeLessThanOrEqual(4);
  });
});

describe("as abas do perfil", () => {
  test("⚠️ são DUAS, e não as quatro do Instagram", () => {
    // Ele tem quatro porque tem quatro TIPOS de conteúdo. Este app tem um.
    // Três abas vazias ao lado de uma cheia não copiam o Instagram — copiam a
    // aparência dele e entregam a sensação de um app pela metade.
    expect(ABAS_DO_PERFIL).toHaveLength(2);
    expect(ABAS_DO_PERFIL.map((a) => a.chave)).toEqual(["grade", "bebe"]);
  });

  test("toda aba tem rótulo", () => {
    for (const a of ABAS_DO_PERFIL) expect(a.rotulo.trim().length).toBeGreaterThan(0);
  });
});

describe("os números do cabeçalho", () => {
  test("⚠️ seguidores e seguindo NÃO são públicos", () => {
    // A única divergência deliberada do modelo, e ela é pesquisada: um placar
    // público de audiência num app de gestação de alto risco mede popularidade
    // num momento em que a pessoa já está sendo medida clinicamente, e dá
    // número objetivo a uma comparação que sem número seria só sensação.
    //
    // Se um dia isto virar `true`, que seja com alguém tendo lido esta linha.
    expect(NUMEROS_PUBLICOS.seguidores).toBe(false);
    expect(NUMEROS_PUBLICOS.seguindo).toBe(false);
  });

  test("publicações aparece sempre — é sobre o que ela fez", () => {
    expect(NUMEROS_PUBLICOS.publicacoes).toBe(true);
  });
});
