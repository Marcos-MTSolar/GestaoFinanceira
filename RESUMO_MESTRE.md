# RESUMO MESTRE DO PROJETO - MT SOLAR GESTÃƒO FINANCEIRA

**Ãšltima AtualizaÃ§Ã£o:** 12/10/2026 11:20:00 (Parte 7C implementada)
**HistÃ³rico de AlteraÃ§Ãµes Recentes:**
- **O que foi feito:**
  - **Parte 7C - Recibos individuais de pagamento para impressÃ£o com discriminaÃ§Ã£o de proventos, descontos e quinzenas**:
    - **C1 (`src/pages/Funcionarios.tsx`)**: No `ModalImpressaoFolha`, quando `modoImpressao === 'recibos'`, renderiza um recibo por colaborador dentro do `<PrintPortal>`, cada um encapsulado em `<section className="print-recibo">` (uma pÃ¡gina A4 retrato por recibo, com isolamento de quebra via CSS). Adicionado seletor de colaborador ("Todos | <nome>") nos controles superiores do modal para permitir a impressÃ£o de um recibo especÃ­fico ou de todos em lote.
    - **C2 (`src/pages/Funcionarios.tsx`)**: Criado o subcomponente `ReciboIndividual` contendo: logotipo corporativo, razÃ£o social, CNPJ; tÃ­tulo "RECIBO DE PAGAMENTO â€” COMPETÃŠNCIA MM/AAAA" acrescido do perÃ­odo (MÃªs Completo, 1Âª ou 2Âª quinzena); dados funcionais (nome, cargo, setor, CPF); tabela detalhada de "Proventos" (salÃ¡rio base, adicionais/periculosidade, proventos avulsos) e tabela de "Descontos" (cada desconto discriminado por nome, inclusive recorrentes, alÃ©m dos adiantamentos salariais abatidos); quadro em destaque com valor lÃ­quido a receber e data prevista de pagamento; termo de quitaÃ§Ã£o legal; e duas linhas de assinatura (colaborador e empresa).
    - **C3 (`src/pages/Funcionarios.tsx`)**: Para colaboradores quinzenais em 1Âª ou 2Âª quinzena, o recibo exibe o valor da respectiva parcela acompanhado de texto explicativo de composiÃ§Ã£o ("1Âª quinzena: 50% do bruto, sem descontos" / "2Âª quinzena: restante do bruto menos descontos e adiantamentos").
    - **C4 (`src/pages/Funcionarios.tsx`)**: Todos os valores sÃ£o consumidos estritamente dos cÃ¡lculos existentes (`calcularFolhaFuncionario`, `calcularParcelasQuinzena`, lanÃ§amentos de folha gerados), sendo proibido recalcular regras internas. Utiliza `formatarMoeda` garantindo valores reais e legÃ­veis na impressÃ£o, independentemente do modo de privacidade em tela.
    - **C5 (`src/pages/Funcionarios.tsx`)**: Adicionado o botÃ£o "Imprimir Recibo" no cabeÃ§alho da Ficha Funcional de cada colaborador, abrindo diretamente o modal no modo 'recibos' com o respectivo colaborador prÃ©-selecionado.
  - **Arquivos modificados:** `src/pages/Funcionarios.tsx`.

**HistÃ³rico de AlteraÃ§Ãµes Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 7B - Folha geral de pagamento para impressÃ£o com alternÃ¢ncia de perÃ­odos e parcelas quinzenais**:
    - **B1 (`src/pages/Funcionarios.tsx`)**: Adicionados ao `ModalImpressaoFolha` os estados `modoImpressao: 'geral' | 'recibos'` (padrÃ£o 'geral') e `periodoImpressao: 'mes' | 'q1' | 'q2'` (padrÃ£o 'mes'), com botÃµes de alternÃ¢ncia estilizados exibidos na parte superior do modal (apenas em tela).
    - **B2 (`src/pages/Funcionarios.tsx`)**: Criado o subcomponente `FolhaGeralImpressao` que consome estritamente os valores prÃ©-calculados (`dbService.calcularFolhaFuncionario`, `dbService.calcularParcelasQuinzena` e lanÃ§amentos gerados da folha), sem recalcular regras internamente. Filtra colaboradores ativos; no perÃ­odo 'mes' lista todos e nos perÃ­odos 'q1'/'q2' lista apenas colaboradores quinzenais com o valor da respectiva parcela.
    - **B3 (`src/pages/Funcionarios.tsx`)**: Tabela da folha geral renderizada dentro de `<PrintPortal>` com a classe CSS `"print-folha"`. ContÃ©m cabeÃ§alho com logo, dados cadastrais e tÃ­tulo dinÃ¢mico com competÃªncia e quinzena; 9 colunas estruturadas (Colaborador, Cargo, SalÃ¡rio Base, Adicionais, Descontos, Adiantamentos, LÃ­quido, Parcelas e Assinatura); linha de totais gerais ao final; e rodapÃ© com data de emissÃ£o e campo de assinatura da diretoria.
    - **B4 (`src/pages/Funcionarios.tsx`)**: Aplicado design system de impressÃ£o com fonte de 10pt, bordas finas, `break-inside: avoid` nas linhas de tabela e rodapÃ©, e largura total (100%).
    - **B5 (`src/pages/Funcionarios.tsx`)**: Removido o bloco temporÃ¡rio de teste da Parte 7A.
  - **Arquivos modificados:** `src/pages/Funcionarios.tsx`.

