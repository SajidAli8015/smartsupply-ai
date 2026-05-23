"""
AI service — Google Gemini with Text-to-SQL for business intelligence.

Flow for each chat turn:
  1. Load last 10 messages as conversation history.
  2. Send user question to Gemini (with history + system prompt).
  3. Parse <sql>...</sql> from the response.
  4. If SQL found: execute it safely, send results back to Gemini for the
     final business-language answer.
  5. Persist user message and assistant response to the database.
"""

import json
import re
from datetime import datetime, timezone
from typing import Any, Optional

import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from models.chat import ChatMessage, ChatRole, ChatSession

_MODEL_NAME = "gemini-2.5-flash"

# ---------------------------------------------------------------------------
# Schema description fed to the LLM
# ---------------------------------------------------------------------------

_DB_SCHEMA = """
Tables:
- products: id, name, type (shirt | jeans), base_price, cost_price, is_active
- skus: id, product_id (FK→products), color, size, sku_code, sale_price, cost_price
- inventory: id, sku_id (FK→skus), quantity_on_hand, quantity_reserved,
             low_stock_threshold, warehouse_location
  available stock = quantity_on_hand - quantity_reserved
- orders: id, buyer_id (FK→users), status (pending | confirmed | packed |
          shipped | delivered | cancelled | returned), total_amount, created_at
- order_items: id, order_id (FK→orders), sku_id (FK→skus), quantity, unit_price
- purchase_orders: id, factory_id (FK→factories), status (draft | sent |
                   confirmed | in_production | shipped | received | cancelled),
                   expected_delivery_date, created_at
- po_line_items: id, po_id (FK→purchase_orders), sku_id (FK→skus),
                 quantity_ordered, quantity_received, unit_cost
- factories: id, name, contact_person, lead_time_days, is_active
- shipments: id, order_id (FK→orders), tracking_number, carrier,
             shipped_at, delivered_at
- users: id, email, full_name, role (supplier | staff | buyer)
"""

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

def _system_prompt() -> str:
    return f"""You are an AI business intelligence assistant for SmartSupply AI, \
a supply chain management platform for an apparel business in Pakistan.

You have access to the business database and can answer questions about:
- Inventory levels and stock management
- Sales performance and revenue analytics
- Purchase orders and factory management
- Order fulfillment and delivery tracking
- Business insights and recommendations

Database schema:
{_DB_SCHEMA}

When answering questions that require data:
1. Generate a PostgreSQL SELECT query to fetch the relevant data.
2. Wrap the SQL in <sql> tags: <sql>SELECT ...</sql>
3. After the SQL results are provided to you, give a clear, business-focused
   answer in plain English.
4. Format monetary values as Pakistani Rupees (PKR) where relevant.
5. Be concise but insightful — act like a business analyst, not a data reader.
6. If a follow-up question refers to previous context, use that context to
   refine your query and answer.

If a question cannot be answered with the available data, say so clearly and
suggest what information would help.
If a question is unrelated to the business, politely redirect to business topics.
Never generate INSERT, UPDATE, DELETE, DROP, or any data-modifying SQL."""


# ---------------------------------------------------------------------------
# Safe SQL execution
# ---------------------------------------------------------------------------

_FORBIDDEN_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER",
    "TRUNCATE", "CREATE", "GRANT", "REVOKE", "EXECUTE",
}


def execute_safe_sql(db: Session, sql_query: str) -> list[dict[str, Any]]:
    """Execute a read-only SQL query and return rows as a list of dicts."""
    cleaned = sql_query.strip().rstrip(";").strip()

    # Block any non-SELECT statement
    first_word = cleaned.split()[0].upper() if cleaned else ""
    if first_word not in ("SELECT", "WITH"):
        raise ValueError(f"Only SELECT/WITH queries are allowed. Got: {first_word!r}")

    # Block forbidden keywords anywhere in the query
    tokens = set(re.findall(r'\b[A-Z]+\b', cleaned.upper()))
    blocked = tokens & _FORBIDDEN_KEYWORDS
    if blocked:
        raise ValueError(f"Query contains forbidden keyword(s): {', '.join(sorted(blocked))}")

    # Enforce a row cap
    if "LIMIT" not in cleaned.upper():
        cleaned = f"{cleaned} LIMIT 100"

    result = db.execute(text(cleaned))
    columns = list(result.keys())
    rows = result.fetchall()
    return [dict(zip(columns, row)) for row in rows]


