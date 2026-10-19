// MT Solar - Gestão Financeira
// Parser de Extratos XLSX do Banco Santander (Parte 15A)

import * as XLSX from 'xlsx';
import {
  ExtratoLido,
  TransacaoExtrato,
  TipoTransacaoExtrato,
  arredondar2Casas,
  normalizarDescricao
} from '../tipos';
import { extrairPrefixoDescricao } from '../assinatura';

const MESES_PORTUGUES: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  marco: '03',
  março: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12',
};

/**
 * Converte data por extenso em português (ex: "Quinta, 15 de outubro de 2026") para 'YYYY-MM-DD'
 * Suporta meses com e sem acento, bem como formato DD/MM/AAAA.
 */
export function converterDataPt(textoData: unknown): string | null {
  if (textoData === null || textoData === undefined) return null;
  const texto = String(textoData).trim();
  if (!texto) return null;

  // Regex para formato: "Quinta, 15 de outubro de 2026" ou "15 de outubro de 2026"
  const matchExtenso = texto.match(/(?:[A-Za-zçãéíóú]+,\s*)?(\d{1,2})\s+de\s+([A-Za-zçãéíóú]+)\s+de\s+(\d{4})/i);
  if (matchExtenso) {
    const dia = matchExtenso[1].padStart(2, '0');
    const nomeMes = matchExtenso[2].toLowerCase();
    const ano = matchExtenso[3];
    const mes = MESES_PORTUGUES[nomeMes];
    if (mes) {
      return `${ano}-${mes}-${dia}`;
    }
  }

  // Regex para formato padrão: "DD/MM/AAAA"
  const matchBarra = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchBarra) {
    const dia = matchBarra[1].padStart(2, '0');
    const mes = matchBarra[2].padStart(2, '0');
    const ano = matchBarra[3];
    return `${ano}-${mes}-${dia}`;
  }

  return null;
}

/**
 * Converte valores da célula XLSX para número positivo com 2 casas
 */
export function parsearNumeroXlsx(valor: unknown): number {
  if (typeof valor === 'number') {
    return isNaN(valor) ? 0 : arredondar2Casas(valor);
  }
  if (typeof valor === 'string') {
    let limpo = valor.trim();
    if (!limpo) return 0;
    if (limpo.includes(',') && limpo.includes('.')) {
      limpo = limpo.replace(/\./g, '').replace(',', '.');
    } else if (limpo.includes(',')) {
      limpo = limpo.replace(',', '.');
    }
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : arredondar2Casas(num);
  }
  return 0;
}

/**
 * Realiza o parsing de uma planilha XLSX exportada pelo Santander
 */
