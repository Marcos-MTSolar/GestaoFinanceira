/**
 * MT Solar – Gestão Financeira
 * Testes Parte 16D – Controle de Saldo Inicial em Importações
 *
 * Todos os testes rodam 100% em memória (simulador).
 * NÃO usa .env.local, Firestore real nem credenciais.
 *
 * Executar: npm run test:16d
 */

import {
  analisarDuplaContagemSaldoInicial,
  calcularMovimentacoesConta,
  contaTemLancamentosImportados,
  subtrairUmDia,
  ItemMovimentacaoCalc,
} from '../src/utils/extrato/saldoInicialHelper';
import { Lancamento } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers do simulador
// ---------------------------------------------------------------------------

let passados = 0;
let falhos = 0;

function assertApprox(desc: string, recebido: number, esperado: number, tol = 0.02): void {
  const ok = Math.abs(recebido - esperado) <= tol;
  if (ok) { console.log(`  ✅ ${desc}`); passados++; }
  else { console.error(`  ❌ ${desc} | esperado=${esperado} recebido=${recebido}`); falhos++; }
}

function assertTrue(desc: string, cond: boolean): void {
  if (cond) { console.log(`  ✅ ${desc}`); passados++; }
  else { console.error(`  ❌ ${desc} (esperado true, recebido false)`); falhos++; }
}

function assertFalse(desc: string, cond: boolean): void {
  if (!cond) { console.log(`  ✅ ${desc}`); passados++; }
  else { console.error(`  ❌ ${desc} (esperado false, recebido true)`); falhos++; }
}

function assertEqual<T>(desc: string, recebido: T, esperado: T): void {
  const ok = JSON.stringify(recebido) === JSON.stringify(esperado);
  if (ok) { console.log(`  ✅ ${desc}`); passados++; }
  else { console.error(`  ❌ ${desc} | esperado=${JSON.stringify(esperado)} recebido=${JSON.stringify(recebido)}`); falhos++; }
}

function criarLancamento(override: Partial<Lancamento> = {}): Lancamento {
  return {
    id: `lanc-${Math.random().toString(36).substr(2, 8)}`,
    tipo: 'receita',
    descricao: 'Teste',
    valor: 100,
    data_vencimento: '2024-01-15',
    data_pagamento: '2024-01-15',
    status: 'pago',
    conta_id: 'conta-A',
    categoria_id: 'cat-001',
    forma_pagamento: 'PIX',
    origem: 'manual',
    recorrencia: 'nenhuma',
    criado_em: new Date().toISOString(),
    ...override,
  };
}

function criarItem(override: Partial<ItemMovimentacaoCalc> = {}): ItemMovimentacaoCalc {
  return {
    acao: 'incluir',
    natureza: 'normal',
    tipoLancamento: 'receita',
    transacao: { tipo: 'credito', valor: 100, data: '2024-01-15' },
    ...override,
  };
}

// ---------------------------------------------------------------------------
// CENÁRIO A – Primeira importação com e sem divergência de saldo inicial
// ---------------------------------------------------------------------------
console.log('\n══════════════════════════════════════════════════════');
console.log('CENÁRIO A – 1ª importação (sem lançamentos prévios)');
console.log('══════════════════════════════════════════════════════');

{
  const lancamentos: Lancamento[] = [];
  assertFalse('A1: conta vazia não tem importações prévias', contaTemLancamentosImportados('conta-A', lancamentos));

  const novos: ItemMovimentacaoCalc[] = [
    criarItem({ transacao: { tipo: 'credito', valor: 2000, data: '2024-01-10' } }),
    criarItem({ tipoLancamento: 'despesa', transacao: { tipo: 'debito', valor: 800, data: '2024-01-12' } }),
  ];

  const { somaTotal, menorData } = calcularMovimentacoesConta({
    contaId: 'conta-A', lancamentosExistentes: lancamentos, novosItens: novos,
  });
  assertApprox('A2: somaNovos = +1200', somaTotal, 1200);
  assertEqual('A3: menorData = 2024-01-10', menorData, '2024-01-10');

  // Sem divergência
  const s1 = analisarDuplaContagemSaldoInicial({ saldoInicialAtual: 10000, somaTotalMovimentacoes: somaTotal, saldoBanco: 11200, menorDataTransacao: menorData });
  assertFalse('A4: sem divergência quando saldos batem', s1.temDivergencia);

  // Com divergência (dupla contagem clássica)
  const s2 = analisarDuplaContagemSaldoInicial({ saldoInicialAtual: 10000, somaTotalMovimentacoes: somaTotal, saldoBanco: 21200, menorDataTransacao: menorData });
  assertTrue('A5: divergência detectada com saldo banco maior', s2.temDivergencia);
  assertApprox('A6: saldoInicialSugerido = 20000', s2.saldoInicialSugerido, 20000);
  assertEqual('A7: dataSugerida = dia anterior à menorData', s2.dataSaldoInicialSugerida, subtrairUmDia('2024-01-10'));
}

