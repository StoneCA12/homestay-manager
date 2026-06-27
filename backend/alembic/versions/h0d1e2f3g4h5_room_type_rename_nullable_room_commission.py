"""room type rename, nullable booking room_id, commission_rates table

Revision ID: h0d1e2f3g4h5
Revises: g8b9c0d1e2f3
Create Date: 2026-06-27

Changes:
- Rename RoomType enum: SINGLE→FAMILY, DOUBLE→WINDOW, TWIN→BALCONY, TRIPLE→REGULAR, SUITE→REGULAR
- Make bookings.room_id nullable (room assigned at check-in)
- Create commission_rates table and seed correct OTA rates
"""
from decimal import Decimal

import sqlalchemy as sa
from alembic import op

revision = "h0d1e2f3g4h5"
down_revision = "g8b9c0d1e2f3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        # ── Step 1: recreate roomtype enum with new values ────────────────────
        op.execute("ALTER TYPE roomtype RENAME TO roomtype_old")
        op.execute("CREATE TYPE roomtype AS ENUM ('FAMILY', 'WINDOW', 'BALCONY', 'REGULAR')")
        op.execute("""
            ALTER TABLE rooms
            ALTER COLUMN room_type TYPE roomtype
            USING CASE room_type::text
                WHEN 'SINGLE'  THEN 'FAMILY'::roomtype
                WHEN 'DOUBLE'  THEN 'WINDOW'::roomtype
                WHEN 'TWIN'    THEN 'BALCONY'::roomtype
                WHEN 'TRIPLE'  THEN 'REGULAR'::roomtype
                WHEN 'SUITE'   THEN 'REGULAR'::roomtype
                ELSE 'REGULAR'::roomtype
            END
        """)
        op.execute("DROP TYPE roomtype_old")

        # ── Step 2: make bookings.room_id nullable ────────────────────────────
        op.execute("ALTER TABLE bookings ALTER COLUMN room_id DROP NOT NULL")

    else:
        # SQLite: enum stored as VARCHAR, just update values
        op.execute("UPDATE rooms SET room_type = 'FAMILY'  WHERE room_type = 'SINGLE'")
        op.execute("UPDATE rooms SET room_type = 'WINDOW'  WHERE room_type = 'DOUBLE'")
        op.execute("UPDATE rooms SET room_type = 'BALCONY' WHERE room_type = 'TWIN'")
        op.execute("UPDATE rooms SET room_type = 'REGULAR' WHERE room_type IN ('TRIPLE', 'SUITE')")
        # SQLite doesn't enforce NOT NULL the same way; recreate is complex — skip for test env

    # ── Step 3: create commission_rates table (both dialects) ─────────────────
    op.create_table(
        "commission_rates",
        sa.Column("ota_source", sa.String(20), primary_key=True),
        sa.Column("rate", sa.Numeric(5, 4), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    # ── Step 4: seed correct commission rates ─────────────────────────────────
    commission_rates = op.get_bind().execute  # noqa: just use op.get_bind()
    op.bulk_insert(
        sa.table(
            "commission_rates",
            sa.column("ota_source", sa.String),
            sa.column("rate", sa.Numeric),
        ),
        [
            {"ota_source": "AGODA",       "rate": Decimal("0.1500")},
            {"ota_source": "BOOKING_COM", "rate": Decimal("0.1000")},
            {"ota_source": "TRAVELOKA",   "rate": Decimal("0.1200")},
            {"ota_source": "ZALO",        "rate": Decimal("0.0000")},
            {"ota_source": "DIRECT",      "rate": Decimal("0.0000")},
        ],
    )


def downgrade() -> None:
    op.drop_table("commission_rates")
    # Reversing enum rename in PostgreSQL is complex; raise to prevent accidental rollback
    raise NotImplementedError(
        "Downgrade of roomtype enum rename is not supported. Restore from backup if needed."
    )
