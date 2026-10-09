import React, { useState, useEffect } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarMoeda, formatarDataBR, formatarCpfCnpj } from '../utils/formatters';
import { Projeto, StatusProjeto, Lancamento } from '../types';
import { Modal } from '../components/Modal';
import {
  SunMedium,
  Plus,
  Edit2,
  Trash2,
  Zap,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Percent,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  FolderOpen,
  Receipt,
  Layers,
  ArrowLeft,
  Briefcase
} from 'lucide-react';

export const Projetos: React.FC = () => {
  const { isAdmin } = useAuth();
  const { formatarValor } = usePrivacy();

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [projetoSelecionadoId, setProjetoSelecionadoId] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Modal de Cadastro/Edição
  const [modalAberto, setModalAberto] = useState(false);
  const [projetoEditando, setProjetoEditando] = useState<Projeto | null>(null);

  // Formulário
  const [nome, setNome] = useState('');
  const [cliente, setCliente] = useState('');
  const [valorContratado, setValorContratado] = useState('');
  const [potenciaKwp, setPotenciaKwp] = useState('');
  const [status, setStatus] = useState<StatusProjeto>('em_andamento');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataPrevisaoFim, setDataPrevisaoFim] = useState('');

  const carregarDados = () => {
    setProjetos(dbService.getProjetos());
  };

  useEffect(() => {
    carregarDados();
    const unsubP = subscribe('projetos', carregarDados);
    const unsubL = subscribe('lancamentos', carregarDados);
    return () => {
      unsubP();
      unsubL();
    };
  }, []);

  const abrirModalNovo = () => {
    setProjetoEditando(null);
    setNome('');
    setCliente('');
    setValorContratado('');
    setPotenciaKwp('10.0');
    setStatus('em_andamento');
    setDataInicio(new Date().toISOString().split('T')[0]);
    setDataPrevisaoFim('');
    setModalAberto(true);
  };

  const abrirModalEditar = (p: Projeto, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProjetoEditando(p);
    setNome(p.nome);
    setCliente(p.cliente);
    setValorContratado(String(p.valor_contratado));
    setPotenciaKwp(String(p.potencia_kwp || 0));
    setStatus(p.status);
    setDataInicio(p.data_inicio);
    setDataPrevisaoFim(p.data_previsao_fim || '');
    setModalAberto(true);
  };

  const salvarProjeto = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const novoOuAtualizado: Projeto = {
      id: projetoEditando ? projetoEditando.id : 'proj-' + Date.now(),
      nome: nome.trim(),
      cliente: cliente.trim(),
      valor_contratado: Number(valorContratado) || 0,
      potencia_kwp: Number(potenciaKwp) || 0,
      status,
      data_inicio: dataInicio,
      data_previsao_fim: dataPrevisaoFim,
    };

    dbService.saveProjeto(novoOuAtualizado);
    setModalAberto(false);
  };

  const excluirProjeto = (id: string, nomeProj: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (confirm(`Deseja remover o projeto "${nomeProj}"?`)) {
      dbService.deleteProjeto(id);
      if (projetoSelecionadoId === id) {
        setProjetoSelecionadoId(null);
      }
    }
  };

  // Resumo Geral Consolidado
  const resumoGeralProjetos = dbService.obterResumoTodosProjetos();

  // Filtragem da lista
  const projetosFiltrados = projetos.filter(p => {
    if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;
    if (busca) {
      const q = busca.toLowerCase();
      const nomeMatch = p.nome.toLowerCase().includes(q);
      const clienteMatch = p.cliente.toLowerCase().includes(q);
      if (!nomeMatch && !clienteMatch) return false;
    }
    return true;
  });

  // Ficha do projeto selecionado
  const fichaAtiva = projetoSelecionadoId 
    ? dbService.obterFichaProjeto(projetoSelecionadoId) 
    : null;

  return (
    <div className="space-y-6 pb-16">
      
      {/* SEÇÃO TOPO */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-[#003064] text-[#FCBC00]">
              <SunMedium className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-[#1A4A85] uppercase tracking-wider">
              Contratos & Usinas Fotovoltaicas
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#003064] mt-1">
            Projetos, Obras & Lucratividade Solar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestão financeira de obras: valor contratado, recebimentos, custos de materiais e mão de obra, margem e lucratividade.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {projetoSelecionadoId && (
            <button
              onClick={() => setProjetoSelecionadoId(null)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs border border-slate-200 bg-white hover:bg-slate-50 text-[#003064] transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar aos Projetos</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={abrirModalNovo}
              className="flex items-center gap-2 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FCBC00]" />
              <span>+ Novo Projeto Solar</span>
            </button>
          )}
        </div>
      </div>

      {/* SE VISUALIZANDO FICHA DETALHADA DO PROJETO */}
      {fichaAtiva ? (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Cabeçalho da Ficha */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                    fichaAtiva.projeto.status === 'concluido'
                      ? 'bg-emerald-100 text-emerald-800'
                      : fichaAtiva.projeto.status === 'em_andamento'
                      ? 'bg-[#FFF4CC] text-[#003064] border border-[#FCBC00]/40'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {fichaAtiva.projeto.status === 'concluido'
                      ? 'Concluído'
                      : fichaAtiva.projeto.status === 'em_andamento'
                      ? 'Em Andamento'
                      : 'Orçamento'}
                  </span>
                  <span className="text-xs text-slate-400">ID: {fichaAtiva.projeto.id}</span>
                </div>
                <h2 className="font-serif text-2xl font-bold text-[#003064]">
                  {fichaAtiva.projeto.nome}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 mt-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Cliente: <strong className="text-slate-800">{fichaAtiva.projeto.cliente}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#FCBC00]" />
                    Potência: <strong>{fichaAtiva.projeto.potencia_kwp || 0} kWp</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Início: {formatarDataBR(fichaAtiva.projeto.data_inicio)}
                    {fichaAtiva.projeto.data_previsao_fim && ` | Previsão: ${formatarDataBR(fichaAtiva.projeto.data_previsao_fim)}`}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => abrirModalEditar(fichaAtiva.projeto)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#003064] transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar Contrato</span>
                  </button>
                  <button
                    onClick={() => excluirProjeto(fichaAtiva.projeto.id, fichaAtiva.projeto.nome)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              )}
            </div>

            {/* Barra de Progresso "Recebido x Contratado" */}
            <div className="mt-5 bg-[#F5F7FA] p-4 rounded-xl border border-slate-200/70">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-[#003064]">
                  Progresso do Faturamento: <strong className="text-emerald-700">{formatarValor(fichaAtiva.receitasPagas)}</strong> recebido de <strong className="text-slate-800">{formatarValor(fichaAtiva.valorContratado)}</strong> contratado
                </span>
                <span className="font-bold text-[#003064] bg-[#FFF4CC] px-2 py-0.5 rounded-md border border-[#FCBC00]/30">
                  {fichaAtiva.percentualRecebido}%
                </span>
              </div>
              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${fichaAtiva.percentualRecebido}%` }}
                  title={`Recebido: ${fichaAtiva.percentualRecebido}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                <span>Recebido: {formatarValor(fichaAtiva.receitasPagas)}</span>
                <span>A Receber: {formatarValor(fichaAtiva.receitaAReceber)}</span>
              </div>
            </div>

            {/* 4 Cards de Resumo da Ficha */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Valor Contratado</span>
                <p className="font-serif text-xl font-bold text-[#003064] mt-0.5">
                  {formatarValor(fichaAtiva.valorContratado)}
                </p>
                <span className="text-[11px] text-emerald-700 font-medium">
                  {formatarValor(fichaAtiva.receitasPagas)} recebido
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Custos da Obra</span>
                <p className="font-serif text-xl font-bold text-red-600 mt-0.5">
                  {formatarValor(fichaAtiva.custosRealizados)}
                </p>
                <span className="text-[11px] text-slate-500">
                  + {formatarValor(fichaAtiva.custosPendentes)} pendentes
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Lucro Realizado (Caixa)</span>
                <p className={`font-serif text-xl font-bold mt-0.5 ${fichaAtiva.lucroRealizado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatarValor(fichaAtiva.lucroRealizado)}
                </p>
                <span className="text-[11px] font-semibold text-emerald-700">
                  Margem: {fichaAtiva.margemRealizada}%
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Lucro Previsto Final</span>
                <p className={`font-serif text-xl font-bold mt-0.5 ${fichaAtiva.lucroPrevisto >= 0 ? 'text-[#1A4A85]' : 'text-red-600'}`}>
                  {formatarValor(fichaAtiva.lucroPrevisto)}
                </p>
                <span className="text-[11px] font-semibold text-[#1A4A85]">
                  Margem Prevista: {fichaAtiva.margemPrevista}%
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Lançamentos Vinculados a este Projeto */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#003064]">
                  Lançamentos Financeiros Vinculados
                </h3>
                <p className="text-xs text-slate-500">
                  Todos os recebimentos do contrato e custos da obra (equipamentos, módulos, mão de obra, fretes).
                </p>
              </div>
              <span className="text-xs font-bold text-[#003064] bg-[#F5F7FA] px-3 py-1.5 rounded-lg border border-slate-200">
                {fichaAtiva.lancamentos.length} lançamentos
              </span>
            </div>

            {fichaAtiva.lancamentos.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Receipt className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-sm">Nenhum lançamento vinculado a esta obra até o momento.</p>
                <p className="text-xs mt-1">Ao criar uma despesa ou receita em Lançamentos, selecione este projeto.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-[#F5F7FA] text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4">Vencimento</th>
                      <th className="py-3 px-4">Pagamento</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {fichaAtiva.lancamentos.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 font-bold text-[10px] uppercase px-2 py-0.5 rounded-md ${
                            l.tipo === 'receita'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {l.tipo === 'receita' ? (
                              <ArrowUpRight className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3 text-red-600" />
                            )}
                            {l.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">
                          {l.descricao}
                        </td>
                        <td className="py-3 px-4">{formatarDataBR(l.data_vencimento)}</td>
                        <td className="py-3 px-4">
                          {l.data_pagamento ? formatarDataBR(l.data_pagamento) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            l.status === 'pago'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {l.status}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-serif font-bold text-sm ${
                          l.tipo === 'receita' ? 'text-emerald-700' : 'text-red-600'
                        }`}>
                          {l.tipo === 'receita' ? '+' : '-'}{formatarValor(l.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* LISTAGEM DOS PROJETOS (CARDS COM BARRA DE PROGRESSO E MÉTRICAS) */
        <div className="space-y-6">
          
          {/* 4 Cards Consolidados de Topo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Contratos Globais
              </span>
              <p className="font-serif text-2xl font-extrabold text-[#003064] mt-1">
                {formatarValor(resumoGeralProjetos.totalContratado)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {projetos.length} obras cadastradas
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Faturado / Recebido
              </span>
              <p className="font-serif text-2xl font-extrabold text-[#16A34A] mt-1">
                {formatarValor(resumoGeralProjetos.totalRecebido)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                A receber: {formatarValor(resumoGeralProjetos.totalAReceber)}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Custos Totais Realizados
              </span>
              <p className="font-serif text-2xl font-extrabold text-red-600 mt-1">
                {formatarValor(resumoGeralProjetos.totalCustosRealizados)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Inversores, módulos, cabos e serviços
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Lucro Realizado & Margem
              </span>
              <p className="font-serif text-2xl font-extrabold text-[#1A4A85] mt-1">
                {formatarValor(resumoGeralProjetos.totalLucroRealizado)}
              </p>
              <p className="text-[11px] font-bold text-emerald-700 mt-0.5">
                Margem Média: {resumoGeralProjetos.margemMediaRealizada}%
              </p>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar projeto ou cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#003064] focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-[#003064] text-slate-700 w-full sm:w-auto"
              >
                <option value="todos">Todos os Status</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluídos</option>
                <option value="orcamento">Em Orçamento</option>
              </select>
            </div>
          </div>

          {/* Grid de Projetos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projetosFiltrados.map((proj) => {
              const ficha = dbService.obterFichaProjeto(proj.id)!;
              return (
                <div
                  key={proj.id}
                  onClick={() => setProjetoSelecionadoId(proj.id)}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group hover:border-[#1A4A85]/50"
                >
                  <div>
                    {/* Topo do Card */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        proj.status === 'concluido'
                          ? 'bg-emerald-100 text-emerald-800'
                          : proj.status === 'em_andamento'
                          ? 'bg-[#FFF4CC] text-[#003064] border border-[#FCBC00]/40'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {proj.status === 'concluido'
                          ? 'Concluído'
                          : proj.status === 'em_andamento'
                          ? 'Em Andamento'
                          : 'Orçamento'}
                      </span>

                      {isAdmin && (
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={(e) => abrirModalEditar(proj, e)}
                            className="p-1.5 text-slate-400 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => excluirProjeto(proj.id, proj.nome, e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="font-serif font-bold text-base text-[#003064] group-hover:text-[#1A4A85] transition-colors mb-1 leading-snug">
                      {proj.nome}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{proj.cliente}</span>
                    </div>

                    {/* Barra de Progresso "Recebido x Contratado" */}
                    <div className="bg-[#F5F7FA] p-3 rounded-xl mb-3 border border-slate-100">
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="font-semibold text-slate-600">Recebido x Contratado</span>
                        <span className="font-bold text-[#003064]">{ficha.percentualRecebido}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${ficha.percentualRecebido}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
                        <span>Recebido: {formatarValor(ficha.receitasPagas)}</span>
                        <span>A Receber: {formatarValor(ficha.receitaAReceber)}</span>
                      </div>
                    </div>

                    {/* Métricas do Projeto */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs mb-3">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-medium">Contrato</span>
                        <span className="font-serif font-bold text-[#003064]">
                          {formatarValor(proj.valor_contratado)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-medium">Custos Obra</span>
                        <span className="font-bold text-red-600">
                          {formatarValor(ficha.custosRealizados)}
                        </span>
                      </div>
                      <div className="mt-1 pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] uppercase text-slate-400 block font-medium">Lucro Realizado</span>
                        <span className={`font-bold ${ficha.lucroRealizado >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                          {formatarValor(ficha.lucroRealizado)}
                        </span>
                      </div>
                      <div className="mt-1 pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] uppercase text-slate-400 block font-medium">Margem</span>
                        <span className="font-bold text-emerald-700">
                          {ficha.margemRealizada}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[#FCBC00]" />
                      {proj.potencia_kwp || 0} kWp
                    </span>
                    <span className="text-[#1A4A85] font-semibold flex items-center gap-1 group-hover:underline">
                      Ver Ficha Completa →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {projetosFiltrados.length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
              <SunMedium className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="text-base font-semibold text-slate-600">Nenhum projeto encontrado</p>
              <p className="text-xs mt-1">Ajuste os filtros de busca ou cadastre uma nova usina solar.</p>
            </div>
          )}

        </div>
      )}

      {/* Modal Cadastro/Edição de Projeto */}
      <Modal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={projetoEditando ? 'Editar Projeto Fotovoltaico' : 'Novo Projeto Fotovoltaico'}
        subtitle="Vincule contratos de usinas aos lançamentos e relatórios financeiros"
      >
        <form onSubmit={salvarProjeto} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Projeto / Obra *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Instalação 75 kWp – Fazenda Boa Esperança"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cliente Responsável *
              </label>
              <input
                type="text"
                required
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Nome do cliente ou empresa"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Potência do Sistema (kWp)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={potenciaKwp}
                onChange={(e) => setPotenciaKwp(e.target.value)}
                placeholder="Ex: 50.0"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Total Contratado (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={valorContratado}
                onChange={(e) => setValorContratado(e.target.value)}
                placeholder="0,00"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status da Obra
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusProjeto)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-none"
              >
                <option value="orcamento">Em Orçamento / Proposta</option>
                <option value="em_andamento">Em Andamento / Execução</option>
                <option value="concluido">Concluído / Homologado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Início
              </label>
              <input
                type="date"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Previsão de Conclusão
              </label>
              <input
                type="date"
                value={dataPrevisaoFim}
                onChange={(e) => setDataPrevisaoFim(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalAberto(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#003064] hover:bg-[#00204A] rounded-xl shadow-xs border-b-2 border-[#FCBC00] transition-colors cursor-pointer"
            >
              Salvar Projeto
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
