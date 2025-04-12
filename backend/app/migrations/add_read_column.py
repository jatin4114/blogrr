import os
import sys
from sqlalchemy import create_engine, MetaData, Table, Column, Boolean, text

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.db.database import SQLALCHEMY_DATABASE_URL

def add_read_column():
    """
    Add a 'read' column to the chat_messages table if it doesn't exist
    """
    print("Connecting to database...")
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    # Reflect the existing tables
    metadata = MetaData()
    metadata.reflect(bind=engine)
    
    if 'chat_messages' in metadata.tables:
        chat_messages = metadata.tables['chat_messages']
        
        # Check if read column already exists
        if 'read' not in chat_messages.c:
            print("Adding 'read' column to chat_messages table...")
            
            # Create an ALTER TABLE statement using SQLAlchemy's text() function
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE chat_messages ADD COLUMN read BOOLEAN DEFAULT FALSE"))
            
            print("Column 'read' added successfully!")
        else:
            print("Column 'read' already exists in chat_messages table.")
    else:
        print("Table 'chat_messages' not found in database.")

if __name__ == "__main__":
    try:
        add_read_column()
    except Exception as e:
        print(f"Error adding read column: {e}")
        sys.exit(1)
    sys.exit(0)
