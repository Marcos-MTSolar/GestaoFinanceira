import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PrivacyProvider } from './context/PrivacyContext';
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
            onFecharModalExterno={() => setModalNovoLancamentoAberto(false)}
          />
        );
      case 'pagar':
        return (
          <ContasPagar
            onNovoLancamento={() => {
              setPaginaAtiva('lancamentos');
              setModalNovoLancamentoAberto(true);
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
    <div className="min-h-screen bg-[#F5F7FA] flex text-slate-800">
      
      {/* Menu Lateral Desktop e Gaveta Mobile */}
      <Sidebar
        paginaAtiva={paginaAtiva}
        onNavegar={(p) => setPaginaAtiva(p)}
        isOpenMobile={sidebarMobileAberta}
        onCloseMobile={() => setSidebarMobileAberta(false)}
      />

      {/* Área de Conteúdo Principal */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <Header
          onToggleSidebar={() => setSidebarMobileAberta(!sidebarMobileAberta)}
          activePageTitle={TITULOS_PAGINAS[paginaAtiva]}
          onNavegar={(p) => setPaginaAtiva(p)}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
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
    <AuthProvider>
      <PrivacyProvider>
        <AppContent />
      </PrivacyProvider>
    </AuthProvider>
  );
}
