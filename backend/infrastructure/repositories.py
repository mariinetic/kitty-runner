"""Repositorios de persistencia."""
from typing import Any

from pymongo import ASCENDING, DESCENDING, MongoClient
from pymongo.errors import PyMongoError

from ..core.config import Settings
from ..core.models import default_profile, now_iso


class MongoRepository:
    """Repository Pattern: isola a estrutura e operacoes do MongoDB."""

    def __init__(self, settings: Settings):
        self.client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
        database = self.client[settings.database_name]
        self.scores = database["scores"]
        self.players = database["players"]
        self.runs = database["runs"]
        self._create_indexes()

    def _create_indexes(self) -> None:
        try:
            self.scores.create_index([("score", DESCENDING)])
            self.scores.create_index([("player_id", ASCENDING)])
            self.players.create_index("player_id", unique=True)
            self.runs.create_index([("player_id", ASCENDING), ("created_at", DESCENDING)])
        except PyMongoError:
            pass

    def get_profile(self, player_id: str) -> dict[str, Any]:
        return self.players.find_one({"player_id": player_id}, {"_id": 0}) or default_profile(player_id)

    def save_profile(self, profile: dict[str, Any]) -> dict[str, Any]:
        profile["updated_at"] = now_iso()
        self.players.replace_one({"player_id": profile["player_id"]}, profile, upsert=True)
        return profile

    def leaderboard(self) -> list[dict[str, Any]]:
        return list(self.scores.find({}, {"_id": 0}).sort("score", DESCENDING).limit(10))

    def save_score(self, entry: dict[str, Any]) -> int:
        self.scores.insert_one(entry)
        return self.scores.count_documents({"score": {"$gt": entry["score"]}}) + 1

    def save_run(self, run: dict[str, Any], score_entry: dict[str, Any]) -> int:
        self.runs.insert_one(run)
        return self.save_score(score_entry)

    def reset_scores(self) -> None:
        self.scores.delete_many({})
