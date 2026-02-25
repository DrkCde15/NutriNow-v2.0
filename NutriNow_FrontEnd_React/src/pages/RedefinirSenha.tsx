import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import './Login.css';

const RedefinirSenha: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) setToken(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/redefinir-senha', {
        token,
        nova_senha: novaSenha
      });
      setMessage(res.data.message || 'Senha redefinida com sucesso!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <main className="login-card fade-in-up">
        <h1>Nova Senha</h1>
        <p style={{ color: '#718096', marginBottom: '2rem', fontSize: '0.95rem' }}>
          Crie uma senha forte para proteger sua conta.
        </p>

        {!message ? (
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <Lock size={20} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Nova Senha"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="toggle-btn" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div className="input-group">
              <Lock size={20} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmar Nova Senha"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </button>
          </form>
        ) : (
          <div className="success-state">
            <CheckCircle size={48} color="#059669" style={{ margin: '0 auto 1.5rem auto' }} />
            <p className="mensagem-sucesso">{message}</p>
            <Link to="/login" className="btn-primary" style={{ display: 'block', marginTop: '1.5rem', textDecoration: 'none' }}>
              Ir para o Login
            </Link>
          </div>
        )}

        {error && <p className="mensagem-erro">{error}</p>}
      </main>
    </div>
  );
};

export default RedefinirSenha;
