"""Add bikes, bike_rentals, and bike_payments tables

Revision ID: n6o7p8q9r0s1
Revises: m5n6o7p8q9r0
Create Date: 2026-06-29
"""
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from alembic import op

revision = "n6o7p8q9r0s1"
down_revision = "m5n6o7p8q9r0"
branch_labels = None
depends_on = None

# New enum types — SQLAlchemy will CREATE them as part of create_table
bikestatus = sa.Enum("AVAILABLE", "RENTED", "MAINTENANCE", name="bikestatus")
bikerentalstatus = sa.Enum("ACTIVE", "RETURNED", "CANCELLED", name="bikerentalstatus")

# paymentmethod already exists from the payments migration — never re-create it
paymentmethod = PGEnum("CASH", "BANK_TRANSFER", "OTA_COLLECTED", name="paymentmethod", create_type=False)


def upgrade() -> None:
    op.create_table(
        "bikes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("plate_number", sa.String(20), nullable=True),
        sa.Column("daily_rate", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", bikestatus, nullable=False, server_default="AVAILABLE"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_bikes_status", "bikes", ["status"])

    op.create_table(
        "bike_rentals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("bike_id", sa.Integer(), sa.ForeignKey("bikes.id"), nullable=False),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id"), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("num_days", sa.Integer(), nullable=False),
        sa.Column("daily_rate", sa.Numeric(15, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("collected_amount", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("status", bikerentalstatus, nullable=False, server_default="ACTIVE"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_by_id",
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
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("end_date >= start_date", name="ck_bike_rentals_dates"),
    )
    op.create_index("ix_bike_rentals_bike_id", "bike_rentals", ["bike_id"])
    op.create_index("ix_bike_rentals_booking_id", "bike_rentals", ["booking_id"])
    op.create_index("ix_bike_rentals_start_date", "bike_rentals", ["start_date"])
    op.create_index("ix_bike_rentals_status", "bike_rentals", ["status"])

    op.create_table(
        "bike_payments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "bike_rental_id",
            sa.Integer(),
            sa.ForeignKey("bike_rentals.id"),
            nullable=False,
        ),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("method", paymentmethod, nullable=False),
        sa.Column(
            "paid_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "recorded_by_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_bike_payments_bike_rental_id", "bike_payments", ["bike_rental_id"])


def downgrade() -> None:
    op.drop_index("ix_bike_payments_bike_rental_id", table_name="bike_payments")
    op.drop_table("bike_payments")

    op.drop_index("ix_bike_rentals_status", table_name="bike_rentals")
    op.drop_index("ix_bike_rentals_start_date", table_name="bike_rentals")
    op.drop_index("ix_bike_rentals_booking_id", table_name="bike_rentals")
    op.drop_index("ix_bike_rentals_bike_id", table_name="bike_rentals")
    op.drop_table("bike_rentals")
    bikerentalstatus.drop(op.get_bind(), checkfirst=True)

    op.drop_index("ix_bikes_status", table_name="bikes")
    op.drop_table("bikes")
    bikestatus.drop(op.get_bind(), checkfirst=True)
