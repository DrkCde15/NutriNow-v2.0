# food_analyser.py - Nutritionist Vision Module using Google GenAI (Gemini)
import os
import sys
import logging
import traceback
import base64
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types
from PIL import Image
import time

logger = logging.getLogger(__name__)

# Prompt especializado para o estágio 1
VISION_PROMPT = """
Você é um especialista em reconhecimento de alimentos e análise visual nutricional.
Analise a imagem e identifique com precisão:
1. Todos os alimentos presentes no prato/refeição.
2. Estimativa de porções/quantidades (ex: 2 colheres de arroz, 1 bife grande).
3. Ingredientes visíveis (ex: azeite, salada de alface e tomate).
4. Método de preparo provável (ex: grelhado, frito, cozido).
Seja puramente descritivo e técnico sobre o que vê.
"""

class FoodAnalyser:
    def __init__(self, **kwargs):
        # Inicializa o Cliente Google GenAI (Gemini)
        api_key = os.getenv("GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash"
        self.config = types.GenerateContentConfig(
            system_instruction=VISION_PROMPT
        )
        logger.info("🚀 FoodAnalyser configurado com Gemini 2.5 Flash.")



    def _analyze_image(self, image_path: str) -> str:
        try:
            if not os.path.exists(image_path):
                return f"❌ Erro: Arquivo {os.path.basename(image_path)} não encontrado."

            # ESTÁGIO 1: VISÃO BRUTA
            logger.info("👁️ Estágio 1: Extraindo fatos nutricionais da imagem...")
            instrucao_visao = "Identify all food items in this meal and estimate theirs portions."
            
            try:
                img = Image.open(image_path)
                
                max_retries = 2
                for attempt in range(max_retries):
                    try:
                        res_vision = self.client.models.generate_content(
                            model=self.model_name,
                            contents=[instrucao_visao, img]
                        )
                        fatos_visuais = res_vision.text
                        break
                    except Exception as e:
                        if ("429" in str(e) or "503" in str(e)) and attempt < max_retries - 1:
                            time.sleep(2)
                            continue
                        raise e
            except Exception as vision_err:
                logger.error(f"Erro no estágio de visão: {vision_err}")
                if "429" in str(vision_err):
                    return "❌ Erro: Limite de cota atingido. Por favor, aguarde alguns segundos antes de enviar outra imagem."
                if "503" in str(vision_err):
                    return "❌ Erro: Servidor sobrecarregado (503). Os servidores da Google estão com alta demanda temporária. Aguarde uns segundos e tente analisar novamente."
                return "❌ Erro: Ocorreu um problema ao processar a imagem com Gemini. Tente novamente."

            # ESTÁGIO 2: INTERPRETAÇÃO DA NUTRIAI
            logger.info("🧠 Estágio 2: NutriAI interpretando dados...")
            
            prompt_nutri = f"""
            Você é a NutriAI, nutricionista expert. Com base na análise visual que você acabou de realizar:
            
            Fatos identificados: {fatos_visuais}

            Gere um relatório estruturado contendo:
            1. 📋 **Tabela de Macronutrientes**: Inclua estimativas de Calorias, Carboidratos(g), Proteínas(g) e Gorduras(g).
            2. 🍱 **Avaliação da Refeição**: Diga se está equilibrada para um atleta.
            3. 💪 **Dica de Ouro**: O que adicionar ou retirar para melhorar o valor nutricional.

            Use markdown, negrito para valores e emojis. Seja direta e profissional.
            """

            # Chamada de texto
            res_text = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt_nutri,
                config=self.config
            )
            resposta_final = res_text.text
            
            return f"""
🍱 **Análise Nutricional NutriNow**
📸 _Arquivo:_ {os.path.basename(image_path)}

{resposta_final}

---
💬 **Nota:** Análise processada pela NutriAI via Google GenAI. Valores são estimativas.
"""

        except Exception as e:
            logger.error(f"❌ Erro na análise de visão: {traceback.format_exc()}")
            if "503" in str(e):
                return "❌ A NutriAI está enfrentando alta demanda nos servidores da inteligência artificial (503). Por favor, aguarde alguns segundos e envie novamente."
            if "429" in str(e):
                 return "❌ Limite de requisições excedido (429). Aguarde um minuto."
            return "❌ A NutriAI não conseguiu analisar esta imagem no momento. Verifique sua conexão e a chave API."

    def analyze_food_image(self, image_path: str) -> str:
        return self._analyze_image(image_path)