"""Add internal_notes table for staff communication

Revision ID: l4m5n6o7p8q9
Revises: k3l4m5n6o7p8
Create Date: 2026-06-29

Changes:
- Create notecategory enum (RECEPTION, HOUSEKEEPING, MAINTENANCE, OWNER)
- Create noteentitytype enum (BOOKING, ROOM, GUEST)
- Create internal_notes table (append-only staff notes, never guest-facing)
"""
import sqlalchemy as sa
from alembic import op

revision = "l4m5n6o7p8q9"
down_revision = "k3l4m5n6o7p8"
branch_labels = None
depends_on = None

notecategory = sa.Enum("RECEPTION", "HOUSEKEEPING", "MAINTENANCE", "OWNER", name="notecategory")
noteentitytype = sa.Enum("BOOKING", "ROOM", "GUEST", name="noteentitytype")


def upgrade() -> None:
    op.create_table(
        "internal_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_type", noteentitytype, nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("category", notecategory, nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "author_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_internal_notes_entity", "internal_notes", ["entity_type", "entity_id"])
    op.create_index("ix_internal_notes_category", "internal_notes", ["category"])
    op.create_index("ix_internal_notes_created_at", "internal_notes", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_internal_notes_created_at", table_name="internal_notes")
    op.drop_index("ix_internal_notes_category", table_name="internal_notes")
    op.drop_index("ix_internal_notes_entity", table_name="internal_notes")
    op.drop_table("internal_notes")
    notecategory.drop(op.get_bind(), checkfirst=True)
    noteentitytype.drop(op.get_bind(), checkfirst=True)
