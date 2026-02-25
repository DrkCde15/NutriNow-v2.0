import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, X, Clock, Dumbbell, Utensils } from 'lucide-react';
import './DietaTreino.css';

interface Item {
  id: number;
  title: string;
  description: string;
  time?: string;
  tipo: string;
}

const DietaTreino: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'treinos' | 'dietas'>('treinos');
  const [workouts, setWorkouts] = useState<Item[]>([]);
  const [meals, setMeals] = useState<Item[]>([]);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', time: '' });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const [treinosRes, dietasRes] = await Promise.all([
        api.get('/dieta-treino?tipo=treino'),
        api.get('/dieta-treino?tipo=dieta')
      ]);
      setWorkouts(treinosRes.data.items || []);
      setMeals(dietasRes.data.items || []);
    } catch (err) {
      console.error('Erro ao carregar itens:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item: Item | null = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({ title: item.title, description: item.description, time: item.time || '' });
    } else {
      setEditingItem(null);
      setFormData({ title: '', description: '', time: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    setFormData({ title: '', description: '', time: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) return;

    const payload = {
      ...formData,
      tipo: activeTab === 'treinos' ? 'treino' : 'dieta'
    };

    try {
      if (editingItem) {
        await api.put(`/dieta-treino/${editingItem.id}`, payload);
        if (activeTab === 'treinos') {
          setWorkouts(workouts.map(w => w.id === editingItem.id ? { ...w, ...formData } : w));
        } else {
          setMeals(meals.map(m => m.id === editingItem.id ? { ...m, ...formData } : m));
        }
      } else {
        const res = await api.post('/dieta-treino', payload);
        const newItem: Item = { id: res.data.id || Date.now(), ...payload };
        if (activeTab === 'treinos') setWorkouts([...workouts, newItem]);
        else setMeals([...meals, newItem]);
      }
      closeModal();
    } catch (err: any) {
      alert('Erro ao salvar item: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    try {
      await api.delete(`/dieta-treino/${id}`);
      if (activeTab === 'treinos') setWorkouts(workouts.filter(w => w.id !== id));
      else setMeals(meals.filter(m => m.id !== id));
    } catch (err: any) {
      alert('Erro ao excluir item: ' + (err.response?.data?.error || err.message));
    }
  };

  const currentItems = activeTab === 'treinos' ? workouts : meals;

  return (
    <div className="dieta-treino-container">
      <div className="content-wrap fade-in-up">
        <header className="page-header">
          <h1>Meus Planos</h1>
          <p>Organize sua rotina de saúde com facilidade</p>
        </header>

        <div className="tab-switcher">
          <button 
            className={`tab-btn ${activeTab === 'treinos' ? 'active' : ''}`}
            onClick={() => setActiveTab('treinos')}
          >
            <Dumbbell size={20} /> Treinos
          </button>
          <button 
            className={`tab-btn ${activeTab === 'dietas' ? 'active' : ''}`}
            onClick={() => setActiveTab('dietas')}
          >
            <Utensils size={20} /> Dietas
          </button>
        </div>

        <div className="list-section">
          <div className="list-header">
            <h2>{activeTab === 'treinos' ? 'Treinos' : 'Refeições'}</h2>
            <button className="add-btn-circle" onClick={() => openModal()} title="Adicionar Novo">
              <Plus size={24} />
            </button>
          </div>

          {loading ? (
            <div className="loading-state">Carregando seus planos...</div>
          ) : currentItems.length > 0 ? (
            <div className="items-grid">
              {currentItems.map(item => (
                <div key={item.id} className="item-card">
                  <div className="item-content">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {item.time && (
                      <div className="item-time">
                        <Clock size={14} /> {item.time}
                      </div>
                    )}
                  </div>
                  <div className="item-actions">
                    <button onClick={() => openModal(item)} className="action-btn edit" title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="action-btn delete" title="Excluir">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>{activeTab === 'treinos' ? 'Nenhum treino cadastrado' : 'Nenhuma refeição cadastrada'}</p>
              <button 
                className="btn-primary" 
                style={{ marginTop: '1rem' }}
                onClick={() => openModal()}
              >
                Começar a planejar
              </button>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingItem ? 'Editar' : 'Adicionar'} {activeTab === 'treinos' ? 'Treino' : 'Refeição'}</h3>
              <button onClick={closeModal} className="close-modal"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="input-group">
                <label>Título</label>
                <input 
                  type="text" 
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Treino de Perna ou Café da Manhã"
                  required
                />
              </div>
              <div className="input-group">
                <label>Descrição</label>
                <textarea 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalhes..."
                  required
                />
              </div>
              <div className="input-group">
                <label>Horário (opcional)</label>
                <input 
                  type="text" 
                  value={formData.time}
                  onChange={e => setFormData({ ...formData, time: e.target.value })}
                  placeholder="Ex: 08:00 ou Pós-treino"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary">
                  {editingItem ? 'Atualizar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DietaTreino;
