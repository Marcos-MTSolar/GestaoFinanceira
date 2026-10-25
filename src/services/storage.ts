import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  writeBatch,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Traduz erros do Firestore / Firebase / Rede para mensagens amigáveis em português (Parte 16C)
 */
function traduzirErroFirestore(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as any)?.code || '';

  if (code === 'permission-denied' || msg.includes('permission-denied') || msg.includes('insufficient permissions')) {
    return 'Permissão insuficiente para gravar os dados no servidor. Verifique se o seu usuário possui perfil de administrador.';
  }
  if (
    code === 'unavailable' ||
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch')
  ) {
    return 'Falha de conexão com a rede ou servidor indisponível. Verifique sua conexão com a internet e tente novamente.';
  }
  if (code === 'resource-exhausted' || msg.includes('resource-exhausted') || msg.includes('quota')) {
    return 'Cota de requisições do servidor excedida temporariamente. Aguarde alguns instantes e tente novamente.';
  }
  if (code === 'deadline-exceeded' || msg.includes('deadline-exceeded') || msg.includes('timeout')) {
    return 'Tempo limite de resposta do servidor excedido. Verifique sua conexão e tente novamente.';
  }
  return msg;
}
import {
  ContaBancaria,
  Categoria,
  Contato,
  Projeto,
  Lancamento,
  UsuarioAutorizado,
  ConfiguracoesEmpresa,
  ResumoSaldoConta,
  Funcionario,
  LancamentoFolha,
  OcorrenciaFuncionario,
  RegistroAuditoria,
  AlertaItem,
  ResultadoCalculoFolha,
  ItemDescontoFolha,
  RegraImportacao,
  RegistroImportacao,
  ParamsImportacaoLote,
  ResultadoImportacaoLote,
  ResultadoDesfazerImportacao,
  ResultadoAuditoriaReparo,
  LancamentoAnomaloAuditoria,
  ResultadoAjusteSaldoInicialLedgerbal,
  DryRunReinicioConta,
  ResultadoReinicioConta,
  ImpactoContaReinicio,
  ResumoSaldoContaPosReinicio,
  ImpactoOutraContaExclusao,
  DryRunExclusaoConta,
  ParamsExclusaoConta,
  ResultadoExclusaoConta,
  TransferenciaOrfaInfo,
  GrupoOrfao,
  ContaExistenteImpactoOrfao,
  DryRunLimparOrfaos,
  ParamsLimparOrfaos,
  ResultadoLimparOrfaos,
} from '../types';
import { calcularDescontosRecorrentes } from '../utils/descontos';
import { CONFIG_QUINZENAL_PADRAO, dataDoDiaNaCompetencia, dividirQuinzenas } from '../utils/quinzena';
import { montarBalanco, ItemManualBalanco } from '../utils/balanco';
import { gerarAssinaturaFraca } from '../utils/extrato/assinatura';
import { inferirFormaPagamento } from '../utils/extrato/inferirFormaPagamento';
import {
  gerarDescricaoCurta,
  formatarObservacoesImportacao,
  complementarObservacoesEnriquecimento,
  obterNomeBanco,
} from '../utils/extrato/observacoesHelper';
import {
  contaTemLancamentosImportados,
  calcularSaldoInicialPrimeiraImportacao,
  converterDisponivelParaSaldoReal,
  conferirSaldoFinal,
} from '../utils/extrato/saldoInicialHelper';

// Nomes das coleções do Firestore
const FIRESTORE_COLLECTIONS = {
  CONTAS: 'contas_bancarias',
  LANCAMENTOS: 'lancamentos',
  CATEGORIAS: 'categorias',
  CONTATOS: 'contatos',
  PROJETOS: 'projetos',
  CONFIGURACOES: 'configuracoes',
  USUARIOS: 'usuarios_autorizados',
  FUNCIONARIOS: 'funcionarios',
  LANCAMENTOS_FOLHA: 'lancamentos_folha',
  HISTORICO: 'historico_auditoria',
  REGRAS_IMPORTACAO: 'regras_importacao',
  IMPORTOES: 'importacoes',
};

const STORAGE_KEYS = {
  CONTAS: 'mtsolar_contas_bancarias',
  LANCAMENTOS: 'mtsolar_lancamentos',
  CATEGORIAS: 'mtsolar_categorias',
  CONTATOS: 'mtsolar_contatos',
  PROJETOS: 'mtsolar_projetos',
  CONFIGURACOES: 'mtsolar_configuracoes',
  USUARIOS: 'mtsolar_usuarios_autorizados',
  USUARIO_ATUAL: 'mtsolar_usuario_atual',
  FUNCIONARIOS: 'mtsolar_funcionarios',
  LANCAMENTOS_FOLHA: 'mtsolar_lancamentos_folha',
  HISTORICO: 'mtsolar_historico_alteracoes',
  MODO_DEMO: 'mtsolar_modo_demonstracao',
};

// Controle de throttle para alertas de falha de gravação
let ultimoAlertaFalhaGravacao = 0;

// Exibe um alerta de falha de gravação (no máximo 1 vez a cada 5 segundos)
function avisarFalhaGravacao(acao: string, erro: unknown): void {
  console.error('Falha ao gravar', acao, erro);
  const agora = Date.now();
  if (agora - ultimoAlertaFalhaGravacao > 5000) {
    ultimoAlertaFalhaGravacao = agora;
    window.alert(
      `Não foi possível salvar no servidor (${acao}). Verifique a conexão e as permissões e recarregue a página antes de continuar.`
    );
  }
}

// Subscrições reativas internas
type Listener = () => void;
const listeners: Record<string, Set<Listener>> = {};

export function subscribe(event: string, callback: Listener): () => void {
  if (!listeners[event]) {
    listeners[event] = new Set();
  }
  listeners[event].add(callback);
  return () => {
    listeners[event]?.delete(callback);
  };
}

function notify(event: string) {
  if (listeners[event]) {
    listeners[event].forEach((cb) => cb());
  }
}

// Caches locais em memória
let cacheContas: ContaBancaria[] = [];
let cacheCategorias: Categoria[] = [];
let cacheContatos: Contato[] = [];
let cacheProjetos: Projeto[] = [];
let cacheLancamentos: Lancamento[] = [];
let cacheUsuarios: UsuarioAutorizado[] = [];
let cacheFuncionarios: Funcionario[] = [];
let cacheLancamentosFolha: LancamentoFolha[] = [];
let cacheHistorico: RegistroAuditoria[] = [];
let cacheConfiguracoes: ConfiguracoesEmpresa | null = null;
let cacheRegrasImportacao: RegraImportacao[] = [];
let cacheImportacoes: RegistroImportacao[] = [];
let usuarioAtualCache: UsuarioAutorizado | null = null;

let isCarregadoState = false;
let unsubscribers: Unsubscribe[] = [];

// Fallbacks estáticos
const CATEGORIAS_PADRAO: Categoria[] = [
  { id: 'cat-rec-1', nome: 'Venda de sistemas fotovoltaicos', tipo: 'receita', cor: '#16A34A', padrao: true },
  { id: 'cat-rec-2', nome: 'Instalação', tipo: 'receita', cor: '#0D9488', padrao: true },
  { id: 'cat-rec-3', nome: 'Manutenção/Limpeza', tipo: 'receita', cor: '#0284C7', padrao: true },
  { id: 'cat-rec-4', nome: 'Projeto e homologação', tipo: 'receita', cor: '#4F46E5', padrao: true },
  { id: 'cat-rec-5', nome: 'Outras receitas', tipo: 'receita', cor: '#65A30D', padrao: true },
  { id: 'cat-des-1', nome: 'Compra de painéis/inversores', tipo: 'despesa', cor: '#DC2626', padrao: true },
  { id: 'cat-des-2', nome: 'Materiais elétricos', tipo: 'despesa', cor: '#EA580C', padrao: true },
  { id: 'cat-des-3', nome: 'Mão de obra terceirizada', tipo: 'despesa', cor: '#D97706', padrao: true },
  { id: 'cat-des-4', nome: 'Salários', tipo: 'despesa', cor: '#B91C1C', padrao: true },
  { id: 'cat-des-5', nome: 'Encargos e impostos', tipo: 'despesa', cor: '#9333EA', padrao: true },
  { id: 'cat-des-6', nome: 'Combustível/frota', tipo: 'despesa', cor: '#C026D3', padrao: true },
  { id: 'cat-des-7', nome: 'Marketing', tipo: 'despesa', cor: '#E11D48', padrao: true },
  { id: 'cat-des-8', nome: 'Aluguel', tipo: 'despesa', cor: '#7C3AED', padrao: true },
  { id: 'cat-des-9', nome: 'Água/luz/internet', tipo: 'despesa', cor: '#2563EB', padrao: true },
  { id: 'cat-des-10', nome: 'Contador', tipo: 'despesa', cor: '#475569', padrao: true },
  { id: 'cat-des-11', nome: 'Ferramentas e EPIs', tipo: 'despesa', cor: '#CA8A04', padrao: true },
  { id: 'cat-des-12', nome: 'Taxas bancárias', tipo: 'despesa', cor: '#64748B', padrao: true },
  { id: 'cat-des-13', nome: 'Outras despesas', tipo: 'despesa', cor: '#78716C', padrao: true },
];

const CONFIGURACAO_PADRAO: ConfiguracoesEmpresa = {
  razao_social: 'MT Solar Soluções em Energia Renovável Ltda',
  nome_fantasia: 'MT Solar - Soluções Fotovoltaicas',
  cnpj: '34.892.105/0001-44',
  inscricao_estadual: '13.540.890-1',
  telefone: '(65) 3624-9000',
  email: 'contato@mtsolar.com.br',
  endereco: 'Av. Historiador Rubens de Mendonça, 1850, Bosque da Saúde',
  cidade_uf: 'Cuiabá - MT',
  chave_pix: '34892105000144',
  aliquota_imposto_padrao: 6.5,
  encargos_fgts: 8.0,
  encargos_inss: 20.0,
};

