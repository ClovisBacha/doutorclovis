/**
 * Um campo de formulário rotulado.
 *
 * ⚠️ Ele saiu de `minha-conta.tsx` quando a tela de peso/pressão/glicemia foi
 * partida (set/2026): as duas passaram a precisar dele, e uma segunda cópia
 * divergiria no primeiro ajuste de estilo. O NOME não mudou, então nenhum dos
 * vinte pontos de uso precisou ser tocado — só o import.
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
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
