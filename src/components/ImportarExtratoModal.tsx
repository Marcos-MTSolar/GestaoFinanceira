// MT Solar - Gestão Financeira
// Modal de Importação de Extratos Bancários - Passo 1: Seleção e Resolução de Contas (Parte 15B)

import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Plus,
  ArrowRight,
  Building2,
  Calendar,
  Layers,
  Check,
  Copy,
  RotateCcw,
  Scale,
  ExternalLink,
  Loader2,
  DollarSign,
  Info
} from 'lucide-react';
import { Modal } from './Modal';
import { ContaBancaria, RegraImportacao, ResultadoAjusteSaldoInicialLedgerbal } from '../types';
import {
  lerExtrato,
  ExtratoLido,
  resolverConta,
  ResultadoResolucaoConta,
  SugestaoCadastroConta,
  contaTemLancamentosImportados
} from '../utils/extrato';
import { formatarDataBR, formatarMoeda } from '../utils/formatters';
import { RevisaoExtrato, ItemRevisaoExtrato } from './extrato/RevisaoExtrato';
import { dbService } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { ResultadoImportacaoLote } from '../types';

export interface ArquivoExtratoItem {
  id: string;
  arquivo: File;
  carregando: boolean;
  erro?: string;
  extrato?: ExtratoLido;
  resolucao?: ResultadoResolucaoConta;
  contaSelecionadaId?: string;
  confirmacaoOutroBanco: boolean;
}

interface ImportarExtratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  contas: ContaBancaria[];
  contaPreSelecionadaId?: string;
  onCadastrarNovaConta?: (sugestao?: SugestaoCadastroConta) => void;
  onVerLote?: (loteId: string) => void;
}

