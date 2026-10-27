// MT Solar - Gestão Financeira
// Testes da Parte 23B: Recorrência automática (funções puras)

import { datasDoMes, planejarGeracao } from '../src/utils/recorrencia';
import { RecorrenciaLancamento, Lancamento } from '../src/types';

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

function assertArrayIgual(a: string[], b: string[], msg: string) {
  const igual = a.length === b.length && a.every((v, i) => v === b[i]);
  asserir(igual, `${msg} — esperado [${b.join(', ')}], obtido [${a.join(', ')}]`);
}

/** Cria um modelo de recorrência fictício */
function criarModelo(params: Partial<RecorrenciaLancamento> & { id: string }): RecorrenciaLancamento {
  const base: RecorrenciaLancamento = {
    id: params.id,
    tipo: 'despesa',
    descricao: 'Conta fictícia',
    valor: 1000,
    frequencia: 'mensal',
    data_inicio: '2026-01-10',
    conta_id: 'conta-1',
    categoria_id: 'cat-1',
    forma_pagamento: 'PIX',
    ativa: true,
    ultima_competencia_gerada: '2025-12',
    criado_em: '2026-01-01T00:00:00.000Z',
  };
  return { ...base, ...params };
}

/** Cria um lançamento fictício já existente com ID determinístico */
function criarLancExistente(id: string, status: 'pendente' | 'pago' = 'pendente'): Lancamento {
  return {
    id,
    tipo: 'despesa',
    descricao: 'Conta fictícia',
    valor: 1000,
    data_vencimento: id.replace('lanc-rec-rec-teste-', ''),
    data_pagamento: status === 'pago' ? '2026-01-10' : null,
    status,
    conta_id: 'conta-1',
    categoria_id: 'cat-1',
    forma_pagamento: 'PIX',
    recorrencia: 'mensal',
    grupo_recorrencia_id: 'rec-teste',
    origem: 'manual',
    criado_em: '2026-01-01T00:00:00.000Z',
  };
}

// =============================================================================
// BLOCO 1: datasDoMes — Mensal dia 31 em meses com 28/29/30/31 dias
// =============================================================================
async function testarMensalDia31() {
  console.log('\n--- BLOCO 1: datasDoMes — Mensal dia 31 em meses com 28/29/30/31 dias ---');

  const rec = criarModelo({ id: 'rec-1', frequencia: 'mensal', data_inicio: '2026-01-31' });

  // Fevereiro 2026 (não bissexto): dia 31 → vira 28
  const febNaoB = datasDoMes(rec, '2026-02');
  assertArrayIgual(febNaoB, ['2026-02-28'], 'Fevereiro não-bissexto: dia 31 → 28');

  // Fevereiro 2028 (bissexto): dia 31 → vira 29
  const febB = datasDoMes(rec, '2028-02');
  assertArrayIgual(febB, ['2028-02-29'], 'Fevereiro bissexto (2028): dia 31 → 29');

  // Abril (30 dias): dia 31 → vira 30
  const abr = datasDoMes(rec, '2026-04');
  assertArrayIgual(abr, ['2026-04-30'], 'Abril (30 dias): dia 31 → 30');

  // Janeiro (31 dias): dia 31 normal
  const jan = datasDoMes(rec, '2026-01');
  assertArrayIgual(jan, ['2026-01-31'], 'Janeiro (31 dias): dia 31 permanece 31');

  // Março (31 dias): dia 31 normal
  const mar = datasDoMes(rec, '2026-03');
  assertArrayIgual(mar, ['2026-03-31'], 'Março (31 dias): dia 31 permanece 31');

  console.log('✅ BLOCO 1 concluído.');
}

// =============================================================================
// BLOCO 2: datasDoMes — Frequência Anual
// =============================================================================
async function testarAnual() {
  console.log('\n--- BLOCO 2: datasDoMes — Frequência Anual ---');

  // Modelo com data_inicio = 2026-03-15 (março)
  const rec = criarModelo({ id: 'rec-anual', frequencia: 'anual', data_inicio: '2026-03-15' });

  // No mês de aniversário (março 2026)
  const marco = datasDoMes(rec, '2026-03');
  assertArrayIgual(marco, ['2026-03-15'], 'Anual: gera no mês correto (março 2026)');

  // Em outros meses não gera
  const jan = datasDoMes(rec, '2026-01');
  assertArrayIgual(jan, [], 'Anual: não gera em meses diferentes do início');

  // No mês de aniversário do ano seguinte
  const marco27 = datasDoMes(rec, '2027-03');
  assertArrayIgual(marco27, ['2027-03-15'], 'Anual: gera em março 2027');

  console.log('✅ BLOCO 2 concluído.');
}

