// MT Solar - Gestão Financeira
// Testes da Parte 22D: Importar o PDF do Sicoob de ponta a ponta
// Simulador em memória — sem banco, sem PDF real

import {
  ContaBancaria,
  Lancamento,
  RegistroImportacao,
} from '../src/types';
import {
  recalcularSaldoInicialConta,
} from '../src/utils/extrato/saldoInicialHelper';
import { parsearSicoobPdf } from '../src/utils/extrato/parsers/sicoobPdf';
import { resolverConta } from '../src/utils/extrato/resolverConta';
import { ItemPdf } from '../src/utils/extrato/tipos';

// ============================================================================
// AUXILIARES DE TESTE
// ============================================================================
let totalTestes = 0;
let testesPassaram = 0;
let testesFalharam = 0;

function asserir(condicao: boolean, mensagem: string) {
  totalTestes++;
  if (condicao) {
    testesPassaram++;
    console.log(`  [OK] ${mensagem}`);
  } else {
    testesFalharam++;
    console.error(`  [FALHA] ${mensagem}`);
  }
}

function secao(titulo: string) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`>> ${titulo}`);
  console.log('='.repeat(72));
}

// Helper para criar ItemPdf sintetico
function criarItem(texto: string, x: number = 154, y: number = 100, pagina: number = 1): ItemPdf {
  return { texto, x, xFim: x + texto.length * 6, y, pagina };
}

// Cabecalho padrao do Sicoob
function criarCabecalho(inicio: string, fim: string, pagina: number = 1): ItemPdf[] {
  return [
    criarItem('SICOOB', 115, 20, pagina),
    criarItem('SISTEMA DE COOPERATIVAS DE CREDITO DO BRASIL', 150, 20, pagina),
    criarItem('SISBR', 400, 20, pagina),
    criarItem('EXTRATO CONTA CORRENTE', 115, 40, pagina),
    criarItem('COOP.:', 115, 60, pagina),
    criarItem('1234-5 / SICOOB FICTICIOLANDIA', 160, 60, pagina),
    criarItem('CONTA:', 115, 80, pagina),
    criarItem('111.111-1 / EMPRESA FICTICIA LTDA', 160, 80, pagina),
    criarItem('PERIODO:', 115, 100, pagina),
    criarItem(`${inicio} - ${fim}`, 160, 100, pagina),
    criarItem('HISTORICO DE MOVIMENTACAO', 115, 120, pagina),
    criarItem('DATA', 115, 140, pagina),
    criarItem('HISTORICO', 154, 140, pagina),
    criarItem('VALOR', 430, 140, pagina),
  ];
}

// ============================================================================
// SIMULADOR DE STORAGE PARA A PARTE 22D
// ============================================================================
class SimuladorStorage22D {
  public cacheContas: ContaBancaria[] = [];
  public cacheLancamentos: Lancamento[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];

  public getContaById(id: string): ContaBancaria | undefined {
    return this.cacheContas.find((c) => c.id === id);
  }

  public saveContaBancaria(conta: ContaBancaria): void {
    const idx = this.cacheContas.findIndex((c) => c.id === conta.id);
    if (idx >= 0) this.cacheContas[idx] = { ...conta };
    else this.cacheContas.push({ ...conta });
  }

  public saveImportacao(lote: RegistroImportacao): void {
    const idx = this.cacheImportacoes.findIndex((i) => i.id === lote.id);
    if (idx >= 0) this.cacheImportacoes[idx] = { ...lote };
    else this.cacheImportacoes.push({ ...lote });
  }

  public calcularResumoConta(contaId: string) {
    const conta = this.getContaById(contaId);
    if (!conta) throw new Error(`Conta nao encontrada: ${contaId}`);
    const lancs = this.cacheLancamentos.filter(
      (l) => l.conta_id === contaId && l.status === 'pago'
    );
    const receitas = lancs.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
    const despesas = lancs.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
    const saldoReal = +(conta.saldo_inicial + receitas - despesas).toFixed(2);
    return { saldoReal, receitas, despesas };
  }

