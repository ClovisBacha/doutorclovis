/**
 * A ABA COMUNIDADE — a porta única.
 *
 * Ela assumiu o lugar do Chat na barra de baixo. Ver `src/lib/comunidade.ts`
 * para a régua de quais portas aparecem (e por que a votação de nome sai no
 * Modo Cuidado enquanto a rede de apoio fica).
 *
 * A primeira versão faz duas coisas:
 *
 *  1. **Reúne o que já existia solto** — Amigas, Acompanhante, Álbum e a
 *     votação de nomes viviam em quatro caminhos diferentes, nenhum deles onde
 *     alguém procuraria "as pessoas que estão comigo nisso".
 *  2. **Recebe a lista de presentes e o chá de bebê**, que é o que vem a
 *     seguir e o motivo de a aba existir com porta própria.
 *
 * ⚠️ As portas são ATALHOS, nunca cópias — elas abrem a tela que já existe, no
 * lugar onde ela já mora. É a mesma decisão do hub da Saúde com Chutes e
 * Contrações: duas implementações da mesma coisa divergem no primeiro conserto.
 */
import { useEffect, useState } from "react";
import arte_cha from "@/assets/comunidade/cha.webp";
import arte_feed from "@/assets/comunidade/feed.webp";
import arte_amigas from "@/assets/comunidade/amigas.webp";
import arte_acompanhante from "@/assets/comunidade/acompanhante.webp";
import arte_album from "@/assets/comunidade/album.webp";
import arte_nome from "@/assets/comunidade/nome.webp";
import { portasDaComunidade } from "@/lib/comunidade";
import {
  emblemaDaPorta,
  fraseDaPorta,
  ordenarPortas,
  type ChaveDaPorta,
  type EstadoDasPortas,
} from "@/lib/estado-das-portas";

/**
 * A peça 3D de cada porta, no lugar do emoji. Por CHAVE da porta, com o emoji
 * como recuo — uma porta nova sem arte continua desenhando o dela.
 */
const ARTE_DA_PORTA: Record<string, string> = {
  cha: arte_cha,
  feed: arte_feed,
  amigas: arte_amigas,
  acompanhante: arte_acompanhante,
  album: arte_album,
  nome: arte_nome,
};

export function ComunidadeTab({
  careMode = false,
  onAbrir,
  bancada,
}: {
  careMode?: boolean;
  /** Leva à aba (e sub-tela) de destino. Mesma assinatura do hub da Saúde. */
  onAbrir: (destino: string, subDestino?: string) => void;
  /** Só para a bancada: injeta o estado sem servidor. */
  bancada?: EstadoDasPortas;
}) {
  const [estado, setEstado] = useState<EstadoDasPortas>(bancada ?? {});

  /**
   * ⚠️ **O ESTADO DAS PORTAS É O QUE FALTAVA NESTA ABA.**
   *
   * Ela mostrava seis cartões idênticos que nunca mudavam — um menu, não um
   * hub. Agora cada porta diz se aconteceu algo atrás dela ("3 presentes
   * reservados", "5 fotos no álbum"), que é o que faz alguém abrir.
   *
   * ⚠️ Falha ao ler NÃO vira zero: `estadoDasPortas` devolve `null` por porta,
   * e `null` não desenha nada. Zero afirmaria que não há nada, e ela deixaria
   * de abrir onde havia.
   *
   * ⚠️ E a aba NÃO ESPERA pelo servidor para desenhar: os cartões aparecem na
   * hora, e o estado chega depois. Um esqueleto aqui trocaria uma tela pobre
   * por uma tela vazia — e esta aba existe para ser aberta de relance.
   */
  useEffect(() => {
    if (bancada || careMode) return;
    let vivo = true;
    (async () => {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const s = await supabase.auth.getSession();
        const t = s.data.session?.access_token;
        if (!t) return;
        const { estadoDasPortas } = await import("@/lib/estado-das-portas.functions");
        const r = await estadoDasPortas({ data: { accessToken: t } });
        if (vivo && r.ok) setEstado(r.resumo);
      } catch {
        /* Sem estado, a aba fica como sempre foi — nunca pior. */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [bancada, careMode]);

  const portas = ordenarPortas(portasDaComunidade({ careMode }), estado);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Comunidade</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          As pessoas que estão com você nessa jornada.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        {portas.map((p) => {
          const e = estado[p.key as ChaveDaPorta];
          const emblema = emblemaDaPorta(e);
          const frase = fraseDaPorta(e);
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onAbrir(p.destino, p.subDestino)}
              className="press relative flex flex-col items-start gap-1 rounded-2xl card-material p-4 text-left"
            >
              {ARTE_DA_PORTA[p.key] ? (
                <img
                  src={ARTE_DA_PORTA[p.key]}
                  alt=""
                  draggable={false}
                  className="h-12 w-12 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.12)]"
                />
              ) : (
                <span className="text-2xl leading-none">{p.emoji}</span>
              )}
              {/* ⚠️ O emblema fica no CANTO, fora do fluxo: no fluxo ele
                  empurraria o título para a segunda linha em "Acompanhante",
                  que é o rótulo mais longo. */}
              {emblema && (
                <span
                  aria-hidden="true"
                  className="absolute right-3 top-3 min-w-[20px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-bold leading-tight text-primary-foreground tabular-nums"
                >
                  {emblema}
                </span>
              )}
              <span className="mt-1 font-semibold leading-tight">{p.label}</span>
              {/* ⚠️ A frase SUBSTITUI o subtítulo quando existe — não se soma a
                  ele. Duas linhas de texto miúdo num cartão de 170px viram um
                  bloco cinza que ninguém lê, e o FATO ("3 presentes
                  reservados") vale mais que a descrição ("fraldas, cotas e a
                  lista"), que ela já leu nas visitas anteriores. */}
              {frase ? (
                <span className="text-xs font-medium leading-snug text-primary">{frase}</span>
              ) : (
                <span className="text-xs leading-snug text-muted-foreground">{p.sub}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
