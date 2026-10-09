import React, { useState, useEffect, useMemo } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarMoeda, formatarDataBR, estaAtrasado, obterHojeISO } from '../utils/formatters';
import { Lancamento, ContaBancaria } from '../types';
import { CaixaCard } from '../components/CaixaCard';
import { ModalPagarReceber } from '../components/ModalPagarReceber';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Clock,
  Landmark,
  SunMedium,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  ShieldAlert,
  Calendar,
  Sparkles,
  Users,
  ChevronRight,
  CheckSquare,
  ArrowRight,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  ReceiptText,
  Filter,
  DollarSign
} from 'lucide-react';

interface DashboardProps {
  onNavegar: (pagina: any) => void;
  onAbrirNovoLancamento: () => void;
}

type FiltroPeriodoTipo = 'mes_atual' | 'mes_anterior' | '3_meses' | 'ano' | 'personalizado';
type HorizonteProjecao = 30 | 60 | 90;

export const Dashboard: React.FC<DashboardProps> = ({
  onNavegar,
  onAbrirNovoLancamento,
}) => {
  const { usuario } = useAuth();
  const { formatarValor } = usePrivacy();

  // FILTRO DE PERÍODO GERAL
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodoTipo>('mes_atual');
  const [dataInicioPersonalizada, setDataInicioPersonalizada] = useState('');
  const [dataFimPersonalizada, setDataFimPersonalizada] = useState('');

  // HORIZONTE DA PROJEÇÃO DE SALDO REAL
  const [diasProjecao, setDiasProjecao] = useState<HorizonteProjecao>(30);
  const [contaProjecaoId, setContaProjecaoId] = useState<string>('todas');

  // ALTERNADOR DO GRÁFICO 6 vs 12 MESES
  const [numMesesGrafico, setNumMesesGrafico] = useState<6 | 12>(6);

  // MODAL DE PAGAMENTO / RECEBIMENTO RÁPIDO
  const [modalLiquidarAberto, setModalLiquidarAberto] = useState(false);
  const [lancamentoParaLiquidar, setLancamentoParaLiquidar] = useState<Lancamento[]>([]);
  const [tipoOperacaoModal, setTipoOperacaoModal] = useState<'pagar' | 'receber'>('pagar');

  // DADOS REATIVOS
  const [resumoGeral, setResumoGeral] = useState(dbService.calcularResumoGeral());
  const [contas, setContas] = useState<ContaBancaria[]>(dbService.getContas().filter(c => c.ativa));
  const [proximosVencimentos, setProximosVencimentos] = useState<Lancamento[]>([]);
  const [ultimosLancamentos, setUltimosLancamentos] = useState<Lancamento[]>([]);
  const [resumoFolha, setResumoFolha] = useState(dbService.obterResumoFolha());

  const carregarDados = () => {
    setResumoGeral(dbService.calcularResumoGeral());
    setContas(dbService.getContas().filter(c => c.ativa));
    setProximosVencimentos(dbService.obterProximosVencimentos(8));
    setUltimosLancamentos(dbService.obterUltimosLancamentos(6));
    setResumoFolha(dbService.obterResumoFolha());
  };

  useEffect(() => {
    carregarDados();
    const unsubL = subscribe('lancamentos', carregarDados);
    const unsubC = subscribe('contas', carregarDados);
    const unsubConf = subscribe('configuracoes', carregarDados);

    return () => {
      unsubL();
      unsubC();
      unsubConf();
    };
  }, []);

  // RESUMO OPERACIONAL DO PERÍODO
  const resumoOperacional = useMemo(() => {
    return dbService.calcularResumoPainel(
      filtroPeriodo,
      dataInicioPersonalizada,
      dataFimPersonalizada
    );
  }, [filtroPeriodo, dataInicioPersonalizada, dataFimPersonalizada, resumoGeral]);

  // PROJEÇÃO DE SALDO REAL PARA 30 / 60 / 90 DIAS
  const projecao = useMemo(() => {
    return dbService.calcularProjecaoSaldoReal(diasProjecao, contaProjecaoId);
  }, [diasProjecao, contaProjecaoId, resumoGeral]);

  // DADOS DOS GRÁFICOS
  const dadosGraficoBarras = useMemo(() => {
    return dbService.obterDadosGrafico6e12Meses(numMesesGrafico);
  }, [numMesesGrafico, resumoGeral]);

  const dadosDespesasCategoria = useMemo(() => {
    return dbService.obterDespesasPorCategoria(
      resumoOperacional.resultadoPeriodo.dataIni,
      resumoOperacional.resultadoPeriodo.dataFim
    );
  }, [resumoOperacional, resumoGeral]);

  const dadosFluxoDiario = useMemo(() => {
    const hoje = new Date();
    const mesAtualIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    return dbService.obterFluxoDiarioMes(mesAtualIso);
  }, [resumoGeral]);

  // BLOCO CAIXA CONSOLIDADO
  const resumoConsolidado = {
    saldo_real: resumoGeral.saldoRealTotal,
    limite_cheque_total: resumoGeral.limiteChequeTotal,
    cheque_especial_utilizado: resumoGeral.chequeEspecialUsadoTotal,
    cheque_especial_disponivel: resumoGeral.chequeDisponivelTotal,
    saldo_disponivel_total: resumoGeral.saldoDisponivelTotal,
    usando_cheque_especial: resumoGeral.usandoChequeEspecialTotal,
    percentual_cheque_usado: resumoGeral.percentualChequeUsadoTotal,
    alerta_critico_cheque: resumoGeral.alertaCriticoChequeTotal,
    custo_juros_mensal_estimado: resumoGeral.custoJurosMensalTotal,
    custo_juros_diario_estimado: resumoGeral.custoJurosDiarioTotal,
  };

  // SAUDAÇÃO & DATA FORMATADA POR EXTENSO
  const dataHojeExtenso = useMemo(() => {
    const hoje = new Date();
    const formato = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(hoje);
    return formato.charAt(0).toUpperCase() + formato.slice(1);
  }, []);

  const primeiroNome = usuario?.nome ? usuario.nome.split(' ')[0] : 'Gestor';

  // ABRIR MODAL RÁPIDO DE PAGAR/RECEBER
  const handleAbrirLiquidar = (l: Lancamento) => {
    setLancamentoParaLiquidar([l]);
    setTipoOperacaoModal(l.tipo === 'despesa' ? 'pagar' : 'receber');
    setModalLiquidarAberto(true);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. TOPO: SAUDAÇÃO COM O NOME DO USUÁRIO E DATA DE HOJE */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FCBC00] animate-pulse" />
            <span className="text-[11px] font-bold text-[#1A4A85] uppercase tracking-wider">
              MT Solar – Energia Renovável • Gestão Financeira
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#003064] mt-1">
            Olá, {usuario?.nome || 'Aurélio Marcos'}!
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#FCBC00]" />
            <span>Hoje é <strong>{dataHojeExtenso}</strong></span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onAbrirNovoLancamento}
            className="flex items-center gap-2 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#FCBC00]" />
            <span>+ Novo Lançamento</span>
          </button>
          
          <button
            onClick={() => onNavegar('contas')}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-[#003064] px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-colors cursor-pointer border border-slate-200"
          >
            <Landmark className="w-4 h-4 text-[#1A4A85]" />
            <span>Ver Contas & Extrato</span>
          </button>
        </div>
      </div>

      {/* 2. TOPO: BLOCO "CAIXA" CONSOLIDADO (COMPONENTE REUTILIZÁVEL BEM DESTACADO) */}
      <section aria-label="Caixa Consolidado">
        <CaixaCard
          titulo="Caixa Consolidado MT Solar"
          subtitulo="Posição patrimonial em tempo real de todas as contas ativas (Dinheiro real da empresa vs Limite de cheque especial bancário)"
          resumo={resumoConsolidado}
          isConsolidado={true}
          onClickExtrato={() => onNavegar('contas')}
          onTransferir={() => onNavegar('contas')}
        />
      </section>

      {/* 3. BARRA DE FILTRO DE PERÍODO (mês atual, mês anterior, 3 meses, ano, personalizado) */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#003064]">
          <Filter className="w-4 h-4 text-[#FCBC00]" />
          <span>Filtro de Período do Painel:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: 'mes_atual', label: 'Mês Atual' },
              { id: 'mes_anterior', label: 'Mês Anterior' },
              { id: '3_meses', label: 'Últimos 3 Meses' },
              { id: 'ano', label: 'Ano Atual' },
              { id: 'personalizado', label: 'Personalizado' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setFiltroPeriodo(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                filtroPeriodo === item.id
                  ? 'bg-[#003064] text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filtroPeriodo === 'personalizado' && (
          <div className="flex items-center gap-2 text-xs pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <input
              type="date"
              value={dataInicioPersonalizada}
              onChange={(e) => setDataInicioPersonalizada(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg"
            />
            <span className="text-slate-400">até</span>
            <input
              type="date"
              value={dataFimPersonalizada}
              onChange={(e) => setDataFimPersonalizada(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg"
            />
          </div>
        )}
      </div>

      {/* 4. CARTÕES DE RESUMO: A RECEBER (7 e 30d), A PAGAR (7 e 30d), RESULTADO DO MÊS, CONTAS ATRASADAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD A: A RECEBER (7 e 30 dias) */}
        <div 
          onClick={() => onNavegar('receber')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              A Receber Previsto
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-[#16A34A] group-hover:bg-[#16A34A] group-hover:text-white transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2 mt-1">
            <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
              <div className="flex justify-between items-center text-[10px] text-emerald-800 font-semibold uppercase">
                <span>Próximos 7 dias</span>
                <span className="bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded-full text-[9px]">
                  {resumoOperacional.aReceber7Dias.quantidade} títulos
                </span>
              </div>
              <p className="font-serif font-black text-lg text-emerald-700 mt-0.5">
                {formatarValor(resumoOperacional.aReceber7Dias.valor)}
              </p>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600 px-1">
              <span>Próximos 30 dias:</span>
              <strong className="font-serif text-[#003064]">
                {formatarValor(resumoOperacional.aReceber30Dias.valor)}
              </strong>
            </div>
          </div>
        </div>

        {/* CARD B: A PAGAR (7 e 30 dias) */}
        <div 
          onClick={() => onNavegar('pagar')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs hover:border-red-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              A Pagar Previsto
            </span>
            <div className="p-2 rounded-xl bg-red-50 text-[#DC2626] group-hover:bg-[#DC2626] group-hover:text-white transition-colors">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2 mt-1">
            <div className="bg-red-50/60 p-2.5 rounded-xl border border-red-100">
              <div className="flex justify-between items-center text-[10px] text-red-800 font-semibold uppercase">
                <span>Próximos 7 dias</span>
                <span className="bg-red-200/70 text-red-900 px-1.5 py-0.2 rounded-full text-[9px]">
                  {resumoOperacional.aPagar7Dias.quantidade} títulos
                </span>
              </div>
              <p className="font-serif font-black text-lg text-red-600 mt-0.5">
                {formatarValor(resumoOperacional.aPagar7Dias.valor)}
              </p>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-600 px-1">
              <span>Próximos 30 dias:</span>
              <strong className="font-serif text-[#003064]">
                {formatarValor(resumoOperacional.aPagar30Dias.valor)}
              </strong>
            </div>
          </div>
        </div>

        {/* CARD C: RESULTADO DO MÊS / PERÍODO (receitas pagas − despesas pagas) */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Resultado do Período
              </span>
              <div className={`p-2 rounded-xl ${
                resumoOperacional.resultadoPeriodo.resultado >= 0
                  ? 'bg-emerald-50 text-[#16A34A]'
                  : 'bg-red-50 text-[#DC2626]'
              }`}>
                {resumoOperacional.resultadoPeriodo.resultado >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </div>
            </div>

            <div className={`font-serif text-2xl font-black mt-1 ${
              resumoOperacional.resultadoPeriodo.resultado >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
            }`}>
              {formatarValor(resumoOperacional.resultadoPeriodo.resultado)}
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Receitas pagas − Despesas pagas
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-600">
              <span>Receitas realizadas:</span>
              <span className="font-semibold text-emerald-700 font-serif">
                {formatarValor(resumoOperacional.resultadoPeriodo.receitasPagas)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Despesas quitadas:</span>
              <span className="font-semibold text-red-600 font-serif">
                {formatarValor(resumoOperacional.resultadoPeriodo.despesasPagas)}
              </span>
            </div>
          </div>
        </div>

        {/* CARD D: CONTAS ATRASADAS (quantidade e valor) */}
        <div 
          onClick={() => onNavegar(resumoOperacional.contasAtrasadas.aPagar.quantidade > 0 ? 'pagar' : 'receber')}
          className={`rounded-2xl p-4 sm:p-5 border shadow-xs cursor-pointer transition-all ${
            resumoOperacional.contasAtrasadas.aPagar.quantidade > 0
              ? 'bg-red-50/70 border-red-300 hover:border-red-400'
              : 'bg-white border-slate-200/90 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Contas Atrasadas
            </span>
            <div className={`p-2 rounded-xl ${
              resumoOperacional.contasAtrasadas.aPagar.quantidade > 0
                ? 'bg-red-200 text-red-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="font-serif text-2xl font-black text-red-700 mt-1">
            {formatarValor(resumoOperacional.contasAtrasadas.aPagar.valor)}
          </div>
          <span className="text-[11px] font-bold text-red-800 mt-0.5 block">
            {resumoOperacional.contasAtrasadas.aPagar.quantidade} {resumoOperacional.contasAtrasadas.aPagar.quantidade === 1 ? 'despesa vencida' : 'despesas vencidas'}
          </span>

          <div className="mt-3 pt-2.5 border-t border-red-200/60 flex items-center justify-between text-[11px] text-slate-600">
            <span>Inadimplência de Clientes:</span>
            <span className="font-bold text-amber-800 font-serif">
              {formatarValor(resumoOperacional.contasAtrasadas.aReceber.valor)} ({resumoOperacional.contasAtrasadas.aReceber.quantidade})
            </span>
          </div>
        </div>

      </div>

      {/* 5. PROJEÇÃO DE SALDO REAL PARA 30/60/90 DIAS (REQUISITO CRÍTICO) */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
        
        {/* Cabeçalho da Projeção */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#003064] text-[#FCBC00]">
                <Activity className="w-4 h-4" />
              </span>
              <h3 className="font-serif font-bold text-lg text-[#003064]">
                Projeção de Saldo Real (Fluxo Projetado de Caixa)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Simulação dia a dia do saldo próprio da empresa, considerando todas as receitas e despesas pendentes.
            </p>
          </div>

          {/* Controles de Projeção */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Conta */}
            <select
              value={contaProjecaoId}
              onChange={(e) => setContaProjecaoId(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-700"
            >
              <option value="todas">Consolidado (Todas as contas)</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>

            {/* Seletor de Horizonte: 30 / 60 / 90 dias */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              {([30, 60, 90] as HorizonteProjecao[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDiasProjecao(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    diasProjecao === d
                      ? 'bg-[#003064] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ALERTA OBRIGATÓRIO CONFORME ESPECIFICAÇÃO:
            "Se a projeção ficar negativa, mostrar o aviso:
            'Seu saldo real ficará negativo em dd/mm, usando R$ X do cheque especial'"
        */}
        {projecao.ficaraNegativo && projecao.avisoChequeEspecial && (
          <div className="p-4 rounded-xl bg-red-50 border-2 border-red-400 text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-red-800">
                  {projecao.avisoChequeEspecial}
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  Previsão identificada com base nos vencimentos programados da MT Solar. Antecipe recebíveis fotovoltaicos ou renegocie faturamentos para manter o saldo positivo.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavegar('receber')}
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-2xs transition-colors cursor-pointer"
            >
              Antecipar Recebíveis
            </button>
          </div>
        )}

        {/* Resumo Numérico da Projeção */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F5F7FA] p-3 rounded-xl border border-slate-200/80 text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Saldo Atual de Partida</span>
            <strong className={`font-serif text-sm ${projecao.saldoInicial >= 0 ? 'text-[#003064]' : 'text-red-600'}`}>
              {formatarValor(projecao.saldoInicial)}
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Ponto Mais Crítico</span>
            <strong className={`font-serif text-sm ${projecao.minimoSaldoProjetado >= 0 ? 'text-[#16A34A]' : 'text-red-600'}`}>
              {formatarValor(projecao.minimoSaldoProjetado)}
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Maior Uso de Limite</span>
            <strong className={`font-serif text-sm ${projecao.maiorUsoCheque > 0 ? 'text-amber-800' : 'text-slate-600'}`}>
              {formatarValor(projecao.maiorUsoCheque)}
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Saldo Projetado Final</span>
            <strong className={`font-serif text-sm ${projecao.saldoFinalProjetado >= 0 ? 'text-[#16A34A]' : 'text-red-600'}`}>
              {formatarValor(projecao.saldoFinalProjetado)}
            </strong>
          </div>
        </div>

        {/* Gráfico de Linha (Recharts) */}
        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={projecao.pontos}
              margin={{ top: 10, right: 15, left: 15, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="dataLabel"
                tick={{ fontSize: 11, fill: '#64748B' }}
                interval={Math.ceil(diasProjecao / 10)}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748B' }}
                tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#00204A] text-white p-3 rounded-xl shadow-lg border border-slate-700 text-xs space-y-1">
                        <p className="font-bold text-[#FCBC00]">{formatarDataBR(data.data)} ({data.dataLabel})</p>
                        <p className="flex justify-between gap-4">
                          <span className="text-slate-300">Saldo Real Projetado:</span>
                          <strong className={data.saldoProjetado >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {formatarMoeda(data.saldoProjetado)}
                          </strong>
                        </p>
                        {data.usandoCheque && (
                          <p className="text-red-300 text-[11px] font-semibold border-t border-slate-700 pt-1">
                            Uso de Cheque Especial: {formatarMoeda(data.chequeUsado)}
                          </p>
                        )}
                        {(data.receitasDia > 0 || data.despesasDia > 0) && (
                          <div className="text-[10px] text-slate-300 pt-1 border-t border-slate-800">
                            {data.receitasDia > 0 && <div>(+) Entradas: {formatarMoeda(data.receitasDia)}</div>}
                            {data.despesasDia > 0 && <div>(-) Saídas: {formatarMoeda(data.despesasDia)}</div>}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Linha de Referência Zero em Vermelho */}
              <ReferenceLine
                y={0}
                stroke="#DC2626"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={{ value: 'Zero (Entra no Cheque Especial)', fill: '#DC2626', fontSize: 10, position: 'insideTopLeft' }}
              />
              <Line
                type="monotone"
                dataKey="saldoProjetado"
                name="Saldo Real Projetado"
                stroke="#003064"
                strokeWidth={3}
                dot={{ r: 2, fill: '#003064' }}
                activeDot={{ r: 6, fill: '#FCBC00', stroke: '#003064', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 6. GRÁFICOS (RECHARTS) NAS CORES DA MARCA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* GRÁFICO 1: RECEITAS X DESPESAS DOS ÚLTIMOS 6/12 MESES (Barras Azul-marinho e Amarelo) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif font-bold text-base text-[#003064] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#1A4A85]" />
                Receitas × Despesas Históricas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparativo de faturamento e custos da MT Solar
              </p>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setNumMesesGrafico(6)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  numMesesGrafico === 6 ? 'bg-[#003064] text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                6 meses
              </button>
              <button
                onClick={() => setNumMesesGrafico(12)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  numMesesGrafico === 12 ? 'bg-[#003064] text-white shadow-2xs' : 'text-slate-600'
                }`}
              >
                12 meses
              </button>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosGraficoBarras}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    formatarMoeda(Number(value) || 0),
                    name === 'receitas' ? 'Receitas' : 'Despesas'
                  ]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                />
                <Legend
                  formatter={(value) => (value === 'receitas' ? 'Receitas (Azul-marinho)' : 'Despesas (Amarelo-sol)')}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                />
                <Bar dataKey="receitas" fill="#003064" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" fill="#FCBC00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2: DESPESAS POR CATEGORIA (Rosca / Donut) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-serif font-bold text-base text-[#003064] flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-[#FCBC00]" />
                Despesas por Categoria
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Distribuição dos custos da empresa no período
              </p>
            </div>

            <span className="text-xs font-bold font-serif text-slate-700 bg-slate-100 px-2.5 py-1 rounded-xl">
              Total: {formatarValor(dadosDespesasCategoria.totalGeral)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
            {/* Donut Chart */}
            <div className="sm:col-span-6 h-56 w-full flex items-center justify-center">
              {dadosDespesasCategoria.itens.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosDespesasCategoria.itens}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {dadosDespesasCategoria.itens.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatarMoeda(Number(val) || 0), 'Valor']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-slate-400">Nenhuma despesa no período.</p>
              )}
            </div>

            {/* Legenda Lateral com Percentuais */}
            <div className="sm:col-span-6 space-y-1.5 max-h-56 overflow-y-auto pr-1 text-xs">
              {dadosDespesasCategoria.itens.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50">
                  <div className="flex items-center gap-2 truncate max-w-[150px]">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />
                    <span className="truncate text-slate-700">{cat.nome}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <strong className="text-slate-800 font-serif">{formatarValor(cat.valor)}</strong>
                    <span className="text-[10px] text-slate-400 block">{cat.percentual}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* GRÁFICO 3: FLUXO DE CAIXA DIÁRIO DO MÊS */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif font-bold text-base text-[#003064]">
              Fluxo de Caixa Diário do Mês Atual
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Entradas e saídas liquidadas dia a dia ao longo do mês vigente
            </p>
          </div>
          <span className="text-xs font-semibold bg-[#FFF4CC] text-[#003064] px-3 py-1 rounded-xl border border-[#FCBC00]/30 self-start sm:self-auto">
            Movimento Diário Conciliado
          </span>
        </div>

        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dadosFluxoDiario}
              margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="dataLabel" tick={{ fontSize: 10, fill: '#64748B' }} interval={2} />
              <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(val: any, name: any) => [
                  formatarMoeda(Number(val) || 0),
                  name === 'entradas' ? 'Entradas' : 'Saídas'
                ]}
                contentStyle={{ borderRadius: '12px', border: '1px solid #CBD5E1', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="entradas" name="Entradas" fill="#16A34A" radius={[3, 3, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="#DC2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 7. LISTAS: PRÓXIMOS VENCIMENTOS (8 primeiros com botão rápido Pagar/Receber) E ÚLTIMOS LANÇAMENTOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LISTA 1: PRÓXIMOS VENCIMENTOS (8 PRIMEIROS) COM BOTÃO RÁPIDO */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FCBC00]" />
                <h3 className="font-serif font-bold text-base text-[#003064]">
                  Próximos Vencimentos (8 Títulos)
                </h3>
              </div>
              <button
                onClick={() => onNavegar('pagar')}
                className="text-xs font-semibold text-[#1A4A85] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {proximosVencimentos.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Nenhum vencimento pendente.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {proximosVencimentos.map((l) => {
                  const hojeIso = obterHojeISO();
                  const atrasado = l.data_vencimento < hojeIso;
                  const venceHoje = l.data_vencimento === hojeIso;
                  const isDespesa = l.tipo === 'despesa';

                  return (
                    <div key={l.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          isDespesa ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          {isDespesa ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate max-w-[180px] sm:max-w-[240px]">
                            {l.descricao}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                            <span>{formatarDataBR(l.data_vencimento)}</span>
                            {atrasado && (
                              <span className="font-bold text-red-600 bg-red-100 px-1.5 py-0.2 rounded-sm">
                                Atrasado
                              </span>
                            )}
                            {venceHoje && (
                              <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-sm">
                                Vence Hoje
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`font-serif font-bold ${
                          isDespesa ? 'text-red-600' : 'text-emerald-700'
                        }`}>
                          {formatarValor(l.valor)}
                        </span>

                        {/* Botão Rápido Pagar/Receber com Simulação de Cheque Especial Integrada */}
                        <button
                          onClick={() => handleAbrirLiquidar(l)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold text-white shadow-2xs transition-all cursor-pointer ${
                            isDespesa
                              ? 'bg-red-600 hover:bg-red-700 border-b border-red-800'
                              : 'bg-emerald-600 hover:bg-emerald-700 border-b border-emerald-800'
                          }`}
                        >
                          {isDespesa ? 'Pagar' : 'Receber'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* LISTA 2: ÚLTIMOS LANÇAMENTOS REALIZADOS */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-[#003064]" />
                <h3 className="font-serif font-bold text-base text-[#003064]">
                  Últimos Lançamentos
                </h3>
              </div>
              <button
                onClick={() => onNavegar('lancamentos')}
                className="text-xs font-semibold text-[#1A4A85] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Ver todos</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {ultimosLancamentos.map((l) => (
                <div key={l.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-[260px]">
                      {l.descricao}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>{formatarDataBR(l.data_pagamento || l.data_vencimento)}</span>
                      <span>•</span>
                      <span className="capitalize">{l.status}</span>
                    </div>
                  </div>

                  <span className={`font-serif font-bold shrink-0 ${
                    l.tipo === 'receita' ? 'text-emerald-700' : 'text-slate-800'
                  }`}>
                    {l.tipo === 'receita' ? '+' : '-'} {formatarValor(l.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* 8. RESUMO DA FOLHA: FUNCIONÁRIOS ATIVOS E CUSTO MENSAL TOTAL */}
      <div className="bg-linear-to-r from-[#003064] to-[#00204A] text-white rounded-2xl p-5 sm:p-6 border border-[#003064] shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#FCBC00] text-[#003064] rounded-2xl font-bold shadow-xs">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#FFF4CC] text-[#003064] px-2 py-0.5 rounded-full">
                Folha & Equipes MT Solar
              </span>
              <span className="text-xs text-slate-300">
                (Planejamento da Etapa 2)
              </span>
            </div>
            <h3 className="font-serif font-bold text-lg text-white mt-1">
              {resumoFolha.funcionariosAtivos} Colaboradores Ativos
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
              Equipes de montagem fotovoltaica, engenharia técnica e administrativo. Salários base de {formatarMoeda(resumoFolha.salariosBase)} com provisão legal de INSS ({resumoFolha.inssPercent}%) e FGTS ({resumoFolha.fgtsPercent}%).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-700 pt-3 md:pt-0 md:pl-6 shrink-0 justify-between md:justify-start">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-300 block">
              Custo Mensal Total Estimado:
            </span>
            <div className="font-serif font-black text-xl text-[#FCBC00]">
              {formatarValor(resumoFolha.custoTotalMensal)}
            </div>
          </div>

          <button
            onClick={() => onNavegar('funcionarios')}
            className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-white/20"
          >
            Ver Módulo
          </button>
        </div>
      </div>

      {/* MODAL DE LIQUIDAÇÃO COM A SIMULAÇÃO DE CHEQUE ESPECIAL EM TEMPO REAL */}
      <ModalPagarReceber
        isOpen={modalLiquidarAberto}
        onClose={() => setModalLiquidarAberto(false)}
        lancamentosAlvo={lancamentoParaLiquidar}
        tipoOperacao={tipoOperacaoModal}
        onSucesso={() => {
          carregarDados();
        }}
      />

    </div>
  );
};
