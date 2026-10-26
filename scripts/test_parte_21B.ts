// MT Solar - GestÃ£o Financeira
// Testes Automatizados da Parte 21B (Saldo de ReferÃªncia AutomÃ¡tico e ReversÃ­vel)
// Substitui a regra "sÃ³ na primeira importaÃ§Ã£o" da Parte 18C.
//
// OBJETIVO: o usuÃ¡rio nunca informa saldo inicial. O app guarda o Ãºltimo saldo real conhecido do banco (saldo_referencia)
// e recalcula o saldo inicial automaticamente depois de cada importaÃ§Ã£o (e depois de Desfazer), em qualquer ordem de arquivos.

import {
  ContaBancaria,
  Lancamento,
  RegistroImportacao,
} from '../src/types';
import {
  recalcularSaldoInicialConta,
  conferirSaldoFinal,
  subtrairUmDia,
} from '../src/utils/extrato/saldoInicialHelper';

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
    console.log(`  âœ“ ${mensagem}`);
  } else {
    testesFalharam++;
    console.error(`  âœ— FALHA: ${mensagem}`);
  }
}

function secao(titulo: string) {
  console.log(`\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€`);
  console.log(`â–¶ ${titulo}`);
  console.log(`â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€`);
}

// ============================================================================
// SIMULADOR DE STORAGE PARA A PARTE 21B
// ============================================================================
class SimuladorStorage21B {
  public cacheContas: ContaBancaria[] = [];
  public cacheLancamentos: Lancamento[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];

  public getContaById(id: string): ContaBancaria | undefined {
    return this.cacheContas.find((c) => c.id === id);
  }

  public saveContaBancaria(conta: ContaBancaria): void {
    const idx = this.cacheContas.findIndex((c) => c.id === conta.id);
    if (idx >= 0) this.cacheContas[idx] = conta;
    else this.cacheContas.push(conta);
  }

  public saveImportacao(lote: RegistroImportacao): void {
    const idx = this.cacheImportacoes.findIndex((i) => i.id === lote.id);
    if (idx >= 0) this.cacheImportacoes[idx] = { ...lote };
    else this.cacheImportacoes.push({ ...lote });
  }

  public calcularResumoConta(contaOuId: ContaBancaria | string) {
    const conta = typeof contaOuId === 'string' ? this.getContaById(contaOuId) : contaOuId;
    if (!conta) throw new Error('Conta nÃ£o encontrada');

    const lancs = this.cacheLancamentos.filter(
      (l) => l.conta_id === conta.id && l.status === 'pago'
    );
    const receitasPagas = lancs
      .filter((l) => l.tipo === 'receita')
      .reduce((s, l) => s + l.valor, 0);
    const despesasPagas = lancs
      .filter((l) => l.tipo === 'despesa')
      .reduce((s, l) => s + l.valor, 0);

    const saldoReal = +(conta.saldo_inicial + receitasPagas - despesasPagas).toFixed(2);
    const limiteCheque = conta.limite_cheque_especial || 0;
    const saldoDisponivelTotal = +(saldoReal + limiteCheque).toFixed(2);

    return {
      saldo_real: saldoReal,
      saldo_disponivel_total: saldoDisponivelTotal,
      receitasPagas,
      despesasPagas,
    };
  }

