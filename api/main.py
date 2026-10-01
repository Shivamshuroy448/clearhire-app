from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List
import os
import uuid
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List
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

# API Endpoints
@app.get("/dashboard", response_model=models.DashboardData)
def get_dashboard_data(user_id: str = "guest", db: Session = Depends(get_db)):
    # Fetch from DB
    db_apps = db.query(DBApplication).filter(DBApplication.user_id == user_id).all()
    if not db_apps:
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
def draft_email_route(app_id: str, db: Session = Depends(get_db)):
    db_app = db.query(DBApplication).filter(DBApplication.id == app_id).first()
    if not db_app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Convert manually to Pydantic model for logic functions (could use mapped helper)
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
    
    risk = calculate_risk(app_model)
    email_draft = generate_followup_email(app_model, risk)
    return email_draft

@app.post("/sync/gmail")
def sync_gmail_route(user_id: str = "guest", db: Session = Depends(get_db)):
    updates = sync_gmail(db, user_id)
    return {"status": "success", "updates": updates, "message": f"Processed {len(updates)} updates from Inbox"}

# Static Files & Frontend Serving
frontend_path = "../frontend"
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
async def read_index():
    if os.path.exists(os.path.join(frontend_path, "index.html")):
        return FileResponse(os.path.join(frontend_path, "index.html"))
    return {"message": "Frontend not found. Please verify the directory structure."}
