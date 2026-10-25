// MT Solar - Gestão Financeira
// Testes Automatizados - Parte 15H
// Cobre:
//   1a. Contamax ignorado (padrão)
//   1b. Contamax como transferência
//   2.  Ajuste de saldo inicial por LEDGERBAL
//   3.  Comparação pós-importação
//   4.  Rollback
//   5.  Deduplicação
//   6.  Segurança: sem conta destino não vaza

import {
  Lancamento,
  ContaBancaria,
  ParamsImportacaoLote,
  ResultadoImportacaoLote,
} from '../src/types';
import { inferirFormaPagamento, gerarAssinaturaFraca } from '../src/utils/extrato';

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

type ItemImportacao = ParamsImportacaoLote["itens"][0];

class Simulador15H {
  public lancamentos: Lancamento[] = [];
  public contas: ContaBancaria[] = [];

  reset() {
    this.lancamentos = [];
    this.contas = [
      {
        id: "conta-santander",
        nome: "Santander Corrente MT Solar",
        banco: "Santander",
        banco_codigo: "033",
        agencia: "0001",
        numero_conta: "99999999-9",
        tipo: "corrente",
        saldo_inicial: 0.0,
        data_saldo_inicial: "2026-07-17",
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: "#CC0000",
        ativa: true,
      },
      {
        id: "conta-sicoob",
        nome: "Sicoob Aplicação MT Solar",
        banco: "Sicoob",
        banco_codigo: "756",
        agencia: "0001",
        numero_conta: "00001234-0",
        tipo: "poupanca",
        saldo_inicial: 0.0,
        data_saldo_inicial: "2026-07-17",
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: "#1A4A85",
        ativa: true,
      },
    ];
  }

  private getContaById(id: string): ContaBancaria | undefined {
    return this.contas.find((c) => c.id === id);
  }

  calcularSaldoReal(contaId: string): number {
    const conta = this.getContaById(contaId);
    if (!conta) return 0;
    let saldo = conta.saldo_inicial;
    for (const l of this.lancamentos) {
      if (l.conta_id === contaId && l.status === "pago") {
        if (l.tipo === "receita") saldo += l.valor;
        else if (l.tipo === "despesa") saldo -= l.valor;
      }
    }
    return +saldo.toFixed(2);
  }

