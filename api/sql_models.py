from sqlalchemy import Column, String, DateTime, Enum, Text
from database import Base
import models
import uuid
from datetime import datetime

class DBApplication(Base):
    __tablename__ = "applications"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    company_name = Column(String, index=True)
    position = Column(String)
    current_stage = Column(String) # Stored as string, validated by Pydantic
    notes = Column(Text, nullable=True)
    recruiter_name = Column(String, nullable=True)
    applied_date = Column(DateTime, default=datetime.now)
    last_contact_date = Column(DateTime, default=datetime.now)
    user_id = Column(String, index=True)
