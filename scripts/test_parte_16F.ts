// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 16F: Teste de Regressão Completo com Simulador
//
// Requisitos testados (sem conexão real com Firestore, 100% em memória):
// 1) Importar Lote A (Período A, ex: Janeiro/2026), depois Lote B (Período B, ex: Fevereiro/2026) na mesma conta,
//    em ambiente com 2 contas cadastradas.
// 2) Nenhum item do Lote A reaparece na revisão do Lote B.
// 3) Deduplicação estrita: 0 lançamentos duplicados (mesmo FITID ou assinatura fraca).
// 4) saldo_inicial e data_saldo_inicial permanecem estritamente inalterados após a importação do Lote B.
// 5) observacoes devidamente preenchidas com todos os metadados (histórico, favorecido, FITID, doc, arquivo, lote).
// 6) Isolamento entre contas: a segunda conta não sofre qualquer alteração.
// 7) Diagnóstico e comparação: "Desfazer importação" vs "Reiniciar conta".

import {
  Lancamento,
  ContaBancaria,
  ParamsImportacaoLote,
  RegistroImportacao,
  DryRunReinicioConta,
} from '../src/types';
import {
  classificarDuplicatas,
  ContextoClassificacao,
} from '../src/utils/extrato/classificarDuplicatas';
import {
  TransacaoExtrato,
} from '../src/utils/extrato/tipos';
import {
  formatarObservacoesImportacao,
  gerarDescricaoCurta,
} from '../src/utils/extrato/observacoesHelper';
import {
  contaTemLancamentosImportados,
  analisarDuplaContagemSaldoInicial,
  calcularMovimentacoesConta,
} from '../src/utils/extrato/saldoInicialHelper';
import {
  gerarAssinaturaFraca,
} from '../src/utils/extrato/assinatura';
import { inferirFormaPagamento } from '../src/utils/extrato/inferirFormaPagamento';

let totalTestes = 0;
let passaram = 0;
let falharam = 0;
const falhas: string[] = [];

function asserir(condicao: boolean, titulo: string, detalheErro?: string): void {
  totalTestes++;
  if (condicao) {
    console.log(`  ✓ ${titulo}`);
    passaram++;
  } else {
    const msg = `✗ ${titulo}${detalheErro ? ` → ${detalheErro}` : ''}`;
    console.error(`  ${msg}`);
    falhas.push(msg);
    falharam++;
  }
}

function secao(nome: string): void {
  console.log('\n' + '═'.repeat(75));
  console.log('  ' + nome);
  console.log('═'.repeat(75));
}

/**
 * Simulador fiel e puro em memória (sem Firestore real, sem .env.local)
 */
class SimuladorRegressao16F {
  public cacheLancamentos: Lancamento[] = [];
  public cacheContas: ContaBancaria[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.cacheLancamentos = [];
    this.cacheImportacoes = [];
    this.cacheContas = [
      {
        id: 'conta-santander',
        nome: 'Santander Corrente MT Solar',
        banco: 'Santander',
        banco_codigo: '033',
        agencia: '3749',
        numero_conta: '13004696-4',
        tipo: 'corrente',
        saldo_inicial: 5000.0,
        data_saldo_inicial: '2025-12-31',
        limite_cheque_especial: 8800.0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#CC0000',
        ativa: true,
      },
      {
        id: 'conta-sicoob',
        nome: 'Sicoob Empresarial',
        banco: 'Sicoob',
        banco_codigo: '756',
        agencia: '4321',
        numero_conta: '98765-4',
        tipo: 'corrente',
        saldo_inicial: 200000.0,
        data_saldo_inicial: '2025-12-31',
        limite_cheque_especial: 10000.0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#003064',
        ativa: true,
      },
    ];
  }

  public getConta(id: string): ContaBancaria {
    const c = this.cacheContas.find((item) => item.id === id);
    if (!c) throw new Error(`Conta ${id} não encontrada.`);
    return { ...c };
  }

