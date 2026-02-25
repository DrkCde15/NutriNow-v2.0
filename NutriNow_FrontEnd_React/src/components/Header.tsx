import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User } from 'lucide-react';
import logo from '../assets/logo.png';

const Header: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          <img src={logo} alt="NutriNow Logo" className="logo-image" />
          <span className="brand-name">
            Nutri<span className="brand-highlight">Now</span>
          </span>
        </Link>

        <div className="nav-links main-nav">
          <Link to="/" className={`nav-link ${isActive('/')}`}>Início</Link>
          {user && (
            <>
              <Link to="/dieta-treino" className={`nav-link ${isActive('/dieta-treino')}`}>Dietas e Treinos</Link>
              <Link to="/chatbot" className={`nav-link ${isActive('/chatbot')}`}>Chat</Link>
            </>
          )}
        </div>

        <div className="nav-links auth-links">
          {!user ? (
            <>
              <Link to="/login" className={`nav-link ${isActive('/login')}`}>Entrar</Link>
              <Link to="/cadastro" className={`nav-link ${isActive('/cadastro')}`}>Cadastrar</Link>
            </>
          ) : (
            <Link to="/perfil" className={`nav-link profile-link ${isActive('/perfil')}`}>
              <User size={20} />
              <span className="user-firstname">{user.nome.split(' ')[0]}</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Header;
