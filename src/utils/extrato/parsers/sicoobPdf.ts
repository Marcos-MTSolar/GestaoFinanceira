// MT Solar - Gestão Financeira
// Parser de Extratos PDF do Sicoob (Partes 22B, 22D e 24B)
// Função PURA: recebe ItemPdf[], não importa pdfjs

import {
  ExtratoLido,
  ItemPdf,
  TransacaoExtrato,
  LancamentoFuturoExtrato,
  TipoTransacaoExtrato,
  arredondar2Casas,
  normalizarDescricao
} from '../tipos';
import { extrairPrefixoDescricao } from '../assinatura';

// ─────────────────────────────────────────────────────────────────────────────
// Erro específico de conferência de saldo
// ─────────────────────────────────────────────────────────────────────────────
export class ErroConciliacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroConciliacao';
    Object.setPrototypeOf(this, ErroConciliacao.prototype);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes e regex
// ─────────────────────────────────────────────────────────────────────────────

// Texto de data dd/mm ou dd/mm/aaaa com x < 140 (coluna de data no Sicoob)
const RE_DATA_DDMM = /^\d{2}\/\d{2}(?:\/\d{4})?$/;

// Valor monetário: pode ter milhar, termina com C, D, * ou sem sinal
// Exemplos: "1.500,00", "1.500,00C", "100,00D", "0,00*"
const RE_VALOR_COMPLETO = /^\d{1,3}(?:\.\d{3})*,\d{2}[CD*]?$/;

// Sinal avulso logo após um valor sem sinal embutido
const RE_SINAL_AVULSO = /^[CD*]$/;

// Período no cabeçalho: dd/mm/aaaa - dd/mm/aaaa
const RE_PERIODO = /(\d{2})\/(\d{2})\/(\d{4})\s*[-–]\s*(\d{2})\/(\d{2})\/(\d{4})/;

// Campos a ignorar ao montar blocos de detalhes (itens de controle/cabeçalho)
const TEXTOS_CABEÇALHO = new Set([
  'DATA', 'HISTÓRICO', 'VALOR', 'HISTÓRICO DE MOVIMENTAÇÃO',
  'SISTEMA DE COOPERATIVAS', 'SISBR', 'COOP.:', 'CONTA:', 'PERÍODO:',
  'EXTRATO CONTA CORRENTE',
]);

// Prefixos de cooperativa/conta/período (para ignorar linhas de cabeçalho repetido)
const RE_CABEÇALHO_REPETIDO = /^(SICOOB|COOP\.|CONTA\.|PERÍODO:|DATA\b|HISTÓRICO\b|VALOR\b|HISTÓRICO DE MOVIMENTAÇÃO)/i;

// Itens de controle — não são transações
const RE_CONTROLE_SALDO = /^(SALDO ANTERIOR|SALDO BLOQ\.?ANTERIOR|SALDO DO DIA|SALDO EM CONTA|SALDO DISPONÍVEL|CHEQUE ESPECIAL|RESUMO)/i;
const RE_SALDO_DO_DIA = /^SALDO DO DIA$/i;
const RE_SALDO_ANTERIOR = /^(SALDO ANTERIOR|SALDO BLOQ\.?ANTERIOR)$/i;

// Delimitadores de final de movimentos correntes
const RE_FIM_MOVIMENTOS = /^(RESUMO\b|LANÇAMENTOS FUTUROS\b|0,00[CD*]?TARIFAS)/i;
const RE_RESUMO_SECTION = /^(RESUMO\b|0,00[CD*]?TARIFAS)/i;
const RE_LANCAMENTOS_FUTUROS_SECTION = /^LANÇAMENTOS FUTUROS\b/i;

// Regex para blocos de detalhe Parte 24B
const RE_FAV = /^FAV\.:\s*(.+)$/i;
const RE_TIPO_PIX_LINHA = /^(Pagamento Pix|Recebimento Pix|Transferência Pix)$/i;
const RE_DOC_ISOLADO = /^DOC\.:\s*(\S+)/i;
const RE_DOC_COLADO = /^(\*{3}\.\d{3}\.\d{3}-\*{2}|\d{2}\.\d{3}\.\d{3}[\s\/]\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})\s*(DOC\.:\s*\S+.*)$/i;
const RE_CPF_MASC = /^\*{3}\.\d{3}\.\d{3}-\*{2}/;
const RE_CNPJ_ESPACO_OU_BARRA = /^\d{2}\.\d{3}\.\d{3}[\s\/]\d{4}-\d{2}/;
const RE_CPF_NORMAL = /^\d{3}\.\d{3}\.\d{3}-\d{2}/;

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários de data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converte dd/mm/aaaa para YYYY-MM-DD
 */
