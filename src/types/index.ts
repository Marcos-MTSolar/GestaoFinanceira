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
  origem: 'manual' | 'folha' | 'transferencia' | 'ajuste';
  funcionario_id?: string;
  criado_em: string;
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

export type TipoContratoFuncionario = 'CLT' | 'PJ' | 'temporario' | 'estagiario' | 'diarista';

export type SetorFuncionario =
  | 'Instalação'
  | 'Comercial'
  | 'Administrativo'
  | 'Projetos'
  | 'Operações'
  | 'Engenharia'
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
  descontado_em_folha?: boolean; // Para adiantamentos que já foram abatidos do salário
  adiantamento_vinculado_id?: string;
  observacoes?: string;
  criado_em: string;
}

export interface RegistroAuditoria {
  id: string;
  data_hora: string; // ISO string
  usuario_nome: string;
  usuario_email: string;
  modulo: 'lancamentos' | 'funcionarios' | 'projetos' | 'contas' | 'contatos' | 'categorias' | 'folha' | 'sistema';
  acao: 'criacao' | 'edicao' | 'exclusao' | 'pagamento' | 'estorno' | 'importacao' | 'reset';
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
