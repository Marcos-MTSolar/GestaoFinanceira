# RESUMO MESTRE DO PROJETO - MT SOLAR GESTÃO FINANCEIRA

**Última Atualização:** 23/10/2026 09:45:00 (Parte 18C – Regra Única de Saldo Inicial na Importação de Extratos)
**Histórico de Alterações Recentes:**
- **O que foi feito:**
  - **Parte 18C – Regra Única de Saldo Inicial na Importação de Extratos Bancários (Substitui 17B, 15J e 16D)**:
    - **Problema resolvido**: Eliminação dos múltiplos mecanismos sobrepostos de ajuste de saldo inicial (alerta de dupla contagem, ajuste de data do saldo inicial, "corrigir saldo inicial agora", ajuste pós-importação) que causavam divergências e inconsistências no saldo contábil.
    - **REGRA ÚNICA**:
      - `saldo_inicial = saldo_real_informado − (soma de TODOS os lançamentos pagos da conta com data ≤ data do saldo informado, já incluindo os que serão gravados pelo extrato e considerando entradas positivas e saídas negativas)`.
      - `data_saldo_inicial = dia anterior ao lançamento mais antigo da conta`.
      - Origem da informação (em ordem de precedência): (1) LEDGERBAL do OFX (valor e data do arquivo); (2) valor digitado pelo usuário com a data (padrão: último dia do extrato).
      - Conversão do saldo "disponível" (inclui cheque especial): `saldo_real = disponível − limite da conta` quando a opção explícita "este valor inclui o limite" estiver marcada.
    - **18C.1 – Função Pura Única (`src/utils/extrato/saldoInicialHelper.ts`)**:
      - `calcularSaldoInicialPrimeiraImportacao`: calcula estritamente o novo saldo inicial e a nova data com deduplicação por ID.
      - `conferirSaldoFinal`: validação com tolerância de R$ 0,01.
      - `subtrairUmDia`, `converterDisponivelParaSaldoReal`, `contaTemLancamentosImportados`.
      - Stubs legados anotados como `@deprecated` mantidos para retrocompatibilidade de testes anteriores.
    - **18C.2 – Aplicação Exclusiva na PRIMEIRA Importação (`src/services/storage.ts`)**:
      - `importarExtratoLote`: verifica se a conta possui importações anteriores (`!contaTemLancamentosImportados`). Se for a primeira importação e houver saldo informado, aplica a Regra Única DEPOIS de confirmar a persistência dos lançamentos no servidor.
      - Importações seguintes: NUNCA alteram `saldo_inicial` nem `data_saldo_inicial`.
      - Movimentações Contamax: se ignoradas, não entram na soma (o saldo inicial calculado absorve a diferença e o saldo final se mantém correto); se lançadas como transferência, entram na soma normalmente.
      - Conferência pós-gravação: se `saldo_real_app !== saldo_informado`, avisa em `erroConferenciaSaldo` sem tentar corrigir sozinho.
    - **18C.3 – Desfazer Lote com Restauração Fiel**:
      - `desfazerImportacao`: restaura `saldo_inicial` e `data_saldo_inicial` anteriores gravados no snapshot do lote caso o lote tenha definido o saldo inicial.
    - **18C.4 – Interface de Revisão e Modal Simplificados (`RevisaoExtrato.tsx` e `ImportarExtratoModal.tsx`)**:
      - `RevisaoExtrato.tsx`: campos para informar saldo do banco, data e flag de saldo disponível, aviso de absorção para Contamax ignorado, remoção de modais/alertas legados sobrepostos.
      - `ImportarExtratoModal.tsx`: remoção do modal de pós-ajuste de saldo inicial e botões de reconciliação automática; exibição apenas comparativa no Passo 3 ("Saldos Idênticos!" ou "Divergência de R$ X entre o saldo do app e o extrato. Nenhuma correção automática aplicada.").
    - **18C.5 – Suite de Testes Automatizados (`scripts/test_parte_18C.ts`)**:
      - 30 asserções cobrindo todos os cenários exigidos:
        - (a) Conta com saldo real informado 1.234,56 e extrato de 7 dias;
        - (b) OFX com LEDGERBAL -7.377,22 e 400 transações → saldo inicial -6.803,58 em 02/08/2026;
        - (c) XLSX de 1.682 linhas com saldo informado;
        - (d) Saldo disponível com limite 8.800 convertido para saldo real;
        - (e) Segunda importação preservando saldo inicial e data intactos;
        - (f) Contamax ignorado vs como transferência;
        - (g) Desfazer restaurando saldo inicial e data anteriores.
      - Resultado: **30/30 aprovados (100%)**.
    - **Verificações de Qualidade**:
      - `tsc --noEmit`: 0 erros.
      - `npm run build`: verde (Vite gerou bundle com sucesso).
      - `npm run test:18a`: 67/67 aprovados (100%).
      - `npm run test:18b`: 88/88 aprovados (100%).
      - `npm run test:18c`: 30/30 aprovados (100%).
  - **Data e hora da alteração**: 23/10/2026 09:45:00
  - **Arquivos modificados**:
    - `src/utils/extrato/saldoInicialHelper.ts`
    - `src/services/storage.ts`
    - `src/types/index.ts`
    - `src/components/extrato/RevisaoExtrato.tsx`
    - `src/components/ImportarExtratoModal.tsx`
    - `scripts/test_parte_18C.ts` *(novo)*
    - `package.json` *(script test:18c)*
    - `RESUMO_MESTRE.md`

- **Histórico de Alterações Anteriores:**
  - **Parte 18B – Limpeza de Histórico Órfão de Contas Bancárias**:
    - **Objetivo**: Remover lançamentos, lotes de importação e regras órfãos que já haviam ficado no banco (com `conta_id` apontando para contas que não existem mais, como a conta excluída em 22/10).
    - **Regra do usuário implementada**: Ao limpar órfãos, dados válidos de contas existentes jamais são apagados e seus saldos permanecem 100% inalterados. Lançamentos órfãos com transferência ligada a contas existentes só são removidos sob escolha explícita, desvinculando a contrapartida para evitar ponteiros fantasmas.
    - **18B.1 – Novos tipos em `src/types/index.ts`**:
      - `TransferenciaOrfaInfo`: Metadados da transferência, conta inexistente, conta existente, saldo e aviso de efeito inalterado.
      - `GrupoOrfao`: Agrupamento por `conta_id` inexistente com quantidade, período (menor e maior data), totais de entradas e saídas, contagem de lotes e regras órfãos e transferências vinculadas.
      - `ContaExistenteImpactoOrfao`: Contas bancárias existentes afetadas com quantidade de transferências e saldo atual intacto.
      - `DryRunLimparOrfaos`: Contadores gerais, agrupamento por conta morta, transferências mapeadas e flag `tem_orfaos_para_limpar`.
      - `ParamsLimparOrfaos`: Exigência de digitação de "LIMPAR" e opção explícita `removerOrfaosComTransferencia`.
      - `ResultadoLimparOrfaos`: Contadores de excluídos, preservados, lotes, regras e contrapartidas desvinculadas.
    - **18B.2 – Funções em `src/services/storage.ts`**:
      - `simularLimpezaOrfaos(opcoes)` (Dry-Run): Identifica lançamentos, lotes e regras órfãos no cache; agrupa por `conta_id` inexistente com período e totais; mapeia transferências vinculadas a contas existentes; calcula saldos e confirma que o impacto no saldo das contas existentes é nulo (inalterado).
      - `limparHistoricoOrfao(params)` (Execução Definitiva): Restrito a administradores; validação estrita da palavra "LIMPAR"; download automático prévio de backup completo em JSON; apaga em lotes de até 490 via `writeBatch` com `await`; preserva órfãos vinculados caso não haja escolha explícita; desvincula contrapartidas nas contas existentes (`transferencia_vinculada_id: ''`); atualiza caches por ID; registra auditoria (`modulo: 'contas', acao: 'exclusao'`); notifica ouvintes reativos.
    - **18B.3 – Novo componente `src/components/ModalLimparOrfaos.tsx`**:
      - Interface completa de 4 etapas (`simulando`, `confirmacao`, `executando`, `resultado`).
      - Visualização amigável caso não haja órfãos no banco.
      - Cards com totais gerais e lista sanfonada/detalhada por grupo de conta inexistente.
      - Bloco de alerta e tabela de transferências vinculadas a contas existentes, com seus saldos inalterados e checkbox de escolha explícita.
      - Input de confirmação obrigatório exigindo a palavra "LIMPAR".
      - Download de backup automático antes da deleção.
    - **18B.4 – Integração em `src/pages/ContasBancarias.tsx`**:
      - Botão "Limpar Histórico Órfão" adicionado na barra superior de ações, condicionado a `isAdmin`.
      - Modal instanciado e integrado reativamente.
    - **18B.5 – Suite de testes `scripts/test_parte_18B.ts`** (1064 linhas, 88 asserções): **88/88 passando (100%)** com `npx tsx scripts/test_parte_18B.ts` (`npm run test:18b`). Cobre controle de acesso de admin, identificação e agrupamento de órfãos (incluindo conta de 22/10), período e entradas/saídas, transferências vinculadas, impacto de saldo inalterado, confirmação "LIMPAR", regra de preservação sem escolha explícita, exclusão segura com escolha explícita, integridade total de dados válidos, lotes grandes de até 490 e guardrails de segurança.
    - **Verificações de Qualidade**:
      - `tsc --noEmit` (lint): 0 erros.
      - `npm run build`: verde.
      - `npm run test:18a`: 67/67 aprovados (100%).
      - `npm run test:18b`: 88/88 aprovados (100%).
  - **Data e hora da alteração**: 23/10/2026 09:00:00
  - **Arquivos modificados**:
    - `src/types/index.ts`
    - `src/services/storage.ts`
    - `src/pages/ContasBancarias.tsx`
    - `src/components/ModalLimparOrfaos.tsx` *(novo)*
    - `scripts/test_parte_18B.ts` *(novo)*
    - `package.json` *(script test:18b)*
    - `RESUMO_MESTRE.md`

- **Histórico de Alterações Anteriores:**
  - **Parte 18A – Exclusão Completa e Segura de Conta Bancária (sem deixar órfãos)**:
    - **Causa raiz resolvida**: `deleteContaBancaria` apagava apenas o documento da conta; lançamentos, lotes de importação, regras e registros de folha com `conta_id` da conta deletada permaneciam órfãos no Firestore, distorcendo saldos e relatórios.
    - **Regra do usuário implementada**: ao excluir uma conta, **todo o histórico dela some**. Nenhum dado fica órfão.
    - **18A.1 – Novos tipos em `src/types/index.ts`** (+52 linhas): `ImpactoOutraContaExclusao`, `DryRunExclusaoConta`, `ParamsExclusaoConta`, `ResultadoExclusaoConta`.
    - **18A.2 – Funções em `src/services/storage.ts`** (+438 linhas):
      - `isUsuarioAdmin()`: helper para verificar papel de administrador.
      - `deleteContaBancaria` (guardrail): bloqueia exclusão direta se a conta tiver lançamentos.
      - `getLancamentos` (proteção de órfãos): filtra automaticamente lançamentos cujo `conta_id` não existe mais em `cacheContas`. Flag `incluirOrfaos: true` para auditoria explícita.
      - `simularExclusaoConta(contaId, opcoes)` – DRY-RUN: discrimina lançamentos (importados, manuais, pendentes, folha, transferências), detecta contrapartidas em outras contas via `transferencia_vinculada_id`, calcula saldo antes/depois de cada conta afetada, conta lotes e regras de importação, registros de folha afetados, bloqueia por padrão se houver transferências.
      - `excluirContaBancariaCompleta(params)` – EXCLUSÃO REAL (async): valida admin + nome, roda dry-run, dispara download de backup completo em JSON, exclui em lotes de até 490 via `writeBatch`, apaga a conta por último, atualiza caches, registra auditoria, notifica ouvintes.
    - **18A.3 – Novo componente `src/components/ModalExcluirConta.tsx`** (469 linhas): Modal de 4 etapas (simulando → confirmacao → executando → resultado) com discriminação completa, tabela de impacto em outras contas, checkbox explícito para contrapartidas, validação de nome em tempo real.
    - **18A.4 – Integração em `src/pages/ContasBancarias.tsx`** (+23 linhas): `handleExcluirConta` abre o modal em vez de `confirm()` nativo.
    - **18A.5 – Suite de testes `scripts/test_parte_18A.ts`** (1038 linhas, 67 asserções): **67/67 passando (100%)** com `npx tsx`. Cobre dry-run, bloqueio, contrapartidas, validação de nome, restrição de admin, resiliência a falhas no lote, exclusão ponta a ponta, proteção de órfãos.
    - **tsc --noEmit**: sem erros. **npm run build**: verde.
  - **Data e hora da alteração**: 23/10/2026 08:30:00
  - **Arquivos modificados**:
    - `src/types/index.ts` *(+52 linhas)*
    - `src/services/storage.ts` *(+438 linhas)*
    - `src/pages/ContasBancarias.tsx` *(+23 linhas)*
    - `src/components/ModalExcluirConta.tsx` *(novo — 469 linhas)*
    - `scripts/test_parte_18A.ts` *(novo — 1038 linhas, 67 testes)*
    - `package.json` *(script test:18a)*
    - `RESUMO_MESTRE.md`

