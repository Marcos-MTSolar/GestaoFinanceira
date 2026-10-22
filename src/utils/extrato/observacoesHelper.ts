// MT Solar - Gestão Financeira
// Módulo de Extratos - Preservação e Formatação de Observações e Metadados (Parte 16E)

import { OrigemImportacao } from '../../types';

export interface DadosFormatacaoImportacao {
  descricaoOriginal: string;
  contraparte?: string;
  documento?: string;
  fitid?: string;
  bancoCodigo: string;
  bancoNome?: string;
  nomeArquivo: string;
  formato: 'ofx' | 'xlsx';
  loteId: string;
  dataHoraImportacao?: string;
}

export interface CamposOrigemDetalhados {
  historicoOriginal: string;
  contraparte?: string;
  documento?: string;
  fitid?: string;
  bancoCodigo?: string;
  bancoNome?: string;
  nomeArquivo?: string;
  formato?: 'ofx' | 'xlsx';
  loteId?: string;
  dataHoraImportacao?: string;
  assinaturaFraca?: string;
  observacoesAdicionais?: string;
}

/**
 * Mapeia códigos de banco para nomes legíveis
 */
export function obterNomeBanco(codigo: string): string {
  if (!codigo) return 'Banco';
  const codigoLimpo = codigo.replace(/^0+/, '');
  switch (codigoLimpo) {
    case '33':
      return 'Santander';
    case '1':
      return 'Banco do Brasil';
    case '104':
      return 'Caixa Econômica Federal';
    case '237':
      return 'Bradesco';
    case '341':
      return 'Itaú Unibanco';
    case '260':
      return 'Nubank';
    case '77':
      return 'Banco Inter';
    case '756':
      return 'Sicoob';
    case '748':
      return 'Sicredi';
    case '422':
      return 'Banco Safra';
    case '212':
      return 'Banco Original';
    case '655':
      return 'Banco Votorantim';
    default:
      return `Banco ${codigo}`;
  }
}

/**
 * Formata data/hora em formato legível brasileiro
 */
export function formatarDataHoraLegivel(isoOuData?: string): string {
  try {
    const d = isoOuData ? new Date(isoOuData) : new Date();
    if (isNaN(d.getTime())) return isoOuData || '';
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} às ${hora}:${min}`;
  } catch {
    return isoOuData || '';
  }
}

/**
 * Gera uma descrição curta e limpa (tipo da operação + favorecido),
 * evitando duplicações como "PIX ENVIADO JOAO - JOAO" ou números variáveis longos.
 */
export function gerarDescricaoCurta(descricaoOriginal: string, contraparte?: string): string {
  const descLimpa = (descricaoOriginal || '').trim();
  const favorecido = (contraparte || '').trim();

  if (!favorecido) {
    return descLimpa;
  }

  // Regex para identificar prefixos comuns de operações bancárias
  const regexOperacao = /^(Pix\s+Enviado|Pix\s+Recebido|Pix\s+Agendado|Pix\s+Transf(?:erencia)?|Pix|Ted\s+Enviada|Ted\s+Recebida|Ted|Doc\s+Enviado|Doc\s+Recebido|Doc|Pagamento\s+Boleto|Pagamento\s+Título|Pagamento\s+Eletr(?:onico)?|Pagamento|Tarifa\s+Bancária|Tarifa|Compra\s+Cartão|Compra\s+Débito|Compra\s+Crédito|Compra|Transferência\s+Enviada|Transferência\s+Recebida|Transferência|Aplicação|Resgate)\b/i;

  const matchOp = descLimpa.match(regexOperacao);

  if (matchOp) {
    const tipoOp = matchOp[1].trim();

    // Se a contraparte já for exatamente igual à descrição inteira, retorna o favorecido
    if (descLimpa.toUpperCase() === favorecido.toUpperCase()) {
      return favorecido;
    }

    // Retorna "Tipo Operação - Favorecido"
    return `${tipoOp} - ${favorecido}`;
  }

  // Se a descrição original contém a contraparte no final
  const idxFav = descLimpa.toUpperCase().lastIndexOf(favorecido.toUpperCase());
  if (idxFav > 0) {
    const prefixo = descLimpa.slice(0, idxFav).replace(/[-–—:]+$/, '').trim();
    if (prefixo) {
      return `${prefixo} - ${favorecido}`;
    }
    return favorecido;
  }

  // Se a descrição original for diferente e não contiver a contraparte
  if (descLimpa.toUpperCase() === favorecido.toUpperCase()) {
    return favorecido;
  }

  return `${descLimpa} - ${favorecido}`;
}

/**
 * Constrói o texto legível para o campo observações de um lançamento criado via extrato.
 */
export function formatarObservacoesImportacao(dados: DadosFormatacaoImportacao): string {
  const nomeBancoFinal = dados.bancoNome || obterNomeBanco(dados.bancoCodigo);
  const dataHora = formatarDataHoraLegivel(dados.dataHoraImportacao);
  const formatoExtenso = dados.formato.toUpperCase();

  const linhas: string[] = ['[Origem: Extrato Bancário]'];

  if (dados.descricaoOriginal) {
    linhas.push(`• Histórico original: ${dados.descricaoOriginal.trim()}`);
  }

  if (dados.contraparte && dados.contraparte.trim()) {
    linhas.push(`• Favorecido/Contraparte: ${dados.contraparte.trim()}`);
  }

  if (dados.documento && dados.documento.trim()) {
    linhas.push(`• Documento: ${dados.documento.trim()}`);
  }

  if (dados.fitid && dados.fitid.trim()) {
    linhas.push(`• FITID: ${dados.fitid.trim()}`);
  }

  linhas.push(`• Banco: ${nomeBancoFinal}${dados.bancoCodigo ? ` (${dados.bancoCodigo})` : ''}`);
  linhas.push(`• Arquivo: ${dados.nomeArquivo || 'extrato'}`);
  linhas.push(`• Formato: ${formatoExtenso}`);
  linhas.push(`• Lote: ${dados.loteId}`);
  if (dataHora) {
    linhas.push(`• Data da importação: ${dataHora}`);
  }

  return linhas.join('\n');
}

/**
 * Complementa o campo observacoes de um lançamento quando este é apenas ENRIQUECIDO,
 * preservando integralmente o texto anterior que o usuário ou sistema já havia registrado.
 */
export function complementarObservacoesEnriquecimento(
  observacoesAnteriores: string | undefined,
  dados: DadosFormatacaoImportacao
): string {
  const nomeBancoFinal = dados.bancoNome || obterNomeBanco(dados.bancoCodigo);
  const dataHora = formatarDataHoraLegivel(dados.dataHoraImportacao);
  const formatoExtenso = dados.formato.toUpperCase();

  const linhasEnriquecimento: string[] = ['[Origem: Extrato Bancário - Enriquecimento]'];

  if (dados.descricaoOriginal) {
    linhasEnriquecimento.push(`• Histórico original: ${dados.descricaoOriginal.trim()}`);
  }

  if (dados.contraparte && dados.contraparte.trim()) {
    linhasEnriquecimento.push(`• Favorecido/Contraparte: ${dados.contraparte.trim()}`);
  }

  if (dados.documento && dados.documento.trim()) {
    linhasEnriquecimento.push(`• Documento: ${dados.documento.trim()}`);
  }

  if (dados.fitid && dados.fitid.trim()) {
    linhasEnriquecimento.push(`• FITID: ${dados.fitid.trim()}`);
  }

  linhasEnriquecimento.push(`• Banco: ${nomeBancoFinal}${dados.bancoCodigo ? ` (${dados.bancoCodigo})` : ''}`);
  linhasEnriquecimento.push(`• Arquivo: ${dados.nomeArquivo || 'extrato'}`);
  linhasEnriquecimento.push(`• Formato: ${formatoExtenso}`);
  linhasEnriquecimento.push(`• Lote: ${dados.loteId}`);
  if (dataHora) {
    linhasEnriquecimento.push(`• Data da importação: ${dataHora}`);
  }

  const blocoEnriquecimento = linhasEnriquecimento.join('\n');

  if (observacoesAnteriores && observacoesAnteriores.trim()) {
    // Se já havia anotações, preserva tudo e adiciona divisor limpo
    return `${observacoesAnteriores.trim()}\n\n---\n${blocoEnriquecimento}`;
  }

  return blocoEnriquecimento;
}

/**
 * Helper para extrair de forma estruturada os campos de origem de um lançamento
 * a partir das observações e/ou do objeto origem_importacao.
 */
export function extrairCamposOrigem(
  observacoes?: string,
  origemImportacao?: OrigemImportacao
): CamposOrigemDetalhados {
  const obs = observacoes || '';
  const extrairLinha = (chave: string): string | undefined => {
    const regex = new RegExp(`•\\s*${chave}:\\s*(.+)`, 'i');
    const m = obs.match(regex);
    return m ? m[1].trim() : undefined;
  };

  const historicoOriginal =
    origemImportacao?.descricao_original ||
    extrairLinha('Histórico original') ||
    '';

  const contraparte =
    origemImportacao?.contraparte ||
    extrairLinha('Favorecido/Contraparte') ||
    undefined;

  const documento =
    origemImportacao?.documento ||
    extrairLinha('Documento') ||
    undefined;

  const fitid =
    origemImportacao?.fitid ||
    extrairLinha('FITID') ||
    undefined;

  const bancoStr = extrairLinha('Banco');
  const nomeArquivo =
    origemImportacao?.nome_arquivo ||
    extrairLinha('Arquivo') ||
    undefined;

  const formatoStr =
    origemImportacao?.formato ||
    (extrairLinha('Formato')?.toLowerCase() as 'ofx' | 'xlsx' | undefined);

  const loteId =
    origemImportacao?.lote_id ||
    extrairLinha('Lote') ||
    undefined;

  const dataHoraImportacao =
    origemImportacao?.data_importacao ||
    extrairLinha('Data da importação') ||
    undefined;

  // Extrai anotações do usuário (o que estiver antes de [Origem: ou ---)
  let observacoesAdicionais: string | undefined = undefined;
  if (obs.includes('---')) {
    const partes = obs.split('---');
    const primeiraParte = partes[0].trim();
    if (primeiraParte && !primeiraParte.startsWith('[Origem:')) {
      observacoesAdicionais = primeiraParte;
    }
  } else if (!obs.trim().startsWith('[Origem:')) {
    const idxOrigem = obs.indexOf('[Origem:');
    if (idxOrigem > 0) {
      observacoesAdicionais = obs.slice(0, idxOrigem).trim();
    }
  }

  return {
    historicoOriginal,
    contraparte,
    documento,
    fitid,
    bancoCodigo: origemImportacao?.banco_codigo,
    bancoNome: bancoStr,
    nomeArquivo,
    formato: formatoStr,
    loteId,
    dataHoraImportacao,
    assinaturaFraca: origemImportacao?.assinatura_fraca,
    observacoesAdicionais,
  };
}
