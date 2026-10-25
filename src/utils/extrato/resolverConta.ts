// MT Solar - Gestão Financeira
// Resolução e Associação Segura de Conta Bancária para Extratos (Parte 15B)

import { ContaBancaria } from '../../types';
import { ExtratoLido } from './tipos';

export interface SugestaoCadastroConta {
  banco_codigo?: string;
  banco_nome?: string;
  agencia?: string;
  numero_conta?: string;
  titular?: string;
}

export type CriterioResolucaoConta =
  | 'banco_codigo_e_conta'
  | 'nome_banco_e_conta'
  | 'banco_apenas'
  | 'conta_apenas';

export type ResultadoResolucaoConta =
  | {
      tipo: 'unica';
      conta: ContaBancaria;
      criterio: CriterioResolucaoConta;
    }
  | {
      tipo: 'ambigua';
      candidatas: ContaBancaria[];
      motivo: string;
    }
  | {
      tipo: 'nenhuma';
      sugestao: SugestaoCadastroConta;
    };

/**
 * Remove qualquer caractere não numérico
 */
export function apenasDigitos(valor?: string | null): string {
  return valor ? valor.replace(/\D/g, '') : '';
}

/**
 * Normaliza strings para comparação (minúsculas, sem acento, sem espaços extras)
 */
export function normalizarTexto(texto?: string | null): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Verifica se os dados de número de conta conferem entre o extrato e a conta cadastrada.
 * Trata o caso do Santander e outros bancos onde o ACCTID traz a agência colada na conta
 * (Ex: ACCTID 0001999999999 ≡ agência 0001 + conta 99999999-9).
 */
export function verificarNumeroContaBate(extrato: ExtratoLido, conta: ContaBancaria): boolean {
  const contaCadDigitos = apenasDigitos(conta.numero_conta);
  if (!contaCadDigitos) return false;

  const extratoContaDigitos = apenasDigitos(extrato.conta);
  const extratoAcctBrutoDigitos = apenasDigitos(extrato.acctIdBruto);
  const agCadDigitos = apenasDigitos(conta.agencia);

  // 1. Comparação exata dos dígitos da conta
  if (extratoContaDigitos && contaCadDigitos === extratoContaDigitos) {
    return true;
  }

  // 2. Se a conta cadastrada tiver agência e o extrato trouxer acctIdBruto (agência + conta colados)
  if (agCadDigitos && extratoAcctBrutoDigitos) {
    if ((agCadDigitos + contaCadDigitos) === extratoAcctBrutoDigitos) {
      return true;
    }
  }

  // 3. Se acctIdBruto terminar com os dígitos da conta cadastrada (mínimo 4 dígitos para evitar falso positivo)
  if (extratoAcctBrutoDigitos && contaCadDigitos.length >= 4) {
    if (extratoAcctBrutoDigitos.endsWith(contaCadDigitos)) {
      return true;
    }
  }

  // 4. Se a conta do extrato terminar com a conta cadastrada ou vice-versa (ex: com ou sem dígito verificador)
  if (extratoContaDigitos.length >= 4 && contaCadDigitos.length >= 4) {
    if (extratoContaDigitos.endsWith(contaCadDigitos) || contaCadDigitos.endsWith(extratoContaDigitos)) {
      return true;
    }
  }

  return false;
}

/**
 * Verifica se o banco confere pelo código Febraban
 */
export function verificarBancoBatePorCodigo(extrato: ExtratoLido, conta: ContaBancaria): boolean {
  if (!conta.banco_codigo || !extrato.bancoCodigo) return false;
  return apenasDigitos(conta.banco_codigo) === apenasDigitos(extrato.bancoCodigo);
}

/**
 * Verifica se o banco confere pelo nome
 */
export function verificarBancoBatePorNome(extrato: ExtratoLido, conta: ContaBancaria): boolean {
  if (!conta.banco || !extrato.bancoNome) return false;
  const nomeConta = normalizarTexto(conta.banco);
  const nomeExtrato = normalizarTexto(extrato.bancoNome);
  return nomeConta.includes(nomeExtrato) || nomeExtrato.includes(nomeConta);
}

/**
 * Identifica a conta bancária cadastrada correspondente a um extrato lido.
 * 
 * Ordem estrita de critérios:
 * 1. banco_codigo + número da conta (comparar só dígitos);
 * 2. nome do banco + número da conta;
 * 3. banco (código ou nome);
 * 4. só o número da conta.
 */
export function resolverConta(
  extrato: ExtratoLido,
  contas: ContaBancaria[]
): ResultadoResolucaoConta {
  const sugestao: SugestaoCadastroConta = {
    banco_codigo: extrato.bancoCodigo || undefined,
    banco_nome: extrato.bancoNome || undefined,
    agencia: extrato.agencia || undefined,
    numero_conta: extrato.conta || undefined,
    titular: extrato.titular || undefined
  };

  if (!contas || contas.length === 0) {
    return { tipo: 'nenhuma', sugestao };
  }

  // 1. Critério 1: banco_codigo + número da conta (comparar só dígitos)
  const candidatasCriterio1 = contas.filter(
    c => verificarBancoBatePorCodigo(extrato, c) && verificarNumeroContaBate(extrato, c)
  );

  if (candidatasCriterio1.length === 1) {
    return { tipo: 'unica', conta: candidatasCriterio1[0], criterio: 'banco_codigo_e_conta' };
  }
  if (candidatasCriterio1.length > 1) {
    return {
      tipo: 'ambigua',
      candidatas: candidatasCriterio1,
      motivo: 'Existem múltiplas contas cadastradas com este mesmo código de banco e número de conta.'
    };
  }

  // 2. Critério 2: nome do banco + número da conta (para contas antigas sem banco_codigo gravado)
  const candidatasCriterio2 = contas.filter(
    c => (verificarBancoBatePorCodigo(extrato, c) || verificarBancoBatePorNome(extrato, c)) &&
         verificarNumeroContaBate(extrato, c)
  );

  if (candidatasCriterio2.length === 1) {
    return { tipo: 'unica', conta: candidatasCriterio2[0], criterio: 'nome_banco_e_conta' };
  }
  if (candidatasCriterio2.length > 1) {
    return {
      tipo: 'ambigua',
      candidatas: candidatasCriterio2,
      motivo: 'Existem múltiplas contas cadastradas com este nome de banco e número de conta.'
    };
  }

  // 3. Critério 3: banco (código ou nome)
  const candidatasCriterio3 = contas.filter(
    c => verificarBancoBatePorCodigo(extrato, c) || verificarBancoBatePorNome(extrato, c)
  );

  if (candidatasCriterio3.length === 1) {
    return { tipo: 'unica', conta: candidatasCriterio3[0], criterio: 'banco_apenas' };
  }
  if (candidatasCriterio3.length > 1) {
    return {
      tipo: 'ambigua',
      candidatas: candidatasCriterio3,
      motivo: 'Existem múltiplas contas cadastradas neste banco. Selecione qual delas corresponde a este extrato.'
    };
  }

  // 4. Critério 4: só o número da conta
  const candidatasCriterio4 = contas.filter(c => verificarNumeroContaBate(extrato, c));

  if (candidatasCriterio4.length === 1) {
    return { tipo: 'unica', conta: candidatasCriterio4[0], criterio: 'conta_apenas' };
  }
  if (candidatasCriterio4.length > 1) {
    return {
      tipo: 'ambigua',
      candidatas: candidatasCriterio4,
      motivo: 'Múltiplas contas cadastradas possuem este número de conta.'
    };
  }

  // 5. Nenhuma conta encontrada
  return { tipo: 'nenhuma', sugestao };
}
