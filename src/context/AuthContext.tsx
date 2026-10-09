import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UsuarioAutorizado, PapelUsuario } from '../types';
import { dbService, subscribe } from '../services/storage';

interface AuthContextType {
  usuario: UsuarioAutorizado | null;
  papel: PapelUsuario;
  isAdmin: boolean;
  carregando: boolean;
  loginGoogle: (emailParam?: string, nomeParam?: string) => Promise<{ sucesso: boolean; mensagem?: string }>;
  logout: () => Promise<void>;
  trocarPerfil: (papel: PapelUsuario) => void;
  alternarParaUsuario: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<UsuarioAutorizado | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  useEffect(() => {
    // 1. Tentar recuperar sessão de usuário logado
    const atual = dbService.getUsuarioAtual();
    setUsuario(atual);
    setCarregando(false);

    // 2. Ouvir mudanças de autenticação do Firebase Auth
    const unsubFbAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser && fbUser.email) {
        const email = fbUser.email.trim().toLowerCase();
        const autorizados = dbService.getUsuariosAutorizados();

        const INITIAL_ADMIN_EMAIL = 'mtsolar.energia@gmail.com';

        // Se for o e-mail do administrador inicial fixo ou se a lista estiver vazia
        if (email === INITIAL_ADMIN_EMAIL || autorizados.length === 0) {
          const primeiroAdmin: UsuarioAutorizado = {
            id: email,
            nome: fbUser.displayName || 'Administrador MT Solar',
            email,
            papel: 'administrador',
            data_adicionado: new Date().toISOString().split('T')[0],
            foto: fbUser.photoURL || undefined,
          };
          await dbService.saveUsuarioAutorizado(primeiroAdmin);
          dbService.setUsuarioAtual(primeiroAdmin);
          setUsuario(primeiroAdmin);
        } else {
          const encontrado = autorizados.find((u) => u.email.toLowerCase() === email);
          if (encontrado) {
            const userObj = { ...encontrado, foto: fbUser.photoURL || encontrado.foto };
            dbService.setUsuarioAtual(userObj);
            setUsuario(userObj);
          } else {
            // Se o e-mail logado no Firebase não estiver autorizado, desloga
            await signOut(auth);
            dbService.setUsuarioAtual(null);
            setUsuario(null);
          }
        }
      }
    });

    // 3. Ouvir alterações de usuário ou lista de autorizados na memória
    const unsubscribeAuth = subscribe('auth', () => {
      setUsuario(dbService.getUsuarioAtual());
    });

    const unsubscribeUsers = subscribe('usuarios', () => {
      const atual = dbService.getUsuarioAtual();
      if (atual) {
        const autorizados = dbService.getUsuariosAutorizados();
        const encontrado = autorizados.find((u) => u.email.toLowerCase() === atual.email.toLowerCase());
        if (!encontrado) {
          dbService.setUsuarioAtual(null);
          setUsuario(null);
        } else if (encontrado.papel !== atual.papel || encontrado.nome !== atual.nome) {
          dbService.setUsuarioAtual(encontrado);
          setUsuario(encontrado);
        }
      }
    });

    return () => {
      unsubFbAuth();
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, []);

  const loginGoogle = async (
    emailParam?: string,
    nomeParam?: string
  ): Promise<{ sucesso: boolean; mensagem?: string }> => {
    try {
      let email = '';
      let nome = '';
      let foto = '';

      if (emailParam) {
        email = emailParam.trim().toLowerCase();
        nome = nomeParam || email.split('@')[0];
      } else {
        const result = await signInWithPopup(auth, googleProvider);
        if (!result.user || !result.user.email) {
          return { sucesso: false, mensagem: 'Não foi possível obter o e-mail da conta do Google.' };
        }
        email = result.user.email.trim().toLowerCase();
        nome = result.user.displayName || email.split('@')[0];
        foto = result.user.photoURL || '';
      }

      const autorizados = dbService.getUsuariosAutorizados();
      const INITIAL_ADMIN_EMAIL = 'mtsolar.energia@gmail.com';

      // Se for o e-mail do administrador inicial fixo ou se não houver usuários cadastrados
      if (email === INITIAL_ADMIN_EMAIL || autorizados.length === 0) {
        const primeiroAdmin: UsuarioAutorizado = {
          id: email,
          nome: nome || 'Administrador MT Solar',
          email,
          papel: 'administrador',
          data_adicionado: new Date().toISOString().split('T')[0],
          foto,
        };
        await dbService.saveUsuarioAutorizado(primeiroAdmin);
        dbService.setUsuarioAtual(primeiroAdmin);
        setUsuario(primeiroAdmin);
        return { sucesso: true };
      }

      // Verificar se o e-mail está na lista de autorizados
      const encontrado = autorizados.find((u) => u.email.toLowerCase() === email);
      if (!encontrado) {
        await signOut(auth);
        return {
          sucesso: false,
          mensagem: `O e-mail "${email}" não está na lista de usuários autorizados da MT Solar. Solicite acesso a um Administrador.`,
        };
      }

      const usuarioAtualizado: UsuarioAutorizado = {
        ...encontrado,
        foto: foto || encontrado.foto,
      };
      dbService.setUsuarioAtual(usuarioAtualizado);
      setUsuario(usuarioAtualizado);
      return { sucesso: true };
    } catch (error: any) {
      console.error('Erro no login do Google:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        return { sucesso: false, mensagem: 'O login com o Google foi cancelado pelo usuário.' };
      }
      return {
        sucesso: false,
        mensagem: error.message || 'Erro ao realizar login com a conta do Google.',
      };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Erro ao deslogar do Firebase Auth:', e);
    }
    dbService.setUsuarioAtual(null);
    setUsuario(null);
  };

  const trocarPerfil = (novoPapel: PapelUsuario) => {
    if (!usuario) return;
    const atualizado: UsuarioAutorizado = { ...usuario, papel: novoPapel };
    dbService.setUsuarioAtual(atualizado);
    setUsuario(atualizado);
  };

  const alternarParaUsuario = (email: string): boolean => {
    const autorizados = dbService.getUsuariosAutorizados();
    const encontrado = autorizados.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (encontrado) {
      dbService.setUsuarioAtual(encontrado);
      setUsuario(encontrado);
      return true;
    }
    return false;
  };

  const papel = usuario?.papel || 'visualizador';
  const isAdmin = papel === 'administrador';

  return (
    <AuthContext.Provider
      value={{
        usuario,
        papel,
        isAdmin,
        carregando,
        loginGoogle,
        logout,
        trocarPerfil,
        alternarParaUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
