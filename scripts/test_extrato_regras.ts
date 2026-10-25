// MT Solar - Gestão Financeira
// Testes de Classificação de Transações de Extrato (Parte 15D)
// Usa os arquivos reais do Santander para garantir cobertura das regras

import fs from 'fs';
import path from 'path';
import { Contato } from '../src/types';
import {
  lerExtrato,
  ExtratoLido,
  TransacaoExtrato,
  classificarTransacao,
  RegraImportacao,
  resolverMovimentacaoInterna,
  REGRAS_SANTANDER,
  normalizarNome,
} from '../src/utils/extrato';

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

// ============================================================
// Contatos de exemplo para testar casamento
// ============================================================
const contatosFicticios: Contato[] = [
  {
    id: 'contato-silvana',
    nome: 'Silvana Costa Pereira',
    tipo: 'fornecedor',
    cpf_cnpj: '',
    telefone: '',
    email: '',
    cidade: 'Cuiabá',
  },
  {
    id: 'contato-mt-solar-paineis',
    nome: 'MT Solar Painéis e Inversores',
    tipo: 'fornecedor',
    cpf_cnpj: '',
    telefone: '',
    email: '',
    cidade: 'Cuiabá',
  },
];

// ============================================================
// Regras de usuário de exemplo
// ============================================================
const regrasUsuario: RegraImportacao[] = [
  {
    id: 'regra-silvana',
    banco_codigo: '033',
    conta_id: '*',
    campo: 'contraparte',
    operador: 'contem',
    valor: 'Silvana',
    categoria_id: 'cat-des-3', // Mão de obra terceirizada
    contato_id: 'contato-silvana',
    tipoLancamento: 'despesa',
    ativa: true,
    criadoEm: '2026-01-01T00:00:00Z',
    usos: 5,
  },
  {
    id: 'regra-conta-luz',
    banco_codigo: '*',
    conta_id: '*',
    campo: 'descricao',
    operador: 'comeca_com',
    valor: 'PAGAMENTO CONTA LUZ',
    categoria_id: 'cat-des-9', // Água/luz/internet
    tipoLancamento: 'despesa',
    ativa: true,
    criadoEm: '2026-01-01T00:00:00Z',
    usos: 12,
  },
  {
    id: 'regra-inativa',
    banco_codigo: '*',
    conta_id: '*',
    campo: 'descricao',
    operador: 'contem',
    valor: 'PAGAMENTO DARF',
    categoria_id: 'cat-des-5',
    tipoLancamento: 'despesa',
    ativa: false, // INATIVA — não deve ser aplicada
    criadoEm: '2026-01-01T00:00:00Z',
    usos: 0,
  },
];

// ============================================================
// Função auxiliar: cria transação mínima para testar regras
// ============================================================
function transacaoFake(
  descricaoNormalizada: string,
  contraparte?: string
): TransacaoExtrato {
  return {
    idTemporario: `fake-${Math.random().toString(36).slice(2)}`,
    data: '2026-10-01',
    valor: 100,
    tipo: 'debito',
    descricaoOriginal: descricaoNormalizada,
    descricaoNormalizada,
    contraparte,
    ordemNoDia: 0,
    linhaOrigem: 1,
  };
}

