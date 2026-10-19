// MT Solar - Gestão Financeira
// Teste de Resolução de Conta Bancária para Extratos (Parte 15B)

import fs from 'fs';
import path from 'path';
import { ContaBancaria } from '../src/types';
import { lerExtrato, resolverConta, ExtratoLido } from '../src/utils/extrato';

let passou = 0;
let falhou = 0;

function asserir(condicao: boolean, descricao: string, detalheErro?: string): void {
  if (condicao) {
    console.log(`  [PASSOU] ${descricao}`);
    passou++;
  } else {
    console.error(`  [FALHOU] ${descricao}${detalheErro ? ` -> ${detalheErro}` : ''}`);
    falhou++;
  }
}

async function executarTestes(): Promise<void> {
  console.log('================================================================');
  console.log(' INICIANDO TESTES DE RESOLUÇÃO DE CONTA BANCÁRIA (PARTE 15B)');
  console.log('================================================================\n');

  const caminhoOfx = path.resolve('src/exemplos_extratos/extrato-pj-16_10_2026_19h22m20s.ofx');
  const caminhoXlsx = path.resolve('src/exemplos_extratos/excel_export1792140356207.xlsx');

  const bufferOfxNode = fs.readFileSync(caminhoOfx);
  const arrayBufferOfx = bufferOfxNode.buffer.slice(
    bufferOfxNode.byteOffset,
    bufferOfxNode.byteOffset + bufferOfxNode.byteLength
  );

  const bufferXlsxNode = fs.readFileSync(caminhoXlsx);
  const arrayBufferXlsx = bufferXlsxNode.buffer.slice(
    bufferXlsxNode.byteOffset,
    bufferXlsxNode.byteOffset + bufferXlsxNode.byteLength
  );

  const extratoOfx: ExtratoLido = await lerExtrato(arrayBufferOfx, 'extrato.ofx');
  const extratoXlsx: ExtratoLido = await lerExtrato(arrayBufferXlsx, 'extrato.xlsx');

  // Conta real da MT Solar no Santander
  const contaSantanderPJ: ContaBancaria = {
    id: 'conta-santander-pj',
    nome: 'Santander PJ Operacional',
    banco: 'Santander',
    banco_codigo: '033',
    agencia: '3749',
    numero_conta: '13004696-4',
    tipo: 'corrente',
    saldo_inicial: 10000,
    data_saldo_inicial: '2026-01-01',
    limite_cheque_especial: 50000,
    taxa_juros_cheque_especial_mensal: 8.5,
    cor: '#EC0000',
    ativa: true
  };

  const contaSicoob: ContaBancaria = {
    id: 'conta-sicoob',
    nome: 'Sicoob MT Solar',
    banco: 'Sicoob',
    banco_codigo: '756',
    agencia: '3001',
    numero_conta: '998877-1',
    tipo: 'corrente',
    saldo_inicial: 5000,
    data_saldo_inicial: '2026-01-01',
    limite_cheque_especial: 20000,
    taxa_juros_cheque_especial_mensal: 7.5,
    cor: '#003064',
    ativa: true
  };

  const contaBradesco: ContaBancaria = {
    id: 'conta-bradesco',
    nome: 'Bradesco Reserva',
    banco: 'Bradesco',
    banco_codigo: '237',
    agencia: '1234',
    numero_conta: '554433-2',
    tipo: 'corrente',
    saldo_inicial: 15000,
    data_saldo_inicial: '2026-01-01',
    limite_cheque_especial: 0,
    taxa_juros_cheque_especial_mensal: 0,
    cor: '#CC092F',
    ativa: true
  };

  const todasContas = [contaSicoob, contaSantanderPJ, contaBradesco];

  // -------------------------------------------------------------
  // TESTE 1: OFX e XLSX reais resolvem para A MESMA conta Santander
  // -------------------------------------------------------------
  console.log('--- TESTE 1: Resolução com Arquivos Reais (OFX e XLSX) ---');
  const resOfx = resolverConta(extratoOfx, todasContas);
  asserir(resOfx.tipo === 'unica', 'OFX resolve para conta única');
  if (resOfx.tipo === 'unica') {
    asserir(resOfx.conta.id === 'conta-santander-pj', `OFX resolveu para "${resOfx.conta.nome}" (ID: ${resOfx.conta.id})`);
    asserir(resOfx.criterio === 'banco_codigo_e_conta', `Critério utilizado: ${resOfx.criterio}`);
  }

  const resXlsx = resolverConta(extratoXlsx, todasContas);
  asserir(resXlsx.tipo === 'unica', 'XLSX resolve para conta única');
  if (resXlsx.tipo === 'unica') {
    asserir(resXlsx.conta.id === 'conta-santander-pj', `XLSX resolveu para "${resXlsx.conta.nome}" (ID: ${resXlsx.conta.id})`);
    asserir(resXlsx.criterio === 'banco_codigo_e_conta', `Critério utilizado: ${resXlsx.criterio}`);
  }

  // Garantir igualdade absoluta de resolução
  if (resOfx.tipo === 'unica' && resXlsx.tipo === 'unica') {
    asserir(
      resOfx.conta.id === resXlsx.conta.id,
      'OFX e XLSX reais resolveram para EXATAMENTE A MESMA conta bancária cadastrada!'
    );
  }

  // -------------------------------------------------------------
  // TESTE 2: Compatibilidade com conta legada (sem banco_codigo gravado)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 2: Conta Legada sem banco_codigo ---');
  const contaSantanderLegada: ContaBancaria = {
    ...contaSantanderPJ,
    id: 'conta-santander-legada',
    banco_codigo: undefined, // não tem código preenchido
    banco: 'Santander',
    numero_conta: '13004696-4'
  };

  const resLegada = resolverConta(extratoOfx, [contaSicoob, contaSantanderLegada]);
  asserir(resLegada.tipo === 'unica', 'Conta legada com nome do banco + número é resolvida como única');
  if (resLegada.tipo === 'unica') {
    asserir(resLegada.conta.id === 'conta-santander-legada', 'ID da conta legada bate');
    asserir(resLegada.criterio === 'nome_banco_e_conta', `Critério utilizado: ${resLegada.criterio}`);
  }

  // -------------------------------------------------------------
  // TESTE 3: Resolução por banco_apenas (quando só há uma conta daquele banco e sem número cadastrado)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 3: Resolução por Banco Único (sem número de conta) ---');
  const contaSantanderSemNumero: ContaBancaria = {
    ...contaSantanderPJ,
    id: 'conta-santander-sem-numero',
    numero_conta: undefined,
    agencia: undefined
  };

  const resBancoApenas = resolverConta(extratoOfx, [contaSicoob, contaSantanderSemNumero]);
  asserir(resBancoApenas.tipo === 'unica', 'Resolveu como única por haver só uma conta Santander cadastrada');
  if (resBancoApenas.tipo === 'unica') {
    asserir(resBancoApenas.criterio === 'banco_apenas', `Critério: ${resBancoApenas.criterio}`);
  }

  // -------------------------------------------------------------
  // TESTE 4: Detecção de Ambiguidade (múltiplas contas do mesmo banco sem número)
  // -------------------------------------------------------------
  console.log('\n--- TESTE 4: Detecção de Ambiguidade ---');
  const contaSantander2: ContaBancaria = {
    ...contaSantanderPJ,
    id: 'conta-santander-filial',
    nome: 'Santander Filial',
    numero_conta: undefined
  };

  const resAmbigua = resolverConta(extratoOfx, [contaSantanderSemNumero, contaSantander2]);
  asserir(resAmbigua.tipo === 'ambigua', 'Detectou ambiguidade entre 2 contas Santander');
  if (resAmbigua.tipo === 'ambigua') {
    asserir(resAmbigua.candidatas.length === 2, 'Contém 2 candidatas');
  }

  // -------------------------------------------------------------
  // TESTE 5: Nenhuma Conta Encontrada com Sugestão de Pré-Preenchimento
  // -------------------------------------------------------------
  console.log('\n--- TESTE 5: Nenhuma Conta Encontrada ---');
  const resNenhuma = resolverConta(extratoOfx, [contaSicoob, contaBradesco]);
  asserir(resNenhuma.tipo === 'nenhuma', 'Retorna tipo "nenhuma" quando não há conta Santander cadastrada');
  if (resNenhuma.tipo === 'nenhuma') {
    asserir(resNenhuma.sugestao.banco_codigo === '033', `Sugestão banco_codigo: ${resNenhuma.sugestao.banco_codigo}`);
    asserir(resNenhuma.sugestao.banco_nome === 'Santander', `Sugestão banco_nome: ${resNenhuma.sugestao.banco_nome}`);
    asserir(resNenhuma.sugestao.agencia === '3749', `Sugestão agência: ${resNenhuma.sugestao.agencia}`);
    asserir(resNenhuma.sugestao.numero_conta === '130046964', `Sugestão conta: ${resNenhuma.sugestao.numero_conta}`);
  }

  console.log('\n================================================================');
  console.log(` RESULTADO RESOLVER CONTA: ${passou} PASSOU / ${falhou} FALHOU`);
  console.log('================================================================');

  if (falhou > 0) {
    process.exit(1);
  }
}

executarTestes().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
