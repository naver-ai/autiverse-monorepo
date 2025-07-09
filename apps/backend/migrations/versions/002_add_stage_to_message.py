"""add stage column to message table

Revision ID: 002
Revises: 001
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add stage column to message table
    op.add_column('message', sa.Column('stage', sa.String(), nullable=True))


def downgrade() -> None:
    # Drop stage column from message table
    op.drop_column('message', 'stage') 