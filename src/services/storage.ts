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
  AlertaItem
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

// Categorias padrão solicitadas para empresa de energia solar
const CATEGORIAS_PADRAO: Categoria[] = [
  // Receitas
  { id: 'cat-rec-1', nome: 'Venda de sistemas fotovoltaicos', tipo: 'receita', cor: '#16A34A', padrao: true },
  { id: 'cat-rec-2', nome: 'Instalação', tipo: 'receita', cor: '#0D9488', padrao: true },
  { id: 'cat-rec-3', nome: 'Manutenção/Limpeza', tipo: 'receita', cor: '#0284C7', padrao: true },
  { id: 'cat-rec-4', nome: 'Projeto e homologação', tipo: 'receita', cor: '#4F46E5', padrao: true },
  { id: 'cat-rec-5', nome: 'Outras receitas', tipo: 'receita', cor: '#65A30D', padrao: true },
  
  // Despesas
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

const CONTATOS_PADRAO: Contato[] = [
  {
    id: 'contato-1',
    nome: 'Aldo Solar Distribuidora',
    tipo: 'fornecedor',
    cpf_cnpj: '00.415.932/0001-99',
    telefone: '(44) 3032-9000',
    email: 'vendas@aldosolar.com.br',
    cidade: 'Maringá - PR',
  },
  {
    id: 'contato-2',
    nome: 'WEG Equipamentos Elétricos',
    tipo: 'fornecedor',
    cpf_cnpj: '84.450.844/0001-54',
    telefone: '(47) 3276-4000',
    email: 'solar@weg.net',
    cidade: 'Jaraguá do Sul - SC',
  },
  {
    id: 'contato-3',
    nome: 'Fazenda Boa Esperança (Dr. Carlos Mendes)',
    tipo: 'cliente',
    cpf_cnpj: '482.910.331-53',
    telefone: '(65) 99981-2244',
    email: 'carlos.mendes@fazendaboa.com.br',
    cidade: 'Sorriso - MT',
  },
  {
    id: 'contato-4',
    nome: 'Supermercado Central Solar',
    tipo: 'cliente',
    cpf_cnpj: '12.839.401/0001-82',
    telefone: '(65) 3544-1100',
    email: 'compras@supercentral.com.br',
    cidade: 'Cuiabá - MT',
  },
];

const PROJETOS_PADRAO: Projeto[] = [
  {
    id: 'proj-1',
    nome: 'Instalação 75 kWp – Fazenda Boa Esperança',
    cliente: 'Fazenda Boa Esperança (Dr. Carlos Mendes)',
    valor_contratado: 215000.00,
    potencia_kwp: 75.0,
    status: 'em_andamento',
    data_inicio: '2026-02-10',
    data_previsao_fim: '2026-04-15',
  },
  {
    id: 'proj-2',
    nome: 'Instalação 25 kWp – Supermercado Central',
    cliente: 'Supermercado Central Solar',
    valor_contratado: 89000.00,
    potencia_kwp: 25.0,
    status: 'em_andamento',
    data_inicio: '2026-03-01',
    data_previsao_fim: '2026-03-28',
  },
  {
    id: 'proj-3',
    nome: 'Homologação e Projeto 15 kWp – Residência Morada Nobre',
    cliente: 'Luciana Ferreira',
    valor_contratado: 48000.00,
    potencia_kwp: 15.0,
    status: 'concluido',
    data_inicio: '2026-01-15',
    data_previsao_fim: '2026-02-20',
  },
];

function dataRelativa(offsetDias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDias);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function mesRelativo(mesesAtras: number, diaDoMes: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - mesesAtras);
  d.setDate(diaDoMes);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function gerarLancamentosPadrao(): Lancamento[] {
  return [
    // HISTÓRICO DOS ÚLTIMOS 12 MESES (Para gráficos 6 e 12 meses)
    {
      id: 'lanc-hist-1',
      tipo: 'receita',
      descricao: 'Quitação Usina Solar 120 kWp Fazenda Primavera',
      valor: 82000.00,
      data_vencimento: mesRelativo(11, 15),
      data_pagamento: mesRelativo(11, 15),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2025-11-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-2',
      tipo: 'despesa',
      descricao: 'Lote 180 Módulos Canadian Solar 575W',
      valor: 54000.00,
      data_vencimento: mesRelativo(11, 20),
      data_pagamento: mesRelativo(11, 20),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-1',
      contato_id: 'contato-1',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2025-11-05T10:00:00Z',
    },
    {
      id: 'lanc-hist-3',
      tipo: 'receita',
      descricao: 'Entrada Sistema Comercial 50 kWp Centro Logístico',
      valor: 68000.00,
      data_vencimento: mesRelativo(10, 10),
      data_pagamento: mesRelativo(10, 10),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-4',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2025-12-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-4',
      tipo: 'despesa',
      descricao: '2x Inversores Deye 50kW Trifásicos',
      valor: 38200.00,
      data_vencimento: mesRelativo(10, 18),
      data_pagamento: mesRelativo(10, 18),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-1',
      contato_id: 'contato-2',
      forma_pagamento: 'boleto',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2025-12-05T10:00:00Z',
    },
    {
      id: 'lanc-hist-5',
      tipo: 'receita',
      descricao: 'Instalação & Homologação Usina Agro 80 kWp',
      valor: 89500.00,
      data_vencimento: mesRelativo(9, 12),
      data_pagamento: mesRelativo(9, 12),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-01-02T10:00:00Z',
    },
    {
      id: 'lanc-hist-6',
      tipo: 'despesa',
      descricao: 'Cabos e quadros de proteção CC/CA Schneider',
      valor: 46000.00,
      data_vencimento: mesRelativo(9, 22),
      data_pagamento: mesRelativo(9, 22),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-2',
      contato_id: 'contato-2',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-01-10T10:00:00Z',
    },
    {
      id: 'lanc-hist-7',
      tipo: 'receita',
      descricao: 'Venda Sistema Solar 35 kWp Frigorífico',
      valor: 74000.00,
      data_vencimento: mesRelativo(8, 14),
      data_pagamento: mesRelativo(8, 14),
      status: 'pago',
      conta_id: 'conta-2',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-4',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-02-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-8',
      tipo: 'despesa',
      descricao: 'Estruturas de solo monoposte para usina',
      valor: 41500.00,
      data_vencimento: mesRelativo(8, 25),
      data_pagamento: mesRelativo(8, 25),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-2',
      contato_id: 'contato-1',
      forma_pagamento: 'boleto',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-02-05T10:00:00Z',
    },
    {
      id: 'lanc-hist-9',
      tipo: 'receita',
      descricao: 'Projeto Fotovoltaico Condomínio Solar 60 kWp',
      valor: 91000.00,
      data_vencimento: mesRelativo(7, 10),
      data_pagamento: mesRelativo(7, 10),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-03-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-10',
      tipo: 'despesa',
      descricao: 'Lote Módulos Fotovoltaicos e Inversores WEG',
      valor: 58000.00,
      data_vencimento: mesRelativo(7, 20),
      data_pagamento: mesRelativo(7, 20),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-1',
      contato_id: 'contato-2',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-03-10T10:00:00Z',
    },
    {
      id: 'lanc-hist-11',
      tipo: 'receita',
      descricao: 'Contrato Usina Solar 75 kWp Fazenda Pantanal',
      valor: 98000.00,
      data_vencimento: mesRelativo(6, 8),
      data_pagamento: mesRelativo(6, 8),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-04-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-12',
      tipo: 'despesa',
      descricao: 'Folha e mão de obra terceirizada montagem',
      valor: 64200.00,
      data_vencimento: mesRelativo(6, 18),
      data_pagamento: mesRelativo(6, 18),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-04-05T10:00:00Z',
    },
    {
      id: 'lanc-hist-13',
      tipo: 'receita',
      descricao: 'Entrega Técnica Usina Solar Cooperativa 90 kWp',
      valor: 105000.00,
      data_vencimento: mesRelativo(5, 12),
      data_pagamento: mesRelativo(5, 12),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-4',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-05-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-14',
      tipo: 'despesa',
      descricao: 'Módulos Trina Solar 600W Vertex Bifacial',
      valor: 69000.00,
      data_vencimento: mesRelativo(5, 22),
      data_pagamento: mesRelativo(5, 22),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-1',
      contato_id: 'contato-1',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-05-10T10:00:00Z',
    },
    {
      id: 'lanc-hist-15',
      tipo: 'receita',
      descricao: 'Entrada 3 Sistemas Comerciais 20 kWp',
      valor: 86000.00,
      data_vencimento: mesRelativo(4, 15),
      data_pagamento: mesRelativo(4, 15),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-4',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-06-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-16',
      tipo: 'despesa',
      descricao: 'Materiais Elétricos, Disjuntores e Caixas DPS',
      valor: 52000.00,
      data_vencimento: mesRelativo(4, 25),
      data_pagamento: mesRelativo(4, 25),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-2',
      contato_id: 'contato-2',
      forma_pagamento: 'boleto',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-06-10T10:00:00Z',
    },
    {
      id: 'lanc-hist-17',
      tipo: 'receita',
      descricao: 'Quitação Usina Fotovoltaica Agro 65 kWp',
      valor: 92000.00,
      data_vencimento: mesRelativo(3, 10),
      data_pagamento: mesRelativo(3, 10),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-07-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-18',
      tipo: 'despesa',
      descricao: 'Inversores Sungrow e Módulos Canadian Solar',
      valor: 59800.00,
      data_vencimento: mesRelativo(3, 20),
      data_pagamento: mesRelativo(3, 20),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-1',
      contato_id: 'contato-1',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-07-10T10:00:00Z',
    },
    {
      id: 'lanc-hist-19',
      tipo: 'receita',
      descricao: 'Venda e Homologação Sistema Solar 45 kWp',
      valor: 87500.00,
      data_vencimento: mesRelativo(2, 14),
      data_pagamento: mesRelativo(2, 14),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-08-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-20',
      tipo: 'despesa',
      descricao: 'Mão de obra de instalação e engenharia de projetos',
      valor: 54300.00,
      data_vencimento: mesRelativo(2, 26),
      data_pagamento: mesRelativo(2, 26),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-08-10T10:00:00Z',
    },
    {
      id: 'lanc-hist-21',
      tipo: 'receita',
      descricao: 'Entrada Usina Fazenda Boa Esperança 75 kWp',
      valor: 75000.00,
      data_vencimento: mesRelativo(1, 10),
      data_pagamento: mesRelativo(1, 10),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-09-01T10:00:00Z',
    },
    {
      id: 'lanc-hist-22',
      tipo: 'despesa',
      descricao: 'Estruturas de fixação e trilhos de alumínio Solar',
      valor: 48900.00,
      data_vencimento: mesRelativo(1, 18),
      data_pagamento: mesRelativo(1, 18),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-2',
      contato_id: 'contato-1',
      forma_pagamento: 'boleto',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-09-05T10:00:00Z',
    },
    {
      id: 'lanc-hist-23',
      tipo: 'despesa',
      descricao: 'Folha de pagamento & encargos colaboradores',
      valor: 33920.00,
      data_vencimento: mesRelativo(1, 5),
      data_pagamento: mesRelativo(1, 5),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-4',
      forma_pagamento: 'transferencia',
      recorrencia: 'mensal',
      origem: 'folha',
      criado_em: '2026-09-01T10:00:00Z',
    },

    // MÊS ATUAL (Lançamentos já pagos nos últimos dias)
    {
      id: 'lanc-mes-1',
      tipo: 'receita',
      descricao: '1ª Parcela Usina 50 kWp Agroindústria',
      valor: 45000.00,
      data_vencimento: dataRelativa(-5),
      data_pagamento: dataRelativa(-5),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },
    {
      id: 'lanc-mes-2',
      tipo: 'despesa',
      descricao: 'Folha de Pagamento Salários Equipe de Campo',
      valor: 26500.00,
      data_vencimento: dataRelativa(-2),
      data_pagamento: dataRelativa(-2),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-4',
      forma_pagamento: 'transferencia',
      recorrencia: 'mensal',
      origem: 'folha',
      criado_em: '2026-10-01T10:00:00Z',
    },
    {
      id: 'lanc-mes-3',
      tipo: 'despesa',
      descricao: 'Encargos FGTS (8%) e INSS (20%) Folha',
      valor: 7420.00,
      data_vencimento: dataRelativa(-1),
      data_pagamento: dataRelativa(-1),
      status: 'pago',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-5',
      forma_pagamento: 'PIX',
      recorrencia: 'mensal',
      origem: 'folha',
      criado_em: '2026-10-01T10:00:00Z',
    },
    {
      id: 'lanc-mes-4',
      tipo: 'receita',
      descricao: 'Homologação e Parecer de Acesso Energisa MT',
      valor: 14800.00,
      data_vencimento: dataRelativa(-1),
      data_pagamento: dataRelativa(-1),
      status: 'pago',
      conta_id: 'conta-2',
      categoria_id: 'cat-rec-4',
      contato_id: 'contato-4',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-10-02T10:00:00Z',
    },

    // CONTAS ATRASADAS (Vencidas e pendentes)
    {
      id: 'lanc-pend-atrasada-1',
      tipo: 'despesa',
      descricao: 'Aluguel do Galpão e Escritório Central MT Solar',
      valor: 4200.00,
      data_vencimento: dataRelativa(-6), // 6 dias atrasada
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-8',
      forma_pagamento: 'boleto',
      recorrencia: 'mensal',
      observacoes: 'Boleto Pantanal Empreendimentos',
      origem: 'manual',
      criado_em: '2026-09-25T10:00:00Z',
    },
    {
      id: 'lanc-pend-atrasada-2',
      tipo: 'despesa',
      descricao: 'Revisão e Manutenção Veículos da Frota Solar (Pickups)',
      valor: 3150.00,
      data_vencimento: dataRelativa(-3), // 3 dias atrasada
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-6',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      observacoes: 'Oficina Central Diesel',
      origem: 'manual',
      criado_em: '2026-09-28T10:00:00Z',
    },
    {
      id: 'lanc-pend-atrasada-3',
      tipo: 'receita',
      descricao: 'Manutenção e Lavagem Técnica de Painéis (Cliente Rural)',
      valor: 6800.00,
      data_vencimento: dataRelativa(-4), // 4 dias atrasada
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-3',
      contato_id: 'contato-3',
      forma_pagamento: 'boleto',
      recorrencia: 'nenhuma',
      observacoes: 'Cliente solicitou prorrogação para próxima semana',
      origem: 'manual',
      criado_em: '2026-09-20T10:00:00Z',
    },

    // VENCE HOJE (Dia 0)
    {
      id: 'lanc-pend-hoje-1',
      tipo: 'despesa',
      descricao: 'Disjuntores em Caixa Moldada CC e Cabos Solares 6mm²',
      valor: 2850.00,
      data_vencimento: dataRelativa(0),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-2',
      contato_id: 'contato-2',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      observacoes: 'Entrega na obra às 14h',
      origem: 'manual',
      criado_em: '2026-10-02T10:00:00Z',
    },

    // PRÓXIMOS 7 DIAS
    {
      id: 'lanc-pend-7d-1',
      tipo: 'receita',
      descricao: '1ª Parcela Usina 45 kWp Supermercado Pantanal',
      valor: 38500.00,
      data_vencimento: dataRelativa(3),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-4',
      forma_pagamento: 'PIX',
      recorrencia: 'parcelado',
      parcela_atual: 1,
      total_parcelas: 3,
      grupo_parcelas_id: 'grp-pantanal-45k',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },
    {
      id: 'lanc-pend-7d-2',
      tipo: 'despesa',
      descricao: 'Equipe Terceirizada de Montagem Mecânica e Estruturas',
      valor: 14200.00,
      data_vencimento: dataRelativa(5),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-3',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },

    // PRÓXIMOS 30 DIAS (Com evento programado que dispara o Cheque Especial para o gráfico de projeção!)
    {
      id: 'lanc-pend-30d-1',
      tipo: 'receita',
      descricao: 'Entrada Projeto Solar Residencial Luxo 15 kWp',
      valor: 22000.00,
      data_vencimento: dataRelativa(11),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-2',
      categoria_id: 'cat-rec-1',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-10-02T10:00:00Z',
    },
    {
      id: 'lanc-pend-30d-critica',
      tipo: 'despesa',
      descricao: 'Lote 160 Módulos Canadian Solar 585W e 2 Inversores Deye 50kW',
      valor: 78500.00, // Valor substancial para compra de estoque fotovoltaico
      data_vencimento: dataRelativa(16), // No dia +16 o saldo ficará negativo
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-1',
      contato_id: 'contato-1',
      forma_pagamento: 'boleto',
      recorrencia: 'nenhuma',
      observacoes: 'Faturamento direto distribuidora - Requer saldo ou limite',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },
    {
      id: 'lanc-pend-30d-recupera',
      tipo: 'receita',
      descricao: 'Quitação Final Usina Solar 75 kWp Fazenda Boa Esperança',
      valor: 70000.00, // Recupera o saldo no dia +24
      data_vencimento: dataRelativa(24),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      projeto_id: 'proj-1',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },

    // FUTUROS (60 e 90 dias)
    {
      id: 'lanc-pend-fut-1',
      tipo: 'despesa',
      descricao: 'Seguro Empresarial e Responsabilidade Civil MT Solar',
      valor: 18500.00,
      data_vencimento: dataRelativa(42),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-12',
      forma_pagamento: 'boleto',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },
    {
      id: 'lanc-pend-fut-2',
      tipo: 'receita',
      descricao: '2ª Parcela Usina Agro 90 kWp Grupo Bom Futuro',
      valor: 85000.00,
      data_vencimento: dataRelativa(55),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      contato_id: 'contato-3',
      forma_pagamento: 'PIX',
      recorrencia: 'parcelado',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },
    {
      id: 'lanc-pend-fut-3',
      tipo: 'despesa',
      descricao: 'Lote Transformadores e Cabos de Média Tensão 15kV',
      valor: 34000.00,
      data_vencimento: dataRelativa(72),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-des-2',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },
    {
      id: 'lanc-pend-fut-4',
      tipo: 'receita',
      descricao: 'Saldo Final e Entrega Homologada Usina 90 kWp',
      valor: 65000.00,
      data_vencimento: dataRelativa(85),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      categoria_id: 'cat-rec-1',
      forma_pagamento: 'PIX',
      recorrencia: 'nenhuma',
      origem: 'manual',
      criado_em: '2026-10-01T10:00:00Z',
    },
  ];
}

const LANCAMENTOS_PADRAO: Lancamento[] = gerarLancamentosPadrao();

export const FUNCIONARIOS_PADRAO: Funcionario[] = [
  {
    id: 'func-1',
    nome: 'Carlos Eduardo Souza',
    cpf: '381.920.481-22',
    rg: '12.384.920-1 SSP/MT',
    data_nascimento: '1990-05-14',
    telefone: '(65) 99812-4040',
    email: 'carlos.instalador@mtsolar.com.br',
    endereco: 'Rua das Acácias, 450 - CPA II, Cuiabá - MT',
    contato_emergencia_nome: 'Marinalva Souza (Esposa)',
    contato_emergencia_telefone: '(65) 99611-3030',
    cargo: 'Instalador Fotovoltaico Líder',
    setor: 'Instalação',
    tipo_contrato: 'CLT',
    data_admissao: '2024-03-10',
    data_desligamento: null,
    status: 'ativo',
    carga_horaria: '44h semanais',
    ctps_pis: 'CTPS 48291/0023 - PIS 128.49201.39-2',
    salario_base: 3800.00,
    forma_remuneracao: 'mensal',
    dia_pagamento: 5,
    comissao_tipo: 'fixo',
    comissao_valor: 0,
    adicional_tipo: 'periculosidade',
    adicional_percentual: 30.0,
    adicional_valor_fixo: 0,
    beneficios: [
      { id: 'ben-1-1', nome: 'Vale-Alimentação / Refeição', valor: 450.00 },
      { id: 'ben-1-2', nome: 'Vale-Transporte', valor: 220.00 },
    ],
    inss_patronal_percentual: 20.0,
    fgts_percentual: 8.0,
    provisao_ferias_percentual: 11.11,
    provisao_13_percentual: 8.33,
    outros_encargos_percentual: 0,
    banco: 'Sicoob',
    agencia: '3008',
    conta: '12890-4',
    tipo_chave_pix: 'cpf',
    chave_pix: '381.920.481-22',
    observacoes: 'Certificações NR-10 e NR-35 em dia. Líder de equipe de campo.',
    ocorrencias: [
      {
        id: 'oc-1',
        data: '2026-04-12',
        tipo: 'elogio',
        descricao: 'Conclusão da montagem da Usina Fazenda Boa Esperança 3 dias antes do prazo sem intercorrências.',
        registrado_em: '2026-04-12T14:00:00Z',
      }
    ],
    criado_em: '2024-03-10T08:00:00Z',
  },
  {
    id: 'func-2',
    nome: 'Rodrigo Mendes Lima',
    cpf: '492.831.029-33',
    rg: '14.920.111-8 SSP/MT',
    data_nascimento: '1993-08-22',
    telefone: '(65) 99234-8899',
    email: 'rodrigo.mendes@mtsolar.com.br',
    endereco: 'Av. Brasil, 820 - Morada da Serra, Cuiabá - MT',
    contato_emergencia_nome: 'Sandra Lima (Mãe)',
    contato_emergencia_telefone: '(65) 98411-2200',
    cargo: 'Eletricista Instalador de Usinas',
    setor: 'Instalação',
    tipo_contrato: 'CLT',
    data_admissao: '2024-06-15',
    data_desligamento: null,
    status: 'ativo',
    carga_horaria: '44h semanais',
    ctps_pis: 'CTPS 59201/0011 - PIS 139.50291.12-3',
    salario_base: 3200.00,
    forma_remuneracao: 'mensal',
    dia_pagamento: 5,
    comissao_tipo: 'fixo',
    comissao_valor: 0,
    adicional_tipo: 'periculosidade',
    adicional_percentual: 30.0,
    adicional_valor_fixo: 0,
    beneficios: [
      { id: 'ben-2-1', nome: 'Vale-Alimentação / Refeição', valor: 450.00 },
      { id: 'ben-2-2', nome: 'Vale-Transporte', valor: 220.00 },
    ],
    inss_patronal_percentual: 20.0,
    fgts_percentual: 8.0,
    provisao_ferias_percentual: 11.11,
    provisao_13_percentual: 8.33,
    outros_encargos_percentual: 0,
    banco: 'Banco do Brasil',
    agencia: '0048-2',
    conta: '38102-9',
    tipo_chave_pix: 'telefone',
    chave_pix: '(65) 99234-8899',
    observacoes: 'Especialista em ligação CC e quadros de string box.',
    ocorrencias: [],
    criado_em: '2024-06-15T08:00:00Z',
  },
  {
    id: 'func-3',
    nome: 'Lucas Gabriel Silveira',
    cpf: '581.029.349-11',
    rg: '16.482.001-2 SSP/MT',
    data_nascimento: '1998-11-03',
    telefone: '(65) 99345-1234',
    email: 'lucas.montador@mtsolar.com.br',
    endereco: 'Rua 24 de Outubro, 110 - Centro, Várzea Grande - MT',
    contato_emergencia_nome: 'Juliana Silveira (Irmã)',
    contato_emergencia_telefone: '(65) 99112-9988',
    cargo: 'Montador Estrutural de Painéis',
    setor: 'Instalação',
    tipo_contrato: 'CLT',
    data_admissao: '2025-01-20',
    data_desligamento: null,
    status: 'ativo',
    carga_horaria: '44h semanais',
    ctps_pis: 'CTPS 91028/0034 - PIS 148.29103.49-1',
    salario_base: 2400.00,
    forma_remuneracao: 'mensal',
    dia_pagamento: 5,
    comissao_tipo: 'fixo',
    comissao_valor: 0,
    adicional_tipo: 'periculosidade',
    adicional_percentual: 30.0,
    adicional_valor_fixo: 0,
    beneficios: [
      { id: 'ben-3-1', nome: 'Vale-Alimentação', valor: 400.00 },
      { id: 'ben-3-2', nome: 'Vale-Transporte', valor: 200.00 },
    ],
    inss_patronal_percentual: 20.0,
    fgts_percentual: 8.0,
    provisao_ferias_percentual: 11.11,
    provisao_13_percentual: 8.33,
    outros_encargos_percentual: 0,
    banco: 'Sicoob',
    agencia: '3008',
    conta: '58291-0',
    tipo_chave_pix: 'telefone',
    chave_pix: '(65) 99345-1234',
    observacoes: 'Experiência em telhados metálicos e cerâmicos.',
    ocorrencias: [],
    criado_em: '2025-01-20T08:00:00Z',
  },
  {
    id: 'func-4',
    nome: 'Engª. Beatriz Albuquerque',
    cpf: '294.819.301-44',
    rg: '10.291.849-0 SSP/MT',
    data_nascimento: '1989-02-18',
    telefone: '(65) 99988-1234',
    email: 'beatriz.eng@mtsolar.com.br',
    endereco: 'Av. Miguel Sutil, 3100 - Bosque da Saúde, Cuiabá - MT',
    contato_emergencia_nome: 'Marcos Albuquerque (Pai)',
    contato_emergencia_telefone: '(65) 3622-4411',
    cargo: 'Engenheira Eletricista e Homologação',
    setor: 'Engenharia',
    tipo_contrato: 'CLT',
    data_admissao: '2023-11-01',
    data_desligamento: null,
    status: 'ativo',
    carga_horaria: '40h semanais',
    ctps_pis: 'CREA-MT 128919/D - PIS 118.29104.99-0',
    salario_base: 7500.00,
    forma_remuneracao: 'mensal',
    dia_pagamento: 5,
    comissao_tipo: 'fixo',
    comissao_valor: 0,
    adicional_tipo: 'nenhum',
    adicional_percentual: 0,
    adicional_valor_fixo: 0,
    beneficios: [
      { id: 'ben-4-1', nome: 'Vale-Alimentação Premium', valor: 600.00 },
      { id: 'ben-4-2', nome: 'Plano de Saúde Unimed', valor: 450.00 },
    ],
    inss_patronal_percentual: 20.0,
    fgts_percentual: 8.0,
    provisao_ferias_percentual: 11.11,
    provisao_13_percentual: 8.33,
    outros_encargos_percentual: 0,
    banco: 'Banco do Brasil',
    agencia: '0048-2',
    conta: '19283-1',
    tipo_chave_pix: 'email',
    chave_pix: 'beatriz.eng@mtsolar.com.br',
    observacoes: 'Responsável técnica pelo CREA, projetos de subestação e pareceres de acesso concessionária.',
    ocorrencias: [],
    criado_em: '2023-11-01T08:00:00Z',
  },
  {
    id: 'func-5',
    nome: 'Marcelo Pimentel',
    cpf: '192.482.910-88',
    rg: '08.491.201-9 SSP/MT',
    data_nascimento: '1987-09-30',
    telefone: '(65) 99677-4400',
    email: 'marcelo.comercial@mtsolar.com.br',
    endereco: 'Rua Estevão de Mendonça, 920 - Quilombo, Cuiabá - MT',
    contato_emergencia_nome: 'Carla Pimentel (Esposa)',
    contato_emergencia_telefone: '(65) 99911-0022',
    cargo: 'Consultor Comercial de Energia Solar',
    setor: 'Comercial',
    tipo_contrato: 'PJ',
    data_admissao: '2024-08-01',
    data_desligamento: null,
    status: 'ativo',
    carga_horaria: 'Flexível',
    ctps_pis: 'PJ: 48.291.049/0001-88',
    salario_base: 2500.00,
    forma_remuneracao: 'mensal',
    dia_pagamento: 10,
    comissao_tipo: 'percentual',
    comissao_valor: 3.0,
    adicional_tipo: 'nenhum',
    adicional_percentual: 0,
    adicional_valor_fixo: 0,
    beneficios: [
      { id: 'ben-5-1', nome: 'Auxílio Combustível / Frota', valor: 500.00 },
    ],
    inss_patronal_percentual: 0,
    fgts_percentual: 0,
    provisao_ferias_percentual: 0,
    provisao_13_percentual: 0,
    outros_encargos_percentual: 0,
    banco: 'Sicoob',
    agencia: '3008',
    conta: '99201-8',
    tipo_chave_pix: 'cnpj',
    chave_pix: '48.291.049/0001-88',
    observacoes: 'Contrato PJ de representação comercial e fechamento de usinas.',
    ocorrencias: [],
    criado_em: '2024-08-01T08:00:00Z',
  },
  {
    id: 'func-6',
    nome: 'Fernanda Castro Santos',
    cpf: '291.849.201-99',
    rg: '13.910.482-3 SSP/MT',
    data_nascimento: '1995-04-12',
    telefone: '(65) 99211-5544',
    email: 'fernanda.financeiro@mtsolar.com.br',
    endereco: 'Rua das Camélias, 102 - Jardim Cuiabá, Cuiabá - MT',
    contato_emergencia_nome: 'Paulo Santos (Marido)',
    contato_emergencia_telefone: '(65) 99822-1133',
    cargo: 'Assistente Financeiro e Suprimentos',
    setor: 'Administrativo',
    tipo_contrato: 'CLT',
    data_admissao: '2024-01-15',
    data_desligamento: null,
    status: 'ativo',
    carga_horaria: '44h semanais',
    ctps_pis: 'CTPS 78192/0010 - PIS 129.48192.01-4',
    salario_base: 2900.00,
    forma_remuneracao: 'mensal',
    dia_pagamento: 5,
    comissao_tipo: 'fixo',
    comissao_valor: 0,
    adicional_tipo: 'nenhum',
    adicional_percentual: 0,
    adicional_valor_fixo: 0,
    beneficios: [
      { id: 'ben-6-1', nome: 'Vale-Alimentação / Refeição', valor: 450.00 },
      { id: 'ben-6-2', nome: 'Vale-Transporte', valor: 220.00 },
      { id: 'ben-6-3', nome: 'Plano Odontológico', valor: 80.00 },
    ],
    inss_patronal_percentual: 20.0,
    fgts_percentual: 8.0,
    provisao_ferias_percentual: 11.11,
    provisao_13_percentual: 8.33,
    outros_encargos_percentual: 0,
    banco: 'Sicoob',
    agencia: '3008',
    conta: '48201-2',
    tipo_chave_pix: 'cpf',
    chave_pix: '291.849.201-99',
    observacoes: 'Controle de contas a pagar, cotações com fornecedores de inversores e rotinas contábeis.',
    ocorrencias: [],
    criado_em: '2024-01-15T08:00:00Z',
  },
  {
    id: 'func-7',
    nome: 'Thiago Ramos da Cruz',
    cpf: '481.920.119-02',
    rg: '15.492.019-4 SSP/MT',
    data_nascimento: '1996-07-25',
    telefone: '(65) 98112-7766',
    email: 'thiago.oem@mtsolar.com.br',
    endereco: 'Rua C, Quadra 10 - Parque Atalaia, Cuiabá - MT',
    contato_emergencia_nome: 'Ana Cruz (Irmã)',
    contato_emergencia_telefone: '(65) 99222-3311',
    cargo: 'Técnico em O&M e Limpeza Solar',
    setor: 'Operações',
    tipo_contrato: 'CLT',
    data_admissao: '2025-02-10',
    data_desligamento: null,
    status: 'ativo',
    carga_horaria: '44h semanais',
    ctps_pis: 'CTPS 82910/0040 - PIS 138.92019.22-1',
    salario_base: 2600.00,
    forma_remuneracao: 'mensal',
    dia_pagamento: 5,
    comissao_tipo: 'fixo',
    comissao_valor: 0,
    adicional_tipo: 'periculosidade',
    adicional_percentual: 30.0,
    adicional_valor_fixo: 0,
    beneficios: [
      { id: 'ben-7-1', nome: 'Vale-Alimentação', valor: 400.00 },
      { id: 'ben-7-2', nome: 'Vale-Transporte', valor: 200.00 },
    ],
    inss_patronal_percentual: 20.0,
    fgts_percentual: 8.0,
    provisao_ferias_percentual: 11.11,
    provisao_13_percentual: 8.33,
    outros_encargos_percentual: 0,
    banco: 'Banco do Brasil',
    agencia: '0048-2',
    conta: '44910-3',
    tipo_chave_pix: 'telefone',
    chave_pix: '(65) 98112-7766',
    observacoes: 'Equipamento de hidrojateamento solar e termografia por drone.',
    ocorrencias: [],
    criado_em: '2025-02-10T08:00:00Z',
  },
  {
    id: 'func-8',
    nome: 'Mateus Oliveira',
    cpf: '619.201.849-55',
    rg: '17.391.820-9 SSP/MT',
    data_nascimento: '2003-10-10',
    telefone: '(65) 99122-3344',
    email: 'mateus.projetos@mtsolar.com.br',
    endereco: 'Av. Fernando Corrêa, 1400 - Poção, Cuiabá - MT',
    contato_emergencia_nome: 'José Oliveira (Pai)',
    contato_emergencia_telefone: '(65) 99933-2211',
    cargo: 'Estagiário de Engenharia de Projetos',
    setor: 'Projetos',
    tipo_contrato: 'estagiario',
    data_admissao: '2025-07-01',
    data_desligamento: null,
    status: 'ativo',
    carga_horaria: '30h semanais',
    ctps_pis: 'Termo de Estágio UFMT',
    salario_base: 1600.00,
    forma_remuneracao: 'mensal',
    dia_pagamento: 5,
    comissao_tipo: 'fixo',
    comissao_valor: 0,
    adicional_tipo: 'nenhum',
    adicional_percentual: 0,
    adicional_valor_fixo: 0,
    beneficios: [
      { id: 'ben-8-1', nome: 'Auxílio Transporte', valor: 200.00 },
    ],
    inss_patronal_percentual: 0,
    fgts_percentual: 0,
    provisao_ferias_percentual: 0,
    provisao_13_percentual: 0,
    outros_encargos_percentual: 0,
    banco: 'Sicoob',
    agencia: '3008',
    conta: '71029-4',
    tipo_chave_pix: 'email',
    chave_pix: 'mateus.projetos@mtsolar.com.br',
    observacoes: 'Estudante de Engenharia Elétrica UFMT (7º semestre). Elaboração de memoriais descritivos e diagramas unifilares.',
    ocorrencias: [],
    criado_em: '2025-07-01T08:00:00Z',
  },
];

export function gerarLancamentosFolhaPadrao(): LancamentoFolha[] {
  const hoje = new Date();
  const mesAtual = String(hoje.getMonth() + 1).padStart(2, '0');
  const anoAtual = hoje.getFullYear();
  const compAtual = `${mesAtual}/${anoAtual}`;

  const mesAntNum = hoje.getMonth() === 0 ? 12 : hoje.getMonth();
  const anoAntNum = hoje.getMonth() === 0 ? anoAtual - 1 : anoAtual;
  const compAnterior = `${String(mesAntNum).padStart(2, '0')}/${anoAntNum}`;

  return [
    // Carlos Eduardo (func-1)
    {
      id: 'folha-1-ad',
      funcionario_id: 'func-1',
      tipo: 'adiantamento',
      descricao: 'Adiantamento Quinzenal (Vale)',
      competencia: compAtual,
      valor: 1000.00,
      tipo_operacao: 'desconto',
      data_prevista: dataRelativa(-15),
      data_pagamento: dataRelativa(-15),
      status: 'pago',
      conta_id: 'conta-1',
      descontado_em_folha: false, // Em aberto, abaterá do salário do mês!
      observacoes: 'Adiantamento salarial solicitado no dia 20.',
      criado_em: '2026-09-20T10:00:00Z',
    },
    {
      id: 'folha-1-sal',
      funcionario_id: 'func-1',
      tipo: 'salario',
      descricao: 'Salário Base + Periculosidade (30%)',
      competencia: compAtual,
      valor: 4940.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(3),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      observacoes: 'Folha mensal da equipe de instalação',
      criado_em: '2026-10-01T08:00:00Z',
    },
    // Rodrigo Mendes (func-2)
    {
      id: 'folha-2-sal',
      funcionario_id: 'func-2',
      tipo: 'salario',
      descricao: 'Salário Base + Periculosidade (30%)',
      competencia: compAtual,
      valor: 4160.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(3),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      criado_em: '2026-10-01T08:00:00Z',
    },
    // Lucas Gabriel (func-3)
    {
      id: 'folha-3-sal',
      funcionario_id: 'func-3',
      tipo: 'salario',
      descricao: 'Salário Base + Periculosidade (30%)',
      competencia: compAtual,
      valor: 3120.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(3),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      criado_em: '2026-10-01T08:00:00Z',
    },
    // Engª Beatriz (func-4)
    {
      id: 'folha-4-sal',
      funcionario_id: 'func-4',
      tipo: 'salario',
      descricao: 'Salário Base Engenharia & Homologação',
      competencia: compAtual,
      valor: 7500.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(-2),
      data_pagamento: dataRelativa(-2),
      status: 'pago',
      conta_id: 'conta-1',
      criado_em: '2026-10-01T08:00:00Z',
    },
    // Marcelo Pimentel (func-5)
    {
      id: 'folha-5-sal',
      funcionario_id: 'func-5',
      tipo: 'salario',
      descricao: 'Remuneração Mensal Prestação de Serviços PJ',
      competencia: compAtual,
      valor: 2500.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(5),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      criado_em: '2026-10-01T08:00:00Z',
    },
    {
      id: 'folha-5-com',
      funcionario_id: 'func-5',
      tipo: 'comissao',
      descricao: 'Comissão Venda Usina Solar 75 kWp Dr. Carlos',
      competencia: compAtual,
      valor: 1800.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(5),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      criado_em: '2026-10-01T08:00:00Z',
    },
    // Fernanda Castro (func-6)
    {
      id: 'folha-6-sal',
      funcionario_id: 'func-6',
      tipo: 'salario',
      descricao: 'Salário Assistente Financeiro',
      competencia: compAtual,
      valor: 2900.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(-2),
      data_pagamento: dataRelativa(-2),
      status: 'pago',
      conta_id: 'conta-1',
      criado_em: '2026-10-01T08:00:00Z',
    },
    // Thiago Ramos (func-7)
    {
      id: 'folha-7-sal',
      funcionario_id: 'func-7',
      tipo: 'salario',
      descricao: 'Salário Base + Periculosidade (30%)',
      competencia: compAtual,
      valor: 3380.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(3),
      data_pagamento: null,
      status: 'pendente',
      conta_id: 'conta-1',
      criado_em: '2026-10-01T08:00:00Z',
    },
    // Mateus Oliveira (func-8)
    {
      id: 'folha-8-sal',
      funcionario_id: 'func-8',
      tipo: 'salario',
      descricao: 'Bolsa Estágio Engenharia',
      competencia: compAtual,
      valor: 1600.00,
      tipo_operacao: 'provento',
      data_prevista: dataRelativa(-2),
      data_pagamento: dataRelativa(-2),
      status: 'pago',
      conta_id: 'conta-1',
      criado_em: '2026-10-01T08:00:00Z',
    },
    // Histórico de mês anterior pago (para resumo anual de todos)
    {
      id: 'folha-ant-1',
      funcionario_id: 'func-1',
      tipo: 'salario',
      descricao: 'Salário Base + Periculosidade',
      competencia: compAnterior,
      valor: 4940.00,
      tipo_operacao: 'provento',
      data_prevista: mesRelativo(1, 5),
      data_pagamento: mesRelativo(1, 5),
      status: 'pago',
      conta_id: 'conta-1',
      criado_em: '2026-09-01T08:00:00Z',
    },
    {
      id: 'folha-ant-4',
      funcionario_id: 'func-4',
      tipo: 'salario',
      descricao: 'Salário Engenharia',
      competencia: compAnterior,
      valor: 7500.00,
      tipo_operacao: 'provento',
      data_prevista: mesRelativo(1, 5),
      data_pagamento: mesRelativo(1, 5),
      status: 'pago',
      conta_id: 'conta-1',
      criado_em: '2026-09-01T08:00:00Z',
    },
  ];
}

const CONFIGURACOES_PADRAO: ConfiguracoesEmpresa = {
  razao_social: 'MT Solar Soluções em Energia Renovável LTDA',
  nome_fantasia: 'MT Solar – Energia renovável',
  cnpj: '34.892.105/0001-44',
  inscricao_estadual: '13.582.991-0',
  telefone: '(65) 3028-4455',
  email: 'financeiro@mtsolar.com.br',
  endereco: 'Av. das Palmeiras, 1420 - Sala 03',
  cidade_uf: 'Cuiabá - MT',
  chave_pix: 'financeiro@mtsolar.com.br',
  aliquota_imposto_padrao: 6.5,
  encargos_fgts: 8.0,
  encargos_inss: 20.0,
};

// Primeiro usuário: Aurélio Marcos como Administrador
const USUARIOS_PADRAO: UsuarioAutorizado[] = [
  {
    id: 'user-admin-1',
    nome: 'Aurélio Marcos',
    email: 'aurelio.marcos21@gmail.com',
    papel: 'administrador',
    data_adicionado: '2026-01-01',
    foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: 'user-viewer-1',
    nome: 'Consultor Financeiro (Visualizador)',
    email: 'consultoria@mtsolar.com.br',
    papel: 'visualizador',
    data_adicionado: '2026-02-01',
    adicionado_por: 'aurelio.marcos21@gmail.com',
  },
];

// Event subscribers
type EventCallback = () => void;
const listeners: Record<string, Set<EventCallback>> = {};

function notify(channel: string) {
  if (listeners[channel]) {
    listeners[channel].forEach((cb) => cb());
  }
}

export function subscribe(channel: string, callback: EventCallback): () => void {
  if (!listeners[channel]) {
    listeners[channel] = new Set();
  }
  listeners[channel].add(callback);
  return () => {
    listeners[channel]?.delete(callback);
  };
}

class StorageService {
  constructor() {
    this.init();
  }

  private init() {
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIAS)) {
      localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(CATEGORIAS_PADRAO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CONTAS)) {
      localStorage.setItem(STORAGE_KEYS.CONTAS, JSON.stringify(CONTAS_PADRAO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CONTATOS)) {
      localStorage.setItem(STORAGE_KEYS.CONTATOS, JSON.stringify(CONTATOS_PADRAO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROJETOS)) {
      localStorage.setItem(STORAGE_KEYS.PROJETOS, JSON.stringify(PROJETOS_PADRAO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LANCAMENTOS)) {
      localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(LANCAMENTOS_PADRAO));
    } else {
      try {
        const salvos = JSON.parse(localStorage.getItem(STORAGE_KEYS.LANCAMENTOS) || '[]');
        const hojeIso = new Date().toISOString().split('T')[0];
        const temFuturos = salvos.some((l: Lancamento) => l.status === 'pendente' && l.data_vencimento >= hojeIso);
        if (!temFuturos || salvos.length < 10) {
          localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(gerarLancamentosPadrao()));
        }
      } catch (err) {
        localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(gerarLancamentosPadrao()));
      }
    }
    if (!localStorage.getItem(STORAGE_KEYS.CONFIGURACOES)) {
      localStorage.setItem(STORAGE_KEYS.CONFIGURACOES, JSON.stringify(CONFIGURACOES_PADRAO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USUARIOS)) {
      localStorage.setItem(STORAGE_KEYS.USUARIOS, JSON.stringify(USUARIOS_PADRAO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USUARIO_ATUAL)) {
      localStorage.setItem(STORAGE_KEYS.USUARIO_ATUAL, JSON.stringify(USUARIOS_PADRAO[0]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.FUNCIONARIOS)) {
      localStorage.setItem(STORAGE_KEYS.FUNCIONARIOS, JSON.stringify(FUNCIONARIOS_PADRAO));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LANCAMENTOS_FOLHA)) {
      localStorage.setItem(STORAGE_KEYS.LANCAMENTOS_FOLHA, JSON.stringify(gerarLancamentosFolhaPadrao()));
    }
  }

  // CONTAS
  getContas(): ContaBancaria[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTAS);
    return raw ? JSON.parse(raw) : [];
  }

  saveConta(conta: ContaBancaria): ContaBancaria {
    const contas = this.getContas();
    const index = contas.findIndex(c => c.id === conta.id);
    if (index >= 0) {
      contas[index] = conta;
    } else {
      contas.push(conta);
    }
    localStorage.setItem(STORAGE_KEYS.CONTAS, JSON.stringify(contas));
    notify('contas');
    notify('lancamentos');
    return conta;
  }

  deleteConta(id: string): { sucesso: boolean; mensagem?: string } {
    const lancamentos = this.getLancamentos();
    const temLancamentos = lancamentos.some(l => l.conta_id === id);
    if (temLancamentos) {
      return {
        sucesso: false,
        mensagem: 'Não é permitido excluir uma conta bancária que já possui lançamentos vinculados. Para retirá-la das operações, marque-a como Inativa.',
      };
    }
    const contas = this.getContas().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CONTAS, JSON.stringify(contas));
    notify('contas');
    return { sucesso: true };
  }

  toggleAtivaConta(id: string): ContaBancaria | null {
    const contas = this.getContas();
    const c = contas.find(item => item.id === id);
    if (!c) return null;
    c.ativa = !c.ativa;
    localStorage.setItem(STORAGE_KEYS.CONTAS, JSON.stringify(contas));
    notify('contas');
    notify('lancamentos');
    return c;
  }

  // TRANSFERÊNCIA ENTRE CONTAS
  transferirEntreContas(params: {
    contaOrigemId: string;
    contaDestinoId: string;
    valor: number;
    data: string;
    observacoes?: string;
  }): { sucesso: boolean; mensagem?: string } {
    const { contaOrigemId, contaDestinoId, valor, data, observacoes } = params;
    if (contaOrigemId === contaDestinoId) {
      return { sucesso: false, mensagem: 'A conta de origem deve ser diferente da conta de destino.' };
    }
    if (valor <= 0) {
      return { sucesso: false, mensagem: 'O valor da transferência deve ser maior que zero.' };
    }
    const contas = this.getContas();
    const origem = contas.find(c => c.id === contaOrigemId);
    const destino = contas.find(c => c.id === contaDestinoId);
    if (!origem || !destino) {
      return { sucesso: false, mensagem: 'Contas bancárias não encontradas.' };
    }

    const transferenciaId = 'transf-' + Date.now();
    const catTransferencia = this.getCategorias().find(c => c.nome.toLowerCase().includes('transferência'))?.id || 'cat-transf';

    const lancamentoSaida: Lancamento = {
      id: 'lanc-saida-' + Date.now(),
      tipo: 'despesa',
      descricao: `Transferência enviada para ${destino.nome}`,
      valor,
      data_vencimento: data,
      data_pagamento: data,
      status: 'pago',
      conta_id: contaOrigemId,
      conta_destino_id: contaDestinoId,
      categoria_id: catTransferencia,
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'transferencia',
      transferencia_vinculada_id: transferenciaId,
      observacoes: observacoes || `Transferência entre contas internas (${origem.nome} -> ${destino.nome})`,
      criado_em: new Date().toISOString(),
    };

    const lancamentoEntrada: Lancamento = {
      id: 'lanc-entrada-' + (Date.now() + 1),
      tipo: 'receita',
      descricao: `Transferência recebida de ${origem.nome}`,
      valor,
      data_vencimento: data,
      data_pagamento: data,
      status: 'pago',
      conta_id: contaDestinoId,
      categoria_id: catTransferencia,
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'transferencia',
      transferencia_vinculada_id: transferenciaId,
      observacoes: observacoes || `Transferência entre contas internas (${origem.nome} -> ${destino.nome})`,
      criado_em: new Date().toISOString(),
    };

    const lancamentos = this.getLancamentos();
    lancamentos.unshift(lancamentoEntrada);
    lancamentos.unshift(lancamentoSaida);
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));
    notify('lancamentos');
    notify('contas');
    return { sucesso: true };
  }

  // CONCILIAÇÃO / AJUSTE DE SALDO
  conciliarSaldoConta(params: {
    contaId: string;
    valorInformado: number;
    tipoInformado: 'sem_limite' | 'com_limite';
    dataAjuste: string;
    observacoes?: string;
  }): { sucesso: boolean; diferenca: number; mensagem?: string } {
    const { contaId, valorInformado, tipoInformado, dataAjuste, observacoes } = params;
    const conta = this.getContas().find(c => c.id === contaId);
    if (!conta) return { sucesso: false, diferenca: 0, mensagem: 'Conta não encontrada.' };

    const resumo = this.calcularResumoConta(conta);
    const saldoRealAtual = resumo.saldo_real;

    let saldoRealEsperado: number;
    if (tipoInformado === 'sem_limite') {
      saldoRealEsperado = valorInformado;
    } else {
      saldoRealEsperado = valorInformado - (conta.limite_cheque_especial || 0);
    }

    const diferenca = +(saldoRealEsperado - saldoRealAtual).toFixed(2);

    if (Math.abs(diferenca) < 0.005) {
      return { sucesso: true, diferenca: 0, mensagem: 'O saldo da conta já confere perfeitamente.' };
    }

    const catAjuste = this.getCategorias().find(c => c.nome.toLowerCase().includes('outras'))?.id || 'cat-rec-5';

    const lancamentoAjuste: Lancamento = {
      id: 'lanc-ajuste-' + Date.now(),
      tipo: diferenca > 0 ? 'receita' : 'despesa',
      descricao: `Ajuste de Saldo / Conciliação Bancária (${tipoInformado === 'sem_limite' ? 'Base Saldo Sem Limite' : 'Base Saldo Com Limite'})`,
      valor: Math.abs(diferenca),
      data_vencimento: dataAjuste,
      data_pagamento: dataAjuste,
      status: 'pago',
      conta_id: contaId,
      categoria_id: catAjuste,
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'ajuste',
      observacoes: observacoes ? `${observacoes} (Diferença de conciliação: ${diferenca > 0 ? '+' : ''}${diferenca})` : `Diferença de conciliação: ${diferenca > 0 ? '+' : ''}${diferenca}`,
      criado_em: new Date().toISOString(),
    };

    const lancamentos = this.getLancamentos();
    lancamentos.unshift(lancamentoAjuste);
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));
    notify('lancamentos');
    notify('contas');
    return { sucesso: true, diferenca };
  }

  // LANCAMENTOS
  getLancamentos(): Lancamento[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LANCAMENTOS);
    return raw ? JSON.parse(raw) : [];
  }

  saveLancamento(lancamento: Lancamento): Lancamento {
    const lancamentos = this.getLancamentos();
    const index = lancamentos.findIndex(l => l.id === lancamento.id);
    const acao = index >= 0 ? 'edicao' : 'criacao';

    if (index >= 0) {
      lancamentos[index] = lancamento;
    } else {
      lancamentos.unshift(lancamento);
    }
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));
    notify('lancamentos');
    notify('contas');

    this.registrarAlteracao(
      'lancamentos',
      acao,
      `${acao === 'criacao' ? 'Criado' : 'Editado'} lançamento: ${lancamento.descricao}`,
      `${lancamento.tipo.toUpperCase()} • R$ ${lancamento.valor.toFixed(2)} • Vencimento: ${lancamento.data_vencimento}`
    );

    return lancamento;
  }

  deleteLancamento(id: string, escopo: 'so_esta' | 'futuras' | 'todas' = 'so_esta'): void {
    const lancamentos = this.getLancamentos();
    const alvo = lancamentos.find(l => l.id === id);
    if (!alvo) return;

    let filtrados: Lancamento[];

    const grupoId = alvo.grupo_parcelas_id || alvo.grupo_recorrencia_id;

    if (!grupoId || escopo === 'so_esta') {
      filtrados = lancamentos.filter(l => l.id !== id);
    } else if (escopo === 'todas') {
      filtrados = lancamentos.filter(l => (l.grupo_parcelas_id !== grupoId && l.grupo_recorrencia_id !== grupoId));
    } else {
      // 'futuras' (esta e as futuras com data_vencimento >= alvo.data_vencimento)
      filtrados = lancamentos.filter(l => {
        const mesmoGrupo = l.grupo_parcelas_id === grupoId || l.grupo_recorrencia_id === grupoId;
        if (!mesmoGrupo) return true;
        return l.data_vencimento < alvo.data_vencimento;
      });
    }

    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(filtrados));
    notify('lancamentos');
    notify('contas');

    this.registrarAlteracao(
      'lancamentos',
      'exclusao',
      `Excluído lançamento: ${alvo.descricao} (${escopo})`,
      `Valor: R$ ${alvo.valor.toFixed(2)} • Vencimento: ${alvo.data_vencimento}`
    );
  }

  // Duplicar lançamento para facilitar novo cadastro
  duplicarLancamento(id: string): Lancamento | null {
    const lancamentos = this.getLancamentos();
    const original = lancamentos.find(l => l.id === id);
    if (!original) return null;

    const copia: Lancamento = {
      ...original,
      id: 'lanc-' + Date.now(),
      descricao: `${original.descricao} (Cópia)`,
      status: 'pendente',
      data_pagamento: null,
      grupo_parcelas_id: undefined,
      grupo_recorrencia_id: undefined,
      parcela_atual: undefined,
      total_parcelas: undefined,
      criado_em: new Date().toISOString(),
    };

    lancamentos.unshift(copia);
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));
    notify('lancamentos');
    notify('contas');
    return copia;
  }

  // Liquidação com suporte a juros, multa, desconto e alteração de conta de saída/entrada
  liquidarLancamento(params: {
    id: string;
    dataPagamento?: string;
    contaId?: string;
    jurosMulta?: number;
    desconto?: number;
    valorFinal?: number;
  }): Lancamento | null {
    const lancamentos = this.getLancamentos();
    const index = lancamentos.findIndex(l => l.id === params.id);
    if (index < 0) return null;

    const l = lancamentos[index];
    const hoje = new Date().toISOString().split('T')[0];
    const juros = params.jurosMulta || 0;
    const desc = params.desconto || 0;
    const valorCalculado = params.valorFinal !== undefined 
      ? params.valorFinal 
      : +(l.valor + juros - desc).toFixed(2);

    lancamentos[index] = {
      ...l,
      status: 'pago',
      data_pagamento: params.dataPagamento || hoje,
      conta_id: params.contaId || l.conta_id,
      valor_original: l.valor_original || l.valor,
      juros_multa: juros > 0 ? juros : undefined,
      desconto: desc > 0 ? desc : undefined,
      valor: valorCalculado,
    };

    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));
    notify('lancamentos');
    notify('contas');

    this.registrarAlteracao(
      'lancamentos',
      'pagamento',
      `Liquidação de título: ${l.descricao}`,
      `${l.tipo === 'receita' ? 'Recebido' : 'Pago'}: R$ ${valorCalculado.toFixed(2)} (Data: ${params.dataPagamento || hoje})`
    );

    return lancamentos[index];
  }

  // Liquidação em lote de múltiplos títulos
  liquidarLancamentosEmLote(params: {
    ids: string[];
    dataPagamento?: string;
    contaId: string;
  }): number {
    const lancamentos = this.getLancamentos();
    const hoje = new Date().toISOString().split('T')[0];
    let contador = 0;
    let totalValor = 0;

    for (const id of params.ids) {
      const idx = lancamentos.findIndex(l => l.id === id);
      if (idx >= 0 && lancamentos[idx].status !== 'pago') {
        totalValor += lancamentos[idx].valor;
        lancamentos[idx] = {
          ...lancamentos[idx],
          status: 'pago',
          data_pagamento: params.dataPagamento || hoje,
          conta_id: params.contaId,
        };
        contador++;
      }
    }

    if (contador > 0) {
      localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));
      notify('lancamentos');
      notify('contas');

      this.registrarAlteracao(
        'lancamentos',
        'pagamento',
        `Liquidação em lote: ${contador} títulos quitados`,
        `Valor total: R$ ${totalValor.toFixed(2)} (Data: ${params.dataPagamento || hoje})`
      );
    }
    return contador;
  }

  // CATEGORIAS
  getCategorias(): Categoria[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIAS);
    return raw ? JSON.parse(raw) : [];
  }

  saveCategoria(categoria: Categoria): Categoria {
    const categorias = this.getCategorias();
    const index = categorias.findIndex(c => c.id === categoria.id);
    if (index >= 0) {
      categorias[index] = categoria;
    } else {
      categorias.push(categoria);
    }
    localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(categorias));
    notify('categorias');
    return categoria;
  }

  deleteCategoria(id: string): boolean {
    const categorias = this.getCategorias();
    const target = categorias.find(c => c.id === id);
    if (target?.padrao) {
      return false; // Não remove categorias padrão essenciais
    }
    const filtradas = categorias.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(filtradas));
    notify('categorias');
    return true;
  }

  // CONTATOS
  getContatos(): Contato[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTATOS);
    return raw ? JSON.parse(raw) : [];
  }

  saveContato(contato: Contato): Contato {
    const contatos = this.getContatos();
    const index = contatos.findIndex(c => c.id === contato.id);
    if (index >= 0) {
      contatos[index] = contato;
    } else {
      contatos.push(contato);
    }
    localStorage.setItem(STORAGE_KEYS.CONTATOS, JSON.stringify(contatos));
    notify('contatos');
    return contato;
  }

  deleteContato(id: string): void {
    const contatos = this.getContatos().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CONTATOS, JSON.stringify(contatos));
    notify('contatos');
  }

  // PROJETOS
  getProjetos(): Projeto[] {
    const raw = localStorage.getItem(STORAGE_KEYS.PROJETOS);
    return raw ? JSON.parse(raw) : [];
  }

  saveProjeto(projeto: Projeto): Projeto {
    const projetos = this.getProjetos();
    const index = projetos.findIndex(p => p.id === projeto.id);
    if (index >= 0) {
      projetos[index] = projeto;
    } else {
      projetos.push(projeto);
    }
    localStorage.setItem(STORAGE_KEYS.PROJETOS, JSON.stringify(projetos));
    notify('projetos');
    return projeto;
  }

  deleteProjeto(id: string): void {
    const projetos = this.getProjetos().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PROJETOS, JSON.stringify(projetos));
    notify('projetos');
  }

  // CONFIGURACOES
  getConfiguracoes(): ConfiguracoesEmpresa {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIGURACOES);
    return raw ? JSON.parse(raw) : CONFIGURACOES_PADRAO;
  }

  saveConfiguracoes(config: ConfiguracoesEmpresa): ConfiguracoesEmpresa {
    localStorage.setItem(STORAGE_KEYS.CONFIGURACOES, JSON.stringify(config));
    notify('configuracoes');
    return config;
  }

  // USUARIOS AUTORIZADOS
  getUsuariosAutorizados(): UsuarioAutorizado[] {
    const raw = localStorage.getItem(STORAGE_KEYS.USUARIOS);
    return raw ? JSON.parse(raw) : [];
  }

  saveUsuarioAutorizado(usuario: UsuarioAutorizado): UsuarioAutorizado {
    const usuarios = this.getUsuariosAutorizados();
    const index = usuarios.findIndex(u => u.email.toLowerCase() === usuario.email.toLowerCase());
    if (index >= 0) {
      usuarios[index] = usuario;
    } else {
      usuarios.push(usuario);
    }
    localStorage.setItem(STORAGE_KEYS.USUARIOS, JSON.stringify(usuarios));
    notify('usuarios');
    return usuario;
  }

  deleteUsuarioAutorizado(id: string): boolean {
    const usuarios = this.getUsuariosAutorizados();
    // Impede deletar o último administrador
    const admins = usuarios.filter(u => u.papel === 'administrador');
    const target = usuarios.find(u => u.id === id);
    if (target?.papel === 'administrador' && admins.length <= 1) {
      return false;
    }
    const filtrados = usuarios.filter(u => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.USUARIOS, JSON.stringify(filtrados));
    notify('usuarios');
    return true;
  }

  // USUARIO LOGADO ATUAL
  getUsuarioAtual(): UsuarioAutorizado | null {
    const raw = localStorage.getItem(STORAGE_KEYS.USUARIO_ATUAL);
    return raw ? JSON.parse(raw) : null;
  }

  setUsuarioAtual(usuario: UsuarioAutorizado | null): void {
    if (usuario) {
      localStorage.setItem(STORAGE_KEYS.USUARIO_ATUAL, JSON.stringify(usuario));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USUARIO_ATUAL);
    }
    notify('auth');
  }

  /**
   * REGRA CENTRAL DE SALDO:
   * "O SALDO REAL de uma conta = saldo_inicial + soma das receitas PAGAS − soma das despesas PAGAS.
   * Ele PODE ficar negativo (significa que a empresa está usando cheque especial).
   * O saldo real NUNCA inclui o limite do cheque especial."
   */
  calcularResumoConta(conta: ContaBancaria): ResumoSaldoConta {
    const lancamentos = this.getLancamentos().filter(
      l => l.conta_id === conta.id && l.status === 'pago'
    );

    let totalReceitasPagas = 0;
    let totalDespesasPagas = 0;

    for (const l of lancamentos) {
      if (l.tipo === 'receita') {
        totalReceitasPagas += l.valor;
      } else if (l.tipo === 'despesa') {
        totalDespesasPagas += l.valor;
      }
    }

    const saldoReal = +(conta.saldo_inicial + totalReceitasPagas - totalDespesasPagas).toFixed(2);
    const limiteChequeTotal = conta.limite_cheque_especial || 0;
    const usandoChequeEspecial = saldoReal < 0;
    const chequeEspecialUtilizado = usandoChequeEspecial ? Math.abs(saldoReal) : 0;
    const chequeEspecialDisponivel = Math.max(0, limiteChequeTotal - chequeEspecialUtilizado);
    const saldoDisponivelTotal = saldoReal + limiteChequeTotal;
    const percentualChequeUsado = limiteChequeTotal > 0 ? (chequeEspecialUtilizado / limiteChequeTotal) * 100 : 0;
    const alertaCriticoCheque = percentualChequeUsado >= 80;
    const taxaMensal = conta.taxa_juros_cheque_especial_mensal || 0;
    const custoJurosMensal = chequeEspecialUtilizado * (taxaMensal / 100);
    const custoJurosDiario = custoJurosMensal / 30;

    return {
      conta,
      saldo_inicial: conta.saldo_inicial,
      total_receitas_pagas: totalReceitasPagas,
      total_despesas_pagas: totalDespesasPagas,
      saldo_real: saldoReal,
      saldo_disponivel_total: saldoDisponivelTotal,
      limite_cheque_total: limiteChequeTotal,
      cheque_especial_utilizado: chequeEspecialUtilizado,
      cheque_especial_disponivel: chequeEspecialDisponivel,
      usando_cheque_especial: usandoChequeEspecial,
      percentual_cheque_usado: percentualChequeUsado,
      alerta_critico_cheque: alertaCriticoCheque,
      custo_juros_mensal_estimado: custoJurosMensal,
      custo_juros_diario_estimado: custoJurosDiario,
    };
  }

  calcularResumoGeral() {
    const contas = this.getContas().filter(c => c.ativa);
    const lancamentos = this.getLancamentos();

    let saldoRealTotal = 0;
    let limiteChequeTotal = 0;
    let chequeEspecialUsadoTotal = 0;

    const resumosContas = contas.map(c => {
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

    // Estimativa consolidada de juros se alguma conta estiver no cheque especial
    const custoJurosMensalTotal = resumosContas.reduce((acc, r) => acc + r.custo_juros_mensal_estimado, 0);
    const custoJurosDiarioTotal = custoJurosMensalTotal / 30;

    const hoje = new Date().toISOString().split('T')[0];

    // Cálculos de pendências
    let aReceberPendente = 0;
    let aReceberAtrasado = 0;
    let aPagarPendente = 0;
    let aPagarAtrasado = 0;

    let totalReceitasMes = 0;
    let totalDespesasMes = 0;

    const mesAtual = hoje.slice(0, 7); // YYYY-MM

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
      } else if (l.status === 'pago') {
        // Transferências não contam como receita ou despesa operacional
        if (l.origem !== 'transferencia') {
          const dataReferencia = (l.data_pagamento || l.data_vencimento).slice(0, 7);
          if (dataReferencia === mesAtual) {
            if (l.tipo === 'receita') {
              totalReceitasMes += l.valor;
            } else {
              totalDespesasMes += l.valor;
            }
          }
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
  }

  obterExtratoConta(contaId: string) {
    const conta = this.getContas().find(c => c.id === contaId);
    if (!conta) return null;

    const lancamentosPagos = this.getLancamentos()
      .filter(l => l.conta_id === contaId && l.status === 'pago')
      .sort((a, b) => {
        const dataA = a.data_pagamento || a.data_vencimento;
        const dataB = b.data_pagamento || b.data_vencimento;
        if (dataA !== dataB) return dataA.localeCompare(dataB);
        return a.criado_em.localeCompare(b.criado_em);
      });

    let saldoAcumulado = conta.saldo_inicial;
    const linhas = lancamentosPagos.map(l => {
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
  }

  /**
   * PROJEÇÃO DE SALDO REAL para 30/60/90 dias
   * Considera o saldo real consolidado (ou da conta) e os lançamentos pendentes futuros.
   * Se a projeção ficar negativa, detecta a primeira data e o valor de cheque especial necessário.
   */
  calcularProjecaoSaldoReal(dias: 30 | 60 | 90 = 30, contaId: string = 'todas') {
    const contas = this.getContas().filter(c => c.ativa);
    let saldoInicial = 0;
    let limiteChequeTotal = 0;

    if (contaId === 'todas') {
      const resGeral = this.calcularResumoGeral();
      saldoInicial = resGeral.saldoRealTotal;
      limiteChequeTotal = resGeral.limiteChequeTotal;
    } else {
      const conta = contas.find(c => c.id === contaId);
      if (conta) {
        const resConta = this.calcularResumoConta(conta);
        saldoInicial = resConta.saldo_real;
        limiteChequeTotal = conta.limite_cheque_especial || 0;
      }
    }

    const hojeIso = new Date().toISOString().split('T')[0];
    const todosLancamentos = this.getLancamentos();

    // Lançamentos pendentes relevantes
    const pendentes = todosLancamentos.filter(l => {
      if (l.status !== 'pendente') return false;
      if (contaId !== 'todas' && l.conta_id !== contaId) return false;
      return true;
    });

    // Pendentes atrasados incidem imediatamente no caixa inicial projetado
    const atrasadasReceitas = pendentes
      .filter(l => l.tipo === 'receita' && l.data_vencimento < hojeIso)
      .reduce((a, b) => a + b.valor, 0);
    const atrasadasDespesas = pendentes
      .filter(l => l.tipo === 'despesa' && l.data_vencimento < hojeIso)
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
        .filter(l => l.tipo === 'receita' && l.data_vencimento === dataIso)
        .reduce((a, b) => a + b.valor, 0);
      const despesasDia = pendentes
        .filter(l => l.tipo === 'despesa' && l.data_vencimento === dataIso)
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
  }

  /**
   * Resumo Operacional do Painel:
   * A receber (7 e 30 dias), A pagar (7 e 30 dias), Resultado do mês e Contas atrasadas
   */
  calcularResumoPainel(
    filtroPeriodo: string = 'mes_atual',
    dataInicioPersonalizada?: string,
    dataFimPersonalizada?: string
  ) {
    const hojeIso = new Date().toISOString().split('T')[0];
    const hojeObj = new Date();
    const todosLancamentos = this.getLancamentos();

    // Datas limites para 7 e 30 dias
    const d7 = new Date();
    d7.setDate(d7.getDate() + 7);
    const limite7Iso = d7.toISOString().split('T')[0];

    const d30 = new Date();
    d30.setDate(d30.getDate() + 30);
    const limite30Iso = d30.toISOString().split('T')[0];

    const pendentes = todosLancamentos.filter(l => l.status === 'pendente');

    // A Receber 7 e 30 dias
    const aReceberPendentes = pendentes.filter(l => l.tipo === 'receita');
    const aReceber7Itens = aReceberPendentes.filter(l => l.data_vencimento >= hojeIso && l.data_vencimento <= limite7Iso);
    const aReceber30Itens = aReceberPendentes.filter(l => l.data_vencimento >= hojeIso && l.data_vencimento <= limite30Iso);

    const aReceber7Dias = {
      valor: aReceber7Itens.reduce((acc, l) => acc + l.valor, 0),
      quantidade: aReceber7Itens.length,
    };
    const aReceber30Dias = {
      valor: aReceber30Itens.reduce((acc, l) => acc + l.valor, 0),
      quantidade: aReceber30Itens.length,
    };

    // A Pagar 7 e 30 dias
    const aPagarPendentes = pendentes.filter(l => l.tipo === 'despesa');
    const aPagar7Itens = aPagarPendentes.filter(l => l.data_vencimento >= hojeIso && l.data_vencimento <= limite7Iso);
    const aPagar30Itens = aPagarPendentes.filter(l => l.data_vencimento >= hojeIso && l.data_vencimento <= limite30Iso);

    const aPagar7Dias = {
      valor: aPagar7Itens.reduce((acc, l) => acc + l.valor, 0),
      quantidade: aPagar7Itens.length,
    };
    const aPagar30Dias = {
      valor: aPagar30Itens.reduce((acc, l) => acc + l.valor, 0),
      quantidade: aPagar30Itens.length,
    };

    // Contas Atrasadas (data_vencimento < hojeIso)
    const aPagarAtrasadasItens = aPagarPendentes.filter(l => l.data_vencimento < hojeIso);
    const aReceberAtrasadasItens = aReceberPendentes.filter(l => l.data_vencimento < hojeIso);

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
      }
    };

    // Período de apuração do resultado
    let dataIni = '';
    let dataFim = '';
    const anoAtual = hojeObj.getFullYear();
    const mesAtual = hojeObj.getMonth();

    if (filtroPeriodo === 'mes_atual') {
      const primeiro = new Date(anoAtual, mesAtual, 1);
      const ultimo = new Date(anoAtual, mesAtual + 1, 0);
      dataIni = primeiro.toISOString().split('T')[0];
      dataFim = ultimo.toISOString().split('T')[0];
    } else if (filtroPeriodo === 'mes_anterior') {
      const primeiro = new Date(anoAtual, mesAtual - 1, 1);
      const ultimo = new Date(anoAtual, mesAtual, 0);
      dataIni = primeiro.toISOString().split('T')[0];
      dataFim = ultimo.toISOString().split('T')[0];
    } else if (filtroPeriodo === '3_meses') {
      const primeiro = new Date();
      primeiro.setDate(primeiro.getDate() - 90);
      dataIni = primeiro.toISOString().split('T')[0];
      dataFim = hojeIso;
    } else if (filtroPeriodo === 'ano') {
      dataIni = `${anoAtual}-01-01`;
      dataFim = `${anoAtual}-12-31`;
    } else if (filtroPeriodo === 'personalizado' && dataInicioPersonalizada && dataFimPersonalizada) {
      dataIni = dataInicioPersonalizada;
      dataFim = dataFimPersonalizada;
    } else {
      const primeiro = new Date(anoAtual, mesAtual, 1);
      const ultimo = new Date(anoAtual, mesAtual + 1, 0);
      dataIni = primeiro.toISOString().split('T')[0];
      dataFim = ultimo.toISOString().split('T')[0];
    }

    const pagosPeriodo = todosLancamentos.filter(l => {
      if (l.status !== 'pago') return false;
      if (l.origem === 'transferencia') return false;
      const dt = l.data_pagamento || l.data_vencimento;
      return dt >= dataIni && dt <= dataFim;
    });

    const receitasPagas = pagosPeriodo.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
    const despesasPagas = pagosPeriodo.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
    const resultadoPeriodo = +(receitasPagas - despesasPagas).toFixed(2);

    return {
      aReceber7Dias,
      aReceber30Dias,
      aPagar7Dias,
      aPagar30Dias,
      contasAtrasadas,
      resultadoPeriodo: {
        receitasPagas,
        despesasPagas,
        resultado: resultadoPeriodo,
        dataIni,
        dataFim,
      }
    };
  }

  /**
   * Dados para gráfico de Barras: Receitas x Despesas dos últimos 6 ou 12 meses
   */
  obterDadosGrafico6e12Meses(numMeses: 6 | 12 = 6) {
    const todos = this.getLancamentos().filter(l => l.status === 'pago' && l.origem !== 'transferencia');
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

      todos.forEach(l => {
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
  }

  /**
   * Despesas por Categoria (para gráfico de Rosca)
   */
  obterDespesasPorCategoria(dataIni?: string, dataFim?: string) {
    const todos = this.getLancamentos().filter(
      l => l.status === 'pago' && l.tipo === 'despesa' && l.origem !== 'transferencia'
    );
    const categorias = this.getCategorias();

    const filtradas = todos.filter(l => {
      if (!dataIni || !dataFim) return true;
      const dt = l.data_pagamento || l.data_vencimento;
      return dt >= dataIni && dt <= dataFim;
    });

    const mapa = new Map<string, number>();
    let totalGeral = 0;

    filtradas.forEach(l => {
      const atual = mapa.get(l.categoria_id) || 0;
      mapa.set(l.categoria_id, atual + l.valor);
      totalGeral += l.valor;
    });

    const coresPaleta = ['#003064', '#FCBC00', '#1A4A85', '#00204A', '#EAB308', '#0284C7', '#16A34A', '#DC2626', '#8B5CF6', '#EC4899'];

    const itens = Array.from(mapa.entries()).map(([catId, valor], idx) => {
      const cat = categorias.find(c => c.id === catId);
      return {
        id: catId,
        nome: cat ? cat.nome : 'Outras Despesas',
        valor,
        percentual: totalGeral > 0 ? +((valor / totalGeral) * 100).toFixed(1) : 0,
        cor: cat?.cor || coresPaleta[idx % coresPaleta.length],
      };
    }).sort((a, b) => b.valor - a.valor);

    return { itens, totalGeral };
  }

  /**
   * Fluxo de Caixa Diário do Mês
   */
  obterFluxoDiarioMes(anoMes?: string) {
    const hoje = new Date();
    const alvo = anoMes || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const [anoStr, mesStr] = alvo.split('-');
    const ano = parseInt(anoStr, 10);
    const mes = parseInt(mesStr, 10);
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const todos = this.getLancamentos().filter(l => l.status === 'pago' && l.origem !== 'transferencia');

    const dias = [];
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const diaPad = String(dia).padStart(2, '0');
      const dataIso = `${alvo}-${diaPad}`;
      let entradas = 0;
      let saidas = 0;

      todos.forEach(l => {
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
  }

  /**
   * Próximos Vencimentos (8 primeiros pendentes ordenados por vencimento)
   */
  obterProximosVencimentos(limite: number = 8): Lancamento[] {
    const pendentes = this.getLancamentos().filter(l => l.status === 'pendente');
    pendentes.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
    return pendentes.slice(0, limite);
  }

  /**
   * Últimos lançamentos realizados
   */
  obterUltimosLancamentos(limite: number = 8): Lancamento[] {
    const todos = [...this.getLancamentos()];
    todos.sort((a, b) => {
      const dataA = a.data_pagamento || a.data_vencimento || a.criado_em;
      const dataB = b.data_pagamento || b.data_vencimento || b.criado_em;
      return dataB.localeCompare(dataA);
    });
    return todos.slice(0, limite);
  }

  /**
   * Resumo da folha de pagamento e equipes MT Solar
   */
  obterResumoFolha() {
    const config = this.getConfiguracoes();
    const funcionariosAtivos = 8;
    const salariosBase = 26500.00;
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
  }

  /**
   * FICHA FINANCEIRA DO PROJETO
   * Calcula contratado, recebido, a receber, custos realizados e previstos,
   * lucro e margem (%) realizados e previstos.
   */
  obterFichaProjeto(projetoId: string) {
    const projeto = this.getProjetos().find(p => p.id === projetoId);
    if (!projeto) return null;

    const lancamentos = this.getLancamentos().filter(
      l => l.projeto_id === projetoId && l.status !== 'cancelado' && l.origem !== 'transferencia'
    );

    // Receitas
    const receitasPagas = lancamentos
      .filter(l => l.tipo === 'receita' && l.status === 'pago')
      .reduce((acc, l) => acc + l.valor, 0);

    const receitasPendentes = lancamentos
      .filter(l => l.tipo === 'receita' && l.status === 'pendente')
      .reduce((acc, l) => acc + l.valor, 0);

    const receitaTotalPrevista = Math.max(projeto.valor_contratado, receitasPagas + receitasPendentes);
    const receitaAReceber = Math.max(0, projeto.valor_contratado - receitasPagas);

    // Custos (Despesas)
    const custosRealizados = lancamentos
      .filter(l => l.tipo === 'despesa' && l.status === 'pago')
      .reduce((acc, l) => acc + l.valor, 0);

    const custosPendentes = lancamentos
      .filter(l => l.tipo === 'despesa' && l.status === 'pendente')
      .reduce((acc, l) => acc + l.valor, 0);

    const custosTotaisPrevistos = +(custosRealizados + custosPendentes).toFixed(2);

    // Lucros e Margens
    const lucroRealizado = +(receitasPagas - custosRealizados).toFixed(2);
    const margemRealizada = receitasPagas > 0 
      ? +((lucroRealizado / receitasPagas) * 100).toFixed(1) 
      : 0;

    const lucroPrevisto = +(projeto.valor_contratado - custosTotaisPrevistos).toFixed(2);
    const margemPrevista = projeto.valor_contratado > 0 
      ? +((lucroPrevisto / projeto.valor_contratado) * 100).toFixed(1) 
      : 0;

    const percentualRecebido = projeto.valor_contratado > 0 
      ? +Math.min(100, (receitasPagas / projeto.valor_contratado) * 100).toFixed(1)
      : 0;

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
  }

  /**
   * Resumo Financeiro de Todos os Projetos
   */
  obterResumoTodosProjetos() {
    const projetos = this.getProjetos();
    const fichas = projetos.map(p => this.obterFichaProjeto(p.id)!).filter(Boolean);

    const totalContratado = fichas.reduce((acc, f) => acc + f.valorContratado, 0);
    const totalRecebido = fichas.reduce((acc, f) => acc + f.receitasPagas, 0);
    const totalAReceber = fichas.reduce((acc, f) => acc + f.receitaAReceber, 0);
    const totalCustosRealizados = fichas.reduce((acc, f) => acc + f.custosRealizados, 0);
    const totalLucroRealizado = +(totalRecebido - totalCustosRealizados).toFixed(2);
    const margemMediaRealizada = totalRecebido > 0 
      ? +((totalLucroRealizado / totalRecebido) * 100).toFixed(1) 
      : 0;

    return {
      fichas,
      totalContratado: +totalContratado.toFixed(2),
      totalRecebido: +totalRecebido.toFixed(2),
      totalAReceber: +totalAReceber.toFixed(2),
      totalCustosRealizados: +totalCustosRealizados.toFixed(2),
      totalLucroRealizado,
      margemMediaRealizada,
    };
  }

  /**
   * Resumo de Histórico e Saldo por Contato (Cliente ou Fornecedor)
   */
  obterHistoricoContato(contatoId: string) {
    const contato = this.getContatos().find(c => c.id === contatoId);
    if (!contato) return null;

    const lancamentos = this.getLancamentos().filter(
      l => l.contato_id === contatoId && l.origem !== 'transferencia'
    );

    const hoje = new Date().toISOString().split('T')[0];

    const pagos = lancamentos.filter(l => l.status === 'pago');
    const pendentes = lancamentos.filter(l => l.status === 'pendente');

    const totalRecebido = pagos.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
    const totalPago = pagos.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);

    const aReceberPendente = pendentes.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
    const aPagarPendente = pendentes.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);

    const inadimplenteReceber = pendentes
      .filter(l => l.tipo === 'receita' && l.data_vencimento < hoje)
      .reduce((a, b) => a + b.valor, 0);

    const emAtrasoPagar = pendentes
      .filter(l => l.tipo === 'despesa' && l.data_vencimento < hoje)
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
  }

  // ==========================================
  // RELATÓRIOS FINANCEIROS GERENCIAIS MT SOLAR
  // ==========================================

  /**
   * 1. DRE Simplificado Gerencial
   */
  gerarRelatorioDRE(dataIni?: string, dataFim?: string) {
    const todos = this.getLancamentos().filter(
      l => l.status === 'pago' && l.origem !== 'transferencia'
    );
    const categorias = this.getCategorias();

    const filtrados = todos.filter(l => {
      const dt = l.data_pagamento || l.data_vencimento;
      if (dataIni && dt < dataIni) return false;
      if (dataFim && dt > dataFim) return false;
      return true;
    });

    const mapaReceitas = new Map<string, number>();
    const mapaDespesas = new Map<string, number>();
    let receitaTotal = 0;
    let despesaTotal = 0;

    filtrados.forEach(l => {
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

    const linhasReceitas = Array.from(mapaReceitas.entries()).map(([catId, val]) => {
      const cat = categorias.find(c => c.id === catId);
      return {
        categoriaId: catId,
        nome: cat ? cat.nome : 'Outras Receitas',
        cor: cat?.cor || '#16A34A',
        valor: +val.toFixed(2),
        percentualReceita: receitaTotal > 0 ? +((val / receitaTotal) * 100).toFixed(1) : 0,
      };
    }).sort((a, b) => b.valor - a.valor);

    const linhasDespesas = Array.from(mapaDespesas.entries()).map(([catId, val]) => {
      const cat = categorias.find(c => c.id === catId);
      return {
        categoriaId: catId,
        nome: cat ? cat.nome : 'Outras Despesas',
        cor: cat?.cor || '#DC2626',
        valor: +val.toFixed(2),
        percentualReceita: receitaTotal > 0 ? +((val / receitaTotal) * 100).toFixed(1) : 0,
      };
    }).sort((a, b) => b.valor - a.valor);

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
  }

  /**
   * 2. Fluxo de Caixa: Realizado vs Previsto (Mensal e Diário)
   */
  gerarRelatorioFluxoCaixa(ano?: number) {
    const hoje = new Date();
    const anoAlvo = ano || hoje.getFullYear();
    const todos = this.getLancamentos().filter(l => l.status !== 'cancelado' && l.origem !== 'transferencia');
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const meses = [];
    for (let m = 0; m < 12; m++) {
      const mesStr = String(m + 1).padStart(2, '0');
      const prefixo = `${anoAlvo}-${mesStr}`;
      
      let realizadoEntradas = 0;
      let realizadoSaidas = 0;
      let previstoEntradas = 0;
      let previstoSaidas = 0;

      todos.forEach(l => {
        const dtRealizada = l.data_pagamento;
        const dtVenc = l.data_vencimento;

        // Realizado
        if (l.status === 'pago' && dtRealizada && dtRealizada.startsWith(prefixo)) {
          if (l.tipo === 'receita') realizadoEntradas += l.valor;
          else realizadoSaidas += l.valor;
        }

        // Previsto (tudo que venceu ou vence no mês)
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
  }

  /**
   * 4. Lucratividade por Projeto
   */
  gerarRelatorioLucratividadeProjetos() {
    return this.obterResumoTodosProjetos();
  }

  /**
   * 5. Quem mais nos deve e a quem mais devemos (com Inadimplência)
   */
  gerarRelatorioInadimplenciaContatos() {
    const contatos = this.getContatos();
    const hoje = new Date().toISOString().split('T')[0];
    const lancamentos = this.getLancamentos().filter(
      l => l.status === 'pendente' && l.origem !== 'transferencia'
    );

    const devedoresMap = new Map<string, { nome: string; cpfCnpj: string; totalDevido: number; totalVencido: number; diasMaiorAtraso: number; parcelasVencidas: number }>();
    const credoresMap = new Map<string, { nome: string; cpfCnpj: string; totalDevido: number; totalVencido: number; parcelasPendentes: number }>();

    lancamentos.forEach(l => {
      const contato = contatos.find(c => c.id === l.contato_id) || {
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
      .filter(d => d.totalDevido > 0)
      .sort((a, b) => b.totalVencido !== a.totalVencido ? b.totalVencido - a.totalVencido : b.totalDevido - a.totalDevido);

    const aQuemDevemos = Array.from(credoresMap.values())
      .filter(c => c.totalDevido > 0)
      .sort((a, b) => b.totalVencido !== a.totalVencido ? b.totalVencido - a.totalVencido : b.totalDevido - a.totalDevido);

    return {
      quemNosDeve,
      aQuemDevemos,
      totalInadimplenciaReceber: quemNosDeve.reduce((acc, q) => acc + q.totalVencido, 0),
      totalVencidoPagar: aQuemDevemos.reduce((acc, q) => acc + q.totalVencido, 0),
    };
  }

  /**
   * 6. Uso do Cheque Especial no Período
   * Dias no negativo, maior valor utilizado, custo estimado de juros no período.
   */
  gerarRelatorioChequeEspecial(dataIni?: string, dataFim?: string) {
    const contas = this.getContas().filter(c => c.ativa);
    const lancamentos = this.getLancamentos().filter(l => l.status === 'pago');

    // Determina o intervalo de datas analisado
    const hoje = new Date();
    const fim = dataFim ? new Date(dataFim + 'T12:00:00') : hoje;
    const inicio = dataIni 
      ? new Date(dataIni + 'T12:00:00') 
      : new Date(fim.getFullYear(), fim.getMonth() - 1, 1);

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

    // Para cada conta, simular dia a dia a evolução do saldo
    contas.forEach(conta => {
      const resumo = this.calcularResumoConta(conta);
      const taxaMensal = conta.taxa_juros_cheque_especial_mensal || 8.0;
      const taxaDiaria = (taxaMensal / 100) / 30;

      let saldoSimulado = conta.saldo_inicial;
      let diasNegConta = 0;
      let picoConta = 0;
      let jurosConta = 0;

      // Percorre os dias do período
      const cursor = new Date(inicio);
      while (cursor <= fim) {
        const diaIso = cursor.toISOString().split('T')[0];

        // Se o cursor for igual à data do saldo inicial ou posterior, calcula lançamentos até essa data
        const lDia = lancamentos.filter(
          l => l.conta_id === conta.id && (l.data_pagamento || l.data_vencimento) <= diaIso
        );
        const rec = lDia.filter(l => l.tipo === 'receita').reduce((a, b) => a + b.valor, 0);
        const des = lDia.filter(l => l.tipo === 'despesa').reduce((a, b) => a + b.valor, 0);
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
      }
    };
  }

  /**
   * 7. Funcionários: Custo por Funcionário, por Setor e Folha ao Longo do Ano
   */
  gerarRelatorioFuncionariosFolha(ano?: number) {
    const anoAlvo = ano || new Date().getFullYear();
    const funcionarios = this.getFuncionarios();
    const folha = this.getLancamentosFolha();

    // Custo por Funcionário
    const porFuncionario = funcionarios.map(f => {
      const calc = this.calcularCustoTotalFuncionario(f);
      return {
        funcionario: f,
        salarioBase: f.salario_base,
        remuneracaoBruta: calc.remuneracaoBruta,
        beneficios: calc.totalBeneficios,
        encargosProvisoes: calc.totalEncargosProvisoes,
        custoTotalMensal: calc.custoTotalMensal,
      };
    }).sort((a, b) => b.custoTotalMensal - a.custoTotalMensal);

    // Custo por Setor
    const setorMap = new Map<string, { setor: string; qtd: number; totalCusto: number; totalBase: number }>();
    porFuncionario.forEach(item => {
      const s = item.funcionario.setor;
      const at = setorMap.get(s) || { setor: s, qtd: 0, totalCusto: 0, totalBase: 0 };
      at.qtd += 1;
      at.totalCusto += item.custoTotalMensal;
      at.totalBase += item.salarioBase;
      setorMap.set(s, at);
    });
    const porSetor = Array.from(setorMap.values()).sort((a, b) => b.totalCusto - a.totalCusto);

    // Folha Mensal ao Longo do Ano (12 meses)
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const folhaMensalAno = [];

    for (let m = 0; m < 12; m++) {
      const mesPad = String(m + 1).padStart(2, '0');
      const comp = `${mesPad}/${anoAlvo}`;
      
      const eventosMes = folha.filter(l => l.competencia === comp);
      const proventos = eventosMes.filter(l => l.tipo_operacao === 'provento').reduce((a, b) => a + b.valor, 0);
      const descontos = eventosMes.filter(l => l.tipo_operacao === 'desconto').reduce((a, b) => a + b.valor, 0);
      const totalLiquido = Math.max(0, +(proventos - descontos).toFixed(2));

      folhaMensalAno.push({
        mesIndex: m + 1,
        mesNome: mesesNomes[m],
        rotulo: `${mesesNomes[m]}/${String(anoAlvo).slice(2)}`,
        competencia: comp,
        totalPago: eventosMes.filter(ev => ev.status === 'pago').reduce((acc, ev) => acc + (ev.tipo_operacao === 'provento' ? ev.valor : -ev.valor), 0),
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
  }

  /**
   * 8. Comparativo Mês a Mês
   */
  gerarRelatorioComparativoMesAMes(ano?: number) {
    const anoAlvo = ano || new Date().getFullYear();
    const dadosAno = this.gerarRelatorioFluxoCaixa(anoAlvo);
    
    const meses = dadosAno.meses.map((m, idx, array) => {
      const mesAnterior = idx > 0 ? array[idx - 1] : null;
      const variacaoReceitas = mesAnterior && mesAnterior.realizadoEntradas > 0
        ? +(((m.realizadoEntradas - mesAnterior.realizadoEntradas) / mesAnterior.realizadoEntradas) * 100).toFixed(1)
        : 0;
      const variacaoDespesas = mesAnterior && mesAnterior.realizadoSaidas > 0
        ? +(((m.realizadoSaidas - mesAnterior.realizadoSaidas) / mesAnterior.realizadoSaidas) * 100).toFixed(1)
        : 0;

      return {
        ...m,
        variacaoReceitas,
        variacaoDespesas,
      };
    });

    return { ano: anoAlvo, meses };
  }

  // ==========================================
  // MÓDULO DE FUNCIONÁRIOS & FOLHA DE PAGAMENTO
  // ==========================================

  getFuncionarios(): Funcionario[] {
    const raw = localStorage.getItem(STORAGE_KEYS.FUNCIONARIOS);
    return raw ? JSON.parse(raw) : FUNCIONARIOS_PADRAO;
  }

  saveFuncionario(funcionario: Funcionario): Funcionario {
    const funcionarios = this.getFuncionarios();
    const index = funcionarios.findIndex(f => f.id === funcionario.id);
    const acao = index >= 0 ? 'edicao' : 'criacao';

    if (index >= 0) {
      funcionarios[index] = funcionario;
    } else {
      funcionarios.push(funcionario);
    }
    localStorage.setItem(STORAGE_KEYS.FUNCIONARIOS, JSON.stringify(funcionarios));
    notify('funcionarios');

    this.registrarAlteracao(
      'funcionarios',
      acao,
      `${acao === 'criacao' ? 'Cadastro de novo' : 'Atualização de'} colaborador: ${funcionario.nome}`,
      `Cargo: ${funcionario.cargo} (${funcionario.setor}) • Salário Base: R$ ${funcionario.salario_base.toFixed(2)}`
    );

    return funcionario;
  }

  deleteFuncionario(id: string): { sucesso: boolean; mensagem?: string } {
    const folha = this.getLancamentosFolha();
    const temLancamentos = folha.some(l => l.funcionario_id === id);
    if (temLancamentos) {
      return {
        sucesso: false,
        mensagem: 'Não é possível excluir funcionário com histórico de pagamentos ou eventos de folha. Altere o status para "Desligado".'
      };
    }
    const funcionarios = this.getFuncionarios();
    const func = funcionarios.find(f => f.id === id);
    const filtrados = funcionarios.filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEYS.FUNCIONARIOS, JSON.stringify(filtrados));
    notify('funcionarios');

    if (func) {
      this.registrarAlteracao(
        'funcionarios',
        'exclusao',
        `Excluído colaborador: ${func.nome}`,
        `Cargo: ${func.cargo} (${func.setor})`
      );
    }

    return { sucesso: true };
  }

  getLancamentosFolha(): LancamentoFolha[] {
    const raw = localStorage.getItem(STORAGE_KEYS.LANCAMENTOS_FOLHA);
    return raw ? JSON.parse(raw) : [];
  }

  saveLancamentoFolha(folha: LancamentoFolha): LancamentoFolha {
    const todos = this.getLancamentosFolha();
    const index = todos.findIndex(l => l.id === folha.id);

    // Sincronizar com a tabela de lançamentos / contas a pagar
    const funcionarios = this.getFuncionarios();
    const func = funcionarios.find(f => f.id === folha.funcionario_id);
    const nomeFunc = func ? func.nome : 'Colaborador';

    const lancamentoDespesaId = folha.lancamento_id || ('lanc-folha-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6));
    folha.lancamento_id = lancamentoDespesaId;

    const lancamentos = this.getLancamentos();
    const lancIndex = lancamentos.findIndex(l => l.id === lancamentoDespesaId);

    const despesaVinculada: Lancamento = {
      id: lancamentoDespesaId,
      tipo: 'despesa',
      descricao: `Folha: ${folha.descricao} – ${nomeFunc} (${folha.competencia})`,
      valor: folha.valor,
      data_vencimento: folha.data_prevista,
      data_pagamento: folha.data_pagamento,
      status: folha.status,
      conta_id: folha.conta_id,
      categoria_id: 'cat-des-4', // Salários
      origem: 'folha',
      funcionario_id: folha.funcionario_id,
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      observacoes: folha.observacoes,
      criado_em: folha.criado_em || new Date().toISOString(),
    };

    if (lancIndex >= 0) {
      lancamentos[lancIndex] = despesaVinculada;
    } else {
      lancamentos.unshift(despesaVinculada);
    }
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));

    if (index >= 0) {
      todos[index] = folha;
    } else {
      todos.unshift(folha);
    }
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS_FOLHA, JSON.stringify(todos));

    notify('lancamentos_folha');
    notify('lancamentos');
    notify('contas');
    return folha;
  }

  deleteLancamentoFolha(id: string): void {
    const todos = this.getLancamentosFolha();
    const alvo = todos.find(l => l.id === id);
    const filtrados = todos.filter(l => l.id !== id);
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS_FOLHA, JSON.stringify(filtrados));

    if (alvo?.lancamento_id) {
      const lancamentos = this.getLancamentos().filter(l => l.id !== alvo.lancamento_id);
      localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));
      notify('lancamentos');
      notify('contas');
    }

    notify('lancamentos_folha');
  }

  liquidarLancamentoFolha(id: string, contaId: string, dataPagamento?: string): void {
    const todos = this.getLancamentosFolha();
    const index = todos.findIndex(l => l.id === id);
    if (index < 0) return;

    const dataEfetiva = dataPagamento || new Date().toISOString().split('T')[0];
    todos[index] = {
      ...todos[index],
      status: 'pago',
      conta_id: contaId,
      data_pagamento: dataEfetiva,
    };
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS_FOLHA, JSON.stringify(todos));

    // Atualiza também o lançamento correspondente no caixa
    if (todos[index].lancamento_id) {
      const lancamentos = this.getLancamentos();
      const lancIdx = lancamentos.findIndex(l => l.id === todos[index].lancamento_id);
      if (lancIdx >= 0) {
        lancamentos[lancIdx] = {
          ...lancamentos[lancIdx],
          status: 'pago',
          conta_id: contaId,
          data_pagamento: dataEfetiva,
        };
        localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(lancamentos));
      }
    }

    notify('lancamentos_folha');
    notify('lancamentos');
    notify('contas');
  }

  adicionarOcorrencia(funcionarioId: string, ocorrencia: OcorrenciaFuncionario): void {
    const funcionarios = this.getFuncionarios();
    const idx = funcionarios.findIndex(f => f.id === funcionarioId);
    if (idx < 0) return;

    const f = funcionarios[idx];
    const ocorrencias = f.ocorrencias ? [...f.ocorrencias] : [];
    ocorrencias.unshift(ocorrencia);
    funcionarios[idx] = { ...f, ocorrencias };
    localStorage.setItem(STORAGE_KEYS.FUNCIONARIOS, JSON.stringify(funcionarios));
    notify('funcionarios');
  }

  calcularCustoTotalFuncionario(f: Funcionario) {
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
  }

  obterFichaFinanceira(funcionarioId: string) {
    const todos = this.getLancamentosFolha().filter(l => l.funcionario_id === funcionarioId);
    todos.sort((a, b) => (b.data_pagamento || b.data_prevista).localeCompare(a.data_pagamento || a.data_prevista));

    const hoje = new Date();
    const anoAtualStr = String(hoje.getFullYear());
    const mesAtualStr = String(hoje.getMonth() + 1).padStart(2, '0');
    const compAtual = `${mesAtualStr}/${anoAtualStr}`;

    const totaisPorTipo: Record<string, number> = {};
    let saldoAdiantamentosAberto = 0;
    let totalPagoMes = 0;
    let totalPagoAno = 0;

    todos.forEach(l => {
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
  }

  gerarFolhaDoMes(competencia: string, dataVencimento: string, contaId: string) {
    const funcionarios = this.getFuncionarios().filter(f => f.status === 'ativo');
    const folhaAtual = this.getLancamentosFolha();
    let gerados = 0;
    let totalValor = 0;

    funcionarios.forEach(func => {
      // Verifica se já existe salário gerado para este funcionário nesta competência
      const jaExiste = folhaAtual.some(
        l => l.funcionario_id === func.id && l.competencia === competencia && l.tipo === 'salario'
      );
      if (jaExiste) return;

      const calc = this.calcularCustoTotalFuncionario(func);

      // Checar se há adiantamentos em aberto para este funcionário
      const adiantamentosAberto = folhaAtual.filter(
        l => l.funcionario_id === func.id && l.tipo === 'adiantamento' && !l.descontado_em_folha && l.status === 'pago'
      );
      const totalDescontoAdiantamento = adiantamentosAberto.reduce((acc, a) => acc + a.valor, 0);

      const valorLiquido = Math.max(0, +(calc.remuneracaoBruta - totalDescontoAdiantamento).toFixed(2));

      const novoLancamentoFolha: LancamentoFolha = {
        id: 'folha-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        funcionario_id: func.id,
        tipo: 'salario',
        descricao: `Salário Mensal ${func.cargo} (Líquido)`,
        competencia,
        valor: valorLiquido,
        tipo_operacao: 'provento',
        data_prevista: dataVencimento,
        data_pagamento: null,
        status: 'pendente',
        conta_id: contaId,
        observacoes: totalDescontoAdiantamento > 0
          ? `Salário Bruto: R$ ${calc.remuneracaoBruta.toFixed(2)} com dedução de R$ ${totalDescontoAdiantamento.toFixed(2)} em adiantamentos.`
          : `Salário Base: R$ ${func.salario_base.toFixed(2)} + Adicionais: R$ ${calc.adicionalValor.toFixed(2)}`,
        criado_em: new Date().toISOString(),
      };

      this.saveLancamentoFolha(novoLancamentoFolha);

      // Marca adiantamentos como descontados
      if (totalDescontoAdiantamento > 0) {
        adiantamentosAberto.forEach(ad => {
          ad.descontado_em_folha = true;
          this.saveLancamentoFolha(ad);
        });
      }

      gerados++;
      totalValor += valorLiquido;
    });

    return { gerados, totalValor: +totalValor.toFixed(2) };
  }

  liquidarFolhaEmLote(folhaIds: string[], contaId: string, dataPagamento: string): { quitados: number; total: number } {
    const todos = this.getLancamentosFolha();
    let quitados = 0;
    let total = 0;

    folhaIds.forEach(id => {
      const idx = todos.findIndex(l => l.id === id);
      if (idx >= 0 && todos[idx].status !== 'pago') {
        this.liquidarLancamentoFolha(id, contaId, dataPagamento);
        quitados++;
        total += todos[idx].valor;
      }
    });

    return { quitados, total: +total.toFixed(2) };
  }

  // Restaurar dados originais de demonstração
  restaurarDadosPadrao() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(CATEGORIAS_PADRAO));
    localStorage.setItem(STORAGE_KEYS.CONTAS, JSON.stringify(CONTAS_PADRAO));
    localStorage.setItem(STORAGE_KEYS.CONTATOS, JSON.stringify(CONTATOS_PADRAO));
    localStorage.setItem(STORAGE_KEYS.PROJETOS, JSON.stringify(PROJETOS_PADRAO));
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(LANCAMENTOS_PADRAO));
    localStorage.setItem(STORAGE_KEYS.CONFIGURACOES, JSON.stringify(CONFIGURACOES_PADRAO));
    localStorage.setItem(STORAGE_KEYS.USUARIOS, JSON.stringify(USUARIOS_PADRAO));
    localStorage.setItem(STORAGE_KEYS.USUARIO_ATUAL, JSON.stringify(USUARIOS_PADRAO[0]));
    localStorage.setItem(STORAGE_KEYS.FUNCIONARIOS, JSON.stringify(FUNCIONARIOS_PADRAO));
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS_FOLHA, JSON.stringify(gerarLancamentosFolhaPadrao()));
    
    notify('contas');
    notify('lancamentos');
    notify('categorias');
    notify('contatos');
    notify('projetos');
    notify('configuracoes');
    notify('usuarios');
    notify('auth');
    notify('funcionarios');
    notify('lancamentos_folha');
  }

  // ==========================================
  // HISTÓRICO DE ALTERAÇÕES & AUDITORIA
  // ==========================================
  getHistoricoAlteracoes(): RegistroAuditoria[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HISTORICO);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  registrarAlteracao(
    modulo: RegistroAuditoria['modulo'],
    acao: RegistroAuditoria['acao'],
    descricao: string,
    detalhes?: string
  ): void {
    try {
      let usuarioNome = 'Administrador';
      let usuarioEmail = 'admin@mtsolar.com.br';
      try {
        const rawUser = localStorage.getItem(STORAGE_KEYS.USUARIO_ATUAL);
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (u.nome) usuarioNome = u.nome;
          if (u.email) usuarioEmail = u.email;
        }
      } catch (e) {}

      const historico = this.getHistoricoAlteracoes();
      const novoRegistro: RegistroAuditoria = {
        id: 'aud-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        data_hora: new Date().toISOString(),
        usuario_nome: usuarioNome,
        usuario_email: usuarioEmail,
        modulo,
        acao,
        descricao,
        detalhes,
      };

      historico.unshift(novoRegistro);
      const limitados = historico.slice(0, 400);
      localStorage.setItem(STORAGE_KEYS.HISTORICO, JSON.stringify(limitados));
      notify('historico');
    } catch (err) {
      console.warn('Falha ao gravar auditoria:', err);
    }
  }

  limparHistoricoAlteracoes(): void {
    localStorage.removeItem(STORAGE_KEYS.HISTORICO);
    notify('historico');
  }

  // ==========================================
  // BACKUP COMPLETO (EXPORTAÇÃO & IMPORTAÇÃO JSON)
  // ==========================================
  exportarBackupCompletoJSON(): string {
    const backup = {
      app: 'MT Solar - Gestão Financeira Empresarial',
      versao: '1.0.0',
      data_exportacao: new Date().toISOString(),
      timestamp: Date.now(),
      contas: this.getContas(),
      categorias: this.getCategorias(),
      contatos: this.getContatos(),
      projetos: this.getProjetos(),
      lancamentos: this.getLancamentos(),
      funcionarios: this.getFuncionarios(),
      lancamentos_folha: this.getLancamentosFolha(),
      usuarios: this.getUsuariosAutorizados(),
      configuracoes: this.getConfiguracoes(),
      historico: this.getHistoricoAlteracoes(),
    };
    return JSON.stringify(backup, null, 2);
  }

  importarBackupCompletoJSON(jsonString: string): {
    sucesso: boolean;
    mensagem: string;
    estatisticas?: {
      contas: number;
      lancamentos: number;
      funcionarios: number;
      projetos: number;
      contatos: number;
      categorias: number;
    };
  } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { sucesso: false, mensagem: 'Arquivo JSON inválido ou vazio.' };
      }

      const dados = parsed.dados || parsed;

      if (!Array.isArray(dados.contas) && !Array.isArray(dados.lancamentos)) {
        return {
          sucesso: false,
          mensagem: 'O arquivo não contém os dados esperados do backup MT Solar (contas ou lançamentos ausentes).'
        };
      }

      if (Array.isArray(dados.contas)) {
        localStorage.setItem(STORAGE_KEYS.CONTAS, JSON.stringify(dados.contas));
      }
      if (Array.isArray(dados.categorias)) {
        localStorage.setItem(STORAGE_KEYS.CATEGORIAS, JSON.stringify(dados.categorias));
      }
      if (Array.isArray(dados.contatos)) {
        localStorage.setItem(STORAGE_KEYS.CONTATOS, JSON.stringify(dados.contatos));
      }
      if (Array.isArray(dados.projetos)) {
        localStorage.setItem(STORAGE_KEYS.PROJETOS, JSON.stringify(dados.projetos));
      }
      if (Array.isArray(dados.lancamentos)) {
        localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify(dados.lancamentos));
      }
      if (Array.isArray(dados.funcionarios)) {
        localStorage.setItem(STORAGE_KEYS.FUNCIONARIOS, JSON.stringify(dados.funcionarios));
      }
      if (Array.isArray(dados.lancamentos_folha)) {
        localStorage.setItem(STORAGE_KEYS.LANCAMENTOS_FOLHA, JSON.stringify(dados.lancamentos_folha));
      }
      if (Array.isArray(dados.usuarios)) {
        localStorage.setItem(STORAGE_KEYS.USUARIOS, JSON.stringify(dados.usuarios));
      }
      if (dados.configuracoes && typeof dados.configuracoes === 'object') {
        localStorage.setItem(STORAGE_KEYS.CONFIGURACOES, JSON.stringify(dados.configuracoes));
      }
      if (Array.isArray(dados.historico)) {
        localStorage.setItem(STORAGE_KEYS.HISTORICO, JSON.stringify(dados.historico));
      }

      notify('contas');
      notify('lancamentos');
      notify('categorias');
      notify('contatos');
      notify('projetos');
      notify('funcionarios');
      notify('lancamentos_folha');
      notify('configuracoes');
      notify('usuarios');
      notify('historico');

      const stats = {
        contas: Array.isArray(dados.contas) ? dados.contas.length : 0,
        lancamentos: Array.isArray(dados.lancamentos) ? dados.lancamentos.length : 0,
        funcionarios: Array.isArray(dados.funcionarios) ? dados.funcionarios.length : 0,
        projetos: Array.isArray(dados.projetos) ? dados.projetos.length : 0,
        contatos: Array.isArray(dados.contatos) ? dados.contatos.length : 0,
        categorias: Array.isArray(dados.categorias) ? dados.categorias.length : 0,
      };

      this.registrarAlteracao(
        'sistema',
        'importacao',
        'Restauração de Backup JSON realizada com sucesso',
        `Importados: ${stats.lancamentos} lançamentos, ${stats.funcionarios} colaboradores, ${stats.projetos} projetos, ${stats.contas} contas bancárias.`
      );

      return {
        sucesso: true,
        mensagem: 'Backup importado com sucesso! Todos os dados operacionais foram restaurados.',
        estatisticas: stats
      };
    } catch (e: any) {
      return {
        sucesso: false,
        mensagem: `Erro ao importar arquivo JSON: ${e?.message || 'Formato incompatível'}`
      };
    }
  }

  // ==========================================
  // MODO DEMONSTRAÇÃO
  // ==========================================
  isModoDemonstracao(): boolean {
    return localStorage.getItem(STORAGE_KEYS.MODO_DEMO) === 'true';
  }

  carregarModoDemonstracao(): void {
    localStorage.setItem(STORAGE_KEYS.MODO_DEMO, 'true');
    this.restaurarDadosPadrao();
    this.registrarAlteracao(
      'sistema',
      'reset',
      'Modo Demonstração carregado',
      'Carregada base completa com projetos solares, lançamentos operacionais, contas com limite e folha de pagamento.'
    );
    notify('modo_demo');
  }

  limparDadosDemonstracao(): void {
    localStorage.removeItem(STORAGE_KEYS.MODO_DEMO);
    // Base zerada limpa para operação real
    const contaPadrao: ContaBancaria = {
      id: 'conta-real-1',
      nome: 'Conta Corrente Principal',
      banco: 'Sicoob MT',
      tipo: 'corrente',
      saldo_inicial: 0,
      data_saldo_inicial: new Date().toISOString().split('T')[0],
      limite_cheque_especial: 20000,
      taxa_juros_cheque_especial_mensal: 7.9,
      cor: '#003064',
      ativa: true,
      criado_em: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.CONTAS, JSON.stringify([contaPadrao]));
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.PROJETOS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.CONTATOS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.FUNCIONARIOS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LANCAMENTOS_FOLHA, JSON.stringify([]));

    notify('contas');
    notify('lancamentos');
    notify('projetos');
    notify('contatos');
    notify('funcionarios');
    notify('lancamentos_folha');
    notify('modo_demo');

    this.registrarAlteracao(
      'sistema',
      'reset',
      'Dados de demonstração removidos',
      'Sistema limpo para início de lançamentos reais.'
    );
  }

  // ==========================================
  // CENTRAL DE ALERTAS INTELIGENTES DO APP
  // ==========================================
  obterAlertas(): AlertaItem[] {
    const alertas: AlertaItem[] = [];
    const hoje = new Date().toISOString().split('T')[0];

    const dataAmanha = new Date();
    dataAmanha.setDate(dataAmanha.getDate() + 1);
    const amanha = dataAmanha.toISOString().split('T')[0];

    const lancamentos = this.getLancamentos();
    const pendentes = lancamentos.filter(l => l.status === 'pendente');

    // 1. Contas a Pagar em Atraso (Despesas)
    const pagarAtrasadas = pendentes.filter(l => l.tipo === 'despesa' && l.data_vencimento < hoje);
    if (pagarAtrasadas.length > 0) {
      const totalAtrasado = pagarAtrasadas.reduce((acc, l) => acc + l.valor, 0);
      alertas.push({
        id: 'alerta-pagar-atrasadas',
        tipo: 'atrasada',
        severidade: 'critico',
        titulo: `${pagarAtrasadas.length} despesa${pagarAtrasadas.length > 1 ? 's' : ''} em atraso`,
        descricao: `Total de R$ ${totalAtrasado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} vencido pendente de pagamento.`,
        data: hoje,
        linkPagina: 'pagar',
      });
    }

    // 2. Contas a Receber em Atraso (Inadimplência de Clientes)
    const receberAtrasadas = pendentes.filter(l => l.tipo === 'receita' && l.data_vencimento < hoje);
    if (receberAtrasadas.length > 0) {
      const totalReceberAtrasado = receberAtrasadas.reduce((acc, l) => acc + l.valor, 0);
      alertas.push({
        id: 'alerta-receber-atrasadas',
        tipo: 'atrasada',
        severidade: 'aviso',
        titulo: `${receberAtrasadas.length} recebimento${receberAtrasadas.length > 1 ? 's' : ''} em atraso`,
        descricao: `Títulos vencidos de clientes somando R$ ${totalReceberAtrasado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        data: hoje,
        linkPagina: 'receber',
      });
    }

    // 3. Contas a Pagar Vencendo HOJE
    const pagarHoje = pendentes.filter(l => l.tipo === 'despesa' && l.data_vencimento === hoje);
    if (pagarHoje.length > 0) {
      const totalPagarHoje = pagarHoje.reduce((acc, l) => acc + l.valor, 0);
      alertas.push({
        id: 'alerta-pagar-hoje',
        tipo: 'vencendo_hoje',
        severidade: 'critico',
        titulo: `${pagarHoje.length} conta${pagarHoje.length > 1 ? 's' : ''} a pagar vence${pagarHoje.length > 1 ? 'm' : ''} HOJE`,
        descricao: `Compromissos do dia totalizam R$ ${totalPagarHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        data: hoje,
        linkPagina: 'pagar',
      });
    }

    // 4. Contas a Pagar Vencendo AMANHÃ
    const pagarAmanha = pendentes.filter(l => l.tipo === 'despesa' && l.data_vencimento === amanha);
    if (pagarAmanha.length > 0) {
      const totalPagarAmanha = pagarAmanha.reduce((acc, l) => acc + l.valor, 0);
      alertas.push({
        id: 'alerta-pagar-amanha',
        tipo: 'vencendo_amanha',
        severidade: 'aviso',
        titulo: `${pagarAmanha.length} conta${pagarAmanha.length > 1 ? 's' : ''} vence${pagarAmanha.length > 1 ? 'm' : ''} amanhã`,
        descricao: `Programadas para amanhã: R$ ${totalPagarAmanha.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
        data: amanha,
        linkPagina: 'pagar',
      });
    }

    // 5. Saldo Real Negativo Consolidado
    const resumoConsolidado = this.calcularResumoGeral();
    if (resumoConsolidado.saldoRealTotal < 0) {
      alertas.push({
        id: 'alerta-saldo-negativo',
        tipo: 'saldo_negativo',
        severidade: 'critico',
        titulo: 'Saldo Real Negativo no Caixa',
        descricao: `Operando com R$ ${resumoConsolidado.chequeEspecialUsadoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} do cheque especial.`,
        linkPagina: 'painel',
      });
    }

    // 6. Projeção Financeira Negativa (30 Dias)
    try {
      const projecao = this.calcularProjecaoSaldoReal(30);
      const diaNegativo = projecao.pontos.find((p: any) => p.saldoProjetado < 0);
      if (diaNegativo && resumoConsolidado.saldoRealTotal >= 0) {
        const dataFmt = diaNegativo.data.split('-').reverse().slice(0, 2).join('/');
        alertas.push({
          id: 'alerta-projecao-negativa',
          tipo: 'projecao_negativa',
          severidade: 'aviso',
          titulo: `Projeção Negativa Prevista em ${dataFmt}`,
          descricao: `Seu saldo real ficará negativo em ${dataFmt}, usando R$ ${diaNegativo.chequeUsado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} do cheque especial.`,
          data: diaNegativo.data,
          linkPagina: 'painel',
        });
      }
    } catch (e) {}

    // 7. Férias de Funcionários Vencendo
    const funcionarios = this.getFuncionarios().filter(f => f.status === 'ativo');
    funcionarios.forEach(func => {
      if (func.data_admissao) {
        const adm = new Date(func.data_admissao);
        const agora = new Date();
        const diffMeses = (agora.getFullYear() - adm.getFullYear()) * 12 + (agora.getMonth() - adm.getMonth());
        if (diffMeses >= 11) {
          const temFeriasRecentes = func.ocorrencias?.some(o => o.tipo === 'outro' && o.descricao.toLowerCase().includes('férias'));
          if (!temFeriasRecentes) {
            alertas.push({
              id: `alerta-ferias-${func.id}`,
              tipo: 'ferias_vencendo',
              severidade: 'info',
              titulo: `Férias a Conceder: ${func.nome}`,
              descricao: `Colaborador com ${diffMeses} meses de empresa. Agendar período de descanso para evitar dobra legal.`,
              linkPagina: 'funcionarios',
            });
          }
        }
      }
    });

    return alertas;
  }
}

export const dbService = new StorageService();
