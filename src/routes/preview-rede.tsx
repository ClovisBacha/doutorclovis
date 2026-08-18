/**
 * BANCADA DAS CONFIGURAÇÕES DO PERFIL SOCIAL — sem conta e sem banco.
 *
 * ⚠️ Ela já foi a bancada do FEED também, e não é mais: o feed do modelo
 * Instagram tem bancada própria (`/preview-instagram`), e a daqui ficou
 * apontando para componentes que o app não abre mais. Duas bancadas do mesmo
 * assunto é como uma delas passa a mostrar uma tela que não existe.
 *
 * O que sobrou é o que só existe aqui: a chave do perfil público, a bio e a
 * FILA DE PEDIDOS — que é impossível de olhar numa conta de verdade sem
 * arranjar alguém para pedir para te seguir.
 *
 * Endereços:
 *   /preview-rede               → o perfil sem pedido nenhum
 *   /preview-rede?pedidos=3     → com três na fila
 *   /preview-rede?luto=1        → Modo Cuidado (a seção inteira some)
 */
import { createFileRoute } from "@tanstack/react-router";
import { ConfiguracoesDoPerfil } from "@/components/rede-social";
import type { PerfilNaTela } from "@/lib/rede-social.functions";

export const Route = createFileRoute("/preview-rede")({
  component: Bancada,
  validateSearch: (q: Record<string, unknown>) => ({
    /* ⚠️ `== null` e NÃO `=== undefined`: o router serializa e revalida, e na
       segunda passada chega `null`. Mesma armadilha de `preview-saude`. */
    pedidos: q.pedidos == null ? 0 : Number(q.pedidos) || 0,
    luto: q.luto == null ? false : !!q.luto,
  }),
});

const PERFIL: PerfilNaTela = {
  id: "eu",
  nome: "Marina Costa",
  /* Sem a semana na bio: ela agora sai do SELO, e escrevê-la aqui esconderia
     o estado de "chave desligada". */
  bio: "Grávida da Helena 🎀",
  avatarUrl: null,
  publico: true,
  meuVinculo: null,
  souEu: true,
  meusSeguidores: 137,
  seloSemana: "32 semanas",
  seloBebe: "Helena",
  mostrarSemana: true,
  mostrarBebe: true,
  /* A aba "Do bebê" segue a MESMA chave da semana — é o mesmo fato. */
  bebe: {
    emoji: "🍆",
    fruta: "Berinjela",
    tamanho: "42,4 cm",
    peso: "1,7 kg",
    sobre: "Já reconhece a sua voz.",
  },
};

function Bancada() {
  const { pedidos, luto } = Route.useSearch();

  const fila = Array.from({ length: Math.max(0, Math.min(pedidos, 8)) }, (_, i) => ({
    id: `q${i}`,
    nome: ["Ana Paula", "Tia Zezé", "Bruna", "Letícia", "Cris", "Duda", "Nina", "Sol"][i],
    avatarUrl: null,
  }));

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <ConfiguracoesDoPerfil careMode={luto} bancada={{ perfil: PERFIL, pedidos: fila }} />
    </div>
  );
}
