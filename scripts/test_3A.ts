import {
  dataDoDiaNaCompetencia,
  dividirQuinzenas,
  CONFIG_QUINZENAL_PADRAO,
  ConfigQuinzenal,
} from '../src/utils/quinzena';

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASSOU] ${testName}`);
  } else {
    console.log(`[FALHOU] ${testName} ${detail || ''}`);
  }
}

console.log('=== TESTES CONFERÊNCIA PARTE 3A ===');

// a) Datas na competência
const d1 = dataDoDiaNaCompetencia('02/2026', 31);
const d2 = dataDoDiaNaCompetencia('02/2028', 31);
const d3 = dataDoDiaNaCompetencia('10/2026', 15);
const d4 = dataDoDiaNaCompetencia('10/2026', 30);
assert(
  d1 === '2026-02-28' && d2 === '2028-02-29' && d3 === '2026-10-15' && d4 === '2026-10-30',
  'a) Datas na competência',
  `Recebido: d1=${d1}, d2=${d2}, d3=${d3}, d4=${d4}`
);

// b) Bruto 4160, 50% e restante (padrão)
const resB = dividirQuinzenas({
  bruto: 4160,
  totalDescontos: 0,
  adiantamentosMax: 0,
  config: CONFIG_QUINZENAL_PADRAO,
});
assert(
  resB.q1 === 2080 && resB.q2 === 2080,
  'b) Bruto 4160, 50% e restante',
  `q1=${resB.q1}, q2=${resB.q2}`
);

// c) Bruto 4160, modo fixo valor_1 1500
const configC: ConfigQuinzenal = {
  ...CONFIG_QUINZENAL_PADRAO,
  modo: 'fixo',
  valor_1: 1500,
  valor_2: null,
};
const resC = dividirQuinzenas({
  bruto: 4160,
  totalDescontos: 0,
  adiantamentosMax: 0,
  config: configC,
});
assert(
  resC.q1 === 1500 && resC.q2 === 2660,
  'c) Bruto 4160, modo fixo 1500',
  `q1=${resC.q1}, q2=${resC.q2}`
);

// d) Caso b com adiantamentosMax 1000
const resD = dividirQuinzenas({
  bruto: 4160,
  totalDescontos: 0,
  adiantamentosMax: 1000,
  config: CONFIG_QUINZENAL_PADRAO,
});
assert(
  resD.q2 === 1080 && resD.abatimentoAdiantamentos === 1000,
  'd) Caso b com adiantamentos 1000',
  `q2=${resD.q2}, abatimento=${resD.abatimentoAdiantamentos}`
);

// e) Caso b com totalDescontos 100
const resE = dividirQuinzenas({
  bruto: 4160,
  totalDescontos: 100,
  adiantamentosMax: 0,
  config: CONFIG_QUINZENAL_PADRAO,
});
assert(
  resE.q2 === 1980 && resE.descontosNaQ2 === 100,
  'e) Caso b com totalDescontos 100',
  `q2=${resE.q2}, descontosNaQ2=${resE.descontosNaQ2}`
);

// f) Caso b com totalDescontos 3000
const resF = dividirQuinzenas({
  bruto: 4160,
  totalDescontos: 3000,
  adiantamentosMax: 0,
  config: CONFIG_QUINZENAL_PADRAO,
});
assert(
  resF.q2 === 0 && resF.descontosNaQ2 === 2080 && resF.avisos.length === 1,
  'f) Caso b com totalDescontos 3000',
  `q2=${resF.q2}, descontosNaQ2=${resF.descontosNaQ2}, avisos=${resF.avisos.length}`
);

// g) Modo fixo valor_1 5000 (maior que bruto 4160)
const configG: ConfigQuinzenal = {
  ...CONFIG_QUINZENAL_PADRAO,
  modo: 'fixo',
  valor_1: 5000,
  valor_2: null,
};
const resG = dividirQuinzenas({
  bruto: 4160,
  totalDescontos: 0,
  adiantamentosMax: 0,
  config: configG,
});
assert(
  resG.q1 === 4160 && resG.q2 === 0,
  'g) Modo fixo 5000 com bruto 4160',
  `q1=${resG.q1}, q2=${resG.q2}`
);

// h) Percentual 40% e 40% explícito
const configH: ConfigQuinzenal = {
  ...CONFIG_QUINZENAL_PADRAO,
  modo: 'percentual',
  valor_1: 40,
  valor_2: 40,
};
const resH = dividirQuinzenas({
  bruto: 4160,
  totalDescontos: 0,
  adiantamentosMax: 0,
  config: configH,
});
assert(
  resH.q1 === 1664 && resH.q2 === 1664 && resH.avisos.length === 1,
  'h) Percentual 40% e 40% explícito',
  `q1=${resH.q1}, q2=${resH.q2}, avisos=${resH.avisos.length}`
);

// i) Caso b com totalDescontos 192
const resI = dividirQuinzenas({
  bruto: 4160,
  totalDescontos: 192,
  adiantamentosMax: 0,
  config: CONFIG_QUINZENAL_PADRAO,
});
assert(
  resI.q2 === 1888 && resI.q1 + resI.q2 === 3968,
  'i) Caso b com totalDescontos 192',
  `q2=${resI.q2}, soma=${resI.q1 + resI.q2}`
);
