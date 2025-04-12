from fastapi import WebSocket
from typing import Dict, Union

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[Union[str, int], WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: Union[str, int]):
        await websocket.accept()
        self.active_connections[str(user_id)] = websocket
        print(f"User {user_id} connected. Active connections: {list(self.active_connections.keys())}")

    def disconnect(self, user_id: Union[str, int]):
        user_id_str = str(user_id)
        if user_id_str in self.active_connections:
            del self.active_connections[user_id_str]
            print(f"User {user_id} disconnected. Remaining connections: {list(self.active_connections.keys())}")

    async def send_message(self, user_id: Union[str, int], message: dict):
        """Send a message to a specific user."""
        user_id_str = str(user_id)
        if user_id_str in self.active_connections:
            await self.active_connections[user_id_str].send_json(message)
            return True
        return False

    def is_connected(self, user_id: Union[str, int]) -> bool:
        """Check if a user is connected."""
        return str(user_id) in self.active_connections

manager = ConnectionManager()
