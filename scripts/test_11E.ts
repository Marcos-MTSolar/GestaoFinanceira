import { montarBalanco, EntradaBalanco } from '../src/utils/balanco';

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASSOU] ${testName}`);
  } else {
    console.log(`[FALHOU] ${testName} ${detail || ''}`);
  }
}

console.log('=== TESTES CONFERÊNCIA PARTE 11E ===');

// Caso a)
const entradaA: EntradaBalanco = {
  contas: [
    { nome: 'A', saldo: 1000 },
    { nome: 'B', saldo: -200 },
  ],
  contasAReceber: 500,
  contasAPagar: 300,
  folhaAPagar: 100,
  adiantamentosColaboradores: 50,
  itensManuais: [
    { id: '1', grupo: 'ativo_nao_circulante', nome: 'Imobilizado', valor: 2000 },
    { id: '2', grupo: 'passivo_nao_circulante', nome: 'Financiamento', valor: 400 },
    { id: '3', grupo: 'pl_capital', nome: 'Capital', valor: 1000 },
  ],
};

const resA = montarBalanco(entradaA);
const condA =
  resA.totais.ativo === 3550 &&
  resA.totais.passivo === 1000 &&
  resA.totais.patrimonioLiquido === 2550 &&
  resA.totais.lucrosAcumulados === 1550 &&
  resA.totais.passivoMaisPL === 3550;

assert(
  condA,
  'a) Caso completo com contas, operacionais e manuais',
  JSON.stringify(resA.totais)
);

// Caso b)
const entradaB: EntradaBalanco = {
  contas: [],
  contasAReceber: 0,
  contasAPagar: 0,
  folhaAPagar: 0,
  adiantamentosColaboradores: 0,
  itensManuais: [],
};

const resB = montarBalanco(entradaB);
const todosTotaisZero = Object.values(resB.totais).every((v) => v === 0);
const linhaPLB = resB.patrimonioLiquido.find(
  (l) => l.nome === 'Lucros acumulados (apurado)' && l.valor === 0
);
const condB = todosTotaisZero && !!linhaPLB;

assert(
  condB,
  'b) Entrada toda zerada e sem itens manuais',
  `totaisZero=${todosTotaisZero}, linhaPL=${JSON.stringify(linhaPLB)}`
);

// Caso c)
const entradaC: EntradaBalanco = {
  contas: [{ nome: 'A', saldo: 100 }],
  contasAReceber: 0,
  contasAPagar: 300,
  folhaAPagar: 0,
  adiantamentosColaboradores: 0,
  itensManuais: [],
};

const resC = montarBalanco(entradaC);
const linhaPLC = resC.patrimonioLiquido.find(
  (l) => l.nome === 'Prejuízos acumulados (apurado)' && l.valor === -200
);
const condC =
  resC.totais.ativo === 100 &&
  resC.totais.passivo === 300 &&
  resC.totais.patrimonioLiquido === -200 &&
  resC.totais.lucrosAcumulados === -200 &&
  !!linhaPLC;

assert(
  condC,
  'c) Prejuízos acumulados apurados quando passivo supera ativo',
  `totais=${JSON.stringify(resC.totais)}, linhaPL=${JSON.stringify(linhaPLC)}`
);

// Caso d)
const entradaD: EntradaBalanco = {
  contas: [{ nome: 'Conta Negativa', saldo: -50 }],
  contasAReceber: 0,
  contasAPagar: 0,
  folhaAPagar: 0,
  adiantamentosColaboradores: 0,
  itensManuais: [],
};

const resD = montarBalanco(entradaD);
const noPassivo = resD.passivoCirculante.some(
  (l) => l.valor === 50 && l.nome.includes('Conta Negativa')
);
const noAtivo = resD.ativoCirculante.some((l) => l.nome.includes('Conta Negativa'));
const condD = noPassivo && !noAtivo;

assert(
  condD,
  'd) Conta com saldo negativo vai para passivoCirculante e não para ativoCirculante',
  `noPassivo=${noPassivo}, noAtivo=${noAtivo}`
);

// Caso e)
const condE =
  resA.totais.ativo === resA.totais.passivoMaisPL &&
  resB.totais.ativo === resB.totais.passivoMaisPL &&
  resC.totais.ativo === resC.totais.passivoMaisPL &&
  resD.totais.ativo === resD.totais.passivoMaisPL;

assert(
  condE,
  'e) Em TODOS os casos: totais.ativo === totais.passivoMaisPL',
  `resA: ${resA.totais.ativo}===${resA.totais.passivoMaisPL}, resB: ${resB.totais.ativo}===${resB.totais.passivoMaisPL}, resC: ${resC.totais.ativo}===${resC.totais.passivoMaisPL}, resD: ${resD.totais.ativo}===${resD.totais.passivoMaisPL}`
);
