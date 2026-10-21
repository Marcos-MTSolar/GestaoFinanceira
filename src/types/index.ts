import type { ItemManualBalanco } from '../utils/balanco';

export type TipoLancamento = 'receita' | 'despesa';

export type StatusLancamento = 'pendente' | 'pago' | 'cancelado';

export type FormaPagamento = 
  | 'PIX' 
  | 'boleto' 
  | 'transferencia' 
  | 'cartao' 
  | 'dinheiro' 
  | 'cheque';

export type TipoConta = 'corrente' | 'poupanca' | 'caixa_fisico' | 'cartao';

export type TipoContato = 'cliente' | 'fornecedor' | 'ambos';

export type StatusProjeto = 'orcamento' | 'em_andamento' | 'concluido';

export type PapelUsuario = 'administrador' | 'visualizador';

export interface ContaBancaria {
  id: string;
  nome: string;
  banco: string;
  banco_codigo?: string;
  agencia?: string;
  numero_conta?: string;
  tipo: TipoConta;
  saldo_inicial: number;
  data_saldo_inicial: string; // YYYY-MM-DD
  limite_cheque_especial: number;
  taxa_juros_cheque_especial_mensal: number;
  cor: string;
  ativa: boolean;
  criado_em?: string;
}

export interface Categoria {
  id: string;
  nome: string;
  tipo: TipoLancamento;
  cor: string;
  padrao?: boolean;
}

export interface Contato {
  id: string;
  nome: string;
  tipo: TipoContato;
  cpf_cnpj: string;
  telefone: string;
  email: string;
  cidade: string;
}

export interface Projeto {
  id: string;
  nome: string; // Ex: "Instalação 5 kWp – Cliente X"
  cliente: string;
  valor_contratado: number;
  potencia_kwp?: number;
  status: StatusProjeto;
  data_inicio: string;
  data_previsao_fim: string;
}

export interface OrigemImportacao {
  lote_id: string;
  banco_codigo: string;
  conta_id: string;
  fitid?: string;
  assinatura_fraca: string;
  formato: 'ofx' | 'xlsx';
}

/**
 * Regra de importação cadastrada pelo usuário no Firestore (coleção: regras_importacao).
 * Permite que o sistema aprenda padrões recorrentes e evite reclassificações manuais repetitivas.
 * Apenas administradores podem criar/editar/excluir regras.
 */
export interface RegraImportacao {
  id: string;
  /** Código Febraban do banco ('033' = Santander) ou '*' para qualquer banco */
  banco_codigo: string;
  /** ID da conta no sistema ou '*' para qualquer conta */
  conta_id: string;
  /** Campo da transação a casar: descrição ou contraparte (favorecido) */
  campo: 'descricao' | 'contraparte';
  /** Operador de comparação */
  operador: 'contem' | 'igual' | 'comeca_com';
  /** Valor a casar (comparado após normalização: maiúsculo, sem acento) */
  valor: string;
  /** ID da categoria a sugerir automaticamente */
  categoria_id: string;
  /** Projeto a vincular automaticamente (opcional) */
  projeto_id?: string;
  /** Contato a vincular automaticamente (opcional) */
  contato_id?: string;
  /** Tipo de lançamento sugerido */
  tipoLancamento?: 'receita' | 'despesa' | 'transferencia';
  /** Se false, a regra está desabilitada sem precisar ser deletada */
  ativa: boolean;
  criadoEm: string;
  /** Contador de vezes que esta regra gerou uma sugestão aceita pelo usuário */
  usos: number;
}

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  descricao: string;
  valor: number;
  valor_original?: number;
  juros_multa?: number;
  desconto?: number;
  data_vencimento: string; // YYYY-MM-DD
  data_pagamento: string | null; // YYYY-MM-DD
  status: StatusLancamento;
  conta_id: string;
  categoria_id: string;
  contato_id?: string;
  projeto_id?: string;
  forma_pagamento: FormaPagamento;
  recorrencia: 'nenhuma' | 'semanal' | 'mensal' | 'anual' | 'parcelado';
  parcela_atual?: number;
  total_parcelas?: number;
  grupo_parcelas_id?: string;
  grupo_recorrencia_id?: string;
  transferencia_vinculada_id?: string;
  conta_destino_id?: string;
  observacoes?: string;
  origem: 'manual' | 'folha' | 'transferencia' | 'ajuste' | 'extrato' | 'importacao';
  funcionario_id?: string;
  folha_id?: string;
  origem_importacao?: OrigemImportacao;
  criado_em: string;
}