  public importarExtratoLote(params: {
    loteId: string;
    contaId: string;
    bancoCodigo: string;
    formato: 'ofx' | 'xlsx' | 'pdf';
    nomeArquivo: string;
    itens: Array<{
      id: string;
      transacao: {
        fitid?: string;
        assinaturaFraca?: string;
        data: string;
        valor: number;
        tipo: 'credito' | 'debito';
        descricao: string;
        detalhes?: string;
        natureza?: string;
      };
      acao: 'incluir' | 'ignorar';
    }>;
    saldoFinalPdf?: { valor: number; data: string };
  }) {
    const conta = this.getContaById(params.contaId);
    if (!conta) throw new Error(`Conta nao encontrada: ${params.contaId}`);

    let saldoRealInformado: number | undefined;
    let dataSaldoInformado: string | undefined;
    const origemSaldo: 'extrato_pdf' | 'ofx_ledgerbal' = params.formato === 'pdf' ? 'extrato_pdf' : 'ofx_ledgerbal';

    if (params.saldoFinalPdf) {
      saldoRealInformado = params.saldoFinalPdf.valor;
      dataSaldoInformado = params.saldoFinalPdf.data;
    }

    const novosLancamentos: Lancamento[] = [];
    let ignoradas = 0;
    let duplicadas = 0;

    for (const item of params.itens) {
      if (item.acao === 'ignorar' || item.transacao.natureza === 'movimentacao_interna') {
        ignoradas++;
        continue;
      }

      const chaveDedupe = item.transacao.assinaturaFraca ||
        `${item.transacao.data}|${item.transacao.tipo}|${item.transacao.valor}`;

      const existePorAssinatura = this.cacheLancamentos.find(
        (l) =>
          l.conta_id === params.contaId &&
          l.origem_importacao?.assinatura_fraca === chaveDedupe
      );
      if (existePorAssinatura) { duplicadas++; continue; }

      if (item.transacao.fitid) {
        const existePorFitid = this.cacheLancamentos.find(
          (l) => l.conta_id === params.contaId && l.origem_importacao?.fitid === item.transacao.fitid
        );
        if (existePorFitid) { duplicadas++; continue; }
      }

      const novoLanc: Lancamento = {
        id: item.id,
        tipo: item.transacao.tipo === 'credito' ? 'receita' : 'despesa',
        descricao: item.transacao.descricao,
        valor: item.transacao.valor,
        data_vencimento: item.transacao.data,
        data_pagamento: item.transacao.data,
        status: 'pago',
        conta_id: params.contaId,
        categoria_id: 'cat-geral',
        forma_pagamento: 'cartao',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        origem_importacao: {
          lote_id: params.loteId,
          banco_codigo: params.bancoCodigo,
          conta_id: params.contaId,
          fitid: item.transacao.fitid,
          assinatura_fraca: chaveDedupe,
          formato: params.formato,
        },
        observacoes: item.transacao.detalhes,
        criado_em: new Date().toISOString(),
      };
      novosLancamentos.push(novoLanc);
    }

    for (const n of novosLancamentos) {
      const idx = this.cacheLancamentos.findIndex((l) => l.id === n.id);
      if (idx >= 0) this.cacheLancamentos[idx] = n;
      else this.cacheLancamentos.push(n);
    }
    const mapUnicos = new Map<string, Lancamento>();
    for (const l of this.cacheLancamentos) mapUnicos.set(l.id, l);
    this.cacheLancamentos = Array.from(mapUnicos.values());

    const registroLote: RegistroImportacao = {
      id: params.loteId,
      data: new Date().toISOString().split('T')[0],
      usuario: 'admin@ficticio.com.br',
      banco_codigo: params.bancoCodigo,
      conta_id: params.contaId,
      nome_arquivo: params.nomeArquivo,
      formato: params.formato,
      periodo: {
        inicio: params.itens[0]?.transacao.data || '',
        fim: dataSaldoInformado || '',
      },
      totais: {
        lancadas: novosLancamentos.length,
        ignoradas,
        duplicadas,
        enriquecidas: 0,
        vinculadas: 0,
        total_creditos: novosLancamentos.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0),
        total_debitos: novosLancamentos.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0),
      },
      status: 'concluida',
      criado_em: new Date().toISOString(),
    };

    if (saldoRealInformado !== undefined && dataSaldoInformado) {
      registroLote.saldo_banco = {
        valor: saldoRealInformado,
        data: dataSaldoInformado,
        origem: origemSaldo,
      };

      const referenciaAtual = conta.saldo_referencia;
      const deveAtualizar = !referenciaAtual || dataSaldoInformado >= referenciaAtual.data;
      if (deveAtualizar) {
        if (!referenciaAtual) {
          registroLote.saldoInicialAnteriorConta = conta.saldo_inicial;
          registroLote.dataSaldoInicialAnteriorConta = conta.data_saldo_inicial;
          registroLote.saldoInicialAjustadoNesteLote = true;
        }
        conta.saldo_referencia = {
          valor: saldoRealInformado,
          data: dataSaldoInformado,
          origem: origemSaldo,
          lote_id: params.loteId,
        };
      }
    }

    if (conta.saldo_referencia) {
      const todosLancs = this.cacheLancamentos.filter((l) => l.conta_id === params.contaId);
      const calculo = recalcularSaldoInicialConta({
        saldoReferencia: { valor: conta.saldo_referencia.valor, data: conta.saldo_referencia.data },
        contaId: params.contaId,
        todosLancamentosPagosConta: todosLancs,
      });
      conta.saldo_inicial = calculo.novoSaldoInicial;
      conta.data_saldo_inicial = calculo.novaDataSaldoInicial;
      this.saveContaBancaria(conta);
    }

    this.saveImportacao(registroLote);
    const resumo = this.calcularResumoConta(params.contaId);

    return {
      sucesso: true,
      loteId: params.loteId,
      novasLancadas: novosLancamentos.length,
      duplicadas,
      ignoradas,
      saldoDepois: resumo.saldoReal,
      saldoReferencia: this.getContaById(params.contaId)?.saldo_referencia,
    };
  }

  public desfazerImportacao(loteId: string) {
    const lote = this.cacheImportacoes.find((i) => i.id === loteId);
    if (!lote) throw new Error(`Lote nao encontrado: ${loteId}`);
    if (lote.status === 'desfeita') throw new Error('Lote ja desfeito');

    const idsRemover = new Set(
      this.cacheLancamentos
        .filter((l) => l.origem_importacao?.lote_id === loteId)
        .map((l) => l.id)
    );
    this.cacheLancamentos = this.cacheLancamentos.filter((l) => !idsRemover.has(l.id));
    lote.status = 'desfeita';
    this.saveImportacao(lote);

    const conta = this.getContaById(lote.conta_id);
    if (!conta) return { sucesso: true, saldoDepois: 0, saldoReferencia: undefined };

    if (conta.saldo_referencia?.lote_id === loteId) {
      delete conta.saldo_referencia;

      const outrosLotes = this.cacheImportacoes.filter(
        (imp) =>
          imp.id !== loteId &&
          imp.conta_id === lote.conta_id &&
          imp.status !== 'desfeita' &&
          imp.saldo_banco?.valor !== undefined
      ).sort((a, b) => (b.saldo_banco!.data).localeCompare(a.saldo_banco!.data));

      if (outrosLotes.length > 0) {
        const maisRecente = outrosLotes[0];
        conta.saldo_referencia = {
          valor: maisRecente.saldo_banco!.valor,
          data: maisRecente.saldo_banco!.data,
          origem: maisRecente.saldo_banco!.origem || 'extrato_pdf',
          lote_id: maisRecente.id,
        };
      } else if (lote.saldoInicialAnteriorConta !== undefined) {
        conta.saldo_inicial = lote.saldoInicialAnteriorConta;
        conta.data_saldo_inicial = lote.dataSaldoInicialAnteriorConta || conta.data_saldo_inicial || '2027-01-01';
      }
    }

    if (conta.saldo_referencia) {
      const todosLancs = this.cacheLancamentos.filter((l) => l.conta_id === conta.id);
      const calculo = recalcularSaldoInicialConta({
        saldoReferencia: { valor: conta.saldo_referencia.valor, data: conta.saldo_referencia.data },
        contaId: conta.id,
        todosLancamentosPagosConta: todosLancs,
      });
      conta.saldo_inicial = calculo.novoSaldoInicial;
      conta.data_saldo_inicial = calculo.novaDataSaldoInicial;
    }

    this.saveContaBancaria(conta);
    const resumo = this.calcularResumoConta(conta.id);
    return {
      sucesso: true,
      saldoDepois: resumo.saldoReal,
      saldoReferencia: this.getContaById(conta.id)?.saldo_referencia,
    };
  }
}

