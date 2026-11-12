// MT Solar - Gestão Financeira
// Testes da Parte 24A: Deduplicação e Mesclagem de Categorias (Testes Unitários e Integrados com Simulador)

import {
  Categoria,
  Lancamento,
  RecorrenciaLancamento,
  RegraImportacao,
  RegistroAuditoria,
  UsuarioAutorizado,
  DryRunMesclarCategorias,
  ParamsMesclarCategorias,
  ResultadoMesclarCategorias,
} from '../src/types';
import {
  chaveCategoria,
  agruparDuplicadas,
  escolherCanonica,
  planejarMesclagem,
  deduplicarCategorias,
} from '../src/utils/categorias';

let totalAssercoes = 0;
let totalFalhas = 0;
const detalheFalhas: string[] = [];

function asserir(condicao: boolean, mensagem: string) {
  totalAssercoes++;
  if (!condicao) {
    totalFalhas++;
    detalheFalhas.push(`  ❌ FALHA: ${mensagem}`);
    console.error(`  ❌ FALHA: ${mensagem}`);
  } else {
    console.log(`  ✅ OK: ${mensagem}`);
  }
}

console.log('================================================================');
console.log(' INICIANDO SUÍTE COMPLETA DE TESTES DA PARTE 24A');
console.log('================================================================\n');

// -----------------------------------------------------------------
// BLOCO 1: NORMALIZAÇÃO DE NOMES E GERAÇÃO DE CHAVE
// -----------------------------------------------------------------
console.log('--- BLOCO 1: Normalização e Chave de Categorias (Acento, Caixa e Espaços) ---');

const ch1 = chaveCategoria({ nome: 'Salários', tipo: 'despesa' });
const ch2 = chaveCategoria({ nome: 'salarios', tipo: 'despesa' });
const ch3 = chaveCategoria({ nome: '  SALÁRIOS   ', tipo: 'despesa' });
const ch4 = chaveCategoria({ nome: 'Salários', tipo: 'receita' });

asserir(ch1 === 'SALARIOS|despesa', `ch1 deve ser SALARIOS|despesa (obtido: ${ch1})`);
asserir(ch1 === ch2, 'Salários e salarios geram exatamente a mesma chave');
asserir(ch1 === ch3, 'Espaços extras são ignorados e colapsados na chave');
asserir(ch1 !== ch4, 'Mesmo nome com tipos diferentes gera chaves distintas');

const chPont = chaveCategoria({ nome: 'Combustível / Frota', tipo: 'despesa' });
const chSemPont = chaveCategoria({ nome: 'COMBUSTIVEL FROTA', tipo: 'despesa' });
asserir(chPont === chSemPont, 'Pontuações como barra são normalizadas para espaço único');

const chEspecial = chaveCategoria({ nome: 'Manutenção & Limpeza', tipo: 'receita' });
const chEspecial2 = chaveCategoria({ nome: 'MANUTENCAO LIMPEZA', tipo: 'receita' });
asserir(chEspecial === chEspecial2, 'Caracteres especiais (&) são normalizados sem acento');

// -----------------------------------------------------------------
// BLOCO 2: AGRUPAMENTO E ISOLAMENTO POR TIPO
// -----------------------------------------------------------------
console.log('\n--- BLOCO 2: Agrupamento de Duplicadas e Tipos Diferentes ---');

const categoriasBase: Categoria[] = [
  { id: 'cat-des-4', nome: 'Salários', tipo: 'despesa', cor: '#B91C1C', padrao: true, criado_em: '2026-01-01T00:00:00Z' },
  { id: 'cat-dup-1', nome: 'salarios', tipo: 'despesa', cor: '#B91C1C', criado_em: '2026-02-01T00:00:00Z' },
  { id: 'cat-dup-2', nome: '  SALÁRIOS  ', tipo: 'despesa', cor: '#B91C1C', criado_em: '2026-03-01T00:00:00Z' },
  { id: 'cat-rec-1', nome: 'Venda de sistemas fotovoltaicos', tipo: 'receita', cor: '#16A34A', padrao: true },
  { id: 'cat-rec-dup', nome: 'venda de sistemas fotovoltaicos', tipo: 'receita', cor: '#16A34A', criado_em: '2026-04-01T00:00:00Z' },
  { id: 'cat-rec-sal', nome: 'Salários', tipo: 'receita', cor: '#16A34A' }, // Mesmo nome "Salários", mas tipo receita
];

