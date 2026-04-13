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
      try {
        // Verifica diretamente com o backend se existe uma sessão válida (necessário para o Google Login)
        const res = await api.get('/me'); 
        setUser(res.data);
        localStorage.setItem('usuario', JSON.stringify(res.data));
      } catch (error) {
        // Se o backend der erro (401), limpa o localStorage
        localStorage.removeItem('usuario');
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
      if (response.data.user) {
        setUser(response.data.user);
        localStorage.setItem('usuario', JSON.stringify(response.data.user));
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
