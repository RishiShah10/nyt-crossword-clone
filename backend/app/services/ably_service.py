from ably import AblyRest
from ..config import settings


class AblyService:
    """Wrapper around Ably REST API for serverless token generation."""

    def __init__(self):
        if not settings.ABLY_API_KEY:
            self._client = None
        else:
            self._client = AblyRest(settings.ABLY_API_KEY)

    async def create_token_request(self, client_id: str, channel: str) -> dict:
        """Generate an Ably token request scoped to a specific channel.

        Args:
            client_id: User ID to bind the token to
            channel: Channel name (e.g., "room:ABC123")

        Returns:
            Token request dict that the client uses to authenticate
        """
        if not self._client:
            raise RuntimeError("Ably not configured — set ABLY_API_KEY")

        capability = {channel: ["publish", "subscribe", "presence"]}
        token_request = await self._client.auth.create_token_request({
            "client_id": client_id,
            "capability": capability,
            "ttl": 3600 * 1000,  # 1 hour in ms
        })
        return token_request.to_dict()


ably_service = AblyService()
