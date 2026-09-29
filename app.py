from flask import (
    Flask, request, jsonify, session,
    send_from_directory, send_file,
    render_template                  # <--- ADD THIS
)
import os
import sqlite3
import uuid
from functools import wraps
from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

# --------------------------------------------------
# APP CONFIGURATION
# --------------------------------------------------

app = Flask(__name__)

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "change-this-secret-key-in-production"
)

app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB max request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "cloud_storage.db")
STORAGE_DIR = os.path.join(BASE_DIR, "storage")

MAX_STORAGE = 100 * 1024 * 1024  # 100 MB per user

os.makedirs(STORAGE_DIR, exist_ok=True)


# --------------------------------------------------
# DATABASE
# --------------------------------------------------

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db


def init_database():
    db = get_db()

    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            original_name TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER NOT NULL,
            uploaded_at TEXT NOT NULL,
            FOREIGN KEY(user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
        )
    """)

    db.commit()
    db.close()


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):

        if "user_id" not in session:
            return jsonify({
                "success": False,
                "message": "Please login first."
            }), 401

        return function(*args, **kwargs)

    return wrapper


def get_current_user():
    if "user_id" not in session:
        return None

    db = get_db()

    user = db.execute(
        "SELECT id, username, email FROM users WHERE id = ?",
        (session["user_id"],)
    ).fetchone()

    db.close()

    return user


def get_storage_used(user_id):
    db = get_db()

    result = db.execute("""
        SELECT COALESCE(SUM(file_size), 0) AS total
        FROM files
        WHERE user_id = ?
    """, (user_id,)).fetchone()

    db.close()

    return result["total"]


def format_size(size):

    if size < 1024:
        return f"{size} B"

    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"

    if size < 1024 * 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} MB"

    return f"{size / (1024 * 1024 * 1024):.1f} GB"


# --------------------------------------------------
# MAIN PAGE
# --------------------------------------------------

@app.route('/')
def home():
    return render_template('index.html')


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/api/signup")
def signup():

    data = request.get_json()

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if len(username) < 3:
        return jsonify({
            "success": False,
            "message": "Username must contain at least 3 characters."
        }), 400

    if "@" not in email:
        return jsonify({
            "success": False,
            "message": "Please enter a valid email."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters."
        }), 400

    db = get_db()

    existing = db.execute("""
        SELECT id
        FROM users
        WHERE username = ? OR email = ?
    """, (username, email)).fetchone()

    if existing:
        db.close()

        return jsonify({
            "success": False,
            "message": "Username or email already exists."
        }), 409

    password_hash = generate_password_hash(password)

    cursor = db.execute("""
        INSERT INTO users
        (username, email, password, created_at)
        VALUES (?, ?, ?, ?)
    """, (
        username,
        email,
        password_hash,
        datetime.now(timezone.utc).isoformat()
    ))

    db.commit()

    user_id = cursor.lastrowid

    db.close()

    # Create personal storage directory
    user_folder = os.path.join(
        STORAGE_DIR,
        str(user_id)
    )

    os.makedirs(user_folder, exist_ok=True)

    session.clear()
    session["user_id"] = user_id

    return jsonify({
        "success": True,
        "message": "Account created successfully."
    })


@app.post("/api/login")
def login():

    data = request.get_json()

    identifier = data.get("identifier", "").strip()
    password = data.get("password", "")

    db = get_db()

    user = db.execute("""
        SELECT *
        FROM users
        WHERE username = ? OR email = ?
    """, (
        identifier,
        identifier.lower()
    )).fetchone()

    db.close()

    if not user:
        return jsonify({
            "success": False,
            "message": "Invalid username/email or password."
        }), 401

    if not check_password_hash(
        user["password"],
        password
    ):
        return jsonify({
            "success": False,
            "message": "Invalid username/email or password."
        }), 401

    session.clear()
    session["user_id"] = user["id"]

    return jsonify({
        "success": True,
        "message": "Login successful."
    })


@app.post("/api/logout")
def logout():

    session.clear()

    return jsonify({
        "success": True
    })


@app.get("/api/me")
def me():

    user = get_current_user()

    if not user:
        return jsonify({
            "logged_in": False
        })

    return jsonify({
        "logged_in": True,
        "username": user["username"],
        "email": user["email"]
    })


# --------------------------------------------------
# FILE LIST
# --------------------------------------------------

@app.get("/api/files")
@login_required
def list_files():

    user_id = session["user_id"]

    db = get_db()

    files = db.execute("""
        SELECT *
        FROM files
        WHERE user_id = ?
        ORDER BY uploaded_at DESC
    """, (user_id,)).fetchall()

    db.close()

    result = []

    for file in files:

        result.append({
            "id": file["id"],
            "name": file["original_name"],
            "type": file["file_type"] or "Unknown",
            "size": file["file_size"],
            "size_text": format_size(file["file_size"]),
            "uploaded_at": file["uploaded_at"]
        })

    used = get_storage_used(user_id)

    return jsonify({
        "success": True,
        "files": result,
        "used": used,
        "used_text": format_size(used),
        "quota": MAX_STORAGE,
        "quota_text": format_size(MAX_STORAGE)
    })


# --------------------------------------------------
# UPLOAD
# --------------------------------------------------

@app.post("/api/upload")
@login_required
def upload_file():

    if "file" not in request.files:

        return jsonify({
            "success": False,
            "message": "No file selected."
        }), 400

    file = request.files["file"]

    if file.filename == "":

        return jsonify({
            "success": False,
            "message": "No file selected."
        }), 400

    filename = secure_filename(file.filename)

    if not filename:

        return jsonify({
            "success": False,
            "message": "Invalid filename."
        }), 400

    user_id = session["user_id"]

    # Find file size
    file.stream.seek(0, os.SEEK_END)

    file_size = file.stream.tell()

    file.stream.seek(0)

    if file_size <= 0:

        return jsonify({
            "success": False,
            "message": "Empty files are not allowed."
        }), 400

    used = get_storage_used(user_id)

    if used + file_size > MAX_STORAGE:

        remaining = MAX_STORAGE - used

        return jsonify({
            "success": False,
            "message":
                f"Storage limit exceeded. "
                f"You have {format_size(remaining)} remaining."
        }), 413

    # Unique server-side filename
    extension = os.path.splitext(filename)[1]

    stored_filename = (
        uuid.uuid4().hex + extension
    )

    user_folder = os.path.join(
        STORAGE_DIR,
        str(user_id)
    )

    os.makedirs(user_folder, exist_ok=True)

    file_path = os.path.join(
        user_folder,
        stored_filename
    )

    try:

        file.save(file_path)

        db = get_db()

        db.execute("""
            INSERT INTO files
            (
                user_id,
                original_name,
                stored_name,
                file_type,
                file_size,
                uploaded_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            filename,
            stored_filename,
            file.mimetype,
            file_size,
            datetime.now(timezone.utc).isoformat()
        ))

        db.commit()
        db.close()

    except Exception as error:

        if os.path.exists(file_path):
            os.remove(file_path)

        print(error)

        return jsonify({
            "success": False,
            "message": "Upload failed."
        }), 500

    return jsonify({
        "success": True,
        "message": "File uploaded successfully."
    })


