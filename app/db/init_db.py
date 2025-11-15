from app.db.base import Base
from app.models import models

def init_db(engine):
    Base.metadata.create_all(bind=engine)
