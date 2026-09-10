"""Casos de uso do jogo."""
from typing import Any

from ..core.models import now_iso


class GameService:
    """Service Layer: regras sem dependencia de Flask ou MongoDB."""

    TRACKED_STATS = ("distance", "hearts", "powerups", "enemies", "bosses")

    def __init__(self, repository):
        self.repository = repository

    def get_profile(self, player_id: str) -> dict[str, Any]:
        return self.repository.get_profile(player_id[:80])

    def update_profile(self, player_id: str, data: dict[str, Any]) -> dict[str, Any]:
        profile = self.get_profile(player_id)
        if data.get("name") is not None:
            profile["name"] = str(data["name"]).strip()[:20] or profile["name"]
        for key in ("xp", "level"):
            if isinstance(data.get(key), (int, float)) and not isinstance(data[key], bool):
                profile[key] = max(0, int(data[key]))
        for key in ("unlocked_phases", "achievements", "missions", "stats", "phase_records", "settings"):
            if isinstance(data.get(key), (dict, list)):
                profile[key] = data[key]
        return self.repository.save_profile(profile)

    def submit_score(self, name: str, score: int, player_id: str | None = None) -> int:
        entry = {"name": name[:20] or "Jogador Misterioso", "score": score, "date": now_iso()}
        if player_id is not None:
            entry["player_id"] = str(player_id)[:80]
        return self.repository.save_score(entry)

    def save_run(self, data: dict[str, Any]) -> tuple[dict[str, Any], int]:
        player_id = str(data.get("player_id") or "guest")[:80]
        score = self.validate_score(data.get("score", 0))
        profile = self.repository.get_profile(player_id)
        profile["name"] = str(data.get("name") or profile["name"]).strip()[:20] or profile["name"]
        phase = int(data.get("phase") or 1)
        stats = profile.setdefault("stats", {})
        missions = profile.setdefault("missions", {})
        stats["runs"] = int(stats.get("runs", 0)) + 1
        stats["score"] = max(int(stats.get("score", 0)), score)
        for key in self.TRACKED_STATS:
            value = int(data.get(key, 0))
            stats[key] = int(stats.get(key, 0)) + value
            if key in missions:
                missions[key] = int(missions.get(key, 0)) + value
        missions["runs"] = int(missions.get("runs", 0)) + 1
        profile["xp"] = int(profile.get("xp", 0)) + max(10, score // 10)
        profile["level"] = 1 + profile["xp"] // 500
        self._unlock_phases(profile)
        records = profile.setdefault("phase_records", {})
        records[str(phase)] = max(int(records.get(str(phase), 0)), score)
        self._update_achievements(profile, score)
        created_at = now_iso()
        run = {"player_id": player_id, "name": profile["name"], "score": score, "phase": phase, "created_at": created_at}
        run.update({key: data.get(key, 0) for key in self.TRACKED_STATS})
        entry = {"player_id": player_id, "name": profile["name"], "score": score, "phase": phase, "date": created_at}
        rank = self.repository.save_run(run, entry)
        self.repository.save_profile(profile)
        return profile, rank

    @staticmethod
    def validate_score(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
            raise ValueError("Pontuação inválida")
        return int(value)

    @staticmethod
    def _unlock_phases(profile: dict[str, Any]) -> None:
        unlocked = profile.setdefault("unlocked_phases", [1])
        for phase in range(1, min(6, profile["level"] + 1) + 1):
            if phase not in unlocked:
                unlocked.append(phase)

    @staticmethod
    def _update_achievements(profile: dict[str, Any], score: int) -> None:
        stats = profile["stats"]
        achievements = set(profile.get("achievements", []))
        if stats["runs"] >= 1:
            achievements.add("first_run")
        if score >= 500:
            achievements.add("score_500")
        if stats["powerups"] >= 5:
            achievements.add("power_collector")
        if stats["bosses"] >= 1:
            achievements.add("boss_breaker")
        profile["achievements"] = sorted(achievements)
