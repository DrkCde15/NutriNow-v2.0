import logging
import time
from collections import OrderedDict
from Nutri import NutritionistAgent

logger = logging.getLogger(__name__)

AGENT_CACHE_TTL_SECONDS = 30 * 60
AGENT_CACHE_MAX_TOTAL = 128
AGENT_CACHE_MAX_PER_USER = 8

agent_cache = OrderedDict()


def _purge_expired_agents():
    now = time.monotonic()
    expired_keys = [
        key for key, entry in agent_cache.items()
        if now - entry["last_seen"] > AGENT_CACHE_TTL_SECONDS
    ]
    for key in expired_keys:
        agent_cache.pop(key, None)


def _enforce_cache_limits(user_id):
    prefix = f"{user_id}_"
    user_keys = [key for key in agent_cache if key.startswith(prefix)]
    while len(user_keys) > AGENT_CACHE_MAX_PER_USER:
        oldest_key = user_keys.pop(0)
        agent_cache.pop(oldest_key, None)

    while len(agent_cache) > AGENT_CACHE_MAX_TOTAL:
        agent_cache.popitem(last=False)


def get_agent(session_id: str, user_id: int = None, email: str = None):
    global agent_cache
    if not session_id:
        session_id = 'anon'
    key = f"{user_id}_{session_id}"
    _purge_expired_agents()

    if key in agent_cache:
        entry = agent_cache.pop(key)
        entry["last_seen"] = time.monotonic()
        agent_cache[key] = entry
        return entry["agent"]
    
    logger.info(f"Criando novo NutritionistAgent para user_id={user_id}, session_id={session_id}")
    mysql_config = None
    agent = NutritionistAgent(session_id=session_id, mysql_config=mysql_config, user_id=user_id, email=email)
    agent_cache[key] = {"agent": agent, "last_seen": time.monotonic()}
    _enforce_cache_limits(user_id)
    return agent

def clear_user_agents(user_id):
    if user_id:
        keys_to_del = [k for k in agent_cache if k.startswith(f"{user_id}_")]
        for k in keys_to_del:
            agent_cache.pop(k, None)

def clear_session_agent(user_id, session_id):
    if user_id and session_id:
        agent_cache.pop(f"{user_id}_{session_id}", None)
