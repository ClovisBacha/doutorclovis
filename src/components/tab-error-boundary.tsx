import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  tabName?: string;
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
            onClick={() => this.setState({ error: null })}
            className="rounded-full border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Tentar novamente
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
