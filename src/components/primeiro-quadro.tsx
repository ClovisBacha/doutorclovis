import { CeuDoDia, type NomeDoCeu } from "@/components/ceu-do-dia";

/**
 * O PRIMEIRO QUADRO DA ABERTURA — o que a paciente vê enquanto o app carrega.
 *
 * ─── ⚠️ O QUE ELE EXISTE PARA CONSERTAR É O SOCORRO ────────────────────────
 *
 * A barra de baixo e a Central de Emergência ficavam DEPOIS do
 * `if (loading) return` de `minha-conta.tsx`. Enquanto o app carregava, **o
 * botão de socorro não existia na tela**: a paciente que abre o app justamente
 * porque está passando mal encontrava um esqueleto cinza e nenhuma saída.
 *
 * E o comentário de `medicoResolvido` (na mesma tela) já afirmava, por escrito,
 * que "o SOS está clicável desde o primeiro pixel" — a intenção original estava
 * documentada, e o retorno antecipado a tinha quebrado em silêncio. Com este
 * componente a frase volta a ser verdade.
 *
 * ─── ⚠️ POR QUE ELE MORA AQUI, E NÃO INLINE NA ROTA ────────────────────────
 *
 * Porque o primeiro quadro precisava ser FOTOGRAFÁVEL. Enterrado dentro de
 * `minha-conta.tsx`, ele só aparece com uma sessão de verdade, por uma fração
 * de segundo, no meio de duas idas à rede — ou seja, ninguém nunca olhou para
 * ele. Como componente, `/preview-abertura` o abre em qualquer estado.
 *
 * É a mesma lição que a skill `/tela` nomeia: se você não consegue verificar,
 * não entregue.
 *
 * ─── ⚠️ O CROMO NÃO MORA AQUI DENTRO, E ISSO É DELIBERADO ──────────────────
 *
 * A barra e a Central de Emergência são IRMÃS deste componente, não filhas.
 * Elas precisam ser filhas DIRETAS do mesmo fragmento nos dois retornos de
 * `minha-conta` (o do carregamento e o normal) para que a chave
 * `cromo-do-app` as encontre na virada de `loading`. Passando-as por prop
 * daqui, elas ficariam um nível abaixo em um dos caminhos — o React as
 * desmontaria, e um SOS já em envio voltaria a "Pedir socorro agora".
 */
export function PrimeiroQuadro({
  ceu,
}: {
  /**
   * O céu a pintar no lugar do bloco cinza — ou `null` para o vulto neutro.
   *
   * ⚠️ **`null` NÃO é "sem céu por enquanto": é o DEEP LINK.** Quem abre por
   * `?tab=Caminho` ou `?tab=Feed` (os pushes do app usam isso) não está indo
   * para a home, e pintar a home durante a espera mostraria uma tela que não é
   * a dela — o app trocaria de ASSUNTO ao terminar de carregar. O vulto cinza é
   * neutro nos dois casos; a arte não é.
   *
   * ⚠️ E quando ele existe, não é uma decisão nova sobre o Céu Clássico (item
   * PAGO, `sky_theme === "v1"`): `useSkyNow` já resolve esta exata espera, e o
   * comentário dele diz por quê — antes de montar vale o céu do DIA, "o mais
   * neutro para essa espera de um quadro". Quem comprou o Clássico vê o padrão
   * pelo instante do carregamento, como já via.
   */
  ceu: NomeDoCeu | null;
}) {
  return (
    <>
      {/* ESQUELETO NO FORMATO DA HOME DO CELULAR.
          O anterior era uma grade de oito quadradinhos com 5 colunas — o
          desenho da versão de computador. No celular a tela trocava de
          SILHUETA ao carregar: primeiro uma grade cinza, depois um céu de
          borda a borda com o bebê no meio. Era metade do "pisca" que ela
          relatava; a outra metade era a rolagem.
          Agora o vulto é o mesmo: bloco alto sangrando nas laterais (o céu),
          cartão da semana em degrau e a fileira de medidas. O conteúdo
          aparece DENTRO do lugar onde já estava, em vez de empurrar tudo. */}
      <div className="md:hidden">
        {ceu ? (
          /* ⚠️ `relative` no pai é obrigatório: `CeuDoDia` é `absolute inset-0`
             e sem ele a arte escaparia para a página. */
          <div className="relative -mx-5 -mt-2 h-[62vh] overflow-hidden bg-muted">
            <CeuDoDia nome={ceu} />
          </div>
        ) : (
          <div className="skeleton -mx-5 -mt-2 h-[62vh] rounded-none" />
        )}
        <div className="relative mx-auto -mt-10 w-[86%] space-y-2">
          <div className="skeleton mx-auto h-16 w-32 rounded-t-3xl" />
          <div className="skeleton h-28 rounded-[26px]" />
        </div>
      </div>
      <div className="mx-auto hidden max-w-5xl px-5 py-8 space-y-4 md:block">
        <div className="skeleton h-52 rounded-3xl" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-[72px] rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-16 rounded-3xl" />
        <div className="skeleton h-24 rounded-3xl" />
      </div>
    </>
  );
}
