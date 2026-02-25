import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import './Login.css';

const EsqueciSenha: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!email.trim()) {
      setError('Por favor, informe seu email');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/esqueci-senha', { email });
      setMessage(res.data.message || 'Um link de redefinição foi enviado para seu email!');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao enviar link de redefinição');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <main className="login-card fade-in-up">
        <h1>Recuperar Senha</h1>
        <p style={{ color: '#718096', marginBottom: '2rem', fontSize: '0.95rem' }}>
          Informe seu e-mail e enviaremos um link para você definir uma nova senha.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <Mail size={20} className="input-icon" />
            <input 
              type="email" 
              placeholder="Seu email cadastrado" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            <Send size={18} style={{ marginRight: '8px' }} />
            {loading ? 'Enviando...' : 'Enviar Link'}
          </button>
          
          <Link to="/login" className="forgot-pass" style={{ marginTop: '1rem' }}>
            <ArrowLeft size={18} /> Voltar para o Login
          </Link>
        </form>

        {message && <p className="mensagem-sucesso">{message}</p>}
        {error && <p className="mensagem-erro">{error}</p>}
      </main>
    </div>
  );
};

export default EsqueciSenha;