// =============================================================================
// BLOCO 3: datasDoMes — Frequência Semanal (mês com 4 e com 5 datas)
// =============================================================================
async function testarSemanal() {
  console.log('\n--- BLOCO 3: datasDoMes — Frequência Semanal ---');

  // data_inicio = 2026-01-07 (quarta-feira)
  const rec = criarModelo({ id: 'rec-sem', frequencia: 'semanal', data_inicio: '2026-01-07' });

  // Janeiro 2026: 07, 14, 21, 28 (4 datas — semanas completas)
  const jan = datasDoMes(rec, '2026-01');
  assertArrayIgual(jan, ['2026-01-07', '2026-01-14', '2026-01-21', '2026-01-28'], 'Semanal: janeiro 2026 com 4 datas');

  // Outubro 2026: 07, 14, 21, 28 do início, mas data_inicio é jan/07
  // outubro/2026: 07/10, 14/10, 21/10, 28/10 = 4 quartas-feiras
  const out = datasDoMes(rec, '2026-10');
  // 2026-01-07 + N*7 que cai em outubro 2026
  // Dias de outubro que são +7k de 2026-01-07:
  // 2026-01-07 → 272 dias para 2026-10-05 (1ª da série que cai em out)
  // Precisamos calcular. 2026-01-07 + semanas:
  // 2026-10-07, 2026-10-14, 2026-10-21, 2026-10-28 → 4 datas (quarta-feira em outubro)
  asserir(out.length >= 4, `Semanal: outubro 2026 deve ter ao menos 4 datas (obtido ${out.length})`);
  asserir(out.every(d => d.startsWith('2026-10-')), 'Semanal: todas as datas devem ser em outubro 2026');

  // Mês com 5 ocorrências: encontrar mês onde a série cai 5x
  // data_inicio 2026-01-07 (quarta). Maio 2026 tem quartas: 06, 13, 20, 27 = 4 datas
  // Março 2026 tem quartas: 04, 11, 18, 25 = 4 datas
  // Setembro 2026 tem quartas: 02, 09, 16, 23, 30 = 5 quartas
  const set = datasDoMes(rec, '2026-09');
  asserir(set.length === 5, `Semanal: setembro 2026 deve ter 5 datas (obtido ${set.length}: ${set.join(', ')})`);

  console.log('✅ BLOCO 3 concluído.');
}

// =============================================================================
// BLOCO 4: datasDoMes — Respeitar data_inicio (não gerar antes)
// =============================================================================
async function testarDataInicio() {
  console.log('\n--- BLOCO 4: datasDoMes — Não gerar antes de data_inicio ---');

  // Modelo mensal com data_inicio = 2026-03-15 (não deve gerar antes de março)
  const rec = criarModelo({ id: 'rec-fut', frequencia: 'mensal', data_inicio: '2026-03-15' });

  // Janeiro 2026: antes de data_inicio → não gera
  const jan = datasDoMes(rec, '2026-01');
  assertArrayIgual(jan, [], 'Mensal: não gera antes de data_inicio');

  // Março 2026: primeiro mês após data_inicio → gera
  const mar = datasDoMes(rec, '2026-03');
  assertArrayIgual(mar, ['2026-03-15'], 'Mensal: gera no mês de data_inicio');

  console.log('✅ BLOCO 4 concluído.');
}