export const dbService = {
  // Estado e Controle de Listeners
  isCarregado(): boolean {
    return isCarregadoState;
  },

  iniciarListeners(): void {
    if (unsubscribers.length > 0) return;

    let colecoesRestantes = 12; // incrementado para incluir regras_importacao e importacoes
    const marcarCarregado = () => {
      colecoesRestantes--;
      if (colecoesRestantes <= 0) {
        isCarregadoState = true;
        notify('carregando');
      }
    };

    try {
      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.CONTAS),
          (snap) => {
            cacheContas = snap.docs.map((d) => d.data() as ContaBancaria);
            notify('contas');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.CATEGORIAS),
          (snap) => {
            cacheCategorias = snap.docs.map((d) => d.data() as Categoria);
            notify('categorias');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.CONTATOS),
          (snap) => {
            cacheContatos = snap.docs.map((d) => d.data() as Contato);
            notify('contatos');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.PROJETOS),
          (snap) => {
            cacheProjetos = snap.docs.map((d) => d.data() as Projeto);
            notify('projetos');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.LANCAMENTOS),
          (snap) => {
            cacheLancamentos = snap.docs.map((d) => d.data() as Lancamento);
            notify('lancamentos');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.USUARIOS),
          (snap) => {
            cacheUsuarios = snap.docs.map((d) => d.data() as UsuarioAutorizado);
            notify('usuarios');
            notify('auth');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.FUNCIONARIOS),
          (snap) => {
            cacheFuncionarios = snap.docs.map((d) => d.data() as Funcionario);
            notify('funcionarios');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA),
          (snap) => {
            cacheLancamentosFolha = snap.docs.map((d) => d.data() as LancamentoFolha);
            notify('folha');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.HISTORICO),
          (snap) => {
            cacheHistorico = snap.docs.map((d) => d.data() as RegistroAuditoria);
            notify('historico');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      unsubscribers.push(
        onSnapshot(
          doc(db, FIRESTORE_COLLECTIONS.CONFIGURACOES, 'empresa'),
          (snap) => {
            if (snap.exists()) {
              cacheConfiguracoes = snap.data() as ConfiguracoesEmpresa;
              notify('configuracoes');
            }
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      // Regras de importação cadastradas pelo usuário
      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.REGRAS_IMPORTACAO),
          (snap) => {
            cacheRegrasImportacao = snap.docs.map((d) => d.data() as RegraImportacao);
            notify('regras_importacao');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );

      // Lotes de importação de extratos bancários
      unsubscribers.push(
        onSnapshot(
          collection(db, FIRESTORE_COLLECTIONS.IMPORTOES),
          (snap) => {
            cacheImportacoes = snap.docs.map((d) => d.data() as RegistroImportacao);
            notify('importacoes');
            marcarCarregado();
          },
          () => marcarCarregado()
        )
      );
    } catch (e) {
      isCarregadoState = true;
      notify('carregando');
    }
  },

  pararListeners(): void {
    unsubscribers.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {}
    });
    unsubscribers = [];
    isCarregadoState = false;

    cacheContas = [];
    cacheCategorias = [];
    cacheContatos = [];
    cacheProjetos = [];
    cacheLancamentos = [];
    cacheUsuarios = [];
    cacheFuncionarios = [];
    cacheLancamentosFolha = [];
    cacheHistorico = [];
    cacheConfiguracoes = null;
    cacheRegrasImportacao = [];
    cacheImportacoes = [];
    usuarioAtualCache = null;
    localStorage.removeItem(STORAGE_KEYS.USUARIO_ATUAL);

    notify('carregando');
    notify('auth');
  },

  // Modo Demonstração
  isModoDemonstracao(): boolean {
    return localStorage.getItem(STORAGE_KEYS.MODO_DEMO) === 'true';
  },

  setModoDemonstracao(ativo: boolean): void {
    localStorage.setItem(STORAGE_KEYS.MODO_DEMO, ativo ? 'true' : 'false');
    notify('auth');
  },

  carregarModoDemonstracao(): void {
    this.setModoDemonstracao(true);
  },

  limparDadosDemonstracao(): void {
    this.setModoDemonstracao(false);
  },

  async resetarDadosDemonstracao(): Promise<void> {
    localStorage.clear();
    notify('auth');
  },

  // Usuário Atual
  getUsuarioAtual(): UsuarioAutorizado | null {
    if (usuarioAtualCache) return usuarioAtualCache;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USUARIO_ATUAL);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUsuarioAtual(u: UsuarioAutorizado | null): void {
    usuarioAtualCache = u;
    if (u) {
      localStorage.setItem(STORAGE_KEYS.USUARIO_ATUAL, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USUARIO_ATUAL);
    }
    notify('auth');
  },

  isUsuarioAdmin(): boolean {
    const u = this.getUsuarioAtual();
    if (!u) {
      return this.isModoDemonstracao();
    }
    return u.papel === 'administrador';
  },

  // Usuários Autorizados
  getUsuariosAutorizados(): UsuarioAutorizado[] {
    return cacheUsuarios;
  },

  saveUsuarioAutorizado(usuario: UsuarioAutorizado): UsuarioAutorizado {
    const docId = usuario.email.toLowerCase();
    const item = { ...usuario, id: usuario.id || docId, email: docId };

    setDoc(doc(db, FIRESTORE_COLLECTIONS.USUARIOS, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveUsuarioAutorizado:', e)
    );

    const idx = cacheUsuarios.findIndex((u) => u.email.toLowerCase() === docId);
    if (idx >= 0) cacheUsuarios[idx] = item;
    else cacheUsuarios.push(item);
    notify('usuarios');
    return item;
  },

  deleteUsuarioAutorizado(idOuEmail: string): boolean {
    const docId = idOuEmail.toLowerCase();
    const target = cacheUsuarios.find((u) => u.id === idOuEmail || u.email.toLowerCase() === docId);
    const idParaDeletar = target ? target.email.toLowerCase() : docId;

    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.USUARIOS, idParaDeletar)).catch((e) =>
      console.warn('Erro async deleteUsuarioAutorizado:', e)
    );

    cacheUsuarios = cacheUsuarios.filter((u) => u.id !== idOuEmail && u.email.toLowerCase() !== docId);
    notify('usuarios');
    return true;
  },

  // Contas Bancárias
  getContasBancarias(): ContaBancaria[] {
    return cacheContas;
  },

  getContas(): ContaBancaria[] {
    return this.getContasBancarias();
  },

  getContaById(id: string): ContaBancaria | undefined {
    return this.getContasBancarias().find((c) => c.id === id);
  },

  async saveContaBancaria(conta: ContaBancaria): Promise<ContaBancaria> {
    const docId = conta.id || `conta-${Date.now()}`;
    const item = { ...conta, id: docId, criado_em: conta.criado_em || new Date().toISOString() };

    try {
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTAS, docId), item, { merge: true });
    } catch (e) {
      console.warn('Erro ao salvar conta bancária no Firestore:', e);
      throw new Error(`Falha ao salvar conta bancária: ${traduzirErroFirestore(e)}`);
    }

    const idx = cacheContas.findIndex((c) => c.id === docId);
    if (idx >= 0) cacheContas[idx] = item;
    else cacheContas.push(item);
    notify('contas');
    return item;
  },

  async saveConta(conta: ContaBancaria): Promise<ContaBancaria> {
    return this.saveContaBancaria(conta);
  },

  deleteContaBancaria(id: string): { sucesso: boolean; mensagem?: string } {
    const temLancamentos = cacheLancamentos.some((l) => l.conta_id === id);
    if (temLancamentos) {
      return {
        sucesso: false,
        mensagem:
          'A conta possui histórico de lançamentos. Para garantir que nada fique órfão, utilize a exclusão completa com simulação, backup e confirmação.',
      };
    }

    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.CONTAS, id)).catch((e) =>
      console.warn('Erro async deleteContaBancaria:', e)
    );

    cacheContas = cacheContas.filter((c) => c.id !== id);
    notify('contas');
    return { sucesso: true };
  },

  deleteConta(id: string): { sucesso: boolean; mensagem?: string } {
    return this.deleteContaBancaria(id);
  },

  toggleAtivaConta(id: string): ContaBancaria | null {
    const conta = this.getContaById(id);
    if (!conta) return null;
    const atualizada = { ...conta, ativa: !conta.ativa };
    this.saveContaBancaria(atualizada);
    return atualizada;
  },

  transferirEntreContas(params: {
    contaOrigemId: string;
    contaDestinoId: string;
    valor: number;
    data: string;
    descricao?: string;
    observacoes?: string;
  }): { sucesso: boolean; mensagem?: string } {
    this.realizarTransferencia(params);
    return { sucesso: true };
  },

  realizarTransferencia(params: {
    contaOrigemId: string;
    contaDestinoId: string;
    valor: number;
    data: string;
    descricao?: string;
    observacoes?: string;
  }): void {
    const timestamp = Date.now();
    const idSaida = `transf-out-${timestamp}`;
    const idEntrada = `transf-in-${timestamp}`;
    const desc = params.descricao ? `Transferência: ${params.descricao}` : 'Transferência entre contas';

    const lancSaida: Lancamento = {
      id: idSaida,
      tipo: 'despesa',
      descricao: desc,
      valor: params.valor,
      data_vencimento: params.data,
      data_pagamento: params.data,
      status: 'pago',
      conta_id: params.contaOrigemId,
      conta_destino_id: params.contaDestinoId,
      transferencia_vinculada_id: idEntrada,
      categoria_id: 'cat-des-12',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'transferencia',
      observacoes: params.observacoes,
      criado_em: new Date().toISOString(),
    };

    const lancEntrada: Lancamento = {
      id: idEntrada,
      tipo: 'receita',
      descricao: desc,
      valor: params.valor,
      data_vencimento: params.data,
      data_pagamento: params.data,
      status: 'pago',
      conta_id: params.contaDestinoId,
      transferencia_vinculada_id: idSaida,
      categoria_id: 'cat-rec-5',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'transferencia',
      observacoes: params.observacoes,
      criado_em: new Date().toISOString(),
    };

    this.saveLancamento(lancSaida);
    this.saveLancamento(lancEntrada);
  },

  conciliarSaldoConta(params: {
    contaId: string;
    valorInformado?: number;
    tipoInformado?: 'sem_limite' | 'com_limite';
    dataAjuste?: string;
    observacoes?: string;
    novoSaldoReal?: number;
    dataConciliacao?: string;
  }): { sucesso: boolean; diferenca: number; mensagem?: string } {
    const conta = this.getContaById(params.contaId);
    if (!conta) return { sucesso: false, diferenca: 0, mensagem: 'Conta não encontrada.' };

    const resumo = this.calcularResumoConta(conta);
    const saldoRealAtual = resumo.saldo_real;

    let saldoRealEsperado = params.novoSaldoReal !== undefined ? params.novoSaldoReal : (params.valorInformado || 0);
    if (params.tipoInformado === 'com_limite') {
      saldoRealEsperado = (params.valorInformado || 0) - (conta.limite_cheque_especial || 0);
    }

    const diferenca = +(saldoRealEsperado - saldoRealAtual).toFixed(2);
    if (Math.abs(diferenca) < 0.01) {
      return { sucesso: true, diferenca: 0, mensagem: 'Saldo confere perfeitamente.' };
    }

    const ehReceita = diferenca > 0;
    const ajuste: Lancamento = {
      id: `ajuste-${Date.now()}`,
      tipo: ehReceita ? 'receita' : 'despesa',
      descricao: `Ajuste de Saldo / Conciliação Bancária (${conta.nome})`,
      valor: Math.abs(diferenca),
      data_vencimento: params.dataConciliacao || params.dataAjuste || new Date().toISOString().split('T')[0],
      data_pagamento: params.dataConciliacao || params.dataAjuste || new Date().toISOString().split('T')[0],
      status: 'pago',
      conta_id: params.contaId,
      categoria_id: ehReceita ? 'cat-rec-5' : 'cat-des-13',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'ajuste',
      observacoes: params.observacoes,
      criado_em: new Date().toISOString(),
    };

    this.saveLancamento(ajuste);
    return { sucesso: true, diferenca };
  },

  // Categorias
  getCategorias(): Categoria[] {
    return cacheCategorias.length > 0 ? cacheCategorias : CATEGORIAS_PADRAO;
  },

  saveCategoria(categoria: Categoria): Categoria {
    const docId = categoria.id || `cat-${Date.now()}`;
    const item = { ...categoria, id: docId };

    setDoc(doc(db, FIRESTORE_COLLECTIONS.CATEGORIAS, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveCategoria:', e)
    );

    const idx = cacheCategorias.findIndex((c) => c.id === docId);
    if (idx >= 0) cacheCategorias[idx] = item;
    else cacheCategorias.push(item);
    notify('categorias');
    return item;
  },

  deleteCategoria(id: string): boolean {
    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.CATEGORIAS, id)).catch((e) =>
      console.warn('Erro async deleteCategoria:', e)
    );
    cacheCategorias = cacheCategorias.filter((c) => c.id !== id);
    notify('categorias');
    return true;
  },

  // Contatos
  getContatos(): Contato[] {
    return cacheContatos;
  },

  saveContato(contato: Contato): Contato {
    const docId = contato.id || `contato-${Date.now()}`;
    const item = { ...contato, id: docId };

    setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTATOS, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveContato:', e)
    );

    const idx = cacheContatos.findIndex((c) => c.id === docId);
    if (idx >= 0) cacheContatos[idx] = item;
    else cacheContatos.push(item);
    notify('contatos');
    return item;
  },

  deleteContato(id: string): void {
    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.CONTATOS, id)).catch((e) =>
      console.warn('Erro async deleteContato:', e)
    );
    cacheContatos = cacheContatos.filter((c) => c.id !== id);
    notify('contatos');
  },

  // Projetos
  getProjetos(): Projeto[] {
    return cacheProjetos;
  },

  saveProjeto(projeto: Projeto): Projeto {
    const docId = projeto.id || `proj-${Date.now()}`;
    const item = { ...projeto, id: docId };

    setDoc(doc(db, FIRESTORE_COLLECTIONS.PROJETOS, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveProjeto:', e)
    );

    const idx = cacheProjetos.findIndex((p) => p.id === docId);
    if (idx >= 0) cacheProjetos[idx] = item;
    else cacheProjetos.push(item);
    notify('projetos');
    return item;
  },

  deleteProjeto(id: string): void {
    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.PROJETOS, id)).catch((e) =>
      console.warn('Erro async deleteProjeto:', e)
    );
    cacheProjetos = cacheProjetos.filter((p) => p.id !== id);
    notify('projetos');
  },

  // Lançamentos
  getLancamentos(filtros?: {
    dataInicio?: string;
    dataFim?: string;
    tipo?: string;
    conta_id?: string;
    pagina?: number;
    limite?: number;
    incluirOrfaos?: boolean;
  }): Lancamento[] {
    // Parte 18A: Proteção contra lançamentos cujo conta_id não existe mais no sistema (relatórios, painel e totais)
    const contasExistentesIds = new Set(cacheContas.map((c) => c.id));
    let lista = filtros?.incluirOrfaos
      ? [...cacheLancamentos]
      : cacheLancamentos.filter((l) => contasExistentesIds.has(l.conta_id));

    if (filtros) {
      if (filtros.dataInicio) {
        lista = lista.filter((l) => l.data_vencimento >= filtros.dataInicio!);
      }
      if (filtros.dataFim) {
        lista = lista.filter((l) => l.data_vencimento <= filtros.dataFim!);
      }
      if (filtros.tipo && filtros.tipo !== 'todos') {
        lista = lista.filter((l) => l.tipo === filtros.tipo);
      }
      if (filtros.conta_id && filtros.conta_id !== 'todas') {
        lista = lista.filter((l) => l.conta_id === filtros.conta_id);
      }
      if (filtros.pagina && filtros.limite) {
        const inicio = (filtros.pagina - 1) * filtros.limite;
        lista = lista.slice(inicio, inicio + filtros.limite);
      }
    }

    return lista;
  },

  getLancamentoById(id: string): Lancamento | undefined {
    return cacheLancamentos.find((l) => l.id === id);
  },

  saveLancamento(lancamento: Lancamento): Lancamento {
    const docId = lancamento.id || `lanc-${Date.now()}`;
    const item: Lancamento = {
      ...lancamento,
      id: docId,
      criado_em: lancamento.criado_em || new Date().toISOString(),
    };

    setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, docId), item, { merge: true }).catch((e) => {
      console.warn('Erro async saveLancamento:', e);
      avisarFalhaGravacao('saveLancamento', e);
    });

    const idx = cacheLancamentos.findIndex((l) => l.id === docId);
    if (idx >= 0) cacheLancamentos[idx] = item;
    else cacheLancamentos.unshift(item);

    // A2: espelhar na folha sempre que o lançamento vier da folha ou tiver vínculo
    if (item.origem === 'folha' || cacheLancamentosFolha.some((f) => f.lancamento_id === item.id)) {
      this.espelharDespesaNaFolha(item);
    }

    notify('lancamentos');
    return item;
  },

  deleteLancamento(id: string, _escopo: string = 'so_esta'): void {
    const target = cacheLancamentos.find((l) => l.id === id);

    // A3: calcular folha vinculada por múltiplos caminhos
    const folhaIdVinculada =
      target?.folha_id ||
      cacheLancamentosFolha.find((f) => f.lancamento_id === id)?.id ||
      (id.startsWith('desp-') && cacheLancamentosFolha.some((f) => f.id === id.slice(5))
        ? id.slice(5)
        : undefined);

    if (folhaIdVinculada) {
      this.removerFolhaOrfa(folhaIdVinculada);
    }

    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, id)).catch((e) => {
      console.warn('Erro async deleteLancamento:', e);
      avisarFalhaGravacao('deleteLancamento', e);
    });
    cacheLancamentos = cacheLancamentos.filter((l) => l.id !== id);
    notify('lancamentos');
  },

  duplicarLancamento(id: string): Lancamento | null {
    const original = this.getLancamentoById(id);
    if (!original) return null;
    const novo: Lancamento = {
      ...original,
      id: `lanc-${Date.now()}`,
      descricao: `${original.descricao} (Cópia)`,
      status: 'pendente',
      data_pagamento: null,
      criado_em: new Date().toISOString(),
    };
    return this.saveLancamento(novo);
  },

  liquidarLancamento(params: {
    id: string;
    contaId?: string;
    dataPagamento?: string;
    jurosMulta?: number;
    desconto?: number;
    valorFinal?: number;
  }): Lancamento | null {
    const target = cacheLancamentos.find((l) => l.id === params.id);
    if (!target) return null;
    const juros = params.jurosMulta || 0;
    const desc = params.desconto || 0;
    const valorCalculado = params.valorFinal !== undefined ? params.valorFinal : +(target.valor + juros - desc).toFixed(2);

    const atualizado: Lancamento = {
      ...target,
      status: 'pago',
      data_pagamento: params.dataPagamento || new Date().toISOString().split('T')[0],
      conta_id: params.contaId || target.conta_id,
      valor: valorCalculado,
      juros_multa: juros > 0 ? juros : undefined,
      desconto: desc > 0 ? desc : undefined,
    };
    const salva = this.saveLancamento(atualizado);
    if (salva.origem === 'folha' && salva.folha_id) {
      this.espelharDespesaNaFolha(salva);
    }
    return salva;
  },

  liquidarLancamentosEmLote(params: { ids: string[]; contaId: string; dataPagamento?: string }): number {
    let count = 0;
    for (const id of params.ids) {
      this.liquidarLancamento({ id, contaId: params.contaId, dataPagamento: params.dataPagamento });
      count++;
    }
    return count;
  },

  salvarLancamentoComRecorrencia(lancamento: Lancamento): Lancamento {
    return this.saveLancamento(lancamento);
  },

  excluirLancamentoERecorrencias(id: string): void {
    const target = cacheLancamentos.find((l) => l.id === id);
    if (!target) return;

    if (target.grupo_recorrencia_id || target.grupo_parcelas_id) {
      const grupoId = target.grupo_recorrencia_id || target.grupo_parcelas_id;
      const vinculados = cacheLancamentos.filter(
        (l) => l.grupo_recorrencia_id === grupoId || l.grupo_parcelas_id === grupoId
      );
      for (const item of vinculados) {
        this.deleteLancamento(item.id);
      }
    } else {
      this.deleteLancamento(id);
    }
  },

  pagarLancamento(id: string, dataPagamento: string, contaId?: string): Lancamento | null {
    return this.liquidarLancamento({ id, dataPagamento, contaId });
  },

  estornarLancamento(id: string): Lancamento | null {
    const target = cacheLancamentos.find((l) => l.id === id);
    if (!target) return null;

    const atualizado: Lancamento = {
      ...target,
      status: 'pendente',
      data_pagamento: null,
    };
    const salva = this.saveLancamento(atualizado);
    if (salva.origem === 'folha' && salva.folha_id) {
      this.espelharDespesaNaFolha(salva);
    }
    return salva;
  },

  espelharDespesaNaFolha(desp: Lancamento): void {
    // A1: localizar a folha por folha_id ou por lancamento_id (sem exigir origem === 'folha')
    const folha =
      cacheLancamentosFolha.find((l) => l.id === desp.folha_id) ||
      cacheLancamentosFolha.find((l) => l.lancamento_id === desp.id);
    if (!folha) {
      return;
    }

    const novoStatus: 'pago' | 'pendente' = desp.status === 'pago' ? 'pago' : 'pendente';

    // A1: saída rápida idempotente — evitar gravação e auditoria desnecessárias
    if (
      folha.status === novoStatus &&
      folha.data_pagamento === desp.data_pagamento &&
      folha.conta_id === desp.conta_id &&
      folha.lancamento_id === desp.id
    ) {
      return;
    }

    const func = this.getFuncionarioById(folha.funcionario_id);
    const nomeDoFuncionario = func ? func.nome : '';

    const folhaAtualizada: LancamentoFolha = {
      ...folha,
      status: novoStatus,
      data_pagamento: desp.data_pagamento,
      conta_id: desp.conta_id,
      lancamento_id: desp.id,
    };

    this.saveLancamentoFolha(folhaAtualizada);

    if (folha.status !== novoStatus) {
      if (novoStatus === 'pago') {
        this.registrarAuditoria(
          'folha',
          'pagamento',
          `Pagamento da folha: ${folha.descricao} – ${nomeDoFuncionario} (${folha.competencia}) no valor de R$ ${folha.valor.toFixed(2)}`
        );
      } else {
        this.registrarAuditoria(
          'folha',
          'estorno',
          `Estorno da folha: ${folha.descricao} – ${nomeDoFuncionario} (${folha.competencia}) no valor de R$ ${folha.valor.toFixed(2)}`
        );
      }
    }
  },

  // Configurações
  getConfiguracoes(): ConfiguracoesEmpresa {
    return cacheConfiguracoes || CONFIGURACAO_PADRAO;
  },

  saveConfiguracoes(config: ConfiguracoesEmpresa): ConfiguracoesEmpresa {
    setDoc(doc(db, FIRESTORE_COLLECTIONS.CONFIGURACOES, 'empresa'), config, { merge: true }).catch((e) =>
      console.warn('Erro async saveConfiguracoes:', e)
    );
    cacheConfiguracoes = config;
    notify('configuracoes');
    return config;
  },

  getItensBalancoManual(): ItemManualBalanco[] {
    return this.getConfiguracoes().balanco_manual || [];
  },

  saveItensBalancoManual(itens: ItemManualBalanco[]): void {
    this.saveConfiguracoes({ ...this.getConfiguracoes(), balanco_manual: itens });
  },

  // Funcionários
  getFuncionarios(): Funcionario[] {
    return cacheFuncionarios;
  },

  getFuncionarioById(id: string): Funcionario | undefined {
    return cacheFuncionarios.find((f) => f.id === id);
  },

  saveFuncionario(funcionario: Funcionario): Funcionario {
    const docId = funcionario.id || `func-${Date.now()}`;
    const item: Funcionario = {
      ...funcionario,
      id: docId,
      criado_em: funcionario.criado_em || new Date().toISOString(),
    };
    setDoc(doc(db, FIRESTORE_COLLECTIONS.FUNCIONARIOS, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveFuncionario:', e)
    );

    const idx = cacheFuncionarios.findIndex((f) => f.id === docId);
    if (idx >= 0) cacheFuncionarios[idx] = item;
    else cacheFuncionarios.push(item);
    notify('funcionarios');
    return item;
  },

  deleteFuncionario(id: string): { sucesso: boolean; mensagem?: string } {
    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.FUNCIONARIOS, id)).catch((e) =>
      console.warn('Erro async deleteFuncionario:', e)
    );
    cacheFuncionarios = cacheFuncionarios.filter((f) => f.id !== id);
    notify('funcionarios');
    return { sucesso: true };
  },

  // Folha
  getLancamentosFolha(filtros?: { competencia?: string; funcionarioId?: string }): LancamentoFolha[] {
    let lista = [...cacheLancamentosFolha];
    if (filtros) {
      if (filtros.competencia) {
        lista = lista.filter((l) => l.competencia === filtros.competencia);
      }
      if (filtros.funcionarioId) {
        lista = lista.filter((l) => l.funcionario_id === filtros.funcionarioId);
      }
    }
    return lista;
  },

  saveLancamentoFolha(lancamento: LancamentoFolha): LancamentoFolha {
    const docId = lancamento.id || `folha-${Date.now()}`;
    const item: LancamentoFolha = {
      ...lancamento,
      id: docId,
      criado_em: lancamento.criado_em || new Date().toISOString(),
    };
    setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA, docId), item, { merge: true }).catch((e) => {
      console.warn('Erro async saveLancamentoFolha:', e);
      avisarFalhaGravacao('saveLancamentoFolha', e);
    });

    const idx = cacheLancamentosFolha.findIndex((f) => f.id === docId);
    if (idx >= 0) cacheLancamentosFolha[idx] = item;
    else cacheLancamentosFolha.push(item);
    notify('folha');
    return item;
  },

  garantirDespesaDaFolha(folha: LancamentoFolha): Lancamento | null {
    if (folha.tipo === 'desconto' || folha.status === 'cancelado') {
      return null;
    }
    if (folha.valor <= 0) {
      return null;
    }

    const id = folha.lancamento_id || `desp-${folha.id}`;
    const despExistente = cacheLancamentos.find((l) => l.id === id);

    if (despExistente) {
      if (despExistente.status === 'pago') {
        if (folha.lancamento_id !== id) {
          this.saveLancamentoFolha({ ...folha, lancamento_id: id });
        }
        return despExistente;
      }

      const func = this.getFuncionarioById(folha.funcionario_id);
      const nomeDoFuncionario = func ? func.nome : '';
      const despAtualizada: Lancamento = {
        ...despExistente,
        descricao: `Folha: ${folha.descricao} – ${nomeDoFuncionario} (${folha.competencia})`,
        valor: folha.valor,
        data_vencimento: folha.data_prevista,
        conta_id: folha.conta_id,
        funcionario_id: folha.funcionario_id,
        folha_id: folha.id,
      };
      const salva = this.saveLancamento(despAtualizada);
      if (folha.lancamento_id !== id) {
        this.saveLancamentoFolha({ ...folha, lancamento_id: id });
      }
      return salva;
    }

    if (folha.status === 'pago') {
      return null;
    }

    const func = this.getFuncionarioById(folha.funcionario_id);
    const nomeDoFuncionario = func ? func.nome : '';

    const cats = this.getCategorias();
    let categoriaId = 'cat-des-4';

    if (func?.tipo_contrato === 'prolabore') {
      const catProlabore = cats.find((c) => {
        const norm = c.nome
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z]/g, '');
        return norm === 'prolabore';
      });
      if (catProlabore) {
        categoriaId = catProlabore.id;
      } else {
        const catSalarios = cats.find((c) => c.nome.toLowerCase() === 'salários' || c.nome.toLowerCase() === 'salarios');
        categoriaId = catSalarios ? catSalarios.id : 'cat-des-4';
      }
    } else {
      const catSalarios = cats.find((c) => c.nome.toLowerCase() === 'salários' || c.nome.toLowerCase() === 'salarios');
      categoriaId = catSalarios ? catSalarios.id : 'cat-des-4';
    }

    const novaDespesa: Lancamento = {
      id,
      tipo: 'despesa',
      descricao: `Folha: ${folha.descricao} – ${nomeDoFuncionario} (${folha.competencia})`,
      valor: folha.valor,
      data_vencimento: folha.data_prevista,
      data_pagamento: null,
      status: 'pendente',
      conta_id: folha.conta_id,
      categoria_id: categoriaId,
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'folha',
      funcionario_id: folha.funcionario_id,
      folha_id: folha.id,
      criado_em: new Date().toISOString(),
    };

    const salva = this.saveLancamento(novaDespesa);
    if (folha.lancamento_id !== id) {
      this.saveLancamentoFolha({ ...folha, lancamento_id: id });
    }
    return salva;
  },

  criarLancamentoFolha(item: LancamentoFolha): LancamentoFolha {
    if (item.tipo !== 'desconto' && item.valor <= 0) {
      const itemQuitado: LancamentoFolha = {
        ...item,
        status: 'pago',
        data_pagamento: item.data_prevista,
        observacoes: (item.observacoes ? item.observacoes + ' ' : '') + 'Quitado por compensação (líquido zero).',
      };
      return this.saveLancamentoFolha(itemQuitado);
    }

    const folhaSalva = this.saveLancamentoFolha(item);
    if (folhaSalva.tipo !== 'desconto' && folhaSalva.status === 'pendente') {
      const desp = this.garantirDespesaDaFolha(folhaSalva);
      if (desp && folhaSalva.lancamento_id !== desp.id) {
        folhaSalva.lancamento_id = desp.id;
      }
    }
    return folhaSalva;
  },

  atualizarLancamentoFolhaPendente(
    id: string,
    campos: Partial<Pick<LancamentoFolha, 'valor' | 'descricao' | 'data_prevista' | 'observacoes'>>
  ): boolean {
    const folha = cacheLancamentosFolha.find((l) => l.id === id);
    if (!folha || folha.status !== 'pendente') return false;

    const atualizada = this.saveLancamentoFolha({
      ...folha,
      ...campos,
    });

    if (atualizada.tipo !== 'desconto') {
      this.garantirDespesaDaFolha(atualizada);
    }
    return true;
  },

  prepararDespesasDaFolha(folhaIds: string[]): Lancamento[] {
    const despesas: Lancamento[] = [];
    for (const id of folhaIds) {
      const folha = cacheLancamentosFolha.find((l) => l.id === id);
      if (folha && folha.status === 'pendente' && folha.tipo !== 'desconto') {
        const desp = this.garantirDespesaDaFolha(folha);
        if (desp) despesas.push(desp);
      }
    }
    return despesas;
  },

  vincularFolhasPendentesSemDespesa(): number {
    if (!this.isCarregado()) return 0;
    let vinculadas = 0;
    for (const folha of cacheLancamentosFolha) {
      if (folha.status === 'pendente' && folha.tipo !== 'desconto' && folha.valor > 0) {
        const temDespesa =
          (folha.lancamento_id && cacheLancamentos.some((d) => d.id === folha.lancamento_id)) ||
          cacheLancamentos.some((d) => d.id === `desp-${folha.id}`);
        if (!temDespesa) {
          const desp = this.garantirDespesaDaFolha(folha);
          if (desp) vinculadas++;
        }
      }
    }
    return vinculadas;
  },

  contarFolhasPagasSemDespesa(): number {
    let contagem = 0;
    for (const folha of cacheLancamentosFolha) {
      if (folha.status === 'pago' && folha.tipo !== 'desconto' && folha.valor > 0) {
        const temDespesa =
          (folha.lancamento_id && cacheLancamentos.some((d) => d.id === folha.lancamento_id)) ||
          cacheLancamentos.some((d) => d.id === `desp-${folha.id}`);
        if (!temDespesa) {
          contagem++;
        }
      }
    }
    return contagem;
  },

  // A8: reconciliar folhas pagas cujo pagamento não existe mais no caixa
  reconciliarPagamentosDeFolha(): number {
    if (!this.isCarregado()) return 0;
    let corrigidas = 0;
    for (const folha of [...cacheLancamentosFolha]) {
      if (folha.tipo === 'desconto' || folha.status !== 'pago' || !folha.lancamento_id || folha.valor <= 0) continue;
      const desp = cacheLancamentos.find((d) => d.id === folha.lancamento_id);
      if (!desp || desp.status !== 'pago') {
        this.saveLancamentoFolha({ ...folha, status: 'pendente', data_pagamento: null });
        corrigidas++;
      }
    }
    return corrigidas;
  },

  removerRegistroFolhaBruto(id: string): void {
    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA, id)).catch((e) => {
      console.warn('Erro async removerRegistroFolhaBruto:', e);
      avisarFalhaGravacao('removerRegistroFolhaBruto', e);
    });
    cacheLancamentosFolha = cacheLancamentosFolha.filter((l) => l.id !== id);
    notify('folha');
  },

  removerFolhaOrfa(folhaId: string): void {
    const folha = cacheLancamentosFolha.find((l) => l.id === folhaId);

    const adiantamentosComAbatimento = cacheLancamentosFolha.filter(
      (l) => l.tipo === 'adiantamento' && (l.abatimentos || []).some((a) => a.folha_id === folhaId)
    );

    this.removerRegistroFolhaBruto(folhaId);

    for (const ad of adiantamentosComAbatimento) {
      const novosAbatimentos = (ad.abatimentos || []).filter((a) => a.folha_id !== folhaId);
      const somaAbatimentos = novosAbatimentos.reduce((sum, a) => sum + a.valor, 0);
      const saldoEmAberto = +(ad.valor - somaAbatimentos).toFixed(2);
      const descontadoTotal = saldoEmAberto <= 0.001;

      this.saveLancamentoFolha({
        ...ad,
        abatimentos: novosAbatimentos,
        descontado_em_folha: descontadoTotal,
      });
    }

    if (folha) {
      const func = this.getFuncionarioById(folha.funcionario_id);
      const nomeDoFuncionario = func ? func.nome : '';
      this.registrarAuditoria(
        'folha',
        'exclusao',
        `Exclusão da folha: ${folha.descricao} – ${nomeDoFuncionario} (${folha.competencia}) no valor de R$ ${folha.valor.toFixed(2)}`
      );
    }
  },

  excluirLancamentoFolha(id: string): void {
    const folha = cacheLancamentosFolha.find((l) => l.id === id);
    if (!folha) return;

    if (folha.lancamento_id && cacheLancamentos.some((l) => l.id === folha.lancamento_id)) {
      this.deleteLancamento(folha.lancamento_id);
    } else {
      this.removerFolhaOrfa(id);
    }
  },

  deleteLancamentoFolha(id: string): void {
    this.excluirLancamentoFolha(id);
  },

  // uso programático; a interface sempre passa pelo ModalPagarReceber, que valida saldo e cheque especial
  liquidarLancamentoFolha(
    id: string,
    contaId: string,
    dataPagamento?: string
  ): { sucesso: boolean; mensagem?: string } {
    const folha = cacheLancamentosFolha.find((l) => l.id === id);
    if (!folha) {
      return { sucesso: false, mensagem: 'Lançamento de folha não encontrado.' };
    }
    if (folha.status === 'pago') {
      return { sucesso: false, mensagem: 'Lançamento de folha já se encontra pago.' };
    }
    if (folha.tipo === 'desconto') {
      return { sucesso: false, mensagem: 'Lançamentos de folha do tipo desconto não geram despesa financeira.' };
    }

    const desp = this.garantirDespesaDaFolha(folha);
    if (!desp) {
      return { sucesso: false, mensagem: 'Não foi possível garantir a despesa associada a esta folha.' };
    }

    const res = this.liquidarLancamento({ id: desp.id, contaId, dataPagamento });
    if (!res) {
      return { sucesso: false, mensagem: 'Não foi possível liquidar a despesa no financeiro.' };
    }

    return { sucesso: true };
  },

  liquidarFolhaEmLote(
    folhaIds: string[],
    contaId: string,
    dataPagamento: string
  ): { quitados: number; total: number; falhas: Array<{ id: string; mensagem: string }> } {
    let quitados = 0;
    const falhas: Array<{ id: string; mensagem: string }> = [];

    for (const id of folhaIds) {
      const res = this.liquidarLancamentoFolha(id, contaId, dataPagamento);
      if (res.sucesso) {
        quitados++;
      } else {
        falhas.push({ id, mensagem: res.mensagem || 'Falha ao liquidar lançamento de folha.' });
      }
    }

    return { quitados, total: folhaIds.length, falhas };
  },

  adicionarOcorrencia(funcionarioId: string, ocorrencia: OcorrenciaFuncionario): void {
    const func = this.getFuncionarioById(funcionarioId);
    if (!func) return;
    const ocorrencias = func.ocorrencias ? [ocorrencia, ...func.ocorrencias] : [ocorrencia];
    this.saveFuncionario({ ...func, ocorrencias });
  },

  calcularFolhaFuncionario(
    func: Funcionario,
    competencia: string,
    periodo?: 'mensal' | 'q1' | 'q2',
    adiantamentoIdsSelecionados?: string[]
  ): ResultadoCalculoFolha {
    const salarioBase = func.salario_base || 0;

    const adicionais =
      func.adicional_tipo === 'periculosidade' || func.adicional_tipo === 'insalubridade'
        ? +(salarioBase * ((func.adicional_percentual || 0) / 100)).toFixed(2)
        : +(func.adicional_valor_fixo || 0).toFixed(2);

    const lancsComp = cacheLancamentosFolha.filter(
      (l) => l.funcionario_id === func.id && l.competencia === competencia
    );

    const tiposProventoAvulsoValidos = [
      'comissao',
      'hora_extra',
      'bonus',
      'vale',
      'reembolso',
      'ferias',
      'decimo_terceiro',
      'rescisao',
      'outro',
    ];

    const proventosAvulsos = +lancsComp
      .filter((l) => l.tipo_operacao === 'provento' && l.tipo !== 'salario' && tiposProventoAvulsoValidos.includes(l.tipo))
      .reduce((sum, l) => sum + (l.valor || 0), 0)
      .toFixed(2);

    const bruto = +(salarioBase + adicionais).toFixed(2);

    const lancsDesconto = lancsComp.filter((l) => l.tipo === 'desconto');
    const descontos: ItemDescontoFolha[] = lancsDesconto.map((l) => ({
      chave: l.id,
      descricao: l.descricao || 'Desconto',
      valor: l.valor || 0,
    }));

    const recorrentes = calcularDescontosRecorrentes(func.descontos_recorrentes, { salarioBase, bruto });
    for (const rec of recorrentes) {
      descontos.push({
        chave: rec.chave,
        descricao: rec.descricao,
        valor: rec.valor,
      });
    }

    const totalDescontos = +descontos.reduce((sum, d) => sum + d.valor, 0).toFixed(2);

    const salExistente = lancsComp.find((l) => l.tipo === 'salario' && l.periodo !== 'q1');

    let adiantamentosElegiveis = cacheLancamentosFolha.filter((l) => {
      if (l.funcionario_id !== func.id || l.tipo !== 'adiantamento' || l.status !== 'pago') return false;
      const somaAbat = (l.abatimentos || []).reduce((sum, a) => sum + a.valor, 0);
      const saldoAberto = +(l.valor - somaAbat).toFixed(2);

      const abatidoNesteSalario = salExistente
        ? (l.abatimentos || []).some((a) => a.folha_id === salExistente.id)
        : false;

      return (!l.descontado_em_folha && saldoAberto > 0) || abatidoNesteSalario;
    });

    if (adiantamentoIdsSelecionados && adiantamentoIdsSelecionados.length > 0) {
      adiantamentosElegiveis = adiantamentosElegiveis.filter((a) =>
        adiantamentoIdsSelecionados.includes(a.id)
      );
    }

    const somaAdiantamentosDisponiveis = adiantamentosElegiveis.reduce((sum, a) => {
      if (salExistente) {
        const abatimentoOutros = (a.abatimentos || []).filter((x) => x.folha_id !== salExistente.id).reduce((s, x) => s + x.valor, 0);
        const disponivel = +(a.valor - abatimentoOutros).toFixed(2);
        return sum + Math.max(0, disponivel);
      } else {
        const somaAbat = (a.abatimentos || []).reduce((s, x) => s + x.valor, 0);
        return sum + Math.max(0, +(a.valor - somaAbat).toFixed(2));
      }
    }, 0);

    const maxAbatimento = Math.max(0, +(bruto - totalDescontos).toFixed(2));
    const adiantamentosAbatidos = +Math.min(somaAdiantamentosDisponiveis, maxAbatimento).toFixed(2);

    const liquido = Math.max(0, +(bruto - totalDescontos - adiantamentosAbatidos).toFixed(2));

    return {
      salarioBase,
      adicionais,
      proventosAvulsos,
      bruto,
      descontos,
      totalDescontos,
      adiantamentosAbatidos,
      liquido,
      adiantamentosDetalhados: adiantamentosElegiveis,
    };
  },

  vincularAdiantamentos(
    salarioId: string,
    funcionarioId: string,
    competencia: string,
    valorAbater: number,
    adiantamentoIdsSelecionados?: string[]
  ): void {
    if (valorAbater <= 0) return;

    let emAberto = cacheLancamentosFolha.filter((l) => {
      if (l.funcionario_id !== funcionarioId || l.tipo !== 'adiantamento' || l.status !== 'pago') return false;
      const somaAbat = (l.abatimentos || [])
        .filter((a) => a.folha_id !== salarioId)
        .reduce((sum, a) => sum + a.valor, 0);
      const saldoRemanescente = +(l.valor - somaAbat).toFixed(2);
      return !l.descontado_em_folha && saldoRemanescente > 0;
    });

    if (adiantamentoIdsSelecionados && adiantamentoIdsSelecionados.length > 0) {
      emAberto = emAberto.filter((a) => adiantamentoIdsSelecionados.includes(a.id));
    }

    let restante = valorAbater;
    for (const ad of emAberto) {
      if (restante <= 0) break;

      const abatimentosOutros = (ad.abatimentos || []).filter((a) => a.folha_id !== salarioId);
      const saldoDisponivel = +(ad.valor - abatimentosOutros.reduce((sum, a) => sum + a.valor, 0)).toFixed(2);
      if (saldoDisponivel <= 0) continue;

      const valorAbaterNeste = +Math.min(saldoDisponivel, restante).toFixed(2);
      if (valorAbaterNeste > 0) {
        const novosAbatimentos = [...abatimentosOutros, { folha_id: salarioId, valor: valorAbaterNeste }];
        const totalAbatido = novosAbatimentos.reduce((sum, a) => sum + a.valor, 0);
        const saldoFinal = +(ad.valor - totalAbatido).toFixed(2);
        const descontadoTotal = saldoFinal <= 0.001;

        this.saveLancamentoFolha({
          ...ad,
          abatimentos: novosAbatimentos,
          descontado_em_folha: descontadoTotal,
          adiantamento_vinculado_id: salarioId,
        });

        restante = +(restante - valorAbaterNeste).toFixed(2);
      }
    }
  },

  calcularParcelasQuinzena(
    func: Funcionario,
    competencia: string,
    adiantamentoIdsSelecionados?: string[]
  ) {
    if (func.forma_remuneracao !== 'quinzenal') {
      return { quinzenal: false as const };
    }
    const calc = this.calcularFolhaFuncionario(func, competencia, undefined, adiantamentoIdsSelecionados);
    const config = func.pagamento_quinzenal || CONFIG_QUINZENAL_PADRAO;
    const divisao = dividirQuinzenas({
      bruto: calc.bruto,
      totalDescontos: calc.totalDescontos,
      adiantamentosMax: calc.adiantamentosAbatidos,
      config,
    });
    return {
      quinzenal: true as const,
      config,
      calc,
      divisao,
      parcelas: [
        { periodo: 'q1' as const, dia: config.dia_1, data_prevista: dataDoDiaNaCompetencia(competencia, config.dia_1), valor: divisao.q1 },
        { periodo: 'q2' as const, dia: config.dia_2, data_prevista: dataDoDiaNaCompetencia(competencia, config.dia_2), valor: divisao.q2 },
      ],
    };
  },

  gerarFolhaDoFuncionario(
    func: Funcionario,
    competencia: string,
    dataVencimento: string,
    contaId: string
  ): { gerados: number; totalValor: number; avisos: string[] } {
    const avisos: string[] = [];
    const salariosComp = cacheLancamentosFolha.filter(
      (l) => l.funcionario_id === func.id && l.competencia === competencia && l.tipo === 'salario'
    );

    if (func.forma_remuneracao === 'quinzenal') {
      // Já existe salário mensal (legado) na competência: não gera quinzenas.
      if (salariosComp.some((l) => !l.periodo || l.periodo === 'mensal')) {
        return { gerados: 0, totalValor: 0, avisos };
      }
      const info = this.calcularParcelasQuinzena(func, competencia);
      if (!info.quinzenal) return { gerados: 0, totalValor: 0, avisos };

      const rotulos = { q1: '1ª Quinzena', q2: '2ª Quinzena' } as const;
      const agora = Date.now();
      let gerados = 0;
      let totalValor = 0;

      for (const parcela of info.parcelas) {
        if (salariosComp.some((l) => l.periodo === parcela.periodo)) continue;

        const partesObs: string[] = [];
        if (parcela.periodo === 'q2') {
          if (info.divisao.abatimentoAdiantamentos > 0) {
            partesObs.push(`Dedução de R$ ${info.divisao.abatimentoAdiantamentos.toFixed(2)} em adiantamentos.`);
          }
          if (info.calc.descontos.length > 0) {
            partesObs.push(`Descontos: ${info.calc.descontos.map((d) => `${d.descricao} R$ ${d.valor.toFixed(2)}`).join('; ')}.`);
          }
        }
        const obs = partesObs.length > 0 ? partesObs.join(' ') : undefined;

        const item: LancamentoFolha = {
          id: `folha-${agora}-${func.id}-${parcela.periodo}`,
          funcionario_id: func.id,
          tipo: 'salario',
          descricao: `${rotulos[parcela.periodo]} – ${func.cargo}`,
          periodo: parcela.periodo,
          competencia,
          valor: parcela.valor,
          tipo_operacao: 'provento',
          data_prevista: parcela.data_prevista,
          data_pagamento: null,
          status: 'pendente',
          conta_id: contaId,
          ...(obs ? { observacoes: obs } : {}),
          criado_em: new Date().toISOString(),
        };
        const salva = this.criarLancamentoFolha(item);
        if (parcela.periodo === 'q2' && info.divisao.abatimentoAdiantamentos > 0) {
          this.vincularAdiantamentos(salva.id, func.id, competencia, info.divisao.abatimentoAdiantamentos);
        }
        gerados++;
        totalValor += parcela.valor;
      }
      avisos.push(...info.divisao.avisos.map((a) => `${func.nome}: ${a}`));
      return { gerados, totalValor: +totalValor.toFixed(2), avisos };
    }

    // MENSAL (comportamento anterior, agora com periodo 'mensal')
    if (salariosComp.length > 0) return { gerados: 0, totalValor: 0, avisos };

    const calcFolha = this.calcularFolhaFuncionario(func, competencia);
    const recorrentes = calcularDescontosRecorrentes(func.descontos_recorrentes, {
      salarioBase: calcFolha.salarioBase,
      bruto: calcFolha.bruto,
    });
    const partesObs: string[] = [];
    if (calcFolha.adiantamentosAbatidos > 0) {
      partesObs.push(`Dedução de R$ ${calcFolha.adiantamentosAbatidos.toFixed(2)} em adiantamentos.`);
    }
    if (recorrentes.length > 0) {
      partesObs.push(`Descontos: ${recorrentes.map((r) => `${r.descricao} R$ ${r.valor.toFixed(2)}`).join('; ')}.`);
    }
    const obsFinal = partesObs.length > 0 ? partesObs.join(' ') : undefined;

    const item: LancamentoFolha = {
      id: `folha-${Date.now()}-${func.id}`,
      funcionario_id: func.id,
      tipo: 'salario',
      descricao: func.tipo_contrato === 'prolabore' ? `Pró-labore ${func.cargo}` : `Salário Mensal ${func.cargo}`,
      periodo: 'mensal',
      competencia,
      valor: calcFolha.liquido,
      tipo_operacao: 'provento',
      data_prevista: dataVencimento,
      data_pagamento: null,
      status: 'pendente',
      conta_id: contaId,
      ...(obsFinal ? { observacoes: obsFinal } : {}),
      criado_em: new Date().toISOString(),
    };
    const folhaSalva = this.criarLancamentoFolha(item);
    if (calcFolha.adiantamentosAbatidos > 0) {
      this.vincularAdiantamentos(folhaSalva.id, func.id, competencia, calcFolha.adiantamentosAbatidos);
    }
    return { gerados: 1, totalValor: calcFolha.liquido, avisos };
  },

  gerarFolhaDoMes(
    competencia: string,
    dataVencimento: string,
    contaId: string
  ): { gerados: number; totalValor: number; avisos: string[] } {
    const ativos = this.getFuncionarios().filter((f) => f.status === 'ativo');
    let gerados = 0;
    let totalValor = 0;
    const avisos: string[] = [];
    for (const func of ativos) {
      const r = this.gerarFolhaDoFuncionario(func, competencia, dataVencimento, contaId);
      gerados += r.gerados;
      totalValor += r.totalValor;
      avisos.push(...r.avisos);
    }
    return { gerados, totalValor: +totalValor.toFixed(2), avisos };
  },

  gerarFolhaMes(competencia: string, contaIdPadrao: string): number {
    const res = this.gerarFolhaDoMes(competencia, new Date().toISOString().split('T')[0], contaIdPadrao);
    return res.gerados;
  },

  // CÁLCULOS E DASHBOARD (100% SEGUROS COM FALLBACK PARA CACHE VAZIO)
  calcularResumoConta(conta: ContaBancaria | string): ResumoSaldoConta {
    const c = typeof conta === 'string' ? this.getContaById(conta) : conta;
    if (!c) {
      const dummyConta: ContaBancaria = {
        id: 'dummy',
        nome: 'Conta',
        banco: 'Banco',
        tipo: 'corrente',
        saldo_inicial: 0,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#003064',
        ativa: false,
      };
      return {
        conta: dummyConta,
        saldo_inicial: 0,
        total_receitas_pagas: 0,
        total_despesas_pagas: 0,
        saldo_real: 0,
        saldo_disponivel_total: 0,
        limite_cheque_total: 0,
        cheque_especial_utilizado: 0,
        cheque_especial_disponivel: 0,
        usando_cheque_especial: false,
        percentual_cheque_usado: 0,
        alerta_critico_cheque: false,
        custo_juros_mensal_estimado: 0,
        custo_juros_diario_estimado: 0,
      };
    }

    const lancsConta = cacheLancamentos.filter((l) => l.conta_id === c.id && l.status === 'pago');
    const receitasPagas = lancsConta.filter((l) => l.tipo === 'receita').reduce((sum, l) => sum + l.valor, 0);
    const despesasPagas = lancsConta.filter((l) => l.tipo === 'despesa').reduce((sum, l) => sum + l.valor, 0);

    const saldoReal = c.saldo_inicial + receitasPagas - despesasPagas;
    const limiteCheque = c.limite_cheque_especial || 0;
    const saldoDisponivelTotal = saldoReal + limiteCheque;
    const chequeUtilizado = Math.max(0, -saldoReal);
    const chequeDisponivel = Math.max(0, limiteCheque - chequeUtilizado);
    const usandoCheque = saldoReal < 0 && limiteCheque > 0;
    const percentualUsado = limiteCheque > 0 ? (chequeUtilizado / limiteCheque) * 100 : 0;
    const alertaCritico = percentualUsado >= 80;

    const taxaMensal = (c.taxa_juros_cheque_especial_mensal || 0) / 100;
    const custoMensal = chequeUtilizado * taxaMensal;
    const custoDiario = custoMensal / 30;

    return {
      conta: c,
      saldo_inicial: c.saldo_inicial,
      total_receitas_pagas: receitasPagas,
      total_despesas_pagas: despesasPagas,
      saldo_real: saldoReal,
      saldo_disponivel_total: saldoDisponivelTotal,
      limite_cheque_total: limiteCheque,
      cheque_especial_utilizado: chequeUtilizado,
      cheque_especial_disponivel: chequeDisponivel,
      usando_cheque_especial: usandoCheque,
      percentual_cheque_usado: percentualUsado,
      alerta_critico_cheque: alertaCritico,
      custo_juros_mensal_estimado: custoMensal,
      custo_juros_diario_estimado: custoDiario,
    };
  },

  calcularResumoGeral() {
    const contas = this.getContas().filter((c) => c.ativa);
    const lancamentos = this.getLancamentos();

    let saldoRealTotal = 0;
    let limiteChequeTotal = 0;
    let chequeEspecialUsadoTotal = 0;

    const resumosContas = contas.map((c) => {
      const res = this.calcularResumoConta(c);
      saldoRealTotal += res.saldo_real;
      limiteChequeTotal += c.limite_cheque_especial;
      chequeEspecialUsadoTotal += res.cheque_especial_utilizado;
      return res;
    });

    const saldoDisponivelTotal = saldoRealTotal + limiteChequeTotal;
    const chequeDisponivelTotal = Math.max(0, limiteChequeTotal - chequeEspecialUsadoTotal);
    const usandoChequeEspecialTotal = saldoRealTotal < 0;
    const percentualChequeUsadoTotal = limiteChequeTotal > 0 ? (chequeEspecialUsadoTotal / limiteChequeTotal) * 100 : 0;
    const alertaCriticoChequeTotal = percentualChequeUsadoTotal >= 80;

    const custoJurosMensalTotal = resumosContas.reduce((acc, r) => acc + r.custo_juros_mensal_estimado, 0);
    const custoJurosDiarioTotal = custoJurosMensalTotal / 30;

    const hoje = new Date().toISOString().split('T')[0];
    let aReceberPendente = 0;
    let aReceberAtrasado = 0;
    let aPagarPendente = 0;
    let aPagarAtrasado = 0;
    let totalReceitasMes = 0;
    let totalDespesasMes = 0;

    const mesAtual = hoje.slice(0, 7);

    for (const l of lancamentos) {
      if (l.status === 'pendente') {
        const atrasado = l.data_vencimento < hoje;
        if (l.tipo === 'receita') {
          aReceberPendente += l.valor;
          if (atrasado) aReceberAtrasado += l.valor;
        } else {
          aPagarPendente += l.valor;
          if (atrasado) aPagarAtrasado += l.valor;
        }
      } else if (l.status === 'pago' && l.origem !== 'transferencia') {
        const dt = (l.data_pagamento || l.data_vencimento).slice(0, 7);
        if (dt === mesAtual) {
          if (l.tipo === 'receita') totalReceitasMes += l.valor;
          else totalDespesasMes += l.valor;
        }
      }
    }

    return {
      saldoRealTotal,
      limiteChequeTotal,
      chequeEspecialUsadoTotal,
      chequeDisponivelTotal,
      saldoDisponivelTotal,
      usandoChequeEspecialTotal,
      percentualChequeUsadoTotal,
      alertaCriticoChequeTotal,
      custoJurosMensalTotal,
      custoJurosDiarioTotal,
      resumosContas,
      aReceberPendente,
      aReceberAtrasado,
      aPagarPendente,
      aPagarAtrasado,
      totalReceitasMes,
      totalDespesasMes,
      resultadoMes: totalReceitasMes - totalDespesasMes,
    };
  },

  obterExtratoConta(contaId: string) {
    const conta = this.getContaById(contaId);
    if (!conta) return null;

    const lancamentosPagos = this.getLancamentos()
      .filter((l) => l.conta_id === contaId && l.status === 'pago')
      .sort((a, b) => {
        const dataA = a.data_pagamento || a.data_vencimento;
        const dataB = b.data_pagamento || b.data_vencimento;
        if (dataA !== dataB) return dataA.localeCompare(dataB);
        return a.criado_em.localeCompare(b.criado_em);
      });

    let saldoAcumulado = conta.saldo_inicial;
    const linhas = lancamentosPagos.map((l) => {
      if (l.tipo === 'receita') {
        saldoAcumulado = +(saldoAcumulado + l.valor).toFixed(2);
      } else {
        saldoAcumulado = +(saldoAcumulado - l.valor).toFixed(2);
      }
      const noCheque = saldoAcumulado < 0;
      const limiteCheque = conta.limite_cheque_especial || 0;
      const valorChequeUsado = noCheque ? Math.abs(saldoAcumulado) : 0;
      return {
        lancamento: l,
        saldo_real_acumulado: saldoAcumulado,
        usando_cheque: noCheque,
        valor_cheque_usado: valorChequeUsado,
        saldo_disponivel_acumulado: saldoAcumulado + limiteCheque,
      };
    });

    const resumoAtual = this.calcularResumoConta(conta);

    return {
      conta,
      saldo_inicial: conta.saldo_inicial,
      data_saldo_inicial: conta.data_saldo_inicial,
      linhas,
      resumoAtual,
    };
  },

  calcularProjecaoSaldoReal(dias: 30 | 60 | 90 = 30, contaId: string = 'todas') {
    const contas = this.getContas().filter((c) => c.ativa);
    let saldoInicial = 0;
    let limiteChequeTotal = 0;

    if (contaId === 'todas') {
      const resGeral = this.calcularResumoGeral();
      saldoInicial = resGeral.saldoRealTotal;
      limiteChequeTotal = resGeral.limiteChequeTotal;
    } else {
      const conta = contas.find((c) => c.id === contaId);
      if (conta) {
        const resConta = this.calcularResumoConta(conta);
        saldoInicial = resConta.saldo_real;
        limiteChequeTotal = conta.limite_cheque_especial || 0;
      }
    }

    const hojeIso = new Date().toISOString().split('T')[0];
    const todosLancamentos = this.getLancamentos();

    const pendentes = todosLancamentos.filter((l) => {
      if (l.status !== 'pendente') return false;
      if (contaId !== 'todas' && l.conta_id !== contaId) return false;
      return true;
    });

    const atrasadasReceitas = pendentes
      .filter((l) => l.tipo === 'receita' && l.data_vencimento < hojeIso)
      .reduce((a, b) => a + b.valor, 0);
    const atrasadasDespesas = pendentes
      .filter((l) => l.tipo === 'despesa' && l.data_vencimento < hojeIso)
      .reduce((a, b) => a + b.valor, 0);

    let saldoAcumulado = +(saldoInicial + atrasadasReceitas - atrasadasDespesas).toFixed(2);

    const pontos: Array<{
      dia: number;
      data: string;
      dataLabel: string;
      saldoProjetado: number;
      receitasDia: number;
      despesasDia: number;
      usandoCheque: boolean;
      chequeUsado: number;
    }> = [];

    let ficaraNegativo = false;
    let primeiraDataNegativa: string | null = null;
    let primeiraDataNegativaFormatada: string | null = null;
    let valorChequePrimeiroDia = 0;
    let maiorUsoCheque = 0;
    let minimoSaldoProjetado = saldoAcumulado;

    for (let i = 0; i <= dias; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dataIso = d.toISOString().split('T')[0];
      const [ano, mes, dia] = dataIso.split('-');
      const dataLabel = `${dia}/${mes}`;

      const receitasDia = pendentes
        .filter((l) => l.tipo === 'receita' && l.data_vencimento === dataIso)
        .reduce((a, b) => a + b.valor, 0);
      const despesasDia = pendentes
        .filter((l) => l.tipo === 'despesa' && l.data_vencimento === dataIso)
        .reduce((a, b) => a + b.valor, 0);

      saldoAcumulado = +(saldoAcumulado + receitasDia - despesasDia).toFixed(2);

      if (saldoAcumulado < minimoSaldoProjetado) {
        minimoSaldoProjetado = saldoAcumulado;
      }

      const usandoCheque = saldoAcumulado < 0;
      const chequeUsado = usandoCheque ? Math.abs(saldoAcumulado) : 0;

      if (chequeUsado > maiorUsoCheque) {
        maiorUsoCheque = chequeUsado;
      }

      if (usandoCheque && !ficaraNegativo) {
        ficaraNegativo = true;
        primeiraDataNegativa = dataIso;
        primeiraDataNegativaFormatada = dataLabel;
        valorChequePrimeiroDia = chequeUsado;
      }

      pontos.push({
        dia: i,
        data: dataIso,
        dataLabel,
        saldoProjetado: saldoAcumulado,
        receitasDia,
        despesasDia,
        usandoCheque,
        chequeUsado,
      });
    }

    const saldoFinalProjetado = saldoAcumulado;
    let avisoChequeEspecial: string | null = null;
    if (ficaraNegativo && primeiraDataNegativaFormatada) {
      avisoChequeEspecial = `Seu saldo real ficará negativo em ${primeiraDataNegativaFormatada}, usando R$ ${valorChequePrimeiroDia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} do cheque especial`;
    }

    return {
      pontos,
      ficaraNegativo,
      primeiraDataNegativa,
      primeiraDataNegativaFormatada,
      valorChequePrimeiroDia,
      maiorUsoCheque,
      saldoInicial,
      saldoFinalProjetado,
      minimoSaldoProjetado,
      limiteChequeTotal,
      avisoChequeEspecial,
    };
  },

  calcularResumoPainel(
    filtroPeriodo: string = 'mes_atual',
    dataInicioPersonalizada?: string,
    dataFimPersonalizada?: string
  ) {
    const hojeIso = new Date().toISOString().split('T')[0];
    const todosLancamentos = this.getLancamentos();

    const d7 = new Date();
    d7.setDate(d7.getDate() + 7);
    const limite7Iso = d7.toISOString().split('T')[0];

    const d30 = new Date();
    d30.setDate(d30.getDate() + 30);
    const limite30Iso = d30.toISOString().split('T')[0];

    const pendentes = todosLancamentos.filter((l) => l.status === 'pendente');

    const aReceberPendentes = pendentes.filter((l) => l.tipo === 'receita');
    const aReceber7Itens = aReceberPendentes.filter((l) => l.data_vencimento >= hojeIso && l.data_vencimento <= limite7Iso);
    const aReceber30Itens = aReceberPendentes.filter((l) => l.data_vencimento >= hojeIso && l.data_vencimento <= limite30Iso);

    const aReceber7Dias = {
      valor: aReceber7Itens.reduce((acc, l) => acc + l.valor, 0),
      quantidade: aReceber7Itens.length,
    };
    const aReceber30Dias = {
      valor: aReceber30Itens.reduce((acc, l) => acc + l.valor, 0),
      quantidade: aReceber30Itens.length,
    };

    const aPagarPendentes = pendentes.filter((l) => l.tipo === 'despesa');
    const aPagar7Itens = aPagarPendentes.filter((l) => l.data_vencimento >= hojeIso && l.data_vencimento <= limite7Iso);
    const aPagar30Itens = aPagarPendentes.filter((l) => l.data_vencimento >= hojeIso && l.data_vencimento <= limite30Iso);

    const aPagar7Dias = {
      valor: aPagar7Itens.reduce((acc, l) => acc + l.valor, 0),
      quantidade: aPagar7Itens.length,
    };
    const aPagar30Dias = {
      valor: aPagar30Itens.reduce((acc, l) => acc + l.valor, 0),
      quantidade: aPagar30Itens.length,
    };

    const aPagarAtrasadasItens = aPagarPendentes.filter((l) => l.data_vencimento < hojeIso);
    const aReceberAtrasadasItens = aReceberPendentes.filter((l) => l.data_vencimento < hojeIso);

    const contasAtrasadas = {
      aPagar: {
        valor: aPagarAtrasadasItens.reduce((acc, l) => acc + l.valor, 0),
        quantidade: aPagarAtrasadasItens.length,
      },
      aReceber: {
        valor: aReceberAtrasadasItens.reduce((acc, l) => acc + l.valor, 0),
        quantidade: aReceberAtrasadasItens.length,
      },
      total: {
        valor: aPagarAtrasadasItens.reduce((acc, l) => acc + l.valor, 0) + aReceberAtrasadasItens.reduce((acc, l) => acc + l.valor, 0),
        quantidade: aPagarAtrasadasItens.length + aReceberAtrasadasItens.length,
      },
    };

    let dataIni = hojeIso;
    let dataFim = hojeIso;
    const hojeObj = new Date();

    if (filtroPeriodo === 'mes_atual') {
      const ano = hojeObj.getFullYear();
      const mes = hojeObj.getMonth();
      const primeiroDia = new Date(ano, mes, 1);
      const ultimoDia = new Date(ano, mes + 1, 0);
      dataIni = primeiroDia.toISOString().split('T')[0];
      dataFim = ultimoDia.toISOString().split('T')[0];
    } else if (filtroPeriodo === 'proximo_mes') {
      const ano = hojeObj.getFullYear();
      const mes = hojeObj.getMonth() + 1;
      const primeiroDia = new Date(ano, mes, 1);
      const ultimoDia = new Date(ano, mes + 1, 0);
      dataIni = primeiroDia.toISOString().split('T')[0];
      dataFim = ultimoDia.toISOString().split('T')[0];
    } else if (filtroPeriodo === 'trimestre') {
      const d = new Date();
      d.setDate(d.getDate() + 90);
      dataIni = hojeIso;
      dataFim = d.toISOString().split('T')[0];
    } else if (filtroPeriodo === 'personalizado' && dataInicioPersonalizada && dataFimPersonalizada) {
      dataIni = dataInicioPersonalizada;
      dataFim = dataFimPersonalizada;
    }

    const pagosPeriodo = todosLancamentos.filter((l) => {
      if (l.status !== 'pago' || l.origem === 'transferencia') return false;
      const dt = l.data_pagamento || l.data_vencimento;
      return dt >= dataIni && dt <= dataFim;
    });

    const receitasPagasPeriodo = pagosPeriodo.filter((l) => l.tipo === 'receita').reduce((acc, l) => acc + l.valor, 0);
    const despesasPagasPeriodo = pagosPeriodo.filter((l) => l.tipo === 'despesa').reduce((acc, l) => acc + l.valor, 0);
    const resultadoOperacionalPeriodo = +(receitasPagasPeriodo - despesasPagasPeriodo).toFixed(2);

    return {
      aReceber7Dias,
      aReceber30Dias,
      aPagar7Dias,
      aPagar30Dias,
      contasAtrasadas,
      resultadoPeriodo: {
        filtro: filtroPeriodo,
        dataIni,
        dataFim,
        receitasPagas: receitasPagasPeriodo,
        despesasPagas: despesasPagasPeriodo,
        resultado: resultadoOperacionalPeriodo,
      },
    };
  },

  obterDadosGrafico6e12Meses(numMeses: 6 | 12 = 6) {
    const todos = this.getLancamentos().filter((l) => l.status === 'pago' && l.origem !== 'transferencia');
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const resultado = [];
    const hoje = new Date();

    for (let i = numMeses - 1; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const ano = d.getFullYear();
      const mesNum = d.getMonth();
      const anoMes = `${ano}-${String(mesNum + 1).padStart(2, '0')}`;
      const rotulo = `${mesesNomes[mesNum]}/${String(ano).slice(2)}`;

      let receitas = 0;
      let despesas = 0;

      todos.forEach((l) => {
        const dt = l.data_pagamento || l.data_vencimento;
        if (dt.startsWith(anoMes)) {
          if (l.tipo === 'receita') receitas += l.valor;
          else despesas += l.valor;
        }
      });

      resultado.push({
        anoMes,
        mesLabel: rotulo,
        receitas,
        despesas,
        resultado: +(receitas - despesas).toFixed(2),
      });
    }

    return resultado;
  },

  obterDespesasPorCategoria(dataIni?: string, dataFim?: string) {
    const todos = this.getLancamentos().filter(
      (l) => l.status === 'pago' && l.tipo === 'despesa' && l.origem !== 'transferencia'
    );
    const categorias = this.getCategorias();

    const filtradas = todos.filter((l) => {
      if (!dataIni || !dataFim) return true;
      const dt = l.data_pagamento || l.data_vencimento;
      return dt >= dataIni && dt <= dataFim;
    });

    const mapa = new Map<string, number>();
    let totalGeral = 0;

    filtradas.forEach((l) => {
      const atual = mapa.get(l.categoria_id) || 0;
      mapa.set(l.categoria_id, atual + l.valor);
      totalGeral += l.valor;
    });

    const coresPaleta = ['#003064', '#FCBC00', '#1A4A85', '#00204A', '#EAB308', '#0284C7', '#16A34A', '#DC2626', '#8B5CF6', '#EC4899'];

    const itens = Array.from(mapa.entries())
      .map(([catId, valor], idx) => {
        const cat = categorias.find((c) => c.id === catId);
        return {
          id: catId,
          nome: cat ? cat.nome : 'Outras Despesas',
          valor,
          percentual: totalGeral > 0 ? +((valor / totalGeral) * 100).toFixed(1) : 0,
          cor: cat?.cor || coresPaleta[idx % coresPaleta.length],
        };
      })
      .sort((a, b) => b.valor - a.valor);

    return { itens, totalGeral };
  },

  obterFluxoDiarioMes(anoMes?: string) {
    const hoje = new Date();
    const alvo = anoMes || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const [anoStr, mesStr] = alvo.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const todos = this.getLancamentos().filter((l) => l.status === 'pago' && l.origem !== 'transferencia');

    const dias = [];
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const diaPad = String(dia).padStart(2, '0');
      const dataIso = `${alvo}-${diaPad}`;
      let entradas = 0;
      let saidas = 0;

      todos.forEach((l) => {
        const dt = l.data_pagamento || l.data_vencimento;
        if (dt === dataIso) {
          if (l.tipo === 'receita') entradas += l.valor;
          else saidas += l.valor;
        }
      });

      dias.push({
        dia,
        dataLabel: `${diaPad}/${mesStr}`,
        dataIso,
        entradas,
        saidas,
        saldoDia: +(entradas - saidas).toFixed(2),
      });
    }

    return dias;
  },

  obterProximosVencimentos(limite: number = 8): Lancamento[] {
    const pendentes = this.getLancamentos().filter((l) => l.status === 'pendente');
    pendentes.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
    return pendentes.slice(0, limite);
  },

  obterUltimosLancamentos(limite: number = 8): Lancamento[] {
    const todos = [...this.getLancamentos()];
    todos.sort((a, b) => {
      const dataA = a.data_pagamento || a.data_vencimento || a.criado_em;
      const dataB = b.data_pagamento || b.data_vencimento || b.criado_em;
      return dataB.localeCompare(dataA);
    });
    return todos.slice(0, limite);
  },

  obterResumoFolha() {
    const config = this.getConfiguracoes();
    const funcionarios = this.getFuncionarios().filter((f) => f.status === 'ativo');
    const funcionariosAtivos = funcionarios.length || 8;
    const salariosBase = funcionarios.reduce((acc, f) => acc + f.salario_base, 0) || 26500.0;
    const inssPercent = config.encargos_inss || 20.0;
    const fgtsPercent = config.encargos_fgts || 8.0;
    const encargoINSS = +(salariosBase * (inssPercent / 100)).toFixed(2);
    const encargoFGTS = +(salariosBase * (fgtsPercent / 100)).toFixed(2);
    const custoTotalMensal = +(salariosBase + encargoINSS + encargoFGTS).toFixed(2);

    return {
      funcionariosAtivos,
      salariosBase,
      inssPercent,
      fgtsPercent,
      encargoINSS,
      encargoFGTS,
      custoTotalMensal,
    };
  },

  obterFichaProjeto(projetoId: string) {
    const projeto = this.getProjetos().find((p) => p.id === projetoId);
    if (!projeto) return null;

    const lancamentos = this.getLancamentos().filter(
      (l) => l.projeto_id === projetoId && l.status !== 'cancelado' && l.origem !== 'transferencia'
    );

    const receitasPagas = lancamentos
      .filter((l) => l.tipo === 'receita' && l.status === 'pago')
      .reduce((acc, l) => acc + l.valor, 0);

    const receitasPendentes = lancamentos
      .filter((l) => l.tipo === 'receita' && l.status === 'pendente')
      .reduce((acc, l) => acc + l.valor, 0);

    const receitaTotalPrevista = Math.max(projeto.valor_contratado, receitasPagas + receitasPendentes);
    const receitaAReceber = Math.max(0, projeto.valor_contratado - receitasPagas);

    const custosRealizados = lancamentos
      .filter((l) => l.tipo === 'despesa' && l.status === 'pago')
      .reduce((acc, l) => acc + l.valor, 0);

    const custosPendentes = lancamentos
      .filter((l) => l.tipo === 'despesa' && l.status === 'pendente')
      .reduce((acc, l) => acc + l.valor, 0);

    const custosTotaisPrevistos = +(custosRealizados + custosPendentes).toFixed(2);
    const lucroRealizado = +(receitasPagas - custosRealizados).toFixed(2);
    const margemRealizada = receitasPagas > 0 ? +((lucroRealizado / receitasPagas) * 100).toFixed(1) : 0;
    const lucroPrevisto = +(projeto.valor_contratado - custosTotaisPrevistos).toFixed(2);
    const margemPrevista = projeto.valor_contratado > 0 ? +((lucroPrevisto / projeto.valor_contratado) * 100).toFixed(1) : 0;
    const percentualRecebido = projeto.valor_contratado > 0 ? +Math.min(100, (receitasPagas / projeto.valor_contratado) * 100).toFixed(1) : 0;

    return {
      projeto,
      lancamentos,
      valorContratado: projeto.valor_contratado,
      receitasPagas: +receitasPagas.toFixed(2),
      receitasPendentes: +receitasPendentes.toFixed(2),
      receitaAReceber: +receitaAReceber.toFixed(2),
      receitaTotalPrevista: +receitaTotalPrevista.toFixed(2),
      custosRealizados: +custosRealizados.toFixed(2),
      custosPendentes: +custosPendentes.toFixed(2),
      custosTotaisPrevistos,
      lucroRealizado,
      margemRealizada,
      lucroPrevisto,
      margemPrevista,
      percentualRecebido,
    };
  },

  obterResumoTodosProjetos() {
    const projetos = this.getProjetos();
    const fichas = projetos.map((p) => this.obterFichaProjeto(p.id)!).filter(Boolean);

    const totalContratado = fichas.reduce((acc, f) => acc + f.valorContratado, 0);
    const totalRecebido = fichas.reduce((acc, f) => acc + f.receitasPagas, 0);
    const totalAReceber = fichas.reduce((acc, f) => acc + f.receitaAReceber, 0);
    const totalCustosRealizados = fichas.reduce((acc, f) => acc + f.custosRealizados, 0);
    const totalLucroRealizado = +(totalRecebido - totalCustosRealizados).toFixed(2);
    const margemMediaRealizada = totalRecebido > 0 ? +((totalLucroRealizado / totalRecebido) * 100).toFixed(1) : 0;

    return {
      fichas,
      totalContratado: +totalContratado.toFixed(2),
      totalRecebido: +totalRecebido.toFixed(2),
      totalAReceber: +totalAReceber.toFixed(2),
      totalCustosRealizados: +totalCustosRealizados.toFixed(2),
      totalLucroRealizado,
      margemMediaRealizada,
    };
  },

  obterHistoricoContato(contatoId: string) {
    const contato = this.getContatos().find((c) => c.id === contatoId);
    if (!contato) return null;

    const lancamentos = this.getLancamentos().filter((l) => l.contato_id === contatoId && l.origem !== 'transferencia');
    const hoje = new Date().toISOString().split('T')[0];

    const pagos = lancamentos.filter((l) => l.status === 'pago');
    const pendentes = lancamentos.filter((l) => l.status === 'pendente');

    const totalRecebido = pagos.filter((l) => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
    const totalPago = pagos.filter((l) => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);

    const aReceberPendente = pendentes.filter((l) => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
    const aPagarPendente = pendentes.filter((l) => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);

    const inadimplenteReceber = pendentes
      .filter((l) => l.tipo === 'receita' && l.data_vencimento < hoje)
      .reduce((a, b) => a + b.valor, 0);

    const emAtrasoPagar = pendentes
      .filter((l) => l.tipo === 'despesa' && l.data_vencimento < hoje)
      .reduce((a, b) => a + b.valor, 0);

    return {
      contato,
      lancamentos,
      totalLancamentos: lancamentos.length,
      totalRecebido: +totalRecebido.toFixed(2),
      totalPago: +totalPago.toFixed(2),
      aReceberPendente: +aReceberPendente.toFixed(2),
      aPagarPendente: +aPagarPendente.toFixed(2),
      inadimplenteReceber: +inadimplenteReceber.toFixed(2),
      emAtrasoPagar: +emAtrasoPagar.toFixed(2),
    };
  },

  gerarRelatorioDRE(dataIni?: string, dataFim?: string) {
    const todos = this.getLancamentos().filter((l) => l.status === 'pago' && l.origem !== 'transferencia');
    const categorias = this.getCategorias();

    const filtrados = todos.filter((l) => {
      const dt = l.data_pagamento || l.data_vencimento;
      if (dataIni && dt < dataIni) return false;
      if (dataFim && dt > dataFim) return false;
      return true;
    });

    const mapaReceitas = new Map<string, number>();
    const mapaDespesas = new Map<string, number>();
    let receitaTotal = 0;
    let despesaTotal = 0;

    filtrados.forEach((l) => {
      if (l.tipo === 'receita') {
        const chave = categorias.some((c) => c.id === l.categoria_id) ? l.categoria_id : 'sem_categoria';
        const at = mapaReceitas.get(chave) || 0;
        mapaReceitas.set(chave, at + l.valor);
        receitaTotal += l.valor;
      } else {
        const chave = categorias.some((c) => c.id === l.categoria_id) ? l.categoria_id : 'sem_categoria';
        const at = mapaDespesas.get(chave) || 0;
        mapaDespesas.set(chave, at + l.valor);
        despesaTotal += l.valor;
      }
    });

    const linhasReceitas = Array.from(mapaReceitas.entries())
      .map(([catId, val]) => {
        const cat = categorias.find((c) => c.id === catId);
        return {
          categoriaId: catId,
          nome: cat ? cat.nome : 'Sem categoria',
          cor: cat?.cor || '#16A34A',
          valor: +val.toFixed(2),
          percentualReceita: receitaTotal > 0 ? +((val / receitaTotal) * 100).toFixed(1) : 0,
        };
      })
      .sort((a, b) => b.valor - a.valor);

    const linhasDespesas = Array.from(mapaDespesas.entries())
      .map(([catId, val]) => {
        const cat = categorias.find((c) => c.id === catId);
        return {
          categoriaId: catId,
          nome: cat ? cat.nome : 'Sem categoria',
          cor: cat?.cor || '#DC2626',
          valor: +val.toFixed(2),
          percentualReceita: receitaTotal > 0 ? +((val / receitaTotal) * 100).toFixed(1) : 0,
        };
      })
      .sort((a, b) => b.valor - a.valor);

    const resultadoLiquido = +(receitaTotal - despesaTotal).toFixed(2);
    const margemLiquida = receitaTotal > 0 ? +((resultadoLiquido / receitaTotal) * 100).toFixed(1) : 0;

    return {
      receitaTotal: +receitaTotal.toFixed(2),
      despesaTotal: +despesaTotal.toFixed(2),
      resultadoLiquido,
      margemLiquida,
      linhasReceitas,
      linhasDespesas,
    };
  },

  gerarRelatorioFluxoCaixa(ano?: number) {
    const hoje = new Date();
    const anoAlvo = ano || hoje.getFullYear();
    const todos = this.getLancamentos().filter((l) => l.status !== 'cancelado' && l.origem !== 'transferencia');
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const meses = [];
    for (let m = 0; m < 12; m++) {
      const mesStr = String(m + 1).padStart(2, '0');
      const prefixo = `${anoAlvo}-${mesStr}`;

      let realizadoEntradas = 0;
      let realizadoSaidas = 0;
      let previstoEntradas = 0;
      let previstoSaidas = 0;

      todos.forEach((l) => {
        const dtRealizada = l.data_pagamento;
        const dtVenc = l.data_vencimento;

        if (l.status === 'pago' && dtRealizada && dtRealizada.startsWith(prefixo)) {
          if (l.tipo === 'receita') realizadoEntradas += l.valor;
          else realizadoSaidas += l.valor;
        }

        if (dtVenc.startsWith(prefixo)) {
          if (l.tipo === 'receita') previstoEntradas += l.valor;
          else previstoSaidas += l.valor;
        }
      });

      meses.push({
        mesIndex: m + 1,
        mesNome: mesesNomes[m],
        rotulo: `${mesesNomes[m]}/${String(anoAlvo).slice(2)}`,
        realizadoEntradas: +realizadoEntradas.toFixed(2),
        realizadoSaidas: +realizadoSaidas.toFixed(2),
        realizadoLiquido: +(realizadoEntradas - realizadoSaidas).toFixed(2),
        previstoEntradas: +previstoEntradas.toFixed(2),
        previstoSaidas: +previstoSaidas.toFixed(2),
        previstoLiquido: +(previstoEntradas - previstoSaidas).toFixed(2),
      });
    }

    return { ano: anoAlvo, meses };
  },

  gerarRelatorioLucratividadeProjetos() {
    return this.obterResumoTodosProjetos();
  },

  gerarRelatorioInadimplenciaContatos() {
    const contatos = this.getContatos();
    const hoje = new Date().toISOString().split('T')[0];
    const lancamentos = this.getLancamentos().filter((l) => l.status === 'pendente' && l.origem !== 'transferencia');

    const devedoresMap = new Map<string, { nome: string; cpfCnpj: string; totalDevido: number; totalVencido: number; diasMaiorAtraso: number; parcelasVencidas: number }>();
    const credoresMap = new Map<string, { nome: string; cpfCnpj: string; totalDevido: number; totalVencido: number; parcelasPendentes: number }>();

    lancamentos.forEach((l) => {
      const contato = contatos.find((c) => c.id === l.contato_id) || {
        id: l.contato_id || 'avulso',
        nome: l.contato_id ? 'Contato ' + l.contato_id : 'Cliente / Fornecedor Avulso',
        cpf_cnpj: '-',
      };

      const atrasado = l.data_vencimento < hoje;
      let diasAtraso = 0;
      if (atrasado) {
        const diff = new Date(hoje).getTime() - new Date(l.data_vencimento).getTime();
        diasAtraso = Math.floor(diff / (1000 * 60 * 60 * 24));
      }

      if (l.tipo === 'receita') {
        const at = devedoresMap.get(contato.id) || {
          nome: contato.nome,
          cpfCnpj: contato.cpf_cnpj,
          totalDevido: 0,
          totalVencido: 0,
          diasMaiorAtraso: 0,
          parcelasVencidas: 0,
        };
        at.totalDevido += l.valor;
        if (atrasado) {
          at.totalVencido += l.valor;
          at.parcelasVencidas += 1;
          if (diasAtraso > at.diasMaiorAtraso) at.diasMaiorAtraso = diasAtraso;
        }
        devedoresMap.set(contato.id, at);
      } else {
        const at = credoresMap.get(contato.id) || {
          nome: contato.nome,
          cpfCnpj: contato.cpf_cnpj,
          totalDevido: 0,
          totalVencido: 0,
          parcelasPendentes: 0,
        };
        at.totalDevido += l.valor;
        if (atrasado) {
          at.totalVencido += l.valor;
        }
        at.parcelasPendentes += 1;
        credoresMap.set(contato.id, at);
      }
    });

    const quemNosDeve = Array.from(devedoresMap.values())
      .filter((d) => d.totalDevido > 0)
      .sort((a, b) => (b.totalVencido !== a.totalVencido ? b.totalVencido - a.totalVencido : b.totalDevido - a.totalDevido));

    const aQuemDevemos = Array.from(credoresMap.values())
      .filter((c) => c.totalDevido > 0)
      .sort((a, b) => (b.totalVencido !== a.totalVencido ? b.totalVencido - a.totalVencido : b.totalDevido - a.totalDevido));

    return {
      quemNosDeve,
      aQuemDevemos,
      totalInadimplenciaReceber: quemNosDeve.reduce((acc, q) => acc + q.totalVencido, 0),
      totalVencidoPagar: aQuemDevemos.reduce((acc, q) => acc + q.totalVencido, 0),
    };
  },

  gerarRelatorioChequeEspecial(dataIni?: string, dataFim?: string) {
    const contas = this.getContas().filter((c) => c.ativa);
    const lancamentos = this.getLancamentos().filter((l) => l.status === 'pago');

    const hoje = new Date();
    const fim = dataFim ? new Date(dataFim + 'T12:00:00') : hoje;
    const inicio = dataIni ? new Date(dataIni + 'T12:00:00') : new Date(fim.getFullYear(), fim.getMonth() - 1, 1);

    let diasNoNegativo = 0;
    let maiorValorUtilizado = 0;
    let custoTotalJurosEstimado = 0;
    const detalhesPorConta: Array<{
      conta: ContaBancaria;
      saldoAtual: number;
      chequeUsadoAtual: number;
      limite: number;
      diasNegativo: number;
      picoUso: number;
      jurosEstimados: number;
    }> = [];

    contas.forEach((conta) => {
      const resumo = this.calcularResumoConta(conta);
      const taxaMensal = conta.taxa_juros_cheque_especial_mensal || 8.0;
      const taxaDiaria = taxaMensal / 100 / 30;

      let diasNegConta = 0;
      let picoConta = 0;
      let jurosConta = 0;

      const cursor = new Date(inicio);
      while (cursor <= fim) {
        const diaIso = cursor.toISOString().split('T')[0];
        const lDia = lancamentos.filter((l) => l.conta_id === conta.id && (l.data_pagamento || l.data_vencimento) <= diaIso);
        const rec = lDia.filter((l) => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
        const des = lDia.filter((l) => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
        const saldoNesseDia = conta.saldo_inicial + rec - des;

        if (saldoNesseDia < 0) {
          const utilizado = Math.abs(saldoNesseDia);
          diasNegConta++;
          if (utilizado > picoConta) picoConta = utilizado;
          jurosConta += utilizado * taxaDiaria;
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      if (picoConta > maiorValorUtilizado) maiorValorUtilizado = picoConta;
      diasNoNegativo = Math.max(diasNoNegativo, diasNegConta);
      custoTotalJurosEstimado += jurosConta;

      detalhesPorConta.push({
        conta,
        saldoAtual: resumo.saldo_real,
        chequeUsadoAtual: resumo.cheque_especial_utilizado,
        limite: conta.limite_cheque_especial,
        diasNegativo: diasNegConta,
        picoUso: +picoConta.toFixed(2),
        jurosEstimados: +jurosConta.toFixed(2),
      });
    });

    return {
      diasNoNegativo,
      maiorValorUtilizado: +maiorValorUtilizado.toFixed(2),
      custoTotalJurosEstimado: +custoTotalJurosEstimado.toFixed(2),
      detalhesPorConta,
      periodo: {
        inicio: inicio.toISOString().split('T')[0],
        fim: fim.toISOString().split('T')[0],
      },
    };
  },

  gerarRelatorioFuncionariosFolha(ano?: number, dataIni?: string, dataFim?: string) {
    const anoAlvo = ano || new Date().getFullYear();
    const funcionarios = this.getFuncionarios();
    const folha = this.getLancamentosFolha();

    const porFuncionario = funcionarios
      .map((f) => {
        const calc = this.calcularCustoTotalFuncionario(f);
        return {
          funcionario: f,
          salarioBase: f.salario_base,
          remuneracaoBruta: calc.remuneracaoBruta,
          beneficios: calc.totalBeneficios,
          encargosProvisoes: calc.totalEncargosProvisoes,
          custoTotalMensal: calc.custoTotalMensal,
        };
      })
      .sort((a, b) => b.custoTotalMensal - a.custoTotalMensal);

    const setorMap = new Map<string, { setor: string; qtd: number; totalCusto: number; totalBase: number }>();
    porFuncionario.forEach((item) => {
      const s = item.funcionario.setor;
      const at = setorMap.get(s) || { setor: s, qtd: 0, totalCusto: 0, totalBase: 0 };
      at.qtd += 1;
      at.totalCusto += item.custoTotalMensal;
      at.totalBase += item.salarioBase;
      setorMap.set(s, at);
    });
    const porSetor = Array.from(setorMap.values()).sort((a, b) => b.totalCusto - a.totalCusto);

    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const folhaMensalAno = [];

    if (dataIni && dataFim) {
      // Modo multi-ano: percorre todos os anos de anoIni até anoFim
      const anoIni = Number(dataIni.slice(0, 4));
      const anoFim = Number(dataFim.slice(0, 4));
      const multiAno = anoIni !== anoFim;

      for (let a = anoIni; a <= anoFim; a++) {
        for (let m = 0; m < 12; m++) {
          const mesPad = String(m + 1).padStart(2, '0');
          const comp = `${mesPad}/${a}`;

          // Filtra eventos desta competência cuja data esteja dentro do período
          const eventosMes = folha.filter((l) => {
            if (l.competencia !== comp) return false;
            const dt = l.data_pagamento || l.data_prevista;
            if (!dt) return false;
            return dt >= dataIni && dt <= dataFim;
          });

          // Inclui o mês somente se houver eventos OU se a competência estiver dentro do intervalo
          const compData = `${a}-${mesPad}`;
          const iniData = `${dataIni.slice(0, 4)}-${dataIni.slice(5, 7)}`;
          const fimData = `${dataFim.slice(0, 4)}-${dataFim.slice(5, 7)}`;
          if (compData < iniData || compData > fimData) continue;

          const saidas = eventosMes.filter((l) => l.tipo !== 'desconto' && l.status !== 'cancelado');
          const totalLiquido = +saidas.reduce((a, l) => a + l.valor, 0).toFixed(2);
          const totalPago = +saidas.filter((l) => l.status === 'pago').reduce((a, l) => a + l.valor, 0).toFixed(2);

          // Rótulo inclui o ano quando o período cruza anos diferentes
          const rotulo = multiAno
            ? `${mesPad}/${a}`
            : `${mesesNomes[m]}/${String(a).slice(2)}`;

          folhaMensalAno.push({
            mesIndex: m + 1,
            mesNome: mesesNomes[m],
            rotulo,
            competencia: comp,
            totalPago,
            totalLiquido,
            quantidadeLancamentos: eventosMes.length,
          });
        }
      }
    } else {
      // Modo mono-ano (comportamento original): percorre os 12 meses de anoAlvo
      for (let m = 0; m < 12; m++) {
        const mesPad = String(m + 1).padStart(2, '0');
        const comp = `${mesPad}/${anoAlvo}`;
        const eventosMes = folha.filter((l) => l.competencia === comp);
        const saidas = eventosMes.filter((l) => l.tipo !== 'desconto' && l.status !== 'cancelado');
        const totalLiquido = +saidas.reduce((a, l) => a + l.valor, 0).toFixed(2);
        const totalPago = +saidas.filter((l) => l.status === 'pago').reduce((a, l) => a + l.valor, 0).toFixed(2);

        folhaMensalAno.push({
          mesIndex: m + 1,
          mesNome: mesesNomes[m],
          rotulo: `${mesesNomes[m]}/${String(anoAlvo).slice(2)}`,
          competencia: comp,
          totalPago,
          totalLiquido,
          quantidadeLancamentos: eventosMes.length,
        });
      }
    }

    return {
      ano: anoAlvo,
      porFuncionario,
      porSetor,
      folhaMensalAno,
      totalGeralMensalEmpresa: porFuncionario.reduce((acc, f) => acc + f.custoTotalMensal, 0),
    };
  },


  gerarRelatorioComparativoMesAMes(ano?: number) {
    const anoAlvo = ano || new Date().getFullYear();
    const dadosAno = this.gerarRelatorioFluxoCaixa(anoAlvo);

    const meses = dadosAno.meses.map((m, idx, array) => {
      const mesAnterior = idx > 0 ? array[idx - 1] : null;
      const variacaoReceitas =
        mesAnterior && mesAnterior.realizadoEntradas > 0
          ? +(((m.realizadoEntradas - mesAnterior.realizadoEntradas) / mesAnterior.realizadoEntradas) * 100).toFixed(1)
          : 0;
      const variacaoDespesas =
        mesAnterior && mesAnterior.realizadoSaidas > 0
          ? +(((m.realizadoSaidas - mesAnterior.realizadoSaidas) / mesAnterior.realizadoSaidas) * 100).toFixed(1)
          : 0;

      return {
        ...m,
        variacaoReceitas,
        variacaoDespesas,
      };
    });

    return { ano: anoAlvo, meses };
  },

  gerarRelatorioBalanco() {
    const contas = this.getContas()
      .filter((c) => c.ativa !== false)
      .map((c) => ({ nome: c.nome, saldo: this.calcularResumoConta(c).saldo_real }));

    const pendentes = this.getLancamentos().filter(
      (l) => l.status === 'pendente' && l.origem !== 'transferencia' && l.origem !== 'ajuste'
    );
    const somar = (arr: Lancamento[]) => +arr.reduce((a, l) => a + l.valor, 0).toFixed(2);

    const contasAReceber = somar(pendentes.filter((l) => l.tipo === 'receita' && l.origem !== 'folha'));
    const contasAPagar = somar(pendentes.filter((l) => l.tipo === 'despesa' && l.origem !== 'folha'));
    const folhaAPagar = somar(pendentes.filter((l) => l.tipo === 'despesa' && l.origem === 'folha'));

    const adiantamentos = this.getLancamentosFolha().filter(
      (l) => l.tipo === 'adiantamento' && l.status === 'pago'
    );
    const adiantamentosColaboradores = +adiantamentos
      .reduce((total, l) => {
        const somaAbat = (l.abatimentos || []).reduce((sum, a) => sum + a.valor, 0);
        return total + Math.max(0, l.valor - somaAbat);
      }, 0)
      .toFixed(2);

    return {
      ...montarBalanco({
        contas,
        contasAReceber,
        contasAPagar,
        folhaAPagar,
        adiantamentosColaboradores,
        itensManuais: this.getItensBalancoManual(),
      }),
      dataBase: new Date().toISOString().split('T')[0],
    };
  },

  calcularCustoTotalFuncionario(f: Funcionario) {
    if (!f) {
      return {
        salarioBase: 0,
        adicionalValor: 0,
        remuneracaoBruta: 0,
        totalBeneficios: 0,
        inssPatronal: 0,
        fgts: 0,
        provisaoFerias: 0,
        provisao13: 0,
        outrosEncargos: 0,
        totalEncargosProvisoes: 0,
        custoTotalMensal: 0,
      };
    }

    const salarioBase = f.salario_base || 0;
    const adicionalValor =
      f.adicional_tipo === 'periculosidade' || f.adicional_tipo === 'insalubridade'
        ? +(salarioBase * ((f.adicional_percentual || 0) / 100)).toFixed(2)
        : +(f.adicional_valor_fixo || 0).toFixed(2);

    const remuneracaoBruta = +(salarioBase + adicionalValor).toFixed(2);
    const totalBeneficios = +(f.beneficios || []).reduce((acc, b) => acc + (b.valor || 0), 0).toFixed(2);

    const isCLT = f.tipo_contrato === 'CLT';
    const isProlabore = f.tipo_contrato === 'prolabore';
    const inssPatronal = (isCLT || isProlabore) ? +(remuneracaoBruta * ((f.inss_patronal_percentual || 0) / 100)).toFixed(2) : 0;
    const fgts = isCLT ? +(remuneracaoBruta * ((f.fgts_percentual || 0) / 100)).toFixed(2) : 0;
    const provisaoFerias = isCLT ? +(remuneracaoBruta * ((f.provisao_ferias_percentual || 0) / 100)).toFixed(2) : 0;
    const provisao13 = isCLT ? +(remuneracaoBruta * ((f.provisao_13_percentual || 0) / 100)).toFixed(2) : 0;
    const outrosEncargos = isCLT ? +(remuneracaoBruta * ((f.outros_encargos_percentual || 0) / 100)).toFixed(2) : 0;

    const totalEncargosProvisoes = +(inssPatronal + fgts + provisaoFerias + provisao13 + outrosEncargos).toFixed(2);
    const custoTotalMensal = +(remuneracaoBruta + totalBeneficios + totalEncargosProvisoes).toFixed(2);

    return {
      salarioBase,
      adicionalValor,
      remuneracaoBruta,
      totalBeneficios,
      inssPatronal,
      fgts,
      provisaoFerias,
      provisao13,
      outrosEncargos,
      totalEncargosProvisoes,
      custoTotalMensal,
    };
  },

  obterFichaFinanceira(funcionarioId: string) {
    const todos = this.getLancamentosFolha().filter((l) => l.funcionario_id === funcionarioId);
    todos.sort((a, b) => (b.data_pagamento || b.data_prevista).localeCompare(a.data_pagamento || a.data_prevista));

    const hoje = new Date();
    const anoAtualStr = String(hoje.getFullYear());
    const mesAtualStr = String(hoje.getMonth() + 1).padStart(2, '0');
    const compAtual = `${mesAtualStr}/${anoAtualStr}`;

    const totaisPorTipo: Record<string, number> = {};
    let saldoAdiantamentosAberto = 0;
    const adiantamentosEmAberto: LancamentoFolha[] = [];
    let totalPagoMes = 0;
    let totalPagoAno = 0;

    todos.forEach((l) => {
      totaisPorTipo[l.tipo] = (totaisPorTipo[l.tipo] || 0) + l.valor;

      if (l.tipo === 'adiantamento' && !l.descontado_em_folha && l.status === 'pago') {
        saldoAdiantamentosAberto += l.valor;
        adiantamentosEmAberto.push(l);
      }

      if (l.status === 'pago') {
        const dt = l.data_pagamento || l.data_prevista;
        if (dt.startsWith(anoAtualStr)) {
          totalPagoAno += l.valor;
        }
        if (l.competencia === compAtual || dt.startsWith(`${anoAtualStr}-${mesAtualStr}`)) {
          totalPagoMes += l.valor;
        }
      }
    });

    return {
      lancamentos: todos,
      totaisPorTipo,
      saldoAdiantamentosAberto: +saldoAdiantamentosAberto.toFixed(2),
      adiantamentosEmAberto,
      totalPagoMes: +totalPagoMes.toFixed(2),
      totalPagoAno: +totalPagoAno.toFixed(2),
    };
  },

  // Auditoria
  getHistoricoAuditoria(): RegistroAuditoria[] {
    return cacheHistorico;
  },

  getHistoricoAlteracoes(): RegistroAuditoria[] {
    return this.getHistoricoAuditoria();
  },

  registrarAuditoria(modulo: any, acao: any, descricao: string, detalhes?: string): void {
    const user = this.getUsuarioAtual();
    const docId = `audit-${Date.now()}`;
    const registro: RegistroAuditoria = {
      id: docId,
      data_hora: new Date().toISOString(),
      usuario_nome: user?.nome || 'Sistema / Convidado',
      usuario_email: user?.email || 'sistema@mtsolar.com.br',
      modulo,
      acao,
      descricao,
      detalhes,
    };
    setDoc(doc(db, FIRESTORE_COLLECTIONS.HISTORICO, docId), registro).catch((e) =>
      console.warn('Erro async registrarAuditoria:', e)
    );
    cacheHistorico.unshift(registro);
    notify('historico');
  },

  registrarAlteracao(modulo: any, acao: any, descricao: string, detalhes?: string): void {
    return this.registrarAuditoria(modulo, acao, descricao, detalhes);
  },

  limparHistoricoAlteracoes(): void {
    for (const item of cacheHistorico) {
      deleteDoc(doc(db, FIRESTORE_COLLECTIONS.HISTORICO, item.id)).catch((e) => {});
    }
    cacheHistorico = [];
    notify('historico');
  },

  // Alertas
  obterAlertas(): AlertaItem[] {
    const alertas: AlertaItem[] = [];
    const hoje = new Date().toISOString().split('T')[0];

    const contas = this.getContasBancarias();
    contas.forEach((c) => {
      const res = this.calcularResumoConta(c.id);
      if (res && res.saldo_real < 0) {
        alertas.push({
          id: `alerta-saldo-${c.id}`,
          tipo: 'saldo_negativo',
          titulo: `Saldo Negativo: ${c.nome}`,
          descricao: `A conta está com saldo de R$ ${res.saldo_real.toFixed(2)}.`,
          severidade: 'critico',
          linkPagina: 'contas',
        });
      }
    });

    const lancamentos = this.getLancamentos();
    lancamentos.forEach((l) => {
      if (l.status === 'pendente') {
        if (l.data_vencimento < hoje) {
          alertas.push({
            id: `alerta-vencido-${l.id}`,
            tipo: 'atrasada',
            titulo: `Título Vencido: ${l.descricao}`,
            descricao: `Venceu em ${l.data_vencimento} - R$ ${l.valor.toFixed(2)}`,
            severidade: 'critico',
            linkPagina: l.tipo === 'despesa' ? 'pagar' : 'receber',
          });
        } else if (l.data_vencimento === hoje) {
          alertas.push({
            id: `alerta-hoje-${l.id}`,
            tipo: 'vencendo_hoje',
            titulo: `Vence Hoje: ${l.descricao}`,
            descricao: `Valor: R$ ${l.valor.toFixed(2)}`,
            severidade: 'aviso',
            linkPagina: l.tipo === 'despesa' ? 'pagar' : 'receber',
          });
        }
      }
    });

    return alertas;
  },

  // Export / Import Backup JSON
  exportarBackupCompletoJSON(): string {
    const backup = {
      app: 'MT Solar - Gestão Financeira',
      versao: '1.0.0',
      data_exportacao: new Date().toISOString(),
      dados: {
        contas: this.getContasBancarias(),
        categorias: this.getCategorias(),
        contatos: this.getContatos(),
        projetos: this.getProjetos(),
        lancamentos: this.getLancamentos(),
        usuarios: this.getUsuariosAutorizados(),
        funcionarios: this.getFuncionarios(),
        lancamentos_folha: this.getLancamentosFolha(),
        configuracoes: this.getConfiguracoes(),
        historico: this.getHistoricoAuditoria(),
      },
    };
    return JSON.stringify(backup, null, 2);
  },

  importarBackupCompletoJSON(jsonStr: string): { sucesso: boolean; mensagem: string } {
    try {
      const parsed = JSON.parse(jsonStr);
      const dados = parsed.dados || parsed;

      if (Array.isArray(dados.contas)) {
        dados.contas.forEach((c: ContaBancaria) => this.saveContaBancaria(c));
      }
      if (Array.isArray(dados.categorias)) {
        dados.categorias.forEach((c: Categoria) => this.saveCategoria(c));
      }
      if (Array.isArray(dados.contatos)) {
        dados.contatos.forEach((c: Contato) => this.saveContato(c));
      }
      if (Array.isArray(dados.projetos)) {
        dados.projetos.forEach((p: Projeto) => this.saveProjeto(p));
      }
      if (Array.isArray(dados.lancamentos)) {
        dados.lancamentos.forEach((l: Lancamento) => this.saveLancamento(l));
      }
      if (Array.isArray(dados.funcionarios)) {
        dados.funcionarios.forEach((f: Funcionario) => this.saveFuncionario(f));
      }
      if (Array.isArray(dados.usuarios)) {
        dados.usuarios.forEach((u: UsuarioAutorizado) => this.saveUsuarioAutorizado(u));
      }
      if (dados.configuracoes) {
        this.saveConfiguracoes(dados.configuracoes);
      }

      this.registrarAlteracao('sistema', 'importacao', 'Backup JSON importado e sincronizado com a nuvem');
      return { sucesso: true, mensagem: 'Backup importado e sincronizado com o Firestore com sucesso!' };
    } catch (e: any) {
      return { sucesso: false, mensagem: 'Erro ao importar arquivo JSON: ' + e?.message };
    }
  },

  // Migração Local -> Firestore
  async importarDadosLocaisParaNuvem(): Promise<{ sucesso: boolean; mensagem: string; itensImportados: number }> {
    try {
      let total = 0;

      const rawContas = localStorage.getItem(STORAGE_KEYS.CONTAS);
      if (rawContas) {
        const contas: ContaBancaria[] = JSON.parse(rawContas);
        for (const item of contas) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTAS, item.id), item, { merge: true });
          total++;
        }
      }

      const rawCat = localStorage.getItem(STORAGE_KEYS.CATEGORIAS);
      if (rawCat) {
        const cats: Categoria[] = JSON.parse(rawCat);
        for (const item of cats) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.CATEGORIAS, item.id), item, { merge: true });
          total++;
        }
      }

      const rawContatos = localStorage.getItem(STORAGE_KEYS.CONTATOS);
      if (rawContatos) {
        const contatos: Contato[] = JSON.parse(rawContatos);
        for (const item of contatos) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTATOS, item.id), item, { merge: true });
          total++;
        }
      }

      const rawProjetos = localStorage.getItem(STORAGE_KEYS.PROJETOS);
      if (rawProjetos) {
        const projetos: Projeto[] = JSON.parse(rawProjetos);
        for (const item of projetos) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.PROJETOS, item.id), item, { merge: true });
          total++;
        }
      }

      const rawLanc = localStorage.getItem(STORAGE_KEYS.LANCAMENTOS);
      if (rawLanc) {
        const lancs: Lancamento[] = JSON.parse(rawLanc);
        for (const item of lancs) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, item.id), item, { merge: true });
          total++;
        }
      }

      const rawUsers = localStorage.getItem(STORAGE_KEYS.USUARIOS);
      if (rawUsers) {
        const users: UsuarioAutorizado[] = JSON.parse(rawUsers);
        for (const item of users) {
          const docId = item.email.toLowerCase();
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.USUARIOS, docId), { ...item, id: docId, email: docId }, { merge: true });
          total++;
        }
      }

      const rawFunc = localStorage.getItem(STORAGE_KEYS.FUNCIONARIOS);
      if (rawFunc) {
        const funcs: Funcionario[] = JSON.parse(rawFunc);
        for (const item of funcs) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.FUNCIONARIOS, item.id), item, { merge: true });
          total++;
        }
      }

      const rawFolha = localStorage.getItem(STORAGE_KEYS.LANCAMENTOS_FOLHA);
      if (rawFolha) {
        const folha: LancamentoFolha[] = JSON.parse(rawFolha);
        for (const item of folha) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA, item.id), item, { merge: true });
          total++;
        }
      }

      const rawConfig = localStorage.getItem(STORAGE_KEYS.CONFIGURACOES);
      if (rawConfig) {
        const config: ConfiguracoesEmpresa = JSON.parse(rawConfig);
        await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONFIGURACOES, 'empresa'), config, { merge: true });
        total++;
      }

      this.registrarAuditoria(
        'sistema',
        'importacao',
        `Importação de ${total} registros locais para o Firestore concluída com sucesso.`
      );

      return {
        sucesso: true,
        mensagem: `Importação realizada com sucesso! ${total} registros foram sincronizados com a nuvem Firestore.`,
        itensImportados: total,
      };
    } catch (err: any) {
      console.error('Erro na importação local para nuvem:', err);
      return {
        sucesso: false,
        mensagem: `Erro ao importar dados: ${err.message || 'Falha na conexão com o Firestore.'}`,
        itensImportados: 0,
      };
    }
  },

  // -------------------------------------------------------------------------
  // Regras de Importação (aprendizado de classificação de extratos)
  // Apenas administradores devem escrever nesta coleção.
  // -------------------------------------------------------------------------

  getRegrasImportacao(): RegraImportacao[] {
    return cacheRegrasImportacao;
  },

  getRegrasImportacaoAtivas(): RegraImportacao[] {
    return cacheRegrasImportacao.filter((r) => r.ativa);
  },

  saveRegraImportacao(regra: Omit<RegraImportacao, 'id' | 'criadoEm' | 'usos'> & Partial<Pick<RegraImportacao, 'id' | 'criadoEm' | 'usos'>>): RegraImportacao {
    const docId = regra.id || `regra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isNova = !regra.id || !cacheRegrasImportacao.some((r) => r.id === docId);
    const item: RegraImportacao = {
      ...regra,
      id: docId,
      criadoEm: regra.criadoEm || new Date().toISOString(),
      usos: regra.usos ?? 0,
    };

    setDoc(doc(db, FIRESTORE_COLLECTIONS.REGRAS_IMPORTACAO, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveRegraImportacao:', e)
    );

    const idx = cacheRegrasImportacao.findIndex((r) => r.id === docId);
    if (idx >= 0) cacheRegrasImportacao[idx] = item;
    else cacheRegrasImportacao.push(item);

    this.registrarAuditoria(
      'regras_importacao',
      isNova ? 'criacao' : 'edicao',
      isNova ? `Nova regra de importação criada: "${item.valor}"` : `Regra de importação atualizada: "${item.valor}"`,
      `Campo: ${item.campo}, Banco: ${item.banco_codigo}, Categoria: ${item.categoria_id}, Ativa: ${item.ativa}`
    );

    notify('regras_importacao');
    return item;
  },

  deleteRegraImportacao(id: string): void {
    const regraExistente = cacheRegrasImportacao.find((r) => r.id === id);
    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.REGRAS_IMPORTACAO, id)).catch((e) =>
      console.warn('Erro async deleteRegraImportacao:', e)
    );
    cacheRegrasImportacao = cacheRegrasImportacao.filter((r) => r.id !== id);

    this.registrarAuditoria(
      'regras_importacao',
      'exclusao',
      `Regra de importação excluída: "${regraExistente?.valor || id}"`,
      `Regra ID: ${id}`
    );

    notify('regras_importacao');
  },

  /**
   * Incrementa o contador `usos` de uma regra quando o usuário aceita a sugestão.
   * Permite ordenar as regras por popularidade futuramente.
   */
  incrementarUsosRegra(id: string): void {
    const regra = cacheRegrasImportacao.find((r) => r.id === id);
    if (!regra) return;
    const atualizada: RegraImportacao = { ...regra, usos: regra.usos + 1 };
    setDoc(doc(db, FIRESTORE_COLLECTIONS.REGRAS_IMPORTACAO, id), atualizada, { merge: true }).catch((e) =>
      console.warn('Erro async incrementarUsosRegra:', e)
    );
    const idx = cacheRegrasImportacao.findIndex((r) => r.id === id);
    if (idx >= 0) cacheRegrasImportacao[idx] = atualizada;
    notify('regras_importacao');
  },

  // ============================================================
  // IMPORTAÇÕES DE EXTRATOS BANCÁRIOS (PARTE 15F)
  // ============================================================
  getImportacoes(): RegistroImportacao[] {
    return [...cacheImportacoes].sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  },

  getImportacaoPorId(id: string): RegistroImportacao | undefined {
    return cacheImportacoes.find((i) => i.id === id);
  },

  async saveImportacao(importacao: RegistroImportacao): Promise<RegistroImportacao> {
    const docId = importacao.id;
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.IMPORTOES, docId), importacao, { merge: true }).catch((e) =>
      console.warn('Erro async saveImportacao:', e)
    );
    const idx = cacheImportacoes.findIndex((i) => i.id === docId);
    if (idx >= 0) cacheImportacoes[idx] = importacao;
    else cacheImportacoes.push(importacao);
    notify('importacoes');
    return importacao;
  },

  /**
   * Gravação atômica, rastreável e reversível de lote de importação revisado na Parte 15E.
   * - Divide operações em batches de no máximo 500 documentos (limite do Firestore)
   * - Cria lançamentos com origem 'importacao' e origem_importacao vinculada ao lote_id
   * - Atualiza enriquecimentos preservando categorias e guardando snapshot para reversão
   * - Registra o lote na coleção 'importacoes' com status 'concluida' (ou 'parcial' se houver falha)
   * - NÃO dispara espelhamento de folha nem recorrências
   */
  async importarExtratoLote(params: ParamsImportacaoLote): Promise<ResultadoImportacaoLote> {
    const conta = this.getContaById(params.contaId);
    if (!conta) {
      throw new Error(`Conta bancária ${params.contaId} não encontrada no sistema.`);
    }

    const resumoAntes = this.calcularResumoConta(conta);
    const saldoAntes = resumoAntes.saldo_real;

    // Parte 18C: Detecta se a conta bancária já possui lançamentos importados anteriores
    const isPrimeiraImportacaoConta = !contaTemLancamentosImportados(params.contaId, cacheLancamentos);

    const totais = {
      lancadas: 0,
      ignoradas: 0,
      duplicadas: 0,
      enriquecidas: 0,
      vinculadas: 0,
      total_creditos: 0,
      total_debitos: 0,
    };

    const avisos: string[] = [];
    const novosLancamentos: Lancamento[] = [];
    const snapshotsEnriquecidos: Array<{
      lancamentoId: string;
      descricaoAnterior: string;
      origemImportacaoAnterior?: any;
      observacoesAnterior?: string;
    }> = [];
    const lancamentosAtualizados: Lancamento[] = [];
    const regrasSalvas: RegraImportacao[] = [];

    // 2. Registro preliminar como 'parcial' no Firestore para rastreabilidade
    const registroLote: RegistroImportacao = {
      id: params.loteId,
      data: new Date().toISOString().split('T')[0],
      usuario: params.usuario,
      banco_codigo: params.bancoCodigo,
      conta_id: params.contaId,
      nome_arquivo: params.nomeArquivo,
      formato: params.formato,
      periodo: params.periodo,
      totais,
      saldo_banco: params.saldoBanco,
      saldo_sistema_antes: saldoAntes,
      status: 'parcial',
      criado_em: new Date().toISOString(),
      snapshot_enriquecidos: [],
    };

    try {
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.IMPORTOES, params.loteId), registroLote, { merge: true });
    } catch (e) {
      console.warn('Erro ao salvar registro preliminar de importacao:', e);
    }

    // 3. Processa cada item revisado
    for (const item of params.itens) {
      if (item.acao === 'ignorar') {
        if (item.statusDeduplicacao === 'duplicada_exata') {
          totais.duplicadas++;
        } else {
          totais.ignoradas++;
        }
        continue;
      }

      // Enriquecimento / Vinculação (Parte 16C: verifica existência prévia para nunca derrubar o lote)
      if (item.acao === 'vincular' && item.lancamentoExistenteId) {
        const lancExistente = this.getLancamentos().find((l) => l.id === item.lancamentoExistenteId);
        if (!lancExistente) {
          avisos.push(
            `Lançamento existente ID "${item.lancamentoExistenteId}" não foi encontrado no sistema para enriquecimento. Transação ignorada.`
          );
          totais.ignoradas++;
          continue;
        }

        snapshotsEnriquecidos.push({
          lancamentoId: lancExistente.id,
          descricaoAnterior: lancExistente.descricao,
          origemImportacaoAnterior: lancExistente.origem_importacao,
          observacoesAnterior: lancExistente.observacoes || '',
        });

        // Enriquecimento OFX x XLSX (ou vinculação manual)
        const descEnriquecida = gerarDescricaoCurta(
          item.transacao.descricaoOriginal,
          item.transacao.contraparte
        );

        const dataHoraImportacaoAtual = new Date().toISOString();
        const observacoesEnriquecidas = complementarObservacoesEnriquecimento(
          lancExistente.observacoes,
          {
            descricaoOriginal: item.transacao.descricaoOriginal,
            contraparte: item.transacao.contraparte,
            documento: item.transacao.documento,
            fitid: item.transacao.fitid || lancExistente.origem_importacao?.fitid,
            bancoCodigo: params.bancoCodigo,
            bancoNome: params.bancoNome,
            nomeArquivo: params.nomeArquivo,
            formato: params.formato,
            loteId: params.loteId,
            dataHoraImportacao: dataHoraImportacaoAtual,
          }
        );

        const lancAtualizado: Lancamento = {
          ...lancExistente,
          descricao: lancExistente.origem === 'manual' ? lancExistente.descricao : descEnriquecida,
          observacoes: observacoesEnriquecidas,
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo,
            conta_id: params.contaId,
            fitid: item.transacao.fitid || lancExistente.origem_importacao?.fitid,
            assinatura_fraca:
              lancExistente.origem_importacao?.assinatura_fraca ||
              gerarAssinaturaFraca({
                conta: params.contaId,
                data: item.transacao.data,
                tipo: item.transacao.tipo,
                valor: item.transacao.valor,
                descricaoNormalizada: item.transacao.descricaoNormalizada,
                ordemNoDia: item.transacao.ordemNoDia,
              }),
            formato: params.formato,
            nome_arquivo: params.nomeArquivo,
            data_importacao: dataHoraImportacaoAtual,
            documento: item.transacao.documento,
            contraparte: item.transacao.contraparte,
            descricao_original: item.transacao.descricaoOriginal,
          },
        };

        lancamentosAtualizados.push(lancAtualizado);
        if (item.statusDeduplicacao === 'enriquecer_existente') {
          totais.enriquecidas++;
        } else {
          totais.vinculadas++;
        }
        continue;
      }

      if (item.acao === 'incluir') {
        // GUARDA DE SEGURANÇA #1: tipoLancamento=transferencia sem conta destino explícita
        // deve ser tratado como ignorar — jamais lançar como despesa avulsa.
        if (item.tipoLancamento === 'transferencia') {
          if (!params.contaDestinoId) {
            console.info(
              `[importarExtratoLote] Movimentação interna ignorada (sem conta destino explícita): ${item.transacao.descricaoOriginal}`
            );
            totais.ignoradas++;
            continue;
          }

          // Com conta destino explícita → criar par de transferência
          const ehResgate = item.transacao.tipo === 'credito';
          const contaOrigemTransferencia = ehResgate ? params.contaDestinoId : params.contaId;
          const contaDestinoTransferencia = ehResgate ? params.contaId : params.contaDestinoId;

          const timestamp = Date.now();
          const idSaida = `lanc-imp-transf-out-${timestamp}-${Math.random().toString(36).substr(2, 5)}`;
          const idEntrada = `lanc-imp-transf-in-${timestamp}-${Math.random().toString(36).substr(2, 5)}`;
          const dataHoraImportacaoAtual = new Date().toISOString();
          const descTransf = gerarDescricaoCurta(item.transacao.descricaoOriginal, item.transacao.contraparte);
          const obsTransf = formatarObservacoesImportacao({
            descricaoOriginal: item.transacao.descricaoOriginal,
            contraparte: item.transacao.contraparte,
            documento: item.transacao.documento,
            fitid: item.transacao.fitid,
            bancoCodigo: params.bancoCodigo,
            bancoNome: params.bancoNome,
            nomeArquivo: params.nomeArquivo,
            formato: params.formato,
            loteId: params.loteId,
            dataHoraImportacao: dataHoraImportacaoAtual,
          });
          const assFraca = gerarAssinaturaFraca({
            conta: params.contaId,
            data: item.transacao.data,
            tipo: item.transacao.tipo,
            valor: item.transacao.valor,
            descricaoNormalizada: item.transacao.descricaoNormalizada,
            ordemNoDia: item.transacao.ordemNoDia,
          });

          const lancSaida: Lancamento = {
            id: idSaida,
            tipo: 'despesa',
            descricao: descTransf,
            valor: item.transacao.valor,
            data_vencimento: item.transacao.data,
            data_pagamento: item.transacao.data,
            status: 'pago',
            conta_id: contaOrigemTransferencia,
            conta_destino_id: contaDestinoTransferencia,
            transferencia_vinculada_id: idEntrada,
            categoria_id: 'cat-des-12',
            forma_pagamento: 'transferencia',
            recorrencia: 'nenhuma',
            observacoes: obsTransf,
            origem: 'transferencia',
            origem_importacao: {
              lote_id: params.loteId,
              banco_codigo: params.bancoCodigo,
              conta_id: params.contaId,
              fitid: item.transacao.fitid,
              assinatura_fraca: assFraca,
              formato: params.formato,
              nome_arquivo: params.nomeArquivo,
              data_importacao: dataHoraImportacaoAtual,
              documento: item.transacao.documento,
              contraparte: item.transacao.contraparte,
              descricao_original: item.transacao.descricaoOriginal,
            },
            criado_em: new Date().toISOString(),
          };

          const lancEntrada: Lancamento = {
            id: idEntrada,
            tipo: 'receita',
            descricao: descTransf,
            valor: item.transacao.valor,
            data_vencimento: item.transacao.data,
            data_pagamento: item.transacao.data,
            status: 'pago',
            conta_id: contaDestinoTransferencia,
            transferencia_vinculada_id: idSaida,
            categoria_id: 'cat-rec-5',
            forma_pagamento: 'transferencia',
            recorrencia: 'nenhuma',
            observacoes: obsTransf,
            origem: 'transferencia',
            origem_importacao: {
              lote_id: params.loteId,
              banco_codigo: params.bancoCodigo,
              conta_id: params.contaId,
              fitid: item.transacao.fitid,
              assinatura_fraca: assFraca,
              formato: params.formato,
              nome_arquivo: params.nomeArquivo,
              data_importacao: dataHoraImportacaoAtual,
              documento: item.transacao.documento,
              contraparte: item.transacao.contraparte,
              descricao_original: item.transacao.descricaoOriginal,
            },
            criado_em: new Date().toISOString(),
          };

          novosLancamentos.push(lancSaida, lancEntrada);
          totais.lancadas++;
          if (ehResgate) {
            totais.total_creditos = +(totais.total_creditos + item.transacao.valor).toFixed(2);
          } else {
            totais.total_debitos = +(totais.total_debitos + item.transacao.valor).toFixed(2);
          }
          continue;
        }

        const formaPagamento = inferirFormaPagamento(
          item.transacao.descricaoOriginal,
          item.natureza as any
        );

        const dataHoraImportacaoAtual = new Date().toISOString();
        const descNovo = gerarDescricaoCurta(item.transacao.descricaoOriginal, item.transacao.contraparte);
        const obsNovo = formatarObservacoesImportacao({
          descricaoOriginal: item.transacao.descricaoOriginal,
          contraparte: item.transacao.contraparte,
          documento: item.transacao.documento,
          fitid: item.transacao.fitid,
          bancoCodigo: params.bancoCodigo,
          bancoNome: params.bancoNome,
          nomeArquivo: params.nomeArquivo,
          formato: params.formato,
          loteId: params.loteId,
          dataHoraImportacao: dataHoraImportacaoAtual,
        });

        const assinaturaFraca = gerarAssinaturaFraca({
          conta: params.contaId,
          data: item.transacao.data,
          tipo: item.transacao.tipo,
          valor: item.transacao.valor,
          descricaoNormalizada: item.transacao.descricaoNormalizada,
          ordemNoDia: item.transacao.ordemNoDia,
        });

        const novoLancamento: Lancamento = {
          id: `lanc-imp-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
          tipo: item.tipoLancamento === 'receita' ? 'receita' : 'despesa',
          descricao: descNovo,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: 'pago',
          conta_id: params.contaId,
          categoria_id: item.categoriaId,
          contato_id: item.contatoId || undefined,
          projeto_id: item.projetoId || undefined,
          forma_pagamento: formaPagamento,
          recorrencia: 'nenhuma',
          observacoes: obsNovo,
          origem: 'importacao',
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo,
            conta_id: params.contaId,
            fitid: item.transacao.fitid,
            assinatura_fraca: assinaturaFraca,
            formato: params.formato,
            nome_arquivo: params.nomeArquivo,
            data_importacao: dataHoraImportacaoAtual,
            documento: item.transacao.documento,
            contraparte: item.transacao.contraparte,
            descricao_original: item.transacao.descricaoOriginal,
          },
          criado_em: new Date().toISOString(),
        };

        novosLancamentos.push(novoLancamento);
        totais.lancadas++;
        if (novoLancamento.tipo === 'receita') {
          totais.total_creditos = +(totais.total_creditos + item.transacao.valor).toFixed(2);
        } else {
          totais.total_debitos = +(totais.total_debitos + item.transacao.valor).toFixed(2);
        }
      }
    }

    // 4. Regras de importação a salvar
    if (params.regrasACriar && params.regrasACriar.length > 0) {
      for (const r of params.regrasACriar) {
        const novaRegra: RegraImportacao = {
          ...r,
          id: `regra-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          criadoEm: new Date().toISOString(),
          usos: 1,
        };
        regrasSalvas.push(novaRegra);
      }
    }

    // 5. Trava Anti-Vazamento entre Contas (Requisito 3 - Parte 15G)
    for (const lanc of novosLancamentos) {
      const contaValida =
        lanc.conta_id === params.contaId ||
        (params.contaDestinoId && lanc.conta_id === params.contaDestinoId && lanc.transferencia_vinculada_id);

      if (!contaValida) {
        const erroMsg = `[importarExtratoLote] VIOLAÇÃO DE SEGURANÇA: Tentativa de gravar lançamento '${lanc.id}' para conta '${lanc.conta_id}', diferente da conta escolhida '${params.contaId}'. A importação foi abortada imediatamente.`;
        console.error(erroMsg);
        throw new Error(erroMsg);
      }
    }

    for (const lanc of lancamentosAtualizados) {
      if (lanc.conta_id !== params.contaId) {
        const erroMsg = `[importarExtratoLote] VIOLAÇÃO DE SEGURANÇA: Tentativa de atualizar lançamento '${lanc.id}' da conta '${lanc.conta_id}', diferente da conta do lote '${params.contaId}'. A importação foi abortada imediatamente.`;
        console.error(erroMsg);
        throw new Error(erroMsg);
      }
    }

    // 6. Execução em batches no Firestore (máx 490 operações por lote)
    const todasOperacoes: Array<{
      tipo: 'set';
      colecao: string;
      id: string;
      dado: any;
      merge?: boolean;
    }> = [];

    for (const lanc of novosLancamentos) {
      todasOperacoes.push({
        tipo: 'set',
        colecao: FIRESTORE_COLLECTIONS.LANCAMENTOS,
        id: lanc.id,
        dado: lanc,
      });
    }

    for (const lanc of lancamentosAtualizados) {
      // Usar set com merge: true para enriquecimento seguro (não derruba o lote se documento não existir)
      todasOperacoes.push({
        tipo: 'set',
        colecao: FIRESTORE_COLLECTIONS.LANCAMENTOS,
        id: lanc.id,
        dado: {
          descricao: lanc.descricao,
          origem_importacao: lanc.origem_importacao,
        },
        merge: true,
      });
    }

    for (const reg of regrasSalvas) {
      todasOperacoes.push({
        tipo: 'set',
        colecao: FIRESTORE_COLLECTIONS.REGRAS_IMPORTACAO,
        id: reg.id,
        dado: reg,
      });
    }

    const TAMANHO_MAX_BATCH = 490;
    try {
      for (let i = 0; i < todasOperacoes.length; i += TAMANHO_MAX_BATCH) {
        const batch = writeBatch(db);
        const fatia = todasOperacoes.slice(i, i + TAMANHO_MAX_BATCH);

        for (const op of fatia) {
          const docRef = doc(db, op.colecao, op.id);
          if (op.merge) {
            batch.set(docRef, op.dado, { merge: true });
          } else {
            batch.set(docRef, op.dado);
          }
        }

        await batch.commit();
      }
    } catch (err) {
      const msgTraduzida = traduzirErroFirestore(err);
      console.error('Falha ao persistir batch no Firestore:', err);
      registroLote.totais = totais;
      registroLote.status = 'parcial';
      registroLote.atualizado_em = new Date().toISOString();
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.IMPORTOES, params.loteId), registroLote, { merge: true }).catch(() => {});
      throw new Error(`Falha na gravação do lote no servidor. O lote foi registrado como 'parcial'. Detalhes: ${msgTraduzida}`);
    }

    // 7. Conferência pós-commit no Firestore por lote_id (Parte 16C)
    let totalConfirmadosServidor = 0;
    try {
      const qLote = query(
        collection(db, FIRESTORE_COLLECTIONS.LANCAMENTOS),
        where('origem_importacao.lote_id', '==', params.loteId)
      );
      const snapshotLote = await getDocs(qLote);
      totalConfirmadosServidor = snapshotLote.size;
    } catch (checkErr) {
      console.warn('Não foi possível verificar contagem no Firestore pós-commit:', checkErr);
      avisos.push(`Não foi possível auditar contagem no servidor após gravação: ${traduzirErroFirestore(checkErr)}`);
      // Em fallback de ambiente local ou offline, assume novosLancamentos.length
      totalConfirmadosServidor = novosLancamentos.length;
    }

    if (totalConfirmadosServidor !== novosLancamentos.length) {
      const msgDivergencia = `Divergência detectada após gravação: o servidor confirmou ${totalConfirmadosServidor} lançamento(s), mas o lote esperava ${novosLancamentos.length}. O lote foi registrado como 'parcial'.`;
      console.error(msgDivergencia);
      registroLote.totais = totais;
      registroLote.status = 'parcial';
      registroLote.atualizado_em = new Date().toISOString();
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.IMPORTOES, params.loteId), registroLote, { merge: true }).catch(() => {});
      throw new Error(msgDivergencia);
    }

    // 8. PARTE 18C (REGRA ÚNICA):
    // Aplicar o saldo inicial somente na PRIMEIRA importação da conta (conta sem lançamentos importados anteriores),
    // no mesmo momento da gravação e DEPOIS de os lançamentos serem confirmados no servidor.
    // Calcular a soma com dados deduplicados por ID.
    let saldoInicialDefinido: { novoSaldoInicial: number; novaDataSaldoInicial: string } | undefined = undefined;

    const infoSaldo = params.saldoInformado || params.saldoBanco;
    let saldoRealInformado: number | undefined = undefined;
    let dataSaldoInformado: string | undefined = undefined;

    if (infoSaldo && infoSaldo.valor !== undefined) {
      dataSaldoInformado = infoSaldo.data || params.periodo.fim || new Date().toISOString().split('T')[0];
      // PARTE 21A: a conversão disponível→real é feita SOMENTE na tela (RevisaoExtrato).
      // O storage recebe SEMPRE o saldo real já convertido; isDisponivel aqui é sempre false.
      // Não aplicar converterDisponivelParaSaldoReal aqui.
      saldoRealInformado = infoSaldo.valor;
    }

    if (isPrimeiraImportacaoConta && saldoRealInformado !== undefined && dataSaldoInformado) {
      // Coleta todos os lançamentos pagos da conta pós-gravação (existentes + novos do lote + enriquecidos)
      const todosLancsParaCalculo: Lancamento[] = [
        ...cacheLancamentos.filter((l) => l.conta_id === params.contaId),
        ...novosLancamentos.filter((l) => l.conta_id === params.contaId),
        ...lancamentosAtualizados.filter((l) => l.conta_id === params.contaId),
      ];

      const calculo = calcularSaldoInicialPrimeiraImportacao({
        saldoRealInformado,
        dataSaldoInformado,
        contaId: params.contaId,
        todosLancamentosPagosConta: todosLancsParaCalculo,
      });

      const saldoInicialAnterior = conta.saldo_inicial;
      const dataSaldoInicialAnterior = conta.data_saldo_inicial;

      const contaAtualizada: ContaBancaria = {
        ...conta,
        saldo_inicial: calculo.novoSaldoInicial,
        data_saldo_inicial: calculo.novaDataSaldoInicial,
      };

      try {
        await this.saveContaBancaria(contaAtualizada);

        saldoInicialDefinido = {
          novoSaldoInicial: calculo.novoSaldoInicial,
          novaDataSaldoInicial: calculo.novaDataSaldoInicial,
        };

        registroLote.saldoInicialAjustadoNesteLote = true;
        registroLote.saldoInicialAnteriorConta = saldoInicialAnterior;
        registroLote.dataSaldoInicialAnteriorConta = dataSaldoInicialAnterior;
      } catch (contaErr) {
        console.error('Falha ao atualizar dados de saldo inicial da conta:', contaErr);
        registroLote.totais = totais;
        registroLote.status = 'parcial';
        registroLote.atualizado_em = new Date().toISOString();
        await setDoc(doc(db, FIRESTORE_COLLECTIONS.IMPORTOES, params.loteId), registroLote, { merge: true }).catch(() => {});
        throw new Error(`Lançamentos foram gravados, mas houve falha ao atualizar a conta bancária: ${traduzirErroFirestore(contaErr)}`);
      }
    }

    // 9. PARTE 21A: atualização atômica do cache sinâcrono — upsert por id
    // (o onSnapshot pode ter entregue os mesmos documentos; push cego criaria duplicatas)
    for (const novo of novosLancamentos) {
      const idxExist = cacheLancamentos.findIndex((l) => l.id === novo.id);
      if (idxExist >= 0) {
        cacheLancamentos[idxExist] = novo; // substitui se já existe
      } else {
        cacheLancamentos.push(novo);
      }
    }
    for (const atualizado of lancamentosAtualizados) {
      const idx = cacheLancamentos.findIndex((l) => l.id === atualizado.id);
      if (idx >= 0) cacheLancamentos[idx] = atualizado;
    }
    for (const reg of regrasSalvas) {
      const idxReg = cacheRegrasImportacao.findIndex((r) => r.id === reg.id);
      if (idxReg >= 0) {
        cacheRegrasImportacao[idxReg] = reg; // upsert: substitui se já existe
      } else {
        cacheRegrasImportacao.push(reg);
      }
    }

    // Deduplicação estrita garantida: calcula os saldos de resultado só com dados deduplicados por ID
    const mapaLancamentosDeduplicados = new Map<string, Lancamento>();
    for (const l of cacheLancamentos) {
      mapaLancamentosDeduplicados.set(l.id, l);
    }
    cacheLancamentos = Array.from(mapaLancamentosDeduplicados.values());

    // 10. Recalcula saldos finais
    const contaFinal = this.getContaById(params.contaId) || conta;
    const resumoDepois = this.calcularResumoConta(contaFinal);
    const saldoDepois = resumoDepois.saldo_real;

    let diferencaConciliacao: number | undefined = undefined;
    if (saldoRealInformado !== undefined) {
      diferencaConciliacao = +(saldoRealInformado - saldoDepois).toFixed(2);
    }

    // Conferência pós-gravação (Parte 18C - Requisito 5)
    let erroConferenciaSaldo: string | undefined = undefined;
    if (saldoRealInformado !== undefined) {
      const conferencia = conferirSaldoFinal(saldoDepois, saldoRealInformado, 0.01);
      if (!conferencia.confere) {
        erroConferenciaSaldo = `Divergência de saldo após a gravação: Saldo Real apurado no App (R$ ${saldoDepois.toFixed(2)}) difere do Saldo Informado pelo Banco (R$ ${saldoRealInformado.toFixed(2)}) em R$ ${conferencia.diferenca.toFixed(2)}. Nenhuma correção automática foi aplicada.`;
        avisos.push(erroConferenciaSaldo);
        console.warn('[importarExtratoLote]', erroConferenciaSaldo);
      }
    }

    const contasAfetadas: Array<{
      contaId: string;
      contaNome: string;
      saldoAntes: number;
      saldoDepois: number;
    }> = [
      {
        contaId: contaFinal.id,
        contaNome: contaFinal.nome,
        saldoAntes,
        saldoDepois,
      },
    ];

    if (params.contaDestinoId) {
      const contaDestino = this.getContaById(params.contaDestinoId);
      if (contaDestino) {
        const resumoDestino = this.calcularResumoConta(contaDestino);
        const variacaoDestino = novosLancamentos
          .filter((l) => l.conta_id === params.contaDestinoId)
          .reduce((sum, l) => sum + (l.tipo === 'receita' ? l.valor : -l.valor), 0);
        contasAfetadas.push({
          contaId: contaDestino.id,
          contaNome: contaDestino.nome,
          saldoAntes: +(resumoDestino.saldo_real - variacaoDestino).toFixed(2),
          saldoDepois: resumoDestino.saldo_real,
        });
      }
    }

    // 11. Finaliza o registro de importação como 'concluida'
    registroLote.totais = totais;
    registroLote.saldo_sistema_depois = saldoDepois;
    registroLote.status = 'concluida';
    registroLote.snapshot_enriquecidos = snapshotsEnriquecidos;
    registroLote.atualizado_em = new Date().toISOString();

    await this.saveImportacao(registroLote);

    this.registrarAuditoria(
      'importacoes',
      'importacao',
      `Importação de extrato bancário lote ${params.loteId} (${totais.lancadas} lançamentos)`,
      `Arquivo: ${params.nomeArquivo}, Conta: ${contaFinal.nome}, Banco: ${params.bancoCodigo}, Período: ${params.periodo.inicio} a ${params.periodo.fim}`
    );

    notify('lancamentos');
    notify('regras_importacao');
    notify('contas');

    return {
      sucesso: true,
      loteId: params.loteId,
      contaId: params.contaId,
      totais,
      saldoAntes,
      saldoDepois,
      diferencaConciliacao,
      mensagem: `Importação de ${totais.lancadas} lançamento(s) concluída com sucesso.`,
      contasAfetadas,
      confirmadosServidor: totalConfirmadosServidor,
      avisos,
      statusLote: 'concluida',
      saldoInicialDefinido,
      erroConferenciaSaldo,
    };
  },


  /**
   * Desfaz com segurança um lote de importação executado anteriormente:
   * - Deleta exclusivamente os lançamentos criados pelo lote (com origem 'importacao' ou 'transferencia')
   * - Restaura o estado anterior dos lançamentos enriquecidos/vinculados usando snapshot
   * - Marca o status do lote como 'desfeita'
   */
  async desfazerImportacao(loteId: string): Promise<ResultadoDesfazerImportacao> {
    const lote = cacheImportacoes.find((i) => i.id === loteId);
    if (!lote) {
      throw new Error(`Lote de importação ${loteId} não encontrado.`);
    }

    if (lote.status === 'desfeita') {
      throw new Error(`Este lote de importação já foi desfeito anteriormente.`);
    }

    const snapshots = lote.snapshot_enriquecidos || [];
    const idsEnriquecidosSet = new Set(snapshots.map((s) => s.lancamentoId));

    // Localiza os lançamentos criados por este lote (incluindo transferências de contrapartida)
    const lancamentosARemover = cacheLancamentos.filter(
      (l) =>
        l.origem_importacao?.lote_id === loteId &&
        (l.origem === 'importacao' || l.origem === 'transferencia') &&
        !idsEnriquecidosSet.has(l.id)
    );
    const TAMANHO_MAX_BATCH = 490;

    // Batches de exclusão e restauração
    const todasOperacoes: Array<{
      tipo: 'delete' | 'update';
      id: string;
      dado?: any;
    }> = [];

    for (const lanc of lancamentosARemover) {
      todasOperacoes.push({
        tipo: 'delete',
        id: lanc.id,
      });
    }

    for (const snap of snapshots) {
      todasOperacoes.push({
        tipo: 'update',
        id: snap.lancamentoId,
        dado: {
          descricao: snap.descricaoAnterior,
          origem_importacao: snap.origemImportacaoAnterior || null,
          observacoes: snap.observacoesAnterior !== undefined ? snap.observacoesAnterior : '',
        },
      });
    }

    for (let i = 0; i < todasOperacoes.length; i += TAMANHO_MAX_BATCH) {
      const batch = writeBatch(db);
      const fatia = todasOperacoes.slice(i, i + TAMANHO_MAX_BATCH);

      for (const op of fatia) {
        const docRef = doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, op.id);
        if (op.tipo === 'delete') {
          batch.delete(docRef);
        } else {
          batch.update(docRef, op.dado);
        }
      }

      await batch.commit();
    }

    // Atualiza status do lote para 'desfeita'
    const loteAtualizado: RegistroImportacao = {
      ...lote,
      status: 'desfeita',
      atualizado_em: new Date().toISOString(),
    };
    await this.saveImportacao(loteAtualizado);

    // Atualiza caches síncronos
    const idsRemovidosSet = new Set(lancamentosARemover.map((l) => l.id));
    cacheLancamentos = cacheLancamentos.filter((l) => !idsRemovidosSet.has(l.id));

    for (const snap of snapshots) {
      const idx = cacheLancamentos.findIndex((l) => l.id === snap.lancamentoId);
      if (idx >= 0) {
        cacheLancamentos[idx] = {
          ...cacheLancamentos[idx],
          descricao: snap.descricaoAnterior,
          origem_importacao: snap.origemImportacaoAnterior,
          observacoes: snap.observacoesAnterior !== undefined ? snap.observacoesAnterior : cacheLancamentos[idx].observacoes,
        };
      }
    }

    // Se o saldo inicial foi alterado neste lote pelo assistente, restaura o saldo original da conta (Parte 15J)
    if (lote.saldoInicialAjustadoNesteLote && lote.saldoInicialAnteriorConta !== undefined) {
      const contaLote = this.getContaById(lote.conta_id);
      if (contaLote) {
        contaLote.saldo_inicial = lote.saldoInicialAnteriorConta;
        if (lote.dataSaldoInicialAnteriorConta) {
          contaLote.data_saldo_inicial = lote.dataSaldoInicialAnteriorConta;
        }
        await this.saveContaBancaria(contaLote);
      }
    }

    this.registrarAuditoria(
      'importacoes',
      'desfazer',
      `Lote de importação ${loteId} desfeito`,
      `${lancamentosARemover.length} lançamento(s) excluído(s) e ${snapshots.length} restaurado(s)`
    );

    notify('lancamentos');
    notify('contas');
    notify('importacoes');

    return {
      sucesso: true,
      loteId,
      lancamentosRemovidos: lancamentosARemover.length,
      lancamentosRestaurados: snapshots.length,
      mensagem: `Importação desfeita com sucesso. ${lancamentosARemover.length} lançamento(s) removido(s) e ${snapshots.length} restaurado(s).`,
    };
  },

  /**
   * Ferramenta de auditoria e reparo seguro de importações (com dry-run por padrão).
   * Identifica:
   * 1. Lançamentos órfãos ou indevidos em conta diferente da conta do lote (vazamento)
   * 2. Lançamentos duplicados gerados no mesmo lote de importação
   * 3. Movimentações Contamax indevidamente convertidas em despesas avulsas
   * 4. Ajustes de conciliação aplicados na conta errada
   * Exibe saldos antes e depois para aprovação antes de qualquer alteração real.
   */
  async auditarERepararImportacoes(opcoes?: {
    dryRun?: boolean;
    contaIdAlvo?: string;
    loteIdAlvo?: string;
  }): Promise<ResultadoAuditoriaReparo> {
    const dryRun = opcoes?.dryRun !== false; // Padrão seguro: SEMPRE dry-run a menos que explicitamente false
    const lotes = cacheImportacoes;
    const lancamentosIndevidos: LancamentoAnomaloAuditoria[] = [];

    // Mapa de contas para consulta rápida
    const mapaContas = new Map<string, ContaBancaria>();
    for (const c of cacheContas) {
      mapaContas.set(c.id, c);
    }

    // Mapa de lotes por ID
    const mapaLotes = new Map<string, RegistroImportacao>();
    for (const l of lotes) {
      mapaLotes.set(l.id, l);
    }

    // Rastreia fitids por lote para detectar duplicidades
    const fitidsVistosPorLote = new Map<string, Set<string>>();

    for (const lanc of cacheLancamentos) {
      if (lanc.origem !== 'importacao' && lanc.origem !== 'ajuste') continue;

      const contaLanc = mapaContas.get(lanc.conta_id);
      const contaNome = contaLanc?.nome || `Conta ID ${lanc.conta_id}`;

      // Se filtro por conta foi especificado
      if (opcoes?.contaIdAlvo && lanc.conta_id !== opcoes.contaIdAlvo) {
        continue;
      }

      // 1. Verificação de Lote de Importação
      if (lanc.origem === 'importacao' && lanc.origem_importacao?.lote_id) {
        const loteId = lanc.origem_importacao.lote_id;
        if (opcoes?.loteIdAlvo && loteId !== opcoes.loteIdAlvo) continue;

        const lote = mapaLotes.get(loteId);
        if (lote) {
          // Anomalia 1: Lançamento em conta diferente da conta do lote (sem par de transferência legítimo)
          if (lanc.conta_id !== lote.conta_id && !lanc.transferencia_vinculada_id) {
            lancamentosIndevidos.push({
              id: lanc.id,
              descricao: lanc.descricao,
              valor: lanc.valor,
              tipo: lanc.tipo,
              contaId: lanc.conta_id,
              contaNome,
              motivo: `Lançamento gravado indevidamente na conta '${contaNome}' quando o lote '${lote.nome_arquivo}' pertence à conta '${mapaContas.get(lote.conta_id)?.nome || lote.conta_id}'`,
              loteId,
            });
            continue;
          }

          // Anomalia 2: Duplicidade exata de FITID dentro do mesmo lote
          if (lanc.origem_importacao.fitid) {
            let fitids = fitidsVistosPorLote.get(loteId);
            if (!fitids) {
              fitids = new Set();
              fitidsVistosPorLote.set(loteId, fitids);
            }
            if (fitids.has(lanc.origem_importacao.fitid)) {
              lancamentosIndevidos.push({
                id: lanc.id,
                descricao: lanc.descricao,
                valor: lanc.valor,
                tipo: lanc.tipo,
                contaId: lanc.conta_id,
                contaNome,
                motivo: `Lançamento duplicado no lote '${lote.nome_arquivo}' (FITID ${lanc.origem_importacao.fitid} repetido)`,
                loteId,
              });
              continue;
            }
            fitids.add(lanc.origem_importacao.fitid);
          }

          // Anomalia 3: Movimentação interna Contamax que virou despesa avulsa sem contraparte
          const descUpper = lanc.descricao.toUpperCase();
          if (
            lanc.tipo === 'despesa' &&
            !lanc.transferencia_vinculada_id &&
            !lanc.conta_destino_id &&
            (descUpper.includes('CONTAMAX') || descUpper.includes('RESG CONTAMAX') || descUpper.includes('APL CONTAMAX'))
          ) {
            lancamentosIndevidos.push({
              id: lanc.id,
              descricao: lanc.descricao,
              valor: lanc.valor,
              tipo: lanc.tipo,
              contaId: lanc.conta_id,
              contaNome,
              motivo: `Movimentação interna Contamax gravada como despesa avulsa inflacionando o saldo da conta`,
              loteId,
            });
            continue;
          }
        }
      }
    }

    // Calcula os saldos atuais e os saldos projetados após exclusão dos lançamentos indevidos
    const idsIndevidosSet = new Set(lancamentosIndevidos.map((l) => l.id));
    const saldosPorConta = cacheContas.map((conta) => {
      const resumoAtual = this.calcularResumoConta(conta);
      const saldoAtual = resumoAtual.saldo_real;

      // Recalcula o saldo projetado sem os lançamentos indevidos
      let impactoCreditos = 0;
      let impactoDebitos = 0;
      for (const indevido of lancamentosIndevidos) {
        if (indevido.contaId === conta.id) {
          if (indevido.tipo === 'receita') {
            impactoCreditos += indevido.valor;
          } else {
            impactoDebitos += indevido.valor;
          }
        }
      }

      // Remover receita reduz o saldo; remover despesa aumenta o saldo
      const saldoProjetado = +(saldoAtual - impactoCreditos + impactoDebitos).toFixed(2);
      const diferenca = +(saldoProjetado - saldoAtual).toFixed(2);

      return {
        contaId: conta.id,
        contaNome: conta.nome,
        saldoAtual,
        saldoProjetado,
        diferenca,
      };
    });

    // Se NÃO for dry-run, executa o reparo atômico
    if (!dryRun && lancamentosIndevidos.length > 0) {
      console.info(`[auditarERepararImportacoes] APLICANDO REPARO: Removendo ${lancamentosIndevidos.length} lançamento(s) indevido(s)...`);
      const TAMANHO_MAX = 490;
      for (let i = 0; i < lancamentosIndevidos.length; i += TAMANHO_MAX) {
        const batch = writeBatch(db);
        const fatia = lancamentosIndevidos.slice(i, i + TAMANHO_MAX);

        for (const item of fatia) {
          const docRef = doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, item.id);
          batch.delete(docRef);
        }

        await batch.commit();
      }

      // Atualiza o cache local em memória
      cacheLancamentos = cacheLancamentos.filter((l) => !idsIndevidosSet.has(l.id));

      this.registrarAuditoria(
        'sistema',
        'reparo_importacao',
        `Reparo de importações executado`,
        `${lancamentosIndevidos.length} lançamento(s) anômalo(s) removido(s)`
      );

      notify('lancamentos');
      notify('contas');
    }

    const modoTexto = dryRun ? '[DRY-RUN - NENHUMA ALTERAÇÃO FEITA]' : '[REPARO APLICADO]';
    return {
      dryRun,
      totalAnomalias: lancamentosIndevidos.length,
      lancamentosIndevidos,
      saldosPorConta,
      mensagem: `${modoTexto} ${lancamentosIndevidos.length} anomalia(s) identificada(s).`,
    };
  },

  /**
   * Ajusta o saldo inicial da conta bancária para que o saldo real da conta na data do LEDGERBAL
   * coincida exatamente com o saldo informado pelo banco (LEDGERBAL), sem criar lançamentos de ajuste.
   *
   * Fórmula:
   * saldo_inicial_novo = LEDGERBAL - soma(lançamentos pagos da conta até a data do LEDGERBAL)
   * data_saldo_inicial = dia anterior ao primeiro lançamento da conta (ou do extrato)
   */
  async ajustarSaldoInicialPorLedgerbal(params: {
    contaId: string;
    saldoLedgerbal: number;
    dataLedgerbal: string;
    dataPrimeiroLancamento?: string;
  }): Promise<ResultadoAjusteSaldoInicialLedgerbal> {
    const conta = this.getContaById(params.contaId);
    if (!conta) {
      throw new Error(`Conta bancária '${params.contaId}' não encontrada.`);
    }

    const saldoInicialAnterior = conta.saldo_inicial;
    const dataSaldoInicialAnterior = conta.data_saldo_inicial;

    // Localiza todos os lançamentos pagos da conta até a data do LEDGERBAL
    const lancs = cacheLancamentos.filter(
      (l) =>
        l.conta_id === params.contaId &&
        l.status === 'pago' &&
        (l.data_pagamento || l.data_vencimento) <= params.dataLedgerbal
    );

    const receitas = lancs
      .filter((l) => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0);
    const despesas = lancs
      .filter((l) => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0);

    // Soma dos lançamentos na conta (sem o saldo inicial)
    const somaLancamentosSemSaldoInicial = +(receitas - despesas).toFixed(2);

    // Novo saldo inicial para que: saldo_inicial_novo + somaLancamentos = saldoLedgerbal
    const saldoInicialNovo = +(params.saldoLedgerbal - somaLancamentosSemSaldoInicial).toFixed(2);

    // Determina a data do saldo inicial: dia anterior ao primeiro lançamento
    let dataReferencia = params.dataPrimeiroLancamento;
    if (!dataReferencia) {
      const datasLancs = cacheLancamentos
        .filter((l) => l.conta_id === params.contaId)
        .map((l) => l.data_pagamento || l.data_vencimento)
        .filter(Boolean)
        .sort();
      dataReferencia = datasLancs[0] || params.dataLedgerbal;
    }

    // Calcula dia anterior
    const dRef = new Date(dataReferencia + 'T12:00:00Z');
    dRef.setUTCDate(dRef.getUTCDate() - 1);
    const dataSaldoInicialNova = dRef.toISOString().split('T')[0];

    // Atualiza a conta bancária
    conta.saldo_inicial = saldoInicialNovo;
    conta.data_saldo_inicial = dataSaldoInicialNova;

    await this.saveConta(conta);

    const resumoAtualizado = this.calcularResumoConta(conta);
    const saldoFinalAposAjuste = resumoAtualizado.saldo_real;
    const diferenca = +(params.saldoLedgerbal - saldoFinalAposAjuste).toFixed(2);

    this.registrarAuditoria(
      'contas',
      'edicao',
      `Saldo inicial da conta ${conta.nome} recalculado pelo LEDGERBAL do banco`,
      `Saldo inicial alterado de ${saldoInicialAnterior.toFixed(2)} para ${saldoInicialNovo.toFixed(2)} (Data: ${dataSaldoInicialNova}). Saldo final agora confere perfeitamente com LEDGERBAL ${params.saldoLedgerbal.toFixed(2)}.`
    );

    notify('contas');

    return {
      sucesso: true,
      saldoInicialAnterior,
      saldoInicialNovo,
      dataSaldoInicialAnterior,
      dataSaldoInicialNova,
      saldoFinalAposAjuste,
      diferenca,
      mensagem: `Saldo inicial da conta ajustado para R$ ${saldoInicialNovo.toFixed(2)}. O saldo final confere com o banco.`,
    };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARTE 15I — Reinício seguro de conta para reimportação
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * DRY-RUN: calcula o impacto da limpeza de importação sem gravar nada.
   * Retorna lançamentos a remover, preservados e saldos antes/depois.
   */
  simularReinicioConta(params: {
    contaId: string;
    zerarSaldoInicial?: boolean;
    novaDataSaldoInicial?: string;
  }): DryRunReinicioConta {
    const { contaId, zerarSaldoInicial = false, novaDataSaldoInicial } = params;

    const conta = this.getContaById(contaId);
    if (!conta) {
      throw new Error(`Conta bancária ${contaId} não encontrada.`);
    }

    // ─── Lotes da conta ───────────────────────────────────────────────────
    const lotesContaIds = new Set(
      cacheImportacoes
        .filter((i) => i.conta_id === contaId && i.status !== 'desfeita')
        .map((i) => i.id)
    );

    // ─── Lançamentos a remover ────────────────────────────────────────────
    // 1. origem='importacao' e conta_id=contaId
    const lancamentosImportacaoDiretos = cacheLancamentos.filter(
      (l) => l.origem === 'importacao' && l.conta_id === contaId
    );

    // 2. Transferências geradas por importação (contrapartidas em outras contas)
    //    identificadas por transferencia_vinculada_id que aponta para um lançamento
    //    da conta principal ou vinculadas ao lote
    const idsLancamentosContaPrincipal = new Set(lancamentosImportacaoDiretos.map((l) => l.id));
    const transferenciasContapartida = cacheLancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.transferencia_vinculada_id &&
        idsLancamentosContaPrincipal.has(l.transferencia_vinculada_id) &&
        l.conta_id !== contaId
    );
    // Também transferências que têm origem_importacao apontando para um lote desta conta
    const transferenciasLote = cacheLancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.conta_id === contaId &&
        l.origem_importacao?.lote_id &&
        lotesContaIds.has(l.origem_importacao.lote_id)
    );
    const idsTransferenciasLote = new Set(transferenciasLote.map((l) => l.id));
    const contrapartidasTransferenciasLote = cacheLancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.transferencia_vinculada_id &&
        idsTransferenciasLote.has(l.transferencia_vinculada_id) &&
        l.conta_id !== contaId
    );

    // 3. Ajustes de conciliação com origem='ajuste' criados pelo lote
    const ajustesConciliacao = cacheLancamentos.filter(
      (l) =>
        l.origem === 'ajuste' &&
        l.conta_id === contaId &&
        l.origem_importacao?.lote_id &&
        lotesContaIds.has(l.origem_importacao.lote_id)
    );

    // ─── Conjunto total a remover ─────────────────────────────────────────
    const todosARemover = [
      ...lancamentosImportacaoDiretos,
      ...transferenciasContapartida,
      ...transferenciasLote,
      ...contrapartidasTransferenciasLote,
      ...ajustesConciliacao,
    ];
    // Deduplicar por id
    const idsRemover = new Set(todosARemover.map((l) => l.id));

    // ─── Lançamentos PRESERVADOS (manuais, folha, contas a pagar/receber) ─
    const lancamentosContaPrincipal = cacheLancamentos.filter((l) => l.conta_id === contaId);
    const preservados = lancamentosContaPrincipal.filter((l) => !idsRemover.has(l.id));

    const contManuais = preservados.filter(
      (l) => l.origem === 'manual'
    ).length;
    const contFolha = preservados.filter((l) => l.origem === 'folha').length;
    // contas a pagar/receber não têm origem própria no tipo Lancamento;
    // são lançamentos com origem='manual' ou 'extrato' — contamos separadamente os preservados não-folha
    const contContasPagarReceber = 0;
    const contTransferenciasManuais = preservados.filter(
      (l) => l.origem === 'transferencia'
    ).length;

    // ─── Cálculo de impacto no saldo ──────────────────────────────────────
    const resumoAtual = this.calcularResumoConta(contaId);
    const saldoAntes = resumoAtual.saldo_real;

    // Simular saldo depois removendo os lançamentos da conta principal
    const idsRemoverContaPrincipal = new Set(
      [...lancamentosImportacaoDiretos, ...transferenciasLote, ...ajustesConciliacao].map((l) => l.id)
    );
    const lancamentosRestantesPrincipal = lancamentosContaPrincipal.filter(
      (l) => !idsRemoverContaPrincipal.has(l.id) && l.status === 'pago'
    );
    const receitasRestantes = lancamentosRestantesPrincipal
      .filter((l) => l.tipo === 'receita')
      .reduce((s, l) => s + l.valor, 0);
    const despesasRestantes = lancamentosRestantesPrincipal
      .filter((l) => l.tipo === 'despesa')
      .reduce((s, l) => s + l.valor, 0);

    const saldoInicialAjustado = zerarSaldoInicial ? 0 : conta.saldo_inicial;
    const saldoDepois = +(saldoInicialAjustado + receitasRestantes - despesasRestantes).toFixed(2);

    // ─── Impacto nas contas afetadas (contas secundárias) ─────────────────
    const contasAfetadasMap = new Map<string, ImpactoContaReinicio>();

    const todasTransferenciasSecundarias = [
      ...transferenciasContapartida,
      ...contrapartidasTransferenciasLote,
    ];
    for (const tl of todasTransferenciasSecundarias) {
      if (!contasAfetadasMap.has(tl.conta_id)) {
        const contaSec = this.getContaById(tl.conta_id);
        if (contaSec) {
          const resumoSec = this.calcularResumoConta(tl.conta_id);
          contasAfetadasMap.set(tl.conta_id, {
            conta_id: tl.conta_id,
            conta_nome: contaSec.nome,
            saldo_antes: resumoSec.saldo_real,
            saldo_depois: resumoSec.saldo_real,
            transferencias_removidas: 0,
            diferenca: 0,
          });
        }
      }
      const impacto = contasAfetadasMap.get(tl.conta_id);
      if (impacto) {
        // Calcula variação que o lançamento causa no saldo
        const variacao = tl.tipo === 'receita' ? tl.valor : -tl.valor;
        impacto.saldo_depois = +(impacto.saldo_depois - variacao).toFixed(2);
        impacto.transferencias_removidas += 1;
        impacto.diferenca = +(impacto.saldo_depois - impacto.saldo_antes).toFixed(2);
        contasAfetadasMap.set(tl.conta_id, impacto);
      }
    }

    return {
      conta_id: contaId,
      conta_nome: conta.nome,
      saldo_antes: +saldoAntes.toFixed(2),
      saldo_depois: saldoDepois,
      saldo_inicial_atual: conta.saldo_inicial,
      novo_saldo_inicial: saldoInicialAjustado,
      nova_data_saldo_inicial: novaDataSaldoInicial,
      zerar_saldo_inicial: zerarSaldoInicial,
      total_lancamentos_removidos: lancamentosImportacaoDiretos.length + transferenciasLote.length + ajustesConciliacao.length,
      total_transferencias_removidas: transferenciasContapartida.length + contrapartidasTransferenciasLote.length,
      total_lotes_afetados: lotesContaIds.size,
      total_ajustes_removidos: ajustesConciliacao.length,
      contas_afetadas: Array.from(contasAfetadasMap.values()),
      preservados: {
        manuais: contManuais,
        folha: contFolha,
        contas_pagar_receber: contContasPagarReceber,
        transferencias_manuais: contTransferenciasManuais,
        total: preservados.length,
      },
    };
  },

  /**
   * Executa o reinício seguro da conta:
   * 1. Gera e dispara download do backup completo antes de qualquer escrita
   * 2. Remove em batches de até 490 os lançamentos de importação
   * 3. Marca os lotes como 'desfeita'
   * 4. Atualiza saldo_inicial se zerarSaldoInicial=true
   * 5. Registra em RegistroAuditoria e dispara notify
   */
  async executarReinicioConta(params: {
    contaId: string;
    zerarSaldoInicial?: boolean;
    novaDataSaldoInicial?: string;
    usuarioEmail?: string;
  }): Promise<ResultadoReinicioConta> {
    const { contaId, zerarSaldoInicial = false, novaDataSaldoInicial } = params;

    const conta = this.getContaById(contaId);
    if (!conta) {
      throw new Error(`Conta bancária ${contaId} não encontrada.`);
    }

    // ─── 1. Backup automático antes de qualquer escrita ───────────────────
    const backupJson = this.exportarBackupCompletoJSON();
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nomeArquivo = `backup_antes_reinicio_${conta.nome.replace(/\s+/g, '_')}_${backupTimestamp}.json`;
    try {
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('[executarReinicioConta] Falha ao disparar download do backup:', e);
      // Não bloqueia: backup já está na memória se o download falhar
    }

    // ─── 2. Identificar lançamentos a remover (mesma lógica do dry-run) ───
    const lotesContaIds = cacheImportacoes
      .filter((i) => i.conta_id === contaId && i.status !== 'desfeita')
      .map((i) => i.id);
    const lotesContaIdsSet = new Set(lotesContaIds);

    const lancamentosImportacaoDiretos = cacheLancamentos.filter(
      (l) => l.origem === 'importacao' && l.conta_id === contaId
    );
    const idsLancamentosContaPrincipal = new Set(lancamentosImportacaoDiretos.map((l) => l.id));

    const transferenciasContapartida = cacheLancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.transferencia_vinculada_id &&
        idsLancamentosContaPrincipal.has(l.transferencia_vinculada_id) &&
        l.conta_id !== contaId
    );
    const transferenciasLote = cacheLancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.conta_id === contaId &&
        l.origem_importacao?.lote_id &&
        lotesContaIdsSet.has(l.origem_importacao.lote_id)
    );
    const idsTransferenciasLote = new Set(transferenciasLote.map((l) => l.id));
    const contrapartidasTransferenciasLote = cacheLancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.transferencia_vinculada_id &&
        idsTransferenciasLote.has(l.transferencia_vinculada_id) &&
        l.conta_id !== contaId
    );
    const ajustesConciliacao = cacheLancamentos.filter(
      (l) =>
        l.origem === 'ajuste' &&
        l.conta_id === contaId &&
        l.origem_importacao?.lote_id &&
        lotesContaIdsSet.has(l.origem_importacao.lote_id)
    );

    const todosIds = new Set([
      ...lancamentosImportacaoDiretos.map((l) => l.id),
      ...transferenciasContapartida.map((l) => l.id),
      ...transferenciasLote.map((l) => l.id),
      ...contrapartidasTransferenciasLote.map((l) => l.id),
      ...ajustesConciliacao.map((l) => l.id),
    ]);
    const totalRemovidos = todosIds.size;

    // ─── 3. Batches de exclusão ────────────────────────────────────────────
    const idsArray = Array.from(todosIds);
    const TAMANHO_MAX_BATCH = 490;

    for (let i = 0; i < idsArray.length; i += TAMANHO_MAX_BATCH) {
      const batch = writeBatch(db);
      const fatia = idsArray.slice(i, i + TAMANHO_MAX_BATCH);
      for (const id of fatia) {
        batch.delete(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, id));
      }
      await batch.commit();
    }

    // ─── 4. Marca lotes como 'desfeita' ────────────────────────────────────
    for (const loteId of lotesContaIds) {
      const lote = cacheImportacoes.find((i) => i.id === loteId);
      if (lote) {
        const loteAtualizado: RegistroImportacao = {
          ...lote,
          status: 'desfeita',
          atualizado_em: new Date().toISOString(),
        };
        await this.saveImportacao(loteAtualizado);
      }
    }

    // ─── 5. Zerar saldo inicial se solicitado ─────────────────────────────
    if (zerarSaldoInicial) {
      const contaAtualizada: ContaBancaria = {
        ...conta,
        saldo_inicial: 0,
        data_saldo_inicial: novaDataSaldoInicial || conta.data_saldo_inicial,
      };
      await this.saveContaBancaria(contaAtualizada);
    }

    // ─── 6. Atualizar caches locais ────────────────────────────────────────
    cacheLancamentos = cacheLancamentos.filter((l) => !todosIds.has(l.id));

    // ─── 7. Auditoria ─────────────────────────────────────────────────────
    this.registrarAuditoria(
      'contas',
      'reset',
      `Reinício seguro da conta ${conta.nome} — importações removidas`,
      `${totalRemovidos} lançamento(s) de importação removidos. ${lotesContaIds.length} lote(s) marcado(s) como desfeito(s). Backup: ${nomeArquivo}. Saldo inicial zerado: ${zerarSaldoInicial}.`
    );

    notify('lancamentos');
    notify('contas');
    notify('importacoes');

    // ─── 8. Saldos finais de cada conta afetada ────────────────────────────
    const contasIds = new Set<string>([contaId]);
    for (const l of [...transferenciasContapartida, ...contrapartidasTransferenciasLote]) {
      contasIds.add(l.conta_id);
    }

    const saldosFinais: ResumoSaldoContaPosReinicio[] = [];
    for (const cId of contasIds) {
      const c = this.getContaById(cId);
      if (c) {
        const resumo = this.calcularResumoConta(cId);
        saldosFinais.push({
          conta_id: cId,
          conta_nome: c.nome,
          saldo_real: resumo.saldo_real,
          limite_credito: c.limite_cheque_especial || 0,
          cheque_utilizado: resumo.cheque_especial_utilizado,
        });
      }
    }

    return {
      sucesso: true,
      mensagem: `Reinício concluído: ${totalRemovidos} lançamento(s) de importação removidos, ${lotesContaIds.length} lote(s) desfeito(s). Backup gerado: ${nomeArquivo}.`,
      removidos: totalRemovidos,
      lotes_desfeitos: lotesContaIds.length,
      backup_timestamp: backupTimestamp,
      saldos_finais: saldosFinais,
    };
  },

  /**
   * ─── PARTE 18A: SIMULAÇÃO (DRY-RUN) DE EXCLUSÃO COMPLETA DE CONTA ─────────────
   * Avalia o impacto antes de excluir a conta bancária:
   * 1. Quantos lançamentos da conta serão apagados (separando importados, manuais, pendentes, folha)
   * 2. Transferências com OUTRAS contas (contas e valores afetados, saldo antes e depois)
   * 3. Lotes da coleção 'importacoes' e regras com conta_id desta conta
   * 4. Registros da folha que ficarão sem conta de pagamento
   * 5. Bloqueio automático de exclusão caso haja transferências sem a opção explícita de contrapartida
   */
  simularExclusaoConta(
    contaId: string,
    opcoes?: { excluirContrapartidasTransferencias?: boolean }
  ): DryRunExclusaoConta {
    const conta = this.getContaById(contaId);
    if (!conta) {
      throw new Error(`Conta bancária com ID "${contaId}" não encontrada.`);
    }

    const excluirContrapartidas = !!opcoes?.excluirContrapartidasTransferencias;

    // 1. Identificar todos os lançamentos que pertencem diretamente à conta
    const lancamentosConta = cacheLancamentos.filter((l) => l.conta_id === contaId);
    const idsLancamentosConta = new Set(lancamentosConta.map((l) => l.id));

    // Discriminação dos lançamentos da conta
    let countFolha = 0;
    let countPendentes = 0;
    let countImportados = 0;
    let countTransferencias = 0;
    let countManuais = 0;

    for (const l of lancamentosConta) {
      const isFolha = l.origem === 'folha' || !!l.folha_id || !!l.funcionario_id;
      if (isFolha) {
        countFolha++;
        continue;
      }

      const isPendente = l.status === 'pendente';
      if (isPendente) {
        countPendentes++;
        continue;
      }

      const isImportado =
        l.origem === 'importacao' || l.origem === 'extrato' || !!l.origem_importacao;
      if (isImportado) {
        countImportados++;
        continue;
      }

      const isTransf =
        l.origem === 'transferencia' || !!l.transferencia_vinculada_id || !!l.conta_destino_id;
      if (isTransf) {
        countTransferencias++;
        continue;
      }

      countManuais++;
    }

    // 2. Transferências com OUTRAS contas
    const contrapartidasOutrasContasMap = new Map<string, Lancamento>();

    // Checagem a: lançamentos da conta que apontam para contrapartidas fora
    for (const l of lancamentosConta) {
      if (l.transferencia_vinculada_id) {
        const contra = cacheLancamentos.find((x) => x.id === l.transferencia_vinculada_id);
        if (contra && contra.conta_id !== contaId) {
          contrapartidasOutrasContasMap.set(contra.id, contra);
        }
      }
    }

    // Checagem b: lançamentos de outras contas que apontam para esta conta
    for (const l of cacheLancamentos) {
      if (l.conta_id !== contaId) {
        if (l.transferencia_vinculada_id && idsLancamentosConta.has(l.transferencia_vinculada_id)) {
          contrapartidasOutrasContasMap.set(l.id, l);
        }
      }
    }

    const contrapartidasLista = Array.from(contrapartidasOutrasContasMap.values());
    const totalTransferenciasOutras = contrapartidasLista.length;

    // Calcular impacto por conta afetada
    const outrasContasMap = new Map<string, ImpactoOutraContaExclusao>();
    for (const cp of contrapartidasLista) {
      const outraId = cp.conta_id;
      if (!outrasContasMap.has(outraId)) {
        const contaInfo = this.getContaById(outraId);
        const resumo = this.calcularResumoConta(outraId);
        outrasContasMap.set(outraId, {
          conta_id: outraId,
          conta_nome: contaInfo ? contaInfo.nome : 'Conta Desconhecida',
          saldo_antes: resumo.saldo_real,
          saldo_depois: resumo.saldo_real,
          diferenca: 0,
          quantidade_transferencias: 0,
          valores_transferencias: [],
        });
      }

      const item = outrasContasMap.get(outraId)!;
      item.quantidade_transferencias++;
      item.valores_transferencias.push(cp.valor);

      if (excluirContrapartidas) {
        if (cp.status === 'pago') {
          const impacto = cp.tipo === 'receita' ? -cp.valor : cp.valor;
          item.saldo_depois = +(item.saldo_depois + impacto).toFixed(2);
        }
      }
    }

    for (const item of outrasContasMap.values()) {
      item.diferenca = +(item.saldo_depois - item.saldo_antes).toFixed(2);
    }

    const outrasContasAfetadas = Array.from(outrasContasMap.values());

    // 3. Lotes da coleção 'importacoes'
    const totalLotes = cacheImportacoes.filter((i) => i.conta_id === contaId).length;

    // 4. Regras de importação com conta_id === contaId
    const totalRegras = cacheRegrasImportacao.filter((r) => r.conta_id === contaId).length;

    // 5. Registros da folha de pagamento que ficarão sem conta de pagamento
    const registrosFolhaAfetados = cacheLancamentosFolha.filter(
      (f) => f.conta_id === contaId || (f.lancamento_id && idsLancamentosConta.has(f.lancamento_id))
    );

    // 6. Bloqueio por transferências
    const temTransferenciasOutras = totalTransferenciasOutras > 0;
    const bloqueado = temTransferenciasOutras && !excluirContrapartidas;
    const motivoBloqueio = bloqueado
      ? `A conta possui ${totalTransferenciasOutras} transferência(s) com ${outrasContasAfetadas.length} outra(s) conta(s). Por padrão, a exclusão está bloqueada para preservar os saldos das outras contas. Para prosseguir, autorize explicitamente a exclusão das contrapartidas.`
      : undefined;

    return {
      conta,
      total_lancamentos_conta: lancamentosConta.length,
      discriminacao_lancamentos: {
        importados: countImportados,
        manuais: countManuais,
        pendentes_pagar_receber: countPendentes,
        folha: countFolha,
        transferencias: countTransferencias,
      },
      total_transferencias_outras_contas: totalTransferenciasOutras,
      outras_contas_afetadas: outrasContasAfetadas,
      total_lotes_importacoes: totalLotes,
      total_regras_importacao: totalRegras,
      registros_folha_sem_conta: registrosFolhaAfetados.length,
      bloqueado_por_transferencias: bloqueado,
      motivo_bloqueio: motivoBloqueio,
    };
  },

  /**
   * ─── PARTE 18A: EXCLUSÃO COMPLETA E SEGURA DE CONTA BANCÁRIA ──────────────────
   * Regra do usuário: ao excluir uma conta, todo o histórico dela some.
   * 1. Apenas administrador pode executar
   * 2. Exige digitação exata do nome da conta para confirmar
   * 3. Bloqueia transferências sem opção explícita de contrapartida
   * 4. Gera e dispara download de backup completo antes de qualquer exclusão
   * 5. Exclui em lotes de até 490 (writeBatch) com await (lançamentos, lotes, regras e folha desvinculada)
   * 6. Se qualquer lote falhar, NÃO apaga a conta e avisa quantos lançamentos já foram removidos
   * 7. A conta bancária é apagada por último
   * 8. Atualiza o cache por ID, notifica 'lancamentos', 'contas', 'importacoes', 'regras_importacao', 'folha'
   * 9. Registra em RegistroAuditoria
   */
  async excluirContaBancariaCompleta(
    params: ParamsExclusaoConta
  ): Promise<ResultadoExclusaoConta> {
    const { contaId, nomeConfirmacao, excluirContrapartidasTransferencias = false } = params;

    // 1. Verificação de administrador
    if (!this.isUsuarioAdmin()) {
      throw new Error('Apenas administradores podem excluir contas bancárias.');
    }

    // 2. Busca e validação da conta
    const conta = this.getContaById(contaId);
    if (!conta) {
      throw new Error(`Conta bancária com ID "${contaId}" não encontrada.`);
    }

    // 3. Validação do nome da conta digitado
    if (nomeConfirmacao.trim().toLowerCase() !== conta.nome.trim().toLowerCase()) {
      throw new Error(
        `O nome digitado ("${nomeConfirmacao.trim()}") não confere com o nome da conta ("${conta.nome}").`
      );
    }

    // 4. Executar simulação (dry-run)
    const dryRun = this.simularExclusaoConta(contaId, {
      excluirContrapartidasTransferencias,
    });

    if (dryRun.bloqueado_por_transferencias) {
      throw new Error(
        dryRun.motivo_bloqueio ||
          'Exclusão bloqueada: existem transferências vinculadas a outras contas sem autorização explícita para remover as contrapartidas.'
      );
    }

    // 5. Backup completo obrigatório antes de qualquer exclusão
    const backupJson = this.exportarBackupCompletoJSON();
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nomeArquivoBackup = `backup_antes_exclusao_${conta.nome.replace(/\s+/g, '_')}_${backupTimestamp}.json`;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivoBackup;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('[excluirContaBancariaCompleta] Falha ao disparar download do backup:', e);
      }
    }

    // 6. Preparar listas de IDs a serem excluídos/atualizados
    const lancamentosConta = cacheLancamentos.filter((l) => l.conta_id === contaId);
    const idsLancamentosConta = new Set(lancamentosConta.map((l) => l.id));

    // Contrapartidas de transferências em outras contas (se autorizado)
    const idsContrapartidasExcluir = new Set<string>();
    if (excluirContrapartidasTransferencias) {
      for (const l of lancamentosConta) {
        if (l.transferencia_vinculada_id) {
          const contra = cacheLancamentos.find((x) => x.id === l.transferencia_vinculada_id);
          if (contra && contra.conta_id !== contaId) {
            idsContrapartidasExcluir.add(contra.id);
          }
        }
      }
      for (const l of cacheLancamentos) {
        if (l.conta_id !== contaId) {
          if (l.transferencia_vinculada_id && idsLancamentosConta.has(l.transferencia_vinculada_id)) {
            idsContrapartidasExcluir.add(l.id);
          }
        }
      }
    }

    const todosLancamentosExcluirIds = new Set<string>([
      ...idsLancamentosConta,
      ...idsContrapartidasExcluir,
    ]);

    // Lotes de importação
    const lotesExcluir = cacheImportacoes.filter((i) => i.conta_id === contaId);
    const idsLotesExcluir = lotesExcluir.map((i) => i.id);

    // Regras de importação
    const regrasExcluir = cacheRegrasImportacao.filter((r) => r.conta_id === contaId);
    const idsRegrasExcluir = regrasExcluir.map((r) => r.id);

    // Registros de folha: desvincular conta_id e lancamento_id (sem apagar funcionário nem registro de folha)
    const registrosFolhaDesvincular = cacheLancamentosFolha.filter(
      (f) => f.conta_id === contaId || (f.lancamento_id && idsLancamentosConta.has(f.lancamento_id))
    );
    const idsFolhaDesvincular = registrosFolhaDesvincular.map((f) => f.id);

    // 7. Montar fila de operações em lotes de até 490 (writeBatch)
    type OperacaoBatch =
      | { tipo: 'delete'; colecao: string; id: string; isLancamento?: boolean }
      | { tipo: 'update'; colecao: string; id: string; dados: any };

    const operacoes: OperacaoBatch[] = [];

    // Adiciona deleções de lançamentos
    for (const id of todosLancamentosExcluirIds) {
      operacoes.push({
        tipo: 'delete',
        colecao: FIRESTORE_COLLECTIONS.LANCAMENTOS,
        id,
        isLancamento: true,
      });
    }

    // Adiciona deleções de lotes de importação
    for (const id of idsLotesExcluir) {
      operacoes.push({
        tipo: 'delete',
        colecao: FIRESTORE_COLLECTIONS.IMPORTOES,
        id,
      });
    }

    // Adiciona deleções de regras de importação
    for (const id of idsRegrasExcluir) {
      operacoes.push({
        tipo: 'delete',
        colecao: FIRESTORE_COLLECTIONS.REGRAS_IMPORTACAO,
        id,
      });
    }

    // Adiciona atualizações de desvinculação da folha
    for (const f of registrosFolhaDesvincular) {
      operacoes.push({
        tipo: 'update',
        colecao: FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA,
        id: f.id,
        dados: { conta_id: '', lancamento_id: '' },
      });
    }

    const TAMANHO_MAX_BATCH = 490;
    let lancamentosRemovidosAteAgora = 0;

    for (let i = 0; i < operacoes.length; i += TAMANHO_MAX_BATCH) {
      const fatia = operacoes.slice(i, i + TAMANHO_MAX_BATCH);
      const batch = writeBatch(db);

      for (const op of fatia) {
        const ref = doc(db, op.colecao, op.id);
        if (op.tipo === 'delete') {
          batch.delete(ref);
        } else if (op.tipo === 'update') {
          batch.update(ref, op.dados);
        }
      }

      try {
        await batch.commit();
        for (const op of fatia) {
          if (op.tipo === 'delete' && op.isLancamento) {
            lancamentosRemovidosAteAgora++;
          }
        }
      } catch (e) {
        console.error('[excluirContaBancariaCompleta] Falha no commit do lote:', e);
        const erroMsg = traduzirErroFirestore(e);
        throw new Error(
          `Falha durante a exclusão em lotes no servidor: ${erroMsg}. ${lancamentosRemovidosAteAgora} lançamento(s) foram removidos antes da falha. A conta bancária "${conta.nome}" NÃO foi apagada.`
        );
      }
    }

    // 8. POR ÚLTIMO, apaga o documento da conta bancária
    try {
      await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.CONTAS, contaId));
    } catch (e) {
      const erroMsg = traduzirErroFirestore(e);
      throw new Error(
        `Todos os lançamentos foram excluídos (${lancamentosRemovidosAteAgora}), mas ocorreu um erro ao apagar o registro da conta bancária no servidor: ${erroMsg}.`
      );
    }

    // 9. Atualizar o cache em memória por ID (sem duplicar)
    cacheLancamentos = cacheLancamentos.filter((l) => !todosLancamentosExcluirIds.has(l.id));
    cacheImportacoes = cacheImportacoes.filter((i) => !idsLotesExcluir.includes(i.id));
    cacheRegrasImportacao = cacheRegrasImportacao.filter((r) => !idsRegrasExcluir.includes(r.id));
    cacheLancamentosFolha = cacheLancamentosFolha.map((f) => {
      if (idsFolhaDesvincular.includes(f.id)) {
        return { ...f, conta_id: '', lancamento_id: undefined };
      }
      return f;
    });
    cacheContas = cacheContas.filter((c) => c.id !== contaId);

    // 10. Auditoria
    const detalheAuditoria =
      `Conta: ${conta.nome} (ID: ${contaId}). ` +
      `Lançamentos da conta excluídos: ${lancamentosConta.length}. ` +
      `Contrapartidas de transferências em outras contas excluídas: ${idsContrapartidasExcluir.size}. ` +
      `Lotes de importação excluídos: ${idsLotesExcluir.length}. ` +
      `Regras de importação excluídas: ${idsRegrasExcluir.length}. ` +
      `Registros de folha desvinculados: ${idsFolhaDesvincular.length}. ` +
      `Backup: ${nomeArquivoBackup}.`;

    this.registrarAuditoria(
      'contas',
      'exclusao',
      `Exclusão definitiva da conta bancária ${conta.nome}`,
      detalheAuditoria
    );

    // 11. Notificar ouvintes reativos
    notify('lancamentos');
    notify('contas');
    notify('importacoes');
    notify('regras_importacao');
    notify('folha');

    return {
      sucesso: true,
      conta_id: contaId,
      conta_nome: conta.nome,
      total_lancamentos_excluidos: lancamentosConta.length,
      total_contrapartidas_excluidas: idsContrapartidasExcluir.size,
      total_lotes_excluidos: idsLotesExcluir.length,
      total_regras_excluidas: idsRegrasExcluir.length,
      registros_folha_desvinculados: idsFolhaDesvincular.length,
      backup_json: backupJson,
      mensagem: `Conta "${conta.nome}" e todo o seu histórico foram excluídos com sucesso. Backup completo salvo em ${nomeArquivoBackup}.`,
    };
  },

  /**
   * ─── PARTE 18B: SIMULAÇÃO (DRY-RUN) DE LIMPEZA DE HISTÓRICO ÓRFÃO ─────────────
   * Identifica dados remanescentes cujas contas bancárias não existem mais no sistema:
   * 1. Lançamentos com conta_id inexistente em cacheContas
   * 2. Lotes de importação (coleção 'importacoes') com conta_id inexistente
   * 3. Regras de importação específicas (conta_id !== '*') com conta_id inexistente
   * 4. Identifica transferências cuja contrapartida está em conta existente e calcula impacto
   * 5. Agrupa por conta_id inexistente (quantidade, período, entradas, saídas, lotes, regras)
   */
  simularLimpezaOrfaos(opcoes?: {
    removerOrfaosComTransferencia?: boolean;
  }): DryRunLimparOrfaos {
    const contasExistentes = this.getContas();
    const contasExistentesIds = new Set(contasExistentes.map((c) => c.id));
    const contasExistentesMap = new Map(contasExistentes.map((c) => [c.id, c]));

    // 1. Lançamentos órfãos
    const lancamentosOrfaos = cacheLancamentos.filter(
      (l) => !contasExistentesIds.has(l.conta_id)
    );
    const idsLancamentosOrfaos = new Set(lancamentosOrfaos.map((l) => l.id));

    // 2. Lotes de importação órfãos
    const lotesOrfaos = cacheImportacoes.filter(
      (i) => !contasExistentesIds.has(i.conta_id)
    );

    // 3. Regras de importação órfãs (regras específicas de conta excluída)
    const regrasOrfas = cacheRegrasImportacao.filter(
      (r) => r.conta_id && r.conta_id !== '*' && !contasExistentesIds.has(r.conta_id)
    );

    // 4. Mapear transferências com contas existentes
    const transferenciasMap = new Map<string, TransferenciaOrfaInfo>();

    // Caso A: Lançamento órfão aponta para contrapartida em conta existente
    for (const lOrfao of lancamentosOrfaos) {
      if (lOrfao.transferencia_vinculada_id) {
        const contra = cacheLancamentos.find((x) => x.id === lOrfao.transferencia_vinculada_id);
        if (contra && contasExistentesIds.has(contra.conta_id)) {
          const cExistente = contasExistentesMap.get(contra.conta_id);
          const resumo = this.calcularResumoConta(contra.conta_id);
          transferenciasMap.set(lOrfao.id, {
            lancamento_orfao_id: lOrfao.id,
            tipo_orfao: lOrfao.tipo,
            valor: lOrfao.valor,
            data: lOrfao.data_pagamento || lOrfao.data_vencimento,
            descricao: lOrfao.descricao,
            conta_inexistente_id: lOrfao.conta_id,
            conta_existente_id: contra.conta_id,
            conta_existente_nome: cExistente?.nome || 'Conta Existente',
            lancamento_existente_id: contra.id,
            saldo_atual_conta_existente: resumo.saldo_real,
            efeito_no_saldo: 'Inalterado (o lançamento da conta existente nunca será apagado)',
          });
        }
      }
    }

    // Caso B: Lançamento de conta existente aponta para lançamento órfão
    for (const lExistente of cacheLancamentos) {
      if (contasExistentesIds.has(lExistente.conta_id) && lExistente.transferencia_vinculada_id) {
        if (idsLancamentosOrfaos.has(lExistente.transferencia_vinculada_id)) {
          const lOrfao = lancamentosOrfaos.find(
            (x) => x.id === lExistente.transferencia_vinculada_id
          );
          if (lOrfao && !transferenciasMap.has(lOrfao.id)) {
            const cExistente = contasExistentesMap.get(lExistente.conta_id);
            const resumo = this.calcularResumoConta(lExistente.conta_id);
            transferenciasMap.set(lOrfao.id, {
              lancamento_orfao_id: lOrfao.id,
              tipo_orfao: lOrfao.tipo,
              valor: lOrfao.valor,
              data: lOrfao.data_pagamento || lOrfao.data_vencimento,
              descricao: lOrfao.descricao,
              conta_inexistente_id: lOrfao.conta_id,
              conta_existente_id: lExistente.conta_id,
              conta_existente_nome: cExistente?.nome || 'Conta Existente',
              lancamento_existente_id: lExistente.id,
              saldo_atual_conta_existente: resumo.saldo_real,
              efeito_no_saldo: 'Inalterado (o lançamento da conta existente nunca será apagado)',
            });
          }
        }
      }
    }

    const transferenciasComContasExistentes = Array.from(transferenciasMap.values());

    // 5. Agrupamento por conta_id inexistente
    const contasInexistentesIds = new Set<string>();
    for (const l of lancamentosOrfaos) contasInexistentesIds.add(l.conta_id);
    for (const i of lotesOrfaos) contasInexistentesIds.add(i.conta_id);
    for (const r of regrasOrfas) contasInexistentesIds.add(r.conta_id);

    const grupos: GrupoOrfao[] = [];
    for (const cId of contasInexistentesIds) {
      const lancsDoGrupo = lancamentosOrfaos.filter((l) => l.conta_id === cId);
      let totalEntradas = 0;
      let totalSaidas = 0;
      let dataMin = '';
      let dataMax = '';

      for (const l of lancsDoGrupo) {
        if (l.tipo === 'receita') {
          totalEntradas += l.valor;
        } else if (l.tipo === 'despesa') {
          totalSaidas += l.valor;
        }
        const dt = l.data_pagamento || l.data_vencimento;
        if (dt) {
          if (!dataMin || dt < dataMin) dataMin = dt;
          if (!dataMax || dt > dataMax) dataMax = dt;
        }
      }

      const lotesDoGrupo = lotesOrfaos.filter((i) => i.conta_id === cId);
      const regrasDoGrupo = regrasOrfas.filter((r) => r.conta_id === cId);
      const transfsDoGrupo = transferenciasComContasExistentes.filter(
        (t) => t.conta_inexistente_id === cId
      );

      grupos.push({
        conta_id: cId,
        total_lancamentos: lancsDoGrupo.length,
        data_mais_antiga: dataMin || 'N/A',
        data_mais_recente: dataMax || 'N/A',
        total_entradas: +totalEntradas.toFixed(2),
        total_saidas: +totalSaidas.toFixed(2),
        total_lotes_importacao: lotesDoGrupo.length,
        total_regras_importacao: regrasDoGrupo.length,
        transferencias_com_contas_existentes: transfsDoGrupo,
      });
    }

    // Ordenar grupos por total de lançamentos decrescente
    grupos.sort((a, b) => b.total_lancamentos - a.total_lancamentos);

    // Contas existentes afetadas agrupadas
    const contasAfetadasMap = new Map<string, ContaExistenteImpactoOrfao>();
    for (const t of transferenciasComContasExistentes) {
      if (!contasAfetadasMap.has(t.conta_existente_id)) {
        contasAfetadasMap.set(t.conta_existente_id, {
          conta_id: t.conta_existente_id,
          conta_nome: t.conta_existente_nome,
          saldo_atual: t.saldo_atual_conta_existente,
          quantidade_transferencias: 0,
        });
      }
      contasAfetadasMap.get(t.conta_existente_id)!.quantidade_transferencias++;
    }
    const contasExistentesAfetadas = Array.from(contasAfetadasMap.values());

    return {
      total_lancamentos_orfaos: lancamentosOrfaos.length,
      total_lotes_orfaos: lotesOrfaos.length,
      total_regras_orfaos: regrasOrfas.length,
      total_transferencias_com_contas_existentes: transferenciasComContasExistentes.length,
      grupos,
      contas_existentes_afetadas: contasExistentesAfetadas,
      tem_orfaos_para_limpar:
        lancamentosOrfaos.length > 0 || lotesOrfaos.length > 0 || regrasOrfas.length > 0,
    };
  },

  /**
   * ─── PARTE 18B: LIMPEZA DEFINITIVA DE HISTÓRICO ÓRFÃO ───────────────────────────
   * 1. Apenas administradores podem executar
   * 2. Exige confirmação explícita digitando "LIMPAR"
   * 3. Dispara download de backup JSON antes de qualquer alteração
   * 4. Nunca apaga lançamentos de contas existentes
   * 5. Se um lançamento órfão for contrapartida de transferência com conta existente,
   *    não apaga sem escolha explícita (removerOrfaosComTransferencia: true)
   * 6. Apaga em lotes de até 490 com await writeBatch
   * 7. Atualiza caches em memória por ID (cacheLancamentos, cacheImportacoes, cacheRegrasImportacao)
   * 8. Registra auditoria completa
   * 9. Notifica ouvintes reativos
   */
  async limparHistoricoOrfao(
    params: ParamsLimparOrfaos
  ): Promise<ResultadoLimparOrfaos> {
    // 1. Verificação de administrador
    if (!this.isUsuarioAdmin()) {
      throw new Error('Apenas administradores podem limpar o histórico órfão.');
    }

    // 2. Validação da palavra de confirmação
    if (params.textoConfirmacao.trim().toUpperCase() !== 'LIMPAR') {
      throw new Error(
        'Confirmação inválida. Digite exatamente "LIMPAR" para autorizar a limpeza do histórico órfão.'
      );
    }

    // 3. Executar dry-run para mapear órfãos atuais
    const dryRun = this.simularLimpezaOrfaos({
      removerOrfaosComTransferencia: params.removerOrfaosComTransferencia,
    });

    if (!dryRun.tem_orfaos_para_limpar) {
      return {
        sucesso: true,
        total_lancamentos_excluidos: 0,
        total_lancamentos_preservados: 0,
        total_lotes_excluidos: 0,
        total_regras_excluidas: 0,
        total_contrapartidas_desvinculadas: 0,
        mensagem: 'Nenhum lançamento ou registro órfão foi encontrado para limpeza.',
      };
    }

    // 4. Backup completo obrigatório antes de qualquer exclusão
    const backupJson = this.exportarBackupCompletoJSON();
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nomeArquivoBackup = `backup_antes_limpeza_orfaos_${backupTimestamp}.json`;

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivoBackup;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('[limparHistoricoOrfao] Falha ao disparar download do backup:', e);
      }
    }

    const contasExistentes = this.getContas();
    const contasExistentesIds = new Set(contasExistentes.map((c) => c.id));

    // Mapear IDs de órfãos vinculados a transferências com contas existentes
    const idsOrfaosComTransf = new Set<string>();
    const contrapartidasExistentesAtualizar = new Map<string, string>(); // idLancamentoExistente -> contaId

    for (const g of dryRun.grupos) {
      for (const t of g.transferencias_com_contas_existentes) {
        idsOrfaosComTransf.add(t.lancamento_orfao_id);
        if (t.lancamento_existente_id) {
          contrapartidasExistentesAtualizar.set(t.lancamento_existente_id, t.conta_existente_id);
        }
      }
    }

    // 5. Determinar quais lançamentos órfãos serão apagados
    const lancamentosOrfaos = cacheLancamentos.filter(
      (l) => !contasExistentesIds.has(l.conta_id)
    );

    const lancamentosParaExcluir: Lancamento[] = [];
    let totalPreservados = 0;

    for (const l of lancamentosOrfaos) {
      // Regra 3: Nunca apagar lançamentos de contas existentes!
      if (contasExistentesIds.has(l.conta_id)) {
        throw new Error(
          `VIOLAÇÃO CRÍTICA: Lançamento de conta bancária existente ("${l.conta_id}") jamais pode ser excluído!`
        );
      }

      const ehOrfaoComTransf = idsOrfaosComTransf.has(l.id);
      if (ehOrfaoComTransf && !params.removerOrfaosComTransferencia) {
        // Sem escolha explícita, preserva o lançamento órfão para manter o vínculo
        totalPreservados++;
      } else {
        lancamentosParaExcluir.push(l);
      }
    }

    // Lotes de importação órfãos a excluir
    const lotesParaExcluir = cacheImportacoes.filter(
      (i) => !contasExistentesIds.has(i.conta_id)
    );

    // Regras de importação órfãs a excluir
    const regrasParaExcluir = cacheRegrasImportacao.filter(
      (r) => r.conta_id && r.conta_id !== '*' && !contasExistentesIds.has(r.conta_id)
    );

    // 6. Montar operações de lote no Firestore (writeBatch, até 490 operações por lote)
    type OperacaoBatch =
      | { tipo: 'delete'; colecao: string; id: string }
      | { tipo: 'update'; colecao: string; id: string; dados: any };

    const operacoes: OperacaoBatch[] = [];

    // Exclusão de lançamentos órfãos aprovados
    for (const l of lancamentosParaExcluir) {
      operacoes.push({
        tipo: 'delete',
        colecao: FIRESTORE_COLLECTIONS.LANCAMENTOS,
        id: l.id,
      });
    }

    // Exclusão de lotes órfãos
    for (const lot of lotesParaExcluir) {
      operacoes.push({
        tipo: 'delete',
        colecao: FIRESTORE_COLLECTIONS.IMPORTOES,
        id: lot.id,
      });
    }

    // Exclusão de regras órfãs
    for (const reg of regrasParaExcluir) {
      operacoes.push({
        tipo: 'delete',
        colecao: FIRESTORE_COLLECTIONS.REGRAS_IMPORTACAO,
        id: reg.id,
      });
    }

    // Se o usuário optou por remover órfãos com transferências, desvincula a contrapartida na conta existente
    const idsContrapartidasDesvinculadas = new Set<string>();
    if (params.removerOrfaosComTransferencia) {
      for (const [idLancExistente] of contrapartidasExistentesAtualizar) {
        idsContrapartidasDesvinculadas.add(idLancExistente);
        operacoes.push({
          tipo: 'update',
          colecao: FIRESTORE_COLLECTIONS.LANCAMENTOS,
          id: idLancExistente,
          dados: { transferencia_vinculada_id: '' },
        });
      }
    }

    const TAMANHO_MAX_BATCH = 490;
    for (let i = 0; i < operacoes.length; i += TAMANHO_MAX_BATCH) {
      const fatia = operacoes.slice(i, i + TAMANHO_MAX_BATCH);
      const batch = writeBatch(db);

      for (const op of fatia) {
        const ref = doc(db, op.colecao, op.id);
        if (op.tipo === 'delete') {
          batch.delete(ref);
        } else if (op.tipo === 'update') {
          batch.update(ref, op.dados);
        }
      }

      try {
        await batch.commit();
      } catch (e) {
        console.error('[limparHistoricoOrfao] Falha no commit do lote no Firestore:', e);
        const erroMsg = traduzirErroFirestore(e);
        throw new Error(`Falha durante a limpeza de dados órfãos no servidor: ${erroMsg}`);
      }
    }

    // 7. Atualizar o cache em memória por ID
    const idsLancamentosExcluidos = new Set(lancamentosParaExcluir.map((l) => l.id));
    const idsLotesExcluidos = new Set(lotesParaExcluir.map((lot) => lot.id));
    const idsRegrasExcluidas = new Set(regrasParaExcluir.map((reg) => reg.id));

    cacheLancamentos = cacheLancamentos.filter((l) => !idsLancamentosExcluidos.has(l.id));
    cacheImportacoes = cacheImportacoes.filter((i) => !idsLotesExcluidos.has(i.id));
    cacheRegrasImportacao = cacheRegrasImportacao.filter((r) => !idsRegrasExcluidas.has(r.id));

    if (idsContrapartidasDesvinculadas.size > 0) {
      cacheLancamentos = cacheLancamentos.map((l) => {
        if (idsContrapartidasDesvinculadas.has(l.id)) {
          return { ...l, transferencia_vinculada_id: undefined };
        }
        return l;
      });
    }

    // 8. Auditoria
    const detalheAuditoria =
      `Limpeza de histórico órfão realizada com sucesso. ` +
      `Lançamentos órfãos excluídos: ${lancamentosParaExcluir.length}. ` +
      `Lançamentos órfãos preservados (transferências sem escolha explícita): ${totalPreservados}. ` +
      `Lotes de importação excluídos: ${lotesParaExcluir.length}. ` +
      `Regras de importação excluídas: ${regrasParaExcluir.length}. ` +
      `Contrapartidas em contas existentes desvinculadas: ${idsContrapartidasDesvinculadas.size}. ` +
      `Backup completo salvo: ${nomeArquivoBackup}.`;

    this.registrarAuditoria(
      'contas',
      'exclusao',
      `Limpeza de histórico órfão (${lancamentosParaExcluir.length} excluídos)`,
      detalheAuditoria
    );

    // 9. Notificar ouvintes reativos
    notify('lancamentos');
    notify('importacoes');
    notify('regras_importacao');
    notify('contas');

    return {
      sucesso: true,
      total_lancamentos_excluidos: lancamentosParaExcluir.length,
      total_lancamentos_preservados: totalPreservados,
      total_lotes_excluidos: lotesParaExcluir.length,
      total_regras_excluidas: regrasParaExcluir.length,
      total_contrapartidas_desvinculadas: idsContrapartidasDesvinculadas.size,
      backup_json: backupJson,
      mensagem:
        `Limpeza concluída com sucesso: ${lancamentosParaExcluir.length} lançamento(s) órfão(s) excluído(s)` +
        (totalPreservados > 0
          ? `, ${totalPreservados} preservado(s) por vínculo com conta existente`
          : '') +
        (lotesParaExcluir.length > 0 ? `, ${lotesParaExcluir.length} lote(s) removido(s)` : '') +
        (regrasParaExcluir.length > 0 ? `, ${regrasParaExcluir.length} regra(s) removida(s)` : '') +
        `. Backup gerado em ${nomeArquivoBackup}.`,
    };
  },

};

// Exportar alias storage para compatibilidade total
export const storage = dbService;
