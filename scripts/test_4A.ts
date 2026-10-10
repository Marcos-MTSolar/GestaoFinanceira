import { calcularDescontosRecorrentes } from '../src/utils/descontos';
import type { DescontoRecorrente } from '../src/types';

const base = { salarioBase: 3200, bruto: 4160 };

console.log('=== TESTES DA PARTE 4A ===\n');

// Caso a: 6% sobre salario_base -> 192
const itemA: DescontoRecorrente = { id: 'a', nome: 'Plano A', tipo: 'percentual', valor: 6, base: 'salario_base', ativo: true };
const resA = calcularDescontosRecorrentes([itemA], base);
const passouA = resA.length === 1 && resA[0].valor === 192 && resA[0].chave === 'rec-a';
console.log(`Caso a) 6% sobre salario_base -> 192: ${passouA ? 'PASSOU' : 'FALHOU'}`);

// Caso b: fixo 80 -> 80
const itemB: DescontoRecorrente = { id: 'b', nome: 'Plano B', tipo: 'fixo', valor: 80, base: 'salario_base', ativo: true };
const resB = calcularDescontosRecorrentes([itemB], base);
const passouB = resB.length === 1 && resB[0].valor === 80 && resB[0].chave === 'rec-b';
console.log(`Caso b) fixo 80 -> 80: ${passouB ? 'PASSOU' : 'FALHOU'}`);

// Caso c: 5% sobre bruto -> 208
const itemC: DescontoRecorrente = { id: 'c', nome: 'Plano C', tipo: 'percentual', valor: 5, base: 'bruto', ativo: true };
const resC = calcularDescontosRecorrentes([itemC], base);
const passouC = resC.length === 1 && resC[0].valor === 208 && resC[0].chave === 'rec-c';
console.log(`Caso c) 5% sobre bruto -> 208: ${passouC ? 'PASSOU' : 'FALHOU'}`);

// Caso d: item com ativo false -> ignorado
const itemD: DescontoRecorrente = { id: 'd', nome: 'Plano D', tipo: 'fixo', valor: 100, base: 'salario_base', ativo: false };
const resD = calcularDescontosRecorrentes([itemD], base);
const passouD = resD.length === 0;
console.log(`Caso d) item com ativo false -> ignorado: ${passouD ? 'PASSOU' : 'FALHOU'}`);

// Caso e: lista [a, b] -> 2 itens, soma 272
const resE = calcularDescontosRecorrentes([itemA, itemB], base);
const somaE = resE.reduce((s, x) => s + x.valor, 0);
const passouE = resE.length === 2 && somaE === 272;
console.log(`Caso e) lista [a, b] -> 2 itens, soma 272: ${passouE ? 'PASSOU' : 'FALHOU'}`);

// Caso f: lista undefined -> []
const resF = calcularDescontosRecorrentes(undefined, base);
const passouF = Array.isArray(resF) && resF.length === 0;
console.log(`Caso f) lista undefined -> []: ${passouF ? 'PASSOU' : 'FALHOU'}`);

// Caso g: valor negativo -> ignorado
const itemG: DescontoRecorrente = { id: 'g', nome: 'Plano G', tipo: 'fixo', valor: -50, base: 'salario_base', ativo: true };
const resG = calcularDescontosRecorrentes([itemG], base);
const passouG = resG.length === 0;
console.log(`Caso g) valor negativo -> ignorado: ${passouG ? 'PASSOU' : 'FALHOU'}`);
