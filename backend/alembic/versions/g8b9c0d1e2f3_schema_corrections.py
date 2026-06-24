"""schema corrections: guest compliance fields, ZALO source, deposit, per-room expenses

Revision ID: g8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = "g8b9c0d1e2f3"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # ── OTASource enum: add ZALO ──────────────────────────────────────────────
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE otasource ADD VALUE IF NOT EXISTS 'ZALO'")

    # ── guests: compliance + UX fields ───────────────────────────────────────
    op.add_column("guests", sa.Column("id_type", sa.String(20), nullable=True))
    op.add_column("guests", sa.Column("times_stayed", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("guests", sa.Column("notes", sa.Text(), nullable=True))

    # Unique index on phone for non-null values (dedup key)
    if bind.dialect.name == "postgresql":
        op.execute(
            "CREATE UNIQUE INDEX uq_guests_phone ON guests(phone) WHERE phone IS NOT NULL"
        )
    # SQLite (test env) doesn't support partial unique indexes — skip

    # ── bookings: deposit tracking (stored as payment, so just schema for future) ─
    # Deposit is recorded as a Payment row with notes='deposit'; no column needed.
    # Keeping the migration minimal — revisit if standalone deposit field is required.

    # ── expenses: optional per-room attribution ───────────────────────────────
    op.add_column("expenses", sa.Column("room_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_expenses_room_id", "expenses", "rooms", ["room_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_expenses_room_id", "expenses", ["room_id"])


def downgrade() -> None:
    op.drop_index("ix_expenses_room_id", table_name="expenses")
    op.drop_constraint("fk_expenses_room_id", "expenses", type_="foreignkey")
    op.drop_column("expenses", "room_id")

    op.drop_column("guests", "notes")
    op.drop_column("guests", "times_stayed")
    op.drop_column("guests", "id_type")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS uq_guests_phone")
        # Note: PostgreSQL does not support removing enum values; ZALO stays in the type.
