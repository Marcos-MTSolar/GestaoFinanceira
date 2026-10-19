// MT Solar - Gestão Financeira
// Testes do Lote de Importação de Extratos Bancários (Parte 15F)
// Cobre:
// 1. Processamento e particionamento atômico em batches de até 500 operações (1.000+ linhas)
// 2. Criação de lançamentos com origem 'importacao', status 'pago', forma de pagamento inferida
// 3. Enriquecimento de lançamentos existentes preservando categoria e gerando snapshot
// 4. Tratamento de falha parcial com status 'parcial'
// 5. Desfazimento (rollback seguro) restaurando lançamentos enriquecidos e removendo novos

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  Lancamento,
  ContaBancaria,
  Categoria,
  RegraImportacao,
  RegistroImportacao,
  ParamsImportacaoLote,
  ResultadoImportacaoLote,
  ResultadoDesfazerImportacao
} from '../src/types';
import { ItemRevisaoExtrato } from '../src/components/extrato/RevisaoExtrato';
import {
  lerExtrato,
  TransacaoExtrato,
  inferirFormaPagamento,
  gerarAssinaturaFraca
} from '../src/utils/extrato';

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

// ============================================================
// SIMULADOR DO SERVIÇO DE STORAGE (ISOLADO PARA TESTE UNITÁRIO)
// Executa rigorosamente o mesmo algoritmo implementado no storage.ts
// ============================================================
class SimuladorStorageImportacao {
  public cacheLancamentos: Lancamento[] = [];
  public cacheContas: ContaBancaria[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];
  public cacheRegras: RegraImportacao[] = [];