const grupos = agruparDuplicadas(categoriasBase);
asserir(grupos.get('SALARIOS|despesa')?.length === 3, 'Grupo SALARIOS|despesa possui 3 ocorrências');
asserir(grupos.get('VENDA DE SISTEMAS FOTOVOLTAICOS|receita')?.length === 2, 'Grupo VENDA DE SISTEMAS possui 2 ocorrências');
asserir(grupos.get('SALARIOS|receita')?.length === 1, 'Grupo SALARIOS|receita possui 1 ocorrência isolada (não mistura com despesa)');

// -----------------------------------------------------------------
// BLOCO 3: ESCOLHA DA CANÔNICA (3 CRITÉRIOS DE DESEMPATE)
// -----------------------------------------------------------------
console.log('\n--- BLOCO 3: Escolha Rigorosa da Categoria Canônica ---');

// Critério 1: Mais lançamentos vinculados
const grupoRefs: Categoria[] = [
  { id: 'cat-poucas-refs', nome: 'Aluguel', tipo: 'despesa', cor: '#7C3AED', criado_em: '2025-10-01T00:00:00Z' },
  { id: 'cat-muitas-refs', nome: 'aluguel', tipo: 'despesa', cor: '#7C3AED', criado_em: '2026-02-01T00:00:00Z' },
  { id: 'cat-zero-refs', nome: 'ALUGUEL', tipo: 'despesa', cor: '#7C3AED', criado_em: '2025-01-01T00:00:00Z' },
];
const contagemRefs = {
  'cat-poucas-refs': 5,
  'cat-muitas-refs': 42, // maior quantidade de lançamentos
  'cat-zero-refs': 0,
};
const canRef = escolherCanonica(grupoRefs, contagemRefs);
asserir(canRef.id === 'cat-muitas-refs', `Critério 1: cat-muitas-refs (42 refs) foi escolhida como canônica (obtido: ${canRef.id})`);

// Critério 2: Mais antiga (quando empatar em referências)
const grupoData: Categoria[] = [
  { id: 'cat-data-recente', nome: 'Marketing', tipo: 'despesa', cor: '#E11D48', criado_em: '2026-05-10T00:00:00Z' },
  { id: 'cat-data-antiga', nome: 'marketing', tipo: 'despesa', cor: '#E11D48', criado_em: '2026-01-05T00:00:00Z' },
  { id: 'cat-data-media', nome: 'MARKETING', tipo: 'despesa', cor: '#E11D48', criado_em: '2026-03-20T00:00:00Z' },
];
const empateRefs = { 'cat-data-recente': 10, 'cat-data-antiga': 10, 'cat-data-media': 10 };
const canData = escolherCanonica(grupoData, empateRefs);
asserir(canData.id === 'cat-data-antiga', `Critério 2: cat-data-antiga mais antiga venceu o empate (obtido: ${canData.id})`);

// Prioridade histórica de categorias com padrao: true
const grupoPadrao: Categoria[] = [
  { id: 'cat-custom', nome: 'Salários', tipo: 'despesa', cor: '#B91C1C', criado_em: '2026-01-02T00:00:00Z' },
  { id: 'cat-des-4', nome: 'salários', tipo: 'despesa', cor: '#B91C1C', padrao: true },
];
const canPadrao = escolherCanonica(grupoPadrao, { 'cat-custom': 0, 'cat-des-4': 0 });
asserir(canPadrao.id === 'cat-des-4', `Categoria padrão original tem prioridade de antiguidade histórica (obtido: ${canPadrao.id})`);

// Critério 3: Menor ID lexicográfico
const grupoId: Categoria[] = [
  { id: 'cat-zebra', nome: 'Contador', tipo: 'despesa', cor: '#475569', criado_em: '2026-01-01T00:00:00Z' },
  { id: 'cat-alfa', nome: 'contador', tipo: 'despesa', cor: '#475569', criado_em: '2026-01-01T00:00:00Z' },
  { id: 'cat-beta', nome: 'CONTADOR', tipo: 'despesa', cor: '#475569', criado_em: '2026-01-01T00:00:00Z' },
];
const canId = escolherCanonica(grupoId, {});
asserir(canId.id === 'cat-alfa', `Critério 3: menor ID alfanumérico venceu (obtido: ${canId.id})`);

