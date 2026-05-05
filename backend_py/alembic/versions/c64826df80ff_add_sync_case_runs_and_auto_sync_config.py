"""add_sync_case_runs_and_auto_sync_config

Revision ID: c64826df80ff
Revises: 8a0998e7f55f
Create Date: 2026-05-04 20:38:46.962840

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c64826df80ff'
down_revision: Union[str, None] = '8a0998e7f55f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # sync_case_runs
    op.create_table(
        'sync_case_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('iteration_name', sa.String(), nullable=False),
        sa.Column('folder_id', sa.Integer(), nullable=True),
        sa.Column('folder_url', sa.String(), nullable=True),
        sa.Column('stats_created', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('stats_updated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('stats_skipped', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('stats_errors', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('details', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('(CURRENT_TIMESTAMP)')),
        sa.PrimaryKeyConstraint('id')
    )

    # auto_sync_config
    op.create_table(
        'auto_sync_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('mode', sa.String(), nullable=False, server_default='"cases"'),
        sa.Column('gitlab_project_id', sa.String(), nullable=True),
        sa.Column('testmo_project_id', sa.Integer(), nullable=True),
        sa.Column('iteration_name', sa.String(), nullable=True),
        sa.Column('run_id', sa.Integer(), nullable=True),
        sa.Column('version', sa.String(), nullable=True),
        sa.Column('timezone', sa.String(), nullable=False, server_default='"Europe/Paris"'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('(CURRENT_TIMESTAMP)')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('(CURRENT_TIMESTAMP)')),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('auto_sync_config')
    op.drop_table('sync_case_runs')
