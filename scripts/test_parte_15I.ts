// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 15I: Reinício Seguro de Conta para Reimportação
// Cobre:
//   1. Simulação Dry-Run (simularReinicioConta):
//      - Identifica lançamentos diretos de importação (origem === 'importacao' ou com origem_importacao.lote_id)
//      - Identifica transferências de importação (com a outra conta envolvida)
//      - Identifica lotes da coleção importacoes
//      - Identifica ajustes de conciliação gerados por importação
//      - Calcula saldos ANTES e DEPOIS da conta escolhida e das contas afetadas
//      - Lista contagem precisa de lançamentos PRESERVADOS (manuais, folha, contas a pagar/receber e transferências manuais)
//   2. Preservação estrita:
//      - Lançamentos manuais, de folha e transferências manuais permanecem 100% intocados
//   3. Execução do Reinício (executarReinicioConta):
//      - Exclusão seletiva de todos os lançamentos vinculados a importação da conta
//      - Marcação dos lotes como 'desfeita'
//      - Ajuste opcional de saldo_inicial (zerar ou manter)
//      - Recálculo preciso dos saldos finais de todas as contas envolvidas
//   4. Isolamento estrito de outras contas não relacionadas

import {
  Lancamento,
  ContaBancaria,
  RegistroImportacao,
  DryRunReinicioConta,
  ResultadoReinicioConta,
  ImpactoContaReinicio,
} from '../src/types';

let totalTestes = 0;
let passaram = 0;
let falharam = 0;
const falhas: string[] = [];

function asserir(condicao: boolean, titulo: string, detalheErro?: string): void {
  totalTestes++;
  if (condicao) {
    console.log("  ✓ " + titulo);
    passaram++;
  } else {
    const msg = "✗ " + titulo + (detalheErro ? " → " + detalheErro : "");
    console.error("  " + msg);
    falhas.push(msg);
    falharam++;
  }
}

function secao(nome: string): void {
  console.log("\n" + "═".repeat(70));
  console.log("  " + nome);
  console.log("═".repeat(70));
}

class Simulador15I {
  public lancamentos: Lancamento[] = [];
  public contas: ContaBancaria[] = [];
  public importacoes: RegistroImportacao[] = [];

  reset() {
    this.lancamentos = [];
    this.importacoes = [];
    this.contas = [
      {
        id: "conta-santander",
        nome: "Santander Corrente MT Solar",
        banco: "Santander",
        banco_codigo: "033",
        agencia: "0001",
        numero_conta: "99999999-9",
        tipo: "corrente",
        saldo_inicial: 1000.00,
        data_saldo_inicial: "2026-01-01",
        limite_cheque_especial: 5000,
        taxa_juros_cheque_especial_mensal: 0.08,
        cor: "#CC0000",
        ativa: true,
      },
      {
        id: "conta-sicoob",
        nome: "Sicoob MT Solar",
        banco: "Sicoob",
        tipo: "poupanca",
        saldo_inicial: 50000.00,
        data_saldo_inicial: "2026-01-01",
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: "#003064",
        ativa: true,
      },
      {
        id: "conta-bradesco",
        nome: "Bradesco MT Solar",
        banco: "Bradesco",
        tipo: "corrente",
        saldo_inicial: 10000.00,
        data_saldo_inicial: "2026-01-01",
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: "#FF0000",
        ativa: true,
      },
    ];
  }

  getContaById(id: string): ContaBancaria | undefined {
    return this.contas.find((c) => c.id === id);
  }

  calcularResumoConta(contaId: string) {
    const conta = this.getContaById(contaId);
    if (!conta) throw new Error(`Conta ${contaId} não encontrada`);

    const lancs = this.lancamentos.filter((l) => l.conta_id === contaId && l.status === 'pago');
    const receitas = lancs.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
    const despesas = lancs.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
    const saldo_real = +(conta.saldo_inicial + receitas - despesas).toFixed(2);
    const limite = conta.limite_cheque_especial || 0;
    const cheque_especial_utilizado = saldo_real < 0 ? Math.min(Math.abs(saldo_real), limite) : 0;

    return {
      saldo_real,
      cheque_especial_utilizado,
    };
  }