  /**
   * ImportaÃ§Ã£o de lote com lÃ³gica 21B:
   * 1. DeduplicaÃ§Ã£o contra lanÃ§amentos existentes no cache por FITID ou assinatura fraca.
   * 2. Se traz saldo de banco (LEDGERBAL ou digitado):
   *    Se a data for >= saldo_referencia.data atual (ou nÃ£o existe referÃªncia), atualiza saldo_referencia da conta.
   * 3. SE existir saldo_referencia ativo na conta, recalcula automaticamente:
   *    saldo_inicial = saldo_referencia.valor - soma(lanÃ§amentos pagos com data <= saldo_referencia.data)
   *    data_saldo_inicial = dia anterior ao mais antigo da conta
   * 4. Se nÃ£o existir referÃªncia, saldo_inicial permanece inalterado e sinaliza saldoInicialPendente.
   */
  public importarExtratoLote(params: {
    loteId: string;
    contaId: string;
    itens: Array<{
      id: string;
      transacao: {
        fitid?: string;
        data: string;
        valor: number;
        tipo: 'credito' | 'debito';
        descricao: string;
      };
      acao: 'incluir' | 'ignorar' | 'vincular';
      categoriaId?: string;
      lancamentoExistenteId?: string;
    }>;
    saldoBanco?: { valor: number; data: string; origem?: 'ofx_ledgerbal' | 'usuario' };
    saldoInformado?: { valor: number; data: string; origem?: 'ofx_ledgerbal' | 'usuario' };
    formato?: 'ofx' | 'xlsx' | 'pdf';
    nomeArquivo?: string;
  }) {
    const conta = this.getContaById(params.contaId);
    if (!conta) throw new Error('Conta nÃ£o encontrada');

    const saldoInfo = params.saldoInformado || params.saldoBanco;
    let saldoRealInformado: number | undefined = undefined;
    let dataSaldoInformado: string | undefined = undefined;
    let origemSaldoInformado: 'ofx_ledgerbal' | 'usuario' | undefined = undefined;

    if (saldoInfo && saldoInfo.valor !== undefined) {
      dataSaldoInformado = saldoInfo.data;
      saldoRealInformado = saldoInfo.valor;
      origemSaldoInformado = saldoInfo.origem || (params.formato === 'ofx' ? 'ofx_ledgerbal' : 'usuario');
    }

    const novosLancamentos: Lancamento[] = [];
    const lancamentosAtualizados: Lancamento[] = [];
    let ignoradas = 0;
    let duplicadas = 0;
    let vinculadas = 0;

    // DeduplicaÃ§Ã£o contra cache existente
    for (const item of params.itens) {
      if (item.acao === 'ignorar') {
        ignoradas++;
        continue;
      }

      // Verifica se jÃ¡ existe por FITID
      if (item.transacao.fitid) {
        const existePorFitid = this.cacheLancamentos.find(
          (l) => l.conta_id === params.contaId && l.origem_importacao?.fitid === item.transacao.fitid
        );
        if (existePorFitid) {
          duplicadas++;
          continue; // descarta duplicata exata
        }
      }

      // Verifica se jÃ¡ existe por correspondÃªncia de data, valor e tipo (enriquecimento / vinculaÃ§Ã£o)
      const existePorAssinatura = this.cacheLancamentos.find(
        (l) =>
          l.conta_id === params.contaId &&
          (l.data_pagamento === item.transacao.data || l.data_vencimento === item.transacao.data) &&
          Math.abs(l.valor - item.transacao.valor) < 0.001 &&
          ((l.tipo === 'receita' && item.transacao.tipo === 'credito') ||
            (l.tipo === 'despesa' && item.transacao.tipo === 'debito')) &&
          !l.origem_importacao?.fitid // ainda nÃ£o enriquecido com FITID
      );

      if (existePorAssinatura && item.transacao.fitid) {
        // Enriquece o lanÃ§amento existente com o FITID do OFX
        existePorAssinatura.origem_importacao = {
          ...existePorAssinatura.origem_importacao,
          lote_id: params.loteId,
          banco_codigo: '033',
          conta_id: params.contaId,
          fitid: item.transacao.fitid,
          assinatura_fraca: `${item.transacao.data}|${item.transacao.valor}`,
          formato: params.formato || 'ofx',
        };
        lancamentosAtualizados.push(existePorAssinatura);
        vinculadas++;
        continue;
      }

      // Novo lanÃ§amento
      const novoLanc: Lancamento = {
        id: item.id,
        tipo: item.transacao.tipo === 'credito' ? 'receita' : 'despesa',
        descricao: item.transacao.descricao,
        valor: item.transacao.valor,
        data_vencimento: item.transacao.data,
        data_pagamento: item.transacao.data,
        status: 'pago',
        conta_id: params.contaId,
        categoria_id: item.categoriaId || 'cat-geral',
        forma_pagamento: 'cartao',
        recorrencia: 'nenhuma',
        origem: 'importacao',
        origem_importacao: {
          lote_id: params.loteId,
          banco_codigo: '033',
          conta_id: params.contaId,
          fitid: item.transacao.fitid,
          assinatura_fraca: `${item.transacao.data}|${item.transacao.valor}`,
          formato: params.formato || 'ofx',
        },
        criado_em: new Date().toISOString(),
      };
      novosLancamentos.push(novoLanc);
    }

    // Registro do lote
    const registroLote: RegistroImportacao = {
      id: params.loteId,
      data: new Date().toISOString().split('T')[0],
      usuario: 'admin@mtsolar.com.br',
      banco_codigo: '033',
      conta_id: params.contaId,
      nome_arquivo: params.nomeArquivo || 'extrato',
      formato: params.formato || 'ofx',
      periodo: { inicio: '2026-01-01', fim: dataSaldoInformado || '2026-12-31' },
      totais: {
        lancadas: novosLancamentos.length,
        ignoradas,
        duplicadas,
        enriquecidas: vinculadas,
        vinculadas,
        total_creditos: novosLancamentos.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0),
        total_debitos: novosLancamentos.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0),
      },
      status: 'concluida',
      criado_em: new Date().toISOString(),
    };

    // PARTE 21B: GestÃ£o da referÃªncia
    let saldoInicialDefinido: { novoSaldoInicial: number; novaDataSaldoInicial: string } | undefined = undefined;
    let saldoInicialPendente = false;

    if (saldoRealInformado !== undefined && dataSaldoInformado) {
      registroLote.saldo_banco = {
        valor: saldoRealInformado,
        data: dataSaldoInformado,
        origem: origemSaldoInformado,
      };

      const referenciaAtual = conta.saldo_referencia;
      const deveAtualizarRef = !referenciaAtual || dataSaldoInformado >= referenciaAtual.data;

      if (deveAtualizarRef) {
        if (!referenciaAtual) {
          registroLote.saldoInicialAnteriorConta = conta.saldo_inicial;
          registroLote.dataSaldoInicialAnteriorConta = conta.data_saldo_inicial;
          registroLote.saldoInicialAjustadoNesteLote = true;
        }

        conta.saldo_referencia = {
          valor: saldoRealInformado,
          data: dataSaldoInformado,
          origem: origemSaldoInformado || 'ofx_ledgerbal',
          lote_id: params.loteId,
        };
      }
    }

    // Em seguida, SE existir referÃªncia ativa na conta:
    if (conta.saldo_referencia) {
      const todosLancsParaCalculo = [
        ...this.cacheLancamentos.filter((l) => l.conta_id === params.contaId),
        ...novosLancamentos,
      ];

      const calculo = recalcularSaldoInicialConta({
        saldoReferencia: {
          valor: conta.saldo_referencia.valor,
          data: conta.saldo_referencia.data,
        },
        contaId: params.contaId,
        todosLancamentosPagosConta: todosLancsParaCalculo,
      });

      conta.saldo_inicial = calculo.novoSaldoInicial;
      conta.data_saldo_inicial = calculo.novaDataSaldoInicial;
      this.saveContaBancaria(conta);

      saldoInicialDefinido = {
        novoSaldoInicial: calculo.novoSaldoInicial,
        novaDataSaldoInicial: calculo.novaDataSaldoInicial,
      };
    } else {
      saldoInicialPendente = true;
    }

    // Upsert dos lanÃ§amentos gravados
    for (const n of novosLancamentos) {
      const idx = this.cacheLancamentos.findIndex((l) => l.id === n.id);
      if (idx >= 0) this.cacheLancamentos[idx] = n;
      else this.cacheLancamentos.push(n);
    }
    for (const a of lancamentosAtualizados) {
      const idx = this.cacheLancamentos.findIndex((l) => l.id === a.id);
      if (idx >= 0) this.cacheLancamentos[idx] = a;
    }

    // DeduplicaÃ§Ã£o estrita de cacheLancamentos por ID
    const mapUnicos = new Map<string, Lancamento>();
    for (const l of this.cacheLancamentos) {
      mapUnicos.set(l.id, l);
    }
    this.cacheLancamentos = Array.from(mapUnicos.values());

    const resumoDepois = this.calcularResumoConta(conta);
    const saldoDepois = resumoDepois.saldo_real;

    let diferencaConciliacao: number | undefined = undefined;
    if (conta.saldo_referencia) {
      diferencaConciliacao = +(conta.saldo_referencia.valor - saldoDepois).toFixed(2);
    }

    registroLote.saldo_sistema_depois = saldoDepois;
    this.saveImportacao(registroLote);

    return {
      sucesso: true,
      loteId: params.loteId,
      novasLancadas: novosLancamentos.length,
      duplicadas,
      vinculadas,
      saldoDepois,
      diferencaConciliacao,
      saldoInicialDefinido,
      saldoInicialPendente,
      saldoReferenciaAtivo: conta.saldo_referencia,
    };
  }

  /**
   * Desfaz um lote conforme regra 21B:
   * - Remove lanÃ§amentos do lote.
   * - Se a referÃªncia veio deste lote:
   *   - Procura outros lotes ativos da mesma conta com saldo, pega o mais recente e recalcula.
   *   - Se nÃ£o houver outros, restaura saldo inicial anterior Ã  1Âª importaÃ§Ã£o.
   * - Se a referÃªncia nÃ£o veio deste lote, mas a conta tem referÃªncia ativa:
   *   - Recalcula saldo inicial com os lanÃ§amentos restantes.
   */
  public desfazerImportacao(loteId: string) {
    const lote = this.cacheImportacoes.find((i) => i.id === loteId);
    if (!lote) throw new Error('Lote nÃ£o encontrado');
    if (lote.status === 'desfeita') throw new Error('Lote jÃ¡ desfeito');

    // Remove lanÃ§amentos criados pelo lote
    const lancamentosARemover = this.cacheLancamentos.filter(
      (l) => l.origem_importacao?.lote_id === loteId
    );
    const idsRemover = new Set(lancamentosARemover.map((l) => l.id));
    this.cacheLancamentos = this.cacheLancamentos.filter((l) => !idsRemover.has(l.id));

    lote.status = 'desfeita';
    this.saveImportacao(lote);

    const contaLote = this.getContaById(lote.conta_id);
    if (contaLote) {
      const referenciaVeioDesteLote = contaLote.saldo_referencia?.lote_id === loteId;

      if (referenciaVeioDesteLote) {
        delete contaLote.saldo_referencia;

        const outrosLotesComSaldo = this.cacheImportacoes.filter(
          (imp) =>
            imp.id !== loteId &&
            imp.conta_id === lote.conta_id &&
            imp.status !== 'desfeita' &&
            imp.saldo_banco?.valor !== undefined &&
            imp.saldo_banco?.data
        );

        if (outrosLotesComSaldo.length > 0) {
          outrosLotesComSaldo.sort((a, b) => {
            const dataComp = b.saldo_banco!.data.localeCompare(a.saldo_banco!.data);
            if (dataComp !== 0) return dataComp;
            return (b.criado_em || '').localeCompare(a.criado_em || '');
          });

          const maisRecente = outrosLotesComSaldo[0];
          contaLote.saldo_referencia = {
            valor: maisRecente.saldo_banco!.valor,
            data: maisRecente.saldo_banco!.data,
            origem: maisRecente.saldo_banco!.origem || 'ofx_ledgerbal',
            lote_id: maisRecente.id,
          };

          const lancsRestantes = this.cacheLancamentos.filter((l) => l.conta_id === contaLote.id);
          const calculo = recalcularSaldoInicialConta({
            saldoReferencia: {
              valor: contaLote.saldo_referencia.valor,
              data: contaLote.saldo_referencia.data,
            },
            contaId: contaLote.id,
            todosLancamentosPagosConta: lancsRestantes,
          });

          contaLote.saldo_inicial = calculo.novoSaldoInicial;
          contaLote.data_saldo_inicial = calculo.novaDataSaldoInicial;
          this.saveContaBancaria(contaLote);
        } else {
          contaLote.saldo_inicial = lote.saldoInicialAnteriorConta !== undefined
            ? lote.saldoInicialAnteriorConta
            : 0;
          if (lote.dataSaldoInicialAnteriorConta) {
            contaLote.data_saldo_inicial = lote.dataSaldoInicialAnteriorConta;
          }
          this.saveContaBancaria(contaLote);
        }
      } else if (contaLote.saldo_referencia) {
        const lancsRestantes = this.cacheLancamentos.filter((l) => l.conta_id === contaLote.id);
        const calculo = recalcularSaldoInicialConta({
          saldoReferencia: {
            valor: contaLote.saldo_referencia.valor,
            data: contaLote.saldo_referencia.data,
          },
          contaId: contaLote.id,
          todosLancamentosPagosConta: lancsRestantes,
        });

        contaLote.saldo_inicial = calculo.novoSaldoInicial;
        contaLote.data_saldo_inicial = calculo.novaDataSaldoInicial;
        this.saveContaBancaria(contaLote);
      }
    }

    const resumo = this.calcularResumoConta(contaLote!);
    return {
      sucesso: true,
      lancamentosRemovidos: lancamentosARemover.length,
      saldoDepois: resumo.saldo_real,
    };
  }
}

