"""initial schema

Revision ID: dcb19f5ece4e
Revises:
Create Date: 2026-06-16

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "dcb19f5ece4e"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

user_role = sa.Enum("OWNER", "ADMIN", "RECEPTIONIST", name="userrole")
room_type = sa.Enum("SINGLE", "DOUBLE", "TWIN", "TRIPLE", "SUITE", name="roomtype")
room_status = sa.Enum("AVAILABLE", "DIRTY", "CLEANING", "OUT_OF_ORDER", name="roomstatus")
booking_status = sa.Enum(
    "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW", name="bookingstatus"
)
ota_source = sa.Enum("AGODA", "BOOKING_COM", "TRAVELOKA", "DIRECT", name="otasource")


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("role", user_role, nullable=False, server_default="RECEPTIONIST"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_number", sa.String(10), nullable=False),
        sa.Column("room_type", room_type, nullable=False),
        sa.Column("floor", sa.Integer(), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("base_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("housekeeping_status", room_status, nullable=False, server_default="AVAILABLE"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("room_number"),
    )
    op.create_index("ix_rooms_room_number", "rooms", ["room_number"])

    op.create_table(
        "guests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(150), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("nationality", sa.String(60), nullable=True),
        sa.Column("id_number", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_guests_full_name", "guests", ["full_name"])
    op.create_index("ix_guests_email", "guests", ["email"])

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("booking_ref", sa.String(100), nullable=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("guest_id", sa.Integer(), sa.ForeignKey("guests.id"), nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("check_in_date", sa.Date(), nullable=False),
        sa.Column("check_out_date", sa.Date(), nullable=False),
        sa.Column("num_guests", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("ota_source", ota_source, nullable=False, server_default="DIRECT"),
        sa.Column("status", booking_status, nullable=False, server_default="CONFIRMED"),
        sa.Column("total_price", sa.Numeric(15, 2), nullable=False),
        sa.Column("collected_amount", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("raw_email_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("check_out_date > check_in_date", name="ck_bookings_dates"),
    )
    op.create_index("ix_bookings_room_id", "bookings", ["room_id"])
    op.create_index("ix_bookings_guest_id", "bookings", ["guest_id"])
    op.create_index("ix_bookings_check_in_date", "bookings", ["check_in_date"])
    op.create_index("ix_bookings_check_out_date", "bookings", ["check_out_date"])
    op.create_index("ix_bookings_status", "bookings", ["status"])
    op.create_index("ix_bookings_booking_ref", "bookings", ["booking_ref"])

    op.create_table(
        "housekeeping_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("room_id", sa.Integer(), sa.ForeignKey("rooms.id"), nullable=False),
        sa.Column("changed_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("from_status", room_status, nullable=False),
        sa.Column("to_status", room_status, nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_housekeeping_logs_room_id", "housekeeping_logs", ["room_id"])


def downgrade() -> None:
    op.drop_table("housekeeping_logs")
    op.drop_table("bookings")
    op.drop_table("guests")
    op.drop_table("rooms")
    op.drop_table("users")

    ota_source.drop(op.get_bind())
    booking_status.drop(op.get_bind())
    room_status.drop(op.get_bind())
    room_type.drop(op.get_bind())
    user_role.drop(op.get_bind())
