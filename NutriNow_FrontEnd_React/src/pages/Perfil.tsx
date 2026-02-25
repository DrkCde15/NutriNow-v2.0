import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Settings, Calendar, Target, Ruler, Trash2, X, Camera } from 'lucide-react';
import './Perfil.css';

const Perfil: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    nome: '',
    email: '',
    dataNascimento: '',
    meta: '',
    alturaPeso: '',
    foto: 'U'
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    dataNascimento: '',
    meta: '',
    altura: '',
    peso: ''
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
          alturaPeso: res.data.alturaPeso || '-- / --'
        });
      }
    } catch (err) {
      console.error('Erro ao carregar perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    const [altura, peso] = profile.alturaPeso.split(' / ');
    setFormData({
      nome: profile.nome,
      email: profile.email,
      dataNascimento: profile.dataNascimento === '--/--/----' ? '' : profile.dataNascimento,
      meta: profile.meta === 'Não definida' ? '' : profile.meta,
      altura: altura?.replace('m', '').trim() || '',
      peso: peso?.replace('kg', '').trim() || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const alturaPesoStr = formData.altura && formData.peso 
      ? `${formData.altura}m / ${formData.peso}kg` 
      : profile.alturaPeso;

    const payload = {
      nome: formData.nome,
      email: formData.email,
      dataNascimento: formData.dataNascimento,
      meta: formData.meta,
      alturaPeso: alturaPesoStr
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
              <p>{profile.alturaPeso}</p>
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
                    type="text" 
                    value={formData.altura}
                    onChange={e => setFormData({...formData, altura: e.target.value})}
                    placeholder="1.75"
                  />
                </div>
                <div className="input-group">
                  <label>Peso (kg)</label>
                  <input 
                    type="text" 
                    value={formData.peso}
                    onChange={e => setFormData({...formData, peso: e.target.value})}
                    placeholder="70"
                  />
                </div>
              </div>
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
