import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  DEGRAUS,
  ENTRADA_MENSAGENS,
  MENSAGENS_ESCOLHIDAS,
  TETO_AUTOATENDIMENTO,
  centavosPorMensagem,
  descontoVsEntrada,
  gestantesAtendidas,
  precoDe,
} from "@/lib/planos-medico";

/**
 * O SELETOR DE MENSAGENS — a barra que enche e os números subindo.
 *
 * ─── POR QUE ELE EXISTE ─────────────────────────────────────────────────────
 *
 * A página vendia três cartões fixos, e a escada tem dez degraus. Quem quisesse
 * 1.250 mensagens não tinha como ver o preço antes de abrir o Stripe — ou seja,
 * o degrau do meio, que é onde a escada foi desenhada para levar a pessoa, era
 * invisível na tela que decide a compra.
 *
 * ─── O PREÇO VEM DA ESCADA, SEMPRE ──────────────────────────────────────────
 *
 * Cada número aqui sai de `precoDe` / `centavosPorMensagem` / `descontoVsEntrada`.
 * Nenhuma conta de preço é escrita neste arquivo — um `n * 0.15` aqui seria a
 * segunda tabela de preços, e é assim que a tela e a fatura divergem. Esta base
 * já viu isso quatro vezes.
 *
 * ─── O QUE A ANIMAÇÃO PRECISA FAZER ─────────────────────────────────────────
 *
 * Ela não é enfeite: o produto é uma escada, e escada se entende VENDO subir.
 * A barra enche, o preço rola até o novo valor e o desconto aparece quando
 * existe. Com `prefers-reduced-motion` tudo isso vira troca instantânea de
 * número — a informação é a mesma, sem movimento.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Dois temas, um componente.
 *
 * A mesma escada aparece no site (seção escura, vidro) e no painel do médico
 * (fundo claro). Duplicar o componente para trocar seis classes é como a régua
 * de vencimento ganhou quatro cópias discordantes nesta base — e aqui a cópia
 * carregaria a CONTA do preço junto.
 */
const TEMAS = {
  escuro: {
    caixa: "border-white/15 bg-white/[0.06] backdrop-blur-xl",
    rotulo: "text-white/50",
    titulo: "text-white",
    apoio: "text-white/60",
    forte: "text-white/85",
    trilho: "bg-white/10",
    marcaAtiva: "bg-white/45",
    marcaInativa: "bg-white/20",
    selo: "border-white/10 bg-white/[0.04]",
    seloRotulo: "text-white/45",
    fraco: "text-white/45",
    botao: "bg-white text-neutral-900 focus-visible:ring-white/40",
  },
  claro: {
    caixa: "border-primary/25 bg-card",
    rotulo: "text-muted-foreground",
    titulo: "text-foreground",
    apoio: "text-muted-foreground",
    forte: "text-foreground",
    trilho: "bg-primary/10",
    marcaAtiva: "bg-primary/50",
    marcaInativa: "bg-primary/20",
    selo: "border-border bg-background",
    seloRotulo: "text-muted-foreground",
    fraco: "text-muted-foreground",
    botao: "bg-primary text-primary-foreground focus-visible:ring-primary/40",
  },
} as const;

/** Passo do slider. 50 é o maior passo que ainda encosta em todos os degraus. */
const PASSO = 50;

/**
 * Onde a barra nasce quando não há escolha anterior.
 *
 * Mil, e não a entrada: é o primeiro degrau em que o desconto chega a dois
 * dígitos, e uma barra que abre no mínimo faz o produto parecer menor do que é.
 */
const PADRAO_MENSAGENS = 1_000;

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * O preço unitário, em CENTAVOS, com uma casa — e arredondado PARA CIMA.
 *
 * ─── DUAS RAZÕES, e as duas foram medidas ───────────────────────────────────
 *
 * 1. Em reais com duas casas, degraus vizinhos COLIDEM: 300 e 500 mostravam os
 *    dois "R$ 0,19"; 1.750 e 2.000, os dois "R$ 0,15". Arrastar a barra mudava
 *    o preço total e deixava o unitário parado — que é justamente o número que
 *    deveria mostrar o desconto acontecendo.
 *
 * 2. E `Math.round` mostrava MENOS do que a fatura cobra. Em 2.100 mensagens o
 *    real é 14,4476 centavos e a tela imprimia "R$ 0,14": 2.100 × 0,14 dá
 *    R$ 294,00 contra os R$ 303,40 cobrados. É a mesma propaganda enganosa que
 *    `descontoVsEntrada` evita com `floor` — aqui o sentido seguro é o oposto,
 *    porque o número é um PREÇO e não um desconto.
 */
const centavosTexto = (centavos: number) =>
  `${(Math.ceil(centavos * 10) / 10).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} centavos`;