/**
 * Registro de lote de importação de extrato bancário na coleção 'importacoes'.
 * Garante rastreabilidade, conciliação e capacidade de desfazer importações de forma reversível.
 */
export interface RegistroImportacao {
  id: string; // lote_id (ex: "lote-1729350000000-abcde")
  data: string; // data da execução (YYYY-MM-DD)
  usuario: string; // email do usuário que executou a importação
  banco_codigo: string;
  conta_id: string;
  nome_arquivo: string;
  formato: 'ofx' | 'xlsx';
  periodo: { inicio: string; fim: string };
  totais: {
    lancadas: number;
    ignoradas: number;
    duplicadas: number;
    enriquecidas: number;
    vinculadas: number;
    total_creditos: number;
    total_debitos: number;
  };
  saldo_banco?: { valor: number; data: string };
  saldo_sistema_antes?: number;
  saldo_sistema_depois?: number;
  status: 'concluida' | 'desfeita' | 'parcial';
  criado_em: string;
  atualizado_em?: string;
  snapshot_enriquecidos?: Array<{
    lancamentoId: string;
    descricaoAnterior: string;
    origemImportacaoAnterior?: OrigemImportacao;
  }>;
  /** Armazena os valores anteriores caso o saldo inicial da conta tenha sido ajustado neste lote (para restauração em desfazer) */
  saldoInicialAnteriorConta?: number;
  dataSaldoInicialAnteriorConta?: string;
  saldoInicialAjustadoNesteLote?: boolean;
}

export interface ParamsImportacaoLote {
  loteId: string;
  usuario: string;
  contaId: string;
  bancoCodigo: string;
  formato: 'ofx' | 'xlsx';
  nomeArquivo: string;
  periodo: { inicio: string; fim: string };
  /** Conta de aplicação explicitamente escolhida pelo usuário para transferências Contamax */
  contaDestinoId?: string;
  /** Se o assistente ou usuário confirmou o ajuste do saldo inicial para conciliação */
  saldoInicialAjustado?: {
    novoSaldoInicial: number;
    novaDataSaldoInicial: string;
    saldoInicialAnterior: number;
    dataSaldoInicialAnterior: string;
  };
  itens: Array<{
    id: string;
    contaId?: string;
    transacao: {
      idTemporario: string;
      fitid?: string;
      data: string;
      valor: number;
      tipo: 'credito' | 'debito';
      descricaoOriginal: string;
      descricaoNormalizada: string;
      contraparte?: string;
      ordemNoDia: number;
    };
    acao: 'incluir' | 'ignorar' | 'vincular';
    decisaoManual?: 'vincular' | 'novo' | 'ignorar';
    statusDeduplicacao?: string;
    tipoLancamento: 'receita' | 'despesa' | 'transferencia' | 'ajuste';
    categoriaId: string;
    projetoId?: string;
    contatoId?: string;
    natureza?: string;
    lancamentoExistenteId?: string;
    lembrarRegra?: boolean;
  }>;
  regrasACriar?: Array<Omit<RegraImportacao, 'id'>>;
  saldoBanco?: { valor: number; data: string };
  ajustarDataSaldoInicial?: boolean;
  novaDataSaldoInicial?: string;
}

export interface ResultadoImportacaoLote {
  sucesso: boolean;
  loteId: string;
  contaId?: string;
  totais: {
    lancadas: number;
    ignoradas: number;
    duplicadas: number;
    enriquecidas: number;
    vinculadas: number;
    total_creditos: number;
    total_debitos: number;
  };
  saldoAntes: number;
  saldoDepois: number;
  diferencaConciliacao?: number;
  mensagem?: string;
  /** Contas afetadas pela importação com saldo antes e depois — para exibição de transparência */
  contasAfetadas?: Array<{
    contaId: string;
    contaNome: string;
    saldoAntes: number;
    saldoDepois: number;
  }>;
}

export interface LancamentoAnomaloAuditoria {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  contaId: string;
  contaNome: string;
  motivo: string;
  loteId?: string;
}

export interface ResultadoAuditoriaReparo {
  dryRun: boolean;
  totalAnomalias: number;
  lancamentosIndevidos: LancamentoAnomaloAuditoria[];
  saldosPorConta: Array<{
    contaId: string;
    contaNome: string;
    saldoAtual: number;
    saldoProjetado: number;
    diferenca: number;
  }>;
  mensagem: string;
}

