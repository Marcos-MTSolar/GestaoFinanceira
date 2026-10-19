// MT Solar - Gestão Financeira
// Interface de Revisão e Categorização de Extratos Bancários (Parte 15E)

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Link2,
  Ban,
  Tag,
  User,
  BookmarkPlus,
  X,
  AlertCircle
} from 'lucide-react';
import {
  ContaBancaria,
  Categoria,
  Contato,
  Projeto,
  Lancamento,
  RegraImportacao
} from '../../types';
import {
  ExtratoLido,
  TransacaoExtrato,
  StatusClassificacao,
  TransacaoClassificada,
  NaturezaTransacao,
  SugestaoClassificacao,
  classificarDuplicatas,
  classificarTransacao,
  resolverMovimentacaoInterna,
  diferencaDias
} from '../../utils/extrato';
import { dbService } from '../../services/storage';
import { usePrivacy } from '../../context/PrivacyContext';
import { useAuth } from '../../context/AuthContext';
import { formatarDataBR } from '../../utils/formatters';
import { ComboboxCategoria } from './ComboboxCategoria';

export interface ItemRevisaoExtrato {
  id: string;
  transacao: TransacaoExtrato;
  bancoCodigo: string;
  contaId: string;
  formato: 'ofx' | 'xlsx';
  statusDeduplicacao: StatusClassificacao;
  lancamentoExistenteId?: string;
  lancamentoExistente?: Lancamento;
  diferencaDiasManual?: number;
  natureza: NaturezaTransacao;
  sugestaoClassificacao?: SugestaoClassificacao;
  sugestaoAplicada?: boolean;
  acao: 'incluir' | 'ignorar' | 'vincular';
  decisaoManual?: 'vincular' | 'novo' | 'ignorar';
  tipoLancamento: 'receita' | 'despesa' | 'transferencia' | 'ajuste';
  categoriaId: string;
  categoriaNome?: string;
  projetoId?: string;
  contatoId?: string;
  nomeContatoSugerido?: string;
  lembrarRegra?: boolean;
}

interface RevisaoExtratoProps {
  extratosComConta: Array<{
    extrato: ExtratoLido;
    contaId: string;
    bancoCodigo: string;
    formato: 'ofx' | 'xlsx';
  }>;
  contas: ContaBancaria[];
  onVoltar: () => void;
  onConcluirRevisao: (dadosProntos: {
    itens: ItemRevisaoExtrato[];
    regrasACriar: Array<Omit<RegraImportacao, 'id'>>;
    saldoBanco?: { valor: number; data: string };
    ajustarDataSaldoInicial?: boolean;
    novaDataSaldoInicial?: string;
  }) => void;
}

