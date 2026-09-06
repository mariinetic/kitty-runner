"""Adaptadores HTTP da aplicacao."""
import os

from flask import Flask, jsonify, render_template, request, send_from_directory
from pymongo.errors import PyMongoError


def register_routes(app: Flask, service) -> None:
    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/Images/<path:filename>")
    def image_file(filename):
        return send_from_directory(os.path.join(app.root_path, "..", "frontend", "assets", "Images"), filename)

    @app.route("/api/leaderboard", methods=["GET"])
    def get_leaderboard():
        try:
            return jsonify(service.repository.leaderboard())
        except PyMongoError as exc:
            return jsonify({"error": f"Erro ao consultar o banco: {exc}"}), 500

    @app.route("/api/profile/<player_id>", methods=["GET"])
    def profile_get(player_id):
        try:
            return jsonify(service.get_profile(player_id))
        except PyMongoError as exc:
            return jsonify({"error": f"Erro ao consultar o perfil: {exc}"}), 500

    @app.route("/api/profile/<player_id>", methods=["PUT"])
    def profile_update(player_id):
        try:
            return jsonify(service.update_profile(player_id, request.get_json(silent=True) or {}))
        except PyMongoError as exc:
            return jsonify({"error": f"Erro ao salvar o perfil: {exc}"}), 500

    @app.route("/api/run", methods=["POST"])
    def save_run():
        try:
            profile, rank = service.save_run(request.get_json(silent=True) or {})
            return jsonify({"message": "Corrida salva!", "rank": rank, "profile": profile}), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except (PyMongoError, TypeError, OverflowError) as exc:
            return jsonify({"error": f"Erro ao salvar a corrida: {exc}"}), 500

    @app.route("/api/score", methods=["POST"])
    def submit_score():
        data = request.get_json(silent=True) or {}
        if "player_id" in data:
            return save_run()
        try:
            score = service.validate_score(data.get("score"))
            rank = service.submit_score(str(data.get("name") or "Jogador Misterioso").strip(), score)
            return jsonify({"message": "Pontuação salva!", "rank": rank}), 201
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except PyMongoError as exc:
            return jsonify({"error": f"Erro ao salvar no banco: {exc}"}), 500

    @app.route("/api/leaderboard", methods=["DELETE"])
    def reset_leaderboard():
        try:
            service.repository.reset_scores()
            return jsonify({"message": "Ranking zerado"})
        except PyMongoError as exc:
            return jsonify({"error": f"Erro ao limpar o banco: {exc}"}), 500
