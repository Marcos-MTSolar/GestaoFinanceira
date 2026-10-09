import React from 'react';
import { PaginaId } from './Sidebar';
import {
  LayoutDashboard,
  Landmark,
  ReceiptText,
  ArrowDownCircle,
  Menu,
} from 'lucide-react';

interface MobileBottomNavProps {
  paginaAtiva: PaginaId;
  onNavegar: (pagina: PaginaId) => void;
  onToggleMenu: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  paginaAtiva,
  onNavegar,
  onToggleMenu,
}) => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200/90 shadow-lg px-2 py-1.5 flex items-center justify-around safe-bottom">
      <button
        onClick={() => onNavegar('painel')}
        className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
          paginaAtiva === 'painel'
            ? 'text-[#003064] font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <LayoutDashboard className={`w-5 h-5 ${paginaAtiva === 'painel' ? 'text-[#003064]' : 'text-slate-400'}`} />
        <span>Painel</span>
      </button>

      <button
        onClick={() => onNavegar('contas')}
        className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
          paginaAtiva === 'contas'
            ? 'text-[#003064] font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Landmark className={`w-5 h-5 ${paginaAtiva === 'contas' ? 'text-[#003064]' : 'text-slate-400'}`} />
        <span>Contas</span>
      </button>

      <button
        onClick={() => onNavegar('lancamentos')}
        className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
          paginaAtiva === 'lancamentos'
            ? 'text-[#003064] font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <ReceiptText className={`w-5 h-5 ${paginaAtiva === 'lancamentos' ? 'text-[#003064]' : 'text-slate-400'}`} />
        <span>Lançamentos</span>
      </button>

      <button
        onClick={() => onNavegar('pagar')}
        className={`flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition-colors ${
          paginaAtiva === 'pagar'
            ? 'text-[#003064] font-bold'
            : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <ArrowDownCircle className={`w-5 h-5 ${paginaAtiva === 'pagar' ? 'text-red-600' : 'text-slate-400'}`} />
        <span>A Pagar</span>
      </button>

      <button
        onClick={onToggleMenu}
        className="flex flex-col items-center py-1 px-2.5 rounded-lg text-[10px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <Menu className="w-5 h-5 text-slate-400" />
        <span>Menu</span>
      </button>
    </nav>
  );
};
