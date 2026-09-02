/**
 * A ARTE DA VITRINE DO CANTINHO — a peça 3D de cada item grátis e de cada
 * conjunto, no lugar do emoji.
 *
 * ⚠️ SÓ A VITRINE. O emoji continua sendo o que a TRILHA desenha
 * (`DecorSprite`, a bandeja do Arrumar, os layouts gravados): trocar o sprite
 * por imagem mexeria no tamanho, na animação e nos layouts que as pacientes já
 * montaram. Aqui é onde ela DECIDE comprar, e é onde o objeto precisa ter volume.
 *
 * ⚠️ MAPA POR ID, com o emoji como recuo: são 94 itens e 17 têm arte — os
 * outros continuam com o emoji, e um item novo entra aqui só quando a arte
 * dele existir. Mora em `components/` (e não em `lib/`) porque importa `.webp`,
 * e um teste do `bun` morreria no primeiro `import`.
 */
import i_trilha_jardim from "@/assets/cantinho/trilha-jardim.webp";
import i_fundo_simples from "@/assets/cantinho/fundo-simples.webp";
import i_tema_ceu_v1 from "@/assets/cantinho/tema-ceu-v1.webp";
import i_planta_suculenta from "@/assets/cantinho/planta-suculenta.webp";
import i_objeto_cestinho from "@/assets/cantinho/objeto-cestinho.webp";
import i_ceu_estrelinhas from "@/assets/cantinho/ceu-estrelinhas.webp";
import i_ceu_nuvem from "@/assets/cantinho/ceu-nuvem.webp";
import i_bicho_borboleta from "@/assets/cantinho/bicho-borboleta.webp";
import i_fundo_amanhecer from "@/assets/cantinho/fundo-amanhecer.webp";
import i_trilha_lotus from "@/assets/cantinho/trilha-lotus.webp";
import i_luz_vela from "@/assets/cantinho/luz-vela.webp";
import i_agua_poca from "@/assets/cantinho/agua-poca.webp";
import i_planta_trevo from "@/assets/cantinho/planta-trevo.webp";
import i_objeto_livrinho from "@/assets/cantinho/objeto-livrinho.webp";
import i_bicho_joaninha from "@/assets/cantinho/bicho-joaninha.webp";
import i_especial_primavera from "@/assets/cantinho/especial-primavera.webp";
import i_especial_colecao from "@/assets/cantinho/especial-colecao.webp";
import c_mar from "@/assets/conjuntos/mar.webp";
import c_noite from "@/assets/conjuntos/noite.webp";
import c_floral from "@/assets/conjuntos/floral.webp";
import c_luzes from "@/assets/conjuntos/luzes.webp";
import c_cha from "@/assets/conjuntos/cha.webp";
import c_depois_da_chuva from "@/assets/conjuntos/depois-da-chuva.webp";
import c_bichinhos from "@/assets/conjuntos/bichinhos.webp";
import c_quintal from "@/assets/conjuntos/quintal.webp";
import c_lago from "@/assets/conjuntos/lago.webp";
import c_recife from "@/assets/conjuntos/recife.webp";
import c_madrugada from "@/assets/conjuntos/madrugada.webp";
import c_chao_de_floresta from "@/assets/conjuntos/chao-de-floresta.webp";
import c_costura from "@/assets/conjuntos/costura.webp";

/** id do item (`CANTINHO_ITEMS`) → arte 3D. Ausente = desenha o emoji. */
export const ARTE_DO_ITEM: Record<string, string> = {
  "trilha-jardim": i_trilha_jardim,
  "fundo-simples": i_fundo_simples,
  "tema-ceu-v1": i_tema_ceu_v1,
  "planta-suculenta": i_planta_suculenta,
  "objeto-cestinho": i_objeto_cestinho,
  "ceu-estrelinhas": i_ceu_estrelinhas,
  "ceu-nuvem": i_ceu_nuvem,
  "bicho-borboleta": i_bicho_borboleta,
  "fundo-amanhecer": i_fundo_amanhecer,
  "trilha-lotus": i_trilha_lotus,
  "luz-vela": i_luz_vela,
  "agua-poca": i_agua_poca,
  "planta-trevo": i_planta_trevo,
  "objeto-livrinho": i_objeto_livrinho,
  "bicho-joaninha": i_bicho_joaninha,
  "especial-primavera": i_especial_primavera,
  "especial-colecao": i_especial_colecao,
};

/** id do conjunto (`CONJUNTOS`) → domo 3D. Ausente = desenha o emoji. */
export const ARTE_DO_CONJUNTO: Record<string, string> = {
  mar: c_mar,
  noite: c_noite,
  floral: c_floral,
  luzes: c_luzes,
  cha: c_cha,
  "depois-da-chuva": c_depois_da_chuva,
  bichinhos: c_bichinhos,
  quintal: c_quintal,
  lago: c_lago,
  recife: c_recife,
  madrugada: c_madrugada,
  "chao-de-floresta": c_chao_de_floresta,
  costura: c_costura,
};
