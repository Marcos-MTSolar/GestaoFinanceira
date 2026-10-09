import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { dbService, subscribe } from '../services/storage';
import { AlertaItem } from '../types';
import { PaginaId } from './Sidebar';
import { Logo } from './Logo';
import { 
  Menu, 
  LogOut, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  Sparkles,
  Bell,
  AlertTriangle,
  AlertCircle,
  Clock,
  TrendingDown,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  activePageTitle: string;
  onNavegar?: (pagina: PaginaId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  activePageTitle,
  onNavegar,
}) => {
  const { usuario, isAdmin, logout, trocarPerfil } = useAuth();
  const { ocultarValores, toggleOcultarValores } = usePrivacy();
  const [menuAberto, setMenuAberto] = useState(false);
  const [alertasAberto, setAlertasAberto] = useState(false);
  const [alertas, setAlertas] = useState<AlertaItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const carregarAlertas = () => {
    try {
      const lista = dbService.obterAlertas();
      setAlertas(lista);
    } catch (e) {
      console.warn('Erro ao carregar alertas:', e);
    }
  };

  useEffect(() => {
    carregarAlertas();
    const unsubLanc = subscribe('lancamentos', carregarAlertas);
    const unsubContas = subscribe('contas', carregarAlertas);
    const unsubFunc = subscribe('funcionarios', carregarAlertas);
    return () => {
      unsubLanc();
      unsubContas();
      unsubFunc();
    };
  }, []);

  const totalAlertas = alertas.length;
  const temCritico = alertas.some(a => a.severidade === 'critico');

  const handleClickAlerta = (link?: string) => {
    setAlertasAberto(false);
    if (link && onNavegar) {
      onNavegar(link as PaginaId);
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Lado Esquerdo: Mobile Hamburger + Logo no Mobile + Título da Página no Desktop */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            type="button"
            className="lg:hidden p-2 text-slate-600 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Abrir menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo exibida no mobile no cabeçalho */}
          <div className="lg:hidden">
            <Logo size="sm" withWhiteBadge={false} />
          </div>

          {/* Título da Página no Desktop */}
          <div className="hidden lg:flex items-center gap-2">
            <h1 className="font-serif text-xl font-bold text-[#003064]">
              {activePageTitle}
            </h1>
            <span className="text-xs bg-[#FFF4CC] text-[#003064] font-semibold px-2 py-0.5 rounded-full border border-[#FCBC00]/30">
              MT Solar
            </span>
            {dbService.isModoDemonstracao() && (
              <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 animate-pulse">
                <Sparkles className="w-3 h-3 text-amber-600" />
                Modo Demonstração
              </span>
            )}
          </div>
        </div>

        {/* Lado Direito: Ações, Alertas & Perfil */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* BOTÃO OLHO (MODO PRIVACIDADE: OCULTAR / MOSTRAR VALORES) */}
          <button
            onClick={toggleOcultarValores}
            type="button"
            className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              ocultarValores
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
            title={ocultarValores ? 'Clique para mostrar os valores financeiros' : 'Clique para ocultar os valores financeiros (Modo Privacidade)'}
          >
            {ocultarValores ? (
              <>
                <EyeOff className="w-4 h-4 text-amber-600" />
                <span className="hidden sm:inline text-[11px]">Valores Ocultos</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline text-[11px]">Modo Privacidade</span>
              </>
            )}
          </button>

          {/* SINO DE NOTIFICAÇÕES & ALERTAS INTELIGENTES */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setAlertasAberto(!alertasAberto);
                setMenuAberto(false);
              }}
              type="button"
              className={`relative p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                totalAlertas > 0
                  ? temCritico 
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Alertas e avisos do sistema"
            >
              <Bell className="w-4 h-4" />
              {totalAlertas > 0 && (
                <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs ${
                  temCritico ? 'bg-red-600' : 'bg-amber-500'
                }`}>
                  {totalAlertas}
                </span>
              )}
            </button>

            {/* Painel Dropdown de Alertas */}
            {alertasAberto && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAlertasAberto(false)}
                />
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                  <div className="px-4 py-3 bg-[#003064] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#FCBC00]" />
                      <h3 className="font-serif font-bold text-sm">Central de Alertas MT Solar</h3>
                    </div>
                    <span className="text-[10px] font-bold bg-[#FCBC00] text-[#003064] px-2 py-0.5 rounded-full">
                      {totalAlertas} {totalAlertas === 1 ? 'pendência' : 'pendências'}
                    </span>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                    {alertas.length === 0 ? (
                      <div className="p-6 text-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-800">Tudo em dia!</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Nenhum alerta crítico ou título vencido no momento. Fluxo financeiro sob controle.
                        </p>
                      </div>
                    ) : (
                      alertas.map((alerta) => {
                        const eCritico = alerta.severidade === 'critico';
                        const eAviso = alerta.severidade === 'aviso';

                        return (
                          <div
                            key={alerta.id}
                            onClick={() => handleClickAlerta(alerta.linkPagina)}
                            className={`p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 border ${
                              eCritico
                                ? 'bg-red-50/60 hover:bg-red-50 border-red-200/80'
                                : eAviso
                                ? 'bg-amber-50/60 hover:bg-amber-50 border-amber-200/80'
                                : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/80'
                            }`}
                          >
                            <div className="shrink-0 mt-0.5">
                              {alerta.tipo === 'saldo_negativo' || alerta.tipo === 'projecao_negativa' ? (
                                <TrendingDown className={`w-4 h-4 ${eCritico ? 'text-red-600' : 'text-amber-600'}`} />
                              ) : alerta.tipo === 'ferias_vencendo' ? (
                                <Calendar className="w-4 h-4 text-blue-600" />
                              ) : (
                                <Clock className={`w-4 h-4 ${eCritico ? 'text-red-600' : 'text-amber-600'}`} />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className={`text-xs font-bold truncate ${
                                  eCritico ? 'text-red-900' : eAviso ? 'text-amber-900' : 'text-slate-800'
                                }`}>
                                  {alerta.titulo}
                                </h4>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase shrink-0 ${
                                  eCritico ? 'bg-red-200 text-red-800' : eAviso ? 'bg-amber-200 text-amber-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {alerta.severidade}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                                {alerta.descricao}
                              </p>
                              {alerta.linkPagina && (
                                <p className="text-[10px] font-semibold text-[#003064] hover:underline mt-1.5 flex items-center gap-1">
                                  <span>Resolver agora</span>
                                  <ArrowRight className="w-3 h-3" />
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {totalAlertas > 0 && (
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-500">Alertas em tempo real</span>
                      <button
                        onClick={() => setAlertasAberto(false)}
                        className="text-[11px] font-semibold text-[#003064] hover:underline cursor-pointer"
                      >
                        Fechar
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Badge de Papel */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200">
            {isAdmin ? (
              <span className="flex items-center gap-1 text-[#003064] bg-[#FFF4CC] px-2 py-0.5 rounded-full border border-[#FCBC00]/40 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-[#003064]" />
                Administrador
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 font-semibold">
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                Visualizador (Leitura)
              </span>
            )}
          </div>

          {/* Dropdown do Usuário */}
          <div className="relative">
            <button
              onClick={() => {
                setMenuAberto(!menuAberto);
                setAlertasAberto(false);
              }}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#003064] text-white flex items-center justify-center font-bold text-xs ring-2 ring-[#FCBC00]">
                {usuario?.nome ? usuario.nome.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {usuario?.nome || 'Usuário'}
                </p>
                <p className="text-[11px] text-slate-500 leading-tight truncate max-w-[130px]">
                  {usuario?.email}
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {menuAberto && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuAberto(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-100 mb-2">
                    <p className="text-xs font-semibold text-[#003064]">{usuario?.nome}</p>
                    <p className="text-xs text-slate-500 truncate">{usuario?.email}</p>
                    <div className="mt-1.5 inline-block">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isAdmin ? 'bg-[#FFF4CC] text-[#003064]' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {isAdmin ? 'Acesso Total (Admin)' : 'Somente Leitura'}
                      </span>
                    </div>
                  </div>

                  {/* Alternador Rápido de Papel (Para teste de permissões RBAC) */}
                  <div className="px-2 py-1.5 bg-slate-50 rounded-xl mb-2 text-xs">
                    <p className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#FCBC00]" />
                      Simular Papel (Demonstração):
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => {
                          trocarPerfil('administrador');
                          setMenuAberto(false);
                        }}
                        className={`py-1 px-2 text-[11px] rounded-lg font-medium text-center transition-all cursor-pointer ${
                          isAdmin 
                            ? 'bg-[#003064] text-white shadow-xs' 
                            : 'bg-white text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Administrador
                      </button>
                      <button
                        onClick={() => {
                          trocarPerfil('visualizador');
                          setMenuAberto(false);
                        }}
                        className={`py-1 px-2 text-[11px] rounded-lg font-medium text-center transition-all cursor-pointer ${
                          !isAdmin 
                            ? 'bg-[#003064] text-white shadow-xs' 
                            : 'bg-white text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Visualizador
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setMenuAberto(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair da Conta
                  </button>
                </div>
              </>
            )}
          </div>

        </div>

      </div>
    </header>
  );
};