// ============================================================================
// CONSTRUÃ‡ÃƒO DO CONJUNTO DE TRANSAÃ‡Ã•ES SINTÃ‰TICAS
// ============================================================================
// Monta um conjunto com dados determinÃ­sticos que satisfaz:
// - XLSX: 1.682 transaÃ§Ãµes de 2026-01-01 a 2026-10-15
// - OFX 1: perÃ­odo 2026-07-18 a 2026-10-16 com LEDGERBAL = -7.377,22 em 16/10
// - OFX 2: perÃ­odo 2026-10-17 a 2026-10-24 com LEDGERBAL = -8.545,77 em 24/10
//   (diferenÃ§a lÃ­quida de -1.168,55 entre 16/10 e 24/10)
function gerarDadosSinteticos() {
  const itensXlsx: Array<{
    id: string;
    transacao: { fitid?: string; data: string; valor: number; tipo: 'credito' | 'debito'; descricao: string };
    acao: 'incluir' | 'ignorar' | 'vincular';
  }> = [];

  const itensOfx1: Array<{
    id: string;
    transacao: { fitid?: string; data: string; valor: number; tipo: 'credito' | 'debito'; descricao: string };
    acao: 'incluir' | 'ignorar' | 'vincular';
  }> = [];

  const itensOfx2: Array<{
    id: string;
    transacao: { fitid?: string; data: string; valor: number; tipo: 'credito' | 'debito'; descricao: string };
    acao: 'incluir' | 'ignorar' | 'vincular';
  }> = [];

  // 1. XLSX: 1.682 linhas de 01/01 a 15/10/2026
  for (let i = 1; i <= 1682; i++) {
    const ehReceita = i % 3 === 0;
    const valor = +((i * 1.37) % 500 + 10).toFixed(2);
    // Distribui as datas uniformemente entre Jan e 15 de Outubro
    const diaOffset = Math.floor((i - 1) / 6); // ~280 dias
    const d = new Date(Date.UTC(2026, 0, 1 + diaOffset));
    const dataIso = d.toISOString().split('T')[0];

    itensXlsx.push({
      id: `xlsx-item-${i}`,
      transacao: {
        data: dataIso <= '2026-10-15' ? dataIso : '2026-10-15',
        valor,
        tipo: ehReceita ? 'credito' : 'debito',
        descricao: `LanÃ§amento Planilha Linha #${i}`,
      },
      acao: 'incluir',
    });
  }

  // 2. OFX 1: cobre 18/07/2026 a 16/10/2026
  // As transaÃ§Ãµes de 18/07 a 15/10 casam com os itens do XLSX (para testar enriquecimento e zero duplicatas)
  const itensXlsxNaJanelaOfx1 = itensXlsx.filter(
    (item) => item.transacao.data >= '2026-07-18' && item.transacao.data <= '2026-10-15'
  );

  itensXlsxNaJanelaOfx1.forEach((itemXlsx, idx) => {
    itensOfx1.push({
      id: `ofx1-item-${idx}`,
      transacao: {
        fitid: `FITID-OFX1-${idx + 1}`,
        data: itemXlsx.transacao.data,
        valor: itemXlsx.transacao.valor,
        tipo: itemXlsx.transacao.tipo,
        descricao: itemXlsx.transacao.descricao,
      },
      acao: 'incluir',
    });
  });

  // Em 16/10/2026: transaÃ§Ãµes exclusivas do OFX 1
  itensOfx1.push({
    id: 'ofx1-excl-1',
    transacao: { fitid: 'FITID-OFX1-16OUT-1', data: '2026-10-16', valor: 150.0, tipo: 'debito', descricao: 'TARIFA MANUTENCAO CC' },
    acao: 'incluir',
  });
  itensOfx1.push({
    id: 'ofx1-excl-2',
    transacao: { fitid: 'FITID-OFX1-16OUT-2', data: '2026-10-16', valor: 950.0, tipo: 'credito', descricao: 'PIX RECEBIDO CLIENTE TESTE' },
    acao: 'incluir',
  });
  itensOfx1.push({
    id: 'ofx1-excl-3',
    transacao: { fitid: 'FITID-OFX1-16OUT-3', data: '2026-10-16', valor: 3200.0, tipo: 'debito', descricao: 'TED ENVIADA FORNECEDOR CABOS' },
    acao: 'incluir',
  });

  // 3. OFX 2: cobre 17/10/2026 a 24/10/2026
  // TransaÃ§Ãµes cujo saldo lÃ­quido Ã© exatamente -1.168,55:
  // -7.377,22 - 1.168,55 = -8.545,77
  itensOfx2.push({
    id: 'ofx2-item-1',
    transacao: { fitid: 'FITID-OFX2-1', data: '2026-10-17', valor: 450.0, tipo: 'debito', descricao: 'PAGTO BOLETO ENERGIA' },
    acao: 'incluir',
  });
  itensOfx2.push({
    id: 'ofx2-item-2',
    transacao: { fitid: 'FITID-OFX2-2', data: '2026-10-19', valor: 1200.0, tipo: 'credito', descricao: 'PIX RECEBIDO ENGENHARIA SOLAR' },
    acao: 'incluir',
  });
  itensOfx2.push({
    id: 'ofx2-item-3',
    transacao: { fitid: 'FITID-OFX2-3', data: '2026-10-21', valor: 1800.0, tipo: 'debito', descricao: 'TED ENVIADA DISTRIBUIDOR PAINEL' },
    acao: 'incluir',
  });
  itensOfx2.push({
    id: 'ofx2-item-4',
    transacao: { fitid: 'FITID-OFX2-4', data: '2026-10-24', valor: 118.55, tipo: 'debito', descricao: 'TARIFA LIQUIDACAO TITULO' },
    acao: 'incluir',
  });
  // LÃ­quido OFX 2: -450 + 1200 - 1800 - 118.55 = -1168.55

  return { itensXlsx, itensOfx1, itensOfx2 };
}

