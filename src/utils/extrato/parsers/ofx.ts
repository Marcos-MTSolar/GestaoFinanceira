// MT Solar - Gestão Financeira
// Parser de Extratos OFX 1.x SGML e OFX 2.x XML (Parte 15A)

import {
  ExtratoLido,
  TransacaoExtrato,
  TipoTransacaoExtrato,
  arredondar2Casas,
  normalizarDescricao
} from '../tipos';
import { extrairPrefixoDescricao } from '../assinatura';

/**
 * Converte data de 8 dígitos (YYYYMMDD) no formato 'YYYY-MM-DD'
 * Não converte fuso horário (conforme especificação)
 */
function formatarDataIso8(dtStr: string): string {
  const limpo = dtStr.replace(/\D/g, '');
  if (limpo.length >= 8) {
    const ano = limpo.slice(0, 4);
    const mes = limpo.slice(4, 6);
    const dia = limpo.slice(6, 8);
    return `${ano}-${mes}-${dia}`;
  }
  return '';
}

/**
 * Converte valor numérico em string com suporte a vírgula ou ponto decimal
 * Exemplos: "-4703,31" -> -4703.31, "6803,58" -> 6803.58, "1.234,56" -> 1234.56
 */
export function parsearValorOfx(valorStr: string): number {
  if (!valorStr) return 0;
  let limpo = valorStr.trim();
  if (limpo.includes(',') && limpo.includes('.')) {
    // Ex: 1.234,56 ou 1,234.56
    const ultimaVirgula = limpo.lastIndexOf(',');
    const ultimoPonto = limpo.lastIndexOf('.');
    if (ultimaVirgula > ultimoPonto) {
      // 1.234,56
      limpo = limpo.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56
      limpo = limpo.replace(/,/g, '');
    }
  } else if (limpo.includes(',')) {
    limpo = limpo.replace(',', '.');
  }
  const num = parseFloat(limpo);
  return isNaN(num) ? 0 : arredondar2Casas(num);
}

/**
 * Extrai o conteúdo textual de uma tag OFX (suporta SGML sem fechamento e XML com fechamento)
 */
