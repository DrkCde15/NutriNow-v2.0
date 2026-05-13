# Nutri.py - Nutritionist Agent using Groq API
import os
import logging
import random
import time
from datetime import date, datetime
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
- Use o contexto do perfil e da agenda do NutriNow quando eles estiverem disponiveis.
- Nunca invente eventos da agenda; se nao houver agenda no contexto, diga que nao encontrou itens agendados.
- Finalize sempre com uma frase de incentivo baseada no objetivo do usuario.
- Formate suas respostas em Markdown rico (use > para citacoes e alertas).
"""

WEEKDAY_LABELS = {
    "MO": "segunda",
    "TU": "terca",
    "WE": "quarta",
    "TH": "quinta",
    "FR": "sexta",
    "SA": "sabado",
    "SU": "domingo",
}


class NutritionistAgent:
    def __init__(self, session_id: str, mysql_config: Optional[dict] = None, user_id: Optional[int] = None, email: Optional[str] = None):
        self.session_id = session_id
        self.user_id = user_id
        self.email = email
        self.db_config = mysql_config or {
            "host": os.getenv("MYSQL_HOST"),
            "user": os.getenv("MYSQL_USER"),
            "password": os.getenv("MYSQL_PASSWORD"),
            "database": os.getenv("MYSQL_DATABASE"),
            "port": int(os.getenv("MYSQL_PORT")),
        }

        # Groq only
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.groq_base_url = os.getenv("GROQ_BASE_URL").rstrip("/")
        self.groq_timeout_seconds = self._resolve_groq_timeout_seconds()
        self.max_retries = int(os.getenv("GROQ_MAX_RETRIES"))
        self.temperature = float(os.getenv("GROQ_TEMPERATURE"))

        self.model_name = os.getenv("GROQ_PRIMARY_MODEL")
        fallback_models_raw = os.getenv("GROQ_FALLBACK_MODELS")
        self.fallback_models = [m.strip() for m in fallback_models_raw.split(",") if m.strip()]

        if not self.groq_api_key:
            logger.warning("GROQ_API_KEY nao encontrada no .env")

    @staticmethod
    def _resolve_groq_timeout_seconds() -> int:
        raw = os.getenv("GROQ_TIMEOUT_SECONDS")
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
            raise RuntimeError("GROQ_API_KEY nao configurada")

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

    @staticmethod
    def _to_datetime(value) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, date):
            return datetime.combine(value, datetime.min.time())
        if isinstance(value, str):
            normalized = value.replace("Z", "+00:00")
            try:
                return datetime.fromisoformat(normalized).replace(tzinfo=None)
            except ValueError:
                pass

            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
        return datetime.now()

    @staticmethod
    def _clean_context_text(value, max_length: int = 180) -> str:
        text = " ".join(str(value or "").split())
        if len(text) <= max_length:
            return text
        return f"{text[: max_length - 3].rstrip()}..."

    @staticmethod
    def _parse_recurrence_days(value) -> List[str]:
        days = []
        for part in str(value or "").split(","):
            day = part.strip().upper()
            if day in WEEKDAY_LABELS and day not in days:
                days.append(day)
        return days

    @classmethod
    def _format_recurrence(cls, item: Dict) -> str:
        recurrence_type = str(item.get("recurrence_type") or "none").lower()
        if recurrence_type != "weekly":
            return "recorrencia: nao"

        recurrence_days = cls._parse_recurrence_days(item.get("recurrence_days"))
        if not recurrence_days:
            return "recorrencia: semanal"

        day_labels = ", ".join(WEEKDAY_LABELS[day] for day in recurrence_days)
        recurrence = f"recorrencia: semanal em {day_labels}"
        recurrence_until = item.get("recurrence_until")
        if recurrence_until:
            until_date = cls._to_datetime(recurrence_until).strftime("%d/%m/%Y")
            recurrence += f" ate {until_date}"
        return recurrence

    @staticmethod
    def _item_start_datetime(item: Dict) -> datetime:
        start = NutritionistAgent._to_datetime(item.get("created_at"))
        time_value = str(item.get("time") or "").strip()

        if len(time_value) == 5 and time_value[2] == ":":
            try:
                hours, minutes = [int(part) for part in time_value.split(":")]
                start = start.replace(hour=hours, minute=minutes, second=0, microsecond=0)
            except ValueError:
                pass

        return start

    @staticmethod
    def _resolve_dieta_user_column(cursor) -> str:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'dieta_treino'
              AND column_name IN ('user_id', 'usuario_id')
            """
        )
        columns = {
            row.get("column_name") or row.get("COLUMN_NAME")
            for row in cursor.fetchall()
        }
        if "user_id" in columns:
            return "user_id"
        if "usuario_id" in columns:
            return "usuario_id"
        return "user_id"

    @staticmethod
    def _get_dieta_treino_columns(cursor) -> set:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = DATABASE()
              AND table_name = 'dieta_treino'
            """
        )
        return {
            row.get("column_name") or row.get("COLUMN_NAME")
            for row in cursor.fetchall()
        }

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

    def _get_calendar_context(self, limit: int = 12) -> str:
        """Busca itens de dieta/treino agendados para injetar no prompt."""
        if not self.user_id:
            return ""

        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(dictionary=True)
            columns = self._get_dieta_treino_columns(cursor)
            if not columns:
                conn.close()
                return ""

            user_column = self._resolve_dieta_user_column(cursor)
            duration_expr = "duration_minutes" if "duration_minutes" in columns else "60 AS duration_minutes"
            recurrence_type_expr = "recurrence_type" if "recurrence_type" in columns else "'none' AS recurrence_type"
            recurrence_days_expr = "recurrence_days" if "recurrence_days" in columns else "NULL AS recurrence_days"
            recurrence_until_expr = (
                "DATE_FORMAT(recurrence_until, '%Y-%m-%d') AS recurrence_until"
                if "recurrence_until" in columns
                else "NULL AS recurrence_until"
            )

            cursor.execute(
                f"""
                SELECT
                    id,
                    tipo,
                    title,
                    description,
                    time,
                    created_at,
                    updated_at,
                    {duration_expr},
                    {recurrence_type_expr},
                    {recurrence_days_expr},
                    {recurrence_until_expr}
                FROM dieta_treino
                WHERE {user_column}=%s
                ORDER BY
                    CASE
                        WHEN recurrence_type = 'weekly'
                          AND (recurrence_until IS NULL OR recurrence_until >= CURDATE()) THEN 0
                        WHEN created_at >= NOW() THEN 1
                        ELSE 2
                    END,
                    created_at ASC
                LIMIT %s
                """,
                (self.user_id, limit),
            )
            items = cursor.fetchall() or []
            conn.close()

            if not items:
                return "\n\n[CONTEXTO DA AGENDA DO USUARIO]: Nenhum treino ou dieta agendado no NutriNow."

            lines = []
            for item in items:
                tipo = str(item.get("tipo") or "").lower()
                tipo_label = "Treino" if tipo == "treino" else "Dieta"
                title = self._clean_context_text(item.get("title"), 80) or "Sem titulo"
                description = self._clean_context_text(item.get("description"))
                start = self._item_start_datetime(item)
                duration = int(item.get("duration_minutes") or 60)
                updated_at = self._to_datetime(item.get("updated_at")).strftime("%d/%m/%Y")

                parts = [
                    f"{tipo_label}: {title}",
                    f"quando: {start.strftime('%d/%m/%Y %H:%M')}",
                    f"duracao: {duration} min",
                    self._format_recurrence(item),
                    f"atualizado: {updated_at}",
                ]
                if description:
                    parts.append(f"descricao: {description}")
                lines.append(f"- {' | '.join(parts)}")

            return "\n\n[CONTEXTO DA AGENDA DO USUARIO]:\n" + "\n".join(lines)
        except Exception as e:
            logger.error(f"Erro ao buscar contexto da agenda: {e}")
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
            calendar_context = self._get_calendar_context()
            chat_history = self.get_conversation_history(limit=6)

            messages: List[Dict[str, str]] = [{"role": "system", "content": f"{SYSTEM_PROMPT}{user_context}{calendar_context}"}]
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
