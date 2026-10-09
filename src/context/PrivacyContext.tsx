import React, { createContext, useContext, useState, useEffect } from 'react';
import { formatarMoeda } from '../utils/formatters';

interface PrivacyContextType {
  ocultarValores: boolean;
  toggleOcultarValores: () => void;
  formatarValor: (valor: number) => string;
}

const STORAGE_KEY = 'mtsolar_privacidade_ocultar_valores';

const PrivacyContext = createContext<PrivacyContextType>({} as PrivacyContextType);

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ocultarValores, setOcultarValores] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const toggleOcultarValores = () => {
    setOcultarValores((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const formatarValor = (valor: number): string => {
    if (ocultarValores) {
      return 'R$ ••••••';
    }
    return formatarMoeda(valor);
  };

  return (
    <PrivacyContext.Provider
      value={{
        ocultarValores,
        toggleOcultarValores,
        formatarValor,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => useContext(PrivacyContext);
