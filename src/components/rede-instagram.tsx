/**
 * AS DUAS TELAS NO MODELO INSTAGRAM — o feed e o perfil.
 *
 * Pedido do dono: "vamos copiar exatamente o modelo do Instagram — a tela
 * principal, onde mostra todo mundo que você segue e às vezes gente que você
 * não segue, e a tela do perfil".
 *
 * As medidas moram em `src/lib/medidas-instagram.ts`, com a origem de cada uma
 * e um teste que cobra as relações (o anel fora da foto, a grade 3:4, a
 * hierarquia de tamanho dos avatares). Aqui fica o desenho.
 *
 * ─── O QUE FOI COPIADO, E O QUE NÃO ────────────────────────────────────────
 *
 * COPIADO: a estrutura inteira. Barra de topo com marca à esquerda e ações à
 * direita; fileira de stories com anel; post de imagem inteira com a linha de
 * ações embaixo e a legenda abaixo dela; perfil com avatar grande, números,
 * bio, botões e grade de três colunas com abas.
 *
 * NÃO COPIADO, e são três, todas deliberadas:
 *
 *  1. **O degradê do anel.** Laranja-rosa-roxo é a marca deles. A estrutura
 *     (anel aceso = tem coisa nova) é convenção; a cor é identidade.
 *  2. **Quatro abas viram duas.** Eles têm quatro tipos de conteúdo; este app
 *     tem um. Três abas vazias entregam a sensação de um app pela metade.
 *  3. **Seguidores e seguindo não são públicos.** A única divergência de
 *     produto, e está pesquisada — ver `NUMEROS_PUBLICOS`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ABAS_DO_PERFIL,
  ANEL_NOVO,
  ANEL_VISTO,
  AVATAR_DO_PERFIL,
  AVATAR_DO_POST,
  CAIXA_DO_STORY,
  ESPESSURA_DO_ANEL,
  FOTO_DO_STORY,
  NUMEROS_PUBLICOS,
  RAZAO_DA_GRADE,
  RAZAO_DO_POST,
  VAO_DA_GRADE,
  VAO_DO_ANEL,
  type AbaDoPerfil,
} from "@/lib/medidas-instagram";
import { PERSONAS, type Persona } from "@/lib/selo-do-perfil";
import { ATIVIDADES_DO_DESAFIO, fraseDoGrupo } from "@/lib/desafio-em-grupo";
import type { DesafioNaTela } from "@/lib/desafio-em-grupo.functions";
import {
  emojiDaReacao,
  enqueteValida,
  haQuantoPublicou,
  limparOpcoes,
  LIMITE_DA_OPCAO,
  OPCOES_MAX,
  OPCOES_MIN,
  rotuloDeVotos,
  LIMITE_DA_BIO,
  LIMITE_DO_TEXTO,
  MINIMO_DA_BUSCA,
  postEhValido,
  REACOES,
  textoDoAviso,
  totalDeReacoes,
  VISIBILIDADES,
  type AulaNoPost,
  type TipoDeReacao,
  type Visibilidade,
} from "@/lib/rede-social";
import {
  LIMITE_DA_PERGUNTA,
  recadoDoDesfecho,
  type DesfechoDaPergunta,
} from "@/lib/pergunta-clinica";
import { publicarAtalhos, type AtalhoDaAba } from "@/lib/atalhos-da-aba";
import type {
  AtividadeNaTela,
  BolhaDeStory,
  PerfilNaTela,
  PostNaTela,
} from "@/lib/rede-social.functions";

/* ══════════════════════════════════════════════════════════════════════════
   PEÇAS
   ══════════════════════════════════════════════════════════════════════════ */

