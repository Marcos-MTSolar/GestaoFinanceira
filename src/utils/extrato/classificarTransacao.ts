// MT Solar - Gestão Financeira
// Classificação de Transações de Extrato com Sugestão de Categoria (Parte 15D)

import { Contato } from '../../types';
import { TransacaoExtrato } from './tipos';
import { normalizarDescricao } from './tipos';

// ============================================================
// TIPOS PÚBLICOS
// ============================================================

/**
 * Natureza da transação — identifica o tipo de operação bancária.
 * Baseada nas regras do banco e usada para sugerir categoria.
 */
export type NaturezaTransacao =
  | 'movimentacao_interna'  // Contamax / aplicações internas — não é receita nem despesa
  | 'emprestimo'            // Débito de empréstimo / financiamento
  | 'tarifa_bancaria'       // IOF, tarifas, manutenção
  | 'imposto'               // DARF, INSS, FGTS, Simples, etc.
  | 'conta_consumo'         // Luz, água, celular, internet, seguro
  | 'cartao_debito'         // Compra no cartão de débito
  | 'recebimento'           // PIX recebido, depósito, TED entrada
  | 'pagamento'             // PIX enviado, boleto pago, TED saída
  | 'capitalizacao'         // Título de capitalização
  | 'acordo_divida'         // Acordo / dívida em atraso
  | 'indefinido';           // Sem regra correspondente

/**
 * Sugestão de tipo de lançamento gerada pela classificação.
 * 'transferencia' é exclusivo para movimentações internas (Contamax).
 */
export type TipoLancamentoSugerido = 'receita' | 'despesa' | 'transferencia';

/**
 * Definição de uma regra de classificação por banco.
 * Cada banco mantém seu próprio arquivo em src/utils/extrato/regras/<banco>.ts.
 */
export interface RegraClassificacaoBanco {
  natureza: NaturezaTransacao;
  tipoLancamentoSugerido: TipoLancamentoSugerido;
  categoriaSugeridaNome?: string;
  /** Função pura que testa a descricaoNormalizada (já em maiúscula/sem acento) */
  testar: (descricaoNormalizada: string) => boolean;
}

/**
 * Regra de importação cadastrada pelo usuário — salva no Firestore.
 * Permite aprendizado personalizado por empresa.
 */
export interface RegraImportacao {
  id: string;
  /** Código do banco ('033') ou '*' para qualquer banco */
  banco_codigo: string;
  /** ID da conta ou '*' para qualquer conta */
  conta_id: string;
  /** Campo da transação a casar */
  campo: 'descricao' | 'contraparte';
  /** Operador de comparação */
  operador: 'contem' | 'igual' | 'comeca_com';
  /** Valor a casar (sempre comparado após normalização) */
  valor: string;
  /** Categoria a sugerir */
  categoria_id: string;
  /** Projeto a vincular (opcional) */
  projeto_id?: string;
  /** Contato a vincular (opcional) */
  contato_id?: string;
  /** Tipo de lançamento a sugerir */
  tipoLancamento?: TipoLancamentoSugerido;
  /** Se false, a regra está desabilitada */
  ativa: boolean;
  criadoEm: string;
  /** Quantidade de vezes que esta regra gerou uma sugestão aceita */
  usos: number;
}

/**
 * Sugestão completa para uma transação, pronta para exibir ao usuário.
 */
export interface SugestaoClassificacao {
  natureza: NaturezaTransacao;
  tipoLancamentoSugerido?: TipoLancamentoSugerido;
  /** Nome da categoria sugerida (pode não existir na lista do usuário) */
  categoriaSugeridaNome?: string;
  /** ID da categoria sugerida (preenchido quando veio de regra_usuario) */
  categoriaSugeridaId?: string;
  /** ID do projeto sugerido */
  projetoSugeridoId?: string;
  /** Contato encontrado no cadastro */
  contatoId?: string;
  /** Nome do contato na transação (para sugerir criação se não existir no cadastro) */
  nomeContatoSugerido?: string;
  /** ID da regra do usuário aplicada */
  regraUsuarioId?: string;
}

