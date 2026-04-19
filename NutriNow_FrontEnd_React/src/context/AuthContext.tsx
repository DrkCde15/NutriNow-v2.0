import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

export interface User {
  id: number;
  nome: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Verificar se existe um token vindo na URL (OAuth callback)
      const params = new URLSearchParams(window.location.search);
      const tokenFromUrl = params.get('access_token');
      
      if (tokenFromUrl) {
        localStorage.setItem('nutrinow_token', tokenFromUrl);
        // Opcional: Pegar dados do usuário da URL também para evitar uma chamada inicial
        const userFromUrl = {
          id: parseInt(params.get('user_id') || '0'),
          nome: params.get('user_name') || '',
          email: params.get('user_email') || ''
        };
        if (userFromUrl.id) {
          localStorage.setItem('usuario', JSON.stringify(userFromUrl));
          setUser(userFromUrl);
        }
        
        // Limpar a URL para ficar bonita
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      const token = localStorage.getItem('nutrinow_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get('/me'); 
        setUser(res.data);
        localStorage.setItem('usuario', JSON.stringify(res.data));
      } catch (error) {
        localStorage.removeItem('usuario');
        localStorage.removeItem('nutrinow_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, senha: string) => {
    try {
      const response = await api.post('/login', { email, senha });
      const { user, access_token } = response.data;
      if (user && access_token) {
        setUser(user);
        localStorage.setItem('usuario', JSON.stringify(user));
        localStorage.setItem('nutrinow_token', access_token);
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/logout', {});
    } finally {
      setUser(null);
      localStorage.removeItem('usuario');
      localStorage.removeItem('nutrinow_token');
      localStorage.removeItem('nutrinow_session_id');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