// ---------------------------------------------------------------------------
// CENÁRIO B – Importação subsequente (conta já tem lançamentos importados)
// ---------------------------------------------------------------------------
console.log('\n══════════════════════════════════════════════════════');
console.log('CENÁRIO B – 2ª importação (conta já tem lançamentos)');
console.log('══════════════════════════════════════════════════════');

{
  const lancamentos: Lancamento[] = [
    criarLancamento({ conta_id: 'conta-A', valor: 100, tipo: 'receita', origem: 'importacao',
      origem_importacao: { lote_id: 'lote-001', banco_codigo: '033', conta_id: 'conta-A', formato: 'ofx', assinatura_fraca: 'hash-test' } }),
    criarLancamento({ conta_id: 'conta-A', valor: 500, tipo: 'despesa', origem: 'importacao',
      origem_importacao: { lote_id: 'lote-001', banco_codigo: '033', conta_id: 'conta-A', formato: 'ofx', assinatura_fraca: 'hash-test' } }),
  ];

  assertTrue('B1: conta-A tem importações prévias', contaTemLancamentosImportados('conta-A', lancamentos));
  assertFalse('B2: conta-B não é afetada (isolamento)', contaTemLancamentosImportados('conta-B', lancamentos));

  const novos: ItemMovimentacaoCalc[] = [
    criarItem({ transacao: { tipo: 'credito', valor: 3000, data: '2024-02-01' } }),
    criarItem({ tipoLancamento: 'despesa', transacao: { tipo: 'debito', valor: 1000, data: '2024-02-10' } }),
  ];

  const { somaTotal } = calcularMovimentacoesConta({
    contaId: 'conta-A', lancamentosExistentes: lancamentos, novosItens: novos,
  });
  // existentes: +100 - 500 = -400; novos: +3000 - 1000 = +2000; total = +1600
  assertApprox('B3: somaTotal (existentes + novos) = 1600', somaTotal, 1600);

  // saldoProjetado = 5000 + 1600 = 6600; saldoBanco = 6600 → sem divergência
  const analise = analisarDuplaContagemSaldoInicial({ saldoInicialAtual: 5000, somaTotalMovimentacoes: somaTotal, saldoBanco: 6600 });
  assertFalse('B4: sem divergência na 2ª importação quando saldos batem', analise.temDivergencia);
}

// ---------------------------------------------------------------------------
// CENÁRIO C – Contamax em "Ignorar" NÃO distorce saldo inicial
// ---------------------------------------------------------------------------
console.log('\n══════════════════════════════════════════════════════');
console.log('CENÁRIO C – Contamax Ignorado: apenas divergenciaExclusivaContamax');
console.log('══════════════════════════════════════════════════════');

{
  // Lançamentos normais: +1200 movimentação líquida
  // Contamax ignorado: débito de 500 no extrato → impactoContamaxIgnorado = -500
  // saldoProjetado (sem Contamax) = 5000 + 1200 = 6200
  // saldoBanco = 5700 (banco descontou 500 de Contamax)
  // diferenca bruta = 6200 - 5700 = +500
  // diferencaReal = 500 + (-500) = 0 → sem divergência real de saldo inicial

  const analise = analisarDuplaContagemSaldoInicial({
    saldoInicialAtual: 5000,
    somaTotalMovimentacoes: 1200,
    saldoBanco: 5700,
    impactoContamaxIgnorado: -500,
  });

  assertFalse('C1: Contamax Ignorado não gera divergência de saldo inicial', analise.temDivergencia);
  assertTrue('C2: divergenciaExclusivaContamax = true', analise.divergenciaExclusivaContamax === true);
  assertApprox('C3: diferencaReal = 0', analise.diferencaReal ?? 0, 0);
  assertApprox('C4: diferenca bruta = +500', analise.diferenca, 500);
  // saldoInicialSugerido = 5700 - 1200 - (-500) = 5700 - 1200 + 500 = 5000
  assertApprox('C5: saldoInicialSugerido = 5000 (saldo inicial inalterado)', analise.saldoInicialSugerido, 5000);
}

