/**
 * Um campo de formulário rotulado.
 *
 * ⚠️ Ele saiu de `minha-conta.tsx` quando a tela de peso/pressão/glicemia foi
 * partida (set/2026): as duas passaram a precisar dele, e uma segunda cópia
 * divergiria no primeiro ajuste de estilo. O NOME não mudou, então nenhum dos
 * vinte pontos de uso precisou ser tocado — só o import.
 *
 * ⚠️ **O `min-h-11` MORA AQUI, e não nos vinte pontos de uso.** Medido a 393px
 * antes: 311×38 — abaixo dos 44 do alvo de toque, nos cinco campos com que a
 * paciente registra peso, pressão e glicemia. Um campo de formulário é alvo de
 * toque como qualquer outro, e consertar no componente é uma regra; consertar
 * nos chamadores é vinte edições e um vigésimo primeiro campo nascendo errado
 * amanhã. (O tamanho da LETRA já é resolvido por outra regra, global: abaixo de
 * 16px o Safari do iPhone dá zoom ao focar, e `styles.css` sobe todo campo no
 * toque. São dois problemas diferentes no mesmo elemento.)
 */
export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    /* ⚠️ **O `<label>` ERA IRMÃO DO `<input>`, sem `htmlFor` e sem `id` — ou
       seja, não controlava nada.** O leitor de tela anunciava o campo SEM NOME
       (nos cinco com que ela registra peso, pressão e glicemia, entre outros), e
       tocar no rótulo não levava o foco ao campo. Envolver o input é o conserto
       sem `id`: um `id` fixo num componente usado vinte vezes na mesma página
       produziria vinte ids repetidos, que é outro defeito. */
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
    </label>
  );
}