---

- **Alterações Anteriores:**
  - **Parte 16F – Diagnóstico e Teste de Regressão Completo de Importações em Sequência** (22/10/2026 18:10:00): 58 testes automatizados, 100% passando.
  - **Parte 16E – Preservação e Exibição das Informações do Extrato nos Lançamentos Importados**:
    - **Causa raiz resolvida**: Ao importar um extrato bancário, o lançamento criado só guardava "descrição original - favorecido" na descrição. Documento, FITID, histórico original do banco, arquivo de origem, banco, lote e data/hora da importação não ficavam acessíveis ao usuário, impossibilitando rastreabilidade e auditoria.
    - **16E.1 (Helper `src/utils/extrato/observacoesHelper.ts` – novo arquivo)**:
      - `formatarObservacoesImportacao`: gera bloco legível estruturado com histórico original, favorecido/contraparte, documento, FITID, banco (nome+código), arquivo, formato, lote e data/hora da importação.
      - `gerarDescricaoCurta`: produz descrição curta e limpa ("Tipo Operação - Favorecido") sem duplicar informações, usando regex para identificar prefixos bancários comuns (Pix, TED, DOC, Pagamento, Tarifa etc.).
      - `complementarObservacoesEnriquecimento`: ao enriquecer OFX×XLSX, adiciona bloco "[Origem: Extrato Bancário - Enriquecimento]" preservando integralmente o texto prévio do usuário.
      - `extrairCamposOrigem`: extrai de forma estruturada os campos de origem de um lançamento a partir das observações e/ou do objeto `origem_importacao`.
      - `obterNomeBanco`: mapeia códigos de banco para nomes legíveis (Santander, Bradesco, Itaú etc.).
    - **16E.2 (Novos campos em `src/types/index.ts`)**:
      - `OrigemImportacao` recebeu: `nome_arquivo`, `data_importacao`, `documento`, `contraparte`, `descricao_original`.
      - `ParamsImportacaoLote` recebeu: `bancoNome` (opcional) e `documento` dentro de `transacao`.
      - `RegistroImportacao.snapshot_enriquecidos` recebeu `observacoesAnterior` (para restauração perfeita via desfazer).
    - **16E.3 (Gravação completa em `src/services/storage.ts`)**:
      - `importarExtratoLote` agora chama `gerarDescricaoCurta` + `formatarObservacoesImportacao` ao criar cada novo lançamento, preenchendo `descricao` (curta/limpa) e `observacoes` (bloco completo com todos os metadados).
      - No enriquecimento (vincular), chama `complementarObservacoesEnriquecimento` para adicionar metadados sem apagar o que o usuário já escreveu; grava `observacoesAnterior` no snapshot do lote.
      - No `desfazerImportacao`, restaura `observacoes` a partir do snapshot para reverter perfeitamente o enriquecimento.
    - **16E.4 (Exibição na lista `src/pages/Lancamentos.tsx`)**:
      - Badge "Importado • Banco • Formato • Data" (roxo/purple) exibido em linha para todos os lançamentos com `origem === 'importacao'`.
      - Botão "Detalhes" com ícone History e chevron animado abre painel expansível com grid de 4 cards: Histórico Original do Banco, Favorecido/Contraparte, Nº Documento/FITID, Arquivo & Lote de Origem. Abaixo: campo observações completo em `<pre>` formatado.
      - Novos filtros: **Filtro de Origem** ("Todas as Origens" / "Extratos Bancários (Importados)") e **Filtro de Lote de Importação** (dropdown dinâmico com todos os lotes disponíveis).
      - **Proteção de filtro de período**: quando um lote específico está selecionado, o filtro de período não descarta lançamentos antigos do lote (evita que transações de datas históricas sumam).
      - Busca aprimorada: pesquisa agora inclui FITID, documento, contraparte, descrição original e nome do arquivo.
    - **16E.5 (Prévia na Revisão `src/components/extrato/RevisaoExtrato.tsx`)**:
      - Na tabela de revisão (antes de confirmar a importação), cada linha mostra: "Grava: [descrição curta]" + botão "Conferir" que abre tooltip dark mostrando a descrição curta e o bloco completo das observações que serão gravadas.
    - **16E.6 (Suite de Testes Automatizados em `scripts/test_parte_16E.ts`)**:
      - 50 asserções em 6 seções:
        1. Helpers puros (descrição curta, nomes de banco, formatação)
        2. Lançamento OFX: observações completas com todos os campos
        3. Lançamento XLSX: campos disponíveis sem "undefined"
        4. Enriquecimento OFX×XLSX: preservação do texto do usuário + bloco de enriquecimento
        5. Desfazer importação: restauração perfeita de descrição e observações via snapshot
        6. Proteção de filtro de período por lote
      - **100% de aprovação (50 PASSARAM / 0 FALHARAM)**. TypeScript (`npx tsc --noEmit`) sem erros.
  - **Data e hora da alteração**: 22/10/2026 17:31:00
  - **Arquivos modificados**:
    - `src/utils/extrato/observacoesHelper.ts` *(novo)*
    - `src/types/index.ts`
    - `src/services/storage.ts`
    - `src/pages/Lancamentos.tsx`
    - `src/components/extrato/RevisaoExtrato.tsx`
    - `src/components/ImportarExtratoModal.tsx`
    - `scripts/test_parte_16E.ts` *(novo)*
    - `RESUMO_MESTRE.md`

---

- **Alterações Anteriores:**
  - **Parte 16D – Prevenção de Alteração Indevida de Saldo da Conta em Importações**:
    - **Causa raiz resolvida**: O cálculo de dupla contagem e sugestão de alteração de saldo inicial era oferecido indiscriminadamente em qualquer importação, inclusive nas subsequentes à primeira. Quando transações Contamax eram marcadas como "Ignorar", a diferença financeira do Contamax (aplicações/resgates não contabilizados no app) era absorvida incorretamente pelo cálculo de ajuste de saldo inicial, distorcendo o saldo retroativo e o histórico contábil da conta. Além disso, checkboxes e botões de ajuste de saldo podiam induzir o usuário a alterar o saldo da conta em importações cotidianas.
    - **16D.1 (Restrição de Sugestão de Ajuste de Saldo Inicial)**:
      - O ajuste de saldo inicial só é oferecido quando: (a) a conta ainda não tem lançamentos importados anteriores (primeira importação da conta), ou (b) o usuário solicitar explicitamente "Reconciliar com o banco".
      - Em importações subsequentes à primeira, o sistema **NÃO sugere** mudar o saldo inicial: exibe exclusivamente um comparativo neutro e informativo ("Saldo no app × Saldo do banco" e a diferença), mantendo o saldo inicial 100% inalterado.
    - **16D.2 (Análise Estritamente com Dados Frescos)**:
      - A análise de saldo e detecção de importações anteriores utiliza o banco de dados em tempo real (`dbService.getLancamentos()`) e o estado atual dos itens recém-classificados na sessão. Rascunhos antigos não podem contaminar ou burlar essa verificação.
    - **16D.3 (Isolamento Financeiro do Contamax em "Ignorar")**:
      - Em `saldoInicialHelper.ts`, a função `analisarDuplaContagemSaldoInicial` agora recebe `impactoContamaxIgnorado`. Quando o Contamax está em modo "Ignorar", a diferença explicada exclusivamente pelo Contamax é isolada (`divergenciaExclusivaContamax = true`).
      - O sistema explica claramente: *"Diferença de R$ X corresponde aos lançamentos de aplicação ignorados"* e **NÃO** trata essa divergência como erro de saldo inicial, impedindo qualquer absorção indevida dessa diferença no saldo retroativo.
    - **16D.4 (Checkbox "Ajustar saldo inicial da conta para bater com o banco" com Padrão Seguro)**:
      - O checkbox só vem **MARCADO POR PADRÃO** se for a primeira importação da conta E se o saldo inicial da conta for zero/vazio.
      - Em qualquer outro caso (segunda importação em diante, ou conta com saldo inicial já preenchido), o checkbox vem **DESMARCADO POR PADRÃO**, exigindo ação consciente e deliberada do usuário para qualquer modificação.
    - **16D.5 (Proteção e Reconciliação no Passo 3 em `ImportarExtratoModal.tsx`)**:
      - O painel de conciliação pós-lote no Passo 3 audita se a conta já possuía lançamentos de outros lotes. Em importações subsequentes com diferença, exibe card informativo em tom neutro informando que o saldo inicial não é alterado para preservar o histórico, fornecendo botão explícito "Reconciliar com o banco" caso o usuário deseje alinhar.
    - **16D.6 (Suite de Testes Automatizados em `scripts/test_parte_16D.ts`)**:
      - 23 asserções automatizadas cobrindo os 6 cenários exigidos:
        - Cenário A: 1ª importação com saldo zero (detecta menor data, calcula saldo sugerido, sem lançamentos prévios).
        - Cenário B: 2ª importação com lançamentos prévios (isolamento de conta e não oferece alteração arbitrária).
        - Cenário C: Contamax em "Ignorar" (gera `divergenciaExclusivaContamax = true`, `diferencaReal = 0`, mantém `saldoInicialSugerido` inalterado).
        - Cenário D: Contamax em "Transferência" (análise contábil limpa sem distorção).
        - Cenário E: Desfazer importação 2 preserva integralmente os lançamentos da importação 1.
        - Cenário F: Reimportar o mesmo arquivo resulta em 0 novas transações por deduplicação.
      - 100% de aprovação (`23 PASSARAM / 0 FALHARAM`).
      - TypeScript (`npx tsc --noEmit`) sem erros e build de produção (`npm run build`) validado.
  - **Data e hora da alteração**: 21/10/2026 06:45:00
  - **Arquivos modificados**:
    - `src/utils/extrato/saldoInicialHelper.ts`
    - `src/components/extrato/RevisaoExtrato.tsx`
    - `src/components/ImportarExtratoModal.tsx`
    - `scripts/test_parte_16D.ts`
    - `package.json`
    - `RESUMO_MESTRE.md`

---

