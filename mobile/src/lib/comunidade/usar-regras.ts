import { useCallback, useEffect, useRef, useState } from "react";
import { lerJson, gravarJson } from "~/lib/armazem";
import { parametroDaBancada } from "~/lib/bancada";
import { chaveDasRegras } from "~/lib/comunidade/regras";
import { useSessao } from "~/lib/sessao";

/**
 * AS REGRAS DA COMUNIDADE ANTES DO PRIMEIRO GESTO (Apple, diretriz 1.2).
 *
 * App com conteúdo gerado por usuárias precisa que a pessoa CONCORDE com
 * termos de tolerância zero antes de publicar. Aqui o portão fica no gesto —
 * publicar, comentar ou reagir —, e não na entrada da aba: quem só lê não é
 * interrompida.
 *
 * `exigir(acao)` roda a ação na hora se ela já concordou; senão abre a folha
 * e roda a ação depois do "Concordo". O "já concordei" é por conta
 * (`dc-regras-comunidade:<uid>`) e some no sair da conta (prefixo `dc-`).
 *
 * Bancada: `&regras=1` abre a folha na chegada.
 */
export function useRegrasDaComunidade() {
  const { sessao } = useSessao();
  const uid = sessao?.user.id ?? null;
  const [concordou, setConcordou] = useState<boolean | null>(null);
  const [aberta, setAberta] = useState(false);
  const pendente = useRef<(() => void) | null>(null);

  useEffect(() => {
    let vivo = true;
    if (parametroDaBancada("regras") === "1") {
      setConcordou(false);
      setAberta(true);
      return;
    }
    void lerJson<boolean>(chaveDasRegras(uid), false).then((v) => {
      if (vivo) setConcordou(v === true);
    });
    return () => {
      vivo = false;
    };
  }, [uid]);

  const exigir = useCallback(
    (acao: () => void) => {
      if (concordou) {
        acao();
        return;
      }
      pendente.current = acao;
      setAberta(true);
    },
    [concordou],
  );

  const concordar = useCallback(() => {
    setConcordou(true);
    setAberta(false);
    void gravarJson(chaveDasRegras(uid), true);
    const acao = pendente.current;
    pendente.current = null;
    if (acao) setTimeout(acao, 250);
  }, [uid]);

  const fechar = useCallback(() => {
    pendente.current = null;
    setAberta(false);
  }, []);

  return { exigir, folha: { aberta, aoConcordar: concordar, aoFechar: fechar } };
}
