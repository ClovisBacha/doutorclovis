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
    if (this.state.error) {
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
        </div>
      );
    }
    return this.props.children;
  }
}