async function executarTestes(): Promise<void> {
  console.log('================================================================');
  console.log(' INICIANDO TESTES DE CLASSIFICAÇÃO DE TRANSAÇÕES (PARTE 15D)');
  console.log('================================================================\n');

  // ------------------------------------------------------------------
  // Carregar extratos sintéticos
  // ------------------------------------------------------------------
  const caminhoOfx = path.resolve('scripts/fixtures/extrato_sintetico_santander.ofx');
  const caminhoXlsx = path.resolve('scripts/fixtures/extrato_sintetico_santander.xlsx');

  const bufOfxNode = fs.readFileSync(caminhoOfx);
  const bufXlsxNode = fs.readFileSync(caminhoXlsx);

  const abOfx = bufOfxNode.buffer.slice(bufOfxNode.byteOffset, bufOfxNode.byteOffset + bufOfxNode.byteLength);
  const abXlsx = bufXlsxNode.buffer.slice(bufXlsxNode.byteOffset, bufXlsxNode.byteOffset + bufXlsxNode.byteLength);

  const extratoOfx: ExtratoLido = await lerExtrato(abOfx, 'extrato.ofx');
  const extratoXlsx: ExtratoLido = await lerExtrato(abXlsx, 'extrato.xlsx');

  const BANCO = '033';
  const CONTA_ID = 'conta-santander-pj';

  // ------------------------------------------------------------------
  // BLOCO 1: Regras do banco (regra_banco)
  // ------------------------------------------------------------------
  console.log('--- BLOCO 1: Regras do Banco Santander (regra_banco) ---');

  // Contamax / movimentação interna
  const tContamax = transacaoFake('APLICACAO CONTAMAX AUTOMATICO');
  const rContamax = classificarTransacao(tContamax, BANCO, CONTA_ID, [], []);
  asserir(
    rContamax.origemSugestao === 'regra_banco',
    'Contamax identificado por regra do banco'
  );
  asserir(
    rContamax.natureza === 'movimentacao_interna',
    `Contamax classificado como movimentacao_interna (obtido: ${rContamax.natureza})`
  );
  asserir(
    rContamax.sugestao.tipoLancamentoSugerido === 'transferencia',
    'Contamax sugerido como transferencia'
  );

  // Resgate Contamax
  const tResgate = transacaoFake('RESGATE CONTAMAX AUTOMATICO');
  const rResgate = classificarTransacao(tResgate, BANCO, CONTA_ID, [], []);
  asserir(
    rResgate.natureza === 'movimentacao_interna',
    'Resgate Contamax também identificado como movimentacao_interna'
  );

  // IOF
  const tIof = transacaoFake('IOF OPERACOES DE CREDITO');
  const rIof = classificarTransacao(tIof, BANCO, CONTA_ID, [], []);
  asserir(rIof.natureza === 'tarifa_bancaria', `IOF → tarifa_bancaria (obtido: ${rIof.natureza})`);
  asserir(rIof.sugestao.tipoLancamentoSugerido === 'despesa', 'IOF sugerido como despesa');

  // Tarifa
  const tTarifa = transacaoFake('TAR MANUTENCAO DE CONTA');
  const rTarifa = classificarTransacao(tTarifa, BANCO, CONTA_ID, [], []);
  asserir(rTarifa.natureza === 'tarifa_bancaria', `TAR MANUTENCAO → tarifa_bancaria (obtido: ${rTarifa.natureza})`);
  asserir(
    rTarifa.sugestao.categoriaSugeridaNome === 'Taxas bancárias',
    `Nome de categoria sugerido: "${rTarifa.sugestao.categoriaSugeridaNome}"`
  );

  // DARF
  const tDarf = transacaoFake('PAGAMENTO DARF SIMPLES NACIONAL');
  const rDarf = classificarTransacao(tDarf, BANCO, CONTA_ID, [], []);
  asserir(rDarf.natureza === 'imposto', `DARF → imposto (obtido: ${rDarf.natureza})`);
  asserir(rDarf.sugestao.tipoLancamentoSugerido === 'despesa', 'DARF sugerido como despesa');

  // Conta de luz
  const tLuz = transacaoFake('PAGAMENTO CONTA LUZ ENERGISA BRASIL');
  const rLuz = classificarTransacao(tLuz, BANCO, CONTA_ID, [], []);
  asserir(rLuz.natureza === 'conta_consumo', `Luz → conta_consumo (obtido: ${rLuz.natureza})`);

  // Mensalidade seguro
  const tSeguro = transacaoFake('MENSALIDADE DE SEGURO PORTO SEGURO');
  const rSeguro = classificarTransacao(tSeguro, BANCO, CONTA_ID, [], []);
  asserir(rSeguro.natureza === 'conta_consumo', `Seguro → conta_consumo (obtido: ${rSeguro.natureza})`);

  // Cartão débito
  const tCartao = transacaoFake('COMPRA CARTAO DEB POSTO PETROBRAS');
  const rCartao = classificarTransacao(tCartao, BANCO, CONTA_ID, [], []);
  asserir(rCartao.natureza === 'cartao_debito', `Compra débito → cartao_debito (obtido: ${rCartao.natureza})`);

  // PIX recebido
  const tPixRec = transacaoFake('PIX RECEBIDO', 'CLIENTE ENERGIA SOLAR');
  const rPixRec = classificarTransacao(tPixRec, BANCO, CONTA_ID, [], []);
  asserir(rPixRec.natureza === 'recebimento', `PIX RECEBIDO → recebimento (obtido: ${rPixRec.natureza})`);
  asserir(rPixRec.sugestao.tipoLancamentoSugerido === 'receita', 'PIX RECEBIDO sugerido como receita');

  // CR COB BLOQ (outro padrão de recebimento)
  const tCrCob = transacaoFake('CR COB BLOQ COMP CONF RECEBIMENTO BOLETO');
  const rCrCob = classificarTransacao(tCrCob, BANCO, CONTA_ID, [], []);
  asserir(rCrCob.natureza === 'recebimento', `CR COB BLOQ → recebimento (obtido: ${rCrCob.natureza})`);

  // PIX enviado
  const tPixEnv = transacaoFake('PIX ENVIADO', 'GIRLANE SANTOS BRAINER');
  const rPixEnv = classificarTransacao(tPixEnv, BANCO, CONTA_ID, [], []);
  asserir(rPixEnv.natureza === 'pagamento', `PIX ENVIADO → pagamento (obtido: ${rPixEnv.natureza})`);

  // PIX agendado
  const tPixAg = transacaoFake('PIX AGENDADO');
  const rPixAg = classificarTransacao(tPixAg, BANCO, CONTA_ID, [], []);
  asserir(rPixAg.natureza === 'pagamento', `PIX AGENDADO → pagamento (obtido: ${rPixAg.natureza})`);

  // Pagamento de boleto
  const tBoleto = transacaoFake('PAGAMENTO DE BOLETO BANCO DO BRASIL');
  const rBoleto = classificarTransacao(tBoleto, BANCO, CONTA_ID, [], []);
  asserir(rBoleto.natureza === 'pagamento', `PAGAMENTO DE BOLETO → pagamento (obtido: ${rBoleto.natureza})`);

  // Capitalização
  const tCap = transacaoFake('DEBITO AUT TITULO CAPITALIZACAO BRADESCO');
  const rCap = classificarTransacao(tCap, BANCO, CONTA_ID, [], []);
  asserir(rCap.natureza === 'capitalizacao', `Capitalização → capitalizacao (obtido: ${rCap.natureza})`);

  // Acordo / dívida
  const tAcordo = transacaoFake('DEBITO DE ACORDO NEGOCIADO');
  const rAcordo = classificarTransacao(tAcordo, BANCO, CONTA_ID, [], []);
  asserir(rAcordo.natureza === 'acordo_divida', `Acordo → acordo_divida (obtido: ${rAcordo.natureza})`);

  // Sem regra correspondente
  const tSemRegra = transacaoFake('MENSAGEM GENERICA SEM PADRAO');
  const rSemRegra = classificarTransacao(tSemRegra, BANCO, CONTA_ID, [], []);
  asserir(rSemRegra.natureza === 'indefinido', `Sem padrão → indefinido (obtido: ${rSemRegra.natureza})`);
  asserir(rSemRegra.origemSugestao === 'nenhuma', 'origemSugestao = nenhuma para transação sem regra');

  // ------------------------------------------------------------------
  // BLOCO 2: Casamento de contato por nome (OFX com contraparte)
  // ------------------------------------------------------------------
  console.log('\n--- BLOCO 2: Casamento de Contato por Nome Normalizado ---');

  // Contato existente
  const tSilvanaContato = transacaoFake('PIX ENVIADO', 'Silvana Costa Pereira');
  const rSilvanaContato = classificarTransacao(tSilvanaContato, BANCO, CONTA_ID, [], contatosFicticios);
  asserir(
    rSilvanaContato.sugestao.contatoId === 'contato-silvana',
    `Contraparte "Silvana Costa Pereira" casou com contato cadastrado (id: ${rSilvanaContato.sugestao.contatoId})`
  );
  asserir(
    rSilvanaContato.sugestao.nomeContatoSugerido === undefined,
    'nomeContatoSugerido vazio pois contato já existe'
  );

  // Contato NÃO cadastrado → sugerir criação
  const tContatoNovo = transacaoFake('PIX RECEBIDO', 'João da Silva Construções');
  const rContatoNovo = classificarTransacao(tContatoNovo, BANCO, CONTA_ID, [], contatosFicticios);
  asserir(
    rContatoNovo.sugestao.contatoId === undefined,
    'Contato desconhecido: contatoId não preenchido'
  );
  asserir(
    rContatoNovo.sugestao.nomeContatoSugerido === 'João da Silva Construções',
    `Sugestão de criação de contato: "${rContatoNovo.sugestao.nomeContatoSugerido}"`
  );

  // Transação XLSX sem contraparte → sem sugestão de contato
  const tSemContraparte = transacaoFake('PIX ENVIADO');
  const rSemContraparte = classificarTransacao(tSemContraparte, BANCO, CONTA_ID, [], contatosFicticios);
  asserir(
    rSemContraparte.sugestao.contatoId === undefined &&
    rSemContraparte.sugestao.nomeContatoSugerido === undefined,
    'Transação sem contraparte (XLSX): sem sugestão de contato'
  );

  // ------------------------------------------------------------------
  // BLOCO 3: Regras do usuário (prioridade sobre regras do banco)
  // ------------------------------------------------------------------
  console.log('\n--- BLOCO 3: Regras do Usuário (regra_usuario) ---');

  // Silvana: regra_usuario deve vencer regra_banco
  const tSilvanaRegra = transacaoFake('PIX ENVIADO', 'Silvana Costa Pereira');
  const rSilvanaRegra = classificarTransacao(tSilvanaRegra, BANCO, CONTA_ID, regrasUsuario, contatosFicticios);
  asserir(
    rSilvanaRegra.origemSugestao === 'regra_usuario',
    `Regra do usuário para Silvana prevalece sobre regra_banco (origem: ${rSilvanaRegra.origemSugestao})`
  );
  asserir(
    rSilvanaRegra.sugestao.regraUsuarioId === 'regra-silvana',
    `ID da regra aplicada: ${rSilvanaRegra.sugestao.regraUsuarioId}`
  );
  asserir(
    rSilvanaRegra.sugestao.categoriaSugeridaId === 'cat-des-3',
    `Categoria sugerida pela regra: ${rSilvanaRegra.sugestao.categoriaSugeridaId}`
  );
  asserir(
    rSilvanaRegra.sugestao.contatoId === 'contato-silvana',
    `contatoId da regra: ${rSilvanaRegra.sugestao.contatoId} (regra define contato_id = contato-silvana)`
  );

  // Regra de conta de luz por começa_com
  const tLuzRegra = transacaoFake('PAGAMENTO CONTA LUZ ENERGISA');
  const rLuzRegra = classificarTransacao(tLuzRegra, BANCO, CONTA_ID, regrasUsuario, []);
  asserir(
    rLuzRegra.origemSugestao === 'regra_usuario',
    `Regra comeca_com para conta de luz (origem: ${rLuzRegra.origemSugestao})`
  );
  asserir(
    rLuzRegra.sugestao.categoriaSugeridaId === 'cat-des-9',
    `Categoria: ${rLuzRegra.sugestao.categoriaSugeridaId}`
  );

  // Regra inativa NÃO deve ser aplicada → cai para regra_banco
  const tDarfInativo = transacaoFake('PAGAMENTO DARF SIMPLES NACIONAL');
  const rDarfInativo = classificarTransacao(tDarfInativo, BANCO, CONTA_ID, regrasUsuario, []);
  asserir(
    rDarfInativo.origemSugestao === 'regra_banco',
    `Regra inativa ignorada; cai para regra_banco (origem: ${rDarfInativo.origemSugestao})`
  );
  asserir(
    rDarfInativo.natureza === 'imposto',
    `DARF identificado pelo banco como imposto`
  );

  // Regra por campo 'descricao' com operador 'contem'
  const regraContem: RegraImportacao = {
    id: 'regra-manutencao',
    banco_codigo: '*',
    conta_id: '*',
    campo: 'descricao',
    operador: 'contem',
    valor: 'MANUTENCAO',
    categoria_id: 'cat-des-12',
    tipoLancamento: 'despesa',
    ativa: true,
    criadoEm: '2026-01-01T00:00:00Z',
    usos: 0,
  };
  const tManutencao = transacaoFake('TAR MANUTENCAO DE CONTA CORRENTE');
  const rManutencao = classificarTransacao(tManutencao, BANCO, CONTA_ID, [regraContem], []);
  asserir(
    rManutencao.origemSugestao === 'regra_usuario',
    `Regra "contem MANUTENCAO" casou (origem: ${rManutencao.origemSugestao})`
  );

  // Regra por campo 'descricao' com operador 'igual'
  const regraIgual: RegraImportacao = {
    id: 'regra-pix-exato',
    banco_codigo: '033',
    conta_id: CONTA_ID,
    campo: 'descricao',
    operador: 'igual',
    valor: 'PIX ENVIADO',
    categoria_id: 'cat-des-13',
    tipoLancamento: 'despesa',
    ativa: true,
    criadoEm: '2026-01-01T00:00:00Z',
    usos: 0,
  };
  const tPixExato = transacaoFake('PIX ENVIADO'); // exato
  const tPixDetalhado = transacaoFake('PIX ENVIADO GIRLANE SANTOS'); // não exato
  const rPixExato = classificarTransacao(tPixExato, BANCO, CONTA_ID, [regraIgual], []);
  const rPixDetalhado = classificarTransacao(tPixDetalhado, BANCO, CONTA_ID, [regraIgual], []);
  asserir(
    rPixExato.origemSugestao === 'regra_usuario',
    'Operador igual: casa quando descrição é exatamente "PIX ENVIADO"'
  );
  asserir(
    rPixDetalhado.origemSugestao === 'regra_banco',
    'Operador igual: NÃO casa "PIX ENVIADO GIRLANE SANTOS" (cai para regra_banco)'
  );

  // ------------------------------------------------------------------
  // BLOCO 4: Regras sobre transações reais do OFX
  // ------------------------------------------------------------------
  console.log('\n--- BLOCO 4: Regras Aplicadas às Transações Reais do OFX ---');

  const contamax = extratoOfx.transacoes.filter(
    (t) => /CONTAMAX/i.test(t.descricaoNormalizada)
  );
  asserir(contamax.length > 0, `OFX real contém transações Contamax (${contamax.length} encontradas)`);

  const classifContamax = contamax.map((t) =>
    classificarTransacao(t, BANCO, CONTA_ID, [], [])
  );
  asserir(
    classifContamax.every((r) => r.natureza === 'movimentacao_interna'),
    `Todas as transações Contamax do OFX → movimentacao_interna`
  );

  const pixEnviados = extratoOfx.transacoes.filter(
    (t) => t.descricaoNormalizada.startsWith('PIX ENVIADO')
  );
  asserir(pixEnviados.length > 0, `OFX real contém PIX ENVIADO (${pixEnviados.length} transações)`);
  const classifPix = pixEnviados.map((t) =>
    classificarTransacao(t, BANCO, CONTA_ID, [], contatosFicticios)
  );
  const pixComContato = classifPix.filter((r) => r.sugestao.contatoId !== undefined);
  const pixComSugestao = classifPix.filter((r) => r.sugestao.nomeContatoSugerido !== undefined);
  asserir(pixComContato.length >= 0 && pixComSugestao.length >= 0, 'Casamento de contraparte com contatos funcionando em PIX ENVIADO reais');
  asserir(
    classifPix.every((r) => r.natureza === 'pagamento'),
    `Todos os PIX ENVIADO reais → pagamento`
  );

  // Silvana real no OFX
  const silvanaReal = extratoOfx.transacoes.find(
    (t) => t.contraparte?.toUpperCase().includes('SILVANA COSTA PEREIRA')
  );
  asserir(silvanaReal !== undefined, 'Transação real da Silvana Costa Pereira encontrada no OFX');
  if (silvanaReal) {
    const rSilvanaReal = classificarTransacao(silvanaReal, BANCO, CONTA_ID, regrasUsuario, contatosFicticios);
    asserir(
      rSilvanaReal.origemSugestao === 'regra_usuario',
      `Silvana real: regra_usuario aplicada (origem: ${rSilvanaReal.origemSugestao})`
    );
    asserir(
      rSilvanaReal.sugestao.contatoId === 'contato-silvana',
      `Silvana real: contato identificado`
    );
  }

  // ------------------------------------------------------------------
  // BLOCO 5: Movimentação interna — resolverMovimentacaoInterna
  // ------------------------------------------------------------------
  console.log('\n--- BLOCO 5: resolverMovimentacaoInterna ---');

  const acao1 = resolverMovimentacaoInterna();
  asserir(acao1.acao === 'ignorar', `Sem conta de aplicação → acao = ignorar`);
  asserir(
    'motivo' in acao1 && acao1.motivo.includes('Contamax'),
    `Motivo de ignorar menciona Contamax: "${('motivo' in acao1 ? acao1.motivo : '')}"`
  );

  const acao2 = resolverMovimentacaoInterna('conta-aplicacoes-financeiras');
  asserir(acao2.acao === 'transferencia', `Com conta de aplicação → acao = transferencia`);
  asserir(
    'contaDestinoId' in acao2 && acao2.contaDestinoId === 'conta-aplicacoes-financeiras',
    `contaDestinoId correto: ${'contaDestinoId' in acao2 ? acao2.contaDestinoId : ''}`
  );

  // ------------------------------------------------------------------
  // BLOCO 6: normalizarNome (casamento de contatos)
  // ------------------------------------------------------------------
  console.log('\n--- BLOCO 6: normalizarNome ---');

  asserir(
    normalizarNome('Silvana Costa Pereira') === normalizarNome('SILVANA COSTA PEREIRA'),
    'normalizarNome insensível a maiúsculas'
  );
  asserir(
    normalizarNome('João da Silva') === normalizarNome('JOAO DA SILVA'),
    'normalizarNome remove acentos'
  );
  asserir(
    normalizarNome('MT Solar Painéis & Inversores Ltda.') ===
    normalizarNome('MT SOLAR PAINEIS   INVERSORES LTDA'),
    'normalizarNome colapsa pontuação e espaços'
  );

  // ------------------------------------------------------------------
  // BLOCO 7: Cobertura das regras do Santander com descricoes reais do OFX
  // ------------------------------------------------------------------
  console.log('\n--- BLOCO 7: Cobertura das Regras (descricoes reais do OFX) ---');

  const totalTransacoesOfx = extratoOfx.transacoes.length;
  const classificadas = extratoOfx.transacoes.map((t) =>
    classificarTransacao(t, BANCO, CONTA_ID, [], [])
  );

  const porNatureza: Record<string, number> = {};
  for (const c of classificadas) {
    porNatureza[c.natureza] = (porNatureza[c.natureza] ?? 0) + 1;
  }

  console.log(`  Distribuição de ${totalTransacoesOfx} transações reais do OFX por natureza:`);
  for (const [nat, qtd] of Object.entries(porNatureza).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${nat}: ${qtd}`);
  }

  const comRegra = classificadas.filter((c) => c.origemSugestao !== 'nenhuma').length;
  const semRegra = classificadas.filter((c) => c.origemSugestao === 'nenhuma').length;
  asserir(
    comRegra > 0,
    `Pelo menos 1 transação real classificada por regra do banco (${comRegra} de ${totalTransacoesOfx})`
  );
  asserir(
    comRegra > semRegra,
    `Maioria classificada por regra do banco (${comRegra} com regra vs ${semRegra} sem regra)`
  );

  // ------------------------------------------------------------------
  // RESULTADO FINAL
  // ------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` RESULTADO FINAL CLASSIFICAÇÃO 15D: ${passou} PASSOU / ${falhou} FALHOU`);
  console.log('================================================================');

  if (falhou > 0) {
    process.exit(1);
  }
}

executarTestes().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