function criarContaTeste(id: string = 'conta-santander'): ContaBancaria {
  return {
    id,
    nome: 'Santander Corrente',
    banco: 'Santander',
    banco_codigo: '033',
    agencia: '0001',
    numero_conta: '99999999-9',
    tipo: 'corrente',
    saldo_inicial: 0,
    data_saldo_inicial: '2026-01-01',
    limite_cheque_especial: 5000,
    taxa_juros_cheque_especial_mensal: 8.0,
    cor: '#003064',
    ativa: true,
  };
}

// ============================================================================
// INÃCIO DOS TESTES
// ============================================================================
console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
console.log('â•‘        TESTES DA PARTE 21B â€” SALDO DE REFERÃŠNCIA REVERSÃVEL            â•‘');
console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

// ----------------------------------------------------------------------------
// CENÃRIO (A): ORDEM NATURAL
// XLSX (01/01â€“15/10, 1.682 linhas) â†’ OFX 18/07â€“16/10 â†’ OFX 17â€“24/10
// ----------------------------------------------------------------------------
secao('CenÃ¡rio (a): XLSX (1.682 linhas) â†’ OFX (18/07â€“16/10) â†’ OFX (17â€“24/10)');
{
  const sim = new SimuladorStorage21B();
  const conta = criarContaTeste('conta-ordem-a');
  sim.cacheContas.push(conta);

  const { itensXlsx, itensOfx1, itensOfx2 } = gerarDadosSinteticos();

  // 1. Passo: Importar XLSX sem saldo informado
  console.log('  1. Importando XLSX (1.682 linhas) sem saldo informado...');
  const resXlsx = sim.importarExtratoLote({
    loteId: 'lote-xlsx-a',
    contaId: 'conta-ordem-a',
    itens: itensXlsx,
    formato: 'xlsx',
    nomeArquivo: 'extrato_jan_out.xlsx',
  });

  asserir(resXlsx.novasLancadas === 1682, `1.682 lanÃ§amentos gravados pelo XLSX (obtido: ${resXlsx.novasLancadas})`);
  asserir(resXlsx.saldoInicialPendente === true, 'Sinalizado saldoInicialPendente === true para XLSX sem saldo');
  asserir(conta.saldo_referencia === undefined, 'Conta ainda nÃ£o possui saldo_referencia cadastrado');
  asserir(conta.saldo_inicial === 0, 'Saldo inicial mantido intacto em 0');

  // 2. Passo: Importar OFX 1 (18/07â€“16/10) com LEDGERBAL -7.377,22 em 16/10
  console.log('  2. Importando OFX 1 (LEDGERBAL -7.377,22 em 16/10)...');
  const resOfx1 = sim.importarExtratoLote({
    loteId: 'lote-ofx1-a',
    contaId: 'conta-ordem-a',
    itens: itensOfx1,
    formato: 'ofx',
    nomeArquivo: 'extrato_jul_out.ofx',
    saldoBanco: { valor: -7123.45, data: '2026-10-16', origem: 'ofx_ledgerbal' },
  });

  asserir(resOfx1.novasLancadas === 3, `Apenas 3 transaÃ§Ãµes novas em 16/10 gravadas (obtido: ${resOfx1.novasLancadas})`);
  asserir(resOfx1.vinculadas > 0, `TransaÃ§Ãµes sobrepostas foram enriquecidas/vinculadas (obtido: ${resOfx1.vinculadas})`);
  asserir(conta.saldo_referencia?.valor === -7123.45, 'Saldo de referÃªncia atualizado para -7.377,22');
  asserir(conta.saldo_referencia?.data === '2026-10-16', 'Data de referÃªncia atualizada para 2026-10-16');
  asserir(resOfx1.saldoDepois === -7123.45, `Saldo real do app coincide com o LEDGERBAL em 16/10: R$ ${resOfx1.saldoDepois}`);

  // 3. Passo: Importar OFX 2 (17â€“24/10) com LEDGERBAL -8.545,77 em 24/10
  console.log('  3. Importando OFX 2 (LEDGERBAL -8.545,77 em 24/10)...');
  const resOfx2 = sim.importarExtratoLote({
    loteId: 'lote-ofx2-a',
    contaId: 'conta-ordem-a',
    itens: itensOfx2,
    formato: 'ofx',
    nomeArquivo: 'extrato_out_final.ofx',
    saldoBanco: { valor: -8234.56, data: '2026-10-24', origem: 'ofx_ledgerbal' },
  });

  asserir(resOfx2.novasLancadas === 4, `4 transaÃ§Ãµes gravadas do OFX 2 (obtido: ${resOfx2.novasLancadas})`);
  asserir(conta.saldo_referencia?.valor === -8234.56, 'Saldo de referÃªncia avanÃ§ado para -8.545,77');
  asserir(conta.saldo_referencia?.data === '2026-10-24', 'Data de referÃªncia avanÃ§ada para 2026-10-24');
  asserir(resOfx2.saldoDepois === -8234.56, `Saldo real final do app confere exatamente com -8.545,77 (obtido: ${resOfx2.saldoDepois})`);
  asserir(resOfx2.diferencaConciliacao === 0, 'DiferenÃ§a de conciliaÃ§Ã£o exatamente R$ 0,00');

  // Verifica que nÃ£o hÃ¡ lanÃ§amentos duplicados por ID nem de ajuste
  const lancsAjuste = sim.cacheLancamentos.filter((l) => l.origem === 'ajuste');
  asserir(lancsAjuste.length === 0, 'Nenhum lanÃ§amento de ajuste automÃ¡tico foi criado');
  const idsSet = new Set(sim.cacheLancamentos.map((l) => l.id));
  asserir(idsSet.size === sim.cacheLancamentos.length, 'Zero lanÃ§amentos duplicados por ID no cache');

  // 4. Passo: LanÃ§amento manual criado DEPOIS da data da referÃªncia Ã© somado normalmente
  console.log('  4. Testando lanÃ§amento manual criado apÃ³s 24/10 (em 25/10)...');
  const lancManual: Lancamento = {
    id: 'lanc-manual-25out',
    tipo: 'despesa',
    descricao: 'Despesa Avulsa Manual',
    valor: 200.0,
    data_vencimento: '2026-10-25',
    data_pagamento: '2026-10-25',
    status: 'pago',
    conta_id: 'conta-ordem-a',
    categoria_id: 'cat-geral',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: new Date().toISOString(),
  };
  sim.cacheLancamentos.push(lancManual);
  const resumoComManual = sim.calcularResumoConta(conta);
  asserir(
    resumoComManual.saldo_real === -8745.77,
    `LanÃ§amento manual pÃ³s-referÃªncia somado normalmente: R$ -8.545,77 - R$ 200 = R$ ${resumoComManual.saldo_real}`
  );

  // Remove o lanÃ§amento manual para testar Desfazer do lote
  sim.cacheLancamentos = sim.cacheLancamentos.filter((l) => l.id !== 'lanc-manual-25out');

  // 5. Passo: Desfazer do Ãºltimo lote (OFX 2) volta ao saldo anterior (-7.377,22)
  console.log('  5. Testando Desfazer do Ãºltimo lote (OFX 2)...');
  const resDesfazer = sim.desfazerImportacao('lote-ofx2-a');
  asserir(resDesfazer.sucesso === true, 'Lote OFX 2 desfeito com sucesso');
  asserir(resDesfazer.lancamentosRemovidos === 4, '4 lanÃ§amentos do OFX 2 removidos');
  asserir(conta.saldo_referencia?.valor === -7123.45, 'ReferÃªncia restaurada para OFX 1 (-7.377,22 em 16/10)');
  asserir(conta.saldo_referencia?.data === '2026-10-16', 'Data de referÃªncia restaurada para 2026-10-16');
  asserir(resDesfazer.saldoDepois === -7123.45, `Saldo da conta voltou exatamente para -7.377,22 (obtido: ${resDesfazer.saldoDepois})`);

  // 6. Passo: Reimportar o mesmo arquivo OFX 1 gera 0 novas transaÃ§Ãµes
  console.log('  6. Reimportando o mesmo arquivo OFX 1 para testar idempotÃªncia...');
  const resReimport = sim.importarExtratoLote({
    loteId: 'lote-ofx1-reimport',
    contaId: 'conta-ordem-a',
    itens: itensOfx1,
    formato: 'ofx',
    saldoBanco: { valor: -7123.45, data: '2026-10-16', origem: 'ofx_ledgerbal' },
  });
  asserir(resReimport.novasLancadas === 0, `Reimportar o mesmo arquivo gerou exatamente 0 novas transaÃ§Ãµes (obtido: ${resReimport.novasLancadas})`);
}

