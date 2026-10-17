// Teste B2: formatarPercentual
import { formatarPercentual } from '../src/utils/formatters';

const casos: Array<[number, string]> = [
  [90.6,   '90,6%'],
  [62.5,   '62,5%'],
  [9.4,    '9,4%'],
  [0,      '0,0%'],
  [100,    '100,0%'],
  [1234.5, '1.234,5%'],
];

let passou = 0;
let falhou = 0;

for (const [entrada, esperado] of casos) {
  const resultado = formatarPercentual(entrada);
  if (resultado === esperado) {
    console.log(`PASSOU: formatarPercentual(${entrada}) === '${esperado}'`);
    passou++;
  } else {
    console.log(`FALHOU: formatarPercentual(${entrada}) === '${resultado}' (esperado: '${esperado}')`);
    falhou++;
  }
}

console.log(`\nResultado: ${passou} PASSOU / ${falhou} FALHOU`);