  async importarExtratoLote(params: ParamsImportacaoLote): Promise<ResultadoImportacaoLote> {
    const conta = this.getContaById(params.contaId);
    if (!conta) throw new Error("Conta não encontrada: " + params.contaId);
    const saldoAntes = this.calcularSaldoReal(params.contaId);
    const totais = { lancadas: 0, ignoradas: 0, duplicadas: 0, enriquecidas: 0, vinculadas: 0, total_creditos: 0, total_debitos: 0 };
    const novos: Lancamento[] = [];

    for (const item of params.itens) {
      if (item.acao === "ignorar") { totais.ignoradas++; continue; }

      const ass = gerarAssinaturaFraca({
        conta: params.contaId,
        data: item.transacao.data,
        tipo: item.transacao.tipo,
        valor: item.transacao.valor,
        descricaoNormalizada: item.transacao.descricaoNormalizada,
        ordemNoDia: item.transacao.ordemNoDia,
      });
      const jaExiste = this.lancamentos.some((l) => l.origem_importacao?.assinatura_fraca === ass);
      if (jaExiste) { totais.duplicadas++; continue; }

      if (item.natureza === "movimentacao_interna") {
        if (!params.contaDestinoId) { totais.ignoradas++; continue; }
        const idSaida = "out-" + Math.random().toString(36).substr(2, 5);
        const idEntrada = "in-" + Math.random().toString(36).substr(2, 5);
        const ehResgate = item.transacao.tipo === "credito";
        novos.push({
          id: ehResgate ? idEntrada : idSaida,
          tipo: ehResgate ? "receita" : "despesa",
          descricao: item.transacao.descricaoOriginal,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: "pago",
          conta_id: params.contaId,
          conta_destino_id: params.contaDestinoId,
          transferencia_vinculada_id: ehResgate ? idSaida : idEntrada,
          categoria_id: "",
          forma_pagamento: "transferencia",
          recorrencia: "nenhuma",
          origem: "transferencia",
          origem_importacao: { lote_id: params.loteId, banco_codigo: params.bancoCodigo, conta_id: params.contaId, fitid: item.transacao.fitid, assinatura_fraca: ass, formato: params.formato },
          criado_em: new Date().toISOString(),
        });
        novos.push({
          id: ehResgate ? idSaida : idEntrada,
          tipo: ehResgate ? "despesa" : "receita",
          descricao: item.transacao.descricaoOriginal,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: "pago",
          conta_id: params.contaDestinoId,
          transferencia_vinculada_id: ehResgate ? idEntrada : idSaida,
          categoria_id: "",
          forma_pagamento: "transferencia",
          recorrencia: "nenhuma",
          origem: "transferencia",
          origem_importacao: { lote_id: params.loteId, banco_codigo: params.bancoCodigo, conta_id: params.contaId, fitid: item.transacao.fitid, assinatura_fraca: ass, formato: params.formato },
          criado_em: new Date().toISOString(),
        });
        totais.lancadas++;
        if (ehResgate) totais.total_creditos = +(totais.total_creditos + item.transacao.valor).toFixed(2);
        else totais.total_debitos = +(totais.total_debitos + item.transacao.valor).toFixed(2);
        continue;
      }

      const fp = inferirFormaPagamento(item.transacao.descricaoOriginal, item.natureza as any);
      novos.push({
        id: "lanc-" + Math.random().toString(36).substr(2, 6),
        tipo: item.tipoLancamento === "receita" ? "receita" : "despesa",
        descricao: item.transacao.descricaoOriginal,
        valor: item.transacao.valor,
        data_vencimento: item.transacao.data,
        data_pagamento: item.transacao.data,
        status: "pago",
        conta_id: params.contaId,
        categoria_id: item.categoriaId,
        forma_pagamento: fp,
        recorrencia: "nenhuma",
        origem: "importacao",
        origem_importacao: { lote_id: params.loteId, banco_codigo: params.bancoCodigo, conta_id: params.contaId, fitid: item.transacao.fitid, assinatura_fraca: ass, formato: params.formato },
        criado_em: new Date().toISOString(),
      });
      totais.lancadas++;
      const ultimo = novos[novos.length - 1];
      if (ultimo.tipo === "receita") totais.total_creditos = +(totais.total_creditos + item.transacao.valor).toFixed(2);
      else totais.total_debitos = +(totais.total_debitos + item.transacao.valor).toFixed(2);
    }

    for (const lanc of novos) {
      const permitida = lanc.conta_id === params.contaId || (params.contaDestinoId && lanc.conta_id === params.contaDestinoId && lanc.transferencia_vinculada_id);
      if (!permitida) throw new Error("VIOLAÇÃO DE SEGURANÇA: lançamento para conta não autorizada: " + lanc.conta_id);
    }

    this.lancamentos.push(...novos);
    const saldoDepois = this.calcularSaldoReal(params.contaId);
    const diferencaConciliacao = params.saldoBanco ? +(params.saldoBanco.valor - saldoDepois).toFixed(2) : undefined;
    return { sucesso: true, loteId: params.loteId, contaId: params.contaId, totais, saldoAntes, saldoDepois, diferencaConciliacao };
  }

  desfazerImportacao(loteId: string): { removidos: number } {
    const antes = this.lancamentos.length;
    this.lancamentos = this.lancamentos.filter((l) => {
      const ehLote = l.origem_importacao?.lote_id === loteId;
      const ehImportado = l.origem === "importacao" || l.origem === "transferencia";
      return !(ehLote && ehImportado);
    });
    return { removidos: antes - this.lancamentos.length };
  }

  ajustarSaldoInicialPorLedgerbal(p: { contaId: string; saldoLedgerbal: number; dataLedgerbal: string }) {
    const conta = this.getContaById(p.contaId)!;
    const saldoInicialAnterior = conta.saldo_inicial;
    const lancs = this.lancamentos.filter((l) => l.conta_id === p.contaId && l.status === "pago" && (l.data_pagamento || l.data_vencimento)! <= p.dataLedgerbal);
    const r = lancs.filter((l) => l.tipo === "receita").reduce((s, l) => s + l.valor, 0);
    const d = lancs.filter((l) => l.tipo === "despesa").reduce((s, l) => s + l.valor, 0);
    const saldoInicialNovo = +(p.saldoLedgerbal - (r - d)).toFixed(2);
    const datas = this.lancamentos.filter((l) => l.conta_id === p.contaId).map((l) => (l.data_pagamento || l.data_vencimento)!).filter(Boolean).sort();
    const primeiraData = datas[0] || p.dataLedgerbal;
    const dt = new Date(primeiraData + "T12:00:00Z"); dt.setUTCDate(dt.getUTCDate() - 1);
    const dataSaldoInicialNova = dt.toISOString().split("T")[0];
    conta.saldo_inicial = saldoInicialNovo;
    conta.data_saldo_inicial = dataSaldoInicialNova;
    const saldoFinalAposAjuste = this.calcularSaldoReal(p.contaId);
    return { saldoInicialAnterior, saldoInicialNovo, dataSaldoInicialNova, saldoFinalAposAjuste, diferenca: +(p.saldoLedgerbal - saldoFinalAposAjuste).toFixed(2) };
  }
}