// -----------------------------------------------------------------
// BLOCO 4: PLANEJAR MESCLAGEM E MAPA DE-PARA
// -----------------------------------------------------------------
console.log('\n--- BLOCO 4: Planejar Mesclagem e Mapa De-Para ---');

const plano = planejarMesclagem(categoriasBase, {
  'cat-des-4': 20,
  'cat-dup-1': 8,
  'cat-dup-2': 3,
  'cat-rec-1': 50,
  'cat-rec-dup': 5,
  'cat-rec-sal': 2,
});

asserir(plano.totalGrupos === 2, `Exatamente 2 grupos contêm duplicatas (obtido: ${plano.totalGrupos})`);
asserir(plano.totalDuplicadas === 3, `Total de 3 duplicadas a eliminar (2 em salários despesa + 1 em venda) (obtido: ${plano.totalDuplicadas})`);
asserir(plano.totalReferenciasAfetadas === 16, `Total de 16 vínculos a reapontar (8+3+5) (obtido: ${plano.totalReferenciasAfetadas})`);
asserir(plano.mapaDePara['cat-dup-1'] === 'cat-des-4', 'cat-dup-1 mapeia para cat-des-4');
asserir(plano.mapaDePara['cat-dup-2'] === 'cat-des-4', 'cat-dup-2 mapeia para cat-des-4');
asserir(plano.mapaDePara['cat-rec-dup'] === 'cat-rec-1', 'cat-rec-dup mapeia para cat-rec-1');
asserir(plano.mapaDePara['cat-rec-sal'] === undefined, 'cat-rec-sal (receita) não foi mesclada com despesa');

// -----------------------------------------------------------------
// BLOCO 5: SIMULADOR DE ARMAZENAMENTO E IDEMPOTÊNCIA DO saveCategoria
// -----------------------------------------------------------------
console.log('\n--- BLOCO 5: Simulador de Armazenamento e Idempotência na Origem ---');

class SimuladorCategorias24A {
  public cacheCategorias: Categoria[] = [];
  public cacheLancamentos: Lancamento[] = [];
  public cacheRecorrencias: RecorrenciaLancamento[] = [];
  public cacheRegrasImportacao: RegraImportacao[] = [];
  public cacheAuditoria: RegistroAuditoria[] = [];
  public notificacoes: string[] = [];
  public usuarioAtual: UsuarioAutorizado = {
    id: 'user-admin',
    nome: 'Admin Teste',
    email: 'admin@mtsolar.com.br',
    papel: 'administrador',
    data_adicionado: '2026-01-01',
  };

  public getCategorias(): Categoria[] {
    return this.cacheCategorias;
  }

  public getCategoriasUnicas(tipo?: 'receita' | 'despesa' | 'transferencia' | 'ajuste'): Categoria[] {
    const todas = this.getCategorias();
    const filtradas = tipo ? todas.filter((c) => c.tipo === tipo) : todas;

    const mapaRefs = new Map<string, number>();
    for (const l of this.cacheLancamentos) {
      if (l.categoria_id) {
        mapaRefs.set(l.categoria_id, (mapaRefs.get(l.categoria_id) || 0) + 1);
      }
    }
    for (const r of this.cacheRecorrencias) {
      if (r.categoria_id) {
        mapaRefs.set(r.categoria_id, (mapaRefs.get(r.categoria_id) || 0) + 1);
      }
    }
    for (const reg of this.cacheRegrasImportacao) {
      if (reg.categoria_id) {
        mapaRefs.set(reg.categoria_id, (mapaRefs.get(reg.categoria_id) || 0) + 1);
      }
    }

    return deduplicarCategorias(filtradas, mapaRefs);
  }

