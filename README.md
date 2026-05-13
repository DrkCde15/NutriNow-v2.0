# 🥗 NutriNow

Plataforma digital de nutricao e performance que transforma orientacao tecnica em acoes simples no dia a dia.

![Logo do projeto](Nutrinow_Frontend/src/assets/logo.png)

## ✨ O produto

O NutriNow 2 foi desenhado para quem quer melhorar saude, composicao corporal e consistencia sem depender de planilhas confusas.

A experiencia une:

- 🎯 acompanhamento de perfil e objetivo;
- 📅 organizacao de dieta e treino no mesmo lugar;
- 🤖 assistente NutriAI para tirar duvidas e manter motivacao.

## 🧩 Problema que resolvemos

Muita gente comeca uma rotina de saude, mas para no meio por 3 motivos:

- 😕 falta de clareza sobre o que fazer;
- 🔁 dificuldade para manter constancia;
- 📚 excesso de informacao contraditoria.

O NutriNow reduz essa friccao com orientacao continua, historico e contexto pessoal.

## 👥 Para quem e

- 🏋️ pessoas que querem emagrecer, ganhar massa ou melhorar habitos;
- 🌱 iniciantes que precisam de direcionamento pratico;
- 📲 usuarios que querem centralizar treino, dieta e suporte em uma unica interface.

## 🚀 Principais beneficios

- 🧭 Direcao clara: objetivo, progresso e rotina visiveis em um so fluxo.
- 💬 Apoio continuo: NutriAI disponivel para duvidas e reforco de habitos.
- ⚡ Menos atrito: cadastro, login e uso rapido, sem curva de aprendizado longa.
- 📈 Evolucao mensuravel: historico de interacoes e registros para acompanhar consistencia.

## 🛠️ Funcionalidades atuais

- 🔐 Cadastro e login (incluindo Google OAuth).
- 📧 Recuperacao de senha por e-mail.
- 👤 Perfil com meta, peso, altura e historico.
- 🥗 CRUD de dieta e treino.
- Google Calendar: conexao OAuth, recorrencia semanal e sincronizacao automatica dos itens de dieta/treino.
- 🤖 Chat com NutriAI (texto) com memoria no MySQL.
- 📸 Endpoint de analise de imagem disponivel (agente atual em modo texto).

## 🗺️ Jornada do usuario (resumo)

1. 📝 Cria conta e define objetivo.
2. ⚙️ Ajusta perfil inicial (dados fisicos e meta).
3. 📆 Registra dieta e treino da semana.
4. 💡 Usa o chat para suporte e ajustes.
5. 📊 Volta ao dashboard para acompanhar constancia.

## 🌟 Diferenciais do NutriNow

- 🎯 Produto orientado a resultado, nao so a registro.
- 🧠 IA contextual (considera usuario, sessao e historico).
- 🏗️ Arquitetura pronta para evoluir de MVP para ambiente produtivo.

## 🧱 Stack (para contexto)

### Frontend

- React 19 com TypeScript.
- Vite 7 para desenvolvimento, build e preview.
- TanStack Router/TanStack Start para roteamento e estrutura da aplicação.
- TanStack Query para controle de estado assíncrono e chamadas à API.
- Tailwind CSS 4 para estilos utilitários.
- Radix UI como base de componentes acessíveis.
- Lucide React para ícones.
- React Hook Form + Zod para formulários e validação.
- Date-fns para manipulação de datas no calendário.
- Recharts para visualizações e gráficos.
- Sonner para notificações.

### Backend

- Python com Flask como API HTTP.
- Flask-Cors para liberar comunicação entre frontend e backend em ambiente local.
- MySQL Connector para acesso ao banco de dados.
- Python-dotenv para leitura das variáveis do `.env`.
- Requests + OAuthlib para integrações externas via HTTP/OAuth.
- Werkzeug para recursos auxiliares de segurança e utilidades web.
- Serviços organizados em rotas e módulos internos (`auth`, `profile`, `fitness`, `calendar`, `chatbot`, `feedbacks`).

### Banco de dados

- MySQL 8+.
- Schema principal documentado em `NutriNow_BackEnd/SQL.txt`.
- Armazena usuários, perfil, dieta/treino, histórico do chat, feedbacks e tokens/eventos vinculados ao Google Calendar.

### Autenticação e integrações

- Login tradicional com e-mail/senha.
- Google OAuth 2.0 para autenticação.
- Google Calendar API para criar, atualizar e excluir eventos automaticamente a partir dos itens de dieta/treino.
- Recuperação de senha por e-mail via serviço SMTP configurado no backend.
- Integração com Groq em formato compatível com OpenAI API para o chat NutriAI.

### IA

- NutriAI roda no backend e usa histórico/contexto do usuário salvo no MySQL.
- Dependências de LangChain estão presentes para evolução do agente e orquestração de fluxos.
- Há suporte configurável por variáveis de ambiente para modelo principal, fallback, timeout, retries e temperatura.

### Tooling e qualidade

- TypeScript para tipagem no frontend.
- ESLint e Prettier para padronização do código frontend.
- Scripts npm principais: `dev`, `build`, `preview`, `lint` e `format`.
- Build do frontend com Vite.
- Backend executado diretamente com `python App.py`.

---

## 👨‍💻 Guia rapido para desenvolvedores

### ✅ Requisitos

- Node.js 20+
- npm 10+
- Python 3.10+
- MySQL 8+

### 🗂️ Estrutura

```text
NutriNow-2/
|- Nutrinow_Frontend/
|- NutriNow_BackEnd/
`- README.md
```

### ⚙️ Backend

```bash
cd NutriNow_BackEnd
pip install -r requirements.txt
python App.py
```

Backend padrao: `http://127.0.0.1:8000`  
Healthcheck: `GET /health`

`.env` esperado em `NutriNow_BackEnd/`:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=nutrinow2
HOST=127.0.0.1
PORT=8000
FLASK_DEBUG=true
FLASK_SECRET_KEY=troque_esta_chave
JWT_SECRET_KEY=troque_esta_chave
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
GROQ_API_KEY=sua_chave_groq
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_PRIMARY_MODEL=groq/compound-mini
GROQ_FALLBACK_MODELS=groq/compound
GROQ_TIMEOUT_SECONDS=60
GROQ_MAX_RETRIES=5
GROQ_TEMPERATURE=0.7
CLIENT_ID=seu_google_client_id
SECRET_KEY_CLIENT=seu_google_client_secret
GOOGLE_CALENDAR_REDIRECT_URI=http://127.0.0.1:8000/calendar/google/callback
GOOGLE_CALENDAR_TIMEZONE=America/Sao_Paulo
GOOGLE_CALENDAR_EVENT_DURATION_MINUTES=60
EMAIL_SENDER=seu_email@gmail.com
EMAIL_PASSWORD=sua_senha_de_app
```

No Google Cloud Console, ative a Google Calendar API e adicione a URI acima em
**Authorized redirect URIs** do cliente OAuth. A integracao usa o escopo
`https://www.googleapis.com/auth/calendar.events`.

### 🎨 Frontend

```bash
cd Nutrinow_Frontend
npm install
npm run dev
```

Crie `.env` com:

```env
VITE_API_URL=http://127.0.0.1:8000
```
