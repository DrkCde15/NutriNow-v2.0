import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, User, X } from 'lucide-react';
import logo from '../assets/logo.png';

const Header: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path ? 'active' : '';

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-bar">
          <Link to="/" className="nav-logo">
            <img src={logo} alt="NutriNow Logo" className="logo-image" />
            <span className="brand-name">
              Nutri<span className="brand-highlight">Now</span>
            </span>
          </Link>

          <button
            type="button"
            className="nav-toggle"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <div className={`nav-menu ${menuOpen ? 'is-open' : ''}`}>
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
      </div>
    </nav>
  );
};

export default Header;
