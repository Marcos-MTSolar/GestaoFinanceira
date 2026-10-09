# RESUMO MESTRE DO PROJETO - MT SOLAR GESTÃO FINANCEIRA

**Última Atualização:** 09/10/2026 11:04:00
**Histórico de Alterações Recentes:**
- **O que foi feito:**
  - Restauração de todas as 35 funções originais de cálculo e estatísticas no `src/services/storage.ts` alimentadas por cache síncrono via `onSnapshot` do Firestore.
  - Implementação do `ErrorBoundary` em `src/components/ErrorBoundary.tsx` e envolvimento da aplicação em `src/App.tsx`.
  - Tratamento resiliente no `AuthContext.tsx`: bypass imediato sem Firestore para `mtsolar.energia@gmail.com`, tratamento gracioso de e-mails não autorizados (`permission-denied`), encerramento de sessão sem exceções não tratadas para popups fechados pelo usuário e inicialização/desativação dos listeners do storage atrelada ao ciclo de vida do usuário autenticado.
  - Ajuste de `firestore.rules` com acesso por documento próprio em `usuarios_autorizados` e admin inicial fixo `mtsolar.energia@gmail.com` com `email_verified == true`.
  - Atualização da página `src/pages/Login.tsx` removendo o botão/modo de visualizador sem login e ajustando textos de permissão.
  - Inclusão da meta tag `<meta name="mobile-web-app-capable" content="yes">` em `index.html`.
  - Verificação com `npx tsc --noEmit` e `npm run build` bem-sucedidos.
- **Arquivos modificados/criados:**
  - `src/services/storage.ts` (restauradas todas as funções síncronas de cálculo e relatórios, adicionado gerenciamento de ciclo de vida de listeners)
  - `src/components/ErrorBoundary.tsx` (componente de classe criado para capturar exceções React com UI amigável em português)
  - `src/App.tsx` (envolvido com `ErrorBoundary`)
  - `src/context/AuthContext.tsx` (refatorado tratamento de admin fixo, autorização, permission-denied e listeners)
  - `src/pages/Login.tsx` (removido botão de visualizador sem login e atualizada mensagem de orientação)
  - `firestore.rules` (regras alinhadas ao código com permissão individual para `usuarios_autorizados`)
  - `index.html` (adicionada meta tag `mobile-web-app-capable`)
  - `RESUMO_MESTRE.md` (atualizado)

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
