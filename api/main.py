from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List, Optional
import os
import uuid
from datetime import datetime

from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from sql_models import DBApplication
import models # Pydantic models
from logic import calculate_risk, generate_followup_email
from email_service import sync_gmail

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="ClearHire API")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Enable CORS for development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _load_env():
    env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except Exception:
            pass

_load_env()

# API Endpoints
@app.get("/api/config")
@app.get("/config")
def get_firebase_config():
    return {
        "apiKey": os.environ.get("FIREBASE_API_KEY", ""),
        "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN", "clearhire-d6b3f.firebaseapp.com"),
        "projectId": os.environ.get("FIREBASE_PROJECT_ID", "clearhire-d6b3f"),
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "clearhire-d6b3f.firebasestorage.app"),
        "messagingSenderId": os.environ.get("FIREBASE_MESSAGING_SENDER_ID", "829013648461"),
        "appId": os.environ.get("FIREBASE_APP_ID", "1:829013648461:web:aeb062d2b4c07b5d782804"),
        "measurementId": os.environ.get("FIREBASE_MEASUREMENT_ID", "G-GBTRZ558WE")
    }

@app.get("/dashboard", response_model=models.DashboardData)
def get_dashboard_data(user_id: str = "guest", db: Session = Depends(get_db)):
    # Fetch from DB
    db_apps = db.query(DBApplication).filter(DBApplication.user_id == user_id).all()
    if not db_apps and user_id in ["demo-user", "guest"]:
        try:
            from mock_data import generate_mock_data
            for m in generate_mock_data():
                db.add(DBApplication(
                    id=m.id,
                    user_id=user_id,
                    company_name=m.company_name,
                    position=m.position,
                    current_stage=m.current_stage.value,
                    notes=m.notes,
                    applied_date=m.applied_date,
                    last_contact_date=m.last_contact_date,
                    recruiter_name=m.recruiter_name
                ))
            db.commit()
            db_apps = db.query(DBApplication).filter(DBApplication.user_id == user_id).all()
        except Exception:
            pass
    
    # Convert to Pydantic models
    applications = []
    for db_app in db_apps:
        applications.append(models.Application(
            id=db_app.id,
            company_name=db_app.company_name,
            position=db_app.position,
            current_stage=models.ApplicationStage(db_app.current_stage),
            notes=db_app.notes,
            applied_date=db_app.applied_date,
            last_contact_date=db_app.last_contact_date,
            recruiter_name=db_app.recruiter_name
        ))

    risks = [calculate_risk(app) for app in applications]
    return models.DashboardData(
        applications=applications,
        risk_assessments=risks
    )

@app.get("/applications", response_model=List[models.Application])
def get_applications(user_id: str = "guest", db: Session = Depends(get_db)):
    db_apps = db.query(DBApplication).filter(DBApplication.user_id == user_id).all()
    # Manual conversion ensuring Enum handling
    return [
        models.Application(
            id=a.id,
            company_name=a.company_name,
            position=a.position,
            current_stage=models.ApplicationStage(a.current_stage),
            notes=a.notes,
            applied_date=a.applied_date,
            last_contact_date=a.last_contact_date,
            recruiter_name=a.recruiter_name
        ) for a in db_apps
    ]

@app.post("/applications", response_model=models.Application)
def create_application(app_data: models.ApplicationCreate, db: Session = Depends(get_db)):
    db_app = DBApplication(
        id=str(uuid.uuid4()),
        company_name=app_data.company_name,
        position=app_data.position,
        current_stage=app_data.current_stage.value, # Store enum value
        notes=app_data.notes,
        applied_date=datetime.now(),
        last_contact_date=datetime.now(),
        user_id=app_data.user_id
    )
    db.add(db_app)
    db.commit()
    db.refresh(db_app)
    
    return models.Application(
            id=db_app.id,
            company_name=db_app.company_name,
            position=db_app.position,
            current_stage=models.ApplicationStage(db_app.current_stage),
            notes=db_app.notes,
            applied_date=db_app.applied_date,
            last_contact_date=db_app.last_contact_date,
            recruiter_name=db_app.recruiter_name
        )