// ============================================================================
// DADOS SINTETICOS DOS DOIS PDFs
// ============================================================================
const SALDO_FINAL_PDF_A = 2200.00;
const DATA_SALDO_PDF_A = '2027-10-15';
const SALDO_FINAL_PDF_B = 3900.00;
const DATA_SALDO_PDF_B = '2027-10-31';

const itensPdfA = [
  { id: 'pdf-a-lanc1', transacao: { assinaturaFraca: '2027-10-01|credito|500|DEP|0', data: '2027-10-01', valor: 500, tipo: 'credito' as const, descricao: 'DEP DIN AG', detalhes: 'CPF: 111.111.111-11' }, acao: 'incluir' as const },
  { id: 'pdf-a-lanc2', transacao: { assinaturaFraca: '2027-10-01|credito|500|DEP|1', data: '2027-10-01', valor: 500, tipo: 'credito' as const, descricao: 'DEP DIN AG', detalhes: 'CPF: 222.222.222-22' }, acao: 'incluir' as const },
  { id: 'pdf-a-lanc3', transacao: { assinaturaFraca: '2027-10-10|debito|300|PIX|0',  data: '2027-10-10', valor: 300, tipo: 'debito' as const,  descricao: 'PIX ENVIADO' }, acao: 'incluir' as const },
  { id: 'pdf-a-lanc4', transacao: { assinaturaFraca: '2027-10-15|credito|500|DEP|0', data: '2027-10-15', valor: 500, tipo: 'credito' as const, descricao: 'DEP DIN AG' }, acao: 'incluir' as const },
];

