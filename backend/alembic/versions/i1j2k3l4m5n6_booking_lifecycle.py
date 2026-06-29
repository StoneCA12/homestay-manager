"""Booking lifecycle: add PENDING status + booking_logs table

Revision ID: i1j2k3l4m5n6
Revises: h0d1e2f3g4h5
Create Date: 2026-06-28

Changes:
- Add PENDING to bookingstatus enum (before CONFIRMED)
- Create booking_logs table for immutable audit trail
"""
import sqlalchemy as sa
from alembic import op

revision = "i1j2k3l4m5n6"
down_revision = "h0d1e2f3g4h5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        # ALTER TYPE supports adding values without recreating in PostgreSQL 9.1+
        op.execute("ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'CONFIRMED'")

    # Create booking_logs table (both dialects)
    op.create_table(
        "booking_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "booking_id",
            sa.Integer(),
            sa.ForeignKey("bookings.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_booking_logs_booking_id", "booking_logs", ["booking_id"])


def downgrade() -> None:
    op.drop_index("ix_booking_logs_booking_id", table_name="booking_logs")
    op.drop_table("booking_logs")
    # Removing an enum value in PostgreSQL requires recreating the type;
    # raise to prevent accidental rollback
    raise NotImplementedError("Downgrade of bookingstatus enum is not supported. Restore from backup if needed.")
