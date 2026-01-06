"""add score to questions

Revision ID: 24f2a1c661a7
Revises: 47cabedcefd2
Create Date: 2026-01-04 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '24f2a1c661a7'
down_revision: Union[str, None] = '47cabedcefd2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('questions', sa.Column('score', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('questions', 'score')

