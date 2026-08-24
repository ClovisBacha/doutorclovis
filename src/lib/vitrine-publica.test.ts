/**
 * A VITRINE PÚBLICA — as duas travas que a auditoria desta leva achou.
 *
 * `/p/<codigo>` é a única página do app em que o código de indicação chega pelo
 * CAMINHO e não pela query, e é a superfície que a criadora põe na bio. As duas
 * coisas abaixo falhavam em silêncio.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { primeiroNome } from "./quem-convidou";

const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/**
 * ⚠️ O BOTÃO FLUTUANTE LEVAVA A `/auth` SEM O CÓDIGO.
 *
 * `PublicBottomNav` desenha um CTA gradiente de largura inteira, só no celular
 * — que é exatamente onde um link do WhatsApp abre. Ele apontava para `/auth`
 * puro, e as três capturas do app (`useReferralCapture`, `useAffiliateCapture`,
 * a faixa de convite) leem só a QUERY: abrir `/p/MARINA` não guarda código
 * nenhum. A amiga criava a conta, `referred_by` ficava nulo, e ela não aparecia
 * na lista de Amigas, não dava para formar dupla nem presentear, e as 100 🌱
 * não eram pagas a ninguém.
 *
 * É palavra por palavra o defeito que o cabeçalho de `indicacao.ts` descreve.
 */
describe("a barra pública não pousa na vitrine", () => {
  const nav = semComentarios(readFileSync("src/components/public-bottom-nav.tsx", "utf8"));

  test("⚠️ `/p/` está na lista de rotas sem a barra", () => {
    expect(nav).toContain('location.pathname.startsWith("/p/")');
  });

  /* ⚠️ E o convite COM código continua na página — o que saiu foi o atalho que
     o perdia, nunca a capacidade de indicar. */
  test("⚠️ a vitrine continua convidando, e com o código dela", () => {
    const rota = semComentarios(readFileSync("src/routes/p.$codigo.tsx", "utf8"));
    expect(rota).toContain("ConviteDoApp");
    expect(rota).toContain("codigo");
  });
});

/**
 * ⚠️ O TÍTULO QUE VAI PARA O WHATSAPP DIZIA "Alguém está no Obstétrica".
 *
 * Havia um `split(/\s+/)[0] || "Alguém"` com um comentário afirmando ser "a
 * mesma régua de `primeiroNome`". Não era: `primeiroNome` recusa nome de um
 * caractere e devolve `null`, enquanto o `||` transformava tudo que sobrasse no
 * placeholder — e o placeholder é o que `perfilPublicoPorCodigo` já grava
 * quando `display_name` está vazio.
 *
 * ⚠️ E não se conserta depois: o título é o que o WhatsApp COPIA e guarda no
 * histórico de toda conversa em que o link foi colado.
 */
describe("a prévia do link nunca afirma um nome que não existe", () => {
  const rota = semComentarios(readFileSync("src/routes/p.$codigo.tsx", "utf8"));

  test("⚠️ usa `primeiroNome`, e não um `split` próprio", () => {
    expect(rota).toContain("primeiroNome(perfil.nome)");
    expect(rota).not.toContain('|| "Alguém"');
    expect(rota).not.toMatch(/perfil\.nome\.trim\(\)\.split/);
  });

  /* Sem primeiro nome utilizável, a página cai no cartão genérico do site —
     que apresenta o app sem afirmar nada sobre ninguém. */
  test("⚠️ sem nome utilizável, NÃO emite título nenhum", () => {
    expect(rota).toContain("if (!nome) return []");
  });

  /* A régua compartilhada é a que decide, e é ela que recusa os casos ruins. */
  test("⚠️ os casos que o `||` deixava passar são justamente os recusados", () => {
    expect(primeiroNome("Marina Costa")).toBe("Marina");
    expect(primeiroNome("M Costa")).toBeNull();
    expect(primeiroNome("   ")).toBeNull();
    expect(primeiroNome(null)).toBeNull();
  });
});
