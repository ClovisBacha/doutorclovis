/**
 * AS PEÇAS DOS SONS PARA DORMIR — a família do coração da Saúde, no lugar dos
 * emojis (set/2026).
 *
 * Eram 33 sons e 2 histórias desenhados com emoji, numa tela escura em que
 * tudo o mais é material do app: emoji tem desenho e cor próprios em cada
 * sistema, e no iPhone metade deles sai com uma paleta que não é a nossa. As
 * peças foram geradas com a referência do dono (nano_banana_pro +
 * image_references) e recortadas por `scripts/bebes/do-drive.mjs`.
 *
 * ⚠️ O mapa é PARCIAL de propósito: `IconeDoSom` cai no emoji quando a peça
 * não existe — som novo entra com emoji e ganha peça quando a arte for feita,
 * nunca com um buraco. E o emoji continua sendo a fonte do `aria`/texto, que
 * é o que o leitor de tela e o push usam.
 *
 * Mora em `components/` (e não em `lib/`) porque importa `.webp`: um teste
 * do bun morreria no primeiro `import`.
 */
import ic_ar_condicionado from "@/assets/sons/ar-condicionado.webp";
import ic_aviao from "@/assets/sons/aviao.webp";
import ic_branco from "@/assets/sons/branco.webp";
import ic_cachoeira from "@/assets/sons/cachoeira.webp";
import ic_chuva from "@/assets/sons/chuva.webp";
import ic_chuva_carro from "@/assets/sons/chuva-carro.webp";
import ic_chuva_forte from "@/assets/sons/chuva-forte.webp";
import ic_chuva_telhado from "@/assets/sons/chuva-telhado.webp";
import ic_cigarras from "@/assets/sons/cigarras.webp";
import ic_coracao from "@/assets/sons/coracao.webp";
import ic_drone from "@/assets/sons/drone.webp";
import ic_floresta_noite from "@/assets/sons/floresta-noite.webp";
import ic_fogueira from "@/assets/sons/fogueira.webp";
import ic_historia_mar from "@/assets/sons/historia-mar.webp";
import ic_historia_trem from "@/assets/sons/historia-trem.webp";
import ic_lago from "@/assets/sons/lago.webp";
import ic_lareira from "@/assets/sons/lareira.webp";
import ic_maquina_lavar from "@/assets/sons/maquina-lavar.webp";
import ic_mar from "@/assets/sons/mar.webp";
import ic_marrom from "@/assets/sons/marrom.webp";
import ic_pad from "@/assets/sons/pad.webp";
import ic_passaros from "@/assets/sons/passaros.webp";
import ic_piano from "@/assets/sons/piano.webp";
import ic_riacho from "@/assets/sons/riacho.webp";
import ic_rosa from "@/assets/sons/rosa.webp";
import ic_sapos from "@/assets/sons/sapos.webp";
import ic_secador from "@/assets/sons/secador.webp";
import ic_sino_vento from "@/assets/sons/sino-vento.webp";
import ic_tempestade from "@/assets/sons/tempestade.webp";
import ic_tigela from "@/assets/sons/tigela.webp";
import ic_ventilador from "@/assets/sons/ventilador.webp";
import ic_vento_folhas from "@/assets/sons/vento-folhas.webp";
import ic_vento_janela from "@/assets/sons/vento-janela.webp";
import ic_ventre from "@/assets/sons/ventre.webp";

/** Chave do som (`SomKey`) ou da história (`Historia.chave`) → arte. */
export const ARTE_DO_SOM: Readonly<Partial<Record<string, string>>> = {
  "ar-condicionado": ic_ar_condicionado,
  aviao: ic_aviao,
  branco: ic_branco,
  cachoeira: ic_cachoeira,
  chuva: ic_chuva,
  "chuva-carro": ic_chuva_carro,
  "chuva-forte": ic_chuva_forte,
  "chuva-telhado": ic_chuva_telhado,
  cigarras: ic_cigarras,
  coracao: ic_coracao,
  drone: ic_drone,
  "floresta-noite": ic_floresta_noite,
  fogueira: ic_fogueira,
  "casa-do-mar": ic_historia_mar,
  "trem-da-noite": ic_historia_trem,
  lago: ic_lago,
  lareira: ic_lareira,
  "maquina-lavar": ic_maquina_lavar,
  mar: ic_mar,
  marrom: ic_marrom,
  pad: ic_pad,
  passaros: ic_passaros,
  piano: ic_piano,
  riacho: ic_riacho,
  rosa: ic_rosa,
  sapos: ic_sapos,
  secador: ic_secador,
  "sino-vento": ic_sino_vento,
  tempestade: ic_tempestade,
  tigela: ic_tigela,
  ventilador: ic_ventilador,
  "vento-folhas": ic_vento_folhas,
  "vento-janela": ic_vento_janela,
  ventre: ic_ventre,
};

/**
 * O ícone de um som: a peça quando existe, o emoji quando não.
 * `tamanho` em px (a caixa é quadrada). `drop-shadow` suave para a peça
 * pousar no fundo escuro sem borda.
 */
export function IconeDoSom({
  chave,
  emoji,
  tamanho = 28,
  className = "",
}: {
  chave: string;
  emoji: string;
  tamanho?: number;
  className?: string;
}) {
  const arte = ARTE_DO_SOM[chave];
  if (!arte) {
    return (
      <span
        aria-hidden
        className={`leading-none ${className}`}
        style={{ fontSize: tamanho * 0.86 }}
      >
        {emoji}
      </span>
    );
  }
  return (
    <img
      src={arte}
      alt=""
      aria-hidden
      width={tamanho}
      height={tamanho}
      className={`shrink-0 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)] ${className}`}
      style={{ width: tamanho, height: tamanho }}
    />
  );
}
