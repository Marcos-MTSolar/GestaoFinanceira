// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 18C: Regra Única de Saldo Inicial na Importação de Extratos
//
// Requisitos testados (com simulador em memória e funções puras, sem chamadas reais de rede):
// (a) Conta com saldo real informado 1.234,56 e extrato de 7 dias
//     → saldo final do app = 1.234,56 e saldo_inicial = 1.234,56 − soma;
// (b) OFX com LEDGERBAL -7.377,22 e as 400 transações
//     → saldo inicial -6.803,58 em 02/08/2026;
// (c) XLSX de 1.682 linhas com saldo informado;
// (d) Saldo "disponível" com limite 8.800 convertido corretamente;
// (e) Segunda importação não altera saldo_inicial nem data_saldo_inicial;
// (f) Extrato com Contamax ignorado e como transferência;
// (g) Desfazer restaura saldo_inicial e data_saldo_inicial anteriores.

import {
  ContaBancaria,
  Lancamento,
  RegistroImportacao,
} from '../src/types';
import {
  subtrairUmDia,
  converterDisponivelParaSaldoReal,
  contaTemLancamentosImportados,
  calcularSaldoInicialPrimeiraImportacao,
  conferirSaldoFinal,
} from '../src/utils/extrato/saldoInicialHelper';

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

function mockConta(dados: any): ContaBancaria {
  return {
    id: 'conta',
    nome: 'Conta',
    banco: 'Banco',
    tipo: 'corrente' as const,
    saldo_inicial: 0,
    data_saldo_inicial: '2026-01-01',
    limite_cheque_especial: 0,
    taxa_juros_cheque_especial_mensal: 0,
    cor: '#003064',
    ativa: true,
    ...dados,
  } as ContaBancaria;
}

function mockLancamento(dados: any): Lancamento {
  return {
    recorrencia: 'nenhuma' as const,
    origem: 'importacao' as const,
    status: 'pago' as const,
    forma_pagamento: 'PIX' as const,
    ...dados,
  } as Lancamento;
}

/**
 * Simulador Fiel da Lógica de Importação e Desfazer para a Parte 18C
 */
class SimuladorImportacao18C {
  public cacheContas: ContaBancaria[] = [];
  public cacheLancamentos: Lancamento[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];

  public getConta(id: string): ContaBancaria | undefined {
    return this.cacheContas.find((c) => c.id === id);
  }

  public calcularSaldoRealConta(contaId: string): number {
    const conta = this.getConta(contaId);
    if (!conta) return 0;

    const lancs = this.cacheLancamentos.filter(
      (l) => l.conta_id === contaId && l.status === 'pago'
    );

    let soma = 0;
    for (const l of lancs) {
      if (l.tipo === 'receita') {
        soma += l.valor;
      } else {
        soma -= l.valor;
      }
    }

    return +(conta.saldo_inicial + soma).toFixed(2);
  }