// =============================================================================
// BLOCO 5: datasDoMes — Respeitar data_encerramento
// =============================================================================
async function testarDataEncerramento() {
  console.log('\n--- BLOCO 5: datasDoMes — Não gerar após data_encerramento ---');

  const rec = criarModelo({
    id: 'rec-enc',
    frequencia: 'mensal',
    data_inicio: '2026-01-10',
    data_encerramento: '2026-03-31',
  });

  // Março 2026: última competência (encerra em 31/03)
  const mar = datasDoMes(rec, '2026-03');
  assertArrayIgual(mar, ['2026-03-10'], 'Mensal: gera em março (antes de encerrar)');

  // Abril 2026: após data_encerramento → não gera
  const abr = datasDoMes(rec, '2026-04');
  assertArrayIgual(abr, [], 'Mensal: não gera após data_encerramento');

  console.log('✅ BLOCO 5 concluído.');
}

// =============================================================================
// BLOCO 6: planejarGeracao — Catch-up de 3 meses atrasados
// =============================================================================
async function testarCatchUp() {
  console.log('\n--- BLOCO 6: planejarGeracao — Catch-up de 3 meses atrasados ---');

  const rec = criarModelo({
    id: 'rec-catchup',
    frequencia: 'mensal',
    data_inicio: '2026-01-10',
    ultima_competencia_gerada: '2025-12',
  });

  // Hoje = 2026-03-20 → deve gerar janeiro, fevereiro e março
  const novos = planejarGeracao(rec, [], '2026-03-20');
  asserir(novos.length === 3, `Catch-up: deve gerar 3 lançamentos (gerou ${novos.length})`);
  asserir(novos[0].competencia === '2026-01', `Catch-up: 1º é janeiro 2026 (obtido: ${novos[0].competencia})`);
  asserir(novos[1].competencia === '2026-02', `Catch-up: 2º é fevereiro 2026 (obtido: ${novos[1].competencia})`);
  asserir(novos[2].competencia === '2026-03', `Catch-up: 3º é março 2026 (obtido: ${novos[2].competencia})`);
  asserir(novos.every(l => l.status === 'pendente'), 'Catch-up: todos com status pendente');
  asserir(novos.every(l => l.grupo_recorrencia_id === 'rec-catchup'), 'Catch-up: grupo_recorrencia_id correto');

  console.log('✅ BLOCO 6 concluído.');
}

// =============================================================================
// BLOCO 7: planejarGeracao — Limite de 12 meses
// =============================================================================
async function testarLimite12Meses() {
  console.log('\n--- BLOCO 7: planejarGeracao — Limite de 12 meses por execução ---');

  const rec = criarModelo({
    id: 'rec-limite',
    frequencia: 'mensal',
    data_inicio: '2025-01-10',
    ultima_competencia_gerada: '2024-12',
  });

  // Hoje = 2026-10-01 → sem limite seriam 22 meses, com limite são 12
  const novos = planejarGeracao(rec, [], '2026-10-01');
  asserir(novos.length === 12, `Limite 12: deve gerar exatamente 12 lançamentos (gerou ${novos.length})`);

  console.log('✅ BLOCO 7 concluído.');
}

// =============================================================================
// BLOCO 8: planejarGeracao — Idempotência (planejar duas vezes não duplica)
// =============================================================================
async function testarIdempotencia() {
  console.log('\n--- BLOCO 8: planejarGeracao — Idempotência ---');

  const rec = criarModelo({
    id: 'rec-idemp',
    frequencia: 'mensal',
    data_inicio: '2026-01-10',
    ultima_competencia_gerada: '2025-12',
  });

  // Primeira execução: gera janeiro 2026
  const novos1 = planejarGeracao(rec, [], '2026-01-15');
  asserir(novos1.length === 1, `Idempotência: 1ª execução deve gerar 1 lançamento (gerou ${novos1.length})`);

  // Segunda execução: simula que o lançamento já existe
  const novos2 = planejarGeracao(rec, novos1, '2026-01-15');
  asserir(novos2.length === 0, `Idempotência: 2ª execução deve gerar 0 lançamentos (gerou ${novos2.length})`);

  console.log('✅ BLOCO 8 concluído.');
}

