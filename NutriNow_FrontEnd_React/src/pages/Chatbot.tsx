import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chatService';
import { LogOut, Send, Image as ImageIcon } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import logo from '../assets/logo.png';
import './Chatbot.css';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const sessionId = chatService.getSessionId();
    if (!sessionId) {
      const sid = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      chatService.setSessionId(sid);
    }

    loadChatHistory();
  }, [user]);

  const loadChatHistory = async () => {
    try {
      const response = await chatService.getChatHistory();
      if (response.success && response.history?.length > 0) {
        const history = response.history.map((msg: any) => ({
          text: msg.content,
          isUser: msg.role === 'user',
          timestamp: new Date(msg.timestamp || new Date())
        }));
        setMessages(history);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  };


  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentMessage.trim() || loading) return;

    const userMsg: Message = {
      text: currentMessage,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    const messageText = currentMessage;
    setCurrentMessage('');
    setLoading(true);

    try {
      const res = await chatService.sendMessage(messageText);
      if (res.success) {
        if (res.session_id) {
          chatService.setSessionId(res.session_id);
        }
        const botMsg: Message = {
          text: res.response!,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(res.error || 'Erro ao enviar mensagem.');
      }
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      setMessages(prev => [...prev, {
        text: 'Erro de conexão com o servidor.',
        isUser: false,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const userMsg: Message = {
      text: `📸 Imagem enviada: ${file.name}`,
      isUser: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await chatService.analyzeImage(file);
      if (res.success) {
        const botMsg: Message = {
          text: res.response,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(res.error || 'Erro ao analisar a imagem.');
      }
    } catch (err) {
      console.error('Erro ao enviar imagem:', err);
      setMessages(prev => [...prev, {
        text: 'Erro ao enviar imagem.',
        isUser: false,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const formatMessage = (text: string) => {
    const rawHtml = marked.parse(text || '') as string;
    return DOMPurify.sanitize(rawHtml);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="nutri-chat-root">
      <div className="bg-wrap">
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>
        <div className="bg-shape shape-3"></div>
        <div className="bg-glow"></div>
      </div>

      <div className="chat-card fade-in-up">
        <header className="chat-top">
          <div className="top-left">
            <div className="mascot-box">
              <img src={logo} alt="NutriNow Mascot" className="mascot-img" />
            </div>
            <div className="title-area">
              <span className="kicker">Assistente NutriNow</span>
              <h1 className="chat-title">Chat com NutriAI</h1>
              <span className="chat-sub">Online e pronto para ajudar</span>
            </div>
          </div>
          
          <button className="logout-btn" onClick={handleLogout} title="Sair do chat">
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </header>

        <main className="messages-area">
          {messages.map((msg, idx) => (
            <div key={idx} className={`msg-row ${msg.isUser ? 'msg-user' : 'msg-bot'}`}>
              {!msg.isUser && (
                <div className="msg-avatar">
                   <img src={logo} alt="NutriAI" />
                </div>
              )}
              <div className="msg-bubble">
                <div 
                  className="msg-text" 
                  dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }}
                ></div>
                <div className="msg-time">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {msg.isUser && (
                <div className="msg-avatar user-avatar">
                  <div className="user-initial">{user?.nome?.[0] || 'U'}</div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="msg-row msg-bot">
              <div className="msg-avatar">
                <img src={logo} alt="NutriAI" />
              </div>
              <div className="msg-bubble typing">
                <div className="typing-dots">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
        </main>

        <form className="chat-input-area" onSubmit={handleSendMessage}>
          <label className="file-label" title="Analisar Imagem">
            <ImageIcon size={22} color="white" />
            <input type="file" hidden accept="image/*" onChange={onFileSelected} />
          </label>
          
          <input 
            type="text" 
            className="input-field" 
            placeholder="Pergunte sobre sua dieta ou treino..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
          />

          <button type="submit" className="send-btn" disabled={loading}>
            <Send size={22} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chatbot;