  public saveCategoria(categoria: Categoria): Categoria {
    const chaveNova = chaveCategoria(categoria);
    const todas = this.cacheCategorias;
    const existentePorChave = todas.find((c) => chaveCategoria(c) === chaveNova);

    if (existentePorChave) {
      // Se não passou ID ou passou um ID novo/diferente do existente, reaproveita a existente (idempotência)
      if (!categoria.id || categoria.id !== existentePorChave.id) {
        return existentePorChave;
      }

      // Edição da existente
      const docId = existentePorChave.id;
      const item: Categoria = {
        ...existentePorChave,
        ...categoria,
        id: docId,
        criado_em: existentePorChave.criado_em || categoria.criado_em || new Date().toISOString(),
      };
      const idx = this.cacheCategorias.findIndex((c) => c.id === docId);
      if (idx >= 0) this.cacheCategorias[idx] = item;
      else this.cacheCategorias.push(item);
      this.notificacoes.push('categorias');
      return item;
    }

    const docId = categoria.id || `cat-${Date.now()}`;
    const item: Categoria = {
      ...categoria,
      id: docId,
      criado_em: categoria.criado_em || new Date().toISOString(),
    };
    const idx = this.cacheCategorias.findIndex((c) => c.id === docId);
    if (idx >= 0) this.cacheCategorias[idx] = item;
    else this.cacheCategorias.push(item);
    this.notificacoes.push('categorias');
    return item;
  }

  public simularMesclagemCategorias(): DryRunMesclarCategorias {
    const todas = this.getCategorias();
    const mapaRefs = new Map<string, number>();
    for (const l of this.cacheLancamentos) {
      if (l.categoria_id) {
        mapaRefs.set(l.categoria_id, (mapaRefs.get(l.categoria_id) || 0) + 1);
      }
    }
    for (const r of this.cacheRecorrencias) {
      if (r.categoria_id) {
        mapaRefs.set(r.categoria_id, (mapaRefs.get(r.categoria_id) || 0) + 1);
      }
    }
    for (const reg of this.cacheRegrasImportacao) {
      if (reg.categoria_id) {
        mapaRefs.set(reg.categoria_id, (mapaRefs.get(reg.categoria_id) || 0) + 1);
      }
    }

    const plano = planejarMesclagem(todas, mapaRefs);

    return {
      total_grupos_duplicados: plano.totalGrupos,
      total_categorias_duplicadas: plano.totalDuplicadas,
      total_referencias_afetadas: plano.totalReferenciasAfetadas,
      grupos: plano.grupos,
      tem_duplicadas_para_mesclar: plano.totalDuplicadas > 0,
    };
  }

  public async mesclarCategoriasDuplicadas(
    params: ParamsMesclarCategorias
  ): Promise<ResultadoMesclarCategorias> {
    if (this.usuarioAtual.papel !== 'administrador') {
      throw new Error('Apenas administradores podem executar a mesclagem de categorias.');
    }
    if (params.textoConfirmacao.trim().toUpperCase() !== 'MESCLAR') {
      throw new Error('Texto de confirmação inválido. Digite "MESCLAR" para confirmar a operação.');
    }

    const dryRun = this.simularMesclagemCategorias();
    if (!dryRun.tem_duplicadas_para_mesclar) {
      return {
        sucesso: true,
        total_categorias_mescladas: 0,
        total_lancamentos_reapontados: 0,
        total_recorrencias_reapontadas: 0,
        total_regras_reapontadas: 0,
        total_folhas_reapontadas: 0,
        total_rascunhos_reapontados: 0,
        mensagem: 'Nenhuma categoria duplicada encontrada.',
      };
    }

    const mapaDePara: Record<string, string> = {};
    for (const g of dryRun.grupos) {
      for (const d of g.duplicadas) {
        mapaDePara[d.id] = g.canonica.id;
      }
    }

    let totalLancamentos = 0;
    let totalRecorrencias = 0;
    let totalRegras = 0;

    // Reapontamento com upsert no cache
    this.cacheLancamentos = this.cacheLancamentos.map((l) => {
      if (l.categoria_id && mapaDePara[l.categoria_id]) {
        totalLancamentos++;
        return { ...l, categoria_id: mapaDePara[l.categoria_id] };
      }
      return l;
    });

    this.cacheRecorrencias = this.cacheRecorrencias.map((r) => {
      if (r.categoria_id && mapaDePara[r.categoria_id]) {
        totalRecorrencias++;
        return { ...r, categoria_id: mapaDePara[r.categoria_id] };
      }
      return r;
    });

    this.cacheRegrasImportacao = this.cacheRegrasImportacao.map((reg) => {
      if (reg.categoria_id && mapaDePara[reg.categoria_id]) {
        totalRegras++;
        return { ...reg, categoria_id: mapaDePara[reg.categoria_id] };
      }
      return reg;
    });

    const idsExcluir = new Set(Object.keys(mapaDePara));
    this.cacheCategorias = this.cacheCategorias.filter((c) => !idsExcluir.has(c.id));

    this.cacheAuditoria.push({
      id: 'audit-' + Date.now(),
      usuario_email: this.usuarioAtual.email,
      usuario_nome: this.usuarioAtual.nome,
      data_hora: new Date().toISOString(),
      modulo: 'categorias',
      acao: 'edicao',
      descricao: `Mesclagem de categorias duplicadas (${idsExcluir.size} mescladas)`,
      detalhes: `Reapontados ${totalLancamentos} lançamentos e ${totalRegras} regras.`,
    });

    this.notificacoes.push('categorias', 'lancamentos', 'recorrencias', 'regras_importacao');

    return {
      sucesso: true,
      total_categorias_mescladas: idsExcluir.size,
      total_lancamentos_reapontados: totalLancamentos,
      total_recorrencias_reapontadas: totalRecorrencias,
      total_regras_reapontadas: totalRegras,
      total_folhas_reapontadas: 0,
      total_rascunhos_reapontados: 0,
      backup_json: '{}',
      mensagem: `Mesclagem concluída: ${idsExcluir.size} categorias mescladas.`,
    };
  }
}

