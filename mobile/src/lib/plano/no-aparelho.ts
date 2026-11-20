import { useEffect, useState } from "react";
import { apagar, gravarJson, lerJson } from "~/lib/armazem";
import {
  CHAVE_DO_PLANO_SEM_CONTA,
  chaveDoPlano,
  lerRespostas,
  planoCompleto,
  type RespostasDoPlano,
} from "~/lib/plano/respostas";

/**
 * O PLANO NO APARELHO (20/11/2026): as respostas do funil antes da conta, e a
 * mudança delas para a conta depois do cadastro.
 */

/** As respostas de quem ainda não tem conta (ou já passaram para a conta `uid`). */
export async function lerPlanoDoAparelho(uid?: string | null): Promise<RespostasDoPlano> {
  const semConta = lerRespostas(await lerJson<unknown>(CHAVE_DO_PLANO_SEM_CONTA, null));
  if (planoCompleto(semConta) || !uid) return semConta;
  return lerRespostas(await lerJson<unknown>(chaveDoPlano(uid), null));
}

/**
 * Depois de gravar o perfil: as respostas passam para a chave da conta
 * ("dc-…", que o sair apaga) e saem da chave sem dono — o próximo cadastro
 * neste aparelho começa do zero.
 */
export async function passarPlanoParaAConta(uid: string, r: RespostasDoPlano): Promise<void> {
  await gravarJson(chaveDoPlano(uid), r);
  await apagar(CHAVE_DO_PLANO_SEM_CONTA);
}

/**
 * A porta pergunta isto quando a conta ainda não tem a data da gestação:
 * `null` enquanto lê, `true` se há um plano montado esperando para ser
 * guardado (vai para `/guardar-plano`), `false` se não (vai para o ritual).
 */
export function usePlanoEsperando(ligado: boolean): boolean | null {
  const [tem, setTem] = useState<boolean | null>(null);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    void lerJson<unknown>(CHAVE_DO_PLANO_SEM_CONTA, null).then((bruto) => {
      if (vivo) setTem(planoCompleto(lerRespostas(bruto)));
    });
    return () => {
      vivo = false;
    };
  }, [ligado]);
  return ligado ? tem : false;
}