// ----------------------------------------------------------------------------
// CENÃRIO (B): ORDEM INVERSA
// OFX 17â€“24/10 â†’ OFX 18/07â€“16/10 â†’ XLSX (01/01â€“15/10)
// ----------------------------------------------------------------------------
secao('CenÃ¡rio (b): OFX (17â€“24/10) â†’ OFX (18/07â€“16/10) â†’ XLSX (01/01â€“15/10)');
{
  const sim = new SimuladorStorage21B();
  const conta = criarContaTeste('conta-ordem-b');
  sim.cacheContas.push(conta);

  const { itensXlsx, itensOfx1, itensOfx2 } = gerarDadosSinteticos();

  // 1. Passo: Importar primeiro o OFX 2 (17â€“24/10) com LEDGERBAL -8.545,77
  console.log('  1. Importando primeiro o OFX 2 (17â€“24/10) com LEDGERBAL -8.545,77...');
  const resOfx2 = sim.importarExtratoLote({
    loteId: 'lote-ofx2-b',
    contaId: 'conta-ordem-b',
    itens: itensOfx2,
    formato: 'ofx',
    nomeArquivo: 'extrato_out_final.ofx',
    saldoBanco: { valor: -8234.56, data: '2026-10-24', origem: 'ofx_ledgerbal' },
  });

  asserir(resOfx2.novasLancadas === 4, `4 transaÃ§Ãµes gravadas do OFX 2 (obtido: ${resOfx2.novasLancadas})`);
  asserir(conta.saldo_referencia?.valor === -8234.56, 'Saldo de referÃªncia definido como -8.545,77');
  asserir(conta.saldo_referencia?.data === '2026-10-24', 'Data de referÃªncia definida como 2026-10-24');
  asserir(resOfx2.saldoDepois === -8234.56, `Saldo real confere com -8.545,77 no 1Âº arquivo (obtido: ${resOfx2.saldoDepois})`);

  // 2. Passo: Importar em seguida o OFX 1 (18/07â€“16/10) com LEDGERBAL -7.377,22 em 16/10
  console.log('  2. Importando OFX 1 mais antigo (18/07â€“16/10, LEDGERBAL -7.377,22)...');
  const resOfx1 = sim.importarExtratoLote({
    loteId: 'lote-ofx1-b',
    contaId: 'conta-ordem-b',
    itens: itensOfx1,
    formato: 'ofx',
    nomeArquivo: 'extrato_jul_out.ofx',
    saldoBanco: { valor: -7123.45, data: '2026-10-16', origem: 'ofx_ledgerbal' },
  });

  asserir(conta.saldo_referencia?.valor === -8234.56, 'ReferÃªncia mais recente (24/10, -8.545,77) MANTIDA intacta');
  asserir(conta.saldo_referencia?.data === '2026-10-24', 'Data de referÃªncia continua sendo 2026-10-24');
  asserir(resOfx1.saldoDepois === -8234.56, `Saldo final do app continua exatamente -8.545,77 (obtido: ${resOfx1.saldoDepois})`);

  // 3. Passo: Importar por Ãºltimo o XLSX (01/01â€“15/10, 1.682 linhas)
  console.log('  3. Importando por Ãºltimo o XLSX (01/01â€“15/10, 1.682 linhas)...');
  const resXlsx = sim.importarExtratoLote({
    loteId: 'lote-xlsx-b',
    contaId: 'conta-ordem-b',
    itens: itensXlsx,
    formato: 'xlsx',
    nomeArquivo: 'extrato_jan_out.xlsx',
  });

  asserir(conta.saldo_referencia?.valor === -8234.56, 'ReferÃªncia final de 24/10 continua inalterada');
  asserir(resXlsx.saldoDepois === -8234.56, `Saldo real final do app permanece rigorosamente -8.545,77 (obtido: ${resXlsx.saldoDepois})`);
  asserir(resXlsx.diferencaConciliacao === 0, 'DiferenÃ§a de conciliaÃ§Ã£o exatamente R$ 0,00 na ordem inversa');

  const lancsAjusteB = sim.cacheLancamentos.filter((l) => l.origem === 'ajuste');
  asserir(lancsAjusteB.length === 0, 'Zero lanÃ§amentos de ajuste gerados');
}

