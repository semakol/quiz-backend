"""add current_question_id to sessions

Revision ID: add_current_question_id
Revises: 24f2a1c661a7
Create Date: 2026-01-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_current_question_id'
down_revision: Union[str, None] = '24f2a1c661a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sessions', sa.Column('current_question_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_sessions_current_question', 'sessions', 'questions', ['current_question_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_sessions_current_question', 'sessions', type_='foreignkey')
    op.drop_column('sessions', 'current_question_id')

