/**
 * A TELA DA SESSÃO PARA DOIS.
 *
 * ─── O QUE ELA RESOLVE QUE O ÁUDIO SOZINHO NÃO RESOLVE ──────────────────────
 *
 * Numa prática para duas pessoas em UM aparelho, o defeito clássico é ninguém
 * saber de quem é a vez — os dois ouvem "agora você" e os dois se mexem, ou
 * nenhum. Aqui o alvo do bloco está em letra grande e em cor própria, e a
 * figura mostra onde a mão vai. Quem chegou atrasado na frase entende a tela
 * num relance.
 *
 * ─── AS FIGURAS SÃO DESENHO, NÃO FOTO ───────────────────────────────────────
 *
 * "Bem embaixo, na base da coluna" é ambíguo em texto e óbvio num desenho. São
 * quatro traços de SVG, com o ponto da mão destacado — nada de foto de casal
 * sorrindo, que é o que faz este tipo de conteúdo parecer propaganda de plano
 * de saúde.
 *
 * ─── E O TEXTO FICA NA TELA ─────────────────────────────────────────────────
 *
 * Ao contrário da história para dormir (onde ler acorda), aqui os dois estão
 * acordados e um deles está executando uma instrução com as mãos. Se o áudio
 * passou e ele não pegou, o texto tem de estar lá.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { emConteudo, emRepouso } from "@/lib/sessao-de-audio";
import {
  ROTULO_DO_ALVO,
  SESSAO_DO_CASAL,
  type Alvo,
  type BlocoDoCasal,
} from "@/lib/sessao-do-casal";
import { faixaDoBloco } from "@/lib/voz-da-noite";
import { anunciarMidia, estadoDaMidia } from "@/lib/media-session";
import { manterTelaAcesa } from "@/lib/tela-acesa";

const COR: Record<Alvo, { chip: string; texto: string }> = {
  /* Três cores porque são três destinatários, e a cor é lida antes da palavra.
     Rosa para ela, azul para quem acompanha, âmbar para os dois — a mesma
     lógica de leitura por cor do calendário do painel. */
  ela: { chip: "bg-rose-500/20 text-rose-200 border-rose-400/30", texto: "text-rose-200" },
  par: { chip: "bg-sky-500/20 text-sky-200 border-sky-400/30", texto: "text-sky-200" },
  dois: { chip: "bg-amber-500/20 text-amber-100 border-amber-400/30", texto: "text-amber-100" },
};

/** Os quatro desenhos. Traço fino, ponto de ação destacado. */
function Figura({ tipo }: { tipo: BlocoDoCasal["figura"] }) {
  if (!tipo) return null;
  const traco = "stroke-white/45";
  const alvo = "fill-amber-300";
  return (
    <svg
      viewBox="0 0 120 90"
      className="h-[112px] w-auto"
      fill="none"
      strokeWidth={1.6}
      aria-hidden
    >
      {tipo === "respirar" && (
        <>
          {/* Duas respirações que se encontram: a de trás segue a da frente. */}
          <circle cx={44} cy={45} r={20} className={`${traco} dc-casal-respira`} />
          <circle
            cx={78}
            cy={45}
            r={14}
            className={`${traco} dc-casal-respira`}
            style={{ animationDelay: "0.35s" }}
          />
          <circle cx={44} cy={45} r={3} className={alvo} />
          <circle cx={78} cy={45} r={3} className="fill-white/40" />
        </>
      )}
      {tipo === "mao-no-sacro" && (
        <>
          {/* De costas: ela sentada à frente, a mão de quem acompanha na base
              da coluna — o ponto âmbar é exatamente onde a palma vai. */}
          <path d="M52 20a9 9 0 1 1 .1 0Z" className={traco} />
          <path d="M44 34c0 14-3 26-3 38h24c0-12-3-24-3-38" className={traco} />
          <path d="M41 72h26" className={traco} />
          <circle cx={54} cy={62} r={7} className={alvo} opacity={0.85} />
          <path d="M82 58c-6 2-14 3-20 4" className={traco} />
          <path d="M84 52a7 7 0 1 1 .1 0Z" className={traco} />
        </>
      )}
      {tipo === "mao-na-barriga" && (
        <>
          {/* De perfil: a barriga e as duas mãos apoiadas, uma de cada lado. */}
          <path d="M46 18a9 9 0 1 1 .1 0Z" className={traco} />
          <path d="M40 32c-2 12-2 20 0 30" className={traco} />
          <path d="M40 40c14-2 22 6 22 14 0 8-8 14-22 12" className={traco} />
          <circle cx={54} cy={48} r={5} className={alvo} opacity={0.85} />
          <circle cx={57} cy={62} r={5} className={alvo} opacity={0.85} />
          <path d="M74 44c-6 2-10 3-14 4M76 66c-6-2-10-3-14-4" className={traco} />
        </>
      )}
      {tipo === "palavra" && (
        <>
          {/* Duas falas, uma palavra só no meio das duas. */}
          <path
            d="M22 30h34a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H34l-8 8v-8h-4a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6Z"
            className={traco}
          />
          <path
            d="M98 30H72a6 6 0 0 0-6 6v14a6 6 0 0 0 6 6h20l8 8v-8a6 6 0 0 0 6-6V36a6 6 0 0 0-6-6Z"
            className={traco}
          />
          <circle cx={60} cy={43} r={4} className={alvo} />
        </>
      )}
    </svg>
  );
}