function Foto({ url, nome, lado }: { url: string | null; nome: string; lado: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        className="rounded-full object-cover"
        style={{ width: lado, height: lado }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full bg-primary/15 font-semibold text-primary"
      style={{ width: lado, height: lado, fontSize: Math.round(lado * 0.4) }}
    >
      {nome.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** A bolinha com anel. `novo` acende; visto fica cinza. */
export function BolinhaDeStory({
  url,
  nome,
  rotulo,
  novo = true,
  aoTocar,
}: {
  url: string | null;
  nome: string;
  rotulo: string;
  novo?: boolean;
  aoTocar?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoTocar}
      className="press flex shrink-0 flex-col items-center gap-1"
      style={{ width: CAIXA_DO_STORY + 12 }}
    >
      {/* O anel é o fundo; o vão é o padding branco; a foto vem por cima.
          Três camadas, como no original — não uma borda no `<img>`, que
          encostaria na imagem e leria como moldura. */}
      <span
        className="flex items-center justify-center rounded-full"
        style={{
          width: CAIXA_DO_STORY,
          height: CAIXA_DO_STORY,
          padding: ESPESSURA_DO_ANEL,
          background: novo
            ? `linear-gradient(135deg, ${ANEL_NOVO[0]}, ${ANEL_NOVO[1]})`
            : ANEL_VISTO,
        }}
      >
        <span
          className="flex items-center justify-center rounded-full bg-background"
          style={{
            width: FOTO_DO_STORY + VAO_DO_ANEL * 2,
            height: FOTO_DO_STORY + VAO_DO_ANEL * 2,
          }}
        >
          <Foto url={url} nome={nome} lado={FOTO_DO_STORY} />
        </span>
      </span>
      <span className="w-full truncate text-center text-[11px] leading-tight text-foreground/80">
        {rotulo}
      </span>
    </button>
  );
}

export type Story = { id: string; nome: string; avatarUrl: string | null; novo: boolean };

export function FileiraDeStories({
  stories,
  aoTocar,
}: {
  stories: Story[];
  aoTocar?: (id: string) => void;
}) {
  if (stories.length === 0) return null;
  return (
    <div className="-mx-4 border-b border-border">
      {/* Rola na horizontal e sangra nas laterais — a última bolinha tem de
          encostar na borda da tela, senão a fileira parece ter acabado. */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stories.map((s) => (
          <BolinhaDeStory
            key={s.id}
            url={s.avatarUrl}
            nome={s.nome}
            rotulo={s.nome}
            novo={s.novo}
            aoTocar={() => aoTocar?.(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O CARROSSEL
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Várias fotos num post.
 *
 * ⚠️ **Rolagem nativa com `scroll-snap`, e não um `transform` controlado por
 * estado.** O deslizar do dedo tem inércia, resistência na borda e velocidade
 * que o sistema calcula — reimplementar isso em JavaScript dá sempre um
 * arrasto que parece quase certo e nunca é. O navegador já faz, e faz melhor.
 *
 * ⚠️ E os pontinhos saem do `scrollLeft`, não de um índice que o toque
 * incrementa: com índice próprio, arrastar até a metade e soltar deixaria o
 * ponto num lugar e a foto noutro.
 */
function Carrossel({ urls }: { urls: string[] }) {
  const [i, setI] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);

  if (urls.length === 0) return null;

  return (
    <div className="relative">
      <div
        ref={caixa}
        onScroll={(e) => {
          const el = e.currentTarget;
          const n = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
          if (n !== i) setI(n);
        }}
        className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ aspectRatio: String(RAZAO_DO_POST) }}
      >
        {urls.map((u, n) => (
          <div key={n} className="w-full shrink-0 snap-center overflow-hidden bg-muted/40">
            <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>

      {urls.length > 1 && (
        <>
          {/* O contador no canto, como eles fazem — é o que diz de cara que
              há mais de uma foto, antes de a pessoa tentar deslizar. */}
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
            {i + 1}/{urls.length}
          </span>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
            {urls.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  n === i ? "bg-primary" : "bg-foreground/25"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O POST — no formato deles
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O MARCADOR — desenhado, nunca 🔖.
 *
 * Mesma lição do 📞 da Central de Emergência e do 📅 da fita: emoji é um
 * caractere que cada fabricante desenha do jeito dele, e este aqui precisa ter
 * DOIS estados que se distingam de longe — vazio e cheio. O contorno com
 * `fill="none"` e o cheio com `fill="currentColor"` são a mesma silhueta, então
 * a troca não mexe no arranjo da linha.
 */
/**
 * A lupa da busca — desenhada, e pela razão de sempre.
 *
 * ⚠️ 🔍 é emoji COLORIDO em todo sistema, e ela senta ao lado de duas marcas
 * monocromáticas (o ♡ e o ＋). Medido na bancada: um ícone azul-e-cinza no meio
 * de dois traços da cor do texto lê como adesivo colado ali, não como a
 * terceira ação da mesma barra.
 */
function IconeLupa() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[21px] w-[21px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    >
      <circle cx="10.6" cy="10.6" r="6.4" />
      <path d="M15.4 15.4 20 20" />
    </svg>
  );
}

function IconeMarcador({ cheio }: { cheio: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-[22px] w-[22px]"
      fill={cheio ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M6 3.6h12c.6 0 1 .4 1 1v15.6l-7-4.4-7 4.4V4.6c0-.6.4-1 1-1z" />
    </svg>
  );
}

export function PostInstagram({
  post,
  aoReagir,
  aoAbrirPerfil,
  aoSalvar,
  aoApagar,
  aoDenunciar,
  aoVotar,
  sugerido = false,
}: {
  post: PostNaTela;
  aoReagir: (t: TipoDeReacao | null) => void;
  aoAbrirPerfil?: (id: string) => void;
  /** Guardar/desguardar. Sem ele o marcador não aparece. */
  aoSalvar?: (salvar: boolean) => void;
  /** Só faz sentido no post DELA — a tela confere `souAAutora`. */
  aoApagar?: () => void;
  /**
   * Denunciar. Só no post de OUTRA pessoa.
   *
   * ⚠️ Era a lacuna que fechava o círculo: a caixinha tinha denúncia e o FEED
   * não — o canal com mais alcance era o único sem canal de reporte. A régua
   * clínica agora roda em `publicarPost`; o que sobra são as coisas que régua
   * nenhuma pega (assédio, mentira, foto de outra pessoa), e para essas o único
   * caminho é uma pessoa olhar.
   */
  aoDenunciar?: () => void;
  /** Votar na enquete. Sem ele as opções aparecem inertes. */
  aoVotar?: (opcao: number) => void;
  /** Veio do algoritmo, não de quem ela segue. */
  sugerido?: boolean;
}) {
  const [escolhendo, setEscolhendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const total = totalDeReacoes(post.reacoes);
  /* Post antigo (anterior ao carrossel) tem `imagens` vazio e só
     `imagemUrl` — o recuo faz os dois terem a mesma forma aqui. */
  const fotos = post.imagens?.length ? post.imagens : post.imagemUrl ? [post.imagemUrl] : [];

  return (
    <article className="-mx-4 border-b border-border pb-3">
      <header className="flex items-center gap-2.5 px-4 py-2.5">
        <button
          type="button"
          onClick={() => aoAbrirPerfil?.(post.autorId)}
          className="press flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <Foto url={post.autorAvatar} nome={post.autorNome} lado={AVATAR_DO_POST} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold leading-tight">
              {post.autorNome}
            </span>
            {/* ⚠️ "Sugerido para você" é OBRIGATÓRIO quando o post não veio de
                quem ela segue. Sem o rótulo, o feed passa a misturar estranhos
                sem avisar — e num app de gestação de alto risco a pessoa
                precisa saber se está lendo uma amiga ou uma desconhecida. */}
            {sugerido && (
              <span className="block text-[11px] leading-tight text-muted-foreground">
                Sugerido para você
              </span>
            )}
          </span>
        </button>
        {/* O ⋯ tem uma ação por lado: apagar no post DELA, denunciar no de
            outra pessoa. No modelo ele abre um menu com oito itens; aqui é uma
            só de cada lado, e um menu de um item é um botão com uma etapa a
            mais. */}
        {((post.souAAutora && aoApagar) || (!post.souAAutora && aoDenunciar)) && (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            aria-label="Opções da publicação"
            className="press shrink-0 px-1 text-lg leading-none text-muted-foreground"
          >
            ⋯
          </button>
        )}
      </header>

      {/* ⚠️ A confirmação é uma MENSAGEM separada, e não o mesmo botão virando
          "tem certeza?" — é a mesma decisão do cancelar consulta, pedida pelo
          dono na época. Apagar publicação é irreversível: não há lixeira, e o
          arquivo sai do balde. */}
      {confirmando && (
        <div className="mx-4 mb-2 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-[13px] leading-snug">
            {post.souAAutora
              ? "Apagar esta publicação?"
              : /* ⚠️ Diz que é CALADO: sem isso ela hesita achando que a outra
                   vai saber — e é a mesma razão pela qual o bloqueio é mudo. */
                "Denunciar esta publicação? Ela fica registrada para a gente olhar, e quem publicou não é avisada."}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
                if (post.souAAutora) aoApagar?.();
                else aoDenunciar?.();
              }}
              className="press flex-1 rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground"
            >
              {post.souAAutora ? "Sim, apagar" : "Denunciar"}
            </button>
          </div>
        </div>
      )}

      {post.imagemUrl && <Carrossel urls={fotos} />}

      {/* A linha de ações vem LOGO ABAIXO da imagem, antes da legenda — é a
          ordem deles, e ela existe porque a ação é o que a tela quer que
          aconteça primeiro. */}
      <div className="flex items-center gap-3 px-4 pt-2.5">
        <button
          type="button"
          onClick={() => setEscolhendo((v) => !v)}
          aria-label="Reagir"
          className="press text-[22px] leading-none"
        >
          {post.minhaReacao ? emojiDaReacao(post.minhaReacao) : "🤍"}
        </button>
        {total > 0 && (
          <span className="text-[13px] font-semibold tabular-nums">
            {total} {total === 1 ? "reação" : "reações"}
          </span>
        )}
        {/* O marcador fica na PONTA DIREITA, separado das reações pelo vão que
            sobra — é o arranjo deles, e ele diz uma coisa verdadeira: guardar é
            gesto privado (ninguém vê, nem a autora), reagir é gesto social. */}
        {aoSalvar && (
          <button
            type="button"
            onClick={() => aoSalvar(!post.salvo)}
            aria-label={post.salvo ? "Tirar dos salvos" : "Salvar"}
            aria-pressed={post.salvo}
            className="press ml-auto leading-none"
          >
            <IconeMarcador cheio={post.salvo} />
          </button>
        )}
      </div>

      {escolhendo && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-2">
          {REACOES.map((r) => (
            <button
              key={r.tipo}
              type="button"
              onClick={() => {
                aoReagir(post.minhaReacao === r.tipo ? null : r.tipo);
                setEscolhendo(false);
              }}
              className={`press rounded-full px-2.5 py-1 text-[13px] ${
                post.minhaReacao === r.tipo ? "bg-primary/15 font-semibold" : "bg-muted/60"
              }`}
            >
              {r.emoji} {r.rotulo}
            </button>
          ))}
        </div>
      )}

      {/* ⚠️ A ENQUETE vem antes da legenda e depois das ações: é o único
          elemento do post que PEDE alguma coisa de quem lê, e enterrá-la
          embaixo do texto faria a maioria rolar direto. */}
      {post.enquete && (
        <div className="mt-1 space-y-1.5 px-4">
          {post.enquete.opcoes.map((op, i) => {
            const meu = post.enquete!.meuVoto;
            const jaVotou = meu !== null;
            const votos = post.enquete!.votos[i] ?? 0;
            const total = post.enquete!.votos.reduce((a, b) => a + b, 0);
            /* A barra é proporcional; o RÓTULO é número absoluto — "67%" são
               dois votos de três, e numa base pequena a porcentagem transforma
               três pessoas numa maioria. */
            const fatia = total > 0 ? Math.round((votos / total) * 100) : 0;
            return (
              <button
                key={i}
                type="button"
                disabled={jaVotou || !aoVotar}
                onClick={() => aoVotar?.(i)}
                className={`press relative block w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-[13px] ${
                  meu === i ? "border-primary font-semibold" : "border-border"
                } disabled:cursor-default`}
              >
                {jaVotou && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-primary/12"
                    style={{ width: `${fatia}%` }}
                  />
                )}
                <span className="relative flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{op}</span>
                  {jaVotou && (
                    <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                      {rotuloDeVotos(votos)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          {post.enquete.meuVoto === null && (
            /* ⚠️ Ela precisa saber ANTES que o voto não se troca — a PK do
               banco garante um por pessoa, e descobrir isso tocando é o tipo de
               surpresa que faz alguém desconfiar do app inteiro. */
            <p className="pt-0.5 text-[11px] text-muted-foreground">
              Toque para votar — o voto não muda depois.
            </p>
          )}
        </div>
      )}

      {/* ⚠️ A PERGUNTA vem ANTES do texto, e citada. Ela é a metade que dá
          sentido à outra: "Sim, foi na 20ª" solto no feed não quer dizer nada,
          e era exatamente isso que o feed mostrava enquanto a coluna existia
          sem leitor. Sem NADA sobre quem perguntou — a caixinha é anônima, e
          continua anônima depois de respondida. */}
      {post.pergunta && (
        <div className="mx-4 mt-2 rounded-xl border-l-2 border-primary/40 bg-muted/40 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Perguntaram
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug">{post.pergunta}</p>
        </div>
      )}

      {/* ⚠️ A aula anexada mostra o TEMA, e nunca o dia: o dia gestacional é a
          semana dela disfarçada (D = semana × 7 + diaDaSemana), e publicá-lo
          passaria por cima da chave `mostrar_semana`. Nunca a nota, tampouco —
          seria o placar público que a aba das Amigas gastou um arquivo inteiro
          para não ter. */}
      {post.aula && (
        <div className="mx-4 mt-2 rounded-xl bg-muted/50 px-3 py-2">
          <p className="text-[13px] font-medium leading-snug">
            📚 Fiz a aula de hoje — sobre <span className="font-semibold">{post.aula.tema}</span>
          </p>
        </div>
      )}

      {post.texto && (
        <p className="px-4 pt-1.5 text-[14px] leading-snug">
          <span className="font-semibold">{post.autorNome}</span>{" "}
          <span className="whitespace-pre-wrap">{post.texto}</span>
        </p>
      )}

      {/* ⚠️ A HORA, embaixo da legenda — é onde o modelo a põe, e ela estava
          faltando em TODO post. Sem ela, uma publicação de três semanas atrás
          lê como notícia de hoje, e aqui as notícias têm data biológica: o
          ultrassom de quem estava com 28 semanas naquela semana é outra frase
          hoje, com 31. */}
      {/* ⚠️ Sem caixa alta: "3 h" virava "3 H" e "18 de agosto de 2026" virava
          um berro de duas linhas. O modelo mudou para minúscula anos atrás, e
          em português a versão em caixa alta lê pior que em inglês. */}
      <p className="px-4 pt-1 text-[11px] text-muted-foreground">
        {haQuantoPublicou(post.criadoEm, Date.now())}
      </p>
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A TELA PRINCIPAL
   ══════════════════════════════════════════════════════════════════════════ */

export function TelaPrincipal({
  posts,
  stories = [],
  sugestoes = [],
  pessoas = [],
  aoSeguirPessoa,
  aoReagir,
  aoSalvar,
  aoApagar,
  aoDenunciar,
  aoVotar,
  aoAbrirPerfil,
  aoTocarStory,
  aoChegarNoFim,
  temMais = false,
  desafio,
  aoEntrarNoDesafio,
  aoIrParaOJogo,
}: {
  posts: PostNaTela[];
  stories?: Story[];
  /**
   * A ZONA DE SUGESTÕES — publicações de quem ela NÃO segue.
   *
   * ⚠️ Lista própria, e não ids misturados na de cima. É o que garante que
   * estranhas nunca apareçam no meio das pessoas que ela escolheu: elas entram
   * DEPOIS do aviso de "você está em dia", que é o modelo do Instagram e é o
   * único arranjo em que "sugerido" significa alguma coisa.
   */
  sugestoes?: PostNaTela[];
  /** Pessoas sugeridas, a fileira do modelo. */
  pessoas?: PessoaNaLista[];
  aoSeguirPessoa?: (id: string) => void;
  aoReagir: (post: PostNaTela, t: TipoDeReacao | null) => void;
  aoSalvar?: (post: PostNaTela, salvar: boolean) => void;
  aoApagar?: (post: PostNaTela) => void;
  /** Denunciar o post de outra pessoa. Ver `PostInstagram`. */
  aoDenunciar?: (post: PostNaTela) => void;
  aoVotar?: (post: PostNaTela, opcao: number) => void;
  aoAbrirPerfil?: (id: string) => void;
  /**
   * Toque numa bolinha da fileira. Recebe o id do AUTOR, não do story.
   *
   * ⚠️ As outras ações desta tela (publicar, buscar, atividade, perfil, as
   * seções da Comunidade) NÃO são props daqui: elas viraram as bolinhas da
   * barra de baixo, publicadas por `RedeNoApp`. Foi assim que o primeiro
   * elemento da aba passou a ser a fileira de stories.
   */
  aoTocarStory?: (autorId: string) => void;
  /**
   * O fim da lista apareceu — hora de buscar as mais antigas.
   *
   * ⚠️ Quem se protege de chamar duas vezes é QUEM RECEBE: a sentinela pode
   * entrar e sair da tela num tranco de rolagem, e o observador dispara nas
   * duas vezes. A trava mora no contêiner, que é quem sabe se já há um pedido
   * no ar.
   */
  aoChegarNoFim?: () => void;
  /** Ainda há página seguinte. Sem isso a sentinela ficaria armada para sempre. */
  temMais?: boolean;
  /** O desafio da semana da criadora que a trouxe, se houver. */
  desafio?: DesafioNaTela | null;
  aoEntrarNoDesafio?: (entrar: boolean) => void;
  /** Leva ao Caminho, onde a atividade acontece. */
  aoIrParaOJogo?: () => void;
}) {
  const fim = useRef<HTMLDivElement>(null);

  /* ⚠️ A sentinela é um `IntersectionObserver`, e não um ouvinte de `scroll`:
     a aba vive dentro de `minha-conta`, e quem rola pode ser a janela ou um
     contêiner interno — um ouvinte de `scroll` precisaria saber qual, e erraria
     no dia em que o invólucro mudasse. O observador não precisa saber. */
  useEffect(() => {
    const alvo = fim.current;
    if (!alvo || !aoChegarNoFim || !temMais) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) aoChegarNoFim();
      },
      /* Uma tela de antecedência: a página seguinte chega antes de ela bater no
         fundo, que é o que faz a rolagem parecer infinita em vez de emendada. */
      { rootMargin: "600px" },
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [aoChegarNoFim, temMais, posts.length]);

  return (
    <div className="px-4">
      {/* ⚠️ **NÃO HÁ CABEÇALHO AQUI, e a falta dele é o recurso.**
          Pedido do dono, com a foto do aparelho: "toda essa parte de cima deve
          sumir, não precisamos que cada aba ocupe esse espaço que é precioso…
          o primeiro elemento da aba será os stories, assim como no Instagram".

          Havia DUAS barras empilhadas antes desta linha — a do app (‹ Feed ⚙
          Sair) e a desta tela (Comunidade 🔍 ♡ ＋ ⊞) —, e as duas juntas
          comiam a primeira dobra inteira de um iPhone. As ações não sumiram:
          viraram as bolinhas que sobem ao tocar de novo no ícone da Comunidade
          na barra de baixo (`publicarAtalhos`, em `RedeNoApp`). */}
      {desafio && (
        <CartaoDoDesafio
          desafio={desafio}
          aoEntrar={aoEntrarNoDesafio}
          aoIrParaOJogo={aoIrParaOJogo}
        />
      )}

      <FileiraDeStories stories={stories} aoTocar={aoTocarStory} />

      {posts.length === 0 && sugestoes.length === 0 && pessoas.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ainda não há nada por aqui 💛
        </p>
      ) : (
        posts.map((p) => (
          <PostInstagram
            key={p.id}
            post={p}
            aoReagir={(t) => aoReagir(p, t)}
            aoSalvar={aoSalvar ? (v) => aoSalvar(p, v) : undefined}
            aoApagar={aoApagar && p.souAAutora ? () => aoApagar(p) : undefined}
            aoDenunciar={aoDenunciar && !p.souAAutora ? () => aoDenunciar(p) : undefined}
            aoVotar={aoVotar ? (i) => aoVotar(p, i) : undefined}
            aoAbrirPerfil={aoAbrirPerfil}
          />
        ))
      )}

      {temMais && (
        <div ref={fim} className="py-6">
          <div className="skeleton h-24 rounded-2xl" />
        </div>
      )}

      {/* ─── A ZONA DE SUGESTÕES ────────────────────────────────────────────
          ⚠️ Ela só abre quando o feed de quem ela segue ACABOU (`!temMais`).
          Este é o arranjo do "você está em dia" do Instagram, e aqui ele não é
          estética: interlaçar desconhecidas no meio das pessoas que ela
          escolheu, num app de gestação de alto risco, faz a paciente ler um
          relato duro sem saber se veio de uma amiga ou de uma estranha. Com o
          aviso no meio, tudo que está abaixo dele tem procedência. */}
      {!temMais && (pessoas.length > 0 || sugestoes.length > 0) && (
        <>
          {posts.length > 0 && <EmDia />}

          {pessoas.length > 0 && (
            <FileiraDePessoas
              pessoas={pessoas}
              aoSeguir={aoSeguirPessoa}
              aoAbrirPerfil={aoAbrirPerfil}
            />
          )}

          {sugestoes.length > 0 && (
            <>
              <h2 className="px-0 pb-1 pt-4 text-[14px] font-semibold">Publicações sugeridas</h2>
              {sugestoes.map((p) => (
                <PostInstagram
                  key={p.id}
                  post={p}
                  /* O rótulo é OBRIGATÓRIO — ver `PostInstagram`. */
                  sugerido
                  aoReagir={(t) => aoReagir(p, t)}
                  aoSalvar={aoSalvar ? (v) => aoSalvar(p, v) : undefined}
                  aoVotar={aoVotar ? (i) => aoVotar(p, i) : undefined}
                  aoAbrirPerfil={aoAbrirPerfil}
                />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * "Você está em dia" — o divisor do modelo.
 *
 * Ele responde à pergunta que a paciente faria ao ver uma desconhecida no feed
 * ("de onde veio isso?") ANTES de ela fazer a pergunta.
 */
function EmDia() {
  return (
    <div className="flex flex-col items-center gap-1.5 border-b border-border py-8 text-center">
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-foreground/70 text-xl"
      >
        ✓
      </span>
      <p className="text-[15px] font-semibold">Você está em dia</p>
      <p className="max-w-[16rem] text-[13px] leading-snug text-muted-foreground">
        Você viu tudo de quem acompanha. Daqui para baixo são pessoas que você ainda não segue.
      </p>
    </div>
  );
}

/**
 * A fileira de pessoas sugeridas.
 *
 * ⚠️ **Nenhum cartão diz POR QUE aquela pessoa está ali.** O modelo escreve
 * "seguida por fulana e mais 3", e aqui isso entregaria quem ela segue a quem
 * só abriu o feed — a lista de seguidores deste app não é pública de propósito.
 * O motivo ordena a fileira e fica no servidor.
 */
function FileiraDePessoas({
  pessoas,
  aoSeguir,
  aoAbrirPerfil,
}: {
  pessoas: PessoaNaLista[];
  aoSeguir?: (id: string) => void;
  aoAbrirPerfil?: (id: string) => void;
}) {
  /* Quem ela acabou de seguir. ⚠️ O cartão NÃO some: sumir no toque tira da
     tela a única confirmação de que o toque funcionou, e ela toca de novo. */
  const [seguidas, setSeguidas] = useState<Set<string>>(new Set());

  return (
    <section className="border-b border-border py-4">
      <h2 className="pb-2 text-[14px] font-semibold">Sugestões para você</h2>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {pessoas.map((p) => {
          const jaSegue = seguidas.has(p.id);
          return (
            <div
              key={p.id}
              className="flex w-[148px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-border p-3"
            >
              <button type="button" onClick={() => aoAbrirPerfil?.(p.id)} className="press">
                <Foto url={p.avatarUrl} nome={p.nome} lado={64} />
              </button>
              <p className="line-clamp-2 text-center text-[13px] font-semibold leading-tight">
                {p.nome}
              </p>
              {p.bio && (
                <p className="line-clamp-1 w-full text-center text-[11px] leading-tight text-muted-foreground">
                  {p.bio}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  setSeguidas((s) => new Set(s).add(p.id));
                  aoSeguir?.(p.id);
                }}
                disabled={jaSegue}
                /* ⚠️ `mt-auto` alinha os botões pelo PÉ do cartão. Os cartões
                   já têm a mesma altura (o `flex` estica), mas quem tem bio e
                   nome de duas linhas empurrava o botão para baixo do da
                   vizinha — uma fileira de botões em degrau. */
                className={`press mt-auto w-full rounded-lg py-1.5 text-[13px] font-semibold ${
                  jaSegue ? "border border-border" : "bg-primary text-primary-foreground"
                }`}
              >
                {jaSegue ? "Seguindo" : "Seguir"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

function Numero({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-[15px] font-semibold tabular-nums leading-tight">{valor}</span>
      <span className="text-[12px] leading-tight text-muted-foreground">{rotulo}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A CAIXINHA — o lado de quem PERGUNTA
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O campo que vive no perfil de quem abriu a caixa.
 *
 * ⚠️ **Três estados, e o terceiro não é um aviso — é uma porta.** Bandeira
 * vermelha não devolve "não posso responder isso": devolve o botão do SOS, que
 * avisa o médico e o contato de emergência dela com localização. Uma tela que
 * apenas recusasse deixaria quem escreveu "estou sangrando" sozinha, olhando um
 * texto de erro.
 */
export function CaixinhaNoPerfil({
  nome,
  aoPerguntar,
  aoAbrirSOS,
  inerte = false,
}: {
  nome: string;
  aoPerguntar?: (texto: string) => Promise<DesfechoDaPergunta | null>;
  aoAbrirSOS?: () => void;
  inerte?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [desfecho, setDesfecho] = useState<DesfechoDaPergunta | null>(null);

  const primeiroNome = nome.trim().split(/\s+/)[0] || nome;

  if (!aberta) {
    return (
      <button
        type="button"
        onClick={() => !inerte && setAberta(true)}
        className="press mt-2 w-full rounded-lg border border-border py-1.5 text-[14px] font-medium"
      >
        💬 Mandar uma pergunta
      </button>
    );
  }

  if (desfecho) {
    return (
      <div className="mt-2 rounded-xl bg-muted/50 p-3">
        <p className="text-[13px] leading-snug">{recadoDoDesfecho(desfecho)}</p>
        {desfecho === "emergencia" && aoAbrirSOS && (
          <button
            type="button"
            onClick={aoAbrirSOS}
            className="press mt-2.5 w-full rounded-xl bg-destructive py-2 text-[14px] font-semibold text-destructive-foreground"
          >
            Abrir a Central de Emergência
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setDesfecho(null);
            setTexto("");
            setAberta(false);
          }}
          className="press mt-2 w-full rounded-xl border border-border py-1.5 text-[13px]"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-xl bg-muted/50 p-3">
      <label htmlFor="dc-pergunta" className="text-[13px] font-semibold">
        Perguntar para {primeiroNome}
      </label>
      {/* ⚠️ A tela DIZ que é anônima, e diz também o limite. As duas frases
          existem por razões opostas: sem a primeira ninguém pergunta, e sem a
          segunda a caixinha vira o lugar onde se pede conduta médica a uma
          leiga — que é o que fechou os comentários deste app. */}
      <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
        Ela não vê quem perguntou. Para dúvidas do seu corpo, quem responde é o seu médico — mande
        por aqui mesmo que eu levo até ele.
      </p>
      <textarea
        id="dc-pergunta"
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DA_PERGUNTA))}
        rows={3}
        placeholder="Sua pergunta…"
        className="mt-2 w-full resize-none rounded-lg border border-border bg-background p-2 text-[14px]"
      />
      <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
        {texto.length}/{LIMITE_DA_PERGUNTA}
      </div>
      <div className="mt-1.5 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setAberta(false);
            setTexto("");
          }}
          className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
        >
          Agora não
        </button>
        <button
          type="button"
          disabled={!texto.trim() || enviando || inerte || !aoPerguntar}
          onClick={async () => {
            if (!aoPerguntar) return;
            setEnviando(true);
            const d = await aoPerguntar(texto.trim());
            setEnviando(false);
            /* `null` é falha de envio: o `toast` do chamador já contou, e
               manter o texto no campo é o que permite tentar de novo sem
               reescrever. */
            if (d) setDesfecho(d);
          }}
          className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
}

export function TelaDePerfil({
  perfil,
  posts,
  aoSeguir,
  aoVoltar,
  aoAbrirPost,
  aoAbrirLista,
  aoAbrirSalvos,
  aoBloquear,
  aoAbrirEspelho,
  aoAplicarCodigo,
  aoPerguntar,
  aoAbrirSOS,
  somenteLeitura = false,
}: {
  perfil: PerfilNaTela;
  posts: PostNaTela[];
  aoSeguir?: () => void;
  aoVoltar?: () => void;
  aoAbrirPost?: (id: string) => void;
  /**
   * Tocar nos números abre a lista.
   *
   * ⚠️ `undefined` para perfil de terceiro, e isso é o portão: no Instagram
   * qualquer um abre a lista de seguidores de um perfil público. Aqui não — a
   * lista de quem acompanha uma gestante de alto risco é o CÍRCULO SOCIAL
   * dela, e expô-la entrega de quem ela é próxima a quem só quis olhar um
   * perfil. Só a dona abre as duas listas dela.
   */
  aoAbrirLista?: (tipo: "seguidores" | "seguindo") => void;
  /** Só no próprio perfil — a coleção é privada e não existe a de ninguém. */
  aoAbrirSalvos?: () => void;
  /** Só no perfil de terceiro. */
  aoBloquear?: () => void;
  /** Abre "ver como os outros veem". Só no próprio perfil. */
  aoAbrirEspelho?: () => void;
  /** Aplica o código de embaixadora deste perfil. Irreversível — ver a tela. */
  aoAplicarCodigo?: (codigo: string) => void;
  /**
   * Manda uma pergunta para a caixinha dela. Devolve o desfecho da triagem, ou
   * `null` quando não deu para enviar.
   *
   * ⚠️ **Quem tria é o SERVIDOR**, e a tela só desenha o que ele respondeu. Uma
   * segunda régua aqui diria "mandei para o seu médico" sobre um texto que o
   * servidor publicou — ou pior, publicaria um que ele teria roteado.
   */
  aoPerguntar?: (texto: string) => Promise<DesfechoDaPergunta | null>;
  /** A Central de Emergência, para quando a triagem achar bandeira vermelha. */
  aoAbrirSOS?: () => void;
  /**
   * O ESPELHO: a tela desenha, e nada nela age.
   *
   * ⚠️ **O desligamento é feito AQUI, num lugar só, e não pelo chamador.** A
   * prévia tem hoje cinco controles (seguir, abrir post, abrir lista, salvos,
   * bloquear); o sexto que alguém acrescentar amanhã nasce LIGADO se quem
   * desliga for o chamador — e um dos previstos, o "aplicar código de
   * embaixadora", grava um campo que nunca é reescrito. Um toque numa tela que
   * o app apresenta como inerte queimaria a indicação da médica dela, sem erro
   * e sem volta.
   */
  somenteLeitura?: boolean;
}) {
  const [aba, setAba] = useState<AbaDoPerfil>("grade");
  const [confirmandoBloqueio, setConfirmandoBloqueio] = useState(false);
  const [confirmandoCodigo, setConfirmandoCodigo] = useState(false);

  /* A trava do espelho: toda ação vira `undefined` de uma vez. */
  const agir = <T,>(f: T | undefined): T | undefined => (somenteLeitura ? undefined : f);
  const seguir = agir(aoSeguir);
  const abrirPost = agir(aoAbrirPost);
  const abrirLista = agir(aoAbrirLista);
  const abrirSalvos = agir(aoAbrirSalvos);
  const bloquear = agir(aoBloquear);
  const perguntar = agir(aoPerguntar);

  /* Só os POSTS aparecem na grade; o "Do bebê" é a aba própria. */
  const naGrade = aba === "grade" ? posts : [];

  const rotuloDoBotao = perfil.souEu
    ? "Editar perfil"
    : perfil.meuVinculo === "ativo"
      ? "Seguindo"
      : perfil.meuVinculo === "pendente"
        ? "Pedido enviado"
        : perfil.publico
          ? "Seguir"
          : "Pedir para seguir";

  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        {aoVoltar && (
          <button
            type="button"
            onClick={aoVoltar}
            aria-label="Voltar"
            className="press -ml-1 text-xl leading-none"
          >
            ‹
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{perfil.nome}</h1>
        {/* No modelo, os salvos moram atrás do ☰ do próprio perfil. O ícone é
            o MESMO marcador do post — é o que liga o gesto ao lugar onde ele
            guarda. */}
        {abrirSalvos && (
          <button type="button" onClick={abrirSalvos} aria-label="Salvos" className="press">
            <IconeMarcador cheio={false} />
          </button>
        )}
        {bloquear && (
          <button
            type="button"
            onClick={() => setConfirmandoBloqueio((v) => !v)}
            aria-label="Opções deste perfil"
            className="press px-1 text-lg leading-none text-muted-foreground"
          >
            ⋯
          </button>
        )}
      </header>

      {/* ⚠️ Bloquear é o único gesto de SEGURANÇA desta tela, e ele diz o que
          faz antes de fazer: desfaz o seguir nos dois sentidos e some com um
          do outro. Um "Bloquear" sem essa frase parece reversível — e é, mas
          o vínculo que ele desfez não volta sozinho. */}
      {confirmandoBloqueio && bloquear && (
        <div className="mx-4 mt-2 rounded-2xl border border-border bg-muted/40 p-3">
          <p className="text-[13px] leading-snug">
            Bloquear {perfil.nome}? Vocês deixam de se ver por aqui, e quem seguia quem deixa de
            seguir.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmandoBloqueio(false)}
              className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmandoBloqueio(false);
                bloquear();
              }}
              className="press flex-1 rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground"
            >
              Bloquear
            </button>
          </div>
        </div>
      )}

      <div className="px-4">
        {/* Avatar à esquerda, números à direita — o arranjo deles. */}
        <div className="flex items-center gap-6">
          <Foto url={perfil.avatarUrl} nome={perfil.nome} lado={AVATAR_DO_PERFIL} />
          <div className="flex flex-1 justify-around">
            {NUMEROS_PUBLICOS.publicacoes && (
              <Numero
                valor={posts.length}
                rotulo={posts.length === 1 ? "publicação" : "publicações"}
              />
            )}
            {/* ⚠️ Os dois números de AUDIÊNCIA só no próprio perfil. É a única
                divergência deliberada do modelo, e ela está pesquisada em
                `NUMEROS_PUBLICOS`: um placar público mede popularidade num
                momento em que ela já está sendo medida clinicamente. */}
            {perfil.souEu && (
              <>
                <button type="button" onClick={() => abrirLista?.("seguidores")} className="press">
                  <Numero valor={perfil.meusSeguidores ?? 0} rotulo="seguidores" />
                </button>
                <button type="button" onClick={() => abrirLista?.("seguindo")} className="press">
                  <Numero valor={perfil.euSigo ?? 0} rotulo="seguindo" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ⚠️ Os dois selos são PEÇAS SEPARADAS, porque as chaves são duas e uma
            delas pode estar ligada sozinha. Uma string só ("Helena · 28
            semanas") obrigaria a desmontá-la para desenhar o caso de uma chave
            só — e é assim que nasce a vírgula solta no começo da linha.

            ⚠️ E eles NÃO entram no cabeçalho do post: lá o carimbo seria a
            semana de HOJE sobre um post de seis semanas atrás, que é o defeito
            que `haQuantoPublicou` acabou de consertar. */}
        {(perfil.seloSemana || perfil.seloBebe) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {/* ⚠️ `text-primary` sobre `primary/12` media 3,87:1 — abaixo do piso
                de 4,5 que este projeto já cobrou de si mesmo na Loja de
                Sementinhas. 12px em peso 600 não é "texto grande" pela WCAG (o
                corte é 18,66px), e este é justamente o número que a função
                inteira existe para publicar: o texto menos legível da tela era o
                único conteúdo novo dela.

                ⚠️ E o comentário fica AQUI, fora do `{cond && (…)}` — dentro
                dele, um comentário JSX vira o segundo filho da expressão e
                custa um `TS1005` que aponta para a linha do `<span>`. Já está
                escrito no CLAUDE.md, e eu caí nele de novo. */}
            {perfil.seloSemana && (
              <span className="rounded-full bg-primary/12 px-2.5 py-1 text-[12px] font-semibold text-foreground">
                🤰 {perfil.seloSemana}
              </span>
            )}
            {perfil.seloBebe && (
              <span className="rounded-full bg-muted/70 px-2.5 py-1 text-[12px] font-medium">
                💛 {perfil.seloBebe}
              </span>
            )}
          </div>
        )}

        {perfil.bio && <p className="mt-3 text-[14px] leading-snug">{perfil.bio}</p>}

        {/* ─── O CÓDIGO DA EMBAIXADORA ──────────────────────────────────────
            ⚠️ **Nunca num toque só.** `ref_code` é gravado UMA VEZ e nunca
            reescrito — e o MESMO campo carrega o código da médica dela. Um
            toque curioso aqui queimaria a indicação da médica para sempre, sem
            erro e sem volta, e nenhuma tela do app poderia desfazer.

            Por isso a confirmação é uma MENSAGEM separada que diz o que o
            toque faz — a mesma decisão do cancelar consulta e do apagar
            publicação. */}
        {perfil.codigoDeEmbaixadora && (
          <div className="mt-3 rounded-2xl border border-border p-3">
            <p className="text-[12px] text-muted-foreground">Código de embaixadora</p>
            <p className="mt-0.5 font-mono text-[15px] font-semibold tracking-wide">
              {perfil.codigoDeEmbaixadora}
            </p>
            {perfil.possoAplicarOCodigo && aoAplicarCodigo && !somenteLeitura && (
              <>
                {!confirmandoCodigo ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoCodigo(true)}
                    className="press mt-2 w-full rounded-lg border border-border py-1.5 text-[13px] font-semibold"
                  >
                    Usar este código
                  </button>
                ) : (
                  <div className="mt-2 rounded-xl bg-muted/50 p-3">
                    <p className="text-[13px] leading-snug">
                      Usar o código{" "}
                      <span className="font-semibold">{perfil.codigoDeEmbaixadora}</span> como quem
                      te trouxe ao app? Você ganha 150 🌱 de boas-vindas.
                    </p>
                    <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
                      Isso vale uma vez só e não dá para trocar depois — é o mesmo campo onde entra
                      o código da sua médica, se ela te passou um.
                    </p>
                    {/* ⚠️ **O CONSENTIMENTO PRECISA DIZER O QUE ACONTECE.** O
                        código faz o primeiro nome dela aparecer numa lista da
                        criadora, e as duas telas que pediam o código falavam só
                        das 150 🌱. Isso é "expor a paciente sem ela saber" — e o
                        que fica exposto não é um nome qualquer: é "esta pessoa é
                        paciente de um app de gestação de alto risco", que é dado
                        de saúde por inferência. */}
                    <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
                      Quem te trouxe passa a ver o seu primeiro nome numa lista, para poder te
                      presentear. Nada mais do seu acompanhamento aparece para ela.
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmandoCodigo(false)}
                        className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
                      >
                        Agora não
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmandoCodigo(false);
                          aoAplicarCodigo(perfil.codigoDeEmbaixadora!);
                        }}
                        className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground"
                      >
                        Sim, usar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={seguir}
          disabled={perfil.souEu || perfil.meuVinculo === "pendente"}
          className={`press mt-3 w-full rounded-lg py-1.5 text-[14px] font-semibold ${
            perfil.meuVinculo || perfil.souEu
              ? "border border-border"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {rotuloDoBotao}
        </button>

        {/* ⚠️ A caixinha aparece a QUEM VISITA, nunca à dona — no perfil dela o
            que existe é a caixa cheia, que mora no hub. E ela nasce do campo
            que o servidor devolve: um botão desenhado por conta própria
            prometeria uma caixa fechada. */}
        {perfil.aceitaPerguntas && !perfil.souEu && (
          <CaixinhaNoPerfil
            nome={perfil.nome}
            aoPerguntar={perguntar}
            aoAbrirSOS={aoAbrirSOS}
            inerte={somenteLeitura}
          />
        )}

        {/* ⚠️ O espelho vive no PRÓPRIO perfil, e não numa tela de ajustes: a
            pergunta que ele responde ("o que os outros veem?") só ocorre a
            alguém que está olhando o próprio perfil. Escondido nos ajustes,
            ele seria mais um controle que existe e ninguém acha — que é o
            defeito que a catraca de portas foi escrita para pegar. */}
        {aoAbrirEspelho && !somenteLeitura && (
          <button
            type="button"
            onClick={aoAbrirEspelho}
            className="press mt-2 w-full rounded-lg border border-border py-1.5 text-[14px] font-medium"
          >
            👁 Ver como os outros veem
          </button>
        )}
      </div>

      {/* As abas, com o traço embaixo da ativa — a assinatura da tela deles. */}
      <div className="mt-4 flex border-b border-border">
        {ABAS_DO_PERFIL.map((a) => (
          <button
            key={a.chave}
            type="button"
            onClick={() => setAba(a.chave)}
            className={`press h-11 flex-1 text-[13px] font-medium ${
              aba === a.chave
                ? "border-b-2 border-foreground text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "grade" ? (
        /* A grade é a MESMA dos salvos (`GradeDePosts`) — duas cópias
           divergiriam na primeira vez que a proporção da célula mudasse, e ela
           já mudou uma vez (1:1 → 3:4, em 2025). */
        <GradeDePosts posts={naGrade} vazio="Nenhuma publicação ainda." aoAbrirPost={abrirPost} />
      ) : perfil.bebe ? (
        /* ⚠️ Esta aba existia VAZIA desde o primeiro dia, prometendo "os marcos
            da gestação vão aparecer aqui 💛" — em qualquer perfil, inclusive o
            de terceiro. Era a única promessa não paga da rede.

            ⚠️ E o que entrou é tudo DERIVADO da semana: quem sabe que ela está
            de 28 semanas já sabe o tamanho do bebê. É o mesmo fato em outras
            palavras, e a tabela é igual para toda gestante — por isso obedece à
            mesma chave, sem virar uma segunda decisão de privacidade.

            ⚠️ NADA de marco de exame. `consultaForWeek` devolve TOTG,
            morfológico e hemograma: a agenda clínica dela. */
        <div className="px-4 py-6">
          <div className="flex items-center gap-4">
            <span aria-hidden className="text-5xl leading-none">
              {perfil.bebe.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-[17px] font-semibold leading-tight">{perfil.bebe.fruta}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                {perfil.bebe.tamanho}
                {perfil.bebe.peso && perfil.bebe.peso !== "—" ? ` · ${perfil.bebe.peso}` : ""}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[14px] leading-snug">{perfil.bebe.sobre}</p>
          <p className="mt-4 text-[12px] leading-snug text-muted-foreground">
            O tamanho é uma média da semana — cada bebê cresce no ritmo dele.
          </p>
        </div>
      ) : (
        /* Sem semana pública, a aba não promete: ela diz o que é. */
        <p className="px-8 py-16 text-center text-sm leading-snug text-muted-foreground">
          {perfil.souEu
            ? "Quando a data da sua última menstruação estiver no perfil, o tamanho do bebê aparece aqui 💛"
            : "Esta pessoa não mostra a semana da gestação no perfil."}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O CONTÊINER — busca, e alterna entre feed e perfil
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A rede dentro do app: o feed, e o perfil de quem ela tocar.
 *
 * Duas telas e um estado — `abertoEm` guarda o id de quem está sendo visto, e
 * `null` é o feed. Um router aqui seria um endereço novo por perfil, e a aba
 * inteira vive dentro de `minha-conta`, que já governa a navegação.
 */
/**
 * A rede dentro do app — cinco telas e um estado.
 *
 * `onde` diz o que desenhar: o feed, um perfil, a edição do próprio perfil,
 * uma lista de gente, ou um post sozinho. Um router aqui daria um endereço por
 * tela, e a aba inteira vive dentro de `minha-conta`, que já governa a
 * navegação.
 *
 * ⚠️ **A pilha é rasa de propósito: `voltar` sempre cai no feed ou no perfil
 * anterior, nunca numa cadeia.** Uma pilha de verdade precisaria de histórico
 * próprio, e o botão físico de voltar do Android já governa a aba — duas
 * pilhas concorrentes é como a seta passa a levar para o lugar errado, que é
 * o defeito que `voltarDaBarra` já teve de consertar três vezes neste app.
 */
type Onde =
  | { t: "feed" }
  | { t: "perfil"; id: string }
  | { t: "editar" }
  | { t: "lista"; tipo: "seguidores" | "seguindo" }
  | { t: "post"; id: string }
  | { t: "novo" }
  | { t: "atividade" }
  | { t: "salvos" }
  | { t: "busca" }
  | { t: "caixinha" }
  | { t: "espelho" };

export function RedeNoApp({
  careMode = false,
  onAbrirSecoes,
  onIrParaOJogo,
  onAbrirSOS,
  aulaDeHoje,
}: {
  careMode?: boolean;
  onAbrirSecoes?: () => void;
  /**
   * A Central de Emergência.
   *
   * ⚠️ **PROP, e não um evento global.** Quem governa a folha do SOS é
   * `minha-conta`, e um `CustomEvent` criaria um segundo dono para o mesmo
   * estado — o defeito que este app já pagou com `voltarDaBarra` e com o passo
   * do tutorial. Sem a prop, a bandeira vermelha ainda mostra o recado; o que
   * some é o botão.
   */
  onAbrirSOS?: () => void;
  /** Leva ao Caminho — é lá que a atividade do desafio acontece. */
  onIrParaOJogo?: () => void;
  /**
   * A aula que ela fez hoje, se fez — quem sabe disso é o Caminho, e ele passa
   * por `minha-conta`. Sem ela, o compositor simplesmente não oferece o anexo.
   */
  aulaDeHoje?: AulaNoPost | null;
}) {
  const [posts, setPosts] = useState<PostNaTela[]>([]);
  const [onde, setOnde] = useState<Onde>({ t: "feed" });
  const [perfil, setPerfil] = useState<PerfilNaTela | null>(null);
  const [doPerfil, setDoPerfil] = useState<PostNaTela[]>([]);
  const [gente, setGente] = useState<PessoaNaLista[]>([]);
  const [oPost, setOPost] = useState<PostNaTela | null>(null);
  const [bolhas, setBolhas] = useState<BolhaDeStory[]>([]);
  const [vendoStory, setVendoStory] = useState<BolhaDeStory | null>(null);
  const [euId, setEuId] = useState<string | null>(null);
  /** A MINHA foto. Ver a fileira de stories — `perfil` é o último perfil ABERTO. */
  const [meuAvatar, setMeuAvatar] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<AtividadeNaTela[]>([]);
  const [naoVistas, setNaoVistas] = useState(0);
  const [salvos, setSalvos] = useState<PostNaTela[]>([]);
  const [sugestoes, setSugestoes] = useState<PostNaTela[]>([]);
  const [persona, setPersona] = useState<Persona>("estranha");
  /** A foto escolhida, esperando a conferência antes de virar story. */
  const [conferindoStory, setConferindoStory] = useState<string | null>(null);
  /** A semana que ela pode carimbar — do servidor, e `null` quando não há. */
  const [semanaDoCarimbo, setSemanaDoCarimbo] = useState<string | null>(null);
  const [desafio, setDesafio] = useState<DesafioNaTela | null>(null);
  /* A caixinha: as perguntas dela e a chave. `naCaixa` alimenta o emblema da
     bolinha, e por isso é carregado JUNTO com o feed — um número que só
     chegasse ao abrir a caixa nasceria sempre zerado, e ninguém abriria. */
  const [perguntasDaCaixa, setPerguntasDaCaixa] = useState<PerguntaNaTela[]>([]);
  const [caixaAberta, setCaixaAberta] = useState(false);
  const [naCaixa, setNaCaixa] = useState(0);
  const [previa, setPrevia] = useState<{
    perfil: PerfilNaTela | null;
    posts: PostNaTela[];
    trancado: boolean;
    carregando: boolean;
  }>({ perfil: null, posts: [], trancado: false, carregando: true });
  const [pessoas, setPessoas] = useState<PessoaNaLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  /** Cursor da página seguinte do feed. `null` = acabou. */
  const [proximo, setProximo] = useState<string | null>(null);
  /* ⚠️ `useRef` e não `useState`: a sentinela pode disparar duas vezes no mesmo
     tranco de rolagem, e um estado só valeria no render seguinte — as duas
     chamadas leriam `false` e a mesma página entraria duas vezes na lista. */
  const buscandoMais = useRef(false);
  /** Já pedi as sugestões nesta visita? Ver `carregarSugestoes`. */
  const sugestoesPedidas = useRef(false);
  const arquivoDoStory = useRef<HTMLInputElement>(null);

  async function token() {
    const { supabase } = await import("@/integrations/supabase/client");
    const s = await supabase.auth.getSession();
    return s.data.session?.access_token ?? null;
  }

  async function carregarFeed() {
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/rede-social.functions");
      /* Feed e stories em PARALELO: são duas consultas independentes, e em
         série a fileira só apareceria depois de o feed inteiro chegar. */
      const [r, st, meu, at] = await Promise.all([
        mod.meuFeed({ data: { accessToken: t } }),
        mod.storiesDoFeed({ data: { accessToken: t } }),
        mod.meuPerfilSocial({ data: { accessToken: t } }),
        /* ⚠️ A atividade vem JUNTO, e não quando ela toca no ♡: o emblema é o
           que faz alguém tocar. Buscando só na abertura da caixa, o coração
           nasceria sempre sem número e a caixa só seria aberta por acaso. */
        mod.minhaAtividade({ data: { accessToken: t } }),
      ]);
      if (r.ok) {
        setPosts(r.posts);
        setProximo(r.proximo);
      }
      if (st.ok) setBolhas(st.bolhas);
      if (meu.ok) {
        setEuId(meu.perfil.id);
        setMeuAvatar(meu.perfil.avatarUrl ?? null);
        setSemanaDoCarimbo(meu.semanaDoCarimbo);
      }
      if (at.ok) {
        setAvisos(at.itens);
        setNaoVistas(at.novas);
      }
      void carregarDesafio();
      void carregarCaixinha();
    } catch {
      /* Feed vazio é melhor que erro: ela não veio buscar um erro. */
    } finally {
      setCarregando(false);
    }
  }

  /**
   * A CAIXINHA.
   *
   * ⚠️ Carregada JUNTO com o feed pelo mesmo motivo da atividade: o emblema é o
   * que faz alguém abrir. Buscando só na abertura da caixa, a bolinha nasceria
   * sempre sem número e a caixa só seria aberta por acaso — que é como uma
   * pergunta fica dias sem resposta numa caixa cujo dono não sabe que ela tem
   * algo dentro.
   */
  async function carregarCaixinha() {
    try {
      const t = await token();
      if (!t) return;
      const { minhaCaixinha } = await import("@/lib/caixinha.functions");
      const r = await minhaCaixinha({ data: { accessToken: t } });
      if (!r.ok) return;
      setPerguntasDaCaixa(r.perguntas);
      setCaixaAberta(r.aceita);
      setNaCaixa(r.novas);
    } catch {
      /* Sem a caixa ela perde a caixa, não a aba. */
    }
  }

  async function alternarCaixa(aberta: boolean) {
    const t = await token();
    if (!t) return;
    const { salvarPerfilSocial } = await import("@/lib/rede-social.functions");
    const r = await salvarPerfilSocial({ data: { accessToken: t, aceitaPerguntas: aberta } });
    const { toast } = await import("sonner");
    if (!r.ok) {
      toast.error("Não deu para mudar agora. Tente de novo.");
      return;
    }
    /* ⚠️ `parcial` = o banco não tem a coluna, e o recuo salvou só o resto.
       Acender a chave aqui faria a tela afirmar que a caixa está aberta
       enquanto o servidor recusa toda pergunta. */
    if ("parcial" in r && r.parcial) {
      toast.error("A caixinha ainda não está pronta no servidor.");
      return;
    }
    setCaixaAberta(aberta);
  }

  /**
   * Perguntar para outra pessoa.
   *
   * ⚠️ **Devolve o desfecho do SERVIDOR, cru.** A tela desenha o recado a
   * partir dele; decidir aqui qual das três coisas aconteceu seria uma segunda
   * régua clínica no navegador, e ela discordaria da primeira no dia em que uma
   * das listas mudasse.
   */
  async function perguntarPara(donaId: string, texto: string): Promise<DesfechoDaPergunta | null> {
    try {
      const t = await token();
      if (!t) return null;
      const { perguntar } = await import("@/lib/caixinha.functions");
      const r = await perguntar({ data: { accessToken: t, donaId, texto } });
      if (!r.ok) {
        /* ⚠️ O texto vem do SERVIDOR. Escrevê-lo aqui seria uma segunda régua:
           ela diria "você já mandou bastante hoje" para um teto POR PESSOA, que
           é outra coisa — e divergiria no primeiro ajuste. */
        const { toast } = await import("sonner");
        toast.error(("recado" in r && r.recado) || "Não deu para enviar agora. Tente de novo.");
        return null;
      }
      return r.desfecho;
    } catch {
      return null;
    }
  }

  /** Responder. `null` = publicou; string = a recusa, com o recado do servidor. */
  async function responderDaCaixa(
    id: string,
    resposta: string,
    visibilidade: Visibilidade,
  ): Promise<string | null> {
    try {
      const t = await token();
      if (!t) return "Sua sessão expirou. Entre de novo.";
      const { responderPergunta } = await import("@/lib/caixinha.functions");
      const r = await responderPergunta({
        data: { accessToken: t, perguntaId: id, resposta, visibilidade },
      });
      if (!r.ok) {
        return ("recado" in r && r.recado) || "Não deu para publicar agora. Tente de novo.";
      }
      /* A caixa e o FEED, os dois: a resposta virou post, e não vê-lo aparecer
         faria ela publicar de novo. */
      await carregarCaixinha();
      void carregarFeed();
      return null;
    } catch {
      return "Não deu para publicar agora. Tente de novo.";
    }
  }

  async function denunciarPost(post: PostNaTela) {
    /* Some da tela na hora, como o apagar: ela acabou de denunciar, e um post
       que continua ali lê como "não foi". */
    setPosts((ps) => ps.filter((x) => x.id !== post.id));
    setSugestoes((ps) => ps.filter((x) => x.id !== post.id));
    if (onde.t === "post") setOnde({ t: "feed" });
    try {
      const t = await token();
      if (!t) return;
      const { denunciarPost: chamar } = await import("@/lib/rede-social.functions");
      const r = await chamar({ data: { accessToken: t, postId: post.id } });
      const { toast } = await import("sonner");
      if (r.ok) toast.success("Denunciada. A gente vai olhar.");
      else toast.error("Não deu para denunciar agora.");
    } catch {
      /* Ela vê o post voltar na próxima carga. */
    }
  }

  async function removerSeguidor(quemId: string) {
    /* ⚠️ Some da lista na hora, e o CONTADOR do perfil desce junto: o número
       vive em `perfil.meusSeguidores`, e sem isto a lista mostraria 11 pessoas
       embaixo de um "12 seguidores". */
    setGente((g) => g.filter((p) => p.id !== quemId));
    setPerfil((p) =>
      p && p.meusSeguidores != null
        ? { ...p, meusSeguidores: Math.max(0, p.meusSeguidores - 1) }
        : p,
    );
    try {
      const t = await token();
      if (!t) return;
      const { removerSeguidor: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, quemId } });
    } catch {
      /* A próxima abertura da lista corrige. */
    }
  }

  async function arquivarDaCaixa(id: string) {
    const t = await token();
    if (!t) return;
    const { arquivarPergunta } = await import("@/lib/caixinha.functions");
    const r = await arquivarPergunta({ data: { accessToken: t, perguntaId: id } });
    if (r.ok) await carregarCaixinha();
  }

  async function denunciarDaCaixa(id: string, bloquear: boolean) {
    const t = await token();
    if (!t) return;
    const { denunciarPergunta } = await import("@/lib/caixinha.functions");
    const r = await denunciarPergunta({ data: { accessToken: t, perguntaId: id, bloquear } });
    const { toast } = await import("sonner");
    /* ⚠️ O aviso NUNCA nomeia ninguém — a caixa é anônima, e um "bloqueamos
       Fulana" aqui devolveria por texto o que o servidor recusou por campo. */
    if (r.ok) toast.success(bloquear ? "Denunciada e bloqueada." : "Denunciada.");
    else toast.error("Não deu para concluir agora. Tente de novo.");
    await carregarCaixinha();
  }

  useEffect(() => {
    if (careMode) {
      setCarregando(false);
      return;
    }
    void carregarFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode]);

  /* O feed acabou (não há página seguinte) → a zona de sugestões pode nascer.
     Também cobre a conta NOVA, em que o feed nasce vazio e `proximo` é `null`:
     ali a fileira de pessoas é a única coisa útil na tela. */
  useEffect(() => {
    if (careMode || carregando || proximo) return;
    void carregarSugestoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode, carregando, proximo]);

  /**
   * A zona de sugestões.
   *
   * ⚠️ **Pedido à parte, e só quando o feed de quem ela segue acabou.** Junto
   * com o feed, ela pagaria a consulta mais cara da tela em toda abertura — e
   * quem tem muita gente para ler nunca chega no fim para vê-la. E uma vez só
   * por visita: `carregadas` guarda o pedido feito, não o resultado, porque um
   * resultado vazio é resposta legítima (base pequena, ela já segue todo mundo)
   * e sem isso a tela pediria de novo a cada rolagem.
   */
  /**
   * O desafio da semana, e o bônus.
   *
   * ⚠️ **A cobrança roda JUNTO com a leitura**, e é idempotente: a chave carrega
   * o desafio e a pessoa, e `cobrarBonusDoDesafio` só paga o VIGENTE — ligar o
   * recurso não retroage. É o mesmo desenho de `cobrarBonusDaDupla`, que passou
   * meses só pagando quem abria a aba Amigas.
   */
  async function carregarDesafio() {
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/desafio-em-grupo.functions");
      const [r] = await Promise.all([
        mod.meuDesafioDaSemana({ data: { accessToken: t } }),
        mod.cobrarBonusDoDesafio({ data: { accessToken: t } }).catch(() => null),
      ]);
      if (r.ok) setDesafio(r.desafio);
    } catch {
      /* Sem desafio a aba fica como estava. */
    }
  }

  async function entrarNoDesafio(entrar: boolean) {
    if (!desafio) return;
    /* Otimista: o cartão responde na hora, e a próxima carga corrige. */
    setDesafio({ ...desafio, souParticipante: entrar });
    try {
      const t = await token();
      if (!t) return;
      const { entrarNoDesafio: chamar } = await import("@/lib/desafio-em-grupo.functions");
      await chamar({ data: { accessToken: t, desafioId: desafio.id, entrar } });
      await carregarDesafio();
    } catch {
      void carregarDesafio();
    }
  }

  async function carregarSugestoes() {
    if (sugestoesPedidas.current) return;
    sugestoesPedidas.current = true;
    try {
      const t = await token();
      if (!t) return;
      const { sugestoesDoFeed } = await import("@/lib/rede-social.functions");
      const r = await sugestoesDoFeed({ data: { accessToken: t } });
      if (!r.ok) return;
      setSugestoes(r.posts);
      setPessoas(r.pessoas);
    } catch {
      /* Sem sugestão a tela fica só com o feed dela, que é o estado normal de
         quem já segue todo mundo. */
    }
  }

  async function seguirPessoa(alvoId: string) {
    try {
      const t = await token();
      if (!t) return;
      const { seguir: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, alvoId } });
      /* ⚠️ NÃO recarrega o feed aqui. O post dela só passa a valer no próximo
         carregamento, e refazer a lista embaixo do dedo tiraria da tela o que
         ela estava lendo. A fileira já mostra "Seguindo". */
    } catch {
      /* O botão volta ao normal na próxima abertura. */
    }
  }

  async function maisAntigas() {
    if (!proximo || buscandoMais.current) return;
    buscandoMais.current = true;
    try {
      const t = await token();
      if (!t) return;
      const { meuFeed } = await import("@/lib/rede-social.functions");
      const r = await meuFeed({ data: { accessToken: t, antesDe: proximo } });
      if (!r.ok) return;
      /* ⚠️ Junta SEM REPETIR por id. A régua filtra depois de ler, então duas
         páginas podem se sobrepor — e uma chave repetida no React derruba a
         lista inteira, não só o item. */
      setPosts((ps) => {
        const vistos = new Set(ps.map((p) => p.id));
        return [...ps, ...r.posts.filter((p) => !vistos.has(p.id))];
      });
      setProximo(r.proximo);
    } catch {
      /* Fica onde está; a sentinela tenta de novo na próxima rolagem. */
    } finally {
      buscandoMais.current = false;
    }
  }

  async function abrirPerfil(id: string) {
    setPerfil(null);
    setOnde({ t: "perfil", id });
    try {
      const t = await token();
      if (!t) return;
      const { verPerfil } = await import("@/lib/rede-social.functions");
      const r = await verPerfil({ data: { accessToken: t, alvoId: id } });
      if (r.ok) {
        setPerfil(r.perfil);
        setDoPerfil(r.posts);
      } else {
        /* `indisponivel` cobre bloqueio, Modo Cuidado e perfil inexistente com
           a mesma resposta — e a tela não conta qual foi. */
        setOnde({ t: "feed" });
      }
    } catch {
      setOnde({ t: "feed" });
    }
  }

  async function abrirLista(tipo: "seguidores" | "seguindo") {
    setGente([]);
    setOnde({ t: "lista", tipo });
    try {
      const t = await token();
      if (!t) return;
      const { listaDeGente } = await import("@/lib/rede-social.functions");
      const r = await listaDeGente({ data: { accessToken: t, tipo } });
      if (r.ok) setGente(r.gente);
    } catch {
      /* Lista vazia; a tela já diz "ninguém por aqui ainda". */
    }
  }

  async function abrirPost(id: string) {
    setOPost(null);
    setOnde({ t: "post", id });
    try {
      const t = await token();
      if (!t) return;
      const { verPost } = await import("@/lib/rede-social.functions");
      const r = await verPost({ data: { accessToken: t, postId: id } });
      if (r.ok) setOPost(r.post);
      else setOnde({ t: "feed" });
    } catch {
      setOnde({ t: "feed" });
    }
  }

  async function reagir(post: PostNaTela, tipo: TipoDeReacao | null) {
    const aplicar = (ps: PostNaTela[]) =>
      ps.map((p) => {
        if (p.id !== post.id) return p;
        const c = { ...p.reacoes };
        if (p.minhaReacao) c[p.minhaReacao] = Math.max(0, (c[p.minhaReacao] ?? 1) - 1);
        if (tipo) c[tipo] = (c[tipo] ?? 0) + 1;
        return { ...p, reacoes: c, minhaReacao: tipo };
      });
    setPosts(aplicar);
    setDoPerfil(aplicar);
    /* ⚠️ **`sugestoes` é uma QUARTA lista, e ela era esquecida aqui e em
       `guardar`.** `votar`, logo abaixo, lembra — e a divergência era invisível
       na bancada, porque os handlers de mentira dela não têm estado. Na zona
       "Publicações sugeridas" o servidor gravava e a tela não mudava: ela
       tocava no coração e nada acontecia. */
    setSugestoes(aplicar);
    setOPost((p) => (p ? aplicar([p])[0] : p));
    try {
      const t = await token();
      if (!t) return;
      const { reagir: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, postId: post.id, tipo } });
    } catch {
      void carregarFeed();
    }
  }

  async function seguir() {
    if (!perfil || perfil.souEu) return;
    try {
      const t = await token();
      if (!t) return;
      const mod = await import("@/lib/rede-social.functions");
      if (perfil.meuVinculo === "ativo") {
        await mod.deixarDeSeguir({ data: { accessToken: t, alvoId: perfil.id } });
        setPerfil({ ...perfil, meuVinculo: null });
      } else if (!perfil.meuVinculo) {
        const r = await mod.seguir({ data: { accessToken: t, alvoId: perfil.id } });
        if (r.ok) setPerfil({ ...perfil, meuVinculo: r.estado });
      }
    } catch {
      /* O botão volta ao estado real na próxima abertura do perfil. */
    }
  }

  async function salvarPerfil(m: {
    nome?: string;
    bio?: string | null;
    avatar?: string | null;
  }): Promise<boolean> {
    try {
      const t = await token();
      if (!t) return false;
      const { salvarPerfilSocial } = await import("@/lib/rede-social.functions");
      const r = await salvarPerfilSocial({ data: { accessToken: t, ...m } });
      if (!r.ok) return false;
      /* Recarrega do servidor em vez de aplicar o que eu mandei: a foto volta
         como URL ASSINADA do balde, e não como a data URL que subiu — pintar a
         data URL aqui deixaria a tela certa e o banco diferente. */
      if (perfil) await abrirPerfil(perfil.id);
      return true;
    } catch {
      return false;
    }
  }

  async function publicar(p: {
    texto: string | null;
    fotos: string[];
    visibilidade: Visibilidade;
    enquete: string[];
    aula: AulaNoPost | null;
  }): Promise<boolean> {
    try {
      const t = await token();
      if (!t) return false;
      const { publicarPost } = await import("@/lib/rede-social.functions");
      const r = await publicarPost({
        data: {
          accessToken: t,
          texto: p.texto,
          /* A PRIMEIRA vai em `imagem` e as demais em `extras` — é a forma do
             servidor, que guardou a capa numa coluna própria desde antes de o
             carrossel existir. */
          imagem: p.fotos[0] ?? null,
          extras: p.fotos.slice(1),
          visibilidade: p.visibilidade,
          enquete: p.enquete,
          aula: p.aula,
        },
      });
      if (!r.ok) {
        /* ⚠️ **O recado da régua clínica precisa CHEGAR.** Sem ele, quem
           escreveu "não precisa ir ao pronto-socorro" recebe um "não deu para
           publicar" genérico, reescreve a mesma frase e tenta de novo para
           sempre. O texto vem do SERVIDOR — decidir aqui por que foi recusado
           seria uma segunda régua clínica no navegador. */
        if ("recado" in r && r.recado) {
          const { toast } = await import("sonner");
          toast.error(r.recado, { duration: 7000 });
        }
        return false;
      }
      /* Recarrega em vez de enfiar o post na lista: a URL da foto volta
         ASSINADA do balde, e a data URL que subiu não é a que o feed mostra. */
      await carregarFeed();
      return true;
    } catch {
      return false;
    }
  }

  async function apagar(post: PostNaTela) {
    /* Some da tela na hora, das TRÊS listas: ela acabou de mandar apagar, e um
       post que continua ali por meio segundo lê como "não apagou". */
    setPosts((ps) => ps.filter((x) => x.id !== post.id));
    setDoPerfil((ps) => ps.filter((x) => x.id !== post.id));
    setSalvos((ps) => ps.filter((x) => x.id !== post.id));
    if (onde.t === "post") setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" });
    try {
      const t = await token();
      if (!t) return;
      const { apagarPost } = await import("@/lib/rede-social.functions");
      const r = await apagarPost({ data: { accessToken: t, postId: post.id } });
      if (!r.ok) await carregarFeed();
    } catch {
      void carregarFeed();
    }
  }

  async function votar(post: PostNaTela, opcao: number) {
    if (!post.enquete || post.enquete.meuVoto !== null) return;
    /* Otimista: o voto é o gesto mais leve da tela, e esperar o servidor faz o
       botão parecer travado. Se falhar, a próxima carga corrige. */
    const aplicar = (ps: PostNaTela[]) =>
      ps.map((x) => {
        if (x.id !== post.id || !x.enquete) return x;
        const votos = [...x.enquete.votos];
        votos[opcao] = (votos[opcao] ?? 0) + 1;
        return { ...x, enquete: { ...x.enquete, votos, meuVoto: opcao } };
      });
    setPosts(aplicar);
    setDoPerfil(aplicar);
    setSugestoes(aplicar);
    setOPost((x) => (x ? aplicar([x])[0] : x));
    try {
      const t = await token();
      if (!t) return;
      const { votar: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, postId: post.id, opcao } });
    } catch {
      void carregarFeed();
    }
  }

  async function guardar(post: PostNaTela, salvar: boolean) {
    const aplicar = (ps: PostNaTela[]) =>
      ps.map((x) => (x.id === post.id ? { ...x, salvo: salvar } : x));
    setPosts(aplicar);
    setDoPerfil(aplicar);
    setOPost((x) => (x ? aplicar([x])[0] : x));
    /* Tirar dos salvos com a lista aberta some da lista; guardar não a
       preenche, porque a lista vem ordenada do servidor. */
    if (!salvar) setSalvos((ps) => ps.filter((x) => x.id !== post.id));
    try {
      const t = await token();
      if (!t) return;
      const { salvarPost } = await import("@/lib/rede-social.functions");
      await salvarPost({ data: { accessToken: t, postId: post.id, salvar } });
    } catch {
      void carregarFeed();
    }
  }

  /**
   * O espelho.
   *
   * ⚠️ Chama a MESMA `verPerfil` da tela real, com `comoVisitante` — nada é
   * montado aqui. E `motivo: "trancado"` não é erro: é a resposta certa para a
   * maioria das pacientes, cujo perfil nasce fechado.
   */
  async function verComo(p: Persona) {
    setPersona(p);
    setPrevia((v) => ({ ...v, carregando: true }));
    try {
      const t = await token();
      if (!t || !euId) return;
      const { verPerfil } = await import("@/lib/rede-social.functions");
      const r = await verPerfil({ data: { accessToken: t, alvoId: euId, comoVisitante: p } });
      if (r.ok) {
        setPrevia({ perfil: r.perfil, posts: r.posts, trancado: false, carregando: false });
      } else {
        setPrevia({
          perfil: null,
          posts: [],
          trancado: r.motivo === "trancado",
          carregando: false,
        });
      }
    } catch {
      setPrevia({ perfil: null, posts: [], trancado: false, carregando: false });
    }
  }

  async function abrirSalvos() {
    setSalvos([]);
    setOnde({ t: "salvos" });
    try {
      const t = await token();
      if (!t) return;
      const { meusSalvos } = await import("@/lib/rede-social.functions");
      const r = await meusSalvos({ data: { accessToken: t } });
      if (r.ok) setSalvos(r.posts);
    } catch {
      /* Lista vazia; a tela já diz "você ainda não guardou nada". */
    }
  }

  async function abrirAtividade() {
    setOnde({ t: "atividade" });
    /* ⚠️ O emblema zera JÁ, sem esperar o servidor: ela está olhando a caixa
       neste instante, e um número que continua aceso enquanto ela lê é o
       número deixando de significar. Se a gravação falhar, ele volta na
       próxima abertura do app — e voltar é melhor que nunca ter zerado. */
    setNaoVistas(0);
    setAvisos((as) => as.map((a) => ({ ...a, visto: true })));
    try {
      const t = await token();
      if (!t) return;
      const { marcarAtividadeVista } = await import("@/lib/rede-social.functions");
      await marcarAtividadeVista({ data: { accessToken: t } });
    } catch {
      /* Fica não vista no banco; a próxima abertura mostra de novo. */
    }
  }

  async function buscar(termo: string): Promise<PessoaNaLista[]> {
    try {
      const t = await token();
      if (!t) return [];
      const { buscarPerfis } = await import("@/lib/rede-social.functions");
      const r = await buscarPerfis({ data: { accessToken: t, termo } });
      if (!r.ok) return [];
      return r.perfis.map((p) => ({
        id: p.id,
        nome: p.nome,
        bio: p.bio,
        avatarUrl: p.avatarUrl,
        sigo: p.meuVinculo,
        souEu: false,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Aplica o código de embaixadora de um perfil.
   *
   * ⚠️ Quem confere tudo é `atribuirInfluenciadora`: e-mail confirmado, código
   * ATIVO, e `ref_code` ainda nulo (com `.is("ref_code", null)` na condição do
   * UPDATE, para o checkout não perder a corrida). A tela não repete nenhuma
   * dessas réguas — uma segunda diria "pronto" sobre o que o servidor recusou.
   */
  async function aplicarCodigo(codigo: string) {
    try {
      const t = await token();
      if (!t) return;
      const { atribuirInfluenciadora } = await import("@/lib/influenciadora.functions");
      const r = await atribuirInfluenciadora({ data: { accessToken: t, codigo } });
      const { toast } = await import("sonner");
      if (r.ok && r.atribuido) {
        toast.success(r.bonus ? `Pronto! +${r.bonus} 🌱 de boas-vindas` : "Pronto 💛");
        /* Recarrega o perfil: a pílula some, porque agora eu tenho código. */
        if (perfil) await abrirPerfil(perfil.id);
      } else if (r.ok && (r as { jaTinha?: boolean }).jaTinha) {
        toast.error("Você já tem um código guardado.");
      } else if (r.ok && (r as { invalido?: boolean }).invalido) {
        toast.error("Esse código não está mais ativo.");
      } else {
        toast.error("Não deu para usar o código agora.");
      }
    } catch {
      /* Nada mudou; o botão continua lá. */
    }
  }

  async function bloquear(alvoId: string) {
    try {
      const t = await token();
      if (!t) return;
      const { bloquear: chamar } = await import("@/lib/rede-social.functions");
      const r = await chamar({ data: { accessToken: t, alvoId, bloquear: true } });
      if (!r.ok) return;
      /* Volta ao feed e recarrega: bloquear desfaz o seguir nos dois sentidos
         e tira os posts dela da minha vista — ficar no perfil de quem acabei
         de bloquear seria a tela contradizendo o gesto. */
      setOnde({ t: "feed" });
      await carregarFeed();
    } catch {
      /* O perfil continua como está; ela vê que nada mudou e tenta de novo. */
    }
  }

  async function responder(seguidorId: string, aceitar: boolean) {
    setAvisos((as) =>
      as.filter((a) => !(a.especie === "pediu_para_seguir" && a.quemId === seguidorId)),
    );
    try {
      const t = await token();
      if (!t) return;
      const { responderPedido } = await import("@/lib/rede-social.functions");
      await responderPedido({ data: { accessToken: t, seguidorId, aceitar } });
    } catch {
      /* O pedido volta na próxima abertura. */
    }
  }

  async function publicarStory(dataUrl: string, carimbar: boolean) {
    setConferindoStory(null);
    try {
      const t = await token();
      if (!t) return;
      const { publicarStory: chamar } = await import("@/lib/rede-social.functions");
      const r = await chamar({
        data: { accessToken: t, imagem: dataUrl, texto: null, carimbarSemana: carimbar },
      });
      if (r.ok) void carregarFeed();
    } catch {
      /* A fileira não muda; ela tenta de novo. */
    }
  }

  async function quemViu(storyId: string): Promise<PessoaNaLista[]> {
    try {
      const t = await token();
      if (!t) return [];
      const { quemViuMeuStory } = await import("@/lib/rede-social.functions");
      const r = await quemViuMeuStory({ data: { accessToken: t, storyId } });
      return r.ok ? r.gente : [];
    } catch {
      return [];
    }
  }

  async function apagarStory(storyId: string) {
    /* Fecha o visor na hora: continuar olhando o story que ela acabou de mandar
       apagar é a tela contradizendo o gesto. */
    setVendoStory(null);
    try {
      const t = await token();
      if (!t) return;
      const { apagarStory: chamar } = await import("@/lib/rede-social.functions");
      await chamar({ data: { accessToken: t, storyId } });
    } catch {
      /* Continua lá; a fileira mostra de novo na próxima abertura. */
    } finally {
      void carregarFeed();
    }
  }

  async function verStory(autorId: string) {
    const b = bolhas.find((x) => x.autorId === autorId);
    /* ⚠️ Tocar na MINHA bolinha sem story nenhum abre o seletor de foto, não
       um visor vazio. É a bolinha do "adicionar", e é assim que publicar um
       story deixa de ser função escondida. */
    if (!b || b.stories.length === 0) {
      if (autorId === euId) arquivoDoStory.current?.click();
      return;
    }
    setVendoStory(b);
  }

  async function marcarVisto(storyId: string) {
    try {
      const t = await token();
      if (!t) return;
      const { marcarStoryVisto } = await import("@/lib/rede-social.functions");
      await marcarStoryVisto({ data: { accessToken: t, storyId } });
      /* O anel apaga na hora, sem esperar recarga — quem acabou de ver não
         deve encontrar o anel aceso ao fechar. */
      setBolhas((bs) =>
        bs.map((b) =>
          b.stories.some((x) => x.id === storyId)
            ? {
                ...b,
                stories: b.stories.map((x) => (x.id === storyId ? { ...x, visto: true } : x)),
                novo: b.stories.some((x) => x.id !== storyId && !x.visto),
              }
            : b,
        ),
      );
    } catch {
      /* Não visto continua não visto; a próxima abertura corrige. */
    }
  }

  /**
   * OS ATALHOS DA ABA — as bolinhas que sobem da barra de baixo.
   *
   * ⚠️ Elas são o que o cabeçalho da tela deixou de ser. O feed abre agora nos
   * stories, e as ações moram a um toque no ícone da Comunidade — pedido do
   * dono: "as funções adicionais devem abrir quando a pessoa está na aba e toca
   * no ícone de novo; aí abrem várias bolinhas pra cima".
   *
   * ⚠️ **Só quando ela está NO FEED.** Dentro de uma tela filha (o perfil de
   * alguém, a busca, o compositor) as bolinhas ofereceriam "Publicar" por cima
   * de uma tela que já é outra coisa — e o botão de fechar dela está ali do
   * lado, na seta.
   *
   * ⚠️ E o `useEffect` depende do EMBLEMA (`naoVistas`): sem ele, o número de
   * atividades novas congelaria no valor da montagem, e a bolinha diria "3"
   * depois de ela ter lido as três.
   */
  useEffect(() => {
    if (onde.t !== "feed") return;
    /* ⚠️ **Em Modo Cuidado as bolinhas NÃO somem — elas encolhem.** Sumindo,
       tocar de novo no ícone da Comunidade não fazia nada e o hub ficava
       inalcançável; sobra a porta para o que `portasDaComunidade` mantém de
       propósito (Amigas, Acompanhante, Álbum). Publicar, buscar, atividade,
       perfil, salvos e caixinha ficam de fora — são a rede em volta. */
    if (careMode) {
      return publicarAtalhos(
        "comunidade",
        onAbrirSecoes
          ? [
              {
                id: "secoes",
                rotulo: "Amigas, álbum…",
                icone: "grade" as const,
                aoTocar: onAbrirSecoes,
              },
            ]
          : [],
      );
    }
    const atalhos: AtalhoDaAba[] = [
      { id: "buscar", rotulo: "Buscar", icone: "buscar", aoTocar: () => setOnde({ t: "busca" }) },
      {
        id: "atividade",
        rotulo: "Atividade",
        icone: "coracao",
        emblema: naoVistas,
        aoTocar: () => void abrirAtividade(),
      },
      { id: "publicar", rotulo: "Publicar", icone: "mais", aoTocar: () => setOnde({ t: "novo" }) },
      {
        id: "perfil",
        rotulo: "Meu perfil",
        icone: "pessoa",
        aoTocar: () => {
          if (euId) void abrirPerfil(euId);
        },
      },
      { id: "salvos", rotulo: "Salvos", icone: "marcador", aoTocar: () => void abrirSalvos() },
      {
        id: "caixinha",
        rotulo: "Caixinha",
        icone: "balao",
        /* ⚠️ O emblema conta as SEM RESPOSTA, e não o total: uma caixa com
           quarenta perguntas já respondidas diria "40" para sempre, e o número
           deixaria de significar trabalho. Mesma régua do contador da fita do
           painel. */
        emblema: naCaixa,
        aoTocar: () => setOnde({ t: "caixinha" }),
      },
      ...(onAbrirSecoes
        ? [
            {
              id: "secoes",
              rotulo: "Chá de bebê, álbum…",
              icone: "grade" as const,
              aoTocar: onAbrirSecoes,
            },
          ]
        : []),
    ];
    return publicarAtalhos("comunidade", atalhos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careMode, onde.t, naoVistas, naCaixa, euId, onAbrirSecoes]);

  /* ⚠️ **`return null` DEIXAVA A ABA EM BRANCO, e sem saída.**
     A barra de baixo abre "Feed", e o único caminho para o hub é o atalho ⊞ que
     esta MESMA tela publica — e o efeito dos atalhos retorna cedo em Modo
     Cuidado. Então a paciente que perdeu a gestação tocava em Comunidade (o
     ícone continua aceso), via uma tela VAZIA, tocava de novo e nada subia. Ela
     conclui que o app quebrou, na semana em que menos tem paciência para isso.

     E `portasDaComunidade` mantém Amigas, Acompanhante e Álbum de propósito —
     "tirá-las seria isolá-la no pior momento" —, então as três ficavam sem
     porta nenhuma. O silêncio tem de ter uma porta. */
  if (careMode) {
    return (
      <div className="px-4 py-10">
        <div className="rounded-3xl border border-border bg-card p-8 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            O feed está em pausa enquanto o Modo Cuidado estiver ligado.
          </p>
          {onAbrirSecoes && (
            <button
              type="button"
              onClick={onAbrirSecoes}
              className="press mt-4 rounded-full border border-border px-5 py-2 text-xs font-semibold text-foreground"
            >
              Ver Amigas, Álbum e Acompanhante
            </button>
          )}
        </div>
      </div>
    );
  }

  /* A conferência vem ANTES de tudo: ela é tela cheia e a escolha já foi feita. */
  if (conferindoStory) {
    return (
      <ConferirStory
        imagem={conferindoStory}
        /* ⚠️ A semana vem do MEU perfil, que a tela já carregou — e `null`
           quando não há o que carimbar (sem DUM, pós-parto, Modo Cuidado). */
        semana={semanaDoCarimbo}
        aoCancelar={() => setConferindoStory(null)}
        aoPublicar={({ carimbar }) => void publicarStory(conferindoStory, carimbar)}
      />
    );
  }

  if (vendoStory) {
    return (
      <VisorDeStory
        bolha={vendoStory}
        aoFechar={() => setVendoStory(null)}
        aoVer={marcarVisto}
        souEu={vendoStory.autorId === euId}
        aoQuemViu={quemViu}
        aoApagarStory={apagarStory}
      />
    );
  }

  if (onde.t === "novo") {
    return (
      <NovoPost
        aoFechar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoPublicar={publicar}
        aulaDeHoje={aulaDeHoje}
      />
    );
  }

  if (onde.t === "espelho") {
    return (
      <EspelhoDoPerfil
        persona={persona}
        aoTrocarPersona={verComo}
        perfil={previa.perfil}
        posts={previa.posts}
        trancado={previa.trancado}
        carregando={previa.carregando}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
      />
    );
  }

  if (onde.t === "busca") {
    return (
      <TelaDeBusca
        aoVoltar={() => setOnde({ t: "feed" })}
        aoBuscar={buscar}
        aoAbrirPerfil={abrirPerfil}
      />
    );
  }

  if (onde.t === "salvos") {
    return (
      <TelaDosSalvos
        posts={salvos}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoAbrirPost={abrirPost}
      />
    );
  }

  if (onde.t === "caixinha") {
    return (
      <TelaDaCaixinha
        perguntas={perguntasDaCaixa}
        aceita={caixaAberta}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoAlternarCaixa={(v) => void alternarCaixa(v)}
        aoResponder={responderDaCaixa}
        aoArquivar={(id) => void arquivarDaCaixa(id)}
        aoDenunciar={(id, b) => void denunciarDaCaixa(id, b)}
        aoAbrirPost={abrirPost}
      />
    );
  }

  if (onde.t === "atividade") {
    return (
      <TelaDeAtividade
        itens={avisos}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoAbrirPerfil={abrirPerfil}
        aoAbrirPost={abrirPost}
        aoResponder={responder}
      />
    );
  }

  if (onde.t === "editar" && perfil) {
    return (
      <EditarPerfil
        perfil={perfil}
        aoSalvar={salvarPerfil}
        aoFechar={() => setOnde({ t: "perfil", id: perfil.id })}
      />
    );
  }

  if (onde.t === "lista") {
    return (
      <ListaDeGente
        titulo={onde.tipo === "seguidores" ? "Seguidores" : "Seguindo"}
        gente={gente}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoAbrirPerfil={abrirPerfil}
        /* ⚠️ Só em SEGUIDORES: em "Seguindo", quem sai é ela, e para isso já
           existe o botão do perfil. */
        aoRemover={onde.tipo === "seguidores" ? (id) => void removerSeguidor(id) : undefined}
      />
    );
  }

  if (onde.t === "post" && oPost) {
    return (
      <TelaDoPost
        post={oPost}
        aoReagir={(t) => reagir(oPost, t)}
        aoSalvar={(v) => guardar(oPost, v)}
        aoVotar={(i) => votar(oPost, i)}
        aoApagar={oPost.souAAutora ? () => apagar(oPost) : undefined}
        aoDenunciar={oPost.souAAutora ? undefined : () => void denunciarPost(oPost)}
        aoVoltar={() => setOnde(perfil ? { t: "perfil", id: perfil.id } : { t: "feed" })}
        aoAbrirPerfil={abrirPerfil}
      />
    );
  }

  if (onde.t === "perfil" && perfil) {
    return (
      <TelaDePerfil
        perfil={perfil}
        posts={doPerfil}
        aoVoltar={() => setOnde({ t: "feed" })}
        aoSeguir={perfil.souEu ? () => setOnde({ t: "editar" }) : seguir}
        aoAbrirPost={abrirPost}
        aoAbrirLista={perfil.souEu ? abrirLista : undefined}
        aoAbrirSalvos={perfil.souEu ? abrirSalvos : undefined}
        aoAbrirEspelho={
          perfil.souEu
            ? () => {
                setOnde({ t: "espelho" });
                void verComo(persona);
              }
            : undefined
        }
        aoBloquear={perfil.souEu ? undefined : () => bloquear(perfil.id)}
        aoAplicarCodigo={aplicarCodigo}
        aoPerguntar={(texto) => perguntarPara(perfil.id, texto)}
        /* ⚠️ Bandeira vermelha abre a Central de Emergência — a MESMA que a
           barra de baixo abre, e nunca uma tela nova. Ela avisa o médico e o
           contato dela com localização; um segundo caminho para "socorro"
           divergiria dela no primeiro conserto. */
        aoAbrirSOS={onAbrirSOS}
      />
    );
  }

  if (carregando) return <div className="skeleton h-80 rounded-2xl" />;

  /* A MINHA bolinha entra sempre, mesmo sem story — é o convite para publicar.
     Se o servidor já a devolveu (porque tenho story vivo), ela não é
     duplicada. */
  const fileira: Story[] = [
    ...(euId && !bolhas.some((b) => b.autorId === euId)
      ? [
          {
            id: euId,
            nome: "Seu story",
            /* ⚠️ **`perfil` é o ÚLTIMO PERFIL ABERTO, e não o meu.** Ele não é
               limpo no voltar, então abrir o perfil da Marina e voltar ao feed
               deixava a primeira bolinha — a "Seu story" — com a foto dela.
               `meuAvatar` é carregado por `meuPerfilSocial`, junto com o feed. */
            avatarUrl: meuAvatar,
            novo: false,
          },
        ]
      : []),
    ...bolhas.map((b) => ({
      id: b.autorId,
      nome: b.autorId === euId ? "Seu story" : b.autorNome,
      avatarUrl: b.autorAvatar,
      novo: b.novo,
    })),
  ];

  return (
    <>
      <input
        ref={arquivoDoStory}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          /* ⚠️ `prepararFotoDoStory`, e não `prepararAvatar`: aquele corta um
             QUADRADO de 512px no centro, e o story é 9:16 exibido inteiro. */
          const d = await prepararFotoDoStory(f);
          if (d) setConferindoStory(d);
        }}
      />
      <TelaPrincipal
        posts={posts}
        stories={fileira}
        aoReagir={reagir}
        aoSalvar={guardar}
        aoApagar={apagar}
        aoDenunciar={(p) => void denunciarPost(p)}
        aoVotar={votar}
        aoAbrirPerfil={abrirPerfil}
        aoChegarNoFim={maisAntigas}
        temMais={!!proximo}
        desafio={desafio}
        aoEntrarNoDesafio={entrarNoDesafio}
        aoIrParaOJogo={onIrParaOJogo}
        sugestoes={sugestoes}
        pessoas={pessoas}
        aoSeguirPessoa={seguirPessoa}
        aoTocarStory={verStory}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   EDITAR PERFIL
   ══════════════════════════════════════════════════════════════════════════ */

/** Reduz a foto no celular. Mesmo lado do resto do app. */
const LADO_DO_AVATAR = 512;
async function prepararAvatar(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    /* Corta o QUADRADO CENTRAL antes de reduzir — o avatar é exibido em
       círculo, e uma foto retangular esticada num círculo deforma o rosto. É o
       mesmo recorte de `campo-foto.tsx`. */
    const lado = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - lado) / 2;
    const sy = (bitmap.height - lado) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = LADO_DO_AVATAR;
    canvas.height = LADO_DO_AVATAR;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, LADO_DO_AVATAR, LADO_DO_AVATAR);
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return null;
  }
}

export function EditarPerfil({
  perfil,
  aoSalvar,
  aoFechar,
}: {
  perfil: PerfilNaTela;
  aoSalvar: (m: { nome?: string; bio?: string | null; avatar?: string | null }) => Promise<boolean>;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(perfil.nome);
  const [bio, setBio] = useState(perfil.bio ?? "");
  const [avatar, setAvatar] = useState<string | null>(perfil.avatarUrl);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    const ok = await aoSalvar({
      nome: nome.trim() || undefined,
      bio: bio.trim() || null,
      /* ⚠️ Só manda a foto se ela MUDOU. Reenviar a mesma URL a cada
         salvamento subiria um arquivo novo no balde toda vez, e o antigo
         ficaria órfão lá dentro — cem edições de bio viram cem fotos. */
      avatar: avatar !== perfil.avatarUrl ? avatar : undefined,
    });
    setSalvando(false);
    if (ok) aoFechar();
  }

  return (
    <div>
      <header className="flex h-11 items-center justify-between px-4">
        <button type="button" onClick={aoFechar} className="press text-[15px]">
          Cancelar
        </button>
        <h1 className="text-[16px] font-semibold">Editar perfil</h1>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="press text-[15px] font-semibold text-primary disabled:opacity-50"
        >
          {salvando ? "…" : "Salvar"}
        </button>
      </header>

      <div className="flex flex-col items-center gap-2 py-5">
        <Foto url={avatar} nome={nome} lado={AVATAR_DO_PERFIL} />
        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const d = await prepararAvatar(f);
            if (d) setAvatar(d);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => arquivo.current?.click()}
          className="press text-[14px] font-semibold text-primary"
        >
          Trocar foto
        </button>
      </div>

      <div className="space-y-4 px-4">
        <label className="block">
          <span className="text-[12px] text-muted-foreground">Nome</span>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value.slice(0, 60))}
            className="mt-1 w-full border-b border-border bg-transparent pb-1.5 text-[15px] outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[12px] text-muted-foreground">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, LIMITE_DA_BIO))}
            rows={2}
            className="mt-1 w-full resize-none border-b border-border bg-transparent pb-1.5 text-[15px] outline-none"
          />
          <span className="mt-0.5 block text-right text-[11px] tabular-nums text-muted-foreground">
            {bio.length}/{LIMITE_DA_BIO}
          </span>
        </label>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A LISTA DE GENTE
   ══════════════════════════════════════════════════════════════════════════ */

export type PessoaNaLista = {
  id: string;
  nome: string;
  bio: string | null;
  avatarUrl: string | null;
  sigo: "ativo" | "pendente" | null;
  souEu: boolean;
};

export function ListaDeGente({
  titulo,
  gente,
  aoVoltar,
  aoAbrirPerfil,
  aoRemover,
}: {
  titulo: string;
  gente: PessoaNaLista[];
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
  /**
   * Tirar alguém de perto sem bloquear. Só na lista de SEGUIDORES.
   *
   * ⚠️ A saída do meio que faltava: a lista só oferecia "seguir/deixar de
   * seguir", que é sobre quem EU sigo. Para tirar quem me segue, a única opção
   * era bloquear — nuclear, e que a própria tela descreve como reversível.
   */
  aoRemover?: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState<string | null>(null);
  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">{titulo}</h1>
      </header>
      {gente.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Ninguém por aqui ainda.</p>
      ) : (
        <ul>
          {gente.map((p) => (
            <li key={p.id}>
              <div className="flex items-center gap-1 pr-3">
                <button
                  type="button"
                  onClick={() => aoAbrirPerfil?.(p.id)}
                  className="press flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left"
                >
                  <Foto url={p.avatarUrl} nome={p.nome} lado={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold leading-tight">
                      {p.nome}
                    </span>
                    {p.bio && (
                      <span className="block truncate text-[12px] leading-tight text-muted-foreground">
                        {p.bio}
                      </span>
                    )}
                  </span>
                </button>
                {aoRemover && (
                  <button
                    type="button"
                    onClick={() => setConfirmando((c) => (c === p.id ? null : p.id))}
                    aria-label={`Opções de ${p.nome}`}
                    className="press shrink-0 px-2 text-[15px] leading-none text-muted-foreground"
                  >
                    ⋯
                  </button>
                )}
              </div>
              {/* ⚠️ Confirmação em MENSAGEM separada, e dizendo o que acontece —
                  a mesma decisão do cancelar consulta e do bloquear. E a frase
                  diz que é CALADO: sem isso, ela hesita achando que a outra vai
                  ser avisada. */}
              {confirmando === p.id && aoRemover && (
                <div className="mx-4 mb-2 rounded-2xl border border-border bg-muted/40 p-3">
                  <p className="text-[13px] leading-snug">
                    Tirar {p.nome} dos seus seguidores? Ela deixa de ver o que você publica, e não é
                    avisada.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
                    >
                      Não
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmando(null);
                        aoRemover(p.id);
                      }}
                      className="press flex-1 rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground"
                    >
                      Tirar
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O POST SOZINHO — o que a grade abre
   ══════════════════════════════════════════════════════════════════════════ */

export function TelaDoPost({
  post,
  aoReagir,
  aoSalvar,
  aoApagar,
  aoDenunciar,
  aoVotar,
  aoVoltar,
  aoAbrirPerfil,
}: {
  post: PostNaTela;
  aoReagir: (t: TipoDeReacao | null) => void;
  aoSalvar?: (salvar: boolean) => void;
  aoApagar?: () => void;
  /** Denunciar o post de outra pessoa. Ver `PostInstagram`. */
  aoDenunciar?: () => void;
  aoVotar?: (opcao: number) => void;
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
}) {
  return (
    <div className="px-4">
      <header className="flex h-11 items-center gap-2">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Publicação</h1>
      </header>
      <PostInstagram
        post={post}
        aoReagir={aoReagir}
        aoSalvar={aoSalvar}
        aoApagar={aoApagar}
        aoDenunciar={aoDenunciar}
        aoVotar={aoVotar}
        aoAbrirPerfil={aoAbrirPerfil}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O VISOR DE STORY — tela cheia
   ══════════════════════════════════════════════════════════════════════════ */

/** Quanto cada story fica na tela antes de passar sozinho. */
const DURACAO_DO_STORY = 5000;

export function VisorDeStory({
  bolha,
  aoFechar,
  aoVer,
  souEu = false,
  aoQuemViu,
  aoApagarStory,
}: {
  bolha: BolhaDeStory;
  aoFechar: () => void;
  aoVer?: (storyId: string) => void;
  /** É o meu story? Só então aparecem "visto por" e a lixeira. */
  souEu?: boolean;
  aoQuemViu?: (storyId: string) => Promise<PessoaNaLista[]>;
  aoApagarStory?: (storyId: string) => void;
}) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [quemViu, setQuemViu] = useState<PessoaNaLista[] | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const atual = bolha.stories[i];

  /* ⚠️ Marca como visto ao ENTRAR no story, não ao sair. Quem fecha o app no
     meio já viu aquele — e marcar na saída deixaria o anel aceso para sempre
     em quem sempre fecha antes do fim, que é a maioria. */
  useEffect(() => {
    if (atual) aoVer?.(atual.id);
  }, [atual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* O relógio que passa sozinho. Pausa enquanto o dedo está na tela — é o
     gesto que todo mundo já conhece de segurar para ler. */
  useEffect(() => {
    /* ⚠️ A folha de "visto por" e a confirmação PARAM o relógio. Sem isso o
       story passa por baixo da folha e ela fecha a lista para ler a foto
       seguinte — ou pior, a confirmação de apagar fica em pé sobre um story que
       já não é o que ela mandou apagar. */
    if (pausado || quemViu || confirmando || !atual) return;
    const t = setTimeout(() => {
      if (i + 1 < bolha.stories.length) setI(i + 1);
      else aoFechar();
    }, DURACAO_DO_STORY);
    return () => clearTimeout(t);
  }, [i, pausado, quemViu, confirmando, atual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!atual) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      {/* As barrinhas de progresso, uma por story — a assinatura do formato. */}
      <div className="flex gap-1 px-2 pt-2" style={{ paddingTop: "max(0.5rem, var(--safe-top))" }}>
        {bolha.stories.map((s, n) => (
          <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <span
              className="block h-full bg-white"
              style={{
                width: n < i ? "100%" : n === i ? undefined : "0%",
                /* A do ATUAL anima; as passadas ficam cheias e as futuras
                   vazias. `animationPlayState` é o que faz o dedo pausar a
                   barra junto com o relógio — sem isso a barra correria
                   sozinha e chegaria ao fim antes da foto trocar. */
                animation:
                  n === i ? `dc-story-barra ${DURACAO_DO_STORY}ms linear forwards` : undefined,
                animationPlayState: pausado || quemViu || confirmando ? "paused" : "running",
              }}
            />
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <Foto url={bolha.autorAvatar} nome={bolha.autorNome} lado={30} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
          {bolha.autorNome}
        </span>
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="press text-2xl leading-none text-white"
        >
          ×
        </button>
      </div>

      {/* A foto ocupa o resto. `object-contain` e não `cover`: um story é uma
          composição inteira, e cortar as bordas engole texto que a pessoa
          escreveu na foto. */}
      <div className="relative min-h-0 flex-1">
        {atual.imagemUrl && (
          <img src={atual.imagemUrl} alt="" className="h-full w-full object-contain" />
        )}
        {atual.texto && (
          <p className="absolute inset-x-0 bottom-8 px-6 text-center text-[16px] font-medium text-white drop-shadow-lg">
            {atual.texto}
          </p>
        )}

        {/* ⚠️ O carimbo é DERIVADO na leitura, nunca tinta no JPEG: o banco
            guarda só um booleano. Queimado no pixel, ele sobreviveria à decisão
            dela — o arquivo no balde ficaria com "28 semanas" para sempre, e o
            app não teria como apagá-lo se ela entrasse em Modo Cuidado.

            Ele mora ACIMA do texto (`bottom-20` contra `bottom-8`) para os dois
            nunca se sobreporem: os dois são opcionais e podem coexistir.

            ⚠️ E fica ancorado no CONTÊINER, ao contrário da tela de
            conferência: aqui o visor é preto de ponta a ponta e a pílula sobre
            a tarja continua legível — enquanto lá a tarja é a moldura do
            editor, e o carimbo na moldura em vez de na foto era o defeito. */}
        {atual.carimbo && (
          <span className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-[15px] font-semibold text-white backdrop-blur-sm">
            🤰 {atual.carimbo}
          </span>
        )}

        {/* As duas metades invisíveis: esquerda volta, direita avança. Segurar
            pausa. É o gesto do formato, e ele não tem rótulo em lugar nenhum
            porque todo mundo já sabe. */}
        <button
          type="button"
          aria-label="Anterior"
          onPointerDown={() => setPausado(true)}
          onPointerUp={() => {
            setPausado(false);
            if (i > 0) setI(i - 1);
          }}
          onPointerLeave={() => setPausado(false)}
          className="absolute inset-y-0 left-0 w-1/3"
        />
        <button
          type="button"
          aria-label="Próximo"
          onPointerDown={() => setPausado(true)}
          onPointerUp={() => {
            setPausado(false);
            if (i + 1 < bolha.stories.length) setI(i + 1);
            else aoFechar();
          }}
          onPointerLeave={() => setPausado(false)}
          className="absolute inset-y-0 right-0 w-2/3"
        />
      </div>

      {/* ⚠️ O rodapé só existe no MEU story. No modelo é ali que mora "visto
          por" — e é a única recompensa de publicar um: sem ele, publicar um
          story é falar sozinha para uma parede que some em 24 h. */}
      {souEu && atual && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ paddingBottom: "max(0.75rem, var(--safe-bottom))" }}
        >
          {aoQuemViu && (
            <button
              type="button"
              onClick={async () => setQuemViu((await aoQuemViu(atual.id)) ?? [])}
              className="press flex-1 text-left text-[13px] text-white/85"
            >
              👁 Ver quem viu
            </button>
          )}
          {aoApagarStory && (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              aria-label="Apagar story"
              className="press text-[15px] text-white/85"
            >
              🗑
            </button>
          )}
        </div>
      )}

      {confirmando && (
        <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-3xl bg-card p-4">
          <p className="text-[14px] leading-snug">
            Apagar este story? Ele sairia sozinho em 24 horas.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="press flex-1 rounded-xl border border-border py-2 text-[14px]"
            >
              Não
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
                if (atual) aoApagarStory?.(atual.id);
              }}
              className="press flex-1 rounded-xl bg-destructive py-2 text-[14px] font-semibold text-destructive-foreground"
            >
              Sim, apagar
            </button>
          </div>
        </div>
      )}

      {quemViu && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-3xl bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">
              {quemViu.length === 1 ? "1 pessoa viu" : `${quemViu.length} pessoas viram`}
            </h2>
            <button
              type="button"
              onClick={() => setQuemViu(null)}
              aria-label="Fechar"
              className="press text-xl leading-none"
            >
              ×
            </button>
          </div>
          {quemViu.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted-foreground">Ninguém viu ainda.</p>
          ) : (
            <ul className="mt-2">
              {quemViu.map((g) => (
                <li key={g.id} className="flex items-center gap-3 py-2">
                  <Foto url={g.avatarUrl} nome={g.nome} lado={36} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{g.nome}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A ATIVIDADE — a aba do coração
   ══════════════════════════════════════════════════════════════════════════ */

export function TelaDeAtividade({
  itens,
  aoVoltar,
  aoAbrirPerfil,
  aoAbrirPost,
  aoResponder,
}: {
  itens: AtividadeNaTela[];
  aoVoltar: () => void;
  aoAbrirPerfil?: (id: string) => void;
  aoAbrirPost?: (id: string) => void;
  /**
   * Aceitar ou recusar um pedido de seguir, aqui mesmo.
   *
   * ⚠️ É AQUI que o pedido é respondido, e não só nas configurações. O perfil
   * nasce FECHADO (`PERFIL_PUBLICO_PADRAO = false`), então todo seguir vira um
   * pedido — e enquanto a única porta esteve enterrada numa seção de ajustes,
   * a rede inteira ficava parada esperando uma tela que ninguém abria.
   */
  aoResponder?: (seguidorId: string, aceitar: boolean) => void;
}) {
  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Atividade</h1>
      </header>

      {itens.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Quando alguém reagir ou começar a te acompanhar, aparece aqui 💛
        </p>
      ) : (
        <ul>
          {itens.map((a) => (
            <li key={a.id}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  a.visto ? "" : "bg-primary/[0.06]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => aoAbrirPerfil?.(a.quemId)}
                  className="press shrink-0"
                >
                  <Foto url={a.quemAvatar} nome={a.quemNome} lado={40} />
                </button>
                <p className="min-w-0 flex-1 text-[13px] leading-snug">
                  <span className="font-semibold">{a.quemNome}</span>{" "}
                  {/* O texto vem de `textoDoAviso`, a MESMA função que o push
                      usa — duas redações da mesma frase divergiriam, e a
                      paciente leria uma no aviso e outra na tela. */}
                  {textoDoAviso(a.especie, "").trim()}
                </p>
                {/* O pedido AINDA DE PÉ ganha os dois botões; o já respondido
                    vira uma linha comum, sem botão que não faz nada. */}
                {a.especie === "pediu_para_seguir" && a.pendente && aoResponder && (
                  <span className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => aoResponder(a.quemId, false)}
                      className="press rounded-lg border border-border px-2.5 py-1.5 text-[12px]"
                    >
                      Agora não
                    </button>
                    <button
                      type="button"
                      onClick={() => aoResponder(a.quemId, true)}
                      className="press rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-primary-foreground"
                    >
                      Aceitar
                    </button>
                  </span>
                )}
                {a.postCapa && (
                  <button
                    type="button"
                    onClick={() => a.postId && aoAbrirPost?.(a.postId)}
                    className="press shrink-0"
                  >
                    <img src={a.postCapa} alt="" className="h-10 w-10 rounded object-cover" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   NOVA PUBLICAÇÃO — o que o ＋ abre
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Reduz a foto do POST antes de subir.
 *
 * ⚠️ 1080 e não 512, que é o lado do avatar. O avatar aparece num círculo de
 * 44px; a foto do post ocupa a largura inteira da tela, e num iPhone de
 * densidade 3 são ~1180 pixels reais — mandar 512 é entregar uma foto
 * visivelmente mole justamente na peça que a tela existe para mostrar. A
 * qualidade 0,8 mantém o data URL bem abaixo do teto de 1,5 MB do servidor.
 *
 * A proporção é PRESERVADA, ao contrário do avatar: o modelo aceita retrato,
 * paisagem e quadrado, e recortar aqui decidiria pelo enquadramento dela.
 */
const LADO_DA_FOTO = 1080;
async function prepararFotoDoPost(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, LADO_DA_FOTO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/**
 * Reduz a foto do STORY.
 *
 * ⚠️ **Ela subia por `prepararAvatar`** — 512px QUADRADOS, com recorte central.
 * Num formato 9:16 exibido com `object-contain`, isso é duas perdas ao mesmo
 * tempo: a foto perde as pontas de cima e de baixo no recorte, e o que sobra é
 * exibido em 512px numa tela que pede ~1080. A moldura da semana viria carimbar
 * uma foto que já saía errada.
 *
 * Aqui não há recorte: a foto cabe inteira em 1080×1920, preservando a
 * proporção dela — que é o que `object-contain` do visor espera.
 */
const LADO_DO_STORY = { largura: 1080, altura: 1920 };
async function prepararFotoDoStory(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(
      1,
      LADO_DO_STORY.largura / bitmap.width,
      LADO_DO_STORY.altura / bitmap.height,
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

/** Teto de fotos por publicação — o mesmo do servidor (a primeira + nove). */
const FOTOS_POR_POST = 10;

export function NovoPost({
  aoFechar,
  aoPublicar,
  aulaDeHoje,
}: {
  aoFechar: () => void;
  /** Devolve `true` quando publicou. A tela só fecha nesse caso. */
  aoPublicar: (p: {
    texto: string | null;
    fotos: string[];
    visibilidade: Visibilidade;
    enquete: string[];
    aula: AulaNoPost | null;
  }) => Promise<boolean>;
  /**
   * A aula que ela fez hoje, para anexar com um toque.
   *
   * ⚠️ Só o dia e o título chegam aqui: nota, enunciado e gabarito ficam de
   * fora — o primeiro seria um placar público, os outros vazam conteúdo
   * premium e estragam a aula de quem está uma semana atrás.
   */
  aulaDeHoje?: AulaNoPost | null;
}) {
  const [texto, setTexto] = useState("");
  /* Uma LISTA, e a primeira é a capa. Um estado para "a foto" e outro para "as
     outras" divergiria na hora de remover a primeira. */
  const [fotos, setFotos] = useState<string[]>([]);
  /* ⚠️ O padrão é o mais FECHADO. O erro possível aqui é publicar para menos
     gente do que ela queria — nunca para mais. */
  const [vis, setVis] = useState<Visibilidade>("amigas");
  /* `null` = sem enquete. Duas opções vazias é o estado inicial de quem abriu
     a enquete e ainda não escreveu — e não uma enquete inválida na tela. */
  const [opcoes, setOpcoes] = useState<string[] | null>(null);
  const [comAula, setComAula] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const arquivo = useRef<HTMLInputElement>(null);

  /* ⚠️ A régua de "dá para publicar isto?" é a MESMA do servidor
     (`postEhValido`). Uma segunda condição escrita aqui aceitaria o que o
     servidor recusa, e ela levaria um erro depois de escrever o texto. */
  /* ⚠️ A enquete conta como conteúdo — um post que é SÓ a enquete é legítimo
     ("menino ou menina?" não precisa de foto nem de legenda). É a mesma régua
     do servidor, e as duas concordam de propósito. */
  const opcoesLimpas = limparOpcoes(opcoes ?? []);
  const enqueteOk = opcoes === null || enqueteValida(opcoesLimpas);
  const temConteudo =
    postEhValido({ texto, temImagem: fotos.length > 0 }) || opcoesLimpas.length >= OPCOES_MIN;
  const podeEnviar = temConteudo && enqueteOk && !enviando;

  async function enviar() {
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    const ok = await aoPublicar({
      texto: texto.trim() || null,
      fotos,
      visibilidade: vis,
      enquete: opcoes ? opcoesLimpas : [],
      aula: comAula ? (aulaDeHoje ?? null) : null,
    });
    setEnviando(false);
    if (ok) aoFechar();
    else setErro("Não deu para publicar. Tente de novo.");
  }

  return (
    <div>
      {/* A barra de cima com "Compartilhar" à direita é a tela de legenda
          deles, e ela resolve uma coisa: a ação de confirmar mora onde o
          polegar já está, no alto, e não some quando o teclado sobe. */}
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 text-[16px] font-semibold">Nova publicação</h1>
        <button
          type="button"
          onClick={enviar}
          disabled={!podeEnviar}
          className="press text-[14px] font-semibold text-primary disabled:opacity-40"
        >
          {enviando ? "Publicando…" : "Compartilhar"}
        </button>
      </header>

      <div className="px-4">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DO_TEXTO))}
          rows={4}
          placeholder="Escreva uma legenda…"
          className="w-full resize-none rounded-2xl border border-border bg-background px-3 py-2.5 text-[14px] leading-snug"
        />
        {/* O contador só aparece perto do fim: um número piscando a cada letra
            desde a primeira transforma escrever num exercício de caber. */}
        {texto.length > LIMITE_DO_TEXTO - 80 && (
          <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
            {LIMITE_DO_TEXTO - texto.length}
          </p>
        )}

        {fotos.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {fotos.map((f, n) => (
              <div key={n} className="relative shrink-0">
                <img src={f} alt="" className="h-24 w-24 rounded-xl object-cover" />
                {/* A PRIMEIRA leva o selo — sem ele ninguém sabe qual vai
                    aparecer na grade do perfil. */}
                {n === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">
                    capa
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setFotos((fs) => fs.filter((_, k) => k !== n))}
                  aria-label="Tirar esta foto"
                  className="press absolute right-1 top-1 rounded-full bg-black/60 px-1.5 leading-none text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ─── A ENQUETE ────────────────────────────────────────────────── */}
        {opcoes === null ? (
          <button
            type="button"
            onClick={() => setOpcoes(["", ""])}
            className="press mt-3 w-full rounded-xl border border-border py-2 text-[14px] font-medium"
          >
            📊 Fazer uma enquete
          </button>
        ) : (
          <div className="mt-3 rounded-2xl border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">Enquete</p>
              <button
                type="button"
                onClick={() => setOpcoes(null)}
                className="press text-[12px] text-muted-foreground"
              >
                tirar
              </button>
            </div>
            <div className="mt-2 space-y-1.5">
              {opcoes.map((op, i) => (
                <input
                  key={i}
                  value={op}
                  onChange={(e) =>
                    setOpcoes((os) =>
                      (os ?? []).map((o, k) =>
                        k === i ? e.target.value.slice(0, LIMITE_DA_OPCAO) : o,
                      ),
                    )
                  }
                  placeholder={`Opção ${i + 1}`}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[14px]"
                />
              ))}
            </div>
            {opcoes.length < OPCOES_MAX && (
              <button
                type="button"
                onClick={() => setOpcoes((os) => [...(os ?? []), ""])}
                className="press mt-2 text-[13px] font-medium text-primary"
              >
                + opção
              </button>
            )}
            {/* ⚠️ O aviso do voto único aparece ANTES de publicar, e não só
                para quem vota: quem cria a enquete precisa saber que não dá
                para corrigir depois — post não se edita. */}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Cada pessoa vota uma vez, e o voto não muda. Você vê só os números — nunca quem votou
              em quê.
            </p>
            {!enqueteOk && opcoesLimpas.length > 0 && (
              <p className="mt-1 text-[12px] text-destructive">
                {opcoesLimpas.length < OPCOES_MIN
                  ? `Escreva pelo menos ${OPCOES_MIN} opções.`
                  : "As opções precisam ser diferentes entre si."}
              </p>
            )}
          </div>
        )}

        {/* ─── A AULA DE HOJE ───────────────────────────────────────────── */}
        {aulaDeHoje && (
          <button
            type="button"
            onClick={() => setComAula((v) => !v)}
            aria-pressed={comAula}
            className={`press mt-3 w-full rounded-xl border py-2 text-[14px] font-medium ${
              comAula ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            📚 {comAula ? "Aula anexada" : "Anexar a aula de hoje"}
          </button>
        )}

        {/* ⚠️ A camada fica À VISTA, e não atrás de um menu. Escondida, ela
            publica no padrão sem perceber — e num app de gestação a diferença
            entre "as amigas" e "qualquer pessoa" é a diferença entre contar
            uma notícia e publicá-la. */}
        <div className="mt-3">
          <p className="text-[12px] font-medium text-muted-foreground">Quem vai ver</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VISIBILIDADES.map((v) => (
              <button
                key={v.chave}
                type="button"
                onClick={() => setVis(v.chave)}
                className={`press rounded-full px-3 py-1.5 text-[13px] ${
                  vis === v.chave ? "bg-primary/15 font-semibold text-primary" : "bg-muted/60"
                }`}
              >
                {v.rotulo}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
            {VISIBILIDADES.find((v) => v.chave === vis)?.sub}
          </p>
        </div>

        <input
          ref={arquivo}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            /* O teto é conferido AQUI e não só no servidor: recusar o post
               inteiro depois de ela escolher onze fotos é pior que não deixar
               escolher a décima primeira. */
            if (fotos.length >= FOTOS_POR_POST) {
              setErro(`No máximo ${FOTOS_POR_POST} fotos por publicação.`);
              return;
            }
            const d = await prepararFotoDoPost(f);
            if (!d) setErro("Não consegui ler essa imagem.");
            else {
              setErro(null);
              setFotos((fs) => [...fs, d]);
            }
          }}
        />
        <button
          type="button"
          onClick={() => arquivo.current?.click()}
          className="press mt-3 w-full rounded-xl border border-border py-2 text-[14px] font-medium"
        >
          📷 {fotos.length > 0 ? `Adicionar outra (${fotos.length})` : "Adicionar foto"}
        </button>

        {erro && <p className="mt-2 text-[13px] text-destructive">{erro}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   OS SALVOS
   ══════════════════════════════════════════════════════════════════════════ */

/** A grade de três colunas — a mesma do perfil e a dos salvos. */
export function GradeDePosts({
  posts,
  vazio,
  aoAbrirPost,
}: {
  posts: PostNaTela[];
  vazio: string;
  aoAbrirPost?: (id: string) => void;
}) {
  if (posts.length === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">{vazio}</p>;
  }
  return (
    <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: VAO_DA_GRADE }}>
      {posts.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => aoAbrirPost?.(p.id)}
          /* ⚠️ `aspect-ratio` de 3:4, a proporção NOVA da grade. A antiga era
             quadrada, e mudou em 2025 — quem construir 1:1 hoje corta a foto
             vertical, que é a maioria. */
          style={{ aspectRatio: String(RAZAO_DA_GRADE) }}
          className="press relative overflow-hidden bg-muted/60"
        >
          {p.imagemUrl ? (
            <img src={p.imagemUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            /* Post só de texto na grade: mostra o texto, não um buraco. */
            <span className="line-clamp-4 block p-2 text-left text-[11px] leading-snug text-foreground/70">
              {p.texto}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function TelaDosSalvos({
  posts,
  aoVoltar,
  aoAbrirPost,
}: {
  posts: PostNaTela[];
  aoVoltar: () => void;
  aoAbrirPost?: (id: string) => void;
}) {
  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="text-[16px] font-semibold">Salvos</h1>
      </header>
      {/* ⚠️ O texto diz que ninguém vê esta lista, e isso não é enfeite: no
          modelo, "salvo" é a única coleção privada de verdade, e quem não sabe
          disso usa o marcador com o mesmo cuidado de uma curtida pública. */}
      <p className="px-4 pb-2 text-[12px] leading-snug text-muted-foreground">
        Só você vê o que guardou aqui — nem quem publicou fica sabendo.
      </p>
      {/* Sem padding lateral, como a grade do perfil: a célula da grade encosta
          na borda no modelo, e uma das duas com respiro faria a mesma grade
          parecer duas. */}
      <GradeDePosts posts={posts} vazio="Você ainda não guardou nada." aoAbrirPost={aoAbrirPost} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A BUSCA
   ══════════════════════════════════════════════════════════════════════════ */

export function TelaDeBusca({
  aoVoltar,
  aoBuscar,
  aoAbrirPerfil,
}: {
  aoVoltar: () => void;
  aoBuscar: (termo: string) => Promise<PessoaNaLista[]>;
  aoAbrirPerfil?: (id: string) => void;
}) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<PessoaNaLista[]>([]);
  const [buscando, setBuscando] = useState(false);
  /* ⚠️ Descarta resposta ATRASADA: quem digita "ana" dispara três buscas, e a
     de "an" pode voltar depois da de "ana". Mesma trava do `contatoDaPaciente`
     no painel do médico. */
  const daVez = useRef(0);

  useEffect(() => {
    const t = termo.trim();
    if (t.length < MINIMO_DA_BUSCA) {
      setAchados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const meu = ++daVez.current;
    /* Espera meio segundo depois da última tecla: sem isso são cinco idas ao
       servidor para escrever um nome de cinco letras. */
    const id = setTimeout(async () => {
      const r = await aoBuscar(t);
      if (daVez.current !== meu) return;
      setAchados(r);
      setBuscando(false);
    }, 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo]);

  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value.slice(0, 60))}
          placeholder="Buscar"
          autoFocus
          className="h-9 min-w-0 flex-1 rounded-xl bg-muted/60 px-3 text-[14px]"
        />
      </header>

      {termo.trim().length > 0 && termo.trim().length < MINIMO_DA_BUSCA ? (
        <p className="py-10 text-center text-[13px] text-muted-foreground">
          Escreva pelo menos {MINIMO_DA_BUSCA} letras.
        </p>
      ) : buscando ? (
        <div className="space-y-2 px-4 py-3">
          <div className="skeleton h-12 rounded-xl" />
          <div className="skeleton h-12 rounded-xl" />
        </div>
      ) : achados.length === 0 ? (
        /* ⚠️ O vazio EXPLICA, e a explicação é a régua do produto: só quem
           abriu o perfil aparece na busca. Sem isso, procurar a irmã e não
           achar lê como app quebrado — quando na verdade a irmã está protegida
           exatamente como escolheu. */
        <p className="px-6 py-10 text-center text-[13px] leading-snug text-muted-foreground">
          {termo.trim()
            ? "Ninguém com esse nome por aqui. Só aparece na busca quem deixou o perfil público."
            : "Procure por alguém que você já conhece."}
        </p>
      ) : (
        <ul>
          {achados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => aoAbrirPerfil?.(p.id)}
                className="press flex w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <Foto url={p.avatarUrl} nome={p.nome} lado={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-tight">
                    {p.nome}
                  </span>
                  {p.bio && (
                    <span className="block truncate text-[12px] leading-tight text-muted-foreground">
                      {p.bio}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O ESPELHO — "ver como os outros veem"
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A tela que responde "o que aparece de mim para quem?".
 *
 * Pedido do dono: "não podemos expor a paciente sem ela saber". Uma chave de
 * privacidade sem esta tela é uma promessa; com ela, é uma verificação.
 *
 * ⚠️ **As personas são ABSTRATAS.** "Ver como a Marina me vê" seria um
 * verificador de bloqueio e revelaria por tabela quem segue quem — e a lista de
 * seguidores deste app não é pública de propósito.
 *
 * ⚠️ **E o perfil desenhado aqui vem do SERVIDOR, pela mesma função da tela
 * real** (`verPerfil` com `comoVisitante`). Uma prévia montada no navegador
 * afirmaria o que a paciente quer ouvir, e não o que o servidor entrega — que é
 * o único jeito de esta tela ser pior que não existir.
 */
export function EspelhoDoPerfil({
  persona,
  aoTrocarPersona,
  perfil,
  posts,
  trancado,
  carregando,
  aoVoltar,
}: {
  persona: Persona;
  aoTrocarPersona: (p: Persona) => void;
  perfil: PerfilNaTela | null;
  posts: PostNaTela[];
  /** A estranha bateu numa conta fechada. */
  trancado: boolean;
  carregando: boolean;
  aoVoltar: () => void;
}) {
  const escolhida = PERSONAS.find((p) => p.chave === persona);

  return (
    <div>
      <header className="flex h-11 items-center gap-2 px-4">
        <button
          type="button"
          onClick={aoVoltar}
          aria-label="Voltar"
          className="press -ml-1 text-xl"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">Como os outros veem</h1>
      </header>

      <div className="border-b border-border px-4 pb-3">
        <div className="flex gap-1.5">
          {PERSONAS.map((p) => (
            <button
              key={p.chave}
              type="button"
              onClick={() => aoTrocarPersona(p.chave)}
              className={`press flex-1 rounded-xl px-2 py-2 text-[12px] font-semibold ${
                p.chave === persona ? "bg-primary text-primary-foreground" : "bg-muted/60"
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{escolhida?.sub}</p>
      </div>

      {carregando ? (
        <div className="space-y-2 p-4">
          <div className="skeleton h-24 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      ) : trancado ? (
        /* ⚠️ Este é o estado da MAIORIA das pacientes, e não um caso de borda:
            o perfil nasce fechado. Dizer isso em voz alta é a informação mais
            útil que a tela dá — a de que ela não está exposta a ninguém. */
        <div className="px-6 py-16 text-center">
          <p className="text-[15px] font-semibold">Ela não consegue abrir o seu perfil</p>
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            O seu perfil está fechado: só quem você aceitar consegue te acompanhar, e você não
            aparece na busca de quem não te conhece.
          </p>
        </div>
      ) : perfil ? (
        /* A MESMA `TelaDePerfil` da tela real, em modo inerte. Uma segunda
           montagem divergiria dela e passaria a mentir no primeiro conserto. */
        <TelaDePerfil perfil={perfil} posts={posts} somenteLeitura />
      ) : (
        <p className="px-6 py-16 text-center text-[13px] text-muted-foreground">
          Não consegui montar a prévia agora.
        </p>
      )}

      <p className="px-6 pb-8 pt-2 text-center text-[12px] leading-snug text-muted-foreground">
        Nada do seu acompanhamento aparece aqui para ninguém — peso, pressão, exames e consultas são
        só seus e do seu médico.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CONFERIR O STORY ANTES DE PUBLICAR — Fase 3
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A foto, a moldura da semana, e o botão de publicar.
 *
 * ─── POR QUE ELA VÊ ANTES ──────────────────────────────────────────────────
 *
 * Até aqui, escolher a foto PUBLICAVA — sem prévia, sem cancelar, sem nada.
 * Com o carimbo isso deixou de ser aceitável: o app passaria a escrever a
 * semana de gestação dela numa foto que ela nunca viu montada.
 *
 * ⚠️ **O carimbo é uma SOBREPOSIÇÃO, não tinta no JPEG.** Queimado no pixel,
 * ele sobrevive à decisão dela: o arquivo no balde guarda "28 semanas" para
 * sempre, e quem printou fica com a semana. Derivado, ele morre sozinho — a
 * régua cala em Modo Cuidado, depois do parto e sem DUM.
 *
 * ⚠️ **E ele NÃO vem ligado.** Carimbar sozinho porque a chave do perfil está
 * ligada seria o app decidindo o que vai na foto dela.
 */
export function ConferirStory({
  imagem,
  semana,
  aoCancelar,
  aoPublicar,
}: {
  /** Data URL da foto já reduzida. */
  imagem: string;
  /** "28 semanas", ou `null` quando não há o que carimbar. */
  semana: string | null;
  aoCancelar: () => void;
  aoPublicar: (opts: { carimbar: boolean }) => void;
}) {
  const [carimbar, setCarimbar] = useState(false);
  const [enviando, setEnviando] = useState(false);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <header
        className="flex h-12 shrink-0 items-center gap-2 px-4"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <button
          type="button"
          onClick={aoCancelar}
          aria-label="Cancelar"
          className="press text-2xl leading-none text-white"
        >
          ×
        </button>
        <h1 className="min-w-0 flex-1 text-[15px] font-semibold text-white">Seu story</h1>
      </header>

      {/* `object-contain`, como o visor: um story é uma composição inteira, e
          cortar as bordas engole o que a pessoa escreveu na foto. */}
      {/* ⚠️ O carimbo pousa na FOTO, não no contêiner. Com `object-contain` a
          foto não preenche a caixa, e um `absolute bottom-5` no contêiner
          desenhava a pílula na tarja preta abaixo da imagem — a moldura ficava
          fora da moldura. A caixa de dentro encolhe até a foto, e o carimbo se
          posiciona contra ela. */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative max-h-full">
          <img src={imagem} alt="" className="block max-h-full w-auto object-contain" />
          {carimbar && semana && (
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-[15px] font-semibold text-white backdrop-blur-sm">
              🤰 {semana}
            </span>
          )}
        </div>
      </div>

      <div
        className="shrink-0 space-y-3 px-4 pb-4 pt-3"
        style={{ paddingBottom: "max(1rem, var(--safe-bottom))" }}
      >
        {semana ? (
          <button
            type="button"
            role="switch"
            aria-checked={carimbar}
            onClick={() => setCarimbar((v) => !v)}
            className={`press flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left ${
              carimbar ? "bg-white text-black" : "bg-white/12 text-white"
            }`}
          >
            <span className="text-[14px] font-semibold">🤰 {semana}</span>
            <span className="text-[13px] opacity-70">
              {carimbar ? "no story" : "tocar para pôr"}
            </span>
          </button>
        ) : (
          /* Sem semana não há carimbo, e a tela não finge que há: sem DUM,
             depois do parto ou em Modo Cuidado, o controle simplesmente não
             existe. */
          <p className="text-center text-[12px] text-white/60">
            Sem a data da última menstruação no perfil, não dá para carimbar a semana.
          </p>
        )}

        <button
          type="button"
          disabled={enviando}
          onClick={() => {
            setEnviando(true);
            aoPublicar({ carimbar: carimbar && !!semana });
          }}
          className="press w-full rounded-2xl bg-white py-3 text-[15px] font-semibold text-black disabled:opacity-60"
        >
          {enviando ? "Publicando…" : "Publicar story"}
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   O DESAFIO DA SEMANA — Fase 5
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * O convite da criadora, no topo do feed.
 *
 * ⚠️ **Ela ENTRA — não é inscrita.** Agrupar automaticamente por `ref_code`
 * recriaria por fora o grupo compulsório que o código foi tirado do grafo de
 * amizade para não criar, e do qual não haveria como sair.
 *
 * ⚠️ **O contador é NÚMERO, e some abaixo de duas pessoas.** "3 de 300
 * fecharam" diz ao grupo que quase ninguém veio; "1 fechou" é ela mesma se
 * olhando no espelho. E nunca a lista de quem fechou — nem a de quem não.
 *
 * ⚠️ **E o texto não cobra.** É a mesma regra do empurrão da dupla: "você vai
 * perder" é o texto de todo app de streak e aqui cairia numa gestante que pode
 * estar internada.
 */
export function CartaoDoDesafio({
  desafio,
  aoEntrar,
  aoIrParaOJogo,
}: {
  desafio: DesafioNaTela;
  aoEntrar?: (entrar: boolean) => void;
  aoIrParaOJogo?: () => void;
}) {
  const a = ATIVIDADES_DO_DESAFIO.find((x) => x.chave === desafio.atividade);
  const fechei = desafio.meusDias >= desafio.diasAlvo;
  const doGrupo = fraseDoGrupo(desafio.quantasFecharam ?? 0);

  return (
    <section className="-mx-4 mb-2 border-b border-border bg-primary/[0.04] px-4 py-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-primary">
        Desafio da semana
      </p>
      <p className="mt-1 text-[15px] font-semibold leading-snug">
        {a?.emoji} {a?.rotulo} em {desafio.diasAlvo} dias
      </p>
      <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
        {desafio.deQuem} propôs para quem chegou pelo código dela.
      </p>

      {desafio.souParticipante ? (
        <>
          <p className="mt-2 text-[13px]">
            {fechei ? (
              <span className="font-semibold text-primary">Você fechou esta semana 💛</span>
            ) : (
              <>
                Você já fez <strong className="font-semibold">{desafio.meusDias}</strong> de{" "}
                {desafio.diasAlvo} dias.
              </>
            )}
          </p>
          {doGrupo && <p className="mt-0.5 text-[12px] text-muted-foreground">{doGrupo}</p>}
          <div className="mt-2 flex gap-2">
            {!fechei && aoIrParaOJogo && (
              <button
                type="button"
                onClick={aoIrParaOJogo}
                className="press flex-1 rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground"
              >
                Fazer agora
              </button>
            )}
            {aoEntrar && (
              <button
                type="button"
                onClick={() => aoEntrar(false)}
                className="press rounded-xl border border-border px-3 py-2 text-[13px]"
              >
                Sair
              </button>
            )}
          </div>
        </>
      ) : (
        aoEntrar && (
          <button
            type="button"
            onClick={() => aoEntrar(true)}
            className="press mt-2 w-full rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground"
          >
            Entrar no desafio
          </button>
        )
      )}
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   A CAIXINHA — o lado de quem RESPONDE
   ══════════════════════════════════════════════════════════════════════════ */

export type PerguntaNaTela = {
  id: string;
  texto: string;
  criadoEm: string;
  resposta: string | null;
  postId: string | null;
};

/**
 * A caixa dela.
 *
 * ⚠️ **Nenhuma linha tem rosto, nome ou inicial** — e isso não é economia de
 * layout: é o recurso. A caixa ser anônima é o que faz alguém perguntar, e
 * qualquer pista de identidade aqui (uma inicial, uma cor derivada do id, um
 * "há 2 minutos" ao lado de quem acabou de seguir) devolve por dedução o que o
 * servidor recusou devolver por campo.
 *
 * ⚠️ **E a hora é GROSSA de propósito** (`haQuantoPublicou`, que passa a data
 * cheia depois de quatro semanas). Um carimbo de minuto exato numa caixa
 * anônima é o suficiente para cruzar com quem estava online.
 */
export function TelaDaCaixinha({
  perguntas,
  aceita,
  aoVoltar,
  aoAlternarCaixa,
  aoResponder,
  aoArquivar,
  aoDenunciar,
  aoAbrirPost,
}: {
  perguntas: PerguntaNaTela[];
  aceita: boolean;
  aoVoltar?: () => void;
  aoAlternarCaixa?: (aberta: boolean) => void;
  /** Devolve o recado do servidor quando a resposta é recusada, ou `null`. */
  aoResponder?: (id: string, resposta: string, v: Visibilidade) => Promise<string | null>;
  aoArquivar?: (id: string) => void;
  aoDenunciar?: (id: string, bloquear: boolean) => void;
  aoAbrirPost?: (postId: string) => void;
}) {
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [visibilidade, setVisibilidade] = useState<Visibilidade>("seguidores");
  const [recado, setRecado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [denunciando, setDenunciando] = useState<string | null>(null);

  const semResposta = perguntas.filter((p) => !p.resposta);
  const respondidas = perguntas.filter((p) => p.resposta);

  function fecharComposicao() {
    setRespondendo(null);
    setTexto("");
    setRecado(null);
  }

  return (
    <div className="pb-10">
      <header className="flex h-11 items-center gap-2 px-4">
        {aoVoltar && (
          <button
            type="button"
            onClick={aoVoltar}
            aria-label="Voltar"
            className="press -ml-1 text-xl leading-none"
          >
            ‹
          </button>
        )}
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">Caixinha de perguntas</h1>
      </header>

      {/* ⚠️ O interruptor mora AQUI, e não numa tela de ajustes: quem quer
          fechar a caixa está olhando para o que chegou nela. */}
      <div className="mx-4 mt-1 rounded-2xl border border-border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">Aceitar perguntas</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              Quem abre o seu perfil pode te mandar uma pergunta sem se identificar. Você responde
              quando quiser — e a resposta vira uma publicação sua.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={aceita}
            aria-label="Aceitar perguntas"
            onClick={() => aoAlternarCaixa?.(!aceita)}
            className={`press mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
              aceita ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-background transition-transform ${
                aceita ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>
        {/* ⚠️ Fechar a caixa NÃO apaga o que já chegou, e a tela diz isso: sem
            a frase, quem fecha acha que perdeu as perguntas e não fecha. */}
        <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
          Fechando, ninguém manda perguntas novas — as que já chegaram continuam aqui.
        </p>
      </div>

      {perguntas.length === 0 && (
        <p className="mx-4 mt-6 text-center text-[13px] leading-snug text-muted-foreground">
          {aceita
            ? "Nenhuma pergunta ainda. Ela aparece aqui assim que alguém escrever."
            : "A caixinha está fechada. Ligue acima para começar a receber."}
        </p>
      )}

      {semResposta.length > 0 && (
        <>
          <h2 className="mx-4 mt-5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sem resposta
          </h2>
          <ul className="mt-1.5 flex flex-col gap-2 px-4">
            {semResposta.map((p) => (
              <li key={p.id} className="rounded-2xl border border-border p-3">
                <p className="whitespace-pre-wrap text-[14px] leading-snug">{p.texto}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {haQuantoPublicou(p.criadoEm, Date.now())}
                </p>

                {respondendo === p.id ? (
                  <div className="mt-2">
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DO_TEXTO))}
                      rows={3}
                      placeholder="Sua resposta…"
                      aria-label="Sua resposta"
                      className="w-full resize-none rounded-lg border border-border bg-background p-2 text-[14px]"
                    />
                    <div className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                      {texto.length}/{LIMITE_DO_TEXTO}
                    </div>

                    {/* A mesma camada do compositor — a resposta é um post. */}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {VISIBILIDADES.map((v) => (
                        <button
                          key={v.chave}
                          type="button"
                          onClick={() => setVisibilidade(v.chave)}
                          className={`press rounded-full px-2.5 py-1 text-[12px] ${
                            visibilidade === v.chave
                              ? "bg-primary text-primary-foreground"
                              : "border border-border"
                          }`}
                        >
                          {v.rotulo}
                        </button>
                      ))}
                    </div>

                    {/* ⚠️ O recado vem do SERVIDOR e não é reescrito aqui: ele é
                        o único lugar que sabe por que a resposta foi recusada, e
                        um texto local divergiria da régua no primeiro ajuste. */}
                    {recado && (
                      <p className="mt-2 rounded-lg bg-muted/60 p-2 text-[12px] leading-snug">
                        {recado}
                      </p>
                    )}

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={fecharComposicao}
                        className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={!texto.trim() || enviando || !aoResponder}
                        onClick={async () => {
                          if (!aoResponder) return;
                          setEnviando(true);
                          const r = await aoResponder(p.id, texto.trim(), visibilidade);
                          setEnviando(false);
                          /* `null` = publicou. Qualquer string é a recusa, e o
                             texto FICA no campo: ela precisa reescrever, não
                             recomeçar. */
                          if (r) setRecado(r);
                          else fecharComposicao();
                        }}
                        className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {enviando ? "Publicando…" : "Publicar resposta"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        fecharComposicao();
                        setRespondendo(p.id);
                        setMenu(null);
                      }}
                      className="press flex-1 rounded-xl bg-primary py-1.5 text-[13px] font-semibold text-primary-foreground"
                    >
                      Responder
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenu((m) => (m === p.id ? null : p.id))}
                      aria-label="Opções desta pergunta"
                      className="press rounded-xl border border-border px-3 text-[15px] leading-none text-muted-foreground"
                    >
                      ⋯
                    </button>
                  </div>
                )}

                {menu === p.id && denunciando !== p.id && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        aoArquivar?.(p.id);
                      }}
                      className="press flex-1 rounded-xl border border-border py-1.5 text-[13px]"
                    >
                      Tirar da caixa
                    </button>
                    <button
                      type="button"
                      onClick={() => setDenunciando(p.id)}
                      className="press flex-1 rounded-xl border border-border py-1.5 text-[13px] text-destructive"
                    >
                      Denunciar
                    </button>
                  </div>
                )}

                {/* ⚠️ Denunciar e BLOQUEAR moram juntos porque a caixa é
                    anônima: pedir que ela "descubra quem foi e bloqueie no
                    perfil" é pedir o impossível, e sem esta porta a anonimidade
                    viraria impunidade. Ela continua sem saber quem é — a tela
                    não mostra nome nem inicial, nem antes nem depois. */}
                {denunciando === p.id && (
                  <div className="mt-2 rounded-xl bg-muted/60 p-3">
                    <p className="text-[13px] leading-snug">
                      Denunciar esta pergunta? Ela sai da sua caixa e fica registrada para a gente
                      olhar.
                    </p>
                    <div className="mt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDenunciando(null);
                          setMenu(null);
                          aoDenunciar?.(p.id, true);
                        }}
                        className="press w-full rounded-xl bg-destructive py-1.5 text-[13px] font-semibold text-destructive-foreground"
                      >
                        Denunciar e bloquear quem escreveu
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDenunciando(null);
                          setMenu(null);
                          aoDenunciar?.(p.id, false);
                        }}
                        className="press w-full rounded-xl border border-border py-1.5 text-[13px]"
                      >
                        Só denunciar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDenunciando(null)}
                        className="press w-full rounded-xl py-1 text-[13px] text-muted-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {respondidas.length > 0 && (
        <>
          <h2 className="mx-4 mt-6 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Respondidas
          </h2>
          <ul className="mt-1.5 flex flex-col gap-2 px-4">
            {respondidas.map((p) => (
              <li key={p.id} className="rounded-2xl border border-border p-3">
                <p className="whitespace-pre-wrap text-[13px] leading-snug text-muted-foreground">
                  {p.texto}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-snug">{p.resposta}</p>
                {p.postId && aoAbrirPost && (
                  <button
                    type="button"
                    onClick={() => aoAbrirPost(p.postId!)}
                    className="press mt-2 text-[13px] font-medium text-primary"
                  >
                    Ver a publicação
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