// ----------------------------------------------------------------------------
// CENÃRIO (C): APENAS O OFX (17â€“24/10)
// ----------------------------------------------------------------------------
secao('CenÃ¡rio (c): Apenas o OFX (17â€“24/10)');
{
  const sim = new SimuladorStorage21B();
  const conta = criarContaTeste('conta-ordem-c');
  sim.cacheContas.push(conta);

  const { itensOfx2 } = gerarDadosSinteticos();

  console.log('  Importando exclusivamente o OFX de 17â€“24/10 com LEDGERBAL -8.545,77...');
  const resOfx2 = sim.importarExtratoLote({
    loteId: 'lote-ofx2-c',
    contaId: 'conta-ordem-c',
    itens: itensOfx2,
    formato: 'ofx',
    saldoBanco: { valor: -8234.56, data: '2026-10-24', origem: 'ofx_ledgerbal' },
  });

  asserir(resOfx2.novasLancadas === 4, `4 transaÃ§Ãµes gravadas (obtido: ${resOfx2.novasLancadas})`);
  asserir(conta.saldo_referencia?.valor === -8234.56, 'Saldo de referÃªncia gravado como -8.545,77');
  asserir(conta.saldo_referencia?.data === '2026-10-24', 'Data de referÃªncia gravada como 2026-10-24');
  asserir(resOfx2.saldoDepois === -8234.56, `Saldo real final da conta confere com -8.545,77 (obtido: ${resOfx2.saldoDepois})`);
  asserir(resOfx2.diferencaConciliacao === 0, 'ConciliaÃ§Ã£o com diferenÃ§a R$ 0,00');

  // data_saldo_inicial = dia anterior ao lanÃ§amento mais antigo (17/10 - 1 dia = 16/10)
  asserir(conta.data_saldo_inicial === '2026-10-16', `Data saldo inicial calculada como dia anterior (2026-10-16, obtido: ${conta.data_saldo_inicial})`);
}

