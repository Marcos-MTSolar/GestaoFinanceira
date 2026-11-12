// MT Solar - Gestão Financeira
// Sugestão Inteligente e Determinística de Categoria para Extratos Bancários (Parte 24C)
// Função PURA sem efeitos colaterais

import { Categoria, Contato, Lancamento } from '../../types';
import { TransacaoExtrato, normalizarDescricao } from './tipos';
import { RegraImportacao, REGRAS_POR_BANCO } from './classificarTransacao';

export type OrigemSugestaoCategoria =
  | 'regra_usuario'
  | 'contato'
  | 'historico'
  | 'palavra_chave'
  | 'regra_banco'
  | 'nenhuma';

export interface SugestaoCategoriaResultado {
  categoriaId?: string;
  categoriaNome?: string;
  contatoId?: string;
  origemSugestao: OrigemSugestaoCategoria;
  tipoOrigemEtiqueta?: 'mensagem' | 'historico' | 'contato' | 'regra' | 'banco';
  rotuloBadge?: string;
}

export interface ParametrosSugerirCategoria {
  transacao: TransacaoExtrato;
  bancoCodigo: string;
  contaId: string;
  categorias: Categoria[];
  regrasUsuario?: RegraImportacao[];
  contatos?: Contato[];
  historicoLancamentos?: Lancamento[];
}

/**
 * Normaliza textos para comparação insensível a caixa, acentos e pontuação.
 */
function normalizar(texto?: string): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sugere categoria e contato para uma transação de extrato seguindo precedência rigorosa:
 * 1) Regra do usuário (RegraImportacao com campos 'mensagem', 'documento', 'favorecido', 'contraparte', 'descricao')
 * 2) Contato por documento completo (CNPJ/CPF) ou CPF mascarado único -> categoria habitual
 * 3) Histórico: lançamentos anteriores com mesma mensagem ou documento -> categoria mais frequente (mínimo 60%)
 * 4) Palavras-chave da mensagem ou favorecido casadas contra categorias EXISTENTES (ex: almoco -> "aliment", posto -> "combust")
 * 5) Regra do banco
 */