const itensPdfB = [
  { id: 'pdf-b-lanc3-dup', transacao: { assinaturaFraca: '2027-10-10|debito|300|PIX|0',      data: '2027-10-10', valor: 300,   tipo: 'debito' as const,  descricao: 'PIX ENVIADO' }, acao: 'incluir' as const },
  { id: 'pdf-b-lanc4-dup', transacao: { assinaturaFraca: '2027-10-15|credito|500|DEP|0',     data: '2027-10-15', valor: 500,   tipo: 'credito' as const, descricao: 'DEP DIN AG' }, acao: 'incluir' as const },
  { id: 'pdf-b-lanc5',     transacao: { assinaturaFraca: '2027-10-20|credito|1000|PIX|0',    data: '2027-10-20', valor: 1000,  tipo: 'credito' as const, descricao: 'PIX RECEBIDO' }, acao: 'incluir' as const },
  { id: 'pdf-b-lanc6-int', transacao: { assinaturaFraca: '2027-10-31|debito|200|SUBS|0',     data: '2027-10-31', valor: 200,   tipo: 'debito' as const,  descricao: 'DEB PARC SUBS INTEG', natureza: 'movimentacao_interna' }, acao: 'ignorar' as const },
  { id: 'pdf-b-lanc7',     transacao: { assinaturaFraca: '2027-10-31|debito|15.50|TAR|0',    data: '2027-10-31', valor: 15.50, tipo: 'debito' as const,  descricao: 'TARIFA CESTA' }, acao: 'incluir' as const },
];

function criarConta(id: string, nome: string, numero_conta: string, banco_codigo = '756', banco = 'Sicoob', saldo_inicial = 0): ContaBancaria {
  return {
    id,
    nome,
    banco,
    banco_codigo,
    agencia: '1234',
    numero_conta,
    tipo: 'corrente',
    saldo_inicial,
    data_saldo_inicial: '2027-01-01',
    limite_cheque_especial: 0,
    taxa_juros_cheque_especial_mensal: 0,
    cor: '#003064',
    ativa: true,
  };
}

