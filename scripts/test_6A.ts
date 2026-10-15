/**
 * Testes A2 — scripts/test_6A.ts
 * Importa APENAS de '../src/utils/periodo' (proibido copiar o código).
 */
import { mesesDoPeriodo, dentroDoPeriodo } from '../src/utils/periodo';

let passou = 0;
let falhou = 0;

function verificar(descricao: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (ok) {
    console.log(`PASSOU — ${descricao}`);
    passou++;
  } else {
    console.log(`FALHOU — ${descricao}`);
    console.log(`  Esperado : ${JSON.stringify(esperado)}`);
    console.log(`  Obtido   : ${JSON.stringify(obtido)}`);
    falhou++;
  }
}

// Caso 1: período de um único mês
verificar(
  "mesesDoPeriodo('2026-10-01','2026-10-31') = ['2026-10']",
  mesesDoPeriodo('2026-10-01', '2026-10-31'),
  ['2026-10']
);

// Caso 2: ano completo tem 12 itens
const r12 = mesesDoPeriodo('2026-01-01', '2026-12-31');
verificar(
  "('2026-01-01','2026-12-31') tem 12 itens",
  r12.length,
  12
);

// Caso 3: período de 13 meses (out/2025 a out/2026)
const r13 = mesesDoPeriodo('2025-10-11', '2026-10-11');
verificar(
  "('2025-10-11','2026-10-11') tem 13 itens",
  r13.length,
  13
);
verificar(
  "primeiro item é '2025-10'",
  r13[0],
  '2025-10'
);
verificar(
  "último item é '2026-10'",
  r13[r13.length - 1],
  '2026-10'
);

// Caso 4: dentro do período — true
verificar(
  "dentroDoPeriodo('2026-10-11','2026-10-01','2026-10-31') = true",
  dentroDoPeriodo('2026-10-11', '2026-10-01', '2026-10-31'),
  true
);

// Caso 5: fora do período — false
verificar(
  "dentroDoPeriodo('2026-09-30','2026-10-01','2026-10-31') = false",
  dentroDoPeriodo('2026-09-30', '2026-10-01', '2026-10-31'),
  false
);

console.log(`\nResultado: ${passou} PASSOU / ${falhou} FALHOU`);
if (falhou > 0) process.exit(1);