export interface ResultadoAjusteSaldoInicialLedgerbal {
  sucesso: boolean;
  saldoInicialAnterior: number;
  saldoInicialNovo: number;
  dataSaldoInicialAnterior: string;
  dataSaldoInicialNova: string;
  saldoFinalAposAjuste: number;
  diferenca: number;
  mensagem: string;
}

export interface ResultadoDesfazerImportacao {
  sucesso: boolean;
  loteId: string;
  lancamentosRemovidos: number;
  lancamentosRestaurados: number;
  mensagem?: string;
}




export interface UsuarioAutorizado {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  data_adicionado: string;
  adicionado_por?: string;
  foto?: string;
}

export interface ConfiguracoesEmpresa {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual?: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade_uf: string;
  chave_pix: string;
  aliquota_imposto_padrao: number; // % Ex: 6.5
  encargos_fgts: number; // % Ex: 8.0
  encargos_inss: number; // % Ex: 20.0
  balanco_manual?: ItemManualBalanco[];
}

export interface ResumoSaldoConta {
  conta: ContaBancaria;
  saldo_inicial: number;
  total_receitas_pagas: number;
  total_despesas_pagas: number;
  saldo_real: number; // saldo_inicial + receitas_pagas - despesas_pagas
  saldo_disponivel_total: number; // saldo_real + limite_cheque_especial
  limite_cheque_total: number;
  cheque_especial_utilizado: number; // máx(0, -saldo_real)
  cheque_especial_disponivel: number; // limite - utilizado
  usando_cheque_especial: boolean;
  percentual_cheque_usado: number; // % do limite utilizado
  alerta_critico_cheque: boolean; // utilizado > 80% do limite
  custo_juros_mensal_estimado: number; // valor utilizado * (taxa/100)
  custo_juros_diario_estimado: number; // custo mensal / 30
}

export type StatusFuncionario = 'ativo' | 'ferias' | 'afastado' | 'desligado';

export type TipoContratoFuncionario = 'CLT' | 'PJ' | 'temporario' | 'estagiario' | 'diarista' | 'prolabore';

export type SetorFuncionario =
  | 'Instalação'
  | 'Comercial'
  | 'Administrativo'
  | 'Projetos'
  | 'Operações'
  | 'Engenharia'
  | 'Diretoria'
  | 'Outro';

export type FormaRemuneracao = 'mensal' | 'quinzenal' | 'diaria' | 'hora';

export type TipoLancamentoFolha =
  | 'salario'
  | 'adiantamento'
  | 'vale'
  | 'comissao'
  | 'hora_extra'
  | 'bonus'
  | 'desconto'
  | 'ferias'
  | 'decimo_terceiro'
  | 'rescisao'
  | 'reembolso'
  | 'outro';

export interface BeneficioFuncionario {
  id: string;
  nome: string;
  valor: number;
}

export interface OcorrenciaFuncionario {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: 'falta' | 'atestado' | 'advertencia' | 'elogio' | 'outro';
  descricao: string;
  registrado_em: string;
}

export interface DescontoRecorrente { id: string; nome: string; tipo: 'percentual' | 'fixo'; valor: number; base: 'salario_base' | 'bruto'; ativo: boolean; }

export interface Funcionario {
  id: string;
  // 1. Dados Pessoais
  nome: string;
  cpf: string;
  rg: string;
  data_nascimento: string; // YYYY-MM-DD
  telefone: string;
  email: string;
  endereco: string;
  contato_emergencia_nome: string;
  contato_emergencia_telefone: string;
  foto?: string;

  // 2. Contrato
  cargo: string;
  setor: SetorFuncionario;
  tipo_contrato: TipoContratoFuncionario;
  data_admissao: string; // YYYY-MM-DD
  data_desligamento?: string | null;
  status: StatusFuncionario;
  carga_horaria: string; // Ex: "44h semanais"
  ctps_pis?: string;

  // 3. Remuneração
  salario_base: number;
  forma_remuneracao: FormaRemuneracao;
  dia_pagamento: number; // Dia do mês (ex: 5)
  comissao_tipo: 'percentual' | 'fixo';
  comissao_valor: number; // % ou R$
  adicional_tipo: 'nenhum' | 'periculosidade' | 'insalubridade' | 'outro';
  adicional_percentual: number; // Ex: 30% periculosidade
  adicional_valor_fixo: number;

  // 4. Benefícios Mensais
  beneficios: BeneficioFuncionario[];

  // 5. Encargos e Provisões
  inss_patronal_percentual: number; // Padrão 20%
  fgts_percentual: number; // Padrão 8%
  provisao_ferias_percentual: number; // Padrão 11.11% (1/12 + 1/3)
  provisao_13_percentual: number; // Padrão 8.33% (1/12)
  outros_encargos_percentual: number;

