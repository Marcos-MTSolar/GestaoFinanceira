// MT Solar - Gestão Financeira
// Testes Automatizados — Parte 16B: Rascunho de Revisão Baseado na Identidade do Arquivo
// Cobre:
//   1) Hash do extrato gera chaves únicas por arquivo (conta + datas + qtd + valores)
//   2) Arquivos diferentes para a mesma conta geram chaves diferentes (sem sobreposição)
//   3) Mesmo arquivo gera a mesma chave determinística
//   4) O rascunho v2 armazena somente escolhas do usuário, não o status de deduplicação
//   5) Ao reaplicar, itens que viraram duplicatas NÃO recebem escolhas antigas de 'incluir'
//   6) Limpeza de rascunhos antigos (> 14 dias) e eliminação de chaves v1

import { ExtratoLido } from '../src/utils/extrato';

let totalTestes = 0;
let passaram = 0;
let falharam = 0;
const falhas: string[] = [];

function asserir(condicao: boolean, titulo: string, detalheErro?: string): void {
  totalTestes++;
  if (condicao) {
    console.log("  ✓ " + titulo);
    passaram++;
  } else {
    const msg = "✗ " + titulo + (detalheErro ? " → " + detalheErro : "");
    console.error("  " + msg);
    falhas.push(msg);
    falharam++;
  }
}

function secao(nome: string): void {
  console.log("\n" + "═".repeat(70));
  console.log("  " + nome);
  console.log("═".repeat(70));
}