// ---------------------------------------------------------------------------
// CENÁRIO D – Contamax em "Transferência": análise sem impactoContamaxIgnorado
// ---------------------------------------------------------------------------
console.log('\n══════════════════════════════════════════════════════');
console.log('CENÁRIO D – Contamax em Transferência: análise limpa');
console.log('══════════════════════════════════════════════════════');

{
  // Quando Contamax = 'transferencia', não há impactoContamaxIgnorado (0)
  const analise = analisarDuplaContagemSaldoInicial({
    saldoInicialAtual: 5000,
    somaTotalMovimentacoes: 700,  // lançamentos normais + Contamax como transferência
    saldoBanco: 5700,
    impactoContamaxIgnorado: 0,
  });

  assertFalse('D1: Contamax em Transferência → sem divergência quando saldos batem', analise.temDivergencia);
  assertFalse('D2: divergenciaExclusivaContamax = false', analise.divergenciaExclusivaContamax === true);
}

// ---------------------------------------------------------------------------
// CENÁRIO E – Desfazer importação 2 mantém estado da importação 1
// ---------------------------------------------------------------------------
console.log('\n══════════════════════════════════════════════════════');
console.log('CENÁRIO E – Desfazer importação 2 preserva importação 1');
console.log('══════════════════════════════════════════════════════');

{
  const lancamentosPos1: Lancamento[] = [
    criarLancamento({ conta_id: 'conta-A', valor: 2000, tipo: 'receita', origem: 'importacao',
      origem_importacao: { lote_id: 'lote-001', banco_codigo: '033', conta_id: 'conta-A', formato: 'ofx', assinatura_fraca: 'hash-test' } }),
  ];

  const lancamentosPos2: Lancamento[] = [
    ...lancamentosPos1,
    criarLancamento({ conta_id: 'conta-A', valor: 500, tipo: 'despesa', origem: 'importacao',
      origem_importacao: { lote_id: 'lote-002', banco_codigo: '033', conta_id: 'conta-A', formato: 'ofx', assinatura_fraca: 'hash-test' } }),
  ];

  // Simula desfazer lote-002: remove lançamentos do lote-002
  const aposDesfazer = lancamentosPos2.filter(l => l.origem_importacao?.lote_id !== 'lote-002');

  assertEqual('E1: após desfazer importação 2, resta 1 lançamento', aposDesfazer.length, 1);
  assertTrue('E2: lançamento restante é do lote-001', aposDesfazer[0].origem_importacao?.lote_id === 'lote-001');
  assertTrue('E3: conta ainda tem importações (lote-001)', contaTemLancamentosImportados('conta-A', aposDesfazer));
  assertFalse('E4: conta-B não é afetada', contaTemLancamentosImportados('conta-B', aposDesfazer));
}

// ---------------------------------------------------------------------------
// CENÁRIO F – Reimportar mesmo arquivo gera 0 novas transações (deduplicação)
// ---------------------------------------------------------------------------
console.log('\n══════════════════════════════════════════════════════');
console.log('CENÁRIO F – Reimportar mesmo arquivo: 0 novas transações');
console.log('══════════════════════════════════════════════════════');

{
  // Todos os itens já classificados como 'ignorar' (duplicatas detectadas)
  const itens: ItemMovimentacaoCalc[] = [
    { acao: 'ignorar', natureza: 'normal', tipoLancamento: 'receita', transacao: { tipo: 'credito', valor: 1000, data: '2024-01-10' } },
    { acao: 'ignorar', natureza: 'normal', tipoLancamento: 'despesa', transacao: { tipo: 'debito', valor: 500, data: '2024-01-12' } },
  ];

  const { somaNovos } = calcularMovimentacoesConta({
    contaId: 'conta-A', lancamentosExistentes: [], novosItens: itens,
  });
  assertApprox('F1: reimportar mesmo arquivo → somaNovos = 0 (todos ignorados)', somaNovos, 0);
}

// ---------------------------------------------------------------------------
// Resumo Final
// ---------------------------------------------------------------------------
console.log('\n══════════════════════════════════════════════════════');
console.log(`RESULTADO: ${passados} ✅ passados | ${falhos} ❌ falhos`);
console.log('══════════════════════════════════════════════════════\n');

if (falhos > 0) process.exit(1);