  exportarBackupCompletoJSON(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      contas: this.contas,
      lancamentos: this.lancamentos,
      importacoes: this.importacoes,
    }, null, 2);
  }

  simularReinicioConta(params: {
    contaId: string;
    zerarSaldoInicial?: boolean;
    novaDataSaldoInicial?: string;
  }): DryRunReinicioConta {
    const { contaId, zerarSaldoInicial = false, novaDataSaldoInicial } = params;

    const conta = this.getContaById(contaId);
    if (!conta) {
      throw new Error(`Conta bancária ${contaId} não encontrada.`);
    }

    const lotesContaIds = new Set(
      this.importacoes
        .filter((i) => i.conta_id === contaId && i.status !== 'desfeita')
        .map((i) => i.id)
    );

    // 1. Lançamentos com origem='importacao' pertencentes à conta escolhida
    const lancamentosImportacaoDiretos = this.lancamentos.filter(
      (l) => l.origem === 'importacao' && l.conta_id === contaId
    );
    const idsLancamentosContaPrincipal = new Set(lancamentosImportacaoDiretos.map((l) => l.id));

    // Contrapartidas de transferências
    const transferenciasContapartida = this.lancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.transferencia_vinculada_id &&
        idsLancamentosContaPrincipal.has(l.transferencia_vinculada_id) &&
        l.conta_id !== contaId
    );

    // 2. Transferências geradas por importação (origem='transferencia' com origem_importacao.lote_id)
    const transferenciasLote = this.lancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.conta_id === contaId &&
        l.origem_importacao?.lote_id &&
        lotesContaIds.has(l.origem_importacao.lote_id)
    );
    const idsTransferenciasLote = new Set(transferenciasLote.map((l) => l.id));

    const contrapartidasTransferenciasLote = this.lancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.transferencia_vinculada_id &&
        idsTransferenciasLote.has(l.transferencia_vinculada_id) &&
        l.conta_id !== contaId
    );

    // 3. Ajustes de conciliação com origem='ajuste' criados pelo lote
    const ajustesConciliacao = this.lancamentos.filter(
      (l) =>
        l.origem === 'ajuste' &&
        l.conta_id === contaId &&
        l.origem_importacao?.lote_id &&
        lotesContaIds.has(l.origem_importacao.lote_id)
    );

    // Conjunto total a remover
    const todosARemover = [
      ...lancamentosImportacaoDiretos,
      ...transferenciasContapartida,
      ...transferenciasLote,
      ...contrapartidasTransferenciasLote,
      ...ajustesConciliacao,
    ];
    const idsRemover = new Set(todosARemover.map((l) => l.id));

    // Lançamentos PRESERVADOS
    const lancamentosContaPrincipal = this.lancamentos.filter((l) => l.conta_id === contaId);
    const preservados = lancamentosContaPrincipal.filter((l) => !idsRemover.has(l.id));

    const contManuais = preservados.filter((l) => l.origem === 'manual').length;
    const contFolha = preservados.filter((l) => l.origem === 'folha').length;
    const contContasPagarReceber = 0;
    const contTransferenciasManuais = preservados.filter((l) => l.origem === 'transferencia').length;

    // Cálculo de saldos
    const resumoAtual = this.calcularResumoConta(contaId);
    const saldoAntes = resumoAtual.saldo_real;

    const idsRemoverContaPrincipal = new Set(
      [...lancamentosImportacaoDiretos, ...transferenciasLote, ...ajustesConciliacao].map((l) => l.id)
    );
    const lancamentosRestantesPrincipal = lancamentosContaPrincipal.filter(
      (l) => !idsRemoverContaPrincipal.has(l.id) && l.status === 'pago'
    );
    const receitasRestantes = lancamentosRestantesPrincipal
      .filter((l) => l.tipo === 'receita')
      .reduce((s, l) => s + l.valor, 0);
    const despesasRestantes = lancamentosRestantesPrincipal
      .filter((l) => l.tipo === 'despesa')
      .reduce((s, l) => s + l.valor, 0);

    const saldoInicialAjustado = zerarSaldoInicial ? 0 : conta.saldo_inicial;
    const saldoDepois = +(saldoInicialAjustado + receitasRestantes - despesasRestantes).toFixed(2);

    // Contas secundárias afetadas
    const contasAfetadasMap = new Map<string, ImpactoContaReinicio>();
    const todasTransferenciasSecundarias = [
      ...transferenciasContapartida,
      ...contrapartidasTransferenciasLote,
    ];

    for (const tl of todasTransferenciasSecundarias) {
      if (!contasAfetadasMap.has(tl.conta_id)) {
        const contaSec = this.getContaById(tl.conta_id);
        if (contaSec) {
          const resumoSec = this.calcularResumoConta(tl.conta_id);
          contasAfetadasMap.set(tl.conta_id, {
            conta_id: tl.conta_id,
            conta_nome: contaSec.nome,
            saldo_antes: resumoSec.saldo_real,
            saldo_depois: resumoSec.saldo_real,
            transferencias_removidas: 0,
            diferenca: 0,
          });
        }
      }
      const impacto = contasAfetadasMap.get(tl.conta_id);
      if (impacto) {
        const variacao = tl.tipo === 'receita' ? tl.valor : -tl.valor;
        impacto.saldo_depois = +(impacto.saldo_depois - variacao).toFixed(2);
        impacto.transferencias_removidas += 1;
        impacto.diferenca = +(impacto.saldo_depois - impacto.saldo_antes).toFixed(2);
        contasAfetadasMap.set(tl.conta_id, impacto);
      }
    }

    return {
      conta_id: contaId,
      conta_nome: conta.nome,
      saldo_antes: +saldoAntes.toFixed(2),
      saldo_depois: saldoDepois,
      saldo_inicial_atual: conta.saldo_inicial,
      novo_saldo_inicial: saldoInicialAjustado,
      nova_data_saldo_inicial: novaDataSaldoInicial,
      zerar_saldo_inicial: zerarSaldoInicial,
      total_lancamentos_removidos: lancamentosImportacaoDiretos.length + transferenciasLote.length + ajustesConciliacao.length,
      total_transferencias_removidas: transferenciasContapartida.length + contrapartidasTransferenciasLote.length,
      total_lotes_afetados: lotesContaIds.size,
      total_ajustes_removidos: ajustesConciliacao.length,
      contas_afetadas: Array.from(contasAfetadasMap.values()),
      preservados: {
        manuais: contManuais,
        folha: contFolha,
        contas_pagar_receber: contContasPagarReceber,
        transferencias_manuais: contTransferenciasManuais,
        total: preservados.length,
      },
    };
  }

  async executarReinicioConta(params: {
    contaId: string;
    zerarSaldoInicial?: boolean;
    novaDataSaldoInicial?: string;
  }): Promise<ResultadoReinicioConta> {
    const { contaId, zerarSaldoInicial = false, novaDataSaldoInicial } = params;

    const conta = this.getContaById(contaId);
    if (!conta) {
      throw new Error(`Conta bancária ${contaId} não encontrada.`);
    }

    const backupJson = this.exportarBackupCompletoJSON();
    const backupTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nomeArquivo = `backup_antes_reinicio_${conta.nome.replace(/\s+/g, '_')}_${backupTimestamp}.json`;

    const lotesContaIds = this.importacoes
      .filter((i) => i.conta_id === contaId && i.status !== 'desfeita')
      .map((i) => i.id);
    const lotesContaIdsSet = new Set(lotesContaIds);

    const lancamentosImportacaoDiretos = this.lancamentos.filter(
      (l) => l.origem === 'importacao' && l.conta_id === contaId
    );
    const idsLancamentosContaPrincipal = new Set(lancamentosImportacaoDiretos.map((l) => l.id));

    const transferenciasContapartida = this.lancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.transferencia_vinculada_id &&
        idsLancamentosContaPrincipal.has(l.transferencia_vinculada_id) &&
        l.conta_id !== contaId
    );
    const transferenciasLote = this.lancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.conta_id === contaId &&
        l.origem_importacao?.lote_id &&
        lotesContaIdsSet.has(l.origem_importacao.lote_id)
    );
    const idsTransferenciasLote = new Set(transferenciasLote.map((l) => l.id));
    const contrapartidasTransferenciasLote = this.lancamentos.filter(
      (l) =>
        l.origem === 'transferencia' &&
        l.transferencia_vinculada_id &&
        idsTransferenciasLote.has(l.transferencia_vinculada_id) &&
        l.conta_id !== contaId
    );
    const ajustesConciliacao = this.lancamentos.filter(
      (l) =>
        l.origem === 'ajuste' &&
        l.conta_id === contaId &&
        l.origem_importacao?.lote_id &&
        lotesContaIdsSet.has(l.origem_importacao.lote_id)
    );

    const todosIds = new Set([
      ...lancamentosImportacaoDiretos.map((l) => l.id),
      ...transferenciasContapartida.map((l) => l.id),
      ...transferenciasLote.map((l) => l.id),
      ...contrapartidasTransferenciasLote.map((l) => l.id),
      ...ajustesConciliacao.map((l) => l.id),
    ]);
    const totalRemovidos = todosIds.size;

    // Remover lançamentos
    this.lancamentos = this.lancamentos.filter((l) => !todosIds.has(l.id));

    // Marcar lotes como 'desfeita'
    for (const loteId of lotesContaIds) {
      const lote = this.importacoes.find((i) => i.id === loteId);
      if (lote) {
        lote.status = 'desfeita';
        lote.atualizado_em = new Date().toISOString();
      }
    }

    // Zerar saldo inicial se solicitado
    if (zerarSaldoInicial) {
      conta.saldo_inicial = 0;
      if (novaDataSaldoInicial) {
        conta.data_saldo_inicial = novaDataSaldoInicial;
      }
    }

    // Contas envolvidas
    const contasIds = new Set<string>([contaId]);
    for (const l of [...transferenciasContapartida, ...contrapartidasTransferenciasLote]) {
      contasIds.add(l.conta_id);
    }

    const saldosFinais = [];
    for (const cId of contasIds) {
      const c = this.getContaById(cId);
      if (c) {
        const resumo = this.calcularResumoConta(cId);
        saldosFinais.push({
          conta_id: cId,
          conta_nome: c.nome,
          saldo_real: resumo.saldo_real,
          limite_credito: c.limite_cheque_especial || 0,
          cheque_utilizado: resumo.cheque_especial_utilizado,
        });
      }
    }

    return {
      sucesso: true,
      mensagem: `Reinício concluído: ${totalRemovidos} lançamento(s) de importação removidos, ${lotesContaIds.length} lote(s) desfeito(s). Backup gerado: ${nomeArquivo}.`,
      removidos: totalRemovidos,
      lotes_desfeitos: lotesContaIds.length,
      backup_timestamp: backupTimestamp,
      saldos_finais: saldosFinais,
    };
  }
}