/** Origem da sugestão — define a prioridade aplicada */
export type OrigemSugestao = 'regra_usuario' | 'regra_banco' | 'nenhuma';

/**
 * Resultado completo da classificação de uma transação.
 */
export interface ResultadoClassificacao {
  natureza: NaturezaTransacao;
  sugestao: SugestaoClassificacao;
  origemSugestao: OrigemSugestao;
}

// ============================================================
// MAPA DE REGRAS POR BANCO
// Cada banco registrado em bancos.ts importa e expõe suas regras aqui.
// ============================================================
import { REGRAS_SANTANDER } from './regras/santander';

const REGRAS_POR_BANCO: Record<string, RegraClassificacaoBanco[]> = {
  '033': REGRAS_SANTANDER,
};

// ============================================================
// NORMALIZAÇÃO DE NOMES PARA CASAMENTO DE CONTATOS
// ============================================================

/**
 * Normaliza um nome para comparação difusa (sem acento, maiúsculo, sem pontuação, espaços colapsados).
 */
export function normalizarNome(nome: string): string {
  if (!nome) return '';
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// CASAMENTO DE CONTRAPARTE COM CONTATOS CADASTRADOS
// ============================================================

/**
 * Tenta casar a contraparte da transação com um contato existente no cadastro.
 * O casamento é por nome normalizado (sem acento, maiúsculo).
 * Retorna o ID do contato se encontrado, ou undefined.
 */
function buscarContatoPorNome(
  nomeContraparte: string,
  contatos: Contato[]
): Contato | undefined {
  if (!nomeContraparte) return undefined;
  const nomeNorm = normalizarNome(nomeContraparte);
  return contatos.find((c) => normalizarNome(c.nome) === nomeNorm);
}

// ============================================================
// CASAMENTO DE REGRAS DO USUÁRIO
// ============================================================

function testarRegraUsuario(
  transacao: TransacaoExtrato,
  regra: RegraImportacao,
  bancoCodigo: string,
  contaId: string
): boolean {
  // Filtro de banco e conta
  if (regra.banco_codigo !== '*' && regra.banco_codigo !== bancoCodigo) return false;
  if (regra.conta_id !== '*' && regra.conta_id !== contaId) return false;
  if (!regra.ativa) return false;

  // Campo a comparar
  const campoTexto = regra.campo === 'contraparte'
    ? (transacao.contraparte ?? '')
    : transacao.descricaoNormalizada;

  const textoNorm = normalizarDescricao(campoTexto);
  const valorNorm = normalizarDescricao(regra.valor);

  switch (regra.operador) {
    case 'igual':
      return textoNorm === valorNorm;
    case 'comeca_com':
      return textoNorm.startsWith(valorNorm);
    case 'contem':
    default:
      return textoNorm.includes(valorNorm);
  }
}

// ============================================================
// FUNÇÃO PRINCIPAL: classificarTransacao
// ============================================================

/**
 * Classifica uma transação de extrato combinando regras do usuário e regras do banco.
 *
 * Prioridade:
 * 1. Regra do usuário (regra_usuario) — mais específica
 * 2. Regra do banco (regra_banco) — sugestão genérica
 * 3. Nenhuma (indefinido)
 *
 * Com contraparte (OFX): tenta casar contato existente por nome normalizado.
 * Sem contraparte (XLSX): casamento apenas por descricao.
 *
 * @param transacao Transação do extrato (OFX ou XLSX)
 * @param bancoCodigo Código Febraban do banco (ex: '033' Santander)
 * @param contaId ID da conta no sistema (para filtrar regras do usuário)
 * @param regrasUsuario Regras cadastradas pelo usuário no Firestore
 * @param contatos Lista de contatos cadastrados (para casamento de contraparte)
 */
export function classificarTransacao(
  transacao: TransacaoExtrato,
  bancoCodigo: string,
  contaId: string,
  regrasUsuario: RegraImportacao[],
  contatos: Contato[]
): ResultadoClassificacao {

  // ------------------------------------------------------------------
  // 1. Regras do usuário (prioridade máxima)
  // ------------------------------------------------------------------
  const regraUsuario = regrasUsuario.find((r) =>
    testarRegraUsuario(transacao, r, bancoCodigo, contaId)
  );

  if (regraUsuario) {
    // Casamento de contato (se houver contraparte e contato_id na regra)
    const contatoId = regraUsuario.contato_id
      ?? (transacao.contraparte ? buscarContatoPorNome(transacao.contraparte, contatos)?.id : undefined);

    const nomeContatoSugerido =
      !contatoId && transacao.contraparte ? transacao.contraparte : undefined;

    return {
      natureza: 'indefinido', // regras do usuário não precisam mapear natureza
      sugestao: {
        natureza: 'indefinido',
        tipoLancamentoSugerido: regraUsuario.tipoLancamento,
        categoriaSugeridaId: regraUsuario.categoria_id,
        projetoSugeridoId: regraUsuario.projeto_id,
        contatoId,
        nomeContatoSugerido,
        regraUsuarioId: regraUsuario.id,
      },
      origemSugestao: 'regra_usuario',
    };
  }

  // ------------------------------------------------------------------
  // 2. Regras do banco
  // ------------------------------------------------------------------
  const regrasDoB = REGRAS_POR_BANCO[bancoCodigo] ?? [];
  const regraBanco = regrasDoB.find((r) => r.testar(transacao.descricaoNormalizada));

  // Casamento de contato por nome normalizado (OFX tem contraparte; XLSX não)
  const contatoCadastrado = transacao.contraparte
    ? buscarContatoPorNome(transacao.contraparte, contatos)
    : undefined;

  const nomeContatoSugerido =
    !contatoCadastrado && transacao.contraparte ? transacao.contraparte : undefined;

  if (regraBanco) {
    const natureza = regraBanco.natureza;
    return {
      natureza,
      sugestao: {
        natureza,
        tipoLancamentoSugerido: regraBanco.tipoLancamentoSugerido,
        categoriaSugeridaNome: regraBanco.categoriaSugeridaNome,
        contatoId: contatoCadastrado?.id,
        nomeContatoSugerido,
      },
      origemSugestao: 'regra_banco',
    };
  }

  // ------------------------------------------------------------------
  // 3. Nenhuma regra casou — indefinido
  // ------------------------------------------------------------------
  return {
    natureza: 'indefinido',
    sugestao: {
      natureza: 'indefinido',
      contatoId: contatoCadastrado?.id,
      nomeContatoSugerido,
    },
    origemSugestao: 'nenhuma',
  };
}

// ============================================================
// TRATAMENTO DE MOVIMENTAÇÃO INTERNA (Contamax)
// ============================================================

/**
 * Resultado do processamento de uma movimentação interna (ex: Contamax).
 */
export type ResultadoMovimentacaoInterna =
  | { acao: 'ignorar'; motivo: string }
  | { acao: 'transferencia'; contaDestinoId: string };

/**
 * Determina como tratar uma movimentação interna (Contamax / aplicação automática).
 *
 * Padrão: ignorar e registrar no lote como "ignorada: movimentação interna".
 * Opcional: se contaAplicacaoId for fornecido, registrar como transferência entre contas.
 *
 * @param contaAplicacaoId ID da conta de aplicação cadastrada (ex: "conta-contamax")
 */
export function resolverMovimentacaoInterna(
  contaAplicacaoId?: string
): ResultadoMovimentacaoInterna {
  if (contaAplicacaoId) {
    return {
      acao: 'transferencia',
      contaDestinoId: contaAplicacaoId,
    };
  }
  return {
    acao: 'ignorar',
    motivo: 'Movimentação interna (Contamax/aplicação automática) — não lançada como receita/despesa',
  };
}
