import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  BeneficioFuncionario,
  RegistroAuditoria,
  AlertaItem,
} from '../types';

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
};

// Subscrições internas
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

// Caches locais sincronizados em tempo real com o Firestore
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
let usuarioAtualCache: UsuarioAutorizado | null = null;

let isFirestoreInitialized = false;

// Inicialização dos Ouvintes em Tempo Real (onSnapshot) do Firestore
function initFirestoreListeners() {
  if (isFirestoreInitialized) return;
  isFirestoreInitialized = true;

  // 1. Contas Bancárias
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.CONTAS), (snapshot) => {
    cacheContas = snapshot.docs.map((docSnap) => docSnap.data() as ContaBancaria);
    notify('contas');
  }, (err) => console.warn('Erro onSnapshot contas:', err));

  // 2. Categorias
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.CATEGORIAS), (snapshot) => {
    cacheCategorias = snapshot.docs.map((docSnap) => docSnap.data() as Categoria);
    notify('categorias');
  }, (err) => console.warn('Erro onSnapshot categorias:', err));

  // 3. Contatos
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.CONTATOS), (snapshot) => {
    cacheContatos = snapshot.docs.map((docSnap) => docSnap.data() as Contato);
    notify('contatos');
  }, (err) => console.warn('Erro onSnapshot contatos:', err));

  // 4. Projetos
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.PROJETOS), (snapshot) => {
    cacheProjetos = snapshot.docs.map((docSnap) => docSnap.data() as Projeto);
    notify('projetos');
  }, (err) => console.warn('Erro onSnapshot projetos:', err));

  // 5. Lançamentos
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.LANCAMENTOS), (snapshot) => {
    cacheLancamentos = snapshot.docs.map((docSnap) => docSnap.data() as Lancamento);
    notify('lancamentos');
  }, (err) => console.warn('Erro onSnapshot lancamentos:', err));

  // 6. Usuários Autorizados
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.USUARIOS), (snapshot) => {
    cacheUsuarios = snapshot.docs.map((docSnap) => docSnap.data() as UsuarioAutorizado);
    notify('usuarios');
    notify('auth');
  }, (err) => console.warn('Erro onSnapshot usuarios:', err));

  // 7. Funcionários
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.FUNCIONARIOS), (snapshot) => {
    cacheFuncionarios = snapshot.docs.map((docSnap) => docSnap.data() as Funcionario);
    notify('funcionarios');
  }, (err) => console.warn('Erro onSnapshot funcionarios:', err));

  // 8. Lançamentos da Folha
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA), (snapshot) => {
    cacheLancamentosFolha = snapshot.docs.map((docSnap) => docSnap.data() as LancamentoFolha);
    notify('folha');
  }, (err) => console.warn('Erro onSnapshot folha:', err));

  // 9. Histórico de Auditoria
  onSnapshot(collection(db, FIRESTORE_COLLECTIONS.HISTORICO), (snapshot) => {
    cacheHistorico = snapshot.docs.map((docSnap) => docSnap.data() as RegistroAuditoria);
    notify('historico');
  }, (err) => console.warn('Erro onSnapshot historico:', err));

  // 10. Configurações da Empresa
  onSnapshot(doc(db, FIRESTORE_COLLECTIONS.CONFIGURACOES, 'empresa'), (docSnap) => {
    if (docSnap.exists()) {
      cacheConfiguracoes = docSnap.data() as ConfiguracoesEmpresa;
      notify('configuracoes');
    }
  }, (err) => console.warn('Erro onSnapshot configuracoes:', err));
}

// Inicia os listeners assim que o módulo é importado
initFirestoreListeners();

// Dados Padrão Iniciais (se o Firestore estiver vazio)
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

