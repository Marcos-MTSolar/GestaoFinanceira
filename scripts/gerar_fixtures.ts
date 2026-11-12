// MT Solar - Gestão Financeira
// Gerador de Fixtures Sintéticos para Testes de Extrato (Parte 21A-bis / 21A-ter)
// Fixtures 100% sintéticos (sem dados reais confidenciais), versionáveis e reproduzíveis.
// Agência 0001, Conta 99999999-9, nomes e saldos 100% fictícios.

import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const dirFixtures = path.resolve('scripts/fixtures');
if (!fs.existsSync(dirFixtures)) {
  fs.mkdirSync(dirFixtures, { recursive: true });
}

// ----------------------------------------------------------------------------
// 1. OFX SANTANDER SINTÉTICO (SGML, CHARSET 1252, vírgula decimal, LEDGERBAL)
// ----------------------------------------------------------------------------
const ofxContent = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20261016192220[-3:GMT]
<LANGUAGE>POR
<FI>
<ORG>Santander
<FID>033
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>033
<BRANCHID>0001
<ACCTID>0001999999999
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260803120000[-3:GMT]
<DTEND>20261016120000[-3:GMT]
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260803120000[-3:GMT]
<TRNAMT>6803,58
<FITID>FITID-SINT-001
<CHECKNUM>000123456
<MEMO>CR COB BLOQ COMP CONF RECEBIMENTO 0001/000123456
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260803120000[-3:GMT]
<TRNAMT>-20,17
<FITID>FITID-SINT-002
<MEMO>TARIFA BANCARIA CESTA BASICA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260804120000[-3:GMT]
<TRNAMT>-4703,31
<FITID>FITID-SINT-003
<MEMO>PIX ENVIADO SILVANA COSTA PEREIRA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260810120000[-3:GMT]
<TRNAMT>-1500,00
<FITID>FITID-SINT-004
<MEMO>APLICACAO CONTAMAX AUTOMATICO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260815120000[-3:GMT]
<TRNAMT>800,00
<FITID>FITID-SINT-005
<MEMO>RESGATE CONTAMAX AUTOMATICO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260820120000[-3:GMT]
<TRNAMT>-50,00
<FITID>FITID-SINT-006
<MEMO>IOF OPERACOES DE CREDITO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260901120000[-3:GMT]
<TRNAMT>1200,00
<FITID>FITID-SINT-007
<MEMO>PIX RECEBIDO CLIENTE EXEMPLO SOLAR
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260905120000[-3:GMT]
<TRNAMT>-350,00
<FITID>FITID-SINT-008
<MEMO>TED ENVIADA FORNECEDOR MODULOS SOLAR
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260910120000[-3:GMT]
<TRNAMT>-120,50
<FITID>FITID-SINT-009
<MEMO>PAGAMENTO DE BOLETO ENEL DISTRIBUICAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260915120000[-3:GMT]
<TRNAMT>-500,00
<FITID>FITID-SINT-010
<MEMO>APLICACAO CONTAMAX AUTOMATICO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260920120000[-3:GMT]
<TRNAMT>300,00
<FITID>FITID-SINT-011
<MEMO>RESGATE CONTAMAX AUTOMATICO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260925120000[-3:GMT]
<TRNAMT>-85,00
<FITID>FITID-SINT-012
<MEMO>TARIFA MENSALIDADE CONTA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260928120000[-3:GMT]
<TRNAMT>-210,00
<FITID>FITID-SINT-013
<MEMO>PIX ENVIADO POSTO GASOLINA MATRIZ
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260930120000[-3:GMT]
<TRNAMT>4500,00
<FITID>FITID-SINT-014
<MEMO>PIX RECEBIDO PROJETO RESIDENCIAL 01
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261001120000[-3:GMT]
<TRNAMT>-1300,00
<FITID>FITID-SINT-015
<MEMO>TED ENVIADA FABRICANTE INVERSOR BRASIL
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261002120000[-3:GMT]
<TRNAMT>-45,00
<FITID>FITID-SINT-016
<MEMO>TARIFA TED INTERNET BANKING
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005120000[-3:GMT]
<TRNAMT>-320,00
<FITID>FITID-SINT-017
<MEMO>PIX ENVIADO ALIMENTACAO EQUIPE CAMPO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261007120000[-3:GMT]
<TRNAMT>2800,00
<FITID>FITID-SINT-018
<MEMO>PIX RECEBIDO PROJETO COMERCIAL USINA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261008120000[-3:GMT]
<TRNAMT>-1800,00
<FITID>FITID-SINT-019
<MEMO>PAGAMENTO FORNECEDOR ESTRUTURAS ALUMINIO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261009120000[-3:GMT]
<TRNAMT>-450,00
<FITID>FITID-SINT-020
<MEMO>APLICACAO CONTAMAX AUTOMATICO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261010120000[-3:GMT]
<TRNAMT>450,00
<FITID>FITID-SINT-021
<MEMO>RESGATE CONTAMAX AUTOMATICO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261011120000[-3:GMT]
<TRNAMT>-75,00
<FITID>FITID-SINT-022
<MEMO>PAGAMENTO AGUA E SANEAMENTO MATRIZ
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261015120000[-3:GMT]
<TRNAMT>-108,39
<FITID>FITID-SINT-023
<MEMO>PAGAMENTO TITULO BANCO SANTANDER
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261015120000[-3:GMT]
<TRNAMT>-108,39
<FITID>FITID-SINT-024
<MEMO>PAGAMENTO TITULO BANCO SANTANDER
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261015120000[-3:GMT]
<TRNAMT>-850,00
<FITID>FITID-SINT-025
<MEMO>PIX ENVIADO MANUTENCAO VEICULO OPERACIONAL
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261015120000[-3:GMT]
<TRNAMT>1500,00
<FITID>FITID-SINT-026
<MEMO>PIX RECEBIDO SINAL INSTALACAO PAINEL
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261015120000[-3:GMT]
<TRNAMT>-620,00
<FITID>FITID-SINT-027
<MEMO>PAGAMENTO CARTAO DEB MC AUTO POSTO EXEMPLO
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261016120000[-3:GMT]
<TRNAMT>-150,00
<FITID>FITID-SINT-028
<MEMO>PAGAMENTO INTERNET FIBRA ESCRITORIO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261016120000[-3:GMT]
<TRNAMT>950,00
<FITID>FITID-SINT-029
<MEMO>PIX RECEBIDO CONSULTORIA ENGENHARIA SOLAR
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261016120000[-3:GMT]
<TRNAMT>-3200,00
<FITID>FITID-SINT-030
<MEMO>TED ENVIADA DISTRIBUIDOR CABOS SOLARES
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>-5432,10
<DTASOF>20261016120000[-3:GMT]
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