export function parsearSantanderXlsx(buffer: ArrayBuffer): ExtratoLido {
  const avisos: string[] = [];

  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const primeiroNomeAba = workbook.SheetNames[0];
  if (!primeiroNomeAba) {
    throw new Error('Planilha XLSX inválida ou sem abas.');
  }

  const worksheet = workbook.Sheets[primeiroNomeAba];
  const linhasMatriz = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: true });

  if (!linhasMatriz || linhasMatriz.length === 0) {
    throw new Error('Planilha XLSX vazia.');
  }

  let titular: string | undefined = undefined;
  let acctIdBruto: string | undefined = undefined;
  let conta: string | undefined = undefined;
  let dataInicioStr: string | undefined = undefined;
  let dataFimStr: string | undefined = undefined;
  let indiceCabecalho = -1;
  let colData = 0;
  let colDescricao = 1;
  let colCredito = 2;
  let colDebito = 3;

  // Analisar metadados nas primeiras 15 linhas
  const limiteVarredura = Math.min(linhasMatriz.length, 15);
  for (let i = 0; i < limiteVarredura; i++) {
    const linha = linhasMatriz[i];
    if (!linha || !Array.isArray(linha)) continue;

    for (let c = 0; c < linha.length; c++) {
      const celula = linha[c];
      if (typeof celula !== 'string') continue;

      const texto = celula.trim();

      // Identificar Conta
      if (/Conta:\s*([0-9-]+)/i.test(texto)) {
        acctIdBruto = texto;
        const matchConta = texto.match(/Conta:\s*([0-9-]+)/i);
        if (matchConta) {
          conta = matchConta[1].replace(/\D/g, '');
        }
        // Se a primeira coluna tiver o titular
        if (c > 0 && typeof linha[0] === 'string' && linha[0].trim()) {
          titular = linha[0].trim();
        }
      }

      // Identificar Período
      const matchPeriodo = texto.match(/Extrato de\s*(\d{2})\/(\d{2})\/(\d{4})\s*a\s*(\d{2})\/(\d{2})\/(\d{4})/i);
      if (matchPeriodo) {
        dataInicioStr = `${matchPeriodo[3]}-${matchPeriodo[2]}-${matchPeriodo[1]}`;
        dataFimStr = `${matchPeriodo[6]}-${matchPeriodo[5]}-${matchPeriodo[4]}`;
      }
    }

    // Identificar Linha de Cabeçalho das Colunas
    const textosLinha = linha.map(cell => (typeof cell === 'string' ? cell.toLowerCase().trim() : ''));
    const temData = textosLinha.some(t => t === 'data');
    const temDesc = textosLinha.some(t => t.includes('descri'));
    const temCredito = textosLinha.some(t => t.includes('crédito') || t.includes('credito'));
    const temDebito = textosLinha.some(t => t.includes('débito') || t.includes('debito'));

    if (temData && temDesc && (temCredito || temDebito)) {
      indiceCabecalho = i;
      colData = textosLinha.findIndex(t => t === 'data');
      colDescricao = textosLinha.findIndex(t => t.includes('descri'));
      colCredito = textosLinha.findIndex(t => t.includes('crédito') || t.includes('credito'));
      colDebito = textosLinha.findIndex(t => t.includes('débito') || t.includes('debito'));
      break;
    }
  }

  if (indiceCabecalho === -1) {
    throw new Error('Cabeçalho de colunas (Data, Descrição, Crédito, Débito) não localizado na planilha.');
  }

  const transacoes: TransacaoExtrato[] = [];
  const mapaOrdemNoDia = new Map<string, number>();

  // Iterar pelas linhas de dados
  for (let i = indiceCabecalho + 1; i < linhasMatriz.length; i++) {
    const linha = linhasMatriz[i];
    const linhaOrigem = i + 1; // 1-based para referência do usuário

    if (!linha || !Array.isArray(linha) || linha.length === 0) {
      continue;
    }

    const celulaData = linha[colData];
    const celulaDesc = linha[colDescricao];
    const celulaCredito = linha[colCredito];
    const celulaDebito = linha[colDebito];

    const textoDescricao = celulaDesc !== undefined && celulaDesc !== null ? String(celulaDesc).trim() : '';
    const textoData = celulaData !== undefined && celulaData !== null ? String(celulaData).trim() : '';

    // Ignorar linha de TOTAL
    if (textoDescricao.toUpperCase() === 'TOTAL' || textoData.toUpperCase() === 'TOTAL') {
      avisos.push(`Linha ${linhaOrigem} ignorada: linha de TOTAL desconsiderada.`);
      continue;
    }

    // Se linha inteiramente em branco, ignora
    if (!textoData && !textoDescricao && celulaCredito === undefined && celulaDebito === undefined) {
      continue;
    }

    const dataFormatada = converterDataPt(celulaData);
    if (!dataFormatada) {
      avisos.push(`Linha ${linhaOrigem} ignorada: formato de data não reconhecido (${celulaData}).`);
      continue;
    }

    const valorCredito = parsearNumeroXlsx(celulaCredito);
    const valorDebito = parsearNumeroXlsx(celulaDebito);

    let tipo: TipoTransacaoExtrato = 'credito';
    let valorFinal = 0;

    if (valorCredito > 0) {
      tipo = 'credito';
      valorFinal = valorCredito;
    } else if (valorDebito > 0) {
      tipo = 'debito';
      valorFinal = valorDebito;
    } else {
      avisos.push(`Linha ${linhaOrigem} ignorada: transação com valor zerado em Crédito e Débito.`);
      continue;
    }

    valorFinal = arredondar2Casas(valorFinal);
    const descricaoOriginal = textoDescricao;
    const descricaoNormalizada = normalizarDescricao(textoDescricao);

    // Regra determinística para ordemNoDia entre transações idênticas no mesmo dia
    const prefixoDesc = extrairPrefixoDescricao(descricaoNormalizada);
    const chaveDeterminismo = `${dataFormatada}_${tipo}_${valorFinal.toFixed(2)}_${prefixoDesc}`;
    const ordemNoDia = mapaOrdemNoDia.get(chaveDeterminismo) ?? 0;
    mapaOrdemNoDia.set(chaveDeterminismo, ordemNoDia + 1);

    const idTemporario = `xlsx_${dataFormatada}_L${linhaOrigem}_${ordemNoDia}`;

    transacoes.push({
      idTemporario,
      fitid: undefined,
      data: dataFormatada,
      valor: valorFinal,
      tipo,
      descricaoOriginal,
      descricaoNormalizada,
      contraparte: undefined,
      documento: undefined,
      ordemNoDia,
      linhaOrigem
    });
  }

  // Se período não foi extraído do cabeçalho, inferir pelas transações
  let periodoInicio = dataInicioStr;
  let periodoFim = dataFimStr;

  if ((!periodoInicio || !periodoFim) && transacoes.length > 0) {
    const datasOrdenadas = [...transacoes.map(t => t.data)].sort();
    if (!periodoInicio) periodoInicio = datasOrdenadas[0];
    if (!periodoFim) periodoFim = datasOrdenadas[datasOrdenadas.length - 1];
  }

  return {
    formato: 'xlsx',
    bancoCodigo: '033',
    bancoNome: 'Santander',
    agencia: undefined,
    conta,
    acctIdBruto,
    titular,
    periodo: {
      inicio: periodoInicio || '',
      fim: periodoFim || ''
    },
    saldoFinal: undefined,
    transacoes,
    avisos
  };
}
