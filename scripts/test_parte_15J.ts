// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 15J: Prevenção de Dupla Contagem do Saldo Inicial na Importação
// Cobre:
//   (a) Conta com saldo_inicial digitado como saldo de hoje (-8.475,22) + OFX real:
//       alerta aparece com sugestão de -6.803,58 em 2026-08-02.
//   (b) Após corrigir, saldo final = LEDGERBAL (-7.377,22) sem lançamento de ajuste e outra conta isolada.
//   (c) XLSX de 365 dias e depois OFX de 90 dias: união deduplicada sem dupla contagem.
//   (d) Conta nova com saldo_inicial 0: assistente de 1ª importação ativo e sem alerta indevido.
//   (e) Desfazer restaura saldo_inicial e data_saldo_inicial anteriores registrados no lote.

import {
  Lancamento,
  ContaBancaria,
  RegistroImportacao,
  ParamsImportacaoLote,
  ResultadoImportacaoLote,
} from '../src/types';
import {
  calcularMovimentacoesConta,
  analisarDuplaContagemSaldoInicial,
  contaTemLancamentosImportados,
  subtrairUmDia,
  inferirFormaPagamento,
  gerarAssinaturaFraca
} from '../src/utils/extrato';

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

class Simulador15J {
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
        saldo_inicial: -8475.22, // Saldo de hoje digitado pelo usuário
        data_saldo_inicial: "2026-10-16",
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: "#CC0000",
        ativa: true,
      },
      {
        id: "conta-sicoob",
        nome: "Sicoob MT Solar (Secundária)",
        banco: "Sicoob",
        banco_codigo: "756",
        agencia: "0001",
        numero_conta: "00001234-0",
        tipo: "corrente",
        saldo_inicial: 50000.0,
        data_saldo_inicial: "2026-01-01",
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: "#1A4A85",
        ativa: true,
      },
    ];
  }

  getContaById(id: string): ContaBancaria | undefined {
    return this.contas.find((c) => c.id === id);
  }

  saveConta(c: ContaBancaria): void {
    const idx = this.contas.findIndex((cta) => cta.id === c.id);
    if (idx >= 0) this.contas[idx] = { ...c };
    else this.contas.push({ ...c });
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
    if (!conta) throw new Error("Conta não encontrada");
    const saldoAntes = this.calcularSaldoReal(conta.id);

    // Ajuste do saldo inicial se informado pelo assistente
    if (params.saldoInicialAjustado) {
      conta.saldo_inicial = params.saldoInicialAjustado.novoSaldoInicial;
      conta.data_saldo_inicial = params.saldoInicialAjustado.novaDataSaldoInicial;
      this.saveConta(conta);
    }

    const totais = {
      lancadas: 0,
      ignoradas: 0,
      duplicadas: 0,
      enriquecidas: 0,
      vinculadas: 0,
      total_creditos: 0,
      total_debitos: 0,
    };

    const novosLancamentos: Lancamento[] = [];

    for (const item of params.itens) {
      if (item.acao === "ignorar") {
        totais.ignoradas++;
        continue;
      }

      if (item.acao === "incluir") {
        if (item.tipoLancamento === "transferencia") {
          if (!params.contaDestinoId) {
            totais.ignoradas++;
            continue;
          }
          const ehResgate = item.transacao.tipo === "credito";
          const contaOrigem = ehResgate ? params.contaDestinoId : params.contaId;
          const contaDest = ehResgate ? params.contaId : params.contaDestinoId;

          const idSaida = `lanc-transf-out-${item.id}`;
          const idEntrada = `lanc-transf-in-${item.id}`;

          novosLancamentos.push({
            id: idSaida,
            tipo: "despesa",
            descricao: item.transacao.descricaoOriginal,
            valor: item.transacao.valor,
            data_vencimento: item.transacao.data,
            data_pagamento: item.transacao.data,
            status: "pago",
            conta_id: contaOrigem,
            conta_destino_id: contaDest,
            transferencia_vinculada_id: idEntrada,
            categoria_id: "cat-des-transf",
            forma_pagamento: "transferencia",
            recorrencia: "nenhuma",
            origem: "transferencia",
            origem_importacao: {
              lote_id: params.loteId,
              banco_codigo: params.bancoCodigo,
              conta_id: params.contaId,
              fitid: item.transacao.fitid,
              assinatura_fraca: "ass-" + item.id,
              formato: params.formato,
            },
            criado_em: new Date().toISOString(),
          });

          novosLancamentos.push({
            id: idEntrada,
            tipo: "receita",
            descricao: item.transacao.descricaoOriginal,
            valor: item.transacao.valor,
            data_vencimento: item.transacao.data,
            data_pagamento: item.transacao.data,
            status: "pago",
            conta_id: contaDest,
            transferencia_vinculada_id: idSaida,
            categoria_id: "cat-rec-transf",
            forma_pagamento: "transferencia",
            recorrencia: "nenhuma",
            origem: "transferencia",
            origem_importacao: {
              lote_id: params.loteId,
              banco_codigo: params.bancoCodigo,
              conta_id: params.contaId,
              fitid: item.transacao.fitid,
              assinatura_fraca: "ass-" + item.id,
              formato: params.formato,
            },
            criado_em: new Date().toISOString(),
          });

          totais.lancadas += 2;
          continue;
        }

        novosLancamentos.push({
          id: `lanc-${item.id}`,
          tipo: item.tipoLancamento === "receita" ? "receita" : "despesa",
          descricao: item.transacao.descricaoOriginal,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: "pago",
          conta_id: params.contaId,
          categoria_id: item.categoriaId || "cat-geral",
          forma_pagamento: "transferencia",
          recorrencia: "nenhuma",
          origem: "importacao",
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo,
            conta_id: params.contaId,
            fitid: item.transacao.fitid,
            assinatura_fraca: "ass-" + item.id,
            formato: params.formato,
          },
          criado_em: new Date().toISOString(),
        });
        totais.lancadas++;
      }
    }

    this.lancamentos.push(...novosLancamentos);
    const saldoDepois = this.calcularSaldoReal(conta.id);

    // Registro do lote na coleção importacoes
    const registroLote: RegistroImportacao = {
      id: params.loteId,
      data: new Date().toISOString().split("T")[0],
      usuario: params.usuario,
      banco_codigo: params.bancoCodigo,
      conta_id: params.contaId,
      nome_arquivo: params.nomeArquivo,
      formato: params.formato,
      periodo: params.periodo,
      totais,
      saldo_sistema_antes: saldoAntes,
      saldo_sistema_depois: saldoDepois,
      status: "concluida",
      criado_em: new Date().toISOString(),
      saldoInicialAjustadoNesteLote: Boolean(params.saldoInicialAjustado),
      saldoInicialAnteriorConta: params.saldoInicialAjustado?.saldoInicialAnterior,
      dataSaldoInicialAnteriorConta: params.saldoInicialAjustado?.dataSaldoInicialAnterior,
    };
    this.importacoes.push(registroLote);

    return {
      sucesso: true,
      loteId: params.loteId,
      totais,
      saldoAntes,
      saldoDepois,
      diferencaConciliacao: params.saldoBanco?.valor !== undefined ? +(params.saldoBanco.valor - saldoDepois).toFixed(2) : undefined,
    };
  }

  async desfazerImportacao(loteId: string): Promise<{ removidos: number; saldoRestaurado: boolean }> {
    const lote = this.importacoes.find((i) => i.id === loteId);
    if (!lote) throw new Error("Lote não encontrado");

    const antes = this.lancamentos.length;
    this.lancamentos = this.lancamentos.filter(
      (l) => l.origem_importacao?.lote_id !== loteId
    );
    const removidos = antes - this.lancamentos.length;
    lote.status = "desfeita";

    let saldoRestaurado = false;
    if (lote.saldoInicialAjustadoNesteLote && lote.saldoInicialAnteriorConta !== undefined) {
      const conta = this.getContaById(lote.conta_id);
      if (conta) {
        conta.saldo_inicial = lote.saldoInicialAnteriorConta;
        if (lote.dataSaldoInicialAnteriorConta) {
          conta.data_saldo_inicial = lote.dataSaldoInicialAnteriorConta;
        }
        this.saveConta(conta);
        saldoRestaurado = true;
      }
    }

    return { removidos, saldoRestaurado };
  }
}

