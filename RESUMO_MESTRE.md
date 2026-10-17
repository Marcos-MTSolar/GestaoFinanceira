# RESUMO MESTRE DO PROJETO - MT SOLAR GESTÃO FINANCEIRA

**Última Atualização:** 17/10/2026 07:05:00 (Parte 14D implementada)
**Histórico de Alterações Recentes:**
- **O que foi feito:**
  - **Parte 14D - Padronização da tipografia de números com Inter tabular/alinhada (`font-num`) nas demais telas e componentes do sistema**:
    - **D1 (Auditoria e Classificação de `font-serif`)**: Mapeadas todas as ocorrências de `font-serif` em 15 arquivos do sistema (`Projetos.tsx`, `ContasPagar.tsx`, `ContasReceber.tsx`, `Cadastros.tsx`, `Configuracoes.tsx`, `Lancamentos.tsx`, `ContasBancarias.tsx`, `Login.tsx`, `ExtratoModal.tsx`, `ModalPagarReceber.tsx`, `ConciliacaoModal.tsx`, `Header.tsx`, `Modal.tsx`, `ErrorBoundary.tsx`, `InConstruction.tsx`).
    - **D2 (Substituição de NÚMEROS por `font-num`)**:
      - `src/pages/Projetos.tsx`: Substituídos totais de faturamento e custos nos cards de resumo, orçamentos, saldo financeiro, lucro e percentuais por `font-num`.
      - `src/pages/ContasPagar.tsx`: Substituídos totais de cards (A Pagar Hoje, Vencidas, Próximos 7 Dias, Total do Mês), valores monetários na tabela/cards móveis e modais de baixa por `font-num`.
      - `src/pages/ContasReceber.tsx`: Substituídos totais de cards (A Receber Hoje, Em Atraso, Próximos 7 Dias, Total do Mês), valores monetários na tabela/cards móveis por `font-num`.
      - `src/pages/Cadastros.tsx`: Substituídos valores de limites e saldos por `font-num`.
      - `src/pages/Configuracoes.tsx`: Substituídos valores monetários em configurações financeiras por `font-num`.
      - `src/pages/Lancamentos.tsx`: Substituídos totais filtrados (Receitas, Despesas, Saldo Líquido) e coluna de valor na tabela por `font-num`.
      - `src/components/ExtratoModal.tsx`: Substituídos todos os valores de movimentação monetária (entradas, saídas, saldo atual) por `font-num`.
      - `src/components/ModalPagarReceber.tsx`: Substituídos valor original de títulos selecionados, valor original total, valor final total a pagar/receber e simulações comparativas de saldo da conta ("Saldo Real Hoje" e "Depois deste pagamento/recebimento") por `font-num`.
      - `src/components/ConciliacaoModal.tsx`: Substituídos saldo real atual no App, saldo real esperado calculado e diferença apurada por `font-num`.
    - **D3 (Preservação de TÍTULOS e TEXTOS com `font-serif`)**:
      - Mantidos intocados com `font-serif` todos os títulos e cabeçalhos em `ContasBancarias.tsx`, `Login.tsx`, `Header.tsx`, `Modal.tsx`, `ErrorBoundary.tsx`, `InConstruction.tsx`, bem como os cabeçalhos de seção e títulos de `Projetos.tsx`, `ContasPagar.tsx`, `ContasReceber.tsx`, `Cadastros.tsx`, `Configuracoes.tsx` e `Lancamentos.tsx`.
  - **Arquivos modificados:** `src/pages/Projetos.tsx`, `src/pages/ContasPagar.tsx`, `src/pages/ContasReceber.tsx`, `src/pages/Cadastros.tsx`, `src/pages/Configuracoes.tsx`, `src/pages/Lancamentos.tsx`, `src/components/ExtratoModal.tsx`, `src/components/ModalPagarReceber.tsx`, `src/components/ConciliacaoModal.tsx`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 14C - Padronização da tipografia de números com Inter tabular/alinhada (`font-num`) em Funcionários (`src/pages/Funcionarios.tsx`)**:
    - **C1 / C2 / C3**: Mapeadas todas as 60 ocorrências de `font-serif` no arquivo. Classificadas 10 ocorrências como TÍTULO/TEXTO (título principal L572, avatares com iniciais L829, L958, L1340, título do fechamento da folha L1030, nome do colaborador L1345 e cabeçalhos de seções L1534, L1716, L1772, L1830), mantendo-as intocadas com `font-serif`.
    - As 50 ocorrências de NÚMERO (resultando em 54 nós com a classe `font-num`) foram convertidas com rigor:
      - 5 indicadores de topo (Colaboradores ativos, Salários Base, Custo c/ Encargos, Já Liquidado, Pendente);
      - Valores de salário base e custo mensal da tabela de colaboradores e cards mobile;
      - Valores e totais da tabela da Folha do Mês (salário base, adicionais, descontos, tooltip de detalhamento, adiantamentos e líquido a pagar);
      - Valores dos indicadores de resumo da Ficha Funcional (salário base, custo empresa, pago no mês/ano, adiantamentos em aberto e 13º acumulado);
      - Valores de descontos recorrentes ativos, tabela de lançamentos do colaborador e tabela de evolução mensal da remuneração;
      - Inputs de valores monetários no cadastro de funcionários e modal de novo lançamento de folha;
      - Prévia de valores, descontos e líquido no modal de novo lançamento de folha;
      - Todas as células numéricas e linha de totais gerais da tabela de impressão `FolhaGeralImpressao`;
      - Valores monetários de proventos, descontos, totais e "Valor Líquido a Receber" no componente `ReciboIndividual`.
  - **Arquivos modificados:** `src/pages/Funcionarios.tsx`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 14B - Padronização da tipografia de números com Inter tabular/alinhada (`font-num`)**:
    - **B1 (`index.html`)**: Atualizado `<link>` do Google Fonts para incluir peso 800 na família Inter (`Inter:wght@400;500;600;700;800`), mantendo Playfair Display.
    - **B2 (`src/index.css`)**: Adicionada regra `body { font-variant-numeric: tabular-nums lining-nums; }` dentro de `@layer base` e utilitário `@utility font-num` definindo família Inter com `tabular-nums lining-nums`, `font-feature-settings: 'tnum' 1, 'lnum' 1` e `letter-spacing: -0.01em`.
    - **B3 / B4 (`src/components/CaixaCard.tsx`)**: Mapeadas 9 ocorrências de `font-serif`: 1 mantida como TÍTULO (L121) e 8 NÚMEROS convertidos para `font-num` (saldos consolidado, bancário, investimento, gaveta, reservas e cheque especial).
    - **B3 / B4 (`src/pages/Dashboard.tsx`)**: Mapeadas 26 ocorrências de `font-serif`: 8 mantidas como TÍTULO (L191, L451, L624, L687, L756, L801, L885, L940) e 18 NÚMEROS convertidos para `font-num` (entradas, saídas, saldo operacional, total a receber, total a pagar, previsões, caixas e despesas).
    - **B3 / B4 / B5 (`src/pages/Relatorios.tsx`)**: Mapeadas 52 ocorrências de `font-serif`: 20 mantidas como TÍTULO/TEXTO e 32 NÚMEROS convertidos para `font-num` (DRE, Fluxo de Caixa, Lucratividade por Projeto, Cheque Especial, Folha de Pagamento, Balanço Patrimonial e Comparativo Mensal). Valores destacados de indicadores no Balanço Patrimonial também receberam `font-num`.
  - **Arquivos modificados:** `index.html`, `src/index.css`, `src/components/CaixaCard.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Relatorios.tsx`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 14A - Correções de layout, quebra de página e responsividade na impressão de relatórios (`src/pages/Relatorios.tsx`)**:
    - **A1**: No gráfico estático de impressão do Fluxo de Caixa, ajustada altura para `height={260}`, margens `margin={{ top: 5, right: 10, left: 0, bottom: 10 }}`, legenda com `<Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 11 }} />` (evitando sobreposição com rótulos do eixo X) e eixos X e Y com `tick={{ fontSize: 10 }}`.
    - **A2**: Adicionada a classe `print:overflow-visible` em todas as 6 `<div>` com classe `overflow-x-auto` da página de relatórios (menu superior, Fluxo de Caixa, Lucratividade por Projeto, Cheque Especial, Folha no Período e Comparativo Mensal), eliminando o surgimento de barras de rolagem no PDF/impressão.
    - **A3**: Nas tabelas de Fluxo de Caixa e Comparativo Mensal, a `<table>` recebeu `print:table-fixed print:text-[8.5pt]` e todas as células `<th>` e `<td>` receberam `print:px-1.5 print:py-1`, além de `print:whitespace-normal` nos cabeçalhos `<th>`.
    - **A4**: Adicionado `print-avoid-break` nas `<div>` que envolvem as tabelas de Fluxo de Caixa e Comparativo Mensal para evitar que a tabela seja partida ao meio na mudança de página. Compactação de impressão aplicada no cartão do Fluxo com `print:p-3` no cartão externo, `print:mb-2` no bloco do título e wrapper do gráfico com `mb-2`.
    - **A5**: Parágrafo descritivo de período interno do Fluxo de Caixa recebeu `print:hidden`, uma vez que a informação já consta no cabeçalho oficial de impressão.
    - **A6**: No cabeçalho de impressão superior, o título do relatório recebeu `print:text-lg` e o subtítulo da empresa recebeu `print:text-[9pt]`, impedindo a quebra de linha indesejada no papel.
    - **A7**: Realizada auditoria de todas as 5 tabelas de `Relatorios.tsx`. Nas tabelas com 6 ou mais colunas que não eram Fluxo nem Comparativo (Lucratividade por Projeto - 8 colunas; Detalhamento de Cheque Especial - 7 colunas), foram adicionadas `print:text-[8.5pt]` na `<table>` e `print:px-1.5` nas células.
  - **Arquivos modificados:** `src/pages/Relatorios.tsx`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 13B - Ajustes de impressão em gráficos e cartões, formatação brasileira de percentuais e consolidação de 'Sem categoria'**:
    - **B1 (`src/pages/Relatorios.tsx`)**: Grades de cartões de indicadores adaptadas para impressão com `print:grid-cols-2` (DRE e Projetos & Usinas) e `print:grid-cols-3` (Cheque Especial e Folha). Todos os 15 parágrafos de indicadores com a classe `font-serif text-2xl font-bold` receberam `print:text-xl`.
    - **B2 (`src/utils/formatters.ts`, `scripts/test_13B.ts`, `src/pages/Relatorios.tsx`)**: Criada a função `formatarPercentual(valor: number, casas: number = 1): string` em `src/utils/formatters.ts`. Criado script de teste automatizado `scripts/test_13B.ts` validando todas as entradas com 6 PASSOU / 0 FALHOU. No JSX de `Relatorios.tsx`, todas as interpolações de percentual em tela e impressão foram substituídas por `formatarPercentual`, preservando as exportações de CSV intocadas.
    - **B3 (`src/pages/Relatorios.tsx`)**: No Fluxo de Caixa, título ajustado para `Fluxo de Caixa Mensal` e inserido parágrafo com período efetivo: `Período: {formatarDataBR(iniEfetivo)} até {formatarDataBR(fimEfetivo)}`.
    - **B4 (`src/pages/Relatorios.tsx`)**: No Fluxo de Caixa, o contêiner dinâmico do `ResponsiveContainer` foi marcado com `print:hidden` e foi incluído contêiner `hidden print:block` com `<BarChart width={640} height={300} ...>` estático sem ResponsiveContainer, mantendo os mesmos eixos, legenda e barras com `isAnimationActive={false}` (sem Tooltip).
    - **B5 (`src/pages/Relatorios.tsx`)**: Nos dois gráficos de rosca de Composição de Despesas e Receitas, o `ResponsiveContainer` foi marcado com `print:hidden` e foi adicionado contêiner `hidden print:flex justify-center` com `<PieChart width={640} height={240}>` estático sem animação.
    - **B6 (`src/services/storage.ts`, `src/pages/Relatorios.tsx`)**: No `gerarRelatorioDRE` do `storage.ts` e no `useMemo` de `dadosCategorias` em `Relatorios.tsx`, categorias não encontradas no cadastro agora agrupam sob a chave única `'sem_categoria'` com a denominação `'Sem categoria'` (substituindo 'Outras Receitas' e 'Outras Despesas').
  - **Arquivos modificados:** `src/utils/formatters.ts`, `scripts/test_13B.ts` (novo), `src/pages/Relatorios.tsx`, `src/services/storage.ts`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 13A - Correção de quebra de página no Balanço Patrimonial e auditoria de print-avoid-break (`src/pages/Relatorios.tsx`)**:
    - **A1 (Balanço Patrimonial)**: Removida a classe `print-avoid-break` do cartão externo (linha 1365), que era mais alto que a página e empurrava todo o conteúdo para a página 2. Adicionadas `print:p-0 print:border-0` no mesmo elemento. As DUAS caixas de coluna (ATIVO e PASSIVO E PATRIMÔNIO LÍQUIDO, linhas 1403 e 1487) receberam `print-avoid-break` individualmente. Compactação de impressão: grid recebeu `print:gap-3 print:mt-3`; contêineres internos das colunas receberam `print:p-2 print:space-y-3 print:text-[9pt]`; aviso âmbar recebeu `print:mt-2 print:p-2`; rodapé de conferência recebeu `print:mt-3 print:pt-2`.
    - **A2 (Auditoria print-avoid-break)**: Removida a classe `print-avoid-break` de 8 elementos que contêm `<table>` ou `.map` sem limite de tamanho: Fluxo de Caixa (L808), Demonstrativo de Lucratividade Projetos (L990), Quem Nos Deve (L1064), A Quem Devemos (L1094), Detalhamento Cheque Especial (L1145), Custo por Funcionário (L1213), Folha de Pagamento no Período (L1257), Comparativo Mensal (L1320). As linhas de tabela continuam protegidas pela regra `tr` do `index.css`.
    - **A3 (Listas com rolagem)**: Acrescentadas `print:max-h-none print:overflow-visible` em todos os 5 contêineres com `max-h-` + `overflow-y-auto`: L786 (despesas DRE), L904 (categorias despesas), L947 (categorias receitas), L1217 (custo por funcionário), L1652 (modal ajustes balanço).
    - **A4**: Nenhuma alteração em `index.css`.
  - **Arquivos modificados:** `src/pages/Relatorios.tsx`.

