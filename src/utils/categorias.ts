// MT Solar - Gestão Financeira
// Utilitários puros para Deduplicação e Mesclagem de Categorias (Parte 24A)

import { Categoria, TipoLancamento, GrupoMesclagemCategoria } from '../types';
import { normalizarNome } from './extrato/classificarTransacao';

/**
 * Gera a chave única normalizada para uma categoria.
 * Formato: NOME_NORMALIZADO|TIPO
 * Exemplo: "SALARIOS|despesa"
 *
 * Mesmos nomes com tipos diferentes (receita x despesa) NÃO colidem.
 */
export function chaveCategoria(c: { nome: string; tipo: TipoLancamento | string }): string {
  const nomeNorm = normalizarNome(c.nome || '');
  const tipoNorm = (c.tipo || '').trim().toLowerCase();
  return `${nomeNorm}|${tipoNorm}`;
}

/**
 * Agrupa uma lista de categorias pela chave normalizada (nome + tipo).
 * Retorna um Map onde a chave é `chaveCategoria` e o valor é a lista de categorias correspondentes.
 */
export function agruparDuplicadas(categorias: Categoria[]): Map<string, Categoria[]> {
  const mapa = new Map<string, Categoria[]>();

  for (const cat of categorias) {
    const chave = chaveCategoria(cat);
    const lista = mapa.get(chave);
    if (lista) {
      lista.push(cat);
    } else {
      mapa.set(chave, [cat]);
    }
  }

  return mapa;
}

/**
 * Extrai um timestamp aproximado ou data em milissegundos para ordenação por antiguidade.
 * Ordem de prioridade para apurar data de criação:
 * 1. Categorias com `padrao: true` são as mais antigas da base (timestamp 0).
 * 2. `criado_em` válido no formato ISO.
 * 3. Timestamp embutido no id (ex: `cat-1729000000000`).
 * 4. Fallback para Infinity se nada puder ser inferido.
 */
export function obterTimestampCriacao(cat: Categoria): number {
  if (cat.padrao) {
    return 0;
  }
  if (cat.criado_em) {
    const t = new Date(cat.criado_em).getTime();
    if (!isNaN(t)) return t;
  }
  if (cat.id && cat.id.startsWith('cat-')) {
    const resto = cat.id.replace('cat-', '');
    const num = Number(resto);
    if (!isNaN(num) && num > 1000000000) {
      return num;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Tipo flexível para contagem de referências vinculadas a uma categoria (lançamentos, recorrências, regras etc.)
 */
export type MapaReferencias = Map<string, number> | Record<string, number>;

function obterContagem(ref: MapaReferencias | undefined, id: string): number {
  if (!ref) return 0;
  if (ref instanceof Map) {
    return ref.get(id) || 0;
  }
  return (ref as Record<string, number>)[id] || 0;
}

/**
 * Escolhe a categoria canônica de um grupo de categorias com a mesma chave.
 * Critérios rigorosos de desempate:
 * 1. Mais lançamentos/referências vinculadas (maior contagem de referências).
 * 2. Mais antiga (menor timestamp de criação / padrao: true).
 * 3. Menor id (ordem lexicográfica determinística).
 */
export function escolherCanonica(
  grupo: Categoria[],
  referencias?: MapaReferencias
): Categoria {
  if (!grupo || grupo.length === 0) {
    throw new Error('escolherCanonica requer um grupo com pelo menos uma categoria.');
  }
  if (grupo.length === 1) {
    return grupo[0];
  }

  const ordenadas = [...grupo].sort((a, b) => {
    // 1. Mais referências vinculadas
    const refA = obterContagem(referencias, a.id);
    const refB = obterContagem(referencias, b.id);
    if (refA !== refB) {
      return refB - refA; // Maior quantidade primeiro
    }

    // 2. Mais antiga
    const tempoA = obterTimestampCriacao(a);
    const tempoB = obterTimestampCriacao(b);
    if (tempoA !== tempoB) {
      return tempoA - tempoB; // Mais antigo (menor timestamp) primeiro
    }

    // 3. Menor ID lexicograficamente
    return a.id.localeCompare(b.id);
  });

  return ordenadas[0];
}

export interface PlanoMesclagem {
  /** Mapa de ID duplicado -> ID canônico */
  mapaDePara: Record<string, string>;
  /** Detalhes de cada grupo com duplicatas */
  grupos: GrupoMesclagemCategoria[];
  /** Total de grupos que contêm duplicatas */
  totalGrupos: number;
  /** Total de categorias duplicadas que serão mescladas e removidas */
  totalDuplicadas: number;
  /** Total de referências em lançamentos/regras/recorrências que serão reapontadas */
  totalReferenciasAfetadas: number;
}

/**
 * Planeja a mesclagem de todas as categorias duplicadas na lista.
 * Retorna o mapa idDuplicada -> idCanonica e os metadados dos grupos afetados.
 *
 * Mesmos nomes com tipos diferentes (receita x despesa) NÃO são duplicatas.
 */
export function planejarMesclagem(
  categorias: Categoria[],
  referencias?: MapaReferencias
): PlanoMesclagem {
  const mapaGrupos = agruparDuplicadas(categorias);
  const mapaDePara: Record<string, string> = {};
  const grupos: GrupoMesclagemCategoria[] = [];
  let totalDuplicadas = 0;
  let totalReferenciasAfetadas = 0;

  for (const [chave, lista] of mapaGrupos.entries()) {
    if (lista.length <= 1) {
      continue; // Categoria única, sem duplicatas
    }

    const canonica = escolherCanonica(lista, referencias);
    const duplicadas = lista.filter((c) => c.id !== canonica.id);

    let totalRefsGrupo = 0;
    for (const dup of duplicadas) {
      mapaDePara[dup.id] = canonica.id;
      const qtdRef = obterContagem(referencias, dup.id);
      totalRefsGrupo += qtdRef;
      totalReferenciasAfetadas += qtdRef;
      totalDuplicadas++;
    }

    grupos.push({
      chave,
      nomeNormalizado: normalizarNome(canonica.nome),
      tipo: canonica.tipo,
      canonica,
      duplicadas,
      totalReferencias: totalRefsGrupo,
    });
  }

  return {
    mapaDePara,
    grupos,
    totalGrupos: grupos.length,
    totalDuplicadas,
    totalReferenciasAfetadas,
  };
}

/**
 * Retorna uma lista de categorias deduplicadas (apenas as canônicas).
 * Preserva apenas uma categoria para cada chave (nome normalizado + tipo).
 */
export function deduplicarCategorias(
  categorias: Categoria[],
  referencias?: MapaReferencias
): Categoria[] {
  const mapaGrupos = agruparDuplicadas(categorias);
  const resultado: Categoria[] = [];

  for (const [, lista] of mapaGrupos.entries()) {
    if (lista.length === 1) {
      resultado.push(lista[0]);
    } else {
      resultado.push(escolherCanonica(lista, referencias));
    }
  }

  // Ordena alfabeticamente pelo nome para apresentação consistente
  return resultado.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