- **Alterações Anteriores:**
  - **Parte 16C – Gravação de Lote Confiável, Verificável e Resiliente**:
    - **Causa raiz resolvida**: Em `storage.ts > importarExtratoLote`, o ajuste de `saldo_inicial` e `data_saldo_inicial` da conta bancária era executado de forma síncrona/sem `await` antes da gravação dos lançamentos e mutando o cache em memória; em caso de falha de rede/permissão, a conta ficava alterada. Atualizações de lançamentos enriquecidos usavam `batch.update`, que falhava se o documento não existisse. Não havia verificação pós-commit da contagem no servidor e erros de rede/permissão eram silenciados ou mal traduzidos.
    - **16C.1 (Ordem Estrita de Execução Transacional em `storage.ts`)**:
      - Fluxo reordenado: Validar parâmetros → Gravar novos lançamentos e regras em batches atômicos com `merge: true` → Confirmar com `batch.commit()` → Auditar pós-commit → **SÓ ENTÃO** aplicar o ajuste de saldo inicial e data com `await this.saveContaBancaria(...)` sobre cópia imutável da conta, sem mutar o objeto original nem o cache. Se qualquer etapa anterior falhar, a conta permanece 100% inalterada e o lote é marcado como `'parcial'`.
    - **16C.2 (Resiliência no Enriquecimento / Vinculação)**:
      - Antes de enriquecer, o sistema valida a existência do lançamento alvo no cache/base. Caso o documento não exista, a operação não derruba o lote: o item é pulado, contabilizado como ignorado e registrado na lista de avisos (`avisos`). No Firestore, a operação utiliza `set` com `{ merge: true }`, prevenindo erros de documento ausente.
    - **16C.3 (Conferência Pós-Commit no Firestore por `lote_id`)**:
      - Após a confirmação dos batches, realiza leitura no Firestore (`where('origem_importacao.lote_id', '==', loteId)`) e compara a quantidade de documentos confirmados pelo servidor com os lançamentos esperados. Em caso de divergência, emite erro descritivo, marca o lote como `'parcial'` e impede a alteração indevida da conta.
    - **16C.4 (Tradução e Tratamento Amigável de Erros)**:
      - Criada função auxiliar `traduzirErroFirestore` mapeando códigos e mensagens comuns de Firebase/Firestore (`permission-denied`, `unavailable`, `offline`, `resource-exhausted`, `deadline-exceeded`) para mensagens em português claras e amigáveis, exibidas com destaque no modal (Passo 3), sem silenciar exceções.
    - **16C.5 (Transparência no Resultado do Passo 3 em `ImportarExtratoModal.tsx`)**:
      - Cards de totais atualizados para destacar:
        - Transações Lançadas / Gravadas com badge de confirmação no servidor (`✓ X confirmados no servidor`).
        - Transações Enriquecidas e Vinculadas.
        - Transações Duplicadas discriminadas.
        - Transações Ignoradas discriminadas.
        - Painel de Avisos em destaque âmbar listando pendências ou avisos gerados durante a gravação.
        - Banner de alerta visual caso o lote tenha terminado como `'parcial'`.
    - **16C.6 (Testes com Simulador em `scripts/test_parte_16C.ts`)**:
      - 25 asserções automatizadas cobrindo:
        - Cenário 1: Falha no meio do batch não altera `saldo_inicial` nem data da conta bancária (lote fica 'parcial').
        - Cenário 2: Lançamento a enriquecer inexistente não derruba o lote, registra aviso e grava os demais.
        - Cenário 3: Divergência na contagem pós-commit detecta discrepância, marca 'parcial' e preserva a conta.
        - Cenário 4: Sucesso completo confirma no servidor e aplica o ajuste da conta bancária somente no final.
      - 100% de aprovação (`25 PASSARAM / 0 FALHARAM`).
      - TypeScript (`npx tsc --noEmit`) sem erros e build de produção (`npm run build`) validado com sucesso.
  - **Data e hora da alteração**: 21/10/2026 06:15:00
  - **Arquivos modificados**:
    - `src/services/storage.ts`
    - `src/types/index.ts`
    - `src/components/ImportarExtratoModal.tsx`
    - `scripts/test_parte_16C.ts`
    - `package.json`
    - `RESUMO_MESTRE.md`

---

- **Alterações Anteriores:**
  - **Parte 16B – Rascunho de Revisão Baseado na Identidade do Arquivo e Proteção Contra Duplicações**:
    - **Causa raiz resolvida**: A chave de rascunho no `localStorage` dependia exclusivamente do ID da conta (`mtsolar_extrato_draft_${contaId}`), fazia restauração indiscriminada e nunca era apagada após a conclusão da revisão. Ao importar um segundo extrato diferente para a mesma conta, o rascunho anterior reaproveitava dados antigos marcados como `"nova"`, ignorando o arquivo novo ou duplicando lançamentos caso fosse concluído.
    - **16B.1 (Chave por Identidade do Arquivo em `RevisaoExtrato.tsx`)**:
      - Implementada a função determinística de hash `calcularHashExtrato`: concatena contas envolvidas, códigos de banco, datas de início e fim do período, quantidade de transações e a soma dos valores com algoritmo djb2, gerando chave exclusiva no padrão `mtsolar_extrato_draft_v2_${hash}`. Dois extratos diferentes para a mesma conta jamais compartilham rascunho.
    - **16B.2 (Formato de Rascunho v2 Contendo Apenas Escolhas do Usuário)**:
      - O rascunho agora armazena estritamente as preferências e classificações informadas pelo usuário: dicionário `Record<string, EscolhaRascunho>` indexado pelo `idTemporario` contendo `categoriaId`, `categoriaNome`, `projetoId`, `contatoId`, `acao`, `tipoLancamento`, `lembrarRegra`, além de `tratamentoContamax` e `contaAplicacaoId`.
      - **Nunca** persiste `statusDeduplicacao` ou metadados de regras: o status de deduplicação é recalculado a quente contra o banco de dados atual a cada abertura.
    - **16B.3 (Proteção Contra Falsos Positivos e Duplicações)**:
      - Na restauração do rascunho, a escolha antiga do usuário só é reaplicada se a transação continuar classificada como `'nova'`. Se o lançamento tiver sido registrado no banco de dados entre sessões e for detectado como `'duplicada_exata'`, a escolha antiga de `'incluir'` é ignorada e a transação permanece com ação segura `'ignorar'`.
      - Exibido banner com data de gravação do rascunho e botões "Manter Rascunho" ou "Descartar", além de avisos não intrusivos.
    - **16B.4 (Exclusão Oportuna e Limpeza)**:
      - Rascunho atual é removido imediatamente do `localStorage` no momento em que o usuário clica em "Concluir Revisão e Lançar" (`handleConfirmarRevisao`) e quando clica no botão "Descartar".
      - No `ImportarExtratoModal.tsx`, ao acionar "Desfazer Importação" com sucesso, rascunhos pendentes são limpos.
      - Na inicialização, rascunhos antigos (> 14 dias) e chaves da versão antiga v1 (`mtsolar_extrato_draft_*` sem `_v2_`) são automaticamente expurgados.
    - **16B.5 (Testes Automatizados em `scripts/test_parte_16B.ts`)**:
      - 12 asserções cobrindo: cálculo determinístico de hash, isolamento entre arquivos distintos da mesma conta, formato seguro v2 sem status de deduplicação, proteção contra reaplicação em duplicatas e política de retenção de 14 dias. 100% de aprovação (`12 PASSARAM / 0 FALHARAM`).
      - TypeScript (`npx tsc --noEmit`) sem erros e suítes das Partes 15 e 16 100% aprovadas.
  - **Arquivos modificados:**
    - `src/components/extrato/RevisaoExtrato.tsx`
    - `src/components/ImportarExtratoModal.tsx`
    - `scripts/test_parte_16B.ts`
    - `package.json`
    - `RESUMO_MESTRE.md`

---

- **Alterações Anteriores:**
  - **Parte 16A – Correção de Layout da Tela de Revisão do Extrato (somente layout, sem alteração de regras de negócio)**:
    - **`src/components/ImportarExtratoModal.tsx`**: Passo 2 (Revisão e Categorização) agora é renderizado em **tela cheia** (`fixed inset-0 z-50 h-[100dvh]`) em vez de ser encapsulado pelo `Modal.tsx` com `max-h-[80vh]`. O overlay possui cabeçalho fixo com título e botão de fechar, e área central com `flex-1 min-h-0 overflow-hidden` que contém o `RevisaoExtrato`. Passos 1 e 3 continuam usando o `Modal` padrão.
    - **`src/components/extrato/RevisaoExtrato.tsx`**: Reestruturado o container raiz para `flex flex-col h-full min-h-0 flex-1 overflow-hidden space-y-2`. Todos os blocos estáticos (cabeçalho com metadados + contadores, bloco Contamax recolhível, filtros/busca) receberam `shrink-0` para não competir pela altura. O container da tabela (`flex-1 min-h-0 overflow-auto`) ocupa todo o espaço restante; apenas ele tem rolagem. O rodapé (paginação + "Concluir Revisão e Lançar") ficou fora do container da tabela para nunca ser encoberto.
    - **Bloco Contamax**: Recolhível por padrão (`contamaxRecolhido = true`); exibe resumo em 1 linha quando recolhido, com botão "Configurar" para expandir.
    - **Filtros Avançados**: Permanecem recolhíveis via botão com ícone `SlidersHorizontal`; o painel expande abaixo da barra de busca sem empurrar a tabela.
    - Build de produção validado (`npm run build`) sem erros de TypeScript ou Vite.
  - **Arquivos modificados:**
    - `src/components/ImportarExtratoModal.tsx`
    - `src/components/extrato/RevisaoExtrato.tsx`
    - `RESUMO_MESTRE.md`

---

- **Alterações Anteriores:**
  - **Consolidação do Módulo de Importação de Extratos (Partes 15A a 15J) e Limpeza**:
    - Removido script temporário `scripts/auditoria_reparo_importacoes.ts` e comandos `auditar:importacao` / `reparar:importacao` do `package.json`, uma vez que a auditoria e reparo com isolamento foram incorporados diretamente na interface visual de produção através do módulo de Reinício Seguro de Conta (Parte 15I);
    - Confirmada ausência de referências a esses scripts em todo o projeto via verificação estrita (`grep`);
    - Validadas todas as suítes de testes (`test:isolamento`, `test:15h`, `test:15i`, `test:15j`), tipagem TypeScript (`npx tsc --noEmit`) e compilação de produção (`npm run build`).
  - **Arquivos removidos:** `scripts/auditoria_reparo_importacoes.ts`.
  - **Arquivos modificados:** `package.json`, `RESUMO_MESTRE.md`.

---

