"""split revision_count into revision_1_count and revision_2_count

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns
    op.add_column('journal', sa.Column('revision_1_count', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('journal', sa.Column('revision_2_count', sa.Integer(), nullable=False, server_default='0'))
    
    # Copy existing revision_count to revision_1_count
    op.execute("UPDATE journal SET revision_1_count = revision_count WHERE revision_count IS NOT NULL")
    
    # Drop the old column
    op.drop_column('journal', 'revision_count')


def downgrade() -> None:
    # Add back the old column
    op.add_column('journal', sa.Column('revision_count', sa.Integer(), nullable=False, server_default='0'))
    
    # Copy revision_1_count back to revision_count
    op.execute("UPDATE journal SET revision_count = revision_1_count WHERE revision_1_count IS NOT NULL")
    
    # Drop the new columns
    op.drop_column('journal', 'revision_2_count')
    op.drop_column('journal', 'revision_1_count') 