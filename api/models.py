from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from enum import Enum

class ApplicationStage(str, Enum):
    APPLIED = "Applied"
    SCREENING = "Screening"
    INTERVIEW = "Interview"
    OFFER = "Offer"
    REJECTED = "Rejected"
    GHOSTED = "Ghosted"

class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class ApplicationBase(BaseModel):
    company_name: str
    position: str
    current_stage: ApplicationStage
    notes: Optional[str] = None

class ApplicationCreate(ApplicationBase):
    user_id: str

class ApplicationUpdate(BaseModel):
    company_name: Optional[str] = None
    position: Optional[str] = None
    current_stage: Optional[ApplicationStage] = None
    notes: Optional[str] = None

class Application(ApplicationBase):
    id: str
    applied_date: datetime
    last_contact_date: datetime
    recruiter_name: Optional[str] = None
    user_id: Optional[str] = None

class RiskAssessment(BaseModel):
    application_id: str
    ghosting_probability: float  # 0.0 to 1.0
    risk_level: RiskLevel
    days_since_contact: int
    expected_response_days: int
    recommendation: str

class DashboardData(BaseModel):
    applications: List[Application]
    risk_assessments: List[RiskAssessment]

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    token: str
    user_name: str

class EmailDraftRequest(BaseModel):
    strategy: Optional[str] = "nudge" # "nudge", "value_add", "timeline_check"

class EmailDraftResponse(BaseModel):
    subject: str
    body: str
    role_category: Optional[str] = "General"
    tone: Optional[str] = "Modern Tech"
