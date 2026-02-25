import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, HelpCircle } from 'lucide-react';
import './Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const res = await login(email, senha);
      setMessage(res.message || 'Login realizado com sucesso!');
      setTimeout(() => navigate('/'), 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Usuário ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <main className="login-card fade-in-up">
        <h1>Bem-vindo de volta</h1>

        <button className="btn-social google">
          <i className="fa-brands fa-google"></i> Conectar com o Google
        </button>

        <button className="btn-social facebook">
          <i className="fa-brands fa-facebook"></i> Conectar com o Facebook
        </button>

        <div className="divider"><span>OU</span></div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <Mail size={20} className="input-icon" />
            <input 
              type="email" 
              placeholder="Email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
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

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          
          <Link to="/cadastro" className="btn-secondary-outline">Criar conta</Link>
        </form>

        <Link to="/esqueci-senha" title="Esqueci minha senha" className="forgot-pass">
          <HelpCircle size={18} /> Esqueci minha senha
        </Link>

        {message && <p className="mensagem-sucesso">{message}</p>}
        {error && <p className="mensagem-erro">{error}</p>}
      </main>
    </div>
  );
};

export default Login;