**HistÃ³rico de AlteraÃ§Ãµes Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 7A - CriaÃ§Ã£o do PrintPortal e isolamento da impressÃ£o de folha e recibos**:
    - **A1 (`src/components/PrintPortal.tsx`)**: Criado o componente `PrintPortal` que, ao montar, cria `<div id="print-root">` no `document.body` (caso nÃ£o exista), aplica a classe `print-portal-ativo` ao body e renderiza `{children}` via `createPortal`. Ao desmontar, remove a classe e o elemento criado.
    - **A2 (`src/index.css`)**: Adicionadas regras de isolamento CSS: em tela (`@media screen`), `#print-root` fica oculto (`display: none`); em impressÃ£o (`@media print`), quando `body.print-portal-ativo` estiver ativo, `#root` Ã© ocultado (`display: none !important`) e `#print-root` Ã© exibido (`display: block !important`). Definidas pÃ¡ginas nomeadas `@page folha` (A4 landscape) e `@page recibo` (A4 portrait com quebras de pÃ¡gina controladas).
    - **A3 (`src/pages/Funcionarios.tsx`)**: Criada funÃ§Ã£o `carregarImagem` com Promise de prÃ©-carregamento. No botÃ£o "Imprimir Documento" de `ModalImpressaoFolha`, aguarda `Promise.all([document.fonts.ready, carregarImagem('/logo.png')])` antes de chamar `window.print()`.
    - **A4 (`src/pages/Funcionarios.tsx`)**: Inserido bloco `<PrintPortal>` com conteÃºdo de teste ("TESTE DE IMPRESSÃƒO" com logotipo) para validar o isolamento no papel. A prÃ©-visualizaÃ§Ã£o em tela permanece intacta.
  - **Arquivos criados/modificados:** `src/components/PrintPortal.tsx` (novo), `src/index.css`, `src/pages/Funcionarios.tsx`.

