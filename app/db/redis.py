import redis
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

redis_client: Optional[redis.Redis] = None

def get_redis() -> Optional[redis.Redis]:
    global redis_client
    if redis_client is None:
        try:
            if settings.USE_INMEMORY_REDIS:
                try:
                    import fakeredis
                    redis_client = fakeredis.FakeStrictRedis(decode_responses=True)
                    logger.info("Using in-memory Redis (fakeredis)")
                except ImportError:
                    logger.error("fakeredis is not installed. Install it with: pip install fakeredis")
                    raise ImportError("fakeredis is required for in-memory Redis mode")
            else:
                redis_client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
            redis_client.ping()
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning(f"Redis connection failed: {e}. Rate limiting and caching will be disabled.")
            redis_client = None
        except ImportError as e:
            logger.error(f"Failed to initialize Redis: {e}")
            redis_client = None
    return redis_client

def check_rate_limit(key: str, limit: int, window: int) -> tuple[bool, int]:
    r = get_redis()
    if r is None:
        return True, limit
    
    try:
        current = r.get(key)
        
        if current is None:
            r.setex(key, window, 1)
            return True, limit - 1
        
        current_count = int(current)
        if current_count >= limit:
            return False, 0
        
        r.incr(key)
        remaining = limit - current_count - 1
        return True, remaining
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(f"Redis error during rate limit check: {e}")
        return True, limit

def cache_user_check(email: str, exists: bool, ttl: int = 300) -> None:
    r = get_redis()
    if r is None:
        return
    
    try:
        key = f"user_exists:{email}"
        r.setex(key, ttl, "1" if exists else "0")
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(f"Redis error during cache write: {e}")

def get_cached_user_check(email: str) -> Optional[bool]:
    r = get_redis()
    if r is None:
        return None
    
    try:
        key = f"user_exists:{email}"
        result = r.get(key)
        if result is None:
            return None
        return result == "1"
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(f"Redis error during cache read: {e}")
        return None

def cache_token(user_id: str, token: str, ttl: int) -> None:
    r = get_redis()
    if r is None:
        return
    
    try:
        key = f"user_token:{user_id}"
        r.setex(key, ttl, token)
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(f"Redis error during token cache: {e}")

def get_cached_token(user_id: str) -> Optional[str]:
    r = get_redis()
    if r is None:
        return None
    
    try:
        key = f"user_token:{user_id}"
        return r.get(key)
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(f"Redis error during token read: {e}")
        return None

def invalidate_token(user_id: str) -> None:
    r = get_redis()
    if r is None:
        return
    
    try:
        key = f"user_token:{user_id}"
        r.delete(key)
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning(f"Redis error during token invalidation: {e}")

