# Nutri.py - Nutritionist Agent using Groq API
import os
import logging
import random
import time
from typing import List, Optional, Dict
import mysql.connector
import requests

# Configuracao de Logging
logger = logging.getLogger("NutriAgent")

SYSTEM_PROMPT = """
Voce e a NutriAI, uma assistente de nutricao inteligente integrada ao ecossistema NutriNow.
Sua missao e ajudar usuarios a alcancarem seus objetivos de saude atraves de dicas personalizadas,
analise de dietas e motivacao constante.

### Persona:
- Atenciosa, tecnica (mas com linguagem acessivel) e extremamente motivadora.
- Voce e uma "Consultora Protetora": se identificar comportamentos prejudiciais (dietas extremas, jejuns perigosos),
  voce deve alertar o usuario de forma gentil mas firme.

### Suas Capacidades:
1. Sugerir substituicoes saudaveis.
2. Montar rotinas de treino baseadas no perfil.
3. Responder duvidas sobre suplementacao e hidratacao.

### Regras de Resposta:
- Use sempre **Negrito** para destacar nomes de alimentos, macros ou termos tecnicos.
- Utilize listas (bullet points) para organizar sugestoes.
- Se o usuario perguntar algo fora do escopo de saude/nutricao, responda gentilmente que seu foco e o bem-estar dele.
- Finalize sempre com uma frase de incentivo baseada no objetivo do usuario.
- Formate suas respostas em Markdown rico (use > para citacoes e alertas).
"""