function dmAnoParaIso(dd: string, mm: string, aaaa: string): string {
  return `${aaaa}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

/**
 * Retorna o dia anterior a uma data ISO YYYY-MM-DD
 */
function diaAnterior(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Diferença em dias entre duas datas ISO (fim - início)
 */
function diferencaDias(inicio: string, fim: string): number {
  const a = new Date(`${inicio}T00:00:00Z`);
  const b = new Date(`${fim}T00:00:00Z`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Dado "dd/mm" ou "dd/mm/aaaa" e o período completo (inicio, fim em YYYY-MM-DD),
 * determina o ano correto:
 * - Se já contiver ano, formata diretamente em YYYY-MM-DD
 * - Se for dd/mm:
 *   - Usa o ano do fim do período
 *   - Se (mm, dd) > (mm do fim, dd do fim) → usa ano anterior
 */
function inferirAno(dataTexto: string, periodoInicio: string, periodoFim: string): string {
  const partes = dataTexto.split('/');
  if (partes.length === 3) {
    return dmAnoParaIso(partes[0], partes[1], partes[2]);
  }

  const [dd, mm] = partes;
  const anoFim = parseInt(periodoFim.slice(0, 4), 10);
  const mesFim = periodoFim.slice(5, 7);
  const diaFim = periodoFim.slice(8, 10);

  const chkMm = mm.padStart(2, '0');
  const chkDd = dd.padStart(2, '0');

  if (chkMm > mesFim || (chkMm === mesFim && chkDd > diaFim)) {
    return dmAnoParaIso(dd, mm, String(anoFim - 1));
  }
  return dmAnoParaIso(dd, mm, String(anoFim));
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários de valor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrai valor numérico de string como "1.500,00", "100,00D", "150,00C".
 * Retorna { valor: number; sinal: 'C'|'D'|'*'|null }
 */
function parsearValorSicoob(texto: string): { valor: number; sinal: 'C' | 'D' | '*' | null } | null {
  const m = texto.match(/^(\d{1,3}(?:\.\d{3})*,\d{2})([CD*]?)$/);
  if (!m) return null;
  const numStr = m[1].replace(/\./g, '').replace(',', '.');
  const valor = arredondar2Casas(parseFloat(numStr));
  const sinal = (m[2] as 'C' | 'D' | '*') || null;
  return { valor, sinal };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bloco de movimento
// ─────────────────────────────────────────────────────────────────────────────

interface BlocoMovimento {
  indiceInicio: number; // posição do item de data no array original
  ddmm: string;
  itensBloco: ItemPdf[]; // todos os itens do bloco, incluindo o da data
}

export interface OpcoesParserSicoob {
  cnpjEmpresa?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parseia um extrato PDF do Sicoob a partir dos itens de texto extraídos.
 * Função PURA — não importa nem executa pdfjs.
 */
export function parsearSicoobPdf(itens: ItemPdf[], opcoes?: OpcoesParserSicoob): ExtratoLido {
  const avisos: string[] = [];

  if (!itens || itens.length === 0) {
    throw new ErroConciliacao('Extrato Sicoob PDF vazio: nenhum item de texto encontrado.');
  }

  // ─── 1. CABEÇALHO ───────────────────────────────────────────────────────
  const idxHistorico = itens.findIndex(i =>
    i.texto.trim().toUpperCase() === 'HISTÓRICO DE MOVIMENTAÇÃO'
  );

  const itensCabecalho = idxHistorico >= 0 ? itens.slice(0, idxHistorico + 1) : itens.slice(0, 30);
  const textoCabecalho = itensCabecalho.map(i => i.texto.trim()).join(' ');

  // Extrair período
  const mPeriodo = textoCabecalho.match(RE_PERIODO);
  if (!mPeriodo) {
    throw new ErroConciliacao('Cabeçalho Sicoob: período não encontrado (esperado dd/mm/aaaa - dd/mm/aaaa).');
  }
  const periodoInicio = dmAnoParaIso(mPeriodo[1], mPeriodo[2], mPeriodo[3]);
  const periodoFim = dmAnoParaIso(mPeriodo[4], mPeriodo[5], mPeriodo[6]);

  if (diferencaDias(periodoInicio, periodoFim) > 366) {
    throw new ErroConciliacao(`Período de extrato maior que 366 dias (${periodoInicio} a ${periodoFim}). Verifique o arquivo.`);
  }

  // Extrair COOP. (agência) — "1234-5 / ..." => agência = "1234"
  let agencia: string | undefined;
  const mCoop = textoCabecalho.match(/COOP\.:\s*([\d]+(?:-[\dX])?)(?:\s*\/\s*(.+?))?(?=\s+CONTA|\s+PERÍODO|$)/i)
    || textoCabecalho.match(/COOP\.:\s*([\d]+(?:-[\dX])?)/i);
  if (mCoop) {
    agencia = mCoop[1].split('-')[0].trim();
  }

  // Extrair CONTA — "111.111-1 / EMPRESA TESTE LTDA"
  let conta: string | undefined;
  let acctIdBruto: string | undefined;
  let titular: string | undefined;

  const mConta = textoCabecalho.match(/CONTA:\s*([\d.]+(?:-[\dX])?)(?:\s*\/\s*(.+?))?(?=\s+PERÍODO|\s+HISTÓRICO|$)/i)
    || textoCabecalho.match(/CONTA:\s*([\d.]+(?:-[\dX])?)/i);
  if (mConta) {
    acctIdBruto = mConta[1].trim();
    conta = acctIdBruto.replace(/\D/g, '');
    if (mConta[2]) {
      titular = mConta[2].trim();
    }
  }

  // Extrair CNPJ do titular se presente no cabeçalho
  let cnpjTitular: string | undefined;
  const mCnpjCabecalho = textoCabecalho.match(/(?:CNPJ|CPF)[:\s]*([\d.\/\s-]+)/i);
  if (mCnpjCabecalho) {
    const rawCnpj = mCnpjCabecalho[1].trim();
    if (rawCnpj.replace(/\D/g, '').length >= 11) {
      cnpjTitular = rawCnpj;
    }
  }

  // ─── 2. SEGMENTAR ITENS APÓS O CABEÇALHO ────────────────────────────────
  const idxBodyInicio = idxHistorico >= 0 ? idxHistorico + 1 : 0;
  const itensBody = itens.slice(idxBodyInicio);

  // Detectar início da seção RESUMO ou LANÇAMENTOS FUTUROS para truncar itensMov
  let idxCorteMov = itensBody.length;
  for (let i = 0; i < itensBody.length; i++) {
    const t = itensBody[i].texto.trim();
    if (RE_FIM_MOVIMENTOS.test(t)) {
      idxCorteMov = i;
      break;
    }
  }
  const itensMov = itensBody.slice(0, idxCorteMov);

  // ─── 2.1 PARSEAR LANÇAMENTOS FUTUROS (SE HOUVER) ────────────────────────
  const lancamentosFuturos: LancamentoFuturoExtrato[] = [];
  const idxFuturosSection = itensBody.findIndex(i => RE_LANCAMENTOS_FUTUROS_SECTION.test(i.texto.trim()));

  if (idxFuturosSection >= 0) {
    const itensFuturosRaw = itensBody.slice(idxFuturosSection + 1);
    const idxFimFuturos = itensFuturosRaw.findIndex(i => RE_RESUMO_SECTION.test(i.texto.trim()));
    const itensFuturos = idxFimFuturos >= 0 ? itensFuturosRaw.slice(0, idxFimFuturos) : itensFuturosRaw;

    const RE_DATA_FUTURO = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/;
    const blocosFuturos: ItemPdf[][] = [];
    let blocoFuturoAtual: ItemPdf[] | null = null;

    for (const it of itensFuturos) {
      const t = it.texto.trim();
      if (RE_DATA_FUTURO.test(t)) {
        if (blocoFuturoAtual) {
          blocosFuturos.push(blocoFuturoAtual);
        }
        blocoFuturoAtual = [it];
      } else if (blocoFuturoAtual) {
        blocoFuturoAtual.push(it);
      }
    }
    if (blocoFuturoAtual) {
      blocosFuturos.push(blocoFuturoAtual);
    }

    for (const bf of blocosFuturos) {
      const itemData = bf[0];
      const mData = itemData.texto.trim().match(RE_DATA_FUTURO);
      if (!mData) continue;
      const dd = mData[1];
      const mm = mData[2];
      const anoRaw = mData[3];
      const aaaa = anoRaw.length === 2 ? `20${anoRaw}` : anoRaw;
      const dataIso = `${aaaa}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;

      const restantes = bf.slice(1);
      let valorFuturo = 0;
      let tipoFuturo: TipoTransacaoExtrato = 'debito';
      let itemValorFuturo: ItemPdf | undefined;

      for (let k = 0; k < restantes.length; k++) {
        const it = restantes[k];
        const parsed = parsearValorSicoob(it.texto.trim());
        if (parsed) {
          itemValorFuturo = it;
          valorFuturo = parsed.valor;
          let sinal = parsed.sinal;
          if (!sinal) {
            const prox = restantes[k + 1];
            if (prox && RE_SINAL_AVULSO.test(prox.texto.trim())) {
              sinal = prox.texto.trim() as 'C' | 'D';
            }
          }
          tipoFuturo = sinal === 'C' ? 'credito' : 'debito';
          break;
        }
      }

      if (!itemValorFuturo) continue;

      const itensSemValor = restantes.filter(it => it !== itemValorFuturo && !RE_SINAL_AVULSO.test(it.texto.trim()));
      let docFuturo: string | undefined;
      const descFuturoPartes: string[] = [];

      for (const it of itensSemValor) {
        const t = it.texto.trim();
        const mDoc = t.match(/DOC\.:\s*(\S+)/i);
        if (mDoc) {
          docFuturo = mDoc[1];
        } else {
          descFuturoPartes.push(t);
        }
      }

      const descricaoFuturo = descFuturoPartes.join(' ').trim() || 'Lançamento Futuro';

      lancamentosFuturos.push({
        data: dataIso,
        descricao: descricaoFuturo,
        valor: arredondar2Casas(valorFuturo),
        tipo: tipoFuturo,
        documento: docFuturo
      });
    }
  }

  // ─── 3. MONTAR BLOCOS ────────────────────────────────────────────────────
  function isItemCabecalhoRepetido(item: ItemPdf): boolean {
    const t = item.texto.trim().toUpperCase();
    if (TEXTOS_CABEÇALHO.has(t)) return true;
    if (RE_CABEÇALHO_REPETIDO.test(item.texto.trim())) return true;
    if (t === 'SICOOB') return true;
    return false;
  }

  function isItemData(item: ItemPdf): boolean {
    return RE_DATA_DDMM.test(item.texto.trim()) && item.x < 140;
  }

  const blocos: BlocoMovimento[] = [];
  let blocoAtual: BlocoMovimento | null = null;
  let ultimaDataVista = '';

  for (let i = 0; i < itensMov.length; i++) {
    const item = itensMov[i];
    const texto = item.texto.trim();

    if (isItemCabecalhoRepetido(item)) {
      if (blocoAtual) {
        blocos.push(blocoAtual);
        blocoAtual = null;
      }
      continue;
    }

    const isControleDireto = item.x >= 130 && item.x < 400 && RE_CONTROLE_SALDO.test(texto);

    if (isItemData(item)) {
      if (blocoAtual) {
        blocos.push(blocoAtual);
      }
      ultimaDataVista = texto;
      blocoAtual = {
        indiceInicio: idxBodyInicio + i,
        ddmm: texto,
        itensBloco: [item]
      };
    } else if (isControleDireto && (!blocoAtual || blocoAtual.itensBloco.length > 1 || !isItemData(blocoAtual.itensBloco[0]))) {
      if (blocoAtual) {
        blocos.push(blocoAtual);
      }
      const dataControle = RE_SALDO_ANTERIOR.test(texto)
        ? `${periodoInicio.slice(8, 10)}/${periodoInicio.slice(5, 7)}`
        : (ultimaDataVista || `${periodoInicio.slice(8, 10)}/${periodoInicio.slice(5, 7)}`);

      blocoAtual = {
        indiceInicio: idxBodyInicio + i,
        ddmm: dataControle,
        itensBloco: [item]
      };
    } else {
      if (blocoAtual) {
        blocoAtual.itensBloco.push(item);
      }
    }
  }
  if (blocoAtual) {
    blocos.push(blocoAtual);
  }

  // ─── 4. PROCESSAR CADA BLOCO ─────────────────────────────────────────────
  interface EntradaSaldo {
    data: string;
    valor: number;
    tipo: 'anterior' | 'dia';
  }
  interface EntradaTransacao {
    data: string;
    valor: number;
    tipo: TipoTransacaoExtrato;
    descricaoOriginal: string;
    descricaoNormalizada: string;
    contraparte?: string;
    documento?: string;
    detalhes?: string;
    linhaOrigem: number;
    // Campos novos Parte 24B
    tipoOperacaoBanco?: 'pix_emitido' | 'pix_recebido' | 'pix_transferencia' | 'titulo_boleto' | 'db_tr_dif_tit' | 'outro';
    contraparteNome?: string;
    contraparteDocumento?: string;
    documentoMascarado?: boolean;
    mensagemUsuario?: string;
    favorecido?: string;
    ehPropriaEmpresa?: boolean;
  }

  const entradasTransacoes: EntradaTransacao[] = [];
  const entradasSaldo: EntradaSaldo[] = [];

  for (const bloco of blocos) {
    const { ddmm, itensBloco, indiceInicio } = bloco;
    const dataBlocoIso = inferirAno(ddmm, periodoInicio, periodoFim);

    const temItemDataNoBloco = isItemData(itensBloco[0]);
    const itensRestantes = temItemDataNoBloco ? itensBloco.slice(1) : itensBloco;

    // Detectar linha de controle
    const primeiroHistorico = itensRestantes.find(i => i.x >= 130 && i.x < 430);
    const textoHistorico = primeiroHistorico?.texto.trim() ?? '';

    const isControle = RE_CONTROLE_SALDO.test(textoHistorico) ||
      itensBloco.some(it => RE_CONTROLE_SALDO.test(it.texto.trim()));

    if (isControle) {
      const itemControle = itensBloco.find(it => RE_CONTROLE_SALDO.test(it.texto.trim()));
      const textoControle = itemControle?.texto.trim() ?? textoHistorico;

      if (RE_SALDO_DO_DIA.test(textoControle)) {
        const itemValor = itensRestantes.find(i => RE_VALOR_COMPLETO.test(i.texto.trim()) && i.x >= 400);
        if (itemValor) {
          const parsed = parsearValorSicoob(itemValor.texto.trim());
          if (parsed) {
            let sinalSaldo = parsed.sinal;
            if (!sinalSaldo || sinalSaldo === null) {
              const idxItemVal = itensRestantes.indexOf(itemValor);
              const proxItem = itensRestantes[idxItemVal + 1];
              if (proxItem && RE_SINAL_AVULSO.test(proxItem.texto.trim())) {
                sinalSaldo = proxItem.texto.trim() as 'C' | 'D' | '*';
              }
            }
            const valorSaldo = sinalSaldo === 'D' ? -parsed.valor : parsed.valor;
            entradasSaldo.push({ data: dataBlocoIso, valor: valorSaldo, tipo: 'dia' });
          }
        }
      } else if (RE_SALDO_ANTERIOR.test(textoControle)) {
        const itemValor = itensRestantes.find(i => RE_VALOR_COMPLETO.test(i.texto.trim()) && i.x >= 400);
        if (itemValor) {
          const parsed = parsearValorSicoob(itemValor.texto.trim());
          if (parsed) {
            let sinalSaldo = parsed.sinal;
            if (!sinalSaldo) {
              const idxItemVal = itensRestantes.indexOf(itemValor);
              const proxItem = itensRestantes[idxItemVal + 1];
              if (proxItem && RE_SINAL_AVULSO.test(proxItem.texto.trim())) {
                sinalSaldo = proxItem.texto.trim() as 'C' | 'D' | '*';
              }
            }
            if (sinalSaldo !== '*') {
              const valorSaldo = sinalSaldo === 'D' ? -parsed.valor : parsed.valor;
              const dataSaldoAnterior = diaAnterior(periodoInicio);
              entradasSaldo.push({ data: dataSaldoAnterior, valor: valorSaldo, tipo: 'anterior' });
            }
          }
        }
      }
      continue;
    }

    // ─── Bloco de transação ───
    let itemValor: ItemPdf | undefined;
    let sinalTransacao: 'C' | 'D' | null = null;
    let valorTransacao: number | undefined;

    for (let j = 0; j < itensRestantes.length; j++) {
      const it = itensRestantes[j];
      if (RE_VALOR_COMPLETO.test(it.texto.trim()) && it.x >= 400) {
        itemValor = it;
        const parsed = parsearValorSicoob(it.texto.trim());
        if (!parsed) continue;
        valorTransacao = parsed.valor;

        if (parsed.sinal === 'C' || parsed.sinal === 'D') {
          sinalTransacao = parsed.sinal;
        } else if (parsed.sinal === '*') {
          itemValor = undefined;
          break;
        } else {
          const proxIt = itensRestantes[j + 1];
          if (proxIt && RE_SINAL_AVULSO.test(proxIt.texto.trim())) {
            if (proxIt.texto.trim() === '*') {
              itemValor = undefined;
              break;
            }
            sinalTransacao = proxIt.texto.trim() as 'C' | 'D';
          }
        }
        break;
      }
    }

    if (!itemValor || valorTransacao === undefined) {
      continue;
    }

    if (!sinalTransacao) {
      throw new ErroConciliacao(
        `Transação em ${dataBlocoIso} com valor ${itemValor.texto.trim()} sem indicador de débito/crédito (C/D). ` +
        `Verifique o arquivo PDF.`
      );
    }

    const tipo: TipoTransacaoExtrato = sinalTransacao === 'C' ? 'credito' : 'debito';

    const idxItemValor = itensRestantes.indexOf(itemValor!);
    const idxSinalAvulso = sinalTransacao && !parsearValorSicoob(itemValor.texto.trim())?.sinal
      ? idxItemValor + 1
      : -1;

    const itensDescricao = itensRestantes.filter((it, idx) => {
      if (idx === idxItemValor) return false;
      if (idx === idxSinalAvulso) return false;
      if (it.x >= 400) return false;
      return true;
    });

    const itemDescPrincipal = itensDescricao.find(i => i.x >= 130 && i.x < 400);
    const descricaoOriginal = itemDescPrincipal?.texto.trim() ?? '';
    const descricaoNormalizada = normalizarDescricao(descricaoOriginal);

    const itensDetalhe = itemDescPrincipal
      ? itensDescricao.filter(i => i !== itemDescPrincipal)
      : itensDescricao.slice(1);

    // ─── Extração de Metadados Ricos (Parte 24B) ───
    let tipoOperacaoBanco: 'pix_emitido' | 'pix_recebido' | 'pix_transferencia' | 'titulo_boleto' | 'db_tr_dif_tit' | 'outro' = 'outro';
    const descUpper = descricaoOriginal.toUpperCase();
    if (/PIX\.?EMIT\.OUT IF-MSM/i.test(descUpper)) {
      tipoOperacaoBanco = 'pix_emitido';
    } else if (/PIX\s*RECEB/i.test(descUpper)) {
      tipoOperacaoBanco = 'pix_recebido';
    } else if (/PIX\s*EMIT/i.test(descUpper)) {
      tipoOperacaoBanco = 'pix_emitido';
    } else if (/DB\.TR\.C\.DIF\.TIT\.INT/i.test(descUpper)) {
      tipoOperacaoBanco = 'db_tr_dif_tit';
    } else if (/D[EÉ]B\.TIT\.COMPE\.EFETI/i.test(descUpper)) {
      tipoOperacaoBanco = 'titulo_boleto';
    }

    let favorecido: string | undefined;
    let contraparteNome: string | undefined;
    let contraparteDocumento: string | undefined;
    let documentoMascarado: boolean | undefined;
    let mensagemUsuario: string | undefined;
    let documentoTransacao: string | undefined;
    let ehPropriaEmpresa: boolean = false;

    if (/PIX\.?EMIT\.OUT IF-MSM/i.test(descUpper)) {
      ehPropriaEmpresa = true;
    }

    interface DetalheLinha {
      texto: string;
      consumidoComo?: 'fav' | 'tipo_pix' | 'doc' | 'contraparte_doc' | 'contraparte_nome' | 'proprio_titular';
    }
    const linhasDet: DetalheLinha[] = [];

    for (const det of itensDetalhe) {
      const t = det.texto.trim();
      if (!t) continue;

      const mColado = t.match(RE_DOC_COLADO);
      if (mColado) {
        linhasDet.push({ texto: mColado[1].trim() });
        linhasDet.push({ texto: mColado[2].trim() });
      } else {
        linhasDet.push({ texto: t });
      }
    }

    // 1) FAV.: <nome>
    for (const l of linhasDet) {
      const mFav = l.texto.match(RE_FAV);
      if (mFav) {
        favorecido = mFav[1].trim();
        l.consumidoComo = 'fav';
      }
    }

    // 2) DOC.: <número>
    for (const l of linhasDet) {
      const mDoc = l.texto.match(RE_DOC_ISOLADO);
      if (mDoc) {
        documentoTransacao = mDoc[1].trim();
        l.consumidoComo = 'doc';
      }
    }

    // 3) Linha indicadora de Pix ("Pagamento Pix", "Recebimento Pix", "Transferência Pix")
    let tipoPixEncontrado: string | undefined;
    let idxTipoPix = -1;
    for (let k = 0; k < linhasDet.length; k++) {
      const l = linhasDet[k];
      if (RE_TIPO_PIX_LINHA.test(l.texto)) {
        tipoPixEncontrado = l.texto;
        idxTipoPix = k;
        l.consumidoComo = 'tipo_pix';
        break;
      }
    }

    // Em DB.TR.C.DIF.TIT.INT: as linhas após "Transferência Pix" são nome e CNPJ do titular
    if (tipoOperacaoBanco === 'db_tr_dif_tit' && idxTipoPix >= 0) {
      for (let k = idxTipoPix + 1; k < linhasDet.length; k++) {
        const l = linhasDet[k];
        if (l.consumidoComo) continue;
        const textoNorm = l.texto.toUpperCase();
        if (
          (titular && textoNorm.includes(titular.toUpperCase().slice(0, 8))) ||
          RE_CNPJ_ESPACO_OU_BARRA.test(l.texto) ||
          textoNorm.includes('EMPRESA') ||
          textoNorm.includes('LTDA')
        ) {
          l.consumidoComo = 'proprio_titular';
        }
      }
    }

    // Em Recebimento Pix: primeira linha com letras após tipo Pix é o nome do pagador
    if (tipoOperacaoBanco === 'pix_recebido' || (tipoPixEncontrado && /Recebimento Pix/i.test(tipoPixEncontrado))) {
      for (let k = idxTipoPix + 1; k < linhasDet.length; k++) {
        const l = linhasDet[k];
        if (l.consumidoComo) continue;
        if (
          !RE_CPF_MASC.test(l.texto) &&
          !RE_CNPJ_ESPACO_OU_BARRA.test(l.texto) &&
          !RE_CPF_NORMAL.test(l.texto) &&
          !RE_DOC_ISOLADO.test(l.texto) &&
          /[A-Za-záéíóúãõâêîôûç]/i.test(l.texto)
        ) {
          contraparteNome = l.texto;
          l.consumidoComo = 'contraparte_nome';
          break;
        }
      }
    }

    // 4) Identificar documento da contraparte (CPF mascarado ou CNPJ com espaço/barra)
    for (const l of linhasDet) {
      if (l.consumidoComo) continue;
      if (RE_CPF_MASC.test(l.texto)) {
        contraparteDocumento = l.texto;
        documentoMascarado = true;
        l.consumidoComo = 'contraparte_doc';
        break;
      } else if (RE_CNPJ_ESPACO_OU_BARRA.test(l.texto)) {
        contraparteDocumento = l.texto;
        documentoMascarado = false;
        l.consumidoComo = 'contraparte_doc';
        break;
      } else if (RE_CPF_NORMAL.test(l.texto)) {
        contraparteDocumento = l.texto;
        documentoMascarado = false;
        l.consumidoComo = 'contraparte_doc';
        break;
      }
    }

    // 5) Mensagem do usuário: linhas restantes não consumidas
    const linhasMensagem: string[] = [];
    for (const l of linhasDet) {
      if (l.consumidoComo) continue;
      const t = l.texto.trim();
      if (!t) continue;
      if (/^(CPF|CNPJ):/i.test(t)) continue;
      if (/^\d+$/.test(t.replace(/[.\-\/\s]/g, ''))) continue;
      linhasMensagem.push(t);
    }
    if (linhasMensagem.length > 0) {
      mensagemUsuario = linhasMensagem.join(' ');
    }

    // Determinar se contraparte é a própria empresa
    const cnpjEmpresaAlvo = opcoes?.cnpjEmpresa || cnpjTitular || '34.892.105/0001-44';
    const digitosEmpresaAlvo = cnpjEmpresaAlvo.replace(/\D/g, '');
    if (contraparteDocumento) {
      const digitosContraparte = contraparteDocumento.replace(/\D/g, '');
      if (digitosContraparte.length >= 11 && digitosEmpresaAlvo.length >= 11 && digitosContraparte === digitosEmpresaAlvo) {
        ehPropriaEmpresa = true;
      }
    }

    // Definir contraparte para retrocompatibilidade
    let contraparte: string | undefined;
    if (favorecido) {
      contraparte = favorecido;
    } else if (contraparteNome) {
      contraparte = contraparteNome;
    } else if (contraparteDocumento && !documentoMascarado) {
      contraparte = contraparteDocumento;
    } else {
      for (const det of itensDetalhe) {
        const t = det.texto.trim();
        if (!t) continue;
        if (/^CPF:/i.test(t) || /^CNPJ:/i.test(t) || /^DOC\.:/i.test(t)) continue;
        if (/^\d+$/.test(t.replace(/[.\-\/]/g, ''))) continue;
        if (/[A-Za-záéíóúãõâêîôûç]/i.test(t)) {
          contraparte = t;
          break;
        }
      }
    }

    const detalhesStr = itensDetalhe.length > 0
      ? itensDetalhe.map(i => i.texto.trim()).join(' | ')
      : undefined;

    entradasTransacoes.push({
      data: dataBlocoIso,
      valor: arredondar2Casas(valorTransacao),
      tipo,
      descricaoOriginal,
      descricaoNormalizada,
      contraparte,
      documento: documentoTransacao,
      detalhes: detalhesStr,
      linhaOrigem: indiceInicio + 1,
      tipoOperacaoBanco,
      contraparteNome,
      contraparteDocumento,
      documentoMascarado,
      mensagemUsuario,
      favorecido,
      ehPropriaEmpresa
    });
  }

  // ─── 5. CONFERÊNCIA DE SALDO ──────────────────────────────────────────────
  const entradaAnterior = entradasSaldo.find(e => e.tipo === 'anterior');
  const saldosDia = entradasSaldo.filter(e => e.tipo === 'dia');

  if (entradaAnterior !== undefined) {
    let saldoAcumulado = entradaAnterior.valor;

    const transacoesPorDia = new Map<string, EntradaTransacao[]>();
    for (const t of entradasTransacoes) {
      const arr = transacoesPorDia.get(t.data) ?? [];
      arr.push(t);
      transacoesPorDia.set(t.data, arr);
    }

    const diasComSaldo = [...new Set(saldosDia.map(s => s.data))].sort();

    const todosDias = [...new Set([
      ...entradasTransacoes.map(t => t.data),
      ...diasComSaldo
    ])].sort();

    for (const dia of todosDias) {
      const transacoesDia = transacoesPorDia.get(dia) ?? [];
      for (const t of transacoesDia) {
        saldoAcumulado += t.tipo === 'credito' ? t.valor : -t.valor;
        saldoAcumulado = arredondar2Casas(saldoAcumulado);
      }
      const saldoDia = saldosDia.find(s => s.data === dia);
      if (saldoDia) {
        if (Math.abs(saldoAcumulado - saldoDia.valor) > 0.005) {
          throw new ErroConciliacao(
            `Divergência de saldo em ${dia}: ` +
            `extrato mostra ${saldoDia.valor.toFixed(2)}, ` +
            `calculado ${saldoAcumulado.toFixed(2)}. ` +
            `Verifique o arquivo PDF.`
          );
        }
      }
    }
  } else {
    if (saldosDia.length >= 2) {
      avisos.push('Aviso: SALDO ANTERIOR não encontrado. Conferência de saldo entre dias consecutivos apenas.');
    } else {
      avisos.push('Aviso: SALDO ANTERIOR não encontrado. Conferência de saldo não realizada.');
    }
  }

  // ─── 6. MONTAR TRANSAÇÕES FINAIS ─────────────────────────────────────────
  const mapaOrdemNoDia = new Map<string, number>();
  const transacoes: TransacaoExtrato[] = [];

  for (const entrada of entradasTransacoes) {
    const prefixoDesc = extrairPrefixoDescricao(entrada.descricaoNormalizada);
    const chaveDeterminismo = `${entrada.data}_${entrada.tipo}_${entrada.valor.toFixed(2)}_${prefixoDesc}`;
    const ordemNoDia = mapaOrdemNoDia.get(chaveDeterminismo) ?? 0;
    mapaOrdemNoDia.set(chaveDeterminismo, ordemNoDia + 1);

    const idTemporario = `pdf_${entrada.data}_L${entrada.linhaOrigem}_${ordemNoDia}`;

    transacoes.push({
      idTemporario,
      fitid: undefined,
      data: entrada.data,
      valor: entrada.valor,
      tipo: entrada.tipo,
      descricaoOriginal: entrada.descricaoOriginal,
      descricaoNormalizada: entrada.descricaoNormalizada,
      contraparte: entrada.contraparte,
      documento: entrada.documento,
      detalhes: entrada.detalhes,
      ordemNoDia,
      linhaOrigem: entrada.linhaOrigem,
      tipoOperacaoBanco: entrada.tipoOperacaoBanco,
      contraparteNome: entrada.contraparteNome,
      contraparteDocumento: entrada.contraparteDocumento,
      documentoMascarado: entrada.documentoMascarado,
      mensagemUsuario: entrada.mensagemUsuario,
      favorecido: entrada.favorecido,
      ehPropriaEmpresa: entrada.ehPropriaEmpresa
    });
  }

  // ─── 7. SALDO FINAL ───────────────────────────────────────────────────────
  let saldoFinal: { valor: number; data: string } | undefined;

  if (saldosDia.length > 0) {
    const ultimoSaldoDia = saldosDia.reduce((prev, curr) =>
      curr.data >= prev.data ? curr : prev
    );
    saldoFinal = { valor: ultimoSaldoDia.valor, data: ultimoSaldoDia.data };
  } else if (entradaAnterior) {
    saldoFinal = { valor: entradaAnterior.valor, data: diaAnterior(periodoInicio) };
  }

  return {
    formato: 'pdf',
    bancoCodigo: '756',
    bancoNome: 'Sicoob',
    agencia,
    conta,
    acctIdBruto,
    titular,
    cnpjTitular,
    periodo: { inicio: periodoInicio, fim: periodoFim },
    saldoFinal,
    transacoes,
    lancamentosFuturos: lancamentosFuturos.length > 0 ? lancamentosFuturos : undefined,
    avisos
  };
}