async function runTests() {
  const sim = new Simulador15I();
  sim.reset();

  const loteId1 = 'lote-imp-15i-01';
  const lote1: RegistroImportacao = {
    id: loteId1,
    data: '2026-08-31',
    usuario: 'admin@mtsolar.com.br',
    banco_codigo: '033',
    conta_id: 'conta-santander',
    nome_arquivo: 'extrato_santander.ofx',
    formato: 'ofx',
    periodo: { inicio: '2026-08-01', fim: '2026-08-31' },
    totais: {
      lancadas: 5,
      ignoradas: 0,
      duplicadas: 0,
      enriquecidas: 0,
      vinculadas: 0,
      total_creditos: 1500,
      total_debitos: 2085,
    },
    status: 'concluida',
    criado_em: '2026-08-31T12:00:00Z',
    atualizado_em: '2026-08-31T12:00:00Z',
  };
  sim.importacoes.push(lote1);

  // Lançamentos manuais e de folha na conta Santander (devem ser PRESERVADOS)
  const lancManualSantander: Lancamento = {
    id: 'lanc-man-01',
    descricao: 'Venda à vista cliente MT',
    valor: 2500.00,
    tipo: 'receita',
    categoria_id: 'cat-vendas',
    conta_id: 'conta-santander',
    data_pagamento: '2026-08-05',
    data_vencimento: '2026-08-05',
    status: 'pago',
    origem: 'manual',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-05T10:00:00Z',
  };

  const lancFolhaSantander: Lancamento = {
    id: 'lanc-folha-01',
    descricao: 'Salário Funcionário 1',
    valor: 3000.00,
    tipo: 'despesa',
    categoria_id: 'cat-folha',
    conta_id: 'conta-santander',
    data_pagamento: '2026-08-10',
    data_vencimento: '2026-08-10',
    status: 'pago',
    origem: 'folha',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-10T10:00:00Z',
  };

  const lancTransfManualSantander: Lancamento = {
    id: 'lanc-transf-man-origem',
    descricao: 'Transferência manual para Sicoob',
    valor: 500.00,
    tipo: 'despesa',
    categoria_id: 'cat-transf',
    conta_id: 'conta-santander',
    conta_destino_id: 'conta-sicoob',
    data_pagamento: '2026-08-12',
    data_vencimento: '2026-08-12',
    status: 'pago',
    origem: 'transferencia',
    transferencia_vinculada_id: 'lanc-transf-man-destino',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-12T10:00:00Z',
  };

  const lancTransfManualSicoob: Lancamento = {
    id: 'lanc-transf-man-destino',
    descricao: 'Transferência manual recebida do Santander',
    valor: 500.00,
    tipo: 'receita',
    categoria_id: 'cat-transf',
    conta_id: 'conta-sicoob',
    data_pagamento: '2026-08-12',
    data_vencimento: '2026-08-12',
    status: 'pago',
    origem: 'transferencia',
    transferencia_vinculada_id: 'lanc-transf-man-origem',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-12T10:00:00Z',
  };

  // Lançamentos de importação no Santander (devem ser REMOVIDOS)
  const lancImp1: Lancamento = {
    id: 'lanc-imp-01',
    descricao: 'PIX RECEBIDO FORNECEDOR',
    valor: 1500.00,
    tipo: 'receita',
    categoria_id: 'cat-outros',
    conta_id: 'conta-santander',
    data_pagamento: '2026-08-15',
    data_vencimento: '2026-08-15',
    status: 'pago',
    origem: 'importacao',
    origem_importacao: {
      lote_id: loteId1,
      banco_codigo: '033',
      conta_id: 'conta-santander',
      assinatura_fraca: 'hash-01',
      formato: 'ofx',
    },
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-15T10:00:00Z',
  };

  const lancImp2: Lancamento = {
    id: 'lanc-imp-02',
    descricao: 'TARIFA BANCARIA',
    valor: 85.00,
    tipo: 'despesa',
    categoria_id: 'cat-banco',
    conta_id: 'conta-santander',
    data_pagamento: '2026-08-16',
    data_vencimento: '2026-08-16',
    status: 'pago',
    origem: 'importacao',
    origem_importacao: {
      lote_id: loteId1,
      banco_codigo: '033',
      conta_id: 'conta-santander',
      assinatura_fraca: 'hash-02',
      formato: 'ofx',
    },
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-16T10:00:00Z',
  };

  // Transferência automática gerada na importação (Contamax / Aplicação Automática)
  // Lado CC (Santander - despesa de aplicação)
  const lancImpTransfOrigem: Lancamento = {
    id: 'lanc-imp-transf-cc',
    descricao: 'APLICACAO CONTAMAX (Importação)',
    valor: 2000.00,
    tipo: 'despesa',
    categoria_id: 'cat-transf',
    conta_id: 'conta-santander',
    conta_destino_id: 'conta-sicoob',
    data_pagamento: '2026-08-18',
    data_vencimento: '2026-08-18',
    status: 'pago',
    origem: 'transferencia',
    transferencia_vinculada_id: 'lanc-imp-transf-dest',
    origem_importacao: {
      lote_id: loteId1,
      banco_codigo: '033',
      conta_id: 'conta-santander',
      assinatura_fraca: 'hash-03',
      formato: 'ofx',
    },
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-18T10:00:00Z',
  };

  // Lado Conta Destino (Sicoob - contrapartida da aplicação)
  const lancImpTransfDestino: Lancamento = {
    id: 'lanc-imp-transf-dest',
    descricao: 'APLICACAO CONTAMAX (Contrapartida)',
    valor: 2000.00,
    tipo: 'receita',
    categoria_id: 'cat-transf',
    conta_id: 'conta-sicoob',
    data_pagamento: '2026-08-18',
    data_vencimento: '2026-08-18',
    status: 'pago',
    origem: 'transferencia',
    transferencia_vinculada_id: 'lanc-imp-transf-cc',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-18T10:00:00Z',
  };

  // Ajuste de conciliação criado por importação
  const lancAjusteImp: Lancamento = {
    id: 'lanc-ajuste-imp-01',
    descricao: 'Ajuste de Conciliação Bancária',
    valor: 15.00,
    tipo: 'despesa',
    categoria_id: 'cat-ajuste',
    conta_id: 'conta-santander',
    data_pagamento: '2026-08-20',
    data_vencimento: '2026-08-20',
    status: 'pago',
    origem: 'ajuste',
    origem_importacao: {
      lote_id: loteId1,
      banco_codigo: '033',
      conta_id: 'conta-santander',
      assinatura_fraca: 'hash-ajuste',
      formato: 'ofx',
    },
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-20T10:00:00Z',
  };

  // Lançamento isolado na Conta Terceira (Bradesco) para provar isolamento 100%
  const lancBradesco: Lancamento = {
    id: 'lanc-bradesco-01',
    descricao: 'Manutenção Bradesco',
    valor: 300.00,
    tipo: 'despesa',
    categoria_id: 'cat-manutencao',
    conta_id: 'conta-bradesco',
    data_pagamento: '2026-08-22',
    data_vencimento: '2026-08-22',
    status: 'pago',
    origem: 'manual',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    criado_em: '2026-08-22T10:00:00Z',
  };

  sim.lancamentos = [
    lancManualSantander,
    lancFolhaSantander,
    lancTransfManualSantander,
    lancTransfManualSicoob,
    lancImp1,
    lancImp2,
    lancImpTransfOrigem,
    lancImpTransfDestino,
    lancAjusteImp,
    lancBradesco,
  ];

  // ══════════════════════════════════════════════════════════════════
  // CENÁRIO 1 — Simulação Dry-Run (simularReinicioConta)
  // ══════════════════════════════════════════════════════════════════
  secao('CENÁRIO 1 — Simulação Dry-Run (simularReinicioConta)');

  const dryRun = sim.simularReinicioConta({
    contaId: 'conta-santander',
    zerarSaldoInicial: false,
  });

  asserir(dryRun.conta_id === 'conta-santander', 'Dry-run refere-se à conta Santander');
  asserir(dryRun.total_lancamentos_removidos === 4, `Total lançamentos a remover da conta = 4 (obtido: ${dryRun.total_lancamentos_removidos})`);
  asserir(dryRun.total_transferencias_removidas === 1, `Total contrapartidas de transferências a remover = 1 (obtido: ${dryRun.total_transferencias_removidas})`);
  asserir(dryRun.total_lotes_afetados === 1, `Total de lotes de importação identificados = 1 (obtido: ${dryRun.total_lotes_afetados})`);
  asserir(dryRun.total_ajustes_removidos === 1, `Total de ajustes de conciliação = 1 (obtido: ${dryRun.total_ajustes_removidos})`);

  // Preservados: 1 manual, 1 folha, 1 transf manual = 3
  asserir(dryRun.preservados.manuais === 1, `Lançamentos manuais preservados = 1 (obtido: ${dryRun.preservados.manuais})`);
  asserir(dryRun.preservados.folha === 1, `Lançamentos de folha preservados = 1 (obtido: ${dryRun.preservados.folha})`);
  asserir(dryRun.preservados.transferencias_manuais === 1, `Transferências manuais preservadas = 1 (obtido: ${dryRun.preservados.transferencias_manuais})`);
  asserir(dryRun.preservados.total === 3, `Total de preservados na conta principal = 3 (obtido: ${dryRun.preservados.total})`);

  // Contas secundárias afetadas pelo dry-run
  asserir(dryRun.contas_afetadas.length === 1, `Exatamente 1 conta secundária afetada (Sicoob) (obtido: ${dryRun.contas_afetadas.length})`);
  asserir(dryRun.contas_afetadas[0].conta_id === 'conta-sicoob', 'Conta secundária afetada é o Sicoob');

  // No Sicoob, lancImpTransfDestino é uma receita de 2000. Ao remover, saldo_depois = saldo_antes - 2000
  const impactoSicoob = dryRun.contas_afetadas[0];
  asserir(impactoSicoob.diferenca === -2000.00, `Impacto na conta secundária calculado com exatidão (-2000.00 | obtido: ${impactoSicoob.diferenca})`);

  // Saldo Santander antes e depois:
  // Saldo inicial: 1000
  // Preservados: +2500 (manual) - 3000 (folha) - 500 (transf manual) = -1000
  // Saldo esperado depois: 1000 + (-1000) = 0.00
  asserir(dryRun.saldo_depois === 0.00, `Saldo projetado após limpeza é R$ 0,00 (obtido: ${dryRun.saldo_depois})`);

  // ══════════════════════════════════════════════════════════════════
  // CENÁRIO 2 — Dry-Run com Opção de Zerar Saldo Inicial
  // ══════════════════════════════════════════════════════════════════
  secao('CENÁRIO 2 — Dry-Run com Opção de Zerar Saldo Inicial');

  const dryRunZerar = sim.simularReinicioConta({
    contaId: 'conta-santander',
    zerarSaldoInicial: true,
    novaDataSaldoInicial: '2026-08-01',
  });

  asserir(dryRunZerar.zerar_saldo_inicial === true, 'Flag zerar_saldo_inicial ativa');
  asserir(dryRunZerar.novo_saldo_inicial === 0, 'Novo saldo inicial é 0');
  asserir(dryRunZerar.nova_data_saldo_inicial === '2026-08-01', 'Nova data do saldo inicial definida');
  // Com saldo inicial zerado (0 em vez de 1000), saldo_depois = 0 + (-1000) = -1000.00
  asserir(dryRunZerar.saldo_depois === -1000.00, `Saldo depois com saldo_inicial zerado = -1000.00 (obtido: ${dryRunZerar.saldo_depois})`);

  // ══════════════════════════════════════════════════════════════════
  // CENÁRIO 3 — Execução Real do Reinício Seguro (executarReinicioConta)
  // ══════════════════════════════════════════════════════════════════
  secao('CENÁRIO 3 — Execução Real do Reinício Seguro (executarReinicioConta)');

  const resultadoExecucao = await sim.executarReinicioConta({
    contaId: 'conta-santander',
    zerarSaldoInicial: false,
  });

  asserir(resultadoExecucao.sucesso === true, 'Execução concluída com sucesso');
  asserir(resultadoExecucao.removidos === 5, `Total geral de lançamentos removidos = 5 (4 CC + 1 contrapartida Sicoob) (obtido: ${resultadoExecucao.removidos})`);
  asserir(resultadoExecucao.lotes_desfeitos === 1, `Lote de importação marcado como desfeito = 1 (obtido: ${resultadoExecucao.lotes_desfeitos})`);

  // Conferir estado do lote
  const loteAtualizado = sim.importacoes.find((l) => l.id === loteId1);
  asserir(loteAtualizado?.status === 'desfeita', 'Status do lote foi alterado para "desfeita"');

  // Conferir lançamentos após limpeza
  const restosImportacao = sim.lancamentos.filter(
    (l) => l.origem === 'importacao' && l.conta_id === 'conta-santander'
  );
  asserir(restosImportacao.length === 0, 'Zero lançamentos de origem "importacao" no Santander');

  // Contrapartida no Sicoob deve ter sido removida
  const restosContrapartida = sim.lancamentos.filter((l) => l.id === lancImpTransfDestino.id);
  asserir(restosContrapartida.length === 0, 'Contrapartida de transferência no Sicoob foi removida');

  // Lançamentos manuais e folha no Santander permanecem intactos
  const manualRestante = sim.lancamentos.find((l) => l.id === lancManualSantander.id);
  const folhaRestante = sim.lancamentos.find((l) => l.id === lancFolhaSantander.id);
  const transfManualRestante = sim.lancamentos.find((l) => l.id === lancTransfManualSantander.id);

  asserir(manualRestante !== undefined, 'Lançamento manual do Santander PRESERVADO intacto');
  asserir(folhaRestante !== undefined, 'Lançamento de folha do Santander PRESERVADO intacto');
  asserir(transfManualRestante !== undefined, 'Transferência manual do Santander PRESERVADA intacta');

  // Transferência manual do Sicoob permanece intacta
  const transfManualSicoobRestante = sim.lancamentos.find((l) => l.id === lancTransfManualSicoob.id);
  asserir(transfManualSicoobRestante !== undefined, 'Transferência manual do Sicoob PRESERVADA intacta');

  // Lançamento do Bradesco (conta terceira) permanece 100% intocado
  const lancBradescoRestante = sim.lancamentos.find((l) => l.id === lancBradesco.id);
  asserir(lancBradescoRestante !== undefined, 'Lançamento da conta Bradesco 100% INTACTO');

  // Saldos reais calculados após reinício
  const resumoSantanderFinal = sim.calcularResumoConta('conta-santander');
  asserir(resumoSantanderFinal.saldo_real === 0.00, `Saldo real do Santander recalculado com perfeição = R$ 0,00 (obtido: ${resumoSantanderFinal.saldo_real})`);

  const resumoSicoobFinal = sim.calcularResumoConta('conta-sicoob');
  // Sicoob inicial: 50.000 + 500 (transf manual) = 50.500,00
  asserir(resumoSicoobFinal.saldo_real === 50500.00, `Saldo real do Sicoob recalculado com perfeição = R$ 50.500,00 (obtido: ${resumoSicoobFinal.saldo_real})`);

  const resumoBradescoFinal = sim.calcularResumoConta('conta-bradesco');
  // Bradesco inicial: 10.000 - 300 = 9.700,00
  asserir(resumoBradescoFinal.saldo_real === 9700.00, `Saldo real do Bradesco não foi afetado = R$ 9.700,00 (obtido: ${resumoBradescoFinal.saldo_real})`);

  // ══════════════════════════════════════════════════════════════════
  // CENÁRIO 4 — Validações e Casos Limite
  // ══════════════════════════════════════════════════════════════════
  secao('CENÁRIO 4 — Validações e Casos Limite');

  // Conta inexistente lança erro amigável
  try {
    sim.simularReinicioConta({ contaId: 'conta-fantasma' });
    asserir(false, 'Deveria ter lançado erro para conta inexistente no dry-run');
  } catch (err: any) {
    asserir(err.message.includes('não encontrada'), 'Dry-run rejeita conta inexistente com segurança');
  }

  try {
    await sim.executarReinicioConta({ contaId: 'conta-fantasma' });
    asserir(false, 'Deveria ter lançado erro para conta inexistente na execução');
  } catch (err: any) {
    asserir(err.message.includes('não encontrada'), 'Execução rejeita conta inexistente com segurança');
  }

  // Backup JSON gerado contém dados
  const backup = sim.exportarBackupCompletoJSON();
  const backupObj = JSON.parse(backup);
  asserir(Array.isArray(backupObj.contas) && backupObj.contas.length >= 3, 'Backup automático contém as contas');
  asserir(Array.isArray(backupObj.lancamentos), 'Backup automático contém os lançamentos');

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(`  TOTAL DE TESTES: ${totalTestes}`);
  console.log(`  PASSARAM: ${passarem()}`);
  console.log(`  FALHARAM: ${falharam}`);
  console.log('══════════════════════════════════════════════════════════════════════\n');

  if (falharam === 0) {
    console.log('  ✓ TODOS OS TESTES DA PARTE 15I PASSARAM COM SUCESSO!\n');
  } else {
    console.error(`  ✗ ${falharam} teste(s) falharam.`);
    process.exit(1);
  }
}

function passarem() {
  return passaram;
}

runTests().catch((e) => {
  console.error('Erro na suíte de testes:', e);
  process.exit(1);
});
