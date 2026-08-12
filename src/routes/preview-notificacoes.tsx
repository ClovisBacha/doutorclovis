import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NotificacoesSheet } from "@/components/notificacoes-sheet";
import type { Notificacao } from "@/lib/notificacoes";

/**
 * Bancada da central de notificações.
 *
 * A gaveta é puramente apresentacional (recebe a lista pronta), então dá para
 * fotografá-la com exemplos — inclusive o estado de lista vazia, que na conta
 * real só acontece quando tudo já foi resolvido e é justamente o mais difícil
 * de reproduzir à mão.
 */
export const Route = createFileRoute("/preview-notificacoes")({
  // Mesmo cuidado da `/preview-home`: o valor volta como booleano no segundo
  // passe de validação, e só aceitar "1" apagaria o parâmetro.
  validateSearch: (s: Record<string, unknown>) => ({
    vazio: s.vazio === true || String(s.vazio ?? "") === "1",
  }),
  head: () => ({
    meta: [{ title: "Bancada das notificações" }, { name: "robots", content: "noindex" }],
  }),
  component: PreviewNotificacoes,
});

const EXEMPLO: Notificacao[] = [
  {
    id: "medico-ausente",
    icone: "👩‍⚕️",
    titulo: "Você ainda não tem um médico no app",
    corpo:
      "Encontre um obstetra por experiência, formação e cidade — ele passa a te acompanhar por aqui.",
    acao: { rotulo: "Encontrar um obstetra", executar: () => {} },
  },
  {
    id: "convide-medico",
    icone: "🎁",
    titulo: "Convide o seu médico e ganhe 1 ano de Premium",
    corpo:
      "Pelo seu link ele ganha 15% de desconto extra em qualquer plano — e, quando assinar, você ganha 1 ano de Premium grátis.",
    acao: { rotulo: "Pegar meu link", executar: () => {} },
  },
  {
    id: "local:Belo Horizonte",
    icone: "📍",
    titulo: "Mostrando o tempo de Belo Horizonte",
    corpo:
      "Com a sua localização, o céu e a chuva do app ficam iguais aos da sua janela. Toque para ativar.",
    acao: { rotulo: "Ativar localização", executar: () => {} },
  },
];

function PreviewNotificacoes() {
  const { vazio } = Route.useSearch();
  const [aberta, setAberta] = useState(true);
  /* Só a primeira aparece como lida: é o caso que mostra as duas aparências.
     O valor é o INSTANTE da leitura — é ele que faz a lida sumir da caixa
     depois de sete dias, e por isso a bancada usa uma data de agora: com uma
     data velha o item nem apareceria aqui. */
  const lidas = new Map([["medico-ausente", new Date().toISOString()]]);
  return (
    <div className="fixed inset-0 z-[75] bg-gradient-to-b from-sky-200 to-rose-100">
      {aberta && (
        <NotificacoesSheet
          lista={vazio ? [] : EXEMPLO}
          lidas={lidas}
          onFechar={() => setAberta(false)}
        />
      )}
    </div>
  );
}
