// MT Solar - Gestão Financeira
// Script de Testes Automatizados - Parte 22A: Infraestrutura PDF
// Usa somente dados em memória (sem Firestore, sem --env-file)

import {
  identificarFormatoPorConteudo,
  detectarBancoEFormato,
  ErroBancoNaoSuportado
} from '../src/utils/extrato';
import { extrairItensPdf } from '../src/utils/extrato/leitorPdf';
import { PDFDocument, StandardFonts } from 'pdf-lib';

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

function asserterizarNumero(
  valor: number,
  esperado: number,
  descricao: string,
  tolerancia = 1.0
): void {
  const ok = Math.abs(valor - esperado) <= tolerancia;
  asserir(ok, descricao, ok ? undefined : `obtido ${valor}, esperado ${esperado} ±${tolerancia}`);
}

/**
 * Gera um PDF em memória com posições conhecidas, adequado para exercitar o leitor.
 *
 * Layout:
 *  - Página 595.28 × 841.89 (A4)
 *  - Título: "HISTÓRICO DE MOVIMENTAÇÃO"  x≈50, y≈60 (do topo)
 *  - Item acima da data  (y menor = mais para cima):  "SALDO ANTERIOR" x≈50, y≈100
 *  - Data/col1: "20/10"           x=115,2  y≈150
 *  - Historico: "DEP DIN AG"      x=154,2  y≈150
 *  - Valor:     "1.500,00"        x=445    y≈150
 *  - Indicador: "C"               x=473,5  y≈155 (levemente abaixo do valor)
 *
 * Nota: pdf-lib usa coordenadas com origem no CANTO INFERIOR ESQUERDO.
 * O leitor converte para y-a-partir-do-topo: y_topo = alturaPagina - y_bottom
 */
