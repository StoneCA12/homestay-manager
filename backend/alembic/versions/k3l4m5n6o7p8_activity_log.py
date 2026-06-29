"""add activity_logs table

Revision ID: k3l4m5n6o7p8
Revises: j2k3l4m5n6o7
Create Date: 2026-06-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "k3l4m5n6o7p8"
down_revision = "j2k3l4m5n6o7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("room_number", sa.String(), nullable=True),
        sa.Column("actor_name", sa.String(), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_activity_logs_booking_id", "activity_logs", ["booking_id"])
    op.create_index("ix_activity_logs_created_at", "activity_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_activity_logs_created_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_booking_id", table_name="activity_logs")
    op.drop_table("activity_logs")
