# RESUMO MESTRE DO PROJETO - MT SOLAR GESTÃO FINANCEIRA

**Última Atualização:** 10/10/2026 15:23:05 (Parte 4D implementada)
**Histórico de Alterações Recentes:**
- **O que foi feito:**
  - **Parte 4A - Estrutura e cálculo de descontos recorrentes**:
    - **A1 (`src/types/index.ts`)**: Adicionada interface `DescontoRecorrente` e propriedade opcional `descontos_recorrentes?: DescontoRecorrente[]` na interface `Funcionario`.
    - **A2 (`src/utils/descontos.ts`)**: Criada a função utilitária `calcularDescontosRecorrentes` sem dependências do Firebase/storage.
    - **A3 (`scripts/test_4A.ts`)**: Criado o script de testes cobrindo os 7 casos de testes (a a g) importando diretamente de `src/utils/descontos.ts`, com aprovação total de 100%.
  - **Parte 4B - Integração de descontos recorrentes no cálculo de folha**:
    - **B1 (`src/services/storage.ts`)**: Importada `calcularDescontosRecorrentes` de `'../utils/descontos'`; atualizado `calcularFolhaFuncionario` para calcular os descontos recorrentes e incluí-los no array `descontos` e `totalDescontos`.
    - **B2 & B3 (`src/services/storage.ts`)**: Confirmado que `maxAbatimento` (`Math.max(0, +(bruto - totalDescontos).toFixed(2))`) e `liquido` (`Math.max(0, +(bruto - totalDescontos - adiantamentosAbatidos).toFixed(2))`) utilizam o `totalDescontos` atualizado, impedindo saldo negativo.
    - **B4 (`src/services/storage.ts`)**: Atualizado `gerarFolhaDoMes` para concatenar o texto de descontos recorrentes na propriedade `observacoes` utilizando spread condicional sem gravar `undefined`.
  - **Parte 4C - Formulário de cadastro/edição de colaboradores**:
    - **C1 (`src/pages/Funcionarios.tsx`)**: Adicionado estado `descontosRec: DescontoRecorrente[]` com carga inicial de `funcionarioParaEditar.descontos_recorrentes` e reset para novos cadastros.
    - **C2 & C3 (`src/pages/Funcionarios.tsx`)**: Criada a seção "Descontos Recorrentes em Folha" no modal com lista editável (nome, tipo, valor, base, ativo, remover) e 4 botões de atalho ("VT 6%", "Plano saúde", "Pensão", "Outro") com gerações de IDs determinísticos.
    - **C4 (`src/pages/Funcionarios.tsx`)**: Criada a função de validação `validarDescontosRecorrentes` (nome obrigatório, valor > 0, percentual <= 100%) bloqueando o salvamento via `alert` e gravando via spread condicional.
    - **C5 (`src/pages/Funcionarios.tsx`)**: Adicionada a prévia ao vivo dos descontos mensais estimados e do líquido estimado (antes de adiantamentos).
  - **Parte 4D - Exibição, exportação e prévias de descontos recorrentes**:
    - **D1 (`src/pages/Funcionarios.tsx`)**: Confirmado que o tooltip da coluna "Descontos" na tabela "Folha do Mês" já renderiza dinamicamente cada desconto recorrente pelo nome e valor via `calcFolha.descontos`. (JÁ EXISTIA)
    - **D2 (`src/pages/Funcionarios.tsx`)**: Adicionado bloco de Descontos Recorrentes Ativos na Ficha do Colaborador (aba financeira), listando o nome e o valor mensal estimado de cada item ativo.
    - **D3 (`src/utils/csvExporter.ts` e `src/pages/Funcionarios.tsx`)**: Adicionada a coluna "Detalhe dos descontos" no exportador de CSV com o texto formatado `"Nome R$ x; Nome R$ y"`.
    - **D4 (`src/pages/Funcionarios.tsx`)**: Adicionada prévia ao vivo de impacto no salário ao selecionar o evento "Desconto Diversos" no modal de novo lançamento de folha.
- **Arquivos modificados:**
  - `src/pages/Funcionarios.tsx`
  - `src/services/storage.ts`
  - `src/types/index.ts`
  - `src/utils/csvExporter.ts`
  - `src/utils/descontos.ts`
  - `scripts/test_4A.ts`
  - `RESUMO_MESTRE.md`

---

## 1. VISÃO GERAL
- **Propósito do sistema:** Plataforma corporativa para gestão financeira empresarial, fluxo de caixa, controle de usinas/projetos fotovoltaicos, folha de pagamento de colaboradores e conciliação bancária da MT Solar.
- **Público-alvo:** Diretores, gestores financeiros, engenheiros de projeto e consultores externos da MT Solar.
- **Estágio atual do projeto:** Integrado ao Firebase (Auth + Firestore), com build de produção testado e verificado para Vercel.

