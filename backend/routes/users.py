from __future__ import annotations

from flask import Blueprint

from controllers import UserController
from utils.decorators import auth_required


users_bp = Blueprint("users", __name__, url_prefix="/api/users")
controller = UserController()


@users_bp.get("")
@auth_required
def list_users():
    return controller.list()


@users_bp.post("")
@auth_required
def create_user():
    return controller.create()


@users_bp.put("/<user_id>")
@auth_required
def update_user(user_id: str):
    return controller.update(user_id)


@users_bp.delete("/<user_id>")
@auth_required
def delete_user(user_id: str):
    return controller.delete(user_id)


@users_bp.get("/personnel/pending")
@auth_required
def list_pending_personnel():
    return controller.list_pending_personnel()


@users_bp.post("/personnel/<request_id>/approve")
@auth_required
def approve_personnel(request_id: str):
    return controller.approve_personnel(request_id)
