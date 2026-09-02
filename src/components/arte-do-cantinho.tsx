/**
 * A ARTE DA VITRINE DO CANTINHO — a peça 3D de cada item grátis e de cada
 * conjunto, no lugar do emoji.
 *
 * ⚠️ SÓ A VITRINE. O emoji continua sendo o que a TRILHA desenha
 * (`DecorSprite`, a bandeja do Arrumar, os layouts gravados): trocar o sprite
 * por imagem mexeria no tamanho, na animação e nos layouts que as pacientes já
 * montaram. Aqui é onde ela DECIDE comprar, e é onde o objeto precisa ter volume.
 *
 * ⚠️ MAPA POR ID, com o emoji como recuo: os 107 itens vivos têm arte, e um item novo
 * entra aqui só quando a arte dele existir — até lá, o emoji. Mora em `components/` (e não em `lib/`) porque importa `.webp`,
 * e um teste do `bun` morreria no primeiro `import`.
 */
import i_agua_caranguejo from "@/assets/cantinho/agua-caranguejo.webp";
import i_agua_cisne from "@/assets/cantinho/agua-cisne.webp";
import i_agua_concha from "@/assets/cantinho/agua-concha.webp";
import i_agua_coral from "@/assets/cantinho/agua-coral.webp";
import i_agua_foca from "@/assets/cantinho/agua-foca.webp";
import i_agua_fonte from "@/assets/cantinho/agua-fonte.webp";
import i_agua_golfinho from "@/assets/cantinho/agua-golfinho.webp";
import i_agua_patinho from "@/assets/cantinho/agua-patinho.webp";
import i_agua_peixinho from "@/assets/cantinho/agua-peixinho.webp";
import i_agua_poca from "@/assets/cantinho/agua-poca.webp";
import i_agua_polvo from "@/assets/cantinho/agua-polvo.webp";
import i_agua_sapinho from "@/assets/cantinho/agua-sapinho.webp";
import i_bicho_abelha from "@/assets/cantinho/bicho-abelha.webp";
import i_bicho_borboleta from "@/assets/cantinho/bicho-borboleta.webp";
import i_bicho_caracol from "@/assets/cantinho/bicho-caracol.webp";
import i_bicho_coelho from "@/assets/cantinho/bicho-coelho.webp";
import i_bicho_coruja from "@/assets/cantinho/bicho-coruja.webp";
import i_bicho_esquilo from "@/assets/cantinho/bicho-esquilo.webp";
import i_bicho_gato from "@/assets/cantinho/bicho-gato.webp";
import i_bicho_joaninha from "@/assets/cantinho/bicho-joaninha.webp";
import i_bicho_lagarta from "@/assets/cantinho/bicho-lagarta.webp";
import i_bicho_ourico from "@/assets/cantinho/bicho-ourico.webp";
import i_bicho_ovelha from "@/assets/cantinho/bicho-ovelha.webp";
import i_bicho_passaro from "@/assets/cantinho/bicho-passaro.webp";
import i_bicho_raposa from "@/assets/cantinho/bicho-raposa.webp";
import i_bicho_tartaruga from "@/assets/cantinho/bicho-tartaruga.webp";
import i_ceu_arcoiris from "@/assets/cantinho/ceu-arcoiris.webp";
import i_ceu_balao_ar from "@/assets/cantinho/ceu-balao-ar.webp";
import i_ceu_carpas from "@/assets/cantinho/ceu-carpas.webp";
import i_ceu_cometa from "@/assets/cantinho/ceu-cometa.webp";
import i_ceu_estrelinhas from "@/assets/cantinho/ceu-estrelinhas.webp";
import i_ceu_fogos from "@/assets/cantinho/ceu-fogos.webp";
import i_ceu_lua from "@/assets/cantinho/ceu-lua.webp";
import i_ceu_nuvem from "@/assets/cantinho/ceu-nuvem.webp";
import i_ceu_passarinhos from "@/assets/cantinho/ceu-passarinhos.webp";
import i_ceu_pipa from "@/assets/cantinho/ceu-pipa.webp";
import i_ceu_sol from "@/assets/cantinho/ceu-sol.webp";
import i_clima_bolhas from "@/assets/cantinho/clima-bolhas.webp";
import i_clima_folhas from "@/assets/cantinho/clima-folhas.webp";
import i_clima_neve from "@/assets/cantinho/clima-neve.webp";
import i_clima_peninhas from "@/assets/cantinho/clima-peninhas.webp";
import i_clima_petalas from "@/assets/cantinho/clima-petalas.webp";
import i_clima_poeira from "@/assets/cantinho/clima-poeira.webp";
import i_especial_arvore from "@/assets/cantinho/especial-arvore.webp";
import i_especial_carrossel from "@/assets/cantinho/especial-carrossel.webp";
import i_especial_chuva from "@/assets/cantinho/especial-chuva.webp";
import i_especial_colecao from "@/assets/cantinho/especial-colecao.webp";
import i_especial_dianoite from "@/assets/cantinho/especial-dianoite.webp";
import i_especial_inverno from "@/assets/cantinho/especial-inverno.webp";
import i_especial_natal from "@/assets/cantinho/especial-natal.webp";
import i_especial_outono from "@/assets/cantinho/especial-outono.webp";
import i_especial_pavao from "@/assets/cantinho/especial-pavao.webp";
import i_especial_primavera from "@/assets/cantinho/especial-primavera.webp";
import i_especial_vagalume from "@/assets/cantinho/especial-vagalume.webp";
import i_fundo_amanhecer from "@/assets/cantinho/fundo-amanhecer.webp";
import i_fundo_aurora from "@/assets/cantinho/fundo-aurora.webp";
import i_fundo_bosque from "@/assets/cantinho/fundo-bosque.webp";
import i_fundo_campo from "@/assets/cantinho/fundo-campo.webp";
import i_fundo_deserto from "@/assets/cantinho/fundo-deserto.webp";
import i_fundo_estrelas from "@/assets/cantinho/fundo-estrelas.webp";
import i_fundo_lago from "@/assets/cantinho/fundo-lago.webp";
import i_fundo_lavanda from "@/assets/cantinho/fundo-lavanda.webp";
import i_fundo_mar from "@/assets/cantinho/fundo-mar.webp";
import i_fundo_neve from "@/assets/cantinho/fundo-neve.webp";
import i_fundo_nuvens from "@/assets/cantinho/fundo-nuvens.webp";
import i_fundo_quartinho from "@/assets/cantinho/fundo-quartinho.webp";
import i_fundo_simples from "@/assets/cantinho/fundo-simples.webp";
import i_luz_lampiao from "@/assets/cantinho/luz-lampiao.webp";
import i_luz_lanterna from "@/assets/cantinho/luz-lanterna.webp";
import i_luz_pisca from "@/assets/cantinho/luz-pisca.webp";
import i_luz_vela from "@/assets/cantinho/luz-vela.webp";
import i_objeto_almofada from "@/assets/cantinho/objeto-almofada.webp";
import i_objeto_berco from "@/assets/cantinho/objeto-berco.webp";
import i_objeto_caixinha from "@/assets/cantinho/objeto-caixinha.webp";
import i_objeto_cestinho from "@/assets/cantinho/objeto-cestinho.webp";
import i_objeto_chaleira from "@/assets/cantinho/objeto-chaleira.webp";
import i_objeto_espelho from "@/assets/cantinho/objeto-espelho.webp";
import i_objeto_fones from "@/assets/cantinho/objeto-fones.webp";
import i_objeto_livrinho from "@/assets/cantinho/objeto-livrinho.webp";
import i_objeto_luminaria from "@/assets/cantinho/objeto-luminaria.webp";
import i_objeto_matrioska from "@/assets/cantinho/objeto-matrioska.webp";
import i_objeto_mobile from "@/assets/cantinho/objeto-mobile.webp";
import i_objeto_novelo from "@/assets/cantinho/objeto-novelo.webp";
import i_objeto_poltrona from "@/assets/cantinho/objeto-poltrona.webp";
import i_objeto_quadrinho from "@/assets/cantinho/objeto-quadrinho.webp";
import i_objeto_tapete from "@/assets/cantinho/objeto-tapete.webp";
import i_planta_bonsai from "@/assets/cantinho/planta-bonsai.webp";
import i_planta_cacto from "@/assets/cantinho/planta-cacto.webp";
import i_planta_cerejeira from "@/assets/cantinho/planta-cerejeira.webp";
import i_planta_cogumelo from "@/assets/cantinho/planta-cogumelo.webp";
import i_planta_girassol from "@/assets/cantinho/planta-girassol.webp";
import i_planta_hortela from "@/assets/cantinho/planta-hortela.webp";
import i_planta_palmeira from "@/assets/cantinho/planta-palmeira.webp";
import i_planta_roseira from "@/assets/cantinho/planta-roseira.webp";
import i_planta_suculenta from "@/assets/cantinho/planta-suculenta.webp";
import i_planta_trevo from "@/assets/cantinho/planta-trevo.webp";
import i_planta_tulipa from "@/assets/cantinho/planta-tulipa.webp";
import i_planta_vaso from "@/assets/cantinho/planta-vaso.webp";
import i_tema_ceu_v1 from "@/assets/cantinho/tema-ceu-v1.webp";
import i_trilha_constelacao from "@/assets/cantinho/trilha-constelacao.webp";
import i_trilha_coracao from "@/assets/cantinho/trilha-coracao.webp";
import i_trilha_cristais from "@/assets/cantinho/trilha-cristais.webp";
import i_trilha_jardim from "@/assets/cantinho/trilha-jardim.webp";
import i_trilha_lotus from "@/assets/cantinho/trilha-lotus.webp";
import i_trilha_origami from "@/assets/cantinho/trilha-origami.webp";
import i_trilha_perolas from "@/assets/cantinho/trilha-perolas.webp";
import i_trilha_planetas from "@/assets/cantinho/trilha-planetas.webp";
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
  "agua-caranguejo": i_agua_caranguejo,
  "agua-cisne": i_agua_cisne,
  "agua-concha": i_agua_concha,
  "agua-coral": i_agua_coral,
  "agua-foca": i_agua_foca,
  "agua-fonte": i_agua_fonte,
  "agua-golfinho": i_agua_golfinho,
  "agua-patinho": i_agua_patinho,
  "agua-peixinho": i_agua_peixinho,
  "agua-poca": i_agua_poca,
  "agua-polvo": i_agua_polvo,
  "agua-sapinho": i_agua_sapinho,
  "bicho-abelha": i_bicho_abelha,
  "bicho-borboleta": i_bicho_borboleta,
  "bicho-caracol": i_bicho_caracol,
  "bicho-coelho": i_bicho_coelho,
  "bicho-coruja": i_bicho_coruja,
  "bicho-esquilo": i_bicho_esquilo,
  "bicho-gato": i_bicho_gato,
  "bicho-joaninha": i_bicho_joaninha,
  "bicho-lagarta": i_bicho_lagarta,
  "bicho-ourico": i_bicho_ourico,
  "bicho-ovelha": i_bicho_ovelha,
  "bicho-passaro": i_bicho_passaro,
  "bicho-raposa": i_bicho_raposa,
  "bicho-tartaruga": i_bicho_tartaruga,
  "ceu-arcoiris": i_ceu_arcoiris,
  "ceu-balao-ar": i_ceu_balao_ar,
  "ceu-carpas": i_ceu_carpas,
  "ceu-cometa": i_ceu_cometa,
  "ceu-estrelinhas": i_ceu_estrelinhas,
  "ceu-fogos": i_ceu_fogos,
  "ceu-lua": i_ceu_lua,
  "ceu-nuvem": i_ceu_nuvem,
  "ceu-passarinhos": i_ceu_passarinhos,
  "ceu-pipa": i_ceu_pipa,
  "ceu-sol": i_ceu_sol,
  "clima-bolhas": i_clima_bolhas,
  "clima-folhas": i_clima_folhas,
  "clima-neve": i_clima_neve,
  "clima-peninhas": i_clima_peninhas,
  "clima-petalas": i_clima_petalas,
  "clima-poeira": i_clima_poeira,
  "especial-arvore": i_especial_arvore,
  "especial-carrossel": i_especial_carrossel,
  "especial-chuva": i_especial_chuva,
  "especial-colecao": i_especial_colecao,
  "especial-dianoite": i_especial_dianoite,
  "especial-inverno": i_especial_inverno,
  "especial-natal": i_especial_natal,
  "especial-outono": i_especial_outono,
  "especial-pavao": i_especial_pavao,
  "especial-primavera": i_especial_primavera,
  "especial-vagalume": i_especial_vagalume,
  "fundo-amanhecer": i_fundo_amanhecer,
  "fundo-aurora": i_fundo_aurora,
  "fundo-bosque": i_fundo_bosque,
  "fundo-campo": i_fundo_campo,
  "fundo-deserto": i_fundo_deserto,
  "fundo-estrelas": i_fundo_estrelas,
  "fundo-lago": i_fundo_lago,
  "fundo-lavanda": i_fundo_lavanda,
  "fundo-mar": i_fundo_mar,
  "fundo-neve": i_fundo_neve,
  "fundo-nuvens": i_fundo_nuvens,
  "fundo-quartinho": i_fundo_quartinho,
  "fundo-simples": i_fundo_simples,
  "luz-lampiao": i_luz_lampiao,
  "luz-lanterna": i_luz_lanterna,
  "luz-pisca": i_luz_pisca,
  "luz-vela": i_luz_vela,
  "objeto-almofada": i_objeto_almofada,
  "objeto-berco": i_objeto_berco,
  "objeto-caixinha": i_objeto_caixinha,
  "objeto-cestinho": i_objeto_cestinho,
  "objeto-chaleira": i_objeto_chaleira,
  "objeto-espelho": i_objeto_espelho,
  "objeto-fones": i_objeto_fones,
  "objeto-livrinho": i_objeto_livrinho,
  "objeto-luminaria": i_objeto_luminaria,
  "objeto-matrioska": i_objeto_matrioska,
  "objeto-mobile": i_objeto_mobile,
  "objeto-novelo": i_objeto_novelo,
  "objeto-poltrona": i_objeto_poltrona,
  "objeto-quadrinho": i_objeto_quadrinho,
  "objeto-tapete": i_objeto_tapete,
  "planta-bonsai": i_planta_bonsai,
  "planta-cacto": i_planta_cacto,
  "planta-cerejeira": i_planta_cerejeira,
  "planta-cogumelo": i_planta_cogumelo,
  "planta-girassol": i_planta_girassol,
  "planta-hortela": i_planta_hortela,
  "planta-palmeira": i_planta_palmeira,
  "planta-roseira": i_planta_roseira,
  "planta-suculenta": i_planta_suculenta,
  "planta-trevo": i_planta_trevo,
  "planta-tulipa": i_planta_tulipa,
  "planta-vaso": i_planta_vaso,
  "tema-ceu-v1": i_tema_ceu_v1,
  "trilha-constelacao": i_trilha_constelacao,
  "trilha-coracao": i_trilha_coracao,
  "trilha-cristais": i_trilha_cristais,
  "trilha-jardim": i_trilha_jardim,
  "trilha-lotus": i_trilha_lotus,
  "trilha-origami": i_trilha_origami,
  "trilha-perolas": i_trilha_perolas,
  "trilha-planetas": i_trilha_planetas,
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