const sim = new SimuladorCategorias24A();

// Cadastrar categoria inicial
const cat1 = sim.saveCategoria({
  id: 'cat-salarios-original',
  nome: 'Salários',
  tipo: 'despesa',
  cor: '#B91C1C',
});
asserir(cat1.id === 'cat-salarios-original', 'Primeira categoria cadastrada com sucesso');

// Tentar cadastrar duplicata sem ID (ex: combobox ou criação rápida)
const cat2 = sim.saveCategoria({
  id: '',
  nome: 'salarios', // minúsculo, sem acento
  tipo: 'despesa',
  cor: '#B91C1C',
});
asserir(cat2.id === 'cat-salarios-original', 'Tentativa de criar duplicata retornou a categoria original existente');
asserir(sim.cacheCategorias.length === 1, 'Cache permanece com apenas 1 categoria');

// Cadastrar com mesmo nome mas tipo receita (deve permitir)
const catReceita = sim.saveCategoria({
  id: 'cat-salarios-rec',
  nome: 'Salários',
  tipo: 'receita',
  cor: '#16A34A',
});
asserir(catReceita.id === 'cat-salarios-rec', 'Categoria de receita com mesmo nome criada com sucesso');
asserir(sim.cacheCategorias.length === 2, 'Cache possui 2 categorias (uma despesa e uma receita)');

// -----------------------------------------------------------------
// BLOCO 6: SELETOR DE CATEGORIAS ÚNICAS (UI SALVAGUARDA)
// -----------------------------------------------------------------
console.log('\n--- BLOCO 6: Salvaguarda de UI com getCategoriasUnicas ---');

// Forçar inserção de duplicatas legadas no cache
sim.cacheCategorias.push(
  { id: 'cat-legada-1', nome: 'Combustível / Frota', tipo: 'despesa', cor: '#C026D3' },
  { id: 'cat-legada-2', nome: 'COMBUSTIVEL FROTA', tipo: 'despesa', cor: '#C026D3' },
  { id: 'cat-legada-3', nome: 'combustivel frota', tipo: 'despesa', cor: '#C026D3' }
);
asserir(sim.cacheCategorias.length === 5, 'Cache agora tem 5 categorias (com duplicatas legadas inseridas)');

// O seletor único getCategoriasUnicas deve filtrar as duplicatas na UI
const unicasUI = sim.getCategoriasUnicas('despesa');
const chavesUnicasUI = unicasUI.map((c) => chaveCategoria(c));
const setUnicas = new Set(chavesUnicasUI);
asserir(setUnicas.size === unicasUI.length, 'Não há nenhuma categoria repetida na listagem da UI');
asserir(unicasUI.length === 2, `Exatamente 2 categorias de despesa retornadas (Salários e Combustível Frota) (obtido: ${unicasUI.length})`);

