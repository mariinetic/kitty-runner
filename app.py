"""Kitty Runner — backend Flask com persistência MongoDB."""
import os
from datetime import datetime, timezone

from flask import Flask, render_template, request, jsonify, send_from_directory
from pymongo import MongoClient, DESCENDING, ASCENDING
from pymongo.errors import PyMongoError

app = Flask(__name__)
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client["kitty_runner"]
scores_collection = db["scores"]
players_collection = db["players"]
runs_collection = db["runs"]

try:
    scores_collection.create_index([("score", DESCENDING)])
    scores_collection.create_index([("player_id", ASCENDING)])
    players_collection.create_index("player_id", unique=True)
    runs_collection.create_index([("player_id", ASCENDING), ("created_at", DESCENDING)])
except PyMongoError:
    pass


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def default_profile(player_id):
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


def get_profile(player_id):
    profile = players_collection.find_one({"player_id": player_id}, {"_id": 0})
    return profile or default_profile(player_id)


def save_profile(profile):
    profile["updated_at"] = now_iso()
    players_collection.replace_one({"player_id": profile["player_id"]}, profile, upsert=True)
    return profile


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/Images/<path:filename>")
def image_file(filename):
    return send_from_directory(os.path.join(app.root_path, "Images"), filename)


@app.route("/api/leaderboard", methods=["GET"])
def get_leaderboard():
    try:
        return jsonify(list(scores_collection.find({}, {"_id": 0}).sort("score", DESCENDING).limit(10)))
    except PyMongoError as exc:
        return jsonify({"error": f"Erro ao consultar o banco: {exc}"}), 500


@app.route("/api/profile/<player_id>", methods=["GET"])
def profile_get(player_id):
    try:
        return jsonify(get_profile(str(player_id)[:80]))
    except PyMongoError as exc:
        return jsonify({"error": f"Erro ao consultar o perfil: {exc}"}), 500


@app.route("/api/profile/<player_id>", methods=["PUT"])
def profile_update(player_id):
    data = request.get_json(force=True, silent=True) or {}
    try:
        profile = get_profile(str(player_id)[:80])
        profile["player_id"] = str(player_id)[:80]
        if data.get("name") is not None:
            profile["name"] = str(data["name"]).strip()[:20] or profile["name"]
        for key in ("xp", "level"):
            if isinstance(data.get(key), (int, float)):
                profile[key] = max(0, int(data[key]))
        for key in ("unlocked_phases", "achievements", "missions", "stats", "phase_records", "settings"):
            if isinstance(data.get(key), (dict, list)):
                profile[key] = data[key]
        return jsonify(save_profile(profile))
    except PyMongoError as exc:
        return jsonify({"error": f"Erro ao salvar o perfil: {exc}"}), 500


@app.route("/api/run", methods=["POST"])
def save_run():
    data = request.get_json(force=True, silent=True) or {}
    player_id = str(data.get("player_id") or "guest")[:80]
    score = data.get("score", 0)
    if not isinstance(score, (int, float)) or score < 0:
        return jsonify({"error": "Pontuação inválida"}), 400
    try:
        profile = get_profile(player_id)
        profile["name"] = str(data.get("name") or profile["name"]).strip()[:20] or profile["name"]
        phase = int(data.get("phase") or 1)
        stats = profile.setdefault("stats", {})
        missions = profile.setdefault("missions", {})
        stats["runs"] = int(stats.get("runs", 0)) + 1
        stats["score"] = max(int(stats.get("score", 0)), int(score))
        stats["distance"] = int(stats.get("distance", 0)) + int(data.get("distance", score))
        stats["enemies"] = int(stats.get("enemies", 0)) + int(data.get("enemies", 0))
        stats["powerups"] = int(stats.get("powerups", 0)) + int(data.get("powerups", 0))
        stats["bosses"] = int(stats.get("bosses", 0)) + int(data.get("bosses", 0))
        missions["runs"] = int(missions.get("runs", 0)) + 1
        missions["hearts"] = int(missions.get("hearts", 0)) + int(data.get("hearts", 0))
        missions["powerups"] = int(missions.get("powerups", 0)) + int(data.get("powerups", 0))
        missions["bosses"] = int(missions.get("bosses", 0)) + int(data.get("bosses", 0))
        profile["xp"] = int(profile.get("xp", 0)) + max(10, int(score // 10))
        profile["level"] = 1 + profile["xp"] // 500
        profile.setdefault("unlocked_phases", [1])
        for phase_number in range(1, min(6, profile["level"] + 1) + 1):
            if phase_number not in profile["unlocked_phases"]: profile["unlocked_phases"].append(phase_number)
        profile.setdefault("phase_records", {})
        profile["phase_records"][str(phase)] = max(int(profile["phase_records"].get(str(phase), 0)), int(score))
        achievements = set(profile.get("achievements", []))
        if stats["runs"] >= 1: achievements.add("first_run")
        if int(score) >= 500: achievements.add("score_500")
        if stats["powerups"] >= 5: achievements.add("power_collector")
        if stats["bosses"] >= 1: achievements.add("boss_breaker")
        profile["achievements"] = sorted(achievements)
        run = {"player_id": player_id, "name": profile["name"], "score": int(score), "phase": phase, "created_at": now_iso(), **{k: data.get(k, 0) for k in ("distance", "hearts", "powerups", "enemies", "bosses")}}
        runs_collection.insert_one(run)
        entry = {"player_id": player_id, "name": profile["name"], "score": int(score), "phase": phase, "date": run["created_at"]}
        scores_collection.insert_one(entry)
        rank = scores_collection.count_documents({"score": {"$gt": int(score)}}) + 1
        save_profile(profile)
        return jsonify({"message": "Corrida salva!", "rank": rank, "profile": profile}), 201
    except PyMongoError as exc:
        return jsonify({"error": f"Erro ao salvar a corrida: {exc}"}), 500


@app.route("/api/score", methods=["POST"])
def submit_score():
    data = request.get_json(force=True, silent=True) or {}
    if "player_id" in data:
        return save_run()
    name = str(data.get("name") or "Jogador Misterioso").strip()[:20] or "Jogador Misterioso"
    score = data.get("score")
    if not isinstance(score, (int, float)) or score < 0:
        return jsonify({"error": "Pontuação inválida"}), 400
    try:
        entry = {"name": name, "score": int(score), "date": now_iso()}
        scores_collection.insert_one(entry)
        rank = scores_collection.count_documents({"score": {"$gt": entry["score"]}}) + 1
        return jsonify({"message": "Pontuação salva!", "rank": rank}), 201
    except PyMongoError as exc:
        return jsonify({"error": f"Erro ao salvar no banco: {exc}"}), 500


@app.route("/api/leaderboard", methods=["DELETE"])
def reset_leaderboard():
    try:
        scores_collection.delete_many({})
        return jsonify({"message": "Ranking zerado"})
    except PyMongoError as exc:
        return jsonify({"error": f"Erro ao limpar o banco: {exc}"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