  public getLancamentos(): Lancamento[] {
    return [...this.cacheLancamentos];
  }

  public getImportacoes(): RegistroImportacao[] {
    return [...this.cacheImportacoes];
  }

  public calcularSaldoReal(contaId: string): number {
    const conta = this.getConta(contaId);
    let saldo = conta.saldo_inicial;
    for (const l of this.cacheLancamentos) {
      if (l.conta_id === contaId && l.status === 'pago') {
        if (l.tipo === 'receita') saldo += l.valor;
        else if (l.tipo === 'despesa') saldo -= l.valor;
      }
    }
    return +saldo.toFixed(2);
  }

  /**
   * Simula a importação de lote exatamente conforme implementado em storage.ts
   */
  public async importarExtratoLote(params: ParamsImportacaoLote): Promise<{ sucesso: boolean; loteId: string }> {
    const conta = this.getConta(params.contaId);
    const saldoAntes = this.calcularSaldoReal(params.contaId);

    const novosLancamentos: Lancamento[] = [];
    const agoraIso = new Date().toISOString();

    const totais = {
      lancadas: 0,
      ignoradas: 0,
      duplicadas: 0,
      enriquecidas: 0,
      vinculadas: 0,
      total_creditos: 0,
      total_debitos: 0,
    };

    for (const item of params.itens) {
      if (item.acao === 'ignorar') {
        totais.ignoradas++;
        continue;
      }

      if (item.acao === 'incluir') {
        const tx = item.transacao;
        const ehReceita = item.tipoLancamento === 'receita' || tx.tipo === 'credito';
        const valor = Math.abs(tx.valor);
        const dataIso = tx.data;
        const formaPag = inferirFormaPagamento(tx.descricaoOriginal);

        const assFraca = gerarAssinaturaFraca({
          conta: conta.numero_conta || conta.id,
          data: dataIso,
          valor,
          tipo: tx.tipo,
          descricaoNormalizada: tx.descricaoNormalizada,
          ordemNoDia: tx.ordemNoDia || 0,
        });

        const descCurta = gerarDescricaoCurta(tx.descricaoOriginal, tx.contraparte);

        const obsFormatada = formatarObservacoesImportacao({
          descricaoOriginal: tx.descricaoOriginal,
          contraparte: tx.contraparte,
          documento: tx.documento,
          fitid: tx.fitid,
          bancoNome: params.bancoNome || conta.nome,
          bancoCodigo: params.bancoCodigo || conta.banco_codigo || '033',
          nomeArquivo: params.nomeArquivo,
          formato: params.formato,
          loteId: params.loteId,
          dataHoraImportacao: agoraIso,
        });

        const novo: Lancamento = {
          id: `lanc-${Math.random().toString(36).substring(2, 9)}`,
          tipo: item.tipoLancamento === 'receita' ? 'receita' : 'despesa',
          descricao: descCurta,
          observacoes: obsFormatada,
          valor,
          data_vencimento: dataIso,
          data_pagamento: dataIso,
          status: 'pago',
          conta_id: params.contaId,
          categoria_id: item.categoriaId || 'cat-outros',
          forma_pagamento: formaPag,
          origem: 'importacao',
          recorrencia: 'nenhuma',
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo || conta.banco_codigo || '033',
            conta_id: params.contaId,
            fitid: tx.fitid,
            assinatura_fraca: assFraca,
            formato: params.formato,
            nome_arquivo: params.nomeArquivo,
            data_importacao: agoraIso,
            documento: tx.documento,
            contraparte: tx.contraparte,
            descricao_original: tx.descricaoOriginal,
          },
          criado_em: agoraIso,
        };

        novosLancamentos.push(novo);
        totais.lancadas++;
        if (ehReceita) totais.total_creditos += valor;
        else totais.total_debitos += valor;
      }
    }

    // Gravação dos novos lançamentos no cache
    for (const l of novosLancamentos) {
      this.cacheLancamentos.push(l);
    }

