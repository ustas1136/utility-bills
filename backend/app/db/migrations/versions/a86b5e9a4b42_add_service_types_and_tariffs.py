"""add service_types and tariffs

Revision ID: a86b5e9a4b42
Revises: bcb2e8d6cac7
Create Date: 2026-09-28 17:43:26.072956

"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'a86b5e9a4b42'
down_revision: str | None = 'bcb2e8d6cac7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── service_types ───────────────────────────────────────────
    op.create_table(
        'service_types',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=20), nullable=False),
        sa.Column('unit', sa.String(length=32), nullable=True),
        sa.Column('periodicity', sa.String(length=20), nullable=False),
        sa.Column('metered', sa.Boolean(), nullable=False),
        sa.Column('applicable_object_types', sa.ARRAY(sa.String(length=32)), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_service_types_category'), 'service_types', ['category'], unique=False)
    op.create_index(op.f('ix_service_types_code'), 'service_types', ['code'], unique=True)
    op.create_index(op.f('ix_service_types_is_system'), 'service_types', ['is_system'], unique=False)

    # ── Начальное наполнение системными услугами ────────────────
    service_types_table = sa.table(
        "service_types",
        sa.column("code", sa.String),
        sa.column("name", sa.String),
        sa.column("category", sa.String),
        sa.column("unit", sa.String),
        sa.column("periodicity", sa.String),
        sa.column("metered", sa.Boolean),
        sa.column("applicable_object_types", sa.ARRAY(sa.String)),
        sa.column("is_system", sa.Boolean),
        sa.column("created_by", sa.BigInteger),
    )

    op.bulk_insert(
        service_types_table,
        [
            {"code": "electricity", "name": "Электроэнергия", "category": "utility",
             "unit": "kWh", "periodicity": "monthly", "metered": True,
             "applicable_object_types": ["apartment", "house"], "is_system": True,
             "created_by": None},
            {"code": "water_cold", "name": "Холодная вода", "category": "utility",
             "unit": "m3", "periodicity": "monthly", "metered": True,
             "applicable_object_types": ["apartment", "house"], "is_system": True,
             "created_by": None},
            {"code": "water_hot", "name": "Горячая вода", "category": "utility",
             "unit": "m3", "periodicity": "monthly", "metered": True,
             "applicable_object_types": ["apartment", "house"], "is_system": True,
             "created_by": None},
            {"code": "gas", "name": "Газ", "category": "utility",
             "unit": "m3", "periodicity": "monthly", "metered": True,
             "applicable_object_types": ["apartment", "house"], "is_system": True,
             "created_by": None},
            {"code": "heating", "name": "Отопление", "category": "utility",
             "unit": "Gcal", "periodicity": "monthly", "metered": False,
             "applicable_object_types": ["apartment", "house"], "is_system": True,
             "created_by": None},
            {"code": "waste", "name": "Вывоз мусора", "category": "utility",
             "unit": "person", "periodicity": "monthly", "metered": False,
             "applicable_object_types": ["apartment", "house"], "is_system": True,
             "created_by": None},
            {"code": "land_tax", "name": "Земельный налог", "category": "tax",
             "unit": None, "periodicity": "yearly", "metered": False,
             "applicable_object_types": ["land"], "is_system": True,
             "created_by": None},
            {"code": "property_tax", "name": "Налог на имущество", "category": "tax",
             "unit": None, "periodicity": "yearly", "metered": False,
             "applicable_object_types": ["apartment", "house"], "is_system": True,
             "created_by": None},
            {"code": "transport_tax", "name": "Транспортный налог", "category": "tax",
             "unit": None, "periodicity": "yearly", "metered": False,
             "applicable_object_types": ["vehicle"], "is_system": True,
             "created_by": None},
            {"code": "osago", "name": "ОСАГО", "category": "insurance",
             "unit": None, "periodicity": "yearly", "metered": False,
             "applicable_object_types": ["vehicle"], "is_system": True,
             "created_by": None},
            {"code": "kasko", "name": "КАСКО", "category": "insurance",
             "unit": None, "periodicity": "yearly", "metered": False,
             "applicable_object_types": ["vehicle"], "is_system": True,
             "created_by": None},
        ],
    )

    # ── tariffs ─────────────────────────────────────────────────
    op.create_table(
        'tariffs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('service_type_id', sa.Integer(), nullable=False),
        sa.Column('household_id', sa.Integer(), nullable=True),
        sa.Column('region', sa.String(length=100), nullable=True),
        sa.Column('rate', sa.Numeric(precision=14, scale=4), nullable=False),
        sa.Column('currency', sa.String(length=3), nullable=False),
        sa.Column('valid_from', sa.Date(), nullable=False),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['household_id'], ['households.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['service_type_id'], ['service_types.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tariffs_household_id'), 'tariffs', ['household_id'], unique=False)
    op.create_index(op.f('ix_tariffs_service_type_id'), 'tariffs', ['service_type_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_tariffs_service_type_id'), table_name='tariffs')
    op.drop_index(op.f('ix_tariffs_household_id'), table_name='tariffs')
    op.drop_table('tariffs')

    op.drop_index(op.f('ix_service_types_is_system'), table_name='service_types')
    op.drop_index(op.f('ix_service_types_code'), table_name='service_types')
    op.drop_index(op.f('ix_service_types_category'), table_name='service_types')
    op.drop_table('service_types')