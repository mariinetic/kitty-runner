"""Application package for Kitty Runner."""
from flask import Flask

from .api.routes import register_routes
from .application.services import GameService
from .core.config import Settings
from .infrastructure.repositories import MongoRepository


def create_app(settings: Settings | None = None, repository=None) -> Flask:
    settings = settings or Settings.from_environment()
    app = Flask(__name__, template_folder="../frontend/templates", static_folder="../frontend/static")
    app.config.update(DEBUG=settings.debug, PORT=settings.port)
    service = GameService(repository or MongoRepository(settings))
    app.extensions["backend_service"] = service
    register_routes(app, service)
    return app


__all__ = ["create_app", "Settings", "GameService", "MongoRepository"]