// =============================================================================
// BLOCO 9: planejarGeracao — Lançamento excluído pelo usuário não reaparece
// =============================================================================
async function testarExcluidoNaoReaparece() {
  console.log('\n--- BLOCO 9: planejarGeracao — Excluído não reaparece ---');

  // A competência já avançou: ultima_competencia_gerada = '2026-01'
  // O lançamento de jan foi excluído pelo usuário (não está em lancamentosExistentes)
  // Portanto não será gerado novamente (competência já passou)
  const rec = criarModelo({
    id: 'rec-excl',
    frequencia: 'mensal',
    data_inicio: '2026-01-10',
    ultima_competencia_gerada: '2026-01', // já avançado após gerar janeiro
  });

  // Lance de janeiro não existe (usuário excluiu), mas a competência já avançou
  const novos = planejarGeracao(rec, [], '2026-02-15');
  // Deve gerar apenas fevereiro (janeiro não volta)
  asserir(novos.length === 1, `Excluído: apenas fevereiro deve ser gerado (gerou ${novos.length})`);
  asserir(novos[0].competencia === '2026-02', `Excluído: lançamento gerado é de fevereiro (${novos[0].competencia})`);

  console.log('✅ BLOCO 9 concluído.');
}

// =============================================================================
// BLOCO 10: planejarGeracao — Lançamento já pago não é sobrescrito
// =============================================================================
async function testarPagoNaoSobrescrito() {
  console.log('\n--- BLOCO 10: planejarGeracao — Pago não é sobrescrito ---');

  const rec = criarModelo({
    id: 'rec-pago',
    frequencia: 'mensal',
    data_inicio: '2026-01-10',
    ultima_competencia_gerada: '2025-12',
  });

  // Lançamento de janeiro já pago
  const lançJanPago: Lancamento = {
    id: 'lanc-rec-rec-pago-2026-01-10',
    tipo: 'despesa',
    descricao: 'Conta fictícia',
    valor: 1000,
    data_vencimento: '2026-01-10',
    data_pagamento: '2026-01-10',
    status: 'pago',
    conta_id: 'conta-1',
    categoria_id: 'cat-1',
    forma_pagamento: 'PIX',
    recorrencia: 'mensal',
    grupo_recorrencia_id: 'rec-pago',
    origem: 'manual',
    criado_em: '2026-01-01T00:00:00.000Z',
  };

  // Deve NÃO gerar janeiro (já existe com esse ID, mesmo pago)
  const novos = planejarGeracao(rec, [lançJanPago], '2026-02-10');
  asserir(
    novos.every(l => l.id !== 'lanc-rec-rec-pago-2026-01-10'),
    'Pago não sobrescrito: não deve gerar lançamento com ID já existente'
  );
  // Fevereiro deve ser gerado
  const tem_fev = novos.some(l => l.competencia === '2026-02');
  asserir(tem_fev, 'Pago não sobrescrito: fevereiro deve ser gerado normalmente');

  console.log('✅ BLOCO 10 concluído.');
}

// =============================================================================
// BLOCO 11: planejarGeracao — Modelo inativo
// =============================================================================
async function testarModeloInativo() {
  console.log('\n--- BLOCO 11: planejarGeracao — Modelo inativo ---');

  const rec = criarModelo({
    id: 'rec-inativo',
    frequencia: 'mensal',
    data_inicio: '2026-01-10',
    ultima_competencia_gerada: '2025-12',
    ativa: false,
  });

  const novos = planejarGeracao(rec, [], '2026-03-01');
  asserir(novos.length === 0, `Inativo: modelo inativo não deve gerar lançamentos (gerou ${novos.length})`);

  console.log('✅ BLOCO 11 concluído.');
}

// =============================================================================
// BLOCO 12: planejarGeracao — Virada de ano (dezembro → janeiro)
// =============================================================================
async function testarViradaDeAno() {
  console.log('\n--- BLOCO 12: planejarGeracao — Virada de ano (dezembro → janeiro) ---');

  const rec = criarModelo({
    id: 'rec-virada',
    frequencia: 'mensal',
    data_inicio: '2025-12-15',
    ultima_competencia_gerada: '2025-11',
  });

  // Hoje = 2026-02-01 → deve gerar dezembro 2025 e janeiro 2026
  const novos = planejarGeracao(rec, [], '2026-02-01');
  asserir(novos.length === 3, `Virada de ano: deve gerar 3 lançamentos (gerou ${novos.length})`);
  asserir(novos[0].competencia === '2025-12', `Virada: 1º é dezembro 2025 (${novos[0].competencia})`);
  asserir(novos[1].competencia === '2026-01', `Virada: 2º é janeiro 2026 (${novos[1].competencia})`);
  asserir(novos[2].competencia === '2026-02', `Virada: 3º é fevereiro 2026 (${novos[2].competencia})`);
  asserir(novos[0].data_vencimento === '2025-12-15', `Virada: dez com dia 15 (${novos[0].data_vencimento})`);
  asserir(novos[1].data_vencimento === '2026-01-15', `Virada: jan com dia 15 (${novos[1].data_vencimento})`);

  console.log('✅ BLOCO 12 concluído.');
}

