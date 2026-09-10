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
        player_id = entry.get("player_id")
        if player_id is not None:
            matching = [item for item in self.scores if item.get("player_id") == player_id]
            if matching:
                best_score = max(item["score"] for item in matching)
                candidate_score = entry["score"]
                if candidate_score <= best_score:
                    for item in matching:
                        if entry.get("name"):
                            item["name"] = entry["name"]
                    return sum(item["score"] > best_score for item in self.scores if item.get("player_id") != player_id) + 1

                self.scores = [item for item in self.scores if item.get("player_id") != player_id]
                self.scores.append({**entry, "score": candidate_score})
                return sum(item["score"] > candidate_score for item in self.scores if item.get("player_id") != player_id) + 1

        name = entry.get("name")
        if name:
            matching = [item for item in self.scores if item.get("name") == name]
            if matching:
                best_score = max(item["score"] for item in matching)
                candidate_score = entry["score"]
                if candidate_score <= best_score:
                    for item in matching:
                        item["name"] = name
                    return sum(item["score"] > best_score for item in self.scores if item.get("name") != name) + 1

                self.scores = [item for item in self.scores if item.get("name") != name]
                self.scores.append({**entry, "score": candidate_score})
                return sum(item["score"] > candidate_score for item in self.scores if item.get("name") != name) + 1

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


def test_same_player_score_updates_instead_of_duplication():
    repository = MemoryRepository()
    service = GameService(repository)

    service.save_run({"player_id": "p1", "name": "Mia", "score": 300, "powerups": 2})
    profile, rank = service.save_run({"player_id": "p1", "name": "Mia", "score": 750, "powerups": 5})

    assert len(repository.scores) == 1
    assert repository.scores[0]["score"] == 750
    assert repository.scores[0]["player_id"] == "p1"
    assert rank == 1
    assert profile["stats"]["score"] == 750


def test_same_name_without_player_id_updates_best_score():
    repository = MemoryRepository()
    service = GameService(repository)

    service.submit_score("Mia", 300)
    rank = service.submit_score("Mia", 820)

    assert len(repository.scores) == 1
    assert repository.scores[0]["score"] == 820
    assert rank == 1


def test_invalid_score_is_rejected():
    try:
        GameService.validate_score(True)
    except ValueError as exc:
        assert str(exc) == "Pontuação inválida"
    else:
        raise AssertionError("invalid score was accepted")
