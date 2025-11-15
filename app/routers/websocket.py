from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, session_url: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(session_url, []).append(websocket)

    def disconnect(self, session_url: str, websocket: WebSocket):
        conns = self.active_connections.get(session_url, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, session_url: str, message: dict):
        conns = list(self.active_connections.get(session_url, []))
        for conn in conns:
            await conn.send_json(message)

manager = ConnectionManager()

@router.websocket('/ws/{session_url}')
async def websocket_endpoint(websocket: WebSocket, session_url: str):
    await manager.connect(session_url, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(session_url, data)
    except WebSocketDisconnect:
        manager.disconnect(session_url, websocket)