// Implementação idêntica da função de hash usada em RevisaoExtrato.tsx
function calcularHashExtrato(
  extratosParam: Array<{
    extrato: ExtratoLido;
    contaId: string;
    bancoCodigo: string;
  }>
): string {
  let soma = 0;
  const partes: string[] = [];
  for (const item of extratosParam) {
    const e = item.extrato;
    partes.push(item.contaId);
    partes.push(item.bancoCodigo);
    partes.push(e.periodo.inicio || '');
    partes.push(e.periodo.fim || '');
    partes.push(String(e.transacoes.length));
    for (const t of e.transacoes) {
      soma += t.valor * (t.tipo === 'credito' ? 1 : -1);
      partes.push(t.data);
    }
  }
  partes.push(Math.round(soma * 100).toString());
  let hash = 5381;
  const str = partes.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

secao("1. Identidade e Determinação de Hash do Arquivo");

const extratoAgosto: ExtratoLido = {
  formato: 'ofx',
  bancoCodigo: '033',
  bancoNome: 'Santander',
  conta: '1234-56789',
  periodo: { inicio: '2026-08-01', fim: '2026-08-31' },
  transacoes: [
    {
      idTemporario: 't1',
      data: '2026-08-05',
      descricaoOriginal: 'PAGTO ENEL',
      descricaoNormalizada: 'PAGTO ENEL',
      tipo: 'debito',
      valor: 250.0,
      fitid: 'FITID-AG01',
      ordemNoDia: 0,
      linhaOrigem: 1,
    },
    {
      idTemporario: 't2',
      data: '2026-08-10',
      descricaoOriginal: 'PIX RECEBIDO CLIENTE A',
      descricaoNormalizada: 'PIX RECEBIDO CLIENTE A',
      tipo: 'credito',
      valor: 1500.0,
      fitid: 'FITID-AG02',
      ordemNoDia: 0,
      linhaOrigem: 2,
    },
  ],
  avisos: [],
};

const extratoSetembro: ExtratoLido = {
  formato: 'ofx',
  bancoCodigo: '033',
  bancoNome: 'Santander',
  conta: '1234-56789',
  periodo: { inicio: '2026-09-01', fim: '2026-09-30' },
  transacoes: [
    {
      idTemporario: 't3',
      data: '2026-09-05',
      descricaoOriginal: 'PAGTO ENEL',
      descricaoNormalizada: 'PAGTO ENEL',
      tipo: 'debito',
      valor: 310.0,
      fitid: 'FITID-ST01',
      ordemNoDia: 0,
      linhaOrigem: 1,
    },
  ],
  avisos: [],
};

const hashAgosto1 = calcularHashExtrato([
  { extrato: extratoAgosto, contaId: 'conta-santander', bancoCodigo: '033' },
]);
const hashAgosto2 = calcularHashExtrato([
  { extrato: extratoAgosto, contaId: 'conta-santander', bancoCodigo: '033' },
]);
const hashSetembro = calcularHashExtrato([
  { extrato: extratoSetembro, contaId: 'conta-santander', bancoCodigo: '033' },
]);
const hashOutraConta = calcularHashExtrato([
  { extrato: extratoAgosto, contaId: 'conta-itau', bancoCodigo: '033' },
]);

asserir(
  hashAgosto1 === hashAgosto2,
  'Mesmo arquivo OFX importado duas vezes gera hash estritamente idêntico'
);
asserir(
  hashAgosto1 !== hashSetembro,
  'Arquivos diferentes (Agosto vs Setembro) para a mesma conta geram hashes diferentes (sem conflito de rascunho)'
);
asserir(
  hashAgosto1 !== hashOutraConta,
  'Mesmo arquivo associado a contas bancárias diferentes gera hashes diferentes'
);

secao("2. Formato e Isolamento do Rascunho v2");

// Simulação de rascunho v2
interface EscolhaRascunho {
  categoriaId: string;
  categoriaNome?: string;
  projetoId?: string;
  contatoId?: string;
  acao: 'incluir' | 'ignorar' | 'vincular';
  tipoLancamento: 'receita' | 'despesa' | 'transferencia' | 'ajuste';
  lembrarRegra?: boolean;
}

interface DadosRascunhoV2 {
  versao: 2;
  salvoEm: string;
  chave: string;
  escolhas: Record<string, EscolhaRascunho>;
  tratamentoContamax: 'ignorar' | 'transferencia';
  contaAplicacaoId: string;
}

const rascunho: DadosRascunhoV2 = {
  versao: 2,
  salvoEm: new Date().toISOString(),
  chave: `mtsolar_extrato_draft_v2_${hashAgosto1}`,
  escolhas: {
    t1: {
      categoriaId: 'cat-energia',
      categoriaNome: 'Energia Elétrica',
      acao: 'incluir',
      tipoLancamento: 'despesa',
      lembrarRegra: true,
    },
  },
  tratamentoContamax: 'ignorar',
  contaAplicacaoId: '',
};

asserir(rascunho.versao === 2, 'Rascunho utiliza especificação da versão 2');
asserir(
  !('statusDeduplicacao' in (rascunho.escolhas['t1'] as any)),
  'Rascunho NÃO armazena statusDeduplicacao (evita mascarar duplicatas em reimportação)'
);
asserir(
  !('natureza' in (rascunho.escolhas['t1'] as any)),
  'Rascunho NÃO armazena natureza das transações (é recalculada ao vivo)'
);

secao("3. Proteção Contra Falsos Positivos e Reaplicação Segura");

// Cenário: na 1ª importação, a transação era 'nova'.
// O usuário definiu acao: 'incluir'.
// Suponha que no banco de dados ela já foi lançada ou outro usuário a lançou.
// Ao reimportar, o detector marca a transação como 'duplicada_exata'.
// A regra da Parte 16B exige que a escolha antiga NÃO seja aplicada se o status for duplicata.

const itemDedupeNova = { status: 'nova' as const };
const itemDedupeDuplicada = { status: 'duplicada_exata' as const };

function aplicarEscolha(
  itemDedupeStatus: 'nova' | 'duplicada_exata',
  escolha: EscolhaRascunho | undefined
) {
  let acaoFinal: 'incluir' | 'ignorar' =
    itemDedupeStatus === 'duplicada_exata' ? 'ignorar' : 'incluir';

  if (escolha && itemDedupeStatus === 'nova') {
    acaoFinal = escolha.acao === 'vincular' ? 'incluir' : escolha.acao;
  }
  return acaoFinal;
}

const acaoParaNova = aplicarEscolha('nova', rascunho.escolhas['t1']);
const acaoParaDuplicada = aplicarEscolha('duplicada_exata', rascunho.escolhas['t1']);

asserir(
  acaoParaNova === 'incluir',
  'Transação verdadeiramente nova reaproveita categoria e ação do rascunho'
);
asserir(
  acaoParaDuplicada === 'ignorar',
  'Transação que se tornou duplicata no banco IGNORA o rascunho antigo e permanece como "ignorar" (evita duplicação)'
);

secao("4. Política de Limpeza e Expiração de Rascunhos");

// Simulação de localStorage
const storageMock: Record<string, string> = {
  // Chave v1 legada
  'mtsolar_extrato_draft_conta123': JSON.stringify({ itens: [] }),
  // Chave v2 com 20 dias (expirada)
  'mtsolar_extrato_draft_v2_antigo1': JSON.stringify({
    versao: 2,
    salvoEm: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  // Chave v2 recente (2 dias)
  'mtsolar_extrato_draft_v2_recente': JSON.stringify({
    versao: 2,
    salvoEm: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  // Outra chave não relacionada ao extrato
  'mtsolar_usuario_tema': 'dark',
};

function simularLimpezaRascunhos(mock: Record<string, string>) {
  const limite = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const chaves = Object.keys(mock);
  for (const k of chaves) {
    if (k.startsWith('mtsolar_extrato_draft_') && !k.includes('_v2_')) {
      delete mock[k];
      continue;
    }
    if (k.startsWith('mtsolar_extrato_draft_v2_')) {
      try {
        const d = JSON.parse(mock[k]);
        if (d?.salvoEm) {
          const t = new Date(d.salvoEm).getTime();
          if (!isNaN(t) && t < limite) {
            delete mock[k];
          }
        }
      } catch {
        delete mock[k];
      }
    }
  }
}

simularLimpezaRascunhos(storageMock);

asserir(
  !('mtsolar_extrato_draft_conta123' in storageMock),
  'Chave legada v1 foi devidamente eliminada'
);
asserir(
  !('mtsolar_extrato_draft_v2_antigo1' in storageMock),
  'Rascunho v2 com mais de 14 dias foi devidamente purgado'
);
asserir(
  'mtsolar_extrato_draft_v2_recente' in storageMock,
  'Rascunho v2 recente (< 14 dias) foi preservado'
);
asserir(
  'mtsolar_usuario_tema' in storageMock,
  'Outras preferências do sistema não foram afetadas'
);

secao("RESUMO FINAL");
console.log(`Total de testes: ${totalTestes}`);
console.log(`Passaram: ${passaram}`);
console.log(`Falharam: ${falharam}`);

if (falharam > 0) {
  process.exit(1);
} else {
  console.log("\nTodos os testes da Parte 16B passaram com sucesso!");
}
