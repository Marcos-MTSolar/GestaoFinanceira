// MT Solar - Gestão Financeira
// Detecção de Banco e Formato por Conteúdo do Arquivo (Parte 15A)

import * as XLSX from 'xlsx';
import {
  FormatoExtrato,
  ContextoDeteccao,
  DefinicaoBanco,
  ErroBancoNaoSuportado,
  ItemPdf
} from './tipos';
import { BANCOS_REGISTRADOS } from './bancos';
import { decodificarOfxBuffer } from './parsers/ofx';
import { extrairItensPdf } from './leitorPdf';

/**
 * Identifica o formato do arquivo exclusivamente pelo seu conteúdo binário / assinatura (magic bytes).
 * NUNCA se baseia apenas na extensão do nome do arquivo.
 */
export function identificarFormatoPorConteudo(arquivo: ArrayBuffer): FormatoExtrato {
  if (!arquivo || arquivo.byteLength < 4) {
    throw new ErroBancoNaoSuportado('Arquivo vazio ou corrompido.');
  }

  const bytes = new Uint8Array(arquivo.slice(0, 16));

  // Assinatura ZIP / OpenXML (PK\x03\x04) típica de arquivos .xlsx modernos
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'xlsx';
  }

  // Assinatura OLE2 / BIFF antiga (D0 CF 11 E0) de arquivos .xls
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return 'xlsx';
  }

  // Assinatura PDF (%PDF-)
  if (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d    // -
  ) {
    return 'pdf';
  }

  // Verifica marcadores textuais de extrato OFX (SGML 1.x ou XML 2.x)
  const limiteLeituraTexto = Math.min(arquivo.byteLength, 1024);
  const cabecalhoTexto = new TextDecoder('latin1').decode(new Uint8Array(arquivo.slice(0, limiteLeituraTexto)));

  if (
    /OFXHEADER/i.test(cabecalhoTexto) ||
    /DATA:OFXSGML/i.test(cabecalhoTexto) ||
    /<OFX>/i.test(cabecalhoTexto) ||
    /<OFXSGML>/i.test(cabecalhoTexto) ||
    /<SIGNONMSGSRSV1>/i.test(cabecalhoTexto)
  ) {
    return 'ofx';
  }

  throw new ErroBancoNaoSuportado(
    'Formato de arquivo não reconhecido pelo conteúdo. O sistema suporta apenas extratos OFX (.ofx/.qfx), planilhas Excel (.xlsx) e arquivos PDF (.pdf).'
  );
}

export interface ResultadoDeteccao {
  banco: DefinicaoBanco;
  formato: FormatoExtrato;
  contexto: ContextoDeteccao;
}

/**
 * Detecta o banco emissor e prepara o contexto de leitura analisando estritamente o conteúdo do arquivo.
 */
export async function detectarBancoEFormato(
  arquivo: ArrayBuffer,
  nomeArquivo?: string
): Promise<ResultadoDeteccao> {
  const formato = identificarFormatoPorConteudo(arquivo);

  let textoOfx: string | undefined = undefined;
  let linhasXlsx: unknown[][] | undefined = undefined;
  let itensPdf: ItemPdf[] | undefined = undefined;

  if (formato === 'ofx') {
    textoOfx = decodificarOfxBuffer(arquivo);
  } else if (formato === 'xlsx') {
    try {
      const workbook = XLSX.read(new Uint8Array(arquivo), { type: 'array' });
      const primeiraAba = workbook.SheetNames[0];
      if (primeiraAba) {
        const worksheet = workbook.Sheets[primeiraAba];
        linhasXlsx = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true });
      }
    } catch {
      throw new ErroBancoNaoSuportado('Falha ao processar estrutura da planilha Excel.');
    }
  } else if (formato === 'pdf') {
    itensPdf = await extrairItensPdf(arquivo);
  }

  const contexto: ContextoDeteccao = {
    formato,
    textoOfx,
    linhasXlsx,
    itensPdf,
    nomeArquivo
  };

  // Percorre o registro de bancos procurando correspondência por conteúdo
  for (const banco of BANCOS_REGISTRADOS) {
    if (banco.detectar(contexto)) {
      if (!banco.formatosSuportados.includes(formato)) {
        throw new ErroBancoNaoSuportado(
          `O banco emissor detectado (${banco.nome}) não suporta importação no formato "${formato.toUpperCase()}".`
        );
      }
      return { banco, formato, contexto };
    }
  }

  throw new ErroBancoNaoSuportado(
    'Banco emissor não suportado ou layout de extrato desconhecido. Não foi possível identificar o banco pelo conteúdo do arquivo.'
  );
}
