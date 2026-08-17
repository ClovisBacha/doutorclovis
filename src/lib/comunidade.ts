/**
 * A COMUNIDADE — quais portas a aba mostra, e por quê.
 *
 * A aba assumiu o lugar do Chat na barra de baixo (ver `BottomSection`). O que
 * ela faz de mais valioso na primeira versão não é uma função nova: é **dar uma
 * porta única a quatro coisas que já existiam e não tinham nenhuma**.
 *
 * O Álbum Familiar vivia só em `/album/<token>`, a votação de nomes era uma
 * sub-aba escondida dentro do hub do Bebê, o painel do acompanhante morava em
 * `/acompanhar/<token>` e as Amigas eram alcançáveis por um ícone na fita do
 * jogo. Quatro peças de convívio, quatro caminhos diferentes, nenhum deles onde
 * alguém procuraria "as pessoas que estão comigo nisso".
 *
 * A régua mora aqui e não no componente pela razão de sempre neste repositório:
 * o componente importa `sonner`, que toca `document` ao carregar e derruba o
 * `bun test` inteiro.
 */

export type PortaDaComunidade = {
  key: string;
  label: string;
  sub: string;
  emoji: string;
  /** Aba de destino. */
  destino: string;
  /** Sub-tela dentro do destino, quando ele é um hub. */
  subDestino?: string;
};

/**
 * As quatro portas, na ordem em que aparecem.
 *
 * A ordem é por PROXIMIDADE: primeiro as pessoas (amigas, acompanhante), depois
 * as coisas que se fazem com elas (álbum, nome). Uma grade que abrisse pelo
 * álbum apresentaria a aba como um lugar de arquivos.
 */
export const PORTAS: PortaDaComunidade[] = [
  {
    key: "amigas",
    label: "Amigas",
    sub: "Quem está com você",
    emoji: "👯",
    destino: "Amigas",
  },
  {
    key: "acompanhante",
    label: "Acompanhante",
    sub: "Marido, mãe, quem você escolher",
    emoji: "🤝",
    destino: "Acompanhante",
  },
  {
    key: "album",
    label: "Álbum",
    sub: "As fotos que a família vê",
    emoji: "📸",
    destino: "Bebê",
    subDestino: "album",
  },
  {
    key: "nome",
    label: "Nome do bebê",
    sub: "A família sugere e vota",
    emoji: "💭",
    destino: "Bebê",
    subDestino: "nome",
  },
];

/**
 * As portas que valem AGORA.
 *
 * ⚠️ **Em Modo Cuidado, "Nome do bebê" sai — e Amigas, Acompanhante e Álbum
 * ficam.** A separação não é de tom, é de tempo verbal: votar num nome é uma
 * decisão sobre um bebê que vai nascer, e oferecê-la a quem acabou de perder a
 * gestação é o app não ter entendido o que aconteceu.
 *
 * As outras três ficam por razões diferentes e igualmente concretas. Amigas e
 * Acompanhante são a rede de apoio, que é justamente do que ela mais precisa
 * agora — tirá-las seria isolá-la no pior momento. E o Álbum é dela: as fotos
 * que já estão lá são a memória do que houve, e escondê-las seria o app apagar
 * o bebê dela. A mesma decisão que manteve `exam_files` de pé quando o envio de
 * exames saiu do produto: parar de pedir é uma coisa, apagar o que já existe é
 * outra, e muito mais irreversível.
 *
 * O bolão do nascimento também some, mas o portão dele é `bolaoDisponivel`, em
 * `bolao.ts`, e é conferido no SERVIDOR — ele carrega dado de outras pessoas.
 */
export function portasDaComunidade({ careMode }: { careMode: boolean }): PortaDaComunidade[] {
  if (!careMode) return PORTAS;
  return PORTAS.filter((p) => p.key !== "nome");
}