// ============================================================================
// EXECUCAO DOS TESTES
// ============================================================================
async function executarTestes() {
  console.log('Iniciando testes da PARTE 22D -- Importar PDF Sicoob de ponta a ponta\n');

  // =========================================================================
  // CENARIO (a): PDF A primeiro, depois PDF B
  // =========================================================================
  secao('Cenario (a): PDF A (01-15) depois PDF B (10-31) -- saldo final correto');
  {
    const sim = new SimuladorStorage22D();
    const conta = criarConta('conta-sicoob-a', 'Sicoob CC Ficticia A', '1111111');
    sim.saveContaBancaria(conta);

    const resA = sim.importarExtratoLote({
      loteId: 'lote-pdf-a',
      contaId: 'conta-sicoob-a',
      bancoCodigo: '756',
      formato: 'pdf',
      nomeArquivo: 'sicoob_01_15.pdf',
      itens: itensPdfA,
      saldoFinalPdf: { valor: SALDO_FINAL_PDF_A, data: DATA_SALDO_PDF_A },
    });

    asserir(resA.novasLancadas === 4, `PDF A: 4 lancamentos novos (obtido: ${resA.novasLancadas})`);
    asserir(resA.duplicadas === 0, `PDF A: 0 duplicatas (obtido: ${resA.duplicadas})`);
    asserir(resA.ignoradas === 0, `PDF A: 0 ignoradas (obtido: ${resA.ignoradas})`);
    const cA1 = sim.getContaById('conta-sicoob-a')!;
    asserir(cA1.saldo_referencia?.valor === SALDO_FINAL_PDF_A, `PDF A: saldo_referencia = ${SALDO_FINAL_PDF_A}`);
    asserir(cA1.saldo_referencia?.origem === 'extrato_pdf', `PDF A: origem = 'extrato_pdf'`);

    const resB = sim.importarExtratoLote({
      loteId: 'lote-pdf-b',
      contaId: 'conta-sicoob-a',
      bancoCodigo: '756',
      formato: 'pdf',
      nomeArquivo: 'sicoob_10_31.pdf',
      itens: itensPdfB,
      saldoFinalPdf: { valor: SALDO_FINAL_PDF_B, data: DATA_SALDO_PDF_B },
    });

    asserir(resB.novasLancadas === 2, `PDF B: 2 novos (PIX + tarifa) (obtido: ${resB.novasLancadas})`);
    asserir(resB.duplicadas === 2, `PDF B: 2 duplicatas por assinatura fraca (obtido: ${resB.duplicadas})`);
    asserir(resB.ignoradas === 1, `PDF B: 1 movimentacao interna ignorada (obtido: ${resB.ignoradas})`);

    const cFinal = sim.getContaById('conta-sicoob-a')!;
    asserir(cFinal.saldo_referencia?.valor === SALDO_FINAL_PDF_B, `Ref. final = ${SALDO_FINAL_PDF_B} (obtido: ${cFinal.saldo_referencia?.valor})`);
    asserir(cFinal.saldo_referencia?.data === DATA_SALDO_PDF_B, `Data ref. = ${DATA_SALDO_PDF_B}`);
    asserir(cFinal.saldo_referencia?.origem === 'extrato_pdf', `Origem = 'extrato_pdf'`);
    asserir(resB.saldoDepois === SALDO_FINAL_PDF_B, `saldoDepois = ${SALDO_FINAL_PDF_B} (obtido: ${resB.saldoDepois})`);
  }

  // =========================================================================
  // CENARIO (b): Ordem inversa
  // =========================================================================
  secao('Cenario (b): Ordem inversa -- PDF B primeiro, depois PDF A');
  {
    const sim = new SimuladorStorage22D();
    const conta = criarConta('conta-sicoob-b', 'Sicoob CC Ordem Inversa', '2222222');
    sim.saveContaBancaria(conta);

    const resB = sim.importarExtratoLote({
      loteId: 'lote-inv-b',
      contaId: 'conta-sicoob-b',
      bancoCodigo: '756',
      formato: 'pdf',
      nomeArquivo: 'sicoob_10_31.pdf',
      itens: itensPdfB,
      saldoFinalPdf: { valor: SALDO_FINAL_PDF_B, data: DATA_SALDO_PDF_B },
    });
    asserir(resB.novasLancadas === 4, `Ordem inv. PDF B: 4 novas (10/10, 15/10, PIX, tarifa) sem duplicatas ainda (obtido: ${resB.novasLancadas})`);
    asserir(resB.ignoradas === 1, `Ordem inv. PDF B: 1 movimentacao interna ignorada (obtido: ${resB.ignoradas})`);

    const resA = sim.importarExtratoLote({
      loteId: 'lote-inv-a',
      contaId: 'conta-sicoob-b',
      bancoCodigo: '756',
      formato: 'pdf',
      nomeArquivo: 'sicoob_01_15.pdf',
      itens: itensPdfA,
      saldoFinalPdf: { valor: SALDO_FINAL_PDF_A, data: DATA_SALDO_PDF_A },
    });
    asserir(resA.duplicadas === 2, `Ordem inv. PDF A: 2 duplicatas (10/10, 15/10) (obtido: ${resA.duplicadas})`);
    asserir(resA.novasLancadas === 2, `Ordem inv. PDF A: 2 novas (01/10 x2) (obtido: ${resA.novasLancadas})`);

    const cFinal = sim.getContaById('conta-sicoob-b')!;
    // Ref. deve ser o PDF B (mais recente, 31/10)
    asserir(cFinal.saldo_referencia?.valor === SALDO_FINAL_PDF_B, `Ref. = PDF B (${SALDO_FINAL_PDF_B}) (obtido: ${cFinal.saldo_referencia?.valor})`);
    asserir(cFinal.saldo_referencia?.data === DATA_SALDO_PDF_B, `Data ref. = ${DATA_SALDO_PDF_B}`);
    const resumo = sim.calcularResumoConta('conta-sicoob-b');
    asserir(resumo.saldoReal === SALDO_FINAL_PDF_B, `Saldo real = ${SALDO_FINAL_PDF_B} (obtido: ${resumo.saldoReal})`);
  }

  // =========================================================================
  // CENARIO (c): Desfazer lote B -> referencia volta para A
  // =========================================================================
  secao('Cenario (c): Desfazer lote PDF B -- referencia restaurada para PDF A');
  {
    const sim = new SimuladorStorage22D();
    const conta = criarConta('conta-sicoob-c', 'Sicoob CC Desfazer', '3333333');
    sim.saveContaBancaria(conta);

    sim.importarExtratoLote({
      loteId: 'lote-c-a',
      contaId: 'conta-sicoob-c',
      bancoCodigo: '756',
      formato: 'pdf',
      nomeArquivo: 'sicoob_01_15.pdf',
      itens: itensPdfA,
      saldoFinalPdf: { valor: SALDO_FINAL_PDF_A, data: DATA_SALDO_PDF_A },
    });

    sim.importarExtratoLote({
      loteId: 'lote-c-b',
      contaId: 'conta-sicoob-c',
      bancoCodigo: '756',
      formato: 'pdf',
      nomeArquivo: 'sicoob_10_31.pdf',
      itens: itensPdfB,
      saldoFinalPdf: { valor: SALDO_FINAL_PDF_B, data: DATA_SALDO_PDF_B },
    });

    const cAntes = sim.getContaById('conta-sicoob-c')!;
    asserir(cAntes.saldo_referencia?.lote_id === 'lote-c-b', 'Antes desfazer: ref. aponta para lote-c-b');

    const resDesfazer = sim.desfazerImportacao('lote-c-b');
    asserir(resDesfazer.sucesso === true, 'Desfazer retornou sucesso');

    const cApos = sim.getContaById('conta-sicoob-c')!;
    asserir(cApos.saldo_referencia?.valor === SALDO_FINAL_PDF_A, `Ref. restaurada = ${SALDO_FINAL_PDF_A} (obtido: ${cApos.saldo_referencia?.valor})`);
    asserir(cApos.saldo_referencia?.data === DATA_SALDO_PDF_A, `Data ref. = ${DATA_SALDO_PDF_A}`);
    asserir(cApos.saldo_referencia?.lote_id === 'lote-c-a', `Ref. aponta para lote-c-a`);

    const lancsB = sim.cacheLancamentos.filter((l) => l.origem_importacao?.lote_id === 'lote-c-b');
    asserir(lancsB.length === 0, 'Lancamentos do lote B removidos');

    asserir(resDesfazer.saldoDepois === SALDO_FINAL_PDF_A, `Saldo apos desfazer = ${SALDO_FINAL_PDF_A} (obtido: ${resDesfazer.saldoDepois})`);
  }

  // =========================================================================
  // CENARIO (d): Movimentacoes internas ignoradas
  // =========================================================================
  secao('Cenario (d): Movimentacoes internas ignoradas -- saldo inalterado');
  {
    const sim = new SimuladorStorage22D();
    const conta = criarConta('conta-sicoob-d', 'Sicoob CC Mov Internas', '4444444');
    sim.saveContaBancaria(conta);

    const SALDO_D = 5000.00;
    const itensSoInternas = [
      { id: 'int-1', transacao: { assinaturaFraca: '2027-10-05|debito|1000|APLIC|0',  data: '2027-10-05', valor: 1000, tipo: 'debito' as const,  descricao: 'APLICACAO RDC', natureza: 'movimentacao_interna' }, acao: 'ignorar' as const },
      { id: 'int-2', transacao: { assinaturaFraca: '2027-10-05|credito|1000|RESG|0', data: '2027-10-05', valor: 1000, tipo: 'credito' as const, descricao: 'RESGATE RDC',   natureza: 'movimentacao_interna' }, acao: 'ignorar' as const },
      { id: 'int-3', transacao: { assinaturaFraca: '2027-10-05|debito|500|SUBS|0',   data: '2027-10-05', valor: 500,  tipo: 'debito' as const,  descricao: 'DEB PARC SUBS INTEG', natureza: 'movimentacao_interna' }, acao: 'ignorar' as const },
    ];

    const res = sim.importarExtratoLote({
      loteId: 'lote-d',
      contaId: 'conta-sicoob-d',
      bancoCodigo: '756',
      formato: 'pdf',
      nomeArquivo: 'sicoob_so_internas.pdf',
      itens: itensSoInternas,
      saldoFinalPdf: { valor: SALDO_D, data: '2027-10-05' },
    });

    asserir(res.novasLancadas === 0, `Nenhum lancamento criado (obtido: ${res.novasLancadas})`);
    asserir(res.ignoradas === 3, `3 ignoradas (obtido: ${res.ignoradas})`);
    const cD = sim.getContaById('conta-sicoob-d')!;
    asserir(cD.saldo_referencia?.valor === SALDO_D, `saldo_referencia = ${SALDO_D}`);
    asserir(cD.saldo_inicial === SALDO_D, `saldo_inicial = ${SALDO_D} com 0 lancamentos (obtido: ${cD.saldo_inicial})`);
    asserir(res.saldoDepois === SALDO_D, `saldoDepois = ${SALDO_D}`);
  }

  // =========================================================================
  // CENARIO (e): Isolamento de conta
  // =========================================================================
  secao('Cenario (e): Isolamento -- outras contas nao sao alteradas');
  {
    const sim = new SimuladorStorage22D();
    const contaSicoob = criarConta('conta-sicoob-e', 'Sicoob CC Principal', '5555555', '756', 'Sicoob', 1000);
    const contaOutra = criarConta('conta-outra-e', 'Banco Ficticio CC', '9999999', '999', 'Banco Ficticio', 5000);
    sim.saveContaBancaria(contaSicoob);
    sim.saveContaBancaria(contaOutra);

    sim.importarExtratoLote({
      loteId: 'lote-e',
      contaId: 'conta-sicoob-e',
      bancoCodigo: '756',
      formato: 'pdf',
      nomeArquivo: 'sicoob_01_15.pdf',
      itens: itensPdfA,
      saldoFinalPdf: { valor: SALDO_FINAL_PDF_A, data: DATA_SALDO_PDF_A },
    });

    const outraDepois = sim.getContaById('conta-outra-e')!;
    asserir(outraDepois.saldo_inicial === 5000, `Conta outra inalterada: saldo_inicial = 5000 (obtido: ${outraDepois.saldo_inicial})`);
    asserir(outraDepois.saldo_referencia === undefined, 'Conta outra: sem saldo_referencia');

    const lancsSicoob = sim.cacheLancamentos.filter((l) => l.conta_id === 'conta-sicoob-e');
    const lancsOutra  = sim.cacheLancamentos.filter((l) => l.conta_id === 'conta-outra-e');
    asserir(lancsSicoob.length === 4, `4 lancamentos na conta Sicoob (obtido: ${lancsSicoob.length})`);
    asserir(lancsOutra.length === 0, `0 lancamentos na conta outra (obtido: ${lancsOutra.length})`);
  }

  // =========================================================================
  // CENARIO (f): End-to-end via parsearSicoobPdf + resolverConta
  // =========================================================================
  secao('Cenario (f): E2E -- parsearSicoobPdf -> resolverConta -> importarExtratoLote');
  {
    const itensPdf: ItemPdf[] = [
      ...criarCabecalho('01/10/2027', '15/10/2027'),
      criarItem('SALDO ANTERIOR', 154, 160),
      criarItem('2.000,00', 430, 160),
      criarItem('C', 473, 160),
      criarItem('01/10', 115, 180),
      criarItem('DEP DIN AG', 154, 180),
      criarItem('500,00', 430, 180),
      criarItem('C', 473, 180),
      criarItem('CPF: 111.111.111-11', 154, 192),
      criarItem('10/10', 115, 220),
      criarItem('PIX ENVIADO', 154, 220),
      criarItem('300,00', 430, 220),
      criarItem('D', 473, 220),
      criarItem('15/10', 115, 260),
      criarItem('SALDO DO DIA', 154, 260),
      criarItem('2.200,00', 430, 260),
      criarItem('C', 473, 260),
    ];

    const extrato = parsearSicoobPdf(itensPdf);
    asserir(extrato.bancoCodigo === '756', `bancoCodigo = '756' (obtido: '${extrato.bancoCodigo}')`);
    asserir(extrato.formato === 'pdf', `formato = 'pdf' (obtido: '${extrato.formato}')`);
    asserir(extrato.transacoes.length === 2, `2 transacoes parseadas (obtido: ${extrato.transacoes.length})`);
    asserir(extrato.saldoFinal?.valor === 2200, `saldoFinal.valor = 2200 (obtido: ${extrato.saldoFinal?.valor})`);
    asserir(extrato.saldoFinal?.data === '2027-10-15', `saldoFinal.data = '2027-10-15' (obtido: '${extrato.saldoFinal?.data}')`);

    const contasCad: ContaBancaria[] = [
      criarConta('conta-sicoob-f', 'Sicoob CC E2E', '1111111')
    ];

    const resolucao = resolverConta(extrato, contasCad);
    asserir(resolucao.tipo === 'unica', `resolverConta tipo = 'unica' (obtido: '${resolucao.tipo}')`);
    if (resolucao.tipo === 'unica') {
      asserir(resolucao.conta.id === 'conta-sicoob-f', `Conta resolvida = 'conta-sicoob-f'`);
    }

    const sim = new SimuladorStorage22D();
    sim.saveContaBancaria(contasCad[0]);

    const itensParaImportar = extrato.transacoes.map((t, i) => ({
      id: `e2e-lanc-${i}`,
      transacao: {
        assinaturaFraca: `${t.data}|${t.tipo}|${t.valor}|${(t.descricaoNormalizada || '').split(' ')[0]}|${t.ordemNoDia}`,
        data: t.data,
        valor: t.valor,
        tipo: t.tipo as 'credito' | 'debito',
        descricao: t.descricaoOriginal,
        detalhes: t.detalhes,
      },
      acao: 'incluir' as const,
    }));

    const resE2E = sim.importarExtratoLote({
      loteId: 'lote-e2e',
      contaId: 'conta-sicoob-f',
      bancoCodigo: extrato.bancoCodigo!,
      formato: 'pdf',
      nomeArquivo: 'sicoob_sintetico.pdf',
      itens: itensParaImportar,
      saldoFinalPdf: extrato.saldoFinal!,
    });

    asserir(resE2E.novasLancadas === 2, `E2E: 2 lancamentos gravados (obtido: ${resE2E.novasLancadas})`);
    asserir(resE2E.saldoDepois === 2200, `E2E: saldoDepois = 2200 (obtido: ${resE2E.saldoDepois})`);
    asserir(resE2E.saldoReferencia?.valor === 2200, `E2E: saldo_referencia.valor = 2200`);
    asserir(resE2E.saldoReferencia?.origem === 'extrato_pdf', `E2E: origem = 'extrato_pdf' (obtido: '${resE2E.saldoReferencia?.origem}')`);
  }

  // =========================================================================
  // RESUMO
  // =========================================================================
  console.log('\n' + '='.repeat(72));
  console.log('RESULTADO FINAL -- PARTE 22D');
  console.log('='.repeat(72));
  console.log(`  [OK]    Passaram: ${testesPassaram}`);
  console.log(`  [FALHA] Falharam: ${testesFalharam}`);
  console.log('='.repeat(72));
  if (testesFalharam > 0) {
    process.exit(1);
  } else {
    console.log(`\nTodos os ${totalTestes} testes PASSARAM!\n`);
  }
}

executarTestes().catch((err) => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
