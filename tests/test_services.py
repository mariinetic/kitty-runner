from copy import deepcopy

from backend.application.services import GameService
from backend.core.models import default_profile


class MemoryRepository:
    def __init__(self):
        self.profiles = {}
        self.scores = []
        self.runs = []

    def get_profile(self, player_id):
        return deepcopy(self.profiles.get(player_id, default_profile(player_id)))

    def save_profile(self, profile):
        self.profiles[profile["player_id"]] = deepcopy(profile)
        return profile

    def save_run(self, run, entry):
        self.runs.append(run)
        return self.save_score(entry)

    def save_score(self, entry):
        self.scores.append(entry)
        return sum(item["score"] > entry["score"] for item in self.scores) + 1


def test_save_run_updates_profile_and_rank():
    repository = MemoryRepository()
    service = GameService(repository)

    profile, rank = service.save_run({"player_id": "p1", "name": "Mia", "score": 500, "powerups": 5})

    assert rank == 1
    assert profile["stats"]["runs"] == 1
    assert profile["achievements"] == ["first_run", "power_collector", "score_500"]
    assert repository.runs[0]["player_id"] == "p1"


def test_invalid_score_is_rejected():
    try:
        GameService.validate_score(True)
    except ValueError as exc:
        assert str(exc) == "Pontuação inválida"
    else:
        raise AssertionError("invalid score was accepted")
