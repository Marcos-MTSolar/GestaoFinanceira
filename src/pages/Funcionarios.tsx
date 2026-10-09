import React, { useState, useEffect, useMemo } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarMoeda, formatarDataBR, formatarCpfCnpj, formatarTelefone, obterHojeISO } from '../utils/formatters';
import { exportarFolhaCSV } from '../utils/csvExporter';
import {
  Funcionario,
  LancamentoFolha,
  TipoLancamentoFolha,
  StatusFuncionario,
  TipoContratoFuncionario,
  SetorFuncionario,
  FormaRemuneracao,
  BeneficioFuncionario,
  OcorrenciaFuncionario,
  ContaBancaria,
  Lancamento
} from '../types';
import { Modal } from '../components/Modal';
import { ModalPagarReceber } from '../components/ModalPagarReceber';
import { Logo } from '../components/Logo';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Users,
  UserCheck,
  UserPlus,
  DollarSign,
  CreditCard,
  Calendar,
  Building2,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  Printer,
  Download,
  ChevronRight,
  Eye,
  TrendingUp,
  TrendingDown,
  Layers,
  Award,
  FileText,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  HeartHandshake,
  Percent,
  CheckSquare,
  Square,
  BadgeAlert,
  Wallet,
  Receipt,
  History
} from 'lucide-react';

const SETORES: SetorFuncionario[] = [
  'Instalação',
  'Comercial',
  'Administrativo',
  'Projetos',
  'Engenharia',
  'Operações',
  'Outro',
];

const TIPOS_CONTRATO: { id: TipoContratoFuncionario; label: string }[] = [
  { id: 'CLT', label: 'CLT (Efetivo)' },
  { id: 'PJ', label: 'PJ / Autônomo' },
  { id: 'temporario', label: 'Temporário' },
  { id: 'estagiario', label: 'Estagiário' },
  { id: 'diarista', label: 'Diarista' },
];

const TIPOS_LANCAMENTO_FOLHA: { id: TipoLancamentoFolha; label: string; tipoOperacao: 'provento' | 'desconto' }[] = [
  { id: 'salario', label: 'Salário Base', tipoOperacao: 'provento' },
  { id: 'adiantamento', label: 'Adiantamento (Vale)', tipoOperacao: 'desconto' },
  { id: 'vale', label: 'Vale Transporte / Refeição', tipoOperacao: 'provento' },
  { id: 'comissao', label: 'Comissão de Vendas', tipoOperacao: 'provento' },
  { id: 'hora_extra', label: 'Horas Extras', tipoOperacao: 'provento' },
  { id: 'bonus', label: 'Bônus / Premiação', tipoOperacao: 'provento' },
  { id: 'desconto', label: 'Desconto Diversos', tipoOperacao: 'desconto' },
  { id: 'ferias', label: 'Férias (+1/3)', tipoOperacao: 'provento' },
  { id: 'decimo_terceiro', label: '13º Salário', tipoOperacao: 'provento' },
  { id: 'rescisao', label: 'Rescisão Contratual', tipoOperacao: 'provento' },
  { id: 'reembolso', label: 'Reembolso de Despesas', tipoOperacao: 'provento' },
  { id: 'outro', label: 'Outros Proventos', tipoOperacao: 'provento' },
];

