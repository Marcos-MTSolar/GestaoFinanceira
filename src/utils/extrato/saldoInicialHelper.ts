// MT Solar - Gestão Financeira
// Auxiliar Único de Saldo Inicial na Importação de Extratos Bancários (Parte 18C - REGRA ÚNICA)
// Substitui integralmente a Parte 17B e toda a lógica de ajuste de saldo inicial das Partes 15J e 16D.

import { Lancamento } from '../../types';

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
 * Converte saldo "disponível" (que inclui limite do cheque especial) para saldo real da conta.
 * Regra: saldo real = disponível − limite da conta
 */
export function converterDisponivelParaSaldoReal(
  saldoDisponivel: number,
  limiteConta: number
): number {
  return +(saldoDisponivel - (limiteConta || 0)).toFixed(2);
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

export interface ParamsCalculoSaldoInicialUnico {
  /** Saldo real informado (LEDGERBAL do OFX ou digitado pelo usuário, já convertido se era disponível) */
  saldoRealInformado: number;
  /** Data de referência do saldo informado (ex.: data do LEDGERBAL ou data digitada) */
  dataSaldoInformado: string;
  /** ID da conta bancária */
  contaId: string;
  /**
   * Todos os lançamentos pagos da conta pós-gravação (já incluindo os novos lançamentos do extrato).
   * Itens ignorados (ex.: Contamax ignorado) NÃO devem estar nesta lista.
   */
  todosLancamentosPagosConta: Lancamento[];
}

export interface ResultadoCalculoSaldoInicialUnico {
  novoSaldoInicial: number;
  novaDataSaldoInicial: string;
  somaLancamentosConsiderados: number;
  totalLancamentosConsiderados: number;
  menorDataLancamento?: string;
}

export interface ParamsRecalculoSaldoInicial {
  saldoReferencia: {
    valor: number;
    data: string;
  };
  contaId: string;
  todosLancamentosPagosConta: Lancamento[];
}

/**
 * PARTE 21B (Regra de Saldo de Referência Reversível e Automática):
 * O usuário nunca informa saldo inicial. O app guarda o último saldo real conhecido do banco e
 * recalcula o saldo inicial automaticamente depois de cada importação (e depois de Desfazer),
 * em qualquer ordem de arquivos.
 *
 * saldo_inicial = saldo_referencia.valor − soma dos lançamentos pagos da conta com data ≤ saldo_referencia.data
 *                 (entrada +, saída −, deduplicado por ID, incluindo manuais)
 * data_saldo_inicial = dia anterior ao lançamento mais antigo da conta.
 */
export function recalcularSaldoInicialConta(
  params: ParamsRecalculoSaldoInicial
): ResultadoCalculoSaldoInicialUnico {
  return calcularSaldoInicialPrimeiraImportacao({
    saldoRealInformado: params.saldoReferencia.valor,
    dataSaldoInformado: params.saldoReferencia.data,
    contaId: params.contaId,
    todosLancamentosPagosConta: params.todosLancamentosPagosConta,
  });
}

/**
 * REGRA (Parte 18C / 21B):
 * saldo_inicial = saldo_real_informado − (soma de TODOS os lançamentos pagos da conta com data ≤ data do saldo informado,
 *                 já incluindo os que serão gravados pelo extrato e considerando entradas positivas e saídas negativas).
 * data_saldo_inicial = dia anterior ao lançamento mais antigo da conta.
 */
export function calcularSaldoInicialPrimeiraImportacao(
  params: ParamsCalculoSaldoInicialUnico
): ResultadoCalculoSaldoInicialUnico {
  const { saldoRealInformado, dataSaldoInformado, contaId, todosLancamentosPagosConta } = params;

  // 1. Deduplicação estrita por ID
  const mapPorId = new Map<string, Lancamento>();
  for (const l of todosLancamentosPagosConta) {
    if (l.conta_id === contaId && l.status === 'pago') {
      mapPorId.set(l.id, l);
    }
  }
  const lancamentosDeduplicados = Array.from(mapPorId.values());

  // 2. Filtrar lançamentos pagos da conta com data <= dataSaldoInformado
  const lancsAteData = lancamentosDeduplicados.filter((l) => {
    const dt = l.data_pagamento || l.data_vencimento;
    return dt && dt <= dataSaldoInformado;
  });

  // 3. Somar entradas (+ valor) e saídas (- valor)
  let soma = 0;
  for (const l of lancsAteData) {
    if (l.tipo === 'receita') {
      soma += l.valor;
    } else {
      soma -= l.valor;
    }
  }
  const somaLancamentosConsiderados = +soma.toFixed(2);

  // 4. saldo_inicial = saldo_real_informado - soma
  const novoSaldoInicial = +(saldoRealInformado - somaLancamentosConsiderados).toFixed(2);

  // 5. data_saldo_inicial = dia anterior ao lançamento mais antigo da conta
  const todasDatas = lancamentosDeduplicados
    .map((l) => l.data_pagamento || l.data_vencimento)
    .filter(Boolean)
    .sort();

  const menorDataLancamento = todasDatas[0];
  const dataReferencia = menorDataLancamento || dataSaldoInformado;
  const novaDataSaldoInicial = subtrairUmDia(dataReferencia);

  return {
    novoSaldoInicial,
    novaDataSaldoInicial,
    somaLancamentosConsiderados,
    totalLancamentosConsiderados: lancsAteData.length,
    menorDataLancamento,
  };
}

/**
 * Confere se o saldo real do app é igual ao saldo informado (tolerância de R$ 0,01).
 */
export function conferirSaldoFinal(
  saldoRealApp: number,
  saldoRealInformado: number,
  tolerancia: number = 0.01
): { confere: boolean; diferenca: number } {
  const diferenca = +(saldoRealApp - saldoRealInformado).toFixed(2);
  const confere = Math.abs(diferenca) <= tolerancia;
  return { confere, diferenca };
}

// ============================================================
// STUBS LEGADOS (Partes 15J, 16D, 16F)
// Mantidos para retrocompatibilidade com scripts de testes existentes
// ============================================================

export interface ItemMovimentacaoCalc {
  acao: string;
  transacao: {
    data: string;
    valor: number;
    tipo: 'credito' | 'debito';
  };
  tipoLancamento?: string;
  natureza?: string;
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
 * @deprecated Substituído pela REGRA ÚNICA da Parte 18C.
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

  let somaNovos = 0;
  for (const item of novosItens) {
    if (item.acao !== 'incluir') continue;

    if (item.natureza === 'movimentacao_interna' && !contaDestinoId) {
      continue;
    }

    if (item.natureza === 'movimentacao_interna' && contaDestinoId) {
      if (item.transacao.tipo === 'debito') {
        somaNovos -= item.transacao.valor;
      } else {
        somaNovos += item.transacao.valor;
      }
      continue;
    }

    if (item.tipoLancamento === 'receita' || item.transacao.tipo === 'credito') {
      somaNovos += item.transacao.valor;
    } else {
      somaNovos -= item.transacao.valor;
    }
  }

  somaExistentes = +somaExistentes.toFixed(2);
  somaNovos = +somaNovos.toFixed(2);
  const somaTotal = +(somaExistentes + somaNovos).toFixed(2);

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

/**
 * @deprecated Substituído pela REGRA ÚNICA da Parte 18C.
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
  const diferencaReal = +(diferenca + impactoContamaxIgnorado).toFixed(2);

  const temDivergencia = Math.abs(diferencaReal) > tolerancia;
  const divergenciaExclusivaContamax = !temDivergencia && Math.abs(diferenca) > tolerancia;

  const saldoInicialSugerido = +(saldoBanco - somaTotalMovimentacoes - impactoContamaxIgnorado).toFixed(2);

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

