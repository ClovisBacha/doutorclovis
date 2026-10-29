import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OnboardingRitual, CodigoDaEmbaixadora } from "@/components/onboarding-ritual";

/**
 * Bancada do RITUAL DE BOAS-VINDAS.
 *
 * ─── POR QUE ELA PRECISOU EXISTIR ───────────────────────────────────────────
 *
 * O ritual só aparece para uma paciente recém-criada e SEM perfil, uma única
 * vez. Não há como reabri-lo: salvou, acabou. Enquanto ele só pedia nome, DUM e
 * foto, isso era um incômodo de revisão.
 *
 * ⚠️ NO DIA EM QUE ELE GANHOU O CAMPO DO CÓDIGO DA EMBAIXADORA, virou outra
 * coisa: um controle no PRIMEIRO MINUTO de toda paciente nova — e que decide se
 * uma influenciadora recebe ou não a indicação — que ninguém conseguia olhar
 * sem criar uma conta do zero. Foi escrito às cegas e entregue sem ninguém ter
 * visto. É exatamente o defeito que a skill `/tela` existe para impedir.
 *
 * ⚠️ A BANCADA FABRICA O DADO, NUNCA O DESENHO: ela injeta o PASSO e o código
 * guardado no navegador. O corpo de cada tela, o salvamento e as regras
 * continuam sendo os da produção.
 *
 * ⚠️ ELA COBRE AS DUAS PORTAS DO MESMO CÓDIGO, e por isso é uma bancada só: o
 * campo do ritual e o cartão do Perfil (`CodigoDaEmbaixadora`) são a mesma
 * funcionalidade em dois momentos, e o do Perfil vive dentro de uma aba que
 * exige sessão — ele estava tão invisível quanto o do ritual.
 *
 * Parâmetros:
 *   `?passo=4`        em qual passo abrir (o campo do código está no último)
 *   `?ref=MARIA`      simula ter chegado por um link de embaixadora
 *   `?nome=Ana`       o nome que veio do cadastro
 *   `?tela=perfil`    mostra o cartão da rede de segurança, do Perfil
 */
export const Route = createFileRoute("/preview-onboarding")({
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e não `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null` — `Number(null)` é 0, e a bancada voltaria
       sozinha para o primeiro passo. Sétima vez que isto aparece no repo. */
    passo: q.passo == null ? 4 : Number(q.passo),
    ref: q.ref == null ? "" : String(q.ref),
    nome: q.nome == null ? "Ana" : String(q.nome),
    tela: q.tela == null ? "ritual" : String(q.tela),
  }),
  head: () => ({
    meta: [{ title: "Bancada do onboarding" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewOnboarding,
});

function PreviewOnboarding() {
  const { passo, ref, nome, tela } = Route.useSearch();
  /* ⚠️ O ritual lê o código guardado na PRIMEIRA renderização
     (`useState(() => storedAffiliateCode())`), então o localStorage precisa
     estar escrito ANTES de ele montar — daí o `pronto`, que segura a montagem
     por um render. Sem isso a bancada mostraria sempre o campo vazio, que é
     justamente o estado que ela não precisava provar. */
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    try {
      if (ref) {
        localStorage.setItem(
          "obst_ref",
          JSON.stringify({ code: ref.toUpperCase(), at: Date.now() }),
        );
      } else {
        localStorage.removeItem("obst_ref");
      }
    } catch {
      /* storage indisponível — a bancada mostra o campo vazio */
    }
    setPronto(true);
  }, [ref]);

  if (!pronto) return null;

  /* O cartão do Perfil — a segunda porta do mesmo código. Ele se esconde sem
     sessão (é o certo em produção), então a bancada o liga explicitamente. */
  if (tela === "perfil") {
    return (
      <div className="mx-auto max-w-md p-4">
        <CodigoDaEmbaixadora bancada />
      </div>
    );
  }

  return (
    <OnboardingRitual
      /* `key` com os parâmetros: trocar `?ref=` ou `?passo=` no endereço
         remonta o ritual, em vez de deixar o estado antigo na tela. */
      key={`${ref}-${passo}`}
      initialName={nome}
      passoInicial={passo}
      onClose={() => {
        /* Fechar não faz nada aqui — a bancada existe para OLHAR. Navegar para
           `/minha-conta` levaria a um login. */
      }}
    />
  );
}
