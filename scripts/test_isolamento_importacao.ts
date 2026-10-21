// MT Solar - Gestão Financeira
// Testes Automatizados de Isolamento de Contas e Correção do Bug de Importação
// Cobre os 4 requisitos obrigatórios:
// 1. Importação OFX não altera saldo de outras contas
// 2. Contamax sem conta de aplicação configurada não vaza para outras contas
// 3. Validação de lote aborta se houver lançamento com conta_id inválido (trava anti-vazamento)
// 4. Resumo pós-importação lista corretamente contas afetadas

import {
  Lancamento,
  ContaBancaria,
  ParamsImportacaoLote,
  ResultadoImportacaoLote,
  RegistroImportacao,
} from '../src/types';
import { inferirFormaPagamento, gerarAssinaturaFraca } from '../src/utils/extrato';

let totalTestes = 0;
let passaram = 0;
let falharam = 0;

function asserir(condicao: boolean, titulo: string, detalheErro?: string): void {
  totalTestes++;
  if (condicao) {
    console.log(`  [PASSOU] ${titulo}`);
    passaram++;
  } else {
    console.error(`  [FALHOU] ${titulo}${detalheErro ? ` -> ${detalheErro}` : ''}`);
    falharam++;
  }
}

// Simulador fiel da implementação de storage.ts
class SimuladorIsolamentoContas {
  public cacheLancamentos: Lancamento[] = [];
  public cacheContas: ContaBancaria[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.cacheLancamentos = [];
    this.cacheContas = [
      {
        id: 'conta-santander',
        nome: 'Santander Corrente MT Solar',
        banco: 'Santander',
        banco_codigo: '033',
        agencia: '3749',
        numero_conta: '13004696-4',
        tipo: 'corrente',
        saldo_inicial: 1000.0,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#CC0000',
        ativa: true,
      },
      {
        id: 'conta-secundaria',
        nome: 'Conta Secundária de Investimento',
        banco: 'Santander',
        banco_codigo: '033',
        agencia: '3749',
        numero_conta: '99999999-9',
        tipo: 'poupanca',
        saldo_inicial: 50000.0,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#003064',
        ativa: true,
      },
    ];
    this.cacheImportacoes = [];
  }

  calcularResumoConta(conta: ContaBancaria) {
    let saldo = conta.saldo_inicial;
    for (const l of this.cacheLancamentos) {
      if (l.conta_id === conta.id && l.status === 'pago') {
        if (l.tipo === 'receita') saldo += l.valor;
        else if (l.tipo === 'despesa') saldo -= l.valor;
      }
    }
    return {
      saldo_real: +saldo.toFixed(2),
    };
  }