export const RevisaoExtrato: React.FC<RevisaoExtratoProps> = ({
  extratosComConta,
  contas,
  onVoltar,
  onConcluirRevisao
}) => {
  const { isAdmin } = useAuth();
  const { formatarValor, ocultarValores } = usePrivacy();

  // Dados mestres do Firestore / cache
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [regrasUsuario, setRegrasUsuario] = useState<RegraImportacao[]>([]);
  const [lancamentosExistentes, setLancamentosExistentes] = useState<Lancamento[]>([]);

  // Itens em revisão
  const [itens, setItens] = useState<ItemRevisaoExtrato[]>([]);
  const [inicializado, setInicializado] = useState(false);
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(false);

  // Seleção múltipla para ações em lote
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Sugestão de lote parecidas (toast/banner)
  const [sugestaoLoteParecidas, setSugestaoLoteParecidas] = useState<{
    descricaoPadrao: string;
    categoriaId: string;
    categoriaNome: string;
    quantidade: number;
    itensIds: string[];
  } | null>(null);

  // Filtros
  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'credito' | 'debito'>('todos');
  const [apenasSemCategoria, setApenasSemCategoria] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(50);

  // Modal de Ação em Lote
  const [modalLoteAberto, setModalLoteAberto] = useState(false);
  const [loteCategoriaId, setLoteCategoriaId] = useState('');
  const [loteProjetoId, setLoteProjetoId] = useState('');
  const [loteContatoId, setLoteContatoId] = useState('');

  // Modal de Confirmação Final de Revisão (15E pronta)
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false);

  // Chave do rascunho no localStorage
  const storageDraftKey = useMemo(() => {
    const contasIds = extratosComConta.map((e) => e.contaId).sort().join('_');
    return `mtsolar_extrato_draft_${contasIds}`;
  }, [extratosComConta]);

  // Carrega dados mestres
  useEffect(() => {
    setCategorias(dbService.getCategorias());
    setContatos(dbService.getContatos());
    setProjetos(dbService.getProjetos());
    setRegrasUsuario(dbService.getRegrasImportacao());
    setLancamentosExistentes(dbService.getLancamentos());
  }, []);

  // Processa e Inicializa os itens de revisão
  useEffect(() => {
    if (inicializado || categorias.length === 0) return;

    // Tenta recuperar rascunho salvo anteriormente
    try {
      const salvo = localStorage.getItem(storageDraftKey);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItens(parsed);
          setInicializado(true);
          setRascunhoRecuperado(true);
          return;
        }
      }
    } catch (e) {
      console.warn('Erro ao ler rascunho do localStorage:', e);
    }

    const novosItens: ItemRevisaoExtrato[] = [];

    for (const itemExtrato of extratosComConta) {
      const { extrato, contaId, bancoCodigo, formato } = itemExtrato;

      // 15C: Deduplicação e cruzamento
      const itensDedupe: TransacaoClassificada[] = classificarDuplicatas(
        extrato.transacoes,
        lancamentosExistentes,
        { bancoCodigo, contaId }
      );

      // 15D: Classificação por Natureza e Sugestão
      for (const itemDedupe of itensDedupe) {
        const transacao = itemDedupe.transacao;

        const classif = classificarTransacao(
          transacao,
          bancoCodigo,
          contaId,
          regrasUsuario,
          contatos
        );

        // Movimentação interna (Contamax)
        let acaoInicial: 'incluir' | 'ignorar' | 'vincular' = 'incluir';
        let tipoInicial: 'receita' | 'despesa' | 'transferencia' | 'ajuste' =
          transacao.tipo === 'credito' ? 'receita' : 'despesa';

        if (classif.natureza === 'movimentacao_interna') {
          const contaDestinoApp = contas.find(
            (c) =>
              c.id !== contaId &&
              c.ativa &&
              (c.tipo === 'poupanca' ||
                c.nome.toLowerCase().includes('aplic') ||
                c.nome.toLowerCase().includes('invest'))
          );
          const resInterna = resolverMovimentacaoInterna(contaDestinoApp?.id);
          if (resInterna.acao === 'ignorar') {
            acaoInicial = 'ignorar';
          } else {
            tipoInicial = 'transferencia';
          }
        } else if (itemDedupe.status === 'duplicada_exata') {
          acaoInicial = 'ignorar';
        } else if (itemDedupe.status === 'enriquecer_existente') {
          acaoInicial = 'vincular';
        } else if (itemDedupe.status === 'possivel_duplicata_manual') {
          acaoInicial = 'incluir';
        }

        // Tenta associar categoria sugerida
        let categoriaIdInicial = '';
        let categoriaNomeInicial: string | undefined = undefined;
        let sugestaoAplicada = false;

        if (classif.sugestao.categoriaSugeridaId) {
          const cat = categorias.find((c) => c.id === classif.sugestao.categoriaSugeridaId);
          if (cat) {
            categoriaIdInicial = cat.id;
            categoriaNomeInicial = cat.nome;
            sugestaoAplicada = true;
          }
        } else if (classif.sugestao.categoriaSugeridaNome) {
          const nomeSugerido = classif.sugestao.categoriaSugeridaNome.toLowerCase().trim();
          const cat = categorias.find(
            (c) =>
              c.nome.toLowerCase().trim() === nomeSugerido ||
              c.nome.toLowerCase().includes(nomeSugerido)
          );
          if (cat) {
            categoriaIdInicial = cat.id;
            categoriaNomeInicial = cat.nome;
            sugestaoAplicada = true;
          }
        }

        let diferencaEmDias: number | undefined = undefined;
        if (itemDedupe.lancamentoRelacionado) {
          const dataLanc =
            itemDedupe.lancamentoRelacionado.data_pagamento ||
            itemDedupe.lancamentoRelacionado.data_vencimento;
          diferencaEmDias = diferencaDias(transacao.data, dataLanc);
        }

        novosItens.push({
          id: `${contaId}_${transacao.idTemporario}`,
          transacao,
          bancoCodigo,
          contaId,
          formato,
          statusDeduplicacao: itemDedupe.status,
          lancamentoExistenteId: itemDedupe.idDoLancamentoRelacionado,
          lancamentoExistente: itemDedupe.lancamentoRelacionado,
          diferencaDiasManual: diferencaEmDias,
          natureza: classif.natureza,
          sugestaoClassificacao: classif.sugestao,
          sugestaoAplicada,
          acao: acaoInicial,
          decisaoManual:
            itemDedupe.status === 'possivel_duplicata_manual' ? 'novo' : undefined,
          tipoLancamento: tipoInicial,
          categoriaId: categoriaIdInicial,
          categoriaNome: categoriaNomeInicial,
          contatoId: classif.sugestao.contatoId,
          nomeContatoSugerido: classif.sugestao.nomeContatoSugerido,
          lembrarRegra: false
        });
      }
    }

    setItens(novosItens);
    setInicializado(true);
  }, [
    inicializado,
    categorias,
    extratosComConta,
    lancamentosExistentes,
    regrasUsuario,
    contatos,
    contas,
    storageDraftKey
  ]);

  // Salva rascunho em localStorage com try/catch
  useEffect(() => {
    if (!inicializado || itens.length === 0) return;
    try {
      localStorage.setItem(storageDraftKey, JSON.stringify(itens));
    } catch (e) {
      console.warn('Cota de localStorage excedida ou indisponível:', e);
    }
  }, [itens, inicializado, storageDraftKey]);

  // Contadores globais
  const contadores = useMemo(() => {
    let novas = 0;
    let duplicadas = 0;
    let enriquecer = 0;
    let manuais = 0;
    let internas = 0;
    let semCategoria = 0;

    for (const item of itens) {
      if (item.natureza === 'movimentacao_interna') {
        internas++;
      } else if (item.statusDeduplicacao === 'nova') {
        novas++;
      } else if (item.statusDeduplicacao === 'duplicada_exata') {
        duplicadas++;
      } else if (item.statusDeduplicacao === 'enriquecer_existente') {
        enriquecer++;
      } else if (item.statusDeduplicacao === 'possivel_duplicata_manual') {
        manuais++;
      }

      if (
        item.acao === 'incluir' &&
        (item.tipoLancamento === 'receita' || item.tipoLancamento === 'despesa') &&
        !item.categoriaId
      ) {
        semCategoria++;
      }
    }

    return { novas, duplicadas, enriquecer, manuais, internas, semCategoria };
  }, [itens]);

  // Filtra itens
  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      // Filtro de texto
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase().trim();
        const bateOriginal = item.transacao.descricaoOriginal.toLowerCase().includes(termo);
        const bateNormalizada = item.transacao.descricaoNormalizada.toLowerCase().includes(termo);
        const bateContraparte = Boolean(item.transacao.contraparte?.toLowerCase().includes(termo));
        const bateCategoria = Boolean(item.categoriaNome?.toLowerCase().includes(termo));
        if (!bateOriginal && !bateNormalizada && !bateContraparte && !bateCategoria) {
          return false;
        }
      }

      // Filtro de Status
      if (filtroStatus === 'novas' && (item.statusDeduplicacao !== 'nova' || item.natureza === 'movimentacao_interna')) {
        return false;
      }
      if (filtroStatus === 'duplicadas' && item.statusDeduplicacao !== 'duplicada_exata') {
        return false;
      }
      if (filtroStatus === 'enriquecer' && item.statusDeduplicacao !== 'enriquecer_existente') {
        return false;
      }
      if (filtroStatus === 'manuais' && item.statusDeduplicacao !== 'possivel_duplicata_manual') {
        return false;
      }
      if (filtroStatus === 'internas' && item.natureza !== 'movimentacao_interna') {
        return false;
      }
      if (filtroStatus === 'incluir' && item.acao !== 'incluir') {
        return false;
      }
      if (filtroStatus === 'ignorar' && item.acao !== 'ignorar') {
        return false;
      }

      // Filtro Tipo (Crédito / Débito)
      if (filtroTipo === 'credito' && item.transacao.tipo !== 'credito') return false;
      if (filtroTipo === 'debito' && item.transacao.tipo !== 'debito') return false;

      // Filtro apenas sem categoria
      if (apenasSemCategoria) {
        const precisaCategoria =
          item.acao === 'incluir' &&
          (item.tipoLancamento === 'receita' || item.tipoLancamento === 'despesa');
        if (!precisaCategoria || item.categoriaId) return false;
      }

      // Filtro Faixa de Data
      if (dataInicio && item.transacao.data < dataInicio) return false;
      if (dataFim && item.transacao.data > dataFim) return false;

      // Filtro Faixa de Valor
      if (valorMin && item.transacao.valor < parseFloat(valorMin)) return false;
      if (valorMax && item.transacao.valor > parseFloat(valorMax)) return false;

      return true;
    });
  }, [
    itens,
    buscaTexto,
    filtroStatus,
    filtroTipo,
    apenasSemCategoria,
    dataInicio,
    dataFim,
    valorMin,
    valorMax
  ]);

  // Paginação dos itens filtrados
  const totalPaginas = Math.ceil(itensFiltrados.length / itensPorPagina) || 1;
  const itensPagina = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return itensFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [itensFiltrados, paginaAtual, itensPorPagina]);

  // Atualiza um item específico
  const atualizarItem = (id: string, updates: Partial<ItemRevisaoExtrato>) => {
    setItens((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  // Ao alterar a categoria de uma linha, detecta se existem outras semelhantes
  const handleAlterarCategoria = (
    idLinha: string,
    novaCategoriaId: string,
    novaCategoriaNome?: string
  ) => {
    const itemAtual = itens.find((i) => i.id === idLinha);
    if (!itemAtual) return;

    atualizarItem(idLinha, {
      categoriaId: novaCategoriaId,
      categoriaNome: novaCategoriaNome,
      sugestaoAplicada: false
    });

    if (!novaCategoriaId || !novaCategoriaNome) {
      setSugestaoLoteParecidas(null);
      return;
    }

    // Procura outras transações sem categoria com a mesma descrição normalizada ou mesma contraparte
    const padraoAtual = itemAtual.transacao.descricaoNormalizada;
    const contraparteAtual = itemAtual.transacao.contraparte;

    const semelhantesSemCategoria = itens.filter(
      (i) =>
        i.id !== idLinha &&
        i.acao === 'incluir' &&
        !i.categoriaId &&
        i.tipoLancamento === itemAtual.tipoLancamento &&
        (i.transacao.descricaoNormalizada === padraoAtual ||
          (contraparteAtual && i.transacao.contraparte === contraparteAtual))
    );

    if (semelhantesSemCategoria.length > 0) {
      setSugestaoLoteParecidas({
        descricaoPadrao: contraparteAtual || padraoAtual,
        categoriaId: novaCategoriaId,
        categoriaNome: novaCategoriaNome,
        quantidade: semelhantesSemCategoria.length,
        itensIds: semelhantesSemCategoria.map((i) => i.id)
      });
    } else {
      setSugestaoLoteParecidas(null);
    }
  };

  // Aplica categoria para todas as semelhantes detectadas
  const handleAplicarSemelhantes = () => {
    if (!sugestaoLoteParecidas) return;
    const idsSet = new Set(sugestaoLoteParecidas.itensIds);
    setItens((prev) =>
      prev.map((item) =>
        idsSet.has(item.id)
          ? {
              ...item,
              categoriaId: sugestaoLoteParecidas.categoriaId,
              categoriaNome: sugestaoLoteParecidas.categoriaNome,
              sugestaoAplicada: false
            }
          : item
      )
    );
    setSugestaoLoteParecidas(null);
  };

  // Navega para a próxima linha sem categoria
  const handleIrProximaSemCategoria = () => {
    const indiceProxima = itensFiltrados.findIndex(
      (item) =>
        item.acao === 'incluir' &&
        (item.tipoLancamento === 'receita' || item.tipoLancamento === 'despesa') &&
        !item.categoriaId
    );

    if (indiceProxima === -1) {
      // Se não encontrou nos filtrados, limpa filtros e vai para ela
      const indiceGeral = itens.findIndex(
        (item) =>
          item.acao === 'incluir' &&
          (item.tipoLancamento === 'receita' || item.tipoLancamento === 'despesa') &&
          !item.categoriaId
      );
      if (indiceGeral >= 0) {
        setApenasSemCategoria(true);
        setPaginaAtual(1);
      }
      return;
    }

    const paginaDaLinha = Math.floor(indiceProxima / itensPorPagina) + 1;
    setPaginaAtual(paginaDaLinha);
  };

  // Seleção Múltipla
  const toggleSelecionarTudo = () => {
    if (selecionados.size === itensPagina.length && itensPagina.length > 0) {
      setSelecionados(new Set());
    } else {
      const novos = new Set<string>();
      itensPagina.forEach((item) => novos.add(item.id));
      setSelecionados(novos);
    }
  };

  const toggleSelecionarItem = (id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  // Aplicação de Ação em Lote
  const handleAplicarAcaoLote = () => {
    if (selecionados.size === 0) return;

    setItens((prev) =>
      prev.map((item) => {
        if (!selecionados.has(item.id)) return item;
        const updates: Partial<ItemRevisaoExtrato> = {};
        if (loteCategoriaId) {
          const cat = categorias.find((c) => c.id === loteCategoriaId);
          updates.categoriaId = loteCategoriaId;
          updates.categoriaNome = cat?.nome;
          updates.sugestaoAplicada = false;
        }
        if (loteProjetoId) updates.projetoId = loteProjetoId;
        if (loteContatoId) updates.contatoId = loteContatoId;
        return { ...item, ...updates };
      })
    );

    setModalLoteAberto(false);
    setLoteCategoriaId('');
    setLoteProjetoId('');
    setLoteContatoId('');
    setSelecionados(new Set());
  };

  const handleMarcarLoteAcao = (acao: 'incluir' | 'ignorar') => {
    setItens((prev) =>
      prev.map((item) =>
        selecionados.has(item.id) ? { ...item, acao } : item
      )
    );
    setSelecionados(new Set());
  };

  // Validação final para concluir a revisão
  const handleTentarConcluir = () => {
    if (contadores.semCategoria > 0) {
      setApenasSemCategoria(true);
      setPaginaAtual(1);
      return;
    }

    setModalConfirmacaoAberto(true);
  };

  // Confirmação final da revisão (encaminha para a Parte 15F)
  const handleConfirmarRevisao = () => {
    const regrasACriar: Array<Omit<RegraImportacao, 'id'>> = [];
    for (const item of itens) {
      if (item.lembrarRegra && item.categoriaId) {
        regrasACriar.push({
          banco_codigo: item.bancoCodigo,
          conta_id: item.contaId,
          campo: item.transacao.contraparte ? 'contraparte' : 'descricao',
          operador: item.transacao.contraparte ? 'contem' : 'comeca_com',
          valor: item.transacao.contraparte || item.transacao.descricaoNormalizada,
          categoria_id: item.categoriaId,
          contato_id: item.contatoId,
          tipoLancamento: item.tipoLancamento === 'receita' ? 'receita' : 'despesa',
          ativa: true,
          criadoEm: new Date().toISOString(),
          usos: 1
        });
      }
    }

    let saldoBancoFinal: { valor: number; data: string } | undefined = undefined;
    if (saldoFinalOfx) {
      saldoBancoFinal = saldoFinalOfx;
    } else if (saldoInformadoBanco.trim() !== '') {
      const num = Number(saldoInformadoBanco.replace(',', '.'));
      if (!isNaN(num)) {
        saldoBancoFinal = {
          valor: num,
          data: periodoGlobal.fim || new Date().toISOString().split('T')[0],
        };
      }
    }

    onConcluirRevisao({
      itens,
      regrasACriar,
      saldoBanco: saldoBancoFinal,
      ajustarDataSaldoInicial: temTransacaoAnteriorSaldoInicial ? ajustarDataSaldoInicial : false,
      novaDataSaldoInicial:
        temTransacaoAnteriorSaldoInicial && ajustarDataSaldoInicial ? dataMinimaTransacoes : undefined,
    });
  };

  // Saldo informado pelo banco e ajuste de data inicial
  const [saldoInformadoBanco, setSaldoInformadoBanco] = useState<string>('');
  const [ajustarDataSaldoInicial, setAjustarDataSaldoInicial] = useState<boolean>(true);

  // Conta bancária principal do cabeçalho
  const contaPrincipal = useMemo(() => {
    if (extratosComConta.length === 0) return null;
    return contas.find((c) => c.id === extratosComConta[0].contaId);
  }, [extratosComConta, contas]);

  const periodoGlobal = useMemo(() => {
    const datas = extratosComConta.map((e) => e.extrato.periodo);
    const inicio = datas.map((d) => d.inicio).filter(Boolean).sort()[0];
    const fim = datas.map((d) => d.fim).filter(Boolean).sort().reverse()[0];
    return { inicio, fim };
  }, [extratosComConta]);

  const saldoFinalOfx = useMemo(() => {
    for (const e of extratosComConta) {
      if (e.extrato.saldoFinal?.valor !== undefined) {
        return e.extrato.saldoFinal;
      }
    }
    return undefined;
  }, [extratosComConta]);

  const dataMinimaTransacoes = useMemo(() => {
    if (itens.length === 0) return '';
    return itens.map((i) => i.transacao.data).sort()[0];
  }, [itens]);

  const temTransacaoAnteriorSaldoInicial = useMemo(() => {
    if (!contaPrincipal?.data_saldo_inicial || !dataMinimaTransacoes) return false;
    return dataMinimaTransacoes < contaPrincipal.data_saldo_inicial;
  }, [contaPrincipal, dataMinimaTransacoes]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-3">
        <Ban className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="font-serif text-lg font-bold text-slate-800">
          Acesso Restrito
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Apenas usuários com perfil de Administrador possuem permissão para revisar e importar extratos bancários.
        </p>
        <button
          type="button"
          onClick={onVoltar}
          className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[85vh] space-y-4">
      
      {/* CABEÇALHO COM METADADOS E CONTADORES */}
      <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-bold text-[#003064]">
                {contaPrincipal?.nome || 'Conta Bancária'}
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#003064] text-white">
                {contaPrincipal?.banco || 'Extrato Bancário'}
              </span>
              {contaPrincipal?.numero_conta && (
                <span className="text-xs text-slate-500 font-num">
                  CC {contaPrincipal.numero_conta}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Período do extrato: {periodoGlobal.inicio ? formatarDataBR(periodoGlobal.inicio) : 'Início'} até{' '}
              {periodoGlobal.fim ? formatarDataBR(periodoGlobal.fim) : 'Fim'} • Total de{' '}
              <strong className="font-num font-bold text-slate-800">{itens.length}</strong> transações
            </p>
          </div>

          {/* Atalho Próxima Sem Categoria */}
          {contadores.semCategoria > 0 && (
            <button
              type="button"
              onClick={handleIrProximaSemCategoria}
              className="flex items-center gap-2 px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-bold transition-all shadow-2xs animate-pulse cursor-pointer"
              title="Saltar para a próxima transação sem categoria"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Faltam <span className="font-num font-extrabold">{contadores.semCategoria}</span> sem categoria</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
        </div>

        {/* Notificação de Rascunho Recuperado */}
        {rascunhoRecuperado && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <span className="flex items-center gap-1.5 text-[11px]">
              <BookmarkPlus className="w-3.5 h-3.5 text-amber-600" />
              Rascunho de revisão recuperado do seu navegador.
            </span>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(storageDraftKey);
                setRascunhoRecuperado(false);
              }}
              className="text-[10px] text-amber-700 underline hover:text-amber-900"
            >
              Descartar rascunho
            </button>
          </div>
        )}

        {/* Badges Interativos de Contadores */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setFiltroStatus(filtroStatus === 'novas' ? 'todos' : 'novas');
              setApenasSemCategoria(false);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              filtroStatus === 'novas'
                ? 'bg-emerald-100/70 border-emerald-400 ring-2 ring-emerald-200'
                : 'bg-emerald-50/50 border-emerald-200/80 hover:bg-emerald-100/50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-emerald-800 block">Novas</span>
            <span className="text-base font-bold text-emerald-950 font-num">{contadores.novas}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroStatus(filtroStatus === 'duplicadas' ? 'todos' : 'duplicadas');
              setApenasSemCategoria(false);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              filtroStatus === 'duplicadas'
                ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-300'
                : 'bg-slate-100/60 border-slate-200 hover:bg-slate-200/50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Duplicadas</span>
            <span className="text-base font-bold text-slate-800 font-num">{contadores.duplicadas}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroStatus(filtroStatus === 'enriquecer' ? 'todos' : 'enriquecer');
              setApenasSemCategoria(false);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              filtroStatus === 'enriquecer'
                ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-200'
                : 'bg-blue-50/60 border-blue-200 hover:bg-blue-100/50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-blue-800 block">A Enriquecer</span>
            <span className="text-base font-bold text-blue-950 font-num">{contadores.enriquecer}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroStatus(filtroStatus === 'manuais' ? 'todos' : 'manuais');
              setApenasSemCategoria(false);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              filtroStatus === 'manuais'
                ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-200'
                : 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-amber-800 block">Possíveis Duplicatas</span>
            <span className="text-base font-bold text-amber-950 font-num">{contadores.manuais}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFiltroStatus(filtroStatus === 'internas' ? 'todos' : 'internas');
              setApenasSemCategoria(false);
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              filtroStatus === 'internas'
                ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-200'
                : 'bg-purple-50/60 border-purple-200 hover:bg-purple-100/50'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-purple-800 block">Internas (Contamax)</span>
            <span className="text-base font-bold text-purple-950 font-num">{contadores.internas}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setApenasSemCategoria(!apenasSemCategoria);
              setFiltroStatus('todos');
            }}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              apenasSemCategoria
                ? 'bg-red-100 border-red-400 ring-2 ring-red-200'
                : contadores.semCategoria > 0
                ? 'bg-red-50/80 border-red-200 hover:bg-red-100/60'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-red-800 block">Sem Categoria</span>
            <span className="text-base font-bold text-red-950 font-num">{contadores.semCategoria}</span>
          </button>
        </div>
      </div>

      {/* BANNER DE SUGESTÃO DE CATEGORIZAÇÃO EM LOTE PARA ITENS PARECIDOS */}
      {sugestaoLoteParecidas && (
        <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <p>
              Encontradas mais <strong className="font-num">{sugestaoLoteParecidas.quantidade}</strong> transações semelhantes a “<span className="font-semibold">{sugestaoLoteParecidas.descricaoPadrao}</span>”.
              Deseja aplicar a categoria <strong>“{sugestaoLoteParecidas.categoriaNome}”</strong> a todas elas?
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAplicarSemelhantes}
              className="px-3 py-1.5 bg-[#003064] hover:bg-[#00204A] text-white text-[11px] font-bold rounded-lg transition-colors shadow-2xs cursor-pointer"
            >
              Aplicar a todas ({sugestaoLoteParecidas.quantidade})
            </button>
            <button
              type="button"
              onClick={() => setSugestaoLoteParecidas(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
              title="Ignorar sugestão"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Campo de Busca por Texto */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={buscaTexto}
            onChange={(e) => {
              setBuscaTexto(e.target.value);
              setPaginaAtual(1);
            }}
            placeholder="Buscar por descrição, contraparte ou categoria..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
          />
          {buscaTexto && (
            <button
              type="button"
              onClick={() => setBuscaTexto('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros em linha */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filtroStatus}
            onChange={(e) => {
              setFiltroStatus(e.target.value);
              setPaginaAtual(1);
            }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
          >
            <option value="todos">Status: Todos</option>
            <option value="novas">Apenas Novas</option>
            <option value="enriquecer">Apenas A Enriquecer</option>
            <option value="manuais">Possíveis Duplicatas</option>
            <option value="duplicadas">Apenas Duplicadas</option>
            <option value="internas">Movimentações Internas</option>
            <option value="incluir">Marcadas p/ Incluir</option>
            <option value="ignorar">Marcadas p/ Ignorar</option>
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => {
              setFiltroTipo(e.target.value as any);
              setPaginaAtual(1);
            }}
            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
          >
            <option value="todos">Tipo: Entradas e Saídas</option>
            <option value="credito">Apenas Créditos (Entradas)</option>
            <option value="debito">Apenas Débitos (Saídas)</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setApenasSemCategoria(!apenasSemCategoria);
              setPaginaAtual(1);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              apenasSemCategoria
                ? 'bg-red-500 text-white border-red-600 shadow-2xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {apenasSemCategoria ? 'Exibindo: Sem Categoria' : 'Filtrar: Sem Categoria'}
          </button>
        </div>
      </div>

      {/* BARRA DE AÇÕES EM LOTE (QUANDO HOUVER SELECIONADOS) */}
      {selecionados.size > 0 && (
        <div className="flex items-center justify-between gap-3 p-3 bg-[#003064] text-white rounded-xl text-xs shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="font-bold font-num px-2 py-0.5 rounded bg-white/20">
              {selecionados.size}
            </span>
            <span>transações selecionadas</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setModalLoteAberto(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FCBC00] hover:bg-[#e0a800] text-slate-950 font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Categorizar em Lote</span>
            </button>

            <button
              type="button"
              onClick={() => handleMarcarLoteAcao('incluir')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Marcar como Incluir
            </button>

            <button
              type="button"
              onClick={() => handleMarcarLoteAcao('ignorar')}
              className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Marcar como Ignorar
            </button>

            <button
              type="button"
              onClick={() => setSelecionados(new Set())}
              className="text-xs text-slate-300 hover:text-white underline ml-1"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}

      {/* TABELA DE TRANSAÇÕES (DESKTOP) E CARDS (MOBILE) */}
      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl bg-white shadow-2xs">
        {/* Desktop: Tabela */}
        <table className="hidden md:table w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selecionados.size === itensPagina.length && itensPagina.length > 0}
                  onChange={toggleSelecionarTudo}
                  className="rounded border-slate-300 text-[#003064] focus:ring-[#003064] cursor-pointer"
                  title="Selecionar todos da página"
                />
              </th>
              <th className="p-3 w-24">Data</th>
              <th className="p-3">Descrição / Contraparte</th>
              <th className="p-3 w-28 text-right">Valor</th>
              <th className="p-3 w-32">Natureza</th>
              <th className="p-3 w-24">Tipo</th>
              <th className="p-3 min-w-[220px]">Categoria (Obrigatória)</th>
              <th className="p-3 w-36">Projeto</th>
              <th className="p-3 w-36">Contato</th>
              <th className="p-3 w-24 text-center">Ação</th>
              <th className="p-3 w-16 text-center" title="Lembrar esta regra para importações futuras">
                Regra
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itensPagina.map((item) => {
              const ehCredito = item.transacao.tipo === 'credito';
              const estaSelecionado = selecionados.has(item.id);
              const precisaCategoria =
                item.acao === 'incluir' &&
                (item.tipoLancamento === 'receita' || item.tipoLancamento === 'despesa');
              const semCategoriaErro = precisaCategoria && !item.categoriaId;

              return (
                <React.Fragment key={item.id}>
                  <tr
                    className={`transition-colors ${
                      semCategoriaErro
                        ? 'bg-red-50/40 hover:bg-red-50/70'
                        : item.acao === 'ignorar'
                        ? 'bg-slate-50/60 opacity-60 hover:opacity-100'
                        : estaSelecionado
                        ? 'bg-blue-50/50'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={estaSelecionado}
                        onChange={() => toggleSelecionarItem(item.id)}
                        className="rounded border-slate-300 text-[#003064] focus:ring-[#003064] cursor-pointer"
                      />
                    </td>

                    {/* Data */}
                    <td className="p-3 font-num font-semibold text-slate-700 whitespace-nowrap">
                      {formatarDataBR(item.transacao.data)}
                    </td>

                    {/* Descrição e Contraparte */}
                    <td className="p-3 max-w-xs">
                      <div className="font-semibold text-slate-800 truncate" title={item.transacao.descricaoOriginal}>
                        {item.transacao.descricaoOriginal}
                      </div>

                      {item.transacao.contraparte && (
                        <div className="flex items-center gap-1 text-[11px] text-[#1A4A85] font-medium mt-0.5 truncate">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="truncate" title={item.transacao.contraparte}>
                            {item.transacao.contraparte}
                          </span>
                        </div>
                      )}

                      {/* Badges de Status da Deduplicação */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item.statusDeduplicacao === 'duplicada_exata' && (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-200/80 px-1.5 py-0.2 rounded">
                            Duplicada ignorada
                          </span>
                        )}
                        {item.statusDeduplicacao === 'enriquecer_existente' && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <Link2 className="w-2.5 h-2.5" />
                            Enriquecer existente
                          </span>
                        )}
                        {item.statusDeduplicacao === 'possivel_duplicata_manual' && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            Possível manual
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Valor */}
                    <td className="p-3 text-right font-num font-bold whitespace-nowrap">
                      <span className={ehCredito ? 'text-emerald-600' : 'text-red-600'}>
                        {ehCredito ? '+ ' : '- '}
                        {ocultarValores ? '••••' : formatarValor(item.transacao.valor)}
                      </span>
                    </td>

                    {/* Natureza */}
                    <td className="p-3 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                        {item.natureza.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Tipo Lançamento */}
                    <td className="p-3">
                      <select
                        value={item.tipoLancamento}
                        onChange={(e) =>
                          atualizarItem(item.id, {
                            tipoLancamento: e.target.value as any,
                            categoriaId: '',
                            categoriaNome: undefined
                          })
                        }
                        className="px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#003064] focus:outline-hidden"
                      >
                        <option value="receita">Receita</option>
                        <option value="despesa">Despesa</option>
                        <option value="transferencia">Transferência</option>
                        <option value="ajuste">Ajuste</option>
                      </select>
                    </td>

                    {/* Categoria Obrigatória */}
                    <td className="p-3">
                      <ComboboxCategoria
                        categoriaId={item.categoriaId}
                        tipoLancamento={item.tipoLancamento}
                        categorias={categorias}
                        sugerida={item.sugestaoAplicada}
                        obrigatorio={item.acao === 'incluir'}
                        temErro={semCategoriaErro}
                        onChange={(catId, catNome) =>
                          handleAlterarCategoria(item.id, catId, catNome)
                        }
                        onEnterNext={handleIrProximaSemCategoria}
                        disabled={item.acao === 'ignorar'}
                      />
                    </td>

                    {/* Projeto */}
                    <td className="p-3">
                      <select
                        value={item.projetoId || ''}
                        onChange={(e) => atualizarItem(item.id, { projetoId: e.target.value })}
                        disabled={item.acao === 'ignorar'}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#003064] focus:outline-hidden truncate"
                      >
                        <option value="">Sem projeto</option>
                        {projetos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Contato */}
                    <td className="p-3">
                      <select
                        value={item.contatoId || ''}
                        onChange={(e) => atualizarItem(item.id, { contatoId: e.target.value })}
                        disabled={item.acao === 'ignorar'}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-[#003064] focus:outline-hidden truncate"
                      >
                        <option value="">Sem contato</option>
                        {contatos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Ação (Incluir / Ignorar) */}
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                        <button
                          type="button"
                          onClick={() => atualizarItem(item.id, { acao: 'incluir' })}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${
                            item.acao === 'incluir'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Incluir
                        </button>
                        <button
                          type="button"
                          onClick={() => atualizarItem(item.id, { acao: 'ignorar' })}
                          className={`px-2 py-1 text-[10px] font-bold rounded-md transition-colors ${
                            item.acao === 'ignorar'
                              ? 'bg-slate-700 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Ignorar
                        </button>
                      </div>
                    </td>

                    {/* Checkbox Lembrar Regra */}
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(item.lembrarRegra)}
                        onChange={(e) =>
                          atualizarItem(item.id, { lembrarRegra: e.target.checked })
                        }
                        disabled={!item.categoriaId || item.acao === 'ignorar'}
                        className="rounded border-slate-300 text-[#003064] focus:ring-[#003064] cursor-pointer"
                        title="Salvar regra para categorizar automaticamente futuras transações parecidas"
                      />
                    </td>
                  </tr>

                  {/* BLOCO COMPARATIVO SE FOR POSSÍVEL DUPLICATA MANUAL */}
                  {item.statusDeduplicacao === 'possivel_duplicata_manual' &&
                    item.lancamentoExistente && (
                      <tr className="bg-amber-50/60 border-b border-amber-200 text-amber-950">
                        <td colSpan={11} className="p-3">
                          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-amber-300 shadow-2xs">
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="text-xs space-y-1">
                                <p className="font-bold text-amber-900">
                                  Possível duplicata com lançamento manual já existente no sistema:
                                </p>
                                <div className="flex items-center gap-3 text-slate-700 flex-wrap">
                                  <span>
                                    <strong>Existente:</strong> {item.lancamentoExistente.descricao}
                                  </span>
                                  <span>
                                    <strong>Data:</strong>{' '}
                                    {formatarDataBR(
                                      item.lancamentoExistente.data_pagamento ||
                                        item.lancamentoExistente.data_vencimento
                                    )}
                                  </span>
                                  <span>
                                    <strong>Valor:</strong>{' '}
                                    <span className="font-num font-semibold">
                                      {formatarValor(item.lancamentoExistente.valor)}
                                    </span>
                                  </span>
                                  {item.diferencaDiasManual !== undefined && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200/80 font-bold text-amber-900">
                                      Diferença de {item.diferencaDiasManual} dia(s)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  atualizarItem(item.id, {
                                    decisaoManual: 'vincular',
                                    acao: 'vincular'
                                  })
                                }
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                  item.decisaoManual === 'vincular'
                                    ? 'bg-[#003064] text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                Vincular ao existente
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  atualizarItem(item.id, {
                                    decisaoManual: 'novo',
                                    acao: 'incluir'
                                  })
                                }
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                  item.decisaoManual === 'novo'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                Criar novo
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  atualizarItem(item.id, {
                                    decisaoManual: 'ignorar',
                                    acao: 'ignorar'
                                  })
                                }
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                  item.decisaoManual === 'ignorar'
                                    ? 'bg-slate-700 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                Ignorar
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Mobile: Lista de Cartões */}
        <div className="md:hidden divide-y divide-slate-100 p-2 space-y-3">
          {itensPagina.map((item) => {
            const ehCredito = item.transacao.tipo === 'credito';
            const precisaCategoria =
              item.acao === 'incluir' &&
              (item.tipoLancamento === 'receita' || item.tipoLancamento === 'despesa');
            const semCategoriaErro = precisaCategoria && !item.categoriaId;

            return (
              <div
                key={item.id}
                className={`p-3 rounded-2xl border transition-all space-y-2.5 ${
                  semCategoriaErro
                    ? 'border-red-300 bg-red-50/50'
                    : item.acao === 'ignorar'
                    ? 'border-slate-200 bg-slate-50 opacity-60'
                    : 'border-slate-200 bg-white shadow-2xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-num font-semibold text-slate-500">
                      {formatarDataBR(item.transacao.data)}
                    </span>
                    <p className="text-xs font-bold text-slate-800 line-clamp-2">
                      {item.transacao.descricaoOriginal}
                    </p>
                    {item.transacao.contraparte && (
                      <p className="text-[11px] text-[#1A4A85] font-medium mt-0.5">
                        {item.transacao.contraparte}
                      </p>
                    )}
                  </div>

                  <span
                    className={`font-num font-bold text-sm shrink-0 ${
                      ehCredito ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {ehCredito ? '+ ' : '- '}
                    {ocultarValores ? '••••' : formatarValor(item.transacao.valor)}
                  </span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Categoria (Obrigatória)
                  </label>
                  <ComboboxCategoria
                    categoriaId={item.categoriaId}
                    tipoLancamento={item.tipoLancamento}
                    categorias={categorias}
                    sugerida={item.sugestaoAplicada}
                    obrigatorio={item.acao === 'incluir'}
                    temErro={semCategoriaErro}
                    onChange={(catId, catNome) =>
                      handleAlterarCategoria(item.id, catId, catNome)
                    }
                    onEnterNext={handleIrProximaSemCategoria}
                    disabled={item.acao === 'ignorar'}
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    {item.natureza.replace('_', ' ')}
                  </span>

                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                    <button
                      type="button"
                      onClick={() => atualizarItem(item.id, { acao: 'incluir' })}
                      className={`px-3 py-1 text-xs font-bold rounded-md ${
                        item.acao === 'incluir'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Incluir
                    </button>
                    <button
                      type="button"
                      onClick={() => atualizarItem(item.id, { acao: 'ignorar' })}
                      className={`px-3 py-1 text-xs font-bold rounded-md ${
                        item.acao === 'ignorar'
                          ? 'bg-slate-700 text-white shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {itensFiltrados.length === 0 && (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Search className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-xs font-semibold">Nenhuma transação encontrada para os filtros aplicados.</p>
            <button
              type="button"
              onClick={() => {
                setBuscaTexto('');
                setFiltroStatus('todos');
                setFiltroTipo('todos');
                setApenasSemCategoria(false);
              }}
              className="text-xs text-[#1A4A85] font-semibold underline hover:text-[#003064]"
            >
              Limpar todos os filtros
            </button>
          </div>
        )}
      </div>

      {/* RODAPÉ COM PAGINAÇÃO E AÇÕES FINAIS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200 text-xs">
        {/* Paginação */}
        <div className="flex items-center gap-3">
          <span className="text-slate-500">
            Página <strong className="font-num text-slate-800">{paginaAtual}</strong> de{' '}
            <strong className="font-num text-slate-800">{totalPaginas}</strong> (
            <span className="font-num">{itensFiltrados.length}</span> transações filtradas)
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={paginaAtual <= 1}
              onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>

            <button
              type="button"
              disabled={paginaAtual >= totalPaginas}
              onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
              className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>
          </div>

          <select
            value={itensPorPagina}
            onChange={(e) => {
              setItensPorPagina(Number(e.target.value));
              setPaginaAtual(1);
            }}
            className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onVoltar}
            className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Voltar aos arquivos
          </button>

          <button
            type="button"
            onClick={handleTentarConcluir}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              contadores.semCategoria > 0
                ? 'bg-slate-300 text-slate-600 hover:bg-red-50 hover:text-red-700 border border-slate-300 cursor-pointer'
                : 'bg-[#003064] hover:bg-[#00204A] text-white border-b-2 border-[#FCBC00] cursor-pointer'
            }`}
          >
            <span>Concluir Revisão e Lançar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MODAL DE CATEGORIZAÇÃO EM LOTE */}
      {modalLoteAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h4 className="font-serif font-bold text-sm text-[#003064]">
                Ação em Lote ({selecionados.size} itens selecionados)
              </h4>
              <button
                type="button"
                onClick={() => setModalLoteAberto(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Definir Categoria:</label>
                <select
                  value={loteCategoriaId}
                  onChange={(e) => setLoteCategoriaId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">-- Não alterar categoria --</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Definir Projeto:</label>
                <select
                  value={loteProjetoId}
                  onChange={(e) => setLoteProjetoId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">-- Não alterar projeto --</option>
                  {projetos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Definir Contato:</label>
                <select
                  value={loteContatoId}
                  onChange={(e) => setLoteContatoId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">-- Não alterar contato --</option>
                  {contatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setModalLoteAberto(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAplicarAcaoLote}
                className="px-4 py-2 bg-[#003064] text-white rounded-xl text-xs font-bold hover:bg-[#00204A]"
              >
                Aplicar alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO E GRAVAÇÃO FINAL (PARTE 15F) */}
      {modalConfirmacaoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-serif font-bold text-base text-[#003064]">
                  Confirmar Gravação de Lançamentos
                </h4>
                <p className="text-xs text-slate-500">
                  Revise o sumário e confirme para gravar atômica e rastreavelmente no sistema.
                </p>
              </div>
            </div>

            {/* Resumo Numérico */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Lançamentos novos prontos para gravar:</span>
                <strong className="font-num text-emerald-700 font-bold">
                  {itens.filter((i) => i.acao === 'incluir').length}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Lançamentos existentes a enriquecer:</span>
                <strong className="font-num text-blue-700 font-bold">
                  {itens.filter((i) => i.acao === 'vincular').length}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Transações ignoradas (duplicadas/internas):</span>
                <strong className="font-num text-slate-700 font-bold">
                  {itens.filter((i) => i.acao === 'ignorar').length}
                </strong>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-600">Novas regras automáticas a salvar:</span>
                <strong className="font-num text-purple-700 font-bold">
                  {itens.filter((i) => i.lembrarRegra).length}
                </strong>
              </div>
            </div>

            {/* Alerta de Transações Anteriores à Data do Saldo Inicial */}
            {temTransacaoAnteriorSaldoInicial && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-2 text-amber-950">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Atenção: Movimentações anteriores à Data do Saldo Inicial</p>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      O extrato contém lançamentos a partir de <strong>{formatarDataBR(dataMinimaTransacoes)}</strong>, que antecedem a data do saldo inicial da conta (<strong>{formatarDataBR(contaPrincipal!.data_saldo_inicial)}</strong>).
                      Lançar registros anteriores sem ajustar a data inicial pode gerar distorção na linha do tempo do saldo.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1 font-semibold text-[11px] cursor-pointer text-amber-950">
                  <input
                    type="checkbox"
                    checked={ajustarDataSaldoInicial}
                    onChange={(e) => setAjustarDataSaldoInicial(e.target.checked)}
                    className="rounded border-amber-400 text-[#003064] focus:ring-[#003064] cursor-pointer"
                  />
                  <span>Ajustar a data do saldo inicial da conta para {formatarDataBR(dataMinimaTransacoes)}</span>
                </label>
              </div>
            )}

            {/* Saldo Informado pelo Banco para Conciliação */}
            {saldoFinalOfx ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs">
                <span className="text-blue-900 font-semibold">
                  Saldo final no extrato OFX ({formatarDataBR(saldoFinalOfx.data)}):
                </span>
                <span className="font-num font-bold text-sm text-[#003064]">
                  {formatarValor(saldoFinalOfx.valor)}
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
                <label className="font-semibold text-slate-700 block">
                  Saldo final informado pelo banco (opcional para conciliação):
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={saldoInformadoBanco}
                  onChange={(e) => setSaldoInformadoBanco(e.target.value)}
                  placeholder="Ex: -7377.22"
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-num focus:ring-2 focus:ring-[#003064] focus:outline-hidden"
                />
              </div>
            )}

            <p className="text-[11px] text-slate-500 italic">
              A importação criará lançamentos com status 'pago' e origem 'importacao'. A operação é reversível a qualquer momento através do identificador do lote.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setModalConfirmacaoAberto(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Voltar à revisão
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalConfirmacaoAberto(false);
                  handleConfirmarRevisao();
                }}
                className="px-5 py-2.5 bg-[#003064] hover:bg-[#00204A] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Confirmar e Gravar Lançamentos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