export function sugerirCategoria(params: ParametrosSugerirCategoria): SugestaoCategoriaResultado {
  const {
    transacao,
    bancoCodigo,
    contaId,
    categorias,
    regrasUsuario = [],
    contatos = [],
    historicoLancamentos = []
  } = params;

  // -------------------------------------------------------------------------
  // 1. REGRA DO USUÁRIO (Precedência máxima)
  // -------------------------------------------------------------------------
  const regrasAplicaveis = regrasUsuario.filter((r) => {
    if (!r.ativa) return false;
    if (r.banco_codigo !== '*' && r.banco_codigo !== bancoCodigo) return false;
    if (r.conta_id !== '*' && r.conta_id !== contaId) return false;
    return true;
  });

  for (const r of regrasAplicaveis) {
    const campo = r.campo || 'descricao';
    let valorAlvo = '';
    if (campo === 'mensagem') {
      valorAlvo = transacao.mensagemUsuario || '';
    } else if (campo === 'favorecido') {
      valorAlvo = transacao.favorecido || '';
    } else if (campo === 'documento') {
      valorAlvo = transacao.contraparteDocumento || transacao.documento || '';
    } else if (campo === 'contraparte') {
      valorAlvo = transacao.contraparte || transacao.contraparteNome || '';
    } else {
      valorAlvo = transacao.descricaoNormalizada || transacao.descricaoOriginal;
    }

    if (!valorAlvo) continue;

    const valorAlvoNorm = normalizar(valorAlvo);
    const valorRegraNorm = normalizar(r.valor);
    if (!valorRegraNorm) continue;

    let casou = false;
    if (r.operador === 'comeca_com') {
      casou = valorAlvoNorm.startsWith(valorRegraNorm);
    } else if (r.operador === 'igual') {
      casou = valorAlvoNorm === valorRegraNorm;
    } else {
      casou = valorAlvoNorm.includes(valorRegraNorm);
    }

    if (casou) {
      const cat = categorias.find((c) => c.id === r.categoria_id);
      return {
        categoriaId: r.categoria_id,
        categoriaNome: cat?.nome,
        contatoId: r.contato_id,
        origemSugestao: 'regra_usuario',
        tipoOrigemEtiqueta: 'regra',
        rotuloBadge: 'Sugerida (regra)',
      };
    }
  }

  // -------------------------------------------------------------------------
  // 2. CONTATO POR DOCUMENTO COMPLETO OU CPF MASCARADO ÚNICO
  // -------------------------------------------------------------------------
  const docTransacao = transacao.contraparteDocumento || transacao.documento;
  let contatoEncontrado: Contato | undefined;

  if (docTransacao) {
    const digitosDoc = docTransacao.replace(/\D/g, '');

    if (transacao.documentoMascarado || /^\*{3}/.test(docTransacao)) {
      // CPF Mascarado: ex: ***.791.454-** -> 6 dígitos centrais visíveis
      if (digitosDoc.length === 6) {
        const contatosCandidatos = contatos.filter((c) => {
          const digitosContato = (c.cpf_cnpj || '').replace(/\D/g, '');
          if (digitosContato.length === 11) {
            const miolo = digitosContato.slice(3, 9);
            return miolo === digitosDoc;
          }
          return false;
        });

        // Só sugere se casar com UM único contato
        if (contatosCandidatos.length === 1) {
          contatoEncontrado = contatosCandidatos[0];
        }
      }
    } else if (digitosDoc.length >= 11) {
      // Documento COMPLETO
      contatoEncontrado = contatos.find((c) => {
        const digitosContato = (c.cpf_cnpj || '').replace(/\D/g, '');
        return digitosContato.length >= 11 && digitosContato === digitosDoc;
      });
    }
  }

  if (contatoEncontrado) {
    let categoriaDoContatoId: string | undefined =
      (contatoEncontrado as any).categoria_padrao_id || (contatoEncontrado as any).categoria_id;

    if (!categoriaDoContatoId && historicoLancamentos.length > 0) {
      const lancsDoContato = historicoLancamentos.filter(
        (l) => l.contato_id === contatoEncontrado!.id && l.categoria_id
      );
      if (lancsDoContato.length > 0) {
        const freq = new Map<string, number>();
        for (const l of lancsDoContato) {
          freq.set(l.categoria_id, (freq.get(l.categoria_id) || 0) + 1);
        }
        let maisFreqId = '';
        let maxFreq = 0;
        for (const [id, count] of freq.entries()) {
          if (count > maxFreq) {
            maxFreq = count;
            maisFreqId = id;
          }
        }
        categoriaDoContatoId = maisFreqId;
      }
    }

    if (categoriaDoContatoId) {
      const cat = categorias.find((c) => c.id === categoriaDoContatoId);
      return {
        categoriaId: categoriaDoContatoId,
        categoriaNome: cat?.nome,
        contatoId: contatoEncontrado.id,
        origemSugestao: 'contato',
        tipoOrigemEtiqueta: 'contato',
        rotuloBadge: 'Sugerida (contato)',
      };
    }
  }

  // -------------------------------------------------------------------------
  // 3. HISTÓRICO: LANÇAMENTOS ANTERIORES (MENSAGEM OU DOCUMENTO, >= 60%)
  // -------------------------------------------------------------------------
  if (historicoLancamentos.length > 0) {
    const msgTransacaoNorm = transacao.mensagemUsuario ? normalizar(transacao.mensagemUsuario) : '';
    const docTransacaoLimpo = docTransacao ? docTransacao.trim() : '';

    if (msgTransacaoNorm || docTransacaoLimpo) {
      const lancsCasados = historicoLancamentos.filter((l) => {
        if (!l.categoria_id) return false;

        // Casamento por mensagem
        if (msgTransacaoNorm) {
          if (l.observacoes && normalizar(l.observacoes).includes(msgTransacaoNorm)) {
            return true;
          }
          if (l.descricao && normalizar(l.descricao).includes(msgTransacaoNorm)) {
            return true;
          }
        }

        // Casamento por documento
        if (docTransacaoLimpo) {
          if (l.observacoes && l.observacoes.includes(docTransacaoLimpo)) {
            return true;
          }
          if ((l.origem_importacao as any)?.contraparteDocumento === docTransacaoLimpo) {
            return true;
          }
          if ((l.origem_importacao as any)?.documento === docTransacaoLimpo) {
            return true;
          }
        }

        return false;
      });

      if (lancsCasados.length > 0) {
        const freq = new Map<string, number>();
        for (const l of lancsCasados) {
          freq.set(l.categoria_id, (freq.get(l.categoria_id) || 0) + 1);
        }

        let catMaisFrequenteId = '';
        let maxContagem = 0;
        for (const [catId, count] of freq.entries()) {
          if (count > maxContagem) {
            maxContagem = count;
            catMaisFrequenteId = catId;
          }
        }

        const participacao = maxContagem / lancsCasados.length;
        if (participacao >= 0.60 && catMaisFrequenteId) {
          const cat = categorias.find((c) => c.id === catMaisFrequenteId);
          return {
            categoriaId: catMaisFrequenteId,
            categoriaNome: cat?.nome,
            contatoId: contatoEncontrado?.id,
            origemSugestao: 'historico',
            tipoOrigemEtiqueta: 'historico',
            rotuloBadge: 'Sugerida (histórico)',
          };
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. PALAVRAS-CHAVE DA MENSAGEM OU FAVORECIDO CONTRA CATEGORIAS EXISTENTES
  // -------------------------------------------------------------------------
  const textoParaAnalise = [
    transacao.mensagemUsuario,
    transacao.favorecido,
    transacao.contraparteNome
  ].filter(Boolean).join(' ');

  if (textoParaAnalise.trim()) {
    const textoNorm = normalizar(textoParaAnalise);

    const MAPA_RADICAIS: Array<{ termos: string[]; radicalCategoria: string }> = [
      {
        termos: ['ALMOCO', 'REFEICAO', 'ALIMENTACAO', 'ALIMENT', 'RESTAURANTE', 'LANCHE', 'MARMITA', 'BUFFET'],
        radicalCategoria: 'ALIMENT',
      },
      {
        termos: ['POSTO', 'COMBUSTIVEL', 'COMBUST', 'GASOLINA', 'DIESEL', 'ETANOL', 'ABASTECIMENTO'],
        radicalCategoria: 'COMBUST',
      },
      {
        termos: ['PEDAGIO', 'SEM PARAR', 'CONCESSIONARIA RODOVIA', 'AUTOPISTA'],
        radicalCategoria: 'PEDAG',
      },
      {
        termos: ['HOTEL', 'POUSADA', 'HOSPEDAGEM', 'HOSTEL'],
        radicalCategoria: 'HOSPED',
      },
    ];

    for (const regraRadical of MAPA_RADICAIS) {
      const bateTermo = regraRadical.termos.some((termo) => {
        const regexTermo = new RegExp(`\\b${termo}\\b`, 'i');
        return regexTermo.test(textoNorm) || textoNorm.includes(termo);
      });

      if (bateTermo) {
        // Busca se existe categoria cadastrada compatível com o radical
        const catExistente = categorias.find((c) =>
          normalizar(c.nome).includes(regraRadical.radicalCategoria)
        );
        if (catExistente) {
          return {
            categoriaId: catExistente.id,
            categoriaNome: catExistente.nome,
            contatoId: contatoEncontrado?.id,
            origemSugestao: 'palavra_chave',
            tipoOrigemEtiqueta: 'mensagem',
            rotuloBadge: 'Sugerida (mensagem)',
          };
        }
        // Se a categoria não existir, NÃO cria nada
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. REGRA DO BANCO (Heurística genérica do banco emissor)
  // -------------------------------------------------------------------------
  const regrasBanco = REGRAS_POR_BANCO[bancoCodigo] ?? [];
  const regraBanco = regrasBanco.find((r) => r.testar(transacao.descricaoNormalizada));

  if (regraBanco && regraBanco.categoriaSugeridaNome) {
    const nomeSugeridoNorm = normalizar(regraBanco.categoriaSugeridaNome);
    const catBanco = categorias.find((c) => normalizar(c.nome).includes(nomeSugeridoNorm));
    if (catBanco) {
      return {
        categoriaId: catBanco.id,
        categoriaNome: catBanco.nome,
        contatoId: contatoEncontrado?.id,
        origemSugestao: 'regra_banco',
        tipoOrigemEtiqueta: 'banco',
        rotuloBadge: 'Sugerida (regra)',
      };
    }
  }

  return {
    contatoId: contatoEncontrado?.id,
    origemSugestao: 'nenhuma',
  };
}

