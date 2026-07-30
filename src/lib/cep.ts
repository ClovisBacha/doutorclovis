/**
 * CEP → endereço, pelo ViaCEP.
 *
 * Por que importa mais do que parece: a cidade digitada à mão é o que a busca
 * por proximidade compara. "Belo Horizonte", "belo horizonte", "BH" e "Bh" são
 * quatro cidades diferentes para um `ilike`, e a paciente que procura em BH
 * perde o médico que escreveu "Bh". Preenchendo pelo CEP, a cidade sai sempre
 * do mesmo lugar e sempre escrita igual.
 *
 * ViaCEP é público, gratuito, sem chave e sem limite documentado. É um serviço
 * de terceiro, então tudo aqui é best-effort: falhou, o médico digita à mão como
 * sempre digitou. Nada trava por causa dele.
 */

export type EnderecoCep = {
  rua: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/** Só os dígitos. `"30.140-071"` → `"30140071"`. */
export function digitosCep(v: string): string {
  return (v ?? "").replace(/\D/g, "").slice(0, 8);
}

/** `"30140071"` → `"30140-071"`, para o campo ficar legível enquanto digita. */
export function formatarCep(v: string): string {
  const d = digitosCep(v);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/**
 * Busca o endereço. `null` em qualquer falha — inclusive CEP inexistente, que o
 * ViaCEP responde com `{ erro: true }` e status 200.
 *
 * O `AbortSignal` de 4s existe pelo mesmo motivo do reverse-geocode do SOS: um
 * serviço externo opcional não pode pendurar um formulário.
 */
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const d = digitosCep(cep);
  if (d.length !== 8) return null;
  try {
    const corta = new AbortController();
    const alarme = setTimeout(() => corta.abort(), 4000);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: corta.signal });
      if (!res.ok) return null;
      const j = (await res.json()) as {
        erro?: boolean | string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      // CEP inexistente vem como 200 com `erro`, não como 404.
      if (j.erro) return null;
      return {
        rua: j.logradouro ?? "",
        bairro: j.bairro ?? "",
        cidade: j.localidade ?? "",
        uf: (j.uf ?? "").toUpperCase(),
      };
    } finally {
      clearTimeout(alarme);
    }
  } catch {
    return null;
  }
}
