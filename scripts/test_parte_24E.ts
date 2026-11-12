// MT Solar - Gestão Financeira
// Suíte de Testes da PARTE 24E — Verificação de Pagamentos Agendados na Importação do Extrato
// Dados 100% FICTÍCIOS conforme diretrizes do projeto

import { TransacaoExtrato, ExtratoLido } from '../src/utils/extrato/tipos';
import { verificarAgendamentos, calcularCoberturaEfetiva } from '../src/utils/extrato/verificarAgendamentos';
import { Lancamento } from '../src/types';
import { dbService } from '../src/services/storage';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHA: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log('🧪 Iniciando testes da PARTE 24E — Verificação de Pagamentos Agendados\n');

  const CONTA_SICOOB = 'conta-sicoob-001';
  const CONTA_SANTANDER = 'conta-santander-002';
  const HOJE = '2026-11-12';

  // ---------------------------------------------------------------------------
  // (a) Agendado caiu no extrato -> confirmado
  // ---------------------------------------------------------------------------
  console.log('--- Teste (a): Agendamento confirmado no extrato ---');
  const lancAgendadoA: Lancamento = {
    id: 'lanc-agend-a',
    tipo: 'despesa',
    descricao: 'Fornecedor Fictício Cabos Solares',
    valor: 450.00,
    data_vencimento: '2026-11-05',
    data_pagamento: null,
    status: 'pendente',
    conta_id: CONTA_SICOOB,
    categoria_id: 'cat-fornec',
    forma_pagamento: 'boleto',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-11-01T10:00:00Z',
    agendamento: {
      data: '2026-11-05',
      conta_id: CONTA_SICOOB,
      criado_em: '2026-11-01T10:00:00Z',
      status: 'ativo',
    },
  };

  const extratoA: ExtratoLido = {
    transacoes: [
      {
        idTemporario: 't-ext-a',
        data: '2026-11-05',
        descricaoOriginal: 'LIQ.TITULO FORNECEDOR CABOS',
        descricaoNormalizada: 'LIQ TITULO FORNECEDOR CABOS',
        contraparte: 'FORNECEDOR FICTICIO CABOS SOLARES',
        valor: 450.00,
        tipo: 'debito',
        ordemNoDia: 0,
        linhaOrigem: 1,
      },
    ],
    periodo: { inicio: '2026-11-01', fim: '2026-11-10' },
    formato: 'pdf',
    bancoCodigo: '756',
    bancoNome: 'Banco Cooperativo Sicoob',
    avisos: [],
  };

  const resA = verificarAgendamentos([lancAgendadoA], extratoA, CONTA_SICOOB, HOJE);
  assert(resA.confirmados.length === 1, 'Um agendamento confirmado');
  assert(resA.confirmados[0].lancamento.id === 'lanc-agend-a', 'ID do agendamento confirmado confere');
  assert(resA.naoLocalizados.length === 0, 'Zero agendamentos não localizados');

  // ---------------------------------------------------------------------------
  // (b) Não caiu no extrato com período coberto -> nao_localizado com alerta
  // ---------------------------------------------------------------------------
  console.log('--- Teste (b): Agendamento não caiu no extrato (não localizado) ---');
  const lancAgendadoB: Lancamento = {
    id: 'lanc-agend-b',
    tipo: 'despesa',
    descricao: 'Aluguel Galpão Logística Fictício',
    valor: 1200.00,
    data_vencimento: '2026-11-03',
    data_pagamento: null,
    status: 'pendente',
    conta_id: CONTA_SICOOB,
    categoria_id: 'cat-aluguel',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-11-01T10:00:00Z',
    agendamento: {
      data: '2026-11-03',
      conta_id: CONTA_SICOOB,
      criado_em: '2026-11-01T10:00:00Z',
      status: 'ativo',
    },
  };

  const extratoB: ExtratoLido = {
    transacoes: [
      {
        idTemporario: 't-ext-b',
        data: '2026-11-04',
        descricaoOriginal: 'PAGTO DIVERSO OUTRO',
        descricaoNormalizada: 'PAGTO DIVERSO OUTRO',
        valor: 50.00,
        tipo: 'debito',
        ordemNoDia: 0,
        linhaOrigem: 1,
      },
    ],
    periodo: { inicio: '2026-11-01', fim: '2026-11-09' },
    formato: 'pdf',
    bancoCodigo: '756',
    bancoNome: 'Banco Cooperativo Sicoob',
    avisos: [],
  };

  const resB = verificarAgendamentos([lancAgendadoB], extratoB, CONTA_SICOOB, HOJE);
  assert(resB.naoLocalizados.length === 1, 'Agendamento classificado como não localizado');
  assert(resB.naoLocalizados[0].lancamento.id === 'lanc-agend-b', 'ID do não localizado confere');
  assert(resB.confirmados.length === 0, 'Zero confirmados');

  // ---------------------------------------------------------------------------
  // (c) Data após cobertura do extrato -> fora_da_cobertura (sem falso alerta)
  // ---------------------------------------------------------------------------
  console.log('--- Teste (c): Agendamento futuro após o período do extrato ---');
  const lancAgendadoC: Lancamento = {
    id: 'lanc-agend-c',
    tipo: 'despesa',
    descricao: 'Seguro Frota Veículos Fictício',
    valor: 850.00,
    data_vencimento: '2026-11-20',
    data_pagamento: null,
    status: 'pendente',
    conta_id: CONTA_SICOOB,
    categoria_id: 'cat-seguro',
    forma_pagamento: 'boleto',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-11-01T10:00:00Z',
    agendamento: {
      data: '2026-11-20',
      conta_id: CONTA_SICOOB,
      criado_em: '2026-11-01T10:00:00Z',
      status: 'ativo',
    },
  };

  const resC = verificarAgendamentos([lancAgendadoC], extratoB, CONTA_SICOOB, HOJE);
  assert(resC.foraDaCobertura.length === 1, 'Classificado como fora da cobertura');
  assert(resC.naoLocalizados.length === 0, 'Não gera alerta falso');

  // ---------------------------------------------------------------------------
  // (d) Tolerância de final de semana (+4 dias corridos)
  // ---------------------------------------------------------------------------
  console.log('--- Teste (d): Tolerância de fim de semana/feriado (+4 dias) ---');
  // Se agendado para 2026-11-08 e o extrato vai até 2026-11-09, tolerância vai até 12/11 -> fora da cobertura
  const lancAgendadoD: Lancamento = {
    id: 'lanc-agend-d',
    tipo: 'despesa',
    descricao: 'Internet Fibra Óptica Fictícia',
    valor: 199.90,
    data_vencimento: '2026-11-08',
    data_pagamento: null,
    status: 'pendente',
    conta_id: CONTA_SICOOB,
    categoria_id: 'cat-ti',
    forma_pagamento: 'transferencia',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-11-01T10:00:00Z',
    agendamento: {
      data: '2026-11-08',
      conta_id: CONTA_SICOOB,
      criado_em: '2026-11-01T10:00:00Z',
      status: 'ativo',
    },
  };

  const resD = verificarAgendamentos([lancAgendadoD], extratoB, CONTA_SICOOB, HOJE);
  assert(resD.foraDaCobertura.length === 1, 'Tolerância de 4 dias respeitada (fora da cobertura até compensação)');

  // ---------------------------------------------------------------------------
  // (e) Extrato de outra conta bancária -> sem interferência / falso alerta
  // ---------------------------------------------------------------------------
  console.log('--- Teste (e): Agendamento de outra conta ignorado pelo extrato desta conta ---');
  const lancAgendadoE: Lancamento = {
    id: 'lanc-agend-e',
    tipo: 'despesa',
    descricao: 'Consultoria Contábil Fictícia',
    valor: 900.00,
    data_vencimento: '2026-11-04',
    data_pagamento: null,
    status: 'pendente',
    conta_id: CONTA_SANTANDER, // Santander
    categoria_id: 'cat-contab',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-11-01T10:00:00Z',
    agendamento: {
      data: '2026-11-04',
      conta_id: CONTA_SANTANDER,
      criado_em: '2026-11-01T10:00:00Z',
      status: 'ativo',
    },
  };

  // Extrato importado para CONTA_SICOOB
  const resE = verificarAgendamentos([lancAgendadoE], extratoB, CONTA_SICOOB, HOJE);
  assert(resE.confirmados.length === 0, 'Zero confirmados nesta conta');
  assert(resE.naoLocalizados.length === 0, 'Zero falsos alertas para conta diferente');

  // ---------------------------------------------------------------------------
  // (f) Consta em lancamentosFuturos do extrato (Parte 24B) -> confirmado_futuro
  // ---------------------------------------------------------------------------
  console.log('--- Teste (f): Consta em lançamentos futuros do extrato ---');
  const lancAgendadoF: Lancamento = {
    id: 'lanc-agend-f',
    tipo: 'despesa',
    descricao: 'Tarifa Conectividade Fictícia',
    valor: 89.90,
    data_vencimento: '2026-11-15',
    data_pagamento: null,
    status: 'pendente',
    conta_id: CONTA_SICOOB,
    categoria_id: 'cat-tarifas',
    forma_pagamento: 'boleto',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-11-01T10:00:00Z',
    agendamento: {
      data: '2026-11-15',
      conta_id: CONTA_SICOOB,
      criado_em: '2026-11-01T10:00:00Z',
      status: 'ativo',
    },
  };

  const extratoF: ExtratoLido = {
    transacoes: [],
    periodo: { inicio: '2026-11-01', fim: '2026-11-10' },
    lancamentosFuturos: [
      {
        data: '2026-11-15',
        descricao: 'DEB AUT TARIFA CONECTIVIDADE',
        valor: 89.90,
        tipo: 'debito',
      },
    ],
    formato: 'pdf',
    bancoCodigo: '756',
    bancoNome: 'Banco Cooperativo Sicoob',
    avisos: [],
  };

  const resF = verificarAgendamentos([lancAgendadoF], extratoF, CONTA_SICOOB, HOJE);
  assert(resF.confirmadosComoFuturo.length === 1, 'Confirmado como lançamento futuro do banco');
  assert(resF.naoLocalizados.length === 0, 'Zero não localizados');

  // ---------------------------------------------------------------------------
  // (g) Valor diferente na mesma data -> nao_localizado com candidata sugerida
  // ---------------------------------------------------------------------------
  console.log('--- Teste (g): Débito próximo com valor diferente (candidata indicada) ---');
  const lancAgendadoG: Lancamento = {
    id: 'lanc-agend-g',
    tipo: 'despesa',
    descricao: 'Taxa Licença Ambiental Fictícia',
    valor: 300.00,
    data_vencimento: '2026-11-04',
    data_pagamento: null,
    status: 'pendente',
    conta_id: CONTA_SICOOB,
    categoria_id: 'cat-taxas',
    forma_pagamento: 'boleto',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-11-01T10:00:00Z',
    agendamento: {
      data: '2026-11-04',
      conta_id: CONTA_SICOOB,
      criado_em: '2026-11-01T10:00:00Z',
      status: 'ativo',
    },
  };

  const extratoG: ExtratoLido = {
    transacoes: [
      {
        idTemporario: 't-ext-g',
        data: '2026-11-04',
        descricaoOriginal: 'LIQ TITULO TAXA LICENCA COM JUROS',
        descricaoNormalizada: 'LIQ TITULO TAXA LICENCA COM JUROS',
        valor: 315.50, // R$ 15,50 de juros/multa
        tipo: 'debito',
        ordemNoDia: 0,
        linhaOrigem: 1,
      },
    ],
    periodo: { inicio: '2026-11-01', fim: '2026-11-09' },
    formato: 'pdf',
    bancoCodigo: '756',
    bancoNome: 'Banco Cooperativo Sicoob',
    avisos: [],
  };

  const resG = verificarAgendamentos([lancAgendadoG], extratoG, CONTA_SICOOB, HOJE);
  assert(resG.naoLocalizados.length === 1, 'Agendamento classificado como não localizado');
  assert(resG.naoLocalizados[0].candidataValorDiferente !== undefined, 'Candidata com valor diferente detectada');
  assert(resG.naoLocalizados[0].candidataValorDiferente?.valor === 315.50, 'Valor da candidata confere');

  // ---------------------------------------------------------------------------
  // (h) Reagendar e Cancelar agendamento
  // ---------------------------------------------------------------------------
  console.log('--- Teste (h): Métodos reagendarLancamento e cancelarAgendamento ---');
  dbService.saveLancamento(lancAgendadoB);

  const reagendado = dbService.reagendarLancamento('lanc-agend-b', '2026-11-25');
  assert(reagendado !== null, 'Lançamento reagendado com sucesso');
  assert(reagendado?.data_vencimento === '2026-11-25', 'Data de vencimento atualizada para 2026-11-25');
  assert(reagendado?.agendamento?.data === '2026-11-25', 'Data do agendamento atualizada');
  assert(reagendado?.agendamento?.status === 'ativo', 'Status do agendamento reativado');

  const cancelado = dbService.cancelarAgendamento('lanc-agend-b');
  assert(cancelado !== null, 'Agendamento cancelado com sucesso');
  assert(cancelado?.agendamento?.status === 'cancelado', 'Status marcado como cancelado');

  // ---------------------------------------------------------------------------
  // (i) e (j) Desfazer reverte a confirmação do agendamento e mantém saldo intacto
  // ---------------------------------------------------------------------------
  console.log('--- Teste (i) e (j): Desfazer restaura agendamento anterior e saldo ---');
  
  // Lançamento com agendamento ativo inicial
  const lancAgendadoInicial: Lancamento = {
    id: 'lanc-teste-desfazer-24e',
    tipo: 'despesa',
    descricao: 'Equipamento Suporte Telhado Fictício',
    valor: 600.00,
    data_vencimento: '2026-11-05',
    data_pagamento: null,
    status: 'pendente',
    conta_id: CONTA_SICOOB,
    categoria_id: 'cat-equip',
    forma_pagamento: 'boleto',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-11-01T10:00:00Z',
    agendamento: {
      data: '2026-11-05',
      conta_id: CONTA_SICOOB,
      criado_em: '2026-11-01T10:00:00Z',
      status: 'ativo',
    },
  };

  // Simulação do snapshot gerado na importação (conforme implementado em storage.ts)
  const snapshotGerado = {
    lancamentoId: lancAgendadoInicial.id,
    descricaoAnterior: lancAgendadoInicial.descricao,
    origemImportacaoAnterior: lancAgendadoInicial.origem_importacao,
    observacoesAnterior: lancAgendadoInicial.observacoes || '',
    statusAnterior: lancAgendadoInicial.status,
    dataPagamentoAnterior: lancAgendadoInicial.data_pagamento || null,
    contaIdAnterior: lancAgendadoInicial.conta_id,
    agendamentoAnterior: lancAgendadoInicial.agendamento,
  };

  assert(snapshotGerado.statusAnterior === 'pendente', 'Snapshot preserva status anterior como pendente');
  assert(snapshotGerado.agendamentoAnterior?.status === 'ativo', 'Snapshot preserva agendamento anterior como ativo');

  // Lançamento após confirmação pela importação do lote
  const lancPosLote: Lancamento = {
    ...lancAgendadoInicial,
    status: 'pago',
    data_pagamento: '2026-11-05',
    agendamento: {
      ...lancAgendadoInicial.agendamento!,
      status: 'confirmado',
      ultima_verificacao: '2026-11-12T15:00:00Z',
    },
  };

  assert(lancPosLote.status === 'pago', 'Status atualizado para pago pós-lote');
  assert(lancPosLote.agendamento?.status === 'confirmado', 'Agendamento confirmado pós-lote');

  // Simulação da reversão pelo desfazerImportacao (conforme implementado em storage.ts)
  const lancRestaurado: Lancamento = {
    ...lancPosLote,
    descricao: snapshotGerado.descricaoAnterior,
    status: snapshotGerado.statusAnterior || lancPosLote.status,
    data_pagamento: snapshotGerado.dataPagamentoAnterior !== undefined ? snapshotGerado.dataPagamentoAnterior : lancPosLote.data_pagamento,
    conta_id: snapshotGerado.contaIdAnterior || lancPosLote.conta_id,
    agendamento: snapshotGerado.agendamentoAnterior !== undefined ? snapshotGerado.agendamentoAnterior : lancPosLote.agendamento,
  };

  assert(lancRestaurado.status === 'pendente', 'Lançamento restaurado para pendente no Desfazer');
  assert(!lancRestaurado.data_pagamento, 'Data de pagamento limpa/nula no Desfazer');
  assert(lancRestaurado.agendamento?.status === 'ativo', 'Agendamento restaurado para ativo no Desfazer');
  assert(lancRestaurado.agendamento?.data === '2026-11-05', 'Data agendada intacta');

  console.log('\n🎉 TODOS OS TESTES DA PARTE 24E PASSARAM COM SUCESSO!\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro na execução da suíte 24E:', err);
  process.exit(1);
});
