# RESUMO MESTRE DO PROJETO - MT SOLAR GESTÃO FINANCEIRA

**Última Atualização:** 09/10/2026 10:13:00
**Histórico de Alterações Recentes:**
- **O que foi feito:**
  - Migração completa da persistência local para o Firebase Firestore e Firebase Auth com login via Google (`signInWithPopup`).
  - Atualização do controle de acesso para definir o e-mail administrador inicial fixo `mtsolar.energia@gmail.com` tanto no código quanto no `firestore.rules`.
  - Confirmação de ignoramento do `.env.local` no `.gitignore` (`git check-ignore .env.local` OK) e remoção de qualquer chave nos arquivos versionados.
  - Confirmação da presença da imagem oficial `public/logo.png` (usada no `Logo.tsx` em fundo claro).
  - Remoção do `bun.lock` e adição do `.npmrc` com `legacy-peer-deps=true` para garantir builds consistentes na Vercel via `npm`.
  - Reescrita do `firestore.rules` garantindo regras seguras com `mtsolar.energia@gmail.com` como administrador inicial.
  - Execução bem-sucedida do `npm run build`.
- **Arquivos modificados/criados:**
  - `src/lib/firebase.ts` (criado)
  - `src/services/storage.ts` (reescrito para Firestore com real-time e paginação)
  - `src/context/AuthContext.tsx` (atualizado com o e-mail admin fixo `mtsolar.energia@gmail.com`)
  - `src/pages/Login.tsx` (atualizado para acionar login com Google via Firebase Auth)
  - `src/pages/Configuracoes.tsx` (adicionado card e botão "Importar dados locais para a nuvem")
  - `src/components/Logo.tsx` (utilizando `public/logo.png` em fundo claro)
  - `firestore.rules` (regras seguras atualizadas com `mtsolar.energia@gmail.com` como admin inicial)
  - `.npmrc` (criado com `legacy-peer-deps=true`)
  - `bun.lock` (removido para manter apenas o `package-lock.json`)
  - `firebase.json` e `firestore.indexes.json` (criados)
  - `.env.example` (criado sem valores confidenciais)
  - `package.json` e `package-lock.json` (instalação de dependências)

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
