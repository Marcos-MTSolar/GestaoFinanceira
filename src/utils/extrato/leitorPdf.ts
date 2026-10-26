// MT Solar - Gestão Financeira
// Módulo de Extratos - Leitor e Extrator de Itens de Arquivos PDF (Parte 22A)

import { ErroBancoNaoSuportado, ItemPdf } from './tipos';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsCache: any = null;

/**
 * Carrega a biblioteca pdfjs-dist dinamicamente sob demanda.
 * No navegador (Vite), inicializa o worker com ?url.
 * No ambiente Node (testes / scripts tsx), utiliza a build legacy sem worker.
 */
async function obterPdfJs(): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (pdfjsCache) {
    return pdfjsCache;
  }

  if (typeof window === 'undefined') {
    // Ambiente Node (testes / scripts de automação via tsx)
    // Usa dynamic import para evitar bundling da build legacy no navegador
    const pdfjs = await import(
      /* @vite-ignore */
      'pdfjs-dist/legacy/build/pdf.mjs'
    );
    pdfjsCache = pdfjs;
    return pdfjs;
  } else {
    // Ambiente Navegador (Vite): carrega build principal + worker via ?url
    const pdfjs = await import('pdfjs-dist');

    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      // O import ?url retorna a URL do arquivo worker como string
      const workerUrl: string = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    }

    pdfjsCache = pdfjs;
    return pdfjs;
  }
}

/**
 * Extrai todos os itens de texto selecionáveis de um arquivo PDF com suas coordenadas originais.
 *
 * Regras:
 * - Utiliza uma cópia do buffer (para evitar desanexação de memória pelo worker do pdfjs).
 * - Coordenada Y é calculada a partir do TOPO da página: y = alturaPagina - transform[5].
 * - Coordenada X e xFim: x = transform[4], xFim = x + width.
 * - Descarta itens vazios após trim.
 * - Preserva estritamente a ordem de desenho original do arquivo PDF (NÃO reordena).
 * - Lança erro em português se o PDF possuir senha ou se não contiver texto selecionável.
 */
export async function extrairItensPdf(buffer: ArrayBuffer): Promise<ItemPdf[]> {
  const pdfjs = await obterPdfJs();
  // Passa uma cópia dos bytes para evitar desanexação do buffer original pelo worker
  const dados = new Uint8Array(buffer.slice(0));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfDoc: any;
  try {
    const loadingTask = pdfjs.getDocument({
      data: dados,
      isEvalSupported: false,
      useSystemFonts: true
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    const erro = err as { name?: string; message?: string };
    if (erro?.name === 'PasswordException' || (erro?.message && /password/i.test(erro.message))) {
      throw new ErroBancoNaoSuportado('PDF protegido por senha.');
    }
    throw err;
  }

  const itens: ItemPdf[] = [];
  const numPaginas: number = pdfDoc.numPages;

  for (let numPagina = 1; numPagina <= numPaginas; numPagina++) {
    const pagina = await pdfDoc.getPage(numPagina);
    const viewport = pagina.getViewport({ scale: 1 });
    const alturaPagina: number = viewport.height;
    const conteudoTexto = await pagina.getTextContent();

    for (const item of conteudoTexto.items) {
      if (!('str' in item)) continue;

      const texto = (item.str as string).trim();
      if (!texto) continue;

      const transform = item.transform as number[];
      const x = transform[4];
      const width = (item.width as number) || 0;
      const xFim = x + width;
      // Y medido a partir do TOPO da página (pdfjs usa bottom-left como origem)
      const y = alturaPagina - transform[5];

      itens.push({
        pagina: numPagina,
        texto,
        x,
        xFim,
        y
      });
    }
  }

  if (itens.length === 0) {
    throw new ErroBancoNaoSuportado(
      'PDF sem texto selecionável (imagem ou digitalizado). Baixe o extrato em PDF diretamente pelo app do banco.'
    );
  }

  return itens;
}