  async importarExtratoLote(params: ParamsImportacaoLote): Promise<ResultadoImportacaoLote> {
    const conta = this.cacheContas.find((c) => c.id === params.contaId);
    if (!conta) throw new Error('Conta não encontrada.');

    const saldoAntes = this.calcularResumoConta(conta).saldo_real;

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
      if (item.acao === 'ignorar') {
        totais.ignoradas++;
        continue;
      }

      if (item.acao === 'incluir') {
        // GUARDA 1: transferências sem conta destino explícita são ignoradas
        if (item.tipoLancamento === 'transferencia') {
          if (!params.contaDestinoId) {
            totais.ignoradas++;
            continue;
          }

          const idSaida = `lanc-out-${Math.random().toString(36).substr(2, 6)}`;
          const idEntrada = `lanc-in-${Math.random().toString(36).substr(2, 6)}`;
          const assFraca = gerarAssinaturaFraca({
            conta: params.contaId,
            data: item.transacao.data,
            tipo: item.transacao.tipo,
            valor: item.transacao.valor,
            descricaoNormalizada: item.transacao.descricaoNormalizada,
            ordemNoDia: item.transacao.ordemNoDia,
          });

          const lancSaida: Lancamento = {
            id: idSaida,
            tipo: 'despesa',
            descricao: item.transacao.descricaoOriginal,
            valor: item.transacao.valor,
            data_vencimento: item.transacao.data,
            data_pagamento: item.transacao.data,
            status: 'pago',
            conta_id: params.contaId,
            conta_destino_id: params.contaDestinoId,
            transferencia_vinculada_id: idEntrada,
            categoria_id: item.categoriaId || 'cat-des-12',
            forma_pagamento: 'transferencia',
            recorrencia: 'nenhuma',
            origem: 'importacao',
            origem_importacao: {
              lote_id: params.loteId,
              banco_codigo: params.bancoCodigo,
              conta_id: params.contaId,
              fitid: item.transacao.fitid,
              assinatura_fraca: assFraca,
              formato: params.formato,
            },
            criado_em: new Date().toISOString(),
          };
          const lancEntrada: Lancamento = {
            id: idEntrada,
            tipo: 'receita',
            descricao: item.transacao.descricaoOriginal,
            valor: item.transacao.valor,
            data_vencimento: item.transacao.data,
            data_pagamento: item.transacao.data,
            status: 'pago',
            conta_id: params.contaDestinoId,
            transferencia_vinculada_id: idSaida,
            categoria_id: 'cat-rec-5',
            forma_pagamento: 'transferencia',
            recorrencia: 'nenhuma',
            origem: 'importacao',
            origem_importacao: {
              lote_id: params.loteId,
              banco_codigo: params.bancoCodigo,
              conta_id: params.contaId,
              fitid: item.transacao.fitid,
              assinatura_fraca: assFraca,
              formato: params.formato,
            },
            criado_em: new Date().toISOString(),
          };
          novosLancamentos.push(lancSaida, lancEntrada);
          totais.lancadas++;
          totais.total_debitos = +(totais.total_debitos + item.transacao.valor).toFixed(2);
          continue;
        }

        const formaPagamento = inferirFormaPagamento(
          item.transacao.descricaoOriginal,
          item.natureza as any
        );

        const assinaturaFraca = gerarAssinaturaFraca({
          conta: params.contaId,
          data: item.transacao.data,
          tipo: item.transacao.tipo,
          valor: item.transacao.valor,
          descricaoNormalizada: item.transacao.descricaoNormalizada,
          ordemNoDia: item.transacao.ordemNoDia,
        });

        const novoLancamento: Lancamento = {
          id: `lanc-imp-${Math.random().toString(36).substr(2, 6)}`,
          tipo: item.tipoLancamento === 'receita' ? 'receita' : 'despesa',
          descricao: item.transacao.descricaoOriginal,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: 'pago',
          conta_id: item.contaId || params.contaId,
          categoria_id: item.categoriaId,
          forma_pagamento: formaPagamento,
          recorrencia: 'nenhuma',
          origem: 'importacao',
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo,
            conta_id: params.contaId,
            fitid: item.transacao.fitid,
            assinatura_fraca: assinaturaFraca,
            formato: params.formato,
          },
          criado_em: new Date().toISOString(),
        };

        novosLancamentos.push(novoLancamento);
        totais.lancadas++;
        if (novoLancamento.tipo === 'receita') {
          totais.total_creditos = +(totais.total_creditos + item.transacao.valor).toFixed(2);
        } else {
          totais.total_debitos = +(totais.total_debitos + item.transacao.valor).toFixed(2);
        }
      }
    }

    // 3.5. VALIDAÇÃO DE SEGURANÇA ESTRITA (Trava Anti-Vazamento entre Contas)
    for (const lanc of novosLancamentos) {
      const contaValida =
        lanc.conta_id === params.contaId ||
        (params.contaDestinoId && lanc.conta_id === params.contaDestinoId && lanc.transferencia_vinculada_id);

      if (!contaValida) {
        const erroMsg = `[importarExtratoLote] VIOLAÇÃO DE SEGURANÇA: Tentativa de gravar lançamento '${lanc.id}' para conta '${lanc.conta_id}', diferente da conta escolhida '${params.contaId}'. A importação foi abortada imediatamente.`;
        throw new Error(erroMsg);
      }
    }

    // Persistência simulada no cache
    this.cacheLancamentos.push(...novosLancamentos);

    const resumoDepois = this.calcularResumoConta(conta);
    const saldoDepois = resumoDepois.saldo_real;

    const contasAfetadas: Array<{
      contaId: string;
      contaNome: string;
      saldoAntes: number;
      saldoDepois: number;
    }> = [
      {
        contaId: conta.id,
        contaNome: conta.nome,
        saldoAntes,
        saldoDepois,
      },
    ];

    if (params.contaDestinoId) {
      const contaDestino = this.cacheContas.find((c) => c.id === params.contaDestinoId);
      if (contaDestino) {
        const resumoDestino = this.calcularResumoConta(contaDestino);
        const entradasDestino = novosLancamentos
          .filter((l) => l.conta_id === params.contaDestinoId && l.tipo === 'receita')
          .reduce((sum, l) => sum + l.valor, 0);
        contasAfetadas.push({
          contaId: contaDestino.id,
          contaNome: contaDestino.nome,
          saldoAntes: +(resumoDestino.saldo_real - entradasDestino).toFixed(2),
          saldoDepois: resumoDestino.saldo_real,
        });
      }
    }

    return {
      sucesso: true,
      loteId: params.loteId,
      contaId: params.contaId,
      totais,
      saldoAntes,
      saldoDepois,
      contasAfetadas,
    };
  }
}

