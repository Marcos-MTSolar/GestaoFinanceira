// MT Solar - Gestão Financeira
// Registro e Configuração de Bancos Homologados para Extratos (Parte 15A)

import { DefinicaoBanco, ErroBancoNaoSuportado, ExtratoLido } from './tipos';
import { parsearOfx } from './parsers/ofx';
import { parsearSantanderXlsx } from './parsers/santanderXlsx';

/**
 * Definição do Banco Santander (Código 033)
 * Suporta formatos OFX e XLSX
 */
export const BANCO_SANTANDER: DefinicaoBanco = {
  codigo: '033',
  nome: 'Santander',
  formatosSuportados: ['ofx', 'xlsx'],
  detectar: (contexto) => {
    // Detecção no formato OFX por conteúdo: BANKID 033 ou ORG / FID SANTANDER
    if (contexto.formato === 'ofx' && contexto.textoOfx) {
      const temBankId = /<BANKID>\s*0?33\b/i.test(contexto.textoOfx);
      const temOrg = /<ORG>\s*SANTANDER/i.test(contexto.textoOfx);
      const temFid = /<FID>\s*SANTANDER/i.test(contexto.textoOfx);
      return temBankId || temOrg || temFid;
    }

    // Detecção no formato XLSX por conteúdo: "EXTRATO DE CONTA CORRENTE" + colunas de cabeçalho
    if (contexto.formato === 'xlsx' && contexto.linhasXlsx) {
      const primeirasLinhas = contexto.linhasXlsx.slice(0, 12);
      const temTituloExtrato = primeirasLinhas.some(linha =>
        Array.isArray(linha) &&
        linha.some(celula => typeof celula === 'string' && celula.toUpperCase().includes('EXTRATO DE CONTA CORRENTE'))
      );

      const temColunasSantander = primeirasLinhas.some(linha => {
        if (!Array.isArray(linha)) return false;
        const texto = linha.map(c => (typeof c === 'string' ? c.toLowerCase().trim() : '')).join(' ');
        const temCredito = texto.includes('crédito') || texto.includes('credito');
        const temDebito = texto.includes('débito') || texto.includes('debito');
        return temCredito && temDebito;
      });

      return temTituloExtrato && temColunasSantander;
    }

    return false;
  },
  parser: async (contexto, buffer): Promise<ExtratoLido> => {
    if (contexto.formato === 'ofx') {
      if (!contexto.textoOfx) {
        throw new ErroBancoNaoSuportado('Conteúdo textual OFX não fornecido para o parser do Santander.');
      }
      return parsearOfx(contexto.textoOfx, buffer);
    }

    if (contexto.formato === 'xlsx') {
      return parsearSantanderXlsx(buffer);
    }

    throw new ErroBancoNaoSuportado(`Formato "${contexto.formato}" não é suportado pelo Santander.`);
  }
};

/**
 * Registro de todos os bancos homologados no sistema
 * Pronto para expansão (outros bancos podem ser plugados aqui)
 */
export const BANCOS_REGISTRADOS: DefinicaoBanco[] = [
  BANCO_SANTANDER,
];

/**
 * Busca a definição de um banco pelo seu código Febraban
 */
export function obterBancoPorCodigo(codigo: string): DefinicaoBanco | undefined {
  return BANCOS_REGISTRADOS.find(b => b.codigo === codigo);
}
