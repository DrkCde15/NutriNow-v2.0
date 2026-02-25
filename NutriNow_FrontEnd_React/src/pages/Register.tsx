import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { User, Mail, Lock, Eye, EyeOff, Calendar, Users } from 'lucide-react';
import './Login.css'; // Reusing Login styles

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    data_nascimento: '',
    genero: '',
    email: '',
    senha: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/cadastro', formData);
      setMessage(res.data.message || 'Conta criada com sucesso!');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <main className="login-card fade-in-up">
        <h1>Criar sua conta</h1>

        <form className="login-form" onSubmit={handleRegister}>
          <div className="input-group">
            <User size={20} className="input-icon" />
            <input 
              type="text" 
              name="nome"
              placeholder="Nome" 
              value={formData.nome}
              onChange={handleInputChange}
              required 
            />
          </div>

          <div className="input-group">
            <User size={20} className="input-icon" />
            <input 
              type="text" 
              name="sobrenome"
              placeholder="Sobrenome" 
              value={formData.sobrenome}
              onChange={handleInputChange}
              required 
            />
          </div>

          <div className="input-group">
            <Calendar size={20} className="input-icon" />
            <input 
              type="date" 
              name="data_nascimento"
              placeholder="Data de Nascimento" 
              value={formData.data_nascimento}
              onChange={handleInputChange}
              required 
            />
          </div>

          <div className="input-group">
            <Users size={20} className="input-icon" />
            <select 
              name="genero"
              value={formData.genero}
              onChange={handleInputChange as any}
              required
              className="select-field"
            >
              <option value="" disabled>Gênero</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro</option>
            </select>
          </div>

          <div className="input-group">
            <Mail size={20} className="input-icon" />
            <input 
              type="email" 
              name="email"
              placeholder="Email" 
              value={formData.email}
              onChange={handleInputChange}
              required 
            />
          </div>

          <div className="input-group">
            <Lock size={20} className="input-icon" />
            <input
              type={showPassword ? 'text' : 'password'}
              name="senha"
              placeholder="Senha"
              value={formData.senha}
              onChange={handleInputChange}
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
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>
          
          <Link to="/login" className="btn-secondary-outline">Já tenho conta</Link>
        </form>

        {message && <p className="mensagem-sucesso">{message}</p>}
        {error && <p className="mensagem-erro">{error}</p>}
      </main>
    </div>
  );
};

export default Register;