const caminhoOfx = path.join(dirFixtures, 'extrato_sintetico_santander.ofx');
fs.writeFileSync(caminhoOfx, ofxContent, 'latin1');
console.log(`✓ Fixture OFX gerado: ${caminhoOfx} (30 transações, Agência 0001, Conta 999999999)`);

// ----------------------------------------------------------------------------
// 2. XLSX SANTANDER SINTÉTICO (Cabeçalho, datas por extenso, linha TOTAL)
// ----------------------------------------------------------------------------
const linhasPlanilha: (string | number)[][] = [
  ['EXTRATO DE CONTA CORRENTE', '', '', ''],
  ['EMPRESA FICTICIA EXEMPLO LTDA', 'Conta: 99999999-9', '', ''],
  ['Extrato de 01/01/2026 a 15/10/2026', '', '', ''],
  ['', '', '', ''],
  ['Data', 'Descrição', 'Crédito (R$)', 'Débito (R$)'],

  // Transações anteriores a Agosto/2026 (exclusivas do XLSX)
  ['Segunda, 05 de janeiro de 2026', 'PIX RECEBIDO ADIANTAMENTO CONTRATO 01', '5000,00', ''],
  ['Segunda, 12 de janeiro de 2026', 'TED ENVIADA COMPRA CABOS FOTOVOLTAICOS', '', '2100,00'],
  ['Sexta, 20 de fevereiro de 2026', 'PIX RECEBIDO PARCELA OBRA FAZENDA', '4200,00', ''],
  ['Sexta, 27 de fevereiro de 2026', 'PAGAMENTO ENEL DISTRIBUICAO MATRIZ', '', '180,50'],
  ['Terça, 10 de março de 2026', 'PIX ENVIADO COMPONENTES ELETRICOS', '', '350,00'],
  ['Quinta, 16 de abril de 2026', 'PIX RECEBIDO CONSULTORIA PROJETO', '1800,00', ''],
  ['Quarta, 20 de maio de 2026', 'TED ENVIADA ESTRUTURAS FIXACAO', '', '1450,00'],
  ['Segunda, 15 de junho de 2026', 'PIX RECEBIDO INSTALACAO SISTEMA RESIDENCIAL', '3500,00', ''],
  ['Sexta, 10 de julho de 2026', 'PAGAMENTO BOLETO SEGURO EQUIPAMENTOS', '', '420,00'],
  ['Quarta, 29 de julho de 2026', 'TARIFA MANUTENCAO CONTA JURIDICA', '', '85,00'],

  // Transações de Agosto a 15/Outubro que casam com o OFX (para testar deduplicação e enriquecimento)
  ['Segunda, 03 de agosto de 2026', 'CR COB BLOQ COMP CONF RECEBIMENTO 0001/000123456', '6803,58', ''],
  ['Segunda, 03 de agosto de 2026', 'TARIFA BANCARIA CESTA BASICA', '', '20,17'],
  ['Terça, 04 de agosto de 2026', 'PIX ENVIADO SILVANA COSTA PEREIRA', '', '4703,31'],
  ['Segunda, 10 de agosto de 2026', 'APLICACAO CONTAMAX AUTOMATICO', '', '1500,00'],
  ['Sábado, 15 de agosto de 2026', 'RESGATE CONTAMAX AUTOMATICO', '800,00', ''],
  ['Quinta, 20 de agosto de 2026', 'IOF OPERACOES DE CREDITO', '', '50,00'],
  ['Terça, 01 de setembro de 2026', 'PIX RECEBIDO CLIENTE EXEMPLO SOLAR', '1200,00', ''],
  ['Sábado, 05 de setembro de 2026', 'TED ENVIADA FORNECEDOR MODULOS SOLAR', '', '350,00'],
  ['Quinta, 10 de setembro de 2026', 'PAGAMENTO DE BOLETO ENEL DISTRIBUICAO', '', '120,50'],
  ['Terça, 15 de setembro de 2026', 'APLICACAO CONTAMAX AUTOMATICO', '', '500,00'],
  ['Domingo, 20 de setembro de 2026', 'RESGATE CONTAMAX AUTOMATICO', '300,00', ''],
  ['Sexta, 25 de setembro de 2026', 'TARIFA MENSALIDADE CONTA', '', '85,00'],
  ['Segunda, 28 de setembro de 2026', 'PIX ENVIADO POSTO GASOLINA MATRIZ', '', '210,00'],
  ['Quarta, 30 de setembro de 2026', 'PIX RECEBIDO PROJETO RESIDENCIAL 01', '4500,00', ''],
  ['Quinta, 01 de outubro de 2026', 'TED ENVIADA FABRICANTE INVERSOR BRASIL', '', '1300,00'],
  ['Sexta, 02 de outubro de 2026', 'TARIFA TED INTERNET BANKING', '', '45,00'],
  ['Segunda, 05 de outubro de 2026', 'PIX ENVIADO ALIMENTACAO EQUIPE CAMPO', '', '320,00'],
  ['Quarta, 07 de outubro de 2026', 'PIX RECEBIDO PROJETO COMERCIAL USINA', '2800,00', ''],
  ['Quinta, 08 de outubro de 2026', 'PAGAMENTO FORNECEDOR ESTRUTURAS ALUMINIO', '', '1800,00'],
  ['Sexta, 09 de outubro de 2026', 'APLICACAO CONTAMAX AUTOMATICO', '', '450,00'],
  ['Sábado, 10 de outubro de 2026', 'RESGATE CONTAMAX AUTOMATICO', '450,00', ''],
  ['Domingo, 11 de outubro de 2026', 'PAGAMENTO AGUA E SANEAMENTO MATRIZ', '', '75,00'],

  // Dois boletos idênticos de 108,39 no mesmo dia 15/10/2026
  ['Quinta, 15 de outubro de 2026', 'PAGAMENTO TITULO BANCO SANTANDER', '', '108,39'],
  ['Quinta, 15 de outubro de 2026', 'PAGAMENTO TITULO BANCO SANTANDER', '', '108,39'],
  ['Quinta, 15 de outubro de 2026', 'PIX ENVIADO MANUTENCAO VEICULO OPERACIONAL', '', '850,00'],
  ['Quinta, 15 de outubro de 2026', 'PIX RECEBIDO SINAL INSTALACAO PAINEL', '1500,00', ''],
  ['Quinta, 15 de outubro de 2026', 'PAGAMENTO CARTAO DEB MC AUTO POSTO EXEMPLO', '', '620,00'],

  // Linha de TOTAL obrigatória do padrão Santander
  ['TOTAL', 'TOTAL', '37053,58', '21092,88'],
];

