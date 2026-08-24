/**
 * O MODO CONSULTA NÃO PODE CALAR UMA ALERGIA.
 *
 * Esta tela é olhada de lado, em quinze minutos, com a paciente falando. Um
 * espaço em branco onde deveria estar "alergias" é lido como "não tem alergia"
 * — e a diferença entre "não tem" e "eu não sei" é uma prescrição.
 */

import { describe, expect, test } from "bun:test";
import { essenciais, idadeGestacional, quantasDesconhecidas } from "./modo-consulta";
import type { FichaClinica } from "./clinical.functions";

const ficha = (p: Partial<FichaClinica> = {}): FichaClinica =>
  ({
    nome: "Ana",
    bebe: null,
    gestDias: 256,
    dpp: null,
    gestacaoNumero: 1,
    tipoSanguineo: "O+",
    alergias: "dipirona",
    medicamentos: "metildopa 250mg 3x/dia",
    alturaCm: 165,
    pesoPreGestacional: 62,
    telefone: null,
    contatoEmergencia: null,
    telefoneEmergencia: null,
    riscos: ["pré-eclâmpsia prévia"],
    observacoesPrevias: null,
    modoCuidado: false,
    degradada: false,
    ...p,
  }) as FichaClinica;

describe("1. a idade gestacional não arredonda", () => {
  test("mostra semanas E dias", () => {
    /* Conduta em 36s0d não é conduta em 36s6d — corticoide, viabilidade,
       36+6 versus 37+0. A tela nunca pode arredondar para semanas. */
    expect(idadeGestacional(256)).toBe("36s4d");
    expect(idadeGestacional(252)).toBe("36s0d");
    expect(idadeGestacional(258)).toBe("36s6d");
    expect(idadeGestacional(259)).toBe("37s0d");
  });

  test("sem data, não inventa semana", () => {
    expect(idadeGestacional(null)).toBe("—");
    expect(idadeGestacional(-3)).toBe("—");
  });
});

describe("2. as linhas essenciais aparecem SEMPRE", () => {
  test("as quatro estão lá, nesta ordem", () => {
    /* A ordem é a da urgência de quem prescreve: o que impede uma receita vem
       antes do que a contextualiza. */
    expect(essenciais(ficha()).map((l) => l.rotulo)).toEqual([
      "Alergias",
      "Em uso",
      "Risco",
      "Sangue",
    ]);
  });

  test("campo vazio vira «nada relatado», e não some da tela", () => {
    /**
     * Esconder a linha vazia devolveria o espaço em branco que se lê como "não
     * tem alergia". A linha fica, dizendo o que ela é.
     */
    const l = essenciais(ficha({ alergias: "", medicamentos: null }));
    expect(l[0].valor).toBe("nada relatado");
    expect(l[1].valor).toBe("nada relatado");
    expect(l[0].desconhecido).toBe(false);
  });

  test("o que está preenchido sai como está", () => {
    const l = essenciais(ficha());
    expect(l[0].valor).toBe("dipirona");
    expect(l[1].valor).toBe("metildopa 250mg 3x/dia");
    expect(l[2].valor).toBe("pré-eclâmpsia prévia");
  });
});

describe("3. «não sei» é diferente de «não tem» — o ponto do arquivo", () => {
  test("com o banco degradado, tudo é DESCONHECIDO", () => {
    /**
     * `degradada` significa que o banco não tem as colunas do perfil. Mostrar
     * "nada relatado" ali seria afirmar ausência de alergia a partir de uma
     * coluna que não existe.
     */
    const l = essenciais(ficha({ degradada: true }));
    expect(l.every((x) => x.desconhecido)).toBe(true);
    expect(l[0].valor).toContain("desconhecido");
    expect(l[0].valor).not.toContain("nada relatado");
  });

  test("sem ficha nenhuma, também é desconhecido", () => {
    /* Ficha que não carregou parecendo uma paciente sem alergias é o pior
       desfecho possível desta tela. */
    const l = essenciais(null);
    expect(l).toHaveLength(4);
    expect(l.every((x) => x.desconhecido)).toBe(true);
  });

  test("degradada NÃO vira «nada relatado» nem quando o campo tem valor", () => {
    /* Se o banco não tem a coluna, qualquer valor que apareça é de outra
       origem e não pode ser apresentado como o perfil dela. */
    const l = essenciais(ficha({ degradada: true, alergias: "dipirona" }));
    expect(l[0].desconhecido).toBe(true);
  });

  test("a contagem alimenta um aviso ÚNICO", () => {
    /* Quatro alertas iguais na mesma tela viram paisagem. O aviso é um só, no
       topo, e a contagem é o que o dispara. */
    expect(quantasDesconhecidas(essenciais(ficha({ degradada: true })))).toBe(4);
    expect(quantasDesconhecidas(essenciais(ficha()))).toBe(0);
  });
});
