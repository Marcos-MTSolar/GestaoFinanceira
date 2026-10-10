export interface ConfigQuinzenal {
  dia_1: number;
  dia_2: number;
  modo: 'percentual' | 'fixo';
  valor_1: number;
  valor_2: number | null;
}

export const CONFIG_QUINZENAL_PADRAO: ConfigQuinzenal = {
  dia_1: 15, dia_2: 30, modo: 'percentual', valor_1: 50, valor_2: null,
};

const r2 = (n: number) => +n.toFixed(2);

export function dataDoDiaNaCompetencia(competencia: string, dia: number): string {
  const [mm, aaaa] = competencia.split('/').map(Number);
  const ultimoDia = new Date(aaaa, mm, 0).getDate();
  const d = Math.min(Math.max(1, Math.floor(dia) || 1), ultimoDia);
  return `${aaaa}-${String(mm).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export interface EntradaDivisao {
  bruto: number;
  totalDescontos: number;
  adiantamentosMax: number;
  config: ConfigQuinzenal;
}

export interface ResultadoDivisao {
  share1: number;
  share2: number;
  q1: number;
  q2: number;
  descontosNaQ2: number;
  abatimentoAdiantamentos: number;
  avisos: string[];
}

export function dividirQuinzenas(e: EntradaDivisao): ResultadoDivisao {
  const { bruto, totalDescontos, adiantamentosMax, config } = e;
  const avisos: string[] = [];
  const base = (v: number) => (config.modo === 'percentual' ? (bruto * v) / 100 : v);
  const share1 = r2(Math.min(Math.max(base(config.valor_1), 0), bruto));
  const share2 = config.valor_2 === null ? r2(bruto - share1) : r2(Math.max(base(config.valor_2), 0));
  if (config.valor_2 !== null && Math.abs(share1 + share2 - bruto) > 0.01) {
    avisos.push(`A soma das duas parcelas (R$ ${(share1 + share2).toFixed(2)}) difere do bruto (R$ ${bruto.toFixed(2)}).`);
  }
  const descontosNaQ2 = r2(Math.min(Math.max(totalDescontos, 0), share2));
  if (totalDescontos - descontosNaQ2 > 0.009) {
    avisos.push(`Descontos maiores que a 2ª quinzena; excedente de R$ ${(totalDescontos - descontosNaQ2).toFixed(2)} não foi abatido.`);
  }
  const baseQ2 = r2(share2 - descontosNaQ2);
  const abatimentoAdiantamentos = r2(Math.min(Math.max(adiantamentosMax, 0), baseQ2));
  const q2 = r2(baseQ2 - abatimentoAdiantamentos);
  return { share1, share2, q1: share1, q2, descontosNaQ2, abatimentoAdiantamentos, avisos };
}
