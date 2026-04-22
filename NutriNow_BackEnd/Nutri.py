# Nutri.py - Nutritionist Agent using Google GenAI (Gemini)
import sys
import os
import logging
import mysql.connector
from datetime import datetime
from typing import List, Optional, Dict
import random
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
             
        self.api_key = api_key
        self.api_version = os.getenv("GEMINI_API_VERSION", "v1")
        self.timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "120"))
        self.client = self._build_genai_client()
        self.model_name = "gemini-2.5-flash" 
        fallback_models_raw = os.getenv("GEMINI_FALLBACK_MODELS", "gemini-1.5-flash")
        self.fallback_models = [m.strip() for m in fallback_models_raw.split(",") if m.strip()]

        self.config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT
        )
        
        # Inicializa a ferramenta de visão local (agora também usando GenAI)
        self.food_analyser = FoodAnalyser()

    def _build_genai_client(self):
        return genai.Client(
            api_key=self.api_key,
            http_options=types.HttpOptions(
                apiVersion=self.api_version,
                timeout=self.timeout_seconds
            )
        )

    @staticmethod
    def _is_retryable_error(exc: Exception) -> bool:
        """Define quais erros de rede/API valem retry com backoff."""
        if isinstance(exc, (errors.ServerError, TimeoutError, ConnectionError)):
            return True

        msg = str(exc).lower()
        retryable_markers = (
            "429",
            "500",
            "502",
            "503",
            "504",
            "sslerror",
            "ssleoferror",
            "unexpected_eof_while_reading",
            "eof occurred",
            "connection aborted",
            "connection reset",
            "timed out",
            "timeout",
            "temporarily unavailable",
        )
        return any(marker in msg for marker in retryable_markers)

    def _generate_with_retry(self, contents: str, config: Optional[types.GenerateContentConfig] = None):
        max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "5"))
        config = config or self.config
        candidate_models = [self.model_name] + [m for m in self.fallback_models if m != self.model_name]
        last_exc = None

        for model in candidate_models:
            for attempt in range(max_retries):
                try:
                    return self.client.models.generate_content(
                        model=model,
                        contents=contents,
                        config=config
                    )
                except Exception as exc:
                    last_exc = exc
                    if not self._is_retryable_error(exc):
                        break

                    if attempt >= max_retries - 1:
                        break

                    # Em erro SSL/EOF, recria o cliente para renovar handshake/conexoes.
                    msg = str(exc).lower()
                    if "ssl" in msg or "eof" in msg:
                        self.client = self._build_genai_client()

                    # Exponential backoff com jitter para reduzir colisao entre retries concorrentes.
                    wait_time = min(2 ** attempt, 16) + random.uniform(0, 0.75)
                    logger.warning(
                        f"Falha transitoria ao chamar Gemini [{model}] (tentativa {attempt + 1}/{max_retries}): {exc}. "
                        f"Novo retry em {wait_time:.2f}s."
                    )
                    time.sleep(wait_time)

            logger.warning(f"Falha ao usar o modelo {model}. Tentando fallback, se disponivel.")

        raise last_exc if last_exc else RuntimeError("Falha ao gerar conteudo no Gemini.")

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
                       altura, peso, ja_treinou
                FROM perfil WHERE usuario_id = %s
            """, (self.user_id,))
            perfil = cursor.fetchone()
            conn.close()
            
            if perfil:
                contexto = f"\n\n[CONTEXTO DO USUÁRIO]: Meta: {perfil['meta']} | "
                contexto += f"Altura: {perfil['altura']}m | Peso: {perfil['peso']}kg | "
                contexto += f"Histórico de Treino: {perfil['ja_treinou']}"
                return contexto
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
        """Salva mensagem no historico do MySQL"""
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            # Incluido 'email' no INSERT conforme o schema SQL
            cursor.execute(
                "INSERT INTO chat_history (session_id, user_id, email, message_type, content) VALUES (%s, %s, %s, %s, %s)",
                (self.session_id, self.user_id, self.email, message_type, content)
            )
            conn.commit()
            cursor.close()
            conn.close()
            logger.info(f"Mensagem salva no DB: {message_type}")
        except Exception as e:
            logger.error(f"Erro ao salvar mensagem no banco: {e}")

    def run_text(self, text: str) -> str:
        """Processa uma mensagem de texto usando IA Local"""
        try:
            # 1. Recupera Contexto e Historico
            user_context = self._get_user_context()
            chat_history = self.get_conversation_history(limit=6)

            # 2. Monta o Prompt com Memoria
            full_prompt = f"{SYSTEM_PROMPT}{user_context}\n\n"
            for msg in chat_history:
                full_prompt += f"{msg['role'].capitalize()}: {msg['content']}\n"

            full_prompt += f"User: {text}\nAssistant:"

            # 3. Gera resposta com retry robusto para quota, servidor e SSL/transiente.
            response = self._generate_with_retry(contents=full_prompt, config=self.config)
            result = response.text

            # 4. Salva no Banco
            self._save_message("human", text)
            self._save_message("ai", result)
            return result
        except Exception as e:
            logger.error(f"Erro no NutriAgent: {e}")
            if "429" in str(e):
                return "A NutriAI esta muito requisitada agora (limite de cota excedido). Aguarde alguns segundos e tente novamente."
            if "503" in str(e):
                return "Os servidores da Google estao com alta demanda temporaria (503). Aguarde alguns segundos e tente novamente."
            if "ssl" in str(e).lower() or "eof" in str(e).lower():
                return "Houve uma instabilidade de conexao segura com a IA (SSL). Tente novamente em alguns segundos."
            return "Puxa, tive um probleminha tecnico aqui. Pode repetir?"

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