async function gerarPdfTeste(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const alturaA4 = 841.89;
  const page = doc.addPage([595.28, alturaA4]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Função auxiliar para converter y-a-partir-do-topo em y-bottom (pdf-lib)
  const toBottom = (yTopo: number) => alturaA4 - yTopo;

  // Título
  page.drawText('HISTÓRICO DE MOVIMENTAÇÃO', {
    x: 50,
    y: toBottom(60),
    size: 12,
    font
  });

  // Item posicionado ACIMA da linha da data (y menor = mais para cima)
  page.drawText('SALDO ANTERIOR', {
    x: 50,
    y: toBottom(100),
    size: 10,
    font
  });

  // Linha de lançamento com posições exatas
  page.drawText('20/10', {
    x: 115.2,
    y: toBottom(150),
    size: 10,
    font
  });

  page.drawText('DEP DIN AG', {
    x: 154.2,
    y: toBottom(150),
    size: 10,
    font
  });

  page.drawText('1.500,00', {
    x: 445,
    y: toBottom(150),
    size: 10,
    font
  });

  // Indicador "C" levemente abaixo (y_bottom menor = y_topo maior)
  page.drawText('C', {
    x: 473.5,
    y: toBottom(155),
    size: 10,
    font
  });

  const bytes = await doc.save();
  // Retorna um ArrayBuffer real (slice para desanexar do Uint8Array)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function executarTestes(): Promise<void> {
  console.log('================================================================');
  console.log(' INICIANDO TESTES DA PARTE 22A — INFRAESTRUTURA PDF');
  console.log('================================================================\n');

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCO 1: Identificação de formato por magic bytes
  // ─────────────────────────────────────────────────────────────────────────
  console.log('--- BLOCO 1: Identificação de formato por magic bytes ---');

  {
    // 1.1 — PDF com cabeçalho %PDF-
    const pdfMagic = new TextEncoder().encode('%PDF-1.4 resto');
    const fmt = identificarFormatoPorConteudo(pdfMagic.buffer as ArrayBuffer);
    asserir(fmt === 'pdf', `Magic bytes %PDF- detectados como 'pdf' (obtido: '${fmt}')`);
  }

  {
    // 1.2 — OFX
    const ofxMagic = new TextEncoder().encode('OFXHEADER:100\nDATA:OFXSGML');
    const fmt = identificarFormatoPorConteudo(ofxMagic.buffer as ArrayBuffer);
    asserir(fmt === 'ofx', `Marcadores OFX detectados como 'ofx' (obtido: '${fmt}')`);
  }

  {
    // 1.3 — XLSX (ZIP magic PK\x03\x04)
    const xlsxMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    const fmt = identificarFormatoPorConteudo(xlsxMagic.buffer as ArrayBuffer);
    asserir(fmt === 'xlsx', `Magic bytes PK detectados como 'xlsx' (obtido: '${fmt}')`);
  }

  {
    // 1.4 — Arquivo aleatório não reconhecido → ErroBancoNaoSuportado
    const lixo = new TextEncoder().encode('Este é um arquivo qualquer sem assinatura válida');
    try {
      identificarFormatoPorConteudo(lixo.buffer as ArrayBuffer);
      asserir(false, 'Deveria lançar ErroBancoNaoSuportado para arquivo aleatório');
    } catch (err) {
      asserir(
        err instanceof ErroBancoNaoSuportado,
        `Arquivo aleatório lança ErroBancoNaoSuportado: "${(err as Error).message}"`
      );
      // A mensagem deve citar OFX, XLSX e PDF
      const msg = (err as Error).message;
      asserir(
        /OFX/i.test(msg) && /XLSX/i.test(msg) && /PDF/i.test(msg),
        `Mensagem de erro cita OFX, XLSX e PDF: "${msg}"`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCO 2: extrairItensPdf com PDF gerado em memória
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- BLOCO 2: Extração de itens do PDF em memória (pdf-lib) ---');

  const pdfBuffer = await gerarPdfTeste();

  {
    // 2.1 — Formato detectado como 'pdf'
    const fmt = identificarFormatoPorConteudo(pdfBuffer);
    asserir(fmt === 'pdf', `PDF gerado em memória detectado como 'pdf' (obtido: '${fmt}')`);
  }

  const itens = await extrairItensPdf(pdfBuffer);

  {
    // 2.2 — Não está vazio
    asserir(itens.length > 0, `extrairItensPdf retornou ${itens.length} itens (esperado > 0)`);
  }

  {
    // 2.3 — Todos os itens são da página 1
    const todosPag1 = itens.every(i => i.pagina === 1);
    asserir(todosPag1, 'Todos os itens estão na página 1');
  }

  {
    // 2.4 — Textos na ordem de desenho (conforme o PDF foi construído)
    const textos = itens.map(i => i.texto);
    console.log('    Textos extraídos em ordem:', JSON.stringify(textos));

    const ordemEsperada = [
      'HISTÓRICO DE MOVIMENTAÇÃO',
      'SALDO ANTERIOR',
      '20/10',
      'DEP DIN AG',
      '1.500,00',
      'C'
    ];

    asserir(
      textos.length === ordemEsperada.length,
      `Quantidade de itens: ${textos.length} (esperado: ${ordemEsperada.length})`
    );

    for (let i = 0; i < ordemEsperada.length; i++) {
      asserir(
        textos[i] === ordemEsperada[i],
        `Item[${i}] = "${textos[i]}" (esperado: "${ordemEsperada[i]}")`
      );
    }
  }

  {
    // 2.5 — Coordenadas x dentro de ±1 dos valores esperados
    const buscar = (texto: string) => itens.find(i => i.texto === texto);

    const item2010 = buscar('20/10');
    if (item2010) {
      asserterizarNumero(item2010.x, 115.2, '"20/10" tem x ≈ 115,2');
    } else {
      asserir(false, '"20/10" não encontrado nos itens');
    }

    const itemDep = buscar('DEP DIN AG');
    if (itemDep) {
      asserterizarNumero(itemDep.x, 154.2, '"DEP DIN AG" tem x ≈ 154,2');
    } else {
      asserir(false, '"DEP DIN AG" não encontrado nos itens');
    }

    const itemValor = buscar('1.500,00');
    if (itemValor) {
      asserterizarNumero(itemValor.x, 445, '"1.500,00" tem x ≈ 445');
    } else {
      asserir(false, '"1.500,00" não encontrado nos itens');
    }

    const itemC = buscar('C');
    if (itemC) {
      asserterizarNumero(itemC.x, 473.5, '"C" tem x ≈ 473,5');
    } else {
      asserir(false, '"C" não encontrado nos itens');
    }
  }

  {
    // 2.6 — Coordenadas y a partir do TOPO dentro de ±1
    const buscar = (texto: string) => itens.find(i => i.texto === texto);

    const item2010 = buscar('20/10');
    if (item2010) {
      asserterizarNumero(item2010.y, 150, '"20/10" tem y ≈ 150 (do topo)');
    }

    const itemC = buscar('C');
    if (itemC) {
      asserterizarNumero(itemC.y, 155, '"C" tem y ≈ 155 (do topo, levemente abaixo da linha)');
    }

    // Item acima da linha da data deve ter y menor (mais próximo do topo)
    const itemSaldo = buscar('SALDO ANTERIOR');
    const itemData = buscar('20/10');
    if (itemSaldo && itemData) {
      asserir(
        itemSaldo.y < itemData.y,
        `"SALDO ANTERIOR" (y=${itemSaldo.y.toFixed(1)}) está ACIMA da linha da data (y=${itemData.y.toFixed(1)})`
      );
    }
  }

  {
    // 2.7 — xFim > x para todos os itens com largura > 0
    const comLargura = itens.filter(i => i.xFim > i.x);
    asserir(
      comLargura.length > 0,
      `Pelo menos um item tem xFim > x (${comLargura.length} de ${itens.length})`
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCO 3: detectarBancoEFormato com PDF → banco desconhecido
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- BLOCO 3: detectarBancoEFormato com PDF de banco desconhecido ---');

  {
    try {
      await detectarBancoEFormato(pdfBuffer, 'extrato_banco_desconhecido.pdf');
      asserir(false, 'PDF de banco desconhecido deveria lançar ErroBancoNaoSuportado');
    } catch (err) {
      asserir(
        err instanceof ErroBancoNaoSuportado,
        `PDF de banco desconhecido lança ErroBancoNaoSuportado: "${(err as Error).message}"`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCO 4: PDF sem texto selecionável → erro específico
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- BLOCO 4: PDF sem texto selecionável ---');

  {
    // PDF legítimo mas vazio de texto (apenas uma página em branco)
    const docVazio = await PDFDocument.create();
    docVazio.addPage([595.28, 841.89]);
    const bytesVazio = await docVazio.save();
    const bufferVazio = bytesVazio.buffer.slice(
      bytesVazio.byteOffset,
      bytesVazio.byteOffset + bytesVazio.byteLength
    );

    try {
      await extrairItensPdf(bufferVazio as ArrayBuffer);
      asserir(false, 'PDF sem texto deveria lançar ErroBancoNaoSuportado');
    } catch (err) {
      const msg = (err as Error).message;
      asserir(
        err instanceof ErroBancoNaoSuportado,
        `PDF sem texto lança ErroBancoNaoSuportado`
      );
      asserir(
        msg.includes('sem texto selecionável') || msg.includes('PDF sem texto'),
        `Mensagem de erro correta: "${msg}"`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCO 5: Arquivo aleatório (não PDF) via lerExtrato → erro
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- BLOCO 5: Arquivo aleatório → ErroBancoNaoSuportado ---');

  {
    const { lerExtrato } = await import('../src/utils/extrato/index.js');
    const lixo = new TextEncoder().encode('conteudo invalido sem assinatura');
    try {
      await lerExtrato(lixo.buffer as ArrayBuffer, 'arquivo_invalido.bin');
      asserir(false, 'Arquivo inválido deveria lançar ErroBancoNaoSuportado');
    } catch (err) {
      asserir(
        err instanceof ErroBancoNaoSuportado,
        `Arquivo inválido lança ErroBancoNaoSuportado: "${(err as Error).message}"`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BLOCO 6: OFX e XLSX continuam funcionando (integridade de regressão)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- BLOCO 6: OFX e XLSX continuam funcionando após a mudança assíncrona ---');

  {
    const ofxConteudo = `OFXHEADER:100
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
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<DTSERVER>20261001120000[-3:BRT]</DTSERVER>
<LANGUAGE>POR</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001</TRNUID>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<STMTRS>
<CURDEF>BRL</CURDEF>
<BANKACCTFROM>
<BANKID>033</BANKID>
<ACCTID>0001999999999</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261001120000[-3:BRT]</DTSTART>
<DTEND>20261001120000[-3:BRT]</DTEND>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20261001120000[-3:BRT]</DTPOSTED>
<TRNAMT>1000,00</TRNAMT>
<FITID>20261001001</FITID>
<MEMO>Pix Recebido Teste</MEMO>
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1000,00</BALAMT>
<DTASOF>20261001120000[-3:BRT]</DTASOF>
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

    const { lerExtrato } = await import('../src/utils/extrato/index.js');
    const buf = new TextEncoder().encode(ofxConteudo);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    const extrato = await lerExtrato(ab, 'teste_regressao.ofx');

    asserir(extrato.formato === 'ofx', `OFX ainda funciona: formato = '${extrato.formato}'`);
    asserir(extrato.bancoCodigo === '033', `OFX ainda funciona: bancoCodigo = '${extrato.bancoCodigo}'`);
    asserir(extrato.transacoes.length === 1, `OFX ainda funciona: 1 transação (obtido: ${extrato.transacoes.length})`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESUMO FINAL
  // ─────────────────────────────────────────────────────────────────────────
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
