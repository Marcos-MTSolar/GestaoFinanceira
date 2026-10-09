import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200/90 p-8 sm:p-10 relative z-10 text-center animate-in fade-in">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-200 shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="font-serif text-2xl font-extrabold text-[#003064] tracking-tight">
              Ops! Algo deu errado
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
              Ocorreu uma falha inesperada durante a exibição desta página. Nossos sistemas registraram o ocorrido.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 bg-[#003064] hover:bg-[#00204A] text-white py-3 px-4 rounded-xl font-semibold text-xs shadow-md transition-all border-b-2 border-[#FCBC00] cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#FCBC00]" />
                <span>Recarregar Aplicativo</span>
              </button>
            </div>

            {/* Detalhes Técnicos Recolhíveis */}
            <details className="mt-6 text-left border border-slate-200 bg-slate-50/80 rounded-xl p-3 text-xs text-slate-700">
              <summary className="font-bold cursor-pointer text-slate-800 flex items-center justify-between select-none">
                <span>Detalhes Técnicos do Erro</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </summary>
              <div className="mt-3 space-y-2 overflow-x-auto">
                <p className="font-mono text-[11px] text-red-700 font-semibold bg-red-50 p-2 rounded border border-red-200">
                  {this.state.error?.toString()}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="font-mono text-[10px] text-slate-600 bg-white p-2 rounded border border-slate-200 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
