# food_analyser.py - Módulo de visão nutricional baseado na arquitetura NEURA
import os
import sys
import logging
import traceback
import base64
import ollama
from datetime import datetime
from pydantic import PrivateAttr
from langchain.tools import BaseTool
from dotenv import load_dotenv

load_dotenv()

# Adiciona o caminho do projeto NEURA ao python path
if os.getenv("NEURA_PATH"):
    sys.path.append(os.getenv("NEURA_PATH"))

try:
    from neura_ai.core import Neura
    from neura_ai.config import NeuraConfig
except ImportError:
    print("Aviso: neura_ai não encontrado. Verifique o NEURA_PATH no .env")

logger = logging.getLogger(__name__)

# Prompt especializado para o estágio 1 (Moondream)
VISION_PROMPT = """
Você é um especialista em reconhecimento de alimentos e análise visual nutricional.
Analise a imagem e identifique com precisão:
1. Todos os alimentos presentes no prato/refeição.
2. Estimativa de porções/quantidades (ex: 2 colheres de arroz, 1 bife grande).
3. Ingredientes visíveis (ex: azeite, salada de alface e tomate).
4. Método de preparo provável (ex: grelhado, frito, cozido).
Seja puramente descritivo e técnico sobre o que vê.
"""

class FoodAnalyser(BaseTool):
    name: str = "food_analyser"
    description: str = """Analisa imagens de refeições para extrair dados nutricionais e fornecer feedback especializado."""

    _neura: any = PrivateAttr()

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Configuração do Host Local conforme padrão NOG
        host_ollama = "http://127.0.0.1:11434"
        
        # Inicializa o NEURA CORE para Visão
        self._neura = Neura(
            model="gemma2:2b", 
            vision_model="moondream:latest", 
            system_prompt=VISION_PROMPT,
            host=host_ollama,
            use_memory=False
        )
        
        # AJUSTE DE TIMEOUT EXTREMO: Modelos de visão podem demorar muito no primeiro load.
        # Aumentamos para 600 segundos (10 minutos).
        self._neura.client = ollama.Client(
            host=host_ollama, 
            timeout=600.0 
        )
        logger.info("🚀 FoodAnalyser configurado com timeout estendido de 600s.")

    def _run(self, image_path: str) -> str:
        """Análise síncrona de imagem usando a abordagem de dois estágios"""
        return self._analyze_image(image_path)

    async def _arun(self, image_path: str) -> str:
        """Análise assíncrona de imagem"""
        return self._analyze_image(image_path)

    def _analyze_image(self, image_path: str) -> str:
        try:
            if not os.path.exists(image_path):
                return f"❌ Erro: Arquivo {os.path.basename(image_path)} não encontrado."

            # ESTÁGIO 1: VISÃO BRUTA (Moondream)
            logger.info("👁️ Estágio 1: Extraindo fatos nutricionais da imagem (isso pode levar um minuto)...")
            instrucao_visao = "Identify all food items in this meal and estimate theirs portions."
            
            # Chamada direta ao client para garantir que o timeout seja aplicado
            try:
                with open(image_path, 'rb') as f:
                    img_data = f.read()
                
                res_vision = self._neura.client.generate(
                    model="moondream:latest",
                    prompt=instrucao_visao,
                    images=[img_data]
                )
                fatos_visuais = res_vision['response']
            except Exception as vision_err:
                logger.error(f"Erro no estágio de visão: {vision_err}")
                return "❌ Erro: O servidor de IA local demorou muito para processar a imagem. Tente novamente."

            # ESTÁGIO 2: INTERPRETAÇÃO DA NUTRIAI (Gemma)
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
            res_text = self._neura.client.generate(
                model="gemma2:2b",
                prompt=prompt_nutri,
                system=VISION_PROMPT # Usa o prompt do sistema para manter a persona
            )
            resposta_final = res_text['response']
            
            return f"""
🍱 **Análise Nutricional NutriNow**
📸 _Arquivo:_ {os.path.basename(image_path)}

{resposta_final}

---
💬 **Nota:** Análise processada localmente pela NutriAI. Valores são estimativas.
"""

        except Exception as e:
            logger.error(f"❌ Erro na análise de visão: {traceback.format_exc()}")
            return "❌ A NutriAI não conseguiu analisar esta imagem no momento. Verifique se o servidor Ollama está ativo."

    def analyze_food_image(self, image_path: str) -> str:
        return self._analyze_image(image_path)