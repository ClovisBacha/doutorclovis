/**
 * A FAIXA DE QUEM CONVIDOU — a primeira coisa que ela lê.
 *
 * Ver `src/lib/quem-convidou.ts` para o porquê de cada palavra e de cada
 * silêncio. Aqui é só o desenho e a busca.
 */
import { useEffect, useState } from "react";
import {
  codigoLimpo,
  fraseDoConvite,
  inicialDoConvite,
  subtextoDoConvite,
  type QuemConvidou,
  type TipoDeConvite,
} from "@/lib/quem-convidou";

/**
 * Onde o código fica enquanto ela anda pelo site.
 *
 * ⚠️ **`sessionStorage`, e nunca o `localStorage` de 60 dias que o `__root` já
 * usa para ATRIBUIR.** São duas perguntas diferentes: "a quem esta conta
 * pertence quando ela se cadastrar" (60 dias, e é o que paga a indicação) e
 * "ela acabou de chegar por um convite" (esta visita). Lendo o de 60 dias, a
 * faixa apareceria em toda visita por dois meses — inclusive muito depois de
 * ela já ter criado a conta —, e um convite que se repete deixa de ser convite.
 */
const CHAVE = "obst_convite_visita";

function guardado(): { codigo: string; tipo: TipoDeConvite } | null {
  try {
    const cru = sessionStorage.getItem(CHAVE);
    if (!cru) return null;
    const o = JSON.parse(cru) as { codigo?: string; tipo?: string };
    const codigo = codigoLimpo(o.codigo);
    if (!codigo) return null;
    return { codigo, tipo: o.tipo === "criadora" ? "criadora" : "amiga" };
  } catch {
    return null;
  }
}

/**
 * O código desta visita: a URL manda; o `sessionStorage` é a memória.
 *
 * ⚠️ **A URL vem primeiro** — quem abre um link novo com outro código está
 * chegando por OUTRO convite, e a faixa tem de acompanhar.
 */
function daVisita(): { codigo: string; tipo: TipoDeConvite } | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const amiga = codigoLimpo(q.get("amiga"));
  const criadora = codigoLimpo(q.get("ref"));
  const achado: { codigo: string; tipo: TipoDeConvite } | null = amiga
    ? { codigo: amiga, tipo: "amiga" }
    : criadora
      ? { codigo: criadora, tipo: "criadora" }
      : null;
  if (achado) {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(achado));
    } catch {
      /* sem armazenamento: a faixa vale só para esta página, e tudo bem */
    }
    return achado;
  }
  return guardado();
}

export function FaixaDeConvite({
  escura = false,
  bancada,
}: {
  escura?: boolean;
  /**
   * Injetável pela bancada.
   *
   * ⚠️ Ela fabrica o DADO, nunca o desenho — a mesma decisão de
   * `PerfilDaAmigaTela`. Sem isto, olhar esta faixa exigiria um código de
   * indicação real numa conta real, que é como uma tela passa meses sem
   * ninguém nunca ter visto.
   */
  bancada?: QuemConvidou | null;
}) {
  /**
   * ⚠️ **Nasce `null` e o servidor nunca a desenha.** O código vive na URL e no
   * `sessionStorage`, que não existem na renderização do servidor: pintar
   * qualquer coisa antes da primeira passada do cliente daria mismatch de
   * hidratação — o defeito que o convite pelo WhatsApp já pagou com
   * `location.origin` no render.
   */
  const [quem, setQuem] = useState<QuemConvidou | null>(bancada ?? null);

  useEffect(() => {
    if (bancada) return;
    const achado = daVisita();
    if (!achado) return;
    let vivo = true;
    (async () => {
      try {
        const { quemConvidou } = await import("@/lib/convite.functions");
        const r = await quemConvidou({ data: { codigo: achado.codigo, tipo: achado.tipo } });
        if (vivo && r.quem) setQuem(r.quem);
      } catch {
        /* Sem a faixa, a landing é a de sempre — o pior caso é o de hoje. */
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!bancada]);

  if (!quem) return null;

  const claro = !escura;
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${
        claro
          ? "border border-border bg-card"
          : "border border-white/20 bg-white/10 backdrop-blur-sm"
      }`}
    >
      {quem.avatarUrl ? (
        <img
          src={quem.avatarUrl}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          aria-hidden
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[16px] font-bold ${
            claro ? "bg-primary/15 text-primary" : "bg-white/20 text-white"
          }`}
        >
          {inicialDoConvite(quem.nome)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-[14px] font-semibold leading-snug ${claro ? "" : "text-white"}`}>
          {fraseDoConvite(quem)}
        </p>
        <p
          className={`mt-0.5 text-[12px] leading-snug ${
            claro ? "text-muted-foreground" : "text-white/70"
          }`}
        >
          {subtextoDoConvite(quem)}
        </p>
      </div>
    </div>
  );
}
