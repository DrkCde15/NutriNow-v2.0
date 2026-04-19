import logging
import uuid
from Nutri import NutritionistAgent

logger = logging.getLogger(__name__)

# Cache de agentes
agent_cache = {}

def get_agent(session_id: str, user_id: int = None, email: str = None):
    global agent_cache
    if not session_id:
        session_id = 'anon'
    key = f"{user_id}_{session_id}"
    if key in agent_cache:
        return agent_cache[key]
    
    logger.info(f"Criando novo NutritionistAgent para user_id={user_id}, session_id={session_id}")
    mysql_config = None
    agent = NutritionistAgent(session_id=session_id, mysql_config=mysql_config, user_id=user_id, email=email)
    agent_cache[key] = agent
    return agent

def clear_user_agents(user_id):
    if user_id:
        keys_to_del = [k for k in agent_cache if k.startswith(f"{user_id}_")]
        for k in keys_to_del:
            agent_cache.pop(k, None)
