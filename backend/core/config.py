"""Configuracao da aplicacao."""
from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    mongo_uri: str = "mongodb://localhost:27017/"
    database_name: str = "kitty_runner"
    port: int = 5000
    debug: bool = True

    @classmethod
    def from_environment(cls) -> "Settings":
        return cls(
            mongo_uri=os.getenv("MONGO_URI", cls.mongo_uri),
            database_name=os.getenv("MONGO_DATABASE", cls.database_name),
            port=int(os.getenv("PORT", str(cls.port))),
            debug=os.getenv("FLASK_DEBUG", "1").lower() in {"1", "true", "yes"},
        )
