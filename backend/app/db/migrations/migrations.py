from alembic import op  # type: ignore
import sqlalchemy as sa

def run_migrations():
    # Create tables if they don't exist
    op.create_table(
        'contacts',
        sa.Column('id', sa.Integer, primary_key=True, index=True),
        sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contact_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'contact_id', name='unique_user_contact')
    )

if __name__ == "__main__":
    run_migrations()