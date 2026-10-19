// MT Solar - Gestão Financeira
// Teste de Deduplicação, Cruzamento OFX x XLSX e Enriquecimento de Extratos (Parte 15C)

import fs from 'fs';
import path from 'path';
import { Lancamento, TipoLancamento } from '../src/types';
import {
  lerExtrato,
  TransacaoExtrato,
  ExtratoLido,
  TipoTransacaoExtrato,
  classificarDuplicatas,
  enriquecerLancamento,
  gerarAssinaturaFraca
} from '../src/utils/extrato';

let passou = 0;
let falhou = 0;

function asserir(condicao: boolean, descricao: string, detalheErro?: string): void {
  if (condicao) {
    console.log(`  [PASSOU] ${descricao}`);
    passou++;
  } else {
    console.error(`  [FALHOU] ${descricao}${detalheErro ? ` -> ${detalheErro}` : ''}`);
    falhou++;
  }
}

/**
 * Converte TipoTransacaoExtrato para TipoLancamento.
 * credito = receita; debito = despesa
 */
function tipoParaLancamento(tipo: TipoTransacaoExtrato): TipoLancamento {
  return tipo === 'credito' ? 'receita' : 'despesa';
}

function converterTransacaoEmLancamento(
  transacao: TransacaoExtrato,
  contaId: string,
  bancoCodigo: string,
  loteId: string,
  formato: 'ofx' | 'xlsx',
  categoriaId: string = 'cat-padrao'
): Lancamento {
  const assinaturaFraca = gerarAssinaturaFraca({
    conta: contaId,
    data: transacao.data,
    tipo: transacao.tipo,
    valor: transacao.valor,
    descricaoNormalizada: transacao.descricaoNormalizada,
    ordemNoDia: transacao.ordemNoDia
  });

  return {
    id: `lanc-${formato}-${transacao.idTemporario}`,
    tipo: tipoParaLancamento(transacao.tipo),
    descricao: transacao.descricaoOriginal,
    valor: transacao.valor,
    data_vencimento: transacao.data,
    data_pagamento: transacao.data,
    status: 'pago',
    conta_id: contaId,
    categoria_id: categoriaId,
    forma_pagamento: 'transferencia',
    recorrencia: 'nenhuma',
    origem: 'extrato',
    observacoes: transacao.contraparte ? `Favorecido: ${transacao.contraparte}` : undefined,
    origem_importacao: {
      lote_id: loteId,
      banco_codigo: bancoCodigo,
      conta_id: contaId,
      fitid: transacao.fitid,
      assinatura_fraca: assinaturaFraca,
      formato
    },
    criado_em: new Date().toISOString()
  };
}

