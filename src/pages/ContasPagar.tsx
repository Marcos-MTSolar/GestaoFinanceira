import React, { useState, useEffect, useMemo } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarMoeda, formatarDataBR, obterHojeISO } from '../utils/formatters';
import { Lancamento, ContaBancaria, Categoria, Contato } from '../types';
import { ModalPagarReceber } from '../components/ModalPagarReceber';
import {
  ArrowDownCircle,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  Plus,
  CheckSquare,
  Square,
  Check,
  Building,
  TrendingDown,
  Layers,
  Search,
  Filter
} from 'lucide-react';

interface ContasPagarProps {
  onNovoLancamento: () => void;
}

type GrupoVencimento = 'atrasadas' | 'hoje' | '7dias' | '30dias' | 'futuras';

export const ContasPagar: React.FC<ContasPagarProps> = ({ onNovoLancamento }) => {
  const { isAdmin } = useAuth();
  const { formatarValor } = usePrivacy();

  const [despesas, setDespesas] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);

  // Seleção para Pagamento em Lote
  const [selecionados, setSelecionados] = useState<string[]>([]);

  // Modal de Pagamento / Simulação
  const [modalPagarAberto, setModalPagarAberto] = useState(false);
  const [lancamentosParaPagar, setLancamentosParaPagar] = useState<Lancamento[]>([]);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroConta, setFiltroConta] = useState('todas');
  const [grupoAtivoAba, setGrupoAtivoAba] = useState<GrupoVencimento | 'todos'>('todos');

  const carregarDados = () => {
    const todos = dbService.getLancamentos();
    // Apenas despesas PENDENTES no módulo de Contas a Pagar
    setDespesas(todos.filter((l) => l.tipo === 'despesa' && l.status === 'pendente'));
    setContas(dbService.getContas());
    setCategorias(dbService.getCategorias());
    setContatos(dbService.getContatos());
  };

  useEffect(() => {
    carregarDados();
    const unsubL = subscribe('lancamentos', carregarDados);
    const unsubC = subscribe('contas', carregarDados);
    return () => {
      unsubL();
      unsubC();
    };
  }, []);

  const hoje = obterHojeISO();

  // Cálculo das datas limites para agrupamento
  const dataHojeObj = new Date(hoje + 'T12:00:00');

  const data7DiasObj = new Date(dataHojeObj);
  data7DiasObj.setDate(data7DiasObj.getDate() + 7);
  const iso7Dias = data7DiasObj.toISOString().split('T')[0];

  const data30DiasObj = new Date(dataHojeObj);
  data30DiasObj.setDate(data30DiasObj.getDate() + 30);
  const iso30Dias = data30DiasObj.toISOString().split('T')[0];

  // AGRUPAMENTO DE DESPESAS PENDENTES
  const grupos = useMemo(() => {
    const atrasadas: Lancamento[] = [];
    const hojeGrupo: Lancamento[] = [];
    const proximos7Dias: Lancamento[] = [];
    const proximos30Dias: Lancamento[] = [];
    const futuras: Lancamento[] = [];

    despesas.forEach((d) => {
      if (filtroConta !== 'todas' && d.conta_id !== filtroConta) return;
      if (busca) {
        const q = busca.toLowerCase();
        const descOk = d.descricao.toLowerCase().includes(q);
        const obsOk = d.observacoes?.toLowerCase().includes(q);
        if (!descOk && !obsOk) return;
      }

      const v = d.data_vencimento;
      if (v < hoje) {
        atrasadas.push(d);
      } else if (v === hoje) {
        hojeGrupo.push(d);
      } else if (v <= iso7Dias) {
        proximos7Dias.push(d);
      } else if (v <= iso30Dias) {
        proximos30Dias.push(d);
      } else {
        futuras.push(d);
      }
    });

    return {
      atrasadas,
      hoje: hojeGrupo,
      '7dias': proximos7Dias,
      '30dias': proximos30Dias,
      futuras,
    };
  }, [despesas, hoje, iso7Dias, iso30Dias, filtroConta, busca]);

  // Totais por grupo
  const totalAtrasadas = grupos.atrasadas.reduce((a, b) => a + b.valor, 0);
  const totalHoje = grupos.hoje.reduce((a, b) => a + b.valor, 0);
  const total7Dias = grupos['7dias'].reduce((a, b) => a + b.valor, 0);
  const total30Dias = grupos['30dias'].reduce((a, b) => a + b.valor, 0);
  const totalFuturas = grupos.futuras.reduce((a, b) => a + b.valor, 0);
  const totalGeralPendente = totalAtrasadas + totalHoje + total7Dias + total30Dias + totalFuturas;

  // Seleção de itens
  const handleToggleSelecionar = (id: string) => {
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelecionarTodosVisiveis = (itens: Lancamento[]) => {
    const idsVisiveis = itens.map((i) => i.id);
    const todosSelecionados = idsVisiveis.every((id) => selecionados.includes(id));
    if (todosSelecionados) {
      setSelecionados((prev) => prev.filter((id) => !idsVisiveis.includes(id)));
    } else {
      setSelecionados((prev) => Array.from(new Set([...prev, ...idsVisiveis])));
    }
  };

  // Abrir modal de pagamento individual
  const handlePagarIndividual = (l: Lancamento) => {
    setLancamentosParaPagar([l]);
    setModalPagarAberto(true);
  };

  // Abrir modal de pagamento em lote
  const handlePagarLote = () => {
    const alvos = despesas.filter((d) => selecionados.includes(d.id));
    if (alvos.length === 0) return;
    setLancamentosParaPagar(alvos);
    setModalPagarAberto(true);
  };

  const valorSelecionadoTotal = despesas
    .filter((d) => selecionados.includes(d.id))
    .reduce((acc, d) => acc + d.valor, 0);

  // Renderizar uma seção de grupo
  const renderSecaoGrupo = (
    titulo: string,
    subtitulo: string,
    lista: Lancamento[],
    corBorda: string,
    corBadge: string,
    iconeBadge: React.ReactNode
  ) => {
    if (lista.length === 0) return null;

    const todosDoGrupoSelecionados =
      lista.length > 0 && lista.every((item) => selecionados.includes(item.id));

    return (
      <div className={`bg-white rounded-2xl border ${corBorda} shadow-xs overflow-hidden`}>
        {/* Topo do Grupo */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleSelecionarTodosVisiveis(lista)}
                className="text-slate-500 hover:text-[#003064] cursor-pointer"
                title="Selecionar todos deste grupo"
              >
                {todosDoGrupoSelecionados ? (
                  <CheckSquare className="w-5 h-5 text-[#003064]" />
                ) : (
                  <Square className="w-5 h-5 text-slate-400" />
                )}
              </button>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-serif font-bold text-base text-[#003064]">
                  {titulo}
                </h4>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${corBadge}`}>
                  {iconeBadge}
                  <span>{lista.length} títulos</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500">{subtitulo}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total do grupo</span>
            <span className="font-serif font-extrabold text-base text-red-600">
              {formatarValor(lista.reduce((acc, i) => acc + i.valor, 0))}
            </span>
          </div>
        </div>

        {/* Tabela do Grupo */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-semibold border-b border-slate-200">
                {isAdmin && <th className="py-2.5 px-4 w-10">Sel.</th>}
                <th className="py-2.5 px-4">Descrição</th>
                <th className="py-2.5 px-4">Categoria</th>
                <th className="py-2.5 px-4">Conta Débito</th>
                <th className="py-2.5 px-4">Vencimento</th>
                <th className="py-2.5 px-4 text-right">Valor</th>
                <th className="py-2.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((d) => {
                const conta = contas.find((c) => c.id === d.conta_id);
                const cat = categorias.find((c) => c.id === d.categoria_id);
                const estaMarcado = selecionados.includes(d.id);
                const atrasoDias = Math.floor(
                  (new Date(hoje).getTime() - new Date(d.data_vencimento).getTime()) /
                    (1000 * 60 * 60 * 24)
                );

                return (
                  <tr
                    key={d.id}
                    className={`transition-colors ${
                      estaMarcado ? 'bg-amber-50/60' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    {isAdmin && (
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleToggleSelecionar(d.id)}
                          className="text-slate-400 hover:text-[#003064]"
                        >
                          {estaMarcado ? (
                            <CheckSquare className="w-4 h-4 text-[#003064]" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>
                    )}

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{d.descricao}</span>
                        {d.origem === 'folha' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Folha
                          </span>
                        )}
                      </div>
                      {d.observacoes && (
                        <div className="text-[10px] text-slate-400 italic truncate max-w-[200px]">
                          {d.observacoes}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold text-white shadow-2xs"
                        style={{ backgroundColor: cat?.cor || '#003064' }}
                      >
                        {cat?.nome || 'Despesa'}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                      {conta?.nome || '-'}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={d.data_vencimento < hoje ? 'text-red-600 font-bold' : 'text-slate-700'}>
                        {formatarDataBR(d.data_vencimento)}
                      </span>
                      {atrasoDias > 0 && (
                        <span className="text-[10px] text-red-600 font-bold block">
                          ({atrasoDias} {atrasoDias === 1 ? 'dia' : 'dias'} de atraso)
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap font-serif font-bold text-red-600 text-sm">
                      {formatarValor(d.valor)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {isAdmin && (
                        <button
                          onClick={() => handlePagarIndividual(d)}
                          type="button"
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-2xs border-b border-red-800 transition-all cursor-pointer flex items-center gap-1 ml-auto"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Pagar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const handleToggleToggleSelecionar = (id: string) => {
    handleToggleSelecionar(id);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Topo do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#003064] flex items-center gap-2">
            <ArrowDownCircle className="w-6 h-6 text-red-600" />
            Contas a Pagar – Gestão de Vencimentos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Despesas operacionais e aquisições de módulos/inversores organizadas por prazo de vencimento.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={onNovoLancamento}
            type="button"
            className="flex items-center gap-2 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2 rounded-xl font-semibold text-xs shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FCBC00]" />
            <span>Nova Despesa</span>
          </button>
        )}
      </div>

      {/* BARRA FIXA DE AÇÃO EM LOTE SE HOUVER SELECIONADOS */}
      {selecionados.length > 0 && isAdmin && (
        <div className="bg-[#003064] text-white p-4 rounded-2xl shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FCBC00] text-[#003064] flex items-center justify-center font-bold">
              {selecionados.length}
            </div>
            <div>
              <p className="font-bold text-sm">
                {selecionados.length} títulos selecionados para quitação
              </p>
              <p className="text-xs text-blue-200">
                Valor consolidado: <strong>{formatarValor(valorSelecionadoTotal)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelecionados([])}
              type="button"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold"
            >
              Desmarcar Todos
            </button>
            <button
              onClick={handlePagarLote}
              type="button"
              className="px-4 py-1.5 bg-[#FCBC00] hover:bg-amber-400 text-[#003064] rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Pagar Selecionados ({formatarValor(valorSelecionadoTotal)})</span>
            </button>
          </div>
        </div>
      )}

      {/* CARDS DOS 5 GRUPOS DE VENCIMENTO SOLICITADOS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        
        {/* 1. Atrasadas */}
        <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
          totalAtrasadas > 0 ? 'bg-red-50/80 border-red-300 ring-1 ring-red-200' : 'bg-white border-slate-200'
        }`}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 flex items-center justify-between">
            <span>Atrasadas</span>
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          </span>
          <p className="font-serif text-xl font-black text-red-600 mt-1">
            {formatarValor(totalAtrasadas)}
          </p>
          <span className="text-[10px] text-red-700/80 font-semibold block mt-0.5">
            {grupos.atrasadas.length} títulos vencidos
          </span>
        </div>

        {/* 2. Vence Hoje */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center justify-between">
            <span>Vence Hoje</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </span>
          <p className="font-serif text-xl font-black text-amber-700 mt-1">
            {formatarValor(totalHoje)}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {grupos.hoje.length} compromissos hoje
          </span>
        </div>

        {/* 3. Próximos 7 Dias */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center justify-between">
            <span>Próximos 7 Dias</span>
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
          </span>
          <p className="font-serif text-xl font-black text-blue-700 mt-1">
            {formatarValor(total7Dias)}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {grupos['7dias'].length} programados
          </span>
        </div>

        {/* 4. Próximos 30 Dias */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
            <span>Próximos 30 Dias</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </span>
          <p className="font-serif text-xl font-bold text-slate-800 mt-1">
            {formatarValor(total30Dias)}
          </p>
          <span className="text-[10px] text-slate-500 block mt-0.5">
            {grupos['30dias'].length} programados
          </span>
        </div>

        {/* 5. Futuras (> 30 dias) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Futuras (&gt; 30 dias)</span>
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </span>
          <p className="font-serif text-xl font-bold text-slate-700 mt-1">
            {formatarValor(totalFuturas)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {grupos.futuras.length} a longo prazo
          </span>
        </div>

      </div>

      {/* FILTROS RÁPIDOS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar despesa..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={filtroConta}
            onChange={(e) => setFiltroConta(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white w-full sm:w-auto"
          >
            <option value="todas">Todas as Contas de Saída</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* SEÇÕES AGRUPADAS */}
      <div className="space-y-6">
        {renderSecaoGrupo(
          'Despesas Vencidas / Atrasadas',
          'Títulos que já ultrapassaram a data de vencimento. Risco de encargos e juros moratórios.',
          grupos.atrasadas,
          'border-red-300',
          'bg-red-100 text-red-800',
          <AlertTriangle className="w-3 h-3 text-red-600" />
        )}

        {renderSecaoGrupo(
          'Vencem Hoje',
          'Títulos com vencimento na data de hoje. Prioridade máxima para liquidação.',
          grupos.hoje,
          'border-amber-300',
          'bg-amber-100 text-amber-800',
          <Clock className="w-3 h-3 text-amber-600" />
        )}

        {renderSecaoGrupo(
          'Próximos 7 Dias',
          'Compromissos agendados para a próxima semana.',
          grupos['7dias'],
          'border-blue-200',
          'bg-blue-50 text-[#003064]',
          <Calendar className="w-3 h-3 text-[#1A4A85]" />
        )}

        {renderSecaoGrupo(
          'Próximos 30 Dias',
          'Compromissos agendados para o mês vigente.',
          grupos['30dias'],
          'border-slate-200',
          'bg-slate-100 text-slate-700',
          <Calendar className="w-3 h-3 text-slate-500" />
        )}

        {renderSecaoGrupo(
          'Contas Futuras (> 30 dias)',
          'Parcelamentos de longo prazo e fornecimentos contratados.',
          grupos.futuras,
          'border-slate-200',
          'bg-slate-100 text-slate-600',
          <Calendar className="w-3 h-3 text-slate-400" />
        )}

        {despesas.length === 0 && (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#16A34A] mx-auto mb-3" />
            <h3 className="font-serif text-lg font-bold text-[#003064]">
              Tudo em dia! Nenhuma despesa pendente
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Todos os títulos a pagar foram devidamente liquidados em conta.
            </p>
          </div>
        )}
      </div>

      {/* MODAL COM SIMULAÇÃO ANTES DE PAGAR */}
      <ModalPagarReceber
        isOpen={modalPagarAberto}
        onClose={() => setModalPagarAberto(false)}
        lancamentosAlvo={lancamentosParaPagar}
        tipoOperacao="pagar"
        onSucesso={() => {
          carregarDados();
          setSelecionados([]);
        }}
      />

    </div>
  );
};
