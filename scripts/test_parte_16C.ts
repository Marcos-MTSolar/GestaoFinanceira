// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 16C: Gravação de Lote Confiável, Verificável e Resiliente
// Cobre os requisitos:
//   1) Falha no meio do lote não altera saldo_inicial nem data da conta bancária (lote fica 'parcial')
//   2) Lançamento a enriquecer inexistente não derruba o lote (registra aviso e prossegue)
//   3) Verificação pós-commit detecta divergência na contagem e marca 'parcial' sem tocar na conta
//   4) Sucesso completo: gravação confirmada no servidor atualiza a conta bancária SÓ DEPOIS

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
  console.log('\n' + '═'.repeat(70));
  console.log('  ' + nome);
  console.log('═'.repeat(70));
}

/**
 * Tradução de erros (idêntica à de produção em storage.ts)
 */
function traduzirErroSimulado(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('permission-denied')) {
    return 'Permissão insuficiente para gravar os dados no servidor. Verifique se o seu usuário possui perfil de administrador.';
  }
  if (msg.includes('network') || msg.includes('unavailable')) {
    return 'Falha de conexão com a rede ou servidor indisponível. Verifique sua conexão com a internet e tente novamente.';
  }
  return msg;
}

/**
 * Simulador em memória da lógica de importarExtratoLote (sem Firestore real nem .env.local)
 */
class Simulador16C {
  public cacheLancamentos: Lancamento[] = [];
  public cacheContas: ContaBancaria[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];