export function SessaoDoCasal({ aoSair }: { aoSair: () => void }) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [comecou, setComecou] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vivoRef = useRef(true);

  const blocos = SESSAO_DO_CASAL.blocos;
  const total = blocos.length;
  const bloco = blocos[i];

  useEffect(() => {
    vivoRef.current = true;
    return () => {
      vivoRef.current = false;
    };
  }, []);

  const limpar = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      a.remove();
    }
    audioRef.current = null;
  }, []);
  useEffect(() => () => limpar(), [limpar]);

  /**
   * ⚠️ A SESSÃO DE ÁUDIO DO iOS SOBE AQUI E VOLTA NO DESMONTE.
   *
   * Esta tela toca `<audio>`, e elemento de mídia faz o `audioSession` do iOS
   * escalar de `ambient` para `playback` — que IGNORA o botão de silêncio. E
   * ele nunca volta sozinho: sem esta limpeza, um som que tocasse horas depois
   * (a conquista das 3h da manhã, por exemplo) herdaria isso e sairia alto com
   * o telefone no silencioso. Ver `sessao-de-audio.ts`.
   *
   * O retorno do efeito É o `finally`: ele roda no ✕, ao trocar de tela, e
   * quando algo estoura no meio.
   */
  useEffect(() => {
    emConteudo();
    return () => emRepouso();
  }, []);

  /* A tela fica acesa: os dois estão com as mãos ocupadas e ninguém vai tocar
     no celular por dez minutos — é o oposto da história para dormir. */
  useEffect(() => {
    if (!comecou) return;
    return manterTelaAcesa();
  }, [comecou]);

  useEffect(() => {
    if (!comecou || pausado) return;
    const faixa = faixaDoBloco(bloco.id);

    const seguir = () => {
      if (!vivoRef.current) return;
      timerRef.current = setTimeout(() => {
        if (!vivoRef.current) return;
        if (i + 1 < total) setI(i + 1);
        else setI(total); // fim
      }, bloco.pausa * 1000);
    };

    if (!faixa) {
      timerRef.current = setTimeout(seguir, 1500);
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }

    const a = audioRef.current ?? new Audio();
    a.src = faixa;
    a.setAttribute("playsinline", "");
    a.style.display = "none";
    if (typeof document !== "undefined" && !a.isConnected) document.body.appendChild(a);
    audioRef.current = a;
    a.addEventListener("ended", seguir, { once: true });
    void a.play().catch(() => seguir());

    /* O bloco seguinte é buscado durante este — a pausa é para a prática, não
       para a rede. */
    const prox = blocos[i + 1];
    const fp = prox ? faixaDoBloco(prox.id) : null;
    if (fp) {
      const b = new Audio();
      b.preload = "auto";
      b.src = fp;
    }

    return () => {
      a.removeEventListener("ended", seguir);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, pausado, comecou]);

  const acoes = useRef({ pausar: () => {}, tocar: () => {} });
  acoes.current = {
    pausar: () => {
      audioRef.current?.pause();
      if (timerRef.current) clearTimeout(timerRef.current);
      setPausado(true);
      estadoDaMidia("paused");
    },
    tocar: () => {
      setPausado(false);
      estadoDaMidia("playing");
    },
  };
  useEffect(() => {
    if (!comecou) return;
    return anunciarMidia({
      titulo: "Para vocês dois",
      aoPausar: () => acoes.current.pausar(),
      aoTocar: () => acoes.current.tocar(),
    });
  }, [comecou]);

  const acabou = i >= total;

  return (
    <div
      className="dc-quiz-in fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#1d1430] via-[#241a3d] to-[#140e24] text-white"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <div className="flex items-center px-4 py-3">
        <button
          onClick={() => {
            limpar();
            aoSair();
          }}
          aria-label="Fechar"
          className="press text-2xl leading-none text-white/40"
        >
          ✕
        </button>
        {comecou && !acabou && (
          <div className="mx-3 h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/45 transition-[width] duration-700"
              style={{ width: `${((i + 1) / total) * 100}%` }}
            />
          </div>
        )}
        <span className="flex-1" />
        {comecou && !acabou && (
          <button
            onClick={() => (pausado ? acoes.current.tocar() : acoes.current.pausar())}
            aria-label={pausado ? "Continuar" : "Pausar"}
            className="press grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/70"
          >
            <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor">
              {pausado ? (
                <path d="M8 5.2v13.6L19 12z" />
              ) : (
                <path d="M6.6 4.8h3.7v14.4H6.6zM13.7 4.8h3.7v14.4h-3.7z" />
              )}
            </svg>
          </button>
        )}
      </div>

      {!comecou && (
        <div className="flex flex-1 flex-col justify-center px-7 pb-10">
          <span className="text-5xl" aria-hidden>
            {SESSAO_DO_CASAL.emoji}
          </span>
          <h3 className="mt-4 font-serif text-[27px] font-semibold leading-tight">
            {SESSAO_DO_CASAL.titulo}
          </h3>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/70">
            Dez minutos com quem vai estar com você no dia. Vocês vão treinar as três coisas que
            mais funcionam no trabalho de parto — e nenhuma delas se aprende na hora.
          </p>
          <ul className="mt-5 space-y-2 text-[13px] text-white/60">
            <li>· a respiração de um seguindo a do outro</li>
            <li>· a pressão da mão na base das costas</li>
            <li>· uma palavra combinada, que vale depois</li>
          </ul>
          <p className="mt-6 text-[12px] leading-relaxed text-white/40">
            Chame quem vai te acompanhar antes de começar. Dá para fazer sentada no chão, na cama ou
            numa cadeira.
          </p>
          <button
            onClick={() => setComecou(true)}
            className="press mt-8 w-full rounded-full bg-white py-3.5 text-sm font-extrabold text-[#241a3d]"
          >
            Estamos os dois aqui
          </button>
        </div>
      )}

      {comecou && !acabou && (
        <div className="flex flex-1 flex-col items-center justify-center px-7 text-center">
          <span
            className={`rounded-full border px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] ${COR[bloco.alvo].chip}`}
          >
            {ROTULO_DO_ALVO[bloco.alvo]}
          </span>
          <div className="mt-7 flex h-[112px] items-center justify-center">
            <Figura tipo={bloco.figura} />
          </div>
          <p
            key={bloco.id}
            className="dc-q-slide mt-7 max-w-sm font-serif text-[19px] leading-relaxed text-white/90"
          >
            {bloco.texto}
          </p>
          {pausado && <p className="mt-6 text-[12px] text-white/45">Pausado</p>}
        </div>
      )}

      {acabou && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="text-5xl" aria-hidden>
            🤲
          </span>
          <h3 className="mt-4 font-serif text-[24px] font-semibold">Vocês treinaram junto</h3>
          <p className="mt-2 max-w-xs text-[13.5px] leading-relaxed text-white/70">
            Cinco minutos por semana bastam para isso virar automático. No dia, ninguém vai precisar
            lembrar de nada.
          </p>
          <button
            onClick={() => {
              limpar();
              aoSair();
            }}
            className="press mt-8 w-full max-w-xs rounded-full bg-white py-3.5 text-sm font-extrabold text-[#241a3d]"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
