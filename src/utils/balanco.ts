export type GrupoManualBalanco =
  | 'ativo_circulante'
  | 'ativo_nao_circulante'
  | 'passivo_circulante'
  | 'passivo_nao_circulante'
  | 'pl_capital'
  | 'pl_reservas';

export interface ItemManualBalanco {
  id: string;
  grupo: GrupoManualBalanco;
  nome: string;
  valor: number;
}

export interface EntradaBalanco {
  contas: Array<{ nome: string; saldo: number }>;
  contasAReceber: number;
  contasAPagar: number;
  folhaAPagar: number;
  adiantamentosColaboradores: number;
  itensManuais: ItemManualBalanco[];
}

export interface LinhaBalanco {
  nome: string;
  valor: number;
  origem: 'auto' | 'manual';
}

export interface ResultadoBalanco {
  ativoCirculante: LinhaBalanco[];
  ativoNaoCirculante: LinhaBalanco[];
  passivoCirculante: LinhaBalanco[];
  passivoNaoCirculante: LinhaBalanco[];
  patrimonioLiquido: LinhaBalanco[];
  totais: {
    ativoCirculante: number;
    ativoNaoCirculante: number;
    ativo: number;
    passivoCirculante: number;
    passivoNaoCirculante: number;
    passivo: number;
    capitalEReservas: number;
    lucrosAcumulados: number;
    patrimonioLiquido: number;
    passivoMaisPL: number;
  };
}

const r2 = (n: number) => +n.toFixed(2);
const soma = (l: LinhaBalanco[]) => r2(l.reduce((a, x) => a + x.valor, 0));

export function montarBalanco(e: EntradaBalanco): ResultadoBalanco {
  const ativoCirculante: LinhaBalanco[] = [];
  const ativoNaoCirculante: LinhaBalanco[] = [];
  const passivoCirculante: LinhaBalanco[] = [];
  const passivoNaoCirculante: LinhaBalanco[] = [];
  const capital: LinhaBalanco[] = [];
  const reservas: LinhaBalanco[] = [];

  for (const c of e.contas) {
    if (c.saldo > 0) {
      ativoCirculante.push({ nome: `Disponível — ${c.nome}`, valor: r2(c.saldo), origem: 'auto' });
    } else if (c.saldo < 0) {
      passivoCirculante.push({ nome: `Saldo devedor / cheque especial — ${c.nome}`, valor: r2(-c.saldo), origem: 'auto' });
    }
  }
  if (e.contasAReceber > 0) ativoCirculante.push({ nome: 'Contas a receber (clientes)', valor: r2(e.contasAReceber), origem: 'auto' });
  if (e.adiantamentosColaboradores > 0) ativoCirculante.push({ nome: 'Adiantamentos a colaboradores', valor: r2(e.adiantamentosColaboradores), origem: 'auto' });
  if (e.contasAPagar > 0) passivoCirculante.push({ nome: 'Contas a pagar (fornecedores e outras)', valor: r2(e.contasAPagar), origem: 'auto' });
  if (e.folhaAPagar > 0) passivoCirculante.push({ nome: 'Folha e pró-labore a pagar', valor: r2(e.folhaAPagar), origem: 'auto' });

  for (const i of e.itensManuais) {
    const linha: LinhaBalanco = { nome: i.nome, valor: r2(i.valor), origem: 'manual' };
    if (i.grupo === 'ativo_circulante') ativoCirculante.push(linha);
    else if (i.grupo === 'ativo_nao_circulante') ativoNaoCirculante.push(linha);
    else if (i.grupo === 'passivo_circulante') passivoCirculante.push(linha);
    else if (i.grupo === 'passivo_nao_circulante') passivoNaoCirculante.push(linha);
    else if (i.grupo === 'pl_capital') capital.push(linha);
    else if (i.grupo === 'pl_reservas') reservas.push(linha);
  }

  const tAC = soma(ativoCirculante);
  const tANC = soma(ativoNaoCirculante);
  const tPC = soma(passivoCirculante);
  const tPNC = soma(passivoNaoCirculante);
  const ativo = r2(tAC + tANC);
  const passivo = r2(tPC + tPNC);
  const plTotal = r2(ativo - passivo);
  const capitalEReservas = r2(soma(capital) + soma(reservas));
  const lucrosAcumulados = r2(plTotal - capitalEReservas);

  const patrimonioLiquido: LinhaBalanco[] = [
    ...capital,
    ...reservas,
    {
      nome: lucrosAcumulados >= 0 ? 'Lucros acumulados (apurado)' : 'Prejuízos acumulados (apurado)',
      valor: lucrosAcumulados,
      origem: 'auto',
    },
  ];

  return {
    ativoCirculante,
    ativoNaoCirculante,
    passivoCirculante,
    passivoNaoCirculante,
    patrimonioLiquido,
    totais: {
      ativoCirculante: tAC,
      ativoNaoCirculante: tANC,
      ativo,
      passivoCirculante: tPC,
      passivoNaoCirculante: tPNC,
      passivo,
      capitalEReservas,
      lucrosAcumulados,
      patrimonioLiquido: plTotal,
      passivoMaisPL: r2(passivo + plTotal),
    },
  };
}