class NutritionistAgent:
    def __init__(self, session_id: str, mysql_config: Optional[dict] = None, user_id: Optional[int] = None, email: Optional[str] = None):
        self.session_id = session_id
        self.user_id = user_id
        self.email = email
        self.db_config = mysql_config or {
            "host": os.getenv("MYSQL_HOST", "localhost"),
            "user": os.getenv("MYSQL_USER", "root"),
            "password": os.getenv("MYSQL_PASSWORD", ""),
            "database": os.getenv("MYSQL_DATABASE", "nutrinow2"),
            "port": int(os.getenv("MYSQL_PORT", 3306)),
        }

        # Groq only
        self.groq_api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY")
        self.groq_base_url = os.getenv("GROQ_BASE_URL").rstrip("/")
        self.groq_timeout_seconds = self._resolve_groq_timeout_seconds()
        self.max_retries = int(os.getenv("GROQ_MAX_RETRIES", "5"))
        self.temperature = float(os.getenv("GROQ_TEMPERATURE", "0.7"))

        self.model_name = os.getenv("GROQ_PRIMARY_MODEL", "groq/compound-mini")
        fallback_models_raw = os.getenv("GROQ_FALLBACK_MODELS", "groq/compound")
        self.fallback_models = [m.strip() for m in fallback_models_raw.split(",") if m.strip()]

        if not self.groq_api_key:
            logger.warning("GROQ_API_KEY/GROQ_KEY nao encontrada no .env")

    @staticmethod
    def _resolve_groq_timeout_seconds() -> int:
        raw = os.getenv("GROQ_TIMEOUT_SECONDS", "60")
        try:
            timeout = int(float(raw))
        except (TypeError, ValueError):
            timeout = 60
        return max(timeout, 5)

    @staticmethod
    def _is_retryable_error(exc: Exception) -> bool:
        msg = str(exc).lower()
        retryable_markers = (
            "429",
            "500",
            "502",
            "503",
            "504",
            "timeout",
            "timed out",
            "ssl",
            "eof",
            "connection reset",
            "connection aborted",
            "temporarily unavailable",
            "unavailable",
            "high demand",
            "rate limit",
        )
        return any(marker in msg for marker in retryable_markers)

    def _call_groq_chat_completion(self, messages: List[Dict[str, str]], model: str) -> str:
        if not self.groq_api_key:
            raise RuntimeError("GROQ_API_KEY/GROQ_KEY nao configurada")

        url = f"{self.groq_base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": self.temperature,
        }

        try:
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=self.groq_timeout_seconds,
            )
        except requests.RequestException as req_err:
            raise RuntimeError(f"Falha de rede no Groq: {req_err}") from req_err

        if response.status_code >= 400:
            raise RuntimeError(f"{response.status_code} {response.text}")

        data = response.json()
        return (
            data.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )

    def _generate_with_retry(self, messages: List[Dict[str, str]]) -> str:
        candidate_models: List[str] = []
        for model in [self.model_name] + self.fallback_models:
            if model and model not in candidate_models:
                candidate_models.append(model)

        last_exc: Optional[Exception] = None

        for model_index, model in enumerate(candidate_models):
            if model_index > 0:
                time.sleep(1)

            for attempt in range(self.max_retries):
                try:
                    return self._call_groq_chat_completion(messages=messages, model=model)
                except Exception as exc:
                    last_exc = exc
                    if not self._is_retryable_error(exc):
                        break

                    if attempt >= self.max_retries - 1:
                        break

                    wait_time = min(2 ** attempt, 16) + random.uniform(0, 0.75)
                    logger.warning(
                        f"Falha transitoria ao chamar Groq [{model}] "
                        f"(tentativa {attempt + 1}/{self.max_retries}): {exc}. "
                        f"Novo retry em {wait_time:.2f}s."
                    )
                    time.sleep(wait_time)

            logger.warning(f"Falha ao usar o modelo {model}. Tentando fallback, se disponivel.")

        raise last_exc if last_exc else RuntimeError("Falha ao gerar conteudo no Groq.")

    def _get_db_connection(self):
        return mysql.connector.connect(**self.db_config)

    def _get_user_context(self) -> str:
        """Busca informacoes do perfil do usuario para injetar no prompt."""
        if not self.user_id:
            return ""

        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                """
                SELECT IFNULL(meta, 'Nao definida') as meta,
                       altura, peso, ja_treinou
                FROM perfil WHERE usuario_id = %s
                """,
                (self.user_id,),
            )
            perfil = cursor.fetchone()
            conn.close()

            if perfil:
                contexto = f"\n\n[CONTEXTO DO USUARIO]: Meta: {perfil['meta']} | "
                contexto += f"Altura: {perfil['altura']}m | Peso: {perfil['peso']}kg | "
                contexto += f"Historico de Treino: {perfil['ja_treinou']}"
                return contexto
        except Exception as e:
            logger.error(f"Erro ao buscar contexto do usuario: {e}")
        return ""

    def get_conversation_history(self, limit: int = 10, by_user: bool = False) -> List[Dict]:
        """Recupera o historico do MySQL."""
        history = []
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(dictionary=True)

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

            for row in reversed(rows):
                history.append(
                    {
                        "role": "user" if row["message_type"] == "human" else "assistant",
                        "content": row["content"],
                        "timestamp": row["timestamp"],
                    }
                )
        except Exception as e:
            logger.error(f"Erro ao buscar historico: {e}")
        return history

    def _save_message(self, message_type: str, content: str):
        """Salva mensagem no historico do MySQL."""
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO chat_history (session_id, user_id, email, message_type, content) VALUES (%s, %s, %s, %s, %s)",
                (self.session_id, self.user_id, self.email, message_type, content),
            )
            conn.commit()
            cursor.close()
            conn.close()
            logger.info(f"Mensagem salva no DB: {message_type}")
        except Exception as e:
            logger.error(f"Erro ao salvar mensagem no banco: {e}")

    def run_text(self, text: str) -> str:
        """Processa uma mensagem de texto usando Groq."""
        try:
            user_context = self._get_user_context()
            chat_history = self.get_conversation_history(limit=6)

            messages: List[Dict[str, str]] = [{"role": "system", "content": f"{SYSTEM_PROMPT}{user_context}"}]
            for msg in chat_history:
                role = "user" if msg["role"] == "user" else "assistant"
                messages.append({"role": role, "content": msg["content"]})
            messages.append({"role": "user", "content": text})

            result = self._generate_with_retry(messages)

            self._save_message("human", text)
            self._save_message("ai", result)
            return result
        except Exception as e:
            logger.error(f"Erro no NutriAgent: {e}")
            msg = str(e).lower()
            if "429" in msg:
                return "A NutriAI esta muito requisitada agora (limite de cota excedido). Aguarde alguns segundos e tente novamente."
            if "503" in msg or "unavailable" in msg or "high demand" in msg:
                return "A IA esta temporariamente indisponivel por alta demanda. Tente novamente em instantes."
            if "ssl" in msg or "eof" in msg or "timeout" in msg:
                return "Houve uma instabilidade de conexao com a IA. Tente novamente em alguns segundos."
            return "Puxa, tive um probleminha tecnico aqui. Pode repetir?"

    def run_image(self, file_path: str) -> str:
        """No modo Groq atual, a analise de imagem nao esta habilitada neste agente."""
        return "No momento, este agente esta configurado para Groq em modo texto. A analise de imagem nao esta habilitada."