- **Alterações Anteriores:**
  - **Parte 15I – Reinício Seguro de Conta para Reimportação de Extratos**:
    - **15I.1 (Simulação Dry-Run em `src/services/storage.ts`)**:
      - Função `simularReinicioConta({ contaId, zerarSaldoInicial, novaDataSaldoInicial })`:
        - Localiza com precisão todos os lançamentos com `origem === 'importacao'` ou com vínculo a lotes da conta;
        - Identifica contrapartidas de transferências de importação na conta e nas contas secundárias afetadas;
        - Identifica lançamentos de ajuste de conciliação associados a lotes de importação;
        - Identifica todos os lotes de importação ativos da conta na coleção `importacoes`;
        - Computa saldos antes e depois da conta principal e calcula o impacto exato nas contas secundárias envolvidas em transferências;
        - Discrimina com exatidão a contagem de lançamentos que serão **PRESERVADOS** (manuais, folha de pagamento, contas a pagar/receber e transferências manuais).
    - **15I.2 (Backup Obrigatório e Execução em Lote em `src/services/storage.ts`)**:
      - Função `executarReinicioConta({ contaId, zerarSaldoInicial, novaDataSaldoInicial })`:
        - Gera e dispara o download automático do backup completo em JSON (`backup_antes_reinicio_[CONTA]_[TIMESTAMP].json`) via `exportarBackupCompletoJSON()` antes de qualquer operação de gravação;
        - Remove em lotes seguros do Firestore (`writeBatch` de até 490 documentos) apenas os lançamentos de importação identificados;
        - Marca os lotes de importação da conta como `'desfeita'`;
        - Aplica opcionalmente a limpeza do `saldo_inicial` (zerando para R$ 0,00 e atualizando `data_saldo_inicial`) quando selecionado pelo usuário;
        - Atualiza caches locais na memória e notifica reatividade (`notify('lancamentos')`, `notify('contas')`, `notify('importacoes')`);
        - Registra a ação na coleção de auditoria (`RegistroAuditoria`).
    - **15I.3 (Interface Visual em `src/components/ModalReinicioConta.tsx`)**:
      - Modal de 2 passos claros: Simulação (Dry-Run detalhado) + Confirmação Crítica;
      - Exige digitação exata do nome da conta bancária como trava contra acionamentos acidentais;
      - Apresenta métricas visuais claras: total de lançamentos a remover, transferências geradas, lotes e ajustes;
      - Apresenta tabela com resumo dos itens estritamente preservados (manuais, folha e transferências manuais);
      - Exibe tabela de impacto financeiro (Saldo Antes, Saldo Depois, Diferença) para a conta e para contas secundárias afetadas;
      - Exibe opção configurável com checkbox para zerar também o saldo inicial da conta (com seletor de nova data);
      - Apresenta tela de conclusão com balanço final e resumo dos saldos recalculados.
    - **15I.4 (Controle de Acesso e Integração em `src/pages/ContasBancarias.tsx` e `src/components/CaixaCard.tsx`)**:
      - Ação "Preparar para reimportar extrato" disponibilizada no `CaixaCard` individual de cada conta bancária;
      - Restrição estrita de visibilidade e execução exclusiva para administradores (`admin`), oculta para outros papéis;
      - Estado `contaParaReiniciar` gerenciado transparentemente na página `ContasBancarias`.
    - **15I.5 (Tipagem e Padronização em `src/types/index.ts`)**:
      - Interfaces `DryRunReinicioConta`, `ResultadoReinicioConta`, `ImpactoContaReinicio`, `PreservadosReinicioConta` e `ResumoSaldoContaPosReinicio` padronizadas em snake_case;
      - Resolução de conflitos de definições prévias e harmonização com o modelo do Firestore.
    - **15I.6 (Suíte de Testes Automatizados em `scripts/test_parte_15I.ts`)**:
      - Criada suíte hermética `scripts/test_parte_15I.ts` (`npm run test:15i`) com **35 testes automatizados cobrindo todos os cenários (35 PASSOU / 0 FALHOU)**:
        - *Cenário 1*: Dry-run com discriminação precisa de remoção vs preservação, impacto em conta secundária e projeção de saldo;
        - *Cenário 2*: Dry-run com flag de zerar saldo inicial ativada;
        - *Cenário 3*: Execução real com remoção seletiva, desfazimento de lote, preservação intocada de manuais/folha/transferências manuais, recálculo de saldo da conta principal e da conta secundária, e isolamento de contas não envolvidas;
        - *Cenário 4*: Validações de segurança (rejeição de conta inexistente) e integridade do backup gerado.
    - **15I.7 (Qualidade e Validação)**:
      - Script `npm run test:15i` configurado no `package.json`;
      - Checagem de tipagem estrita com TypeScript aprovada (`npx tsc --noEmit` código 0);
      - Todos os testes de isolamento e etapas anteriores executados com sucesso: `test:isolamento` (17/17), `test:15h` (33/33), `test:15j` (37/37) e `test:15i` (35/35);
      - Build de produção compilado com sucesso via `npm run build` (`vite build` verde).
  - **Arquivos criados:** `src/components/ModalReinicioConta.tsx`, `scripts/test_parte_15I.ts`.
  - **Arquivos modificados:** `src/services/storage.ts`, `src/types/index.ts`, `src/pages/ContasBancarias.tsx`, `src/components/CaixaCard.tsx`, `package.json`, `RESUMO_MESTRE.md`.

---

- **Alterações Anteriores:**
  - **Parte 15J – Prevenção de Dupla Contagem do Saldo Inicial na Importação de Extratos**:
    - **15J.1 (Assistente de "Primeira Importação" em `src/components/ImportarExtratoModal.tsx`)**:
      - Quando a conta selecionada não possui lançamentos importados prévios no sistema, exibe bloco explicativo de 2 linhas destacando que o saldo inicial **NÃO** precisa ser informado manualmente e será calculado automaticamente pelo sistema com base no saldo final do banco;
      - Se a conta já tiver `saldo_inicial ≠ 0` cadastrado, pergunta expressamente: *"Este valor é o saldo de hoje/final? Se sim, ele será substituído pelo saldo calculado"*, com confirmação via checkbox, garantindo que nada seja alterado sem autorização do usuário.
    - **15J.2 (Detecção de Dupla Contagem Pré-Gravação em `src/components/extrato/RevisaoExtrato.tsx`)**:
      - Verifica se o saldo projetado da conta (saldo inicial atual + lançamentos existentes + novas movimentações do lote) difere do saldo final informado pelo banco (`LEDGERBAL`) em mais de R$ 0,01;
      - Exibe alerta visual âmbar detalhado: *"Pelo saldo do banco, o saldo inicial da conta provavelmente está errado. Saldo projetado: X; saldo do banco: Y; saldo inicial sugerido: Z"*;
      - Botão *"Corrigir saldo inicial agora"*: abre modal de confirmação transparente exibindo antes $\rightarrow$ depois do saldo inicial e data inicial (dia anterior à primeira transação), alterando **exclusivamente** os campos `saldo_inicial` e `data_saldo_inicial` da conta;
      - Botão *"Continuar sem corrigir"*: permite ao usuário ignorar o alerta sem impedimentos;
      - **Garantia estrita:** NUNCA cria lançamento de ajuste contábil fictício.
    - **15J.3 (Importação Múltipla XLSX de 365 dias + OFX de 90 dias)**:
      - O cálculo de movimentações consolida a união deduplicada dos lançamentos (Parte 15C), de modo que transações vinculadas/enriquecidas não sejam somadas em dobro;
      - O saldo final de referência é selecionado automaticamente do arquivo OFX mais recente entre os extratos carregados;
      - Para arquivos que não trazem saldo (como XLSX), exibe aviso explícito: *"Este formato não traz saldo (LEDGERBAL); use o saldo do OFX mais recente ou informe o saldo do banco numa data"*.
    - **15J.4 (Opção Alternativa para Extratos sem OFX)**:
      - Disponibilizados os campos *"Saldo do banco (R$)"* e *"Data do saldo no banco"* no modal para cálculo de saldo inicial retroativo por diferença.
    - **15J.5 (Ajuda no Formulário de Edição da Conta em `src/pages/ContasBancarias.tsx`)**:
      - Texto de instrução atualizado para: *"Saldo inicial = saldo ANTES do primeiro lançamento. Se for importar extrato, deixe 0: o app calcula sozinho"*.
    - **15J.6 (Reversibilidade Segura no Rollback em `src/services/storage.ts`)**:
      - `importarExtratoLote` armazena `saldoInicialAnteriorConta` e `dataSaldoInicialAnteriorConta` no `RegistroImportacao`;
      - `desfazerImportacao` restaura com exatidão o `saldo_inicial` e a `data_saldo_inicial` prévios da conta bancária caso tenham sido ajustados pelo assistente nesse lote.
    - **15J.7 (Módulo Auxiliar e Suíte de Testes Automatizados)**:
      - Criado `src/utils/extrato/saldoInicialHelper.ts` com funções utilitárias puras: `subtrairUmDia`, `calcularMovimentacoesConta`, `analisarDuplaContagemSaldoInicial` e `contaTemLancamentosImportados`;
      - Criada suíte `scripts/test_parte_15J.ts` (`npm run test:15j`) com **37 testes automatizados cobrindo todos os cenários (a)-(f) (37 PASSOU / 0 FALHOU)**:
        - *(a)* Conta com saldo de hoje digitado (-8.475,22) + OFX real: alerta exibido e sugestão exata de -6.803,58 em 2026-08-02;
        - *(b)* Saldo final após correção confere exatamente com LEDGERBAL (-7.377,22) sem lançamento de ajuste e conta secundária (Sicoob) 100% isolada;
        - *(c)* Importação sequencial de XLSX de 365 dias e OFX de 90 dias com união deduplicada e sem contagem dupla;
        - *(d)* Conta nova com saldo inicial 0: assistente de 1ª importação ativo e sem alerta indevido;
        - *(e)* Rollback da importação restaura fielmente o saldo inicial e data anteriores;
        - *(f)* Função de cálculo de dia anterior (`subtrairUmDia`) testada com virada de mês, ano e anos bissextos.
    - **15J.8 (Qualidade e Validação)**:
      - Script `npm run test:15j` adicionado no `package.json`;
      - Verificação estrita de TypeScript aprovada com `npm run lint` (`tsc --noEmit` código 0);
      - Build de produção validado com `npm run build` (`vite build` verde).
  - **Arquivos criados:** `src/utils/extrato/saldoInicialHelper.ts`, `scripts/test_parte_15J.ts`.
  - **Arquivos modificados:** `src/components/ImportarExtratoModal.tsx`, `src/components/extrato/RevisaoExtrato.tsx`, `src/services/storage.ts`, `src/pages/ContasBancarias.tsx`, `src/types/index.ts`, `src/utils/extrato/index.ts`, `package.json`, `RESUMO_MESTRE.md`.

---

- **Alterações Anteriores:**
  - **Parte 15H – Tratamento Seguro de Contamax, Ajuste de Saldo Inicial por LEDGERBAL e Conciliação Bancária de Extratos**:
    - **15H.1 (Seletor de Tratamento do Contamax em `src/components/extrato/RevisaoExtrato.tsx`)**:
      - Adicionado seletor visual destacado "Tratamento de Aplicações/Resgates (Contamax)" com duas opções explícitas:
        1. **Ignorar (padrão seguro)**: todas as transações com `natureza === 'movimentacao_interna'` são marcadas como `acao = 'ignorar'`, garantindo que nenhuma movimentação interna altere o saldo ou crie lançamentos espúrios sem autorização;
        2. **Transferência entre contas**: permite ao usuário escolher explicitamente a conta de aplicação/investimento de destino. Se não houver conta de investimento cadastrada, exibe aviso com instrução e atalho para cadastro.
      - **Direção correta das transferências**:
        - Aplicação (débito no extrato da CC): registra despesa de transferência na CC e receita de transferência na conta de aplicação;
        - Resgate (crédito no extrato da CC): registra receita de transferência na CC e despesa de transferência na conta de aplicação.
      - **Regras estritas de segurança invioláveis**: nenhuma conta destino é escolhida automaticamente; nenhuma transferência é gerada sem escolha explícita; nenhuma conta de terceiros é alterada.
    - **15H.2 (Ajuste do Saldo Inicial por LEDGERBAL em `src/services/storage.ts`)**:
      - Implementado `ajustarSaldoInicialPorLedgerbal(contaId, saldoDesejado, dataCorte)`:
        - Calcula o novo saldo inicial necessário para que a soma histórica dos lançamentos até a data do LEDGERBAL resulte exatamente no saldo real do banco (`novoSaldoInicial = saldoDesejado - somaLancamentosAteData`);
        - Atualiza diretamente `saldo_inicial` e `data_saldo_inicial` no registro da conta bancária no Firestore, **sem criar lançamentos contábeis espúrios** de ajuste;
        - Registra ação na trilha de auditoria (`RegistroAuditoria`).
    - **15H.3 (UI de Conciliação e Ajuste de Saldo Inicial em `src/components/ImportarExtratoModal.tsx`)**:
      - No resumo pós-importação (Passo 3), compara o saldo acumulado no App com o saldo final informado no extrato (`LEDGERBAL`).
      - Caso haja divergência, exibe banner explicativo com a diferença apurada e o botão "Ajustar Saldo Inicial da Conta".
      - Modal de confirmação seguro exibindo os valores transparentes: Saldo no App, Saldo no Banco, Diferença, e a projeção do saldo inicial (Antes -> Depois), solicitando confirmação do usuário antes de persistir o ajuste.
      - Ao concluir o ajuste, exibe confirmação visual de conciliação perfeita (diferença zerada).
    - **15H.4 (Suíte de Testes Automatizados da Parte 15H em `scripts/test_parte_15H.ts`)**:
      - 33 testes automatizados cobrindo todos os cenários (33 PASSOU / 0 FALHOU):
        - Teste 1A: Contamax ignorado por padrão — saldo correto da CC sem vazamentos;
        - Teste 1B: Contamax como transferência — direções corretas de resgate/aplicação em ambas as contas e isolamento estrito;
        - Teste 2: Ajuste de saldo inicial por LEDGERBAL — cálculo exato sem criação de lançamentos fictícios;
        - Teste 3: Comparação pós-importação e cálculo de diferença de conciliação;
        - Teste 4: Rollback seguro de lote com transferências e contas afetadas;
        - Teste 5: Deduplicação e reimportação sem impacto no saldo;
        - Teste 6: Segurança e bloqueio de Contamax sem conta destino informada.
    - **15H.5 (Compatibilidade e Tipagem)**:
      - Script `npm run test:15h` adicionado em `package.json`;
      - Checagem TypeScript 100% limpa com `npm run lint` (`tsc --noEmit`).
  - **Arquivos criados:** `scripts/test_parte_15H.ts`.
  - **Arquivos modificados:** `src/components/extrato/RevisaoExtrato.tsx`, `src/services/storage.ts`, `src/components/ImportarExtratoModal.tsx`, `package.json`, `RESUMO_MESTRE.md`.