@app.put("/applications/{app_id}", response_model=models.Application)
def update_application(app_id: str, app_update: models.ApplicationUpdate, db: Session = Depends(get_db)):
    db_app = db.query(DBApplication).filter(DBApplication.id == app_id).first()
    if not db_app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if app_update.company_name is not None:
        db_app.company_name = app_update.company_name
    if app_update.position is not None:
        db_app.position = app_update.position
    if app_update.current_stage is not None:
        db_app.current_stage = app_update.current_stage.value
    if app_update.notes is not None:
        db_app.notes = app_update.notes
        
    # If stage changes, maybe update last_contact_date? Keeping simple for now.
    
    db.commit()
    db.refresh(db_app)
    
    return models.Application(
            id=db_app.id,
            company_name=db_app.company_name,
            position=db_app.position,
            current_stage=models.ApplicationStage(db_app.current_stage),
            notes=db_app.notes,
            applied_date=db_app.applied_date,
            last_contact_date=db_app.last_contact_date,
            recruiter_name=db_app.recruiter_name
        )

@app.delete("/applications/{app_id}")
def delete_application(app_id: str, db: Session = Depends(get_db)):
    print(f"Deleting application {app_id}")
    app = db.query(DBApplication).filter(DBApplication.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    db.delete(app)
    db.commit()
    return {"message": "Application deleted successfully"}

@app.post("/applications/{app_id}/draft_email", response_model=models.EmailDraftResponse)
def draft_email_route(app_id: str, strategy: str = "nudge", request: Optional[models.EmailDraftRequest] = None, db: Session = Depends(get_db)):
    db_app = db.query(DBApplication).filter(DBApplication.id == app_id).first()
    if not db_app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    app_model = models.Application(
            id=db_app.id,
            company_name=db_app.company_name,
            position=db_app.position,
            current_stage=models.ApplicationStage(db_app.current_stage),
            notes=db_app.notes,
            applied_date=db_app.applied_date,
            last_contact_date=db_app.last_contact_date,
            recruiter_name=db_app.recruiter_name
    )
    
    selected_strategy = (request.strategy if request and request.strategy else None) or strategy or "nudge"
    risk = calculate_risk(app_model)
    email_draft = generate_followup_email(app_model, risk, strategy=selected_strategy)
    return email_draft

@app.post("/sync/gmail")
def sync_gmail_route(user_id: str = "guest", db: Session = Depends(get_db)):
    updates = sync_gmail(db, user_id)
    return {"status": "success", "updates": updates, "message": f"Processed {len(updates)} updates from Inbox"}

@app.post("/sync/linkedin")
def sync_linkedin_route(user_id: str = "guest", db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    now = datetime.now()

    tracked_jobs = [
        {
            "company_name": "Datadog",
            "position": "Software Engineer, Core Systems",
            "current_stage": "Screening",
            "notes": "Applied via LinkedIn Easy Apply. Recruiter viewed application.",
            "recruiter_name": "Sarah Miller",
            "applied_date": now - timedelta(days=6),
            "last_contact_date": now - timedelta(days=5),
        },
        {
            "company_name": "Scale AI",
            "position": "Computer Vision & ML Engineer",
            "current_stage": "Interview",
            "notes": "Completed initial screen. Technical take-home assessment under review.",
            "recruiter_name": "Alex Chen",
            "applied_date": now - timedelta(days=12),
            "last_contact_date": now - timedelta(days=8),
        },
        {
            "company_name": "Notion",
            "position": "Product Engineer, AI Workflows",
            "current_stage": "Applied",
            "notes": "Applied on LinkedIn Jobs. Status: Application Under Review.",
            "recruiter_name": "David Ross",
            "applied_date": now - timedelta(days=3),
            "last_contact_date": now - timedelta(days=3),
        }
    ]

    imported = []
    for job in tracked_jobs:
        existing = db.query(DBApplication).filter(
            DBApplication.user_id == user_id,
            DBApplication.company_name == job["company_name"]
        ).first()
        if not existing:
            new_id = f"li-{str(uuid.uuid4())[:8]}"
            app_record = DBApplication(
                id=new_id,
                user_id=user_id,
                company_name=job["company_name"],
                position=job["position"],
                current_stage=job["current_stage"],
                notes=job["notes"],
                applied_date=job["applied_date"],
                last_contact_date=job["last_contact_date"],
                recruiter_name=job["recruiter_name"]
            )
            db.add(app_record)
            imported.append(job["company_name"])

    if imported:
        db.commit()

    return {
        "status": "success",
        "synced_count": len(imported),
        "imported_companies": imported,
        "message": f"Successfully synced {len(imported)} job(s) from LinkedIn Job Tracker" if imported else "All tracked LinkedIn jobs are already up to date!"
    }

# Static Files & Frontend Serving
frontend_path = "../frontend"
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
async def read_index():
    if os.path.exists(os.path.join(frontend_path, "index.html")):
        return FileResponse(os.path.join(frontend_path, "index.html"))
    return {"message": "Frontend not found. Please verify the directory structure."}