**HistÃ³rico de AlteraÃ§Ãµes Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 6C - OtimizaÃ§Ã£o de layout e suporte profissional a impressÃ£o/PDF nos relatÃ³rios**:
    - **C1**: Adicionada a classe `print:hidden` no elemento mais externo de `Sidebar.tsx` (tanto no `aside` desktop quanto no drawer mobile), `Header.tsx` (`header`) e `MobileBottomNav.tsx` (`nav`). Em `App.tsx`, adicionado `print:block print:bg-white` no contÃªiner principal, `print:pb-0` na Ã¡rea intermediÃ¡ria e `print:p-0 print:max-w-none` na tag `<main>`.
    - **C2**: No `src/index.css`, adicionadas regras de mÃ­dia `@media print` para tamanho A4 portrait, margens de 14mm, `overflow: visible` em html/body, `print-color-adjust: exact`, repetiÃ§Ã£o de thead, quebras de pÃ¡gina evitadas (`break-inside: avoid` em tr e `.print-avoid-break`) e redimensionamento responsivo de grÃ¡ficos Recharts.
    - **C3**: Em `src/pages/Relatorios.tsx`, adicionado `isAnimationActive={false}` em todos os grÃ¡ficos (`Pie`, `Bar`), classes `print-avoid-break print:shadow-none print:border print:border-slate-300 print:rounded-none` em todos os cards e blocos de relatÃ³rios, `handleImprimir` ajustado para disparar `resize` e aguardar 400ms antes de chamar `window.print()`, e tabelas formatadas para `print:text-[10pt]` com bordas finas em cÃ©lulas `th`/`td`.
    - **C4**: Mantido cabeÃ§alho oficial de impressÃ£o e adicionado rodapÃ© fixo no print com texto `"MT Solar â€” RelatÃ³rio gerado pelo sistema de GestÃ£o Financeira"`.
    - **C5**: A exibiÃ§Ã£o e layout em tela permaneceram 100% inalterados.
  - **Arquivos modificados:** `src/index.css`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/Header.tsx`, `src/components/MobileBottomNav.tsx`, `src/pages/Relatorios.tsx`.

**HistÃ³rico de AlteraÃ§Ãµes Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 6B - Paletas e cores consistentes nos relatÃ³rios de categorias (`src/pages/Relatorios.tsx`)**:
    - **B1**: Criadas no topo as paletas de cores `PALETA_RECEITAS` (8 cores), `PALETA_DESPESAS` (8 cores) e a funÃ§Ã£o utilitÃ¡ria `corPorIndice(paleta, i)` para rotaÃ§Ã£o de cor por Ã­ndice.
    - **B2**: Na montagem de `dadosCategorias`, a atribuiÃ§Ã£o de cor foi movida para DEPOIS do `.sort((a, b) => b.valor - a.valor)`, garantindo que a categoria com maior valor receba a 1Âª cor da respectiva paleta.
    - **B3**: Verificados todos os pontos de renderizaÃ§Ã£o de cores no arquivo. As fatias (`<Cell fill=... />`) e as bolinhas de legenda da seÃ§Ã£o de categorias utilizam o mesmo objeto e a mesma propriedade (`d.cor` / `r.cor`), garantindo 100% de consistÃªncia visual. No DRE, as cores respeitam o cadastro/fallback conforme especificado sem conflito.
    - **B4**: Dashboard intocado (`Dashboard.tsx` permaneceu inalterado).
  - **Arquivos modificados:** `src/pages/Relatorios.tsx`.

**HistÃ³rico de AlteraÃ§Ãµes Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 6A - Filtro de perÃ­odo unificado nos relatÃ³rios**:
    - **A1 (`src/utils/periodo.ts`)**: Criado o arquivo com as funÃ§Ãµes `mesesDoPeriodo(ini, fim)` e `dentroDoPeriodo(data, ini, fim)` exatamente conforme especificado.
    - **A2 (`scripts/test_6A.ts`)**: Criado script de testes importando `'../src/utils/periodo'`. 7/7 casos PASSOU.
    - **A3 (anÃ¡lise)**: Fluxo de Caixa retorna `{ ano, meses[] }` com `mesIndex` (1â€“12) â€” chave `YYYY-MM` reconstituÃ­da como `${ano}-${padStart(mesIndex,2,'0')}`. Comparativo delega ao Fluxo. FuncionÃ¡rios usa `competencia` em formato `MM/YYYY`. Todos tÃªm chave de mÃªs identificÃ¡vel â€” prosseguido.
    - **A4 (`src/pages/Relatorios.tsx` + `src/services/storage.ts`)**: Fluxo de Caixa e Comparativo: agora agregam todos os anos de `anoIni` atÃ© `anoFim` do perÃ­odo e filtram apenas os meses presentes em `mesesDoPeriodo`. FuncionÃ¡rios: `gerarRelatorioFuncionariosFolha` ganhou parÃ¢metros opcionais `(dataIni?, dataFim?)` que filtram lanÃ§amentos por `data_pagamento || data_prevista`; o memo passa `iniEfetivo`/`fimEfetivo`. Todos os memos passam a depender de `iniEfetivo` e `fimEfetivo`.
    - **A5 (`src/pages/Relatorios.tsx`)**: Adicionado `<p>` cinza "PosiÃ§Ã£o atual â€” nÃ£o depende do perÃ­odo selecionado" no topo dos relatÃ³rios Projetos & Usinas e InadimplÃªncia.
    - **A6 (`src/pages/Relatorios.tsx`)**: `periodoInvertido = dataInicio > dataFim`; quando verdadeiro, `iniEfetivo`/`fimEfetivo` sÃ£o trocados nos cÃ¡lculos, os inputs ficam com borda vermelha e aparece o texto "A data inicial Ã© maior que a final" em vermelho.
  - **Arquivos criados/modificados:** `src/utils/periodo.ts` (novo), `scripts/test_6A.ts` (novo), `src/pages/Relatorios.tsx`, `src/services/storage.ts`.

**HistÃ³rico de AlteraÃ§Ãµes Recentes (anteriores):**
**HistÃ³rico de AlteraÃ§Ãµes Recentes:**
- **O que foi feito:**
  - **Parte 5D - CorreÃ§Ã£o da previsÃ£o quinzenal e selo de valor desatualizado na tabela da Folha do MÃªs (`src/pages/Funcionarios.tsx`)**:
    - **D1**: SubstituÃ­do o ramo `else if (isQuinzenal && f.pagamento_quinzenal)` que chamava `dividirQuinzenas` com `totalDescontos: 0` e `adiantamentosMax: 0` por chamada a `dbService.calcularParcelasQuinzena(f, competenciaAtiva)`, que jÃ¡ considera descontos recorrentes e adiantamentos abatidos. O `valorLiquido` para quinzenal sem parcelas geradas agora Ã© a soma das parcelas de `prevQuinzena.parcelas` (ou `calcFolha.liquido` como fallback).
    - **D2**: Adicionado texto `"Prev.: 1Âª R$ x â€¢ 2Âª R$ y"` abaixo do valor lÃ­quido quando o colaborador Ã© quinzenal e nÃ£o tem parcelas geradas na competÃªncia atual.
    - **D3**: Adicionado selo Ã¢mbar `"âš  Valor gerado desatualizado"` com tooltip explicativo quando hÃ¡ parcelas pendentes cujo somatÃ³rio difere em mais de R$ 0,01 do previsto atual. Parcelas pagas nunca recebem o selo. Nenhum lanÃ§amento Ã© alterado.
  - **Arquivos modificados:** `src/pages/Funcionarios.tsx` (bloco `let valorLiquido` ~linha 1085 e cÃ©lula JSX `td` do LÃ­quido a Pagar ~linha 1149).

**HistÃ³rico de AlteraÃ§Ãµes Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 5C - Pagamento em lote com modos de seleÃ§Ã£o e auto-geraÃ§Ã£o sob demanda**:
    - **C1 (`src/pages/Funcionarios.tsx`)**: Adicionado o estado `modoLote: 'proxima' | 'todas' | 'q1' | 'q2'` (padrÃ£o 'proxima') e um `<select>` estilizado ao lado do botÃ£o "Pagar Todos em Lote" com as 4 opÃ§Ãµes de seleÃ§Ã£o.
    - **C2 (`src/pages/Funcionarios.tsx`)**: Reescrevemos `handleAbrirPagarTodos` para verificar colaboradores ativos sem folha na competÃªncia com oferta interativa de geraÃ§Ã£o (`confirm`), reler os dados sÃ­ncronos, filtrar as parcelas pendentes conforme o modo escolhido, tratar adequadamente ausÃªncia de pendÃªncias com alertas especÃ­ficos e preparar despesas para abertura do modal de lote.
    - **C3 (`src/pages/Funcionarios.tsx`)**: Confirmado que o modal de lote lista cada tÃ­tulo com sua descriÃ§Ã£o ("Folha: 1Âª Quinzenaâ€¦") e valor individual da parcela sem modificar `ModalPagarReceber.tsx`.
  - **Parte 5B (revisada) - Pagamento rÃ¡pido unificado e leitura de dados atuais da folha**:
    - **B1 (`src/pages/Funcionarios.tsx`)**: Criada a funÃ§Ã£o `parcelasSalarioAtuais(funcionarioId)` que busca as parcelas de salÃ¡rio diretamente do cache sÃ­ncrono do storage (`dbService.getLancamentosFolha()`) em vez do state `lancamentosFolha`.
    - **B2 (`src/pages/Funcionarios.tsx`)**: Reescrevemos `handlePagarSalarioRapido` para atender fluxos mensal e quinzenal unificados, gerando automaticamente a folha do colaborador via `dbService.gerarFolhaDoFuncionario` caso ainda nÃ£o exista, selecionando a parcela pendente (do perÃ­odo solicitado ou a mais antiga) e preparando a despesa via `dbService.prepararDespesasDaFolha`.
    - **B3 & B4 (`src/pages/Funcionarios.tsx` e `src/services/storage.ts`)**: Confirmado que a coluna AÃ§Ã£o exibe botÃµes individuais por quinzena e que a despesa utiliza `folha.descricao`, resultando no formato `"Folha: 1Âª Quinzena â€“ CARGO â€“ NOME (10/2026)"`.
  - **Parte 5A - CorreÃ§Ã£o da seleÃ§Ã£o e validaÃ§Ã£o de conta bancÃ¡ria em lanÃ§amentos e liquidaÃ§Ãµes**:
    - **A1 (`src/pages/Lancamentos.tsx`)**: Criada a constante derivada `contaEfetivaId = contas.some(c => c.id === contaId) ? contaId : (contas[0]?.id || '')`, aplicada no `value` do `<select>`, na validaÃ§Ã£o com alert amigÃ¡vel em `salvarLancamento` e substituindo `conta_id: contaId` por `conta_id: contaEfetivaId` em parcelamento, recorrÃªncia e lanÃ§amento individual/ediÃ§Ã£o.
    - **A2 (`src/pages/Lancamentos.tsx`)**: Ajustado `abrirModalNovo` para buscar a conta inicial diretamente do cache sÃ­ncrono via `dbService.getContas()[0]?.id || ''`, evitando estado vazio ao abrir o modal externamente.
    - **A3 (`src/components/ModalPagarReceber.tsx`)**: Criada `contaEfetivaId = contas.some(c => c.id === contaSelecionadaId) ? contaSelecionadaId : contaPadraoId`, aplicada no `value` do `<select>`, na busca da conta ativa e nas liquidaÃ§Ãµes em lote e individual em `handleConfirmar`, mantendo intactas as travas de limite e cheque especial.
  - **Parte 3B-fix - Suporte a quinzenas e geraÃ§Ã£o de folha quinzenal em storage.ts**:
    - **F0 (`src/services/storage.ts`)**: Adicionada a importaÃ§Ã£o de `CONFIG_QUINZENAL_PADRAO`, `dataDoDiaNaCompetencia`, `dividirQuinzenas` de `'../utils/quinzena'`.
    - **F1 (`src/services/storage.ts`)**: Ajustada a busca de `salExistente` em `calcularFolhaFuncionario` para desconsiderar lanÃ§amentos com `periodo === 'q1'` (`l.tipo === 'salario' && l.periodo !== 'q1'`).
    - **F2 (`src/services/storage.ts`)**: IncluÃ­das as funÃ§Ãµes `calcularParcelasQuinzena` e `gerarFolhaDoFuncionario` no `dbService`, permitindo o cÃ¡lculo e criaÃ§Ã£o de proventos quinzenais (`q1` e `q2`), deduÃ§Ãµes na 2Âª quinzena e suporte ao modo mensal legÃ­vel com perÃ­odo explÃ­cito.
    - **F3 (`src/services/storage.ts`)**: Atualizado o corpo de `gerarFolhaDoMes` para iterar sobre funcionÃ¡rios ativos delegando a geraÃ§Ã£o para `gerarFolhaDoFuncionario`, agregando contadores e avisos.
  - **Parte 4A - Estrutura e cÃ¡lculo de descontos recorrentes**:
    - **A1 (`src/types/index.ts`)**: Adicionada interface `DescontoRecorrente` e propriedade opcional `descontos_recorrentes?: DescontoRecorrente[]` na interface `Funcionario`.
    - **A2 (`src/utils/descontos.ts`)**: Criada a funÃ§Ã£o utilitÃ¡ria `calcularDescontosRecorrentes` sem dependÃªncias do Firebase/storage.
    - **A3 (`scripts/test_4A.ts`)**: Criado o script de testes cobrindo os 7 casos de testes (a a g) importando diretamente de `src/utils/descontos.ts`, com aprovaÃ§Ã£o total de 100%.
  - **Parte 4B - IntegraÃ§Ã£o de descontos recorrentes no cÃ¡lculo de folha**:
    - **B1 (`src/services/storage.ts`)**: Importada `calcularDescontosRecorrentes` de `'../utils/descontos'`; atualizado `calcularFolhaFuncionario` para calcular os descontos recorrentes e incluÃ­-los no array `descontos` e `totalDescontos`.
    - **B2 & B3 (`src/services/storage.ts`)**: Confirmado que `maxAbatimento` (`Math.max(0, +(bruto - totalDescontos).toFixed(2))`) e `liquido` (`Math.max(0, +(bruto - totalDescontos - adiantamentosAbatidos).toFixed(2))`) utilizam o `totalDescontos` atualizado, impedindo saldo negativo.
    - **B4 (`src/services/storage.ts`)**: Atualizado `gerarFolhaDoMes` para concatenar o texto de descontos recorrentes na propriedade `observacoes` utilizando spread condicional sem gravar `undefined`.
  - **Parte 4C - FormulÃ¡rio de cadastro/ediÃ§Ã£o de colaboradores**:
    - **C1 (`src/pages/Funcionarios.tsx`)**: Adicionado estado `descontosRec: DescontoRecorrente[]` com carga inicial de `funcionarioParaEditar.descontos_recorrentes` e reset para novos cadastros.
    - **C2 & C3 (`src/pages/Funcionarios.tsx`)**: Criada a seÃ§Ã£o "Descontos Recorrentes em Folha" no modal com lista editÃ¡vel (nome, tipo, valor, base, ativo, remover) e 4 botÃµes de atalho ("VT 6%", "Plano saÃºde", "PensÃ£o", "Outro") com geraÃ§Ãµes de IDs determinÃ­sticos.
    - **C4 (`src/pages/Funcionarios.tsx`)**: Criada a funÃ§Ã£o de validaÃ§Ã£o `validarDescontosRecorrentes` (nome obrigatÃ³rio, valor > 0, percentual <= 100%) bloqueando o salvamento via `alert` e gravando via spread condicional.
    - **C5 (`src/pages/Funcionarios.tsx`)**: Adicionada a prÃ©via ao vivo dos descontos mensais estimados e do lÃ­quido estimado (antes de adiantamentos).
  - **Parte 4D - ExibiÃ§Ã£o, exportaÃ§Ã£o e prÃ©vias de descontos recorrentes**:
    - **D1 (`src/pages/Funcionarios.tsx`)**: Confirmado que o tooltip da coluna "Descontos" na tabela "Folha do MÃªs" jÃ¡ renderiza dinamicamente cada desconto recorrente pelo nome e valor via `calcFolha.descontos`. (JÃ� EXISTIA)
    - **D2 (`src/pages/Funcionarios.tsx`)**: Adicionado bloco de Descontos Recorrentes Ativos na Ficha do Colaborador (aba financeira), listando o nome e o valor mensal estimado de cada item ativo.
    - **D3 (`src/utils/csvExporter.ts` e `src/pages/Funcionarios.tsx`)**: Adicionada a coluna "Detalhe dos descontos" no exportador de CSV com o texto formatado `"Nome R$ x; Nome R$ y"`.
    - **D4 (`src/pages/Funcionarios.tsx`)**: Adicionada prÃ©via ao vivo de impacto no salÃ¡rio ao selecionar o evento "Desconto Diversos" no modal de novo lanÃ§amento de folha.
- **Arquivos modificados:**
  - `src/pages/Lancamentos.tsx`
  - `src/components/ModalPagarReceber.tsx`
  - `src/services/storage.ts`
  - `src/pages/Funcionarios.tsx`
  - `src/types/index.ts`
  - `src/utils/csvExporter.ts`
  - `src/utils/descontos.ts`
  - `scripts/test_4A.ts`
  - `RESUMO_MESTRE.md`

---

## 1. VISÃƒO GERAL
- **PropÃ³sito do sistema:** Plataforma corporativa para gestÃ£o financeira empresarial, fluxo de caixa, controle de usinas/projetos fotovoltaicos, folha de pagamento de colaboradores e conciliaÃ§Ã£o bancÃ¡ria da MT Solar.
- **PÃºblico-alvo:** Diretores, gestores financeiros, engenheiros de projeto e consultores externos da MT Solar.
- **EstÃ¡gio atual do projeto:** Integrado ao Firebase (Auth + Firestore), com build de produÃ§Ã£o testado e verificado para Vercel.

---

## 2. STACK TECNOLÃ“GICA
- **Frontend:** React 19, TypeScript, Vite 8, TailwindCSS v4, Lucide React icons, Recharts.
- **Backend:** Firebase Cloud Firestore (banco NoSQL em tempo real).
- **Banco de dados e Storage:** Firestore DB `(default)`, Firebase Auth (Google Provider).
- **IntegraÃ§Ãµes externas:** Google OAuth2 (via Firebase Authentication).
- **Gerenciador de Pacotes:** `npm` com `.npmrc` (`legacy-peer-deps=true`) e `package-lock.json`.

---

## 3. ESTRUTURA DE ARQUIVOS
- `src/lib/firebase.ts`: InicializaÃ§Ã£o da aplicaÃ§Ã£o Firebase, Auth (Google Provider) e Firestore DB `(default)`.
- `src/services/storage.ts`: ServiÃ§o central de dados sincronizado em tempo real via Firestore (`onSnapshot`), com suporte a cache local sÃ­ncrono, filtros por perÃ­odo, paginaÃ§Ã£o e funÃ§Ã£o de migraÃ§Ã£o de dados locais para a nuvem.
- `src/context/AuthContext.tsx`: Contexto de autenticaÃ§Ã£o RBAC integrado ao Firebase Auth com popup do Google e validaÃ§Ã£o da coleÃ§Ã£o `usuarios_autorizados` (Administrador inicial: `mtsolar.energia@gmail.com`).
- `src/components/Logo.tsx`: ExibiÃ§Ã£o da marca MT Solar usando a imagem original `public/logo.png` sobre fundo claro.
- `.npmrc`: ConfiguraÃ§Ã£o `legacy-peer-deps=true` para build na Vercel.
- `firestore.rules`: Regras de seguranÃ§a do Firestore com o e-mail administrador inicial fixo.
- `firebase.json`: ConfiguraÃ§Ã£o de deploy de regras do Firebase CLI.

---

## 4. MÃ“DULOS E FUNCIONALIDADES
- **Painel Principal (Dashboard):** MÃ©tricas de saldo real, saldo disponÃ­vel total, cartÃµes de caixa e grÃ¡ficos.
- **Contas BancÃ¡rias:** Cadastro de contas PJ/Caixa interno, limites e taxas de cheque especial.
- **LanÃ§amentos Financeiros:** Receitas e despesas, parcelamentos, recorrÃªncias e transferÃªncias.
- **GestÃ£o de Projetos Solares:** AssociaÃ§Ã£o de lanÃ§amentos financeiros a usinas fotovoltaicas.
- **Folha de Pagamento:** GestÃ£o de proventos, descontos, encargos e salÃ¡rios mensais.
- **ConfiguraÃ§Ãµes & MigraÃ§Ã£o:** GestÃ£o de usuÃ¡rios autorizados, exportaÃ§Ã£o/importaÃ§Ã£o JSON e migraÃ§Ã£o de dados do `localStorage` para a nuvem Firestore.

---

## 5. BANCO DE DADOS
- **ColeÃ§Ãµes do Firestore (`(default)`):**
  - `contas_bancarias`
  - `categorias`
  - `contatos`
  - `projetos`
  - `lancamentos`
  - `usuarios_autorizados`
  - `funcionarios`
  - `lancamentos_folha`
  - `configuracoes`
  - `historico_auditoria`

---

## 6. INTEGRAÃ‡Ã•ES EXTERNAS
- **Firebase Authentication:** AutenticaÃ§Ã£o via Google Provider (`signInWithPopup`).
- **Firebase Firestore:** Banco de dados NoSQL cloud com sincronizaÃ§Ã£o `onSnapshot`.

---

## 7. AUTENTICAÃ‡ÃƒO E SEGURANÃ‡A
- **Administrador Inicial Fixo:** `mtsolar.energia@gmail.com`.
- **Fluxo de Login:** O usuÃ¡rio acessa com a conta do Google -> O sistema valida se o e-mail Ã© `mtsolar.energia@gmail.com` ou se estÃ¡ registrado na coleÃ§Ã£o `usuarios_autorizados`.
- **Perfis e PapÃ©is:**
  - `administrador`: Leitura e escrita total.
  - `visualizador`: Acesso estritamente de leitura.

---

## 8. REGRAS DE NEGÃ“CIO
- Apenas o Administrador inicial (`mtsolar.energia@gmail.com`) ou administradores autorizados no Firestore conseguem incluir/editar usuÃ¡rios e gravar no sistema.

---

## 9. FLUXO DO WHATSAPP
- N/A (MÃ³dulo planejado para fases futuras).

---

## 10. BUILD E DEPLOY
- **Build Frontend:** `npm run build` (Totalmente verificado).
- **Deploy de Regras do Firestore:**
  ```bash
  npx firebase-tools deploy --only firestore:rules --project gestaofinanceira-5afd9
  ```

---

## 11. PROBLEMAS RESOLVIDOS
- `.env.local` confirmado fora do controle de versÃ£o (`git check-ignore .env.local`).
- ResoluÃ§Ã£o de dependÃªncia do `react-is` e remoÃ§Ã£o do `bun.lock` com inclusÃ£o do `.npmrc` para garantir build liso na Vercel.
- Regra de administrador inicial fixo configurada com seguranÃ§a no `firestore.rules` (`mtsolar.energia@gmail.com`).

---


### Parte 8A – gerarRelatorioFuncionariosFolha multi-ano + memos DRE/Cheque (2026-10-13)
**Data:** 2026-10-13T09:09  
**Arquivos modificados:** `src/services/storage.ts`, `src/pages/Relatorios.tsx`  
**O que foi feito:**
- `gerarRelatorioFuncionariosFolha`: quando `dataIni`/`dataFim` são fornecidos, o loop agora percorre todos os anos de `Number(dataIni.slice(0,4))` até `Number(dataFim.slice(0,4))`, gerando uma entrada por competência `MM/AAAA` dentro do intervalo. O filtro usa `data_pagamento || data_prevista`. Rótulo inclui ano completo (ex: `10/2025`) quando o período cruza anos distintos.
- Sem `dataIni`/`dataFim`: comportamento original (12 meses do `anoAlvo`) mantido.
- `Relatorios.tsx`: memo `dadosDRE` movido para depois de `iniEfetivo`/`fimEfetivo` e alterado para usar essas variáveis (e suas dependências). `dadosCheque` já usava `iniEfetivo`/`fimEfetivo`, sem alteração.


### Parte 8B – FolhaGeralImpressao, ReciboIndividual, ModalImpressaoFolha (2026-10-13)
**Data:** 2026-10-13T09:14  
**Arquivos modificados:** `src/pages/Funcionarios.tsx`  
**O que foi feito:**
- **Import**: adicionado `CONFIG_QUINZENAL_PADRAO` no import de `../utils/quinzena`.
- **ReciboIndividual (B1)**: removido "50%" fixo. Em q1, usa `cfg = funcionario.pagamento_quinzenal || CONFIG_QUINZENAL_PADRAO`. textoComposicao, descrição do provento e referência agora são dinâmicos (percentual vs fixo, usando cfg.valor_1). Em q2, textoComposicao usa cfg.valor_2 (null?restante, percentual, fixo).
- **ReciboIndividual (B1/B2)**: valor da parcela q1 para desconto na q2 vem da parcela gerada (por `p.periodo === 'q1'`) ou prevista; fallback `calcFolha.bruto/2` **removido**.
- **FolhaGeralImpressao e ReciboIndividual (B2)**: parcelas identificadas por `p.periodo === 'q1'` / `'q2'`; fallback apenas por data (não mais por `includes('1ª')` / `includes('2ª')`).
- **FolhaGeralImpressao (B3)**: coluna Adicionais usa `calcFolha.adicionais` (sem `proventosAvulsos`) em todos os modos. q1: descontos=0, adiantamentos=0. Nota de rodapé "Salário base e adicionais referem-se ao mês; o líquido refere-se somente ao período impresso." exibida apenas em q1/q2.
- **ModalImpressaoFolha (B4)**: div `id=folha-impressao` trocou `overflow-hidden` por `overflow-x-auto`.

### Parte 8C - Cores das bolinhas no DRE de Relatórios (2026-10-13)
**Data:** 2026-10-13T09:18  
**Arquivos modificados:** `src/pages/Relatorios.tsx`  
**O que foi feito:**
- Nas listas de DRE (detalhamento por categoria), a cor da bolinha de cada linha de receita agora utiliza `corPorIndice(PALETA_RECEITAS, i)` com o índice `i` da linha no `.map()`.
- A cor da bolinha de cada linha de despesa no DRE agora utiliza `corPorIndice(PALETA_DESPESAS, i)` com o índice `i` da linha no `.map()`.
- Nenhuma alteração foi feita em `gerarRelatorioDRE` nem na cor cadastrada das categorias.

### Parte 9A – Ajustes de chaves em relatórios e saídas de caixa da folha (2026-10-15)
**Data:** 2026-10-15T06:55  
**Arquivos modificados:** `src/pages/Relatorios.tsx`, `src/services/storage.ts`  
**O que foi feito:**
- **A1**: Em `Relatorios.tsx`, nas tabelas de Fluxo de Caixa e Comparativo Mensal, substituída a chave `key={m.mesIndex}` por `key={m.rotulo}` para evitar chaves duplicadas em períodos multi-ano.
- **A2**: Em `storage.ts`, na função `gerarRelatorioFuncionariosFolha` (modos multi-ano e mono-ano), o cálculo de `totalLiquido` e `totalPago` foi redefinido para considerar saídas de caixa da folha: `const saidas = eventosMes.filter((l) => l.tipo !== 'desconto' && l.status !== 'cancelado')`. Removido o cálculo antigo por `tipo_operacao` (proventos − descontos) e o sinal negativo em `totalPago`.
- **A3**: Em `Relatorios.tsx`, na tela do relatório "Funcionários & Folha", adicionado texto pequeno cinza: `"Valores = saídas de caixa da folha (salários líquidos, adiantamentos e demais proventos)."`.

### Parte 9B – Proventos avulsos em ReciboIndividual (2026-10-15)
**Data:** 2026-10-15T07:00  
**Arquivos modificados:** `src/pages/Funcionarios.tsx`  
**O que foi feito:**
- **B1**: No componente `ReciboIndividual`, removido do array `itensProventos` o item `'Proventos Avulsos / Bonificação'` nos modos `'q2'` e `'mes'`, pois os avulsos são pagos à parte e não devem compor o líquido do recibo da folha salarial.
- **B2**: Adicionada exibição condicional abaixo das duas tabelas (quando `calcFolha.proventosAvulsos > 0`), em texto pequeno cinza: `"Proventos avulsos desta competência (pagos separadamente): {formatarMoeda(calcFolha.proventosAvulsos)}"`.

### Parte 9C – XAxis rotulo, tabela de folha no período e CSV de folha (2026-10-15)
**Data:** 2026-10-15T07:10  
**Arquivos modificados:** `src/pages/Relatorios.tsx`, `src/pages/Funcionarios.tsx`  
**O que foi feito:**
- **C1**: No gráfico de Fluxo de Caixa (`Relatorios.tsx`), trocado `<XAxis dataKey="mesNome" ...>` por `dataKey="rotulo"`, garantindo rótulos consistentes (mês/ano) em períodos multi-ano.
- **C2**: No relatório "Funcionários & Folha" (`Relatorios.tsx`):
  - Atualizado texto explicativo para: `"Custo por colaborador e por setor = custo mensal estimado atual (não depende do período). A tabela abaixo mostra a folha do período selecionado."`.
  - Acrescentado o cartão `"Folha de Pagamento no Período"` exibindo tabela com `dadosFuncionarios.folhaMensalAno`: colunas Competência (`m.rotulo`), Já Pago (`m.totalPago`), Total do Mês (`m.totalLiquido`) e Lançamentos (`m.quantidadeLancamentos`), com linha de `TOTAIS` e exibição de `"-"` nos meses sem lançamentos.
- **C3**: Em `Funcionarios.tsx` (`handleExportarFolhaCSV`), ajustado `adicionais: calcFolha.adicionais` (removendo soma com `proventosAvulsos`), preservando a coluna em tela da tabela de folha.

## 12. DÉBITOS TÉCNICOS
- Nenhum dÃ©bito impeditivo no momento.

---

## 13. BACKLOG E MELHORIAS SUGERIDAS
- ConfiguraÃ§Ã£o de Ã­ndices compostos no Firestore caso a massa de lanÃ§amentos ultrapasse dezenas de milhares.

---

## 14. VARIÃ�VEIS DE AMBIENTE
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