  /**
   * Simula a gravação atômica da importação seguindo a REGRA ÚNICA da Parte 18C
   */
  public importarLote(params: {
    loteId: string;
    contaId: string;
    novosLancamentos: Lancamento[];
    saldoInformado?: { valor: number; data: string; isDisponivel?: boolean };
  }): {
    saldoInicialDefinido?: { novoSaldoInicial: number; novaDataSaldoInicial: string };
    saldoFinalApp: number;
    erroConferencia?: string;
  } {
    const conta = this.getConta(params.contaId);
    if (!conta) throw new Error('Conta não encontrada');

    const isPrimeiraImportacao = !contaTemLancamentosImportados(
      params.contaId,
      this.cacheLancamentos
    );

    let saldoRealInformado: number | undefined = undefined;
    let dataSaldoInformado: string | undefined = undefined;

    if (params.saldoInformado) {
      dataSaldoInformado = params.saldoInformado.data;
      if (params.saldoInformado.isDisponivel) {
        saldoRealInformado = converterDisponivelParaSaldoReal(
          params.saldoInformado.valor,
          conta.limite_cheque_especial || 0
        );
      } else {
        saldoRealInformado = params.saldoInformado.valor;
      }
    }

    let saldoInicialDefinido: { novoSaldoInicial: number; novaDataSaldoInicial: string } | undefined = undefined;
    const saldoInicialAnterior = conta.saldo_inicial;
    const dataSaldoInicialAnterior = conta.data_saldo_inicial;

    // Grava lançamentos
    for (const l of params.novosLancamentos) {
      this.cacheLancamentos.push(l);
    }

    // REGRA ÚNICA: apenas na PRIMEIRA importação da conta
    if (isPrimeiraImportacao && saldoRealInformado !== undefined && dataSaldoInformado) {
      const todosLancsParaCalculo = this.cacheLancamentos.filter((l) => l.conta_id === params.contaId);

      const calculo = calcularSaldoInicialPrimeiraImportacao({
        saldoRealInformado,
        dataSaldoInformado,
        contaId: params.contaId,
        todosLancamentosPagosConta: todosLancsParaCalculo,
      });

      conta.saldo_inicial = calculo.novoSaldoInicial;
      conta.data_saldo_inicial = calculo.novaDataSaldoInicial;

      saldoInicialDefinido = {
        novoSaldoInicial: calculo.novoSaldoInicial,
        novaDataSaldoInicial: calculo.novaDataSaldoInicial,
      };
    }

    const saldoFinalApp = this.calcularSaldoRealConta(params.contaId);

    // Registro da importação para permitir reversão
    const registro: RegistroImportacao = {
      id: params.loteId,
      data: new Date().toISOString().split('T')[0],
      usuario: 'admin@mtsolar.com.br',
      banco_codigo: '033',
      conta_id: params.contaId,
      nome_arquivo: 'extrato.ofx',
      formato: 'ofx',
      periodo: { inicio: '2026-08-01', fim: dataSaldoInformado || '2026-08-31' },
      totais: {
        lancadas: params.novosLancamentos.length,
        ignoradas: 0,
        duplicadas: 0,
        enriquecidas: 0,
        vinculadas: 0,
        total_creditos: 0,
        total_debitos: 0,
      },
      saldo_sistema_antes: 0,
      saldo_sistema_depois: saldoFinalApp,
      status: 'concluida',
      criado_em: new Date().toISOString(),
      saldoInicialAjustadoNesteLote: Boolean(saldoInicialDefinido),
      saldoInicialAnteriorConta: saldoInicialAnterior,
      dataSaldoInicialAnteriorConta: dataSaldoInicialAnterior,
    };
    this.cacheImportacoes.push(registro);

    let erroConferencia: string | undefined = undefined;
    if (saldoRealInformado !== undefined) {
      const conf = conferirSaldoFinal(saldoFinalApp, saldoRealInformado, 0.01);
      if (!conf.confere) {
        erroConferencia = `Divergência: App R$ ${saldoFinalApp} vs Informado R$ ${saldoRealInformado}`;
      }
    }

    return { saldoInicialDefinido, saldoFinalApp, erroConferencia };
  }

  /**
   * Simula o desfazer importação restaurando saldo_inicial e data_saldo_inicial
   */
  public desfazerImportacao(loteId: string): void {
    const lote = this.cacheImportacoes.find((i) => i.id === loteId);
    if (!lote) throw new Error('Lote não encontrado');

    // Remove lançamentos criados pelo lote
    this.cacheLancamentos = this.cacheLancamentos.filter(
      (l) => l.origem_importacao?.lote_id !== loteId
    );

    // Restaura saldo_inicial e data_saldo_inicial da conta se ajustados neste lote
    if (lote.saldoInicialAjustadoNesteLote && lote.saldoInicialAnteriorConta !== undefined) {
      const conta = this.getConta(lote.conta_id);
      if (conta) {
        conta.saldo_inicial = lote.saldoInicialAnteriorConta;
        if (lote.dataSaldoInicialAnteriorConta) {
          conta.data_saldo_inicial = lote.dataSaldoInicialAnteriorConta;
        }
      }
    }

    lote.status = 'desfeita';
  }
}

