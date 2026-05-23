from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.dependencies import require_supplier
from db.session import get_db
from models.chat import ChatSession
from models.user import User
from services.ai_service import (
    chat_with_ai,
    create_session,
    get_session_messages,
    get_sessions,
)

router = APIRouter(prefix="/ai", tags=["AI"])


class NewSessionRequest(BaseModel):
    first_message: str


class ChatRequest(BaseModel):
    message: str


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
def create_chat_session(
    body: NewSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supplier),
):
    session = create_session(db, current_user.id, body.first_message)
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at,
        "updated_at": session.updated_at,
    }


@router.get("/sessions")
def list_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supplier),
):
    sessions = get_sessions(db, current_user.id)
    return [
        {
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at,
            "updated_at": s.updated_at,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
def get_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supplier),
):
    messages = get_session_messages(db, session_id, current_user.id)
    return [
        {
            "id": m.id,
            "role": m.role.value,
            "content": m.content,
            "sql_query": m.sql_query,
            "created_at": m.created_at,
        }
        for m in messages
    ]


@router.post("/sessions/{session_id}/chat")
def send_message(
    session_id: int,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supplier),
):
    session = db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return chat_with_ai(db, session_id, body.message, current_user.id)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supplier),
):
    session = db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    db.delete(session)
    db.commit()