---

## 2. STACK TECNOLÓGICA
- **Frontend:** React 19, TypeScript, Vite 8, TailwindCSS v4, Lucide React icons, Recharts.
- **Backend:** Firebase Cloud Firestore (banco NoSQL em tempo real).
- **Banco de dados e Storage:** Firestore DB `(default)`, Firebase Auth (Google Provider).
- **Integrações externas:** Google OAuth2 (via Firebase Authentication).
- **Gerenciador de Pacotes:** `npm` com `.npmrc` (`legacy-peer-deps=true`) e `package-lock.json`.

---

## 3. ESTRUTURA DE ARQUIVOS
- `src/lib/firebase.ts`: Inicialização da aplicação Firebase, Auth (Google Provider) e Firestore DB `(default)`.
- `src/services/storage.ts`: Serviço central de dados sincronizado em tempo real via Firestore (`onSnapshot`), com suporte a cache local síncrono, filtros por período, paginação e função de migração de dados locais para a nuvem.
- `src/context/AuthContext.tsx`: Contexto de autenticação RBAC integrado ao Firebase Auth com popup do Google e validação da coleção `usuarios_autorizados` (Administrador inicial: `mtsolar.energia@gmail.com`).
- `src/components/Logo.tsx`: Exibição da marca MT Solar usando a imagem original `public/logo.png` sobre fundo claro.
- `.npmrc`: Configuração `legacy-peer-deps=true` para build na Vercel.
- `firestore.rules`: Regras de segurança do Firestore com o e-mail administrador inicial fixo.
- `firebase.json`: Configuração de deploy de regras do Firebase CLI.

---

## 4. MÓDULOS E FUNCIONALIDADES
- **Painel Principal (Dashboard):** Métricas de saldo real, saldo disponível total, cartões de caixa e gráficos.
- **Contas Bancárias:** Cadastro de contas PJ/Caixa interno, limites e taxas de cheque especial.
- **Lançamentos Financeiros:** Receitas e despesas, parcelamentos, recorrências e transferências.
- **Gestão de Projetos Solares:** Associação de lançamentos financeiros a usinas fotovoltaicas.
- **Folha de Pagamento:** Gestão de proventos, descontos, encargos e salários mensais.
- **Configurações & Migração:** Gestão de usuários autorizados, exportação/importação JSON e migração de dados do `localStorage` para a nuvem Firestore.

---

## 5. BANCO DE DADOS
- **Coleções do Firestore (`(default)`):**
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

## 6. INTEGRAÇÕES EXTERNAS
- **Firebase Authentication:** Autenticação via Google Provider (`signInWithPopup`).
- **Firebase Firestore:** Banco de dados NoSQL cloud com sincronização `onSnapshot`.

---

## 7. AUTENTICAÇÃO E SEGURANÇA
- **Administrador Inicial Fixo:** `mtsolar.energia@gmail.com`.
- **Fluxo de Login:** O usuário acessa com a conta do Google -> O sistema valida se o e-mail é `mtsolar.energia@gmail.com` ou se está registrado na coleção `usuarios_autorizados`.
- **Perfis e Papéis:**
  - `administrador`: Leitura e escrita total.
  - `visualizador`: Acesso estritamente de leitura.

---

## 8. REGRAS DE NEGÓCIO
- Apenas o Administrador inicial (`mtsolar.energia@gmail.com`) ou administradores autorizados no Firestore conseguem incluir/editar usuários e gravar no sistema.

---

## 9. FLUXO DO WHATSAPP
- N/A (Módulo planejado para fases futuras).

---

## 10. BUILD E DEPLOY
- **Build Frontend:** `npm run build` (Totalmente verificado).
- **Deploy de Regras do Firestore:**
  ```bash
  npx firebase-tools deploy --only firestore:rules --project gestaofinanceira-5afd9
  ```

---

## 11. PROBLEMAS RESOLVIDOS
- `.env.local` confirmado fora do controle de versão (`git check-ignore .env.local`).
- Resolução de dependência do `react-is` e remoção do `bun.lock` com inclusão do `.npmrc` para garantir build liso na Vercel.
- Regra de administrador inicial fixo configurada com segurança no `firestore.rules` (`mtsolar.energia@gmail.com`).

---

## 12. DÉBITOS TÉCNICOS
- Nenhum débito impeditivo no momento.

---

## 13. BACKLOG E MELHORIAS SUGERIDAS
- Configuração de índices compostos no Firestore caso a massa de lançamentos ultrapasse dezenas de milhares.

---

## 14. VARIÁVEIS DE AMBIENTE
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
