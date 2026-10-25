// MT Solar - Gestão Financeira
// Módulo de Extratos - Definições de Tipos e Contratos (Parte 15A)

export type FormatoExtrato = 'ofx' | 'xlsx';

export type TipoTransacaoExtrato = 'credito' | 'debito';

export interface TransacaoExtrato {
  idTemporario: string;
  fitid?: string;
  data: string; // 'YYYY-MM-DD'
  valor: number; // sempre positivo, com 2 casas decimais
  tipo: TipoTransacaoExtrato;
  descricaoOriginal: string;
  descricaoNormalizada: string; // maiúscula, sem acento, espaços colapsados, sem números variáveis
  contraparte?: string;
  documento?: string;
  ordemNoDia: number; // posição entre transações idênticas do mesmo dia (0, 1, 2... regra determinística)
  linhaOrigem: number; // número da linha de origem no extrato/arquivo
}

export interface PeriodoExtrato {
  inicio: string; // 'YYYY-MM-DD'
  fim: string; // 'YYYY-MM-DD'
}

export interface SaldoFinalExtrato {
  valor: number; // pode ser positivo ou negativo, com 2 casas decimais
  data: string; // 'YYYY-MM-DD'
}

export interface ExtratoLido {
  formato: FormatoExtrato;
  bancoCodigo: string | null;
  bancoNome: string | null;
  agencia?: string;
  conta?: string; // apenas dígitos
  acctIdBruto?: string;
  titular?: string;
  periodo: PeriodoExtrato;
  saldoFinal?: SaldoFinalExtrato;
  transacoes: TransacaoExtrato[];
  avisos: string[];
}

export class ErroBancoNaoSuportado extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroBancoNaoSuportado';
    Object.setPrototypeOf(this, ErroBancoNaoSuportado.prototype);
  }
}

export interface ContextoDeteccao {
  formato: FormatoExtrato;
  textoOfx?: string;
  linhasXlsx?: unknown[][];
  nomeArquivo?: string;
}

export interface DefinicaoBanco {
  codigo: string;
  nome: string;
  formatosSuportados: FormatoExtrato[];
  detectar: (contexto: ContextoDeteccao) => boolean;
  parser: (contexto: ContextoDeteccao, buffer: ArrayBuffer) => Promise<ExtratoLido> | ExtratoLido;
}

/**
 * Arredonda um valor numérico para exatamente 2 casas decimais
 */
export function arredondar2Casas(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Normaliza descrições de transações bancárias:
 * - Converte para maiúsculas
 * - Remove acentos (NFD)
 * - Remove sequências numéricas variáveis (códigos, CPFs, documentos, datas parciais tipo 05/08)
 * - Substitui pontuações por espaços
 * - Colapsa espaços múltiplos e remove espaços nas pontas
 */
export function normalizarDescricao(texto: string): string {
  if (!texto) return '';

  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    // Remove códigos compostos tipo 0001/000123456 ou números com 2 ou mais dígitos isolados
    .replace(/\b\d+([/-]\d+)*\b/g, '')
    // Substitui pontuações remanescentes por espaço
    .replace(/[^\w\s]/g, ' ')
    // Colapsa espaços múltiplos
    .replace(/\s+/g, ' ')
    .trim();
}
