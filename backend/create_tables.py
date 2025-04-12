import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_tables():
    # Database connection parameters
    dbname = "postgres"
    user = "temporal"
    password = "temporal"
    host = "localhost"
    port = "5432"

    # Connect to PostgreSQL
    conn = psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()

    try:
        # Create tables
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                hashed_password VARCHAR(255) NOT NULL
            )
        """)
        print("Created users table")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS blog_posts (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                body TEXT NOT NULL,
                category VARCHAR(100),
                creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Created blog_posts table")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS post_comments (
                id SERIAL PRIMARY KEY,
                text TEXT NOT NULL,
                blog_id INTEGER NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("Created post_comments table")

        # Create a view that includes the username
        cursor.execute("""
            CREATE OR REPLACE VIEW post_comments_with_users AS
            SELECT 
                pc.*,
                u.username
            FROM post_comments pc
            JOIN users u ON pc.user_id = u.id
        """)
        print("Created post_comments_with_users view")

        print("All tables created successfully!")

    except Exception as e:
        print(f"Error creating tables: {str(e)}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    create_tables() 