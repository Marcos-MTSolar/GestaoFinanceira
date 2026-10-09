import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
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
  RegistroAuditoria,
  AlertaItem,
} from '../types';

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

    let colecoesRestantes = 10;
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

  saveContaBancaria(conta: ContaBancaria): ContaBancaria {
    const docId = conta.id || `conta-${Date.now()}`;
    const item = { ...conta, id: docId, criado_em: conta.criado_em || new Date().toISOString() };

    setDoc(doc(db, FIRESTORE_COLLECTIONS.CONTAS, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveContaBancaria:', e)
    );

    const idx = cacheContas.findIndex((c) => c.id === docId);
    if (idx >= 0) cacheContas[idx] = item;
    else cacheContas.push(item);
    notify('contas');
    return item;
  },

  saveConta(conta: ContaBancaria): ContaBancaria {
    return this.saveContaBancaria(conta);
  },

  deleteContaBancaria(id: string): { sucesso: boolean; mensagem?: string } {
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

  saveLancamento(lancamento: Lancamento): Lancamento {
    const docId = lancamento.id || `lanc-${Date.now()}`;
    const item: Lancamento = {
      ...lancamento,
      id: docId,
      criado_em: lancamento.criado_em || new Date().toISOString(),
    };

    setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveLancamento:', e)
    );

    const idx = cacheLancamentos.findIndex((l) => l.id === docId);
    if (idx >= 0) cacheLancamentos[idx] = item;
    else cacheLancamentos.unshift(item);
    notify('lancamentos');
    return item;
  },

  deleteLancamento(id: string, _escopo: string = 'so_esta'): void {
    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS, id)).catch((e) =>
      console.warn('Erro async deleteLancamento:', e)
    );
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
    return this.saveLancamento(atualizado);
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
    return this.saveLancamento(atualizado);
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
    setDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA, docId), item, { merge: true }).catch((e) =>
      console.warn('Erro async saveLancamentoFolha:', e)
    );

    const idx = cacheLancamentosFolha.findIndex((f) => f.id === docId);
    if (idx >= 0) cacheLancamentosFolha[idx] = item;
    else cacheLancamentosFolha.push(item);
    notify('folha');
    return item;
  },

  deleteLancamentoFolha(id: string): void {
    deleteDoc(doc(db, FIRESTORE_COLLECTIONS.LANCAMENTOS_FOLHA, id)).catch((e) =>
      console.warn('Erro async deleteLancamentoFolha:', e)
    );
    cacheLancamentosFolha = cacheLancamentosFolha.filter((l) => l.id !== id);
    notify('folha');
  },

  liquidarLancamentoFolha(id: string, contaId: string, dataPagamento?: string): void {
    const folha = cacheLancamentosFolha.find((l) => l.id === id);
    if (!folha) return;
    const atualizado: LancamentoFolha = {
      ...folha,
      status: 'pago',
      conta_id: contaId,
      data_pagamento: dataPagamento || new Date().toISOString().split('T')[0],
    };
    this.saveLancamentoFolha(atualizado);
  },

  liquidarFolhaEmLote(folhaIds: string[], contaId: string, dataPagamento: string): { quitados: number; total: number } {
    let quitados = 0;
    for (const id of folhaIds) {
      this.liquidarLancamentoFolha(id, contaId, dataPagamento);
      quitados++;
    }
    return { quitados, total: folhaIds.length };
  },

  adicionarOcorrencia(funcionarioId: string, ocorrencia: OcorrenciaFuncionario): void {
    const func = this.getFuncionarioById(funcionarioId);
    if (!func) return;
    const ocorrencias = func.ocorrencias ? [ocorrencia, ...func.ocorrencias] : [ocorrencia];
    this.saveFuncionario({ ...func, ocorrencias });
  },

  gerarFolhaDoMes(competencia: string, dataVencimento: string, contaId: string): { gerados: number; totalValor: number } {
    const ativos = this.getFuncionarios().filter((f) => f.status === 'ativo');
    let gerados = 0;
    let totalValor = 0;

    for (const func of ativos) {
      const existe = cacheLancamentosFolha.some(
        (l) => l.funcionario_id === func.id && l.competencia === competencia && l.tipo === 'salario'
      );
      if (!existe) {
        const item: LancamentoFolha = {
          id: `folha-${Date.now()}-${func.id}`,
          funcionario_id: func.id,
          tipo: 'salario',
          descricao: `Salário Mensal ${func.cargo}`,
          competencia,
          valor: func.salario_base,
          tipo_operacao: 'provento',
          data_prevista: dataVencimento,
          data_pagamento: null,
          status: 'pendente',
          conta_id: contaId,
          criado_em: new Date().toISOString(),
        };
        this.saveLancamentoFolha(item);
        gerados++;
        totalValor += func.salario_base;
      }
    }
    return { gerados, totalValor };
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
        const at = mapaReceitas.get(l.categoria_id) || 0;
        mapaReceitas.set(l.categoria_id, at + l.valor);
        receitaTotal += l.valor;
      } else {
        const at = mapaDespesas.get(l.categoria_id) || 0;
        mapaDespesas.set(l.categoria_id, at + l.valor);
        despesaTotal += l.valor;
      }
    });

    const linhasReceitas = Array.from(mapaReceitas.entries())
      .map(([catId, val]) => {
        const cat = categorias.find((c) => c.id === catId);
        return {
          categoriaId: catId,
          nome: cat ? cat.nome : 'Outras Receitas',
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
          nome: cat ? cat.nome : 'Outras Despesas',
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

  gerarRelatorioFuncionariosFolha(ano?: number) {
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

    for (let m = 0; m < 12; m++) {
      const mesPad = String(m + 1).padStart(2, '0');
      const comp = `${mesPad}/${anoAlvo}`;
      const eventosMes = folha.filter((l) => l.competencia === comp);
      const proventos = eventosMes.filter((l) => l.tipo_operacao === 'provento').reduce((a, b) => a + b.valor, 0);
      const descontos = eventosMes.filter((l) => l.tipo_operacao === 'desconto').reduce((a, b) => a + b.valor, 0);
      const totalLiquido = Math.max(0, +(proventos - descontos).toFixed(2));

      folhaMensalAno.push({
        mesIndex: m + 1,
        mesNome: mesesNomes[m],
        rotulo: `${mesesNomes[m]}/${String(anoAlvo).slice(2)}`,
        competencia: comp,
        totalPago: eventosMes
          .filter((ev) => ev.status === 'pago')
          .reduce((acc, ev) => acc + (ev.tipo_operacao === 'provento' ? ev.valor : -ev.valor), 0),
        totalLiquido,
        quantidadeLancamentos: eventosMes.length,
      });
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
    const inssPatronal = isCLT ? +(remuneracaoBruta * ((f.inss_patronal_percentual || 0) / 100)).toFixed(2) : 0;
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
    let totalPagoMes = 0;
    let totalPagoAno = 0;

    todos.forEach((l) => {
      totaisPorTipo[l.tipo] = (totaisPorTipo[l.tipo] || 0) + l.valor;

      if (l.tipo === 'adiantamento' && !l.descontado_em_folha && l.status === 'pago') {
        saldoAdiantamentosAberto += l.valor;
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
};

// Exportar alias storage para compatibilidade total
export const storage = dbService;