  // 6. Dados Bancários
  banco: string;
  agencia: string;
  conta: string;
  tipo_chave_pix: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';
  chave_pix: string;

  // 7. Observações e Ocorrências
  observacoes?: string;
  ocorrencias?: OcorrenciaFuncionario[];
  pagamento_quinzenal?: { dia_1: number; dia_2: number; modo: 'percentual' | 'fixo'; valor_1: number; valor_2: number | null };
  descontos_recorrentes?: DescontoRecorrente[];
  criado_em: string;
}

export interface LancamentoFolha {
  id: string;
  funcionario_id: string;
  lancamento_id?: string; // ID vinculado na tabela de lançamentos / contas a pagar
  tipo: TipoLancamentoFolha;
  descricao: string;
  competencia: string; // MM/AAAA, ex: "10/2026"
  valor: number;
  tipo_operacao: 'provento' | 'desconto'; // 'provento' soma no pagamento, 'desconto' subtrai
  data_prevista: string; // YYYY-MM-DD
  data_pagamento: string | null; // YYYY-MM-DD
  status: 'pendente' | 'pago' | 'cancelado';
  conta_id: string;
  descontado_em_folha?: boolean; // Para adiantamentos que já foram totalmente abatidos do salário
  adiantamento_vinculado_id?: string;
  abatimentos?: Array<{ folha_id: string; valor: number }>;
  periodo?: 'mensal' | 'q1' | 'q2';
  observacoes?: string;
  criado_em: string;
}

export interface ItemDescontoFolha {
  chave: string;
  descricao: string;
  valor: number;
}

export interface ResultadoCalculoFolha {
  salarioBase: number;
  adicionais: number;
  proventosAvulsos: number;
  bruto: number;
  descontos: ItemDescontoFolha[];
  totalDescontos: number;
  adiantamentosAbatidos: number;
  liquido: number;
  adiantamentosDetalhados?: LancamentoFolha[];
}

export interface RegistroAuditoria {
  id: string;
  data_hora: string; // ISO string
  usuario_nome: string;
  usuario_email: string;
  modulo: 'lancamentos' | 'funcionarios' | 'projetos' | 'contas' | 'contatos' | 'categorias' | 'folha' | 'sistema' | 'importacoes' | 'regras_importacao';
  acao: 'criacao' | 'edicao' | 'exclusao' | 'pagamento' | 'estorno' | 'importacao' | 'desfazer' | 'reset';
  descricao: string;
  detalhes?: string;
}

export interface AlertaItem {
  id: string;
  tipo: 'vencendo_hoje' | 'vencendo_amanha' | 'atrasada' | 'saldo_negativo' | 'projecao_negativa' | 'ferias_vencendo';
  titulo: string;
  descricao: string;
  severidade: 'critico' | 'aviso' | 'info';
  data?: string;
  linkPagina?: 'painel' | 'contas' | 'lancamentos' | 'pagar' | 'receber' | 'projetos' | 'funcionarios' | 'relatorios' | 'cadastros' | 'configuracoes';
  lido?: boolean;
}

export interface ImpactoContaReinicio {
  conta_id: string;
  conta_nome: string;
  saldo_antes: number;
  saldo_depois: number;
  transferencias_removidas: number;
  diferenca: number;
}

export interface DryRunReinicioConta {
  conta_id: string;
  conta_nome: string;
  saldo_antes: number;
  saldo_depois: number;
  saldo_inicial_atual: number;
  novo_saldo_inicial: number;
  nova_data_saldo_inicial?: string;
  zerar_saldo_inicial: boolean;
  total_lancamentos_removidos: number;
  total_transferencias_removidas: number;
  total_lotes_afetados: number;
  total_ajustes_removidos: number;
  contas_afetadas: ImpactoContaReinicio[];
  preservados: {
    manuais: number;
    folha: number;
    contas_pagar_receber: number;
    transferencias_manuais: number;
    total: number;
  };
}

export interface ResumoSaldoContaPosReinicio {
  conta_id: string;
  conta_nome: string;
  saldo_real: number;
  limite_credito: number;
  cheque_utilizado: number;
}

export interface ResultadoReinicioConta {
  sucesso: boolean;
  mensagem: string;
  removidos: number;
  lotes_desfeitos: number;
  backup_timestamp: string;
  saldos_finais: ResumoSaldoContaPosReinicio[];
}