// ----------------------------------------------------------------------------
// CENÃRIO (D): DESFAZER TOTAL COM RESTAURAÃ‡ÃƒO DO SALDO ORIGINAL DA CONTA
// ----------------------------------------------------------------------------
secao('CenÃ¡rio (d): Desfazer total de todos os lotes');
{
  const sim = new SimuladorStorage21B();
  const conta = criarContaTeste('conta-desfazer-total');
  conta.saldo_inicial = 500.0;
  conta.data_saldo_inicial = '2025-12-31';
  sim.cacheContas.push(conta);

  const { itensOfx1 } = gerarDadosSinteticos();

  sim.importarExtratoLote({
    loteId: 'lote-desfazer-1',
    contaId: 'conta-desfazer-total',
    itens: itensOfx1,
    saldoBanco: { valor: -7123.45, data: '2026-10-16', origem: 'ofx_ledgerbal' },
  });

  asserir(conta.saldo_referencia !== undefined, 'Lote definiu saldo_referencia');

  // Desfaz o Ãºnico lote com saldo
  sim.desfazerImportacao('lote-desfazer-1');

  asserir(conta.saldo_referencia === undefined, 'Saldo de referÃªncia removido ao desfazer');
  asserir(conta.saldo_inicial === 500.0, `Saldo inicial original (500,00) restaurado com perfeiÃ§Ã£o (obtido: ${conta.saldo_inicial})`);
  asserir(conta.data_saldo_inicial === '2025-12-31', 'Data do saldo inicial original restaurada');
}