/**
 * Um número que ROLA até o valor novo.
 *
 * Sem isto o preço pisca de R$ 174,40 para R$ 209,40 e o salto não é sentido —
 * o que a barra mostra como movimento o número precisa mostrar como quantia.
 */
function NumeroQueRola({ valor, duracao = 420 }: { valor: number; duracao?: number }) {
  const reduce = useReducedMotion();
  const [mostrado, setMostrado] = useState(valor);
  const anterior = useRef(valor);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setMostrado(valor);
      anterior.current = valor;
      return;
    }
    const de = anterior.current;
    const ate = valor;
    if (de === ate) return;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      /* easeOutExpo — o mesmo easing do resto do app. */
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      setMostrado(Math.round(de + (ate - de) * e));
      if (t < 1) raf.current = requestAnimationFrame(passo);
      else anterior.current = ate;
    };
    raf.current = requestAnimationFrame(passo);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      /* Sem isto, arrastar rápido deixa `anterior` num valor intermediário e a
         próxima animação parte do lugar errado. */
      anterior.current = mostrado;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, reduce, duracao]);

  return <>{brl(mostrado)}</>;
}

export function EscadaDeMensagens({
  onEscolher,
  className,
  tema = "escuro",
  ocupado = false,
  rotuloBotao,
}: {
  /** Leva a quantidade escolhida para o checkout. */
  onEscolher?: (mensagens: number) => void;
  className?: string;
  tema?: keyof typeof TEMAS;
  /** Desabilita o botão enquanto o checkout abre. */
  ocupado?: boolean;
  /** Sobrescreve o texto do botão (o painel diz "Assinar", o site também). */
  rotuloBotao?: (mensagens: number, precoFormatado: string) => string;
}) {
  const reduce = useReducedMotion();
  const t = TEMAS[tema];
  /**
   * Começa no que ela ESCOLHEU no site, quando houver.
   *
   * O seletor da `/medicos` grava a quantidade antes do cadastro; sem ler de
   * volta aqui, quem arrastou até 1.500 abre o painel em 1.000 e não entende
   * por quê. A escolha morreria entre a vitrine e a compra.
   *
   * Lazy initializer, não `useEffect`: um efeito faria a barra nascer em 1.000
   * e pular para 1.500 no primeiro quadro — e o número que rola trataria isso
   * como uma mudança dela, animando um salto que ninguém pediu.
   */
  const [mensagens, setMensagens] = useState(() => {
    try {
      const bruto = localStorage.getItem(MENSAGENS_ESCOLHIDAS);
      const n = Number(bruto);
      /* A faixa é conferida aqui também: o `localStorage` é do navegador dela e
         qualquer um edita. Fora da escada, cai no padrão. */
      if (Number.isFinite(n) && n >= ENTRADA_MENSAGENS && n <= TETO_AUTOATENDIMENTO) {
        return Math.round(n / PASSO) * PASSO;
      }
    } catch {
      /* sem storage (SSR, aba privada): o padrão serve */
    }
    return PADRAO_MENSAGENS;
  });

  const dados = useMemo(() => {
    const preco = precoDe(mensagens);
    return {
      preco,
      porMensagem: centavosPorMensagem(mensagens),
      desconto: descontoVsEntrada(mensagens),
      gestantes: gestantesAtendidas(mensagens),
      /* Onde ele está na escada, de 0 a 1 — é o preenchimento da barra. */
      fracao: (mensagens - ENTRADA_MENSAGENS) / (TETO_AUTOATENDIMENTO - ENTRADA_MENSAGENS),
    };
  }, [mensagens]);

  const noTeto = mensagens >= TETO_AUTOATENDIMENTO;

  return (
    <div className={`rounded-3xl border p-6 sm:p-8 ${t.caixa} ${className ?? ""}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${t.rotulo}`}>
            Monte o seu plano
          </p>
          <p className={`mt-1 font-serif text-2xl sm:text-3xl ${t.titulo}`}>
            {mensagens.toLocaleString("pt-BR")}{" "}
            <span className={`text-lg sm:text-xl ${t.apoio}`}>mensagens de IA por mês</span>
          </p>
          <p className={`mt-1 text-sm ${t.apoio}`}>
            Dá para cerca de <strong className={t.forte}>{dados.gestantes} gestantes</strong> ativas
            ao mesmo tempo · pacientes ilimitadas
          </p>
        </div>

        <div className="text-right">
          <p className={`font-serif text-4xl leading-none tabular-nums sm:text-5xl ${t.titulo}`}>
            <span className={`align-super text-xl ${t.apoio}`}>R$&nbsp;</span>
            <NumeroQueRola valor={dados.preco} />
          </p>
          <p className={`mt-1 text-sm ${t.apoio}`}>
            por mês · {centavosTexto(dados.porMensagem)} por mensagem
          </p>
        </div>
      </div>

      {/* ── A barra ────────────────────────────────────────────────────────
          O `range` nativo é o controle de verdade (teclado, leitor de tela,
          toque); a barra desenhada fica ATRÁS dele, e o polegar nativo é
          escondido. Trocar por divs com onPointerMove daria a mesma imagem e
          tiraria o acesso por teclado de quem depende dele. */}
      <div className="relative mt-7 h-8">
        <div
          className={`absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full ${t.trilho}`}
        >
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,rgba(228,150,142,0.75),rgba(228,150,142,1))]"
            initial={false}
            animate={{ width: `${Math.max(2, dados.fracao * 100)}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.42, ease: EASE }}
          />
        </div>
        {/* Marcas dos degraus: mostram que a escada tem paradas, não é contínua. */}
        {DEGRAUS.map((d) => {
          const x = ((d - ENTRADA_MENSAGENS) / (TETO_AUTOATENDIMENTO - ENTRADA_MENSAGENS)) * 100;
          return (
            <span
              key={d}
              aria-hidden
              className={`absolute top-1/2 h-3 w-px -translate-y-1/2 ${
                mensagens >= d ? t.marcaAtiva : t.marcaInativa
              }`}
              style={{ left: `${x}%` }}
            />
          );
        })}
        <input
          type="range"
          min={ENTRADA_MENSAGENS}
          max={TETO_AUTOATENDIMENTO}
          step={PASSO}
          value={mensagens}
          onChange={(e) => setMensagens(Number(e.target.value))}
          aria-label="Mensagens de IA por mês"
          aria-valuetext={`${mensagens} mensagens por mês, R$ ${brl(dados.preco)}`}
          className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent focus:outline-none [&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-7 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[rgb(228,150,142)] [&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-7 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[rgb(228,150,142)] [&::-webkit-slider-thumb]:shadow-[0_2px_10px_rgba(0,0,0,0.35)] [&:focus-visible::-webkit-slider-thumb]:ring-4 [&:focus-visible::-webkit-slider-thumb]:ring-white/40"
        />
      </div>

      <div className={`mt-2 flex justify-between text-xs ${t.fraco}`}>
        {/* Derivado, não digitado: R$ 29,90 escrito aqui era a segunda tabela de
            preços — a que diverge no dia em que a primeira faixa mudar. */}
        <span>
          {ENTRADA_MENSAGENS} · R$ {brl(precoDe(ENTRADA_MENSAGENS))}
        </span>
        <span>{TETO_AUTOATENDIMENTO.toLocaleString("pt-BR")} · acima disso, Clínica</span>
      </div>

      {/* ── O que MUDA ao subir ──────────────────────────────────────────── */}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Selo t={t} titulo="Economia por mensagem">
          {dados.desconto > 0 ? (
            <motion.span
              key={dados.desconto}
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="text-[rgb(228,150,142)]"
            >
              −{dados.desconto}%
            </motion.span>
          ) : (
            <span className={t.fraco}>preço de entrada</span>
          )}
        </Selo>
        <Selo t={t} titulo="Gestantes acompanhadas">
          cerca de {dados.gestantes}
        </Selo>
        <Selo t={t} titulo="Teto de pacientes">
          <span className={t.forte}>nenhum</span>
        </Selo>
      </div>

      <button
        type="button"
        onClick={() => onEscolher?.(mensagens)}
        disabled={ocupado}
        className={`mt-6 w-full rounded-full px-6 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-4 active:scale-[0.99] disabled:opacity-60 ${t.botao}`}
      >
        {ocupado
          ? "Abrindo pagamento…"
          : (rotuloBotao?.(mensagens, brl(dados.preco)) ??
            `Assinar ${mensagens.toLocaleString("pt-BR")} mensagens · R$ ${brl(dados.preco)}/mês`)}
      </button>

      <p className={`mt-3 text-center text-xs ${t.fraco}`}>
        {noTeto
          ? "No topo do autoatendimento. Precisa de mais? A Clínica é sob consulta."
          : "Sem fidelidade · dá para mudar a quantidade depois, no próprio checkout"}
      </p>
    </div>
  );
}

function Selo({
  titulo,
  children,
  t,
}: {
  titulo: string;
  children: React.ReactNode;
  t: (typeof TEMAS)[keyof typeof TEMAS];
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${t.selo}`}>
      <p className={`text-[11px] uppercase tracking-[0.1em] ${t.seloRotulo}`}>{titulo}</p>
      <p className={`mt-0.5 font-serif text-xl tabular-nums ${t.titulo}`}>{children}</p>
    </div>
  );
}