# ---------------------------------------------------------------------------
# Gemini helpers
# ---------------------------------------------------------------------------

def _configure() -> None:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY is not configured. Set it in your .env file.",
        )
    genai.configure(api_key=settings.GEMINI_API_KEY)


def _parse_sql(text_: str) -> Optional[str]:
    match = re.search(r"<sql>(.*?)</sql>", text_, re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else None


def _to_gemini_history(messages: list[ChatMessage]) -> list[dict]:
    history = []
    for msg in messages:
        role = "user" if msg.role == ChatRole.user else "model"
        history.append({"role": role, "parts": [msg.content]})
    return history


# ---------------------------------------------------------------------------
# Core chat function
# ---------------------------------------------------------------------------

def chat_with_ai(
    db: Session,
    session_id: int,
    user_message: str,
    user_id: int,
) -> dict[str, Any]:
    _configure()

    # Load last 10 messages for conversation memory
    recent = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
        .all()
    )
    recent = list(reversed(recent))

    model = genai.GenerativeModel(
        model_name=_MODEL_NAME,
        system_instruction=_system_prompt(),
    )
    chat = model.start_chat(history=_to_gemini_history(recent))

    # --- Round 1: ask Gemini, potentially get SQL ---
    try:
        r1 = chat.send_message(user_message)
    except google_exceptions.InvalidArgument as exc:
        detail = str(exc)
        if "API key" in detail:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Gemini API key is invalid or expired. Please renew it in your .env file.",
            )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)
    except google_exceptions.ResourceExhausted as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Gemini API quota exceeded. Please wait a moment and try again.",
        )
    except google_exceptions.NotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Gemini model not available: {exc}",
        )
    except google_exceptions.GoogleAPIError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gemini API error: {exc}",
        )

    r1_text = r1.text

    sql_query: Optional[str] = _parse_sql(r1_text)
    sql_results: Optional[list] = None
    final_text = r1_text

    if sql_query:
        try:
            sql_results = execute_safe_sql(db, sql_query)
            # --- Round 2: feed results back, get business answer ---
            results_payload = json.dumps(sql_results, default=str)
            r2 = chat.send_message(
                f"SQL results:\n{results_payload}\n\n"
                "Now provide the final business-focused answer based on these results."
            )
            final_text = r2.text
        except HTTPException:
            raise
        except google_exceptions.ResourceExhausted:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Gemini API quota exceeded. Please wait a moment and try again.",
            )
        except google_exceptions.GoogleAPIError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Gemini API error on second turn: {exc}",
            )
        except Exception as exc:
            # SQL failed — ask model to recover gracefully without re-raising
            try:
                r2 = chat.send_message(
                    f"The SQL query failed with error: {exc}. "
                    "Please answer without the query or suggest a corrected approach."
                )
                final_text = r2.text
            except google_exceptions.GoogleAPIError:
                final_text = "I wasn't able to fetch the data. Please rephrase your question."
            sql_query = None

    # Persist both turns
    db.add(ChatMessage(
        session_id=session_id,
        role=ChatRole.user,
        content=user_message,
    ))
    db.add(ChatMessage(
        session_id=session_id,
        role=ChatRole.assistant,
        content=final_text,
        sql_query=sql_query,
    ))

    session = db.get(ChatSession, session_id)
    if session:
        session.updated_at = datetime.now(timezone.utc)

    db.commit()

    return {
        "response": final_text,
        "sql_query": sql_query,
        "data": sql_results,
        "session_id": session_id,
    }


# ---------------------------------------------------------------------------
# Session management helpers
# ---------------------------------------------------------------------------

def create_session(db: Session, user_id: int, first_message: str) -> ChatSession:
    title = first_message[:50].strip()
    session = ChatSession(user_id=user_id, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_sessions(db: Session, user_id: int) -> list[ChatSession]:
    return (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )


def get_session_messages(
    db: Session, session_id: int, user_id: int
) -> list[ChatMessage]:
    session = db.get(ChatSession, session_id)
    if not session or session.user_id != user_id:
        return []
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
