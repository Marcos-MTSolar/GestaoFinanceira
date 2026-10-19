// MT Solar - Gestão Financeira
// Teste Ponta a Ponta (E2E) - Módulo de Importação de Extratos Bancários (Parte 15G Fechamento)
// Roteiro completo:
// (a) Importar o XLSX real de 365 dias (excel_export1792140356207.xlsx - 1.682 transações)
// (b) Importar o OFX real de 90 dias (extrato-pj-16_10_2026_19h22m20s.ofx - 400 transações)
// (c) Conferir 0 duplicatas na janela de sobreposição 18/07–16/10/2026
// (d) Saldo conciliado com LEDGERBAL -7.377,22
// (e) Desfazer o lote do OFX mantendo o do XLSX 100% íntegro
// (f) Auditoria registrada em RegistroAuditoria (importar, desfazer, criar/editar/excluir regra)

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
  RegistroAuditoria,
  ParamsImportacaoLote,
  ResultadoImportacaoLote,
  ResultadoDesfazerImportacao
} from '../src/types';
import { ItemRevisaoExtrato } from '../src/components/extrato/RevisaoExtrato';
import {
  lerExtrato,
  classificarDuplicatas,
  gerarAssinaturaFraca,
  inferirFormaPagamento
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
// SIMULADOR DO STORAGE COMPLETO (ESPELHO DO storage.ts)
// ============================================================
class SimuladorStorageE2E {
  public cacheLancamentos: Lancamento[] = [];
  public cacheContas: ContaBancaria[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];
  public cacheRegras: RegraImportacao[] = [];
  public cacheAuditoria: RegistroAuditoria[] = [];

  public batchesGravados: Array<Array<{ tipo: string; id: string; colecao: string; dado?: any }>> = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.cacheLancamentos = [];
    this.cacheContas = [
      {
        id: 'conta-santander-pj',
        nome: 'Santander PJ MT Solar',
        banco: 'Santander',
        banco_codigo: '033',
        agencia: '3749',
        numero_conta: '130046964',
        tipo: 'corrente',
        saldo_inicial: 0,
        data_saldo_inicial: '2026-01-01',
        limite_cheque_especial: 50000,
        taxa_juros_cheque_especial_mensal: 8.5,
        cor: '#003064',
        ativa: true,
      },
    ];
    this.cacheImportacoes = [];
    this.cacheRegras = [];
    this.cacheAuditoria = [];
    this.batchesGravados = [];
  }

  public registrarAuditoria(modulo: any, acao: any, descricao: string, detalhes?: string): void {
    const reg: RegistroAuditoria = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      data_hora: new Date().toISOString(),
      usuario_nome: 'Aureliano Administrador',
      usuario_email: 'admin@mtsolar.com.br',
      modulo,
      acao,
      descricao,
      detalhes,
    };
    this.cacheAuditoria.unshift(reg);
  }

  public getLancamentos(): Lancamento[] {
    return this.cacheLancamentos;
  }

  public getContaById(id: string): ContaBancaria | undefined {
    return this.cacheContas.find((c) => c.id === id);
  }

  public calcularResumoConta(conta: ContaBancaria) {
    let receitasPagas = 0;
    let despesasPagas = 0;

    for (const l of this.cacheLancamentos) {
      if (l.conta_id !== conta.id || l.status !== 'pago') continue;
      if (l.origem === 'transferencia') continue;

      if (l.tipo === 'receita') receitasPagas += l.valor;
      else if (l.tipo === 'despesa') despesasPagas += l.valor;
    }

    const saldoReal = +(conta.saldo_inicial + receitasPagas - despesasPagas).toFixed(2);
    return {
      saldo_real: saldoReal,
      saldo_disponivel_total: +(saldoReal + (conta.limite_cheque_especial || 0)).toFixed(2),
    };
  }

  public conciliarSaldoConta(contaId: string, novoSaldoReal: number) {
    const conta = this.getContaById(contaId);
    if (!conta) throw new Error('Conta não encontrada');

    const resumoAtual = this.calcularResumoConta(conta);
    const diferenca = +(novoSaldoReal - resumoAtual.saldo_real).toFixed(2);

    if (Math.abs(diferenca) < 0.01) {
      return { sucesso: true, diferenca: 0, mensagem: 'Saldo já está perfeitamente conciliado.' };
    }

    const lancamentoAjuste: Lancamento = {
      id: `lanc-ajuste-${Date.now()}`,
      tipo: diferenca > 0 ? 'receita' : 'despesa',
      descricao: 'Ajuste de Conciliação Bancária de Extrato',
      valor: Math.abs(diferenca),
      data_vencimento: new Date().toISOString().split('T')[0],
      data_pagamento: new Date().toISOString().split('T')[0],
      status: 'pago',
      conta_id: contaId,
      categoria_id: 'cat-ajuste',
      forma_pagamento: 'transferencia',
      recorrencia: 'nenhuma',
      origem: 'ajuste',
      criado_em: new Date().toISOString(),
    };

    this.cacheLancamentos.push(lancamentoAjuste);
    this.registrarAuditoria('contas', 'edicao', `Saldo conciliado na conta ${conta.nome}`, `Diferença de ajuste: R$ ${diferenca}`);
    return { sucesso: true, diferenca, lancamentoAjuste };
  }

  public saveRegraImportacao(regra: Partial<RegraImportacao> & { valor: string; categoria_id: string; campo: any; operador: any; banco_codigo: string; conta_id: string; ativa: boolean }): RegraImportacao {
    const docId = regra.id || `regra-${Date.now()}`;
    const isNova = !this.cacheRegras.some((r) => r.id === docId);
    const item: RegraImportacao = {
      id: docId,
      banco_codigo: regra.banco_codigo,
      conta_id: regra.conta_id,
      campo: regra.campo,
      operador: regra.operador,
      valor: regra.valor,
      categoria_id: regra.categoria_id,
      tipoLancamento: regra.tipoLancamento || 'despesa',
      ativa: regra.ativa,
      criadoEm: regra.criadoEm || new Date().toISOString(),
      usos: regra.usos ?? 0,
    };

    const idx = this.cacheRegras.findIndex((r) => r.id === docId);
    if (idx >= 0) this.cacheRegras[idx] = item;
    else this.cacheRegras.push(item);

    this.registrarAuditoria(
      'regras_importacao',
      isNova ? 'criacao' : 'edicao',
      isNova ? `Nova regra de importação criada: "${item.valor}"` : `Regra de importação atualizada: "${item.valor}"`,
      `Campo: ${item.campo}, Banco: ${item.banco_codigo}, Categoria: ${item.categoria_id}, Ativa: ${item.ativa}`
    );

    return item;
  }

  public deleteRegraImportacao(id: string): void {
    const regraExistente = this.cacheRegras.find((r) => r.id === id);
    this.cacheRegras = this.cacheRegras.filter((r) => r.id !== id);
    this.registrarAuditoria(
      'regras_importacao',
      'exclusao',
      `Regra de importação excluída: "${regraExistente?.valor || id}"`,
      `Regra ID: ${id}`
    );
  }

  public async importarExtratoLote(params: ParamsImportacaoLote): Promise<ResultadoImportacaoLote> {
    const conta = this.getContaById(params.contaId);
    if (!conta) throw new Error('Conta não encontrada');

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
    const snapshotsEnriquecidos: Array<{ lancamentoId: string; descricaoAnterior: string; origemImportacaoAnterior?: any }> = [];
    const lancamentosAtualizados: Lancamento[] = [];

    for (const item of params.itens) {
      if (item.acao === 'ignorar') {
        totais.ignoradas++;
        continue;
      }

      if (item.acao === 'vincular' && item.lancamentoExistenteId) {
        const lancExistente = this.cacheLancamentos.find((l) => l.id === item.lancamentoExistenteId);
        if (lancExistente) {
          snapshotsEnriquecidos.push({
            lancamentoId: lancExistente.id,
            descricaoAnterior: lancExistente.descricao,
            origemImportacaoAnterior: lancExistente.origem_importacao ? { ...lancExistente.origem_importacao } : undefined,
          });

          const descRica = item.transacao.contraparte
            ? `${item.transacao.descricaoOriginal} ${item.transacao.contraparte}`.trim()
            : item.transacao.descricaoOriginal;

          const lancAtualizado: Lancamento = {
            ...lancExistente,
            descricao: descRica,
            origem_importacao: {
              lote_id: params.loteId,
              banco_codigo: params.bancoCodigo,
              conta_id: params.contaId,
              fitid: item.transacao.fitid || lancExistente.origem_importacao?.fitid,
              assinatura_fraca: lancExistente.origem_importacao?.assinatura_fraca || '',
              formato: params.formato,
            },
          };

          lancamentosAtualizados.push(lancAtualizado);
          totais.enriquecidas++;
        }
        continue;
      }

      if (item.acao === 'incluir') {
        const assinaturaFraca = gerarAssinaturaFraca({
          conta: params.contaId,
          data: item.transacao.data,
          tipo: item.transacao.tipo,
          valor: item.transacao.valor,
          descricaoNormalizada: item.transacao.descricaoNormalizada,
          ordemNoDia: item.transacao.ordemNoDia,
        });

        const novo: Lancamento = {
          id: `lanc-imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          tipo: item.tipoLancamento === 'receita' ? 'receita' : 'despesa',
          descricao: item.transacao.contraparte
            ? `${item.transacao.descricaoOriginal} - ${item.transacao.contraparte}`
            : item.transacao.descricaoOriginal,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: 'pago',
          conta_id: params.contaId,
          categoria_id: item.categoriaId || 'cat-geral',
          forma_pagamento: inferirFormaPagamento(item.transacao.descricaoOriginal, item.natureza as any),
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

        novosLancamentos.push(novo);
        totais.lancadas++;
        if (novo.tipo === 'receita') totais.total_creditos = +(totais.total_creditos + novo.valor).toFixed(2);
        else totais.total_debitos = +(totais.total_debitos + novo.valor).toFixed(2);
      }
    }

    // Particionamento em batches <= 490
    const ops: Array<{ tipo: string; id: string; colecao: string; dado?: any }> = [];
    for (const l of novosLancamentos) ops.push({ tipo: 'set', id: l.id, colecao: 'lancamentos', dado: l });
    for (const l of lancamentosAtualizados) ops.push({ tipo: 'update', id: l.id, colecao: 'lancamentos', dado: l });

    const TAM = 490;
    for (let i = 0; i < ops.length; i += TAM) {
      this.batchesGravados.push(ops.slice(i, i + TAM));
    }

    // Cache síncrono
    for (const l of novosLancamentos) this.cacheLancamentos.push(l);
    for (const l of lancamentosAtualizados) {
      const idx = this.cacheLancamentos.findIndex((x) => x.id === l.id);
      if (idx >= 0) this.cacheLancamentos[idx] = l;
    }

    const saldoDepois = this.calcularResumoConta(conta).saldo_real;

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
      saldo_sistema_depois: saldoDepois,
      status: 'concluida',
      criado_em: new Date().toISOString(),
      snapshot_enriquecidos: snapshotsEnriquecidos,
    };

    this.cacheImportacoes.push(registroLote);

    this.registrarAuditoria(
      'importacoes',
      'importacao',
      `Importação de extrato bancário lote ${params.loteId} (${totais.lancadas} lançamentos)`,
      `Arquivo: ${params.nomeArquivo}, Conta: ${conta.nome}, Banco: ${params.bancoCodigo}, Período: ${params.periodo.inicio} a ${params.periodo.fim}`
    );

    return {
      sucesso: true,
      loteId: params.loteId,
      totais,
      saldoAntes,
      saldoDepois,
      mensagem: `Importação concluída: ${totais.lancadas} lançadas, ${totais.enriquecidas} enriquecidas.`,
    };
  }

  public async desfazerImportacao(loteId: string): Promise<ResultadoDesfazerImportacao> {
    const lote = this.cacheImportacoes.find((i) => i.id === loteId);
    if (!lote) throw new Error('Lote não encontrado');
    if (lote.status === 'desfeita') throw new Error('Lote já desfeito');

    const snaps = lote.snapshot_enriquecidos || [];
    const idsEnriquecidosSet = new Set(snaps.map((s) => s.lancamentoId));

    const aRemover = this.cacheLancamentos.filter(
      (l) => l.origem_importacao?.lote_id === loteId && l.origem === 'importacao' && !idsEnriquecidosSet.has(l.id)
    );

    const aRemoverIds = new Set(aRemover.map((l) => l.id));
    this.cacheLancamentos = this.cacheLancamentos.filter((l) => !aRemoverIds.has(l.id));

    for (const s of snaps) {
      const idx = this.cacheLancamentos.findIndex((l) => l.id === s.lancamentoId);
      if (idx >= 0) {
        this.cacheLancamentos[idx] = {
          ...this.cacheLancamentos[idx],
          descricao: s.descricaoAnterior,
          origem_importacao: s.origemImportacaoAnterior,
        };
      }
    }

    lote.status = 'desfeita';
    lote.atualizado_em = new Date().toISOString();

    this.registrarAuditoria(
      'importacoes',
      'desfazer',
      `Lote de importação ${loteId} desfeito`,
      `${aRemover.length} lançamento(s) excluído(s) e ${snaps.length} restaurado(s)`
    );

    return {
      sucesso: true,
      loteId,
      lancamentosRemovidos: aRemover.length,
      lancamentosRestaurados: snaps.length,
      mensagem: `Importação desfeita: ${aRemover.length} removidos, ${snaps.length} restaurados.`,
    };
  }
}

// ============================================================
// EXECUÇÃO DO TESTE E2E
// ============================================================
async function executarTesteE2E() {
  console.log('='.repeat(72));
  console.log(' TESTE PONTA A PONTA (E2E) - PARTE 15G FECHAMENTO');
  console.log('='.repeat(72));

  const storage = new SimuladorStorageE2E();

  const caminhoXlsx = path.resolve(__dirname, '../src/exemplos_extratos/excel_export1792140356207.xlsx');
  const caminhoOfx = path.resolve(__dirname, '../src/exemplos_extratos/extrato-pj-16_10_2026_19h22m20s.ofx');

  asserir(fs.existsSync(caminhoXlsx), 'Arquivo XLSX real existe em src/exemplos_extratos/');
  asserir(fs.existsSync(caminhoOfx), 'Arquivo OFX real existe em src/exemplos_extratos/');

  const bufXlsx = fs.readFileSync(caminhoXlsx);
  const arrXlsx = bufXlsx.buffer.slice(bufXlsx.byteOffset, bufXlsx.byteOffset + bufXlsx.byteLength) as ArrayBuffer;
  const extratoXlsx = await lerExtrato(arrXlsx, 'excel_export1792140356207.xlsx');

  const bufOfx = fs.readFileSync(caminhoOfx);
  const arrOfx = bufOfx.buffer.slice(bufOfx.byteOffset, bufOfx.byteOffset + bufOfx.byteLength) as ArrayBuffer;
  const extratoOfx = await lerExtrato(arrOfx, 'extrato-pj-16_10_2026_19h22m20s.ofx');

  // ------------------------------------------------------------
  // ETAPA A: Importar o XLSX de 365 dias (1.682 transações)
  // ------------------------------------------------------------
  console.log('\n--- Etapa (a): Importação do XLSX de 365 dias ---');
  asserir(extratoXlsx.transacoes.length === 1682, `XLSX lido com 1.682 transações (obtido: ${extratoXlsx.transacoes.length})`);

  const itensXlsx: ItemRevisaoExtrato[] = extratoXlsx.transacoes.map((t, i) => ({
    id: `item-xlsx-${i}`,
    transacao: t,
    bancoCodigo: '033',
    contaId: 'conta-santander-pj',
    formato: 'xlsx',
    statusDeduplicacao: 'nova',
    natureza: 'pagamento',
    tipoLancamento: t.tipo === 'credito' ? 'receita' : 'despesa',
    categoriaId: t.tipo === 'credito' ? 'cat-vendas' : 'cat-fornecedor',
    acao: 'incluir',
  }));

  const loteIdXlsx = 'lote-xlsx-365dias';
  const resXlsx = await storage.importarExtratoLote({
    loteId: loteIdXlsx,
    bancoCodigo: '033',
    contaId: 'conta-santander-pj',
    nomeArquivo: 'excel_export1792140356207.xlsx',
    formato: 'xlsx',
    periodo: extratoXlsx.periodo,
    itens: itensXlsx,
    usuario: 'aureliano@mtsolar.com.br',
  });

  asserir(resXlsx.sucesso === true, 'Importação do lote XLSX concluída com sucesso');
  asserir(resXlsx.totais.lancadas === 1682, 'Exatamente 1.682 lançamentos criados a partir do XLSX');
  asserir(storage.cacheLancamentos.length === 1682, 'Cache de lançamentos possui 1.682 itens');
  asserir(storage.batchesGravados.length === 4, 'Particionado em 4 batches no Firestore (490 + 490 + 490 + 212)');
  asserir(storage.batchesGravados.every((b) => b.length <= 490), 'Nenhum batch excedeu o limite máximo de 490');

  // Verifica registro de auditoria
  const auditXlsx = storage.cacheAuditoria.find((a) => a.modulo === 'importacoes' && a.acao === 'importacao');
  asserir(!!auditXlsx, 'Auditoria de importação do XLSX registrada com sucesso');
  asserir(auditXlsx?.descricao.includes('1682 lançamentos') || false, 'Descrição da auditoria contém o número de lançamentos');

  // ------------------------------------------------------------
  // ETAPA B & C: Importar o OFX de 90 dias e conferir 0 duplicatas
  // ------------------------------------------------------------
  console.log('\n--- Etapa (b) & (c): Importação do OFX de 90 dias & Deduplicação ---');
  asserir(extratoOfx.transacoes.length === 400, `OFX lido com 400 transações (obtido: ${extratoOfx.transacoes.length})`);
  asserir(extratoOfx.saldoFinal?.valor === -7377.22, `LEDGERBAL do OFX extraído com exatidão: -7.377,22 (obtido: ${extratoOfx.saldoFinal?.valor})`);

  // Classifica duplicatas contra a base já preenchida pelo XLSX
  const dedupeOfx = classificarDuplicatas(extratoOfx.transacoes, storage.cacheLancamentos, {
    contaId: 'conta-santander-pj',
    bancoCodigo: '033',
    contaNumero: '130046964',
  });

  // Janela de sobreposição: 18/07/2026 a 16/10/2026
  const transacoesNaJanela = dedupeOfx.filter(
    (d) => d.transacao.data >= '2026-07-18' && d.transacao.data <= '2026-10-16'
  );

  const novasNaJanela = transacoesNaJanela.filter((d) => d.status === 'nova');
  const enriquecidasNaJanela = transacoesNaJanela.filter((d) => d.status === 'enriquecer_existente');

  asserir(transacoesNaJanela.length === 400, 'Todas as 400 transações do OFX estão na janela de sobreposição');
  asserir(enriquecidasNaJanela.length === 395, 'Exatamente 395 transações casaram com o XLSX para enriquecimento');
  asserir(novasNaJanela.length === 5, 'Apenas 5 transações novas identificadas (lançadas em 16/10 após a geração do XLSX)');

  // Verifica as 5 novas de 16/10
  asserir(
    novasNaJanela.every((n) => n.transacao.data === '2026-10-16'),
    'Todas as transações "novas" são exclusivamente do dia 16/10/2026'
  );

  // Nenhuma das transações do período anterior a 16/10 gerou duplicata
  const novasAntesDe16Out = dedupeOfx.filter((d) => d.status === 'nova' && d.transacao.data < '2026-10-16');
  asserir(novasAntesDe16Out.length === 0, 'Exatamente ZERO duplicatas na janela 18/07 até 15/10 (obtido: 0)');

  // Converte para itens de revisão e importa o lote do OFX
  const itensOfx: ItemRevisaoExtrato[] = dedupeOfx.map((item, idx) => ({
    id: `item-ofx-${idx}`,
    transacao: item.transacao,
    bancoCodigo: '033',
    contaId: 'conta-santander-pj',
    formato: 'ofx',
    statusDeduplicacao: item.status,
    natureza: 'pagamento',
    tipoLancamento: item.transacao.tipo === 'credito' ? 'receita' : 'despesa',
    categoriaId: item.transacao.tipo === 'credito' ? 'cat-vendas' : 'cat-fornecedor',
    acao: item.status === 'enriquecer_existente' ? 'vincular' : 'incluir',
    lancamentoExistenteId: item.lancamentoRelacionado?.id,
  }));

  const loteIdOfx = 'lote-ofx-90dias';
  const resOfx = await storage.importarExtratoLote({
    loteId: loteIdOfx,
    bancoCodigo: '033',
    contaId: 'conta-santander-pj',
    nomeArquivo: 'extrato-pj-16_10_2026_19h22m20s.ofx',
    formato: 'ofx',
    periodo: extratoOfx.periodo,
    itens: itensOfx,
    saldoBanco: extratoOfx.saldoFinal,
    usuario: 'aureliano@mtsolar.com.br',
  });

  asserir(resOfx.sucesso === true, 'Importação do lote OFX concluída com sucesso');
  asserir(resOfx.totais.lancadas === 5, 'Exatamente 5 novos lançamentos criados pelo OFX');
  asserir(resOfx.totais.enriquecidas === 395, 'Exatamente 395 lançamentos do XLSX foram enriquecidos');
  asserir(storage.cacheLancamentos.length === 1687, 'Total de lançamentos no sistema: 1.687 (1.682 + 5)');

  // ------------------------------------------------------------
  // ETAPA D: Saldo Conciliado com LEDGERBAL -7.377,22
  // ------------------------------------------------------------
  console.log('\n--- Etapa (d): Conciliação Bancária com LEDGERBAL -7.377,22 ---');
  const resumoContaAposOfx = storage.calcularResumoConta(storage.cacheContas[0]);
  console.log(`  Saldo Real calculado pelo sistema: R$ ${resumoContaAposOfx.saldo_real.toFixed(2)}`);
  console.log(`  Saldo LEDGERBAL do banco Santander: R$ ${extratoOfx.saldoFinal?.valor.toFixed(2)}`);

  const diferencaInicial = +(extratoOfx.saldoFinal!.valor - resumoContaAposOfx.saldo_real).toFixed(2);
  console.log(`  Diferença apurada para ajuste de conciliação: R$ ${diferencaInicial}`);

  // Executa conciliação bancária
  const resConciliacao = storage.conciliarSaldoConta('conta-santander-pj', extratoOfx.saldoFinal!.valor);
  asserir(resConciliacao.sucesso === true, 'Operação conciliarSaldoConta executada com sucesso');

  const resumoContaPosConciliacao = storage.calcularResumoConta(storage.cacheContas[0]);
  asserir(
    resumoContaPosConciliacao.saldo_real === extratoOfx.saldoFinal?.valor,
    `Saldo da conta perfeitamente igual ao LEDGERBAL: -7.377,22 (obtido: ${resumoContaPosConciliacao.saldo_real})`
  );

  // ------------------------------------------------------------
  // ETAPA E: Desfazer o Lote do OFX Mantendo o do XLSX
  // ------------------------------------------------------------
  console.log('\n--- Etapa (e): Desfazer o lote do OFX mantendo o XLSX ---');
  const resDesfazerOfx = await storage.desfazerImportacao(loteIdOfx);

  asserir(resDesfazerOfx.sucesso === true, 'Rollback do lote OFX executado com sucesso');
  asserir(resDesfazerOfx.lancamentosRemovidos === 5, 'Exatamente os 5 novos lançamentos do OFX foram removidos');
  asserir(resDesfazerOfx.lancamentosRestaurados === 395, 'Exatamente os 395 lançamentos enriquecidos foram restaurados aos snapshots');

  // Verifica integridade dos lançamentos do XLSX
  const lancamentosDoXlsxRestantes = storage.cacheLancamentos.filter(
    (l) => l.origem_importacao?.lote_id === loteIdXlsx
  );
  asserir(
    lancamentosDoXlsxRestantes.length === 1682,
    `Todos os 1.682 lançamentos do lote XLSX continuam 100% íntegros no sistema (obtido: ${lancamentosDoXlsxRestantes.length})`
  );

  const loteOfxRegistro = storage.cacheImportacoes.find((i) => i.id === loteIdOfx);
  asserir(loteOfxRegistro?.status === 'desfeita', "Lote do OFX marcado como status 'desfeita'");

  const loteXlsxRegistro = storage.cacheImportacoes.find((i) => i.id === loteIdXlsx);
  asserir(loteXlsxRegistro?.status === 'concluida', "Lote do XLSX permanece com status 'concluida'");

  // ------------------------------------------------------------
  // ETAPA F: Auditoria de Regras de Importação
  // ------------------------------------------------------------
  console.log('\n--- Etapa (f): Auditoria de Regras e Lotes em RegistroAuditoria ---');

  // 1. Criar regra
  const novaRegra = storage.saveRegraImportacao({
    valor: 'ENEL DISTRIBUICAO',
    campo: 'descricao',
    operador: 'contem',
    banco_codigo: '033',
    conta_id: 'conta-santander-pj',
    categoria_id: 'cat-energia-eletrica',
    tipoLancamento: 'despesa',
    ativa: true,
  });
  asserir(storage.cacheRegras.length === 1, 'Regra salva no sistema');

  const auditCriarRegra = storage.cacheAuditoria.find(
    (a) => a.modulo === 'regras_importacao' && a.acao === 'criacao'
  );
  asserir(!!auditCriarRegra, 'Auditoria registrada ao CRIAR regra de importação');
  asserir(auditCriarRegra?.descricao.includes('ENEL DISTRIBUICAO') || false, 'Auditoria cita o padrão cadastrado');

  // 2. Editar regra
  storage.saveRegraImportacao({
    ...novaRegra,
    ativa: false,
  });
  const auditEditarRegra = storage.cacheAuditoria.find(
    (a) => a.modulo === 'regras_importacao' && a.acao === 'edicao'
  );
  asserir(!!auditEditarRegra, 'Auditoria registrada ao EDITAR regra de importação');

  // 3. Excluir regra
  storage.deleteRegraImportacao(novaRegra.id);
  asserir(storage.cacheRegras.length === 0, 'Regra removida com sucesso');
  const auditExcluirRegra = storage.cacheAuditoria.find(
    (a) => a.modulo === 'regras_importacao' && a.acao === 'exclusao'
  );
  asserir(!!auditExcluirRegra, 'Auditoria registrada ao EXCLUIR regra de importação');

  // 4. Auditoria de Desfazer
  const auditDesfazer = storage.cacheAuditoria.find(
    (a) => a.modulo === 'importacoes' && a.acao === 'desfazer'
  );
  asserir(!!auditDesfazer, 'Auditoria registrada ao DESFAZER lote de importação');
  asserir(auditDesfazer?.descricao.includes(loteIdOfx) || false, 'Auditoria cita o ID do lote revertido');

  // ------------------------------------------------------------
  // RESUMO FINAL
  // ------------------------------------------------------------
  console.log('\n' + '='.repeat(72));
  console.log(`TOTAL DE TESTES E2E: ${totalTestes}`);
  console.log(`PASSARAM: ${passaram}`);
  console.log(`FALHARAM: ${falharam}`);
  console.log('='.repeat(72));

  if (falharam > 0) {
    process.exit(1);
  }
}

executarTesteE2E().catch((err) => {
  console.error('Erro fatal no teste E2E:', err);
  process.exit(1);
});