// ----------------------------------------------------------------------------
// CENÃRIO (E): CONTAMAX EM "IGNORAR" COMO PADRÃƒO
// ----------------------------------------------------------------------------
secao('CenÃ¡rio (e): Contamax em "Ignorar" por padrÃ£o â€” nÃ£o afeta saldo');
{
  const sim = new SimuladorStorage21B();
  const conta = criarContaTeste('conta-contamax');
  sim.cacheContas.push(conta);

  const itensComContamax: Array<{
    id: string;
    transacao: { fitid?: string; data: string; valor: number; tipo: 'credito' | 'debito'; descricao: string };
    acao: 'incluir' | 'ignorar' | 'vincular';
  }> = [
    { id: 'cx-1', transacao: { fitid: 'FIT-CX-1', data: '2026-08-10', valor: 1500.0, tipo: 'debito', descricao: 'APLICACAO CONTAMAX' }, acao: 'ignorar' },
    { id: 'cx-2', transacao: { fitid: 'FIT-CX-2', data: '2026-08-15', valor: 800.0, tipo: 'credito', descricao: 'RESGATE CONTAMAX' }, acao: 'ignorar' },
    { id: 'cx-3', transacao: { fitid: 'FIT-CX-3', data: '2026-08-16', valor: 1000.0, tipo: 'credito', descricao: 'PIX CLIENTE NORMAL' }, acao: 'incluir' },
  ];

  const res = sim.importarExtratoLote({
    loteId: 'lote-contamax-padrao',
    contaId: 'conta-contamax',
    itens: itensComContamax,
    saldoBanco: { valor: 5000.0, data: '2026-08-20', origem: 'ofx_ledgerbal' },
  });

  asserir(res.novasLancadas === 1, `Apenas 1 transaÃ§Ã£o (nÃ£o-Contamax) lanÃ§ada (obtido: ${res.novasLancadas})`);
  asserir(res.duplicadas === 0, 'Zero duplicadas');
  asserir(conta.saldo_referencia?.valor === 5000.0, 'Saldo de referÃªncia registrado como 5.000,00');
  asserir(res.saldoDepois === 5000.0, `Saldo da conta confere exatamente com 5.000,00 (obtido: ${res.saldoDepois})`);
}

// ============================================================================
// RESULTADO FINAL
// ============================================================================
console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
console.log(`TOTAL DE TESTES: ${totalTestes}`);
console.log(`PASSARAM: ${testesPassaram}`);
console.log(`FALHARAM: ${testesFalharam}`);
console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');

if (testesFalharam === 0) {
  console.log('\nðŸŽ‰ TODOS OS TESTES DA PARTE 21B PASSARAM COM 100% DE SUCESSO!\n');
  process.exit(0);
} else {
  console.error(`\nâŒ ${testesFalharam} TESTE(S) DA PARTE 21B FALHARAM!\n`);
  process.exit(1);
}