**Histórico de Alterações Recentes (anteriores):**
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

---

### Parte 11A – Sincronização Folha ↔ Lançamentos (2026-10-16)
**Data:** 2026-10-16T05:30  
**Arquivos modificados:** `src/services/storage.ts`, `src/pages/Lancamentos.tsx`, `src/pages/Funcionarios.tsx`  
**O que foi feito:**

- **A1 (storage.ts – espelharDespesaNaFolha):** Removida a exigência de `origem === 'folha'` e `folha_id` obrigatório; a folha é localizada por `folha_id` OU por `lancamento_id === desp.id`. Adicionada saída idempotente: se `status`, `data_pagamento`, `conta_id` e `lancamento_id` já estão corretos, a função retorna sem salvar nem registrar auditoria.
- **A2 (storage.ts – saveLancamento):** Após gravar no cache e antes de `notify('lancamentos')`, chama `espelharDespesaNaFolha` se `item.origem === 'folha'` ou se o cache de folha já possui um registro vinculado via `lancamento_id`. As chamadas em `liquidarLancamento` e `estornarLancamento` foram mantidas (agora são idempotentes).
- **A3 (storage.ts – deleteLancamento):** Calcula `folhaIdVinculada` por três caminhos: `target?.folha_id`, busca no cache por `lancamento_id === id`, ou padrão `desp-<folhaId>`. Usa `removerFolhaOrfa` independentemente da `origem`.
- **A4 (storage.ts):** Criada a função `avisarFalhaGravacao(acao, erro)` com throttle de 5 s; usada nos `.catch` de `setDoc` em `saveLancamento`, `deleteDoc` em `deleteLancamento`, `setDoc` em `saveLancamentoFolha` e `deleteDoc` em `removerRegistroFolhaBruto`.
- **A5 (Lancamentos.tsx – salvarLancamento):** No ramo "3. Lançamento Individual / Edição", o objeto `registro` agora preserva `folha_id` e `funcionario_id` via spread condicional ao editar um lançamento que já tenha esses campos.
- **A6 (Lancamentos.tsx):** Quando `lancamentoEditando?.origem === 'folha'`, exibe aviso âmbar acima do campo Valor e desabilita o input (`disabled`).
- **A7 (Funcionarios.tsx – tabela Folha do Mês):** Ao lado de "Quitado" em parcelas quinzenais e no colaborador mensal totalmente pago, exibe botão âmbar "Estornar" (quando `lancamento_id` existe). O `confirm` alerta que o valor volta ao saldo e a parcela volta para Pendente; ao confirmar, chama `dbService.estornarLancamento(lancamento_id)`.
- **A8 (storage.ts + Funcionarios.tsx):** Criado `reconciliarPagamentosDeFolha(): number` que percorre folhas `pago` com `lancamento_id` e, se a despesa não existir ou não estiver `pago`, reverte para `pendente`. No efeito F9 de `Funcionarios.tsx`, a função é chamada antes de `vincularFolhasPendentesSemDespesa`; se retornar > 0, incrementa `folhasReconciliadasCount` (novo `useState(0)`). Faixa âmbar com botão "Fechar" exibe a contagem para o administrador.

