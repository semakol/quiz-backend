from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from app.core.security import verify_token
from app.services import crud
from app.db.session import SessionLocal
from app.models import models
from app.core.config import settings

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.connection_users: Dict[WebSocket, models.User] = {}

    async def connect(self, session_url: str, websocket: WebSocket, user: models.User):
        await websocket.accept()
        self.active_connections.setdefault(session_url, []).append(websocket)
        self.connection_users[websocket] = user

    def disconnect(self, session_url: str, websocket: WebSocket):
        conns = self.active_connections.get(session_url, [])
        if websocket in conns:
            conns.remove(websocket)
        if websocket in self.connection_users:
            del self.connection_users[websocket]

    async def broadcast(self, session_url: str, message: dict):
        conns = list(self.active_connections.get(session_url, []))
        for conn in conns:
            try:
                await conn.send_json(message)
            except Exception:
                self.disconnect(session_url, conn)

manager = ConnectionManager()

async def get_user_from_token(token: Optional[str], db: Session) -> Optional[models.User]:
    if not token:
        return None
    
    try:
        payload = verify_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        user = crud.get_user(db, user_id=int(user_id))
        return user
    except Exception:
        return None

@router.websocket('/ws/{session_url}')
async def websocket_endpoint(
    websocket: WebSocket, 
    session_url: str,
    token: Optional[str] = Query(None)
):
    await websocket.accept()
    
    db = SessionLocal()
    try:
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=1008, reason="Authentication required")
            return
        
        session = db.query(models.SessionGame).filter(
            models.SessionGame.url == session_url
        ).first()
        
        if not session:
            await websocket.close(code=1008, reason="Session not found")
            return
        
        is_host = session.host_id == user.id
        
        session_player = None
        if not is_host:
            session_player = db.query(models.SessionPlayer).filter(
            models.SessionPlayer.session_id == session.id,
            models.SessionPlayer.user_id == user.id
            ).first()
            
            if not session_player:
                session_player = models.SessionPlayer(
                session_id=session.id,
                user_id=user.id,
                nickname=user.username,
                score=0
            )
            db.add(session_player)
            db.commit()
            db.refresh(session_player)
        
        manager.active_connections.setdefault(session_url, []).append(websocket)
        manager.connection_users[websocket] = user
        
        await websocket.send_json({
            "type": "session_joined",
            "session_id": session.id,
            "user_id": user.id,
            "is_host": is_host,
            "session_status": session.status,
            "current_question_id": session.current_question_id,
            "player_score": session_player.score if session_player else 0
        })
        
        if not is_host and session.status == "active" and session.current_question_id:
            await websocket.send_json({
                "type": "question_available",
                "question_id": session.current_question_id,
                "session_id": session.id
            })
        
        if is_host:
            await websocket.send_json({
                "type": "session_info",
                "session": {
                    "id": session.id,
                    "quiz_id": session.quiz_id,
                    "url": session.url,
                    "status": session.status,
                    "started_at": session.started_at.isoformat() if session.started_at else None,
                    "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                    "current_question_id": session.current_question_id
                }
            })
        
        # Отправляем список игроков всем участникам (и хосту, и игрокам)
        players = db.query(models.SessionPlayer).filter(
            models.SessionPlayer.session_id == session.id
        ).all()
        players_data = []
        for player in players:
            player_user = db.query(models.User).filter(models.User.id == player.user_id).first()
            players_data.append({
                "id": player.id,
                "user_id": player.user_id,
                "nickname": player.nickname or (player_user.username if player_user else None),
                "username": player_user.username if player_user else None,
                "score": player.score or 0
            })
        await websocket.send_json({
            "type": "players_list",
            "players": players_data
        })
        
        await manager.broadcast(session_url, {
            "type": "players_updated",
            "message": f"Player {user.username} joined"
        })
        
        try:
            while True:
                try:
                    data = await websocket.receive_json()
                except WebSocketDisconnect:
                    # Нормальное отключение - выходим из цикла
                    break
                except Exception as e:
                    # Если ошибка при получении сообщения (например, некорректный JSON)
                    # и это не разрыв соединения, пропускаем итерацию
                    error_msg = str(e)
                    if "disconnect" in error_msg.lower() or "Cannot call" in error_msg:
                        # Соединение разорвано - выходим из цикла
                        break
                    print(f"Ошибка при получении сообщения: {e}")
                    continue
                
                message_type = data.get("type")
                
                if message_type == "ping":
                    await websocket.send_json({"type": "pong"})
                elif message_type == "get_session_info" and is_host:
                    await websocket.send_json({
                        "type": "session_info",
                        "session": {
                            "id": session.id,
                            "quiz_id": session.quiz_id,
                            "url": session.url,
                            "status": session.status,
                            "started_at": session.started_at.isoformat() if session.started_at else None,
                            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
                            "current_question_id": session.current_question_id
                        }
                    })
                elif message_type == "get_players_list":
                    try:
                        # Разрешаем получение списка игроков всем участникам сессии
                        players = db.query(models.SessionPlayer).filter(
                            models.SessionPlayer.session_id == session.id
                        ).all()
                        players_data = []
                        for player in players:
                            player_user = db.query(models.User).filter(models.User.id == player.user_id).first()
                            players_data.append({
                                "id": player.id,
                                "user_id": player.user_id,
                                "nickname": player.nickname or (player_user.username if player_user else None),
                                "username": player_user.username if player_user else None,
                                "score": player.score or 0
                            })
                        await websocket.send_json({
                            "type": "players_list",
                            "players": players_data
                        })
                    except Exception as e:
                        db.rollback()
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Ошибка при получении списка игроков: {str(e)}"
                        })
                elif message_type == "chat_message":
                    # Обработка сообщения чата - транслируем всем участникам сессии
                    text = data.get("text", "").strip()
                    if text and len(text) <= 500:
                        # Транслируем сообщение всем участникам сессии
                        await manager.broadcast(session_url, {
                            "type": "chat_message",
                            "username": user.username,
                            "text": text
                        })
                    elif len(text) > 500:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Сообщение слишком длинное (максимум 500 символов)"
                        })
                elif message_type == "submit_answer":
                    try:
                        if is_host:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Хост не может отправлять ответы"
                            })
                            continue
                        
                        session_player = db.query(models.SessionPlayer).filter(
                            models.SessionPlayer.session_id == session.id,
                            models.SessionPlayer.user_id == user.id
                        ).first()
                        
                        if not session_player:
                            session_player = models.SessionPlayer(
                                session_id=session.id,
                                user_id=user.id,
                                nickname=user.username,
                                score=0
                            )
                            db.add(session_player)
                            db.commit()
                            db.refresh(session_player)
                            
                            await manager.broadcast(session_url, {
                                "type": "players_updated",
                                "message": f"Player {user.username} joined"
                            })
                        
                        question_id = data.get("question_id")
                        answer_id = data.get("answer_id")
                        text_answer = data.get("text_answer")
                        
                        if not question_id:
                            await websocket.send_json({
                                "type": "error",
                                "message": "ID вопроса не указан"
                            })
                            continue
                        
                        question = db.query(models.Question).filter(
                            models.Question.id == question_id,
                            models.Question.quiz_id == session.quiz_id
                        ).first()
                        
                        if not question:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Вопрос не найден"
                            })
                            continue
                        
                        is_correct = None
                        if answer_id:
                            # Для тестовых вопросов проверяем правильность выбранного ответа
                            answer = db.query(models.Answer).filter(
                                models.Answer.id == answer_id,
                                models.Answer.question_id == question_id
                            ).first()
                            if answer:
                                is_correct = answer.is_correct
                        elif text_answer:
                            # Для открытых вопросов проверяем, есть ли правильный ответ в базе
                            # Если есть правильные ответы, сравниваем с ними (регистронезависимо)
                            correct_answers = db.query(models.Answer).filter(
                                models.Answer.question_id == question_id,
                                models.Answer.is_correct == True
                            ).all()
                            if correct_answers:
                                # Сравниваем текст ответа с правильными ответами
                                text_answer_normalized = text_answer.strip().lower()
                                is_correct = any(
                                    ans.text.strip().lower() == text_answer_normalized 
                                    for ans in correct_answers
                                )
                            else:
                                # Если нет правильных ответов в базе, считаем ответ неправильным
                                is_correct = False
                        
                        existing_answer = db.query(models.PlayerAnswer).filter(
                            models.PlayerAnswer.session_player_id == session_player.id,
                            models.PlayerAnswer.question_id == question_id
                        ).first()
                        
                        if existing_answer:
                            await websocket.send_json({
                                "type": "error",
                                "message": "Вы уже отправили ответ на этот вопрос"
                            })
                            continue
                        
                        player_answer = models.PlayerAnswer(
                            session_player_id=session_player.id,
                            question_id=question_id,
                            answer_id=answer_id,
                            text_answer=text_answer,
                            is_correct=is_correct
                        )
                        db.add(player_answer)
                        
                        question_score = None
                        # Начисляем баллы только если ответ правильный (is_correct == True)
                        if is_correct is True:
                            # Используем score вопроса, если он задан, иначе 1 по умолчанию
                            question_score = question.score if question.score is not None else 1
                            old_score = session_player.score or 0
                            session_player.score = old_score + question_score
                            db.add(session_player)
                            print(f"Начислено {question_score} баллов игроку {session_player.id}. Старый счет: {old_score}, новый счет: {session_player.score}")
                        elif is_correct is None:
                            print(f"Предупреждение: is_correct = None для вопроса {question_id}, ответа {answer_id}, текста '{text_answer}'")
                        
                        db.commit()
                        db.refresh(session_player)
                        
                        await websocket.send_json({
                            "type": "answer_submitted",
                            "question_id": question_id,
                            "is_correct": is_correct,
                            "score": question_score if is_correct else None,
                            "total_score": session_player.score or 0
                        })
                        
                        await manager.broadcast(session_url, {
                            "type": "answer_received",
                            "user_id": user.id,
                                "username": user.username,
                                "question_id": question_id
                            })
                        
                    except Exception as e:
                        db.rollback()
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Ошибка при сохранении ответа: {str(e)}"
                    })
                elif message_type == "start_game" and is_host:
                    try:
                        session.status = "active"
                        db.add(session)
                        db.commit()
                        db.refresh(session)
                        await manager.broadcast(session_url, {
                            "type": "game_started",
                            "session_id": session.id
                        })
                        await websocket.send_json({
                            "type": "status_updated",
                            "status": session.status
                        })
                        players = db.query(models.SessionPlayer).filter(
                            models.SessionPlayer.session_id == session.id
                        ).all()
                        players_data = []
                        for player in players:
                            player_user = db.query(models.User).filter(models.User.id == player.user_id).first()
                            players_data.append({
                                "id": player.id,
                                "user_id": player.user_id,
                                "nickname": player.nickname or (player_user.username if player_user else None),
                                "username": player_user.username if player_user else None,
                                "score": player.score or 0
                            })
                        await websocket.send_json({
                            "type": "players_list",
                            "players": players_data
                        })
                    except Exception as e:
                        db.rollback()
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Ошибка при запуске игры: {str(e)}"
                        })
                elif message_type == "pause_game" and is_host:
                    try:
                        session.status = "paused"
                        db.add(session)
                        db.commit()
                        db.refresh(session)
                        await manager.broadcast(session_url, {
                            "type": "game_paused",
                            "session_id": session.id
                        })
                        await websocket.send_json({
                            "type": "status_updated",
                            "status": session.status
                        })
                    except Exception as e:
                        db.rollback()
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Ошибка при паузе игры: {str(e)}"
                        })
                elif message_type == "next_question" and is_host:
                    try:
                        question = crud.set_next_question(db, session.id, user)
                        db.refresh(session)
                        await manager.broadcast(session_url, {
                            "type": "question_available",
                            "question_id": question.id,
                            "session_id": session.id
                        })
                        await websocket.send_json({
                            "type": "question_sent",
                            "question_id": question.id
                        })
                    except Exception as e:
                        db.rollback()
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Ошибка при переходе к следующему вопросу: {str(e)}"
                        })
                elif message_type == "end_game" and is_host:
                    try:
                        session.status = "ended"
                        db.add(session)
                        db.commit()
                        db.refresh(session)
                        await manager.broadcast(session_url, {
                            "type": "game_ended",
                            "session_id": session.id
                        })
                        await websocket.send_json({
                            "type": "status_updated",
                            "status": session.status
                        })
                    except Exception as e:
                        db.rollback()
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Ошибка при завершении игры: {str(e)}"
                        })
                else:
                    await manager.broadcast(session_url, data)
                    
        except WebSocketDisconnect:
            pass  # Нормальное отключение
        except Exception as e:
            # Обработка любых других ошибок
            print(f"Необработанная ошибка в WebSocket: {e}")
            try:
                db.rollback()
            except Exception:
                pass
            try:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Произошла ошибка: {str(e)}"
                })
            except Exception:
                pass  # Если WebSocket уже закрыт, игнорируем
            manager.disconnect(session_url, websocket)
            await manager.broadcast(session_url, {
                "type": "players_updated",
                "message": f"Player {user.username} left"
            })
    finally:
        db.close()
