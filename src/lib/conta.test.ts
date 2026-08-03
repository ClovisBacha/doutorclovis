/**
 * Excluir a conta.
 *
 * O que se protege aqui tem dois lados, e os dois são caros:
 *
 * · **Apagar sem querer.** Não tem volta. Um toque acidental num botão solto no
 *   meio do Perfil apaga o diário inteiro de uma gestação.
 * · **Dizer que apagou sem ter apagado.** Se a exclusão falhar e a tela mostrar
 *   sucesso, a paciente sai acreditando que os dados dela sumiram. É pior do que
 *   não ter o botão — e é o resultado natural de um `catch` mal colocado.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PALAVRA_DE_CONFIRMACAO } from "./conta.functions";

const servidor = readFileSync("src/lib/conta.functions.ts", "utf8");
const tela = readFileSync("src/components/excluir-conta.tsx", "utf8");

describe("a confirmação é conferida NOS DOIS lados", () => {
  test("o servidor não confia na tela", () => {
    /* No cliente a palavra protege do toque sem querer; no servidor, de um
       pedido montado à mão que nunca passou pela tela. */
    expect(servidor).toContain("data.confirmacao.trim().toUpperCase() !== PALAVRA_DE_CONFIRMACAO");
  });

  test("a palavra é a MESMA nos dois — importada, não escrita duas vezes", () => {
    expect(tela).toContain("PALAVRA_DE_CONFIRMACAO");
    expect(tela).not.toMatch(/=== "EXCLUIR"/);
    expect(PALAVRA_DE_CONFIRMACAO).toBe("EXCLUIR");
  });

  test("a comparação ignora espaço e caixa — mas não aceita outra palavra", () => {
    const confere = (t: string) => t.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;
    expect(confere("excluir")).toBe(true);
    expect(confere("  Excluir ")).toBe(true);
    expect(confere("")).toBe(false);
    expect(confere("EXCLUI")).toBe(false);
    expect(confere("SIM")).toBe(false);
  });
});

describe("a conta do médico não é apagada por aqui", () => {
  test("o servidor recusa antes de chamar o delete", () => {
    /* A conta dele é o vínculo das pacientes e a autoria do prontuário — que o
       CFM manda guardar por 20 anos. Apagar de um toque desliga o SOS de quem
       está grávida agora. */
    const checa = servidor.indexOf('.from("doctors")');
    const apaga = servidor.indexOf("auth.admin.deleteUser");
    expect(checa).toBeGreaterThan(0);
    expect(checa).toBeLessThan(apaga);
    expect(servidor).toContain('return { ok: false, motivo: "medico" }');
  });

  test("a tela dele oferece o caminho, não um botão morto", () => {
    expect(tela).toContain("ehMedico ?");
    expect(tela).toMatch(/suporte/i);
  });
});

describe("falhar não pode parecer sucesso", () => {
  test("o erro do banco sobe em vez de virar `ok`", () => {
    /* Sem os `ON DELETE CASCADE` aplicados, o delete falha com violação de
       chave. Engolir isso faria a paciente sair acreditando que apagou. */
    expect(servidor).toContain('if (error) return { ok: false, motivo: "falhou" }');
  });

  test("a mensagem de falha diz explicitamente que NADA foi apagado", () => {
    expect(tela).toContain("Nada foi apagado");
  });

  test("só sai da sessão quando deu certo", () => {
    const ok = tela.indexOf("if (r.ok)");
    const sair = tela.indexOf("supabase.auth.signOut()");
    expect(ok).toBeGreaterThan(0);
    expect(ok).toBeLessThan(sair);
  });
});

describe("a tela diz o que a paciente precisa saber ANTES de decidir", () => {
  test("avisa que a assinatura não é cancelada junto", () => {
    /* Exigência de revisão da loja, e o tipo de coisa que vira cobrança
       indevida três meses depois — sem ninguém para reclamar, porque a conta
       não existe mais. */
    /* Sem depender da quebra de linha: o Prettier reflui esse parágrafo a cada
       edição, e um teste que quebra por reformatação é um teste que ninguém
       confia. */
    const semQuebras = tela.replace(/\s+/g, " ");
    expect(semQuebras).toContain("apagar a conta não cancela a cobrança");
    expect(semQuebras).toMatch(/App Store ou na Play Store/);
  });

  test("avisa que o prontuário do médico permanece", () => {
    expect(tela).toMatch(/20 anos/);
  });

  test("não abre direto no campo de confirmação", () => {
    /* Dois passos: ela abre, lê, e só então o campo aparece. */
    expect(tela).toContain("const [aberto, setAberto] = useState(false)");
    expect(tela).toContain("Quero excluir minha conta");
  });
});
