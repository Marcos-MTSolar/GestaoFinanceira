// MT Solar - Gestão Financeira
// Suíte de Testes da PARTE 24D — Reconhecimento e Vinculação de Pagamentos sem Duplicação
// Dados 100% fictícios conforme diretrizes do projeto

import { TransacaoExtrato } from '../src/utils/extrato/tipos';
import { casarLancamentosComExtrato, pontuarCandidato } from '../src/utils/extrato/casarLancamentos';
import { classificarDuplicatas } from '../src/utils/extrato/classificarDuplicatas';
import { Lancamento } from '../src/types';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHA: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log('🧪 Iniciando testes da PARTE 24D — Casamento e Vinculação de Pagamentos sem Duplicação\n');

  const CONTA_PRINCIPAL = 'conta-corrente-001';
  const CONTA_SECUNDARIA = 'conta-secundaria-002';

  // ---------------------------------------------------------------------------
  // (a) Pago manual, mesma conta, mesmo valor e dia -> ALTA, 0 novo lançamento
  // ---------------------------------------------------------------------------
  console.log('--- Teste (a): Pago manual, mesma conta, mesmo valor e dia ---');
  const lancManualPago: Lancamento = {
    id: 'lanc-pago-a',
    tipo: 'despesa',
    descricao: 'Fornecedor Equipamentos Solar Fictício',
    valor: 1500.00,
    data_vencimento: '2026-11-10',
    data_pagamento: '2026-11-10',
    status: 'pago',
    conta_id: CONTA_PRINCIPAL,
    categoria_id: 'cat-fornec',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    observacoes: 'NF 12345 compra de inversores',
    criado_em: '2026-11-10T10:00:00Z',
  };

  const tExtratoA: TransacaoExtrato = {
    idTemporario: 't-extrato-a',
    data: '2026-11-10',
    descricaoOriginal: 'PIX EMIT.OUTRA IF FORNECEDOR SOLAR',
    descricaoNormalizada: 'PIX EMIT OUTRA IF FORNECEDOR SOLAR',
    contraparte: 'FORNECEDOR EQUIPAMENTOS SOLAR',
    valor: 1500.00,
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 1,
  };

  const mapaA = casarLancamentosComExtrato([tExtratoA], [lancManualPago], CONTA_PRINCIPAL);
  const resA = mapaA.get('t-extrato-a');
  assert(resA !== undefined, 'Transação avaliada no casamento');
  assert(resA?.nivel === 'ALTA', 'Nível de certeza é ALTA');
  assert(resA?.statusSugerido === 'vincular_automatico', 'Status sugerido é vincular_automatico');
  assert(resA?.candidatoPrincipal?.lancamento.id === 'lanc-pago-a', 'Candidato principal correto vinculado');

  const dedupeA = classificarDuplicatas([tExtratoA], [lancManualPago], { contaId: CONTA_PRINCIPAL });
  assert(dedupeA[0].status === 'vinculada_alta', 'classificarDuplicatas retorna status vinculada_alta');
  assert(dedupeA[0].idDoLancamentoRelacionado === 'lanc-pago-a', 'idDoLancamentoRelacionado preservado');

  // ---------------------------------------------------------------------------
  // (b) Data com diferença de +2 dias -> ALTA (data <= 3 dias)
  // ---------------------------------------------------------------------------
  console.log('\n--- Teste (b): Data com diferença de +2 dias ---');
  const lancDataDif: Lancamento = {
    ...lancManualPago,
    id: 'lanc-pago-b',
    data_vencimento: '2026-11-08',
    data_pagamento: '2026-11-08',
  };
  const mapaB = casarLancamentosComExtrato([tExtratoA], [lancDataDif], CONTA_PRINCIPAL);
  const resB = mapaB.get('t-extrato-a');
  assert(resB?.nivel === 'ALTA', 'Data com 2 dias de diferença mantém nível ALTA (<= 3 dias)');
  assert(resB?.candidatoPrincipal?.diferencaDias === 2, 'Diferença de 2 dias registrada');

  // ---------------------------------------------------------------------------
  // (c) Dois boletos iguais no mesmo dia -> pareamento 1:1 determinístico
  // ---------------------------------------------------------------------------
  console.log('\n--- Teste (c): Dois boletos iguais no mesmo dia (pareamento 1:1) ---');
  const boleto1: Lancamento = {
    ...lancManualPago,
    id: 'bol-1',
    valor: 450.00,
    data_vencimento: '2026-11-10',
    data_pagamento: '2026-11-10',
  };
  const boleto2: Lancamento = {
    ...lancManualPago,
    id: 'bol-2',
    valor: 450.00,
    data_vencimento: '2026-11-10',
    data_pagamento: '2026-11-10',
  };

  const tBoleto1: TransacaoExtrato = {
    idTemporario: 't-bol-1',
    data: '2026-11-10',
    descricaoOriginal: 'LIQUIDACAO BOLETO 1',
    descricaoNormalizada: 'LIQUIDACAO BOLETO 1',
    valor: 450.00,
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 2,
  };
  const tBoleto2: TransacaoExtrato = {
    idTemporario: 't-bol-2',
    data: '2026-11-10',
    descricaoOriginal: 'LIQUIDACAO BOLETO 2',
    descricaoNormalizada: 'LIQUIDACAO BOLETO 2',
    valor: 450.00,
    tipo: 'debito',
    ordemNoDia: 1,
    linhaOrigem: 3,
  };

  const mapaC = casarLancamentosComExtrato([tBoleto1, tBoleto2], [boleto1, boleto2], CONTA_PRINCIPAL);
  const resC1 = mapaC.get('t-bol-1');
  const resC2 = mapaC.get('t-bol-2');

  assert(resC1?.candidatoPrincipal !== undefined, 'Boleto 1 encontrou candidato');
  assert(resC2?.candidatoPrincipal !== undefined, 'Boleto 2 encontrou candidato');
  assert(
    resC1?.candidatoPrincipal?.lancamento.id !== resC2?.candidatoPrincipal?.lancamento.id,
    'Pareamento 1:1 rigoroso: cada boleto do extrato casou com um lançamento diferente'
  );

  // ---------------------------------------------------------------------------
  // (d) Lançado em outra conta -> Nível MÉDIA com alerta, nunca automático silencioso
  // ---------------------------------------------------------------------------
  console.log('\n--- Teste (d): Lançado em outra conta (alerta explícito) ---');
  const lancOutraConta: Lancamento = {
    ...lancManualPago,
    id: 'lanc-outra-conta',
    conta_id: CONTA_SECUNDARIA, // lançado na conta secundária, mas o extrato é da primária
  };
  const mapaD = casarLancamentosComExtrato([tExtratoA], [lancOutraConta], CONTA_PRINCIPAL);
  const resD = mapaD.get('t-extrato-a');
  assert(resD?.nivel === 'MEDIA', 'Candidato em outra conta cai em nível MEDIA');
  assert(resD?.statusSugerido === 'decisao_manual', 'Exige decisão manual do usuário para mover a conta');
  assert(resD?.candidatoPrincipal?.mesmaConta === false, 'mesmaConta registrado como false');

  // ---------------------------------------------------------------------------
  // (e) Pendente casado -> Nível ALTA / Baixa sugerida
  // ---------------------------------------------------------------------------
  console.log('\n--- Teste (e): Pendente casado no extrato ---');
  const lancPendente: Lancamento = {
    ...lancManualPago,
    id: 'lanc-pendente-e',
    status: 'pendente',
    data_pagamento: null,
    data_vencimento: '2026-11-10',
  };
  const mapaE = casarLancamentosComExtrato([tExtratoA], [lancPendente], CONTA_PRINCIPAL);
  const resE = mapaE.get('t-extrato-a');
  assert(resE?.nivel === 'ALTA', 'Lançamento pendente com valor e data coincidentes atinge nível ALTA');
  assert(resE?.candidatoPrincipal?.lancamento.status === 'pendente', 'Status pendente identificado');

  // ---------------------------------------------------------------------------
  // (f) Folha de pagamento -> status pago preservado sem duplicar
  // ---------------------------------------------------------------------------
  console.log('\n--- Teste (f): Folha de pagamento ---');
  const lancFolha: Lancamento = {
    ...lancManualPago,
    id: 'lanc-folha-f',
    origem: 'folha',
    folha_id: 'folha-out-2026',
    funcionario_id: 'func-001',
    descricao: 'Adiantamento Quinzenal - Colaborador Teste',
    valor: 1200.00,
  };
  const tFolha: TransacaoExtrato = {
    idTemporario: 't-folha',
    data: '2026-11-10',
    descricaoOriginal: 'PIX EMIT.OUTRA IF COLABORADOR TESTE',
    descricaoNormalizada: 'PIX EMIT OUTRA IF COLABORADOR TESTE',
    valor: 1200.00,
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 4,
  };
  const mapaF = casarLancamentosComExtrato([tFolha], [lancFolha], CONTA_PRINCIPAL);
  const resF = mapaF.get('t-folha');
  assert(resF?.candidatoPrincipal?.lancamento.origem === 'folha', 'Lançamento de folha casado');
  assert(resF?.nivel === 'ALTA', 'Nível ALTA para folha com mesmo valor e data');

  // ---------------------------------------------------------------------------
  // (g) Valor com juros/multa -> casa pelo valor efetivo pago
  // ---------------------------------------------------------------------------
  console.log('\n--- Teste (g): Valor pago com juros/multa ---');
  const lancComJuros: Lancamento = {
    ...lancManualPago,
    id: 'lanc-juros-g',
    valor_original: 500.00,
    juros_multa: 15.50,
    valor: 515.50, // valor efetivamente pago registrado no sistema
  };
  const tJuros: TransacaoExtrato = {
    idTemporario: 't-juros',
    data: '2026-11-10',
    descricaoOriginal: 'BOLETO VENCIDO PAGAMENTO',
    descricaoNormalizada: 'BOLETO VENCIDO PAGAMENTO',
    valor: 515.50, // extrato debita o valor total com juros
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 5,
  };
  const mapaG = casarLancamentosComExtrato([tJuros], [lancComJuros], CONTA_PRINCIPAL);
  const resG = mapaG.get('t-juros');
  assert(resG?.candidatoPrincipal?.lancamento.id === 'lanc-juros-g', 'Casou pelo valor final pago de R$ 515,50');

  // ---------------------------------------------------------------------------
  // (h) Idempotência: reimportação não gera novos lançamentos
  // ---------------------------------------------------------------------------
  console.log('\n--- Teste (h): Idempotência e reimportação ---');
  const lancJaImportado: Lancamento = {
    ...lancManualPago,
    id: 'lanc-ja-importado',
    origem_importacao: {
      lote_id: 'lote-antigo-1',
      banco_codigo: '756',
      conta_id: CONTA_PRINCIPAL,
      fitid: 'FITID-SICOOB-999',
      assinatura_fraca: 'ass-fraca-123',
      formato: 'pdf',
    },
  };
  const mapaH = casarLancamentosComExtrato([tExtratoA], [lancJaImportado], CONTA_PRINCIPAL);
  assert(mapaH.get('t-extrato-a')?.nivel === 'BAIXA', 'Lançamento que já possui lote/fitid não é reivindicado como manual');

  // ---------------------------------------------------------------------------
  // (i) Preservação de categoria e dados do usuário
  // ---------------------------------------------------------------------------
  console.log('\n--- Teste (i): Preservação de categoria e dados do usuário ---');
  assert(lancManualPago.categoria_id === 'cat-fornec', 'Categoria do usuário original preservada');
  assert(lancManualPago.descricao.includes('Fornecedor Equipamentos'), 'Descrição original preservada');

  console.log('\n🎉 TODOS OS TESTES DA PARTE 24D PASSARAM COM 100% DE SUCESSO!');
}

main().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});

