// MT Solar - Gestão Financeira
// Testes da Parte 22B: Parser do extrato PDF do Sicoob e Registro do Banco Sicoob

import { parsearSicoobPdf, ErroConciliacao } from '../src/utils/extrato/parsers/sicoobPdf';
import { BANCO_SICOOB, BANCOS_REGISTRADOS } from '../src/utils/extrato/bancos';
import { ItemPdf, ContextoDeteccao } from '../src/utils/extrato/tipos';

function asserir(condicao: boolean, mensagem: string) {
  if (!condicao) {
    throw new Error(`FALHA NA ASSERÇÃO: ${mensagem}`);
  }
}

// Helper para criar ItemPdf sintético
function criarItem(texto: string, x: number = 154, y: number = 100, pagina: number = 1): ItemPdf {
  return { texto, x, xFim: x + texto.length * 6, y, pagina };
}

// Cabeçalho padrão para os testes
function criarCabecalhoPadrao(): ItemPdf[] {
  return [
    criarItem('SICOOB', 115, 20),
    criarItem('SISTEMA DE COOPERATIVAS DE CRÉDITO DO BRASIL', 150, 20),
    criarItem('SISBR', 400, 20),
    criarItem('EXTRATO CONTA CORRENTE', 115, 40),
    criarItem('COOP.:', 115, 60),
    criarItem('1234-5 / SICOOB EXEMPLO', 160, 60),
    criarItem('CONTA:', 115, 80),
    criarItem('111.111-1 / EMPRESA TESTE LTDA', 160, 80),
    criarItem('PERÍODO:', 115, 100),
    criarItem('20/10/2027 - 26/10/2027', 160, 100),
    criarItem('HISTÓRICO DE MOVIMENTAÇÃO', 115, 120),
    criarItem('DATA', 115, 140),
    criarItem('HISTÓRICO', 154, 140),
    criarItem('VALOR', 430, 140),
  ];
}

