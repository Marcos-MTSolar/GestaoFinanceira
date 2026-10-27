import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PrivacyProvider } from './context/PrivacyContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { dbService, subscribe } from './services/storage';
import { obterHojeISO } from './utils/formatters';
import { Sidebar, PaginaId } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { InConstruction } from './components/InConstruction';

// Páginas
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ContasBancarias } from './pages/ContasBancarias';
import { Lancamentos } from './pages/Lancamentos';
import { ContasPagar } from './pages/ContasPagar';
import { ContasReceber } from './pages/ContasReceber';
import { Funcionarios } from './pages/Funcionarios';
import { Projetos } from './pages/Projetos';
import { Relatorios } from './pages/Relatorios';
import { Cadastros } from './pages/Cadastros';
import { Configuracoes } from './pages/Configuracoes';

const TITULOS_PAGINAS: Record<PaginaId, string> = {
  painel: 'Painel Geral',
  contas: 'Contas Bancárias',
  lancamentos: 'Lançamentos',
  pagar: 'Contas a Pagar',
  receber: 'Contas a Receber',
  projetos: 'Projetos Fotovoltaicos',
  funcionarios: 'Funcionários & Folha',
  relatorios: 'Relatórios Financeiros',
  cadastros: 'Cadastros Auxiliares',
  configuracoes: 'Configurações',
};

const AppContent: React.FC = () => {
  const { usuario, carregando } = useAuth();
  const [paginaAtiva, setPaginaAtiva] = useState<PaginaId>('painel');
  const [sidebarMobileAberta, setSidebarMobileAberta] = useState(false);
  const [modalNovoLancamentoAberto, setModalNovoLancamentoAberto] = useState(false);
  const [lancamentoEditarId, setLancamentoEditarId] = useState<string | null>(null);
  const [paginaRetorno, setPaginaRetorno] = useState<'pagar' | 'receber' | null>(null);

  // Ref para garantir que gerarRecorrenciasPendentes rode apenas UMA vez por carregamento
  const geracaoRodouRef = useRef(false);
  // Ref para controlar quando o visibilitychange deve disparar nova geração (mudou o dia)
  const ultimoDiaGeracaoRef = useRef<string>('');

  // Parte 23B: Gerar recorrências pendentes após o carregamento (admin only)
  useEffect(() => {
    if (!dbService.isCarregado() || !dbService.isUsuarioAdmin()) return;
    if (geracaoRodouRef.current) return;
    geracaoRodouRef.current = true;
    const hoje = obterHojeISO();
    ultimoDiaGeracaoRef.current = hoje;
    dbService.gerarRecorrenciasPendentes(hoje);
  }, []);

  // Parte 23B: Re-gerar quando o usuário retorna à aba, se o dia mudou
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (!dbService.isCarregado() || !dbService.isUsuarioAdmin()) return;
      const hoje = obterHojeISO();
      if (hoje !== ultimoDiaGeracaoRef.current) {
        ultimoDiaGeracaoRef.current = hoje;
        dbService.gerarRecorrenciasPendentes(hoje);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Parte 23B: Reagir quando o sistema sinalizar que terminou de carregar
  useEffect(() => {
    const unsub = subscribe('carregando', () => {
      if (!dbService.isCarregado() || !dbService.isUsuarioAdmin()) return;
      if (geracaoRodouRef.current) return;
      geracaoRodouRef.current = true;
      const hoje = obterHojeISO();
      ultimoDiaGeracaoRef.current = hoje;
      dbService.gerarRecorrenciasPendentes(hoje);
    });
    return () => unsub();
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#003064] border-t-[#FCBC00] rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#003064]">Carregando MT Solar...</p>
        </div>
      </div>
    );
  }

  // Se não estiver logado, exibe a tela de login
  if (!usuario) {
    return <Login />;
  }

  const renderConteudo = () => {
    switch (paginaAtiva) {
      case 'painel':
        return (
          <Dashboard
            onNavegar={(p) => setPaginaAtiva(p)}
            onAbrirNovoLancamento={() => setModalNovoLancamentoAberto(true)}
          />
        );
      case 'contas':
        return <ContasBancarias />;
      case 'lancamentos':
        return (
          <Lancamentos
            modalNovoAbertoExterno={modalNovoLancamentoAberto}
            onFecharModalExterno={() => {
              setModalNovoLancamentoAberto(false);
              setLancamentoEditarId(null);
              if (paginaRetorno) {
                const destino = paginaRetorno;
                setPaginaRetorno(null);
                setPaginaAtiva(destino);
              }
            }}
            lancamentoEditarExternoId={lancamentoEditarId}
          />
        );
      case 'pagar':
        return (
          <ContasPagar
            onNovoLancamento={() => {
              setPaginaAtiva('lancamentos');
              setModalNovoLancamentoAberto(true);
            }}
            onEditarLancamento={(id) => {
              setLancamentoEditarId(id);
              setPaginaRetorno('pagar');
              setPaginaAtiva('lancamentos');
            }}
          />
        );
      case 'receber':
        return (
          <ContasReceber
            onNovoLancamento={() => {
              setPaginaAtiva('lancamentos');
              setModalNovoLancamentoAberto(true);
            }}
            onEditarLancamento={(id) => {
              setLancamentoEditarId(id);
              setPaginaRetorno('receber');
              setPaginaAtiva('lancamentos');
            }}
          />
        );
      case 'projetos':
        return <Projetos />;
      case 'funcionarios':
        return <Funcionarios />;
      case 'relatorios':
        return <Relatorios />;
      case 'cadastros':
        return <Cadastros />;
      case 'configuracoes':
        return <Configuracoes />;
      default:
        return <Dashboard onNavegar={setPaginaAtiva} onAbrirNovoLancamento={() => setModalNovoLancamentoAberto(true)} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex text-slate-800 print:block print:bg-white">
      
      {/* Menu Lateral Desktop e Gaveta Mobile */}
      <Sidebar
        paginaAtiva={paginaAtiva}
        onNavegar={(p) => setPaginaAtiva(p)}
        isOpenMobile={sidebarMobileAberta}
        onCloseMobile={() => setSidebarMobileAberta(false)}
      />

      {/* Área de Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0 print:pb-0">
        <Header
          onToggleSidebar={() => setSidebarMobileAberta(!sidebarMobileAberta)}
          activePageTitle={TITULOS_PAGINAS[paginaAtiva]}
          onNavegar={(p) => setPaginaAtiva(p)}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 print:p-0 print:max-w-none">
          {renderConteudo()}
        </main>
      </div>

      {/* Menu Inferior no Celular (Mobile-First) */}
      <MobileBottomNav
        paginaAtiva={paginaAtiva}
        onNavegar={(p) => setPaginaAtiva(p)}
        onToggleMenu={() => setSidebarMobileAberta(true)}
      />

    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PrivacyProvider>
          <AppContent />
        </PrivacyProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