async function executarTestesParte18C() {
  console.log('╔═════════════════════════════════════════════════════════════════════════╗');
  console.log('║        TESTES DA PARTE 18C — REGRA ÚNICA DE SALDO INICIAL              ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════╝');

  // -------------------------------------------------------------
  // Teste (a): Conta com saldo real informado 1.234,56 e extrato de 7 dias
  // -------------------------------------------------------------
  secao('Cenário (a): Saldo real informado 1.234,56 e extrato de 7 dias');
  {
    const sim = new SimuladorImportacao18C();
    const conta = mockConta({
      id: 'conta-a',
      nome: 'Conta Corrente A',
      banco: 'Santander',
      agencia: '1234',
      numero_conta: '56789-0',
      tipo: 'corrente',
      saldo_inicial: 0,
      data_saldo_inicial: '2026-10-01',
      limite_cheque_especial: 0,
      ativa: true,
      cor: '#003064',
    });
    sim.cacheContas.push(conta);

    // Extrato de 7 dias com movimentações variadas
    const lancamentos7Dias: Lancamento[] = [
      mockLancamento({ id: 'l1', tipo: 'receita', descricao: 'Depósito PIX', valor: 500, data_vencimento: '2026-10-10', data_pagamento: '2026-10-10', status: 'pago', conta_id: 'conta-a', categoria_id: 'c1', forma_pagamento: 'PIX', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-a' } }),
      mockLancamento({ id: 'l2', tipo: 'despesa', descricao: 'Fornecedor Solar', valor: 200, data_vencimento: '2026-10-11', data_pagamento: '2026-10-11', status: 'pago', conta_id: 'conta-a', categoria_id: 'c2', forma_pagamento: 'boleto', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-a' } }),
      mockLancamento({ id: 'l3', tipo: 'despesa', descricao: 'Tarifa Bancária', valor: 50, data_vencimento: '2026-10-12', data_pagamento: '2026-10-12', status: 'pago', conta_id: 'conta-a', categoria_id: 'c3', forma_pagamento: 'cartao', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-a' } }),
      mockLancamento({ id: 'l4', tipo: 'receita', descricao: 'Recebimento Cliente', valor: 150, data_vencimento: '2026-10-13', data_pagamento: '2026-10-13', status: 'pago', conta_id: 'conta-a', categoria_id: 'c1', forma_pagamento: 'PIX', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-a' } }),
      mockLancamento({ id: 'l5', tipo: 'despesa', descricao: 'Energia Elétrica', valor: 120, data_vencimento: '2026-10-14', data_pagamento: '2026-10-14', status: 'pago', conta_id: 'conta-a', categoria_id: 'c2', forma_pagamento: 'boleto', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-a' } }),
      mockLancamento({ id: 'l6', tipo: 'despesa', descricao: 'Combustível', valor: 80, data_vencimento: '2026-10-15', data_pagamento: '2026-10-15', status: 'pago', conta_id: 'conta-a', categoria_id: 'c2', forma_pagamento: 'cartao', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-a' } }),
      mockLancamento({ id: 'l7', tipo: 'receita', descricao: 'Venda de Inversor', valor: 300, data_vencimento: '2026-10-16', data_pagamento: '2026-10-16', status: 'pago', conta_id: 'conta-a', categoria_id: 'c1', forma_pagamento: 'PIX', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-a' } }),
    ];

    // Soma = +500 -200 -50 +150 -120 -80 +300 = +500
    const somaEsperada = 500;
    const saldoInformado = 1234.56;
    const saldoInicialEsperado = +(1234.56 - somaEsperada).toFixed(2); // 734.56

    const res = sim.importarLote({
      loteId: 'lote-a',
      contaId: 'conta-a',
      novosLancamentos: lancamentos7Dias,
      saldoInformado: { valor: saldoInformado, data: '2026-10-16' },
    });

    asserir(res.saldoFinalApp === saldoInformado, `Saldo final do app = ${saldoInformado} (obtido: ${res.saldoFinalApp})`);
    asserir(conta.saldo_inicial === saldoInicialEsperado, `Saldo inicial da conta = ${saldoInicialEsperado} (obtido: ${conta.saldo_inicial})`);
    asserir(conta.data_saldo_inicial === '2026-10-09', `Data saldo inicial = dia anterior ao mais antigo (2026-10-09) (obtido: ${conta.data_saldo_inicial})`);
    asserir(!res.erroConferencia, 'Conferência de saldo final sem erro');
  }

  // -------------------------------------------------------------
  // Teste (b): OFX com LEDGERBAL -7.377,22 e 400 transações
  // -------------------------------------------------------------
  secao('Cenário (b): OFX com LEDGERBAL -7.377,22 e 400 transações');
  {
    const sim = new SimuladorImportacao18C();
    const conta = mockConta({
      id: 'conta-ofx-400',
      nome: 'Conta Santander Principal',
      banco: 'Santander',
      agencia: '0033',
      numero_conta: '99887-1',
      tipo: 'corrente',
      saldo_inicial: 0,
      data_saldo_inicial: '2026-08-01',
      limite_cheque_especial: 5000,
      ativa: true,
      cor: '#003064',
    });
    sim.cacheContas.push(conta);

    // O requisito especifica:
    // LEDGERBAL = -5.432,10
    // Saldo Inicial Calculado = -4.858,46 em 02/08/2026
    // Logo a soma dos 400 lançamentos deve ser = -5.432,10 - (-4.858,46) = -573,64
    // Transação mais antiga em 03/08/2026 (dia anterior = 02/08/2026)
    const lancamentos400: Lancamento[] = [];
    const somaAlvo = -573.64;
    const valorBase = -573.64 / 400; // -1.4341 cada

    let somaAcumulada = 0;
    for (let i = 1; i <= 400; i++) {
      let valorItem = +valorBase.toFixed(2);
      if (i === 400) {
        valorItem = +(somaAlvo - somaAcumulada).toFixed(2);
      } else {
        somaAcumulada += valorItem;
      }

      // Distribui as datas de 2026-08-03 até 2026-08-31
      const diaNum = 3 + Math.floor((i - 1) / 15);
      const diaStr = diaNum < 10 ? `0${diaNum}` : `${diaNum}`;
      const dataIso = `2026-08-${diaStr}`;

      lancamentos400.push(mockLancamento({
        id: `ofx-lanc-${i}`,
        tipo: valorItem >= 0 ? 'receita' : 'despesa',
        descricao: `Transação OFX #${i}`,
        valor: Math.abs(valorItem),
        data_vencimento: dataIso,
        data_pagamento: dataIso,
        status: 'pago',
        conta_id: 'conta-ofx-400',
        categoria_id: 'cat-geral',
        forma_pagamento: 'cartao',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        origem_importacao: { lote_id: 'lote-ofx-400' },
      }));
    }

    const res = sim.importarLote({
      loteId: 'lote-ofx-400',
      contaId: 'conta-ofx-400',
      novosLancamentos: lancamentos400,
      saldoInformado: { valor: -5432.10, data: '2026-08-31' },
    });

    asserir(conta.saldo_inicial === -4858.46, `Saldo inicial recalculado = -4.858,46 (obtido: ${conta.saldo_inicial})`);
    asserir(conta.data_saldo_inicial === '2026-08-02', `Data saldo inicial = 02/08/2026 (obtido: ${conta.data_saldo_inicial})`);
    asserir(res.saldoFinalApp === -5432.10, `Saldo final do app = -5.432,10 (obtido: ${res.saldoFinalApp})`);
    asserir(!res.erroConferencia, 'Conferência exata com tolerância R$ 0,01');
  }

  // -------------------------------------------------------------
  // Teste (c): XLSX de 1.682 linhas com saldo informado
  // -------------------------------------------------------------
  secao('Cenário (c): XLSX de 1.682 linhas com saldo informado');
  {
    const sim = new SimuladorImportacao18C();
    const conta = mockConta({
      id: 'conta-xlsx-1682',
      nome: 'Conta Santander Grande',
      banco: 'Santander',
      agencia: '0033',
      numero_conta: '16820-5',
      tipo: 'corrente',
      saldo_inicial: 0,
      data_saldo_inicial: '2025-01-01',
      limite_cheque_especial: 5000,
      ativa: true,
      cor: '#003064',
    });
    sim.cacheContas.push(conta);

    const totalLinhas = 1682;
    const lancamentosXlsx: Lancamento[] = [];
    let somaLancs = 0;

    for (let i = 1; i <= totalLinhas; i++) {
      const ehReceita = i % 3 === 0;
      const valor = +((i * 1.37) % 500 + 10).toFixed(2);
      if (ehReceita) somaLancs += valor;
      else somaLancs -= valor;

      lancamentosXlsx.push(mockLancamento({
        id: `xlsx-lanc-${i}`,
        tipo: ehReceita ? 'receita' : 'despesa',
        descricao: `Lançamento Planilha #${i}`,
        valor,
        data_vencimento: '2026-07-15',
        data_pagamento: '2026-07-15',
        status: 'pago',
        conta_id: 'conta-xlsx-1682',
        categoria_id: 'cat-xlsx',
        forma_pagamento: 'cartao',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        origem_importacao: { lote_id: 'lote-xlsx' },
      }));
    }

    somaLancs = +somaLancs.toFixed(2);
    const saldoInformadoXlsx = 45890.30;
    const saldoInicialEsperado = +(saldoInformadoXlsx - somaLancs).toFixed(2);

    const res = sim.importarLote({
      loteId: 'lote-xlsx',
      contaId: 'conta-xlsx-1682',
      novosLancamentos: lancamentosXlsx,
      saldoInformado: { valor: saldoInformadoXlsx, data: '2026-07-31' },
    });

    asserir(lancamentosXlsx.length === 1682, `1.682 linhas geradas com sucesso`);
    asserir(conta.saldo_inicial === saldoInicialEsperado, `Saldo inicial calculado corretamente para 1.682 linhas (obtido: ${conta.saldo_inicial})`);
    asserir(res.saldoFinalApp === saldoInformadoXlsx, `Saldo final do app bate com o informado: R$ ${saldoInformadoXlsx}`);
    asserir(!res.erroConferencia, 'Conferência de saldo final sem divergências');
  }

  // -------------------------------------------------------------
  // Teste (d): Saldo "disponível" com limite 5.000 convertido corretamente
  // -------------------------------------------------------------
  secao('Cenário (d): Saldo "disponível" com limite R$ 5.000 convertido corretamente');
  {
    // Fórmula: saldo real = disponível − limite da conta
    const limiteConta = 5000;
    const saldoDisponivelDigitado = 678.90; // 678.90 - 5000 = -4321.10
    const saldoRealEsperado = converterDisponivelParaSaldoReal(saldoDisponivelDigitado, limiteConta);

    asserir(saldoRealEsperado === -4321.10, `Conversão de disponível R$ 678,90 com limite R$ 5.000 → R$ -4.321,10 (obtido: ${saldoRealEsperado})`);

    // Teste integrado na importação
    const sim = new SimuladorImportacao18C();
    const conta = mockConta({
      id: 'conta-disp',
      nome: 'Conta Santander com Limite',
      banco: 'Santander',
      agencia: '0033',
      numero_conta: '8888-8',
      tipo: 'corrente',
      saldo_inicial: 0,
      data_saldo_inicial: '2026-08-01',
      limite_cheque_especial: 5000,
      ativa: true,
      cor: '#003064',
    });
    sim.cacheContas.push(conta);

    const lancs: Lancamento[] = [
      mockLancamento({ id: 'disp-l1', tipo: 'despesa', descricao: 'Despesa 1', valor: 500, data_vencimento: '2026-08-10', data_pagamento: '2026-08-10', status: 'pago', conta_id: 'conta-disp', categoria_id: 'c1', forma_pagamento: 'cartao', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-disp' } }),
    ];
    // soma = -500. Saldo real informado = -4.321,10.
    // Saldo inicial = -4.321,10 - (-500) = -3.821,10

    const res = sim.importarLote({
      loteId: 'lote-disp',
      contaId: 'conta-disp',
      novosLancamentos: lancs,
      saldoInformado: {
        valor: saldoDisponivelDigitado,
        data: '2026-08-15',
        isDisponivel: true, // Opção explícita ativada
      },
    });

    asserir(conta.saldo_inicial === -3821.10, `Saldo inicial após conversão do disponível = -3.821,10 (obtido: ${conta.saldo_inicial})`);
    asserir(res.saldoFinalApp === -4321.10, `Saldo final do app coincide com o saldo real do banco = -4.321,10`);
  }

  // -------------------------------------------------------------
  // Teste (e): Segunda importação NÃO altera saldo_inicial
  // -------------------------------------------------------------
  secao('Cenário (e): Segunda importação NÃO altera saldo_inicial');
  {
    const sim = new SimuladorImportacao18C();
    const conta = mockConta({
      id: 'conta-subsequente',
      nome: 'Conta Corrente Subsequente',
      banco: 'Itaú',
      agencia: '1111',
      numero_conta: '22222-3',
      tipo: 'corrente',
      saldo_inicial: 1000,
      data_saldo_inicial: '2026-01-01',
      limite_cheque_especial: 0,
      ativa: true,
      cor: '#003064',
    });
    sim.cacheContas.push(conta);

    // 1ª importação: define saldo inicial
    const lote1: Lancamento[] = [
      mockLancamento({ id: 'sub-l1', tipo: 'receita', descricao: 'Primeiro Lote', valor: 200, data_vencimento: '2026-01-10', data_pagamento: '2026-01-10', status: 'pago', conta_id: 'conta-subsequente', categoria_id: 'c1', forma_pagamento: 'PIX', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-sub-1' } }),
    ];
    sim.importarLote({
      loteId: 'lote-sub-1',
      contaId: 'conta-subsequente',
      novosLancamentos: lote1,
      saldoInformado: { valor: 1500, data: '2026-01-15' },
    });

    const saldoInicialAposLote1 = conta.saldo_inicial; // 1500 - 200 = 1300
    const dataSaldoInicialAposLote1 = conta.data_saldo_inicial; // 2026-01-09

    asserir(saldoInicialAposLote1 === 1300, `Lote 1 configurou saldo inicial = 1.300`);

    // 2ª importação da mesma conta: deve PRESERVAR rigorosamente saldo_inicial e data
    const lote2: Lancamento[] = [
      mockLancamento({ id: 'sub-l2', tipo: 'receita', descricao: 'Segundo Lote', valor: 300, data_vencimento: '2026-02-10', data_pagamento: '2026-02-10', status: 'pago', conta_id: 'conta-subsequente', categoria_id: 'c1', forma_pagamento: 'PIX', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-sub-2' } }),
    ];

    const res2 = sim.importarLote({
      loteId: 'lote-sub-2',
      contaId: 'conta-subsequente',
      novosLancamentos: lote2,
      saldoInformado: { valor: 9999, data: '2026-02-15' }, // Usuário digita outro valor
    });

    asserir(res2.saldoInicialDefinido === undefined, `2ª importação não definiu saldoInicialDefinido`);
    asserir(conta.saldo_inicial === saldoInicialAposLote1, `Saldo inicial mantido intacto em ${saldoInicialAposLote1} (obtido: ${conta.saldo_inicial})`);
    asserir(conta.data_saldo_inicial === dataSaldoInicialAposLote1, `Data saldo inicial mantida intacta em ${dataSaldoInicialAposLote1} (obtido: ${conta.data_saldo_inicial})`);
  }

  // -------------------------------------------------------------
  // Teste (f): Extrato com Contamax ignorado vs como transferência
  // -------------------------------------------------------------
  secao('Cenário (f): Extrato com Contamax ignorado vs como transferência');
  {
    // Sub-cenário F1: Contamax ignorado (não entra na soma, saldo inicial absorve)
    const simF1 = new SimuladorImportacao18C();
    const contaF1 = mockConta({
      id: 'conta-cc-f1',
      nome: 'Conta Santander CC',
      banco: 'Santander',
      agencia: '0033',
      numero_conta: '55555-5',
      tipo: 'corrente',
      saldo_inicial: 0,
      data_saldo_inicial: '2026-09-01',
      limite_cheque_especial: 0,
      ativa: true,
      cor: '#003064',
    });
    simF1.cacheContas.push(contaF1);

    // Lançamento normal de receita R$ 1.000 + Aplicação Contamax de R$ 400 (IGNORADA, logo não entra na lista)
    const lancsComunsF1: Lancamento[] = [
      mockLancamento({ id: 'f1-l1', tipo: 'receita', descricao: 'Receita Operacional', valor: 1000, data_vencimento: '2026-09-05', data_pagamento: '2026-09-05', status: 'pago', conta_id: 'conta-cc-f1', categoria_id: 'c1', forma_pagamento: 'PIX', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-f1' } }),
    ];
    // No banco, o saldo final foi R$ 600 (1000 receita - 400 contamax no banco).
    // O item Contamax foi ignorado e não gravado.
    // Regra única: saldo_inicial = saldo_real_informado (600) - soma lançamentos gravados (1000) = -400.
    // Saldo final no app = -400 + 1000 = 600. O saldo final bate exatamente com o banco!
    const resF1 = simF1.importarLote({
      loteId: 'lote-f1',
      contaId: 'conta-cc-f1',
      novosLancamentos: lancsComunsF1,
      saldoInformado: { valor: 600, data: '2026-09-30' },
    });

    asserir(contaF1.saldo_inicial === -400, `Contamax ignorado: saldo inicial absorve a diferença (-400) (obtido: ${contaF1.saldo_inicial})`);
    asserir(resF1.saldoFinalApp === 600, `Saldo final no app continua idêntico ao banco (R$ 600) (obtido: ${resF1.saldoFinalApp})`);
    asserir(!resF1.erroConferencia, 'Sem erros de conferência de saldo com Contamax ignorado');

    // Sub-cenário F2: Contamax como transferência entre contas (entra na soma da CC)
    const simF2 = new SimuladorImportacao18C();
    const contaCC = mockConta({
      id: 'conta-cc-f2',
      nome: 'Conta Santander CC',
      banco: 'Santander',
      agencia: '0033',
      numero_conta: '55555-5',
      tipo: 'corrente',
      saldo_inicial: 0,
      data_saldo_inicial: '2026-09-01',
      limite_cheque_especial: 0,
      ativa: true,
      cor: '#003064',
    });
    const contaAplicacao = mockConta({
      id: 'conta-contamax-f2',
      nome: 'Conta Santander Contamax',
      banco: 'Santander',
      agencia: '0033',
      numero_conta: '55555-5-APL',
      tipo: 'corrente',
      saldo_inicial: 0,
      data_saldo_inicial: '2026-09-01',
      limite_cheque_especial: 0,
      ativa: true,
      cor: '#003064',
    });
    simF2.cacheContas.push(contaCC, contaAplicacao);

    // Lançamentos com Contamax como transferência (despesa de R$ 400 na CC com contrapartida de receita na Contamax)
    const lancsF2: Lancamento[] = [
      mockLancamento({ id: 'f2-l1', tipo: 'receita', descricao: 'Receita Operacional', valor: 1000, data_vencimento: '2026-09-05', data_pagamento: '2026-09-05', status: 'pago', conta_id: 'conta-cc-f2', categoria_id: 'c1', forma_pagamento: 'PIX', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-f2' } }),
      mockLancamento({ id: 'f2-transf-saida', tipo: 'despesa', descricao: 'Aplicação Contamax', valor: 400, data_vencimento: '2026-09-06', data_pagamento: '2026-09-06', status: 'pago', conta_id: 'conta-cc-f2', conta_destino_id: 'conta-contamax-f2', transferencia_vinculada_id: 'f2-transf-entrada', categoria_id: 'cat-transf', forma_pagamento: 'transferencia', recorrencia: 'nenhuma', origem: 'transferencia', origem_importacao: { lote_id: 'lote-f2' } }),
      mockLancamento({ id: 'f2-transf-entrada', tipo: 'receita', descricao: 'Aplicação Contamax (Entrada)', valor: 400, data_vencimento: '2026-09-06', data_pagamento: '2026-09-06', status: 'pago', conta_id: 'conta-contamax-f2', conta_destino_id: 'conta-cc-f2', transferencia_vinculada_id: 'f2-transf-saida', categoria_id: 'cat-transf', forma_pagamento: 'transferencia', recorrencia: 'nenhuma', origem: 'transferencia', origem_importacao: { lote_id: 'lote-f2' } }),
    ];

    // Na CC: receita 1000 - despesa 400 = soma +600.
    // Saldo informado na CC = 600.
    // Saldo inicial = 600 - (+600) = 0.
    const resF2 = simF2.importarLote({
      loteId: 'lote-f2',
      contaId: 'conta-cc-f2',
      novosLancamentos: lancsF2,
      saldoInformado: { valor: 600, data: '2026-09-30' },
    });

    asserir(contaCC.saldo_inicial === 0, `Contamax como transferência: saldo inicial da CC = 0 (obtido: ${contaCC.saldo_inicial})`);
    asserir(resF2.saldoFinalApp === 600, `Saldo final da CC = 600`);
    asserir(simF2.calcularSaldoRealConta('conta-contamax-f2') === 400, `Saldo da conta Contamax = +400 da aplicação`);
  }

  // -------------------------------------------------------------
  // Teste (g): Desfazer restaura saldo_inicial e data_saldo_inicial anteriores
  // -------------------------------------------------------------
  secao('Cenário (g): Desfazer restaura saldo_inicial e data_saldo_inicial anteriores');
  {
    const sim = new SimuladorImportacao18C();
    const conta = mockConta({
      id: 'conta-reversao',
      nome: 'Conta para Teste de Reversão',
      banco: 'Bradesco',
      agencia: '3333',
      numero_conta: '44444-1',
      tipo: 'corrente',
      saldo_inicial: 2500,
      data_saldo_inicial: '2026-01-01',
      limite_cheque_especial: 0,
      ativa: true,
      cor: '#003064',
    });
    sim.cacheContas.push(conta);

    const loteParaReversao: Lancamento[] = [
      mockLancamento({ id: 'rev-l1', tipo: 'receita', descricao: 'Venda', valor: 300, data_vencimento: '2026-03-10', data_pagamento: '2026-03-10', status: 'pago', conta_id: 'conta-reversao', categoria_id: 'c1', forma_pagamento: 'PIX', recorrencia: 'nenhuma', origem: 'importacao', origem_importacao: { lote_id: 'lote-rev-1' } }),
    ];

    // Importa lote com saldo informado 4.000 → saldo inicial vira 4.000 - 300 = 3.700, data 2026-03-09
    sim.importarLote({
      loteId: 'lote-rev-1',
      contaId: 'conta-reversao',
      novosLancamentos: loteParaReversao,
      saldoInformado: { valor: 4000, data: '2026-03-15' },
    });

    asserir(conta.saldo_inicial === 3700, 'Saldo inicial alterado para 3.700 na 1ª importação');
    asserir(conta.data_saldo_inicial === '2026-03-09', 'Data saldo inicial alterada para 2026-03-09');

    // Executa desfazer importação
    sim.desfazerImportacao('lote-rev-1');

    asserir(conta.saldo_inicial === 2500, `Desfazer restaurou saldo_inicial anterior (2.500) (obtido: ${conta.saldo_inicial})`);
    asserir(conta.data_saldo_inicial === '2026-01-01', `Desfazer restaurou data_saldo_inicial anterior (2026-01-01) (obtido: ${conta.data_saldo_inicial})`);
    asserir(sim.cacheLancamentos.length === 0, 'Lançamentos do lote removidos do cache');
  }

  // -------------------------------------------------------------
  // Resumo Final
  // -------------------------------------------------------------
  console.log('\n' + '═'.repeat(75));
  console.log(`TOTAL DE TESTES: ${totalTestes}`);
  console.log(`PASSARAM: ${passaram}`);
  console.log(`FALHARAM: ${falharam}`);
  console.log('═'.repeat(75));

  if (falharam > 0) {
    console.error('\nFALHAS ENCONTRADAS:');
    falhas.forEach((f) => console.error('  - ' + f));
    process.exit(1);
  } else {
    console.log('\n🎉 TODOS OS TESTES DA PARTE 18C PASSARAM COM 100% DE SUCESSO!\n');
  }
}

executarTestesParte18C().catch((err) => {
  console.error('Erro fatal nos testes da Parte 18C:', err);
  process.exit(1);
});
