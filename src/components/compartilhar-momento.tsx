/**
 * COMPARTILHE ESSA VITÓRIA — a folha com as duas saídas.
 *
 * Pedido do dono: "esses momentos que acontecem em todo o app" têm de poder ir
 * para a Comunidade E para o Instagram. São duas coisas diferentes:
 *
 *  · **para FORA** — uma imagem 1080×1350 gerada no aparelho e entregue ao
 *    sistema (`navigator.share` com arquivo), que abre Instagram, WhatsApp,
 *    Fotos, o que ela tiver;
 *  · **para DENTRO** — um post na Comunidade, com o mesmo cartão como foto e a
 *    legenda já escrita.
 *
 * ⚠️ **O DE DENTRO ABRE O COMPOSITOR, E NUNCA PUBLICA.** A visibilidade é
 * decisão dela (o padrão do compositor é o mais fechado), e o texto é rascunho.
 * Publicar direto seria o app pondo no feed, com o nome dela, um texto que ela
 * não escolheu — a mesma decisão do agradecimento do chá de bebê e da
 * transcrição do diário: o app escreve o rascunho, quem aperta enviar é ela.
 *
 * ⚠️ **E O PORTÃO DE MODO CUIDADO NÃO ESTÁ AQUI.** Ele está em `momentoDe`, que
 * devolve `null` — então esta folha nem chega a existir. Um segundo portão aqui
 * seria a segunda régua que este projeto proíbe desde `humorDaJornada`.
 */
import { useState } from "react";
import { ROTULO_COMPARTILHAR, type Momento } from "@/lib/momento";

export function CompartilharMomento({
  momento,
  nomeDaMae,
  aoPublicarNaComunidade,
  compacto = false,
}: {
  /** `null` = não há o que compartilhar (Modo Cuidado, número inválido). */
  momento: Momento | null;
  nomeDaMae?: string | null;
  /**
   * Leva o cartão ao compositor da Comunidade.
   *
   * ⚠️ **Opcional de propósito.** Nem toda tela que celebra sabe navegar até a
   * Comunidade (a folha de gratidão vive dentro do Caminho, que vive dentro de
   * Minha Conta). Sem a prop, a folha oferece só a imagem — e não um botão que
   * não faz nada.
   */
  aoPublicarNaComunidade?: (m: Momento) => void;
  /** Botão pequeno, para dentro de um cartão que já está cheio. */
  compacto?: boolean;
}) {
  const [aberta, setAberta] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  if (!momento) return null;

  async function paraFora() {
    if (ocupado || !momento) return;
    setOcupado(true);
    try {
      const { compartilharMomento } = await import("@/lib/share-card");
      const r = await compartilharMomento(momento, { motherName: nomeDaMae ?? null });
      const { toast } = await import("sonner");
      /* ⚠️ **`downloaded` PRECISA ser dito.** O navegador que não sabe
         compartilhar arquivo salva o PNG nos Downloads — e sem esta frase o
         toque não produz nada visível, e ela conclui que o botão quebrou. */
      if (r === "downloaded") toast.success("Imagem salva no seu aparelho 💛");
      else if (r === "error") toast.error("Não deu para gerar a imagem. Tente de novo.");
      if (r !== "error") setAberta(false);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className={
          compacto
            ? "press inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold"
            : "press inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-primary px-5 text-[14px] font-semibold text-primary-foreground"
        }
      >
        <IconeCompartilhar />
        {ROTULO_COMPARTILHAR}
      </button>

      {aberta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Compartilhar"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45"
          onClick={() => setAberta(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-card p-5"
            style={{ paddingBottom: "max(1.25rem, var(--safe-bottom))" }}
          >
            <p className="text-[15px] font-semibold">Compartilhe essa vitória</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
              {momento.legenda}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void paraFora()}
                className="press min-h-[48px] rounded-2xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {ocupado ? "Preparando…" : "Salvar imagem / Instagram"}
              </button>

              {aoPublicarNaComunidade && (
                <button
                  type="button"
                  onClick={() => {
                    aoPublicarNaComunidade(momento);
                    setAberta(false);
                  }}
                  className="press min-h-[48px] rounded-2xl border border-border px-4 text-[15px] font-semibold"
                >
                  Publicar na Comunidade
                </button>
              )}

              <button
                type="button"
                onClick={() => setAberta(false)}
                className="press min-h-[44px] text-[13px] text-muted-foreground"
              >
                Agora não
              </button>
            </div>

            {/* ⚠️ Diz o que vai acontecer ANTES de ela tocar. "Publicar na
                Comunidade" abre o compositor — e uma paciente que ache que o
                toque já publica simplesmente não toca. */}
            <p className="mt-3 text-center text-[11px] leading-snug text-muted-foreground">
              Nada é publicado sozinho — você confere antes.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * ⚠️ DESENHADO, e não o emoji de compartilhar.
 *
 * Não existe emoji de "compartilhar" que renderize igual nos dois sistemas —
 * o iOS usa o quadrado com a seta, o Android usa três bolinhas ligadas, e
 * qualquer aproximação por emoji sai de cor diferente em cada aparelho. É a
 * mesma lição do 📞 preto no iOS e do 📅 da fita.
 */
function IconeCompartilhar() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}
