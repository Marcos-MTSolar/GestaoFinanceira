import React, { useState, useEffect, useMemo } from 'react';
import { dbService, subscribe } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { usePrivacy } from '../context/PrivacyContext';
import { formatarMoeda, formatarDataBR, estaAtrasado } from '../utils/formatters';
import { exportarLancamentosCSV } from '../utils/csvExporter';
import {
  Lancamento,
  TipoLancamento,
  StatusLancamento,
  FormaPagamento,
  ContaBancaria,
  Categoria,
  Contato,
  Projeto
} from '../types';
import { Modal } from '../components/Modal';
import { ModalPagarReceber } from '../components/ModalPagarReceber';
import { ModalConfirmarExclusao } from '../components/ModalConfirmarExclusao';
import {
  ReceiptText,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  Copy,
  Download,
  Calendar,
  Layers,
  Sparkles,
  Check,
  ChevronDown,
  ArrowUpDown,
  Tag,
  Users2,
  SunMedium,
  CheckSquare,
  Square,
  History
} from 'lucide-react';

interface LancamentosProps {
  modalNovoAbertoExterno?: boolean;
  onFecharModalExterno?: () => void;
  tipoFixo?: TipoLancamento;
}

export const Lancamentos: React.FC<LancamentosProps> = ({
  modalNovoAbertoExterno = false,
  onFecharModalExterno,
  tipoFixo,
}) => {
  const { isAdmin } = useAuth();
  const { formatarValor } = usePrivacy();

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);

  // FILTROS
  const [filtroTipo, setFiltroTipo] = useState<string>(tipoFixo || 'todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroConta, setFiltroConta] = useState<string>('todas');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todas');
  const [filtroContato, setFiltroContato] = useState<string>('todos');
  const [filtroProjeto, setFiltroProjeto] = useState<string>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>('todos');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [filtroBusca, setFiltroBusca] = useState<string>('');

  // ORDENAÇÃO
  const [ordemCampo, setOrdemCampo] = useState<'vencimento' | 'valor' | 'descricao'>('vencimento');
  const [ordemDirecao, setOrdemDirecao] = useState<'asc' | 'desc'>('desc');

  // MODAIS & SELEÇÃO
  const [modalAberto, setModalAberto] = useState(false);
  const [lancamentoEditando, setLancamentoEditando] = useState<Lancamento | null>(null);

  // Modal de Liquidação / Pagamento com Simulação
  const [modalPagarAberto, setModalPagarAberto] = useState(false);
  const [lancamentoParaLiquidar, setLancamentoParaLiquidar] = useState<Lancamento[]>([]);

  // Modal de Exclusão Escopada
  const [modalExclusaoAberto, setModalExclusaoAberto] = useState(false);
  const [lancamentoParaExcluir, setLancamentoParaExcluir] = useState<Lancamento | null>(null);

  // Modal de Histórico de Auditoria
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);

  // FORMULÁRIO DE LANÇAMENTO
  const [tipo, setTipo] = useState<TipoLancamento>(tipoFixo || 'receita');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dataPagamento, setDataPagamento] = useState('');
  const [status, setStatus] = useState<StatusLancamento>('pago');
  const [contaId, setContaId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [contatoId, setContatoId] = useState('');
  const [projetoId, setProjetoId] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('PIX');
  
  // Condição: 'nenhuma' | 'parcelado' | 'recorrente'
  const [modoCondicao, setModoCondicao] = useState<'nenhuma' | 'parcelado' | 'recorrente'>('nenhuma');
  const [totalParcelas, setTotalParcelas] = useState(2);
  const [tipoRecorrencia, setTipoRecorrencia] = useState<'semanal' | 'mensal' | 'anual'>('mensal');
  const [observacoes, setObservacoes] = useState('');

  // MINI CRIAÇÃO INLINE NA HORA (SEM SAIR DO FORMULÁRIO)
  const [inlineCriarCategoria, setInlineCriarCategoria] = useState(false);
  const [novaCatNome, setNovaCatNome] = useState('');
  const [novaCatCor, setNovaCatCor] = useState('#003064');

  const [inlineCriarContato, setInlineCriarContato] = useState(false);
  const [novoContatoNome, setNovoContatoNome] = useState('');
  const [novoContatoTelefone, setNovoContatoTelefone] = useState('');

  const [inlineCriarProjeto, setInlineCriarProjeto] = useState(false);
  const [novoProjetoNome, setNovoProjetoNome] = useState('');
  const [novoProjetoValor, setNovoProjetoValor] = useState('');

  const carregarDados = () => {
    setLancamentos(dbService.getLancamentos());
    const c = dbService.getContas();
    setContas(c);
    setCategorias(dbService.getCategorias());
    setContatos(dbService.getContatos());
    setProjetos(dbService.getProjetos());

    if (c.length > 0 && !contaId) {
      setContaId(c[0].id);
    }
  };

  useEffect(() => {
    carregarDados();
    const unsubL = subscribe('lancamentos', carregarDados);
    const unsubC = subscribe('contas', carregarDados);
    const unsubCat = subscribe('categorias', carregarDados);
    const unsubCon = subscribe('contatos', carregarDados);
    const unsubP = subscribe('projetos', carregarDados);

    return () => {
      unsubL();
      unsubC();
      unsubCat();
      unsubCon();
      unsubP();
    };
  }, []);

  useEffect(() => {
    if (modalNovoAbertoExterno) {
      abrirModalNovo();
    }
  }, [modalNovoAbertoExterno]);

  const abrirModalNovo = () => {
    setLancamentoEditando(null);
    setTipo(tipoFixo || 'receita');
    setDescricao('');
    setValor('');
    setDataVencimento(new Date().toISOString().split('T')[0]);
    setDataPagamento(new Date().toISOString().split('T')[0]);
    setStatus('pago');
    setContaId(contas[0]?.id || '');
    
    const catPadrao = categorias.find(c => c.tipo === (tipoFixo || 'receita'));
    setCategoriaId(catPadrao?.id || '');
    
    setContatoId('');
    setProjetoId('');
    setFormaPagamento('PIX');
    setModoCondicao('nenhuma');
    setTotalParcelas(2);
    setTipoRecorrencia('mensal');
    setObservacoes('');
    
    setInlineCriarCategoria(false);
    setInlineCriarContato(false);
    setInlineCriarProjeto(false);

    setModalAberto(true);
  };

  const abrirModalEditar = (l: Lancamento) => {
    setLancamentoEditando(l);
    setTipo(l.tipo);
    setDescricao(l.descricao);
    setValor(String(l.valor));
    setDataVencimento(l.data_vencimento);
    setDataPagamento(l.data_pagamento || '');
    setStatus(l.status);
    setContaId(l.conta_id);
    setCategoriaId(l.categoria_id);
    setContatoId(l.contato_id || '');
    setProjetoId(l.projeto_id || '');
    setFormaPagamento(l.forma_pagamento);
    
    if (l.recorrencia === 'parcelado') {
      setModoCondicao('parcelado');
      setTotalParcelas(l.total_parcelas || 2);
    } else if (l.recorrencia !== 'nenhuma') {
      setModoCondicao('recorrente');
      setTipoRecorrencia(l.recorrencia as any);
    } else {
      setModoCondicao('nenhuma');
    }

    setObservacoes(l.observacoes || '');
    setInlineCriarCategoria(false);
    setInlineCriarContato(false);
    setInlineCriarProjeto(false);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    if (onFecharModalExterno) onFecharModalExterno();
  };

  // Quick Inline Creation Handlers
  const handleSalvarCategoriaInline = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!novaCatNome.trim()) return;
    const nova = dbService.saveCategoria({
      id: 'cat-' + Date.now(),
      nome: novaCatNome.trim(),
      tipo,
      cor: novaCatCor,
    });
    setCategoriaId(nova.id);
    setNovaCatNome('');
    setInlineCriarCategoria(false);
  };

  const handleSalvarContatoInline = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!novoContatoNome.trim()) return;
    const novo = dbService.saveContato({
      id: 'contato-' + Date.now(),
      nome: novoContatoNome.trim(),
      tipo: tipo === 'receita' ? 'cliente' : 'fornecedor',
      cpf_cnpj: '',
      telefone: novoContatoTelefone.trim(),
      email: '',
      cidade: 'Cuiabá - MT',
    });
    setContatoId(novo.id);
    setNovoContatoNome('');
    setNovoContatoTelefone('');
    setInlineCriarContato(false);
  };

  const handleSalvarProjetoInline = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!novoProjetoNome.trim()) return;
    const novo = dbService.saveProjeto({
      id: 'proj-' + Date.now(),
      nome: novoProjetoNome.trim(),
      cliente: 'MT Solar',
      valor_contratado: Number(novoProjetoValor) || 0,
      status: 'em_andamento',
      data_inicio: new Date().toISOString().split('T')[0],
      data_previsao_fim: '',
    });
    setProjetoId(novo.id);
    setNovoProjetoNome('');
    setNovoProjetoValor('');
    setInlineCriarProjeto(false);
  };

  const salvarLancamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const val = Number(valor);
    if (isNaN(val) || val <= 0) {
      alert('Por favor, informe um valor monetário positivo válido.');
      return;
    }

    if (!contaId) {
      alert('Selecione uma conta bancária de débito/crédito.');
      return;
    }

    // 1. Parcelamento (gera N parcelas mensais automaticamente)
    if (modoCondicao === 'parcelado' && totalParcelas > 1 && !lancamentoEditando) {
      const grupoId = 'grp-parc-' + Date.now();
      const valorPorParcela = +(val / totalParcelas).toFixed(2);
      const dataBase = new Date(dataVencimento + 'T12:00:00');

      for (let i = 1; i <= totalParcelas; i++) {
        const dataVenc = new Date(dataBase);
        dataVenc.setMonth(dataBase.getMonth() + (i - 1));
        const vencIso = dataVenc.toISOString().split('T')[0];

        const novaParcela: Lancamento = {
          id: `lanc-${Date.now()}-${i}`,
          tipo,
          descricao: `${descricao.trim()} (${i}/${totalParcelas})`,
          valor: valorPorParcela,
          data_vencimento: vencIso,
          data_pagamento: i === 1 && status === 'pago' ? (dataPagamento || vencIso) : null,
          status: i === 1 && status === 'pago' ? 'pago' : 'pendente',
          conta_id: contaId,
          categoria_id: categoriaId,
          contato_id: contatoId || undefined,
          projeto_id: projetoId || undefined,
          forma_pagamento: formaPagamento,
          recorrencia: 'parcelado',
          parcela_atual: i,
          total_parcelas: totalParcelas,
          grupo_parcelas_id: grupoId,
          observacoes,
          origem: 'manual',
          criado_em: new Date().toISOString(),
        };
        dbService.saveLancamento(novaParcela);
      }
    }
    // 2. Recorrência (gerar os próximos 12 lançamentos)
    else if (modoCondicao === 'recorrente' && !lancamentoEditando) {
      const grupoRecId = 'grp-rec-' + Date.now();
      const dataBase = new Date(dataVencimento + 'T12:00:00');
      const QUANTIDADE_RECORRENCIAS = 12;

      for (let i = 1; i <= QUANTIDADE_RECORRENCIAS; i++) {
        const dataVenc = new Date(dataBase);
        if (tipoRecorrencia === 'semanal') {
          dataVenc.setDate(dataBase.getDate() + (i - 1) * 7);
        } else if (tipoRecorrencia === 'anual') {
          dataVenc.setFullYear(dataBase.getFullYear() + (i - 1));
        } else {
          // mensal
          dataVenc.setMonth(dataBase.getMonth() + (i - 1));
        }
        const vencIso = dataVenc.toISOString().split('T')[0];

        const novoRecorrente: Lancamento = {
          id: `lanc-rec-${Date.now()}-${i}`,
          tipo,
          descricao: `${descricao.trim()} [${tipoRecorrencia.toUpperCase()} ${i}/12]`,
          valor: val,
          data_vencimento: vencIso,
          data_pagamento: i === 1 && status === 'pago' ? (dataPagamento || vencIso) : null,
          status: i === 1 && status === 'pago' ? 'pago' : 'pendente',
          conta_id: contaId,
          categoria_id: categoriaId,
          contato_id: contatoId || undefined,
          projeto_id: projetoId || undefined,
          forma_pagamento: formaPagamento,
          recorrencia: tipoRecorrencia,
          grupo_recorrencia_id: grupoRecId,
          observacoes,
          origem: 'manual',
          criado_em: new Date().toISOString(),
        };
        dbService.saveLancamento(novoRecorrente);
      }
    }
    // 3. Lançamento Individual / Edição
    else {
      const registro: Lancamento = {
        id: lancamentoEditando ? lancamentoEditando.id : 'lanc-' + Date.now(),
        tipo,
        descricao: descricao.trim(),
        valor: val,
        data_vencimento: dataVencimento,
        data_pagamento: status === 'pago' ? (dataPagamento || dataVencimento) : null,
        status,
        conta_id: contaId,
        categoria_id: categoriaId,
        contato_id: contatoId || undefined,
        projeto_id: projetoId || undefined,
        forma_pagamento: formaPagamento,
        recorrencia: modoCondicao === 'parcelado' ? 'parcelado' : modoCondicao === 'recorrente' ? tipoRecorrencia : 'nenhuma',
        observacoes,
        origem: lancamentoEditando?.origem || 'manual',
        criado_em: lancamentoEditando?.criado_em || new Date().toISOString(),
      };
      dbService.saveLancamento(registro);
    }

    fecharModal();
  };

  // Ações de Duplicar e Excluir
  const handleDuplicar = (l: Lancamento) => {
    if (!isAdmin) return;
    dbService.duplicarLancamento(l.id);
  };

  const handleIniciarExclusao = (l: Lancamento) => {
    if (!isAdmin) return;
    setLancamentoParaExcluir(l);
    setModalExclusaoAberto(true);
  };

  const handleConfirmarExclusao = (escopo: 'so_esta' | 'futuras' | 'todas') => {
    if (!lancamentoParaExcluir) return;
    dbService.deleteLancamento(lancamentoParaExcluir.id, escopo);
  };

  // Abrir Modal de Pagamento / Recebimento com Simulação
  const handleAbrirLiquidar = (l: Lancamento) => {
    if (!isAdmin) return;
    setLancamentoParaLiquidar([l]);
    setModalPagarAberto(true);
  };

  // FILTRAGEM UNIFICADA
  const hoje = new Date().toISOString().split('T')[0];

  const lancamentosFiltrados = useMemo(() => {
    return lancamentos.filter((l) => {
      // Tipo
      if (filtroTipo !== 'todos' && l.tipo !== filtroTipo) return false;

      // Status
      const atrasado = estaAtrasado(l.status, l.data_vencimento);
      if (filtroStatus === 'pago' && l.status !== 'pago') return false;
      if (filtroStatus === 'pendente' && (l.status !== 'pendente' || atrasado)) return false;
      if (filtroStatus === 'atrasado' && !atrasado) return false;
      if (filtroStatus === 'cancelado' && l.status !== 'cancelado') return false;

      // Conta
      if (filtroConta !== 'todas' && l.conta_id !== filtroConta) return false;

      // Categoria
      if (filtroCategoria !== 'todas' && l.categoria_id !== filtroCategoria) return false;

      // Contato
      if (filtroContato !== 'todos' && l.contato_id !== filtroContato) return false;

      // Projeto
      if (filtroProjeto !== 'todos' && l.projeto_id !== filtroProjeto) return false;

      // Período
      const dataRef = l.data_pagamento || l.data_vencimento;
      if (filtroPeriodo === 'mes_atual') {
        const mesAtual = hoje.slice(0, 7);
        if (!dataRef.startsWith(mesAtual)) return false;
      } else if (filtroPeriodo === 'ultimos_30') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        const iso30 = d.toISOString().split('T')[0];
        if (dataRef < iso30 || dataRef > hoje) return false;
      } else if (filtroPeriodo === 'personalizado') {
        if (dataInicio && dataRef < dataInicio) return false;
        if (dataFim && dataRef > dataFim) return false;
      }

      // Busca por texto
      if (filtroBusca) {
        const q = filtroBusca.toLowerCase();
        const descOk = l.descricao.toLowerCase().includes(q);
        const obsOk = l.observacoes?.toLowerCase().includes(q);
        const contatoObj = contatos.find(c => c.id === l.contato_id);
        const contatoOk = contatoObj?.nome.toLowerCase().includes(q);
        const projetoObj = projetos.find(p => p.id === l.projeto_id);
        const projOk = projetoObj?.nome.toLowerCase().includes(q);
        if (!descOk && !obsOk && !contatoOk && !projOk) return false;
      }

      return true;
    }).sort((a, b) => {
      // Ordenação
      let res = 0;
      if (ordemCampo === 'vencimento') {
        res = a.data_vencimento.localeCompare(b.data_vencimento);
      } else if (ordemCampo === 'valor') {
        res = a.valor - b.valor;
      } else if (ordemCampo === 'descricao') {
        res = a.descricao.localeCompare(b.descricao);
      }
      return ordemDirecao === 'asc' ? res : -res;
    });
  }, [
    lancamentos,
    filtroTipo,
    filtroStatus,
    filtroConta,
    filtroCategoria,
    filtroContato,
    filtroProjeto,
    filtroPeriodo,
    dataInicio,
    dataFim,
    filtroBusca,
    ordemCampo,
    ordemDirecao,
    contatos,
    projetos,
    hoje,
  ]);

  // TOTAIS DO FILTRO
  const totalEntradasFiltradas = lancamentosFiltrados
    .filter(l => l.tipo === 'receita')
    .reduce((acc, l) => acc + l.valor, 0);

  const totalSaidasFiltradas = lancamentosFiltrados
    .filter(l => l.tipo === 'despesa')
    .reduce((acc, l) => acc + l.valor, 0);

  const resultadoFiltrado = totalEntradasFiltradas - totalSaidasFiltradas;

  return (
    <div className="space-y-6 pb-16">
      
      {/* Topo / Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#003064] flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-[#1A4A85]" />
            {tipoFixo === 'receita' ? 'Contas a Receber' : tipoFixo === 'despesa' ? 'Contas a Pagar' : 'Lançamentos Financeiros'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão analítica de receitas, despesas, parcelamentos fotovoltaicos e fluxo de caixa.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botão Histórico de Alterações */}
          <button
            onClick={() => setModalHistoricoAberto(true)}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            title="Histórico de alterações e auditoria dos lançamentos"
          >
            <History className="w-4 h-4 text-slate-600" />
            <span>Histórico</span>
          </button>

          {/* Botão Exportar CSV */}
          <button
            onClick={() => exportarLancamentosCSV(lancamentosFiltrados, contas, categorias, contatos, projetos)}
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            title="Exportar planilha CSV da lista filtrada"
          >
            <Download className="w-4 h-4 text-[#1A4A85]" />
            <span>Exportar CSV</span>
          </button>

          {isAdmin && (
            <button
              onClick={abrirModalNovo}
              type="button"
              className="flex items-center gap-2 bg-[#003064] hover:bg-[#00204A] text-white px-4 py-2 rounded-xl font-semibold text-xs shadow-xs border-b-2 border-[#FCBC00] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#FCBC00]" />
              <span>Novo Lançamento</span>
            </button>
          )}
        </div>
      </div>

      {/* TOTAIS DO FILTRO NO TOPO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total Entradas / Receitas
          </span>
          <p className="font-serif text-2xl font-extrabold text-[#16A34A] mt-1">
            +{formatarValor(totalEntradasFiltradas)}
          </p>
          <span className="text-[10px] text-slate-400">
            {lancamentosFiltrados.filter(l => l.tipo === 'receita').length} registros filtrados
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Total Saídas / Despesas
          </span>
          <p className="font-serif text-2xl font-extrabold text-[#DC2626] mt-1">
            -{formatarValor(totalSaidasFiltradas)}
          </p>
          <span className="text-[10px] text-slate-400">
            {lancamentosFiltrados.filter(l => l.tipo === 'despesa').length} registros filtrados
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Resultado Líquido do Filtro
          </span>
          <p className={`font-serif text-2xl font-extrabold mt-1 ${
            resultadoFiltrado >= 0 ? 'text-[#003064]' : 'text-red-600'
          }`}>
            {formatarValor(resultadoFiltrado)}
          </p>
          <span className="text-[10px] text-slate-400">
            Entradas − Saídas
          </span>
        </div>
      </div>

      {/* BARRA DE FILTROS COMPLETOS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por texto */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Buscar descrição, contato ou obs..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
            />
          </div>

          {/* Período */}
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          >
            <option value="todos">Todo o Período Histórico</option>
            <option value="mes_atual">Mês Atual</option>
            <option value="ultimos_30">Últimos 30 Dias</option>
            <option value="personalizado">Período Personalizado (Datas)</option>
          </select>

          {/* Tipo (se não for fixo) */}
          {!tipoFixo && (
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
            >
              <option value="todos">Todos os Tipos (Receitas e Despesas)</option>
              <option value="receita">Apenas Receitas (+)</option>
              <option value="despesa">Apenas Despesas (-)</option>
            </select>
          )}

          {/* Status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          >
            <option value="todos">Todos os Status</option>
            <option value="pago">Pagos / Liquidados</option>
            <option value="pendente">Pendentes no Prazo</option>
            <option value="atrasado">Atrasados / Vencidos</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>

        {/* Linha 2 de Filtros: Conta, Categoria, Contato, Projeto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
          <select
            value={filtroConta}
            onChange={(e) => setFiltroConta(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          >
            <option value="todas">Todas as Contas Bancárias</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          >
            <option value="todas">Todas as Categorias Solares</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.nome} ({cat.tipo})</option>
            ))}
          </select>

          <select
            value={filtroContato}
            onChange={(e) => setFiltroContato(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          >
            <option value="todos">Todos os Clientes / Fornecedores</option>
            {contatos.map((con) => (
              <option key={con.id} value={con.id}>{con.nome}</option>
            ))}
          </select>

          <select
            value={filtroProjeto}
            onChange={(e) => setFiltroProjeto(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
          >
            <option value="todos">Todos os Projetos Solares</option>
            {projetos.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>

        {/* Datas personalizadas se selecionado */}
        {filtroPeriodo === 'personalizado' && (
          <div className="flex items-center gap-3 pt-2 text-xs">
            <span className="text-slate-600 font-semibold">De:</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
            <span className="text-slate-600 font-semibold">Até:</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        )}
      </div>

      {/* TABELA DE LANÇAMENTOS */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <th className="py-3 px-4">Tipo</th>
                
                <th 
                  className="py-3 px-4 cursor-pointer hover:text-[#003064]"
                  onClick={() => {
                    if (ordemCampo === 'descricao') {
                      setOrdemDirecao(ordemDirecao === 'asc' ? 'desc' : 'asc');
                    } else {
                      setOrdemCampo('descricao');
                      setOrdemDirecao('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Descrição / Detalhes</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Conta</th>

                <th 
                  className="py-3 px-4 cursor-pointer hover:text-[#003064]"
                  onClick={() => {
                    if (ordemCampo === 'vencimento') {
                      setOrdemDirecao(ordemDirecao === 'asc' ? 'desc' : 'asc');
                    } else {
                      setOrdemCampo('vencimento');
                      setOrdemDirecao('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-1">
                    <span>Vencimento</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th 
                  className="py-3 px-4 cursor-pointer hover:text-[#003064] text-right"
                  onClick={() => {
                    if (ordemCampo === 'valor') {
                      setOrdemDirecao(ordemDirecao === 'asc' ? 'desc' : 'asc');
                    } else {
                      setOrdemCampo('valor');
                      setOrdemDirecao('desc');
                    }
                  }}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Valor</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>

                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lancamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nenhum lançamento encontrado para os critérios selecionados.
                  </td>
                </tr>
              ) : (
                lancamentosFiltrados.map((l) => {
                  const conta = contas.find(c => c.id === l.conta_id);
                  const cat = categorias.find(c => c.id === l.categoria_id);
                  const contato = contatos.find(c => c.id === l.contato_id);
                  const atrasado = estaAtrasado(l.status, l.data_vencimento);

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tipo Icon */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          l.tipo === 'receita'
                            ? 'bg-emerald-50 text-[#16A34A]'
                            : 'bg-red-50 text-[#DC2626]'
                        }`}>
                          {l.tipo === 'receita' ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                        </div>
                      </td>

                      {/* Descrição & Detalhes */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {l.descricao}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                          <span className="capitalize">{l.forma_pagamento}</span>
                          {contato && <span>• {contato.nome}</span>}
                          {l.recorrencia === 'parcelado' && l.total_parcelas && (
                            <span className="bg-slate-100 px-1.5 py-0.2 rounded-sm text-slate-600 font-semibold">
                              Parcela {l.parcela_atual}/{l.total_parcelas}
                            </span>
                          )}
                          {l.recorrencia !== 'nenhuma' && l.recorrencia !== 'parcelado' && (
                            <span className="bg-blue-50 text-[#003064] px-1.5 py-0.2 rounded-sm font-semibold capitalize">
                              Recorrente ({l.recorrencia})
                            </span>
                          )}
                          {l.observacoes && (
                            <span className="italic truncate max-w-[150px]">• {l.observacoes}</span>
                          )}
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold text-white shadow-2xs"
                          style={{ backgroundColor: cat?.cor || '#003064' }}
                        >
                          {cat?.nome || 'Geral'}
                        </span>
                      </td>

                      {/* Conta */}
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                        {conta?.nome || '-'}
                      </td>

                      {/* Vencimento */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className={atrasado ? 'text-red-600 font-bold' : 'text-slate-700'}>
                          {formatarDataBR(l.data_vencimento)}
                        </div>
                        {l.status === 'pago' && l.data_pagamento && (
                          <div className="text-[10px] text-emerald-700">
                            Liquidado: {formatarDataBR(l.data_pagamento)}
                          </div>
                        )}
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className={`font-serif font-bold text-sm ${
                          l.tipo === 'receita' ? 'text-[#16A34A]' : 'text-red-600'
                        }`}>
                          {l.tipo === 'receita' ? '+' : '-'} {formatarValor(l.valor)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          l.status === 'pago'
                            ? 'bg-emerald-100 text-emerald-800'
                            : atrasado
                            ? 'bg-red-100 text-red-800 animate-pulse'
                            : l.status === 'cancelado'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {l.status === 'pago'
                            ? 'Pago'
                            : atrasado
                            ? 'Atrasado'
                            : l.status === 'cancelado'
                            ? 'Cancelado'
                            : 'Pendente'}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Botão Pagar/Receber com Simulação */}
                          {isAdmin && l.status === 'pendente' && (
                            <button
                              onClick={() => handleAbrirLiquidar(l)}
                              className={`p-1 px-2.5 text-[10px] font-bold rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                l.tipo === 'despesa'
                                  ? 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                              }`}
                              title={l.tipo === 'despesa' ? 'Confirmar Pagamento com Simulação' : 'Confirmar Recebimento'}
                            >
                              <Check className="w-3 h-3" />
                              <span>{l.tipo === 'despesa' ? 'Pagar' : 'Receber'}</span>
                            </button>
                          )}

                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleDuplicar(l)}
                                className="p-1.5 text-slate-400 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Duplicar Lançamento"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => abrirModalEditar(l)}
                                className="p-1.5 text-slate-400 hover:text-[#003064] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Editar Lançamento"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleIniciarExclusao(l)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Excluir Lançamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
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
      </div>

      {/* MODAL 1: NOVO / EDIÇÃO COM ABAS COLORIDAS E MINI-CRIAÇÃO INLINE */}
      <Modal
        isOpen={modalAberto}
        onClose={fecharModal}
        title={lancamentoEditando ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
        subtitle="Entradas e saídas vinculadas às contas bancárias e projetos fotovoltaicos"
        maxWidth="xl"
      >
        <form onSubmit={salvarLancamento} className="space-y-4">
          
          {/* ABAS COLORIDAS: RECEITA (VERDE) E DESPESA (VERMELHO) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo do Lançamento *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTipo('receita');
                  const catRec = categorias.find(c => c.tipo === 'receita');
                  if (catRec) setCategoriaId(catRec.id);
                }}
                className={`py-2.5 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  tipo === 'receita'
                    ? 'bg-[#16A34A] text-white border-emerald-700 shadow-md ring-2 ring-emerald-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>Receita (Entrada em Conta)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTipo('despesa');
                  const catDes = categorias.find(c => c.tipo === 'despesa');
                  if (catDes) setCategoriaId(catDes.id);
                }}
                className={`py-2.5 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  tipo === 'despesa'
                    ? 'bg-[#DC2626] text-white border-red-700 shadow-md ring-2 ring-red-200'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" />
                <span>Despesa (Saída da Conta)</span>
              </button>
            </div>
          </div>

          {/* Descrição e Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Descrição do Lançamento *
              </label>
              <input
                type="text"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Aquisição Inversor Solar 75kW ou Parcela Contrato"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Valor Total (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
                required
              />
            </div>
          </div>

          {/* Conta Bancária e Categoria com criação na hora */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Conta Bancária / Destino *
              </label>
              <select
                value={contaId}
                onChange={(e) => setContaId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
                required
              >
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.banco})
                  </option>
                ))}
              </select>
            </div>

            {/* Categoria com botão inline "+ Criar na hora" */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Categoria Solar *
                </label>
                <button
                  type="button"
                  onClick={() => setInlineCriarCategoria(!inlineCriarCategoria)}
                  className="text-[11px] text-[#1A4A85] font-semibold hover:underline"
                >
                  {inlineCriarCategoria ? 'Cancelar' : '+ Criar Categoria'}
                </button>
              </div>

              {inlineCriarCategoria ? (
                <div className="p-2.5 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                  <input
                    type="text"
                    value={novaCatNome}
                    onChange={(e) => setNovaCatNome(e.target.value)}
                    placeholder="Nome da nova categoria..."
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">Cor:</span>
                      <input
                        type="color"
                        value={novaCatCor}
                        onChange={(e) => setNovaCatCor(e.target.value)}
                        className="w-6 h-5 rounded-xs p-0 border"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSalvarCategoriaInline}
                      className="px-2.5 py-1 bg-[#003064] text-white text-[11px] font-semibold rounded-lg"
                    >
                      Salvar Categoria
                    </button>
                  </div>
                </div>
              ) : (
                <select
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
                  required
                >
                  {categorias
                    .filter((c) => c.tipo === tipo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                </select>
              )}
            </div>
          </div>

          {/* Datas e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data de Vencimento *
              </label>
              <input
                type="date"
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusLancamento)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              >
                <option value="pago">Pago / Compensado</option>
                <option value="pendente">Pendente / A Vencer</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Data do Pagamento
              </label>
              <input
                type="date"
                value={dataPagamento}
                onChange={(e) => setDataPagamento(e.target.value)}
                disabled={status !== 'pago'}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
          </div>

          {/* Contato e Projeto com criação na hora */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Forma de Pagamento
              </label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
              >
                <option value="PIX">PIX</option>
                <option value="boleto">Boleto Bancário</option>
                <option value="transferencia">Transferência TED/DOC</option>
                <option value="cartao">Cartão de Crédito</option>
                <option value="dinheiro">Dinheiro em Espécie</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            {/* Contato */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Contato
                </label>
                <button
                  type="button"
                  onClick={() => setInlineCriarContato(!inlineCriarContato)}
                  className="text-[11px] text-[#1A4A85] font-semibold hover:underline"
                >
                  {inlineCriarContato ? 'Cancelar' : '+ Novo'}
                </button>
              </div>

              {inlineCriarContato ? (
                <div className="p-2 bg-slate-50 border border-slate-300 rounded-xl space-y-1.5">
                  <input
                    type="text"
                    value={novoContatoNome}
                    onChange={(e) => setNovoContatoNome(e.target.value)}
                    placeholder="Nome do cliente/fornecedor..."
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    value={novoContatoTelefone}
                    onChange={(e) => setNovoContatoTelefone(e.target.value)}
                    placeholder="Telefone/WhatsApp..."
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleSalvarContatoInline}
                    className="w-full py-1 bg-[#003064] text-white text-[11px] font-semibold rounded-lg"
                  >
                    Salvar Contato
                  </button>
                </div>
              ) : (
                <select
                  value={contatoId}
                  onChange={(e) => setContatoId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
                >
                  <option value="">(Nenhum selecionado)</option>
                  {contatos.map((con) => (
                    <option key={con.id} value={con.id}>{con.nome}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Projeto */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Projeto Solar
                </label>
                <button
                  type="button"
                  onClick={() => setInlineCriarProjeto(!inlineCriarProjeto)}
                  className="text-[11px] text-[#1A4A85] font-semibold hover:underline"
                >
                  {inlineCriarProjeto ? 'Cancelar' : '+ Novo'}
                </button>
              </div>

              {inlineCriarProjeto ? (
                <div className="p-2 bg-slate-50 border border-slate-300 rounded-xl space-y-1.5">
                  <input
                    type="text"
                    value={novoProjetoNome}
                    onChange={(e) => setNovoProjetoNome(e.target.value)}
                    placeholder="Nome do projeto solar..."
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    type="number"
                    value={novoProjetoValor}
                    onChange={(e) => setNovoProjetoValor(e.target.value)}
                    placeholder="Valor contratado (R$)..."
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleSalvarProjetoInline}
                    className="w-full py-1 bg-[#003064] text-white text-[11px] font-semibold rounded-lg"
                  >
                    Salvar Projeto
                  </button>
                </div>
              ) : (
                <select
                  value={projetoId}
                  onChange={(e) => setProjetoId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
                >
                  <option value="">(Nenhum projeto)</option>
                  {projetos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* PARCELAMENTO E RECORRÊNCIA */}
          {!lancamentoEditando && (
            <div className="p-3.5 bg-[#F5F7FA] rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#003064]" />
                  <span>Condição de Pagamento:</span>
                </label>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setModoCondicao('nenhuma')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      modoCondicao === 'nenhuma'
                        ? 'bg-[#003064] text-white'
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    À Vista / Único
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCondicao('parcelado')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      modoCondicao === 'parcelado'
                        ? 'bg-[#003064] text-white'
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    Parcelamento
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCondicao('recorrente')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      modoCondicao === 'recorrente'
                        ? 'bg-[#003064] text-white'
                        : 'bg-white text-slate-700 border border-slate-300'
                    }`}
                  >
                    Recorrência Fixa
                  </button>
                </div>
              </div>

              {modoCondicao === 'parcelado' && (
                <div className="flex items-center gap-3 pt-1 border-t border-slate-200">
                  <span className="text-xs text-slate-600 font-medium">Dividir em:</span>
                  <input
                    type="number"
                    min="2"
                    max="60"
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-20 px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                  <span className="text-xs text-slate-500">
                    parcelas mensais de <strong>{formatarMoeda(Number(valor) > 0 ? +(Number(valor) / totalParcelas) : 0)}</strong>
                  </span>
                </div>
              )}

              {modoCondicao === 'recorrente' && (
                <div className="flex items-center gap-3 pt-1 border-t border-slate-200 text-xs">
                  <span className="text-slate-600 font-medium">Repetir a cada:</span>
                  <select
                    value={tipoRecorrencia}
                    onChange={(e) => setTipoRecorrencia(e.target.value as any)}
                    className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="mensal">Mês (Mensal)</option>
                    <option value="semanal">Semana (Semanal)</option>
                    <option value="anual">Ano (Anual)</option>
                  </select>
                  <span className="text-slate-500 text-[11px]">
                    O sistema gerará automaticamente os próximos 12 lançamentos programados.
                  </span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Observações / Informações Fiscais
            </label>
            <textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Nota fiscal nº 1092, frete incluso, dados de faturamento..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={fecharModal}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold bg-[#003064] hover:bg-[#00204A] text-white rounded-xl shadow-xs border-b-2 border-[#FCBC00] cursor-pointer"
            >
              {lancamentoEditando ? 'Salvar Alterações' : 'Confirmar Lançamento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: PAGAR / RECEBER COM SIMULAÇÃO */}
      <ModalPagarReceber
        isOpen={modalPagarAberto}
        onClose={() => setModalPagarAberto(false)}
        lancamentosAlvo={lancamentoParaLiquidar}
        tipoOperacao={lancamentoParaLiquidar[0]?.tipo === 'despesa' ? 'pagar' : 'receber'}
        onSucesso={() => carregarDados()}
      />

      {/* MODAL 3: EXCLUSÃO DE PARCELAS ESCOPADA */}
      <ModalConfirmarExclusao
        isOpen={modalExclusaoAberto}
        onClose={() => setModalExclusaoAberto(false)}
        lancamento={lancamentoParaExcluir}
        onConfirmar={handleConfirmarExclusao}
      />

      {/* MODAL 4: HISTÓRICO DE AUDITORIA DE LANÇAMENTOS */}
      <Modal
        isOpen={modalHistoricoAberto}
        onClose={() => setModalHistoricoAberto(false)}
        title="Histórico de Alterações – Lançamentos"
        subtitle="Registro de quem criou, editou, quitou ou removeu lançamentos financeiros"
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
            {dbService.getHistoricoAlteracoes().filter(h => h.modulo === 'lancamentos').length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Nenhuma alteração registrada em lançamentos até o momento.
              </p>
            ) : (
              dbService.getHistoricoAlteracoes().filter(h => h.modulo === 'lancamentos').map(h => (
                <div key={h.id} className="p-3 text-xs flex items-start justify-between gap-3 hover:bg-slate-50/70">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        h.acao === 'criacao' ? 'bg-emerald-100 text-emerald-800' :
                        h.acao === 'edicao' ? 'bg-blue-100 text-blue-800' :
                        h.acao === 'exclusao' ? 'bg-red-100 text-red-800' :
                        h.acao === 'pagamento' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-700'
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
