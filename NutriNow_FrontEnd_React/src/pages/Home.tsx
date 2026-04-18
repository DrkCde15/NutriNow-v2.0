import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import './Home.css';

const Home: React.FC = () => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

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
            <Link to="/cadastro" className="btn-cta-primary">Começar Agora</Link>
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
    </div>
  );
};

export default Home;