export const ImportarExtratoModal: React.FC<ImportarExtratoModalProps> = ({
  isOpen,
  onClose,
  contas,
  contaPreSelecionadaId,
  onCadastrarNovaConta,
  onVerLote
}) => {
  const { usuario } = useAuth();
  const [arquivos, setArquivos] = useState<ArquivoExtratoItem[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [passo, setPasso] = useState<1 | 2 | 3>(1);

  // Estados de Gravação e Conclusão (Parte 15F)
  const [gravando, setGravando] = useState(false);
  const [erroGravacao, setErroGravacao] = useState<string | null>(null);
  const [resultadoLote, setResultadoLote] = useState<ResultadoImportacaoLote | null>(null);
  const [arquivoProcessadoFinal, setArquivoProcessadoFinal] = useState<{
    nomeArquivo: string;
    bancoNome: string;
    contaNome: string;
    saldoBancoInformado?: number;
    dataSaldoBanco?: string;
  } | null>(null);

  // Estados de Conciliação na Tela Final
  const [conciliadoSucesso, setConciliadoSucesso] = useState(false);
  const [saldoDigitadoConciliacao, setSaldoDigitadoConciliacao] = useState('');

  // Estados de Ajuste de Saldo Inicial (Requisito 2 - Parte 15H)
  const [modalAjusteAberto, setModalAjusteAberto] = useState(false);
  const [ajustandoSaldoInicial, setAjustandoSaldoInicial] = useState(false);
  const [resultadoAjuste, setResultadoAjuste] = useState<ResultadoAjusteSaldoInicialLedgerbal | null>(null);

  // Estados de Desfazer Importação
  const [modalDesfazerAberto, setModalDesfazerAberto] = useState(false);
  const [desfazendo, setDesfazendo] = useState(false);
  const [statusDesfeito, setStatusDesfeito] = useState<{
    removidos: number;
    restaurados: number;
  } | null>(null);

  // Assistente de Primeira Importação (Parte 15J)
  const [confirmacaoSubstituirSaldoInicial, setConfirmacaoSubstituirSaldoInicial] = useState<Record<string, boolean>>({});

  const [copiadoLote, setCopiadoLote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Limpa estado ao fechar
  useEffect(() => {
    if (!isOpen) {
      setArquivos([]);
      setPasso(1);
      setGravando(false);
      setErroGravacao(null);
      setResultadoLote(null);
      setArquivoProcessadoFinal(null);
      setConciliadoSucesso(false);
      setSaldoDigitadoConciliacao('');
      setModalAjusteAberto(false);
      setAjustandoSaldoInicial(false);
      setResultadoAjuste(null);
      setModalDesfazerAberto(false);
      setDesfazendo(false);
      setStatusDesfeito(null);
      setCopiadoLote(false);
    }
  }, [isOpen]);

  const processarArquivos = async (fileList: FileList | File[]) => {
    const novosItens: ArquivoExtratoItem[] = Array.from(fileList).map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      arquivo: file,
      carregando: true,
      confirmacaoOutroBanco: false
    }));

    setArquivos(prev => [...prev, ...novosItens]);

    for (const item of novosItens) {
      try {
        const buffer = await item.arquivo.arrayBuffer();
        const extrato = await lerExtrato(buffer, item.arquivo.name);
        const resolucao = resolverConta(extrato, contas.filter(c => c.ativa));

        let contaInicialId: string | undefined = undefined;
        if (resolucao.tipo === 'unica') {
          contaInicialId = resolucao.conta.id;
        } else if (contaPreSelecionadaId) {
          contaInicialId = contaPreSelecionadaId;
        }

        setArquivos(prev =>
          prev.map(a =>
            a.id === item.id
              ? {
                  ...a,
                  carregando: false,
                  extrato,
                  resolucao,
                  contaSelecionadaId: contaInicialId
                }
              : a
          )
        );
      } catch (err) {
        const mensagemErro = err instanceof Error ? err.message : 'Falha ao processar arquivo.';
        setArquivos(prev =>
          prev.map(a =>
            a.id === item.id
              ? {
                  ...a,
                  carregando: false,
                  erro: mensagemErro
                }
              : a
          )
        );
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastando(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processarArquivos(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processarArquivos(e.target.files);
    }
  };

  const removerArquivo = (id: string) => {
    setArquivos(prev => prev.filter(a => a.id !== id));
  };

  const selecionarContaArquivo = (idArquivo: string, contaId: string) => {
    setArquivos(prev =>
      prev.map(a =>
        a.id === idArquivo
          ? {
              ...a,
              contaSelecionadaId: contaId,
              confirmacaoOutroBanco: false
            }
          : a
      )
    );
  };

  const toggleConfirmacaoOutroBanco = (idArquivo: string) => {
    setArquivos(prev =>
      prev.map(a =>
        a.id === idArquivo
          ? { ...a, confirmacaoOutroBanco: !a.confirmacaoOutroBanco }
          : a
      )
    );
  };

  // Validação para avanço do Passo 1
  const podeAvancar =
    arquivos.length > 0 &&
    arquivos.every(item => {
      if (item.carregando || item.erro || !item.extrato || !item.contaSelecionadaId) {
        return false;
      }
      const contaEscolhida = contas.find(c => c.id === item.contaSelecionadaId);
      if (!contaEscolhida) return false;

      // Se bancos forem diferentes, exige confirmação explícita
      const bancoArquivo = item.extrato.bancoNome?.toLowerCase() || '';
      const bancoConta = contaEscolhida.banco?.toLowerCase() || '';
      const bancoDivergente =
        bancoArquivo && bancoConta && !bancoArquivo.includes(bancoConta) && !bancoConta.includes(bancoArquivo);

      if (bancoDivergente && !item.confirmacaoOutroBanco) {
        return false;
      }

      return true;
    });

  const handleAvancarPasso1 = () => {
    if (!podeAvancar) return;
    setPasso(2);
  };

  const arquivosValidosParaRevisao = arquivos
    .filter((a) => a.extrato && a.contaSelecionadaId)
    .map((a) => ({
      extrato: a.extrato!,
      contaId: a.contaSelecionadaId!,
      bancoCodigo: a.extrato!.bancoCodigo || '033',
      formato: a.extrato!.formato
    }));

  const handleExecutarGravacaoLote = async (dados: {
    itens: ItemRevisaoExtrato[];
    regrasACriar: Array<Omit<RegraImportacao, 'id'>>;
    saldoBanco?: { valor: number; data: string };
    ajustarDataSaldoInicial?: boolean;
    novaDataSaldoInicial?: string;
    /** Conta de aplicação selecionada explicitamente pelo usuário para Contamax */
    contaDestinoId?: string;
    /** Ajuste de saldo inicial para prevenir dupla contagem e conciliar com LEDGERBAL (Parte 15J) */
    saldoInicialAjustado?: {
      novoSaldoInicial: number;
      novaDataSaldoInicial: string;
      saldoInicialAnterior: number;
      dataSaldoInicialAnterior: string;
    };
  }) => {
    setGravando(true);
    setErroGravacao(null);

    const arquivoAtivo = arquivosValidosParaRevisao[0];
    if (!arquivoAtivo) {
      setErroGravacao('Nenhum extrato válido configurado para gravação.');
      setGravando(false);
      return;
    }

    const itemArquivoOriginal = arquivos.find(a => a.extrato === arquivoAtivo.extrato);
    const nomeArquivoReal = itemArquivoOriginal?.arquivo.name || arquivoAtivo.formato.toUpperCase();
    const contaAssociada = contas.find(c => c.id === arquivoAtivo.contaId);
    const loteId = `lote-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    let saldoBancoFinal: { valor: number; data: string } | undefined = dados.saldoBanco;
    if (!saldoBancoFinal && arquivoAtivo.extrato.saldoFinal?.valor !== undefined) {
      saldoBancoFinal = {
        valor: arquivoAtivo.extrato.saldoFinal.valor,
        data: arquivoAtivo.extrato.saldoFinal.data || arquivoAtivo.extrato.periodo.fim || new Date().toISOString().split('T')[0]
      };
    }

    setArquivoProcessadoFinal({
      nomeArquivo: nomeArquivoReal,
      bancoNome: arquivoAtivo.extrato.bancoNome || 'Banco',
      contaNome: contaAssociada?.nome || 'Conta Bancária',
      saldoBancoInformado: saldoBancoFinal?.valor,
      dataSaldoBanco: saldoBancoFinal?.data
    });

    try {
      const res = await dbService.importarExtratoLote({
        loteId,
        bancoCodigo: arquivoAtivo.bancoCodigo,
        contaId: arquivoAtivo.contaId,
        nomeArquivo: nomeArquivoReal,
        formato: arquivoAtivo.formato,
        periodo: arquivoAtivo.extrato.periodo,
        itens: dados.itens,
        regrasACriar: dados.regrasACriar,
        usuario: usuario?.email || 'Administrador',
        saldoBanco: saldoBancoFinal,
        ajustarDataSaldoInicial: dados.ajustarDataSaldoInicial,
        novaDataSaldoInicial: dados.novaDataSaldoInicial,
        // Conta de aplicação Contamax escolhida explicitamente pelo usuário (nunca automático)
        contaDestinoId: dados.contaDestinoId,
        // Ajuste de saldo inicial para prevenir dupla contagem e conciliar com LEDGERBAL (Parte 15J)
        saldoInicialAjustado: dados.saldoInicialAjustado
      });

      setResultadoLote(res);
      setPasso(3);
    } catch (err) {
      console.error('Falha na gravação do lote:', err);
      setErroGravacao(err instanceof Error ? err.message : 'Falha na gravação do lote.');
      setPasso(3);
    } finally {
      setGravando(false);
    }
  };

  const handleConciliarDiferenca = (valorSaldoBanco: number) => {
    if (!resultadoLote || !arquivoProcessadoFinal) return;
    const contaId = arquivosValidosParaRevisao[0]?.contaId;
    if (!contaId) return;

    const res = dbService.conciliarSaldoConta({
      contaId,
      novoSaldoReal: valorSaldoBanco,
      dataConciliacao: arquivoProcessadoFinal.dataSaldoBanco || new Date().toISOString().split('T')[0],
      observacoes: `Conciliação após importação do lote ${resultadoLote.loteId} (${arquivoProcessadoFinal.nomeArquivo})`
    });

    if (res.sucesso) {
      setConciliadoSucesso(true);
      setResultadoLote(prev => prev ? {
        ...prev,
        saldoDepois: valorSaldoBanco,
        diferencaConciliacao: 0
      } : null);
    }
  };

  const handleDesfazerLote = async () => {
    if (!resultadoLote) return;
    setDesfazendo(true);
    try {
      const res = await dbService.desfazerImportacao(resultadoLote.loteId);
      setStatusDesfeito({
        removidos: res.lancamentosRemovidos,
        restaurados: res.lancamentosRestaurados
      });
      setModalDesfazerAberto(false);
    } catch (err) {
      alert('Erro ao desfazer importação: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDesfazendo(false);
    }
  };

  const copiarLoteId = () => {
    if (!resultadoLote?.loteId) return;
    navigator.clipboard.writeText(resultadoLote.loteId);
    setCopiadoLote(true);
    setTimeout(() => setCopiadoLote(false), 2000);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          passo === 1
            ? 'Importar Extrato Bancário'
            : passo === 2
            ? 'Revisão e Categorização de Extrato'
            : 'Resumo da Importação e Conciliação Bancária'
        }
        subtitle={
          passo === 1
            ? 'Passo 1: Seleção de arquivos e identificação automática de contas'
            : passo === 2
            ? 'Passo 2: Defina as categorias e revise as transações antes de lançar'
            : 'Passo 3: Gravação concluída, totais contábeis e conciliação de saldos'
        }
        maxWidth={passo === 1 ? '2xl' : 'full'}
      >
        {gravando ? (
          <div className="p-12 text-center space-y-4 max-w-md mx-auto animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-[#003064]/10 flex items-center justify-center text-[#003064] mx-auto">
              <Loader2 className="w-8 h-8 animate-spin text-[#1A4A85]" />
            </div>
            <h3 className="font-serif text-lg font-bold text-[#003064]">
              Gravando Lote Atômico no Firestore...
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Processando e persistindo transações em batches de até 500 operações, atualizando regras e caches contábeis.
            </p>
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#003064] h-1.5 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        ) : passo === 3 ? (
          statusDesfeito ? (
            <div className="p-8 text-center space-y-4 max-w-lg mx-auto animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mx-auto">
                <RotateCcw className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-lg font-bold text-slate-800">
                Importação Desfeita com Sucesso!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Foram removidos <strong className="font-num text-slate-900">{statusDesfeito.removidos}</strong> lançamentos gerados exclusivamente pelo lote, e <strong className="font-num text-slate-900">{statusDesfeito.restaurados}</strong> lançamentos pré-existentes tiveram suas descrições e vínculos restaurados.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-[#003064] hover:bg-[#00204A] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          ) : erroGravacao ? (
            <div className="p-8 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-lg font-bold text-red-700">
                Erro ao Gravar Importação
              </h3>
              <p className="text-xs text-red-600 leading-relaxed">
                {erroGravacao}
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPasso(2)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold"
                >
                  Voltar para Revisão
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-[#003064] text-white rounded-xl text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : resultadoLote ? (
            <div className="space-y-6 max-w-4xl mx-auto py-2">
              {/* Cabeçalho de Sucesso */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-bold text-emerald-950">
                      Importação Finalizada com Sucesso!
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Arquivo: <strong>{arquivoProcessadoFinal?.nomeArquivo}</strong> • Conta: <strong>{arquivoProcessadoFinal?.contaNome}</strong> ({arquivoProcessadoFinal?.bancoNome})
                    </p>
                  </div>
                </div>

                {/* Badge do Lote com Copiar */}
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 text-xs">
                  <span className="text-slate-500 font-semibold">Lote:</span>
                  <code className="font-mono font-bold text-[#003064] text-[11px]">
                    {resultadoLote.loteId}
                  </code>
                  <button
                    type="button"
                    onClick={copiarLoteId}
                    className="p-1 hover:bg-slate-100 rounded-md text-slate-500 hover:text-[#003064] transition-colors cursor-pointer"
                    title="Copiar ID do Lote"
                  >
                    {copiadoLote ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Grid 4 Colunas: Totais de Transações */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Novas Lançadas
                  </span>
                  <p className="font-num text-2xl font-black text-emerald-600 mt-0.5">
                    {resultadoLote.totais.lancadas}
                  </p>
                  <span className="text-[10px] text-slate-500">Transações no sistema</span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Enriquecidas
                  </span>
                  <p className="font-num text-2xl font-black text-[#1A4A85] mt-0.5">
                    {resultadoLote.totais.enriquecidas}
                  </p>
                  <span className="text-[10px] text-slate-500">Descrição/FITID atualizados</span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Vinculadas
                  </span>
                  <p className="font-num text-2xl font-black text-indigo-600 mt-0.5">
                    {resultadoLote.totais.vinculadas}
                  </p>
                  <span className="text-[10px] text-slate-500">Lançamentos conciliados</span>
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Ignoradas / Duplicadas
                  </span>
                  <p className="font-num text-2xl font-black text-slate-500 mt-0.5">
                    {resultadoLote.totais.ignoradas + resultadoLote.totais.duplicadas}
                  </p>
                  <span className="text-[10px] text-slate-500">Preservadas sem alteração</span>
                </div>
              </div>

              {/* Resumo Financeiro & Impacto no Saldo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Entradas e Saídas */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <h4 className="font-serif text-xs font-bold text-[#003064] uppercase tracking-wider">
                    Movimentação Financeira do Lote
                  </h4>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Total de Entradas / Créditos:</span>
                    <strong className="font-num font-bold text-[#16A34A] text-sm">
                      +{formatarMoeda(resultadoLote.totais.total_creditos)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Total de Saídas / Débitos:</span>
                    <strong className="font-num font-bold text-[#DC2626] text-sm">
                      -{formatarMoeda(resultadoLote.totais.total_debitos)}
                    </strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-700">Resultado Líquido do Lote:</span>
                    <span className={`font-num ${
                      resultadoLote.totais.total_creditos >= resultadoLote.totais.total_debitos
                        ? 'text-emerald-700'
                        : 'text-red-700'
                    }`}>
                      {formatarMoeda(resultadoLote.totais.total_creditos - resultadoLote.totais.total_debitos)}
                    </span>
                  </div>
                </div>

                {/* Saldo da Conta Antes e Depois */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                  <h4 className="font-serif text-xs font-bold text-[#003064] uppercase tracking-wider">
                    Evolução do Saldo da Conta
                  </h4>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Saldo Real Antes da Importação:</span>
                    <strong className="font-num font-bold text-slate-800 text-sm">
                      {formatarMoeda(resultadoLote.saldoAntes)}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600">Saldo Real Atual (Após Lançamentos):</span>
                    <strong className={`font-num font-bold text-sm ${
                      resultadoLote.saldoDepois >= 0 ? 'text-[#003064]' : 'text-red-600'
                    }`}>
                      {formatarMoeda(resultadoLote.saldoDepois)}
                    </strong>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
                    <span>Variação total no saldo:</span>
                    <span className="font-num font-semibold text-slate-700">
                      {formatarMoeda(resultadoLote.saldoDepois - resultadoLote.saldoAntes)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Painel de Contas Afetadas — Transparência */}
              {resultadoLote.contasAfetadas && resultadoLote.contasAfetadas.length > 0 && (
                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-2">
                  <h4 className="font-serif text-xs font-bold text-[#003064] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Contas Afetadas por esta Importação</span>
                    {resultadoLote.contasAfetadas.length > 1 && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[10px] font-bold">
                        {resultadoLote.contasAfetadas.length} contas
                      </span>
                    )}
                  </h4>
                  <div className="divide-y divide-slate-100">
                    {resultadoLote.contasAfetadas.map((ca) => (
                      <div key={ca.contaId} className="flex items-center justify-between py-2 text-xs">
                        <span className="text-slate-700 font-medium">{ca.contaNome}</span>
                        <div className="flex items-center gap-3 font-num">
                          <span className="text-slate-500">{formatarMoeda(ca.saldoAntes)}</span>
                          <span className="text-slate-400">→</span>
                          <span className={ca.saldoDepois >= 0 ? 'text-[#003064] font-bold' : 'text-red-600 font-bold'}>
                            {formatarMoeda(ca.saldoDepois)}
                          </span>
                          <span className={`text-[10px] font-semibold ${
                            ca.saldoDepois - ca.saldoAntes >= 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            ({ca.saldoDepois - ca.saldoAntes >= 0 ? '+' : ''}{formatarMoeda(ca.saldoDepois - ca.saldoAntes)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {resultadoLote.contasAfetadas.length === 1 && (
                    <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                      <span>✓</span>
                      <span>Apenas a conta selecionada foi afetada. Nenhuma outra conta foi alterada.</span>
                    </p>
                  )}
                </div>
              )}

              {/* Painel de Conciliação Bancária — Requisitos 2 e 3 da Parte 15H */}
              <div className="p-4 rounded-2xl border transition-all bg-white shadow-2xs border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#003064]" />
                  <h4 className="font-serif text-xs font-bold text-[#003064] uppercase tracking-wider">
                    Conciliação Bancária — Comparação de Saldos
                  </h4>
                </div>

                {/* Tabela comparativa: saldo calculado × LEDGERBAL × diferença (Item 3) */}
                {arquivoProcessadoFinal?.saldoBancoInformado !== undefined ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Saldo Calculado pelo App</span>
                        <span className={`font-num font-bold text-sm ${
                          resultadoLote.saldoDepois >= 0 ? 'text-[#003064]' : 'text-red-700'
                        }`}>
                          {formatarMoeda(resultadoLote.saldoDepois)}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                          LEDGERBAL do Banco ({formatarDataBR(arquivoProcessadoFinal.dataSaldoBanco || '')})
                        </span>
                        <span className={`font-num font-bold text-sm ${
                          arquivoProcessadoFinal.saldoBancoInformado >= 0 ? 'text-emerald-700' : 'text-red-700'
                        }`}>
                          {formatarMoeda(arquivoProcessadoFinal.saldoBancoInformado)}
                        </span>
                      </div>
                      <div className={`p-3 rounded-xl border ${
                        Math.abs(resultadoLote.diferencaConciliacao || 0) < 0.01
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-amber-50 border-amber-300'
                      }`}>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Diferença Exata</span>
                        <span className={`font-num font-bold text-sm ${
                          Math.abs(resultadoLote.diferencaConciliacao || 0) < 0.01
                            ? 'text-emerald-700'
                            : (resultadoLote.diferencaConciliacao || 0) > 0
                            ? 'text-emerald-600'
                            : 'text-red-700'
                        }`}>
                          {(resultadoLote.diferencaConciliacao || 0) > 0 ? '+' : ''}
                          {formatarMoeda(resultadoLote.diferencaConciliacao || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Saldos conciliados perfeitamente ou ajuste já realizado */}
                    {Math.abs(resultadoLote.diferencaConciliacao || 0) < 0.01 ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold">Saldos Idênticos!</p>
                          <p className="text-[11px] text-emerald-700">
                            O saldo calculado pelo app ({formatarMoeda(resultadoLote.saldoDepois)}) coincide com o LEDGERBAL do banco ({formatarMoeda(arquivoProcessadoFinal.saldoBancoInformado)} em {formatarDataBR(arquivoProcessadoFinal.dataSaldoBanco || '')}).
                          </p>
                        </div>
                      </div>
                    ) : resultadoAjuste ? (
                      /* Exibe resultado do ajuste de saldo inicial */
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold">Saldo Inicial Ajustado com Sucesso!</p>
                          <p className="text-[11px] text-emerald-700">
                            Saldo inicial alterado de <strong className="font-num">{formatarMoeda(resultadoAjuste.saldoInicialAnterior)}</strong> para <strong className="font-num">{formatarMoeda(resultadoAjuste.saldoInicialNovo)}</strong> (data: {formatarDataBR(resultadoAjuste.dataSaldoInicialNova)}).
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Saldo final calculado agora: <strong className="font-num">{formatarMoeda(resultadoAjuste.saldoFinalAposAjuste)}</strong>.
                            {Math.abs(resultadoAjuste.diferenca) < 0.01
                              ? ' ✓ Perfeita coincidência com o banco.'
                              : ` Diferença residual: ${formatarMoeda(resultadoAjuste.diferenca)}.`}
                          </p>
                          <p className="text-[10px] text-emerald-600 italic">
                            ⚠ Nenhum lançamento de ajuste foi criado. Apenas o campo "Saldo Inicial" da conta foi alterado.
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Diferença → oferecer ajuste de saldo inicial */
                      <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-900">
                              Diferença de {formatarMoeda(Math.abs(resultadoLote.diferencaConciliacao || 0))} entre o app e o extrato bancário.
                            </p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              Isso ocorre quando o saldo inicial da conta está diferente do saldo real antes do primeiro lançamento importado (ex.: lançamentos Contamax ignorados, histórico anterior ao período importado, etc.).
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-amber-200/80">
                          <p className="text-[11px] text-amber-800 mb-2">
                            <strong>Ação recomendada:</strong> Ajustar o saldo inicial da conta para que o saldo calculado pelo app coincida exatamente com o LEDGERBAL do banco.<br />
                            <span className="text-amber-700">Isso altera SÓ o campo "Saldo Inicial" da conta. Nenhum lançamento de ajuste é criado.</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setModalAjusteAberto(true)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#003064] hover:bg-[#00204A] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Ajustar saldo inicial para bater com o banco
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Sem LEDGERBAL: permite digitar para conferência */
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                    <p className="text-slate-700">
                      O arquivo importado não continha saldo final explícito (LEDGERBAL). Deseja informar o saldo fornecido pelo banco para conferência?
                    </p>
                    <div className="flex items-center gap-2 max-w-sm">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Ex.: -7377.22"
                        value={saldoDigitadoConciliacao}
                        onChange={(e) => setSaldoDigitadoConciliacao(e.target.value)}
                        className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg flex-1"
                      />
                      <button
                        type="button"
                        disabled={!saldoDigitadoConciliacao.trim()}
                        onClick={() => {
                          const val = Number(saldoDigitadoConciliacao.replace(',', '.'));
                          if (!isNaN(val)) {
                            // Apenas armazena para exibição — sem conciliar automaticamente
                            setArquivoProcessadoFinal(prev => prev ? {
                              ...prev,
                              saldoBancoInformado: val,
                              dataSaldoBanco: prev.dataSaldoBanco || new Date().toISOString().split('T')[0]
                            } : null);
                          }
                        }}
                        className="px-3 py-1.5 bg-[#003064] hover:bg-[#00204A] disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Comparar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Ações Finais: Desfazer, Ver Lançamentos e Fechar */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setModalDesfazerAberto(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Desfazer Importação deste Lote</span>
                </button>

                <div className="flex items-center gap-2">
                  {onVerLote && (
                    <button
                      type="button"
                      onClick={() => {
                        onVerLote(resultadoLote.loteId);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                      <span>Ver Lançamentos do Lote</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 bg-[#003064] hover:bg-[#00204A] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Concluir e Fechar
                  </button>
                </div>
              </div>
            </div>
          ) : null
        ) : passo === 2 ? (
          <RevisaoExtrato
            extratosComConta={arquivosValidosParaRevisao}
            contas={contas}
            onVoltar={() => setPasso(1)}
            onConcluirRevisao={handleExecutarGravacaoLote}
          />
        ) : (
          <div className="space-y-6">
          {/* Dropzone de Arquivos */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setArrastando(true);
            }}
            onDragLeave={() => setArrastando(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              arrastando
                ? 'border-[#FCBC00] bg-amber-50/60 scale-[1.01]'
                : 'border-slate-300 hover:border-[#003064] bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".ofx,.qfx,.xlsx"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-[#003064]/5 flex items-center justify-center text-[#003064]">
                <UploadCloud className="w-6 h-6 text-[#1A4A85]" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  Arraste seus extratos aqui ou <span className="text-[#1A4A85] underline">clique para selecionar</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Formatos aceitos: <strong>OFX</strong>, <strong>QFX</strong> e <strong>XLSX</strong> (Santander e homologados). Múltiplos arquivos permitidos.
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Arquivos Processados */}
          {arquivos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-serif text-xs font-bold text-[#003064] uppercase tracking-wider">
                  Arquivos Selecionados ({arquivos.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setArquivos([])}
                  className="text-[11px] text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Limpar todos
                </button>
              </div>

              <div className="space-y-3">
                {arquivos.map((item) => {
                  const contaEscolhida = contas.find(c => c.id === item.contaSelecionadaId);
                  const bancoArquivo = item.extrato?.bancoNome?.toLowerCase() || '';
                  const bancoConta = contaEscolhida?.banco?.toLowerCase() || '';
                  const bancoDivergente =
                    Boolean(bancoArquivo && bancoConta && !bancoArquivo.includes(bancoConta) && !bancoConta.includes(bancoArquivo));

                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.erro
                          ? 'border-red-200 bg-red-50/40'
                          : item.carregando
                          ? 'border-slate-200 bg-slate-50 animate-pulse'
                          : 'border-slate-200 bg-white shadow-2xs'
                      }`}
                    >
                      {/* Linha Superior: Nome do Arquivo e Botão Remover */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.arquivo.name.toLowerCase().endsWith('.xlsx') ? (
                            <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                          ) : (
                            <FileCode className="w-5 h-5 text-[#1A4A85] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate" title={item.arquivo.name}>
                              {item.arquivo.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {(item.arquivo.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removerArquivo(item.id)}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Remover arquivo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Estado: Carregando */}
                      {item.carregando && (
                        <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                          <span className="w-3 h-3 border-2 border-[#003064] border-t-transparent rounded-full animate-spin" />
                          Analisando formato e detectando banco pelo conteúdo...
                        </p>
                      )}

                      {/* Estado: Erro */}
                      {item.erro && (
                        <div className="mt-2.5 p-2.5 bg-red-100/60 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-semibold">Erro ao ler arquivo:</p>
                            <p className="mt-0.5 text-[11px]">{item.erro}</p>
                          </div>
                        </div>
                      )}

                      {/* Estado: Sucesso e Metadados */}
                      {item.extrato && !item.carregando && (
                        <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                          {/* Metadados Detectados */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[10px] bg-[#003064] text-white">
                              {item.extrato.formato.toUpperCase()}
                            </span>

                            <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-red-50 text-red-700 border border-red-200">
                              {item.extrato.bancoNome || 'Banco Desconhecido'} {item.extrato.bancoCodigo ? `(${item.extrato.bancoCodigo})` : ''}
                            </span>

                            <span className="text-[11px] text-slate-600 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {item.extrato.periodo.inicio && item.extrato.periodo.fim ? (
                                <>
                                  {formatarDataBR(item.extrato.periodo.inicio)} até {formatarDataBR(item.extrato.periodo.fim)}
                                </>
                              ) : (
                                'Período contínuo'
                              )}
                            </span>

                            <span className="text-[11px] text-slate-700 font-semibold flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-num font-bold text-slate-900">{item.extrato.transacoes.length}</span> transações
                            </span>
                          </div>

                          {/* Associação com a Conta Cadastrada */}
                          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-[#1A4A85]" />
                                Conta Bancária Associada no Sistema:
                              </label>

                              {item.resolucao?.tipo === 'unica' && (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Identificada com sucesso
                                </span>
                              )}

                              {item.resolucao?.tipo === 'ambigua' && (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                                  Múltiplas candidatas
                                </span>
                              )}

                              {item.resolucao?.tipo === 'nenhuma' && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full">
                                  Nenhuma conta correspondente
                                </span>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <select
                                value={item.contaSelecionadaId || ''}
                                onChange={(e) => selecionarContaArquivo(item.id, e.target.value)}
                                className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
                              >
                                <option value="">-- Selecione uma conta bancária --</option>
                                {contas
                                  .filter(c => c.ativa)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.nome} ({c.banco} {c.agencia ? `Ag. ${c.agencia}` : ''} {c.numero_conta ? `CC ${c.numero_conta}` : ''})
                                    </option>
                                  ))}
                              </select>

                              {item.resolucao?.tipo === 'nenhuma' && onCadastrarNovaConta && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onCadastrarNovaConta(item.resolucao?.tipo === 'nenhuma' ? item.resolucao.sugestao : undefined);
                                  }}
                                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#003064] hover:bg-[#00204A] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
                                >
                                  <Plus className="w-3.5 h-3.5 text-[#FCBC00]" />
                                  <span>Cadastrar esta conta agora</span>
                                </button>
                              )}
                            </div>

                            {/* Assistente de Primeira Importação (Requisito 1 - Parte 15J) */}
                            {contaEscolhida && !contaTemLancamentosImportados(contaEscolhida.id, dbService.getLancamentos()) && (
                              <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl text-xs space-y-1.5 text-blue-950">
                                <div className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-[#1A4A85] shrink-0 mt-0.5" />
                                  <div className="space-y-0.5">
                                    <p className="font-bold text-[#003064]">
                                      Primeira importação desta conta
                                    </p>
                                    <p className="text-[11px] text-blue-900 leading-relaxed">
                                      O saldo inicial NÃO precisa ser informado e será calculado com o saldo final do banco.<br />
                                      O movimento do período será consolidado com precisão e segurança.
                                    </p>
                                  </div>
                                </div>

                                {contaEscolhida.saldo_inicial !== 0 && (
                                  <div className="mt-2 pt-2 border-t border-blue-200 bg-white/80 p-2.5 rounded-lg text-[11px] text-slate-800 space-y-1.5">
                                    <p className="text-slate-700">
                                      A conta possui saldo inicial de <strong className="font-num text-slate-900">{formatarMoeda(contaEscolhida.saldo_inicial)}</strong> cadastrado.
                                      <br />
                                      <span className="font-semibold text-slate-900">Este valor é o saldo de hoje/final?</span> Se sim, ele será substituído pelo saldo calculado retroativo para prevenir contagem em dobro.
                                    </p>
                                    <label className="flex items-center gap-2 font-semibold text-blue-950 cursor-pointer pt-0.5">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(confirmacaoSubstituirSaldoInicial[item.id])}
                                        onChange={(e) =>
                                          setConfirmacaoSubstituirSaldoInicial(prev => ({
                                            ...prev,
                                            [item.id]: e.target.checked
                                          }))
                                        }
                                        className="rounded border-blue-400 text-[#003064] focus:ring-[#003064] cursor-pointer"
                                      />
                                      <span>Sim, este valor é o saldo de hoje/final. Substituir pelo saldo calculado.</span>
                                    </label>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Alerta de Banco Divergente e Confirmação Explícita */}
                            {bancoDivergente && (
                              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-2 text-amber-900 animate-in fade-in">
                                <div className="flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="font-bold text-amber-950">
                                      Atenção: Banco do arquivo ({item.extrato.bancoNome}) é diferente da conta selecionada ({contaEscolhida?.banco}).
                                    </p>
                                    <p className="text-[11px] text-amber-800 mt-0.5">
                                      Para evitar lançamentos indevidos na conta errada, é necessário confirmar conscientemente a operação.
                                    </p>
                                  </div>
                                </div>

                                <label className="flex items-center gap-2 text-[11px] font-semibold text-amber-950 cursor-pointer pt-1">
                                  <input
                                    type="checkbox"
                                    checked={item.confirmacaoOutroBanco}
                                    onChange={() => toggleConfirmacaoOutroBanco(item.id)}
                                    className="rounded border-amber-400 text-[#003064] focus:ring-[#003064] cursor-pointer"
                                  />
                                  <span>Confirmo que desejo associar este extrato à conta selecionada.</span>
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rodapé e Ações do Passo 1 */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Fechar
            </button>

            <button
              type="button"
              disabled={!podeAvancar}
              onClick={handleAvancarPasso1}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                podeAvancar
                  ? 'bg-[#003064] hover:bg-[#00204A] text-white border-b-2 border-[#FCBC00] cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Avançar para Revisão e Categorização</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </Modal>

      {/* MODAL DE CONFIRMAÇÃO PARA AJUSTE DE SALDO INICIAL (Item 2 - Parte 15H) */}
      {modalAjusteAberto && resultadoLote && arquivoProcessadoFinal?.saldoBancoInformado !== undefined && (
        <Modal
          isOpen={modalAjusteAberto}
          onClose={() => !ajustandoSaldoInicial && setModalAjusteAberto(false)}
          title="Ajustar Saldo Inicial da Conta"
          subtitle="Altera SOMENTE o campo 'Saldo Inicial' — nenhum lançamento é criado"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">O que será feito:</p>
                <p className="leading-relaxed">
                  O campo <strong>Saldo Inicial</strong> da conta <strong>{arquivoProcessadoFinal.contaNome}</strong> será recalculado
                  para que o saldo calculado pelo app coincida exatamente com o LEDGERBAL informado pelo banco.
                </p>
                <p className="text-[11px] text-blue-700 pt-1 border-t border-blue-200">
                  Fórmula: <code className="font-mono">saldo_inicial_novo = LEDGERBAL − soma(lançamentos pagos até {formatarDataBR(arquivoProcessadoFinal.dataSaldoBanco || '')})</code>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">Saldo Calculado pelo App</span>
                <span className={`font-num font-bold text-sm ${resultadoLote.saldoDepois >= 0 ? 'text-[#003064]' : 'text-red-700'}`}>
                  {formatarMoeda(resultadoLote.saldoDepois)}
                </span>
              </div>
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">LEDGERBAL do Banco</span>
                <span className={`font-num font-bold text-sm ${arquivoProcessadoFinal.saldoBancoInformado >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatarMoeda(arquivoProcessadoFinal.saldoBancoInformado)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
              <p className="font-semibold mb-1">⚠ O que NÃO será feito:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                <li>Nenhum lançamento de ajuste será criado</li>
                <li>Nenhuma outra conta será alterada</li>
                <li>Os lançamentos já importados permanecem intactos</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={ajustandoSaldoInicial}
                onClick={() => setModalAjusteAberto(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={ajustandoSaldoInicial}
                onClick={async () => {
                  if (!arquivosValidosParaRevisao[0]?.contaId) return;
                  setAjustandoSaldoInicial(true);
                  try {
                    const res = await dbService.ajustarSaldoInicialPorLedgerbal({
                      contaId: arquivosValidosParaRevisao[0].contaId,
                      saldoLedgerbal: arquivoProcessadoFinal.saldoBancoInformado!,
                      dataLedgerbal: arquivoProcessadoFinal.dataSaldoBanco || new Date().toISOString().split('T')[0],
                    });
                    setResultadoAjuste(res);
                    setModalAjusteAberto(false);
                  } catch (err) {
                    alert('Erro ao ajustar saldo inicial: ' + (err instanceof Error ? err.message : String(err)));
                  } finally {
                    setAjustandoSaldoInicial(false);
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-[#003064] hover:bg-[#00204A] text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {ajustandoSaldoInicial ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Ajustando...</span>
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    <span>Confirmar Ajuste de Saldo Inicial</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA DESFAZER IMPORTAÇÃO */}
      <Modal
        isOpen={modalDesfazerAberto}
        onClose={() => !desfazendo && setModalDesfazerAberto(false)}
        title="Confirmar Reversão da Importação"
        subtitle={`Lote: ${resultadoLote?.loteId || ''}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-red-950">Atenção: Esta ação é definitiva!</p>
              <p className="leading-relaxed">
                Serão <strong>excluídos permanentemente</strong> os{' '}
                <span className="font-num font-bold text-red-700">{resultadoLote?.totais.lancadas}</span> lançamentos
                gerados exclusivamente por este lote de importação.
              </p>
              {(resultadoLote?.totais.enriquecidas || 0) + (resultadoLote?.totais.vinculadas || 0) > 0 && (
                <p className="text-[11px] text-red-700 leading-relaxed pt-1 border-t border-red-200">
                  Os {(resultadoLote?.totais.enriquecidas || 0) + (resultadoLote?.totais.vinculadas || 0)} lançamentos
                  pré-existentes que foram enriquecidos ou vinculados terão suas descrições e identificadores restaurados ao
                  estado anterior.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={desfazendo}
              onClick={() => setModalDesfazerAberto(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={desfazendo}
              onClick={handleDesfazerLote}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {desfazendo ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Revertendo Lote...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Sim, Desfazer Importação</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