const CONTAS_PADRAO: ContaBancaria[] = [
  {
    id: 'conta-1',
    nome: 'Sicoob Conta PJ',
    banco: 'Sicoob',
    tipo: 'corrente',
    saldo_inicial: 35000.00,
    data_saldo_inicial: '2026-01-01',
    limite_cheque_especial: 25000.00,
    taxa_juros_cheque_especial_mensal: 7.9,
    cor: '#003064',
    ativa: true,
  },
  {
    id: 'conta-2',
    nome: 'Banco do Brasil - Financiamentos',
    banco: 'Banco do Brasil',
    tipo: 'corrente',
    saldo_inicial: 18450.00,
    data_saldo_inicial: '2026-01-01',
    limite_cheque_especial: 15000.00,
    taxa_juros_cheque_especial_mensal: 8.2,
    cor: '#FCBC00',
    ativa: true,
  },
  {
    id: 'conta-3',
    nome: 'Caixa Físico Operacional',
    banco: 'Caixa Interno',
    tipo: 'caixa_fisico',
    saldo_inicial: 2500.00,
    data_saldo_inicial: '2026-01-01',
    limite_cheque_especial: 0,
    taxa_juros_cheque_especial_mensal: 0,
    cor: '#16A34A',
    ativa: true,
  },
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
  // --- MODO DEMONSTRAÇÃO ---
  isModoDemonstracao(): boolean {
    return localStorage.getItem(STORAGE_KEYS.MODO_DEMO) === 'true';
  },

  setModoDemonstracao(ativo: boolean): void {
    localStorage.setItem(STORAGE_KEYS.MODO_DEMO, ativo ? 'true' : 'false');
    notify('auth');
  },

  async resetarDadosDemonstracao(): Promise<void> {
    localStorage.clear();
    notify('auth');
  },

  // --- USUÁRIO ATUAL DA SESSÃO ---
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

  // --- USUÁRIOS AUTORIZADOS (FIRESTORE) ---
  getUsuariosAutorizados(): UsuarioAutorizado[] {
    return cacheUsuarios;
  },

  async saveUsuarioAutorizado(usuario: UsuarioAutorizado): Promise<void> {
    const docId = usuario.email.toLowerCase();
    const docRef = doc(db, FIRESTORE_COLLECTIONS.USUARIOS, docId);
    await setDoc(docRef, { ...usuario, id: usuario.id || docId }, { merge: true });
    
    // Atualiza cache local imediatamente
    const idx = cacheUsuarios.findIndex((u) => u.email.toLowerCase() === docId);
    if (idx >= 0) {
      cacheUsuarios[idx] = { ...cacheUsuarios[idx], ...usuario };
    } else {
      cacheUsuarios.push({ ...usuario, id: usuario.id || docId });
    }
    notify('usuarios');
  },

  async deleteUsuarioAutorizado(idOuEmail: string): Promise<void> {
    const docId = idOuEmail.toLowerCase();
    const target = cacheUsuarios.find((u) => u.id === idOuEmail || u.email.toLowerCase() === docId);
    const idParaDeletar = target ? target.email.toLowerCase() : docId;

    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.USUARIOS, idParaDeletar));
    cacheUsuarios = cacheUsuarios.filter((u) => u.id !== idOuEmail && u.email.toLowerCase() !== docId);
    notify('usuarios');
  },

  // --- CONTAS BANCÁRIAS (FIRESTORE) ---
  getContasBancarias(): ContaBancaria[] {
    if (cacheContas.length === 0) return CONTAS_PADRAO;
    return cacheContas;
  },

  getContaById(id: string): ContaBancaria | undefined {
    return this.getContasBancarias().find((c) => c.id === id);
  },

  async saveContaBancaria(conta: ContaBancaria): Promise<void> {
    const docId = conta.id || `conta-${Date.now()}`;
    const item = { ...conta, id: docId, criado_em: conta.criado_em || new Date().toISOString() };
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTAS, docId), item, { merge: true });

    const idx = cacheContas.findIndex((c) => c.id === docId);
    if (idx >= 0) cacheContas[idx] = item;
    else cacheContas.push(item);
    notify('contas');
  },

  async deleteContaBancaria(id: string): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.CONTAS, id));
    cacheContas = cacheContas.filter((c) => c.id !== id);
    notify('contas');
  },

  // --- CATEGORIAS (FIRESTORE) ---
  getCategorias(): Categoria[] {
    if (cacheCategorias.length === 0) return CATEGORIAS_PADRAO;
    return cacheCategorias;
  },

  async saveCategoria(categoria: Categoria): Promise<void> {
    const docId = categoria.id || `cat-${Date.now()}`;
    const item = { ...categoria, id: docId };
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.CATEGORIAS, docId), item, { merge: true });

    const idx = cacheCategorias.findIndex((c) => c.id === docId);
    if (idx >= 0) cacheCategorias[idx] = item;
    else cacheCategorias.push(item);
    notify('categorias');
  },

  async deleteCategoria(id: string): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.CATEGORIAS, id));
    cacheCategorias = cacheCategorias.filter((c) => c.id !== id);
    notify('categorias');
  },

  // --- CONTATOS (FIRESTORE) ---
  getContatos(): Contato[] {
    return cacheContatos;
  },

  async saveContato(contato: Contato): Promise<void> {
    const docId = contato.id || `contato-${Date.now()}`;
    const item = { ...contato, id: docId };
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTATOS, docId), item, { merge: true });

    const idx = cacheContatos.findIndex((c) => c.id === docId);
    if (idx >= 0) cacheContatos[idx] = item;
    else cacheContatos.push(item);
    notify('contatos');
  },

  async deleteContato(id: string): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.CONTATOS, id));
    cacheContatos = cacheContatos.filter((c) => c.id !== id);
    notify('contatos');
  },

  // --- PROJETOS (FIRESTORE) ---
  getProjetos(): Projeto[] {
    return cacheProjetos;
  },

  async saveProjeto(projeto: Projeto): Promise<void> {
    const docId = projeto.id || `proj-${Date.now()}`;
    const item = { ...projeto, id: docId };
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.PROJETOS, docId), item, { merge: true });

    const idx = cacheProjetos.findIndex((p) => p.id === docId);
    if (idx >= 0) cacheProjetos[idx] = item;
    else cacheProjetos.push(item);
    notify('projetos');
  },

  async deleteProjeto(id: string): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.PROJETOS, id));
    cacheProjetos = cacheProjetos.filter((p) => p.id !== id);
    notify('projetos');
  },

  // --- LANÇAMENTOS COM FILTROS DE PERÍODO E PAGINAÇÃO (FIRESTORE) ---
  getLancamentos(filtros?: {
    dataInicio?: string;
    dataFim?: string;
    tipo?: string;
    conta_id?: string;
    pagina?: number;
    limite?: number;
  }): Lancamento[] {
    let lista = [...cacheLancamentos];

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

  async saveLancamento(lancamento: Lancamento): Promise<void> {
    const docId = lancamento.id || `lanc-${Date.now()}`;
    const item: Lancamento = {
      ...lancamento,
      id: docId,
      criado_em: lancamento.criado_em || new Date().toISOString(),
    };

    await setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, docId), item, { merge: true });

    const idx = cacheLancamentos.findIndex((l) => l.id === docId);
    if (idx >= 0) cacheLancamentos[idx] = item;
    else cacheLancamentos.push(item);
    notify('lancamentos');
  },

  async deleteLancamento(id: string): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, id));
    cacheLancamentos = cacheLancamentos.filter((l) => l.id !== id);
    notify('lancamentos');
  },

  async salvarLancamentoComRecorrencia(lancamento: Lancamento): Promise<void> {
    await this.saveLancamento(lancamento);
  },

  async excluirLancamentoERecorrencias(id: string): Promise<void> {
    const target = cacheLancamentos.find((l) => l.id === id);
    if (!target) return;

    if (target.grupo_recorrencia_id || target.grupo_parcelas_id) {
      const grupoId = target.grupo_recorrencia_id || target.grupo_parcelas_id;
      const vinculados = cacheLancamentos.filter(
        (l) => l.grupo_recorrencia_id === grupoId || l.grupo_parcelas_id === grupoId
      );
      for (const item of vinculados) {
        await this.deleteLancamento(item.id);
      }
    } else {
      await this.deleteLancamento(id);
    }
  },

  async pagarLancamento(id: string, dataPagamento: string, contaId?: string): Promise<void> {
    const target = cacheLancamentos.find((l) => l.id === id);
    if (!target) return;

    const atualizado: Lancamento = {
      ...target,
      status: 'pago',
      data_pagamento: dataPagamento,
      conta_id: contaId || target.conta_id,
    };
    await this.saveLancamento(atualizado);
  },

  async estornarLancamento(id: string): Promise<void> {
    const target = cacheLancamentos.find((l) => l.id === id);
    if (!target) return;

    const atualizado: Lancamento = {
      ...target,
      status: 'pendente',
      data_pagamento: null,
    };
    await this.saveLancamento(atualizado);
  },

  async realizarTransferencia(params: {
    contaOrigemId: string;
    contaDestinoId: string;
    valor: number;
    data: string;
    descricao?: string;
  }): Promise<void> {
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
      criado_em: new Date().toISOString(),
    };

    await this.saveLancamento(lancSaida);
    await this.saveLancamento(lancEntrada);
  },

  // --- CONFIGURAÇÕES DA EMPRESA (FIRESTORE) ---
  getConfiguracoes(): ConfiguracoesEmpresa {
    return cacheConfiguracoes || CONFIGURACAO_PADRAO;
  },

  async saveConfiguracoes(config: ConfiguracoesEmpresa): Promise<void> {
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONFIGURACOES, 'empresa'), config, { merge: true });
    cacheConfiguracoes = config;
    notify('configuracoes');
  },

  // --- FUNCIONÁRIOS DA MT SOLAR (FIRESTORE) ---
  getFuncionarios(): Funcionario[] {
    return cacheFuncionarios;
  },

  getFuncionarioById(id: string): Funcionario | undefined {
    return cacheFuncionarios.find((f) => f.id === id);
  },

  async saveFuncionario(funcionario: Funcionario): Promise<void> {
    const docId = funcionario.id || `func-${Date.now()}`;
    const item: Funcionario = {
      ...funcionario,
      id: docId,
      criado_em: funcionario.criado_em || new Date().toISOString(),
    };
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.FUNCIONARIOS, docId), item, { merge: true });

    const idx = cacheFuncionarios.findIndex((f) => f.id === docId);
    if (idx >= 0) cacheFuncionarios[idx] = item;
    else cacheFuncionarios.push(item);
    notify('funcionarios');
  },

  async deleteFuncionario(id: string): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.FUNCIONARIOS, id));
    cacheFuncionarios = cacheFuncionarios.filter((f) => f.id !== id);
    notify('funcionarios');
  },

  // --- LANÇAMENTOS DA FOLHA DE PAGAMENTO (FIRESTORE) ---
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

  async saveLancamentoFolha(lancamento: LancamentoFolha): Promise<void> {
    const docId = lancamento.id || `folha-${Date.now()}`;
    const item: LancamentoFolha = {
      ...lancamento,
      id: docId,
      criado_em: lancamento.criado_em || new Date().toISOString(),
    };
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA, docId), item, { merge: true });

    const idx = cacheLancamentosFolha.findIndex((f) => f.id === docId);
    if (idx >= 0) cacheLancamentosFolha[idx] = item;
    else cacheLancamentosFolha.push(item);
    notify('folha');
  },

  async deleteLancamentoFolha(id: string): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA, id));
    cacheLancamentosFolha = cacheLancamentosFolha.filter((f) => f.id !== id);
    notify('folha');
  },

  async gerarFolhaMes(competencia: string, contaIdPadrao: string): Promise<number> {
    const ativos = this.getFuncionarios().filter((f) => f.status === 'ativo');
    let contador = 0;

    for (const func of ativos) {
      const existe = cacheLancamentosFolha.some(
        (l) => l.funcionario_id === func.id && l.competencia === competencia && l.tipo === 'salario'
      );
      if (!existe) {
        const item: LancamentoFolha = {
          id: `folha-${Date.now()}-${func.id}`,
          funcionario_id: func.id,
          tipo: 'salario',
          descricao: `Salário Mensal (${competencia}) - ${func.nome}`,
          competencia,
          valor: func.salario_base,
          tipo_operacao: 'provento',
          data_prevista: new Date().toISOString().split('T')[0],
          data_pagamento: null,
          status: 'pendente',
          conta_id: contaIdPadrao,
          criado_em: new Date().toISOString(),
        };
        await this.saveLancamentoFolha(item);
        contador++;
      }
    }
    return contador;
  },

  // --- REGISTRO DE AUDITORIA (FIRESTORE) ---
  getHistoricoAuditoria(): RegistroAuditoria[] {
    return cacheHistorico;
  },

  async registrarAuditoria(modulo: any, acao: any, descricao: string, detalhes?: string): Promise<void> {
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
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.HISTORICO, docId), registro);
    cacheHistorico.unshift(registro);
    notify('historico');
  },

  // --- CÁLCULO DE SINALIZADORES E ALERTAS INTELIGENTES ---
  obterAlertas(): AlertaItem[] {
    const alertas: AlertaItem[] = [];
    const hoje = new Date().toISOString().split('T')[0];

    // Contas com saldo negativo ou cheque especial crítico
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

    // Títulos Vencidos e Vencendo Hoje
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

  calcularResumoConta(contaId: string): ResumoSaldoConta | null {
    const conta = this.getContaById(contaId);
    if (!conta) return null;

    const lancsConta = cacheLancamentos.filter((l) => l.conta_id === contaId && l.status === 'pago');
    const receitasPagas = lancsConta.filter((l) => l.tipo === 'receita').reduce((sum, l) => sum + l.valor, 0);
    const despesasPagas = lancsConta.filter((l) => l.tipo === 'despesa').reduce((sum, l) => sum + l.valor, 0);

    const saldoReal = conta.saldo_inicial + receitasPagas - despesasPagas;
    const limiteCheque = conta.limite_cheque_especial || 0;
    const saldoDisponivelTotal = saldoReal + limiteCheque;
    const chequeUtilizado = Math.max(0, -saldoReal);
    const chequeDisponivel = Math.max(0, limiteCheque - chequeUtilizado);
    const usandoCheque = saldoReal < 0 && limiteCheque > 0;
    const percentualUsado = limiteCheque > 0 ? (chequeUtilizado / limiteCheque) * 100 : 0;
    const alertaCritico = percentualUsado > 80;

    const taxaMensal = (conta.taxa_juros_cheque_especial_mensal || 0) / 100;
    const custoMensal = chequeUtilizado * taxaMensal;
    const custoDiario = custoMensal / 30;

    return {
      conta,
      saldo_inicial: conta.saldo_inicial,
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

  // --- MIGRAÇÃO: IMPORTAR DADOS LOCAIS DO LOCALSTORAGE PARA A NUVEM (FIRESTORE) ---
  async importarDadosLocaisParaNuvem(): Promise<{ sucesso: boolean; mensagem: string; itensImportados: number }> {
    try {
      let total = 0;

      // 1. Contas
      const rawContas = localStorage.getItem(STORAGE_KEYS.CONTAS);
      if (rawContas) {
        const contas: ContaBancaria[] = JSON.parse(rawContas);
        for (const item of contas) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTAS, item.id), item, { merge: true });
          total++;
        }
      }

      // 2. Categorias
      const rawCat = localStorage.getItem(STORAGE_KEYS.CATEGORIAS);
      if (rawCat) {
        const cats: Categoria[] = JSON.parse(rawCat);
        for (const item of cats) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.CATEGORIAS, item.id), item, { merge: true });
          total++;
        }
      }

      // 3. Contatos
      const rawContatos = localStorage.getItem(STORAGE_KEYS.CONTATOS);
      if (rawContatos) {
        const contatos: Contato[] = JSON.parse(rawContatos);
        for (const item of contatos) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTATOS, item.id), item, { merge: true });
          total++;
        }
      }

      // 4. Projetos
      const rawProjetos = localStorage.getItem(STORAGE_KEYS.PROJETOS);
      if (rawProjetos) {
        const projetos: Projeto[] = JSON.parse(rawProjetos);
        for (const item of projetos) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.PROJETOS, item.id), item, { merge: true });
          total++;
        }
      }

      // 5. Lançamentos
      const rawLanc = localStorage.getItem(STORAGE_KEYS.LANCAMENTOS);
      if (rawLanc) {
        const lancs: Lancamento[] = JSON.parse(rawLanc);
        for (const item of lancs) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, item.id), item, { merge: true });
          total++;
        }
      }

      // 6. Usuários Autorizados
      const rawUsers = localStorage.getItem(STORAGE_KEYS.USUARIOS);
      if (rawUsers) {
        const users: UsuarioAutorizado[] = JSON.parse(rawUsers);
        for (const item of users) {
          const docId = item.email.toLowerCase();
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.USUARIOS, docId), { ...item, id: docId }, { merge: true });
          total++;
        }
      }

      // 7. Funcionários
      const rawFunc = localStorage.getItem(STORAGE_KEYS.FUNCIONARIOS);
      if (rawFunc) {
        const funcs: Funcionario[] = JSON.parse(rawFunc);
        for (const item of funcs) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.FUNCIONARIOS, item.id), item, { merge: true });
          total++;
        }
      }

      // 8. Lançamentos Folha
      const rawFolha = localStorage.getItem(STORAGE_KEYS.LANCAMENTOS_FOLHA);
      if (rawFolha) {
        const folha: LancamentoFolha[] = JSON.parse(rawFolha);
        for (const item of folha) {
          await setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA, item.id), item, { merge: true });
          total++;
        }
      }

      // 9. Configurações
      const rawConfig = localStorage.getItem(STORAGE_KEYS.CONFIGURACOES);
      if (rawConfig) {
        const config: ConfiguracoesEmpresa = JSON.parse(rawConfig);
        await setDoc(doc(db, FIRESTORE_COLLECTIONS.CONFIGURACOES, 'empresa'), config, { merge: true });
        total++;
      }

      await this.registrarAuditoria(
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

  // --- MÉTODOS DE COMPATIBILIDADE E AUDITORIA ---
  getHistoricoAlteracoes(): RegistroAuditoria[] {
    return this.getHistoricoAuditoria();
  },

  async registrarAlteracao(modulo: any, acao: any, descricao: string, detalhes?: string): Promise<void> {
    await this.registrarAuditoria(modulo, acao, descricao, detalhes);
  },

  async limparHistoricoAlteracoes(): Promise<void> {
    for (const item of cacheHistorico) {
      try {
        await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.HISTORICO, item.id));
      } catch (e) {
        console.warn('Erro ao deletar item auditoria:', e);
      }
    }
    cacheHistorico = [];
    notify('historico');
  },

  carregarModoDemonstracao(): void {
    this.setModoDemonstracao(true);
  },

  limparDadosDemonstracao(): void {
    this.setModoDemonstracao(false);
  },

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
};

