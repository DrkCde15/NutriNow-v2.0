import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Calendar, Target, Ruler, Scale, Dumbbell, X, Save } from 'lucide-react';
import './Home.css';
import './Perfil.css'; // Redizendo estilos de modal

const Home: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [formData, setFormData] = useState({
    dataNascimento: '',
    meta: '',
    altura: '',
    peso: '',
    ja_treinou: ''
  });
  const [hasTrained, setHasTrained] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      checkProfileCompletion();
    }
  }, [user, loading]);

  const checkProfileCompletion = async () => {
    try {
      const res = await api.get('/perfil');
      if (res.data.success) {
        const { altura, peso, dataNascimento, ja_treinou } = res.data;
        const defaultDOB = dataNascimento === '01/01/2000';
        
        // Verifica se qualquer dado essencial está faltando
        const isHeightMissing = !altura || parseFloat(altura.toString()) === 0;
        const isWeightMissing = !peso || parseFloat(peso.toString()) === 0;
        const isTrainingMissing = !ja_treinou || ja_treinou === 'Nunca treinou';

        const incomplete = isHeightMissing || isWeightMissing || defaultDOB || isTrainingMissing;

        if (incomplete) {
          const isTrained = ja_treinou && ja_treinou !== 'Nunca treinou';
          setFormData({
            dataNascimento: defaultDOB ? '' : dataNascimento,
            meta: res.data.meta !== 'Não definida' ? res.data.meta : '',
            altura: altura || '',
            peso: peso || '',
            ja_treinou: isTrained ? ja_treinou : ''
          });
          setHasTrained(isTrained);
          setShowCompletionModal(true);
        }
      }
    } catch (err) {
      console.error('HOME: Erro ao verificar perfil:', err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const submissionData = {
      ...formData,
      ja_treinou: hasTrained ? (formData.ja_treinou || 'Sim') : 'Nunca treinou'
    };

    try {
      await api.post('/perfil', submissionData);
      setShowCompletionModal(false);
    } catch (err) {
      console.error('HOME: Erro ao salvar perfil:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqItems = [
    {
      question: "Como funciona a personalização da IA?",
      answer: "Nossa IA analisa seus dados pessoais, objetivos, restrições alimentares e preferências para criar um plano exclusivo. Ela aprende continuamente com seu progresso e ajusta as recomendações automaticamente."
    },
    {
      question: "Posso usar se tiver restrições alimentares?",
      answer: "Sim! O NutriNow trabalha com todas as restrições: vegetariano, vegano, intolerâncias, alergias e preferências culturais ou religiosas."
    },
    {
      question: "Preciso pagar para usar?",
      answer: "Oferecemos um plano gratuito com funcionalidades básicas. Para recursos avançados, temos planos premium acessíveis."
    },
    {
      question: "Como funciona o acompanhamento?",
      answer: "Você registra suas refeições e a IA analisa automaticamente. Recebe feedback instantâneo e sugestões de melhorias."
    },
    {
      question: "Substitui um nutricionista?",
      answer: "O NutriNow é uma ferramenta de apoio baseada em conhecimento científico. Para casos específicos, recomendamos um nutricionista profissional."
    }
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section" id="inicio">
        <div className="hero-container">
          <div className="hero-logo">
            <img src={logo} alt="NutriNow Logo" className="logo-image" />
          </div>

          <h1 className="hero-title">
            Nutri<span className="hero-title-highlight">Now</span>
          </h1>

          <p className="hero-subtitle">
            Transforme sua alimentação com inteligência artificial e descubra o poder
            de uma nutrição personalizada para sua vida.
          </p>

          <div className="cta-buttons">
            {loading ? (
               <div className="btn-cta-primary">Carregando...</div>
            ) : !user ? (
               <Link to="/cadastro" className="btn-cta-primary">Começar Agora</Link>
            ) : (
               <Link to="/chatbot" className="btn-cta-primary">Ir para o Chat</Link>
            )}
            <Link to="/chatbot" className="btn-cta-secondary">Conversar com NutriAI</Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="dietas">
        <h2 className="section-title">Por que escolher o NutriNow?</h2>
        <p className="section-subtitle">Tecnologia de ponta para sua saúde</p>
        <div className="features-container">
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3 className="feature-title">IA Personalizada</h3>
            <p className="feature-description">
              Nossa inteligência artificial aprende com você e cria planos únicos
              baseados em suas necessidades, preferências e objetivos.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3 className="feature-title">Análise Completa</h3>
            <p className="feature-description">
              Acompanhe macros, micros, calorias e muito mais com dashboards
              intuitivos e relatórios detalhados.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎯</div>
            <h3 className="feature-title">Metas Inteligentes</h3>
            <p className="feature-description">
              Defina e alcance seus objetivos com um sistema que se adapta ao seu
              progresso em tempo real.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3 className="feature-title">Chat 24/7</h3>
            <p className="feature-description">
              Tire dúvidas, receba orientações e ajuste seu plano a qualquer momento
              com nosso assistente virtual.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <h2 className="section-title">Como Funciona?</h2>
        <p className="section-subtitle">Simples, rápido e eficiente</p>
        <div className="steps-container">
          <div className="step">
            <div className="step-number">1</div>
            <h3 className="step-title">Cadastre-se</h3>
            <p className="step-description">
              Crie sua conta em menos de 2 minutos e preencha seu perfil nutricional.
            </p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3 className="step-title">Converse com a IA</h3>
            <p className="step-description">
              Nossa IA fará perguntas para entender suas necessidades e preferências.
            </p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3 className="step-title">Receba seu Plano</h3>
            <p className="step-description">
              Obtenha um plano alimentar personalizado e comece sua transformação!
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section" id="chat">
        <h2 className="section-title">Perguntas Frequentes</h2>
        <p className="section-subtitle">Tire suas dúvidas</p>
        <div className="faq-container">
          {faqItems.map((item, index) => (
            <div 
              key={index} 
              className={`faq-item ${activeFaq === index ? 'active' : ''}`}
              onClick={() => toggleFaq(index)}
            >
              <div className="faq-question">
                <span>{item.question}</span>
                <span className="faq-icon">▼</span>
              </div>
              <div className="faq-answer">
                {item.answer}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta" id="cadastro">
        <h2>Pronto para transformar sua vida?</h2>
        <p>Junte-se a milhares de pessoas que já alcançaram seus objetivos</p>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-copyright">
            © 2024 NutriNow. Todos os direitos reservados. | Desenvolvido para sua saúde
          </div>
        </div>
      </footer>

      {/* Completion Modal */}
      {showCompletionModal && (
        <div className="modal-overlay">
          <div className="modal-content completion-modal fade-in-up">
            <div className="modal-header">
              <h3>🏁 Quase lá! Complete seu perfil</h3>
              <button onClick={() => setShowCompletionModal(false)} className="close-modal"><X size={20} /></button>
            </div>
            <p className="modal-intro">Para que nossa IA possa criar o melhor plano para você, precisamos de alguns detalhes adicionais.</p>
            
            <form onSubmit={handleSaveProfile} className="modal-form">
               <div className="form-row">
                <div className="input-group">
                  <label><Calendar size={16} /> Data de Nascimento</label>
                  <input 
                    type="date" 
                    value={formData.dataNascimento}
                    onChange={e => setFormData({...formData, dataNascimento: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label><Target size={16} /> Sua Meta Principal</label>
                  <input 
                    type="text" 
                    value={formData.meta}
                    onChange={e => setFormData({...formData, meta: e.target.value})}
                    placeholder="Ex: Perder peso, Ganhar massa"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="input-group">
                  <label><Ruler size={16} /> Altura (m)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.altura}
                    onChange={e => setFormData({...formData, altura: e.target.value})}
                    placeholder="1.75"
                    required
                  />
                </div>
                <div className="input-group">
                  <label><Scale size={16} /> Peso (kg)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={formData.peso}
                    onChange={e => setFormData({...formData, peso: e.target.value})}
                    placeholder="70.5"
                    required
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
                    <span><Dumbbell size={16} /> Já treinou anteriormente?</span>
                  </label>
                </div>
              </div>

              {hasTrained && (
                <div className="form-row fade-in">
                  <div className="input-group">
                    <label>O que você já treinou?</label>
                    <input 
                      type="text" 
                      value={formData.ja_treinou}
                      onChange={e => setFormData({...formData, ja_treinou: e.target.value})}
                      placeholder="Ex: Musculação - 1 ano"
                      required={hasTrained}
                    />
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                   {saving ? 'Salvando...' : <><Save size={18} /> Finalizar Perfil</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