# --------------------------------------------------
# DOWNLOAD
# --------------------------------------------------

@app.get("/api/download/<int:file_id>")
@login_required
def download_file(file_id):

    user_id = session["user_id"]

    db = get_db()

    file = db.execute("""
        SELECT *
        FROM files
        WHERE id = ?
        AND user_id = ?
    """, (
        file_id,
        user_id
    )).fetchone()

    db.close()

    if not file:

        return jsonify({
            "success": False,
            "message": "File not found."
        }), 404

    user_folder = os.path.join(
        STORAGE_DIR,
        str(user_id)
    )

    file_path = os.path.join(
        user_folder,
        file["stored_name"]
    )

    if not os.path.isfile(file_path):

        return jsonify({
            "success": False,
            "message": "File missing from storage."
        }), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=file["original_name"],
        mimetype=file["file_type"]
    )


# --------------------------------------------------
# DELETE
# --------------------------------------------------

@app.delete("/api/files/<int:file_id>")
@login_required
def delete_file(file_id):

    user_id = session["user_id"]

    db = get_db()

    file = db.execute("""
        SELECT *
        FROM files
        WHERE id = ?
        AND user_id = ?
    """, (
        file_id,
        user_id
    )).fetchone()

    if not file:

        db.close()

        return jsonify({
            "success": False,
            "message": "File not found."
        }), 404

    user_folder = os.path.join(
        STORAGE_DIR,
        str(user_id)
    )

    file_path = os.path.join(
        user_folder,
        file["stored_name"]
    )

    try:

        if os.path.isfile(file_path):
            os.remove(file_path)

        db.execute("""
            DELETE FROM files
            WHERE id = ?
            AND user_id = ?
        """, (
            file_id,
            user_id
        ))

        db.commit()
        db.close()

    except Exception as error:

        db.close()

        print(error)

        return jsonify({
            "success": False,
            "message": "Could not delete file."
        }), 500

    return jsonify({
        "success": True,
        "message": "File deleted successfully."
    })


# --------------------------------------------------
# ERROR HANDLER
# --------------------------------------------------

@app.errorhandler(413)
def request_too_large(error):

    return jsonify({
        "success": False,
        "message": "File is too large. Maximum upload size is 100 MB."
    }), 413


# --------------------------------------------------
# START SERVER
# --------------------------------------------------

if __name__ == "__main__":

    init_database()

    print("----------------------------------------")
    print(" Cloud Storage Server")
    print("----------------------------------------")
    print(" Open: http://127.0.0.1:5000")
    print("----------------------------------------")

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )