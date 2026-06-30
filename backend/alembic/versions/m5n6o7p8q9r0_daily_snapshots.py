"""Add daily_snapshots table for end-of-day reports

Revision ID: m5n6o7p8q9r0
Revises: l4m5n6o7p8q9
Create Date: 2026-06-29
"""
import sqlalchemy as sa
from alembic import op

revision = "m5n6o7p8q9r0"
down_revision = "l4m5n6o7p8q9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "daily_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("report_date", sa.Date(), nullable=False),
        sa.Column("report_json", sa.Text(), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "generated_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_daily_snapshots_report_date", "daily_snapshots", ["report_date"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_daily_snapshots_report_date", table_name="daily_snapshots")
    op.drop_table("daily_snapshots")
