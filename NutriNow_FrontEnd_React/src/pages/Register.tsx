import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { User, Mail, Lock, Eye, EyeOff, Calendar, Users, Target, Ruler, Scale, Dumbbell } from 'lucide-react';
import './Login.css'; // Reusing Login styles

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    nome: '',
    sobrenome: '',
    data_nascimento: '',
    genero: '',
    meta: '',
    altura: '',
    peso: '',
    ja_treinou: '',
    email: '',
    senha: ''
  });
  const [hasTrained, setHasTrained] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const response = await api.get('/auth/login');
      const data = response.data;
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err) {
      setError('Erro ao redirecionar para o login do Google.');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    const submissionData = {
      ...formData,
      ja_treinou: hasTrained ? (formData.ja_treinou || 'Sim') : 'Nunca treinou'
    };

    try {
      const res = await api.post('/cadastro', submissionData);
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

        <button className="btn-social google" onClick={handleGoogleLogin} type="button">
          <i className="fa-brands fa-google"></i> Conectar com o Google
        </button>

        <button className="btn-social facebook" type="button">
          <i className="fa-brands fa-facebook"></i> Conectar com o Facebook
        </button>

        <div className="divider"><span>OU</span></div>

        <form className="login-form" onSubmit={handleRegister}>
          <div className="form-grid">
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
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div className="input-group full-width">
              <Target size={20} className="input-icon" />
              <input 
                type="text" 
                name="meta"
                placeholder="Sua Meta (ex: Emagrecer, Ganhar Músculos)" 
                value={formData.meta}
                onChange={handleInputChange}
                required 
              />
            </div>

            <div className="input-group">
              <Ruler size={20} className="input-icon" />
              <input 
                type="number" 
                step="0.01"
                name="altura"
                placeholder="Altura (m)" 
                value={formData.altura}
                onChange={handleInputChange}
                required 
              />
            </div>

            <div className="input-group">
              <Scale size={20} className="input-icon" />
              <input 
                type="number" 
                step="0.1"
                name="peso"
                placeholder="Peso (kg)" 
                value={formData.peso}
                onChange={handleInputChange}
                required 
              />
            </div>

            <div className="input-group full-width checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  name="hasTrained"
                  checked={hasTrained}
                  onChange={(e) => setHasTrained(e.target.checked)}
                />
                <span>Já treinei anteriormente</span>
              </label>
            </div>

            {hasTrained && (
              <div className="input-group full-width fade-in">
                <Dumbbell size={20} className="input-icon" />
                <input 
                  type="text" 
                  name="ja_treinou"
                  placeholder="O que você já treinou? (ex: Musculação - 1 ano)" 
                  value={formData.ja_treinou}
                  onChange={handleInputChange}
                  required={hasTrained}
                />
              </div>
            )}

            <div className="input-group full-width">
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

            <div className="input-group full-width">
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
