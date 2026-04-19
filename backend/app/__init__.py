from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy
from config import Config

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Enable CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:3000", "http://localhost:3001", "http://192.168.1.101:3000"],
            "supports_credentials": True,
            "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "expose_headers": ["Content-Range", "X-Content-Range"]
        }
    })
    
    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    
    # Configure JWT
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    app.config['JWT_IDENTITY_CLAIM'] = 'sub'
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.video import video_bp
    from app.routes.admin import admin_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(video_bp, url_prefix='/api/video')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    
    # Create database tables
    with app.app_context():
        db.create_all()
        # 开启 WAL 模式，提升多线程并发写入稳定性
        if 'sqlite' in app.config.get('SQLALCHEMY_DATABASE_URI', ''):
            from sqlalchemy import text
            db.session.execute(text('PRAGMA journal_mode=WAL'))
            db.session.execute(text('PRAGMA synchronous=NORMAL'))
            db.session.commit()

    return app
