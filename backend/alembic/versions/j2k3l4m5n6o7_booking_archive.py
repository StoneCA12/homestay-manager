"""booking archive fields

Revision ID: j2k3l4m5n6o7
Revises: i1j2k3l4m5n6
Create Date: 2026-06-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "j2k3l4m5n6o7"
down_revision = "i1j2k3l4m5n6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("is_archived", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("bookings", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("bookings", sa.Column("archived_by_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_bookings_archived_by_user",
        "bookings", "users",
        ["archived_by_user_id"], ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_bookings_is_archived", "bookings", ["is_archived"])


def downgrade() -> None:
    op.drop_index("ix_bookings_is_archived", table_name="bookings")
    op.drop_constraint("fk_bookings_archived_by_user", "bookings", type_="foreignkey")
    op.drop_column("bookings", "archived_by_user_id")
    op.drop_column("bookings", "archived_at")
    op.drop_column("bookings", "is_archived")
