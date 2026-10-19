// MT Solar - Gestão Financeira
// Ponto de Entrada do Módulo de Extratos Bancários (Parte 15A)

import { ExtratoLido } from './tipos';
import { detectarBancoEFormato } from './detectarBanco';

export * from './tipos';
export * from './bancos';
export * from './detectarBanco';
export * from './parsers/ofx';
export * from './parsers/santanderXlsx';
export * from './resolverConta';
export * from './assinatura';
export * from './classificarDuplicatas';
export * from './classificarTransacao';
export * from './regras/santander';
export * from './inferirFormaPagamento';

/**
 * Lê e processa um extrato bancário (OFX ou XLSX) a partir de seu ArrayBuffer.
 * Detecta o banco e o formato exclusivamente pelo conteúdo do arquivo.
 *
 * @param arquivo Buffer binário do arquivo importado
 * @param nomeArquivo Nome do arquivo (usado apenas como metadado auxiliar)
 * @returns Promessa com o extrato parseado e normalizado
 */
export async function lerExtrato(
  arquivo: ArrayBuffer,
  nomeArquivo: string
): Promise<ExtratoLido> {
  const { banco, contexto } = detectarBancoEFormato(arquivo, nomeArquivo);
  return banco.parser(contexto, arquivo);
}