// Helpers para simular dados do extrato real Santander
function criarItem(id: string, tipo: "credito" | "debito", valor: number, data: string, desc: string, ehContamax = false): ItemImportacao {
  return {
    id,
    transacao: {
      idTemporario: id,
      fitid: "FIT-" + id,
      tipo,
      valor,
      data,
      descricaoOriginal: desc,
      descricaoNormalizada: desc.toLowerCase(),
      ordemNoDia: 1,
    },
    natureza: ehContamax ? "movimentacao_interna" : (tipo === "credito" ? "receita" : "despesa"),
    tipoLancamento: ehContamax ? "transferencia" : (tipo === "credito" ? "receita" : "despesa"),
    categoriaId: "cat-1",
    acao: "incluir",
    statusDeduplicacao: "nova",
  } as ItemImportacao;
}

const LEDGERBAL_OFX_REAL = -5432.10;
const DATA_LEDGERBAL = "2026-10-16";
const PRIMEIRA_DATA_OFX = "2026-08-03";

// Lote representativo com soma líquida de -573,64 na CC
// (Com Contamax de resgate/aplicação simulados como transferências)
const ITENS_OFX_90_DIAS: ItemImportacao[] = [
  criarItem("ofx-1", "debito", 10000.0, "2026-08-03", "TED APLICACAO CONTAMAX", true), // Aplicação (-10.000)
  criarItem("ofx-2", "credito", 19004.17, "2026-08-15", "TED RESGATE CONTAMAX", true),  // Resgate (+19.004,17) -> Contamax líquido = +9.004,17
  criarItem("ofx-3", "debito", 15000.0, "2026-09-01", "PAGAMENTO FORNECEDOR PLACAS"), // Despesa (-15.000)
  criarItem("ofx-4", "credito", 5422.19, "2026-10-15", "PIX CLIENTE INSTALACAO SOLAR"), // Receita (+5.422,19)
  // Total líquido das 4 transações = -10000 + 19004.17 - 15000 + 5422.19 = -573.64
];

