import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Settings, Calendar, Target, Ruler, Trash2, X, Camera } from 'lucide-react';
import './Perfil.css';

const toDateInputValue = (value: string) => {
  if (!value || value === '--/--/----') return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const [dia, mes, ano] = value.split('/');
  if (dia && mes && ano) {
    return `${ano}-${mes}-${dia}`;
  }

  return '';
};

interface ProfileData {
  nome: string;
  email: string;
  dataNascimento: string;
  meta: string;
  altura: number | null;
  peso: number | null;
  ja_treinou: string;
  foto: string;
}

const Perfil: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    nome: '',
    email: '',
    dataNascimento: '',
    meta: '',
    altura: null,
    peso: null,
    ja_treinou: 'Nunca treinou',
    foto: 'U'
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasTrained, setHasTrained] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    dataNascimento: '',
    meta: '',
    altura: '',
    peso: '',
    ja_treinou: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/perfil');
      if (res.data.success) {
        const nomes = res.data.nome.split(' ').filter((n: string) => n.length > 0);
        let iniciais = 'U';
        if (nomes.length >= 2) {
          iniciais = (nomes[0][0] + nomes[nomes.length-1][0]).toUpperCase();
        } else if (nomes.length === 1) {
          iniciais = nomes[0][0].toUpperCase();
        }

        setProfile({
          ...res.data,
          foto: iniciais,
          dataNascimento: res.data.dataNascimento || '--/--/----',
          meta: res.data.meta || 'Não definida',
          altura: res.data.altura,
          peso: res.data.peso,
          ja_treinou: res.data.ja_treinou || 'Nunca treinou'
        });
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    const isTrained = profile.ja_treinou !== 'Nunca treinou';
    setFormData({
      nome: profile.nome,
      email: profile.email,
      dataNascimento: toDateInputValue(profile.dataNascimento),
      meta: profile.meta === 'Não definida' ? '' : profile.meta,
      altura: profile.altura?.toString() || '',
      peso: profile.peso?.toString() || '',
      ja_treinou: isTrained ? profile.ja_treinou : ''
    });
    setHasTrained(isTrained);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      ...formData,
      ja_treinou: hasTrained ? (formData.ja_treinou || 'Sim') : 'Nunca treinou'
    };

    try {
      const res = await api.post('/perfil', payload);
      if (res.data.success) {
        loadProfile();
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm('Tem certeza que deseja excluir sua conta permanentemente?')) {
      try {
        await api.delete('/perfil');
        window.location.href = '/login';
      } catch (err) {
        console.error('Erro ao excluir conta:', err);
      }
    }
  };

  if (loading && !profile.nome) {
    return <div className="loading-state">Carregando perfil...</div>;
  }

  return (
    <div className="perfil-container">
      <div className="perfil-card fade-in-up">
        <header className="perfil-header">
          <div className="profile-photo-container">
            <div className="profile-initials">{profile.foto}</div>
            <button className="change-photo-btn"><Camera size={16} /></button>
          </div>
          <h1>{profile.nome}</h1>
          <p className="profile-email">{profile.email}</p>
        </header>

        <div className="info-grid">
          <div className="info-item">
            <Calendar size={20} className="info-icon" />
            <div className="info-content">
              <span>Nascimento</span>
              <p>{profile.dataNascimento}</p>
            </div>
          </div>
          <div className="info-item">
            <Target size={20} className="info-icon" />
            <div className="info-content">
              <span>Sua Meta</span>
              <p>{profile.meta}</p>
            </div>
          </div>
          <div className="info-item">
            <Ruler size={20} className="info-icon" />
            <div className="info-content">
              <span>Altura / Peso</span>
              <p>{profile.altura ? `${profile.altura}m` : '--'} / {profile.peso ? `${profile.peso}kg` : '--'}</p>
            </div>
          </div>
          <div className="info-item">
            <Settings size={20} className="info-icon" />
            <div className="info-content">
              <span>Histórico de Treino</span>
              <p>{profile.ja_treinou}</p>
            </div>
          </div>
        </div>

        <div className="perfil-actions">
          <button className="btn-primary" onClick={openModal}>
            <Settings size={18} /> Editar Perfil
          </button>
          <button className="btn-danger" onClick={handleDeleteAccount}>
            <Trash2 size={18} /> Excluir Conta
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Editar Perfil</h3>
              <button onClick={() => setIsModalOpen(false)} className="close-modal"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="modal-form">
              <div className="form-row">
                <div className="input-group">
                  <label>Nome Completo</label>
                  <input 
                    type="text" 
                    value={formData.nome}
                    onChange={e => setFormData({...formData, nome: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Email</label>
                  <input 
                    type="email" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Data de Nascimento</label>
                  <input 
                    type="date" 
                    value={formData.dataNascimento}
                    onChange={e => setFormData({...formData, dataNascimento: e.target.value})}
                  />
                </div>
                <div className="input-group">
                  <label>Meta Principal</label>
                  <input 
                    type="text" 
                    value={formData.meta}
                    onChange={e => setFormData({...formData, meta: e.target.value})}
                    placeholder="Ex: Emagrecer"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Altura (m)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={formData.altura}
                    onChange={e => setFormData({...formData, altura: e.target.value})}
                    placeholder="1.75"
                  />
                </div>
                <div className="input-group">
                  <label>Peso (kg)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={formData.peso}
                    onChange={e => setFormData({...formData, peso: e.target.value})}
                    placeholder="70"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group checkbox-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox"
                      checked={hasTrained}
                      onChange={e => setHasTrained(e.target.checked)}
                    />
                    <span>Já treinei anteriormente</span>
                  </label>
                </div>
              </div>

              {hasTrained && (
                <div className="form-row">
                  <div className="input-group">
                    <label>Descrição do Treino</label>
                    <input 
                      type="text" 
                      value={formData.ja_treinou}
                      onChange={e => setFormData({...formData, ja_treinou: e.target.value})}
                      placeholder="Ex: Musculação - 2 anos"
                      required={hasTrained}
                    />
                  </div>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Perfil;
