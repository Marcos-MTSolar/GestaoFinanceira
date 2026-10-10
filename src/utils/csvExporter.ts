import { Lancamento, ContaBancaria, Categoria, Contato, Projeto } from '../types';
import { formatarDataBR, formatarMoeda } from './formatters';

export function exportarLancamentosCSV(
  lancamentos: Lancamento[],
  contas: ContaBancaria[],
  categorias: Categoria[],
  contatos: Contato[],
  projetos: Projeto[]
): void {
  const colunas = [
    'ID',
    'Tipo',
    'Descrição',
    'Valor (R$)',
    'Data Vencimento',
    'Data Pagamento',
    'Status',
    'Conta Bancária',
    'Categoria',
    'Contato',
    'Projeto',
    'Forma de Pagamento',
    'Recorrência / Parcela',
    'Observações',
  ];

  const linhas = lancamentos.map((l) => {
    const conta = contas.find((c) => c.id === l.conta_id)?.nome || '-';
    const cat = categorias.find((c) => c.id === l.categoria_id)?.nome || '-';
    const contato = contatos.find((c) => c.id === l.contato_id)?.nome || '-';
    const projeto = projetos.find((p) => p.id === l.projeto_id)?.nome || '-';

    const parcelaInfo =
      l.recorrencia === 'parcelado' && l.total_parcelas
        ? `Parcela ${l.parcela_atual || 1}/${l.total_parcelas}`
        : l.recorrencia !== 'nenhuma'
        ? `Recorrente (${l.recorrencia})`
        : 'À vista';

    return [
      l.id,
      l.tipo.toUpperCase(),
      `"${l.descricao.replace(/"/g, '""')}"`,
      l.valor.toFixed(2).replace('.', ','),
      formatarDataBR(l.data_vencimento),
      l.data_pagamento ? formatarDataBR(l.data_pagamento) : '-',
      l.status.toUpperCase(),
      `"${conta.replace(/"/g, '""')}"`,
      `"${cat.replace(/"/g, '""')}"`,
      `"${contato.replace(/"/g, '""')}"`,
      `"${projeto.replace(/"/g, '""')}"`,
      l.forma_pagamento,
      `"${parcelaInfo}"`,
      `"${(l.observacoes || '').replace(/"/g, '""')}"`,
    ].join(';');
  });

  // UTF-8 BOM para garantir acentuação correta no Excel brasileiro
  const csvContent = '\uFEFF' + [colunas.join(';'), ...linhas].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dataHoje = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `MT_Solar_Lancamentos_${dataHoje}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportarFolhaCSV(
  itens: Array<{
    funcionarioNome: string;
    cargo: string;
    setor: string;
    cpf: string;
    tipoContrato: string;
    salarioBase: number;
    adicionais: number;
    beneficios: number;
    adiantamentosDescontados: number;
    totalDescontos: number;
    detalheDescontos?: string;
    liquido: number;
    status: string;
    chavePix: string;
  }>,
  competencia: string
): void {
  const colunas = [
    'Colaborador',
    'Cargo',
    'Setor',
    'CPF',
    'Contrato',
    'Salário Base (R$)',
    'Adicionais / Comissões (R$)',
    'Benefícios (R$)',
    'Adiantamentos Descontados (R$)',
    'Descontos (R$)',
    'Detalhe dos descontos',
    'Líquido a Pagar (R$)',
    'Status',
    'Chave PIX',
  ];

  const linhas = itens.map((i) => [
    `"${i.funcionarioNome.replace(/"/g, '""')}"`,
    `"${i.cargo.replace(/"/g, '""')}"`,
    `"${i.setor.replace(/"/g, '""')}"`,
    `"${i.cpf}"`,
    i.tipoContrato,
    i.salarioBase.toFixed(2).replace('.', ','),
    i.adicionais.toFixed(2).replace('.', ','),
    i.beneficios.toFixed(2).replace('.', ','),
    i.adiantamentosDescontados.toFixed(2).replace('.', ','),
    i.totalDescontos.toFixed(2).replace('.', ','),
    `"${(i.detalheDescontos || '-').replace(/"/g, '""')}"`,
    i.liquido.toFixed(2).replace('.', ','),
    i.status.toUpperCase(),
    `"${i.chavePix.replace(/"/g, '""')}"`,
  ].join(';'));

  const csvContent = '\uFEFF' + [colunas.join(';'), ...linhas].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const compSanitizada = competencia.replace('/', '_');
  link.setAttribute('download', `MT_Solar_Folha_${compSanitizada}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportarTabelaGenericaCSV(
  nomeArquivo: string,
  colunas: string[],
  linhas: Array<Array<string | number>>
): void {
  const linhasFormatadas = linhas.map(linha =>
    linha.map(item => {
      if (typeof item === 'number') {
        return item.toFixed(2).replace('.', ',');
      }
      return `"${String(item).replace(/"/g, '""')}"`;
    }).join(';')
  );

  const csvContent = '\uFEFF' + [colunas.join(';'), ...linhasFormatadas].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dataHoje = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `MT_Solar_${nomeArquivo}_${dataHoje}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

