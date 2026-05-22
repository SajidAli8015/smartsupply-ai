from sqlalchemy.orm import declarative_base

# Shared declarative base — all ORM models inherit from this.
# Import this (not db.session) wherever you need Base or Base.metadata.
Base = declarative_base()
