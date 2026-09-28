"""init

Revision ID: 584eef8fa938
Revises: 
Create Date: 2026-09-28 10:04:22.660926

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = '584eef8fa938'
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass