# Blogrr - Modern Blogging Platform

A full-stack blogging platform built with FastAPI backend and Html css and JavaScript frontend. Features a modern UI, real-time interactions, and secure authentication.

## Project Overview

Blogrr is a complete blogging solution that allows users to create, manage, and interact with blog posts. The platform features a responsive design, smooth animations, and a robust backend API.

## Tech Stack

### Backend
- FastAPI (Python web framework)
- PostgreSQL (Database)
- SQLAlchemy (ORM)
- JWT Authentication
- Pydantic (Data validation)
- Bcrypt (Password hashing)

### Frontend
- JavaScript
- HTML5
- CSS3 with modern features
- Font Awesome icons
- Responsive design

## Features

- **User Authentication**
  - Secure signup/login
  - JWT token-based authentication
  - Password hashing
  - Session management

- **Blog Management**
  - Create, read, update, delete blogs
  - Rich text content
  - Category organization
  - Author controls

- **Comments System**
  - Real-time commenting
  - Nested comment views
  - Author attribution

- **Interactive UI**
  - Dynamic content loading
  - Smooth transitions
  - Responsive layouts
  - Modal views
  - Filter and sort options

## Getting Started

### Prerequisites
- Python 3.8+
- PostgreSQL
- Modern web browser
- Node.js (optional, for development)

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd blogrr/backend
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure database**
   ```python
   # Update database.py with your PostgreSQL credentials
   SQLALCHEMY_DATABASE_URL = "postgresql://username:password@localhost:5432/dbname"
   ```

5. **Create database tables**
   ```bash
   python create_tables.py
   ```

6. **Run the server**
   ```bash
   uvicorn app.main:app --reload
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd ../frontend
   ```

2. **Configure API endpoint**
   ```javascript
   // Update API_BASE_URL in app.js
   const API_BASE_URL = 'http://localhost:8000';
   ```

3. **Serve the frontend**
   - Using VS Code: Install Live Server extension and right-click on index.html
   - Or simply open index.html in your browser

## API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Project Structure

```
blogrr/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── endpoints/
│   │   ├── db/
│   │   │   └── models/
│   │   ├── schemas/
│   │   └── services/
│   ├── requirements.txt
│   └── create_tables.py
│
└── frontend/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── README.md
```

## Database Schema

```sql
users
- id (PK)
- username
- email
- hashed_password

blog_posts
- id (PK)
- title
- body
- category
- creator_id (FK)
- created_at

post_comments
- id (PK)
- text
- blog_id (FK)
- user_id (FK)
- created_at
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- CORS protection
- SQL injection prevention
- XSS protection

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- FastAPI documentation and community
- SQLAlchemy documentation
- Font Awesome for icons
- Modern CSS features

## note: 
create_tables and reset_db files are used to manually recreate and reset database {tables}
