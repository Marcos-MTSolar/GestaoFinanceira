import React, { createContext, useContext, useState, useEffect } from 'react';
import { UsuarioAutorizado, PapelUsuario } from '../types';
import { dbService, subscribe } from '../services/storage';

interface AuthContextType {
  usuario: UsuarioAutorizado | null;
  papel: PapelUsuario;
  isAdmin: boolean;
  carregando: boolean;
  loginGoogle: (email?: string, nome?: string) => { sucesso: boolean; mensagem?: string };
  logout: () => void;
  trocarPerfil: (papel: PapelUsuario) => void;
  alternarParaUsuario: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<UsuarioAutorizado | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);

  useEffect(() => {
    // Carregar usuário logado inicial
    const atual = dbService.getUsuarioAtual();
    setUsuario(atual);
    setCarregando(false);

    // Ouvir alterações de usuário ou lista de autorizados
    const unsubscribeAuth = subscribe('auth', () => {
      setUsuario(dbService.getUsuarioAtual());
    });

    const unsubscribeUsers = subscribe('usuarios', () => {
      const atual = dbService.getUsuarioAtual();
      if (atual) {
        // Verificar se ainda está na lista de autorizados
        const autorizados = dbService.getUsuariosAutorizados();
        const encontrado = autorizados.find(u => u.email.toLowerCase() === atual.email.toLowerCase());
        if (!encontrado) {
          // Deslogar se foi removido
          dbService.setUsuarioAtual(null);
          setUsuario(null);
        } else {
          // Atualizar dados/papel se mudou
          if (encontrado.papel !== atual.papel || encontrado.nome !== atual.nome) {
            dbService.setUsuarioAtual(encontrado);
            setUsuario(encontrado);
          }
        }
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, []);

  const loginGoogle = (
    emailParam?: string,
    nomeParam?: string
  ): { sucesso: boolean; mensagem?: string } => {
    const email = (emailParam || 'aurelio.marcos21@gmail.com').trim().toLowerCase();
    const nome = nomeParam || 'Aurélio Marcos';

    const autorizados = dbService.getUsuariosAutorizados();
    
    // Regra: se não há nenhum usuário no sistema, o primeiro se torna Administrador
    if (autorizados.length === 0) {
      const primeiroAdmin: UsuarioAutorizado = {
        id: 'user-' + Date.now(),
        nome,
        email,
        papel: 'administrador',
        data_adicionado: new Date().toISOString().split('T')[0],
      };
      dbService.saveUsuarioAutorizado(primeiroAdmin);
      dbService.setUsuarioAtual(primeiroAdmin);
      setUsuario(primeiroAdmin);
      return { sucesso: true };
    }

    // Verificar se o e-mail está na lista de autorizados
    const encontrado = autorizados.find(u => u.email.toLowerCase() === email);
    if (!encontrado) {
      return {
        sucesso: false,
        mensagem: `O e-mail "${email}" não está na lista de usuários autorizados da MT Solar. Solicite acesso a um Administrador.`,
      };
    }

    dbService.setUsuarioAtual(encontrado);
    setUsuario(encontrado);
    return { sucesso: true };
  };

  const logout = () => {
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
    const encontrado = autorizados.find(u => u.email.toLowerCase() === email.toLowerCase());
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