async function executarTestes() {
  console.log('🧪 Iniciando testes da PARTE 22B — Parser PDF Sicoob e Registro de Banco\n');

  // =========================================================================
  // TESTE 1: Extrato válido com créditos, débitos, detalhes de DOC e contraparte
  // =========================================================================
  console.log('--- TESTE 1: Extrato válido completo (crédito, débito, doc, contraparte) ---');
  {
    const itens: ItemPdf[] = [
      ...criarCabecalhoPadrao(),
      // Saldo anterior
      criarItem('SALDO ANTERIOR', 154, 160),
      criarItem('10.000,00', 430, 160),
      criarItem('C', 473, 160),

      // Movimento 1: Crédito com DOC e Contraparte
      criarItem('20/10', 115, 180),
      criarItem('DEP DIN AG', 154, 180),
      criarItem('1.500,00', 430, 180),
      criarItem('C', 473, 180),
      criarItem('CPF: 123.456.789-00', 154, 190),
      criarItem('DOC.: 001234', 154, 200),
      criarItem('João da Silva', 154, 210),

      // Movimento 2: Débito com DOC e Contraparte
      criarItem('21/10', 115, 230),
      criarItem('PIX TRANSF', 154, 230),
      criarItem('250,00', 430, 230),
      criarItem('D', 473, 230),
      criarItem('DOC.: 987654', 154, 240),
      criarItem('Maria Souza', 154, 250),

      // Saldo do dia
      criarItem('21/10', 115, 270),
      criarItem('SALDO DO DIA', 154, 270),
      criarItem('11.250,00', 430, 270),
      criarItem('C', 473, 270),

      // Resumo final
      criarItem('RESUMO', 115, 300),
      criarItem('TOTAL DE CRÉDITOS: 1.500,00', 115, 320),
    ];

    const extrato = parsearSicoobPdf(itens);

    asserir(extrato.bancoCodigo === '756', 'Código do banco deve ser 756');
    asserir(extrato.bancoNome === 'Sicoob', 'Nome do banco deve ser Sicoob');
    asserir(extrato.agencia === '1234', `Agência esperada "1234", obtida "${extrato.agencia}"`);
    asserir(extrato.conta === '1111111', `Conta esperada "1111111", obtida "${extrato.conta}"`);
    asserir(extrato.titular === 'EMPRESA TESTE LTDA', `Titular esperado "EMPRESA TESTE LTDA", obtido "${extrato.titular}"`);
    asserir(extrato.periodo.inicio === '2027-10-20', `Início do período incorreto: ${extrato.periodo.inicio}`);
    asserir(extrato.periodo.fim === '2027-10-26', `Fim do período incorreto: ${extrato.periodo.fim}`);
    asserir(extrato.transacoes.length === 2, `Deveria ter 2 transações, mas obteve ${extrato.transacoes.length}`);

    // Transação 1
    const t1 = extrato.transacoes[0];
    asserir(t1.data === '2027-10-20', `Data t1: esperada "2027-10-20", obtida "${t1.data}"`);
    asserir(t1.tipo === 'credito', `Tipo t1: esperado "credito", obtido "${t1.tipo}"`);
    asserir(t1.valor === 1500, `Valor t1: esperado 1500, obtido ${t1.valor}`);
    asserir(t1.descricaoOriginal === 'DEP DIN AG', `Descrição t1: obtida "${t1.descricaoOriginal}"`);
    asserir(t1.documento === '001234', `Documento t1 esperado "001234", obtido "${t1.documento}"`);
    asserir(t1.contraparte === 'João da Silva', `Contraparte t1 esperada "João da Silva", obtida "${t1.contraparte}"`);

    // Transação 2
    const t2 = extrato.transacoes[1];
    asserir(t2.data === '2027-10-21', `Data t2: esperada "2027-10-21", obtida "${t2.data}"`);
    asserir(t2.tipo === 'debito', `Tipo t2: esperado "debito", obtido "${t2.tipo}"`);
    asserir(t2.valor === 250, `Valor t2: esperado 250, obtido ${t2.valor}`);
    asserir(t2.descricaoOriginal === 'PIX TRANSF', `Descrição t2: obtida "${t2.descricaoOriginal}"`);
    asserir(t2.documento === '987654', `Documento t2 esperado "987654", obtido "${t2.documento}"`);
    asserir(t2.contraparte === 'Maria Souza', `Contraparte t2 esperada "Maria Souza", obtida "${t2.contraparte}"`);

    // Saldo Final
    asserir(extrato.saldoFinal?.valor === 11250, `Saldo final esperado 11250, obtido ${extrato.saldoFinal?.valor}`);
    asserir(extrato.saldoFinal?.data === '2027-10-21', `Data saldo final esperada "2027-10-21", obtida "${extrato.saldoFinal?.data}"`);

    console.log('✅ TESTE 1 passou com sucesso.');
  }

  // =========================================================================
  // TESTE 2: Tratamento de C/D colado vs C/D em item separado
  // =========================================================================
  console.log('\n--- TESTE 2: Tratamento de C/D colado ("1.500,00C") vs separado ("1.500,00" e "C") ---');
  {
    const itens: ItemPdf[] = [
      ...criarCabecalhoPadrao(),
      criarItem('SALDO ANTERIOR', 154, 160),
      criarItem('1.000,00C', 430, 160), // colado

      // Movimento com C colado
      criarItem('20/10', 115, 180),
      criarItem('TED RECEBIDA', 154, 180),
      criarItem('1.500,00C', 430, 180), // C colado

      // Movimento com D em item separado
      criarItem('20/10', 115, 200),
      criarItem('PAG BOLETO', 154, 200),
      criarItem('200,00', 430, 200),
      criarItem('D', 473, 200), // D separado

      // Saldo do dia com C em item separado
      criarItem('20/10', 115, 220),
      criarItem('SALDO DO DIA', 154, 220),
      criarItem('2.300,00', 430, 220),
      criarItem('C', 473, 220),
    ];

    const extrato = parsearSicoobPdf(itens);
    asserir(extrato.transacoes.length === 2, `Deveria ter 2 transações, obtidas ${extrato.transacoes.length}`);

    const t1 = extrato.transacoes[0];
    asserir(t1.tipo === 'credito' && t1.valor === 1500, `t1 deveria ser crédito de 1500, obtido ${t1.tipo} ${t1.valor}`);
    asserir(t1.descricaoOriginal === 'TED RECEBIDA', `t1 descrição incorreta: "${t1.descricaoOriginal}"`);

    const t2 = extrato.transacoes[1];
    asserir(t2.tipo === 'debito' && t2.valor === 200, `t2 deveria ser débito de 200, obtido ${t2.tipo} ${t2.valor}`);
    asserir(t2.descricaoOriginal === 'PAG BOLETO', `t2 descrição incorreta: "${t2.descricaoOriginal}"`);

    console.log('✅ TESTE 2 passou com sucesso.');
  }

  // =========================================================================
  // TESTE 3: Linhas de controle ignoradas (SALDO ANTERIOR, SALDO DO DIA, RESUMO, etc.)
  // =========================================================================
  console.log('\n--- TESTE 3: Linhas de controle ignoradas como transações ---');
  {
    const itens: ItemPdf[] = [
      ...criarCabecalhoPadrao(),
      criarItem('SALDO ANTERIOR', 154, 160),
      criarItem('5.000,00C', 430, 160),
      criarItem('SALDO BLOQ.ANTERIOR', 154, 170),
      criarItem('0,00*', 430, 170),

      // Única transação real
      criarItem('20/10', 115, 180),
      criarItem('PIX RECEBIDO', 154, 180),
      criarItem('500,00C', 430, 180),

      // Linhas de controle
      criarItem('20/10', 115, 200),
      criarItem('SALDO DO DIA', 154, 200),
      criarItem('5.500,00C', 430, 200),

      criarItem('CHEQUE ESPECIAL', 154, 220),
      criarItem('10.000,00', 430, 220),

      criarItem('RESUMO', 115, 240),
      criarItem('TOTAL SAÍDAS: 0,00', 115, 260),
    ];

    const extrato = parsearSicoobPdf(itens);
    asserir(extrato.transacoes.length === 1, `Apenas 1 transação real esperada, obtidas ${extrato.transacoes.length}`);
    asserir(extrato.transacoes[0].descricaoOriginal === 'PIX RECEBIDO', `Transação esperada "PIX RECEBIDO", obtida "${extrato.transacoes[0].descricaoOriginal}"`);

    console.log('✅ TESTE 3 passou com sucesso.');
  }

  // =========================================================================
  // TESTE 4: Conferência de saldo: sucesso quando a matemática bate
  // =========================================================================
  console.log('\n--- TESTE 4: Conferência de saldo - sucesso com matemática exata ---');
  {
    const itens: ItemPdf[] = [
      ...criarCabecalhoPadrao(),
      // Saldo anterior: 5.000,00
      criarItem('SALDO ANTERIOR', 154, 160),
      criarItem('5.000,00', 430, 160),
      criarItem('C', 473, 160),

      // Movimentos no dia 20/10 (+1000, -300, +700 => saldo 6400)
      criarItem('20/10', 115, 180),
      criarItem('CREDITO 1', 154, 180),
      criarItem('1.000,00C', 430, 180),

      criarItem('20/10', 115, 200),
      criarItem('DEBITO 1', 154, 200),
      criarItem('300,00D', 430, 200),

      criarItem('20/10', 115, 220),
      criarItem('CREDITO 2', 154, 220),
      criarItem('700,00C', 430, 220),

      // Saldo do dia 20/10: 6.400,00
      criarItem('20/10', 115, 240),
      criarItem('SALDO DO DIA', 154, 240),
      criarItem('6.400,00C', 430, 240),

      // Movimento no dia 21/10 (-400 => saldo 6000)
      criarItem('21/10', 115, 260),
      criarItem('DEBITO 2', 154, 260),
      criarItem('400,00D', 430, 260),

      // Saldo do dia 21/10: 6.000,00
      criarItem('21/10', 115, 280),
      criarItem('SALDO DO DIA', 154, 280),
      criarItem('6.000,00C', 430, 280),
    ];

    const extrato = parsearSicoobPdf(itens);
    asserir(extrato.transacoes.length === 4, `Esperadas 4 transações, obtidas ${extrato.transacoes.length}`);
    asserir(extrato.saldoFinal?.valor === 6000, `Saldo final esperado 6000, obtido ${extrato.saldoFinal?.valor}`);

    console.log('✅ TESTE 4 passou com sucesso.');
  }

  // =========================================================================
  // TESTE 5: Conferência de saldo: ErroConciliacao disparado com divergência
  // =========================================================================
  console.log('\n--- TESTE 5: Conferência de saldo - ErroConciliacao disparado na divergência ---');
  {
    const itensComDivergencia: ItemPdf[] = [
      ...criarCabecalhoPadrao(),
      criarItem('SALDO ANTERIOR', 154, 160),
      criarItem('5.000,00C', 430, 160),

      // Movimento 1: +1.000 (calculado seria 6.000)
      criarItem('20/10', 115, 180),
      criarItem('CREDITO 1', 154, 180),
      criarItem('1.000,00C', 430, 180),

      // Saldo do dia indica 5.700 (falta um débito de 300, simulando linha perdida)
      criarItem('20/10', 115, 200),
      criarItem('SALDO DO DIA', 154, 200),
      criarItem('5.700,00C', 430, 200),
    ];

    let disparouErroEsperado = false;
    let mensagemErro = '';

    try {
      parsearSicoobPdf(itensComDivergencia);
    } catch (err: any) {
      if (err instanceof ErroConciliacao) {
        disparouErroEsperado = true;
        mensagemErro = err.message;
      } else {
        throw new Error(`Erro inesperado (não é ErroConciliacao): ${err}`);
      }
    }

    asserir(disparouErroEsperado, 'Deveria ter disparado ErroConciliacao por divergência de saldo!');
    asserir(mensagemErro.includes('Divergência de saldo'), `Mensagem deveria indicar divergência de saldo: "${mensagemErro}"`);
    console.log(`✅ TESTE 5 passou com sucesso. Mensagem capturada: "${mensagemErro}"`);
  }

  // =========================================================================
  // TESTE 6: Detecção do banco em bancos.ts via contexto.itensPdf
  // =========================================================================
  console.log('\n--- TESTE 6: Detecção do Banco Sicoob em bancos.ts ---');
  {
    // 6.1 Detecção positiva
    const contextoValido: ContextoDeteccao = {
      formato: 'pdf',
      itensPdf: [
        criarItem('SICOOB', 115, 20),
        criarItem('EXTRATO CONTA CORRENTE', 115, 40),
        criarItem('COOP.: 1234-5', 115, 60),
      ]
    };
    asserir(BANCO_SICOOB.detectar(contextoValido) === true, 'BANCO_SICOOB deveria detectar contexto com SICOOB e EXTRATO CONTA CORRENTE');

    // 6.2 Detecção negativa por ausência de SICOOB
    const contextoSemSicoob: ContextoDeteccao = {
      formato: 'pdf',
      itensPdf: [
        criarItem('BANCO DO BRASIL', 115, 20),
        criarItem('EXTRATO CONTA CORRENTE', 115, 40),
      ]
    };
    asserir(BANCO_SICOOB.detectar(contextoSemSicoob) === false, 'BANCO_SICOOB não deve detectar PDF de outro banco');

    // 6.3 Detecção negativa por formato incorreto
    const contextoOfx: ContextoDeteccao = {
      formato: 'ofx',
      textoOfx: '<BANKID>756</BANKID>',
      itensPdf: contextoValido.itensPdf
    };
    asserir(BANCO_SICOOB.detectar(contextoOfx) === false, 'BANCO_SICOOB só deve aceitar formato pdf');

    // 6.4 Verificação no array BANCOS_REGISTRADOS
    const sicoobRegistrado = BANCOS_REGISTRADOS.find(b => b.codigo === '756');
    asserir(!!sicoobRegistrado, 'BANCO_SICOOB deve estar presente em BANCOS_REGISTRADOS');
    asserir(sicoobRegistrado?.nome === 'Sicoob', 'Nome do banco registrado deve ser Sicoob');
    asserir(sicoobRegistrado?.formatosSuportados.includes('pdf') === true, 'Formatos suportados deve incluir pdf');

    // 6.5 Parser via objeto de banco registrado
    const itensCompleto: ItemPdf[] = [
      ...criarCabecalhoPadrao(),
      criarItem('SALDO ANTERIOR', 154, 160),
      criarItem('1.000,00C', 430, 160),
      criarItem('20/10', 115, 180),
      criarItem('PIX', 154, 180),
      criarItem('100,00C', 430, 180),
      criarItem('20/10', 115, 200),
      criarItem('SALDO DO DIA', 154, 200),
      criarItem('1.100,00C', 430, 200),
    ];
    const contextoCompleto: ContextoDeteccao = {
      formato: 'pdf',
      itensPdf: itensCompleto
    };

    const resultadoParser = await sicoobRegistrado!.parser(contextoCompleto, new ArrayBuffer(0));
    asserir(resultadoParser.transacoes.length === 1, `Parser via BANCO_SICOOB deve funcionar perfeitamente, obtidas ${resultadoParser.transacoes.length}`);

    console.log('✅ TESTE 6 passou com sucesso.');
  }

  console.log('\n🎉 TODOS OS 6 TESTES DA PARTE 22B PASSARAM COM SUCESSO!\n');
}

executarTestes().catch(err => {
  console.error('\n❌ ERRO NO TESTE DA PARTE 22B:', err);
  process.exit(1);
});
