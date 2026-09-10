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
        pipeline = [
            {"$sort": {"score": DESCENDING, "date": DESCENDING}},
            {"$group": {
                "_id": "$player_id",
                "player_id": {"$first": "$player_id"},
                "name": {"$first": "$name"},
                "score": {"$first": "$score"},
                "date": {"$first": "$date"},
            }},
            {"$sort": {"score": DESCENDING, "date": DESCENDING}},
            {"$limit": 10},
            {"$project": {"_id": 0, "player_id": 1, "name": 1, "score": 1, "date": 1}},
        ]
        return list(self.scores.aggregate(pipeline))

    def save_score(self, entry: dict[str, Any]) -> int:
        player_id = entry.get("player_id")
        if player_id is not None:
            existing = list(self.scores.find({"player_id": player_id}, {"_id": 1, "score": 1, "name": 1}))
            if existing:
                best_score = max(int(item.get("score", 0)) for item in existing)
                candidate_score = int(entry.get("score", best_score))
                if candidate_score <= best_score:
                    if entry.get("name"):
                        self.scores.update_many({"player_id": player_id}, {"$set": {"name": entry["name"]}})
                    return self.scores.count_documents({"score": {"$gt": best_score}}) + 1

                self.scores.delete_many({"player_id": player_id})
                self.scores.insert_one({**entry, "score": candidate_score, "date": entry.get("date") or now_iso()})
                return self.scores.count_documents({"score": {"$gt": candidate_score}}) + 1

        name = entry.get("name")
        if name:
            existing = self.scores.find_one({"name": name})
            if existing:
                current_score = int(existing.get("score", 0))
                candidate_score = int(entry.get("score", current_score))
                if candidate_score <= current_score:
                    self.scores.update_one({"name": name}, {"$set": {"name": name}})
                    return self.scores.count_documents({"score": {"$gt": current_score}}) + 1
                self.scores.delete_many({"name": name})
                self.scores.insert_one({**entry, "score": candidate_score, "date": entry.get("date") or now_iso()})
                return self.scores.count_documents({"score": {"$gt": candidate_score}}) + 1

        self.scores.insert_one(entry)
        return self.scores.count_documents({"score": {"$gt": entry["score"]}}) + 1

    def save_run(self, run: dict[str, Any], score_entry: dict[str, Any]) -> int:
        self.runs.insert_one(run)
        return self.save_score(score_entry)

    def reset_scores(self) -> None:
        self.scores.delete_many({})