export function extrairTagOfx(bloco: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
  const match = bloco.match(regex);
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Extrai contraparte de um MEMO removendo prefixos de operação bancária
 * Exemplo: "Pix Enviado GIRLANE SANTOS BRAINER" -> "GIRLANE SANTOS BRAINER"
 */
export function extrairContraparteOfx(memo: string): string | undefined {
  if (!memo) return undefined;
  const match = memo.match(/^(?:Pix\s+Enviado|Pix\s+Recebido|Pix\s+Agendado|Ted\s+Enviada|Ted\s+Recebida|Doc\s+Enviado|Doc\s+Recebido)\s+(.+)$/i);
  if (match && match[1]) {
    const contraparte = match[1].trim();
    return contraparte.length > 0 ? contraparte : undefined;
  }
  return undefined;
}

/**
 * Decodifica um ArrayBuffer respeitando o CHARSET do cabeçalho OFX
 * (1252 -> windows-1252, senão utf-8)
 */
export function decodificarOfxBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const previaAscii = new TextDecoder('latin1').decode(bytes.slice(0, 1024));
  const matchCharset = previaAscii.match(/CHARSET:\s*([^\r\n]+)/i);
  const charsetRaw = matchCharset ? matchCharset[1].trim() : '';

  let encoding = 'utf-8';
  if (/1252|cp1252|windows-1252|win-1252/i.test(charsetRaw)) {
    encoding = 'windows-1252';
  } else if (/latin1|8859-1|iso-8859-1/i.test(charsetRaw)) {
    encoding = 'iso-8859-1';
  }

  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

/**
 * Realiza o parsing de conteúdo OFX (SGML e XML)
 */
export function parsearOfx(conteudoTexto: string, _bufferOriginal?: ArrayBuffer): ExtratoLido {
  const avisos: string[] = [];

  // Extrair metadados gerais
  const bankId = extrairTagOfx(conteudoTexto, 'BANKID') || null;
  const acctIdBruto = extrairTagOfx(conteudoTexto, 'ACCTID') || undefined;
  const org = extrairTagOfx(conteudoTexto, 'ORG') || '';
  const fid = extrairTagOfx(conteudoTexto, 'FID') || '';

  // Determinar banco
  let bancoCodigo: string | null = bankId;
  let bancoNome: string | null = null;
  let agencia: string | undefined = undefined;
  let conta: string | undefined = undefined;

  const ehSantander = bankId === '033' || bankId === '33' || /SANTANDER/i.test(org) || /SANTANDER/i.test(fid);
  if (ehSantander) {
    bancoCodigo = '033';
    bancoNome = 'Santander';
    if (acctIdBruto) {
      const digitosConta = acctIdBruto.replace(/\D/g, '');
      if (digitosConta.length >= 8) {
        agencia = digitosConta.slice(0, 4);
        conta = digitosConta.slice(4);
      } else {
        conta = digitosConta;
      }
    }
  } else if (acctIdBruto) {
    conta = acctIdBruto.replace(/\D/g, '');
  }

  // Período
  const dtStartRaw = extrairTagOfx(conteudoTexto, 'DTSTART');
  const dtEndRaw = extrairTagOfx(conteudoTexto, 'DTEND');
  const dtStart = dtStartRaw ? formatarDataIso8(dtStartRaw) : '';
  const dtEnd = dtEndRaw ? formatarDataIso8(dtEndRaw) : '';

  // Saldo final (LEDGERBAL)
  let saldoFinal: ExtratoLido['saldoFinal'] = undefined;
  const matchLedgerbal = conteudoTexto.match(/<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<\/STMTRS>|$)/i);
  if (matchLedgerbal) {
    const balAmtRaw = extrairTagOfx(matchLedgerbal[1], 'BALAMT');
    const dtAsOfRaw = extrairTagOfx(matchLedgerbal[1], 'DTASOF');
    if (balAmtRaw) {
      const valorSaldo = parsearValorOfx(balAmtRaw);
      const dataSaldo = dtAsOfRaw ? formatarDataIso8(dtAsOfRaw) : (dtEnd || '');
      saldoFinal = {
        valor: valorSaldo,
        data: dataSaldo
      };
    }
  }

  // Tokenizer e parsing de transações <STMTTRN>
  const transacoes: TransacaoExtrato[] = [];
  const mapaOrdemNoDia = new Map<string, number>();

  const regexTrn = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>)|$)/gi;
  let matchTrn: RegExpExecArray | null;

  while ((matchTrn = regexTrn.exec(conteudoTexto)) !== null) {
    const bloco = matchTrn[1];
    if (!bloco.trim()) continue;

    // Linha de origem no texto
    const posicaoNoTexto = matchTrn.index;
    const linhaOrigem = conteudoTexto.slice(0, posicaoNoTexto).split('\n').length;

    const trnType = (extrairTagOfx(bloco, 'TRNTYPE') || '').toUpperCase();
    const dtPostedRaw = extrairTagOfx(bloco, 'DTPOSTED') || '';
    const trnAmtRaw = extrairTagOfx(bloco, 'TRNAMT') || '0';
    const fitid = extrairTagOfx(bloco, 'FITID') || undefined;
    const checknum = extrairTagOfx(bloco, 'CHECKNUM') || undefined;
    const memo = extrairTagOfx(bloco, 'MEMO') || '';

    const data = formatarDataIso8(dtPostedRaw);
    const valorNumerico = parsearValorOfx(trnAmtRaw);

    // O sinal do valor define crédito/débito
    let tipo: TipoTransacaoExtrato = 'credito';
    if (valorNumerico < 0) {
      tipo = 'debito';
    } else if (valorNumerico > 0) {
      tipo = 'credito';
    } else {
      tipo = trnType === 'DEBIT' ? 'debito' : 'credito';
    }

    const valor = arredondar2Casas(Math.abs(valorNumerico));
    const descricaoOriginal = memo;
    const descricaoNormalizada = normalizarDescricao(memo);
    const contraparte = extrairContraparteOfx(memo);

    let documento: string | undefined = undefined;
    if (checknum && !/^0+$/.test(checknum.trim())) {
      documento = checknum.trim();
    }

    // Regra determinística para ordemNoDia entre transações idênticas no mesmo dia
    const prefixoDesc = extrairPrefixoDescricao(descricaoNormalizada);
    const chaveDeterminismo = `${data}_${tipo}_${valor.toFixed(2)}_${prefixoDesc}`;
    const ordemNoDia = mapaOrdemNoDia.get(chaveDeterminismo) ?? 0;
    mapaOrdemNoDia.set(chaveDeterminismo, ordemNoDia + 1);

    const idTemporario = fitid || `ofx_${data}_L${linhaOrigem}_${ordemNoDia}`;

    transacoes.push({
      idTemporario,
      fitid,
      data,
      valor,
      tipo,
      descricaoOriginal,
      descricaoNormalizada,
      contraparte,
      documento,
      ordemNoDia,
      linhaOrigem
    });
  }

  // Determinar datas do período se não vieram explicitamente
  let periodoInicio = dtStart;
  let periodoFim = dtEnd;

  if ((!periodoInicio || !periodoFim) && transacoes.length > 0) {
    const datasOrdenadas = [...transacoes.map(t => t.data).filter(Boolean)].sort();
    if (!periodoInicio && datasOrdenadas.length > 0) {
      periodoInicio = datasOrdenadas[0];
    }
    if (!periodoFim && datasOrdenadas.length > 0) {
      periodoFim = datasOrdenadas[datasOrdenadas.length - 1];
    }
  }

  return {
    formato: 'ofx',
    bancoCodigo,
    bancoNome,
    agencia,
    conta,
    acctIdBruto,
    titular: undefined,
    periodo: {
      inicio: periodoInicio || '',
      fim: periodoFim || ''
    },
    saldoFinal,
    transacoes,
    avisos
  };
}
