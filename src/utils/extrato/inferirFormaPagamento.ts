// MT Solar - Gestão Financeira
// Inferência determinística de Forma de Pagamento a partir da descrição e natureza do extrato (Parte 15F)

import { FormaPagamento } from '../../types';
import { NaturezaTransacao } from './classificarTransacao';

/**
 * Infere a forma de pagamento de um lançamento bancário a partir de sua descrição original ou normalizada.
 * 
 * Regras:
 * - Contém "PIX" → 'pix'
 * - Contém "BOLETO", "BOL ", "TITULO", "COB " → 'boleto'
 * - Contém "CARTAO", "COMPRA CARTAO", "DEB", "ELO", "VISA", "MASTER" → 'cartao_debito'
 * - Contém "TED", "DOC", "TRANSF", "CONTAMAX", "APLICACAO", "RESGATE" → 'transferencia'
 * - Contém "DINHEIRO", "DEP DIN" → 'dinheiro'
 * - Contém "CHEQUE" → 'cheque'
 * - Natureza tarifa_bancaria / imposto / conta_consumo → 'transferencia' (débito em conta)
 * - Padrão fallback → 'transferencia' (operações que transitam em conta corrente são transferências/débitos em conta)
 */
export function inferirFormaPagamento(
  descricao: string,
  natureza?: NaturezaTransacao
): FormaPagamento {
  const d = (descricao || '').toUpperCase();

  if (d.includes('PIX')) {
    return 'PIX';
  }

  if (
    d.includes('BOLETO') ||
    d.includes('TITULO') ||
    d.includes('COB ') ||
    d.includes('PAGAMENTO DE TITULO') ||
    d.includes('PAG BOLETO')
  ) {
    return 'boleto';
  }

  if (
    d.includes('CARTAO') ||
    d.includes('CARTAO DEB') ||
    d.includes('COMPRA DEB') ||
    d.includes('VISA ELECTRON') ||
    d.includes('MAESTRO') ||
    d.includes('ELO DEBITO') ||
    natureza === 'cartao_debito'
  ) {
    return 'cartao';
  }

  if (
    d.includes('TED') ||
    d.includes('DOC') ||
    d.includes('TRANSF') ||
    d.includes('CONTAMAX') ||
    d.includes('APLICACAO') ||
    d.includes('RESGATE') ||
    d.includes('TEF') ||
    natureza === 'movimentacao_interna'
  ) {
    return 'transferencia';
  }

  if (d.includes('DINHEIRO') || d.includes('DEP DIN') || d.includes('DEPOSITO EM ESPECIE')) {
    return 'dinheiro';
  }

  if (d.includes('CHEQUE')) {
    return 'cheque';
  }

  // Tarifas, impostos e contas de consumo debitadas em conta
  if (
    natureza === 'tarifa_bancaria' ||
    natureza === 'imposto' ||
    natureza === 'conta_consumo' ||
    natureza === 'emprestimo'
  ) {
    return 'transferencia';
  }

  return 'transferencia';
}
