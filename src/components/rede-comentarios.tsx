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
import { LIMITE_DO_COMENTARIO, RESPOSTAS_VISIVEIS } from "@/lib/comentarios";

async function token() {
  const { supabase } = await import("@/integrations/supabase/client");
  const s = await supabase.auth.getSession();
  return s.data.session?.access_token ?? null;
}

export function Comentarios({
  postId,
  aoAbrirPerfil,
  bancada,
}: {
  postId: string;
  aoAbrirPerfil?: (id: string) => void;
  /** Só a bancada preenche — a lista vem do servidor e exige sessão. */
  bancada?: { comentarios: ComentarioNaTela[]; abertos?: boolean; souADona?: boolean };
}) {
  const [lista, setLista] = useState<ComentarioNaTela[]>(bancada?.comentarios ?? []);
  const [abertos, setAbertos] = useState(bancada?.abertos ?? true);
  const [souADona, setSouADona] = useState(bancada?.souADona ?? false);
  const [texto, setTexto] = useState("");
  const [recado, setRecado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);
  const [denunciando, setDenunciando] = useState<string | null>(null);
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
    /* A ordem é a do tempo da RAIZ — a mesma da lista que veio do servidor. */
    return saida.sort(
      (a, b) => new Date(a.raiz.criadoEm).getTime() - new Date(b.raiz.criadoEm).getTime(),
    );
  }, [lista]);

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

  const carregar = useCallback(async () => {
    if (bancada) return;
    try {
      const t = await token();
      if (!t) return;
      const { comentariosDoPost } = await import("@/lib/comentarios.functions");
      const r = await comentariosDoPost({ data: { accessToken: t, postId } });
      if (r.ok) {
        setLista(r.comentarios);
        setAbertos(r.abertos);
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
  }, [bancada, postId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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

  async function denunciar(id: string) {
    setDenunciando(null);
    try {
      const t = await token();
      if (!t) return;
      const { denunciarComentario } = await import("@/lib/comentarios.functions");
      await denunciarComentario({ data: { accessToken: t, id } });
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
            className="press text-[12px] text-muted-foreground"
          >
            {abertos ? "Fechar comentários" : "Reabrir comentários"}
          </button>
        )}
      </div>

      {conversas.map(({ raiz, respostas }) => (
        <div key={raiz.id}>
          <Linha
            c={raiz}
            aoAbrirPerfil={aoAbrirPerfil}
            aoApagar={setApagando}
            aoDenunciar={setDenunciando}
            aoCurtir={curtir}
            aoResponder={() => responderA(raiz)}
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
                /* ⚠️ Responder a uma RESPOSTA cai na mesma conversa — a raiz é
                   sempre a mesma. É o que mantém um nível só. Ver
                   `raizDoComentario`. */
                aoResponder={() => responderA(r, raiz)}
              />
            </div>
          ))}

          {respostas.length > RESPOSTAS_VISIVEIS && !abertas[raiz.id] && (
            <button
              type="button"
              onClick={() => setAbertas((a) => ({ ...a, [raiz.id]: true }))}
              className="press ml-9 mt-1 min-h-[36px] text-[12px] font-medium text-muted-foreground"
            >
              Ver mais {respostas.length - RESPOSTAS_VISIVEIS}{" "}
              {respostas.length - RESPOSTAS_VISIVEIS === 1 ? "resposta" : "respostas"}
            </button>
          )}
        </div>
      ))}

      {/* ⚠️ Confirmação em MENSAGEM SEPARADA, nunca o × virando "tem certeza?" —
          a mesma decisão do cancelar consulta e do apagar mensagem. */}
      {apagando && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <p className="text-[13px]">Apagar este comentário?</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void apagar(apagando)}
              className="press rounded-full bg-destructive px-3 py-1 text-[12px] font-semibold text-destructive-foreground"
            >
              Apagar
            </button>
            <button
              type="button"
              onClick={() => setApagando(null)}
              className="press rounded-full border border-border px-3 py-1 text-[12px]"
            >
              Manter
            </button>
          </div>
        </div>
      )}

      {denunciando && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <p className="text-[13px]">Denunciar este comentário?</p>
          {/* ⚠️ A tela NÃO promete o que vai acontecer com a pessoa — a fila é
              da plataforma, e prometer remoção seria prometer o que ninguém
              garante. Mesma decisão da denúncia da caixinha. */}
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            A gente vai olhar. Você também pode bloquear quem escreveu, no perfil dela.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void denunciar(denunciando)}
              className="press rounded-full bg-destructive px-3 py-1 text-[12px] font-semibold text-destructive-foreground"
            >
              Denunciar
            </button>
            <button
              type="button"
              onClick={() => setDenunciando(null)}
              className="press rounded-full border border-border px-3 py-1 text-[12px]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {indisponivel ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Não consegui carregar os comentários agora.
        </p>
      ) : !abertos ? (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Os comentários deste post estão fechados.
        </p>
      ) : (
        <>
          {/* ⚠️ **A TELA DIZ A QUEM ELA RESPONDE, com saída.** Sem esta linha,
              tocar em "Responder" muda um estado invisível: ela escreve achando
              que comenta no post, e o texto nasce dentro da conversa de outra
              pessoa. E sem o ×, sair do modo exigiria enviar. */}
          {respondendo && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                Respondendo a {respondendo.nome}
              </span>
              <button
                type="button"
                onClick={() => setRespondendo(null)}
                aria-label="Cancelar resposta"
                className="press min-h-[32px] px-1 text-[13px] text-muted-foreground"
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
              placeholder="Escreva um comentário…"
              className="max-h-24 min-h-[36px] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-[13px]"
            />
            <button
              type="button"
              onClick={() => void enviar()}
              disabled={!texto.trim() || enviando}
              className="press h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold text-primary disabled:opacity-40"
            >
              Publicar
            </button>
          </div>
          {recado && (
            <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-[12px] leading-snug">
              {recado}
            </p>
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
  aoResponder,
}: {
  c: ComentarioNaTela;
  aoAbrirPerfil?: (id: string) => void;
  aoApagar: (id: string) => void;
  aoDenunciar: (id: string) => void;
  aoCurtir: (c: ComentarioNaTela) => void;
  aoResponder: () => void;
}) {
  return (
    <div className="mt-2.5 flex items-start gap-2">
      <button
        type="button"
        onClick={() => aoAbrirPerfil?.(c.autorId)}
        className="press shrink-0"
        aria-label={`Abrir perfil de ${c.autorNome}`}
      >
        {c.autorAvatar ? (
          <img src={c.autorAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[12px] font-semibold">
            {(c.autorNome.trim()[0] ?? "?").toUpperCase()}
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">
          <span className="font-semibold">{c.autorNome}</span>{" "}
          <span className="whitespace-pre-wrap break-words">{c.texto}</span>
        </p>

        {/* ⚠️ **A MARCA SÓ APARECE PARA A DONA DO POST**, e é o servidor que
            decide (`verDoComentario`). Quem foi restringida nunca recebe este
            campo preenchido no comentário dela — é esse silêncio que separa
            restringir de bloquear. */}
        {c.oculto && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {c.oculto === "restrito"
              ? "Só você e quem escreveu veem este comentário."
              : "Escondido pelo seu filtro de palavras."}
          </p>
        )}

        <div className="mt-0.5 flex items-center gap-3">
          <button
            type="button"
            onClick={aoResponder}
            className="press min-h-[32px] text-[12px] font-medium text-muted-foreground"
          >
            Responder
          </button>
          {/* ⚠️ O número só aparece com pelo menos uma: um "0" ao lado de todo
              comentário transforma a conversa num placar de quem foi ignorada. */}
          {(c.curtidas ?? 0) > 0 && (
            <span className="text-[12px] text-muted-foreground">
              {c.curtidas} {c.curtidas === 1 ? "curtida" : "curtidas"}
            </span>
          )}
        </div>
      </div>

      {/* ⚠️ **O CORAÇÃO É DESENHADO**, e não ❤️. O emoji sai vermelho no iOS e
          cinza no Android, e aqui ele tem DOIS estados que precisam se
          distinguir à primeira vista — a mesma lição do 📞 e do marcador de
          salvar. */}
      <button
        type="button"
        onClick={() => aoCurtir(c)}
        aria-label={c.euCurti ? "Tirar a curtida" : "Curtir comentário"}
        aria-pressed={!!c.euCurti}
        className="press flex h-8 w-8 shrink-0 items-center justify-center"
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
      {c.possoApagar ? (
        <button
          type="button"
          onClick={() => aoApagar(c.id)}
          className="press h-8 w-6 shrink-0 text-[12px] text-muted-foreground"
          aria-label="Apagar comentário"
        >
          ×
        </button>
      ) : (
        <button
          type="button"
          onClick={() => aoDenunciar(c.id)}
          className="press h-8 w-6 shrink-0 text-[12px] text-muted-foreground"
          aria-label="Denunciar comentário"
        >
          ⋯
        </button>
      )}
    </div>
  );
}
