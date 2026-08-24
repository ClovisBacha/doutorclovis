/**
 * O CACHE DE MEMÓRIA DA COMUNIDADE — para voltar a uma aba não custar tudo de
 * novo.
 *
 * ─── O DEFEITO QUE ISTO CONSERTA ────────────────────────────────────────────
 *
 * As abas de `minha-conta` são montadas com `{tab === "X" && <X/>}`. Isso é
 * bom (a aba que não está na tela não custa render), e tem um preço que ninguém
 * tinha pago ainda: **trocar de aba DESMONTA o componente e joga fora o estado
 * dele**. Ir ao Bebê e voltar para o Feed refaz o feed inteiro — contexto,
 * publicações, autores, fotos assinadas, stories, sugeridos — e a paciente
 * espera de novo por uma tela que ela viu dez segundos atrás.
 *
 * É a metade da "lentidão entre interações fáceis" que o dono descreveu, e a
 * que mais irrita: não é a primeira abertura, é a QUINTA.
 *
 * ─── O DESENHO: mostra o velho, busca o novo ───────────────────────────────
 *
 * Ao voltar, a tela pinta na hora com o que estava guardado e dispara a busca
 * por trás. Quem já viu aquele feed vê a mesma tela instantaneamente; o que
 * mudou aparece quando chega.
 *
 * ─── ⚠️ E POR QUE ELE MORA NA MEMÓRIA, E NUNCA NO DISCO ─────────────────────
 *
 * ⚠️ **Nada aqui pode ir para o `localStorage`.** O que este cache guarda são
 * fotos, textos e nomes de OUTRAS pacientes — de uma base de gestação de alto
 * risco. Escrevê-lo em disco criaria uma segunda cópia desse conteúdo no
 * aparelho dela, que sobrevive ao logout, aparece em backup e não é apagada
 * pela varredura da LGPD (`conta.functions.ts` sabe apagar tabelas e baldes,
 * não o armazém local de outro aparelho). Memória é o único lugar em que este
 * dado pode existir do lado do cliente.
 *
 * ⚠️ **E ele é APAGADO no logout.** Um aparelho compartilhado — que num
 * consultório é o caso comum, não a exceção — não pode mostrar à próxima conta
 * o feed da anterior. `limparCacheDoFeed()` é chamada no `signOut`.
 *
 * ⚠️ **A validade é curta de propósito.** Não é para poupar rede: é para o feed
 * não mentir. Um cache de meia hora mostraria como "agora" um story que já
 * venceu e uma publicação que a autora arquivou.
 */

/** Quanto tempo o guardado ainda serve para pintar a tela. */
export const VALIDADE_MS = 90_000;

/**
 * A janela do PERFIL de outra pessoa — mais curta que a do feed, de propósito.
 *
 * ⚠️ **O que o cache do perfil guarda é mais que o do feed:** bio, selo, nome do
 * bebê e as publicações dela. Se a pessoa BLOQUEAR quem está olhando entre uma
 * abertura e a outra, o guardado mostraria por um instante um perfil que já não
 * pode ser visto — conteúdo que aquela paciente de fato já tinha visto, mas
 * ainda assim depois de a outra ter dito "não quero mais".
 *
 * A busca de verdade corrige em seguida (`indisponivel` → volta ao feed, e a
 * entrada é apagada), então a janela é o tamanho do estrago. Quarenta e cinco
 * segundos cobrem o padrão real — abrir, voltar, abrir de novo — e não cobrem
 * "voltei nesse perfil depois do almoço".
 */
export const VALIDADE_DO_PERFIL_MS = 45_000;

type Entrada = { dados: unknown; quando: number };

/**
 * ⚠️ **Módulo, e não `useRef`.** O ponto é justamente sobreviver à DESMONTAGEM
 * do componente — um `ref` morre junto com ele, que é o defeito.
 */
const armazem = new Map<string, Entrada>();

/**
 * Guarda o que a tela acabou de receber.
 *
 * ⚠️ Guardar `undefined` seria indistinguível de "não tem nada guardado", então
 * a chamada é ignorada — quem lê continua vendo "vazio" e busca de novo, que é
 * o certo.
 */
export function guardarNoCache(chave: string, dados: unknown): void {
  if (dados === undefined) return;
  armazem.set(chave, { dados, quando: Date.now() });
}

/**
 * O que está guardado, se ainda serve — ou `null`.
 *
 * ⚠️ **`agora` é parâmetro** para o teste não depender do relógio da máquina.
 * É a mesma decisão de `haQuantoPublicou`, e pela mesma razão: teste que lê o
 * relógio do contêiner falha às terças.
 */
export function lerDoCache<T>(
  chave: string,
  agora: number = Date.now(),
  validadeMs: number = VALIDADE_MS,
): T | null {
  const e = armazem.get(chave);
  if (!e) return null;
  /* ⚠️ Relógio que andou para TRÁS não valida um cache eterno: a diferença
     negativa também está fora da janela. */
  const idade = agora - e.quando;
  if (idade < 0 || idade > validadeMs) {
    armazem.delete(chave);
    return null;
  }
  return e.dados as T;
}

/**
 * Apaga UMA entrada.
 *
 * ⚠️ Existe para o caso em que o servidor recusa o que estava guardado — um
 * perfil que virou `indisponivel` (bloqueio, Modo Cuidado, conta apagada).
 * Sem isto, a entrada continuaria válida pelo resto da janela e a tela voltaria
 * a pintá-la na próxima abertura, depois de o servidor já ter dito não.
 */
export function esquecerDoCache(chave: string): void {
  armazem.delete(chave);
}

/**
 * Apaga tudo. Chamada no logout.
 *
 * ⚠️ **Sem argumento e sem seletividade**, de propósito: uma limpeza que
 * escolhe chaves esquece a chave nova que alguém acrescentar amanhã — e o que
 * ficaria para trás é o feed de outra pessoa num aparelho compartilhado.
 */
export function limparCacheDoFeed(): void {
  armazem.clear();
}

/**
 * Quantas entradas há agora.
 *
 * ⚠️ **É introspecção SÓ DE TESTE**, e está na lista de exceções de
 * `rede-tem-porta.test.ts` por isso. O armazém é um `Map` de módulo: sem esta
 * função não há como afirmar que ele esvaziou, e "esvaziou" é a asserção que
 * protege o feed de outra paciente num aparelho compartilhado. O comentário
 * anterior dizia "e para a bancada" — não era verdade, e uma justificativa
 * falsa é o que faz uma exceção virar buraco.
 */
export function tamanhoDoCache(): number {
  return armazem.size;
}
