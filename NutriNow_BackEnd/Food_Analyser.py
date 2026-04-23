# food_analyser.py - Nutritionist Vision Module using Google GenAI (Gemini)
import os
import logging
import traceback
import random
import time

from dotenv import load_dotenv
from google import genai
from google.genai import types, errors
from PIL import Image

load_dotenv()

logger = logging.getLogger(__name__)

VISION_PROMPT = """
Voce e um especialista em reconhecimento de alimentos e analise visual nutricional.
Analise a imagem e identifique com precisao:
1. Todos os alimentos presentes no prato/refeicao.
2. Estimativa de porcoes/quantidades (ex: 2 colheres de arroz, 1 bife grande).
3. Ingredientes visiveis (ex: azeite, salada de alface e tomate).
4. Metodo de preparo provavel (ex: grelhado, frito, cozido).
Seja puramente descritivo e tecnico sobre o que ve.
"""


class FoodAnalyser:
    def __init__(self, **kwargs):
        api_key = os.getenv("GEMINI_API_KEY")
        api_version = os.getenv("GEMINI_API_VERSION", "v1")
        timeout_seconds = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "120"))

        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                apiVersion=api_version,
                timeout=timeout_seconds,
            ),
        )
        self.model_name = "gemini-1.5-flash"
        self.config = types.GenerateContentConfig(system_instruction=VISION_PROMPT)
        logger.info("FoodAnalyser configurado com Gemini.")

    @staticmethod
    def _is_retryable_error(exc: Exception) -> bool:
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

    def _generate_with_retry(self, contents, config=None):
        max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "5"))
        for attempt in range(max_retries):
            try:
                return self.client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config,
                )
            except Exception as exc:
                if not self._is_retryable_error(exc) or attempt >= max_retries - 1:
                    raise

                wait_time = min(2**attempt, 16) + random.uniform(0, 0.75)
                logger.warning(
                    f"Falha transitoria no FoodAnalyser (tentativa {attempt + 1}/{max_retries}): {exc}. "
                    f"Novo retry em {wait_time:.2f}s."
                )
                time.sleep(wait_time)

    def _analyze_image(self, image_path: str) -> str:
        try:
            if not os.path.exists(image_path):
                return f"Erro: Arquivo {os.path.basename(image_path)} nao encontrado."

            logger.info("Estagio 1: extraindo fatos nutricionais da imagem...")
            instrucao_visao = "Identify all food items in this meal and estimate theirs portions."

            try:
                img = Image.open(image_path)
                res_vision = self._generate_with_retry(contents=[instrucao_visao, img])
                fatos_visuais = res_vision.text
            except Exception as vision_err:
                logger.error(f"Erro no estagio de visao: {vision_err}")
                if "429" in str(vision_err):
                    return "Erro: Limite de cota atingido. Aguarde alguns segundos antes de enviar outra imagem."
                if "503" in str(vision_err):
                    return "Erro: Servidor sobrecarregado (503). Aguarde alguns segundos e tente novamente."
                if "ssl" in str(vision_err).lower() or "eof" in str(vision_err).lower():
                    return "Erro de conexao segura (SSL/EOF) com a IA. Aguarde alguns segundos e tente novamente."
                return "Erro: Ocorreu um problema ao processar a imagem com Gemini. Tente novamente."

            logger.info("Estagio 2: NutriAI interpretando dados...")
            prompt_nutri = f"""
            Voce e a NutriAI, nutricionista expert. Com base na analise visual que voce acabou de realizar:

            Fatos identificados: {fatos_visuais}

            Gere um relatorio estruturado contendo:
            1. Tabela de Macronutrientes: Inclua estimativas de Calorias, Carboidratos(g), Proteinas(g) e Gorduras(g).
            2. Avaliacao da Refeicao: Diga se esta equilibrada para um atleta.
            3. Dica de Ouro: O que adicionar ou retirar para melhorar o valor nutricional.

            Use markdown, negrito para valores e emojis. Seja direta e profissional.
            """

            res_text = self._generate_with_retry(contents=prompt_nutri, config=self.config)
            resposta_final = res_text.text

            return f"""
Analise Nutricional NutriNow
Arquivo: {os.path.basename(image_path)}

{resposta_final}

---
Nota: Analise processada pela NutriAI via Google GenAI. Valores sao estimativas.
"""

        except Exception as e:
            logger.error(f"Erro na analise de visao: {traceback.format_exc()}")
            if "503" in str(e):
                return "A NutriAI esta enfrentando alta demanda (503). Aguarde alguns segundos e envie novamente."
            if "429" in str(e):
                return "Limite de requisicoes excedido (429). Aguarde um minuto."
            if "ssl" in str(e).lower() or "eof" in str(e).lower():
                return "Falha de conexao segura (SSL/EOF) durante a analise da imagem. Tente novamente em alguns segundos."
            return "A NutriAI nao conseguiu analisar esta imagem no momento. Verifique sua conexao e a chave API."

    def analyze_food_image(self, image_path: str) -> str:
        return self._analyze_image(image_path)
