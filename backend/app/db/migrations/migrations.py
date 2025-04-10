from alembic import op # type: ignore
import sqlalchemy as sa
from app.db.database import engine, Base

def run_migrations():
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine, checkfirst=True)

if __name__ == "__main__":
    run_migrations() 