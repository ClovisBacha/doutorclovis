/**
 * Lista de opções + "Outro" que abre um campo de texto.
 *
 * O padrão parece óbvio e tem uma sutileza que decide se ele funciona: o
 * componente NÃO guarda estado próprio do valor. Ele recebe o texto final e
 * deduz, a cada render, se aquele texto está na lista ou não. Assim um valor que
 * já existia no banco — digitado à mão, antes da lista existir — aparece no
 * campo "Outro" já preenchido, em vez de sumir porque não casa com nenhuma
 * opção.
 *
 * O único estado local é "o médico ACABOU de escolher Outro e ainda não digitou
 * nada": nesse instante o texto é vazio, que também é o estado inicial, e sem
 * essa memória o campo de digitação fecharia sozinho.
 */

import { useState } from "react";

export function CampoComOutro({
  label,
  opcoes,
  valor,
  onChange,
  placeholderOutro = "Digite o seu",
  ajuda,
  obrigatorio,
  classeInput,
  classeLabel,
}: {
  label: string;
  opcoes: readonly string[];
  valor: string;
  onChange: (v: string) => void;
  placeholderOutro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  /** As classes do formulário que chama — para não divergir do resto da tela. */
  classeInput: string;
  classeLabel: string;
}) {
  const naLista = !!valor && opcoes.includes(valor);
  const [escolheuOutro, setEscolheuOutro] = useState(false);
  // "Outro" está aberto quando o texto não é nenhuma opção (e existe), ou quando
  // ele acabou de escolher Outro e o campo ainda está vazio.
  const modoOutro = escolheuOutro || (!!valor && !naLista);

  return (
    <div>
      <label className={classeLabel}>
        {label}
        {obrigatorio ? " *" : ""}
      </label>
      <select
        value={modoOutro ? "__outro__" : valor}
        onChange={(e) => {
          if (e.target.value === "__outro__") {
            setEscolheuOutro(true);
            onChange("");
          } else {
            setEscolheuOutro(false);
            onChange(e.target.value);
          }
        }}
        className={classeInput}
        aria-label={label}
      >
        <option value="">Selecione…</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="__outro__">Outro — digitar</option>
      </select>
      {modoOutro && (
        <input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholderOutro}
          className={classeInput}
          autoFocus
          aria-label={`${label} — outro`}
        />
      )}
      {ajuda && <p className="mt-1 text-xs leading-snug text-muted-foreground">{ajuda}</p>}
    </div>
  );
}