async function rodarTestes() {
  console.log('======================================================================');
  console.log('TESTES DE ISOLAMENTO DE CONTAS E ANTI-VAZAMENTO DE EXTRATO');
  console.log('======================================================================\n');

  const sim = new SimuladorIsolamentoContas();

  // -------------------------------------------------------------------------
  // REQUISITO 1: Importação OFX não altera saldo de outras contas
  // -------------------------------------------------------------------------
  console.log('--- Cenário 1: Importação OFX não altera saldo de outras contas ---');
  sim.reset();
  const contaSantander = sim.cacheContas.find((c) => c.id === 'conta-santander')!;
  const contaSecundaria = sim.cacheContas.find((c) => c.id === 'conta-secundaria')!;

  const saldoSecundariaAntes = sim.calcularResumoConta(contaSecundaria).saldo_real;

  const paramsCenario1: ParamsImportacaoLote = {
    loteId: 'lote-teste-1',
    usuario: 'admin@mtsolar.com.br',
    contaId: contaSantander.id,
    bancoCodigo: '033',
    formato: 'ofx',
    nomeArquivo: 'extrato_santander_90dias.ofx',
    periodo: { inicio: '2026-01-01', fim: '2026-03-31' },
    itens: [
      {
        id: 'item-1',
        transacao: {
          idTemporario: 'tmp-1',
          fitid: 'fitid-001',
          data: '2026-01-10',
          tipo: 'credito',
          valor: 5000.0,
          descricaoOriginal: 'TED RECEBIDA CLIENTE MT SOLAR',
          descricaoNormalizada: 'TED RECEBIDA CLIENTE MT SOLAR',
          ordemNoDia: 0,
        },
        acao: 'incluir',
        tipoLancamento: 'receita',
        categoriaId: 'cat-rec-1',
      },
      {
        id: 'item-2',
        transacao: {
          idTemporario: 'tmp-2',
          fitid: 'fitid-002',
          data: '2026-01-12',
          tipo: 'debito',
          valor: 1500.0,
          descricaoOriginal: 'PIX FORNECEDOR MODULOS',
          descricaoNormalizada: 'PIX FORNECEDOR MODULOS',
          ordemNoDia: 1,
        },
        acao: 'incluir',
        tipoLancamento: 'despesa',
        categoriaId: 'cat-des-1',
      },
    ],
  };

  const resultadoC1 = await sim.importarExtratoLote(paramsCenario1);
  const saldoSantanderDepois = sim.calcularResumoConta(contaSantander).saldo_real;
  const saldoSecundariaDepois = sim.calcularResumoConta(contaSecundaria).saldo_real;

  asserir(resultadoC1.sucesso === true, 'Importação concluída com sucesso');
  asserir(
    saldoSantanderDepois === 1000.0 + 5000.0 - 1500.0,
    `Saldo da conta Santander atualizado corretamente (esperado: R$ 4.500,00 | obtido: R$ ${saldoSantanderDepois.toFixed(2)})`
  );
  asserir(
    saldoSecundariaDepois === saldoSecundariaAntes,
    `Saldo da conta secundária permaneceu 100% INALTERADO (R$ ${saldoSecundariaDepois.toFixed(2)})`
  );
  const lancamentosNaSecundaria = sim.cacheLancamentos.filter(
    (l) => l.conta_id === contaSecundaria.id
  );
  asserir(
    lancamentosNaSecundaria.length === 0,
    'Nenhum lançamento foi gravado com a conta_id da outra conta cadastrada'
  );

  // -------------------------------------------------------------------------
  // REQUISITO 2: Contamax sem conta de aplicação não vaza para outras contas
  // -------------------------------------------------------------------------
  console.log('\n--- Cenário 2: Contamax sem conta de aplicação não vaza para outras contas ---');
  sim.reset();

  const paramsCenario2: ParamsImportacaoLote = {
    loteId: 'lote-teste-contamax',
    usuario: 'admin@mtsolar.com.br',
    contaId: contaSantander.id,
    bancoCodigo: '033',
    formato: 'ofx',
    nomeArquivo: 'extrato_santander_com_contamax.ofx',
    periodo: { inicio: '2026-01-01', fim: '2026-03-31' },
    itens: [
      {
        id: 'item-contamax-1',
        transacao: {
          idTemporario: 'tmp-c1',
          fitid: 'fitid-contamax-apl',
          data: '2026-01-15',
          tipo: 'debito',
          valor: 10000.0,
          descricaoOriginal: 'APLICACAO CONTAMAX CDB',
          descricaoNormalizada: 'APLICACAO CONTAMAX CDB',
          ordemNoDia: 0,
        },
        natureza: 'movimentacao_interna',
        acao: 'incluir',
        tipoLancamento: 'transferencia', // Marcado como transferência sem conta destino
        categoriaId: '',
      },
      {
        id: 'item-contamax-2',
        transacao: {
          idTemporario: 'tmp-c2',
          fitid: 'fitid-contamax-resg',
          data: '2026-01-20',
          tipo: 'credito',
          valor: 10000.0,
          descricaoOriginal: 'RESGATE CONTAMAX CDB',
          descricaoNormalizada: 'RESGATE CONTAMAX CDB',
          ordemNoDia: 1,
        },
        natureza: 'movimentacao_interna',
        acao: 'incluir',
        tipoLancamento: 'transferencia',
        categoriaId: '',
      },
    ],
  };

  const resultadoC2 = await sim.importarExtratoLote(paramsCenario2);
  asserir(resultadoC2.totais.ignoradas === 2, 'Contamax sem conta destino foi ignorada com segurança');
  asserir(resultadoC2.totais.lancadas === 0, 'Nenhum lançamento espúrio foi gravado');

  const saldoSantanderC2 = sim.calcularResumoConta(contaSantander).saldo_real;
  const saldoSecundariaC2 = sim.calcularResumoConta(contaSecundaria).saldo_real;
  asserir(
    saldoSantanderC2 === 1000.0,
    `Saldo da conta Santander NÃO foi inflacionado nem reduzido (R$ ${saldoSantanderC2.toFixed(2)})`
  );
  asserir(
    saldoSecundariaC2 === 50000.0,
    `Saldo da outra conta NÃO foi tocado (R$ ${saldoSecundariaC2.toFixed(2)})`
  );

  // -------------------------------------------------------------------------
  // REQUISITO 3: Validação de lote aborta se houver lançamento com conta_id inválido
  // -------------------------------------------------------------------------
  console.log('\n--- Cenário 3: Trava anti-vazamento aborta se conta_id for inválido ---');
  sim.reset();

  const paramsCenario3Invalido: ParamsImportacaoLote = {
    loteId: 'lote-teste-violacao',
    usuario: 'admin@mtsolar.com.br',
    contaId: contaSantander.id,
    bancoCodigo: '033',
    formato: 'ofx',
    nomeArquivo: 'extrato_santander_com_conta_invalida.ofx',
    periodo: { inicio: '2026-01-01', fim: '2026-03-31' },
    itens: [
      {
        id: 'item-malicioso-ou-bugado',
        contaId: contaSecundaria.id, // conta_id diferente da conta do lote!
        transacao: {
          idTemporario: 'tmp-err',
          fitid: 'fitid-errado',
          data: '2026-01-18',
          tipo: 'credito',
          valor: 99999.0,
          descricaoOriginal: 'VALOR EM OUTRA CONTA',
          descricaoNormalizada: 'VALOR EM OUTRA CONTA',
          ordemNoDia: 0,
        },
        acao: 'incluir',
        tipoLancamento: 'receita',
        categoriaId: 'cat-rec-1',
      },
    ],
  };

  let capturouErro = false;
  let mensagemErro = '';
  try {
    await sim.importarExtratoLote(paramsCenario3Invalido);
  } catch (err: any) {
    capturouErro = true;
    mensagemErro = err.message;
  }

  asserir(capturouErro === true, 'Importação abortou imediatamente ao detectar tentativa de vazamento');
  asserir(
    mensagemErro.includes('VIOLAÇÃO DE SEGURANÇA'),
    `Mensagem de erro clara emitida: "${mensagemErro}"`
  );
  asserir(
    sim.cacheLancamentos.length === 0,
    'Nenhum lançamento foi gravado no banco após aborto'
  );

  // -------------------------------------------------------------------------
  // REQUISITO 4: Resumo pós-importação lista corretamente contas afetadas
  // -------------------------------------------------------------------------
  console.log('\n--- Cenário 4: Resumo pós-importação lista corretamente contas afetadas ---');
  sim.reset();

  // Teste 4A: Importação simples em 1 única conta
  const params4A: ParamsImportacaoLote = {
    loteId: 'lote-4a',
    usuario: 'admin@mtsolar.com.br',
    contaId: contaSantander.id,
    bancoCodigo: '033',
    formato: 'ofx',
    nomeArquivo: 'extrato_simples.ofx',
    periodo: { inicio: '2026-01-01', fim: '2026-01-31' },
    itens: [
      {
        id: 'item-4a',
        transacao: {
          idTemporario: 'tmp-4a',
          fitid: 'fitid-4a',
          data: '2026-01-05',
          tipo: 'credito',
          valor: 200.0,
          descricaoOriginal: 'DEPOSITO CLIENTE',
          descricaoNormalizada: 'DEPOSITO CLIENTE',
          ordemNoDia: 0,
        },
        acao: 'incluir',
        tipoLancamento: 'receita',
        categoriaId: 'cat-rec-1',
      },
    ],
  };

  const res4A = await sim.importarExtratoLote(params4A);
  asserir(
    res4A.contasAfetadas?.length === 1,
    `Importação simples lista exatamente 1 conta afetada (${res4A.contasAfetadas?.length})`
  );
  asserir(
    res4A.contasAfetadas?.[0].contaId === contaSantander.id,
    `Conta afetada é o Santander (${res4A.contasAfetadas?.[0].contaNome})`
  );
  asserir(
    res4A.contasAfetadas?.[0].saldoAntes === 1000.0 && res4A.contasAfetadas?.[0].saldoDepois === 1200.0,
    `Saldos antes/depois da conta Santander corretos: R$ 1.000,00 -> R$ 1.200,00`
  );

  // Teste 4B: Transferência legítima explícita (afeta 2 contas com transparência)
  sim.reset();
  const params4B: ParamsImportacaoLote = {
    loteId: 'lote-4b-transf',
    usuario: 'admin@mtsolar.com.br',
    contaId: contaSantander.id,
    bancoCodigo: '033',
    formato: 'ofx',
    nomeArquivo: 'extrato_com_transf_autorizada.ofx',
    periodo: { inicio: '2026-01-01', fim: '2026-01-31' },
    contaDestinoId: contaSecundaria.id, // Usuário configurou explicitamente a conta de contrapartida
    itens: [
      {
        id: 'item-4b',
        transacao: {
          idTemporario: 'tmp-4b',
          fitid: 'fitid-4b',
          data: '2026-01-10',
          tipo: 'debito',
          valor: 300.0,
          descricaoOriginal: 'APLICACAO FINANCEIRA AUTORIZADA',
          descricaoNormalizada: 'APLICACAO FINANCEIRA AUTORIZADA',
          ordemNoDia: 0,
        },
        acao: 'incluir',
        tipoLancamento: 'transferencia',
        categoriaId: 'cat-des-12',
      },
    ],
  };

  const res4B = await sim.importarExtratoLote(params4B);
  asserir(
    res4B.contasAfetadas?.length === 2,
    `Transferência legítima lista exatamente 2 contas afetadas (${res4B.contasAfetadas?.length})`
  );
  const afetadaOrigem = res4B.contasAfetadas?.find((c) => c.contaId === contaSantander.id);
  const afetadaDestino = res4B.contasAfetadas?.find((c) => c.contaId === contaSecundaria.id);
  asserir(
    afetadaOrigem?.saldoAntes === 1000.0 && afetadaOrigem?.saldoDepois === 700.0,
    `Conta origem (Santander): R$ 1.000,00 -> R$ 700,00`
  );
  asserir(
    afetadaDestino?.saldoAntes === 50000.0 && afetadaDestino?.saldoDepois === 50300.0,
    `Conta destino (Secundária): R$ 50.000,00 -> R$ 50.300,00`
  );

  console.log('\n======================================================================');
  console.log(`TOTAL DE TESTES: ${totalTestes}`);
  console.log(`PASSARAM: ${passaram}`);
  console.log(`FALHARAM: ${falharam}`);
  console.log('======================================================================');

  if (falharam > 0) {
    process.exit(1);
  }
}

rodarTestes().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