    // Se houve ajuste explícito de saldo inicial solicitado pelo usuário
    if (params.saldoInicialAjustado) {
      const idxConta = this.cacheContas.findIndex((c) => c.id === params.contaId);
      if (idxConta >= 0) {
        this.cacheContas[idxConta] = {
          ...this.cacheContas[idxConta],
          saldo_inicial: params.saldoInicialAjustado.novoSaldoInicial,
          data_saldo_inicial: params.saldoInicialAjustado.novaDataSaldoInicial,
        };
      }
    }

    const saldoDepois = this.calcularSaldoReal(params.contaId);

    const registroLote: RegistroImportacao = {
      id: params.loteId,
      data: new Date().toISOString().split('T')[0],
      usuario: params.usuario,
      conta_id: params.contaId,
      banco_codigo: params.bancoCodigo || conta.banco_codigo || '033',
      formato: params.formato,
      nome_arquivo: params.nomeArquivo,
      periodo: params.periodo,
      saldo_sistema_antes: saldoAntes,
      saldo_sistema_depois: saldoDepois,
      status: 'concluida',
      totais,
      criado_em: agoraIso,
    };

    this.cacheImportacoes.push(registroLote);

    return {
      loteId: params.loteId,
      sucesso: true,
    };
  }

  /**
   * Desfaz com segurança um lote de importação
   */
  public desfazerImportacao(loteId: string): { removidos: number } {
    const lote = this.cacheImportacoes.find((i) => i.id === loteId);
    if (!lote) throw new Error(`Lote ${loteId} não encontrado.`);
    if (lote.status === 'desfeita') throw new Error(`Lote já desfeito.`);

    const antes = this.cacheLancamentos.length;
    this.cacheLancamentos = this.cacheLancamentos.filter(
      (l) => l.origem_importacao?.lote_id !== loteId
    );
    const removidos = antes - this.cacheLancamentos.length;
    lote.status = 'desfeita';
    return { removidos };
  }

  /**
   * Simula a limpeza completa via Reiniciar Conta / Preparar para reimportar
   */
  public simularReinicioConta(contaId: string): DryRunReinicioConta {
    const conta = this.getConta(contaId);
    const lancamentosRemover = this.cacheLancamentos.filter(
      (l) => l.conta_id === contaId && l.origem === 'importacao'
    );
    const lancamentosPreservar = this.cacheLancamentos.filter(
      (l) => l.conta_id === contaId && l.origem !== 'importacao'
    );
    const lotesAfetados = this.cacheImportacoes.filter(
      (i) => i.conta_id === contaId && i.status !== 'desfeita'
    );

    return {
      conta_id: conta.id,
      conta_nome: conta.nome,
      saldo_antes: this.calcularSaldoReal(contaId),
      saldo_depois: conta.saldo_inicial,
      saldo_inicial_atual: conta.saldo_inicial,
      novo_saldo_inicial: conta.saldo_inicial,
      nova_data_saldo_inicial: conta.data_saldo_inicial,
      zerar_saldo_inicial: false,
      total_lancamentos_removidos: lancamentosRemover.length,
      total_transferencias_removidas: 0,
      total_lotes_afetados: lotesAfetados.length,
      total_ajustes_removidos: 0,
      contas_afetadas: [
        {
          conta_id: conta.id,
          conta_nome: conta.nome,
          saldo_antes: this.calcularSaldoReal(contaId),
          saldo_depois: conta.saldo_inicial,
          transferencias_removidas: 0,
          diferenca: this.calcularSaldoReal(contaId) - conta.saldo_inicial,
        },
      ],
      preservados: {
        manuais: lancamentosPreservar.length,
        folha: 0,
        contas_pagar_receber: 0,
        transferencias_manuais: 0,
        total: lancamentosPreservar.length,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUÇÃO DA SUITE DE TESTES
// ═══════════════════════════════════════════════════════════════════════════

async function executarTestes() {
  const sim = new SimuladorRegressao16F();

  // ─────────────────────────────────────────────────────────────────────────
  secao('1. ESTADO INICIAL E ISOLAMENTO ENTRE DUAS CONTAS CADASTRADAS');
  // ─────────────────────────────────────────────────────────────────────────
  const cSantander = sim.getConta('conta-santander');
  const cSicoob = sim.getConta('conta-sicoob');

  asserir(cSantander.saldo_inicial === 5000.0, 'Conta 1 (Santander) saldo inicial configurado em R$ 5.000,00');
  asserir(cSantander.data_saldo_inicial === '2025-12-31', 'Conta 1 data do saldo inicial: 2025-12-31');
  asserir(cSicoob.saldo_inicial === 200000.0, 'Conta 2 (Sicoob) saldo inicial configurado em R$ 200.000,00');
  asserir(sim.getLancamentos().length === 0, 'Sistema inicia sem lançamentos prévios');
  asserir(sim.getImportacoes().length === 0, 'Sistema inicia sem lotes prévios');

  // ─────────────────────────────────────────────────────────────────────────
  secao('2. IMPORTAÇÃO DO LOTE A (JANEIRO/2026 NA CONTA SANTANDER)');
  // ─────────────────────────────────────────────────────────────────────────
  const txsLoteA: TransacaoExtrato[] = [
    {
      idTemporario: 'tx-a-1',
      tipo: 'credito',
      valor: 15400.0,
      data: '2026-01-10',
      descricaoOriginal: 'PIX RECEBIDO CLIENTE ENERGIA SOLAR',
      descricaoNormalizada: 'PIX RECEBIDO CLIENTE ENERGIA SOLAR',
      documento: 'DOC-10101',
      fitid: '20260110-033-0001',
      contraparte: 'CLIENTE ENERGIA SOLAR',
      ordemNoDia: 0,
      linhaOrigem: 1,
    },
    {
      idTemporario: 'tx-a-2',
      tipo: 'debito',
      valor: 3200.5,
      data: '2026-01-15',
      descricaoOriginal: 'PIX ENVIADO FORNECEDOR INVERSORES MT',
      descricaoNormalizada: 'PIX ENVIADO FORNECEDOR INVERSORES MT',
      documento: 'DOC-10102',
      fitid: '20260115-033-0002',
      contraparte: 'FORNECEDOR INVERSORES MT',
      ordemNoDia: 0,
      linhaOrigem: 2,
    },
    {
      idTemporario: 'tx-a-3',
      tipo: 'debito',
      valor: 89.9,
      data: '2026-01-20',
      descricaoOriginal: 'TARIFA BANCARIA CESTA PJ',
      descricaoNormalizada: 'TARIFA BANCARIA CESTA PJ',
      documento: 'DOC-10103',
      fitid: '20260120-033-0003',
      contraparte: 'BANCO SANTANDER S/A',
      ordemNoDia: 0,
      linhaOrigem: 3,
    },
    {
      idTemporario: 'tx-a-4',
      tipo: 'credito',
      valor: 8500.0,
      data: '2026-01-28',
      descricaoOriginal: 'TED RECEBIDA MEDICAO PROJETO CUIABA',
      descricaoNormalizada: 'TED RECEBIDA MEDICAO PROJETO CUIABA',
      documento: 'DOC-10104',
      fitid: '20260128-033-0004',
      contraparte: 'PROJETO CUIABA',
      ordemNoDia: 0,
      linhaOrigem: 4,
    },
  ];

  const resultadoA = await sim.importarExtratoLote({
    loteId: 'lote-jan-2026',
    contaId: 'conta-santander',
    bancoCodigo: '033',
    bancoNome: 'Santander',
    formato: 'ofx',
    nomeArquivo: 'extrato_santander_jan2026.ofx',
    periodo: { inicio: '2026-01-01', fim: '2026-01-31' },
    usuario: 'admin@mtsolar.com.br',
    itens: txsLoteA.map((tx) => ({
      id: `item-${tx.idTemporario}`,
      acao: 'incluir' as const,
      natureza: 'normal' as const,
      tipoLancamento: tx.tipo === 'credito' ? ('receita' as const) : ('despesa' as const),
      categoriaId: tx.tipo === 'credito' ? 'cat-receita-obras' : 'cat-despesa-fornecedores',
      transacao: tx,
    })),
  });

  asserir(resultadoA.sucesso === true, 'Lote A gravado com sucesso');
  asserir(sim.getLancamentos().length === 4, 'Total de lançamentos no banco após Lote A: 4');

  // Validação das observações do Lote A
  const lancsA = sim.getLancamentos().filter((l) => l.origem_importacao?.lote_id === 'lote-jan-2026');
  for (const l of lancsA) {
    asserir(Boolean(l.observacoes && l.observacoes.toLowerCase().includes('histórico original:')), `Lançamento ${l.id} possui bloco Histórico Original`);
    asserir(Boolean(l.observacoes && l.observacoes.includes('Lote: lote-jan-2026')), `Lançamento ${l.id} possui Lote de importação correto`);
    asserir(Boolean(l.observacoes && l.observacoes.includes('Arquivo: extrato_santander_jan2026.ofx')), `Lançamento ${l.id} cita o arquivo OFX`);
    asserir(Boolean(l.origem_importacao?.fitid), `Lançamento ${l.id} preservou FITID`);
  }

  // Verifica isolamento de contas após Lote A
  const cSicoobAposA = sim.getConta('conta-sicoob');
  asserir(cSicoobAposA.saldo_inicial === 200000.0, 'Conta Sicoob permaneceu 100% inalterada após Lote A');
  asserir(sim.calcularSaldoReal('conta-sicoob') === 200000.0, 'Saldo real da Conta Sicoob intacto');

  // ─────────────────────────────────────────────────────────────────────────
  secao('3. REVISÃO DO LOTE B (FEVEREIRO/2026 NA MESMA CONTA SANTANDER)');
  // ─────────────────────────────────────────────────────────────────────────
  // Transações do Lote B: 3 novas de Fevereiro + 1 tentativa de duplicata exata de Janeiro (mesmo FITID)
  const txsLoteB: TransacaoExtrato[] = [
    {
      idTemporario: 'tx-b-1',
      tipo: 'credito',
      valor: 12000.0,
      data: '2026-02-05',
      descricaoOriginal: 'PIX RECEBIDO CLIENTE USINA SINOP',
      descricaoNormalizada: 'PIX RECEBIDO CLIENTE USINA SINOP',
      documento: 'DOC-20201',
      fitid: '20260205-033-0005',
      contraparte: 'CLIENTE USINA SINOP',
      ordemNoDia: 0,
      linhaOrigem: 1,
    },
    {
      idTemporario: 'tx-b-2',
      tipo: 'debito',
      valor: 4500.0,
      data: '2026-02-12',
      descricaoOriginal: 'PIX ENVIADO CABOS E ESTRUTURAS MT',
      descricaoNormalizada: 'PIX ENVIADO CABOS E ESTRUTURAS MT',
      documento: 'DOC-20202',
      fitid: '20260212-033-0006',
      contraparte: 'CABOS E ESTRUTURAS MT',
      ordemNoDia: 0,
      linhaOrigem: 2,
    },
    {
      idTemporario: 'tx-b-3',
      tipo: 'debito',
      valor: 89.9,
      data: '2026-02-20',
      descricaoOriginal: 'TARIFA BANCARIA CESTA PJ',
      descricaoNormalizada: 'TARIFA BANCARIA CESTA PJ',
      documento: 'DOC-20203',
      fitid: '20260220-033-0007',
      contraparte: 'BANCO SANTANDER S/A',
      ordemNoDia: 0,
      linhaOrigem: 3,
    },
    // Transação idêntica à do Lote A (teste de colisão/duplicação cruzada)
    {
      idTemporario: 'tx-b-dup',
      tipo: 'debito',
      valor: 3200.5,
      data: '2026-01-15',
      descricaoOriginal: 'PIX ENVIADO FORNECEDOR INVERSORES MT',
      descricaoNormalizada: 'PIX ENVIADO FORNECEDOR INVERSORES MT',
      documento: 'DOC-10102',
      fitid: '20260115-033-0002', // Mesmo FITID do Lote A
      contraparte: 'FORNECEDOR INVERSORES MT',
      ordemNoDia: 0,
      linhaOrigem: 4,
    },
  ];

  const contextoB: ContextoClassificacao = {
    contaId: 'conta-santander',
    bancoCodigo: '033',
    contaNumero: '13004696-4',
    loteId: 'lote-fev-2026',
  };

  const classificadasB = classificarDuplicatas(txsLoteB, sim.getLancamentos(), contextoB);

  // Validação: Nenhum item do Lote A aparece como novo na revisão de B
  const novasB = classificadasB.filter((c) => c.status === 'nova');
  const duplicadasExatasB = classificadasB.filter((c) => c.status === 'duplicada_exata');

  asserir(novasB.length === 3, 'Revisão de B identifica exatamente 3 transações novas legítimas');
  asserir(duplicadasExatasB.length === 1, 'Revisão de B detecta a transação repetida de Janeiro como duplicada_exata');
  asserir(
    duplicadasExatasB[0].transacao.fitid === '20260115-033-0002',
    'Transação duplicada identificada corretamente pelo FITID existente no Lote A'
  );

  // Nenhum item de Janeiro está na lista de novos de B
  const itensJanEmNovosB = novasB.filter((c) => c.transacao.data.startsWith('2026-01'));
  asserir(itensJanEmNovosB.length === 0, 'NENHUM item do Lote A (Janeiro) aparece na lista de novos da revisão de B');

  // ─────────────────────────────────────────────────────────────────────────
  secao('4. ANÁLISE DE SALDO INICIAL PARA O LOTE B (IMPORTAÇÃO SUBSEQUENTE)');
  // ─────────────────────────────────────────────────────────────────────────
  const jaTemLotesImportados = contaTemLancamentosImportados('conta-santander', sim.getLancamentos());
  asserir(jaTemLotesImportados === true, 'Sistema detecta com precisão que a Conta Santander JÁ possui lançamentos importados');

  const { somaTotal, menorData } = calcularMovimentacoesConta({
    contaId: 'conta-santander',
    lancamentosExistentes: sim.getLancamentos(),
    novosItens: novasB.map((n) => ({
      acao: 'incluir' as const,
      natureza: 'normal' as const,
      tipoLancamento: n.transacao.tipo === 'credito' ? ('receita' as const) : ('despesa' as const),
      transacao: n.transacao,
    })),
  });

  const saldoBancoExtratoFev = 33019.7; // 25609.6 + 12000 - 4500 - 89.9
  const analiseSaldoB = analisarDuplaContagemSaldoInicial({
    saldoInicialAtual: cSantander.saldo_inicial,
    somaTotalMovimentacoes: somaTotal,
    saldoBanco: saldoBancoExtratoFev,
    menorDataTransacao: menorData,
  });

  asserir(
    analiseSaldoB.temDivergencia === false,
    'Saldos batem perfeitamente; nenhuma divergência de saldo inicial detectada'
  );

  // ─────────────────────────────────────────────────────────────────────────
  secao('5. GRAVAÇÃO DO LOTE B E VERIFICAÇÃO DE SALDO INALTERADO');
  // ─────────────────────────────────────────────────────────────────────────
  const saldoInicialSantanderAntesB = sim.getConta('conta-santander').saldo_inicial;
  const dataSaldoInicialSantanderAntesB = sim.getConta('conta-santander').data_saldo_inicial;

  const resultadoB = await sim.importarExtratoLote({
    loteId: 'lote-fev-2026',
    contaId: 'conta-santander',
    bancoCodigo: '033',
    bancoNome: 'Santander',
    formato: 'ofx',
    nomeArquivo: 'extrato_santander_fev2026.ofx',
    periodo: { inicio: '2026-02-01', fim: '2026-02-28' },
    usuario: 'admin@mtsolar.com.br',
    // Salva apenas os itens classificados como 'nova' (0 duplicados)
    itens: novasB.map((item) => ({
      id: `item-${item.transacao.idTemporario}`,
      acao: 'incluir' as const,
      natureza: 'normal' as const,
      tipoLancamento: item.transacao.tipo === 'credito' ? ('receita' as const) : ('despesa' as const),
      categoriaId: item.transacao.tipo === 'credito' ? 'cat-receita-obras' : 'cat-despesa-fornecedores',
      transacao: item.transacao,
    })),
  });

  asserir(resultadoB.sucesso === true, 'Lote B gravado com sucesso');

  // Verificação crucial: saldo_inicial inalterado em B
  const cSantanderAposB = sim.getConta('conta-santander');
  asserir(
    cSantanderAposB.saldo_inicial === saldoInicialSantanderAntesB,
    `saldo_inicial permanece estritamente inalterado em B: R$ ${cSantanderAposB.saldo_inicial.toFixed(2)}`
  );
  asserir(
    cSantanderAposB.data_saldo_inicial === dataSaldoInicialSantanderAntesB,
    `data_saldo_inicial permanece inalterada em B: ${cSantanderAposB.data_saldo_inicial}`
  );

  // Verificação de 0 duplicados no banco
  const todosLancamentos = sim.getLancamentos();
  asserir(todosLancamentos.length === 7, 'Total exato de lançamentos no sistema: 7 (4 de A + 3 de B)');

  const fitids = todosLancamentos.map((l) => l.origem_importacao?.fitid).filter(Boolean);
  const fitidsUnicos = new Set(fitids);
  asserir(fitids.length === fitidsUnicos.size, 'ZERO duplicados: todos os 7 FITIDs são estritamente únicos');

  const assinaturasFracas = todosLancamentos.map((l) => l.origem_importacao?.assinatura_fraca).filter(Boolean);
  const assinaturasFracasUnicas = new Set(assinaturasFracas);
  asserir(
    assinaturasFracas.length === assinaturasFracasUnicas.size,
    'ZERO duplicados: todas as assinaturas fracas são estritamente únicas'
  );

  // Observações preenchidas para todos os lançamentos do Lote B
  const lancsB = todosLancamentos.filter((l) => l.origem_importacao?.lote_id === 'lote-fev-2026');
  for (const l of lancsB) {
    asserir(Boolean(l.observacoes && l.observacoes.length > 50), `Lançamento ${l.id} de B possui observações ricas preenchidas`);
    asserir(Boolean(l.observacoes && l.observacoes.includes('extrato_santander_fev2026.ofx')), `Lançamento ${l.id} referencia arquivo de Fev`);
    asserir(l.origem_importacao?.contraparte !== undefined, `Lançamento ${l.id} possui contraparte estruturada`);
  }

  // Isolamento da Conta 2 (Sicoob)
  const cSicoobAposB = sim.getConta('conta-sicoob');
  asserir(cSicoobAposB.saldo_inicial === 200000.0, 'Conta Sicoob permanece com saldo inicial intacto (R$ 200.000,00)');
  asserir(sim.calcularSaldoReal('conta-sicoob') === 200000.0, 'Conta Sicoob possui 0 lançamentos vazados');

  // ─────────────────────────────────────────────────────────────────────────
  secao('6. TENTATIVA DE REIMPORTAÇÃO DO LOTE B (DEDUPLICAÇÃO 100%)');
  // ─────────────────────────────────────────────────────────────────────────
  const reclassificacaoB = classificarDuplicatas(txsLoteB, sim.getLancamentos(), contextoB);
  const reNovas = reclassificacaoB.filter((c) => c.status === 'nova');
  const reDuplicadas = reclassificacaoB.filter((c) => c.status === 'duplicada_exata');

  asserir(reNovas.length === 0, 'Reimportar o mesmo extrato resulta em 0 novas transações');
  asserir(reDuplicadas.length === txsLoteB.length, 'Todas as transações do extrato são detectadas como duplicadas exatas');

  // ─────────────────────────────────────────────────────────────────────────
  secao('7. ANÁLISE COMPARATIVA: DESFAZER IMPORTAÇÃO vs REINICIAR CONTA');
  // ─────────────────────────────────────────────────────────────────────────
  // Cenário 7.1: Desfazer importação de um lote pontual (Lote B)
  const copiaSim = new SimuladorRegressao16F();
  // Copia o estado atual
  copiaSim.cacheContas = JSON.parse(JSON.stringify(sim.cacheContas));
  copiaSim.cacheLancamentos = JSON.parse(JSON.stringify(sim.cacheLancamentos));
  copiaSim.cacheImportacoes = JSON.parse(JSON.stringify(sim.cacheImportacoes));

  const resultadoDesfazerB = copiaSim.desfazerImportacao('lote-fev-2026');
  asserir(resultadoDesfazerB.removidos === 3, 'Desfazer Lote B removeu apenas os 3 lançamentos de Fevereiro');
  asserir(
    copiaSim.getLancamentos().length === 4,
    'Os 4 lançamentos do Lote A permaneceram 100% preservados após desfazer B'
  );
  asserir(
    copiaSim.getConta('conta-santander').saldo_inicial === 5000.0,
    'Saldo inicial da conta mantido após desfazer importação'
  );

  // Cenário 7.2: Reiniciar Conta / Preparar para reimportar (Limpeza de todos os lotes de importação)
  // Adiciona um lançamento manual para validar que lançamentos manuais NUNCA são apagados
  const lancamentoManual: Lancamento = {
    id: 'lanc-manual-avulso',
    tipo: 'despesa',
    descricao: 'Adiantamento Viagem Instalação Usina',
    valor: 450.0,
    data_vencimento: '2026-01-20',
    data_pagamento: '2026-01-20',
    status: 'pago',
    conta_id: 'conta-santander',
    categoria_id: 'cat-viagens',
    forma_pagamento: 'dinheiro',
    origem: 'manual',
    recorrencia: 'nenhuma',
    criado_em: new Date().toISOString(),
  };
  sim.cacheLancamentos.push(lancamentoManual);

  const dryRun = sim.simularReinicioConta('conta-santander');
  asserir(dryRun.total_lancamentos_removidos === 7, 'DryRun indica remoção de exatamente 7 lançamentos importados');
  asserir(dryRun.preservados.total === 1, 'DryRun PRESERVA com segurança o lançamento manual avulso');
  asserir(dryRun.preservados.manuais === 1, 'Lançamento manual preservado contabilizado com exatidão');
  asserir(dryRun.total_lotes_afetados === 2, 'DryRun lista os 2 lotes de importação afetados (A e B)');
  asserir(
    dryRun.novo_saldo_inicial === 5000.0,
    'Saldo inicial permanece R$ 5.000,00 após a simulação de reinício'
  );

  // ─────────────────────────────────────────────────────────────────────────
  secao('RESUMO DOS RESULTADOS DA PARTE 16F');
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\nTotal de asserções executadas: ${totalTestes}`);
  console.log(`✓ Passaram: ${passaram}`);
  console.log(`✗ Falharam: ${falharam}`);

  if (falharam > 0) {
    console.error('\nFALHAS REGISTRADAS:');
    for (const f of falhas) {
      console.error(`  - ${f}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!\n');
  }
}

executarTestes().catch((err) => {
  console.error('Erro fatal durante execução dos testes:', err);
  process.exit(1);
});
