from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from routes import register_blueprints


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    frontend_origins = sorted(
        {
            *Config.FRONTEND_ORIGINS,
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
        }
    )

    CORS(
        app,
        origins=frontend_origins,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Garage-ID", "Accept"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        expose_headers=["Content-Type", "Authorization"],
    )

    @app.after_request
    def after_request(response):
        from flask import request
        origin = request.headers.get('Origin', '')
        if origin in frontend_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        elif Config.DEBUG:
            response.headers['Access-Control-Allow-Origin'] = origin or '*'
        
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Garage-ID, Accept'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Type, Authorization'
        return response

    register_blueprints(app)
    
    @app.get("/")
    def index():
        return jsonify(
            {
                "app": app.config["APP_NAME"],
                "status": "ok",
                "version": app.config["APP_VERSION"],
            }
        )

    @app.get("/api/health")
    def health():
        return jsonify({"success": True, "message": "SmartPark backend funcionando"})

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"success": False, "error": "Endpoint no encontrado"}), 404

    @app.errorhandler(500)
    def internal_error(e):
        import traceback
        error_msg = traceback.format_exc()
        print("500 ERROR:", error_msg)
        return jsonify({"success": False, "error": "Error interno del servidor", "details": str(e), "traceback": error_msg[:500]}), 500

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
    )
