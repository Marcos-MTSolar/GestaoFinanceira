// MT Solar - Gestão Financeira
// Auxiliar de Prevenção de Dupla Contagem e Cálculo de Saldo Inicial Retroativo (Parte 15J)

import { Lancamento } from '../../types';

export interface ItemMovimentacaoCalc {
  acao: 'incluir' | 'ignorar' | 'vincular';
  natureza?: string;
  tipoLancamento: 'receita' | 'despesa' | 'transferencia' | 'ajuste';
  transacao: {
    tipo: 'credito' | 'debito';
    valor: number;
    data: string;
  };
}

/**
 * Subtrai exatamente 1 dia civil de uma data ISO (YYYY-MM-DD),
 * evitando problemas de fuso horário.
 */
export function subtrairUmDia(dataIso: string): string {
  if (!dataIso || !dataIso.includes('-')) return dataIso;
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  data.setUTCDate(data.getUTCDate() - 1);
  return data.toISOString().split('T')[0];
}

/**
 * Verifica se a conta bancária já possui algum lançamento prévio com origem de importação de extrato.
 */
export function contaTemLancamentosImportados(
  contaId: string,
  lancamentos: Lancamento[]
): boolean {
  return lancamentos.some(
    (l) => l.conta_id === contaId && (l.origem === 'importacao' || Boolean(l.origem_importacao?.lote_id))
  );
}

/**
 * Calcula a variação financeira líquida e identifica a menor data entre
 * os lançamentos existentes da conta e os novos itens revisados do extrato.
 */
export function calcularMovimentacoesConta(params: {
  contaId: string;
  lancamentosExistentes: Lancamento[];
  novosItens: ItemMovimentacaoCalc[];
  contaDestinoId?: string;
  dataCorte?: string;
}): {
  somaExistentes: number;
  somaNovos: number;
  somaTotal: number;
  menorData?: string;
} {
  const { contaId, lancamentosExistentes, novosItens, contaDestinoId, dataCorte } = params;

  // 1. Lançamentos existentes pagos da conta
  const existentesFiltrados = lancamentosExistentes.filter((l) => {
    if (l.conta_id !== contaId) return false;
    if (l.status !== 'pago') return false;
    const dataRef = l.data_pagamento || l.data_vencimento;
    if (dataCorte && dataRef > dataCorte) return false;
    return true;
  });

  let somaExistentes = 0;
  for (const l of existentesFiltrados) {
    if (l.tipo === 'receita') {
      somaExistentes += l.valor;
    } else {
      somaExistentes -= l.valor;
    }
  }

  // 2. Novos itens a serem incluídos pelo lote
  let somaNovos = 0;
  for (const item of novosItens) {
    if (item.acao !== 'incluir') continue;

    // Movimentação interna sem conta destino explícita é ignorada
    if (item.natureza === 'movimentacao_interna' && !contaDestinoId) {
      continue;
    }

    if (item.natureza === 'movimentacao_interna' && contaDestinoId) {
      // Transferência Contamax:
      // Débito no extrato da CC = aplicação (sai da CC) -> despesa (-valor)
      // Crédito no extrato da CC = resgate (entra na CC) -> receita (+valor)
      if (item.transacao.tipo === 'debito') {
        somaNovos -= item.transacao.valor;
      } else {
        somaNovos += item.transacao.valor;
      }
      continue;
    }

    // Lançamentos comuns
    if (item.tipoLancamento === 'receita' || item.transacao.tipo === 'credito') {
      somaNovos += item.transacao.valor;
    } else {
      somaNovos -= item.transacao.valor;
    }
  }

  somaExistentes = +somaExistentes.toFixed(2);
  somaNovos = +somaNovos.toFixed(2);
  const somaTotal = +(somaExistentes + somaNovos).toFixed(2);

  // Menor data entre todas as movimentações consideradas
  const datas: string[] = [];
  for (const l of existentesFiltrados) {
    const dt = l.data_pagamento || l.data_vencimento;
    if (dt) datas.push(dt);
  }
  for (const item of novosItens) {
    if (item.acao === 'incluir' && item.transacao.data) {
      datas.push(item.transacao.data);
    }
  }
  datas.sort();
  const menorData = datas[0];

  return {
    somaExistentes,
    somaNovos,
    somaTotal,
    menorData,
  };
}

export interface AnaliseDuplaContagem {
  temDivergencia: boolean;
  saldoProjetado: number;
  saldoBanco: number;
  diferenca: number;
  saldoInicialSugerido: number;
  dataSaldoInicialSugerida: string;
  divergenciaExclusivaContamax?: boolean;
  impactoContamaxIgnorado?: number;
  diferencaReal?: number;
}

/**
 * Detecta se o saldo projetado da conta diverge do LEDGERBAL do banco,
 * indicando provável dupla contagem do saldo inicial, e sugere a correção exata.
 * 
 * PARTE 16D: Isola o impacto financeiro de movimentações Contamax marcadas
 * como 'ignorar' para que o ajuste de saldo inicial NUNCA absorva a diferença
 * do Contamax nem distorça o histórico da conta.
 */
export function analisarDuplaContagemSaldoInicial(params: {
  saldoInicialAtual: number;
  somaTotalMovimentacoes: number;
  saldoBanco: number;
  menorDataTransacao?: string;
  tolerancia?: number;
  impactoContamaxIgnorado?: number;
}): AnaliseDuplaContagem {
  const {
    saldoInicialAtual,
    somaTotalMovimentacoes,
    saldoBanco,
    menorDataTransacao,
    tolerancia = 0.01,
    impactoContamaxIgnorado = 0,
  } = params;

  const saldoProjetado = +(saldoInicialAtual + somaTotalMovimentacoes).toFixed(2);
  const diferenca = +(saldoProjetado - saldoBanco).toFixed(2);

  // Quando o Contamax é ignorado, a movimentação da aplicação/resgate não entra no app,
  // mas está no saldo do banco.
  // Se débito no extrato (aplicação): impactoContamax < 0. No banco, o saldo final diminui.
  // No app, o saldo projetado é maior que o saldo do banco por esse valor.
  // Logo, a divergência bruta explicada pelo Contamax ignorado é (-impactoContamax).
  // A divergência REAL (atribuível puramente a saldo inicial) é:
  const diferencaReal = +(diferenca + impactoContamaxIgnorado).toFixed(2);

  // Só há divergência de saldo inicial se a diferença REAL superar a tolerância
  const temDivergencia = Math.abs(diferencaReal) > tolerancia;
  const divergenciaExclusivaContamax = !temDivergencia && Math.abs(diferenca) > tolerancia;

  // saldo_inicial_sugerido corrige apenas a diferencaReal, sem absorver a diferença do Contamax:
  // saldo_inicial_sugerido = saldoBanco - somaTotalMovimentacoes - impactoContamaxIgnorado
  const saldoInicialSugerido = +(saldoBanco - somaTotalMovimentacoes - impactoContamaxIgnorado).toFixed(2);

  // data_saldo_inicial = dia anterior à primeira transação da conta
  const dataReferencia = menorDataTransacao || new Date().toISOString().split('T')[0];
  const dataSaldoInicialSugerida = subtrairUmDia(dataReferencia);

  return {
    temDivergencia,
    saldoProjetado,
    saldoBanco,
    diferenca,
    saldoInicialSugerido,
    dataSaldoInicialSugerida,
    divergenciaExclusivaContamax,
    impactoContamaxIgnorado,
    diferencaReal,
  };
}