const LEDGERBAL = -5432.10;
const DATA_LEDGERBAL = "2026-10-16";
const LOTE1 = "lote-15H-001";
const LOTE2 = "lote-15H-002";

function criarItemComum(id: string, tipo: "credito" | "debito", valor: number, data: string, descricao: string): ItemImportacao {
  return { id, transacao: { idTemporario: id, fitid: "F-" + id, tipo, valor, data, descricaoOriginal: descricao, descricaoNormalizada: descricao.toLowerCase(), ordemNoDia: 1 }, natureza: tipo === "credito" ? "receita" : "despesa", tipoLancamento: tipo === "credito" ? "receita" : "despesa", categoriaId: "cat-gen", acao: "incluir", sugestaoAplicada: false, contaId: "conta-santander", statusDeduplicacao: "nova" } as ItemImportacao;
}

function criarItemContamax(id: string, tipo: "credito" | "debito", valor: number, data: string): ItemImportacao {
  const desc = tipo === "credito" ? "TED CONTAMAX RESGATE" : "TED CONTAMAX APLICACAO";
  return { id, transacao: { idTemporario: id, fitid: "FC-" + id, tipo, valor, data, descricaoOriginal: desc, descricaoNormalizada: desc.toLowerCase(), ordemNoDia: 2 }, natureza: "movimentacao_interna", tipoLancamento: "transferencia", categoriaId: "", acao: "incluir", sugestaoAplicada: false, contaId: "conta-santander", statusDeduplicacao: "nova" } as ItemImportacao;
}

const ITENS_COMUNS = [
  criarItemComum("c1", "credito", 1000.0, "2026-07-20", "PIX RECEBIDO CLIENTE A"),
  criarItemComum("c2", "credito", 500.0, "2026-08-05", "TED RECEBIDO FORNECEDOR B"),
  criarItemComum("c3", "debito", 800.0, "2026-08-10", "BOLETO ALUGUEL"),
  criarItemComum("c4", "debito", 600.0, "2026-09-01", "DEBITO ENERGIA"),
];
const ITEM_APLIC = criarItemContamax("ctx1", "debito", 5000.0, "2026-09-15");
const ITEM_RESGATE = criarItemContamax("ctx2", "credito", 14004.17, "2026-10-10");