**tsc:** zero erros  
**build:** ✓ sucesso (vite build, 2284 módulos, sem erros)

---

### Parte 11B – Confirmação de Período Personalizado nos Relatórios (2026-10-16)
**Data:** 2026-10-16T05:40  
**Arquivos modificados:** `src/pages/Relatorios.tsx`  
**O que foi feito:**

- **B1 (Relatorios.tsx – estados de rascunho):** Criados os estados `inicioRascunho` e `fimRascunho` (iniciados com `dataInicio` e `dataFim`). Em `handleMudarPreset`, presets `ano_atual`, `mes_atual` e `ultimos_12` atualizam `inicioRascunho` e `fimRascunho` sincronizados com `dataInicio` e `dataFim`; ao selecionar `personalizado`, inicializa os rascunhos com as datas ativas.
- **B2 (Relatorios.tsx – inputs e botões do modo personalizado):** No modo `personalizado`, os dois `<input type="date">` manipulam exclusivamente `inicioRascunho` e `fimRascunho` sem alterar `dataInicio`/`dataFim` em tempo real. Adicionados os botões "Pesquisar" (cor #003064, ícone Search de `lucide-react`) e "Limpar" (chama `handleMudarPreset('ano_atual')`). Pressionar `Enter` em qualquer um dos campos de data dispara a pesquisa.
- **B3 (Relatorios.tsx – validação):** O botão "Pesquisar" é desabilitado se algum campo estiver vazio ou se `inicioRascunho > fimRascunho`. Quando `inicioRascunho > fimRascunho`, exibe texto em vermelho: "A data inicial é maior que a final". A lógica de `iniEfetivo`/`fimEfetivo` foi mantida inalterada.
- **B4 (Relatorios.tsx – rodapé de período aplicado):** Abaixo dos controles da barra, sempre (em todos os presets), exibe: `"Período aplicado: dd/mm/aaaa até dd/mm/aaaa"`. Se no preset `personalizado` os rascunhos divergirem das datas aplicadas, adiciona aviso em âmbar: `" — Alterações ainda não aplicadas — clique em Pesquisar"`.
- **B5 e B6:** Presets automáticos (`ano_atual`, `mes_atual`, `ultimos_12`) continuam aplicando imediatamente; nenhum memo de relatório foi alterado.

**tsc:** zero erros  
**build:** ✓ sucesso (vite build, 2284 módulos, sem erros)

---

### Parte 11C – Suporte a Pró-labore e Setor Diretoria (2026-10-16)
**Data:** 2026-10-16T05:55  
**Arquivos modificados:** `src/types/index.ts`, `src/services/storage.ts`, `src/pages/Funcionarios.tsx`  
**O que foi feito:**

- **C1 (types/index.ts):** Adicionado `'prolabore'` em `TipoContratoFuncionario` e `'Diretoria'` em `SetorFuncionario`.
- **C2 (storage.ts – calcularCustoTotalFuncionario):** Adicionada `const isProlabore = f.tipo_contrato === 'prolabore';` aplicando o INSS patronal quando `(isCLT || isProlabore)`. FGTS, provisão de férias, 13º e outros encargos mantidos exclusivamente para CLT.
- **C3 (Funcionarios.tsx):** Adicionado `{ id: 'prolabore', label: 'Pró-labore (Sócio/CEO)' }` em `TIPOS_CONTRATO` e `'Diretoria'` em `SETORES`.
- **C4 (Funcionarios.tsx – formulário):**
  - Ao selecionar `'prolabore'`, define forma de remuneração como `'mensal'` e valor inicial do INSS patronal como `0` para novos cadastros.
  - Na seção de encargos, para `'prolabore'`, esconde FGTS, férias, 13º e outros, exibindo apenas o campo de INSS patronal com rótulo "INSS patronal sobre o pró-labore (%)" e a dica "Use 0 se a empresa é do Simples Nacional. Confirme com o contador."
  - Na seção de descontos recorrentes, adicionado botão de atalho "+ INSS do sócio 11% (base: bruto)" inserindo linha `{ nome: 'INSS do sócio', tipo: 'percentual', valor: 11, base: 'bruto', ativo: true }` com a dica: "Retenção do sócio. O sistema não aplica o teto previdenciário nem calcula IRRF; confirme com o contador."
  - Cálculo dinâmico de custos do modal atualizado para incluir INSS patronal de pró-labore.
- **C5 (Funcionarios.tsx – exibição visual):** Criado helper `formatarTipoContratoLabel` para exibir "Pró-labore" (em vez de "prolabore") na tabela/cartões de colaboradores, no cabeçalho da ficha e na seção de dados contratuais.

**tsc:** zero erros  
**build:** ✓ sucesso (vite build, 2284 módulos, sem erros)

---

### Parte 11D – Integração Financeira, Recibos e Impressão para Pró-labore (2026-10-16)
**Data:** 2026-10-16T06:05  
**Arquivos modificados:** `src/services/storage.ts`, `src/pages/Funcionarios.tsx`  
**O que foi feito:**

- **D1 (storage.ts – garantirDespesaDaFolha):** Quando o colaborador for do tipo `prolabore`, busca dinamicamente categoria de despesa com nome normalizado (sem acentos, minúsculo, apenas letras) igual a `'prolabore'`; se encontrada, vincula a despesa ao ID dela; caso contrário, mantém a regra atual ('Salários' ou 'cat-des-4').
- **D2 (storage.ts – gerarFolhaDoFuncionario):** No caminho mensal, define a descrição como `Pró-labore ${func.cargo}` para colaboradores do tipo `prolabore` (para os demais continua `Salário Mensal ${func.cargo}`).
- **D3 (Funcionarios.tsx – tabela Folha do Mês):** Adicionado selo roxo "Pró-labore" (`bg-violet-100 text-violet-800`) ao lado do selo Quinzenal/Mensal na identificação do colaborador.
- **D4 (Funcionarios.tsx – ReciboIndividual):** Para pró-labore, o título do recibo passa a ser `RECIBO DE PRÓ-LABORE — COMPETÊNCIA ...`, o item de provento base passa a ser `"Pró-labore"` (em vez de Salário Base / Salário Base Mensal), e o termo de quitação declara quitação `"do meu pró-labore"`.
- **D5 (Funcionarios.tsx – FolhaGeralImpressao):** Na coluna "Cargo" da folha geral de impressão de todos os períodos (q1, q2 e mês), exibe `${cargo} (pró-labore)` quando o colaborador for do tipo `prolabore`.

**tsc:** zero erros  
**build:** ✓ sucesso (vite build, 2284 módulos, sem erros)

---

### Parte 11E – Módulo de Cálculo de Balanço Patrimonial (2026-10-16)
**Data:** 2026-10-16T19:30  
**Arquivos modificados / criados:** `src/utils/balanco.ts`, `scripts/test_11E.ts`  
**O que foi feito:**

- **E1 (src/utils/balanco.ts):** Criado módulo utilitário desacoplado de storage/firebase contendo os tipos `GrupoManualBalanco`, `ItemManualBalanco`, `EntradaBalanco`, `LinhaBalanco`, `ResultadoBalanco` e a função pura `montarBalanco(e: EntradaBalanco): ResultadoBalanco`.
- **E2 (Regras de classificação contábil):**
  - Contas bancárias com saldo positivo vão para Ativo Circulante (`Disponível — {nome}`); contas com saldo negativo vão para Passivo Circulante (`Saldo devedor / cheque especial — {nome}`).
  - Contas a receber e adiantamentos a colaboradores vão para Ativo Circulante.
  - Contas a pagar e folha a pagar vão para Passivo Circulante.
  - Itens manuais são classificados por grupo (`ativo_circulante`, `ativo_nao_circulante`, `passivo_circulante`, `passivo_nao_circulante`, `pl_capital`, `pl_reservas`).
  - Totalização de Ativo (AC + ANC), Passivo (PC + PNC), Patrimônio Líquido apurado (Ativo - Passivo), Capital e Reservas (soma de pl_capital e pl_reservas) e Lucros/Prejuízos acumulados apurados (`plTotal - capitalEReservas`).
  - Identificação de lucros ou prejuízos acumulados apurados na linha de fechamento do PL.
  - Garantia de fechamento balançado: `passivoMaisPL === ativo`.
- **E3 (scripts/test_11E.ts):** Implementada suíte de testes com 5 casos automatizados (a, b, c, d, e), cobrindo cenário completo, entrada zerada, prejuízo acumulado apurado, saldos negativos e equivalência `totais.ativo === totais.passivoMaisPL` em todos os casos.

**testes:** 5/5 passaram com sucesso  
**tsc:** zero erros  
**build:** ✓ sucesso (vite build, 2284 módulos, sem erros)

---

### Parte 11F – Integração do Balanço Patrimonial ao Storage e Configurações (2026-10-16)
**Data:** 2026-10-16T19:38  
**Arquivos modificados:** `src/types/index.ts`, `src/services/storage.ts`, `src/pages/Configuracoes.tsx`  
**O que foi feito:**

- **F1 (types/index.ts):** Adicionado `import type { ItemManualBalanco } from '../utils/balanco'` e o campo opcional `balanco_manual?: ItemManualBalanco[];` na interface `ConfiguracoesEmpresa`.
- **F2 (storage.ts – persistência de balanço manual):** Implementados `getItensBalancoManual(): ItemManualBalanco[]` e `saveItensBalancoManual(itens: ItemManualBalanco[]): void` usando `saveConfiguracoes` para persistência com merge no Firestore.
- **F3 (storage.ts – gerarRelatorioBalanco):** Criado método de cálculo automatizado do balanço no `dbService`:
  - Contas ativas (`c.ativa !== false`) com saldo real via `calcularResumoConta`.
  - Contas a receber e a pagar a partir de lançamentos pendentes (excluindo transferências e ajustes).
  - Segregação de despesas de folha pendentes (`l.origem === 'folha'`) para `folhaAPagar`, evitando dupla contagem em `contasAPagar`.
  - Cálculo de `adiantamentosColaboradores` como soma de saldos não abatidos (`Math.max(0, valor - soma(abatimentos))`) de adiantamentos pagos.
  - Montagem de balanço consolidado via `montarBalanco` com data base atual.
- **F4 (Configuracoes.tsx):** Ajustado `handleSalvarConfig` para construir o payload com `{ ...dbService.getConfiguracoes(), ...config }`, preservando `balanco_manual` e quaisquer campos corporativos não editáveis na tela.

**tsc:** zero erros  
**build:** ✓ sucesso (vite build, 2285 módulos, sem erros)

---

### Parte 11G – Interface do Balanço Patrimonial Gerencial e Ajustes Manuais (2026-10-16)
**Data:** 2026-10-16T19:45  
**Arquivos modificados:** `src/pages/Relatorios.tsx`  
**O que foi feito:**

- **G1 (Relatorios.tsx – tipo, título e abas):** Adicionado `'balanco_patrimonial'` ao `TipoRelatorio`, adicionado o registro em `TITULOS_RELATORIOS` (`9. Balanço Patrimonial Gerencial`) e incluída a 9ª aba no array de relatórios com ícone `Scale`.
- **G2 (Relatorios.tsx – cálculo reativo):** Adicionado `dadosBalanco = useMemo(() => dbService.gerarRelatorioBalanco(), [versaoDados])`, independente do período de datas selecionado na barra de filtros.
- **G3 (Relatorios.tsx – renderização em 2 colunas):**
  - Textos informativos de posição atual e data base no padrão DD/MM/AAAA.
  - Aviso âmbar destacando que se trata de balanço gerencial e não substitui o contábil.
  - Layout em grid de 2 colunas (`lg:grid-cols-2` e `print:grid-cols-2`):
    - Coluna da esquerda: Ativo Circulante, Ativo Não Circulante e Total do Ativo.
    - Coluna da direita: Passivo Circulante, Passivo Não Circulante, Patrimônio Líquido e Total Passivo + PL.
    - Selo "manual" para linhas originárias de ajustes manuais e traço "—" para grupos vazios.
    - Bloco de conferência no rodapé validando `Math.abs(totais.ativo - totais.passivoMaisPL) < 0.01` com ícone verde `CheckCircle2`.
- **G4 (Relatorios.tsx – modal de ajustes manuais):**
  - Botão "Ajustes manuais" no topo do relatório, restrito a administradores (`isAdmin` de `useAuth()`) com a classe `print:hidden`.
  - Integração do componente `<Modal>` (`src/components/Modal.tsx`) para gerenciar itens manuais (select de grupo, nome, valor R$ e exclusão).
  - Validação completa antes do salvamento (nome não vazio, grupo selecionado e valor > 0).
  - Geração de IDs `bal-${Date.now()}-${n}` para novos itens e recálculo imediato via `versaoDados`.
- **G5 (Relatorios.tsx – suporte à impressão):**
  - Cabeçalho de impressão oficial atualizado para exibir "Posição em: DD/MM/AAAA" para o balanço.
  - Botão de ajustes manuais marcado com `print:hidden`.
  - Exportação CSV implementada no `handleExportarCSV` gerando estrutura completa do balanço.

**tsc:** zero erros  
**build:** ✓ sucesso (vite build, 2285 módulos, sem erros)

---

### Parte 12A – Refinamentos de Auditoria, Reconciliação, Configurações e Pró-labore (2026-10-16)
**Data:** 2026-10-16T19:55  
**Arquivos modificados:** `src/services/storage.ts`, `src/pages/Funcionarios.tsx`, `src/pages/Configuracoes.tsx`, `src/pages/Relatorios.tsx`  
**O que foi feito:**

- **A1 (storage.ts – espelharDespesaNaFolha):** O registro de auditoria (`pagamento` ou `estorno`) agora ocorre estritamente quando `folha.status !== novoStatus`. Alterações exclusivas de vínculo (`lancamento_id`), `data_pagamento` ou `conta_id` salvam a folha sem disparar registro indevido de auditoria.
- **A2 (Funcionarios.tsx – efeito F9):** Criado `reconciliouRef = useRef(false)` para invocar `dbService.reconciliarPagamentosDeFolha()` somente na primeira execução, prevenindo que updates parciais de rede/outros dispositivos sejam interpretados como incoerência. Vinculação pendente e contagem sem despesa continuam reativas a cada evento.
- **A3 (Configuracoes.tsx – handleSalvarConfig):** Implementada exclusão explícita de `balanco_manual` do payload do formulário (`delete resto.balanco_manual`) antes do merge com `getConfiguracoes()`, garantindo que salvar dados da empresa nunca sobrescreva ajustes manuais do balanço.
- **A4 (Relatorios.tsx – versaoDados):** Confirmados e mantidos os subscribers de `'folha'` e `'configuracoes'` com limpeza completa no cleanup do `useEffect`.
- **A5 (Funcionarios.tsx – FolhaGeralImpressao):** Confirmado que todos os 3 modos de impressão (`q1`, `q2`, `mes`) utilizam `cargo: f.tipo_contrato === 'prolabore' ? `${f.cargo} (pró-labore)` : f.cargo`, não restando nenhuma ocorrência direta de `cargo: f.cargo` dentro de `FolhaGeralImpressao`.
- **A6 (Funcionarios.tsx – formulário de cadastro):** Condicionados o botão de atalho `+ INSS do sócio 11% (base: bruto)` e a dica de retenção de pró-labore para serem exibidos exclusivamente quando `tipoContrato === 'prolabore'`.
- **A7 (Funcionarios.tsx – tabela Folha do Mês):** Confirmada a existência do botão "Estornar" no colaborador mensal totalmente pago (`Quitado`), com confirmação modal e estorno seguro via `dbService.estornarLancamento`.

**tsc:** zero erros  
**build:** ✓ sucesso (vite build, 2285 módulos, sem erros)

