import React from 'react';
import { Logo } from './Logo';
import {
  LayoutDashboard,
  Landmark,
  ReceiptText,
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  SunMedium,
  BarChart3,
  BookOpen,
  Settings,
  X,
  Sparkles
} from 'lucide-react';

export type PaginaId =
  | 'painel'
  | 'contas'
  | 'lancamentos'
  | 'pagar'
  | 'receber'
  | 'funcionarios'
  | 'projetos'
  | 'relatorios'
  | 'cadastros'
  | 'configuracoes';

interface SidebarProps {
  paginaAtiva: PaginaId;
  onNavegar: (pagina: PaginaId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface ItemMenu {
  id: PaginaId;
  label: string;
  icone: React.ElementType;
  emBreve?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  paginaAtiva,
  onNavegar,
  isOpenMobile,
  onCloseMobile,
}) => {
  const itensMenu: ItemMenu[] = [
    { id: 'painel', label: 'Painel', icone: LayoutDashboard },
    { id: 'contas', label: 'Contas Bancárias', icone: Landmark },
    { id: 'lancamentos', label: 'Lançamentos', icone: ReceiptText },
    { id: 'pagar', label: 'Contas a Pagar', icone: ArrowDownCircle },
    { id: 'receber', label: 'Contas a Receber', icone: ArrowUpCircle },
    { id: 'projetos', label: 'Projetos', icone: SunMedium },
    { id: 'funcionarios', label: 'Funcionários', icone: Users },
    { id: 'relatorios', label: 'Relatórios', icone: BarChart3 },
    { id: 'cadastros', label: 'Cadastros', icone: BookOpen },
    { id: 'configuracoes', label: 'Configurações', icone: Settings },
  ];

  const handleItemClick = (id: PaginaId) => {
    onNavegar(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-r border-slate-200 shadow-xs">
      
      {/* Topo: Logo da MT Solar sobre Fundo Branco Limpo */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex-1">
          <Logo size="md" withWhiteBadge={false} />
        </div>
        <button
          onClick={onCloseMobile}
          type="button"
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Destaque Solar Rápido */}
      <div className="mx-4 mt-3 p-2.5 rounded-xl bg-linear-to-r from-[#FFF4CC] to-amber-50/50 border border-[#FCBC00]/30 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#FCBC00] text-[#003064] flex items-center justify-center font-bold">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-[#003064] leading-tight">
            Gestão Financeira Solar
          </p>
          <p className="text-[10px] text-slate-600 leading-tight">
            MT Solar Cuiabá & MT
          </p>
        </div>
      </div>

      {/* Lista de Navegação */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {itensMenu.map((item) => {
          const ativo = paginaAtiva === item.id;
          const Icone = item.icone;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all group ${
                ativo
                  ? 'bg-[#003064] text-white shadow-xs font-semibold'
                  : 'text-slate-700 hover:bg-[#F5F7FA] hover:text-[#00204A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icone
                  className={`w-5 h-5 transition-transform group-hover:scale-105 ${
                    ativo ? 'text-[#FCBC00]' : 'text-[#1A4A85]'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.emBreve && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium tracking-wide ${
                  ativo ? 'bg-[#FCBC00] text-[#003064]' : 'bg-amber-100 text-amber-800'
                }`}>
                  Em breve
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rodapé do Menu com Versão */}
      <div className="p-3 border-t border-slate-100 bg-[#F5F7FA]">
        <div className="text-center">
          <p className="text-[11px] font-semibold text-[#003064]">
            MT Solar Soluções Fotovoltaicas
          </p>
          <p className="text-[10px] text-slate-500">
            v1.0.0 • CNPJ 34.892.105/0001-44
          </p>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixo) */}
      <aside className="hidden lg:block w-64 h-screen sticky top-0 flex-shrink-0 z-20">
        {navContent}
      </aside>

      {/* Mobile Drawer (Sobreposição) */}
      {isOpenMobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-50 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
