"""ensure auth columns + invite tables exist

Revision ID: 0007_fix_auth_columns
Revises: 0006_auth_verification_invites
Create Date: 2025-12-27 01:10:00.000000
"""

from alembic import op

revision = "0007_fix_auth_columns"
down_revision = "0006_auth_verification_invites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS auth_provider VARCHAR NOT NULL DEFAULT 'local',
            ADD COLUMN IF NOT EXISTS google_sub VARCHAR,
            ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
        """
    )
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub ON users (google_sub);
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS invite_codes (
            id SERIAL PRIMARY KEY,
            code VARCHAR NOT NULL,
            created_by_id INTEGER REFERENCES users (id),
            used_by_id INTEGER REFERENCES users (id),
            created_at TIMESTAMP WITHOUT TIME ZONE,
            used_at TIMESTAMP WITHOUT TIME ZONE,
            CONSTRAINT uq_invite_code UNIQUE (code)
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_invite_codes_code ON invite_codes (code);
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS email_verifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users (id),
            token VARCHAR NOT NULL,
            expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            used_at TIMESTAMP WITHOUT TIME ZONE,
            created_at TIMESTAMP WITHOUT TIME ZONE,
            CONSTRAINT uq_email_verification_token UNIQUE (token)
        );
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_email_verifications_token ON email_verifications (token);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_email_verifications_token;")
    op.execute("DROP TABLE IF EXISTS email_verifications;")
    op.execute("DROP INDEX IF EXISTS ix_invite_codes_code;")
    op.execute("DROP TABLE IF EXISTS invite_codes;")
    op.execute("DROP INDEX IF EXISTS uq_users_google_sub;")
    op.execute(
        """
        ALTER TABLE users
            DROP COLUMN IF EXISTS is_verified,
            DROP COLUMN IF EXISTS google_sub,
            DROP COLUMN IF EXISTS auth_provider;
        """
    )
