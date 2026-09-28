from fastapi import HTTPException, status

ROLE_RANK = {"viewer": 0, "member": 1, "admin": 2, "owner": 3}


def require_role(current: str, required: str) -> None:
    """Проверяет, что роль current не ниже required. Иначе 403."""
    if ROLE_RANK.get(current, -1) < ROLE_RANK.get(required, 99):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Requires role '{required}' or higher",
        )


def can_manage(current: str) -> bool:
    return current in ("owner", "admin")