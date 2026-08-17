/**
 * O MENU DO ☰ E A ASSINATURA — as travas da auditoria de ago/2026.
 *
 * A auditoria do menu deu 7,4 e apontou dois defeitos que estes testes fecham:
 *
 *  1. **Não havia como cancelar a assinatura.** `openBillingPortal` existia e o
 *     único chamador era o painel do MÉDICO; `getMyBilling` não tinha chamador
 *     nenhum. A paciente era cobrada todo mês sem tela que dissesse como parar.
 *  2. **"Sair" ficava abaixo da dobra** num iPhone SE — medido: com a folha
 *     rolando inteira, Pós-parto, Painel e Sair saíam da vista.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const semComentarios = (p: string) =>
  readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const menu = semComentarios("src/components/menu-conta.tsx");
const tela = semComentarios("src/components/assinatura-tab.tsx");
const conta = semComentarios("src/routes/_authenticated/minha-conta.tsx");

describe("⚠️ a paciente consegue chegar na própria assinatura", () => {
  test("a linha existe no menu e aponta para um destino real", () => {
    expect(menu).toContain('tab: "Assinatura"');
    expect(menu).toContain("Minha assinatura");
    /* O destino tem de estar no TABS de runtime — `minha-conta` ignora em
       SILÊNCIO um `tab` que não bate, e a linha viraria um botão morto. */
    expect(conta).toContain('"Assinatura",');
    expect(conta).toContain('{tab === "Assinatura" && <AssinaturaTab');
  });

  test("a tela usa as DUAS funções que existiam sem chamador", () => {
    expect(tela).toContain("getMyBilling");
    expect(tela).toContain("openBillingPortal");
  });

  test("⚠️ a origem decide o botão", () => {
    /* Assinatura feita pela loja da Apple/Google não abre no portal do Stripe.
       Um botão que abre um portal vazio faz a paciente concluir que o app está
       quebrado, em vez de procurar no lugar certo. */
    const i = tela.indexOf("function gerenciaNoStripe");
    expect(i).toBeGreaterThan(-1);
    const corpo = tela.slice(i, tela.indexOf("export function"));
    expect(corpo).toContain('"stripe"');
    /* `null`/vazio conta como Stripe: é o que as assinaturas antigas têm. */
    expect(corpo).toContain('s === ""');
    /* ⚠️ LINK, e não instrução escrita. A primeira versão mandava "use Ajustes
       → Apple ID → Assinaturas" em texto: navegar quatro níveis de menu do
       sistema de cabeça é o atrito que faz a paciente pedir estorno no cartão
       em vez de cancelar. */
    expect(tela).toContain("https://apps.apple.com/account/subscriptions");
    expect(tela).toContain("https://play.google.com/store/account/subscriptions");
    /* ⚠️ `https`, NUNCA `itms-apps`: o esquema nativo não existe no navegador,
       e num PWA instalado o link simplesmente não faria nada, sem erro. */
    expect(tela).not.toContain("itms-apps");
  });

  test('⚠️ "tem acesso" e "está pagando" são coisas diferentes', () => {
    /**
     * A bancada pegou: uma assinatura CANCELADA com período pago até setembro
     * mostrava o título "Plano gratuito" e, logo abaixo, "seu acesso vai até 16
     * de setembro" — duas frases que se contradizem na mesma tela.
     *
     * E separar os dois criou um estado novo que também precisou de saída:
     * cancelada + com acesso não pode ficar sem botão nenhum, porque é
     * exatamente quem pode querer voltar atrás.
     */
    expect(tela).toContain("const temAcesso");
    expect(tela).toContain('temAcesso ? "Premium" : "Plano gratuito"');
    expect(tela).toContain("Reativar assinatura");
  });

  test("quem nunca assinou não lê texto de cancelamento", () => {
    /* "Cancelar é imediato" não responde nenhuma pergunta de quem nunca
       assinou — e tela que responde o que não foi perguntado ensina que o
       texto dali é enfeite. A frase do limite ético fica sempre. */
    expect(tela).toContain("nuncaAssinou");
    expect(tela).toContain('{ativa && "Cancelar é imediato');
    expect(tela).toContain("Nada do seu cuidado depende da assinatura");
  });
});

describe("⚠️ Sair nunca fica abaixo da dobra", () => {
  test("a folha é coluna, e o rodapé não rola", () => {
    /* Medido com a área segura injetada: com a folha inteira rolando, num
       iPhone SE (375×667) saíam da vista Pós-parto, Painel e Sair. Só a LISTA
       rola; Painel e Sair vivem num irmão `shrink-0`. */
    expect(menu).toContain("flex max-h-[calc(100dvh-8rem)]");
    expect(menu).toContain("flex-col overflow-hidden");
    expect(menu).toContain("min-h-0 flex-1 space-y-0.5 overflow-y-auto");
    /* O rodapé vem DEPOIS da lista e não encolhe. */
    const lista = menu.indexOf("min-h-0 flex-1");
    const rodape = menu.indexOf('<div className="shrink-0">');
    expect(lista).toBeGreaterThan(-1);
    expect(rodape).toBeGreaterThan(lista);
    /* ⚠️ `onSair` CONTÉM "Sair", e ele mora na lista de props no TOPO do
       arquivo — `indexOf("Sair")` achava a prop e o teste reprovava um layout
       correto. A âncora é o RÓTULO renderizado, entre a tag e o fechamento. */
    const rotulo = menu.indexOf(">\n            Sair\n          </button>");
    expect(rotulo === -1 ? menu.indexOf("            Sair\n") : rotulo).toBeGreaterThan(rodape);
  });
});

describe("os dois sinais do menu", () => {
  test("⚠️ Notificações tem contador, e NÃO ponto", () => {
    /* Os dois apareciam pela mesma condição (`naoLidas > 0`) e diziam a mesma
       coisa. O número é estritamente mais informativo que o ponto. */
    const i = menu.indexOf("onClick={onNotificacoes}");
    const bloco = menu.slice(i, menu.indexOf("</button>", i));
    expect(bloco).not.toContain("bg-rose-500 ring-2");
    expect(bloco).toContain("naoLidas > 0");
  });

  test("o Perfil mantém o ponto — lá ele é a única informação", () => {
    expect(menu).toContain('perfilPendente && tab === "Perfil"');
    /* E ele vem com o texto do que falta: ponto sozinho obriga a abrir para
       descobrir o que é. */
    expect(menu).toContain("contato de emergência");
  });

  test("o cabeçalho usa a foto que ela já subiu", () => {
    /* Era um ícone genérico com `avatar_url` preenchida — o mesmo campo que a
       aba Amigas usa para mostrar o rosto das amigas dela. */
    expect(menu).toContain("foto?: string | null");
    expect(conta).toContain("foto={profile?.avatar_url ?? null}");
  });
});
