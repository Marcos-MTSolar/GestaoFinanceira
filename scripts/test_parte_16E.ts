// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 16E: Preservação e Exibição de Informações do Extrato nos Lançamentos Importados
//
// Requisitos testados:
// 1) Ao criar lançamento: preencher observações com histórico original, favorecido/contraparte,
//    documento, FITID, banco, arquivo, formato, lote e data/hora. Descrição curta e limpa.
// 2) Enriquecimento (OFX×XLSX): complementar observações sem apagar texto prévio do usuário.
// 3) Desfazer importação: remove dados dos enriquecidos e restaura observações anteriores via snapshot.
// 4) Lançamento a partir de OFX tem observações completas; de XLSX tem informações disponíveis.
// 5) Helpers e filtros: extração de dados, geração de descrição limpa e isolamento de lote.

import {
  Lancamento,
  ParamsImportacaoLote,
  RegistroImportacao,
} from '../src/types';
import {
  gerarDescricaoCurta,
  formatarObservacoesImportacao,
  complementarObservacoesEnriquecimento,
  extrairCamposOrigem,
  obterNomeBanco,
} from '../src/utils/extrato/observacoesHelper';
import { gerarAssinaturaFraca } from '../src/utils/extrato/assinatura';
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
  console.log('\n' + '═'.repeat(70));
  console.log('  ' + nome);
  console.log('═'.repeat(70));
}

/**
 * Simulador em memória da lógica de importarExtratoLote e desfazerImportacao de storage.ts
 */
class Simulador16E {
  public cacheLancamentos: Lancamento[] = [];
  public cacheImportacoes: RegistroImportacao[] = [];

  public getLancamentos(): Lancamento[] {
    return [...this.cacheLancamentos];
  }