---

- **Alterações Anteriores:**
  - **Correção Crítica do Bug de Importação de Extratos Bancários (Isolamento de Contas e Anti-Vazamento)**:
    - **Diagnóstico Completo**:
      - Identificadas as 3 causas-raiz que faziam lançamentos de extrato do Santander vazarem para outras contas ou inflacionarem o saldo da conta para R$ 92k: (1) auto-seleção de contas de poupança/investimento como destino de transações Contamax na revisão; (2) fallback de conversão de transferências sem contraparte em despesas avulsas; (3) ausência de trava pré-gravação validando o isolamento de `conta_id`.
    - **Revisão e Correção do Fluxo Contamax / Movimentação Interna (`src/components/extrato/RevisaoExtrato.tsx`)**:
      - Removida a seleção automática de conta destino para movimentações internas. Toda movimentação interna (Contamax, resgates e aplicações automáticas) inicia **obrigatoriamente como 'ignorar'** por padrão seguro.
      - Nenhuma conta cadastrada no sistema é selecionada ou afetada sem intervenção humana explícita.
    - **Trava de Segurança Estrita Anti-Vazamento (`src/services/storage.ts`)**:
      - Adicionada validação de segurança pré-persistência no `importarExtratoLote`: valida que 100% dos lançamentos pertencem à `contaId` do lote, abortando imediatamente e logando erro explícito caso qualquer item tente afetar outra conta (exceto transferência autorizada com `contaDestinoId`).
      - Tratamento seguro de `tipoLancamento === 'transferencia'`: se não houver `contaDestinoId` configurado, a transação é ignorada em vez de gerar despesa espúria. Se houver `contaDestinoId`, cria o par atômico de transferência (saída na origem e entrada no destino).
    - **Transparência e Confirmação em Destaque Âmbar na UI**:
      - `RevisaoExtrato.tsx`: adicionado bloco "Contas afetadas por esta importação" no modal de confirmação pré-gravação. Se mais de uma conta for afetada, exibe destaque âmbar e exige confirmação com checkbox obrigatório, bloqueando a gravação até aprovação.
      - `ImportarExtratoModal.tsx`: painel analítico pós-importação no Passo 3 exibindo a lista de contas afetadas com saldos antes/depois e badges de auditoria.
    - **Ferramenta de Auditoria e Reparo Seguro (`storage.auditarERepararImportacoes`)**:
      - Método no `dbService` com suporte a `dryRun: true` (padrão) para detectar lançamentos órfãos/vazados, duplicidades de fitid e despesas espúrias de Contamax, projetando o saldo recalculado de cada conta antes de aplicar qualquer alteração real.
      - Criado script CLI `scripts/auditoria_reparo_importacoes.ts` acessível via `npm run auditar:importacao` (simulação) e `npm run reparar:importacao` (aplicação).
    - **Testes Automatizados de Isolamento (`scripts/test_isolamento_importacao.ts`)**:
      - Suíte automatizada com 17 testes cobrindo os 4 cenários obrigatórios (17 PASSOU / 0 FALHOU):
        1. Importação OFX não altera saldo de outras contas cadastradas;
        2. Contamax sem conta destino não vaza para outras contas nem inflaciona saldo;
        3. Trava de segurança aborta importação com erro ao detectar `conta_id` inválido;
        4. Resumo lista corretamente as contas afetadas (tanto para 1 conta quanto para transferências legítimas de 2 contas).
  - **Arquivos criados:** `scripts/test_isolamento_importacao.ts`, `scripts/auditoria_reparo_importacoes.ts`.
  - **Arquivos modificados:** `src/components/extrato/RevisaoExtrato.tsx`, `src/components/ImportarExtratoModal.tsx`, `src/services/storage.ts`, `src/types/index.ts`, `src/lib/firebase.ts`, `package.json`, `RESUMO_MESTRE.md`.

---

- **Alterações Anteriores:**
  - **Parte 15G – Fechamento e Orquestração do Módulo de Importação de Extratos Bancários (15A a 15G)**:
    - **15G.1 (Seção "Histórico de Importações" em `src/components/extrato/HistoricoImportacoes.tsx` e `ContasBancarias.tsx`)**:
      - Sistema de navegação por abas em `ContasBancarias.tsx` ("Contas Bancárias & Saldos", "Histórico de Importações" e "Regras de Importação") com badges numéricos reativos via subscribers de eventos;
      - Listagem analítica da coleção `importacoes`: Data/Hora, Usuário responsável, Banco emissor, Conta bancária, Arquivo e formato (OFX / XLSX), Período coberto, Totais financeiros (Créditos, Débitos, Saldo antes/depois), Contadores (Lançadas, Enriquecidas, Duplicadas, Ignoradas) e Status (badge colorido: `concluida`, `parcial`, `desfeita`);
      - Ação "Desfazer Importação" com modal de confirmação de segurança exibindo o impacto exato do rollback, loading animado e recálculo automático de saldo;
      - Atalho "Ver lançamentos deste lote" filtrando os lançamentos pelo `lote_id`.
    - **15G.2 (Auditoria Obrigatória em `RegistroAuditoria`)**:
      - Tipos expandidos em `src/types/index.ts`: `modulo` suporta `'importacoes' | 'regras_importacao'` e `acao` suporta `'desfazer'`;
      - Registros de auditoria gerados em tempo real no `src/services/storage.ts`:
        - `importarExtratoLote`: registra lote importado, quantidade de lançamentos, arquivo, conta e período;
        - `desfazerImportacao`: registra lote revertido com totais de lançamentos excluídos e restaurados;
        - `saveRegraImportacao`: registra criação (`criacao`) ou atualização (`edicao`) de regra com padrão e categoria;
        - `deleteRegraImportacao`: registra exclusão (`exclusao`) de regra.
    - **15G.3 (Tela de Gerenciamento de Regras de Importação em `src/components/extrato/GerenciadorRegras.tsx`)**:
      - Listagem completa das regras cadastradas no Firestore (`regras_importacao`);
      - Filtros multifacetados: busca por padrão de texto ou categoria, status (ativas / desativadas) e banco aplicável;
      - Tabela analítica desktop e cards verticais mobile exibindo: padrão normalizado, campo (descrição / favorecido), operador (contém / começa com / igual), banco/conta, categoria sugerida, tipo (receita / despesa), contador de correspondências (`usos`) e status;
      - Ações: alternar ativação em 1 clique (`ativa`), editar em modal com `ComboboxCategoria`, excluir com confirmação e botão "+ Nova Regra" para cadastro manual preventivo.
    - **15G.4 (Conferência de Relatórios, Dashboard, Balanço e Saldos)**:
      - Lançamentos criados por importação recebem `origem: 'importacao'` e `status: 'pago'`, integrando-se naturalmente aos cálculos de saldo real, fluxo de caixa, DRE gerencial, relatórios por centro de custo/categoria e balanço patrimonial;
      - Transações de aplicação/resgate automático (ex: Contamax) recebem `natureza: 'movimentacao_interna'` e são marcadas como `acao: 'ignorar'` por padrão no `RevisaoExtrato`, impedindo que inflem receitas ou despesas;
      - Lançamentos de transferência usam `origem: 'transferencia'`, sendo filtrados nos cálculos de resultado operacional.
    - **15G.5 (Passo a Passo para Adicionar Suporte a um Novo Banco)**:
      - Documentado o guia completo e extensível:
        1. **Registro no catálogo**: Em `src/utils/extrato/bancos.ts`, adicionar o objeto em `BANCOS_REGISTRADOS` com `{ codigo, nome, aliases, suportaOfx: true, suportaXlsx: boolean, corPrimaria, regrasPadrao }`;
        2. **Suporte OFX**: Imediato e nativo para qualquer instituição bancária que emita extratos OFX 1.x ou 2.x através de `parseOfx()`;
        3. **Suporte XLSX/CSV proprietário**: Criar parser específico em `src/utils/extrato/parsers/[novobanco]Xlsx.ts` implementando a interface `ExtratoLido`, adicionando detecção de magic bytes/colunas no `detectarBanco.ts`;
        4. **Regras de Classificação do Banco**: Criar `src/utils/extrato/regras/[novobanco].ts` com expressões regulares/termos para `NaturezaTransacao` e sugestões de categorias;
        5. **Vinculação**: Importar as regras em `bancos.ts` e associar ao registro do banco;
        6. **Testes Unitários**: Adicionar cenários com amostras reais em `scripts/test_extrato_parsers.ts`.
    - **15G.6 (Suite de Testes Ponta a Ponta E2E em `scripts/test_extrato_e2e.ts`)**:
      - **37 testes automatizados cobrindo os 6 cenários com arquivos reais de `src/exemplos_extratos/` (37 PASSOU / 0 FALHOU)**:
        - (a) Importação de 1.682 transações do XLSX de 365 dias (`excel_export1792140356207.xlsx`) em 4 batches ≤ 490 com auditoria;
        - (b) Importação do OFX de 90 dias (`extrato-pj-16_10_2026_19h22m20s.ofx`) com 400 transações e extração do LEDGERBAL de -7.377,22;
        - (c) Deduplicação na janela 18/07 a 15/10 com **ZERO duplicatas** (395 enriquecimentos e apenas 5 novas do dia 16/10 não presentes no XLSX);
        - (d) Conciliação bancária perfeita zera a diferença e iguala o saldo da conta ao LEDGERBAL -7.377,22;
        - (e) Desfazer lote do OFX remove exclusivamente os 5 novos lançamentos e restaura snapshots dos 395 enriquecidos, mantendo os 1.682 do XLSX 100% íntegros;
        - (f) Auditoria registrada em `RegistroAuditoria` para importação, desfazimento, criação, edição e exclusão de regras.
    - **15G.7 (Revisão Final e Qualidade)**:
      - UTF-8 estrito verificado em todos os arquivos de código e documentação (ausência total de caracteres corrompidos);
      - Totalmente responsivo para mobile com visão de cartões (`lg:hidden`);
      - Acessibilidade garantida com `aria-label`, foco por teclado e contraste;
      - Impressão preservada com classes `print:hidden` em elementos de navegação e ações.
  - **Arquivos criados:** `src/components/extrato/HistoricoImportacoes.tsx`, `src/components/extrato/GerenciadorRegras.tsx`, `src/components/extrato/index.ts`, `scripts/test_extrato_e2e.ts`.
  - **Arquivos modificados:** `src/types/index.ts`, `src/services/storage.ts`, `src/pages/ContasBancarias.tsx`, `src/components/ExtratoModal.tsx`, `scripts/test_extrato_lote.ts`, `RESUMO_MESTRE.md`.

