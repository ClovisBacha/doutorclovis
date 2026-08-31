/**
 * "NÃO CONSEGUI LER" NÃO PODE TER CARA DE "NÃO HÁ NADA".
 *
 * ⚠️ A classe de defeito que este componente existe para fechar: uma leitura
 * falha (rede, RLS, coluna que o `APLICAR_` ainda não criou), a tela descarta o
 * erro com `data ?? []` — ou ignora um `{ ok: false }` que chega numa resposta
 * **200 NORMAL**, que nenhum `try/catch` pega — e desenha um vazio que AFIRMA
 * um fato falso.
 *
 * O custo nunca é a tela feia; é a conclusão que ela induz:
 *
 *   · "Nenhuma teleconsulta agendada" → ela perde a consulta com a sala aberta.
 *   · "Nenhuma consulta salva ainda"  → ela toma o remédio sem a posologia.
 *   · "Seu diário começará aqui"      → ela acredita que perdeu meses de
 *                                       registro emocional.
 *   · "Nenhum ciclo registrado"       → ela informa uma DUM errada ao médico.
 *
 * ⚠️ **UM COMPONENTE SÓ, e não cinco cópias do mesmo JSX**: cinco divergiriam
 * no primeiro ajuste de texto, e a que divergisse seria justamente a menos
 * olhada.
 *
 * ⚠️ **A frase de sossego é PROP, nunca fixa.** "O que você registrou continua
 * salvo" é verdade no diário e MENTIRA na teleconsulta, onde quem marcou foi o
 * consultório. Uma frase genérica aqui seria a segunda mentira no lugar da
 * primeira.
 */
export function NaoConsegueLer({
  oQue,
  sossego,
  aoTentar,
}: {
  /** "sua agenda", "seu diário" — entra em "Não consegui carregar {oQue} agora". */
  oQue: string;
  /** O que continua verdadeiro apesar da falha. Uma frase, na voz do app. */
  sossego: string;
  aoTentar: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center">
      <p className="text-3xl">🌧️</p>
      <p className="mt-2 font-serif text-lg text-foreground/80">
        Não consegui carregar {oQue} agora
      </p>
      {/* ⚠️ Diz de quem é a culpa. Sem isso, a paciente lê a falha como uma
          coisa que ela fez — ou pior, como um dado que sumiu. */}
      <p className="mt-1 text-sm text-muted-foreground">Isso é a nossa conexão. {sossego}</p>
      <button
        type="button"
        onClick={aoTentar}
        className="mt-4 min-h-11 rounded-full border border-border px-6 text-sm font-medium"
      >
        Tentar de novo
      </button>
    </div>
  );
}
