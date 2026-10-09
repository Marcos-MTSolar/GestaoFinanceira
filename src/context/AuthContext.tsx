import React, { createContext, useContext, useState, useEffect } from 'react';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { UsuarioAutorizado, PapelUsuario } from '../types';
import { dbService, subscribe } from '../services/storage';

const INITIAL_ADMIN_EMAIL = 'mtsolar.energia@gmail.com';

interface AuthContextType {
  usuario: UsuarioAutorizado | null;
  papel: PapelUsuario;
  isAdmin: boolean;
  carregando: boolean;
  loginGoogle: () => Promise<{ sucesso: boolean; mensagem?: string }>;
  logout: () => Promise<void>;
  trocarPerfil: (papel: PapelUsuario) => void;
  alternarParaUsuario: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<UsuarioAutorizado | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  // Auxiliar para validar e autorizar usuário
  const processarUsuarioAutenticado = async (fbUser: FirebaseUser): Promise<UsuarioAutorizado | null> => {
    if (!fbUser || !fbUser.email) return null;
    const email = fbUser.email.trim().toLowerCase();
    const foto = fbUser.photoURL || undefined;

    // 1. Admin Inicial Fixo - autoriza direto SEM consultar Firestore
    if (email === INITIAL_ADMIN_EMAIL) {
      const adminObj: UsuarioAutorizado = {
        id: email,
        nome: fbUser.displayName || 'Administrador MT Solar',
        email,
        papel: 'administrador',
        data_adicionado: new Date().toISOString().split('T')[0],
        foto,
      };
      return adminObj;
    }

    // 2. Demais e-mails - consulta coleção usuarios_autorizados com doc ID = email
    try {
      const docRef = doc(db, 'usuarios_autorizados', email);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as UsuarioAutorizado;
        return {
          id: data.id || email,
          nome: data.nome || fbUser.displayName || email.split('@')[0],
          email,
          papel: data.papel || 'visualizador',
          data_adicionado: data.data_adicionado || new Date().toISOString().split('T')[0],
          foto: foto || data.foto,
        };
      }
    } catch (err: any) {
      console.warn('Erro ao consultar autorização do usuário:', err?.code || err?.message);
    }

    // Se documento não existe ou deu erro de permissão -> não autorizado
    return null;
  };

  useEffect(() => {
    // Escutar alterações do Firebase Auth
    const unsubFbAuth = onAuthStateChanged(auth, async (fbUser) => {
      setCarregando(true);
      if (fbUser) {
        const userAutorizado = await processarUsuarioAutenticado(fbUser);
        if (userAutorizado) {
          dbService.setUsuarioAtual(userAutorizado);
          setUsuario(userAutorizado);
          // Iniciar ouvintes Firestore SOMENTE após autorização confirmada
          dbService.iniciarListeners();
        } else {
          // Deslogar se e-mail não estiver autorizado
          try {
            await signOut(auth);
          } catch (e) {}
          dbService.pararListeners();
          dbService.setUsuarioAtual(null);
          setUsuario(null);
        }
      } else {
        dbService.pararListeners();
        dbService.setUsuarioAtual(null);
        setUsuario(null);
      }
      setCarregando(false);
    });

    // Ouvir atualização do estado de carregamento dos listeners Firestore
    const unsubCarregando = subscribe('carregando', () => {
      setCarregando(false);
    });

    // Ouvir alterações de usuário na memória
    const unsubscribeAuth = subscribe('auth', () => {
      setUsuario(dbService.getUsuarioAtual());
    });

    return () => {
      unsubFbAuth();
      unsubCarregando();
      unsubscribeAuth();
    };
  }, []);

  const loginGoogle = async (): Promise<{ sucesso: boolean; mensagem?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!result.user || !result.user.email) {
        return { sucesso: false, mensagem: 'Não foi possível obter o e-mail da conta do Google.' };
      }

      const userAutorizado = await processarUsuarioAutenticado(result.user);
      if (!userAutorizado) {
        await signOut(auth);
        dbService.pararListeners();
        return {
          sucesso: false,
          mensagem: `Seu e-mail "${result.user.email}" não está na lista de usuários autorizados da MT Solar. Solicite acesso ao Administrador.`,
        };
      }

      dbService.setUsuarioAtual(userAutorizado);
      setUsuario(userAutorizado);
      dbService.iniciarListeners();
      return { sucesso: true };
    } catch (error: any) {
      console.error('Erro no login do Google:', error?.code || error);
      // Tratar cancelamento do popup pelo usuário sem exibir mensagem de erro
      if (
        error?.code === 'auth/popup-closed-by-user' ||
        error?.code === 'auth/cancelled-popup-request'
      ) {
        return { sucesso: false };
      }
      return {
        sucesso: false,
        mensagem: 'Erro ao autenticar com a conta do Google. Verifique sua conexão e tente novamente.',
      };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    dbService.pararListeners();
    dbService.setUsuarioAtual(null);
    setUsuario(null);
  };

  const trocarPerfil = (novoPapel: PapelUsuario) => {
    if (!usuario) return;
    const atualizado: UsuarioAutorizado = { ...usuario, papel: novoPapel };
    dbService.setUsuarioAtual(atualizado);
    setUsuario(atualizado);
  };

  const alternarParaUsuario = (emailTarget: string): boolean => {
    const autorizados = dbService.getUsuariosAutorizados();
    const encontrado = autorizados.find((u) => u.email.toLowerCase() === emailTarget.toLowerCase());
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