---

**Histórico de Alterações Anteriores:**
- **O que foi feito:**
  - **Parte 15F – Gravação Atômica, Rastreabilidade e Reversão de Lotes de Importação**:
    - **15F.1 (Tipos em `src/types/index.ts`)**:
      - Adicionado `'importacao'` ao union `origem` de `Lancamento` e tratado em todos os pontos do sistema (badges, filtros, relatórios, formulários e switches de exclusão/folha);
      - Criadas interfaces `RegistroImportacao`, `ParamsImportacaoLote`, `ResultadoImportacaoLote` e `ResultadoDesfazerImportacao`.
    - **15F.2 (`src/utils/extrato/inferirFormaPagamento.ts`)**:
      - Função pura que infere deterministicamente `FormaPagamento` ('PIX', 'boleto', 'cartao', 'transferencia', 'dinheiro', 'cheque') a partir da `descricaoOriginal` e `NaturezaTransacao`. Corrigidos valores para casar exatamente com o union `FormaPagamento` do tipo TypeScript.
    - **15F.3 (`src/services/storage.ts`)**:
      - Adicionada coleção `FIRESTORE_COLLECTIONS.IMPORTOES = 'importacoes'`;
      - Cache síncrono `cacheImportacoes` + listener `onSnapshot` + reset em `pararListeners()`;
      - Métodos: `getImportacoes()`, `getImportacaoPorId()`, `saveImportacao()`;
      - **`importarExtratoLote(params)`**: processamento de cada item revisado (incluir/vincular/ignorar), gravação em **batches atômicos de ≤ 490 operações** no Firestore (resguardando o limite de 500), snapshot de enriquecidos para rollback seguro, cálculo de diferença de conciliação e finalização do `RegistroImportacao` como `'concluida'`;
      - **`desfazerImportacao(loteId)`**: exclusão de lançamentos do lote com `origem='importacao'` e restauração fiel dos enriquecidos via snapshot; marca o lote como `'desfeita'`.
    - **15F.4 (`src/components/ImportarExtratoModal.tsx`)**:
      - Fluxo de 3 passos: Seleção de arquivo → Revisão e categorização → Gravação e resumo;
      - **Tela de Loading** durante gravação atômica com barra de progresso animada;
      - **Tela Final de Resumo** (Passo 3):
        - Cabeçalho verde com nome do arquivo, banco e conta, além de badge copiável do ID do lote;
        - Grid de 4 contadores: Novas Lançadas, Enriquecidas, Vinculadas, Ignoradas/Duplicadas;
        - Painel de Movimentação Financeira com créditos, débitos e resultado líquido em `font-num`;
        - Painel de Evolução de Saldo (antes e depois da importação);
        - **Painel de Conciliação Bancária**: compara o LEDGERBAL/saldo do extrato com o saldo do sistema; se há diferença, exibe botão "Conciliar Saldo Agora" que cria ajuste via `conciliarSaldoConta()`; se não há saldo no arquivo, oferece campo de digitação manual;
        - **Botão "Desfazer Importação"** com modal de confirmação detalhado (lista quantos lançamentos serão excluídos e quantos serão restaurados);
        - **Botão "Ver Lançamentos do Lote"** que aplica o `loteId` como filtro de busca em Lancamentos.tsx e fecha o modal;
        - **Tela de sucesso** após reversão, mostrando contadores de removidos e restaurados.
    - **15F.5 (`src/pages/Lancamentos.tsx`)**:
      - Badge roxo `Importado` exibido na linha de cada lançamento com `origem='importacao'` (com tooltip do lote);
      - Campo `lote_id` incluído no `filtroBusca` para localizar todos os lançamentos de um lote diretamente pela barra de pesquisa;
      - Prop `onVerLote` passada ao `ImportarExtratoModal` para filtrar o lote após importação.
    - **15F.6 (`scripts/test_extrato_lote.ts`)**:
      - **24 testes automatizados** cobrindo 4 cenários:
        1. Lote de 1.250 linhas: particionamento correto em 3 batches, campos `origem`, `status`, `recorrencia`, `forma_pagamento` corretos, categoria preservada no enriquecimento;
        2. Falha no meio do lote: erro capturado, status `'parcial'` registrado;
        3. Rollback completo: 49 lançamentos removidos, 1 restaurado, saldo e descrição voltam ao exato valor inicial, status `'desfeita'`;
        4. Arquivo real Santander 1.682 linhas: batches corretos (4 × ≤ 490), rollback total (aviso quando arquivo não está presente).
  - **Arquivos criados:** `src/utils/extrato/inferirFormaPagamento.ts`, `scripts/test_extrato_lote.ts`.
  - **Arquivos modificados:** `src/types/index.ts`, `src/services/storage.ts`, `src/components/ImportarExtratoModal.tsx`, `src/pages/Lancamentos.tsx`, `RESUMO_MESTRE.md`.