async function executarTestes(): Promise<void> {
  console.log('================================================================');
  console.log(' INICIANDO TESTES DE DEDUPLICAÇÃO E ENRIQUECIMENTO (PARTE 15C)');
  console.log('================================================================\n');

  const caminhoOfx = path.resolve('src/exemplos_extratos/extrato-pj-16_10_2026_19h22m20s.ofx');
  const caminhoXlsx = path.resolve('src/exemplos_extratos/excel_export1792140356207.xlsx');

  const bufferOfxNode = fs.readFileSync(caminhoOfx);
  const arrayBufferOfx = bufferOfxNode.buffer.slice(
    bufferOfxNode.byteOffset,
    bufferOfxNode.byteOffset + bufferOfxNode.byteLength
  );

  const bufferXlsxNode = fs.readFileSync(caminhoXlsx);
  const arrayBufferXlsx = bufferXlsxNode.buffer.slice(
    bufferXlsxNode.byteOffset,
    bufferXlsxNode.byteOffset + bufferXlsxNode.byteLength
  );

  const extratoOfx: ExtratoLido = await lerExtrato(arrayBufferOfx, 'extrato.ofx');
  const extratoXlsx: ExtratoLido = await lerExtrato(arrayBufferXlsx, 'extrato.xlsx');

  const CONTA_ID = 'conta-santander-pj';
  const BANCO_CODIGO = '033';
  const CONTA_NUMERO = '130046964';

  const contexto = {
    contaId: CONTA_ID,
    bancoCodigo: BANCO_CODIGO,
    contaNumero: CONTA_NUMERO,
  };

  // -------------------------------------------------------------
  // TESTE 1: Ordem XLSX depois OFX
  // -------------------------------------------------------------
  console.log('--- TESTE 1: Ordem de Importação XLSX depois OFX ---');
  let baseLancamentosOrdem1: Lancamento[] = [];

  // 1.1 Importar XLSX primeiro em base vazia
  const classifXlsx1 = classificarDuplicatas(extratoXlsx.transacoes, baseLancamentosOrdem1, {
    ...contexto,
    loteId: 'lote-xlsx-1'
  });

  const novasXlsx1 = classifXlsx1.filter(c => c.status === 'nova');
  asserir(
    novasXlsx1.length === 1682,
    `XLSX em base vazia: 1682 novas transações (obtido: ${novasXlsx1.length})`
  );
  asserir(
    classifXlsx1.filter(c => c.status !== 'nova').length === 0,
    'Zero duplicadas na primeira importação do XLSX'
  );

  // Simular gravação das 1682 transações do XLSX com categoria personalizada
  baseLancamentosOrdem1 = extratoXlsx.transacoes.map(t =>
    converterTransacaoEmLancamento(t, CONTA_ID, BANCO_CODIGO, 'lote-xlsx-1', 'xlsx', 'cat-escolhida-usuario')
  );
  asserir(
    baseLancamentosOrdem1.length === 1682,
    `Base simulada populada com ${baseLancamentosOrdem1.length} lançamentos do XLSX`
  );

  // 1.2 Importar OFX em seguida
  const classifOfx1 = classificarDuplicatas(extratoOfx.transacoes, baseLancamentosOrdem1, {
    ...contexto,
    loteId: 'lote-ofx-1'
  });

  const enriquecerOfx1 = classifOfx1.filter(c => c.status === 'enriquecer_existente');
  const novasOfx1 = classifOfx1.filter(c => c.status === 'nova');
  const duplicadasOfx1 = classifOfx1.filter(c => c.status === 'duplicada_exata');

  asserir(
    enriquecerOfx1.length === 395,
    `OFX casou com XLSX existente: 395 transações marcadas como 'enriquecer_existente' (obtido: ${enriquecerOfx1.length})`
  );
  asserir(
    novasOfx1.length === 5,
    `OFX trouxe 5 transações novas de 16/10 não presentes no XLSX (obtido: ${novasOfx1.length})`
  );
  asserir(
    duplicadasOfx1.length === 0,
    `Nenhuma duplicata exata no primeiro cruzamento OFX x XLSX (obtido: ${duplicadasOfx1.length})`
  );

  // Validar enriquecimento de um lançamento específico: Girlane Santos Brainer
  const matchGirlane = enriquecerOfx1.find(c => c.transacao.descricaoOriginal.includes('GIRLANE SANTOS BRAINER'));
  asserir(
    matchGirlane !== undefined && matchGirlane.idDoLancamentoRelacionado !== undefined,
    'Transação da Girlane identificada para enriquecimento'
  );

  if (matchGirlane && matchGirlane.idDoLancamentoRelacionado) {
    const lancAntigo = baseLancamentosOrdem1.find(l => l.id === matchGirlane.idDoLancamentoRelacionado)!;
    const lancEnriquecido = enriquecerLancamento(
      lancAntigo,
      matchGirlane.transacao,
      'lote-ofx-1',
      BANCO_CODIGO,
      CONTA_ID,
      matchGirlane.assinaturaFraca
    );

    asserir(
      lancEnriquecido.categoria_id === 'cat-escolhida-usuario',
      'Enriquecimento preservou a categoria previamente escolhida pelo usuário'
    );
    asserir(
      lancEnriquecido.origem_importacao?.fitid === matchGirlane.transacao.fitid,
      `Enriquecimento completou o FITID: ${lancEnriquecido.origem_importacao?.fitid}`
    );
    asserir(
      lancEnriquecido.descricao === matchGirlane.transacao.descricaoOriginal,
      `Enriquecimento completou a descrição rica: "${lancEnriquecido.descricao}"`
    );
    asserir(
      lancEnriquecido.observacoes?.includes('GIRLANE SANTOS BRAINER') === true,
      `Enriquecimento completou a contraparte: "${lancEnriquecido.observacoes}"`
    );
  }

  // Simular união final: atualizar os 395 enriquecidos e adicionar as 5 novas
  for (const item of enriquecerOfx1) {
    const idx = baseLancamentosOrdem1.findIndex(l => l.id === item.idDoLancamentoRelacionado);
    if (idx !== -1) {
      baseLancamentosOrdem1[idx] = enriquecerLancamento(
        baseLancamentosOrdem1[idx],
        item.transacao,
        'lote-ofx-1',
        BANCO_CODIGO,
        CONTA_ID,
        item.assinaturaFraca
      );
    }
  }
  for (const item of novasOfx1) {
    baseLancamentosOrdem1.push(
      converterTransacaoEmLancamento(item.transacao, CONTA_ID, BANCO_CODIGO, 'lote-ofx-1', 'ofx')
    );
  }

  const totalUniao1 = baseLancamentosOrdem1.length;
  asserir(
    totalUniao1 === 1687,
    `União final da Ordem 1: exatamente 1687 lançamentos (1682 XLSX + 5 novas OFX). Obtido: ${totalUniao1}`
  );

  // -------------------------------------------------------------
  // TESTE 2: Ordem OFX depois XLSX
  // -------------------------------------------------------------
  console.log('\n--- TESTE 2: Ordem de Importação OFX depois XLSX ---');
  let baseLancamentosOrdem2: Lancamento[] = [];

  // 2.1 Importar OFX primeiro em base vazia
  const classifOfx2 = classificarDuplicatas(extratoOfx.transacoes, baseLancamentosOrdem2, {
    ...contexto,
    loteId: 'lote-ofx-2'
  });
  asserir(
    classifOfx2.filter(c => c.status === 'nova').length === 400,
    'OFX em base vazia: todas as 400 transações classificadas como nova'
  );

  // Salvar as 400 do OFX na base
  baseLancamentosOrdem2 = extratoOfx.transacoes.map(t =>
    converterTransacaoEmLancamento(t, CONTA_ID, BANCO_CODIGO, 'lote-ofx-2', 'ofx')
  );
  asserir(
    baseLancamentosOrdem2.length === 400,
    `Base simulada populada com ${baseLancamentosOrdem2.length} lançamentos do OFX`
  );

  // 2.2 Importar XLSX em seguida
  const classifXlsx2 = classificarDuplicatas(extratoXlsx.transacoes, baseLancamentosOrdem2, {
    ...contexto,
    loteId: 'lote-xlsx-2'
  });

  const duplicadasXlsx2 = classifXlsx2.filter(c => c.status === 'duplicada_exata');
  const novasXlsx2 = classifXlsx2.filter(c => c.status === 'nova');

  asserir(
    duplicadasXlsx2.length === 395,
    `As 395 transações do XLSX já existentes no OFX foram marcadas como 'duplicada_exata' (obtido: ${duplicadasXlsx2.length})`
  );
  asserir(
    novasXlsx2.length === 1287,
    `XLSX identificou as 1287 transações anteriores ao período do OFX como 'nova' (obtido: ${novasXlsx2.length})`
  );

  // Adicionar apenas as 1287 novas do XLSX
  for (const item of novasXlsx2) {
    baseLancamentosOrdem2.push(
      converterTransacaoEmLancamento(item.transacao, CONTA_ID, BANCO_CODIGO, 'lote-xlsx-2', 'xlsx')
    );
  }

  const totalUniao2 = baseLancamentosOrdem2.length;
  asserir(
    totalUniao2 === 1687,
    `União final da Ordem 2: exatamente 1687 lançamentos (400 OFX + 1287 XLSX). Obtido: ${totalUniao2}`
  );
  asserir(
    totalUniao1 === totalUniao2,
    `Independência de ordem comprovada: Ordem 1 (${totalUniao1}) === Ordem 2 (${totalUniao2})`
  );

  // -------------------------------------------------------------
  // TESTE 3: Mesmo arquivo importado 2 vezes consecutivas = 0 novas
  // -------------------------------------------------------------
  console.log('\n--- TESTE 3: Importação Duplicada do Mesmo Arquivo ---');
  // Reimportar XLSX na base que já tem os dados
  const reimportacaoXlsx = classificarDuplicatas(extratoXlsx.transacoes, baseLancamentosOrdem1, {
    ...contexto,
    loteId: 'lote-xlsx-repetido'
  });
  const novasReimportXlsx = reimportacaoXlsx.filter(c => c.status === 'nova');
  const dupReimportXlsx = reimportacaoXlsx.filter(c => c.status === 'duplicada_exata');
  asserir(
    novasReimportXlsx.length === 0,
    `Reimportar mesmo XLSX resulta em ZERO novas (obtido: ${novasReimportXlsx.length})`
  );
  asserir(
    dupReimportXlsx.length === 1682,
    `Todas as 1682 transações do XLSX reimportado foram identificadas como 'duplicada_exata' (obtido: ${dupReimportXlsx.length})`
  );

  // Reimportar OFX na base que já tem os dados
  const reimportacaoOfx = classificarDuplicatas(extratoOfx.transacoes, baseLancamentosOrdem1, {
    ...contexto,
    loteId: 'lote-ofx-repetido'
  });
  const novasReimportOfx = reimportacaoOfx.filter(c => c.status === 'nova');
  const dupReimportOfx = reimportacaoOfx.filter(c => c.status === 'duplicada_exata');
  asserir(
    novasReimportOfx.length === 0,
    `Reimportar mesmo OFX resulta em ZERO novas (obtido: ${novasReimportOfx.length})`
  );
  asserir(
    dupReimportOfx.length === 400,
    `Todas as 400 transações do OFX reimportado foram identificadas como 'duplicada_exata' (obtido: ${dupReimportOfx.length})`
  );

  // -------------------------------------------------------------
  // TESTE 4: Dois boletos idênticos de 108,39 no mesmo dia = 2 lançamentos distintos
  // -------------------------------------------------------------
  console.log('\n--- TESTE 4: Dois Boletos Idênticos de 108,39 no Mesmo Dia ---');
  const boletosDia = extratoXlsx.transacoes.filter(
    t => t.data === '2026-10-15' && t.valor === 108.39 && t.tipo === 'debito'
  );
  asserir(boletosDia.length === 2, `Existem 2 boletos de 108.39 em 2026-10-15`);

  // Classificar em base vazia
  const classifBoletosVazia = classificarDuplicatas(boletosDia, [], contexto);
  asserir(
    classifBoletosVazia.every(c => c.status === 'nova'),
    'Ambos os boletos idênticos são classificados como "nova" (NÃO colapsam)'
  );
  asserir(
    classifBoletosVazia[0].transacao.ordemNoDia === 0 && classifBoletosVazia[1].transacao.ordemNoDia === 1,
    'Boletos possuem ordemNoDia distintos (0 e 1)'
  );
  asserir(
    classifBoletosVazia[0].assinaturaFraca !== classifBoletosVazia[1].assinaturaFraca,
    'Boletos possuem assinaturas fracas distintas devido ao ordemNoDia'
  );

  // Salvar os dois boletos
  const lancBoletos = boletosDia.map(t =>
    converterTransacaoEmLancamento(t, CONTA_ID, BANCO_CODIGO, 'lote-boletos', 'xlsx')
  );

  // Reclassificar os mesmos dois boletos contra a base contendo os dois
  const classifBoletosSalvos = classificarDuplicatas(boletosDia, lancBoletos, contexto);
  asserir(
    classifBoletosSalvos.every(c => c.status === 'duplicada_exata'),
    'Ao reimportar, ambos são identificados individualmente como duplicada_exata'
  );
  asserir(
    classifBoletosSalvos[0].idDoLancamentoRelacionado !== classifBoletosSalvos[1].idDoLancamentoRelacionado,
    'Cada boleto casou com o seu respectivo lançamento (pareamento 1:1)'
  );

  // -------------------------------------------------------------
  // TESTE 5: Lançamento manual existente -> possivel_duplicata_manual
  // -------------------------------------------------------------
  console.log('\n--- TESTE 5: Lançamento Manual Existente (±2 dias) ---');
  const lancManual: Lancamento = {
    id: 'lanc-manual-1',
    tipo: 'despesa', // TipoLancamento
    descricao: 'Fornecedor Solar Painéis Manuais',
    valor: 4703.31,
    data_vencimento: '2026-08-05', // 1 dia de diferença em relação a 2026-08-04
    data_pagamento: '2026-08-05',
    status: 'pago',
    conta_id: CONTA_ID,
    categoria_id: 'cat-fornecedores',
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual', // SEM origem_importacao!
    criado_em: '2026-08-05T10:00:00Z'
  };

  const transacaoGirlane = extratoOfx.transacoes.find(
    t => t.data === '2026-08-04' && t.valor === 4703.31 && t.tipo === 'debito'
  )!;

  const classifManual = classificarDuplicatas([transacaoGirlane], [lancManual], contexto);
  asserir(classifManual.length === 1, 'Classificação de 1 transação');
  asserir(
    classifManual[0].status === 'possivel_duplicata_manual',
    `Classificada como 'possivel_duplicata_manual' (obtido: ${classifManual[0].status})`
  );
  asserir(
    classifManual[0].idDoLancamentoRelacionado === 'lanc-manual-1',
    'idDoLancamentoRelacionado aponta para o lançamento manual correto'
  );

  // Se a data for mais distante que 2 dias (ex: 5 dias de diferença), NÃO é duplicata manual
  const lancManualDistante: Lancamento = {
    ...lancManual,
    id: 'lanc-manual-distante',
    data_vencimento: '2026-08-15',
    data_pagamento: '2026-08-15'
  };
  const classifDistante = classificarDuplicatas([transacaoGirlane], [lancManualDistante], contexto);
  asserir(
    classifDistante[0].status === 'nova',
    'Lançamento manual com mais de 2 dias de diferença NÃO gera falso positivo (classificado como "nova")'
  );

  console.log('\n================================================================');
  console.log(` RESULTADO FINAL DEDUP/ENRIQUECIMENTO: ${passou} PASSOU / ${falhou} FALHOU`);
  console.log('================================================================');

  if (falhou > 0) {
    process.exit(1);
  }
}

executarTestes().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
