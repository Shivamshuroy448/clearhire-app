from models import Application, ApplicationStage
from datetime import datetime, timedelta
import uuid
import random

def generate_mock_data():
    now = datetime.now()
    apps = []
    
    # 1. Recent Application (Low Risk)
    apps.append(Application(
        id=str(uuid.uuid4()),
        company_name="TechFlow Systems",
        position="Senior Frontend Engineer",
        applied_date=now - timedelta(days=2),
        last_contact_date=now - timedelta(days=1),
        current_stage=ApplicationStage.SCREENING,
        recruiter_name="Sarah Jenkins",
        notes="Had a great intro call. Waiting for coding challenge."
    ))

    # 2. Waiting for Interview Feedback (Medium Risk)
    apps.append(Application(
        id=str(uuid.uuid4()),
        company_name="Nebula AI",
        position="Full Stack Developer",
        applied_date=now - timedelta(days=10),
        last_contact_date=now - timedelta(days=6),
        current_stage=ApplicationStage.INTERVIEW,
        recruiter_name="Mike Chen",
        notes="Technical interview was on Tuesday."
    ))

    # 3. Possible Ghost (High Risk)
    apps.append(Application(
        id=str(uuid.uuid4()),
        company_name="GreenLeaf Startups",
        position="Product Engineer",
        applied_date=now - timedelta(days=25),
        last_contact_date=now - timedelta(days=14),
        current_stage=ApplicationStage.APPLIED,
        notes="Applied via LinkedIn. No response after initial automated email."
    ))

    # 4. Likely Ghost (Critical Risk)
    apps.append(Application(
        id=str(uuid.uuid4()),
        company_name="Legacy Corp",
        position="Software Architect",
        applied_date=now - timedelta(days=45),
        last_contact_date=now - timedelta(days=45),
        current_stage=ApplicationStage.APPLIED,
        notes="Radio silence."
    ))

    return apps
