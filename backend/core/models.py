"""Modelos e funcoes de dominio."""
from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_profile(player_id: str) -> dict[str, Any]:
    return {
        "player_id": player_id,
        "name": "Jogador Misterioso",
        "xp": 0,
        "level": 1,
        "unlocked_phases": [1],
        "achievements": [],
        "missions": {"runs": 0, "hearts": 0, "powerups": 0, "bosses": 0},
        "stats": {"runs": 0, "distance": 0, "score": 0, "enemies": 0, "bosses": 0, "powerups": 0},
        "phase_records": {},
        "settings": {"music": True, "sfx": True, "reduced_motion": False},
        "updated_at": now_iso(),
    }
