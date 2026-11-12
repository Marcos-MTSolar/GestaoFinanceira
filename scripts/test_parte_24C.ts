// MT Solar - Gestão Financeira
// Suíte de Testes da PARTE 24C — Regras Sicoob e Sugestão de Categoria Inteligente
// Dados 100% fictícios conforme diretrizes do projeto

import { TransacaoExtrato } from '../src/utils/extrato/tipos';
import { classificarTransacao, RegraImportacao } from '../src/utils/extrato/classificarTransacao';
import { sugerirCategoria } from '../src/utils/extrato/sugerirCategoria';
import { inferirFormaPagamento } from '../src/utils/extrato/inferirFormaPagamento';
import { Categoria, Contato, Lancamento } from '../src/types';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHA: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log('🧪 Iniciando testes da PARTE 24C — Regras Sicoob e Sugestão de Categoria\n');

  // ---------------------------------------------------------------------------
  // C1: Novas Regras Sicoob (ordem MSM antes de PIX EMIT, títulos, etc.)
  // ---------------------------------------------------------------------------
  console.log('--- C1: Regras do Sicoob (banco 756) e Inferência de Forma de Pagamento ---');

  // 1. PIX.EMIT.OUT IF-MSM -> transferencia_propria
  const tMsm: TransacaoExtrato = {
    idTemporario: 't-msm',
    data: '2026-11-10',
    descricaoOriginal: 'PIX.EMIT.OUT IF-MSM',
    descricaoNormalizada: 'PIX EMIT OUT IF MSM',
    valor: 500,
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 1,
  };
  const resMsm = classificarTransacao(tMsm, '756', 'conta-1', [], []);
  assert(resMsm.natureza === 'transferencia_propria', 'PIX.EMIT.OUT IF-MSM classificado como transferencia_propria');
  assert(inferirFormaPagamento(tMsm.descricaoNormalizada, resMsm.natureza) === 'PIX', 'Forma de pagamento inferida para PIX MSM é PIX (ou transferencia se natureza prevalecer)');

  // 2. PIX EMIT.OUTRA IF -> pagamento / despesa
  const tPixEmit: TransacaoExtrato = {
    idTemporario: 't-emit',
    data: '2026-11-10',
    descricaoOriginal: 'PIX EMIT.OUTRA IF',
    descricaoNormalizada: 'PIX EMIT OUTRA IF',
    valor: 250,
    tipo: 'debito',
    ordemNoDia: 1,
    linhaOrigem: 2,
  };
  const resPixEmit = classificarTransacao(tPixEmit, '756', 'conta-1', [], []);
  assert(resPixEmit.natureza === 'pagamento', 'PIX EMIT.OUTRA IF classificado como pagamento');
  assert(resPixEmit.sugestao.tipoLancamentoSugerido === 'despesa', 'PIX EMIT.OUTRA IF sugerido como despesa');

  // 3. PIX RECEB.OUTRA IF -> recebimento / receita
  const tPixReceb: TransacaoExtrato = {
    idTemporario: 't-receb',
    data: '2026-11-10',
    descricaoOriginal: 'PIX RECEB.OUTRA IF',
    descricaoNormalizada: 'PIX RECEB OUTRA IF',
    valor: 1200,
    tipo: 'credito',
    ordemNoDia: 2,
    linhaOrigem: 3,
  };
  const resPixReceb = classificarTransacao(tPixReceb, '756', 'conta-1', [], []);
  assert(resPixReceb.natureza === 'recebimento', 'PIX RECEB.OUTRA IF classificado como recebimento');
  assert(resPixReceb.sugestao.tipoLancamentoSugerido === 'receita', 'PIX RECEB.OUTRA IF sugerido como receita');

  // 4. DB.TR.C.DIF.TIT.INT -> pagamento / despesa
  const tDbTr: TransacaoExtrato = {
    idTemporario: 't-dbtr',
    data: '2026-11-10',
    descricaoOriginal: 'DB.TR.C.DIF.TIT.INT',
    descricaoNormalizada: 'DB TR C DIF TIT INT',
    contraparte: 'FORNECEDOR FICTICIO LTDA',
    valor: 350,
    tipo: 'debito',
    ordemNoDia: 3,
    linhaOrigem: 4,
  };
  const resDbTr = classificarTransacao(tDbTr, '756', 'conta-1', [], []);
  assert(resDbTr.natureza === 'pagamento', 'DB.TR.C.DIF.TIT.INT classificado como pagamento');

  // 5. DÉB.TIT.COMPE.EFETI -> pagamento de título / despesa e forma de pagamento boleto
  const tDebTit: TransacaoExtrato = {
    idTemporario: 't-debtit',
    data: '2026-11-10',
    descricaoOriginal: 'DÉB.TIT.COMPE.EFETI',
    descricaoNormalizada: 'DEB TIT COMPE EFETI',
    valor: 68.17,
    tipo: 'debito',
    ordemNoDia: 4,
    linhaOrigem: 5,
  };
  const resDebTit = classificarTransacao(tDebTit, '756', 'conta-1', [], []);
  assert(resDebTit.natureza === 'pagamento', 'DÉB.TIT.COMPE.EFETI classificado como pagamento');
  assert(inferirFormaPagamento(tDebTit.descricaoNormalizada, resDebTit.natureza) === 'boleto', 'inferirFormaPagamento retorna "boleto" para DEB TIT COMPE EFETI');

  // Isolamento de banco: no Santander (033), PIX.EMIT.OUT IF-MSM não gera regra sicoob
  const resSantander = classificarTransacao(tMsm, '033', 'conta-1', [], []);
  assert(resSantander.natureza === 'indefinido', 'Isolamento garantido: PIX.EMIT.OUT IF-MSM permanece indefinido no Santander 033');

  console.log('✅ C1 passou com sucesso.\n');

  // ---------------------------------------------------------------------------
  // C2: Sugestão de Categoria com Precedência Rigorosa (5 níveis)
  // ---------------------------------------------------------------------------
  console.log('--- C2: Precedência de Sugestão de Categoria ---');

  const categoriasFicticias: Categoria[] = [
    { id: 'cat-alim', nome: 'Alimentação e Refeições', tipo: 'despesa', cor: '#CA8A04', padrao: false, criado_em: '2026-01-01' },
    { id: 'cat-comb', nome: 'Combustível Frota', tipo: 'despesa', cor: '#EA580C', padrao: false, criado_em: '2026-01-01' },
    { id: 'cat-serv', nome: 'Prestação de Serviços', tipo: 'receita', cor: '#16A34A', padrao: false, criado_em: '2026-01-01' },
    { id: 'cat-taxas', nome: 'Taxas Bancárias', tipo: 'despesa', cor: '#DC2626', padrao: false, criado_em: '2026-01-01' },
    { id: 'cat-geral', nome: 'Outras Despesas', tipo: 'despesa', cor: '#475569', padrao: false, criado_em: '2026-01-01' },
  ];

  const contatosFicticios: Contato[] = [
    {
      id: 'cont-1',
      nome: 'Posto Fictício Estrela Ltda',
      cpf_cnpj: '11.357.423/0001-80',
      telefone: '(11) 9999-0001',
      email: 'posto@ficticio.com',
      cidade: 'Cuiabá',
      tipo: 'fornecedor',
      categoria_padrao_id: 'cat-comb',
    } as any,
    {
      id: 'cont-2',
      nome: 'Marcos Prestador Individual',
      cpf_cnpj: '123.791.454-99',
      telefone: '(11) 9999-0002',
      email: 'marcos@ficticio.com',
      cidade: 'Cuiabá',
      tipo: 'fornecedor',
      categoria_padrao_id: 'cat-serv',
    } as any
  ];

  // NÍVEL 1: Regra do Usuário
  const regraMsg: RegraImportacao = {
    id: 'reg-1',
    banco_codigo: '*',
    conta_id: '*',
    campo: 'mensagem',
    operador: 'contem',
    valor: 'ALMOCO',
    categoria_id: 'cat-alim',
    tipoLancamento: 'despesa',
    ativa: true,
    criadoEm: '2026-01-01',
    usos: 3
  };

  const tNivel1: TransacaoExtrato = {
    idTemporario: 't-1',
    data: '2026-11-10',
    descricaoOriginal: 'PIX EMIT.OUTRA IF',
    descricaoNormalizada: 'PIX EMIT OUTRA IF',
    mensagemUsuario: 'almoco da equipe de obras',
    valor: 150,
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 1,
  };

  const sugNivel1 = sugerirCategoria({
    transacao: tNivel1,
    bancoCodigo: '756',
    contaId: 'conta-1',
    categorias: categoriasFicticias,
    regrasUsuario: [regraMsg],
    contatos: contatosFicticios
  });
  assert(sugNivel1.origemSugestao === 'regra_usuario', 'Nível 1: Sugestão por Regra do Usuário');
  assert(sugNivel1.categoriaId === 'cat-alim', 'Nível 1: Categoria Alimentação casada pela mensagem');
  assert(Boolean(sugNivel1.rotuloBadge?.includes('regra') || sugNivel1.rotuloBadge?.includes('mensagem')), 'Nível 1: Badge informativo');

  // NÍVEL 2: Contato por Documento Completo e CPF Mascarado
  const tNivel2Cnpj: TransacaoExtrato = {
    idTemporario: 't-2a',
    data: '2026-11-10',
    descricaoOriginal: 'PIX EMIT.OUTRA IF',
    descricaoNormalizada: 'PIX EMIT OUTRA IF',
    contraparteDocumento: '11.357.423 0001-80', // Documento com espaço comum no parser Sicoob
    valor: 200,
    tipo: 'debito',
    ordemNoDia: 1,
    linhaOrigem: 2,
  };
  const sugNivel2Cnpj = sugerirCategoria({
    transacao: tNivel2Cnpj,
    bancoCodigo: '756',
    contaId: 'conta-1',
    categorias: categoriasFicticias,
    regrasUsuario: [],
    contatos: contatosFicticios
  });
  assert(sugNivel2Cnpj.origemSugestao === 'contato', 'Nível 2A: Sugestão por Contato via CNPJ normalizado');
  assert(sugNivel2Cnpj.categoriaId === 'cat-comb', 'Nível 2A: Categoria habitual Combustível');
  assert(sugNivel2Cnpj.contatoId === 'cont-1', 'Nível 2A: Contato ID vinculado');

  // NÍVEL 2B: CPF mascarado "***.791.454-**" casa unicamente com "123.791.454-99"
  const tNivel2Cpf: TransacaoExtrato = {
    idTemporario: 't-2b',
    data: '2026-11-10',
    descricaoOriginal: 'PIX RECEB.OUTRA IF',
    descricaoNormalizada: 'PIX RECEB OUTRA IF',
    contraparteDocumento: '***.791.454-**',
    valor: 300,
    tipo: 'credito',
    ordemNoDia: 2,
    linhaOrigem: 3,
  };
  const sugNivel2Cpf = sugerirCategoria({
    transacao: tNivel2Cpf,
    bancoCodigo: '756',
    contaId: 'conta-1',
    categorias: categoriasFicticias,
    regrasUsuario: [],
    contatos: contatosFicticios
  });
  assert(sugNivel2Cpf.origemSugestao === 'contato', 'Nível 2B: CPF mascarado casou com contato único');
  assert(sugNivel2Cpf.categoriaId === 'cat-serv', 'Nível 2B: Categoria de serviços associada');

  // NÍVEL 3: Histórico de lançamentos passados (mínimo 60% de frequência)
  const historicoFicticio: Lancamento[] = [
    {
      id: 'l-1',
      descricao: 'PIX - Reforma escritorio',
      observacoes: 'MENSAGEM: reforma escritorio',
      categoria_id: 'cat-alim',
      tipo: 'despesa',
      valor: 100,
      data_vencimento: '2026-10-01',
      data_pagamento: '2026-10-01',
      conta_id: 'conta-1',
      forma_pagamento: 'PIX',
      status: 'pago'
    } as any,
    {
      id: 'l-2',
      descricao: 'PIX - Reforma escritorio',
      observacoes: 'MENSAGEM: reforma escritorio',
      categoria_id: 'cat-alim',
      tipo: 'despesa',
      valor: 120,
      data_vencimento: '2026-10-05',
      data_pagamento: '2026-10-05',
      conta_id: 'conta-1',
      forma_pagamento: 'PIX',
      status: 'pago'
    } as any,
    {
      id: 'l-3',
      descricao: 'PIX - Reforma escritorio',
      observacoes: 'MENSAGEM: reforma escritorio',
      categoria_id: 'cat-geral',
      tipo: 'despesa',
      valor: 110,
      data_vencimento: '2026-10-10',
      data_pagamento: '2026-10-10',
      conta_id: 'conta-1',
      forma_pagamento: 'PIX',
      status: 'pago'
    } as any
  ];

  const tNivel3: TransacaoExtrato = {
    idTemporario: 't-3',
    data: '2026-11-10',
    descricaoOriginal: 'PIX EMIT.OUTRA IF',
    descricaoNormalizada: 'PIX EMIT OUTRA IF',
    mensagemUsuario: 'reforma escritorio',
    valor: 115,
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 1,
  };
  const sugNivel3 = sugerirCategoria({
    transacao: tNivel3,
    bancoCodigo: '756',
    contaId: 'conta-1',
    categorias: categoriasFicticias,
    regrasUsuario: [],
    contatos: [],
    historicoLancamentos: historicoFicticio
  });
  assert(sugNivel3.origemSugestao === 'historico', 'Nível 3: Sugestão por Histórico com frequência >= 60% (2/3 = 66%)');
  assert(sugNivel3.categoriaId === 'cat-alim', 'Nível 3: Categoria mais frequente selecionada');

  // NÍVEL 4: Palavras-chave ("gasolina", "diesel", "almoco", etc.) em categorias EXISTENTES
  const tNivel4: TransacaoExtrato = {
    idTemporario: 't-4',
    data: '2026-11-10',
    descricaoOriginal: 'PIX EMIT.OUTRA IF',
    descricaoNormalizada: 'PIX EMIT OUTRA IF',
    mensagemUsuario: 'abastecimento diesel caminhao',
    valor: 450,
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 1,
  };
  const sugNivel4 = sugerirCategoria({
    transacao: tNivel4,
    bancoCodigo: '756',
    contaId: 'conta-1',
    categorias: categoriasFicticias,
    regrasUsuario: [],
    contatos: [],
    historicoLancamentos: []
  });
  assert(sugNivel4.origemSugestao === 'palavra_chave', 'Nível 4: Palavra-chave detectada na mensagem');
  assert(sugNivel4.categoriaId === 'cat-comb', 'Nível 4: Casou com categoria existente "Combustível Frota"');

  // NÍVEL 4 (Regra de Segurança): Se categoria correspondente NÃO existir, palavra-chave não sugere nada
  // Usamos banco '001' sem regras cadastradas e descrição sem nenhuma regra, para isolamento total
  const categoriasSemCombustivel = categoriasFicticias.filter((c) => !c.nome.toLowerCase().includes('combust'));
  const tNivel4IsolSemRegraBanco: TransacaoExtrato = {
    idTemporario: 't-4b',
    data: '2026-11-10',
    descricaoOriginal: 'DEBITO CONTA',
    descricaoNormalizada: 'DEBITO CONTA',
    mensagemUsuario: 'abastecimento diesel caminhao',
    valor: 450,
    tipo: 'debito',
    ordemNoDia: 1,
    linhaOrigem: 2,
  };
  const sugNivel4Inexistente = sugerirCategoria({
    transacao: tNivel4IsolSemRegraBanco,
    bancoCodigo: '001', // banco sem regras registradas
    contaId: 'conta-1',
    categorias: categoriasSemCombustivel,
    regrasUsuario: [],
    contatos: [],
    historicoLancamentos: []
  });
  assert(sugNivel4Inexistente.origemSugestao === 'nenhuma', 'Nível 4: Sem categoria de combustível cadastrada, origemSugestao é nenhuma');
  assert(sugNivel4Inexistente.categoriaId === undefined, 'Nível 4: Não cria categoria se não existir na base');

  // NÍVEL 5: Regra do Banco (ex: DEB TARIFA PACOTE -> Taxas bancárias)
  const tNivel5: TransacaoExtrato = {
    idTemporario: 't-5',
    data: '2026-11-10',
    descricaoOriginal: 'DEB TARIFA PACOTE',
    descricaoNormalizada: 'DEB TARIFA PACOTE',
    valor: 45,
    tipo: 'debito',
    ordemNoDia: 0,
    linhaOrigem: 1,
  };
  const sugNivel5 = sugerirCategoria({
    transacao: tNivel5,
    bancoCodigo: '756',
    contaId: 'conta-1',
    categorias: categoriasFicticias,
    regrasUsuario: [],
    contatos: [],
    historicoLancamentos: []
  });
  assert(sugNivel5.origemSugestao === 'regra_banco', 'Nível 5: Sugestão por Regra do Banco Sicoob');
  assert(sugNivel5.categoriaId === 'cat-taxas', 'Nível 5: Categoria Taxas Bancárias encontrada');

  console.log('✅ C2 passou com sucesso.\n');

  console.log('🎉 TODOS OS TESTES DA PARTE 24C PASSARAM COM 100% DE SUCESSO!');
}

main().catch((err) => {
  console.error('Erro na execução dos testes:', err);
  process.exit(1);
});