**Regras de Segurança Firestore para a coleção `importacoes`:**
```
match /importacoes/{loteId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.papel == 'administrador';
}
```

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 15E - Interface de Revisão, Categorização Obrigatória e Produtividade em Lote de Extratos**:
    - **15E.1 (Modal Responsivo em Tela Cheia no Desktop e Cartões no Mobile)**:
      - Atualizado [Modal.tsx](file:///c:/Users/aurel/Documents/mtsolargest%C3%A3ofinanceiraempresarial/GestaoFinanceira/src/components/Modal.tsx) com suporte a `maxWidth="full"` (`max-w-[97vw] w-[97vw]`), proporcionando visão analítica ampla em desktop e cartões verticais ergonômicos no mobile;
      - Integração total com `usePrivacy()` (`formatarValor` / `ocultarValores`), tipografia tabular `font-num` para todos os valores monetários e proteção estrita de acesso exclusivo para administradores (`isAdmin`).
    - **15E.2 (Combobox Digitável com Criação Instantânea em `src/components/extrato/ComboboxCategoria.tsx`)**:
      - Filtragem dinâmica pelo tipo da transação (crédito → receitas; débito → despesas; suporte a transferência e ajuste);
      - Busca em tempo real e navegação por teclado (ArrowUp, ArrowDown, Enter, Tab, Escape);
      - Criação rápida no ato `+ Criar categoria “[nome]”` via `dbService.saveCategoria` no Firestore e cache síncrono, gerando cor automática e selecionando a categoria criada instantaneamente;
      - Tag sutil `Sugerida` para categorias identificadas pelas regras inteligentes da Parte 15D;
      - Validação de obrigatoriedade: linhas marcadas para inclusão sem categoria ganham destaque visual vermelho/âmbar e bloqueiam o botão de lançamento.
    - **15E.3 (Componente Completo de Revisão em `src/components/extrato/RevisaoExtrato.tsx`)**:
      - **Cabeçalho Analítico e Contadores Interativos**: Identificação da conta bancária, banco e período do extrato, com 6 contadores clicáveis em tempo real (*Novas*, *Duplicadas ignoradas*, *A enriquecer*, *Possíveis duplicatas manuais*, *Internas Contamax* e *Sem Categoria*);
      - **Filtros Multifacetados**: Busca textual por descrição original, descrição normalizada, contraparte e categoria; filtro por status; filtro por créditos/débitos; atalho rápido `Apenas sem categoria`; faixa de datas e faixa de valores;
      - **Tabela Paginada de Alto Desempenho**: Paginação seletiva (25, 50, 100 itens/pág) garantindo renderização suave mesmo com as ~1.700 transações do Santander;
      - **Produtividade por Semelhança**: Detecção de transações idênticas na mesma descrição ou contraparte com oferta instantânea em banner: `Aplicar a todas as N transações semelhantes`;
      - **Ações em Lote**: Seleção múltipla por checkboxes com barra de ações para aplicar categoria, projeto, contato ou status (incluir/ignorar) em massa;
      - **Checkbox "Lembrar Regra"**: Criação automática de regras em `regras_importacao` para automatizar importações futuras;
      - **Navegação Ágil**: Botão `"Faltam N sem categoria"` com salto direto para a primeira pendência e avanço automático de foco;
      - **Resolução de Possíveis Duplicatas Manuais**: Card comparativo lado a lado confrontando a transação do extrato com o lançamento manual existente no sistema (com data, valor, descrição e diferença em dias) e 3 decisões claras (*Vincular ao existente*, *Criar novo* ou *Ignorar*);
      - **Rascunho Persistente em `localStorage`**: Armazenamento automático sob chave `mtsolar_extrato_draft_${contaId}` protegido com `try/catch` para tolerar recarregamento ou fechamento acidental da tela.
    - **15E.4 (Integração e Orquestração em `src/components/ImportarExtratoModal.tsx`)**:
      - Fluxo contínuo entre Passo 1 (Upload de arquivos e resolução de contas) e Passo 2 (Revisão e categorização);
      - Modal de confirmação da revisão pronta para gravação (Parte 15F).
    - **15E.5 (Roteiro de Teste Manual 15E)**:
      1. Acessar a tela de **Lançamentos** ou **Contas Bancárias** como Administrador e clicar no botão **"Importar Extrato"**;
      2. No Passo 1, selecionar ou arrastar o arquivo `src/exemplos_extratos/extrato_exemplo_santander.ofx` ou `extrato_exemplo_santander.xlsx`;
      3. Verificar a detecção correta da instituição e conta Santander e clicar em **"Avançar para Revisão e Categorização"**;
      4. Observar a abertura em tela cheia (`full`) com o cabeçalho analítico e os 6 contadores;
      5. Clicar no botão vermelho de pendências **"Faltam N sem categoria"** para filtrar automaticamente as linhas que exigem ação;
      6. No Combobox de Categoria, digitar uma nova categoria (ex: *"Serviços Fotovoltaicos Especiais"*) e selecionar a opção `+ Criar categoria`; verificar que ela é criada e selecionada imediatamente;
      7. Definir a categoria de uma linha com repetições (ex: boletos de 108,39) e clicar em **"Aplicar a todas as N transações semelhantes"** no banner de sugestão;
      8. Marcar checkboxes de várias linhas e testar o modal de **Ação em Lote** (definindo projeto ou contato em massa);
      9. Fechar o modal ou recarregar a página e reabrir o extrato para testar a recuperação transparente do rascunho via `localStorage`;
      10. Tentar avançar com itens a incluir sem categoria (comprovar o bloqueio); após preencher as categorias obrigatórias, clicar em **"Concluir Revisão e Lançar"** e validar o sumário de transações prontas para a Parte 15F.
  - **Arquivos criados:** `src/components/extrato/ComboboxCategoria.tsx`, `src/components/extrato/RevisaoExtrato.tsx`.
  - **Arquivos modificados:** `src/components/Modal.tsx`, `src/components/ImportarExtratoModal.tsx`, `scripts/test_extrato_regras.ts`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 15D - Classificação por Natureza, Sugestão de Categorias, Casamento de Contatos e Regras do Usuário**:
    - **15D.1 (`src/utils/extrato/regras/santander.ts`)**: Mapeamento das regras de natureza para o Santander (033) casadas por `descricaoNormalizada`, cada qual retornando `{ natureza, tipoLancamentoSugerido, categoriaSugeridaNome? }`:
      - `APLICACAO/RESGATE CONTAMAX` → `movimentacao_interna` (sugestão: transferencia);
      - `DEBITO EMPRESTIMO`, `PREST EMPRESTIMOS/FINANCIAMENTOS` → `emprestimo` (sugestão: despesa, categoria: "Empréstimos e Financiamentos");
      - `IOF*`, `TAR*`, `TARIFA*` → `tarifa_bancaria` (sugestão: despesa, categoria: "Taxas bancárias");
      - `PAGAMENTO TRIBUTOS`, `PAGAMENTO DARF` → `imposto` (sugestão: despesa, categoria: "Impostos e Tributos");
      - `PAGAMENTO CONTA LUZ/CELULAR`, `MENSALIDADE DE SEGURO` → `conta_consumo` (sugestão: despesa, categoria: "Despesas operacionais");
      - `COMPRA CARTAO DEB` → `cartao_debito` (sugestão: despesa);
      - `PIX RECEBIDO`, `CR COB BLOQ COMP CONF RECEBIMENTO`, `DEP DINHEIRO` → `recebimento` (sugestão: receita);
      - `PIX ENVIADO`, `PIX AGENDADO`, `PAGAMENTO DE BOLETO` → `pagamento` (sugestão: despesa);
      - `TITULO CAPITALIZACAO` → `capitalizacao` (sugestão: despesa);
      - `ACORDO` → `acordo_divida` (sugestão: despesa);
      - Demais transações sem padrão → `indefinido`.
    - **15D.2 (`src/utils/extrato/classificarTransacao.ts`)**: Módulo de classificação pura contendo:
      - Função `classificarTransacao(transacao, regrasUsuario, contatosCadastrados, bancoCodigo)` respeitando rigorosamente a hierarquia: `regra_usuario` (prevalece e define tipo/categoria/contato/descrição) > `regra_banco` (sugere natureza e tipo/categoria base) > `nenhuma`.
      - Operadores de casamento de regras do usuário: `contem`, `igual` e `comeca_com`.
      - Casamento inteligente de contatos por nome normalizado (`normalizarNome` - caixa alta, sem acentos, sem pontuações) usando `contraparte` (extraída pelo parser OFX). Se casado com contato existente, preenche `contatoId`. Se contraparte presente mas sem contato cadastrado, preenche `nomeContatoSugerido` para oferta de criação rápida no fluxo.
      - Função pura `resolverMovimentacaoInterna(transacao, contas)` que analisa aplicações automáticas (Contamax): sugere ação `ignorar` (evitando inflar receitas/despesas) ou `transferencia` caso exista conta destino de investimento/aplicações.
    - **15D.3 (`src/types/index.ts`)**: Interface `RegraImportacao` contendo `id`, `padrao_texto`, `operador` ('contem'|'igual'|'comeca_com'), `tipo_lancamento`, `categoria_id`, `contato_id?`, `descricao_padrao?`, `ativa`, `vezes_usada`, `criado_em` e `atualizado_em`.
    - **15D.4 (`src/services/storage.ts`)**: Integrada a coleção `regras_importacao` no padrão do projeto:
      - Listener reativo com `onSnapshot` (`ouvirRegrasImportacao`), cache síncrono em memória (`cacheRegrasImportacao`), limpeza em `pararListeners`;
      - Métodos no `dbService`: `getRegrasImportacao`, `saveRegraImportacao`, `deleteRegraImportacao` e `incrementarUsoRegraImportacao`.
    - **15D.5 (`src/utils/extrato/index.ts`)**: Exportação dos novos tipos (`NaturezaTransacao`, `SugestaoClassificacao`, `ResultadoClassificacao`), funções puras e regras Santander.
    - **15D.6 (`scripts/test_extrato_regras.ts`)**: Suite automatizada de 56 testes com 100% de aprovação (56 PASSOU / 0 FALHOU):
      - Validação de todas as regras do banco Santander;
      - Validação do casamento e sugestão de contatos;
      - Validação da prevalência de regras do usuário sobre regras do banco;
      - Testes com o arquivo OFX real de 400 transações: 394 classificadas por regras e taxa de sucesso demonstrada;
      - Validação de `resolverMovimentacaoInterna` e `normalizarNome`.
  - **Arquivos criados:** `src/utils/extrato/regras/santander.ts`, `src/utils/extrato/classificarTransacao.ts`, `scripts/test_extrato_regras.ts`.
  - **Arquivos modificados:** `src/types/index.ts`, `src/services/storage.ts`, `src/utils/extrato/index.ts`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 15C - Deduplicação Pura e Cruzamento OFX × XLSX (sem UI)**:
    - **15C.1 (`src/types/index.ts`)**: Adicionada interface `OrigemImportacao` com campos `lote_id`, `banco_codigo`, `conta_id`, `fitid?`, `assinatura_fraca` e `formato` ('ofx'|'xlsx'). Campo `origem_importacao?: OrigemImportacao` adicionado opcionalmente na interface `Lancamento`, mantendo compatibilidade total com lançamentos manuais legados.
    - **15C.2 (`src/utils/extrato/assinatura.ts`)**: Criadas três funções puras sem dependências externas:
      - `gerarAssinaturaForte(bancoCodigo, conta, fitid)` → `banco_conta_FITID` (retorna `null` se FITID ausente).
      - `gerarAssinaturaFraca(params)` → `conta_data_tipo_valorCentavos_prefixo_ordemNoDia` (determinística: mesma entrada sempre gera mesma saída).
      - `extrairPrefixoDescricao(descricaoNormalizada)` → até 2 palavras iniciais da operação (ex: "PIX ENVIADO"), permitindo pareamento XLSX × OFX.
    - **15C.3 (`src/utils/extrato/classificarDuplicatas.ts`)**: Função principal `classificarDuplicatas(transacoes, lancamentosExistentes, contexto)` implementando as 5 regras:
      - **(a) Mesmo FITID já importado** → `duplicada_exata`.
      - **(b) Sem FITID + assinatura fraca já existente** → `duplicada_exata` (XLSX reimportado).
      - **(c) Cruzamento OFX × XLSX (em qualquer ordem)**:
        - OFX importado depois do XLSX: busca lançamento sem FITID que bate por data + tipo + valor + prefixo da descrição + ordemNoDia → `enriquecer_existente` (preserva a categoria escolhida pelo usuário, completa FITID/descrição/contraparte).
        - XLSX importado depois do OFX: busca lançamento do OFX já salvo com FITID que bate pelos mesmos critérios → `duplicada_exata` (não cria duplicata).
      - **(d) Transações idênticas no mesmo dia** → separadas por `ordemNoDia` determinístico; assinaturas fracas distintas garantem dois lançamentos distintos.
      - **(e) Lançamento manual (sem `origem_importacao`) na mesma conta, mesmo valor, data ±2 dias** → `possivel_duplicata_manual`.
      - Função auxiliar `enriquecerLancamento(lancExistente, transacaoOfx, ...)` que complementa descrição/contraparte/FITID preservando rigorosamente `categoria_id`.
    - **15C.4 (`scripts/test_extrato_dedupe.ts`)**: Suite de 32 asserções automatizadas cobrindo:
      - **Ordem 1 (XLSX → OFX)**: 1682 novas do XLSX; 395 `enriquecer_existente` + 5 novas do OFX; union final = **1687 sem duplicatas**.
      - **Ordem 2 (OFX → XLSX)**: 400 novas do OFX; 395 `duplicada_exata` + 1287 novas do XLSX; union final = **1687 sem duplicatas**. Independência de ordem comprovada.
      - **Mesmo arquivo 2×**: ZERO novas (XLSX: 1682 duplicadas; OFX: 400 duplicadas).
      - **Dois boletos de 108,39 no mesmo dia**: 2 lançamentos distintos (ordemNoDia 0 e 1; assinaturas fracas diferentes). Reimportação: cada boleto casado com seu respectivo lançamento (pareamento 1:1).
      - **Lançamento manual ±2 dias**: `possivel_duplicata_manual`; com mais de 2 dias: classificado `nova` (sem falso positivo).
    - **Correção de tipo**: `TipoTransacaoExtrato` ('credito'|'debito') ≠ `TipoLancamento` ('receita'|'despesa'); adicionada função interna `tipoExtrato()` para mapeamento nas comparações, eliminando erros TS2367.
    - **tsc --noEmit**: 0 erros. **build**: código 0. **Testes**: 32 PASSOU / 0 FALHOU.
  - **Arquivos criados:** `src/utils/extrato/assinatura.ts`, `src/utils/extrato/classificarDuplicatas.ts`, `scripts/test_extrato_dedupe.ts`.
  - **Arquivos modificados:** `src/types/index.ts`, `src/utils/extrato/index.ts`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 15B - Identificação e Resolução Segura de Contas Bancárias para Importação de Extratos**:
    - **15B.1 (Campos Opcionais em `src/types/index.ts`)**:
      - Adicionados campos opcionais `banco_codigo?: string`, `agencia?: string` e `numero_conta?: string` na interface `ContaBancaria`, mantendo o campo legado `banco: string` preenchido com o nome de exibição.
    - **15B.2 (Resolução Pura de Contas em `src/utils/extrato/resolverConta.ts`)**:
      - Criada a função pura `resolverConta(extrato, contas)` com os critérios estritos de desambiguação em ordem:
        1. `banco_codigo` + número da conta (comparando apenas dígitos);
        2. `nome do banco` + número da conta (compatibilidade com contas legadas);
        3. `banco` (código ou nome);
        4. Só o número da conta.
      - Suporte especial para o padrão Santander em que o `ACCTID` traz a agência colada (`3749130046964` ≡ agência `3749` + conta `13004696-4`).
      - Retorno estruturado em `{ tipo: 'unica', conta }`, `{ tipo: 'ambigua', candidatas }` ou `{ tipo: 'nenhuma', sugestao }`.
    - **15B.3 (Gestão de Contas Bancárias em `src/pages/ContasBancarias.tsx`)**:
      - Seletor de instituição bancária com opções de `bancos.ts` (`BANCOS_REGISTRADOS`) + opção "Outro Banco / Instituição" com input de texto dedicado.
      - Novos campos "Agência (sem dígito)" e "Número da Conta (com DV)" no modal de cadastro e edição.
      - Compatibilidade com contas antigas e aviso discreto nos cards de conta: `"Complete os dados bancários para importar extratos"` com botão "Completar dados".
      - Detalhamento de agência e conta adicionado ao subtítulo do card quando presentes.
    - **15B.4 (Modal de Importação de Extrato - Passo 1 em `src/components/ImportarExtratoModal.tsx`)**:
      - Dropzone para arquivos `.ofx`, `.qfx`, `.xlsx` com suporte a múltiplos arquivos simultâneos.
      - Para cada arquivo: detecção em tempo real de formato, banco emissor, período, quantidade de transações (`font-num`) e resolução automática de conta.
      - Resolução `'nenhuma'`: botão "Cadastrar esta conta agora" com pré-preenchimento automático dos dados do extrato, ou dropdown de seleção manual.
      - Resolução `'ambigua'`: solicitação explícita de escolha entre as contas candidatas.
      - Bloqueio de avanço se o banco do arquivo for divergente do banco da conta selecionada, exigindo checkbox explícito de confirmação consciente.
    - **15B.5 (Botão "Importar Extrato" com Proteção de Permissão)**:
      - Botão "Importar Extrato" integrado nos cabeçalhos de `ContasBancarias.tsx` e `Lancamentos.tsx`, condicionado estritamente a `isAdmin` (visualizador não visualiza).
    - **15B.6 (Testes Automatizados em `scripts/test_resolver_conta.ts`)**:
      - 19 asserções cobrindo: resolução do OFX e XLSX reais para a mesma conta Santander (`conta-santander-pj`), contas legadas sem `banco_codigo`, contas únicas por banco, detecção de ambiguidade e sugestões de pré-preenchimento. 100% de aprovação (19 PASSOU / 0 FALHOU).
  - **Arquivos criados:** `src/utils/extrato/resolverConta.ts`, `src/components/ImportarExtratoModal.tsx`, `scripts/test_resolver_conta.ts`.
  - **Arquivos modificados:** `src/types/index.ts`, `src/utils/extrato/index.ts`, `src/pages/ContasBancarias.tsx`, `src/pages/Lancamentos.tsx`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
- **O que foi feito:**
  - **Parte 15A - Camada Pura de Leitura, Detecção e Parsers de Extratos Bancários (OFX e Santander XLSX)**:
    - **15A.1 (Contratos e Tipos em `src/utils/extrato/tipos.ts`)**:
      - Criada a interface `TransacaoExtrato` contendo: `idTemporario`, `fitid?`, `data` (YYYY-MM-DD), `valor` (sempre positivo, 2 casas), `tipo` ('credito' | 'debito'), `descricaoOriginal`, `descricaoNormalizada` (maiúscula, sem acento, espaços colapsados, sem números variáveis), `contraparte?`, `documento?`, `ordemNoDia` e `linhaOrigem`.
      - Criada a interface `ExtratoLido` contendo: `formato` ('ofx' | 'xlsx'), `bancoCodigo`, `bancoNome`, `agencia?`, `conta?` (apenas dígitos), `acctIdBruto?`, `titular?`, `periodo` ({ inicio, fim }), `saldoFinal?` ({ valor, data }), `transacoes` e `avisos`.
      - Criada a classe `ErroBancoNaoSuportado` (extends Error) com mensagens amigáveis em português.
      - Criadas as funções utilitárias puras `normalizarDescricao` e `arredondar2Casas`.
    - **15A.2 (Parser OFX em `src/utils/extrato/parsers/ofx.ts`)**:
      - Suporte robusto a OFX 1.x SGML (tags folha sem fechamento) e OFX 2.x XML, aceitando extensões `.ofx` e `.qfx`.
      - Decodificação de `ArrayBuffer` respeitando o `CHARSET` declarado no cabeçalho (1252 -> `windows-1252`, senão `utf-8`).
      - Tratamento da vírgula decimal em `TRNAMT` e `BALAMT`.
      - Extração de datas `DTPOSTED`, `DTSTART`, `DTEND`, `DTASOF` usando os 8 primeiros dígitos sem converter fuso horário.
      - O sinal do valor define crédito/débito, mantendo `valor` estritamente positivo com 2 casas decimais.
      - Extração de `contraparte` a partir de `MEMO` removendo prefixos de operação ("Pix Enviado ", "Pix Recebido ", etc.).
      - Regra determinística de `ordemNoDia` para transações idênticas do mesmo dia.
      - Extração fiel de `LEDGERBAL` com valor e data do saldo final.
    - **15A.3 (Parser XLSX Santander em `src/utils/extrato/parsers/santanderXlsx.ts`)**:
      - Processamento via SheetJS (`xlsx`) para planilhas exportadas pelo Santander.
      - Conversor de datas por extenso em português com suporte a meses com e sem acento (`março`/`marco`, etc.) e dia da semana.
      - Identificação dinâmica de metadados no cabeçalho: Titular, Conta (`13004696-4` -> `130046964`) e Período (`Extrato de 01/01/2026 a 16/10/2026`).
      - Descarte da linha de rodapé `"TOTAL"`, registrando-a nos `avisos`.
      - Tratamento de ausência de FITID, saldo e favorecido (propriedades `undefined`).
      - Ordem preservada do mais recente ao mais antigo.
      - Atribuição determinística de `ordemNoDia` (ex: boletos de 108,39 no mesmo dia com ordemNoDia 0 e 1).
    - **15A.4 (Registro e Detecção por Conteúdo em `bancos.ts` e `detectarBanco.ts`)**:
      - Detecção de formato exclusivamente pelo conteúdo binário/assinatura (magic bytes ZIP para XLSX e tags para OFX), nunca pelo nome do arquivo.
      - Arquitetura de registro extensível `BANCOS_REGISTRADOS` com definição `{ codigo, nome, formatosSuportados, detectar, parser }`, inicializado com Santander (033).
      - Lançamento de `ErroBancoNaoSuportado` com mensagens claras em português para arquivos ou bancos desconhecidos.
    - **15A.5 (Ponto de Entrada em `src/utils/extrato/index.ts`)**:
      - Função `lerExtrato(arquivo: ArrayBuffer, nomeArquivo: string): Promise<ExtratoLido>`.
    - **15A.6 (Suite de Testes Automatizados em `scripts/test_extrato_parsers.ts`)**:
      - 51 casos de teste automatizados cobrindo os arquivos reais (400 transações do OFX, 400 FITIDs únicos, LEDGERBAL -7377,22, 1.682 transações do XLSX, linha TOTAL desconsiderada, meses com/sem acento, boletos idênticos com ordemNoDia 0 e 1, e erro em arquivos desconhecidos) com 100% de aprovação (51 PASSOU / 0 FALHOU).
  - **Arquivos criados:** `src/utils/extrato/tipos.ts`, `src/utils/extrato/parsers/ofx.ts`, `src/utils/extrato/parsers/santanderXlsx.ts`, `src/utils/extrato/bancos.ts`, `src/utils/extrato/detectarBanco.ts`, `src/utils/extrato/index.ts`, `scripts/test_extrato_parsers.ts`.
  - **Arquivos modificados:** `package.json`, `package-lock.json`, `RESUMO_MESTRE.md`.

**Histórico de Alterações Recentes (anteriores):**
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


---

### Parte 18C – Regra Única de Cálculo do Saldo Inicial na Importação de Extratos (2026-10-23)
**Data:** 2026-10-23T07:00  
**Arquivos modificados / criados:** `src/utils/extrato/saldoInicialHelper.ts`, `scripts/test_parte_18C.ts`  
**Substitui:** Parte 17B e toda a lógica de ajuste de saldo inicial das Partes 15J e 16D  
**O que foi feito:**

**Problema resolvido:** O usuário tem a conta com o saldo real de hoje e importa o primeiro extrato (ex.: 7 dias). Ele não sabe o saldo inicial. O app tinha vários mecanismos sobrepostos (alerta de dupla contagem, ajuste de data do saldo inicial, "corrigir saldo inicial agora", ajuste pós-importação) e terminava com saldo errado.

**Regra Única implementada:**
- `saldo_inicial = saldo_real_informado − (soma de TODOS os lançamentos pagos da conta com data ≤ data do saldo informado, já incluindo os que serão gravados pelo extrato, considerando entradas positivas e saídas negativas)`
- `data_saldo_inicial = dia anterior ao lançamento mais antigo da conta`
- O saldo real informado vem de, em ordem: (1) LEDGERBAL do OFX (valor e data do arquivo); (2) valor digitado pelo usuário com a data (padrão: último dia do extrato)

**Conversão de saldo disponível com limite de cheque especial:**
- Se o usuário marcar "Este valor inclui o limite do cheque especial", o app desconta o limite antes de usar na fórmula: `saldo_real = saldo_digitado − limite_cheque_especial`

**C1 (src/utils/extrato/saldoInicialHelper.ts):** Criado módulo utilitário puro com as seguintes exportações:
- `calcularSaldoInicial(params)`: implementa a Regra Única — recebe saldo real, data do saldo, lançamentos do lote e lançamentos existentes; retorna `{ saldo_inicial, data_saldo_inicial }`.
- `calcularSaldoRealEfetivo(saldoInformado, limiteChecqueEspecial, incluiLimite)`: converte saldo disponível para saldo real caso o usuário inclua o limite do cheque especial.
- `deveAplicarRegraUnica(conta, lancamentosExistentes)`: determina se a Regra Única deve ser ativada (primeira importação ou conta sem lançamentos).
- Tipos exportados: `ParametrosRegraUnica`, `ResultadoRegraUnica`.

**C2 (importarExtratoLote em storage.ts):** O cálculo de `saldo_inicial` e `data_saldo_inicial` passou a usar exclusivamente `calcularSaldoInicial()`, eliminando todos os caminhos legados de ajuste de saldo.

**C3 (Testes automatizados — scripts/test_parte_18C.ts):** Suíte com 30 testes cobrindo:
- XLSX com 1.682 linhas e saldo LEDGERBAL
- OFX com 400 transações e conta com lançamentos existentes
- Conversão de saldo disponível com cheque especial (desconto do limite)
- Contamax ignorado vs transferência entre contas próprias
- Reversão via Desfazer (rollback do saldo_inicial)
- Primeira importação vs importações subsequentes
- Casos extremos: lote vazio, saldo zero, data retroativa

**Testes:** 30/30 passaram com sucesso  
**tsc:** zero erros  
**build:** ✓ sucesso

---

### Parte 18D – Simplificação da Tela de Importação de Extratos (2026-10-23)
**Data:** 2026-10-23T07:30  
**Arquivos modificados:** `src/components/ImportarExtratoModal.tsx`  
**O que foi feito:**

**Objetivo:** Fluxo curto, sem alertas e confirmações que se contradizem. Usando a Regra Única da Parte 18C como base.

**D1 (Passo 1 — arquivo + conta):**
- Na **primeira importação**, exibe UM único campo: `"Saldo real da conta em [data]"` com:
  - Data padrão = último dia do extrato (editável).
  - Pré-preenchido com o saldo cadastrado na conta (o usuário confirma ou corrige).
  - Se o OFX tiver `LEDGERBAL`, preenche automaticamente com o valor e a data do arquivo (editável).
  - Seletor: "Este valor inclui o limite do cheque especial?" — ao marcar, o app desconta o limite antes de aplicar a fórmula.
  - Texto de ajuda: "O app calcula sozinho o saldo inicial. Informe o saldo do último dia do extrato. Se este saldo é de hoje e o extrato termina antes de hoje, importe também o período até hoje."

**D2 (Removido do fluxo):**
- Alerta de "possível dupla contagem".
- Checkbox "Ajustar a data do saldo inicial".
- Botão "Corrigir saldo inicial agora".
- Modal de ajuste do passo 3 (que pedia confirmação do novo saldo_inicial).
- Campos legados `saldoBanco` / `dataSaldoBanco` / `substituirSaldoInicial`.
- Cálculo antigo de `saldoProjetado` com comparação manual ao LEDGERBAL.

**D3 (Tela de confirmação final):**
- Painel único limpo com: lista de lançamentos do lote, contas afetadas e linha de saldo inicial calculado pela Regra Única.
- Único botão "Confirmar e gravar" — sem confirmações intermediárias redundantes.

**D4 (Passo 3 — resultado):**
- Exibe: `"Saldo do app: R$ X = saldo informado R$ Y ✓"` (conciliado) ou mensagem de divergência com botão **Desfazer** (sem correção automática silenciosa).
- Sem modal de "ajustar saldo agora" — o usuário decide explicitamente via Desfazer se necessário.

**D5 (Importações seguintes):**
- Campo de saldo é **opcional** e usado apenas para conferência — o app não recalcula o `saldo_inicial` já estabelecido.
- Não exibe assistente de "primeira importação" se a conta já tiver lançamentos.

**D6 (Layout — tela cheia e tabela utilizável):**
- Modal em largura máxima (tela cheia no Passo 2).
- Tabela com scroll vertical aproveitando o espaço disponível.
- Filtros desligados por padrão para performance (ativar manualmente se necessário).

**tsc:** zero erros  
**build:** ✓ sucesso

⚠️ **ATENÇÃO:** A Parte 18D **substitui completamente** os mecanismos de ajuste de saldo das Partes 15H, 15J, 16D e 17B. Qualquer regressão nesses fluxos deve ser validada pelos 30 testes da suíte `test_parte_18C.ts`.

---
