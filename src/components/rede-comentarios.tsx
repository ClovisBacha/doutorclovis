/**
 * OS COMENTÁRIOS, NA TELA.
 *
 * A régua está em `comentarios.ts` e a lei em `comentarios.functions.ts`. Aqui
 * só se desenha — e as decisões de tela que importam são duas:
 *
 * ⚠️ **O RECADO DA RECUSA APARECE INTEIRO, e não vira um "não deu certo".** A
 * régua recusa coisas que a pessoa escreveu com boa intenção (o alarme sobre o
 * bebê é o caso típico); um erro genérico faria ela reescrever igual, ou
 * desistir sem entender. O texto explica o efeito e aponta a saída.
 *
 * ⚠️ **E O TEXTO NÃO É APAGADO NA RECUSA.** Ela acabou de escrever; limpar o
 * campo obriga a redigitar tudo para trocar uma frase.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComentarioNaTela } from "@/lib/comentarios.functions";
import { TextoComLinks, EscolherMotivo } from "@/components/rede-instagram";
import {
  LIMITE_DO_COMENTARIO,
  ORDEM_PADRAO,
  RASCUNHO_MINIMO,
  RESPOSTAS_VISIVEIS,
  chaveDoRascunhoDeComentario,
  ehChaveDeRascunhoDeComentario,
  lerRascunhoGuardado,
  ordenarComentarios,
  serializarRascunho,
} from "@/lib/comentarios";
import type { OrdemDosComentarios } from "@/lib/comentarios";

async function token() {
  const { supabase } = await import("@/integrations/supabase/client");
  const s = await supabase.auth.getSession();
  return s.data.session?.access_token ?? null;
}

export function Comentarios({
  postId,
  aoAbrirPerfil,
  aoAbrirArroba,
  aoAbrirTag,
  bancada,
}: {
  postId: string;
  aoAbrirPerfil?: (id: string) => void;
  /** Abrir o perfil por trás de um `@` do comentário. */
  aoAbrirArroba?: (handle: string) => void;
  /** Abrir a página de uma `#` do comentário. */
  aoAbrirTag?: (tag: string) => void;
  /** Só a bancada preenche — a lista vem do servidor e exige sessão. */
  bancada?: {
    comentarios: ComentarioNaTela[];
    abertos?: boolean;
    souADona?: boolean;
    possoComentar?: boolean;
    quemComenta?: string;
    /** Só a bancada: a lista de quem curtiu vem do servidor. */
    curtidas?: { id: string; nome: string; avatarUrl: string | null }[];
    ordem?: OrdemDosComentarios;
    /** Só a bancada: sem isto o rascunho não teria chave e ficaria invisível. */
    euId?: string;
  };
}) {
  const [lista, setLista] = useState<ComentarioNaTela[]>(bancada?.comentarios ?? []);
  const [abertos, setAbertos] = useState(bancada?.abertos ?? true);
  const [souADona, setSouADona] = useState(bancada?.souADona ?? false);
  /** A que está sendo editada. O campo do rodapé assume o texto dela. */
  const [editando, setEditando] = useState<ComentarioNaTela | null>(null);
  const [curtidasDe, setCurtidasDe] = useState<{
    id: string;
    pessoas: { id: string; nome: string; avatarUrl: string | null }[] | "erro" | null;
  } | null>(null);
  /**
   * ⚠️ **Eu posso comentar? Quem responde é o SERVIDOR.**
   *
   * Uma segunda régua aqui ofereceria o campo e o servidor recusaria DEPOIS de
   * ela ter escrito — é o defeito que "Responder" com os comentários fechados já
   * teve nesta mesma tela.
   */
  const [possoComentar, setPossoComentar] = useState(bancada?.possoComentar ?? true);
  const [quemComenta, setQuemComenta] = useState<string>(bancada?.quemComenta ?? "todos");
  const [texto, setTexto] = useState("");
  const [recado, setRecado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [denunciando, setDenunciando] = useState<string | null>(null);
  /**
   * ⚠️ **A FOLHA DE MOTIVO NASCE NO FIM DA LISTA.** Quem toca no ⋯ do primeiro
   * comentário de dez não vê nada acontecer — o controle fica centenas de
   * pixels abaixo, e a leitura razoável é "o botão não funcionou". Ela toca de
   * novo, e continua nada.
   *
   * Medido na bancada: com dez comentários a folha abre fora da dobra.
   */
  const folhaDeMotivo = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!denunciando) return;
    folhaDeMotivo.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [denunciando]);
  /** Conversas com as respostas todas à mostra. Por raiz. */
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  /**
   * A quem eu estou respondendo.
   *
   * ⚠️ **Guarda a RAIZ e o NOME de quem eu toquei, separados.** A raiz é para
   * onde a resposta vai; o nome é o que aparece na tela ("Respondendo a
   * Marina"). Quando ela responde a uma RESPOSTA, os dois divergem — e sem
   * guardar os dois, ou a resposta vai para a conversa errada, ou a tela diz o
   * nome errado.
   */
  const [respondendo, setRespondendo] = useState<{ raizId: string; nome: string } | null>(null);
  const [ordem, setOrdem] = useState<OrdemDosComentarios>(bancada?.ordem ?? ORDEM_PADRAO);
  /** Quem sou eu, para a chave do rascunho. Sem id, não guarda nada. */
  const [euId, setEuId] = useState<string | null>(bancada?.euId ?? null);
  const campo = useRef<HTMLTextAreaElement | null>(null);

  /**
   * A lista plana vira conversas de UM nível.
   *
   * ⚠️ **A resposta órfã ENTRA como raiz, nunca some.** Se a raiz dela foi
   * apagada (o servidor filtra `apagado_em`) ou escondida por restrição, a
   * resposta continua existindo — e descartá-la faria um comentário gravado
   * desaparecer da tela sem nada explicando. Melhor solta no fim que invisível.
   */
  const conversas = useMemo(() => {
    const raizes = new Map<string, { raiz: ComentarioNaTela; respostas: ComentarioNaTela[] }>();
    for (const c of lista) if (!c.respondeA) raizes.set(c.id, { raiz: c, respostas: [] });
    const orfas: ComentarioNaTela[] = [];
    for (const c of lista) {
      if (!c.respondeA) continue;
      const dona = raizes.get(c.respondeA);
      if (dona) dona.respostas.push(c);
      else orfas.push(c);
    }
    const saida = [...raizes.values()];
    for (const o of orfas) saida.push({ raiz: o, respostas: [] });
    /* A ordem é a do tempo da RAIZ. */
    saida.sort((a, b) => new Date(a.raiz.criadoEm).getTime() - new Date(b.raiz.criadoEm).getTime());

    /**
     * ⚠️ **E O FIXADO SOBE DEPOIS — senão esta ordenação DESFAZ a do servidor.**
     *
     * `comentariosDoPost` já devolve a lista com o fixado na frente, e esta
     * linha reordenava tudo por `criadoEm`, jogando-o de volta ao lugar
     * cronológico: o selo "Fixado" aparecia no meio da conversa, e o recurso
     * inteiro não funcionava. Foi a FOTO da bancada que pegou — nenhuma
     * asserção estava perto disso, porque cada metade estava certa sozinha.
     *
     * ⚠️ E quem sobe é a MESMA régua do servidor, nunca um comparador próprio:
     * é ela que garante que uma resposta com `fixadoEm` (gravado por uma versão
     * anterior, ou por um pedido montado à mão) NÃO seja arrancada da conversa.
     * Aplicá-la duas vezes é inofensivo — ela é idempotente.
     */
    /**
     * ⚠️ **E A ORDEM ESCOLHIDA ENTRA AQUI, senão o `sort` acima a DESFAZ.**
     *
     * Esta linha ordenava as raízes por `criadoEm` de forma incondicional. Com
     * o servidor devolvendo "mais curtidos", o componente reordenava tudo de
     * volta por tempo assim que pintava: o seletor mudaria de cor e a lista
     * ficaria idêntica — um controle que promete e não faz nada. Foi LER a
     * cadeia inteira que pegou; nenhuma asserção estava perto disso, porque
     * cada metade estava certa sozinha.
     *
     * Em "recentes" o comportamento é byte a byte o de antes: a régua só levanta
     * o fixado e preserva a ordem que o `sort` de tempo acabou de estabelecer.
     */
    const porId = new Map(saida.map((x) => [x.raiz.id, x]));
    return ordenarComentarios(
      saida.map((x) => x.raiz),
      ordem,
    ).map((r) => porId.get(r.id)!);
  }, [lista, ordem]);

  function responderA(alvo: ComentarioNaTela, raiz?: ComentarioNaTela) {
    setRespondendo({ raizId: (raiz ?? alvo).id, nome: alvo.autorNome });
    /* ⚠️ Foco no campo: sem isto, tocar em "Responder" muda um rótulo pequeno
       no rodapé e mais nada — ela toca de novo achando que não pegou. */
    campo.current?.focus();
  }

  /**
   * O CORAÇÃO — pinta na hora, e desfaz se o servidor recusar.
   *
   * ⚠️ **Pintar ANTES é obrigatório num gesto de um toque.** Esperar a rede
   * deixaria o coração inerte por meio segundo, e ela tocaria de novo — o que
   * mandaria "descurtir" logo depois de "curtir".
   */
  async function curtir(c: ComentarioNaTela) {
    const alvo = !c.euCurti;
    setLista((atual) =>
      atual.map((x) =>
        x.id === c.id
          ? { ...x, euCurti: alvo, curtidas: Math.max(0, (x.curtidas ?? 0) + (alvo ? 1 : -1)) }
          : x,
      ),
    );
    try {
      const t = await token();
      if (!t) return;
      const { curtirComentario } = await import("@/lib/comentarios.functions");
      const r = await curtirComentario({
        data: { accessToken: t, comentarioId: c.id, curtir: alvo },
      });
      if (!r.ok) throw new Error("recusado");
    } catch {
      setLista((atual) =>
        atual.map((x) =>
          x.id === c.id
            ? { ...x, euCurti: !alvo, curtidas: Math.max(0, (x.curtidas ?? 0) + (alvo ? -1 : 1)) }
            : x,
        ),
      );
      setRecado("Não deu para curtir agora.");
    }
  }

  /**
   * FIXAR — pinta na hora, e desfaz se o servidor recusar.
   *
   * ⚠️ **UM SÓ, e a tela desfixa o outro junto.** O servidor já desfixa o
   * anterior no mesmo pedido; se a tela não fizesse o mesmo, ela veria DOIS
   * "Fixado" até a próxima abertura — a tela contradizendo a regra que o
   * próprio app acabou de aplicar.
   */
  async function fixar(c: ComentarioNaTela) {
    const ligar = !c.fixadoEm;
    const agora = new Date().toISOString();
    setLista((atual) =>
      atual.map((x) => ({
        ...x,
        fixadoEm: x.id === c.id ? (ligar ? agora : null) : ligar ? null : x.fixadoEm,
      })),
    );
    try {
      const t = await token();
      if (!t) return;
      const { fixarComentario } = await import("@/lib/comentarios.functions");
      const r = await fixarComentario({
        data: { accessToken: t, comentarioId: c.id, fixar: ligar },
      });
      if (!r.ok) throw new Error("recusado");
      /* ⚠️ Relê: a ORDEM é do servidor, e a pintura otimista só mexeu no selo.
         Sem isto o comentário fixado só subiria ao topo na próxima abertura. */
      void carregar();
    } catch {
      setLista((atual) =>
        atual.map((x) => (x.id === c.id ? { ...x, fixadoEm: c.fixadoEm ?? null } : x)),
      );
      setRecado("Não deu para fixar agora.");
    }
  }

  /**
   * EDITAR — e o campo do rodapé vira o campo de edição.
   *
   * ⚠️ **UM CAMPO SÓ, e não um segundo dentro da linha.** Um `textarea` no meio
   * da lista empurraria a conversa inteira para baixo e, num celular, o teclado
   * cobriria justamente a linha que ela está corrigindo. O rodapé já é o lugar
   * onde ela escreve, já tem o contador e já sobe com o teclado.
   */
  async function salvarEdicao() {
    const alvo = editando;
    if (!alvo) return;
    const novo = texto.trim();
    if (!novo || novo === alvo.texto) {
      setEditando(null);
      setTexto("");
      return;
    }
    setEnviando(true);
    try {
      const t = await token();
      if (!t) return;
      const { editarComentario } = await import("@/lib/comentarios.functions");
      const r = await editarComentario({
        data: { accessToken: t, comentarioId: alvo.id, texto: novo },
      });
      if (!r.ok) {
        /* ⚠️ **O TEXTO NÃO É APAGADO NA RECUSA** — ela acabou de escrever, e
           limpar o campo obriga a redigitar tudo para trocar uma frase. É a
           mesma decisão que o `comentar` já tinha. */
        setRecado(("recado" in r && r.recado) || "Não deu para salvar agora. Tente de novo.");
        return;
      }
      /* Pinta na hora: o servidor já aceitou. O selo só aparece quando o banco
         soube guardá-lo — `semSelo` diz que a edição valeu e o carimbo não. */
      setLista((atual) =>
        atual.map((x) =>
          x.id === alvo.id
            ? { ...x, texto: novo, editadoEm: r.semSelo ? null : new Date().toISOString() }
            : x,
        ),
      );
      setEditando(null);
      setTexto("");
      setRecado(null);
    } catch {
      setRecado("Não deu para salvar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function verCurtidas(c: ComentarioNaTela) {
    setCurtidasDe({ id: c.id, pessoas: null });
    /* ⚠️ Sem isto a bancada trava em "Carregando…" para sempre: a lista vem do
       servidor e exige sessão, e "carregando" é o único estado que ela NÃO
       precisava provar. */
    if (bancada) {
      setCurtidasDe({ id: c.id, pessoas: bancada.curtidas ?? [] });
      return;
    }
    try {
      const t = await token();
      if (!t) return;
      const { quemCurtiuComentario } = await import("@/lib/comentarios.functions");
      const r = await quemCurtiuComentario({ data: { accessToken: t, comentarioId: c.id } });
      /* ⚠️ "Ninguém curtiu" sobre um comentário com o número do lado é a tela se
         contradizendo — falha vira `"erro"`, e nunca lista vazia. */
      setCurtidasDe({ id: c.id, pessoas: r.ok ? r.pessoas : "erro" });
    } catch {
      setCurtidasDe({ id: c.id, pessoas: "erro" });
    }
  }

  const carregar = useCallback(async () => {
    if (bancada) return;
    try {
      const t = await token();
      if (!t) return;
      const { comentariosDoPost } = await import("@/lib/comentarios.functions");
      const r = await comentariosDoPost({ data: { accessToken: t, postId, ordem } });
      if (r.ok) {
        setLista(r.comentarios);
        setAbertos(r.abertos);
        if ("possoComentar" in r) setPossoComentar(r.possoComentar);
        if ("quemComenta" in r) setQuemComenta(r.quemComenta);
        setSouADona(r.souADona);
        setIndisponivel(false);
      } else {
        /* ⚠️ **"NÃO CARREGOU" NÃO PODE TER A CARA DE "NÃO HÁ COMENTÁRIOS".**
           São a mesma imagem e conclusões opostas — e enquanto o SQL não roda,
           é este o estado de todo post. Sem a distinção, a paciente comentaria
           no vazio achando que o dela sumiu. */
        setIndisponivel(true);
      }
    } catch {
      /* A lista fica com o que já tinha. */
    }
  }, [bancada, postId, ordem]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /* ⚠️ **A CHAVE PRECISA DE QUEM EU SOU, e por isso resolvo o id aqui.** O
     aparelho é compartilhado: sem o id da conta, o comentário que a mãe começou
     a escrever reabriria para a filha que usa o mesmo celular. */
  useEffect(() => {
    if (bancada) return;
    let vivo = true;
    void (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const u = await supabase.auth.getUser();
      if (vivo) setEuId(u.data.user?.id ?? null);
    })();
    return () => {
      vivo = false;
    };
  }, [bancada]);

  /* ⚠️ **OFERECE, NUNCA PREENCHE POR CIMA.** Se ela já começou a digitar antes
     de o id resolver, o rascunho guardado não pode apagar o que está na tela —
     é a mesma decisão do rascunho do post. E o modo edição fica de fora: ali o
     campo já carrega o comentário que ela está corrigindo. */
  const rascunhoLido = useRef(false);
  useEffect(() => {
    /* ⚠️ **A BANCADA NÃO É EXCLUÍDA AQUI, de propósito.** O rascunho é uma
       leitura do storage local — não pede sessão nem servidor —, e com o
       `bancada ||` na guarda a bancada mostrava SEMPRE o campo vazio: o único
       estado que ela não precisava provar. A chave carrega o id da conta, e o
       da bancada ("bancada") nunca colide com um uuid de verdade. */
    if (!euId || rascunhoLido.current) return;
    rascunhoLido.current = true;
    try {
      const agora = new Date();
      const guardado = lerRascunhoGuardado(
        localStorage.getItem(chaveDoRascunhoDeComentario(euId, postId)),
        agora,
      );
      if (guardado && !texto.trim()) setTexto(guardado);
      /* ⚠️ **A VARREDURA VIVE AQUI porque é o único momento em que já estamos
         no armazenamento.** Sem ela, cada publicação em que ela começou a
         escrever e desistiu deixa uma chave para sempre — e o que quebra quando
         a cota estoura é a PRÓXIMA gravação de qualquer coisa, inclusive o
         `journey_state`. Ler `localStorage.key(i)` de trás para a frente é o que
         permite remover durante o laço sem pular índice. */
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k || !ehChaveDeRascunhoDeComentario(k)) continue;
        if (lerRascunhoGuardado(localStorage.getItem(k), agora) === null)
          localStorage.removeItem(k);
      }
    } catch {
      /* Sem storage (aba anônima, cota estourada): segue sem rascunho. */
    }
  }, [bancada, euId, postId, texto]);

  useEffect(() => {
    if (!euId || editando) return;
    const chave = chaveDoRascunhoDeComentario(euId, postId);
    const t = setTimeout(() => {
      try {
        if (texto.trim().length >= RASCUNHO_MINIMO)
          localStorage.setItem(chave, serializarRascunho(texto, new Date()));
        else localStorage.removeItem(chave);
      } catch {
        /* Cota estourada: perder o rascunho é melhor que derrubar a tela. */
      }
    }, 700);
    return () => clearTimeout(t);
  }, [bancada, euId, postId, texto, editando]);

  /**
   * ⚠️ **APAGA ANTES DE LIMPAR O CAMPO, nunca depois.** O efeito acima tem 700ms
   * de atraso: limpando o campo primeiro, ele ainda regravaria — e como o texto
   * já teria ido embora, o que ficaria guardado seria o comentário RECÉM
   * PUBLICADO, reaparecendo na próxima abertura do post. Mesmo defeito que o
   * rascunho do post pagou.
   */
  const esquecerRascunho = useCallback(() => {
    if (!euId) return;
    try {
      localStorage.removeItem(chaveDoRascunhoDeComentario(euId, postId));
    } catch {
      /* Nada a fazer. */
    }
  }, [euId, postId]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setRecado(null);
    try {
      const tk = await token();
      if (!tk) return;
      const { comentar } = await import("@/lib/comentarios.functions");
      const r = await comentar({
        data: { accessToken: tk, postId, texto: t, respondeA: respondendo?.raizId },
      });
      if (r.ok) {
        esquecerRascunho();
        setTexto("");
        /* ⚠️ **Sai do modo resposta DEPOIS de enviar.** Deixando ligado, a
           mensagem seguinte iria para a mesma conversa sem ela perceber — e a
           conversa de alguém acumularia respostas que eram para o post. */
        setRespondendo(null);
        /* A conversa que acabou de receber resposta abre inteira: senão a
           resposta dela pode nascer escondida atrás de "ver mais". */
        if (respondendo) setAbertas((a) => ({ ...a, [respondendo.raizId]: true }));
        await carregar();
      } else {
        /* ⚠️ O recado da RÉGUA quando existe — ele é o que ensina. O genérico
           só entra quando o servidor não mandou nenhum. */
        setRecado(
          ("recado" in r && r.recado) ||
            (r.motivo === "fechados"
              ? "Os comentários deste post estão fechados."
              : r.motivo === "muitos"
                ? "Muitos comentários hoje. Tente amanhã."
                : r.motivo === "alvo_invalido"
                  ? "Esse comentário não está mais aqui."
                  : r.motivo === "sem_suporte"
                    ? "Responder ainda não está pronto no servidor."
                    : "Não deu para comentar agora."),
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(id: string) {
    setApagando(null);
    try {
      const t = await token();
      if (!t) return;
      const { apagarComentario } = await import("@/lib/comentarios.functions");
      const r = await apagarComentario({ data: { accessToken: t, id } });
      if (r.ok) await carregar();
      else setRecado("Não deu para apagar agora.");
    } catch {
      setRecado("Não deu para apagar agora.");
    }
  }

  async function denunciar(id: string, motivo: string) {
    setDenunciando(null);
    try {
      const t = await token();
      if (!t) return;
      const { denunciarComentario } = await import("@/lib/comentarios.functions");
      await denunciarComentario({ data: { accessToken: t, id, motivo } });
      /* ⚠️ O mesmo recado tenha dado certo ou não: dizer "não deu para
         denunciar" ensina que a denúncia pode falhar, e quem denuncia um
         comentário duro não precisa dessa dúvida. A linha fica marcada de
         qualquer jeito na próxima tentativa. */
      setRecado("Denunciado. A gente vai olhar.");
    } catch {
      setRecado("Denunciado. A gente vai olhar.");
    }
  }

  async function trocarAbertura() {
    try {
      const t = await token();
      if (!t) return;
      const { fecharComentarios } = await import("@/lib/comentarios.functions");
      const r = await fecharComentarios({ data: { accessToken: t, postId, abertos: !abertos } });
      /* Só repinta com a confirmação: dizer "fechado" sobre uma recusa deixaria
         a tela prometendo um silêncio que não existe. */
      if (r.ok) setAbertos((v) => !v);
    } catch {
      /* silencioso: nada mudou na tela */
    }
  }

  return (
    <section className="px-4 pb-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">
          {lista.length === 0
            ? "Comentários"
            : `${lista.length} ${lista.length === 1 ? "comentário" : "comentários"}`}
        </h3>
        {/* ⚠️ FECHAR É DA DONA, e é a saída que evita o apagar constante — o
            post sobre uma perda é exatamente onde ela precisa dela. */}
        {souADona && (
          <button
            type="button"
            onClick={() => void trocarAbertura()}
            /* ⚠️ 44px de ALTURA sem inchar o cabeçalho. Medido: 118×19. Um
               `min-h-[44px]` aqui empurraria o "8 comentários" ao lado, então o
               `after` estende só a área do dedo — a mesma solução do × da
               linha, e pelo mesmo motivo. */
            className="press relative text-xs text-muted-foreground after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-['']"
          >
            {abertos ? "Fechar comentários" : "Reabrir comentários"}
          </button>
        )}
      </div>

      {/* ⚠️ **O SELETOR SÓ APARECE COM CONVERSA PARA ORDENAR.** Num post com
          dois comentários as duas ordens são a mesma lista, e um controle que
          não muda nada ensina que os controles desta tela não valem — a mesma
          régua do "Hoje eu não desço ao chão" da aba de exercícios, que só
          aparece quando há chão a tirar. */}
      {lista.length >= 3 && (
        <div className="mb-2 flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Ordenar por</span>
          {(
            [
              ["recentes", "mais recentes"],
              ["relevantes", "mais curtidos"],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setOrdem(valor)}
              aria-pressed={ordem === valor}
              /* 44px de alvo sem inchar a linha, como o "Fechar comentários". */
              className={`press relative rounded-full px-2 py-1 after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[''] ${
                ordem === valor ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}

      {conversas.map(({ raiz, respostas }) => (
        <div key={raiz.id}>
          <Linha
            c={raiz}
            aoAbrirPerfil={aoAbrirPerfil}
            aoApagar={setApagando}
            aoDenunciar={setDenunciando}
            aoCurtir={curtir}
            aoAbrirArroba={aoAbrirArroba}
            aoAbrirTag={aoAbrirTag}
            /* ⚠️ **COM OS COMENTÁRIOS FECHADOS, "Responder" NÃO EXISTE.** A dona
               pode fechar a qualquer momento, e o botão continuava em toda
               linha: tocar nele abria o modo resposta, ela escrevia, e o
               servidor recusava com "os comentários deste post estão fechados"
               — depois de ela ter escrito. Botão que promete e não cumpre. */
            aoResponder={abertos ? () => responderA(raiz) : undefined}
            aoFixar={raiz.possoFixar ? () => void fixar(raiz) : undefined}
            aoVerCurtidas={raiz.souOAutor ? () => void verCurtidas(raiz) : undefined}
            aoEditar={
              raiz.souOAutor
                ? () => {
                    setRespondendo(null);
                    setEditando(raiz);
                    setTexto(raiz.texto);
                    campo.current?.focus();
                  }
                : undefined
            }
          />

          {/* ⚠️ **AS RESPOSTAS RECOLHEM DEPOIS DE TRÊS.** Uma conversa de vinte
              empurraria os OUTROS comentários para fora da tela — e num post
              sobre um susto, a resposta que importa costuma ser a da autora, no
              meio delas. */}
          {respostas.slice(0, abertas[raiz.id] ? respostas.length : RESPOSTAS_VISIVEIS).map((r) => (
            <div key={r.id} className="ml-9">
              <Linha
                c={r}
                aoAbrirPerfil={aoAbrirPerfil}
                aoApagar={setApagando}
                aoDenunciar={setDenunciando}
                aoCurtir={curtir}
                aoAbrirArroba={aoAbrirArroba}
                aoAbrirTag={aoAbrirTag}
                /* ⚠️ Responder a uma RESPOSTA cai na mesma conversa — a raiz é
                   sempre a mesma. É o que mantém um nível só. Ver
                   `raizDoComentario`. */
                aoResponder={abertos ? () => responderA(r, raiz) : undefined}
                /* ⚠️ Resposta NÃO se fixa — a régua do servidor recusa, e
                   oferecer aqui seria um botão que promete e não cumpre. */
                aoVerCurtidas={r.souOAutor ? () => void verCurtidas(r) : undefined}
                aoEditar={
                  r.souOAutor
                    ? () => {
                        setRespondendo(null);
                        setEditando(r);
                        setTexto(r.texto);
                        campo.current?.focus();
                      }
                    : undefined
                }
              />
            </div>
          ))}

          {respostas.length > RESPOSTAS_VISIVEIS && !abertas[raiz.id] && (
            <button
              type="button"
              onClick={() => setAbertas((a) => ({ ...a, [raiz.id]: true }))}
              className="press ml-9 mt-1 min-h-[44px] text-xs font-medium text-muted-foreground"
            >
              Ver mais {respostas.length - RESPOSTAS_VISIVEIS}{" "}
              {respostas.length - RESPOSTAS_VISIVEIS === 1 ? "resposta" : "respostas"}
            </button>
          )}
        </div>
      ))}

      {/* ⚠️ Confirmação em MENSAGEM SEPARADA, nunca o × virando "tem certeza?" —
          a mesma decisão do cancelar consulta e do apagar mensagem. */}
      {/* ⚠️ **QUEM CURTIU É SÓ DE QUEM ESCREVEU** — ver `quemCurtiuComentario`.
          A lista não vai para a dona do post: a conversa embaixo das fotos dela
          viraria um painel de quem apoia quem. */}
      {curtidasDe && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold">Quem curtiu</p>
            <button
              type="button"
              onClick={() => setCurtidasDe(null)}
              className="press -m-2 flex h-11 w-11 items-center justify-center text-[13px] text-muted-foreground"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
          {curtidasDe.pessoas === null ? (
            <p className="mt-1 text-xs text-muted-foreground">Carregando…</p>
          ) : curtidasDe.pessoas === "erro" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Não deu para carregar agora. Tente de novo.
            </p>
          ) : curtidasDe.pessoas.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Ninguém ainda.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {curtidasDe.pessoas.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => aoAbrirPerfil?.(p.id)}
                    className="press flex min-h-[44px] w-full items-center gap-2 text-left"
                  >
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {(p.nome.trim()[0] ?? "?").toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px]">{p.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {apagando && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <p className="text-[13px]">Apagar este comentário?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void apagar(apagando)}
              className="press rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground"
            >
              Apagar
            </button>
            <button
              type="button"
              onClick={() => setApagando(null)}
              className="press rounded-full border border-border px-3 py-1 text-xs"
            >
              Manter
            </button>
          </div>
        </div>
      )}

      {denunciando && (
        /* ⚠️ **A MESMA `EscolherMotivo` das outras três portas**, e não um
           Sim/Não próprio: o motivo é o que ORDENA a fila da plataforma, e uma
           denúncia sem ele chega lá sem dizer do que se trata. Duas folhas de
           denúncia divergiriam no primeiro ajuste de catálogo. */
        <div className="mt-3" ref={folhaDeMotivo}>
          <EscolherMotivo
            titulo="Por que você está denunciando este comentário?"
            aviso="A gente vai olhar, e quem escreveu não é avisada. Você também pode bloquear essa pessoa no perfil dela."
            aoCancelar={() => setDenunciando(null)}
            aoEnviar={(m) => void denunciar(denunciando, m)}
          />
        </div>
      )}

      {indisponivel ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Não consegui carregar os comentários agora.
        </p>
      ) : !abertos ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Os comentários deste post estão fechados.
        </p>
      ) : !possoComentar ? (
        /* ⚠️ **DIZ O MOTIVO, e não só "você não pode".** Sem o motivo ela
            conclui que o app quebrou, ou que foi bloqueada — que é uma
            conclusão bem pior e sobre outra coisa. E a lista continua VISÍVEL:
            quem pode ver a publicação continua podendo ler a conversa; o que
            muda é quem escreve. */
        <p className="mt-3 text-xs leading-snug text-muted-foreground">
          {quemComenta === "amigas"
            ? "Só as amigas dela podem comentar nesta publicação."
            : "Só quem ela acompanha pode comentar nesta publicação."}
        </p>
      ) : (
        <>
          {/* ⚠️ **A TELA DIZ A QUEM ELA RESPONDE, com saída.** Sem esta linha,
              tocar em "Responder" muda um estado invisível: ela escreve achando
              que comenta no post, e o texto nasce dentro da conversa de outra
              pessoa. E sem o ×, sair do modo exigiria enviar. */}
          {/* ⚠️ **EDITANDO VENCE RESPONDENDO** — os dois usam o MESMO campo, e
              desenhar as duas faixas juntas diria que ela está fazendo as duas
              coisas. Entrar no modo edição limpa a resposta pendente. */}
          {editando && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                Editando o seu comentário
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditando(null);
                  setTexto("");
                }}
                aria-label="Cancelar edição"
                className="press flex h-11 w-11 shrink-0 items-center justify-center text-[13px] text-muted-foreground"
              >
                ×
              </button>
            </div>
          )}
          {respondendo && !editando && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                Respondendo a {respondendo.nome}
              </span>
              <button
                type="button"
                onClick={() => setRespondendo(null)}
                aria-label="Cancelar resposta"
                className="press flex h-11 w-11 shrink-0 items-center justify-center text-[13px] text-muted-foreground"
              >
                ×
              </button>
            </div>
          )}
          <div className="mt-3 flex items-end gap-2">
            <textarea
              ref={campo}
              value={texto}
              onChange={(e) => setTexto(e.target.value.slice(0, LIMITE_DO_COMENTARIO))}
              rows={1}
              placeholder={editando ? "Corrija o seu comentário…" : "Escreva um comentário…"}
              className="max-h-24 min-h-[36px] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[13px]"
            />
            <button
              type="button"
              onClick={() => void (editando ? salvarEdicao() : enviar())}
              disabled={!texto.trim() || enviando}
              className="press h-11 shrink-0 rounded-full px-3 text-[13px] font-semibold text-primary disabled:opacity-40"
            >
              {editando ? "Salvar" : "Publicar"}
            </button>
          </div>
          {recado && (
            <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs leading-snug">{recado}</p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * UMA LINHA DE COMENTÁRIO — raiz ou resposta, o mesmo desenho.
 *
 * ⚠️ **UM componente para os dois, e não dois.** A diferença entre raiz e
 * resposta é o recuo de 36px do pai — tudo o mais (avatar, nome, coração,
 * responder, apagar) é igual. Duas cópias divergiriam no primeiro ajuste, e a
 * divergência apareceria como a resposta perdendo um botão que a raiz tem.
 */
function Linha({
  c,
  aoAbrirPerfil,
  aoApagar,
  aoDenunciar,
  aoCurtir,
  aoAbrirArroba,
  aoAbrirTag,
  aoResponder,
  aoFixar,
  aoEditar,
  aoVerCurtidas,
}: {
  c: ComentarioNaTela;
  aoAbrirPerfil?: (id: string) => void;
  aoApagar: (id: string) => void;
  aoDenunciar: (id: string) => void;
  aoCurtir: (c: ComentarioNaTela) => void;
  /** Abrir o perfil por trás de um `@`. Sem a prop, o `@` fica texto. */
  aoAbrirArroba?: (handle: string) => void;
  /** Abrir a página de uma `#`. Sem a prop, a tag fica texto. */
  aoAbrirTag?: (tag: string) => void;
  /** `undefined` = não oferece responder (comentários fechados). */
  aoResponder?: () => void;
  /** `undefined` = não é minha publicação, ou este não pode ser fixado. */
  aoFixar?: () => void;
  /** `undefined` = o comentário não é meu. */
  aoEditar?: () => void;
  /** `undefined` = o comentário não é meu, ou ninguém curtiu ainda. */
  aoVerCurtidas?: () => void;
}) {
  /* ⚠️ Estado LOCAL e por linha: revelar um comentário recolhido não pode
     revelar os outros, e a escolha não sobrevive ao fechamento da folha — ela
     escondeu aquela palavra de propósito. */
  const [revelado, setRevelado] = useState(false);
  const oculto = !!c.recolhido && !revelado;

  return (
    <div className="mt-2.5 flex items-start gap-2">
      <button
        type="button"
        onClick={() => aoAbrirPerfil?.(c.autorId)}
        /* ⚠️ A bolinha desenha 28px e era o alvo inteiro. Ela abre o PERFIL de
           outra pessoa — errar por 8px numa lista de seis linhas abre o perfil
           errado. O `after` leva a área a 44 sem mexer no desenho da conversa. */
        className="press relative shrink-0 after:absolute after:-inset-2 after:content-['']"
        aria-label={`Abrir perfil de ${c.autorNome}`}
      >
        {c.autorAvatar ? (
          <img src={c.autorAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {(c.autorNome.trim()[0] ?? "?").toUpperCase()}
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        {/* ⚠️ **O SELO DE FIXADO É PARA TODO MUNDO, e o pino é DESENHADO.** Sem
            ele, o comentário fixado parece só o mais antigo da lista — e quem
            responde a ele não entende por que ele está no topo. 📌 tem cor
            própria em cada sistema, a mesma lição do 📞 e da estrela do
            destaque. */}
        {!!c.fixadoEm && !oculto && (
          <span className="mb-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden>
              <path d="M14 2l8 8-3 1-3.5 3.5L14 22l-4-6-6-4 7.5-1.5L15 7l-1-5z" />
            </svg>
            Fixado
          </span>
        )}
        {/* ⚠️ **RECOLHIDO É O TEXTO FORA DA TELA, não o texto com um aviso.**
            Um filtro que entrega a palavra e avisa embaixo que ela devia estar
            escondida já falhou: ela leu. Aqui a dona vê que existe um
            comentário e decide abrir — e o nome também fica de fora, porque
            "Fulana escreveu algo que você escondeu" já é metade do recado. */}
        {oculto ? (
          <button
            type="button"
            onClick={() => setRevelado(true)}
            className="press min-h-[44px] text-left text-[13px] italic leading-snug text-muted-foreground"
          >
            {c.oculto === "restrito"
              ? "Comentário de alguém que você restringiu."
              : "Comentário escondido pelo seu filtro de palavras."}{" "}
            <span className="font-medium not-italic underline">Ver mesmo assim</span>
          </button>
        ) : (
          <p className="text-[13px] leading-snug">
            <span className="font-semibold">{c.autorNome}</span>{" "}
            {/* ⚠️ **O `@` VIRA LINK AQUI TAMBÉM.** O servidor já avisava a
                mencionada desde o primeiro dia (`avisarMencionadas` roda em
                `comentar`), mas na tela o `@fulana` continuava texto cru — no
                lugar onde a menção é MAIS usada. Metade do recurso funcionava e
                a outra metade não tinha como ser tocada. */}
            <span className="break-words">
              <TextoComLinks
                texto={c.texto}
                aoAbrirArroba={aoAbrirArroba}
                aoAbrirTag={aoAbrirTag}
              />
            </span>
            {/* ⚠️ **O SELO DE EDITADO NÃO É ENFEITE.** Quem respondeu respondeu
                ao texto que estava lá; sem ele, uma edição posterior faz as
                respostas parecerem sem sentido — ou faz a autora parecer ter
                dito uma coisa que ninguém leu. */}
            {c.editadoEm && <span className="ml-1 text-xs text-muted-foreground">· editado</span>}
          </p>
        )}

        {/* ⚠️ **A MARCA SÓ APARECE PARA A DONA DO POST**, e é o servidor que
            decide (`verDoComentario`). Quem foi restringida nunca recebe este
            campo preenchido no comentário dela — é esse silêncio que separa
            restringir de bloquear. */}
        {/* ⚠️ **A ETIQUETA SÓ VALE COM O TEXTO À MOSTRA.** Desenhada junto da
            linha recolhida ela dizia a mesma coisa duas vezes — "escondido pelo
            seu filtro" dentro do botão e de novo embaixo dele. Depois de
            revelar, ela é a única coisa que lembra por que aquilo estava
            escondido, e aí precisa estar. Foi o olhar na bancada que pegou;
            nenhuma asserção estava perto disso. */}
        {c.oculto && !oculto && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c.oculto === "restrito"
              ? "Só você e quem escreveu veem este comentário."
              : "Escondido pelo seu filtro de palavras."}
          </p>
        )}

        {/* ⚠️ **RECOLHIDO NÃO OFERECE AÇÃO NENHUMA.** Curtir e responder um
            comentário cujo texto ela escolheu não ler é pedir uma decisão sobre
            o que ela não viu — e o ♡ ficaria ao lado de uma linha que diz
            "escondido". Revelou, as ações voltam inteiras. */}
        <div className={`mt-0.5 flex items-center gap-3 ${oculto ? "hidden" : ""}`}>
          {aoResponder && (
            <button
              type="button"
              onClick={aoResponder}
              className="press min-h-[44px] pr-2 text-xs font-medium text-muted-foreground"
            >
              Responder
            </button>
          )}
          {/* ⚠️ O número só aparece com pelo menos uma: um "0" ao lado de todo
              comentário transforma a conversa num placar de quem foi ignorada. */}
          {(c.curtidas ?? 0) > 0 &&
            /* ⚠️ **SÓ QUEM ESCREVEU ABRE A LISTA.** Para todo mundo o número é
               texto, e continua sendo — dar o toque a terceiros prometeria uma
               tela que o servidor recusa. */
            (aoVerCurtidas ? (
              <button
                type="button"
                onClick={aoVerCurtidas}
                className="press min-h-[44px] text-xs font-medium text-muted-foreground"
              >
                {c.curtidas} {c.curtidas === 1 ? "curtida" : "curtidas"}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {c.curtidas} {c.curtidas === 1 ? "curtida" : "curtidas"}
              </span>
            ))}
          {/* ⚠️ **FIXAR FICA COM AS AÇÕES, e não num `⋯`.** Um menu a mais numa
              linha que já tem coração e × seria o quarto alvo de 44px numa
              largura de 393px. E o rótulo diz o ESTADO, não a promessa. */}
          {aoFixar && (
            <button
              type="button"
              onClick={aoFixar}
              className="press min-h-[44px] text-xs font-medium text-muted-foreground"
            >
              {c.fixadoEm ? "Desafixar" : "Fixar"}
            </button>
          )}
          {/* ⚠️ **SÓ QUEM ESCREVEU EDITA — nem a dona do post.** Ela pode
              APAGAR, que é a decisão dela sobre a própria conversa; reescrever
              a frase de outra pessoa é pôr palavras na boca dela. */}
          {aoEditar && (
            <button
              type="button"
              onClick={aoEditar}
              className="press min-h-[44px] text-xs font-medium text-muted-foreground"
            >
              Editar
            </button>
          )}
        </div>
      </div>

      {/* ⚠️ Coração e ⋯ somem junto com as ações de baixo enquanto recolhido —
          ver o bloco acima. */}
      {/* ⚠️ **O CORAÇÃO É DESENHADO**, e não ❤️. O emoji sai vermelho no iOS e
          cinza no Android, e aqui ele tem DOIS estados que precisam se
          distinguir à primeira vista — a mesma lição do 📞 e do marcador de
          salvar. */}
      <button
        type="button"
        onClick={() => aoCurtir(c)}
        aria-label={c.euCurti ? "Tirar a curtida" : "Curtir comentário"}
        aria-pressed={!!c.euCurti}
        /* ⚠️ 44px: o coração desenha 16px e o alvo media a caixa. */
        className={`press flex h-11 w-11 shrink-0 items-center justify-center ${oculto ? "hidden" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${c.euCurti ? "text-destructive" : "text-muted-foreground"}`}
          fill={c.euCurti ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
      </button>

      {/* ⚠️ **APAGAR OU DENUNCIAR, NUNCA OS DOIS.** Quem pode apagar (a autora e
          a dona do post) resolve na hora; denunciar é a saída de quem NÃO pode —
          oferecer as duas faria a dona denunciar em vez de apagar, e a fila da
          plataforma encheria de coisa que ela já podia resolver sozinha. */}
      {oculto ? null : c.possoApagar ? (
        <button
          type="button"
          onClick={() => aoApagar(c.id)}
          /* ⚠️ **44px DE LARGURA SEM ROUBAR LARGURA DO TEXTO.** Medido: o alvo
             saía 32×44, abaixo do mínimo no eixo estreito. Passar para `w-11`
             tiraria 12px da coluna do nome, que já trunca em "Marina Costa" a
             393px — a mesma medição que fixou o `gap-1.5` na linha da amiga.
             O `after` estende a área do dedo 6px para cada lado sem mover um
             pixel do desenho. */
          className="press relative h-11 w-8 shrink-0 text-xs text-muted-foreground after:absolute after:-inset-x-1.5 after:inset-y-0 after:content-['']"
          aria-label="Apagar comentário"
        >
          ×
        </button>
      ) : (
        <button
          type="button"
          onClick={() => aoDenunciar(c.id)}
          className="press relative h-11 w-8 shrink-0 text-xs text-muted-foreground after:absolute after:-inset-x-1.5 after:inset-y-0 after:content-['']"
          aria-label="Denunciar comentário"
        >
          ⋯
        </button>
      )}
    </div>
  );
}