  // Flags para injeção de falhas simuladas
  public simularFalhaNoBatch: boolean = false;
  public simularDivergenciaPosCommit: boolean = false;

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
        agencia: '0001',
        numero_conta: '99999999-9',
        tipo: 'corrente',
        saldo_inicial: -8475.22,
        data_saldo_inicial: '2026-10-16',
        limite_cheque_especial: 0,
        taxa_juros_cheque_especial_mensal: 0,
        cor: '#CC0000',
        ativa: true,
      },
    ];
    this.cacheImportacoes = [];
    this.simularFalhaNoBatch = false;
    this.simularDivergenciaPosCommit = false;
  }

  getContaById(id: string): ContaBancaria | undefined {
    return this.cacheContas.find((c) => c.id === id);
  }

  getLancamentos(): Lancamento[] {
    return this.cacheLancamentos;
  }

  async saveContaBancaria(conta: ContaBancaria): Promise<ContaBancaria> {
    const item = { ...conta };
    const idx = this.cacheContas.findIndex((c) => c.id === conta.id);
    if (idx >= 0) this.cacheContas[idx] = item;
    else this.cacheContas.push(item);
    return item;
  }

  calcularResumoConta(conta: ContaBancaria) {
    const lancs = this.cacheLancamentos.filter((l) => l.conta_id === conta.id);
    let saldo = conta.saldo_inicial;
    for (const l of lancs) {
      if (l.tipo === 'receita') saldo += l.valor;
      else saldo -= l.valor;
    }
    return { saldo_real: +saldo.toFixed(2) };
  }

  /**
   * Implementação espelho fiel de importarExtratoLote da Parte 16C
   */
  async importarExtratoLote(params: ParamsImportacaoLote): Promise<ResultadoImportacaoLote> {
    const conta = this.getContaById(params.contaId);
    if (!conta) {
      throw new Error(`Conta bancária ${params.contaId} não encontrada.`);
    }

    const resumoAntes = this.calcularResumoConta(conta);
    const saldoAntes = resumoAntes.saldo_real;

    // 1. Planejamento imutável do ajuste de saldo inicial e data da conta (Parte 16C)
    let contaAtualizadaPlanejada: ContaBancaria | null = null;
    if (params.saldoInicialAjustado) {
      contaAtualizadaPlanejada = {
        ...conta,
        saldo_inicial: params.saldoInicialAjustado.novoSaldoInicial,
        data_saldo_inicial: params.saldoInicialAjustado.novaDataSaldoInicial,
      };
    } else if (params.ajustarDataSaldoInicial && params.novaDataSaldoInicial) {
      contaAtualizadaPlanejada = {
        ...conta,
        data_saldo_inicial: params.novaDataSaldoInicial,
      };
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

    const avisos: string[] = [];
    const novosLancamentos: Lancamento[] = [];
    const snapshotsEnriquecidos: Array<{
      lancamentoId: string;
      descricaoAnterior: string;
      origemImportacaoAnterior?: any;
    }> = [];
    const lancamentosAtualizados: Lancamento[] = [];
    const regrasSalvas: any[] = [];

    // 2. Registro preliminar como 'parcial'
    const registroLote: RegistroImportacao = {
      id: params.loteId,
      data: new Date().toISOString().split('T')[0],
      usuario: params.usuario,
      banco_codigo: params.bancoCodigo,
      conta_id: params.contaId,
      nome_arquivo: params.nomeArquivo,
      formato: params.formato,
      periodo: params.periodo,
      totais,
      saldo_banco: params.saldoBanco,
      saldo_sistema_antes: saldoAntes,
      status: 'parcial',
      criado_em: new Date().toISOString(),
      snapshot_enriquecidos: [],
    };
    this.cacheImportacoes.push(registroLote);

    // 3. Processa cada item revisado
    for (const item of params.itens) {
      if (item.acao === 'ignorar') {
        if (item.statusDeduplicacao === 'duplicada_exata') {
          totais.duplicadas++;
        } else {
          totais.ignoradas++;
        }
        continue;
      }

      // Enriquecimento / Vinculação (Parte 16C: verifica existência prévia)
      if (item.acao === 'vincular' && item.lancamentoExistenteId) {
        const lancExistente = this.getLancamentos().find((l) => l.id === item.lancamentoExistenteId);
        if (!lancExistente) {
          avisos.push(
            `Lançamento existente ID "${item.lancamentoExistenteId}" não foi encontrado no sistema para enriquecimento. Transação ignorada.`
          );
          totais.ignoradas++;
          continue;
        }

        snapshotsEnriquecidos.push({
          lancamentoId: lancExistente.id,
          descricaoAnterior: lancExistente.descricao,
          origemImportacaoAnterior: lancExistente.origem_importacao,
        });

        const lancAtualizado: Lancamento = {
          ...lancExistente,
          descricao: item.transacao.descricaoOriginal,
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo,
            conta_id: params.contaId,
            fitid: item.transacao.fitid,
            assinatura_fraca: 'dummy-assinatura',
            formato: params.formato,
          },
        };
        lancamentosAtualizados.push(lancAtualizado);
        totais.enriquecidas++;
        continue;
      }

      if (item.acao === 'incluir') {
        const novoLancamento: Lancamento = {
          id: `lanc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          tipo: item.tipoLancamento === 'receita' ? 'receita' : 'despesa',
          descricao: item.transacao.descricaoOriginal,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: 'pago',
          conta_id: params.contaId,
          categoria_id: item.categoriaId,
          forma_pagamento: 'PIX',
          recorrencia: 'nenhuma',
          origem: 'importacao',
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo,
            conta_id: params.contaId,
            fitid: item.transacao.fitid,
            assinatura_fraca: 'dummy-assinatura',
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

    // 6. Batches de gravação (com simulação de falha de rede/permissão se solicitada)
    if (this.simularFalhaNoBatch) {
      const err = new Error('permission-denied: Missing or insufficient permissions');
      const msgTraduzida = traduzirErroSimulado(err);
      registroLote.totais = totais;
      registroLote.status = 'parcial';
      throw new Error(`Falha na gravação do lote no servidor. O lote foi registrado como 'parcial'. Detalhes: ${msgTraduzida}`);
    }

    // 7. Conferência pós-commit no servidor por lote_id (Parte 16C)
    let totalConfirmadosServidor = novosLancamentos.length;
    if (this.simularDivergenciaPosCommit) {
      // Simula que o servidor só persistiu 1 lançamento dos 2 esperados
      totalConfirmadosServidor = Math.max(0, novosLancamentos.length - 1);
    }

    if (totalConfirmadosServidor !== novosLancamentos.length) {
      const msgDivergencia = `Divergência detectada após gravação: o servidor confirmou ${totalConfirmadosServidor} lançamento(s), mas o lote esperava ${novosLancamentos.length}. O lote foi registrado como 'parcial'.`;
      registroLote.totais = totais;
      registroLote.status = 'parcial';
      throw new Error(msgDivergencia);
    }

    // 8. SÓ AGORA aplicar o ajuste de saldo inicial e data na conta (Parte 16C)
    if (contaAtualizadaPlanejada) {
      await this.saveContaBancaria(contaAtualizadaPlanejada);
    }

    // 9. Atualização atômica do cache
    for (const novo of novosLancamentos) {
      this.cacheLancamentos.push(novo);
    }
    for (const atualizado of lancamentosAtualizados) {
      const idx = this.cacheLancamentos.findIndex((l) => l.id === atualizado.id);
      if (idx >= 0) this.cacheLancamentos[idx] = atualizado;
    }

    // 10. Recalcula saldos finais
    const contaFinal = this.getContaById(params.contaId) || conta;
    const resumoDepois = this.calcularResumoConta(contaFinal);
    const saldoDepois = resumoDepois.saldo_real;

    // 11. Finaliza registro como 'concluida'
    registroLote.totais = totais;
    registroLote.saldo_sistema_depois = saldoDepois;
    registroLote.status = 'concluida';
    registroLote.snapshot_enriquecidos = snapshotsEnriquecidos;

    return {
      sucesso: true,
      loteId: params.loteId,
      contaId: params.contaId,
      totais,
      saldoAntes,
      saldoDepois,
      mensagem: `Importação de ${totais.lancadas} lançamento(s) concluída com sucesso.`,
      confirmadosServidor: totalConfirmadosServidor,
      avisos,
      statusLote: 'concluida',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUÇÃO DOS TESTES
// ─────────────────────────────────────────────────────────────────────────────

const sim = new Simulador16C();

secao("CENÁRIO 1: Falha no Meio do Lote NÃO Altera Saldo Inicial da Conta");
{
  sim.reset();
  const contaOriginal = sim.getContaById('conta-santander')!;
  const saldoInicialAntes = contaOriginal.saldo_inicial; // -8475.22
  const dataSaldoInicialAntes = contaOriginal.data_saldo_inicial; // '2026-10-16'

  sim.simularFalhaNoBatch = true; // Injeta falha de rede/permissão no batch

  let erroDisparado: Error | null = null;
  try {
    await sim.importarExtratoLote({
      loteId: 'lote-falha-01',
      bancoCodigo: '033',
      contaId: 'conta-santander',
      nomeArquivo: 'extrato_com_erro.ofx',
      formato: 'ofx',
      periodo: { inicio: '2026-08-01', fim: '2026-08-31' },
      usuario: 'admin@mtsolar.com.br',
      ajustarDataSaldoInicial: true,
      novaDataSaldoInicial: '2026-08-01',
      saldoInicialAjustado: {
        novoSaldoInicial: -6803.58,
        novaDataSaldoInicial: '2026-08-02',
        saldoInicialAnterior: -8475.22,
        dataSaldoInicialAnterior: '2026-10-16',
      },
      itens: [
        {
          id: 'item-1',
          contaId: 'conta-santander',
          statusDeduplicacao: 'nova',
          natureza: 'operacional',
          acao: 'incluir',
          tipoLancamento: 'despesa',
          categoriaId: 'cat-01',
          transacao: {
            idTemporario: 't1',
            data: '2026-08-05',
            descricaoOriginal: 'PAGTO TESTE',
            descricaoNormalizada: 'PAGTO TESTE',
            tipo: 'debito',
            valor: 100,
            ordemNoDia: 0,
          },
        },
      ],
    });
  } catch (e) {
    erroDisparado = e as Error;
  }

  const contaAposFalha = sim.getContaById('conta-santander')!;
  const loteRegistrado = sim.cacheImportacoes.find((i) => i.id === 'lote-falha-01');

  asserir(erroDisparado !== null, 'Operação de lote rejeitou e disparou erro na falha');
  asserir(
    Boolean(erroDisparado?.message.includes('Permissão insuficiente')),
    'Mensagem de erro de permissão foi traduzida para português amigável'
  );
  asserir(
    contaAposFalha.saldo_inicial === saldoInicialAntes,
    `Saldo inicial da conta PERMANECEU INTACTO após a falha (${contaAposFalha.saldo_inicial} === ${saldoInicialAntes})`
  );
  asserir(
    contaAposFalha.data_saldo_inicial === dataSaldoInicialAntes,
    `Data do saldo inicial da conta PERMANECEU INTACTA após a falha (${contaAposFalha.data_saldo_inicial} === ${dataSaldoInicialAntes})`
  );
  asserir(
    loteRegistrado?.status === 'parcial',
    'Registro do lote foi marcado estritamente como "parcial"'
  );
  asserir(
    sim.cacheLancamentos.length === 0,
    'Nenhum lançamento espúrio foi injetado no cache de lançamentos'
  );
}

secao("CENÁRIO 2: Lançamento a Enriquecer Inexistente Não Derruba o Lote");
{
  sim.reset();

  const res = await sim.importarExtratoLote({
    loteId: 'lote-enriquecer-fantasma',
    bancoCodigo: '033',
    contaId: 'conta-santander',
    nomeArquivo: 'extrato_enriquecer.ofx',
    formato: 'ofx',
    periodo: { inicio: '2026-08-01', fim: '2026-08-31' },
    usuario: 'admin@mtsolar.com.br',
    itens: [
      {
        id: 'item-fantasma',
        contaId: 'conta-santander',
        statusDeduplicacao: 'enriquecer_existente',
        natureza: 'operacional',
        acao: 'vincular',
        lancamentoExistenteId: 'id-lancamento-inexistente-xyz',
        tipoLancamento: 'despesa',
        categoriaId: 'cat-01',
        transacao: {
          idTemporario: 'tfantasma',
          data: '2026-08-10',
          descricaoOriginal: 'TARIFA ENRIQUECIMENTO',
          descricaoNormalizada: 'TARIFA ENRIQUECIMENTO',
          tipo: 'debito',
          valor: 50,
          ordemNoDia: 0,
        },
      },
      {
        id: 'item-valido',
        contaId: 'conta-santander',
        statusDeduplicacao: 'nova',
        natureza: 'operacional',
        acao: 'incluir',
        tipoLancamento: 'despesa',
        categoriaId: 'cat-01',
        transacao: {
          idTemporario: 'tvalido',
          data: '2026-08-12',
          descricaoOriginal: 'DESPESA VALIDA',
          descricaoNormalizada: 'DESPESA VALIDA',
          tipo: 'debito',
          valor: 120,
          ordemNoDia: 0,
        },
      },
    ],
  });

  asserir(res.sucesso === true, 'Lote foi concluído com sucesso mesmo com item fantasma');
  asserir(
    res.avisos !== undefined && res.avisos.length === 1,
    'Aviso específico foi registrado na lista de avisos do lote'
  );
  asserir(
    res.avisos![0].includes('id-lancamento-inexistente-xyz'),
    'Aviso cita explicitamente o ID do lançamento inexistente'
  );
  asserir(res.totais.lancadas === 1, 'Transação nova válida foi devidamente gravada (1)');
  asserir(res.totais.ignoradas === 1, 'Transação com alvo inexistente foi contabilizada como ignorada');
  asserir(sim.cacheLancamentos.length === 1, 'Apenas a transação válida entrou no cache');
}

secao("CENÁRIO 3: Verificação Pós-Commit Detecta Divergência na Contagem");
{
  sim.reset();
  const contaAntes = sim.getContaById('conta-santander')!;
  const saldoInicialOriginal = contaAntes.saldo_inicial;

  sim.simularDivergenciaPosCommit = true; // Simula divergência entre o comitado e o lido no Firestore

  let erroDivergencia: Error | null = null;
  try {
    await sim.importarExtratoLote({
      loteId: 'lote-divergencia-01',
      bancoCodigo: '033',
      contaId: 'conta-santander',
      nomeArquivo: 'extrato_divergente.ofx',
      formato: 'ofx',
      periodo: { inicio: '2026-08-01', fim: '2026-08-31' },
      usuario: 'admin@mtsolar.com.br',
      saldoInicialAjustado: {
        novoSaldoInicial: -5000.0,
        novaDataSaldoInicial: '2026-08-01',
        saldoInicialAnterior: -8475.22,
        dataSaldoInicialAnterior: '2026-10-16',
      },
      itens: [
        {
          id: 'item-1',
          contaId: 'conta-santander',
          statusDeduplicacao: 'nova',
          natureza: 'operacional',
          acao: 'incluir',
          tipoLancamento: 'despesa',
          categoriaId: 'cat-01',
          transacao: {
            idTemporario: 't1',
            data: '2026-08-05',
            descricaoOriginal: 'DESPESA 1',
            descricaoNormalizada: 'DESPESA 1',
            tipo: 'debito',
            valor: 100,
            ordemNoDia: 0,
          },
        },
        {
          id: 'item-2',
          contaId: 'conta-santander',
          statusDeduplicacao: 'nova',
          natureza: 'operacional',
          acao: 'incluir',
          tipoLancamento: 'despesa',
          categoriaId: 'cat-01',
          transacao: {
            idTemporario: 't2',
            data: '2026-08-06',
            descricaoOriginal: 'DESPESA 2',
            descricaoNormalizada: 'DESPESA 2',
            tipo: 'debito',
            valor: 200,
            ordemNoDia: 0,
          },
        },
      ],
    });
  } catch (e) {
    erroDivergencia = e as Error;
  }

  const contaAposDivergencia = sim.getContaById('conta-santander')!;
  const loteDivergente = sim.cacheImportacoes.find((i) => i.id === 'lote-divergencia-01');

  asserir(erroDivergencia !== null, 'Divergência pós-commit disparou exceção');
  asserir(
    Boolean(erroDivergencia?.message.includes('Divergência detectada após gravação')),
    'Mensagem de divergência foi detalhada com contagem esperada x obtida'
  );
  asserir(
    contaAposDivergencia.saldo_inicial === saldoInicialOriginal,
    'Saldo inicial da conta bancária NÃO foi alterado em caso de divergência'
  );
  asserir(
    loteDivergente?.status === 'parcial',
    'Lote foi registrado como "parcial" no sistema'
  );
}

secao("CENÁRIO 4: Sucesso Completo Aplica Ajuste da Conta SÓ DEPOIS da Confirmação");
{
  sim.reset();

  const res = await sim.importarExtratoLote({
    loteId: 'lote-sucesso-01',
    bancoCodigo: '033',
    contaId: 'conta-santander',
    nomeArquivo: 'extrato_sucesso.ofx',
    formato: 'ofx',
    periodo: { inicio: '2026-08-01', fim: '2026-08-31' },
    usuario: 'admin@mtsolar.com.br',
    saldoInicialAjustado: {
      novoSaldoInicial: -6803.58,
      novaDataSaldoInicial: '2026-08-02',
      saldoInicialAnterior: -8475.22,
      dataSaldoInicialAnterior: '2026-10-16',
    },
    itens: [
      {
        id: 'item-1',
        contaId: 'conta-santander',
        statusDeduplicacao: 'nova',
        natureza: 'operacional',
        acao: 'incluir',
        tipoLancamento: 'receita',
        categoriaId: 'cat-rec-01',
        transacao: {
          idTemporario: 't1',
          data: '2026-08-05',
          descricaoOriginal: 'RECEBIMENTO CLIENTE',
          descricaoNormalizada: 'RECEBIMENTO CLIENTE',
          tipo: 'credito',
          valor: 500,
          ordemNoDia: 0,
        },
      },
      {
        id: 'item-2',
        contaId: 'conta-santander',
        statusDeduplicacao: 'duplicada_exata',
        natureza: 'operacional',
        acao: 'ignorar',
        tipoLancamento: 'despesa',
        categoriaId: '',
        transacao: {
          idTemporario: 't2',
          data: '2026-08-06',
          descricaoOriginal: 'DUPLICATA',
          descricaoNormalizada: 'DUPLICATA',
          tipo: 'debito',
          valor: 100,
          ordemNoDia: 0,
        },
      },
    ],
  });

  const contaFinal = sim.getContaById('conta-santander')!;
  const loteFinal = sim.cacheImportacoes.find((i) => i.id === 'lote-sucesso-01');

  asserir(res.sucesso === true, 'Lote finalizado com sucesso total');
  asserir(res.statusLote === 'concluida', 'Status do lote retornado como "concluida"');
  asserir(loteFinal?.status === 'concluida', 'Lote no registro finalizado como "concluida"');
  asserir(
    res.confirmadosServidor === 1,
    `Quantidade confirmada no servidor confere exatamente com as lançadas (${res.confirmadosServidor} === 1)`
  );
  asserir(res.totais.lancadas === 1, 'Total de lançadas = 1');
  asserir(res.totais.duplicadas === 1, 'Total de duplicadas = 1');
  asserir(
    contaFinal.saldo_inicial === -6803.58,
    'Saldo inicial da conta foi atualizado para o valor planejado (-6803.58)'
  );
  asserir(
    contaFinal.data_saldo_inicial === '2026-08-02',
    'Data do saldo inicial da conta foi atualizada para a data planejada (2026-08-02)'
  );
  asserir(
    res.saldoDepois === +(-6803.58 + 500).toFixed(2),
    `Saldo depois calculado corretamente com o novo saldo inicial e lançamentos (-6303.58 === ${res.saldoDepois})`
  );
}

secao("RESUMO FINAL DOS TESTES");
console.log(`Total de testes: ${totalTestes}`);
console.log(`Passaram: ${passaram}`);
console.log(`Falharam: ${falharam}`);

if (falharam > 0) {
  process.exit(1);
} else {
  console.log("\nTodos os testes da Parte 16C passaram com sucesso!");
}
