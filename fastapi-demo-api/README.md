# FastAPI Demo API

This project is a demonstration of a FastAPI application that includes user authentication, item management, and error handling. 

## Project Structure

```
fastapi-demo-api
├── app
│   ├── main.py
│   ├── api
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── items.py
│   │   └── errors.py
│   ├── core
│   │   ├── __init__.py
│   │   └── config.py
│   ├── models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── item.py
│   ├── schemas
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── item.py
│   └── services
│       ├── __init__.py
│       ├── auth_service.py
│       └── item_service.py
├── requirements.txt
└── README.md
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd fastapi-demo-api
   ```

2. **Create a virtual environment:**
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install the required dependencies:**
   ```
   pip install -r requirements.txt
   ```

4. **Run the application:**
   ```
   uvicorn app.main:app --reload
   ```

## Usage

- **Authentication:**
  - Register a new user: `POST /auth/register`
  - Login: `POST /auth/login`
  - Refresh token: `POST /auth/refresh`
  - Reset password: `POST /auth/reset-password`

- **Item Management:**
  - Create an item: `POST /items/`
  - Get all items: `GET /items/`
  - Update an item: `PUT /items/{item_id}`
  - Delete an item: `DELETE /items/{item_id}`

## Error Handling

The API provides consistent error responses for validation errors and other issues. Check the `errors.py` file for more details on error handling.

## License

This project is licensed under the MIT License.