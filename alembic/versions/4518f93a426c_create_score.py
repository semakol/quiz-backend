"""create score

Revision ID: 4518f93a426c
Revises: add_current_question_id
Create Date: 2026-01-11 15:31:31.672006

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4518f93a426c'
down_revision: Union[str, Sequence[str], None] = 'add_current_question_id'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Проверяем, существует ли уже колонка score
    # Если она уже была добавлена в предыдущей миграции, эта миграция ничего не делает
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('questions')]
    
    if 'score' not in columns:
        # Если колонка не существует, добавляем ее
        op.add_column('questions', sa.Column('score', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Проверяем, существует ли колонка score перед удалением
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('questions')]
    
    if 'score' in columns:
        # Если колонка существует, удаляем ее
        op.drop_column('questions', 'score')
