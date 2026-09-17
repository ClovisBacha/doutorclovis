import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ehPedacoQueSumiu } from "@/lib/pedaco-que-sumiu";

/**
 * ⚠️ A MESMA CHAVE DA RAIZ (`__root.tsx`), de propósito.
 *
 * As duas fronteiras se recuperam do MESMO defeito — um deploy no meio do uso
 * faz o `import()` do pedaço antigo rejeitar. Com chaves diferentes, a
 * paciente poderia recarregar duas vezes na mesma sessão: a raiz uma, a aba
 * outra. Uma chave só é o que faz "uma recarga por sessão" ser verdade.
 */
const CHAVE_RECARGA = "dc-recarreguei-por-pedaco-antigo";

interface Props {
  children: ReactNode;
  tabName?: string;
  /**
   * ⚠️ ADIA A RECARGA — e o único caso hoje é o SOS ABERTO.
   *
   * A recuperação é uma recarga de página, e uma recarga no meio de um envio
   * de socorro o ABORTA: o GPS, o endereço e a chamada ao servidor morrem, e a
   * paciente fica olhando um botão que ela já apertou. A aba que quebrou é
   * irrelevante perto disso — ela pode esperar o desfecho.
   *
   * Quando isto volta a ser falso, a recarga acontece (`componentDidUpdate`):
   * adiar não é desistir.
   */
  adiarRecarga?: boolean;
}

interface State {
  error: Error | null;
}

export class TabErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[TabErrorBoundary] ${this.props.tabName ?? "tab"} crashed:`,
      error,
      info.componentStack,
    );
    this.talvezRecarregar();
  }

  componentDidUpdate() {
    /* O SOS terminou: a recarga adiada acontece agora. */
    this.talvezRecarregar();
  }

  /**
   * ⚠️ "TENTAR NOVAMENTE" NÃO FUNCIONA PARA UM PEDAÇO QUE SUMIU, e este era o
   * defeito: depois de um deploy, o `import()` da aba rejeita, o navegador
   * MARCA a promessa do módulo como falha (`_status = 2`) e a guarda — então
   * `setState({ error: null })` remonta e o mesmo `import()` rejeita de novo,
   * na hora. A paciente tocava num botão que comprovadamente não fazia nada.
   *
   * A raiz já se recupera assim há tempos, e o comentário dela vale igual
   * aqui: quem abriu o app não tem por que saber o que é "um pedaço do
   * aplicativo" — para ela isso é o app não abrir. Uma vez por sessão, senão
   * um erro de rede de verdade viraria laço de recarga e a tela de erro, que é
   * o último recurso, deixaria de aparecer.
   */
  private talvezRecarregar(): void {
    if (typeof window === "undefined") return;
    if (this.props.adiarRecarga) return;
    if (!ehPedacoQueSumiu(this.state.error)) return;
    try {
      if (sessionStorage.getItem(CHAVE_RECARGA)) return;
      sessionStorage.setItem(CHAVE_RECARGA, "1");
    } catch {
      /* modo privado: recarrega assim mesmo, uma vez. */
    }
    window.location.reload();
  }

  render() {
    const { error } = this.state;
    if (error) {
      /* ⚠️ O detalhe fica RECOLHIDO, como na tela raiz — e pelo mesmo motivo:
         o `console.error` acima não existe para quem usa o app instalado num
         iPhone, e sem isto a única testemunha do defeito não tem como contar
         qual foi. Ver o cabeçalho de `ErrorComponent` em `__root.tsx`. */
      const detalhe = [
        `${error.name ?? "Error"}: ${error.message ?? "(sem mensagem)"}`,
        this.props.tabName ? `em ${this.props.tabName}` : "",
        error.stack ? `\n${error.stack}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive/60" />
          <p className="text-sm text-muted-foreground">Algo deu errado ao carregar esta seção.</p>
          <button
            type="button"
            onClick={() =>
              /* Para um pedaço que sumiu, remontar não adianta — ver
                 `talvezRecarregar`. O botão faz o que de fato resolve. */
              ehPedacoQueSumiu(error) ? window.location.reload() : this.setState({ error: null })
            }
            className="min-h-11 rounded-full border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            {ehPedacoQueSumiu(error) ? "Recarregar o app" : "Tentar novamente"}
          </button>
          <details className="w-full max-w-sm text-left">
            <summary className="cursor-pointer text-center text-xs text-muted-foreground">
              Ver detalhes do erro
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted/60 p-3 text-xs leading-snug text-muted-foreground">
              {detalhe}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
