// MT Solar - Gestão Financeira
// Testes Automatizados da PARTE 24B: Parser Sicoob PDF com Contraparte, Mensagem e Futuros
// Execução: npx tsx scripts/test_parte_24B.ts

import fs from 'fs';
import path from 'path';
import { parsearSicoobPdf, ErroConciliacao } from '../src/utils/extrato/parsers/sicoobPdf';
import { extrairItensPdf } from '../src/utils/extrato/leitorPdf';
import { gerarDescricaoCurta, formatarObservacoesImportacao } from '../src/utils/extrato/observacoesHelper';
import { ItemPdf, TransacaoExtrato } from '../src/utils/extrato/tipos';

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

async function executarTestes() {
  console.log('🧪 Iniciando testes da PARTE 24B — Parser Sicoob PDF com metadados ricos e lançamentos futuros\n');

  // Carregar fixture binário sintético
  const caminhoPdf = path.resolve('scripts/fixtures/sicoob_sintetico_completo.pdf');
  asserir(fs.existsSync(caminhoPdf), 'Arquivo de fixture sicoob_sintetico_completo.pdf existe');

  const buffer = fs.readFileSync(caminhoPdf);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  // Extrair itens usando o leitor oficial do sistema
  const itens = await extrairItensPdf(arrayBuffer);
  asserir(itens.length > 0, `Itens extraídos do PDF: ${itens.length}`);

  // =========================================================================
  // TESTE 1: Parser executa sem erro de conciliação
  // =========================================================================
  console.log('\n--- TESTE 1: Execução e conferência matemática de saldo ---');
  let extrato: ReturnType<typeof parsearSicoobPdf>;
  try {
    extrato = parsearSicoobPdf(itens, { cnpjEmpresa: '34.892.105/0001-44' });
    asserir(true, 'Extrato parseado com sucesso sem disparar ErroConciliacao');
  } catch (err: any) {
    asserir(false, 'Extrato não deveria falhar', err?.message);
    return;
  }

  // Verificações de cabeçalho
  asserir(extrato.bancoCodigo === '756', 'Código do banco é 756 (Sicoob)');
  asserir(extrato.bancoNome === 'Sicoob', 'Nome do banco é Sicoob');
  asserir(extrato.agencia === '1234', `Agência esperada "1234", obtida "${extrato.agencia}"`);
  asserir(extrato.conta === '9876543', `Conta esperada "9876543", obtida "${extrato.conta}"`);
  asserir(extrato.periodo.inicio === '2026-10-01', `Início do período: ${extrato.periodo.inicio}`);
  asserir(extrato.periodo.fim === '2026-10-31', `Fim do período: ${extrato.periodo.fim}`);
  asserir(extrato.saldoFinal?.valor === 11669.50, `Saldo final esperado 11669.50, obtido ${extrato.saldoFinal?.valor}`);

  // =========================================================================
  // TESTE 2: Quantidade de transações correntes (excluindo futuros e RESUMO)
  // =========================================================================
  console.log('\n--- TESTE 2: Contagem de transações (excluindo RESUMO e FUTUROS) ---');
  asserir(
    extrato.transacoes.length === 8,
    `Esperado exatamente 8 transações correntes, obtido ${extrato.transacoes.length}`
  );

  // =========================================================================
  // TESTE 3: M1 - PIX EMIT.OUTRA IF (C/D colado, CPF mascarado, mensagem, DOC)
  // =========================================================================
  console.log('\n--- TESTE 3: M1 - Pix emitido com mensagem e CPF mascarado ---');
  const t1 = extrato.transacoes[0];
  asserir(t1.data === '2026-10-02', `Data t1: ${t1.data}`);
  asserir(t1.valor === 500.00, `Valor t1: ${t1.valor}`);
  asserir(t1.tipo === 'debito', `Tipo t1: ${t1.tipo}`);
  asserir(t1.tipoOperacaoBanco === 'pix_emitido', `tipoOperacaoBanco t1: ${t1.tipoOperacaoBanco}`);
  asserir(t1.contraparteDocumento === '***.791.454-**', `Documento mascarado t1: ${t1.contraparteDocumento}`);
  asserir(t1.documentoMascarado === true, `documentoMascarado t1 deve ser true`);
  asserir(t1.mensagemUsuario === 'almoco', `Mensagem do usuário t1: ${t1.mensagemUsuario}`);
  asserir(t1.documento === 'Pix', `DOC t1: ${t1.documento}`);

  // =========================================================================
  // TESTE 4: M2 - PIX RECEB.OUTRA IF (C/D separado, DOC colado, nome pagador)
  // =========================================================================
  console.log('\n--- TESTE 4: M2 - Pix recebido com nome do pagador e DOC colado ---');
  const t2 = extrato.transacoes[1];
  asserir(t2.data === '2026-10-03', `Data t2: ${t2.data}`);
  asserir(t2.valor === 1200.00, `Valor t2: ${t2.valor}`);
  asserir(t2.tipo === 'credito', `Tipo t2: ${t2.tipo}`);
  asserir(t2.tipoOperacaoBanco === 'pix_recebido', `tipoOperacaoBanco t2: ${t2.tipoOperacaoBanco}`);
  asserir(t2.contraparteNome === 'JOAO PEREIRA FICTICIO', `contraparteNome t2: ${t2.contraparteNome}`);
  asserir(t2.contraparteDocumento === '***.537.894-**', `Documento descolado t2: ${t2.contraparteDocumento}`);
  asserir(t2.documentoMascarado === true, `documentoMascarado t2 deve ser true`);
  asserir(t2.documento === 'Pix', `DOC extraído de DOC colado t2: ${t2.documento}`);

  // =========================================================================
  // TESTE 5: M3, M4, M5 - 3 Transferências MSM para o próprio titular
  // =========================================================================
  console.log('\n--- TESTE 5: M3..M5 - Transferências mesma titularidade (própria empresa) ---');
  const t3 = extrato.transacoes[2];
  const t4 = extrato.transacoes[3];
  const t5 = extrato.transacoes[4];

  asserir(t3.tipoOperacaoBanco === 'pix_emitido', 't3 é pix_emitido');
  asserir(t3.ehPropriaEmpresa === true, 't3 ehPropriaEmpresa deve ser true (IF-MSM e CNPJ próprio)');
  asserir(t4.ehPropriaEmpresa === true, 't4 ehPropriaEmpresa deve ser true');
  asserir(t5.ehPropriaEmpresa === true, 't5 ehPropriaEmpresa deve ser true');
  asserir(t3.valor === 300.00 && t4.valor === 200.00 && t5.valor === 100.00, 'Valores de t3, t4 e t5 corretos');

  // =========================================================================
  // TESTE 6: M6 - DB.TR.C.DIF.TIT.INT com FAV (próprio titular NÃO é contraparte)
  // =========================================================================
  console.log('\n--- TESTE 6: M6 - DB.TR.C.DIF.TIT.INT (contraparte é FAV, titular ignorado) ---');
  const t6 = extrato.transacoes[5];
  asserir(t6.tipoOperacaoBanco === 'db_tr_dif_tit', `tipoOperacaoBanco t6: ${t6.tipoOperacaoBanco}`);
  asserir(t6.favorecido === 'FORNECEDOR ESTRUTURAS SOLAR LTDA', `favorecido t6: ${t6.favorecido}`);
  asserir(t6.contraparte === 'FORNECEDOR ESTRUTURAS SOLAR LTDA', `contraparte t6: ${t6.contraparte}`);
  asserir(t6.contraparteNome !== 'EMPRESA FICTICIA SOLAR LTDA', 'Titular não virou contraparteNome');
  asserir(t6.documento === '98765432', `DOC t6: ${t6.documento}`);

  // =========================================================================
  // TESTE 7: M7 - DÉB.TIT.COMPE.EFETI (boleto com mensagem multilinha)
  // =========================================================================
  console.log('\n--- TESTE 7: M7 - Título/boleto com mensagem multilinha ---');
  const t7 = extrato.transacoes[6];
  asserir(t7.tipoOperacaoBanco === 'titulo_boleto', `tipoOperacaoBanco t7: ${t7.tipoOperacaoBanco}`);
  asserir(
    Boolean(t7.mensagemUsuario?.includes('Apartamento de marcos') && t7.mensagemUsuario?.includes('aluguel outubro')),
    `Mensagem multilinha t7 capturada: "${t7.mensagemUsuario}"`
  );
  asserir(t7.documento === '12345678', `DOC t7: ${t7.documento}`);

  // =========================================================================
  // TESTE 8: M8 - PIX RECEB com CNPJ com espaço (não própria empresa)
  // =========================================================================
  console.log('\n--- TESTE 8: M8 - Pix recebido com CNPJ com espaço de terceiro ---');
  const t8 = extrato.transacoes[7];
  asserir(t8.contraparteNome === 'CLIENTE PARQUE SOLAR SA', `contraparteNome t8: ${t8.contraparteNome}`);
  asserir(t8.contraparteDocumento === '11.357.423 0001-80', `contraparteDocumento t8: ${t8.contraparteDocumento}`);
  asserir(t8.documentoMascarado === false, 'documentoMascarado t8 deve ser false para CNPJ');
  asserir(t8.ehPropriaEmpresa === false, 'ehPropriaEmpresa t8 deve ser false');

  // =========================================================================
  // TESTE 9: Seção RESUMO não gerou transações
  // =========================================================================
  console.log('\n--- TESTE 9: Seção RESUMO não gera transações ---');
  const temResumoTransacao = extrato.transacoes.some(t =>
    t.descricaoOriginal.toUpperCase().includes('RESUMO') ||
    t.descricaoOriginal.toUpperCase().includes('TARIFAS VENCIDAS')
  );
  asserir(!temResumoTransacao, 'Nenhuma linha do bloco RESUMO foi lida como transação');

  // =========================================================================
  // TESTE 10: Seção LANÇAMENTOS FUTUROS
  // =========================================================================
  console.log('\n--- TESTE 10: Seção LANÇAMENTOS FUTUROS ---');
  asserir(Boolean(extrato.lancamentosFuturos), 'extrato.lancamentosFuturos está preenchido');
  asserir(
    extrato.lancamentosFuturos?.length === 2,
    `Esperado exatamente 2 lançamentos futuros, obtido ${extrato.lancamentosFuturos?.length}`
  );

  const f1 = extrato.lancamentosFuturos?.[0];
  asserir(f1?.data === '2026-11-17', `Data f1 convertida de 17/11/26 para 2026-11-17: ${f1?.data}`);
  asserir(f1?.valor === 68.17, `Valor f1: ${f1?.valor}`);
  asserir(f1?.tipo === 'debito', `Tipo f1: ${f1?.tipo}`);
  asserir(f1?.documento === '12507989', `Documento f1: ${f1?.documento}`);

  const f2 = extrato.lancamentosFuturos?.[1];
  asserir(f2?.data === '2026-11-20', `Data f2: ${f2?.data}`);
  asserir(f2?.valor === 125.00, `Valor f2: ${f2?.valor}`);
  asserir(f2?.tipo === 'debito', `Tipo f2: ${f2?.tipo}`);
  asserir(f2?.documento === '99887766', `Documento f2: ${f2?.documento}`);

  // Garantir que futuros NÃO entraram em transacoes
  const temFuturoEmTransacoes = extrato.transacoes.some(t =>
    t.documento === '12507989' || t.documento === '99887766'
  );
  asserir(!temFuturoEmTransacoes, 'Lançamentos futuros NÃO estão na lista de transações correntes');

  // =========================================================================
  // TESTE 11: Descrição curta (gerarDescricaoCurta)
  // =========================================================================
  console.log('\n--- TESTE 11: gerarDescricaoCurta com novas regras ---');

  // com mensagem: "Pix – <mensagem>"
  const descComMsg = gerarDescricaoCurta(t1);
  asserir(descComMsg === 'Pix – almoco', `Com mensagem esperada "Pix – almoco", obtida "${descComMsg}"`);

  // com nome: "Pix – <nome>"
  const descComNome = gerarDescricaoCurta(t2);
  asserir(descComNome === 'Pix – JOAO PEREIRA FICTICIO', `Com nome esperada "Pix – JOAO PEREIRA FICTICIO", obtida "${descComNome}"`);

  // só documento mascarado: "Pix enviado – ***.913.164-**"
  const transacaoSoDocMascarado: TransacaoExtrato = {
    ...t1,
    mensagemUsuario: undefined,
    contraparteNome: undefined,
    contraparteDocumento: '***.913.164-**',
    documentoMascarado: true,
  };
  const descSoDoc = gerarDescricaoCurta(transacaoSoDocMascarado);
  asserir(descSoDoc === 'Pix enviado – ***.913.164-**', `Só documento esperada "Pix enviado – ***.913.164-**", obtida "${descSoDoc}"`);

  // FAV: "Transferência – <favorecido>"
  const descFav = gerarDescricaoCurta(t6);
  asserir(
    descFav === 'Transferência – FORNECEDOR ESTRUTURAS SOLAR LTDA',
    `FAV esperada "Transferência – FORNECEDOR ESTRUTURAS SOLAR LTDA", obtida "${descFav}"`
  );

  // títulos com mensagem: "Título – <mensagem>"
  const descTitulo = gerarDescricaoCurta(t7);
  asserir(
    descTitulo.startsWith('Título – Apartamento de marcos'),
    `Título com mensagem esperada "Título – ...", obtida "${descTitulo}"`
  );

  // =========================================================================
  // TESTE 12: Observações detalhadas (formatarObservacoesImportacao)
  // =========================================================================
  console.log('\n--- TESTE 12: formatarObservacoesImportacao com novos campos ---');
  const obsT1 = formatarObservacoesImportacao({
    descricaoOriginal: t1.descricaoOriginal,
    contraparte: t1.contraparte,
    documento: t1.documento,
    bancoCodigo: '756',
    nomeArquivo: 'extrato.pdf',
    formato: 'pdf',
    loteId: 'LOTE-TESTE',
    tipoOperacaoBanco: t1.tipoOperacaoBanco,
    contraparteDocumento: t1.contraparteDocumento,
    mensagemUsuario: t1.mensagemUsuario,
  });

  asserir(obsT1.includes('• Tipo de operação: pix_emitido'), 'Observações contém tipo de operação');
  asserir(obsT1.includes('• Documento da contraparte: ***.791.454-**'), 'Observações contém documento da contraparte');
  asserir(obsT1.includes('• Mensagem: almoco'), 'Observações contém mensagem do usuário');
  asserir(obsT1.includes('• DOC: Pix'), 'Observações contém DOC');

  // =========================================================================
  // TESTE 13: Idempotência do parser
  // =========================================================================
  console.log('\n--- TESTE 13: Idempotência ---');
  const extrato2 = parsearSicoobPdf(itens, { cnpjEmpresa: '34.892.105/0001-44' });
  asserir(
    extrato2.transacoes.length === extrato.transacoes.length,
    'Mesmo número de transações em duas execuções sucessivas'
  );
  asserir(
    extrato2.saldoFinal?.valor === extrato.saldoFinal?.valor,
    'Mesmo saldo final em duas execuções sucessivas'
  );

  // Resumo final
  console.log(`\n=======================================================`);
  console.log(`RESULTADO FINAL: ${passou} asserções passaram, ${falhou} falharam.`);
  console.log(`=======================================================`);

  if (falhou > 0) {
    process.exit(1);
  }
}

executarTestes().catch(err => {
  console.error('Erro fatal durante a execução dos testes:', err);
  process.exit(1);
});