const worksheet = XLSX.utils.aoa_to_sheet(linhasPlanilha);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Extrato');

const caminhoXlsx = path.join(dirFixtures, 'extrato_sintetico_santander.xlsx');
XLSX.writeFile(workbook, caminhoXlsx);
console.log(`✓ Fixture XLSX gerado: ${caminhoXlsx} (37 transações válidas + linha TOTAL)`);

// ----------------------------------------------------------------------------
// 3. PDF SICOOB SINTÉTICO COMPLETO (Parte 24B - Quirks reais, metadados ricos e futuros)
// ----------------------------------------------------------------------------
export async function gerarFixtureSicoobPdfCompleto(): Promise<string> {
  const doc = await PDFDocument.create();
  const alturaA4 = 841.89;
  const page = doc.addPage([595.28, alturaA4]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const toBottom = (yTopo: number) => alturaA4 - yTopo;

  const draw = (texto: string, x: number, yTopo: number, size = 9) => {
    page.drawText(texto, {
      x,
      y: toBottom(yTopo),
      size,
      font,
    });
  };

  // Cabeçalho
  draw('SICOOB', 115, 25, 11);
  draw('SISTEMA DE COOPERATIVAS DE CRÉDITO DO BRASIL', 160, 25, 9);
  draw('SISBR', 450, 25, 9);
  draw('EXTRATO CONTA CORRENTE', 115, 42, 10);
  draw('COOP.:', 115, 58, 9);
  draw('1234-5 / SICOOB EXEMPLO', 160, 58, 9);
  draw('CONTA:', 115, 72, 9);
  draw('987.654-3 / EMPRESA FICTICIA SOLAR LTDA', 160, 72, 9);
  draw('CNPJ:', 115, 86, 9);
  draw('34.892.105/0001-44', 160, 86, 9);
  draw('PERÍODO:', 115, 100, 9);
  draw('01/10/2026 - 31/10/2026', 160, 100, 9);
  draw('HISTÓRICO DE MOVIMENTAÇÃO', 115, 118, 10);
  draw('DATA', 115, 134, 9);
  draw('HISTÓRICO', 154, 134, 9);
  draw('VALOR', 430, 134, 9);

  // Saldo Anterior
  let y = 150;
  draw('SALDO ANTERIOR', 154, y);
  draw('10.000,00C', 430, y);

  // M1: PIX EMIT.OUTRA IF (C/D colado no valor)
  y += 16;
  draw('02/10', 115, y);
  draw('PIX EMIT.OUTRA IF', 154, y);
  draw('500,00D', 430, y);
  y += 10;
  draw('Pagamento Pix', 154, y);
  y += 10;
  draw('***.791.454-**', 154, y);
  y += 10;
  draw('almoco', 154, y);
  y += 10;
  draw('DOC.: Pix', 154, y);

  // M2: PIX RECEB.OUTRA IF (C/D em item separado + DOC colado)
  y += 16;
  draw('03/10', 115, y);
  draw('PIX RECEB.OUTRA IF', 154, y);
  draw('1.200,00', 430, y);
  draw('C', 473, y);
  y += 10;
  draw('Recebimento Pix', 154, y);
  y += 10;
  draw('JOAO PEREIRA FICTICIO', 154, y);
  y += 10;
  draw('***.537.894-**DOC.: Pix', 154, y);

  // M3: 1ª Transferência MSM para o próprio CNPJ
  y += 16;
  draw('04/10', 115, y);
  draw('PIX.EMIT.OUT IF-MSM', 154, y);
  draw('300,00D', 430, y);
  y += 10;
  draw('Transferência Pix', 154, y);
  y += 10;
  draw('EMPRESA FICTICIA SOLAR LTDA', 154, y);
  y += 10;
  draw('34.892.105 0001-44', 154, y);
  y += 10;
  draw('DOC.: Pix', 154, y);

  // M4: 2ª Transferência MSM para o próprio CNPJ
  y += 16;
  draw('04/10', 115, y);
  draw('PIX.EMIT.OUT IF-MSM', 154, y);
  draw('200,00D', 430, y);
  y += 10;
  draw('Transferência Pix', 154, y);
  y += 10;
  draw('EMPRESA FICTICIA SOLAR LTDA', 154, y);
  y += 10;
  draw('34.892.105 0001-44', 154, y);
  y += 10;
  draw('DOC.: Pix', 154, y);

  // M5: 3ª Transferência MSM para o próprio CNPJ
  y += 16;
  draw('04/10', 115, y);
  draw('PIX.EMIT.OUT IF-MSM', 154, y);
  draw('100,00D', 430, y);
  y += 10;
  draw('Transferência Pix', 154, y);
  y += 10;
  draw('EMPRESA FICTICIA SOLAR LTDA', 154, y);
  y += 10;
  draw('34.892.105 0001-44', 154, y);
  y += 10;
  draw('DOC.: Pix', 154, y);

  // M6: DB.TR.C.DIF.TIT.INT com FAV
  y += 16;
  draw('05/10', 115, y);
  draw('DB.TR.C.DIF.TIT.INT', 154, y);
  draw('750,00D', 430, y);
  y += 10;
  draw('FAV.: FORNECEDOR ESTRUTURAS SOLAR LTDA', 154, y);
  y += 10;
  draw('Transferência Pix', 154, y);
  y += 10;
  draw('EMPRESA FICTICIA SOLAR LTDA', 154, y);
  y += 10;
  draw('34.892.105 0001-44', 154, y);
  y += 10;
  draw('DOC.: 98765432', 154, y);

  // M7: DÉB.TIT.COMPE.EFETI (boleto com mensagem multilinha)
  y += 16;
  draw('06/10', 115, y);
  draw('DÉB.TIT.COMPE.EFETI', 154, y);
  draw('180,50D', 430, y);
  y += 10;
  draw('Apartamento de marcos', 154, y);
  y += 10;
  draw('aluguel outubro', 154, y);
  y += 10;
  draw('DOC.: 12345678', 154, y);

  // M8: PIX RECEB.OUTRA IF (CNPJ com espaço de terceiro)
  y += 16;
  draw('07/10', 115, y);
  draw('PIX RECEB.OUTRA IF', 154, y);
  draw('2.500,00C', 430, y);
  y += 10;
  draw('Recebimento Pix', 154, y);
  y += 10;
  draw('CLIENTE PARQUE SOLAR SA', 154, y);
  y += 10;
  draw('11.357.423 0001-80', 154, y);
  y += 10;
  draw('DOC.: Pix', 154, y);

  // SALDO DO DIA (07/10)
  // 10000 - 500 + 1200 - 300 - 200 - 100 - 750 - 180.50 + 2500 = 11.669,50
  y += 18;
  draw('07/10', 115, y);
  draw('SALDO DO DIA', 154, y);
  draw('11.669,50C', 430, y);

  // SEÇÃO RESUMO (não pode gerar transações)
  y += 20;
  draw('RESUMO', 115, y);
  y += 10;
  draw('0,00DTARIFAS VENCIDAS', 154, y);
  y += 10;
  draw('0,00DCHEQUE ESPECIAL', 154, y);

  // SEÇÃO LANÇAMENTOS FUTUROS (não entra em transações nem no saldo)
  y += 20;
  draw('LANÇAMENTOS FUTUROS', 115, y);
  y += 14;
  draw('17/11/26', 115, y);
  draw('DÉB.TIT.COMPE.EFETI', 154, y);
  draw('68,17D', 430, y);
  y += 10;
  draw('DOC.: 12507989', 154, y);
  y += 14;
  draw('20/11/26', 115, y);
  draw('DÉB.TIT.COMPE.EFETI', 154, y);
  draw('125,00D', 430, y);
  y += 10;
  draw('DOC.: 99887766', 154, y);

  const pdfBytes = await doc.save();
  const caminhoPdf = path.join(dirFixtures, 'sicoob_sintetico_completo.pdf');
  fs.writeFileSync(caminhoPdf, Buffer.from(pdfBytes));
  console.log(`✓ Fixture PDF Sicoob gerado: ${caminhoPdf} (8 transações, saldo 11.669,50, resumo, 2 lançamentos futuros)`);
  return caminhoPdf;
}

gerarFixtureSicoobPdfCompleto().catch(err => {
  console.error('Erro ao gerar fixture Sicoob PDF:', err);
});