// -----------------------------------------------------------------
// BLOCO 7: SIMULAÇÃO E EXECUÇÃO DE MESCLAGEM COMPLETA
// -----------------------------------------------------------------
console.log('\n--- BLOCO 7: Execução da Mesclagem com Reaponte, Batches e Auditoria ---');

// Inserir lançamentos: cat-legada-1 tem mais referências (é a canônica com 3 lançamentos),
// enquanto cat-legada-2 (1 lanc + 1 regra) e cat-legada-3 (1 lanc) serão mescladas nela.
sim.cacheLancamentos.push(
  {
    id: 'l-comb-canonico-1',
    tipo: 'despesa',
    descricao: 'Combustível Base 1',
    valor: 200,
    data_vencimento: '2026-10-10',
    data_pagamento: '2026-10-10',
    status: 'pago',
    conta_id: 'conta-1',
    categoria_id: 'cat-legada-1', // canônica
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-10-10',
  },
  {
    id: 'l-comb-canonico-2',
    tipo: 'despesa',
    descricao: 'Combustível Base 2',
    valor: 300,
    data_vencimento: '2026-10-11',
    data_pagamento: '2026-10-11',
    status: 'pago',
    conta_id: 'conta-1',
    categoria_id: 'cat-legada-1', // canônica
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-10-11',
  },
  {
    id: 'l-comb-1',
    tipo: 'despesa',
    descricao: 'Abastecimento Hilux',
    valor: 450,
    data_vencimento: '2026-10-15',
    data_pagamento: '2026-10-15',
    status: 'pago',
    conta_id: 'conta-1',
    categoria_id: 'cat-legada-2', // duplicata
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-10-15',
  },
  {
    id: 'l-comb-2',
    tipo: 'despesa',
    descricao: 'Diesel Caminhão',
    valor: 900,
    data_vencimento: '2026-10-16',
    data_pagamento: '2026-10-16',
    status: 'pago',
    conta_id: 'conta-1',
    categoria_id: 'cat-legada-3', // duplicata
    forma_pagamento: 'PIX',
    recorrencia: 'nenhuma',
    origem: 'manual',
    criado_em: '2026-10-16',
  }
);

sim.cacheRegrasImportacao.push({
  id: 'reg-comb',
  conta_id: 'conta-1',
  banco_codigo: '033',
  campo: 'descricao',
  operador: 'contem',
  valor: 'POSTO IPIRANGA',
  categoria_id: 'cat-legada-2', // duplicata
  ativa: true,
  criadoEm: '2026-01-01',
  usos: 5,
});

// Dry-run antes de executar
const dryRunResultado = sim.simularMesclagemCategorias();
asserir(dryRunResultado.tem_duplicadas_para_mesclar === true, 'Dry-run identificou duplicatas para mesclar');
asserir(dryRunResultado.total_grupos_duplicados === 1, 'Exatamente 1 grupo com duplicatas identificado (COMBUSTIVEL FROTA)');
asserir(dryRunResultado.total_categorias_duplicadas === 2, '2 categorias duplicadas serão eliminadas');
asserir(dryRunResultado.total_referencias_afetadas === 3, '3 vínculos serão reapontados (2 lançamentos + 1 regra)');

// Executar mesclagem (deve falhar sem confirmação "MESCLAR")
let erroConfirmacaoDisparado = false;
try {
  await sim.mesclarCategoriasDuplicadas({ textoConfirmacao: 'CONFIRMAR' });
} catch {
  erroConfirmacaoDisparado = true;
}
asserir(erroConfirmacaoDisparado, 'Guardrail: Bloqueou execução se o usuário não digitar exatamente "MESCLAR"');

// Executar mesclagem com texto correto
const resMesclagem = await sim.mesclarCategoriasDuplicadas({ textoConfirmacao: 'MESCLAR' });
asserir(resMesclagem.sucesso === true, 'Mesclagem executada com sucesso');
asserir(resMesclagem.total_categorias_mescladas === 2, '2 categorias mescladas e removidas');
asserir(resMesclagem.total_lancamentos_reapontados === 2, '2 lançamentos foram reapontados');
asserir(resMesclagem.total_regras_reapontadas === 1, '1 regra foi reapontada');

