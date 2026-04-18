# Nutri.py - Nutritionist Agent using Google GenAI (Gemini)
import sys
import os
import logging
import mysql.connector
from datetime import datetime
from typing import List, Optional, Dict

from google import genai
from google.genai import types, errors
import time
from Food_Analyser import FoodAnalyser

# Configuração de Logging
logger = logging.getLogger("NutriAgent")

SYSTEM_PROMPT = """
Você é a NutriAI, uma assistente de nutrição inteligente integrada ao ecossistema NutriNow.
Sua missão é ajudar usuários a alcançarem seus objetivos de saúde através de dicas personalizadas,
análise de dietas e motivação constante.

### Persona:
- Atenciosa, técnica (mas com linguagem acessível) e extremamente motivadora.
- Você é uma "Consultora Protetora": se identificar comportamentos prejudiciais (dietas extremas, jejuns perigosos),
  você deve alertar o usuário de forma gentil mas firme.

### Suas Capacidades:
1. Analisar fotos de pratos (via ferramenta food_analyser).
2. Sugerir substituições saudáveis.
3. Montar rotinas de treino baseadas no perfil.
4. Responder dúvidas sobre suplementação e hidratação.

### Regras de Resposta:
- Use sempre **Negrito** para destacar nomes de alimentos, macros ou termos técnicos.
- Utilize listas (bullet points) para organizar sugestões.
- Se o usuário perguntar algo fora do escopo de saúde/nutrição, responda gentilmente que seu foco é o bem-estar dele.
- Finalize sempre com uma frase de incentivo baseada no objetivo do usuário.
- Formate suas respostas em Markdown rico (use > para citações e alertas).
"""

class NutritionistAgent:
    def __init__(self, session_id: str, mysql_config: Optional[dict] = None, user_id: Optional[int] = None, email: Optional[str] = None):
        self.session_id = session_id
        self.user_id = user_id
        self.email = email
        self.db_config = mysql_config or {
            'host': os.getenv('MYSQL_HOST', 'localhost'),
            'user': os.getenv('MYSQL_USER', 'root'),
            'password': os.getenv('MYSQL_PASSWORD', ''),
            'database': os.getenv('MYSQL_DATABASE', 'nutrinow2'),
            'port': int(os.getenv('MYSQL_PORT', 3306))
        }
        
        # Inicializa o Cliente Google GenAI (Gemini)
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
             logger.warning("GEMINI_API_KEY não encontrada no .env")
             
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash" 

        self.config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT
        )
        
        # Inicializa a ferramenta de visão local (agora também usando GenAI)
        self.food_analyser = FoodAnalyser()

    def _get_db_connection(self):
        return mysql.connector.connect(**self.db_config)

    def _get_user_context(self) -> str:
        """Busca informações do perfil do usuário para injetar no sistema de IA"""
        if not self.user_id:
            return ""
        
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("""
                SELECT IFNULL(meta, 'Não definida') as meta, 
                       IFNULL(altura_peso, 'Não informada') as medidas
                FROM perfil WHERE usuario_id = %s
            """, (self.user_id,))
            perfil = cursor.fetchone()
            conn.close()
            
            if perfil:
                return f"\n\n[CONTEXTO DO USUÁRIO]: Meta: {perfil['meta']} | Medidas: {perfil['medidas']}"
        except Exception as e:
            logger.error(f"Erro ao buscar contexto do usuário: {e}")
        return ""
    def get_conversation_history(self, limit: int = 10, by_user: bool = False) -> List[Dict]:
        """Recupera o histórico do MySQL"""
        history = []
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Ajustado para usar 'message_type' conforme o schema oficial
            query = "SELECT message_type, content, timestamp FROM chat_history WHERE "
            params = []
            if by_user and self.user_id:
                query += "user_id = %s "
                params.append(self.user_id)
            else:
                query += "session_id = %s "
                params.append(self.session_id)
            
            query += """
                ORDER BY
                    timestamp DESC,
                    CASE WHEN message_type = 'ai' THEN 0 ELSE 1 END
                LIMIT %s
            """
            params.append(limit)
            
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            conn.close()
            
            # Formata para a IA (do mais antigo para o mais novo)
            for row in reversed(rows):
                history.append({
                    "role": "user" if row['message_type'] == 'human' else "assistant",
                    "content": row['content'],
                    "timestamp": row['timestamp']
                })
        except Exception as e:
            logger.error(f"Erro ao buscar histórico: {e}")
        return history

    def _save_message(self, message_type: str, content: str):
        """Salva mensagem no histórico do MySQL"""
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            # Incluído 'email' no INSERT conforme o schema SQL
            cursor.execute(
                "INSERT INTO chat_history (session_id, user_id, email, message_type, content) VALUES (%s, %s, %s, %s, %s)",
                (self.session_id, self.user_id, self.email, message_type, content)
            )
            conn.commit()
            cursor.close()
            conn.close()
            logger.info(f"✅ Mensagem salva no DB: {message_type}")
        except Exception as e:
            logger.error(f"❌ Erro ao salvar mensagem no banco: {e}")

    def run_text(self, text: str) -> str:
        """Processa uma mensagem de texto usando IA Local"""
        try:
            # 1. Recupera Contexto e Histórico
            user_context = self._get_user_context()
            chat_history = self.get_conversation_history(limit=6)
            
            # 2. Monta o Prompt com Memória
            full_prompt = f"{SYSTEM_PROMPT}{user_context}\n\n"
            for msg in chat_history:
                full_prompt += f"{msg['role'].capitalize()}: {msg['content']}\n"
            
            full_prompt += f"User: {text}\nAssistant:"

            # 3. Gera Resposta com Gemini (com Retry para 429)
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = self.client.models.generate_content(
                        model=self.model_name,
                        contents=full_prompt,
                        config=self.config
                    )
                    result = response.text
                    break # Sucesso!
                except Exception as e:
                    if ("429" in str(e) or "503" in str(e)) and attempt < max_retries - 1:
                        wait_time = 2 ** attempt # Exponential backoff: 1, 2, 4s
                        tipo_erro = "Cota atingida (429)" if "429" in str(e) else "Servidor ocupado (503)"
                        logger.warning(f"{tipo_erro}. Tentando novamente em {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    raise e

            # 4. Salva no Banco
            self._save_message("human", text)
            self._save_message("ai", result)

            return result
        except Exception as e:
            logger.error(f"Erro no NutriAgent: {e}")
            if "429" in str(e):
                return "⚠️ A NutriAI está muito requisitada agora (limite de cota excedido). Por favor, aguarde uns segundos e tente novamente."
            if "503" in str(e):
                return "⚠️ Os servidores da Google estão com alta demanda temporária (503). Por favor, aguarde uns segundos e tente enviar novamente!"
            return "Puxa, tive um probleminha técnico aqui na minha memória local. Pode repetir?"

    def run_image(self, file_path: str) -> str:
        """Processa análise de imagem usando a ferramenta food_analyser"""
        try:
            # 1. Executa a análise (que agora tem timeout de 300s)
            result = self.food_analyser.analyze_food_image(file_path)
            
            # 2. Salva a interação no histórico
            self._save_message("human", f"[Imagem analisada: {os.path.basename(file_path)}]")
            self._save_message("ai", result)
            
            return result
        except Exception as e:
            logger.error(f"Erro ao processar imagem: {e}")
            return "Não consegui analisar sua foto agora. Verifique se o Ollama está rodando o modelo Moondream."
