// MT Solar - Gestão Financeira
// Script de Validação e Testes Automatizados dos Parsers de Extrato (Parte 15A)

import fs from 'fs';
import path from 'path';
import {
  lerExtrato,
  converterDataPt,
  normalizarDescricao,
  parsearValorOfx,
  ErroBancoNaoSuportado,
  ExtratoLido
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

async function executarTestes(): Promise<void> {
  console.log('================================================================');
  console.log(' INICIANDO TESTES DO MÓDULO DE EXTRATOS (PARTE 15A)');
  console.log('================================================================\n');

  const caminhoOfx = path.resolve('scripts/fixtures/extrato_sintetico_santander.ofx');
  const caminhoXlsx = path.resolve('scripts/fixtures/extrato_sintetico_santander.xlsx');

  // -------------------------------------------------------------
  // TESTE 1: Parser OFX Santander Sintético
  // -------------------------------------------------------------
  console.log('--- TESTE 1: Arquivo OFX Sintético (Santander 033) ---');
  if (!fs.existsSync(caminhoOfx)) {
    console.error(`Arquivo OFX não encontrado em: ${caminhoOfx}`);
    falhou++;
  } else {
    const bufferOfxNode = fs.readFileSync(caminhoOfx);
    const arrayBufferOfx = bufferOfxNode.buffer.slice(
      bufferOfxNode.byteOffset,
      bufferOfxNode.byteOffset + bufferOfxNode.byteLength
    );

    // Testar detecção por conteúdo (passando nome genérico/sem banco)
    const extratoOfx: ExtratoLido = await lerExtrato(arrayBufferOfx, 'extrato_generico.ofx');

    asserir(extratoOfx.formato === 'ofx', 'Formato detectado como "ofx"');
    asserir(extratoOfx.bancoCodigo === '033', 'Código do banco é "033" (Santander)');
    asserir(extratoOfx.bancoNome === 'Santander', 'Nome do banco é "Santander"');
    asserir(extratoOfx.agencia === '0001', `Agência Santander extraída: "${extratoOfx.agencia}" (esperado: "0001")`);
    asserir(extratoOfx.conta === '999999999', `Conta extraída (só dígitos): "${extratoOfx.conta}" (esperado: "999999999")`);
    asserir(extratoOfx.acctIdBruto === '0001999999999', `acctIdBruto preservado: "${extratoOfx.acctIdBruto}"`);

    // Quantidade de transações
    asserir(extratoOfx.transacoes.length === 30, `Exatamente 30 transações no OFX sintético (obtido: ${extratoOfx.transacoes.length})`);

    // 30 FITIDs únicos
    const fitids = extratoOfx.transacoes.map(t => t.fitid).filter(Boolean);
    const fitidsUnicos = new Set(fitids);
    asserir(fitids.length === 30 && fitidsUnicos.size === 30, `30 FITIDs válidos e únicos (únicos: ${fitidsUnicos.size})`);

    // LEDGERBAL -5432,10
    asserir(
      extratoOfx.saldoFinal !== undefined && extratoOfx.saldoFinal.valor === -5432.10,
      `LEDGERBAL extraído com precisão: ${extratoOfx.saldoFinal?.valor} (esperado: -5432.10)`
    );
    asserir(
      extratoOfx.saldoFinal?.data === '2026-10-16',
      `Data do saldo final: ${extratoOfx.saldoFinal?.data} (esperado: "2026-10-16")`
    );

    // Datas (YYYY-MM-DD, 8 primeiros dígitos sem converter fuso)
    const datasValidas = extratoOfx.transacoes.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t.data));
    asserir(datasValidas, 'Todas as 30 datas estão no formato estrito "YYYY-MM-DD"');
    asserir(extratoOfx.transacoes[0].data === '2026-08-03', `Data da 1ª transação: "${extratoOfx.transacoes[0].data}" (esperado: "2026-08-03")`);

    // Vírgula decimal e valores positivos
    asserir(extratoOfx.transacoes[0].valor === 6803.58, `Vírgula decimal da 1ª transação: ${extratoOfx.transacoes[0].valor} (esperado: 6803.58)`);
    asserir(extratoOfx.transacoes[0].tipo === 'credito', 'Tipo da 1ª transação é "credito"');

    // Transação de débito com sinal convertido
    const transacaoDebito = extratoOfx.transacoes[1];
    asserir(transacaoDebito.tipo === 'debito', 'Tipo da 2ª transação é "debito"');
    asserir(transacaoDebito.valor === 20.17, `Valor de débito é sempre positivo: ${transacaoDebito.valor} (esperado: 20.17)`);

    // Favorecido / Contraparte ("Pix Enviado SILVANA COSTA PEREIRA")
    const transacaoSilvana = extratoOfx.transacoes.find(t => t.descricaoOriginal.includes('SILVANA COSTA PEREIRA'));
    asserir(
      transacaoSilvana?.contraparte === 'SILVANA COSTA PEREIRA',
      `Contraparte extraída sem prefixo: "${transacaoSilvana?.contraparte}" (esperado: "SILVANA COSTA PEREIRA")`
    );

    // Valores com 2 casas decimais
    const todas2Casas = extratoOfx.transacoes.every(t => t.valor > 0 && Math.round(t.valor * 100) / 100 === t.valor);
    asserir(todas2Casas, 'Todos os valores das 30 transações são positivos e têm exatamente 2 casas decimais');
  }

  // -------------------------------------------------------------
  // TESTE 2: Parser XLSX Santander Sintético
  // -------------------------------------------------------------
  console.log('\n--- TESTE 2: Arquivo XLSX Sintético (Santander 033) ---');
  if (!fs.existsSync(caminhoXlsx)) {
    console.error(`Arquivo XLSX não encontrado em: ${caminhoXlsx}`);
    falhou++;
  } else {
    const bufferXlsxNode = fs.readFileSync(caminhoXlsx);
    const arrayBufferXlsx = bufferXlsxNode.buffer.slice(
      bufferXlsxNode.byteOffset,
      bufferXlsxNode.byteOffset + bufferXlsxNode.byteLength
    );

    // Testar detecção por conteúdo com nome sem referência a Santander
    const extratoXlsx: ExtratoLido = await lerExtrato(arrayBufferXlsx, 'documento_financeiro.xlsx');

    asserir(extratoXlsx.formato === 'xlsx', 'Formato detectado como "xlsx"');
    asserir(extratoXlsx.bancoCodigo === '033', 'Código do banco é "033" (Santander)');
    asserir(extratoXlsx.bancoNome === 'Santander', 'Nome do banco é "Santander"');
    asserir(
      extratoXlsx.titular === 'EMPRESA FICTICIA EXEMPLO LTDA',
      `Titular extraído: "${extratoXlsx.titular}"`
    );
    asserir(extratoXlsx.conta === '999999999', `Conta extraída (só dígitos): "${extratoXlsx.conta}" (esperado: "999999999")`);
    asserir(
      extratoXlsx.periodo.inicio === '2026-01-01' && extratoXlsx.periodo.fim === '2026-10-15',
      `Período extraído: ${extratoXlsx.periodo.inicio} até ${extratoXlsx.periodo.fim}`
    );

    // Total de transações válidas sem a linha TOTAL
    asserir(extratoXlsx.transacoes.length === 37, `Quantidade de transações: ${extratoXlsx.transacoes.length} (esperado: 37)`);

    // Linha TOTAL ignorada
    const temLinhaTotal = extratoXlsx.transacoes.some(t => t.descricaoOriginal.toUpperCase() === 'TOTAL');
    asserir(!temLinhaTotal, 'Linha "TOTAL" foi ignorada das transações');
    const avisoTotal = extratoXlsx.avisos.some(a => a.includes('TOTAL'));
    asserir(avisoTotal, `Linha TOTAL foi registrada nos avisos do extrato: "${extratoXlsx.avisos[0]}"`);

    // Sem FITID, sem saldo, sem favorecido no XLSX Santander
    asserir(extratoXlsx.saldoFinal === undefined, 'XLSX Santander não possui saldo final (saldoFinal === undefined)');
    const semFitid = extratoXlsx.transacoes.every(t => t.fitid === undefined);
    asserir(semFitid, 'Todas as transações do XLSX possuem fitid undefined');
    const semContraparte = extratoXlsx.transacoes.every(t => t.contraparte === undefined);
    asserir(semContraparte, 'Todas as transações do XLSX possuem contraparte undefined');

    // Dois boletos idênticos de 108,39 no mesmo dia com ordemNoDia 0 e 1
    const boletos108 = extratoXlsx.transacoes.filter(
      t => t.data === '2026-10-15' && t.valor === 108.39 && t.tipo === 'debito'
    );
    asserir(boletos108.length === 2, `Localizados exatamente 2 boletos de 108.39 em 2026-10-15 (obtido: ${boletos108.length})`);
    if (boletos108.length === 2) {
      asserir(boletos108[0].ordemNoDia === 0, `1º boleto de 108.39 tem ordemNoDia: ${boletos108[0].ordemNoDia} (esperado: 0)`);
      asserir(boletos108[1].ordemNoDia === 1, `2º boleto de 108.39 tem ordemNoDia: ${boletos108[1].ordemNoDia} (esperado: 1)`);
    }

    // Datas contendo período completo
    const primeiraData = extratoXlsx.transacoes[0].data;
    const ultimaData = extratoXlsx.transacoes[extratoXlsx.transacoes.length - 1].data;
    asserir(primeiraData === '2026-01-05', `Primeira transação é de 2026-01-05 ("${primeiraData}")`);
    asserir(ultimaData === '2026-10-15', `Última transação é de 2026-10-15 ("${ultimaData}")`);
  }

  // -------------------------------------------------------------
  // TESTE 3: Meses em português (com e sem acento)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 3: Conversor de Datas por Extenso em Português ---');
  asserir(converterDataPt('Quinta, 15 de outubro de 2026') === '2026-10-15', 'Quinta, 15 de outubro de 2026 -> 2026-10-15');
  asserir(converterDataPt('Segunda, 05 de janeiro de 2026') === '2026-01-05', 'Segunda, 05 de janeiro de 2026 -> 2026-01-05');
  asserir(converterDataPt('10 de março de 2026') === '2026-03-10', '10 de março de 2026 -> 2026-03-10 (com cedilha/acento)');
  asserir(converterDataPt('10 de marco de 2026') === '2026-03-10', '10 de marco de 2026 -> 2026-03-10 (sem acento)');
  asserir(converterDataPt('28 de fevereiro de 2026') === '2026-02-28', '28 de fevereiro de 2026 -> 2026-02-28');
  asserir(converterDataPt('01/01/2026') === '2026-01-01', '01/01/2026 -> 2026-01-01 (formato numérico)');

  // -------------------------------------------------------------
  // TESTE 4: Normalização de Descrições
  // -------------------------------------------------------------
  console.log('\n--- TESTE 4: Normalização de Descrição ---');
  asserir(
    normalizarDescricao('Pix Enviado SILVANA COSTA PEREIRA') === 'PIX ENVIADO SILVANA COSTA PEREIRA',
    'Remove acentos e maiúsculas'
  );
  asserir(
    normalizarDescricao('Cr Cob Bloq Comp Conf Recebimento 0001/000123456') === 'CR COB BLOQ COMP CONF RECEBIMENTO',
    'Remove códigos variáveis tipo 0001/000123456'
  );
  asserir(
    normalizarDescricao('Compra Cartao Deb Mc 05/08 AUTO POSTO EXEMPLO') === 'COMPRA CARTAO DEB MC AUTO POSTO EXEMPLO',
    'Remove datas parciais 05/08'
  );
  asserir(
    normalizarDescricao('Pix Recebido 13248087480') === 'PIX RECEBIDO',
    'Remove CPFs/sequências numéricas variáveis'
  );
  asserir(
    normalizarDescricao('   PAGAMENTO   DE   BOLETO   ') === 'PAGAMENTO DE BOLETO',
    'Colapsa espaços múltiplos'
  );

  // -------------------------------------------------------------
  // TESTE 5: Parser de Valores Numéricos (Vírgula e Ponto)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 5: Parser de Valores Monetários ---');
  asserir(parsearValorOfx('-4703,31') === -4703.31, '-4703,31 -> -4703.31');
  asserir(parsearValorOfx('6803,58') === 6803.58, '6803,58 -> 6803.58');
  asserir(parsearValorOfx('1.234,56') === 1234.56, '1.234,56 -> 1234.56');
  asserir(parsearValorOfx('-5432,10') === -5432.10, '-5432,10 -> -5432.10');

  // -------------------------------------------------------------
  // TESTE 6: Tratamento de Banco/Formato Desconhecido
  // -------------------------------------------------------------
  console.log('\n--- TESTE 6: ErroBancoNaoSuportado em Arquivo Desconhecido ---');
  const bufferInvalido = new TextEncoder().encode('Arquivo de texto qualquer sem assinatura bancaria');
  try {
    await lerExtrato(bufferInvalido.buffer, 'teste.txt');
    asserir(false, 'Deveria lançar ErroBancoNaoSuportado para arquivo desconhecido');
  } catch (erro) {
    asserir(
      erro instanceof ErroBancoNaoSuportado,
      `Lançou ErroBancoNaoSuportado com mensagem em português: "${(erro as Error).message}"`
    );
  }

  // -------------------------------------------------------------
  // RESUMO FINAL
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` RESULTADO FINAL: ${passou} PASSOU / ${falhou} FALHOU`);
  console.log('================================================================');

  if (falhou > 0) {
    process.exit(1);
  }
}

executarTestes().catch(err => {
  console.error('Erro fatal durante a execução dos testes:', err);
  process.exit(1);
});