// Validar que os lançamentos apontam para a canônica
const idCanonicaCombustivel = dryRunResultado.grupos[0].canonica.id;
asserir(idCanonicaCombustivel === 'cat-legada-1', 'cat-legada-1 foi eleita canônica por ter mais vínculos');
asserir(sim.cacheLancamentos[2].categoria_id === idCanonicaCombustivel, 'Lançamento 1 agora aponta para a canônica');
asserir(sim.cacheLancamentos[3].categoria_id === idCanonicaCombustivel, 'Lançamento 2 agora aponta para a canônica');
asserir(sim.cacheRegrasImportacao[0].categoria_id === idCanonicaCombustivel, 'Regra de importação agora aponta para a canônica');

// Validar que as categorias duplicadas foram removidas do cache
const idsRestantes = sim.cacheCategorias.map((c) => c.id);
asserir(!idsRestantes.includes('cat-legada-2'), 'cat-legada-2 foi removida');
asserir(!idsRestantes.includes('cat-legada-3'), 'cat-legada-3 foi removida');
asserir(idsRestantes.includes(idCanonicaCombustivel), 'Categoria canônica preservada intacta');

// Validar auditoria e notificações
asserir(sim.cacheAuditoria.length === 1, 'Registro de auditoria gravado com sucesso');
asserir(sim.cacheAuditoria[0].modulo === 'categorias', 'Módulo da auditoria é "categorias"');
asserir(sim.notificacoes.includes('categorias'), 'Notificação de categorias disparada');
asserir(sim.notificacoes.includes('lancamentos'), 'Notificação de lançamentos disparada');

// -----------------------------------------------------------------
// BLOCO 8: IDEMPOTÊNCIA DA MESCLAGEM (SEGUNDO PASSE = 0 DUPLICATAS)
// -----------------------------------------------------------------
console.log('\n--- BLOCO 8: Idempotência do Processo de Mesclagem ---');

const dryRunSegundoPasse = sim.simularMesclagemCategorias();
asserir(dryRunSegundoPasse.tem_duplicadas_para_mesclar === false, 'Segundo passe: tem_duplicadas_para_mesclar é false');
asserir(dryRunSegundoPasse.total_grupos_duplicados === 0, 'Segundo passe: 0 grupos com duplicatas');
asserir(dryRunSegundoPasse.total_categorias_duplicadas === 0, 'Segundo passe: 0 categorias duplicadas');

const resSegundoPasse = await sim.mesclarCategoriasDuplicadas({ textoConfirmacao: 'MESCLAR' });
asserir(resSegundoPasse.sucesso === true, 'Execução subsequente retorna sucesso imediato');
asserir(resSegundoPasse.total_categorias_mescladas === 0, 'Zero categorias mescladas na segunda execução');

// -----------------------------------------------------------------
// BLOCO 9: TOTAIS DE DRE E FLUXO ABSOLUTAMENTE INALTERADOS
// -----------------------------------------------------------------
console.log('\n--- BLOCO 9: Totais de DRE e Relatórios Absolutamente Inalterados ---');

// Somatório dos lançamentos antes e depois
const totalDespesasAntes = 200 + 300 + 450 + 900;
const totalDespesasDepois = sim.cacheLancamentos.reduce((acc, l) => acc + l.valor, 0);
asserir(totalDespesasAntes === totalDespesasDepois, `Total financeiro das despesas mantido: R$ ${totalDespesasAntes} === R$ ${totalDespesasDepois}`);

const agrupamentoCanonica = sim.cacheLancamentos
  .filter((l) => l.categoria_id === idCanonicaCombustivel)
  .reduce((acc, l) => acc + l.valor, 0);
asserir(agrupamentoCanonica === 1850, `Lançamentos agrupados perfeitamente sob a canônica: R$ 1850.00`);

// -----------------------------------------------------------------
// RESUMO FINAL
// -----------------------------------------------------------------
console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(`  Total de Asserções Realizadas: ${totalAssercoes}`);
console.log(`  Passaram:                      ${totalAssercoes - totalFalhas}`);
console.log(`  Falharam:                      ${totalFalhas}`);
console.log('═══════════════════════════════════════════════════════════════════');

if (totalFalhas > 0) {
  console.error('\n❌ FALHAS DETECTADAS:');
  detalheFalhas.forEach((f) => console.error(f));
  process.exit(1);
} else {
  console.log('\n🎉 TODOS OS TESTES DA PARTE 24A PASSARAM COM 100% DE SUCESSO!\n');
}
