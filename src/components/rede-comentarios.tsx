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

import { useCallback, useEffect, useState } from "react";
import type { ComentarioNaTela } from "@/lib/comentarios.functions";
import { LIMITE_DO_COMENTARIO } from "@/lib/comentarios";

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
      const r = await comentar({ data: { accessToken: tk, postId, texto: t } });
      if (r.ok) {
        setTexto("");
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

      {lista.map((c) => (
        <div key={c.id} className="mt-2.5 flex items-start gap-2">
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
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            <span className="font-semibold">{c.autorNome}</span>{" "}
            <span className="whitespace-pre-wrap break-words">{c.texto}</span>
          </p>
          {/* ⚠️ **APAGAR OU DENUNCIAR, NUNCA OS DOIS.** Quem pode apagar (a
              autora e a dona do post) resolve na hora; denunciar é a saída de
              quem NÃO pode — oferecer as duas faria a dona denunciar em vez de
              apagar, e a fila da plataforma encheria de coisa que ela já podia
              resolver sozinha. */}
          {c.possoApagar ? (
            <button
              type="button"
              onClick={() => setApagando(c.id)}
              className="press shrink-0 text-[12px] text-muted-foreground"
              aria-label="Apagar comentário"
            >
              ×
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDenunciando(c.id)}
              className="press shrink-0 text-[12px] text-muted-foreground"
              aria-label="Denunciar comentário"
            >
              ⋯
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
          <div className="mt-3 flex items-end gap-2">
            <textarea
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