export const Funcionarios: React.FC = () => {
  const { isAdmin } = useAuth();
  const { formatarValor } = usePrivacy();

  // Estados principais
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [lancamentosFolha, setLancamentosFolha] = useState<LancamentoFolha[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);

  // Abas superiores da página: 'colaboradores' | 'folha_mes'
  const [abaPrincipal, setAbaPrincipal] = useState<'colaboradores' | 'folha_mes'>('colaboradores');

  // Filtros da lista
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroSetor, setFiltroSetor] = useState<string>('todos');
  const [filtroContrato, setFiltroContrato] = useState<string>('todos');

  // Competência ativa para Folha do Mês (MM/AAAA)
  const hoje = new Date();
  const mesAtualStr = String(hoje.getMonth() + 1).padStart(2, '0');
  const anoAtualStr = String(hoje.getFullYear());
  const [competenciaAtiva, setCompetenciaAtiva] = useState<string>(`${mesAtualStr}/${anoAtualStr}`);

  // Modais
  const [modalCadastroAberto, setModalCadastroAberto] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState<Funcionario | null>(null);

  // Ficha do Funcionário
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState<Funcionario | null>(null);
  const [abaFicha, setAbaFicha] = useState<'financeiro' | 'resumo_anual' | 'dados' | 'ocorrencias'>('financeiro');

  // Modal Novo Lançamento na Folha do Funcionário
  const [modalNovoLancFolhaAberto, setModalNovoLancFolhaAberto] = useState(false);
  const [modalPagarFolhaAberto, setModalPagarFolhaAberto] = useState(false);
  const [lancamentoParaPagar, setLancamentoParaPagar] = useState<Lancamento[]>([]);
  const [folhaIdParaLiquidar, setFolhaIdParaLiquidar] = useState<string | null>(null);

  // Modal Pagar Todos em Lote (Folha do Mês)
  const [modalPagarTodosAberto, setModalPagarTodosAberto] = useState(false);
  const [selecionadosLoteFolha, setSelecionadosLoteFolha] = useState<string[]>([]);

  // Modal de Impressão da Folha
  const [modalImpressaoAberto, setModalImpressaoAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);

  // Cópia de PIX Feedback
  const [copiouPixId, setCopiouPixId] = useState<string | null>(null);

  const carregarDados = () => {
    setFuncionarios(dbService.getFuncionarios());
    setLancamentosFolha(dbService.getLancamentosFolha());
    setContas(dbService.getContas().filter(c => c.ativa));
  };

  useEffect(() => {
    carregarDados();
    const unsubF = subscribe('funcionarios', carregarDados);
    const unsubLF = subscribe('lancamentos_folha', carregarDados);
    const unsubC = subscribe('contas', carregarDados);
    const unsubL = subscribe('lancamentos', carregarDados);

    return () => {
      unsubF();
      unsubLF();
      unsubC();
      unsubL();
    };
  }, []);

  // Mantém funcionarioSelecionado atualizado quando a lista muda
  useEffect(() => {
    if (funcionarioSelecionado) {
      const atual = funcionarios.find(f => f.id === funcionarioSelecionado.id);
      if (atual) setFuncionarioSelecionado(atual);
    }
  }, [funcionarios]);

  // CÁLCULOS DO TOPO
  const metricasTopo = useMemo(() => {
    const ativos = funcionarios.filter(f => f.status === 'ativo');
    let totalSalarioBaseAtivos = 0;
    let custoTotalEncargos = 0;

    ativos.forEach(f => {
      const c = dbService.calcularCustoTotalFuncionario(f);
      totalSalarioBaseAtivos += f.salario_base;
      custoTotalEncargos += c.custoTotalMensal;
    });

    // Lançamentos da competência ativa
    const eventosComp = lancamentosFolha.filter(l => l.competencia === competenciaAtiva);
    const totalPagoMes = eventosComp
      .filter(l => l.status === 'pago')
      .reduce((acc, l) => acc + (l.tipo_operacao === 'provento' ? l.valor : -l.valor), 0);
    const totalPendenteMes = eventosComp
      .filter(l => l.status === 'pendente')
      .reduce((acc, l) => acc + (l.tipo_operacao === 'provento' ? l.valor : -l.valor), 0);

    return {
      totalAtivos: ativos.length,
      totalFolhaBase: totalSalarioBaseAtivos,
      custoTotalEncargos,
      totalPagoMes: Math.max(0, totalPagoMes),
      totalPendenteMes: Math.max(0, totalPendenteMes),
    };
  }, [funcionarios, lancamentosFolha, competenciaAtiva]);

  // FILTRAGEM DE FUNCIONÁRIOS
  const funcionariosFiltrados = useMemo(() => {
    return funcionarios.filter(f => {
      if (filtroStatus !== 'todos' && f.status !== filtroStatus) return false;
      if (filtroSetor !== 'todos' && f.setor !== filtroSetor) return false;
      if (filtroContrato !== 'todos' && f.tipo_contrato !== filtroContrato) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const nomeOk = f.nome.toLowerCase().includes(q);
        const cargoOk = f.cargo.toLowerCase().includes(q);
        const cpfOk = f.cpf.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
        const emailOk = f.email.toLowerCase().includes(q);
        if (!nomeOk && !cargoOk && !cpfOk && !emailOk) return false;
      }
      return true;
    });
  }, [funcionarios, filtroStatus, filtroSetor, filtroContrato, busca]);

  // STATUS DO PAGAMENTO DO MÊS PARA CADA FUNCIONÁRIO
  const getStatusPagamentoMes = (funcionarioId: string) => {
    const sal = lancamentosFolha.find(
      l => l.funcionario_id === funcionarioId && l.competencia === competenciaAtiva && l.tipo === 'salario'
    );
    if (!sal) return { status: 'sem_lancamento', label: 'A gerar', cor: 'bg-slate-100 text-slate-600' };
    if (sal.status === 'pago') return { status: 'pago', label: 'Pago', cor: 'bg-emerald-100 text-emerald-800' };
    return { status: 'pendente', label: 'Pendente', cor: 'bg-amber-100 text-amber-800' };
  };

  // CÁLCULO DE TEMPO DE EMPRESA
  const calcularTempoEmpresa = (dataAdmissao: string, dataDesligamento?: string | null) => {
    if (!dataAdmissao) return '-';
    const inicio = new Date(dataAdmissao + 'T12:00:00');
    const fim = dataDesligamento ? new Date(dataDesligamento + 'T12:00:00') : new Date();
    
    let anos = fim.getFullYear() - inicio.getFullYear();
    let meses = fim.getMonth() - inicio.getMonth();
    if (meses < 0) {
      anos--;
      meses += 12;
    }
    if (anos === 0 && meses === 0) return 'Menos de 1 mês';
    if (anos === 0) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
    if (meses === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
    return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  };

  // COPIAR CHAVE PIX
  const handleCopiarPix = (chave: string, id: string) => {
    navigator.clipboard.writeText(chave);
    setCopiouPixId(id);
    setTimeout(() => setCopiouPixId(null), 2500);
  };

  // ABRIR CADASTRO NOVO
  const handleNovoFuncionario = () => {
    setFuncionarioEditando(null);
    setModalCadastroAberto(true);
  };

  // ABRIR EDIÇÃO
  const handleEditarFuncionario = (f: Funcionario, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFuncionarioEditando(f);
    setModalCadastroAberto(true);
  };

  // EXCLUIR FUNCIONÁRIO
  const handleExcluirFuncionario = (f: Funcionario, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Deseja realmente excluir o cadastro de ${f.nome}?`)) return;
    const res = dbService.deleteFuncionario(f.id);
    if (!res.sucesso) {
      alert(res.mensagem || 'Não foi possível excluir.');
    } else {
      if (funcionarioSelecionado?.id === f.id) setFuncionarioSelecionado(null);
    }
  };

  // ABRIR PAGAMENTO INDIVIDUAL RÁPIDO COM SIMULAÇÃO
  const handlePagarSalarioRapido = (f: Funcionario, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Busca se já tem lançamento pendente da folha
    let sal = lancamentosFolha.find(
      l => l.funcionario_id === f.id && l.competencia === competenciaAtiva && l.tipo === 'salario' && l.status === 'pendente'
    );

    // Se não tiver, cria um lançamento na hora para ser liquidado
    if (!sal) {
      const calc = dbService.calcularCustoTotalFuncionario(f);
      const ficha = dbService.obterFichaFinanceira(f.id);
      const liquido = Math.max(0, +(calc.remuneracaoBruta - ficha.saldoAdiantamentosAberto).toFixed(2));

      sal = dbService.saveLancamentoFolha({
        id: 'folha-' + Date.now(),
        funcionario_id: f.id,
        tipo: 'salario',
        descricao: `Salário Mensal ${f.cargo}`,
        competencia: competenciaAtiva,
        valor: liquido,
        tipo_operacao: 'provento',
        data_prevista: obterHojeISO(),
        data_pagamento: null,
        status: 'pendente',
        conta_id: contas[0]?.id || 'conta-1',
        observacoes: ficha.saldoAdiantamentosAberto > 0 ? `Dedução de R$ ${ficha.saldoAdiantamentosAberto.toFixed(2)} em adiantamentos.` : undefined,
        criado_em: new Date().toISOString(),
      });
    }

    // Busca o correspondente em lancamentos
    const despesaVinculada = dbService.getLancamentos().find(l => l.id === sal?.lancamento_id) || {
      id: sal.lancamento_id || ('folha-desc-' + sal.id),
      tipo: 'despesa',
      descricao: `Folha: ${sal.descricao} – ${f.nome} (${sal.competencia})`,
      valor: sal.valor,
      data_vencimento: sal.data_prevista,
      data_pagamento: null,
      status: 'pendente',
      conta_id: sal.conta_id,
      categoria_id: 'cat-des-4',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'folha',
      funcionario_id: f.id,
      criado_em: new Date().toISOString(),
    } as Lancamento;

    setFolhaIdParaLiquidar(sal.id);
    setLancamentoParaPagar([despesaVinculada]);
    setModalPagarFolhaAberto(true);
  };

  // GERAR FOLHA DO MÊS EM LOTE
  const handleGerarFolhaMes = () => {
    if (!confirm(`Deseja gerar os lançamentos de salário para todos os colaboradores ativos na competência ${competenciaAtiva}?`)) return;
    const res = dbService.gerarFolhaDoMes(competenciaAtiva, obterHojeISO(), contas[0]?.id || 'conta-1');
    alert(`Folha gerada com sucesso! ${res.gerados} lançamentos criados totalizando ${formatarMoeda(res.totalValor)}.`);
  };

  // PAGAR TODOS EM LOTE
  const handleAbrirPagarTodos = () => {
    const pendentes = lancamentosFolha.filter(
      l => l.competencia === competenciaAtiva && l.status === 'pendente'
    );
    if (pendentes.length === 0) {
      alert(`Não há lançamentos pendentes para quitação na competência ${competenciaAtiva}.`);
      return;
    }

    const idsLancamentos = pendentes.map(p => p.lancamento_id).filter(Boolean) as string[];
    const despesasVinculadas = dbService.getLancamentos().filter(l => idsLancamentos.includes(l.id));

    setLancamentoParaPagar(despesasVinculadas);
    setModalPagarTodosAberto(true);
  };

  // EXPORTAR FOLHA CSV
  const handleExportarFolhaCSV = () => {
    const ativos = funcionarios.filter(f => f.status === 'ativo');
    const dadosExportar = ativos.map(f => {
      const calc = dbService.calcularCustoTotalFuncionario(f);
      const ficha = dbService.obterFichaFinanceira(f.id);
      const sal = lancamentosFolha.find(
        l => l.funcionario_id === f.id && l.competencia === competenciaAtiva && l.tipo === 'salario'
      );
      const liquido = sal ? sal.valor : Math.max(0, calc.remuneracaoBruta - ficha.saldoAdiantamentosAberto);

      return {
        funcionarioNome: f.nome,
        cargo: f.cargo,
        setor: f.setor,
        cpf: f.cpf,
        tipoContrato: f.tipo_contrato,
        salarioBase: f.salario_base,
        adicionais: calc.adicionalValor,
        beneficios: calc.totalBeneficios,
        adiantamentosDescontados: ficha.saldoAdiantamentosAberto,
        outrosDescontos: 0,
        liquido,
        status: sal ? sal.status : 'A gerar',
        chavePix: f.chave_pix || '-',
      };
    });

    exportarFolhaCSV(dadosExportar, competenciaAtiva);
  };

  return (
    <div className="space-y-6 pb-20">

      {/* CABEÇALHO DO MÓDULO */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-[#003064] text-[#FCBC00]">
              <Users className="w-4 h-4" />
            </span>
            <span className="text-[11px] font-bold text-[#1A4A85] uppercase tracking-wider">
              Gestão de Pessoas & Folha de Pagamento
            </span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#003064] mt-1">
            Funcionários, Técnicos & Equipes MT Solar
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cadastro completo de colaboradores, controle de remuneração, encargos sociais e conciliação direta com o caixa.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setModalHistoricoAberto(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-xs border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            title="Histórico de alterações e auditoria da folha e colaboradores"
          >
            <History className="w-4 h-4 text-slate-600" />
            <span>Histórico</span>
          </button>

          {isAdmin && (
            <button
              onClick={handleNovoFuncionario}
              className="flex items-center gap-2 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2.5 rounded-xl font-semibold text-xs shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#FCBC00]" />
              <span>+ Novo Funcionário</span>
            </button>
          )}

          <button
            onClick={() => setAbaPrincipal(abaPrincipal === 'colaboradores' ? 'folha_mes' : 'colaboradores')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs border transition-all cursor-pointer ${
              abaPrincipal === 'folha_mes'
                ? 'bg-[#FCBC00] text-[#003064] border-[#FCBC00] shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-[#003064] border-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>{abaPrincipal === 'folha_mes' ? 'Ver Colaboradores' : 'Folha do Mês'}</span>
          </button>
        </div>
      </div>

      {/* MÉTRICAS NO TOPO */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* 1. Ativos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Colaboradores</span>
            <UserCheck className="w-4 h-4 text-[#003064]" />
          </div>
          <p className="font-serif text-2xl font-bold text-[#003064] mt-0.5">
            {metricasTopo.totalAtivos}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">Ativos na empresa</span>
        </div>

        {/* 2. Total da Folha do Mês */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Salários Base</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-serif text-xl sm:text-2xl font-bold text-slate-800 mt-0.5">
            {formatarValor(metricasTopo.totalFolhaBase)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">Competência {competenciaAtiva}</span>
        </div>

        {/* 3. Custo Total com Encargos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Custo c/ Encargos</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="font-serif text-xl sm:text-2xl font-black text-[#003064] mt-0.5">
            {formatarValor(metricasTopo.custoTotalEncargos)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">INSS, FGTS, Férias, 13º</span>
        </div>

        {/* 4. Já Pago no Mês */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Já Liquidado</span>
            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          </div>
          <p className="font-serif text-xl sm:text-2xl font-bold text-[#16A34A] mt-0.5">
            {formatarValor(metricasTopo.totalPagoMes)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">Pago no mês</span>
        </div>

        {/* 5. Pendente no Mês */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pendente</span>
            <Clock className="w-4 h-4 text-[#DC2626]" />
          </div>
          <p className="font-serif text-xl sm:text-2xl font-bold text-[#DC2626] mt-0.5">
            {formatarValor(metricasTopo.totalPendenteMes)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">Em aberto na folha</span>
        </div>

      </div>

      {/* NAVEGAÇÃO ENTRE ABAS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setAbaPrincipal('colaboradores')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaPrincipal === 'colaboradores'
              ? 'bg-[#003064] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Equipe & Colaboradores ({funcionarios.length})</span>
        </button>

        <button
          onClick={() => setAbaPrincipal('folha_mes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            abaPrincipal === 'folha_mes'
              ? 'bg-[#003064] text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Folha de Pagamento ({competenciaAtiva})</span>
        </button>
      </div>

      {/* ABA 1: LISTA DE COLABORADORES */}
      {abaPrincipal === 'colaboradores' && (
        <div className="space-y-4">
          
          {/* BARRA DE FILTROS & BUSCA */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Campo de Busca */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, cargo, CPF ou e-mail..."
                className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] bg-[#F5F7FA]"
              />
            </div>

            {/* Filtros em Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
              >
                <option value="todos">Status: Todos</option>
                <option value="ativo">Ativo</option>
                <option value="ferias">Férias</option>
                <option value="afastado">Afastado</option>
                <option value="desligado">Desligado</option>
              </select>

              <select
                value={filtroSetor}
                onChange={(e) => setFiltroSetor(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
              >
                <option value="todos">Setor: Todos</option>
                {SETORES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                value={filtroContrato}
                onChange={(e) => setFiltroContrato(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-slate-700"
              >
                <option value="todos">Contrato: Todos</option>
                {TIPOS_CONTRATO.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* LISTA / TABELA DE FUNCIONÁRIOS */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            
            {/* Versão Desktop: Tabela Completa */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Cargo & Setor</th>
                    <th className="py-3 px-4">Contrato & Status</th>
                    <th className="py-3 px-4 text-right">Salário Base</th>
                    <th className="py-3 px-4 text-right">Custo Mensal Total</th>
                    <th className="py-3 px-4 text-center">Mês {competenciaAtiva}</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {funcionariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum colaborador encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    funcionariosFiltrados.map((f) => {
                      const calc = dbService.calcularCustoTotalFuncionario(f);
                      const statusPgto = getStatusPagamentoMes(f.id);
                      const iniciais = f.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

                      return (
                        <tr
                          key={f.id}
                          onClick={() => setFuncionarioSelecionado(f)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          {/* Colaborador */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-[#003064] text-[#FCBC00] font-black flex items-center justify-center shrink-0 shadow-2xs font-serif">
                                {iniciais}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 text-xs truncate group-hover:text-[#003064]">
                                  {f.nome}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  CPF: {formatarCpfCnpj(f.cpf)}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Cargo & Setor */}
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-800">{f.cargo}</p>
                            <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 text-[#003064] border border-slate-200">
                              {f.setor}
                            </span>
                          </td>

                          {/* Contrato & Status */}
                          <td className="py-3.5 px-4">
                            <p className="text-slate-600 font-medium uppercase text-[11px]">{f.tipo_contrato}</p>
                            <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.2 rounded-full capitalize ${
                              f.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' :
                              f.status === 'ferias' ? 'bg-blue-100 text-blue-800' :
                              f.status === 'afastado' ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-200 text-slate-600'
                            }`}>
                              {f.status}
                            </span>
                          </td>

                          {/* Salário Base */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-serif font-bold text-slate-800 text-xs">
                              {formatarValor(f.salario_base)}
                            </span>
                            {f.adicional_tipo !== 'nenhum' && (
                              <span className="text-[10px] text-emerald-700 block font-medium">
                                +30% periculosidade
                              </span>
                            )}
                          </td>

                          {/* Custo Mensal Total */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-serif font-black text-[#003064] text-xs">
                              {formatarValor(calc.custoTotalMensal)}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              benef. + encargos
                            </span>
                          </td>

                          {/* Pagamento do Mês */}
                          <td className="py-3.5 px-4 text-center">
                            <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full ${statusPgto.cor}`}>
                              {statusPgto.label}
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {statusPgto.status !== 'pago' && f.status === 'ativo' && (
                                <button
                                  type="button"
                                  onClick={(e) => handlePagarSalarioRapido(f, e)}
                                  className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
                                  title="Lançar pagamento ou quitar"
                                >
                                  Pagar
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setFuncionarioSelecionado(f)}
                                className="p-1.5 text-slate-500 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Ver Ficha Completa"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => handleEditarFuncionario(f, e)}
                                  className="p-1.5 text-slate-500 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Versão Mobile: Cards Responsivos */}
            <div className="block md:hidden divide-y divide-slate-100">
              {funcionariosFiltrados.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Nenhum colaborador encontrado.
                </div>
              ) : (
                funcionariosFiltrados.map((f) => {
                  const calc = dbService.calcularCustoTotalFuncionario(f);
                  const statusPgto = getStatusPagamentoMes(f.id);
                  const iniciais = f.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

                  return (
                    <div
                      key={f.id}
                      onClick={() => setFuncionarioSelecionado(f)}
                      className="p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#003064] text-[#FCBC00] font-black flex items-center justify-center shrink-0 shadow-2xs font-serif text-sm">
                            {iniciais}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{f.nome}</h4>
                            <p className="text-xs text-slate-500">{f.cargo} • {f.setor}</p>
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          f.status === 'ativo' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {f.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Salário Base</span>
                          <strong className="font-serif text-slate-800">{formatarValor(f.salario_base)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">Custo Total Empresa</span>
                          <strong className="font-serif text-[#003064]">{formatarValor(calc.custoTotalMensal)}</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusPgto.cor}`}>
                          Mês: {statusPgto.label}
                        </span>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {statusPgto.status !== 'pago' && f.status === 'ativo' && (
                            <button
                              type="button"
                              onClick={(e) => handlePagarSalarioRapido(f, e)}
                              className="px-3 py-1 text-xs font-bold bg-emerald-600 text-white rounded-lg shadow-2xs"
                            >
                              Pagar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setFuncionarioSelecionado(f)}
                            className="px-3 py-1 text-xs font-bold bg-slate-100 text-[#003064] rounded-lg"
                          >
                            Ficha
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      )}

      {/* ABA 2: FOLHA DO MÊS */}
      {abaPrincipal === 'folha_mes' && (
        <div className="space-y-4">
          
          {/* Controles da Folha do Mês */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#003064] text-[#FCBC00] rounded-xl font-bold">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-[#003064]">
                  Fechamento da Folha de Pagamento
                </h3>
                <p className="text-xs text-slate-500">
                  Competência: <strong>{competenciaAtiva}</strong> • Cálculo consolidado com comissões, adicionais e descontos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={competenciaAtiva}
                onChange={(e) => setCompetenciaAtiva(e.target.value)}
                placeholder="MM/AAAA"
                className="w-24 px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-[#F5F7FA] text-center"
                title="Competência da folha (MM/AAAA)"
              />

              {isAdmin && (
                <>
                  <button
                    onClick={handleGerarFolhaMes}
                    className="flex items-center gap-1.5 bg-[#003064] hover:bg-[#00204A] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FCBC00]" />
                    <span>Gerar Folha do Mês</span>
                  </button>

                  <button
                    onClick={handleAbrirPagarTodos}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs cursor-pointer border-b border-emerald-800"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>Pagar Todos em Lote</span>
                  </button>
                </>
              )}

              <button
                onClick={handleExportarFolhaCSV}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border border-slate-200"
                title="Exportar planilha CSV da folha"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>

              <button
                onClick={() => setModalImpressaoAberto(true)}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer border border-slate-200"
                title="Versão para impressão / recibos"
              >
                <Printer className="w-3.5 h-3.5 text-[#003064]" />
                <span>Imprimir</span>
              </button>
            </div>
          </div>

          {/* Tabela de Fechamento da Folha */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-600 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Colaborador / Cargo</th>
                    <th className="py-3 px-4 text-right">Salário Base</th>
                    <th className="py-3 px-4 text-right">Adicionais / Comissões</th>
                    <th className="py-3 px-4 text-right">Adiantamentos (Abatidos)</th>
                    <th className="py-3 px-4 text-right">Líquido a Pagar</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {funcionarios.filter(f => f.status === 'ativo').map((f) => {
                    const calc = dbService.calcularCustoTotalFuncionario(f);
                    const ficha = dbService.obterFichaFinanceira(f.id);
                    const sal = lancamentosFolha.find(
                      l => l.funcionario_id === f.id && l.competencia === competenciaAtiva && l.tipo === 'salario'
                    );
                    const valorLiquido = sal ? sal.valor : Math.max(0, calc.remuneracaoBruta - ficha.saldoAdiantamentosAberto);
                    const isPago = sal?.status === 'pago';

                    return (
                      <tr key={f.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-slate-900">{f.nome}</p>
                          <p className="text-[11px] text-slate-500">{f.cargo} • {f.setor}</p>
                        </td>

                        <td className="py-3.5 px-4 text-right font-serif text-slate-700">
                          {formatarValor(f.salario_base)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-serif text-emerald-700">
                          {calc.adicionalValor > 0 ? `+ ${formatarValor(calc.adicionalValor)}` : '-'}
                        </td>

                        <td className="py-3.5 px-4 text-right font-serif text-red-600">
                          {ficha.saldoAdiantamentosAberto > 0 ? `- ${formatarValor(ficha.saldoAdiantamentosAberto)}` : '-'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <strong className="font-serif font-black text-sm text-[#003064]">
                            {formatarValor(valorLiquido)}
                          </strong>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPago ? 'bg-emerald-100 text-emerald-800' :
                            sal ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isPago ? 'Pago' : sal ? 'Pendente' : 'Não Gerado'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {!isPago ? (
                            <button
                              type="button"
                              onClick={() => handlePagarSalarioRapido(f)}
                              className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-colors cursor-pointer"
                            >
                              Pagar
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-700 flex items-center justify-end gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Quitado</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. FICHA DETALHADA DO FUNCIONÁRIO (MODAL / PAINEL COMPLETO) */}
      {/* ========================================================= */}
      {funcionarioSelecionado && (
        <Modal
          isOpen={!!funcionarioSelecionado}
          onClose={() => setFuncionarioSelecionado(null)}
          title={`Ficha Funcional: ${funcionarioSelecionado.nome}`}
          subtitle={`${funcionarioSelecionado.cargo} • ${funcionarioSelecionado.setor}`}
          maxWidth="2xl"
        >
          <div className="space-y-5">
            
            {/* CABEÇALHO DA FICHA */}
            <div className="bg-linear-to-r from-[#003064] to-[#00204A] text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-[#FCBC00] text-[#003064] font-serif font-black text-xl flex items-center justify-center shrink-0 shadow-md">
                  {funcionarioSelecionado.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif font-bold text-lg text-white">
                      {funcionarioSelecionado.nome}
                    </h3>
                    <span className="text-[10px] uppercase font-bold bg-white/20 text-[#FCBC00] px-2 py-0.5 rounded-full">
                      {funcionarioSelecionado.tipo_contrato}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {funcionarioSelecionado.cargo} • {funcionarioSelecionado.setor}
                  </p>
                  <p className="text-[11px] text-[#FCBC00] mt-0.5 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3" />
                    <span>Tempo de MT Solar: {calcularTempoEmpresa(funcionarioSelecionado.data_admissao, funcionarioSelecionado.data_desligamento)}</span>
                  </p>
                </div>
              </div>

              {/* Botão Copiar PIX & Ações Rápidas */}
              <div className="flex flex-col sm:items-end gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-700">
                {funcionarioSelecionado.chave_pix && (
                  <button
                    type="button"
                    onClick={() => handleCopiarPix(funcionarioSelecionado.chave_pix, 'ficha')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/20 transition-all cursor-pointer"
                    title="Copiar Chave PIX do colaborador"
                  >
                    {copiouPixId === 'ficha' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">PIX Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#FCBC00]" />
                        <span>PIX: {funcionarioSelecionado.chave_pix}</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handlePagarSalarioRapido(funcionarioSelecionado)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs cursor-pointer border-b-2 border-emerald-800"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Lançar Pagamento</span>
                </button>
              </div>
            </div>

            {/* CARTÕES DE RESUMO DO FUNCIONÁRIO */}
            {(() => {
              const calc = dbService.calcularCustoTotalFuncionario(funcionarioSelecionado);
              const ficha = dbService.obterFichaFinanceira(funcionarioSelecionado.id);
              
              // Período aquisitivo de férias
              const adm = new Date(funcionarioSelecionado.data_admissao + 'T12:00:00');
              const proxVenctoFerias = new Date(adm);
              proxVenctoFerias.setFullYear(hoje.getFullYear() + (hoje >= adm ? 1 : 0));

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs">
                  
                  {/* Salário Base */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Salário Base</span>
                    <strong className="font-serif text-sm text-slate-800 mt-0.5 block">
                      {formatarValor(funcionarioSelecionado.salario_base)}
                    </strong>
                  </div>

                  {/* Custo Total Empresa */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Custo p/ Empresa</span>
                    <strong className="font-serif text-sm text-[#003064] mt-0.5 block">
                      {formatarValor(calc.custoTotalMensal)}
                    </strong>
                  </div>

                  {/* Total Pago no Mês */}
                  <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 block">Pago no Mês</span>
                    <strong className="font-serif text-sm text-emerald-700 mt-0.5 block">
                      {formatarValor(ficha.totalPagoMes)}
                    </strong>
                  </div>

                  {/* Total Pago no Ano */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Pago no Ano</span>
                    <strong className="font-serif text-sm text-slate-800 mt-0.5 block">
                      {formatarValor(ficha.totalPagoAno)}
                    </strong>
                  </div>

                  {/* Adiantamentos em Aberto (Saldo a Descontar) */}
                  <div className={`p-2.5 rounded-xl border ${
                    ficha.saldoAdiantamentosAberto > 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}>
                    <span className="text-[10px] uppercase font-bold text-amber-900 block">Adiant. Aberto</span>
                    <strong className="font-serif text-sm text-amber-800 mt-0.5 block">
                      {formatarValor(ficha.saldoAdiantamentosAberto)}
                    </strong>
                  </div>

                  {/* Férias */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Próx. Férias</span>
                    <strong className="text-[11px] text-slate-800 font-semibold mt-0.5 block truncate">
                      {formatarDataBR(proxVenctoFerias.toISOString().split('T')[0])}
                    </strong>
                  </div>

                  {/* 13º Acumulado Estimado */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">13º Acumulado</span>
                    <strong className="font-serif text-sm text-purple-700 mt-0.5 block">
                      {formatarValor((funcionarioSelecionado.salario_base / 12) * Math.min(12, hoje.getMonth() + 1))}
                    </strong>
                  </div>

                </div>
              );
            })()}

            {/* ABAS INTERNAS DA FICHA */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setAbaFicha('financeiro')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  abaFicha === 'financeiro' ? 'bg-[#003064] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Financeiro & Lançamentos
              </button>

              <button
                type="button"
                onClick={() => setAbaFicha('resumo_anual')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  abaFicha === 'resumo_anual' ? 'bg-[#003064] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Resumo Anual (Jan–Dez)
              </button>

              <button
                type="button"
                onClick={() => setAbaFicha('dados')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  abaFicha === 'dados' ? 'bg-[#003064] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Dados Cadastrais
              </button>

              <button
                type="button"
                onClick={() => setAbaFicha('ocorrencias')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  abaFicha === 'ocorrencias' ? 'bg-[#003064] text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Ocorrências ({funcionarioSelecionado.ocorrencias?.length || 0})
              </button>
            </div>

            {/* ABA FICHA 1: FINANCEIRO & HISTÓRICO */}
            {abaFicha === 'financeiro' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-sm text-[#003064]">
                    Histórico de Lançamentos de Folha
                  </h4>
                  <button
                    type="button"
                    onClick={() => setModalNovoLancFolhaAberto(true)}
                    className="flex items-center gap-1.5 bg-[#003064] hover:bg-[#00204A] text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#FCBC00]" />
                    <span>Lançar Provento / Desconto</span>
                  </button>
                </div>

                {/* Tabela de Lançamentos do Colaborador */}
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                        <th className="py-2.5 px-3">Tipo / Descrição</th>
                        <th className="py-2.5 px-3">Comp.</th>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3 text-right">Valor</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lancamentosFolha.filter(l => l.funcionario_id === funcionarioSelecionado.id).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            Nenhum lançamento registrado para este colaborador.
                          </td>
                        </tr>
                      ) : (
                        lancamentosFolha
                          .filter(l => l.funcionario_id === funcionarioSelecionado.id)
                          .map((l) => (
                            <tr key={l.id} className="hover:bg-slate-50/70">
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-slate-800">{l.descricao}</p>
                                <span className="text-[10px] text-slate-400 capitalize">{l.tipo.replace('_', ' ')}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-medium">{l.competencia}</td>
                              <td className="py-2.5 px-3 text-slate-600">{formatarDataBR(l.data_pagamento || l.data_prevista)}</td>
                              <td className={`py-2.5 px-3 text-right font-serif font-bold ${
                                l.tipo_operacao === 'desconto' ? 'text-red-600' : 'text-emerald-700'
                              }`}>
                                {l.tipo_operacao === 'desconto' ? '-' : '+'} {formatarValor(l.valor)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`inline-block text-[10px] font-bold px-2 py-0.2 rounded-full ${
                                  l.status === 'pago' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {l.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {l.status === 'pendente' ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const despesa = dbService.getLancamentos().find(lanc => lanc.id === l.lancamento_id) || {
                                        id: l.lancamento_id || ('folha-desc-' + l.id),
                                        tipo: 'despesa',
                                        descricao: `Folha: ${l.descricao} – ${funcionarioSelecionado.nome} (${l.competencia})`,
                                        valor: l.valor,
                                        data_vencimento: l.data_prevista,
                                        data_pagamento: null,
                                        status: 'pendente',
                                        conta_id: l.conta_id,
                                        categoria_id: 'cat-des-4',
                                        forma_pagamento: 'transferencia',
                                        recorrencia: 'nenhuma',
                                        origem: 'folha',
                                        funcionario_id: funcionarioSelecionado.id,
                                        criado_em: new Date().toISOString(),
                                      } as Lancamento;

                                      setFolhaIdParaLiquidar(l.id);
                                      setLancamentoParaPagar([despesa]);
                                      setModalPagarFolhaAberto(true);
                                    }}
                                    className="px-2 py-0.5 text-[11px] font-bold bg-emerald-600 text-white rounded-md"
                                  >
                                    Pagar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (confirm('Deseja excluir este lançamento de folha?')) {
                                        dbService.deleteLancamentoFolha(l.id);
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-red-600"
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA FICHA 2: RESUMO ANUAL MÊS A MÊS */}
            {abaFicha === 'resumo_anual' && (
              <div className="space-y-4">
                <h4 className="font-serif font-bold text-sm text-[#003064]">
                  Evolução Mensal da Remuneração ({anoAtualStr})
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">Mês</th>
                        <th className="py-2.5 px-3 text-right">Salário</th>
                        <th className="py-2.5 px-3 text-right">Comissões/Extras</th>
                        <th className="py-2.5 px-3 text-right">Adiantamentos</th>
                        <th className="py-2.5 px-3 text-right">Benefícios</th>
                        <th className="py-2.5 px-3 text-right">Total Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        '01', '02', '03', '04', '05', '06',
                        '07', '08', '09', '10', '11', '12'
                      ].map((m, idx) => {
                        const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                        const comp = `${m}/${anoAtualStr}`;
                        const eventosMes = lancamentosFolha.filter(
                          l => l.funcionario_id === funcionarioSelecionado.id && l.competencia === comp && l.status === 'pago'
                        );

                        const salario = eventosMes.filter(l => l.tipo === 'salario').reduce((acc, l) => acc + l.valor, 0);
                        const comissoes = eventosMes.filter(l => l.tipo === 'comissao' || l.tipo === 'hora_extra' || l.tipo === 'bonus').reduce((acc, l) => acc + l.valor, 0);
                        const adiant = eventosMes.filter(l => l.tipo === 'adiantamento').reduce((acc, l) => acc + l.valor, 0);
                        const benef = eventosMes.filter(l => l.tipo === 'vale').reduce((acc, l) => acc + l.valor, 0);
                        const totalPago = eventosMes.reduce((acc, l) => acc + l.valor, 0);

                        return (
                          <tr key={m} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {nomesMeses[idx]}/{anoAtualStr.slice(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-serif text-slate-700">{formatarValor(salario)}</td>
                            <td className="py-2 px-3 text-right font-serif text-emerald-700">{formatarValor(comissoes)}</td>
                            <td className="py-2 px-3 text-right font-serif text-amber-800">{formatarValor(adiant)}</td>
                            <td className="py-2 px-3 text-right font-serif text-slate-600">{formatarValor(benef)}</td>
                            <td className="py-2 px-3 text-right font-serif font-bold text-[#003064]">{formatarValor(totalPago)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA FICHA 3: DADOS CADASTRAIS COMPLETOS */}
            {abaFicha === 'dados' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="font-serif font-bold text-sm text-[#003064]">
                    Ficha Cadastral e Dados Contratuais
                  </h4>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleEditarFuncionario(funcionarioSelecionado)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#003064] font-bold"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar Cadastro</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Dados Pessoais */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h5 className="font-bold text-[#003064] uppercase text-[11px] flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-[#1A4A85]" />
                      Dados Pessoais
                    </h5>
                    <p><strong>CPF:</strong> {formatarCpfCnpj(funcionarioSelecionado.cpf)}</p>
                    <p><strong>RG:</strong> {funcionarioSelecionado.rg || '-'}</p>
                    <p><strong>Data de Nascimento:</strong> {formatarDataBR(funcionarioSelecionado.data_nascimento)}</p>
                    <p><strong>Telefone:</strong> {formatarTelefone(funcionarioSelecionado.telefone)}</p>
                    <p><strong>E-mail:</strong> {funcionarioSelecionado.email || '-'}</p>
                    <p><strong>Endereço:</strong> {funcionarioSelecionado.endereco || '-'}</p>
                    <p><strong>Contato Emergência:</strong> {funcionarioSelecionado.contato_emergencia_nome} ({formatarTelefone(funcionarioSelecionado.contato_emergencia_telefone)})</p>
                  </div>

                  {/* Contrato & Bancário */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h5 className="font-bold text-[#003064] uppercase text-[11px] flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-[#1A4A85]" />
                      Contrato & Dados Bancários
                    </h5>
                    <p><strong>Cargo:</strong> {funcionarioSelecionado.cargo}</p>
                    <p><strong>Setor:</strong> {funcionarioSelecionado.setor}</p>
                    <p><strong>Tipo de Contrato:</strong> {funcionarioSelecionado.tipo_contrato}</p>
                    <p><strong>Data de Admissão:</strong> {formatarDataBR(funcionarioSelecionado.data_admissao)}</p>
                    <p><strong>Carga Horária:</strong> {funcionarioSelecionado.carga_horaria}</p>
                    <p><strong>CTPS / PIS:</strong> {funcionarioSelecionado.ctps_pis || '-'}</p>
                    <div className="pt-2 border-t border-slate-200">
                      <p><strong>Banco:</strong> {funcionarioSelecionado.banco} • Agência: {funcionarioSelecionado.agencia} • Conta: {funcionarioSelecionado.conta}</p>
                      <p><strong>Chave PIX:</strong> {funcionarioSelecionado.chave_pix} ({funcionarioSelecionado.tipo_chave_pix})</p>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ABA FICHA 4: OCORRÊNCIAS */}
            {abaFicha === 'ocorrencias' && (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif font-bold text-sm text-[#003064]">
                    Histórico de Ocorrências e Registros de RH
                  </h4>
                </div>

                {/* Formulário Rápido de Nova Ocorrência */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.target as any;
                    const tipo = form.tipoOcorrencia.value;
                    const data = form.dataOcorrencia.value;
                    const descricao = form.descricaoOcorrencia.value;
                    if (!descricao) return;

                    dbService.adicionarOcorrencia(funcionarioSelecionado.id, {
                      id: 'oc-' + Date.now(),
                      tipo,
                      data,
                      descricao,
                      registrado_em: new Date().toISOString(),
                    });
                    form.reset();
                  }}
                  className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3"
                >
                  <span className="font-bold text-slate-700 block text-xs">+ Adicionar Nova Ocorrência</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Tipo</label>
                      <select name="tipoOcorrencia" className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white">
                        <option value="falta">Falta / Ausência</option>
                        <option value="atestado">Atestado Médico</option>
                        <option value="advertencia">Advertência</option>
                        <option value="elogio">Elogio / Mérito</option>
                        <option value="outro">Outro Registro</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Data</label>
                      <input type="date" name="dataOcorrencia" defaultValue={obterHojeISO()} className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" required />
                    </div>
                    <div className="sm:col-span-1 flex items-end">
                      <button type="submit" className="w-full bg-[#003064] text-white py-1.5 rounded-lg font-bold text-xs">
                        Registrar
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-semibold block mb-0.5">Descrição dos Fatos</label>
                    <input type="text" name="descricaoOcorrencia" placeholder="Ex: Apresentou atestado médico de 2 dias por gripe." className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white" required />
                  </div>
                </form>

                {/* Lista de Ocorrências Registradas */}
                <div className="space-y-2">
                  {!funcionarioSelecionado.ocorrencias || funcionarioSelecionado.ocorrencias.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">Nenhuma ocorrência registrada para este funcionário.</p>
                  ) : (
                    funcionarioSelecionado.ocorrencias.map(oc => (
                      <div key={oc.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.2 rounded-full ${
                              oc.tipo === 'elogio' ? 'bg-emerald-100 text-emerald-800' :
                              oc.tipo === 'advertencia' ? 'bg-red-100 text-red-800' :
                              oc.tipo === 'atestado' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {oc.tipo}
                            </span>
                            <span className="text-[11px] text-slate-400">{formatarDataBR(oc.data)}</span>
                          </div>
                          <p className="text-xs text-slate-800 mt-1">{oc.descricao}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL DE CADASTRO / EDIÇÃO COMPLETO (7 SEÇÕES / ABAS)  */}
      {/* ========================================================= */}
      <FormularioCadastroFuncionarioModal
        isOpen={modalCadastroAberto}
        onClose={() => setModalCadastroAberto(false)}
        funcionarioParaEditar={funcionarioEditando}
        onSucesso={() => {
          carregarDados();
          setModalCadastroAberto(false);
        }}
      />

      {/* ========================================================= */}
      {/* 7. MODAL DE NOVO LANÇAMENTO FINANCEIRO DE FOLHA           */}
      {/* ========================================================= */}
      {funcionarioSelecionado && (
        <ModalNovoLancamentoFolhaModal
          isOpen={modalNovoLancFolhaAberto}
          onClose={() => setModalNovoLancFolhaAberto(false)}
          funcionario={funcionarioSelecionado}
          contas={contas}
          competenciaDefault={competenciaAtiva}
          onSucesso={() => {
            carregarDados();
            setModalNovoLancFolhaAberto(false);
          }}
        />
      )}

      {/* ========================================================= */}
      {/* 8. MODAL DE PAGAMENTO / SIMULAÇÃO DE CHEQUE ESPECIAL      */}
      {/* ========================================================= */}
      <ModalPagarReceber
        isOpen={modalPagarFolhaAberto || modalPagarTodosAberto}
        onClose={() => {
          setModalPagarFolhaAberto(false);
          setModalPagarTodosAberto(false);
          setFolhaIdParaLiquidar(null);
        }}
        lancamentosAlvo={lancamentoParaPagar}
        tipoOperacao="pagar"
        onSucesso={() => {
          if (folhaIdParaLiquidar) {
            dbService.liquidarLancamentoFolha(folhaIdParaLiquidar, contas[0]?.id || 'conta-1');
          } else if (modalPagarTodosAberto) {
            // Liquidar todos os eventos da competência
            const pendentes = lancamentosFolha.filter(l => l.competencia === competenciaAtiva && l.status === 'pendente');
            dbService.liquidarFolhaEmLote(pendentes.map(p => p.id), contas[0]?.id || 'conta-1', obterHojeISO());
          }
          carregarDados();
          setModalPagarFolhaAberto(false);
          setModalPagarTodosAberto(false);
          setFolhaIdParaLiquidar(null);
        }}
      />

      {/* ========================================================= */}
      {/* 9. MODAL DE IMPRESSÃO DA FOLHA COM LOGO MT SOLAR          */}
      {/* ========================================================= */}
      <ModalImpressaoFolha
        isOpen={modalImpressaoAberto}
        onClose={() => setModalImpressaoAberto(false)}
        competencia={competenciaAtiva}
        funcionarios={funcionarios.filter(f => f.status === 'ativo')}
        lancamentosFolha={lancamentosFolha}
      />

      {/* ========================================================= */}
      {/* 10. MODAL DE HISTÓRICO DE AUDITORIA DE COLABORADORES      */}
      {/* ========================================================= */}
      <Modal
        isOpen={modalHistoricoAberto}
        onClose={() => setModalHistoricoAberto(false)}
        title="Histórico de Alterações – Colaboradores & Folha"
        subtitle="Registro de quem cadastrou, editou ou gerou eventos de colaboradores"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
            {dbService.getHistoricoAlteracoes().filter(h => h.modulo === 'funcionarios' || h.modulo === 'folha').length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Nenhum registro de alteração em funcionários ou folha até o momento.
              </p>
            ) : (
              dbService.getHistoricoAlteracoes().filter(h => h.modulo === 'funcionarios' || h.modulo === 'folha').map(h => (
                <div key={h.id} className="p-3 text-xs flex items-start justify-between gap-3 hover:bg-slate-50/70">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        h.acao === 'criacao' ? 'bg-emerald-100 text-emerald-800' :
                        h.acao === 'edicao' ? 'bg-blue-100 text-blue-800' :
                        h.acao === 'exclusao' ? 'bg-red-100 text-red-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {h.acao}
                      </span>
                      <span className="font-semibold text-slate-800">{h.descricao}</span>
                    </div>
                    {h.detalhes && (
                      <p className="text-[11px] text-slate-500 font-mono">{h.detalhes}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-700 text-[11px]">{h.usuario_nome}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {new Date(h.data_hora).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => setModalHistoricoAberto(false)}
              className="px-4 py-2 text-xs font-semibold bg-[#003064] text-white rounded-xl cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

// ============================================================================
// SUBCOMPONENTE: MODAL DE CADASTRO DE FUNCIONÁRIO COM AS 7 SEÇÕES SOLICITADAS
// ============================================================================
interface FormularioCadastroProps {
  isOpen: boolean;
  onClose: () => void;
  funcionarioParaEditar: Funcionario | null;
  onSucesso: () => void;
}

const FormularioCadastroFuncionarioModal: React.FC<FormularioCadastroProps> = ({
  isOpen,
  onClose,
  funcionarioParaEditar,
  onSucesso,
}) => {
  const [secaoAtiva, setSecaoAtiva] = useState<number>(1);

  // 1. Dados Pessoais
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [dataNascimento, setDataNascimento] = useState('1992-01-01');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [emergenciaNome, setEmergenciaNome] = useState('');
  const [emergenciaTelefone, setEmergenciaTelefone] = useState('');

  // 2. Contrato
  const [cargo, setCargo] = useState('Instalador Fotovoltaico');
  const [setor, setSetor] = useState<SetorFuncionario>('Instalação');
  const [tipoContrato, setTipoContrato] = useState<TipoContratoFuncionario>('CLT');
  const [dataAdmissao, setDataAdmissao] = useState(obterHojeISO());
  const [dataDesligamento, setDataDesligamento] = useState('');
  const [status, setStatus] = useState<StatusFuncionario>('ativo');
  const [cargaHoraria, setCargaHoraria] = useState('44h semanais');
  const [ctpsPis, setCtpsPis] = useState('');

  // 3. Remuneração
  const [salarioBase, setSalarioBase] = useState('3200');
  const [formaRemuneracao, setFormaRemuneracao] = useState<FormaRemuneracao>('mensal');
  const [diaPagamento, setDiaPagamento] = useState(5);
  const [comissaoTipo, setComissaoTipo] = useState<'percentual' | 'fixo'>('fixo');
  const [comissaoValor, setComissaoValor] = useState('0');
  const [adicionalTipo, setAdicionalTipo] = useState<'nenhum' | 'periculosidade' | 'insalubridade' | 'outro'>('periculosidade');
  const [adicionalPercentual, setAdicionalPercentual] = useState('30');
  const [adicionalValorFixo, setAdicionalValorFixo] = useState('0');

  // 4. Benefícios
  const [beneficios, setBeneficios] = useState<BeneficioFuncionario[]>([
    { id: 'b1', nome: 'Vale-Alimentação / Refeição', valor: 450.00 },
    { id: 'b2', nome: 'Vale-Transporte', valor: 220.00 },
  ]);
  const [novoBenefNome, setNovoBenefNome] = useState('');
  const [novoBenefValor, setNovoBenefValor] = useState('');

  // 5. Encargos & Provisões (com padrões)
  const [inssPatronal, setInssPatronal] = useState('20.0');
  const [fgts, setFgts] = useState('8.0');
  const [provisaoFerias, setProvisaoFerias] = useState('11.11');
  const [provisao13, setProvisao13] = useState('8.33');
  const [outrosEncargos, setOutrosEncargos] = useState('0');

  // 6. Dados Bancários
  const [banco, setBanco] = useState('Sicoob');
  const [agencia, setAgencia] = useState('3008');
  const [conta, setConta] = useState('');
  const [tipoChavePix, setTipoChavePix] = useState<'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'>('cpf');
  const [chavePix, setChavePix] = useState('');

  // 7. Observações
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (funcionarioParaEditar) {
      setNome(funcionarioParaEditar.nome);
      setCpf(funcionarioParaEditar.cpf);
      setRg(funcionarioParaEditar.rg || '');
      setDataNascimento(funcionarioParaEditar.data_nascimento);
      setTelefone(funcionarioParaEditar.telefone);
      setEmail(funcionarioParaEditar.email);
      setEndereco(funcionarioParaEditar.endereco);
      setEmergenciaNome(funcionarioParaEditar.contato_emergencia_nome);
      setEmergenciaTelefone(funcionarioParaEditar.contato_emergencia_telefone);

      setCargo(funcionarioParaEditar.cargo);
      setSetor(funcionarioParaEditar.setor);
      setTipoContrato(funcionarioParaEditar.tipo_contrato);
      setDataAdmissao(funcionarioParaEditar.data_admissao);
      setDataDesligamento(funcionarioParaEditar.data_desligamento || '');
      setStatus(funcionarioParaEditar.status);
      setCargaHoraria(funcionarioParaEditar.carga_horaria);
      setCtpsPis(funcionarioParaEditar.ctps_pis || '');

      setSalarioBase(String(funcionarioParaEditar.salario_base));
      setFormaRemuneracao(funcionarioParaEditar.forma_remuneracao);
      setDiaPagamento(funcionarioParaEditar.dia_pagamento);
      setComissaoTipo(funcionarioParaEditar.comissao_tipo);
      setComissaoValor(String(funcionarioParaEditar.comissao_valor));
      setAdicionalTipo(funcionarioParaEditar.adicional_tipo);
      setAdicionalPercentual(String(funcionarioParaEditar.adicional_percentual));
      setAdicionalValorFixo(String(funcionarioParaEditar.adicional_valor_fixo));

      setBeneficios(funcionarioParaEditar.beneficios || []);
      setInssPatronal(String(funcionarioParaEditar.inss_patronal_percentual));
      setFgts(String(funcionarioParaEditar.fgts_percentual));
      setProvisaoFerias(String(funcionarioParaEditar.provisao_ferias_percentual));
      setProvisao13(String(funcionarioParaEditar.provisao_13_percentual));
      setOutrosEncargos(String(funcionarioParaEditar.outros_encargos_percentual));

      setBanco(funcionarioParaEditar.banco);
      setAgencia(funcionarioParaEditar.agencia);
      setConta(funcionarioParaEditar.conta);
      setTipoChavePix(funcionarioParaEditar.tipo_chave_pix);
      setChavePix(funcionarioParaEditar.chave_pix);
      setObservacoes(funcionarioParaEditar.observacoes || '');
    } else {
      // Valores padrão para novo cadastro
      setNome('');
      setCpf('');
      setRg('');
      setDataNascimento('1994-05-10');
      setTelefone('');
      setEmail('');
      setEndereco('');
      setEmergenciaNome('');
      setEmergenciaTelefone('');

      setCargo('Instalador Fotovoltaico');
      setSetor('Instalação');
      setTipoContrato('CLT');
      setDataAdmissao(obterHojeISO());
      setDataDesligamento('');
      setStatus('ativo');
      setCargaHoraria('44h semanais');
      setCtpsPis('');

      setSalarioBase('3200');
      setFormaRemuneracao('mensal');
      setDiaPagamento(5);
      setComissaoTipo('fixo');
      setComissaoValor('0');
      setAdicionalTipo('periculosidade');
      setAdicionalPercentual('30');
      setAdicionalValorFixo('0');

      setBeneficios([
        { id: 'b1', nome: 'Vale-Alimentação / Refeição', valor: 450.00 },
        { id: 'b2', nome: 'Vale-Transporte', valor: 220.00 },
      ]);

      setInssPatronal('20.0');
      setFgts('8.0');
      setProvisaoFerias('11.11');
      setProvisao13('8.33');
      setOutrosEncargos('0');

      setBanco('Sicoob');
      setAgencia('3008');
      setConta('');
      setTipoChavePix('cpf');
      setChavePix('');
      setObservacoes('');
    }
    setSecaoAtiva(1);
  }, [funcionarioParaEditar, isOpen]);

  // CÁLCULO DINÂMICO EM TEMPO REAL DO CUSTO TOTAL
  const calculoCustoEmpresa = useMemo(() => {
    const sBase = Number(salarioBase) || 0;
    const adic = adicionalTipo === 'periculosidade' || adicionalTipo === 'insalubridade'
      ? sBase * ((Number(adicionalPercentual) || 0) / 100)
      : Number(adicionalValorFixo) || 0;
    const bruta = sBase + adic;
    const totalBen = beneficios.reduce((acc, b) => acc + (b.valor || 0), 0);

    const isCLT = tipoContrato === 'CLT';
    const inss = isCLT ? bruta * ((Number(inssPatronal) || 0) / 100) : 0;
    const fgtsVal = isCLT ? bruta * ((Number(fgts) || 0) / 100) : 0;
    const feriasVal = isCLT ? bruta * ((Number(provisaoFerias) || 0) / 100) : 0;
    const decimoVal = isCLT ? bruta * ((Number(provisao13) || 0) / 100) : 0;
    const outrosVal = isCLT ? bruta * ((Number(outrosEncargos) || 0) / 100) : 0;

    const totalEncargos = inss + fgtsVal + feriasVal + decimoVal + outrosVal;
    const custoFinal = bruta + totalBen + totalEncargos;

    return {
      salarioBase: sBase,
      adicional: adic,
      remuneracaoBruta: bruta,
      beneficios: totalBen,
      encargosProvisoes: totalEncargos,
      custoTotalMensal: custoFinal,
    };
  }, [salarioBase, adicionalTipo, adicionalPercentual, adicionalValorFixo, beneficios, tipoContrato, inssPatronal, fgts, provisaoFerias, provisao13, outrosEncargos]);

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Informe o nome do funcionário.');
      return;
    }

    const funcionario: Funcionario = {
      id: funcionarioParaEditar ? funcionarioParaEditar.id : ('func-' + Date.now()),
      nome: nome.trim(),
      cpf: cpf.trim(),
      rg: rg.trim(),
      data_nascimento: dataNascimento,
      telefone: telefone.trim(),
      email: email.trim(),
      endereco: endereco.trim(),
      contato_emergencia_nome: emergenciaNome.trim(),
      contato_emergencia_telefone: emergenciaTelefone.trim(),

      cargo: cargo.trim(),
      setor,
      tipo_contrato: tipoContrato,
      data_admissao: dataAdmissao,
      data_desligamento: dataDesligamento ? dataDesligamento : null,
      status,
      carga_horaria: cargaHoraria.trim(),
      ctps_pis: ctpsPis.trim(),

      salario_base: Number(salarioBase) || 0,
      forma_remuneracao: formaRemuneracao,
      dia_pagamento: Number(diaPagamento) || 5,
      comissao_tipo: comissaoTipo,
      comissao_valor: Number(comissaoValor) || 0,
      adicional_tipo: adicionalTipo,
      adicional_percentual: Number(adicionalPercentual) || 0,
      adicional_valor_fixo: Number(adicionalValorFixo) || 0,

      beneficios,
      inss_patronal_percentual: Number(inssPatronal) || 0,
      fgts_percentual: Number(fgts) || 0,
      provisao_ferias_percentual: Number(provisaoFerias) || 0,
      provisao_13_percentual: Number(provisao13) || 0,
      outros_encargos_percentual: Number(outrosEncargos) || 0,

      banco: banco.trim(),
      agencia: agencia.trim(),
      conta: conta.trim(),
      tipo_chave_pix: tipoChavePix,
      chave_pix: chavePix.trim(),

      observacoes: observacoes.trim(),
      ocorrencias: funcionarioParaEditar?.ocorrencias || [],
      criado_em: funcionarioParaEditar?.criado_em || new Date().toISOString(),
    };

    dbService.saveFuncionario(funcionario);
    onSucesso();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={funcionarioParaEditar ? `Editar Colaborador: ${funcionarioParaEditar.nome}` : 'Cadastrar Novo Colaborador MT Solar'}
      subtitle="Preencha os dados em 7 etapas para cálculo automático da folha e encargos"
      maxWidth="2xl"
    >
      <form onSubmit={handleSalvar} className="space-y-4">
        
        {/* NAVEGAÇÃO ENTRE AS 7 SEÇÕES */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 text-xs">
          {[
            { num: 1, label: '1. Pessoais' },
            { num: 2, label: '2. Contrato' },
            { num: 3, label: '3. Remuneração' },
            { num: 4, label: '4. Benefícios' },
            { num: 5, label: '5. Encargos' },
            { num: 6, label: '6. Bancários' },
            { num: 7, label: '7. Observações' },
          ].map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setSecaoAtiva(s.num)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                secaoAtiva === s.num
                  ? 'bg-[#003064] text-white shadow-2xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* SEÇÃO 1: DADOS PESSOAIS */}
        {secaoAtiva === 1 && (
          <div className="space-y-3 animate-in fade-in text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Nome Completo *</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo Souza"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">CPF *</label>
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">RG</label>
                <input
                  type="text"
                  value={rg}
                  onChange={(e) => setRg(e.target.value)}
                  placeholder="00.000.000-0 SSP/MT"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Data de Nascimento</label>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Telefone / WhatsApp *</label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(65) 99999-0000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carlos@mtsolar.com.br"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Endereço Residencial</label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  placeholder="Rua, número, bairro e cidade"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Contato de Emergência (Nome)</label>
                <input
                  type="text"
                  value={emergenciaNome}
                  onChange={(e) => setEmergenciaNome(e.target.value)}
                  placeholder="Ex: Maria (Esposa)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Telefone de Emergência</label>
                <input
                  type="text"
                  value={emergenciaTelefone}
                  onChange={(e) => setEmergenciaTelefone(e.target.value)}
                  placeholder="(65) 98888-0000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 2: CONTRATO */}
        {secaoAtiva === 2 && (
          <div className="space-y-3 animate-in fade-in text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cargo *</label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Instalador Fotovoltaico Líder"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Setor / Departamento *</label>
                <select
                  value={setor}
                  onChange={(e) => setSetor(e.target.value as SetorFuncionario)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {SETORES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tipo de Contrato *</label>
                <select
                  value={tipoContrato}
                  onChange={(e) => setTipoContrato(e.target.value as TipoContratoFuncionario)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {TIPOS_CONTRATO.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status Funcional *</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFuncionario)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold"
                >
                  <option value="ativo">Ativo</option>
                  <option value="ferias">Férias</option>
                  <option value="afastado">Afastado (INSS/Licença)</option>
                  <option value="desligado">Desligado</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Data de Admissão *</label>
                <input
                  type="date"
                  value={dataAdmissao}
                  onChange={(e) => setDataAdmissao(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Data de Desligamento (se houver)</label>
                <input
                  type="date"
                  value={dataDesligamento}
                  onChange={(e) => setDataDesligamento(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Carga Horária</label>
                <input
                  type="text"
                  value={cargaHoraria}
                  onChange={(e) => setCargaHoraria(e.target.value)}
                  placeholder="Ex: 44h semanais (Seg a Sex)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">CTPS / PIS / Registro</label>
                <input
                  type="text"
                  value={ctpsPis}
                  onChange={(e) => setCtpsPis(e.target.value)}
                  placeholder="Número CTPS e PIS"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 3: REMUNERAÇÃO */}
        {secaoAtiva === 3 && (
          <div className="space-y-3 animate-in fade-in text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Salário Base (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salarioBase}
                  onChange={(e) => setSalarioBase(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-serif font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Forma de Remuneração</label>
                <select
                  value={formaRemuneracao}
                  onChange={(e) => setFormaRemuneracao(e.target.value as FormaRemuneracao)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="mensal">Mensal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="diaria">Diária</option>
                  <option value="hora">Por Hora</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Dia do Pagamento (Mês)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={diaPagamento}
                  onChange={(e) => setDiaPagamento(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            {/* Comissões & Adicionais */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Comissão</label>
                  <div className="flex gap-2">
                    <select
                      value={comissaoTipo}
                      onChange={(e) => setComissaoTipo(e.target.value as any)}
                      className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="percentual">% sobre vendas</option>
                      <option value="fixo">R$ Fixo por usina</option>
                    </select>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={comissaoValor}
                      onChange={(e) => setComissaoValor(e.target.value)}
                      placeholder="Valor"
                      className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Adicional (Periculosidade/Insalubridade)</label>
                  <div className="flex gap-2">
                    <select
                      value={adicionalTipo}
                      onChange={(e) => setAdicionalTipo(e.target.value as any)}
                      className="text-xs px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="periculosidade">Periculosidade (30%)</option>
                      <option value="insalubridade">Insalubridade</option>
                      <option value="outro">Outro fixo</option>
                      <option value="nenhum">Nenhum</option>
                    </select>
                    {adicionalTipo === 'periculosidade' || adicionalTipo === 'insalubridade' ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={adicionalPercentual}
                          onChange={(e) => setAdicionalPercentual(e.target.value)}
                          className="w-16 px-2 py-1.5 border border-slate-300 rounded-lg bg-white text-center"
                        />
                        <span className="text-slate-500 font-bold">%</span>
                      </div>
                    ) : adicionalTipo === 'outro' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={adicionalValorFixo}
                        onChange={(e) => setAdicionalValorFixo(e.target.value)}
                        placeholder="R$ Fixo"
                        className="w-24 px-2 py-1.5 border border-slate-300 rounded-lg bg-white"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 4: BENEFÍCIOS */}
        {secaoAtiva === 4 && (
          <div className="space-y-3 animate-in fade-in text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Benefícios Mensais Concedidos</span>
              <span className="text-slate-400">Total: {formatarMoeda(calculoCustoEmpresa.beneficios)}</span>
            </div>

            {/* Adicionar Benefício */}
            <div className="flex gap-2">
              <input
                type="text"
                value={novoBenefNome}
                onChange={(e) => setNovoBenefNome(e.target.value)}
                placeholder="Nome (ex: Plano Odontológico, Seguro de Vida)"
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={novoBenefValor}
                onChange={(e) => setNovoBenefValor(e.target.value)}
                placeholder="R$ 0,00"
                className="w-28 px-3 py-1.5 border border-slate-300 rounded-xl"
              />
              <button
                type="button"
                onClick={() => {
                  if (!novoBenefNome || !novoBenefValor) return;
                  setBeneficios([
                    ...beneficios,
                    { id: 'b-' + Date.now(), nome: novoBenefNome, valor: Number(novoBenefValor) || 0 }
                  ]);
                  setNovoBenefNome('');
                  setNovoBenefValor('');
                }}
                className="bg-[#003064] text-white px-3 py-1.5 rounded-xl font-bold"
              >
                + Adicionar
              </button>
            </div>

            {/* Lista de Benefícios */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {beneficios.map((b, idx) => (
                <div key={b.id || idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-medium text-slate-800">{b.nome}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-serif font-bold text-slate-700">{formatarMoeda(b.valor)}</span>
                    <button
                      type="button"
                      onClick={() => setBeneficios(beneficios.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEÇÃO 5: ENCARGOS & PROVISÕES (COM CUSTO TOTAL CALCULADO EM TEMPO REAL) */}
        {secaoAtiva === 5 && (
          <div className="space-y-3 animate-in fade-in text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">INSS Patronal (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={inssPatronal}
                  onChange={(e) => setInssPatronal(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">FGTS (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={fgts}
                  onChange={(e) => setFgts(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Prov. Férias (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={provisaoFerias}
                  onChange={(e) => setProvisaoFerias(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Prov. 13º (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={provisao13}
                  onChange={(e) => setProvisao13(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Outros (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={outrosEncargos}
                  onChange={(e) => setOutrosEncargos(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-xl text-center font-bold"
                />
              </div>
            </div>

            {/* CARD DESTACADO: CUSTO TOTAL MENSAL PARA A EMPRESA */}
            <div className="p-4 rounded-xl bg-linear-to-r from-[#003064] to-[#00204A] text-white shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-[#FCBC00] font-bold">
                  Custo Total Mensal para a MT Solar
                </span>
                <span className="font-serif font-black text-xl text-white">
                  {formatarMoeda(calculoCustoEmpresa.custoTotalMensal)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-700 text-[11px] text-slate-300">
                <div>Salário Base: <strong className="text-white">{formatarMoeda(calculoCustoEmpresa.salarioBase)}</strong></div>
                <div>Adicionais: <strong className="text-white">{formatarMoeda(calculoCustoEmpresa.adicional)}</strong></div>
                <div>Benefícios: <strong className="text-white">{formatarMoeda(calculoCustoEmpresa.beneficios)}</strong></div>
                <div>Encargos/Prov: <strong className="text-white">{formatarMoeda(calculoCustoEmpresa.encargosProvisoes)}</strong></div>
              </div>

              {/* AVISO MANDATÓRIO */}
              <p className="text-[10px] text-amber-300 italic pt-1">
                * Aviso: Valores estimados para provisão financeira gerencial; confirme alíquotas com o contador.
              </p>
            </div>
          </div>
        )}

        {/* SEÇÃO 6: DADOS BANCÁRIOS */}
        {secaoAtiva === 6 && (
          <div className="space-y-3 animate-in fade-in text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Banco</label>
                <input
                  type="text"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  placeholder="Ex: Sicoob, Banco do Brasil, Bradesco"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Agência</label>
                <input
                  type="text"
                  value={agencia}
                  onChange={(e) => setAgencia(e.target.value)}
                  placeholder="0000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Conta Bancária</label>
                <input
                  type="text"
                  value={conta}
                  onChange={(e) => setConta(e.target.value)}
                  placeholder="00000-0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tipo da Chave PIX</label>
                <select
                  value={tipoChavePix}
                  onChange={(e) => setTipoChavePix(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Celular</option>
                  <option value="aleatoria">Chave Aleatória</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Chave PIX *</label>
                <input
                  type="text"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="Informe a chave PIX para pagamentos"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        {/* SEÇÃO 7: OBSERVAÇÕES */}
        {secaoAtiva === 7 && (
          <div className="space-y-3 animate-in fade-in text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Observações Internas</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={4}
                placeholder="Anotações sobre certificações NR, equipamentos EPI entregues, restrições médicas, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
        )}

        {/* BOTÕES DE NAVEGAÇÃO & AÇÕES DO FORMULÁRIO */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <div>
            {secaoAtiva > 1 && (
              <button
                type="button"
                onClick={() => setSecaoAtiva(secaoAtiva - 1)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Voltar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {secaoAtiva < 7 ? (
              <button
                type="button"
                onClick={() => setSecaoAtiva(secaoAtiva + 1)}
                className="px-4 py-2 text-xs font-semibold bg-[#003064] text-white rounded-xl shadow-2xs"
              >
                Avançar ({secaoAtiva + 1}/7)
              </button>
            ) : (
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-[#003064] hover:bg-[#00204A] text-white rounded-xl shadow-xs border-b-2 border-[#FCBC00] cursor-pointer"
              >
                Salvar Funcionário
              </button>
            )}
          </div>
        </div>

      </form>
    </Modal>
  );
};

// ============================================================================
// SUBCOMPONENTE: MODAL PARA LANÇAR NOVO EVENTO FINANCEIRO NA FOLHA DO COLABORADOR
// ============================================================================
interface NovoLancFolhaProps {
  isOpen: boolean;
  onClose: () => void;
  funcionario: Funcionario;
  contas: ContaBancaria[];
  competenciaDefault: string;
  onSucesso: () => void;
}

const ModalNovoLancamentoFolhaModal: React.FC<NovoLancFolhaProps> = ({
  isOpen,
  onClose,
  funcionario,
  contas,
  competenciaDefault,
  onSucesso,
}) => {
  const [tipo, setTipo] = useState<TipoLancamentoFolha>('salario');
  const [descricao, setDescricao] = useState(`Salário Mensal ${funcionario.cargo}`);
  const [valor, setValor] = useState(String(funcionario.salario_base));
  const [competencia, setCompetencia] = useState(competenciaDefault);
  const [dataPrevista, setDataPrevista] = useState(obterHojeISO());
  const [contaId, setContaId] = useState(contas[0]?.id || 'conta-1');
  const [abaterAdiantamento, setAbaterAdiantamento] = useState(false);

  const ficha = dbService.obterFichaFinanceira(funcionario.id);

  if (!isOpen) return null;

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    const numValor = Number(valor) || 0;
    const configTipo = TIPOS_LANCAMENTO_FOLHA.find(t => t.id === tipo);

    let valorFinal = numValor;
    if (tipo === 'salario' && abaterAdiantamento && ficha.saldoAdiantamentosAberto > 0) {
      valorFinal = Math.max(0, +(numValor - ficha.saldoAdiantamentosAberto).toFixed(2));
    }

    dbService.saveLancamentoFolha({
      id: 'folha-' + Date.now(),
      funcionario_id: funcionario.id,
      tipo,
      descricao: descricao.trim(),
      competencia,
      valor: valorFinal,
      tipo_operacao: configTipo?.tipoOperacao || 'provento',
      data_prevista: dataPrevista,
      data_pagamento: null,
      status: 'pendente',
      conta_id: contaId,
      observacoes: abaterAdiantamento ? `Abatimento de R$ ${ficha.saldoAdiantamentosAberto.toFixed(2)} em adiantamentos.` : undefined,
      criado_em: new Date().toISOString(),
    });

    onSucesso();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Lançar Pagamento / Provento: ${funcionario.nome}`}
      subtitle={`Competência: ${competencia} • Integração direta com Contas a Pagar MT Solar`}
      maxWidth="md"
    >
      <form onSubmit={handleSalvar} className="space-y-3.5 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Tipo de Evento da Folha</label>
          <select
            value={tipo}
            onChange={(e) => {
              const novo = e.target.value as TipoLancamentoFolha;
              setTipo(novo);
              const cfg = TIPOS_LANCAMENTO_FOLHA.find(t => t.id === novo);
              setDescricao(`${cfg?.label || novo} – ${funcionario.cargo}`);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium"
          >
            {TIPOS_LANCAMENTO_FOLHA.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
          <input
            type="text"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Valor Bruto (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl font-serif font-bold"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Competência (MM/AAAA)</label>
            <input
              type="text"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center"
              required
            />
          </div>
        </div>

        {/* Opção de Abater Adiantamentos em Aberto */}
        {tipo === 'salario' && ficha.saldoAdiantamentosAberto > 0 && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-1.5">
            <label className="flex items-start gap-2 cursor-pointer font-bold">
              <input
                type="checkbox"
                checked={abaterAdiantamento}
                onChange={(e) => setAbaterAdiantamento(e.target.checked)}
                className="mt-0.5 rounded-sm"
              />
              <span>
                Abater {formatarMoeda(ficha.saldoAdiantamentosAberto)} de adiantamentos em aberto?
              </span>
            </label>
            <p className="text-[11px] text-amber-800">
              O valor líquido a pagar será de: <strong>{formatarMoeda(Math.max(0, (Number(valor) || 0) - (abaterAdiantamento ? ficha.saldoAdiantamentosAberto : 0)))}</strong>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Data Prevista / Vencimento</label>
            <input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Conta Bancária de Débito</label>
            <select
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
            >
              {contas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600">Cancelar</button>
          <button type="submit" className="px-5 py-2 bg-[#003064] text-white rounded-xl font-bold">
            Confirmar Lançamento
          </button>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// SUBCOMPONENTE: MODAL DE IMPRESSÃO / RECIBO DA FOLHA DE PAGAMENTO
// ============================================================================
interface ImpressaoProps {
  isOpen: boolean;
  onClose: () => void;
  competencia: string;
  funcionarios: Funcionario[];
  lancamentosFolha: LancamentoFolha[];
}

const ModalImpressaoFolha: React.FC<ImpressaoProps> = ({
  isOpen,
  onClose,
  competencia,
  funcionarios,
  lancamentosFolha,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Versão para Impressão da Folha MT Solar"
      subtitle={`Visualização pronta para impressão com comprovantes • Competência ${competencia}`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        
        {/* Folha Formatada para Impressão */}
        <div id="folha-impressao" className="bg-white p-6 border border-slate-300 rounded-xl shadow-xs space-y-4 text-xs">
          
          {/* Topo com Logotipo e Dados da Empresa */}
          <div className="flex items-center justify-between pb-4 border-b-2 border-[#003064]">
            <Logo size="md" withWhiteBadge={false} />
            <div className="text-right text-[11px] text-slate-600">
              <strong className="block text-slate-900 font-bold">MT SOLAR SOLUÇÕES EM ENERGIA RENOVÁVEL LTDA</strong>
              <span>CNPJ: 34.892.105/0001-44 • Cuiabá - MT</span>
              <span className="block font-bold text-[#003064] mt-0.5">FOLHA DE PAGAMENTO – COMPETÊNCIA {competencia}</span>
            </div>
          </div>

          {/* Tabela de Colaboradores e Assinaturas */}
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-300 text-slate-700 font-bold">
                <th className="py-2 px-2">Colaborador</th>
                <th className="py-2 px-2">Cargo</th>
                <th className="py-2 px-2 text-right">Salário Base</th>
                <th className="py-2 px-2 text-right">Líquido a Pagar</th>
                <th className="py-2 px-2 text-center">Assinatura do Colaborador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {funcionarios.map(f => {
                const calc = dbService.calcularCustoTotalFuncionario(f);
                const sal = lancamentosFolha.find(l => l.funcionario_id === f.id && l.competencia === competencia && l.tipo === 'salario');
                const liquido = sal ? sal.valor : calc.remuneracaoBruta;

                return (
                  <tr key={f.id}>
                    <td className="py-2.5 px-2 font-bold text-slate-800">{f.nome}</td>
                    <td className="py-2.5 px-2 text-slate-600">{f.cargo}</td>
                    <td className="py-2.5 px-2 text-right font-serif">{formatarMoeda(f.salario_base)}</td>
                    <td className="py-2.5 px-2 text-right font-serif font-bold text-[#003064]">{formatarMoeda(liquido)}</td>
                    <td className="py-2.5 px-2 text-center text-slate-400">
                      ______________________________
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Rodapé da Folha com Assinatura da Diretoria */}
          <div className="pt-6 flex justify-between items-end text-[11px] text-slate-600">
            <div>
              <p>Emitido em: {formatarDataBR(obterHojeISO())}</p>
              <p>Sistema MT Solar Gestão Financeira Empresarial</p>
            </div>
            <div className="text-center">
              <div className="w-48 border-b border-slate-400 mb-1" />
              <p className="font-bold text-slate-800">Diretoria Financeira MT Solar</p>
            </div>
          </div>

        </div>

        {/* Botão de Disparo da Impressão */}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 text-xs font-semibold">
            Fechar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2 bg-[#003064] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Documento</span>
          </button>
        </div>

      </div>
    </Modal>
  );
};
