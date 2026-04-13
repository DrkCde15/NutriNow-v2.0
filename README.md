# 🥗 NutriNow 2.0 — O Futuro da Nutrição com I.A

![NutriNow Logo](NutriNow_FrontEnd_React/src/assets/logo.png)

## 🎯 Nossa Proposta: Saúde Inteligente e Privada

O **NutriNow 2.0** não é apenas mais um rastreador de calorias ou gerenciador de dietas. Nossa proposta é ser um **Consultor de Saúde Onipresente**, eliminando a barreira entre o usuário e o conhecimento nutricional de alta qualidade, sem comprometer seus dados pessoais.

Muitas plataformas de saúde hoje dependem de serviços na nuvem onde seus dados alimentares, médicos e rotinas são vendidos ou processados por grandes modelos de linguagem externos. O NutriNow rompe com isso através da **I.A de Ponta**, utilizando o estado da arte em processamento de linguagem e visão computacional via **Google GenAI**.

---

## 🍎 Saúde e Nutrição na Era Digital

A nutrição é o pilar fundamental da longevidade e da performance humana. No entanto, o acesso a orientações personalizadas muitas vezes é caro ou inacessível. O **NutriNow** surge para democratizar esse acesso, utilizando a tecnologia para transformar dados complexos em escolhas simples e saudáveis.

### O Papel da I.A na Nutrição Moderna

A Inteligência Artificial atua como um catalisador para a mudança de hábitos. Diferente de tabelas estáticas, a I.A do NutriNow:

- **Personaliza em Escala**: Adapta recomendações em tempo real com base no seu metabolismo e objetivos únicos.
- **Simplifica o Complexo**: Transforma uma simples foto de um prato em uma análise técnica completa de macronutrientes.
- **Educação Continuada**: Não apenas diz o que comer, mas explica o _porquê_, ajudando na construção de uma consciência alimentar duradoura.
- **Suporte 24/7**: Erros e dúvidas não têm hora para acontecer. Ter uma assistência inteligente sempre disponível reduz drasticamente as chances de desistência de uma dieta ou plano de treino.

---

## 🤖 A Inteligência Artificial

A IA do NutriNow utiliza a biblioteca **Google GenAI**, integrando o modelo **Gemini 2.5 Flash** para oferecer uma experiência de alta performance, rapidez e inteligência superior.

### Por que Gemini 2.5 Flash?

1.  **Velocidade e Estabilidade**: O Gemini 2.5 Flash é otimizado para respostas rápidas e possui limites de cota muito mais generosos e estáveis, garantindo um acompanhamento sem falhas.
2.  **Visão Computacional Avançada**: Diferente de modelos locais limitados, o Gemini possui uma capacidade multimodal nativa que analisa fotos de alimentos com precisão de detalhes impressionante.
3.  **Análise de Visão em Dois Estágios**:
    -   **Identificação**: Nossa aplicação utiliza a visão multimodal do Gemini para extrair fatos visuais complexos (ingredientes, porções e métodos de preparo).
    -   **Interpretação**: A NutriAI processa esses dados para gerar um relatório nutricional estruturado com macronutrientes e dicas personalizadas.

---

## ✨ Funcionalidades Principais

### 💬 Chatbot NutriAI

Sua nutricionista particular disponível 24/7.

- **Contexto de Perfil**: Ela sabe sua meta (Ex: Emagrecer) e ajusta o tom da conversa para te manter motivado.
- **Memória Persistente**: Graças à integração com o banco de dados, ela lembra do seu progresso em sessões diferentes.

### 📸 Diagnóstico de Refeição

Basta tirar uma foto do seu prato para receber:

- Estimativa de Calorias, Proteínas, Carboidratos e Gorduras.
- Avaliação de equilíbrio nutricional para atletas.
- "Dica de Ouro" para otimizar sua próxima refeição.

---

## 🛠️ Stack Tecnológica

- **Frontend**: React 18, Vite, TypeScript, Lucide-Icons, CSS Premium (Glassmorphism).
- **Backend**: Flask (Python), MySQL, Google GenAI SDK.
- **Motor de IA**: Google Gemini 2.5 Flash (Multimodal & Velocidade).

---

## 🚀 Como Rodar o Projeto

### 1. Obter Chave de API
Obtenha uma chave de API gratuita ou premium no [Google AI Studio](https://aistudio.google.com/).

### 2. Banco de Dados
Importe o `NutriNow_BackEnd/nutrinow2.sql` no seu servidor MySQL.

### 3. Configuração (.env)
Na pasta `NutriNow_BackEnd/`, configure seu `.env`:

```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=nutrinow2
FLASK_SECRET_KEY=nutrinow_sec_key
GEMINI_API_KEY=sua_chave_api_do_google
```

---

**NutriNow** — _Transformando tecnologia em saúde, uma refeição por vez._ 🥗💪
