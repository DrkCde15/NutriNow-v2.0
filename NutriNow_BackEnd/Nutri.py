# Nutri.py - Nutritionist Agent using NEURA Local AI
import sys
import os
import logging
import mysql.connector
import ollama
from datetime import datetime
from typing import List, Optional, Dict

# Adiciona o caminho do projeto NEURA ao python path para permitir o import direto
# O caminho é lido do .env para flexibilidade
from dotenv import load_dotenv
load_dotenv()

neura_path = os.getenv("NEURA_PATH", r'C:\Users\Júlio César\Documents\AGENTS\NEURA')
if neura_path not in sys.path:
    sys.path.append(neura_path)

try:
    from neura_ai.core import Neura
    from neura_ai.config import NeuraConfig
except ImportError:
    print(f"Erro: Não foi possível encontrar a pasta neura_ai em {neura_path}")

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
            'password': os.getenv('MYSQL_PASSWORD', 'Jcs050805j*'),
            'database': os.getenv('MYSQL_DATABASE', 'nutrinow2')
        }
        
        # Host padrão do Ollama
        host_ollama = "http://127.0.0.1:11434"
        
        # Inicializa o NEURA CORE (IA LOCAL)
        self.neura = Neura(
            model="gemma2:2b", 
            system_prompt=SYSTEM_PROMPT,
            host=host_ollama,
            use_memory=False # Stateless no Neura, memória gerida por nós via MySQL
        )
        
        
        # Inicializa a ferramenta de visão local
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
            
            query += "ORDER BY timestamp DESC LIMIT %s"
            params.append(limit)
            
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()
            conn.close()
            
            # Formata para a IA (do mais antigo para o mais novo)
            for row in reversed(rows):
                history.append({"role": "user" if row['message_type'] == 'human' else "assistant", "content": row['content']})
        except Exception as e:
            logger.error(f"Erro ao buscar histórico: {e}")
        return history

    def _save_message(self, message_type: str, content: str):
        """Salva mensagem no histórico do MySQL"""
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            # Ajustado para usar 'message_type' conforme o schema oficial
            cursor.execute(
                "INSERT INTO chat_history (session_id, user_id, message_type, content) VALUES (%s, %s, %s, %s)",
                (self.session_id, self.user_id, message_type, content)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            logger.error(f"Erro ao salvar mensagem: {e}")

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

            # 3. Gera Resposta com Timeout
            response = self.neura.client.generate(
                model="gemma2:2b",
                prompt=full_prompt
            )
            result = response['response']

            # 4. Salva no Banco
            self._save_message("human", text)
            self._save_message("ai", result)

            return result
        except Exception as e:
            logger.error(f"Erro no NutriAgent: {e}")
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