// =============================================================================
// BLOCO 13: planejarGeracao — Modelo com data_inicio futura (não gera antes da hora)
// =============================================================================
async function testarDataInicioFutura() {
  console.log('\n--- BLOCO 13: planejarGeracao — data_inicio futura não gera antes da hora ---');

  // data_inicio = março, ultima_competencia_gerada = dez ano anterior
  // Hoje = fevereiro → não deve gerar nada (data_inicio ainda no futuro)
  const rec = criarModelo({
    id: 'rec-futuro',
    frequencia: 'mensal',
    data_inicio: '2026-03-10',
    ultima_competencia_gerada: '2025-12',
  });

  // Hoje = 2026-02-01 → janeiro e fevereiro seriam tentados, mas data_inicio é março
  const novos = planejarGeracao(rec, [], '2026-02-20');
  // datasDoMes para jan/fev com data_inicio=março não gera (está antes de data_inicio)
  asserir(novos.length === 0, `Data futura: não deve gerar antes de data_inicio (gerou ${novos.length})`);

  // Hoje = 2026-03-15 → deve gerar março
  const novos2 = planejarGeracao(rec, [], '2026-03-15');
  asserir(novos2.length > 0, `Data futura: gera em março quando data_inicio chegou (gerou ${novos2.length})`);
  asserir(novos2[0].competencia === '2026-03', `Data futura: 1º lançamento é de março (${novos2[0].competencia})`);

  console.log('✅ BLOCO 13 concluído.');
}

// =============================================================================
// BLOCO 14: planejarGeracao — ID determinístico correto
// =============================================================================
async function testarIdDeterministico() {
  console.log('\n--- BLOCO 14: planejarGeracao — ID determinístico ---');

  const rec = criarModelo({
    id: 'rec-det',
    frequencia: 'mensal',
    data_inicio: '2026-05-20',
    ultima_competencia_gerada: '2026-04',
  });

  const novos = planejarGeracao(rec, [], '2026-05-21');
  asserir(novos.length === 1, `ID deterministico: deve gerar 1 lançamento (gerou ${novos.length})`);
  asserir(
    novos[0].id === 'lanc-rec-rec-det-2026-05-20',
    `ID determinístico: formato correto (obtido: ${novos[0].id})`
  );

  console.log('✅ BLOCO 14 concluído.');
}

// =============================================================================
// EXECUÇÃO PRINCIPAL
// =============================================================================
async function executarTodos() {
  console.log('🧪 Iniciando testes da PARTE 23B — Recorrência automática (funções puras)\n');

  await testarMensalDia31();
  await testarAnual();
  await testarSemanal();
  await testarDataInicio();
  await testarDataEncerramento();
  await testarCatchUp();
  await testarLimite12Meses();
  await testarIdempotencia();
  await testarExcluidoNaoReaparece();
  await testarPagoNaoSobrescrito();
  await testarModeloInativo();
  await testarViradaDeAno();
  await testarDataInicioFutura();
  await testarIdDeterministico();

  console.log('\n=== RESULTADO FINAL ===');
  console.log(`Total de asserções: ${totalAssercoes}`);
  console.log(`Aprovadas: ${totalAssercoes - totalFalhas}`);
  console.log(`Falhas: ${totalFalhas}`);

  if (totalFalhas > 0) {
    console.log('\nDetalhes das falhas:');
    detalheFalhas.forEach(f => console.log(f));
    process.exit(1);
  } else {
    console.log('\n✅ TODOS OS TESTES APROVADOS COM SUCESSO!');
  }
}

executarTodos().catch((err) => {
  console.error('Erro inesperado nos testes:', err);
  process.exit(1);
});