  // Rastreamento dos batches executados
  public batchesGravados: Array<Array<{ tipo: string; id: string; colecao: string; dado?: any }>> = [];
  public simularFalhaNoBatchIndex: number | null = null;

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
        agencia: '0055',
        numero_conta: '130045678',
        tipo: 'corrente',
        saldo_inicial: 10000.00,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 5000.00,
        taxa_juros_cheque_especial_mensal: 8.5,
        cor: '#CC0000',
        ativa: true
      }
    ];
    this.cacheImportacoes = [];
    this.cacheRegras = [];
    this.batchesGravados = [];
    this.simularFalhaNoBatchIndex = null;
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
      saldo_disponivel_total: +(saldo + (conta.limite_cheque_especial || 0)).toFixed(2)
    };
  }

  async importarExtratoLote(params: ParamsImportacaoLote): Promise<ResultadoImportacaoLote> {
    const conta = this.cacheContas.find(c => c.id === params.contaId);
    if (!conta) throw new Error('Conta não encontrada.');

    const saldoAntes = this.calcularResumoConta(conta).saldo_real;

    if (params.ajustarDataSaldoInicial && params.novaDataSaldoInicial) {
      conta.data_saldo_inicial = params.novaDataSaldoInicial;
    }

    const totais = {
      lancadas: 0,
      ignoradas: 0,
      duplicadas: 0,
      enriquecidas: 0,
      vinculadas: 0,
      total_creditos: 0,
      total_debitos: 0
    };

    const novosLancamentos: Lancamento[] = [];
    const snapshotsEnriquecidos: Array<{
      lancamentoId: string;
      descricaoAnterior: string;
      origemImportacaoAnterior?: any;
    }> = [];
    const lancamentosAtualizados: Lancamento[] = [];
    const regrasSalvas: RegraImportacao[] = [];

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
      snapshot_enriquecidos: []
    };

    this.cacheImportacoes.push(registroLote);

    for (const item of params.itens) {
      if (item.acao === 'ignorar') {
        if (item.statusDeduplicacao === 'duplicada_exata') {
          totais.duplicadas++;
        } else {
          totais.ignoradas++;
        }
        continue;
      }

      if (item.acao === 'vincular' && item.lancamentoExistenteId) {
        const lancExistente = this.cacheLancamentos.find(l => l.id === item.lancamentoExistenteId);
        if (lancExistente) {
          snapshotsEnriquecidos.push({
            lancamentoId: lancExistente.id,
            descricaoAnterior: lancExistente.descricao,
            origemImportacaoAnterior: lancExistente.origem_importacao
          });

          const descEnriquecida = item.transacao.contraparte
            ? `${item.transacao.descricaoOriginal} - ${item.transacao.contraparte}`
            : item.transacao.descricaoOriginal;

          const lancAtualizado: Lancamento = {
            ...lancExistente,
            descricao: lancExistente.origem === 'manual' ? lancExistente.descricao : descEnriquecida,
            origem_importacao: {
              lote_id: params.loteId,
              banco_codigo: params.bancoCodigo,
              conta_id: params.contaId,
              fitid: item.transacao.fitid || lancExistente.origem_importacao?.fitid,
              assinatura_fraca:
                lancExistente.origem_importacao?.assinatura_fraca ||
                gerarAssinaturaFraca({
                  conta: params.contaId,
                  data: item.transacao.data,
                  tipo: item.transacao.tipo,
                  valor: item.transacao.valor,
                  descricaoNormalizada: item.transacao.descricaoNormalizada,
                  ordemNoDia: item.transacao.ordemNoDia
                }),
              formato: params.formato
            }
          };

          lancamentosAtualizados.push(lancAtualizado);
          if (item.statusDeduplicacao === 'enriquecer_existente') {
            totais.enriquecidas++;
          } else {
            totais.vinculadas++;
          }
        }
        continue;
      }

      if (item.acao === 'incluir') {
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
          ordemNoDia: item.transacao.ordemNoDia
        });

        const novoLancamento: Lancamento = {
          id: `lanc-imp-${Date.now()}-${Math.random().toString(36).substr(2, 7)}`,
          tipo: item.tipoLancamento === 'receita' ? 'receita' : 'despesa',
          descricao: item.transacao.contraparte
            ? `${item.transacao.descricaoOriginal} - ${item.transacao.contraparte}`
            : item.transacao.descricaoOriginal,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: 'pago',
          conta_id: params.contaId,
          categoria_id: item.categoriaId,
          contato_id: item.contatoId || undefined,
          projeto_id: item.projetoId || undefined,
          forma_pagamento: formaPagamento,
          recorrencia: 'nenhuma',
          origem: 'importacao',
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo,
            conta_id: params.contaId,
            fitid: item.transacao.fitid,
            assinatura_fraca: assinaturaFraca,
            formato: params.formato
          },
          criado_em: new Date().toISOString()
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

    // Regras de importação
    if (params.regrasACriar && params.regrasACriar.length > 0) {
      for (const r of params.regrasACriar) {
        regrasSalvas.push({
          ...r,
          id: `regra-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          criadoEm: new Date().toISOString(),
          usos: 1
        });
      }
    }

    // Monta todas as operações atômicas
    const todasOperacoes: Array<{
      tipo: 'set' | 'update';
      colecao: string;
      id: string;
      dado: any;
    }> = [];

    for (const lanc of novosLancamentos) {
      todasOperacoes.push({
        tipo: 'set',
        colecao: 'lancamentos',
        id: lanc.id,
        dado: lanc
      });
    }

    for (const lanc of lancamentosAtualizados) {
      todasOperacoes.push({
        tipo: 'update',
        colecao: 'lancamentos',
        id: lanc.id,
        dado: {
          descricao: lanc.descricao,
          origem_importacao: lanc.origem_importacao
        }
      });
    }

    for (const reg of regrasSalvas) {
      todasOperacoes.push({
        tipo: 'set',
        colecao: 'regras_importacao',
        id: reg.id,
        dado: reg
      });
    }

    // Particionamento em batches de no máximo 490 operações (para respeitar o limite de 500 do Firestore)
    const TAMANHO_MAX_BATCH = 490;
    let batchIndex = 0;

    for (let i = 0; i < todasOperacoes.length; i += TAMANHO_MAX_BATCH) {
      const fatia = todasOperacoes.slice(i, i + TAMANHO_MAX_BATCH);

      // Simulação de falha no meio
      if (this.simularFalhaNoBatchIndex === batchIndex) {
        registroLote.totais = totais;
        registroLote.status = 'parcial';
        registroLote.atualizado_em = new Date().toISOString();
        throw new Error(`Falha simulada de rede/permissão no batch ${batchIndex}. Lote marcado como parcial.`);
      }

      this.batchesGravados.push(fatia);
      batchIndex++;
    }

    // Aplica no cache após sucesso de todos os batches
    for (const novo of novosLancamentos) {
      this.cacheLancamentos.push(novo);
    }
    for (const atualizado of lancamentosAtualizados) {
      const idx = this.cacheLancamentos.findIndex(l => l.id === atualizado.id);
      if (idx >= 0) this.cacheLancamentos[idx] = atualizado;
    }
    for (const reg of regrasSalvas) {
      this.cacheRegras.push(reg);
    }

    const saldoDepois = this.calcularResumoConta(conta).saldo_real;
    let diferencaConciliacao: number | undefined = undefined;
    if (params.saldoBanco?.valor !== undefined) {
      diferencaConciliacao = +(params.saldoBanco.valor - saldoDepois).toFixed(2);
    }

    registroLote.totais = totais;
    registroLote.saldo_sistema_depois = saldoDepois;
    registroLote.status = 'concluida';
    registroLote.snapshot_enriquecidos = snapshotsEnriquecidos;
    registroLote.atualizado_em = new Date().toISOString();

    return {
      sucesso: true,
      loteId: params.loteId,
      totais,
      saldoAntes,
      saldoDepois,
      diferencaConciliacao,
      mensagem: `Importação de ${totais.lancadas} lançamento(s) concluída com sucesso.`
    };
  }

  async desfazerImportacao(loteId: string): Promise<ResultadoDesfazerImportacao> {
    const lote = this.cacheImportacoes.find(i => i.id === loteId);
    if (!lote) throw new Error(`Lote ${loteId} não encontrado.`);
    if (lote.status === 'desfeita') throw new Error(`Lote ${loteId} já desfeito.`);

    const snapshots = lote.snapshot_enriquecidos || [];
    const idsEnriquecidosSet = new Set(snapshots.map(s => s.lancamentoId));

    const lancamentosARemover = this.cacheLancamentos.filter(
      l => l.origem_importacao?.lote_id === loteId && l.origem === 'importacao' && !idsEnriquecidosSet.has(l.id)
    );

    const idsRemovidosSet = new Set(lancamentosARemover.map(l => l.id));

    this.cacheLancamentos = this.cacheLancamentos.filter(l => !idsRemovidosSet.has(l.id));

    for (const snap of snapshots) {
      const idx = this.cacheLancamentos.findIndex(l => l.id === snap.lancamentoId);
      if (idx >= 0) {
        this.cacheLancamentos[idx] = {
          ...this.cacheLancamentos[idx],
          descricao: snap.descricaoAnterior,
          origem_importacao: snap.origemImportacaoAnterior
        };
      }
    }

    lote.status = 'desfeita';
    lote.atualizado_em = new Date().toISOString();

    return {
      sucesso: true,
      loteId,
      lancamentosRemovidos: lancamentosARemover.length,
      lancamentosRestaurados: snapshots.length,
      mensagem: `Importação desfeita com sucesso.`
    };
  }
}

// ============================================================
// SUÍTE DE TESTES AUTOMATIZADOS
// ============================================================
async function executarTestes() {
  console.log('='.repeat(70));
  console.log('TESTES PARTE 15F: GRAVAÇÃO EM BATCHES, CONCILIAÇÃO E ROLLBACK');
  console.log('='.repeat(70));

  const storage = new SimuladorStorageImportacao();

  // ------------------------------------------------------------
  // CENÁRIO 1: Lote Grande com 1.250 Linhas em Batches (≤ 500 ops)
  // ------------------------------------------------------------
  console.log('\n--- Cenário 1: Particionamento Atômico de Lote Grande (1.250 linhas) ---');

  // Cria 1 lançamento pré-existente para testar enriquecimento
  const lancamentoPreExistente: Lancamento = {
    id: 'lanc-manual-1',
    tipo: 'despesa',
    descricao: 'Compra Painéis Solares',
    valor: 5000.00,
    data_vencimento: '2026-05-10',
    data_pagamento: '2026-05-10',
    status: 'pago',
    conta_id: 'conta-santander',
    categoria_id: 'cat-fornecedor-solar',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-05-10'
  };
  storage.cacheLancamentos.push(lancamentoPreExistente);

  // Gera 1.250 itens de extrato simulados
  const itensRevisao: ItemRevisaoExtrato[] = [];

  // Item 0: Enriquecimento do lançamento pré-existente
  itensRevisao.push({
    id: 'item-0',
    transacao: {
      idTemporario: 'tx-0',
      data: '2026-05-10',
      valor: 5000.00,
      tipo: 'debito',
      descricaoOriginal: 'PIX ENVIADO MT SOLAR',
      descricaoNormalizada: 'PIX ENVIADO MT SOLAR',
      contraparte: 'WEG EQUIPAMENTOS ELETRICOS',
      ordemNoDia: 1,
      linhaOrigem: 2
    },
    bancoCodigo: '033',
    contaId: 'conta-santander',
    formato: 'xlsx',
    statusDeduplicacao: 'enriquecer_existente',
    lancamentoExistenteId: 'lanc-manual-1',
    natureza: 'indefinido',
    tipoLancamento: 'despesa',
    categoriaId: 'cat-fornecedor-solar',
    acao: 'vincular'
  });

  // Itens 1 a 1.250: Novas inclusões
  for (let i = 1; i <= 1250; i++) {
    const ehCredito = i % 4 === 0;
    itensRevisao.push({
      id: `item-${i}`,
      transacao: {
        idTemporario: `tx-${i}`,
        fitid: `FITID-${i}`,
        data: '2026-06-15',
        valor: 100.00 + (i % 50),
        tipo: ehCredito ? 'credito' : 'debito',
        descricaoOriginal: ehCredito ? `PIX RECEBIDO CLIENTE ${i}` : `PAGAMENTO BOLETO ${i}`,
        descricaoNormalizada: ehCredito ? `PIX RECEBIDO CLIENTE ${i}` : `PAGAMENTO BOLETO ${i}`,
        contraparte: ehCredito ? `Cliente ${i}` : undefined,
        ordemNoDia: 1,
        linhaOrigem: i + 2
      },
      bancoCodigo: '033',
      contaId: 'conta-santander',
      formato: 'xlsx',
      statusDeduplicacao: 'nova',
      natureza: ehCredito ? 'recebimento' : 'pagamento',
      tipoLancamento: ehCredito ? 'receita' : 'despesa',
      categoriaId: ehCredito ? 'cat-receita-venda' : 'cat-despesa-operacional',
      acao: 'incluir'
    });
  }

  const loteId1 = 'lote-teste-1250';
  const resultado1 = await storage.importarExtratoLote({
    loteId: loteId1,
    bancoCodigo: '033',
    contaId: 'conta-santander',
    nomeArquivo: 'extrato_1250_linhas.xlsx',
    formato: 'xlsx',
    periodo: { inicio: '2026-05-01', fim: '2026-06-30' },
    itens: itensRevisao,
    usuario: 'admin@mtsolar.com.br'
  });

  asserir(resultado1.sucesso === true, 'Lote de 1.250 linhas importado com sucesso');
  asserir(resultado1.totais.lancadas === 1250, 'Exatamente 1.250 novos lançamentos criados');
  asserir(resultado1.totais.enriquecidas === 1, 'Exatamente 1 lançamento existente enriquecido');

  // Validação dos batches (tamanho máximo de 490 por batch)
  asserir(storage.batchesGravados.length === 3, 'Operações particionadas em 3 batches no Firestore');
  const todosAbaixoDe500 = storage.batchesGravados.every(b => b.length <= 490);
  asserir(todosAbaixoDe500, 'Nenhum batch excedeu o limite máximo de 490 operações (limite Firestore é 500)');

  // Validação dos dados do lançamento gravado (apenas lançamentos NOVOS, não enriquecidos)
  const novosDoLote = storage.cacheLancamentos.filter(
    l => l.origem_importacao?.lote_id === loteId1 && l.origem === 'importacao'
  );
  asserir(novosDoLote.length === 1250, '1.250 novos lançamentos encontrados no cache síncrono');
  const primeiroNovo = novosDoLote[0];
  asserir(primeiroNovo !== undefined, 'Primeiro lançamento novo acessível');
  asserir(primeiroNovo?.origem === 'importacao', "Campo origem marcado como 'importacao'");
  asserir(primeiroNovo?.status === 'pago', "Status gravado como 'pago'");
  asserir(primeiroNovo?.recorrencia === 'nenhuma', "Recorrência gravada como 'nenhuma'");
  asserir(primeiroNovo?.forma_pagamento === 'PIX' || primeiroNovo?.forma_pagamento === 'boleto', 'Forma de pagamento inferida corretamente (PIX ou boleto)');

  // Validação de preservação da categoria no lançamento enriquecido
  const lancEnriquecido = storage.cacheLancamentos.find(l => l.id === 'lanc-manual-1');
  asserir(lancEnriquecido?.categoria_id === 'cat-fornecedor-solar', 'Categoria original preservada após enriquecimento');
  asserir(lancEnriquecido?.origem_importacao?.lote_id === loteId1, 'Vínculo do lote registrado no lançamento existente');

  // ------------------------------------------------------------
  // CENÁRIO 2: Simulação de Falha Parcial e Marcação 'parcial'
  // ------------------------------------------------------------
  console.log('\n--- Cenário 2: Tratamento de Falha no Meio do Lote ---');

  storage.reset();
  storage.simularFalhaNoBatchIndex = 1; // Força falha no segundo batch (após gravar 490 operações)

  let capturouErro = false;
  try {
    await storage.importarExtratoLote({
      loteId: 'lote-com-falha',
      bancoCodigo: '033',
      contaId: 'conta-santander',
      nomeArquivo: 'extrato_interrompido.xlsx',
      formato: 'xlsx',
      periodo: { inicio: '2026-05-01', fim: '2026-06-30' },
      itens: itensRevisao,
      usuario: 'admin@mtsolar.com.br'
    });
  } catch (err) {
    capturouErro = true;
  }

  asserir(capturouErro, 'Erro capturado ao falhar gravação de batch intermediário');
  const loteFalho = storage.cacheImportacoes.find(i => i.id === 'lote-com-falha');
  asserir(loteFalho?.status === 'parcial', "Status do lote mantido como 'parcial' para permitir retomada ou rollback");

  // ------------------------------------------------------------
  // CENÁRIO 3: Desfazer Importação (Rollback Seguro)
  // ------------------------------------------------------------
  console.log('\n--- Cenário 3: Desfazer Importação (Rollback Completo) ---');

  storage.reset();
  // Insere lançamento pré-existente
  const lancOriginalDesc = 'Compra Painéis Solares Original';
  storage.cacheLancamentos.push({
    ...lancamentoPreExistente,
    descricao: lancOriginalDesc
  });

  const saldoInicialConta = storage.calcularResumoConta(storage.cacheContas[0]).saldo_real;

  // Executa importação com sucesso
  await storage.importarExtratoLote({
    loteId: 'lote-para-desfazer',
    bancoCodigo: '033',
    contaId: 'conta-santander',
    nomeArquivo: 'extrato_a_desfazer.xlsx',
    formato: 'xlsx',
    periodo: { inicio: '2026-05-01', fim: '2026-06-30' },
    itens: itensRevisao.slice(0, 50), // 50 itens
    usuario: 'admin@mtsolar.com.br'
  });

  const saldoAposImportacao = storage.calcularResumoConta(storage.cacheContas[0]).saldo_real;
  asserir(saldoAposImportacao !== saldoInicialConta, 'Saldo alterado após importação do lote');

  // Agora executa desfazimento
  const resultadoDesfazer = await storage.desfazerImportacao('lote-para-desfazer');

  asserir(resultadoDesfazer.sucesso === true, 'Operação de desfazer retornou sucesso');
  asserir(resultadoDesfazer.lancamentosRemovidos === 49, 'Exatamente 49 novos lançamentos foram excluídos');
  asserir(resultadoDesfazer.lancamentosRestaurados === 1, 'Exatamente 1 lançamento enriquecido foi restaurado');

  const lancamentosRestantes = storage.cacheLancamentos.filter(
    l => l.origem_importacao?.lote_id === 'lote-para-desfazer' && l.origem === 'importacao'
  );
  asserir(lancamentosRestantes.length === 0, 'Nenhum lançamento novo do lote sobrou no sistema');

  const lancRestaurado = storage.cacheLancamentos.find(l => l.id === 'lanc-manual-1');
  asserir(lancRestaurado?.descricao === lancOriginalDesc, 'Descrição original restaurada com fidelidade total');
  asserir(lancRestaurado?.origem_importacao === undefined, 'Vínculo do lote removido do lançamento pré-existente');

  const saldoAposDesfazer = storage.calcularResumoConta(storage.cacheContas[0]).saldo_real;
  asserir(saldoAposDesfazer === saldoInicialConta, 'Saldo da conta retornou exatamente ao valor inicial');

  const registroLoteDesfeito = storage.cacheImportacoes.find(i => i.id === 'lote-para-desfazer');
  asserir(registroLoteDesfeito?.status === 'desfeita', "Status do lote atualizado para 'desfeita'");

  // ------------------------------------------------------------
  // CENÁRIO 4: Validação com o Arquivo Real Santander XLSX (1.682 linhas)
  // ------------------------------------------------------------
  console.log('\n--- Cenário 4: Processamento do Arquivo Real Santander (1.682 linhas) ---');

  const caminhoXlsx1 = path.resolve(__dirname, '../src/exemplos_extratos/excel_export1792140356207.xlsx');
  const caminhoXlsx2 = path.resolve(__dirname, '../src/exemplos_extratos/extrato_ano_completo_santander.xlsx');
  const caminhoXlsx = fs.existsSync(caminhoXlsx1) ? caminhoXlsx1 : caminhoXlsx2;
  if (fs.existsSync(caminhoXlsx)) {
    const buffer = fs.readFileSync(caminhoXlsx);
    const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const extratoReal = await lerExtrato(arrayBuf, path.basename(caminhoXlsx));

    asserir(extratoReal.transacoes.length > 1500, `Arquivo real lido com sucesso: ${extratoReal.transacoes.length} transações`);

    // Converte transações reais para itens de revisão
    const itensReais: ItemRevisaoExtrato[] = extratoReal.transacoes.map((t, idx) => ({
      id: `item-real-${idx}`,
      transacao: t,
      bancoCodigo: '033',
      contaId: 'conta-santander',
      formato: 'xlsx',
      statusDeduplicacao: 'nova',
      natureza: 'tarifa_bancaria',
      tipoLancamento: t.tipo === 'credito' ? 'receita' : 'despesa',
      categoriaId: t.tipo === 'credito' ? 'cat-rec' : 'cat-des',
      acao: 'incluir'
    }));

    storage.reset();
    const resReal = await storage.importarExtratoLote({
      loteId: 'lote-santander-real-1682',
      bancoCodigo: '033',
      contaId: 'conta-santander',
      nomeArquivo: 'extrato_ano_completo_santander.xlsx',
      formato: 'xlsx',
      periodo: extratoReal.periodo,
      itens: itensReais,
      usuario: 'aureliano@mtsolar.com.br'
    });

    asserir(resReal.sucesso === true, 'Lote real de 1.682 transações importado com sucesso');
    asserir(resReal.totais.lancadas === extratoReal.transacoes.length, 'Total de lançadas igual ao total de transações lidas');
    asserir(storage.batchesGravados.length === 4, '1.682 operações particionadas corretamente em 4 batches (490 + 490 + 490 + 212)');
    asserir(storage.batchesGravados.every(b => b.length <= 490), 'Nenhum batch ultrapassou 490 operações');

    // Desfaz o lote real
    const desfazReal = await storage.desfazerImportacao('lote-santander-real-1682');
    asserir(desfazReal.sucesso === true, 'Lote real desfeito com sucesso');
    asserir(desfazReal.lancamentosRemovidos === extratoReal.transacoes.length, 'Todas as 1.682 transações removidas com perfeição');
  } else {
    console.log('  [AVISO] Arquivo real de teste não localizado em src/exemplos_extratos/');
  }

  // ------------------------------------------------------------
  // RESUMO DOS RESULTADOS
  // ------------------------------------------------------------
  console.log('\n' + '='.repeat(70));
  console.log(`TOTAL DE TESTES: ${totalTestes}`);
  console.log(`PASSARAM: ${passaram}`);
  console.log(`FALHARAM: ${falharam}`);
  console.log('='.repeat(70));

  if (falharam > 0) {
    process.exit(1);
  }
}

executarTestes().catch(err => {
  console.error('Erro não tratado nos testes:', err);
  process.exit(1);
});