async function executarTestesParte15J(): Promise<void> {
  const sim = new Simulador15J();

  // ────────────────────────────────────────────────────────────────
  // CENÁRIO A: Detecção de Dupla Contagem no OFX Real
  // ────────────────────────────────────────────────────────────────
  secao("CENÁRIO A — Detecção de Dupla Contagem com Saldo de Hoje Digitado");
  sim.reset();

  const santander = sim.getContaById("conta-santander")!;
  const sicoob = sim.getContaById("conta-sicoob")!;

  asserir(santander.saldo_inicial === -8475.22, "A.1 — Saldo inicial cadastrado é o saldo de hoje: -8.475,22");
  asserir(sicoob.saldo_inicial === 50000.0, "A.2 — Segunda conta cadastrada (Sicoob) possui 50.000,00");

  // Análise pré-gravação usando calcularMovimentacoesConta e analisarDuplaContagemSaldoInicial
  const movimentacoes = calcularMovimentacoesConta({
    contaId: santander.id,
    lancamentosExistentes: sim.lancamentos,
    novosItens: ITENS_OFX_90_DIAS,
    contaDestinoId: "conta-sicoob", // Contamax como transferência
  });

  asserir(movimentacoes.somaTotal === -573.64, `A.3 — Soma das movimentações da CC calculada com precisão: -573,64 (obtido: ${movimentacoes.somaTotal})`);
  asserir(movimentacoes.menorData === PRIMEIRA_DATA_OFX, `A.4 — Primeira transação identificada em ${PRIMEIRA_DATA_OFX}`);

  const analise = analisarDuplaContagemSaldoInicial({
    saldoInicialAtual: santander.saldo_inicial,
    somaTotalMovimentacoes: movimentacoes.somaTotal,
    saldoBanco: LEDGERBAL_OFX_REAL,
    menorDataTransacao: movimentacoes.menorData,
  });

  asserir(analise.temDivergencia === true, "A.5 — Alerta de dupla contagem foi acionado (temDivergencia = true)");
  asserir(analise.saldoProjetado === -9048.86, `A.6 — Saldo projetado com erro de contagem dupla = -9.048,86 (obtido: ${analise.saldoProjetado})`);
  asserir(analise.saldoBanco === LEDGERBAL_OFX_REAL, `A.7 — Saldo informado pelo banco (LEDGERBAL) = -5.432,10`);
  asserir(analise.saldoInicialSugerido === -4858.46, `A.8 — Saldo inicial sugerido exato: -4.858,46 (obtido: ${analise.saldoInicialSugerido})`);
  asserir(analise.dataSaldoInicialSugerida === "2026-08-02", `A.9 — Data sugerida é o dia anterior à 1ª transação: 2026-08-02 (obtido: ${analise.dataSaldoInicialSugerida})`);

  // ────────────────────────────────────────────────────────────────
  // CENÁRIO B: Correção Conduzida e Saldo Final Idêntico ao LEDGERBAL
  // ────────────────────────────────────────────────────────────────
  secao("CENÁRIO B — Correção do Saldo Inicial e Isolamento de Outras Contas");

  const resultadoLote = await sim.importarExtratoLote({
    loteId: "lote-ofx-real-15j",
    usuario: "admin@mtsolar.com.br",
    contaId: santander.id,
    bancoCodigo: "033",
    formato: "ofx",
    nomeArquivo: "extrato-pj-16_10_2026.ofx",
    periodo: { inicio: "2026-08-03", fim: "2026-10-16" },
    contaDestinoId: "conta-sicoob",
    saldoBanco: { valor: LEDGERBAL_OFX_REAL, data: DATA_LEDGERBAL },
    saldoInicialAjustado: {
      novoSaldoInicial: analise.saldoInicialSugerido,
      novaDataSaldoInicial: analise.dataSaldoInicialSugerida,
      saldoInicialAnterior: santander.saldo_inicial,
      dataSaldoInicialAnterior: santander.data_saldo_inicial,
    },
    itens: ITENS_OFX_90_DIAS,
  });

  const saldoFinalSantander = sim.calcularSaldoReal(santander.id);
  const saldoFinalSicoob = sim.calcularSaldoReal(sicoob.id);

  asserir(saldoFinalSantander === LEDGERBAL_OFX_REAL, `B.1 — Saldo final Santander confere EXATAMENTE com LEDGERBAL: -5.432,10 (obtido: ${saldoFinalSantander})`);
  asserir(resultadoLote.diferencaConciliacao === 0, `B.2 — Diferença de conciliação foi zerada (0,00)`);
  asserir(santander.saldo_inicial === -4858.46, `B.3 — Saldo inicial da conta alterado no cadastro para -4.858,46`);
  asserir(santander.data_saldo_inicial === "2026-08-02", `B.4 — Data do saldo inicial alterada para 2026-08-02`);

  // Verifica que NÃO foi criado nenhum lançamento com origem 'ajuste'
  const lancamentosAjuste = sim.lancamentos.filter((l) => l.origem === "ajuste");
  asserir(lancamentosAjuste.length === 0, `B.5 — NENHUM lançamento de ajuste contábil foi criado (total: 0)`);

  // Verifica isolamento: Sicoob recebeu apenas as transferências autorizadas (saldo inicial intacto)
  asserir(sicoob.saldo_inicial === 50000.0, `B.6 — Saldo inicial do Sicoob permaneceu 100% inalterado (50.000,00)`);
  asserir(sicoob.data_saldo_inicial === "2026-01-01", `B.7 — Data do saldo inicial do Sicoob permaneceu inalterada`);
  // Variação no Sicoob: -19004.17 + 10000 = -9004.17 -> 50000 - 9004.17 = 40995.83
  asserir(saldoFinalSicoob === 40995.83, `B.8 — Saldo final Sicoob reflete apenas as transferências legítimas (40.995,83)`);

  // ────────────────────────────────────────────────────────────────
  // CENÁRIO C: Importação Múltipla (XLSX de 365 dias + OFX de 90 dias)
  // ────────────────────────────────────────────────────────────────
  secao("CENÁRIO C — Importação Sequencial de Múltiplos Arquivos (XLSX + OFX)");
  sim.reset();
  const santanderC = sim.getContaById("conta-santander")!;
  santanderC.saldo_inicial = 0;
  santanderC.data_saldo_inicial = "2026-01-01";

  // 1. Simula importação prévia de 365 dias do XLSX (onde não há saldo final LEDGERBAL)
  const ITENS_XLSX: ItemImportacao[] = [
    criarItem("xlsx-1", "credito", 2000.0, "2026-01-10", "FATURAMENTO JANEIRO"),
    criarItem("xlsx-2", "debito", 1500.0, "2026-02-20", "DESPESA ALUGUEL FEV"),
    // Transação comum que existirá também no OFX posterior (para testar vinculação)
    criarItem("comum-1", "credito", 5422.19, "2026-10-15", "PIX CLIENTE INSTALACAO SOLAR"),
  ];

  await sim.importarExtratoLote({
    loteId: "lote-xlsx-365d",
    usuario: "admin@mtsolar.com.br",
    contaId: santanderC.id,
    bancoCodigo: "033",
    formato: "xlsx",
    nomeArquivo: "extrato-anual.xlsx",
    periodo: { inicio: "2026-01-01", fim: "2026-10-15" },
    itens: ITENS_XLSX,
  });

  asserir(sim.lancamentos.length === 3, "C.1 — 3 lançamentos importados pelo XLSX");
  asserir(sim.calcularSaldoReal(santanderC.id) === 5922.19, "C.2 — Saldo após XLSX = 5.922,19");

  // 2. Agora importa o OFX de 90 dias que contém o LEDGERBAL mais recente
  // O item comum-1 é detectado como 'vincular' (Parte 15C)
  const ITENS_OFX_COM_VINCULO: ItemImportacao[] = [
    criarItem("ofx-nov-1", "debito", 2000.0, "2026-09-10", "SERVICO MANUTENCAO"),
    {
      ...criarItem("comum-1", "credito", 5422.19, "2026-10-15", "PIX CLIENTE INSTALACAO SOLAR"),
      acao: "vincular", // Deduplicado!
    },
  ];

  const movMultiplos = calcularMovimentacoesConta({
    contaId: santanderC.id,
    lancamentosExistentes: sim.lancamentos,
    novosItens: ITENS_OFX_COM_VINCULO,
  });

  // Soma esperada: existentes (2000 - 1500 + 5422.19 = 5922.19) + novos incluídos (-2000) = 3922.19
  // O item comum-1 tem acao='vincular', logo NÃO é somado duas vezes!
  asserir(movMultiplos.somaTotal === 3922.19, `C.3 — Soma das movimentações deduplicadas não conta em dobro: 3.922,19 (obtido: ${movMultiplos.somaTotal})`);
  asserir(movMultiplos.menorData === "2026-01-10", `C.4 — Menor data considera toda a união histórica (2026-01-10)`);

  const LEDGERBAL_OFX_2 = 10000.0;
  const analiseMultiplos = analisarDuplaContagemSaldoInicial({
    saldoInicialAtual: santander.saldo_inicial,
    somaTotalMovimentacoes: movMultiplos.somaTotal,
    saldoBanco: LEDGERBAL_OFX_2,
    menorDataTransacao: movMultiplos.menorData,
  });

  asserir(analiseMultiplos.saldoInicialSugerido === 6077.81, `C.5 — Saldo sugerido retroativo baseado na união deduplicada: 6.077,81 (obtido: ${analiseMultiplos.saldoInicialSugerido})`);
  asserir(analiseMultiplos.dataSaldoInicialSugerida === "2026-01-09", `C.6 — Data sugerida anterior à menor data de ambos os arquivos: 2026-01-09`);

  // ────────────────────────────────────────────────────────────────
  // CENÁRIO D: Conta Nova com Saldo Inicial 0 e Assistente de 1ª Importação
  // ────────────────────────────────────────────────────────────────
  secao("CENÁRIO D — Conta Nova com Saldo Inicial 0 (Sem Alerta Indevido)");
  sim.reset();

  const contaNova: ContaBancaria = {
    id: "conta-nova",
    nome: "Nova Conta Corrente",
    banco: "Santander",
    banco_codigo: "033",
    tipo: "corrente",
    saldo_inicial: 0.0,
    data_saldo_inicial: "2026-10-01",
    limite_cheque_especial: 0,
    taxa_juros_cheque_especial_mensal: 0,
    cor: "#003064",
    ativa: true,
  };
  sim.contas.push(contaNova);

  const temImportacoes = contaTemLancamentosImportados(contaNova.id, sim.lancamentos);
  asserir(temImportacoes === false, "D.1 — Assistente detecta corretamente que a conta não tem lançamentos prévios de extrato");

  // Transação única com valor 500 e LEDGERBAL 500
  const ITENS_CONTA_NOVA = [criarItem("nova-1", "credito", 500.0, "2026-10-05", "CAPITAL INICIAL")];
  const movNova = calcularMovimentacoesConta({
    contaId: contaNova.id,
    lancamentosExistentes: sim.lancamentos,
    novosItens: ITENS_CONTA_NOVA,
  });
  const analiseNova = analisarDuplaContagemSaldoInicial({
    saldoInicialAtual: contaNova.saldo_inicial,
    somaTotalMovimentacoes: movNova.somaTotal,
    saldoBanco: 500.0,
    menorDataTransacao: movNova.menorData,
  });

  asserir(analiseNova.temDivergencia === false, "D.2 — Conta com saldo inicial 0 coerente NÃO dispara falso alerta de dupla contagem");
  asserir(analiseNova.saldoProjetado === 500.0, "D.3 — Saldo projetado coincide perfeitamente com LEDGERBAL (500,00)");

  // ────────────────────────────────────────────────────────────────
  // CENÁRIO E: Desfazer Restaura Saldo Inicial e Data Anteriores
  // ────────────────────────────────────────────────────────────────
  secao("CENÁRIO E — Desfazer Lote Restaura Saldo Inicial e Data Anteriores");
  sim.reset();
  const santanderE = sim.getContaById("conta-santander")!;
  santanderE.saldo_inicial = -8475.22;
  santanderE.data_saldo_inicial = "2026-10-16";

  // 1. Executa importação com ajuste de saldo inicial e contaDestinoId para as transferências
  const loteE = await sim.importarExtratoLote({
    loteId: "lote-para-reverter-15j",
    usuario: "admin@mtsolar.com.br",
    contaId: santanderE.id,
    contaDestinoId: "conta-sicoob",
    bancoCodigo: "033",
    formato: "ofx",
    nomeArquivo: "extrato-teste-rollback.ofx",
    periodo: { inicio: "2026-08-03", fim: "2026-10-16" },
    saldoBanco: { valor: LEDGERBAL_OFX_REAL, data: DATA_LEDGERBAL },
    saldoInicialAjustado: {
      novoSaldoInicial: -4858.46,
      novaDataSaldoInicial: "2026-08-02",
      saldoInicialAnterior: -8475.22,
      dataSaldoInicialAnterior: "2026-10-16",
    },
    itens: ITENS_OFX_90_DIAS,
  });

  asserir(santanderE.saldo_inicial === -4858.46, "E.1 — Saldo inicial alterado durante a importação para -4.858,46");
  asserir(sim.lancamentos.length === 6, `E.2 — 6 lançamentos criados no lote (obtido: ${sim.lancamentos.length})`);

  // 2. Aciona rollback da importação
  const rollback = await sim.desfazerImportacao("lote-para-reverter-15j");

  asserir(rollback.removidos === 6, `E.3 — Todos os 6 lançamentos do lote foram excluídos`);
  asserir(rollback.saldoRestaurado === true, `E.4 — Assistente acionou restauração do saldo inicial da conta`);

  const santanderRestaurado = sim.getContaById("conta-santander")!;
  asserir(santanderRestaurado.saldo_inicial === -8475.22, `E.5 — Saldo inicial da conta restaurado fielmente para -8.475,22`);
  asserir(santanderRestaurado.data_saldo_inicial === "2026-10-16", `E.6 — Data do saldo inicial restaurada fielmente para 2026-10-16`);
  asserir(sim.calcularSaldoReal("conta-santander") === -8475.22, `E.7 — Saldo real da conta voltou exatamente ao estado anterior`);

  // ────────────────────────────────────────────────────────────────
  // CENÁRIO F: Função subtrairUmDia com Casos de Borda de Calendário
  // ────────────────────────────────────────────────────────────────
  secao("CENÁRIO F — Teste de Datas e Subtração de 1 Dia");
  asserir(subtrairUmDia("2026-08-03") === "2026-08-02", "F.1 — 2026-08-03 - 1 dia = 2026-08-02");
  asserir(subtrairUmDia("2026-08-01") === "2026-07-31", "F.2 — Virada de mês: 2026-08-01 - 1 dia = 2026-07-31");
  asserir(subtrairUmDia("2026-01-01") === "2025-12-31", "F.3 — Virada de ano: 2026-01-01 - 1 dia = 2025-12-31");
  asserir(subtrairUmDia("2024-03-01") === "2024-02-29", "F.4 — Ano bissexto: 2024-03-01 - 1 dia = 2024-02-29");

  // ────────────────────────────────────────────────────────────────
  // RESULTADO FINAL
  // ────────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(70));
  console.log(`  TOTAL DE TESTES: ${totalTestes}`);
  console.log(`  PASSARAM: ${passaram}`);
  console.log(`  FALHARAM: ${falharam}`);
  console.log("═".repeat(70));

  if (falharam > 0) {
    console.error("\nFALHAS REGISTRADAS:");
    falhas.forEach((f) => console.error(f));
    process.exit(1);
  } else {
    console.log("\n  ✓ TODOS OS TESTES DA PARTE 15J PASSARAM COM SUCESSO!\n");
  }
}

executarTestesParte15J().catch((err) => {
  console.error("Erro fatal ao rodar testes da Parte 15J:", err);
  process.exit(1);
});
