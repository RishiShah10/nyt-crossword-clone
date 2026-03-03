from slowapi import Limiter
from slowapi.util import get_remote_address

# Centralized rate limiter to avoid circular imports and duplicate instances
limiter = Limiter(key_func=get_remote_address)
