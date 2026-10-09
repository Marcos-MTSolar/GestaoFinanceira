import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { 
  ShieldCheck, 
  Lock, 
  AlertCircle, 
  CheckCircle2,
  KeyRound,
  Loader2
} from 'lucide-react';

export const Login: React.FC = () => {
  const { loginGoogle } = useAuth();
  const [emailCustom, setEmailCustom] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [mostrarCustom, setMostrarCustom] = useState(false);

  const handleLoginGoogle = async (email?: string, nome?: string) => {
    setErro(null);
    setCarregando(true);
    try {
      const res = await loginGoogle(email, nome);
      if (!res.sucesso && res.mensagem) {
        setErro(res.mensagem);
      }
    } catch (e: any) {
      setErro(e.message || 'Falha ao autenticar.');
    } finally {
      setCarregando(false);
    }
  };

  const handleLoginCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailCustom.trim()) return;
    setErro(null);
    setCarregando(true);
    try {
      const res = await loginGoogle(emailCustom.trim(), emailCustom.split('@')[0]);
      if (!res.sucesso && res.mensagem) {
        setErro(res.mensagem);
      }
    } catch (e: any) {
      setErro(e.message || 'Falha ao verificar e-mail.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      
      {/* Elementos visuais de fundo em tons de sol e energia */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#FFF4CC] rounded-full blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-40 pointer-events-none" />

      {/* Cartão Principal do Login - Fundo Branco Limpo */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-200/90 p-8 sm:p-10 relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* LOGO DA MT SOLAR (Sempre sobre fundo branco ou claro) */}
        <div className="flex justify-center mb-6">
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs">
            <Logo size="lg" withWhiteBadge={false} />
          </div>
        </div>

        {/* Título e Subtítulo */}
        <div className="text-center mb-8">
          <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-[#003064] tracking-tight">
            Gestão Financeira
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-sans">
            Acesse o sistema corporativo da MT Solar – Energia renovável
          </p>
        </div>

        {/* Mensagem de Erro (se email não autorizado ou falha) */}
        {erro && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5 animate-in shake">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Acesso Não Autorizado</p>
              <p className="mt-0.5 leading-relaxed">{erro}</p>
            </div>
          </div>
        )}

        {/* BOTÃO PRINCIPAL DE LOGIN COM GOOGLE (POPUP FIREBASE AUTH) */}
        <div className="space-y-4">
          <button
            onClick={() => handleLoginGoogle()}
            disabled={carregando}
            className="w-full flex items-center justify-center gap-3 bg-[#003064] hover:bg-[#00204A] text-white py-3.5 px-4 rounded-xl font-semibold text-sm shadow-md transition-all group border-b-4 border-[#FCBC00] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {carregando ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#FCBC00]" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center p-1 shrink-0">
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
            )}
            <span>{carregando ? 'Autenticando...' : 'Entrar com Google'}</span>
          </button>

          {/* Opção para alternar para perfil de teste / visualizador */}
          <div className="pt-2">
            <button
              onClick={() => handleLoginGoogle('consultoria@mtsolar.com.br', 'Consultor Externo')}
              disabled={carregando}
              className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4 text-[#1A4A85]" />
              <span>Entrar como Visualizador (Modo Leitura)</span>
            </button>
          </div>

          {/* Testar outro e-mail (validação de e-mail não autorizado) */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setMostrarCustom(!mostrarCustom)}
              className="text-[11px] text-[#1A4A85] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <KeyRound className="w-3 h-3" />
              {mostrarCustom ? 'Ocultar login alternativo' : 'Testar outro e-mail corporativo'}
            </button>
          </div>

          {mostrarCustom && (
            <form onSubmit={handleLoginCustomSubmit} className="pt-2 space-y-2 animate-in fade-in">
              <label className="block text-[11px] font-semibold text-slate-600">
                E-mail para teste de autorização:
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailCustom}
                  onChange={(e) => setEmailCustom(e.target.value)}
                  placeholder="ex: outro@gmail.com"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#003064]"
                  required
                />
                <button
                  type="submit"
                  disabled={carregando}
                  className="px-3 py-2 bg-[#003064] text-white text-xs font-semibold rounded-lg hover:bg-[#00204A] cursor-pointer disabled:opacity-60"
                >
                  Verificar
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Se o e-mail não estiver na lista em Configurações, o acesso será bloqueado pelas regras de segurança.
              </p>
            </form>
          )}
        </div>

        {/* Políticas de Segurança e Regras do App */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold mb-2">
            <Lock className="w-3.5 h-3.5 text-[#003064]" />
            <span>Controle de Acesso Corporativo</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-slate-500">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
              <span>Apenas e-mails previamente autorizados possuem acesso</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
              <span>O primeiro usuário a acessar torna-se o Administrador</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
              <span>Visualizadores possuem acesso estritamente de leitura</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Rodapé com Direitos */}
      <footer className="mt-8 text-center text-xs text-slate-500">
        <p className="font-medium text-[#003064]">
          MT Solar – Energia renovável © {new Date().getFullYear()}
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Cuiabá / MT • Todos os direitos reservados
        </p>
      </footer>

    </div>
  );
};