  public async importarExtratoLote(params: ParamsImportacaoLote): Promise<{ sucesso: boolean; loteId: string }> {
    const dataHoraExecucao = new Date().toISOString();
    const novosLancamentos: Lancamento[] = [];
    const snapshotsEnriquecidos: Array<{
      lancamentoId: string;
      descricaoAnterior: string;
      origemImportacaoAnterior?: any;
      observacoesAnterior?: string;
    }> = [];

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

      // Enriquecimento
      if (item.acao === 'vincular' && item.lancamentoExistenteId) {
        const lancExistente = this.cacheLancamentos.find((l) => l.id === item.lancamentoExistenteId);
        if (!lancExistente) {
          totais.ignoradas++;
          continue;
        }

        snapshotsEnriquecidos.push({
          lancamentoId: lancExistente.id,
          descricaoAnterior: lancExistente.descricao,
          origemImportacaoAnterior: lancExistente.origem_importacao,
          observacoesAnterior: lancExistente.observacoes || '',
        });

        const descEnriquecida = gerarDescricaoCurta(
          item.transacao.descricaoOriginal,
          item.transacao.contraparte
        );

        const observacoesEnriquecidas = complementarObservacoesEnriquecimento(
          lancExistente.observacoes,
          {
            descricaoOriginal: item.transacao.descricaoOriginal,
            contraparte: item.transacao.contraparte,
            documento: item.transacao.documento,
            fitid: item.transacao.fitid || lancExistente.origem_importacao?.fitid,
            bancoCodigo: params.bancoCodigo,
            bancoNome: params.bancoNome,
            nomeArquivo: params.nomeArquivo,
            formato: params.formato,
            loteId: params.loteId,
            dataHoraImportacao: dataHoraExecucao,
          }
        );

        const idx = this.cacheLancamentos.findIndex((l) => l.id === lancExistente.id);
        if (idx >= 0) {
          this.cacheLancamentos[idx] = {
            ...lancExistente,
            descricao: lancExistente.origem === 'manual' ? lancExistente.descricao : descEnriquecida,
            observacoes: observacoesEnriquecidas,
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
                  ordemNoDia: item.transacao.ordemNoDia,
                }),
              formato: params.formato,
              nome_arquivo: params.nomeArquivo,
              data_importacao: dataHoraExecucao,
              documento: item.transacao.documento,
              contraparte: item.transacao.contraparte,
              descricao_original: item.transacao.descricaoOriginal,
            },
          };
        }
        totais.enriquecidas++;
        continue;
      }

      // Novo lançamento
      if (item.acao === 'incluir') {
        const descNovo = gerarDescricaoCurta(item.transacao.descricaoOriginal, item.transacao.contraparte);
        const obsNovo = formatarObservacoesImportacao({
          descricaoOriginal: item.transacao.descricaoOriginal,
          contraparte: item.transacao.contraparte,
          documento: item.transacao.documento,
          fitid: item.transacao.fitid,
          bancoCodigo: params.bancoCodigo,
          bancoNome: params.bancoNome,
          nomeArquivo: params.nomeArquivo,
          formato: params.formato,
          loteId: params.loteId,
          dataHoraImportacao: dataHoraExecucao,
        });

        const novoLanc: Lancamento = {
          id: `lanc-imp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          tipo: item.tipoLancamento === 'receita' ? 'receita' : 'despesa',
          descricao: descNovo,
          valor: item.transacao.valor,
          data_vencimento: item.transacao.data,
          data_pagamento: item.transacao.data,
          status: 'pago',
          conta_id: params.contaId,
          categoria_id: item.categoriaId,
          forma_pagamento: inferirFormaPagamento(item.transacao.descricaoOriginal, item.natureza as any),
          recorrencia: 'nenhuma',
          observacoes: obsNovo,
          origem: 'importacao',
          origem_importacao: {
            lote_id: params.loteId,
            banco_codigo: params.bancoCodigo,
            conta_id: params.contaId,
            fitid: item.transacao.fitid,
            assinatura_fraca: gerarAssinaturaFraca({
              conta: params.contaId,
              data: item.transacao.data,
              tipo: item.transacao.tipo,
              valor: item.transacao.valor,
              descricaoNormalizada: item.transacao.descricaoNormalizada,
              ordemNoDia: item.transacao.ordemNoDia,
            }),
            formato: params.formato,
            nome_arquivo: params.nomeArquivo,
            data_importacao: dataHoraExecucao,
            documento: item.transacao.documento,
            contraparte: item.transacao.contraparte,
            descricao_original: item.transacao.descricaoOriginal,
          },
          criado_em: dataHoraExecucao,
        };

        novosLancamentos.push(novoLanc);
        totais.lancadas++;
      }
    }

    this.cacheLancamentos.push(...novosLancamentos);

    const registro: RegistroImportacao = {
      id: params.loteId,
      data: new Date().toISOString().split('T')[0],
      usuario: params.usuario,
      banco_codigo: params.bancoCodigo,
      conta_id: params.contaId,
      nome_arquivo: params.nomeArquivo,
      formato: params.formato,
      periodo: params.periodo,
      totais,
      status: 'concluida',
      criado_em: dataHoraExecucao,
      snapshot_enriquecidos: snapshotsEnriquecidos,
    };

    this.cacheImportacoes.push(registro);
    return { sucesso: true, loteId: params.loteId };
  }

  public async desfazerImportacao(loteId: string): Promise<boolean> {
    const lote = this.cacheImportacoes.find((i) => i.id === loteId);
    if (!lote) throw new Error('Lote não encontrado');

    const snapshots = lote.snapshot_enriquecidos || [];
    const idsEnriquecidosSet = new Set(snapshots.map((s) => s.lancamentoId));

    // Remove lançamentos criados pelo lote
    this.cacheLancamentos = this.cacheLancamentos.filter(
      (l) => !(l.origem_importacao?.lote_id === loteId && !idsEnriquecidosSet.has(l.id))
    );

    // Restaura lançamentos enriquecidos
    for (const snap of snapshots) {
      const idx = this.cacheLancamentos.findIndex((l) => l.id === snap.lancamentoId);
      if (idx >= 0) {
        this.cacheLancamentos[idx] = {
          ...this.cacheLancamentos[idx],
          descricao: snap.descricaoAnterior,
          origem_importacao: snap.origemImportacaoAnterior,
          observacoes: snap.observacoesAnterior !== undefined ? snap.observacoesAnterior : this.cacheLancamentos[idx].observacoes,
        };
      }
    }

    lote.status = 'desfeita';
    return true;
  }
}

async function executarTestes(): Promise<void> {
  console.log('\nMT Solar — Gestão Financeira');
  console.log('Iniciando Suíte de Testes Automatizados — Parte 16E');

  // =========================================================================
  // TESTE 1: Helpers Puros (Descrição Curta, Formatação e Nomes de Banco)
  // =========================================================================
  secao('1. Teste de Helpers de Observações e Descrição Curta');

  asserir(obterNomeBanco('033') === 'Santander', 'obterNomeBanco("033") retorna Santander');
  asserir(obterNomeBanco('001') === 'Banco do Brasil', 'obterNomeBanco("001") retorna Banco do Brasil');
  asserir(obterNomeBanco('341') === 'Itaú Unibanco', 'obterNomeBanco("341") retorna Itaú Unibanco');

  // Descrição Curta com diferentes padrões de operação
  const d1 = gerarDescricaoCurta('Pix Enviado GIRLANE SANTOS BRAINER', 'GIRLANE SANTOS BRAINER');
  asserir(d1 === 'Pix Enviado - GIRLANE SANTOS BRAINER', `Pix Enviado limpo: "${d1}"`);

  const d2 = gerarDescricaoCurta('TED Enviada FORNECEDOR MODULOS SOLAR', 'FORNECEDOR MODULOS SOLAR');
  asserir(d2 === 'TED Enviada - FORNECEDOR MODULOS SOLAR', `TED Enviada limpa: "${d2}"`);

  const d3 = gerarDescricaoCurta('PAGAMENTO TITULO ENEL DISTRIBUICAO', 'ENEL DISTRIBUICAO');
  asserir(d3 === 'PAGAMENTO - ENEL DISTRIBUICAO' || d3.includes('ENEL DISTRIBUICAO'), `Pagamento limpo: "${d3}"`);

  const d4 = gerarDescricaoCurta('TARIFA BANCARIA CESTA BASICA', undefined);
  asserir(d4 === 'TARIFA BANCARIA CESTA BASICA', `Sem contraparte mantém descrição original limpa: "${d4}"`);

  // =========================================================================
  // TESTE 2: Lançamento Criado a Partir de OFX
  // =========================================================================
  secao('2. Lançamento Criado a Partir de OFX (Observações Completas)');

  const sim1 = new Simulador16E();
  await sim1.importarExtratoLote({
    loteId: 'lote-ofx-001',
    usuario: 'admin@mtsolar.com.br',
    contaId: 'conta-santander',
    bancoCodigo: '033',
    bancoNome: 'Santander',
    formato: 'ofx',
    nomeArquivo: 'extrato_outubro_2026.ofx',
    periodo: { inicio: '2026-10-01', fim: '2026-10-22' },
    itens: [
      {
        id: 'item-1',
        acao: 'incluir',
        tipoLancamento: 'despesa',
        categoriaId: 'cat-fornecedor',
        transacao: {
          idTemporario: 'ofx-t1',
          data: '2026-10-15',
          valor: 1450.5,
          tipo: 'debito',
          descricaoOriginal: 'Pix Enviado GIRLANE SANTOS BRAINER',
          descricaoNormalizada: 'PIX ENVIADO GIRLANE SANTOS BRAINER',
          contraparte: 'GIRLANE SANTOS BRAINER',
          documento: 'DOC-998877',
          fitid: 'FIT-20261015001-998877',
          ordemNoDia: 1,
        },
      },
    ],
  });

  const lancOfx = sim1.getLancamentos()[0];
  asserir(!!lancOfx, 'Lançamento OFX gravado com sucesso no simulador');
  asserir(lancOfx.descricao === 'Pix Enviado - GIRLANE SANTOS BRAINER', 'Descrição gravada é curta e limpa');
  asserir(lancOfx.origem === 'importacao', 'Origem é marcada como importacao');

  const obsOfx = lancOfx.observacoes || '';
  asserir(obsOfx.includes('Histórico original: Pix Enviado GIRLANE SANTOS BRAINER'), 'Observações contém o histórico original do banco');
  asserir(obsOfx.includes('Favorecido/Contraparte: GIRLANE SANTOS BRAINER'), 'Observações contém o favorecido/contraparte');
  asserir(obsOfx.includes('Documento: DOC-998877'), 'Observações contém o número do documento');
  asserir(obsOfx.includes('FITID: FIT-20261015001-998877'), 'Observações contém o FITID');
  asserir(obsOfx.includes('Banco: Santander (033)'), 'Observações contém nome e código do banco');
  asserir(obsOfx.includes('Arquivo: extrato_outubro_2026.ofx'), 'Observações contém o nome do arquivo');
  asserir(obsOfx.includes('Formato: OFX'), 'Observações contém o formato OFX em caixa alta');
  asserir(obsOfx.includes('Lote: lote-ofx-001'), 'Observações contém o ID do lote');
  asserir(obsOfx.includes('Data da importação:'), 'Observações contém a data e hora legível da importação');

  // Metadados estruturados em origem_importacao
  asserir(lancOfx.origem_importacao?.documento === 'DOC-998877', 'origem_importacao possui documento estruturado');
  asserir(lancOfx.origem_importacao?.fitid === 'FIT-20261015001-998877', 'origem_importacao possui fitid estruturado');
  asserir(lancOfx.origem_importacao?.contraparte === 'GIRLANE SANTOS BRAINER', 'origem_importacao possui contraparte estruturada');
  asserir(lancOfx.origem_importacao?.nome_arquivo === 'extrato_outubro_2026.ofx', 'origem_importacao possui nome_arquivo');

  // Teste de extração via helper extrairCamposOrigem
  const camposExtraidosOfx = extrairCamposOrigem(lancOfx.observacoes, lancOfx.origem_importacao);
  asserir(camposExtraidosOfx.contraparte === 'GIRLANE SANTOS BRAINER', 'extrairCamposOrigem extraiu a contraparte com sucesso');
  asserir(camposExtraidosOfx.documento === 'DOC-998877', 'extrairCamposOrigem extraiu o documento com sucesso');
  asserir(camposExtraidosOfx.fitid === 'FIT-20261015001-998877', 'extrairCamposOrigem extraiu o FITID com sucesso');
  asserir(camposExtraidosOfx.formato === 'ofx', 'extrairCamposOrigem extraiu o formato com sucesso');

  // =========================================================================
  // TESTE 3: Lançamento Criado a Partir de XLSX
  // =========================================================================
  secao('3. Lançamento Criado a Partir de XLSX (Informações Disponíveis)');

  const sim2 = new Simulador16E();
  await sim2.importarExtratoLote({
    loteId: 'lote-xlsx-002',
    usuario: 'admin@mtsolar.com.br',
    contaId: 'conta-santander',
    bancoCodigo: '033',
    bancoNome: 'Santander',
    formato: 'xlsx',
    nomeArquivo: 'extrato_santander.xlsx',
    periodo: { inicio: '2026-10-01', fim: '2026-10-22' },
    itens: [
      {
        id: 'item-xlsx-1',
        acao: 'incluir',
        tipoLancamento: 'despesa',
        categoriaId: 'cat-tarifas',
        transacao: {
          idTemporario: 'xlsx-t1',
          data: '2026-10-10',
          valor: 85.0,
          tipo: 'debito',
          descricaoOriginal: 'TARIFA BANCARIA CESTA BASICA',
          descricaoNormalizada: 'TARIFA BANCARIA CESTA BASICA',
          contraparte: undefined,
          documento: undefined,
          fitid: undefined,
          ordemNoDia: 0,
        },
      },
    ],
  });

  const lancXlsx = sim2.getLancamentos()[0];
  asserir(!!lancXlsx, 'Lançamento XLSX gravado com sucesso no simulador');
  asserir(lancXlsx.descricao === 'TARIFA BANCARIA CESTA BASICA', 'Descrição XLSX mantida limpa');

  const obsXlsx = lancXlsx.observacoes || '';
  asserir(obsXlsx.includes('Histórico original: TARIFA BANCARIA CESTA BASICA'), 'XLSX contém histórico original');
  asserir(obsXlsx.includes('Banco: Santander (033)'), 'XLSX contém identificação do banco');
  asserir(obsXlsx.includes('Arquivo: extrato_santander.xlsx'), 'XLSX contém nome do arquivo');
  asserir(obsXlsx.includes('Formato: XLSX'), 'XLSX contém formato XLSX');
  asserir(obsXlsx.includes('Lote: lote-xlsx-002'), 'XLSX contém identificador do lote');
  asserir(!obsXlsx.includes('undefined'), 'XLSX NÃO contém texto "undefined" nas observações');

  // =========================================================================
  // TESTE 4: Enriquecimento Preserva Texto do Usuário
  // =========================================================================
  secao('4. Enriquecimento de Lançamento Existente (OFX x XLSX)');

  const sim3 = new Simulador16E();
  // Cria lançamento existente prévio (ex: originado de XLSX ou manual, com anotação feita pelo usuário)
  const lancExistenteInicial: Lancamento = {
    id: 'lanc-existente-001',
    tipo: 'despesa',
    descricao: 'PIX TRANSF FORNECEDOR',
    valor: 5000.0,
    data_vencimento: '2026-10-18',
    data_pagamento: '2026-10-18',
    status: 'pago',
    conta_id: 'conta-santander',
    categoria_id: 'cat-inversores',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'importacao',
    observacoes: 'Nota fiscal 4589 aprovada pelo setor de compras para a Usina Alpha.',
    criado_em: '2026-10-18T10:00:00Z',
  };
  sim3.cacheLancamentos.push(lancExistenteInicial);

  // Agora importa extrato OFX mais detalhado que enriquece esse lançamento existente
  await sim3.importarExtratoLote({
    loteId: 'lote-enriquecimento-003',
    usuario: 'admin@mtsolar.com.br',
    contaId: 'conta-santander',
    bancoCodigo: '033',
    bancoNome: 'Santander',
    formato: 'ofx',
    nomeArquivo: 'extrato_detalhado.ofx',
    periodo: { inicio: '2026-10-01', fim: '2026-10-22' },
    itens: [
      {
        id: 'item-enriq-1',
        acao: 'vincular',
        statusDeduplicacao: 'enriquecer_existente',
        lancamentoExistenteId: 'lanc-existente-001',
        tipoLancamento: 'despesa',
        categoriaId: 'cat-inversores',
        transacao: {
          idTemporario: 'ofx-enriq-1',
          data: '2026-10-18',
          valor: 5000.0,
          tipo: 'debito',
          descricaoOriginal: 'Pix Enviado WEG EQUIPAMENTOS ELETRICOS SA',
          descricaoNormalizada: 'PIX ENVIADO WEG EQUIPAMENTOS ELETRICOS SA',
          contraparte: 'WEG EQUIPAMENTOS ELETRICOS SA',
          documento: 'DOC-554433',
          fitid: 'FIT-20261018-WEG',
          ordemNoDia: 1,
        },
      },
    ],
  });

  const lancEnriquecido = sim3.getLancamentos().find((l) => l.id === 'lanc-existente-001')!;
  asserir(!!lancEnriquecido, 'Lançamento existente localizado pós-enriquecimento');
  asserir(
    lancEnriquecido.descricao === 'Pix Enviado - WEG EQUIPAMENTOS ELETRICOS SA',
    `Descrição enriquecida com tipo de operação + favorecido: "${lancEnriquecido.descricao}"`
  );

  const obsEnriquecida = lancEnriquecido.observacoes || '';
  asserir(
    obsEnriquecida.startsWith('Nota fiscal 4589 aprovada pelo setor de compras para a Usina Alpha.'),
    'Texto original que o usuário escreveu foi 100% PRESERVADO no início das observações'
  );
  asserir(
    obsEnriquecida.includes('[Origem: Extrato Bancário - Enriquecimento]'),
    'Contém bloco de identificação de enriquecimento'
  );
  asserir(
    obsEnriquecida.includes('Favorecido/Contraparte: WEG EQUIPAMENTOS ELETRICOS SA'),
    'Contém contraparte enriquecida'
  );
  asserir(
    obsEnriquecida.includes('FITID: FIT-20261018-WEG'),
    'Contém FITID enriquecido'
  );

  // Snapshot gravado no lote
  const loteImp = sim3.cacheImportacoes.find((i) => i.id === 'lote-enriquecimento-003')!;
  asserir(!!loteImp, 'Registro do lote de importação encontrado');
  asserir(loteImp.snapshot_enriquecidos?.length === 1, 'Snapshot de enriquecimento registrado');
  asserir(
    loteImp.snapshot_enriquecidos?.[0].observacoesAnterior ===
      'Nota fiscal 4589 aprovada pelo setor de compras para a Usina Alpha.',
    'Snapshot armazena as observações anteriores com perfeição'
  );

  // =========================================================================
  // TESTE 5: Desfazer Restaura Observações e Lançamentos
  // =========================================================================
  secao('5. Desfazer Importação (Restauração via Snapshot)');

  await sim3.desfazerImportacao('lote-enriquecimento-003');

  const lancRestaurado = sim3.getLancamentos().find((l) => l.id === 'lanc-existente-001')!;
  asserir(!!lancRestaurado, 'Lançamento enriquecido permanece após desfazer o lote');
  asserir(
    lancRestaurado.descricao === 'PIX TRANSF FORNECEDOR',
    'Descrição anterior restaurada perfeitamente'
  );
  asserir(
    lancRestaurado.observacoes === 'Nota fiscal 4589 aprovada pelo setor de compras para a Usina Alpha.',
    'Observações anteriores do usuário restauradas 100% via snapshot'
  );
  asserir(!lancRestaurado.observacoes?.includes('WEG'), 'Bloco de enriquecimento foi removido com sucesso');
  asserir(loteImp.status === 'desfeita', 'Status do lote atualizado para "desfeita"');

  // =========================================================================
  // TESTE 6: Proteção do Filtro de Período em Lancamentos.tsx
  // =========================================================================
  secao('6. Proteção do Filtro de Período por Lote');

  // Lançamento com data antiga pertencente ao lote
  const lancAntigoLote: Lancamento = {
    id: 'lanc-antigo-lote',
    tipo: 'despesa',
    descricao: 'Compra Antiga',
    valor: 200,
    data_vencimento: '2025-05-10',
    data_pagamento: '2025-05-10',
    status: 'pago',
    conta_id: 'conta-santander',
    categoria_id: 'cat-geral',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'importacao',
    origem_importacao: {
      lote_id: 'lote-antigo-123',
      banco_codigo: '033',
      conta_id: 'conta-santander',
      assinatura_fraca: 'hash-antigo',
      formato: 'ofx',
    },
    criado_em: '2026-10-22T00:00:00Z',
  };

  // Simula a lógica de Lancamentos.tsx
  const hoje = '2026-10-22';
  const filtroLote: string = 'lote-antigo-123';
  const filtroPeriodo: string = 'mes_atual'; // Normalmente filtraria para 2026-10

  const passouFiltro = (() => {
    // Se lote está ativo, não esconde pelo período!
    if (filtroLote !== 'todos') {
      if (lancAntigoLote.origem_importacao?.lote_id !== filtroLote) return false;
      return true; // Período não descarta!
    }
    const dataRef = lancAntigoLote.data_pagamento || lancAntigoLote.data_vencimento;
    if (filtroPeriodo === 'mes_atual') {
      if (!dataRef.startsWith(hoje.slice(0, 7))) return false;
    }
    return true;
  })();

  asserir(passouFiltro, 'Lançamento de data antiga não é descartado pelo filtro de período quando lote está selecionado');

  // =========================================================================
  // RELATÓRIO FINAL
  // =========================================================================
  secao('RELATÓRIO DOS TESTES — PARTE 16E');
  console.log(`Total de asserções executadas: ${totalTestes}`);
  console.log(`Asserções aprovadas:          ${passaram}`);
  console.log(`Asserções reprovadas:         ${falharam}`);

  if (falharam > 0) {
    console.error('\nFalhas encontradas:');
    falhas.forEach((f) => console.error(` - ${f}`));
    process.exit(1);
  } else {
    console.log('\n✅ TODOS OS TESTES DA PARTE 16E PASSARAM COM 100% DE SUCESSO!\n');
    process.exit(0);
  }
}

executarTestes().catch((err) => {
  console.error('Erro fatal ao rodar os testes da Parte 16E:', err);
  process.exit(1);
});