async function run(): Promise<void> {
  const sim = new Simulador15H();

  // 1A: Contamax ignorado
  secao("TESTE 1A — Contamax IGNORADO (padrão)");
  sim.reset();
  const r1a = await sim.importarExtratoLote({ loteId: LOTE1, bancoCodigo: "033", contaId: "conta-santander", nomeArquivo: "t.ofx", formato: "ofx", periodo: { inicio: "2026-07-18", fim: DATA_LEDGERBAL }, itens: [...ITENS_COMUNS, ITEM_APLIC, ITEM_RESGATE], regrasACriar: [], usuario: "t" });
  asserir(r1a.totais.lancadas === 4, "1A.1 — 4 lançamentos comuns", "lancadas=" + r1a.totais.lancadas);
  asserir(r1a.totais.ignoradas === 2, "1A.2 — 2 Contamax ignorados", "ignoradas=" + r1a.totais.ignoradas);
  asserir(sim.lancamentos.filter((l) => l.conta_id === "conta-sicoob").length === 0, "1A.3 — Nenhum lançamento vazou para conta-sicoob");
  asserir(r1a.saldoDepois === 100.0, "1A.4 — Saldo CC = 100,00", "saldo=" + r1a.saldoDepois);

  // 1B: Contamax como transferência
  secao("TESTE 1B — Contamax como TRANSFERÊNCIA");
  sim.reset();
  const r1b = await sim.importarExtratoLote({ loteId: LOTE1, bancoCodigo: "033", contaId: "conta-santander", nomeArquivo: "t.ofx", formato: "ofx", periodo: { inicio: "2026-07-18", fim: DATA_LEDGERBAL }, itens: [...ITENS_COMUNS, ITEM_APLIC, ITEM_RESGATE], regrasACriar: [], usuario: "t", contaDestinoId: "conta-sicoob" });
  asserir(r1b.totais.lancadas === 6, "1B.1 — 6 lançamentos (4 comuns + 2 Contamax)", "lancadas=" + r1b.totais.lancadas);
  const ctxCC = sim.lancamentos.filter((l) => l.conta_id === "conta-santander" && l.origem === "transferencia");
  const ctxAplic = sim.lancamentos.filter((l) => l.conta_id === "conta-sicoob" && l.origem === "transferencia");
  asserir(ctxCC.length === 2, "1B.2 — 2 transferências na CC", "n=" + ctxCC.length);
  asserir(ctxAplic.length === 2, "1B.3 — 2 transferências na Aplicação", "n=" + ctxAplic.length);
  asserir(ctxCC.find((l) => l.descricao.includes("APLICACAO"))?.tipo === "despesa", "1B.4 — Aplicação = despesa na CC");
  asserir(ctxCC.find((l) => l.descricao.includes("RESGATE"))?.tipo === "receita", "1B.5 — Resgate = receita na CC");
  asserir(ctxAplic.find((l) => l.descricao.includes("APLICACAO"))?.tipo === "receita", "1B.6 — Aplicação = receita na Aplicação");
  asserir(ctxAplic.find((l) => l.descricao.includes("RESGATE"))?.tipo === "despesa", "1B.7 — Resgate = despesa na Aplicação");
  asserir(Math.abs(sim.calcularSaldoReal("conta-santander") - 9104.17) < 0.01, "1B.8 — Saldo CC = 9.104,17", "saldo=" + sim.calcularSaldoReal("conta-santander"));
  asserir(Math.abs(sim.calcularSaldoReal("conta-sicoob") - (-9004.17)) < 0.01, "1B.9 — Saldo Sicoob = -9.004,17", "saldo=" + sim.calcularSaldoReal("conta-sicoob"));

  // 2: Ajuste saldo inicial
  secao("TESTE 2 — Ajuste de Saldo Inicial por LEDGERBAL");
  sim.reset();
  await sim.importarExtratoLote({ loteId: LOTE1, bancoCodigo: "033", contaId: "conta-santander", nomeArquivo: "t.ofx", formato: "ofx", periodo: { inicio: "2026-07-18", fim: DATA_LEDGERBAL }, itens: ITENS_COMUNS, regrasACriar: [], usuario: "t" });
  const nLancAntes = sim.lancamentos.length;
  asserir(sim.calcularSaldoReal("conta-santander") === 100.0, "2.1 — Saldo antes do ajuste = 100,00");
  const aj = sim.ajustarSaldoInicialPorLedgerbal({ contaId: "conta-santander", saldoLedgerbal: LEDGERBAL, dataLedgerbal: DATA_LEDGERBAL });
  asserir(Math.abs(aj.saldoInicialNovo - (-5532.10)) < 0.01, "2.2 — Novo saldo inicial = -5.532,10", "got=" + aj.saldoInicialNovo);
  asserir(Math.abs(aj.saldoFinalAposAjuste - LEDGERBAL) < 0.01, "2.3 — Saldo final = LEDGERBAL", "got=" + aj.saldoFinalAposAjuste);
  asserir(Math.abs(aj.diferenca) < 0.01, "2.4 — Diferença residual ≈ 0", "dif=" + aj.diferenca);
  asserir(sim.lancamentos.length === nLancAntes, "2.5 — Nenhum lançamento de ajuste foi criado");
  asserir(aj.dataSaldoInicialNova < "2026-07-20", "2.6 — Data saldo inicial < primeiro lançamento", "data=" + aj.dataSaldoInicialNova);

  // 3: Comparação
  secao("TESTE 3 — Comparação Pós-Importação");
  sim.reset();
  const r3 = await sim.importarExtratoLote({ loteId: LOTE1, bancoCodigo: "033", contaId: "conta-santander", nomeArquivo: "t.ofx", formato: "ofx", periodo: { inicio: "2026-07-18", fim: DATA_LEDGERBAL }, itens: ITENS_COMUNS, regrasACriar: [], usuario: "t", saldoBanco: { valor: LEDGERBAL, data: DATA_LEDGERBAL } });
  asserir(r3.diferencaConciliacao !== undefined, "3.1 — diferencaConciliacao presente");
  asserir(Math.abs((r3.diferencaConciliacao ?? 0) - (-5532.10)) < 0.01, "3.2 — Diferença exata = -5.532,10", "got=" + r3.diferencaConciliacao);
  asserir(r3.saldoDepois === 100.0, "3.3 — Saldo calculado = 100,00");

  // 4: Rollback
  secao("TESTE 4 — Rollback");
  sim.reset();
  await sim.importarExtratoLote({ loteId: LOTE1, bancoCodigo: "033", contaId: "conta-santander", nomeArquivo: "t.ofx", formato: "ofx", periodo: { inicio: "2026-07-18", fim: DATA_LEDGERBAL }, itens: [...ITENS_COMUNS, ITEM_APLIC, ITEM_RESGATE], regrasACriar: [], usuario: "t", contaDestinoId: "conta-sicoob" });
  asserir(sim.lancamentos.length === 8, "4.1 — 8 lançamentos antes do rollback", "n=" + sim.lancamentos.length);
  const rb = sim.desfazerImportacao(LOTE1);
  asserir(sim.lancamentos.length === 0, "4.2 — Todos removidos após rollback");
  asserir(rb.removidos === 8, "4.3 — 8 removidos", "got=" + rb.removidos);
  asserir(sim.calcularSaldoReal("conta-santander") === 0, "4.4 — Saldo CC volta a 0");
  asserir(sim.calcularSaldoReal("conta-sicoob") === 0, "4.5 — Saldo Sicoob volta a 0");

  // 5: Deduplicação
  secao("TESTE 5 — Deduplicação (reimportar)");
  sim.reset();
  const r5a = await sim.importarExtratoLote({ loteId: LOTE1, bancoCodigo: "033", contaId: "conta-santander", nomeArquivo: "t.ofx", formato: "ofx", periodo: { inicio: "2026-07-18", fim: DATA_LEDGERBAL }, itens: ITENS_COMUNS, regrasACriar: [], usuario: "t" });
  const r5b = await sim.importarExtratoLote({ loteId: LOTE2, bancoCodigo: "033", contaId: "conta-santander", nomeArquivo: "t.ofx", formato: "ofx", periodo: { inicio: "2026-07-18", fim: DATA_LEDGERBAL }, itens: ITENS_COMUNS, regrasACriar: [], usuario: "t" });
  asserir(r5a.totais.lancadas === 4, "5.1 — 1ª importação: 4 lançamentos");
  asserir(r5b.totais.lancadas === 0, "5.2 — Reimportação: 0 novos lançamentos");
  asserir(r5b.totais.duplicadas === 4, "5.3 — 4 duplicatas detectadas");
  asserir(r5b.saldoDepois === r5a.saldoDepois, "5.4 — Saldo não muda na reimportação");

  // 6: Segurança sem conta destino
  secao("TESTE 6 — Segurança: Contamax sem conta destino");
  sim.reset();
  await sim.importarExtratoLote({ loteId: LOTE1, bancoCodigo: "033", contaId: "conta-santander", nomeArquivo: "t.ofx", formato: "ofx", periodo: { inicio: "2026-07-18", fim: DATA_LEDGERBAL }, itens: [ITEM_APLIC, ITEM_RESGATE], regrasACriar: [], usuario: "t" });
  asserir(sim.lancamentos.filter((l) => l.conta_id === "conta-sicoob").length === 0, "6.1 — Nenhum lançamento vazou para Sicoob");
  asserir(sim.lancamentos.length === 0, "6.2 — Nenhum lançamento criado (Contamax ignorados sem contaDestino)");

  // Resultado
  console.log("\n" + "═".repeat(70));
  console.log("  RESULTADO: " + passaram + "/" + totalTestes + " testes passaram");
  if (falharam > 0) {
    console.error("  FALHAS (" + falharam + "):");
    falhas.forEach((f) => console.error("    " + f));
  } else {
    console.log("  ✓ TODOS OS TESTES PASSARAM");
  }
  console.log("═".repeat(70) + "\n");
  process.exit(falharam > 0 ? 1 : 0);
}

run().catch((e) => { console.error(e); process.exit(1); });
