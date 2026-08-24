/**
 * O VÍDEO, MEDIDO.
 *
 * A asserção que mais importa é a do caminho: o cliente manda a string, e é ela
 * que decide se a paciente pode anexar o vídeo de outra conta.
 */

import { describe, expect, test } from "bun:test";
import {
  BYTES_MAX,
  SEGUNDOS_MAX,
  caminhoEhDoDono,
  extensaoDoTipo,
  recadoDaRecusa,
  recusaDoVideo,
} from "./video-do-post";

const ok = { tipo: "video/mp4", bytes: 5_000_000, segundos: 12 };

describe("o que passa e o que não", () => {
  test("um vídeo comum passa", () => {
    expect(recusaDoVideo(ok)).toBe(null);
  });

  test("⚠️ `.mov` do iPhone PASSA — esquecê-lo quebraria o aparelho principal", () => {
    /* É o que o iOS entrega ao escolher da galeria. Uma lista só com mp4/webm
       recusaria em silêncio o aparelho onde o app é instalado. */
    expect(recusaDoVideo({ ...ok, tipo: "video/quicktime" })).toBe(null);
  });

  test("formato estranho é recusado", () => {
    expect(recusaDoVideo({ ...ok, tipo: "video/avi" })).toBe("tipo");
    expect(recusaDoVideo({ ...ok, tipo: "image/jpeg" })).toBe("tipo");
  });

  test("acima do teto de tamanho, recusa", () => {
    expect(recusaDoVideo({ ...ok, bytes: BYTES_MAX + 1 })).toBe("tamanho");
    expect(recusaDoVideo({ ...ok, bytes: BYTES_MAX })).toBe(null);
  });

  test("acima do teto de duração, recusa", () => {
    expect(recusaDoVideo({ ...ok, segundos: SEGUNDOS_MAX + 5 })).toBe("duracao");
  });

  test("⚠️ DURAÇÃO DESCONHECIDA PASSA — não se inventa recusa por falta de dado", () => {
    /* Uns `.mov` do iPhone nunca expõem a duração no `<video>` do Safari.
       Recusar por não saber mandaria embora o formato mais comum do aparelho
       mais comum, e o teto de tamanho já limita o estrago. */
    expect(recusaDoVideo({ ...ok, segundos: null })).toBe(null);
  });

  test("⚠️ um segundo de folga na duração", () => {
    /* O navegador arredonda, e um vídeo de "60s" costuma medir 60,04. Recusar
       exatamente no limite reprovaria o vídeo que a própria tela disse caber. */
    expect(recusaDoVideo({ ...ok, segundos: SEGUNDOS_MAX + 0.4 })).toBe(null);
  });

  test("cada recusa tem recado próprio, com o número", () => {
    expect(recadoDaRecusa("tamanho")).toContain("50");
    expect(recadoDaRecusa("duracao")).toContain(String(SEGUNDOS_MAX));
    expect(recadoDaRecusa("tipo")).toBeTruthy();
  });
});

describe("⚠️ o caminho é DESTA pessoa — a trava que o cliente não controla", () => {
  const EU = "11111111-1111-1111-1111-111111111111";
  const OUTRA = "22222222-2222-2222-2222-222222222222";

  test("o meu passa", () => {
    expect(caminhoEhDoDono(`${EU}/abc.mp4`, EU)).toBe(true);
  });

  test("o de outra pessoa NÃO passa", () => {
    /* O vídeo sobe direto para o Storage e só o caminho volta ao servidor —
       esta função é a única coisa entre a paciente e o vídeo de outra conta. */
    expect(caminhoEhDoDono(`${OUTRA}/abc.mp4`, EU)).toBe(false);
  });

  test("⚠️ travessia de pasta é recusada, mesmo começando certo", () => {
    /* `<eu>/../<outra>/x.mp4` começa com a pasta certa e aponta para fora. */
    expect(caminhoEhDoDono(`${EU}/../${OUTRA}/x.mp4`, EU)).toBe(false);
    expect(caminhoEhDoDono(`${EU}//${OUTRA}/x.mp4`, EU)).toBe(false);
  });

  test("⚠️ prefixo parecido não basta — a barra é obrigatória", () => {
    /* Sem a barra, um uuid que começasse igual passaria. */
    expect(caminhoEhDoDono(`${EU}extra/x.mp4`, EU)).toBe(false);
  });

  test("vazios não passam", () => {
    expect(caminhoEhDoDono("", EU)).toBe(false);
    expect(caminhoEhDoDono(`${EU}/x.mp4`, "")).toBe(false);
  });
});

describe("a extensão segue o tipo", () => {
  test("cada formato ganha a sua", () => {
    expect(extensaoDoTipo("video/quicktime")).toBe("mov");
    expect(extensaoDoTipo("video/webm")).toBe("webm");
    expect(extensaoDoTipo("video/mp4")).toBe("mp4");
    /* Desconhecido cai em mp4, que é o que mais toca em qualquer lugar. */
    expect(extensaoDoTipo("video/sei-la")).toBe("mp4");
  });
});
