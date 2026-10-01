from sqlalchemy.orm import Session
from sql_models import DBApplication
import models
from datetime import datetime, timezone
import uuid
import re
import os
import email.utils
from typing import Optional, List, Dict, Any
import requests

def parse_email_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        dt = email.utils.parsedate_to_datetime(date_str)
        if dt.tzinfo:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return None

def extract_company(subject: str, sender: str = "") -> Optional[str]:
    sub = subject.replace("Re:", "").replace("Fwd:", "").replace("FWD:", "").strip()
    
    # 1. Subject with explicit prefix "Application Received - Datadog"
    m = re.search(r"(?:application received|interview invitation|interview confirmation|application update|status update)\s*[-:|]\s*([A-Za-z0-9&.\- ]+)", sub, re.IGNORECASE)
    if m:
        c = m.group(1).strip()
        if len(c) > 1 and len(c) < 35:
            return c

    # 2. "applying to [Company]" or "application to/at/with [Company]" or "interview with [Company]"
    m = re.search(r"(?:applying to|application to|application at|application with|interview with|interest in|career at|role at)\s+([A-Za-z0-9&.\- ]+?)(?:\s+for|\s+as|\s*[-:|!]|\s*\(|$)", sub, re.IGNORECASE)
    if m:
        c = m.group(1).strip()
        if len(c) > 1 and len(c) < 35 and not c.lower().startswith("the position"):
            return c
            
    # 3. "[Company] - Application Received" or "[Company] Interview" or "[Company]: Next steps"
    m = re.search(r"^([A-Za-z0-9&.\- ]+?)\s*(?:[-:|]|\s+team|\s+careers|\s+recruiting)\s*(?:interview|application|invitation|update|offer|next steps)", sub, re.IGNORECASE)
    if m:
        c = m.group(1).strip()
        if len(c) > 1 and len(c) < 35:
            return c

    # 4. "on behalf of [Company]" in sender
    m = re.search(r"on behalf of\s+([A-Za-z0-9&.\- ]+?)(?:<|$|\")", sender, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    # 5. Sender display name like "Stripe Careers <recruiter@stripe.com>"
    m = re.search(r"^\"?([A-Za-z0-9&.\- ]+?)\s*(?:Careers|Recruiting|Talent|HR|Team|Jobs)", sender, re.IGNORECASE)
    if m:
        c = m.group(1).strip()
        if len(c) > 1 and len(c) < 35 and c.lower() not in ["greenhouse", "lever", "workday", "ashby"]:
            return c
            
    # 6. Fallback to sender domain if it is a company domain (e.g. recruiter@stripe.com -> Stripe)
    m = re.search(r"@([A-Za-z0-9\-]+)\.(?:com|io|ai|co|org)", sender)
    if m:
        dom = m.group(1).capitalize()
        if dom.lower() not in ["gmail", "googlemail", "yahoo", "hotmail", "outlook", "greenhouse", "lever", "ashbyhq", "workday"]:
            return dom

    # 7. Fallback: Split by dash or pipe if present
    if " - " in sub:
        parts = sub.split(" - ")
        candidate = parts[-1].strip()
        if len(candidate) > 1 and len(candidate) < 30:
            return candidate
    if " | " in sub:
        parts = sub.split(" | ")
        candidate = parts[-1].strip()
        if len(candidate) > 1 and len(candidate) < 30:
            return candidate

    return None

def extract_role(subject: str, snippet: str = "") -> str:
    combined = f"{subject} {snippet}"
    # Look for patterns like "for Senior Software Engineer", "as an ML Engineer", "role of Product Manager"
    m = re.search(r"(?:for (?:the )?(?:position of |role of )?|as an? |role:\s*|position:\s*)([A-Za-z0-9 /&,-]+?)(?:\s+at|\s+with|\s*[-:|!.,;]|\s*\(|$)", combined, re.IGNORECASE)
    if m:
        role = m.group(1).strip()
        if 3 <= len(role) <= 45 and not any(w in role.lower() for w in ["your application", "thank you", "interview", "update", "confirmation", "the position"]):
            return role
            
    common_roles = [
        "Software Engineer", "Full Stack Engineer", "Frontend Engineer", "Backend Engineer",
        "Machine Learning Engineer", "AI Engineer", "Data Scientist", "Product Manager",
        "DevOps Engineer", "Site Reliability Engineer", "Security Engineer", "Engineering Manager"
    ]
    for r in common_roles:
        if r.lower() in combined.lower():
            return r
            
    return "Software Engineer"

def extract_stage(subject: str, snippet: str = "") -> str:
    text = f"{subject} {snippet}".lower()
    if any(w in text for w in ["offer letter", "job offer", "pleased to offer", "congratulations on your offer"]):
        return "Offer"
    if any(w in text for w in ["interview", "invitation to interview", "schedule a chat", "phone screen", "technical screen", "hiring manager chat", "round 1", "round 2", "onsite"]):
        return "Interview"
    if any(w in text for w in ["unfortunately", "not moving forward", "other candidates", "pursue other candidates", "decided not to proceed", "will not be moving forward"]):
        return "Rejected"
    if any(w in text for w in ["under review", "reviewing your application", "screening", "phone call"]):
        return "Screening"
    return "Applied"

def sync_gmail(db: Session, user_id: str, access_token: Optional[str] = None) -> Dict[str, Any]:
    # Check if this is demo mode
    if user_id in ["demo-user", "guest"] and not access_token:
        # Simulated demo sync
        simulated_app = db.query(DBApplication).filter(
            DBApplication.company_name == "Stripe",
            DBApplication.user_id == user_id
        ).first()
        
        if not simulated_app:
            new_app = DBApplication(
                id=str(uuid.uuid4()),
                company_name="Stripe",
                position="Machine Learning Engineer",
                current_stage="Interview",
                notes="Gmail Sync: Invitation to Technical Screen with ML Infrastructure Team\nSender: recruiter@stripe.com",
                recruiter_name="recruiter@stripe.com",
                applied_date=datetime.now(),
                last_contact_date=datetime.now(),
                user_id=user_id
            )
            db.add(new_app)
            db.commit()
            return {
                "status": "success",
                "updates": [
                    "Demo Sync: Scanned 12 recent correspondence threads",
                    "Discovered email: 'Stripe - Technical Interview Invitation'",
                    "Added 'Stripe' (ML Engineer) to pipeline with stage 'Interview'"
                ],
                "message": "Demo applications updated."
            }
        else:
            return {
                "status": "success",
                "updates": [
                    "Demo Sync: Scanned inbox, all tracked applications are up-to-date.",
                    "Live Google OAuth sync available when logging in with your Google account."
                ],
                "message": "Demo applications are up to date."
            }

    if not access_token:
        return {
            "status": "error",
            "updates": ["No Google access token provided. Please authorize Gmail access."],
            "message": "Missing access token"
        }

    # Query Gmail REST API with the access token
    headers = {"Authorization": f"Bearer {access_token}"}
    query = 'subject:(application OR interview OR offer OR "applied to" OR "thank you for applying" OR "application received" OR "invitation to interview" OR "next steps")'
    
    url = "https://gmail.googleapis.com/gmail/v1/users/me/messages"
    try:
        res = requests.get(url, headers=headers, params={"q": query, "maxResults": 20}, timeout=10)
        if res.status_code == 401:
            return {
                "status": "error",
                "updates": ["Google OAuth session expired. Please grant Gmail permissions again."],
                "message": "Google token expired"
            }
        if res.status_code != 200:
            return {
                "status": "error",
                "updates": [f"Gmail API error ({res.status_code}): {res.text[:200]}"],
                "message": f"Gmail API returned {res.status_code}"
            }
        
        data = res.json()
        messages = data.get("messages", [])
        if not messages:
            return {
                "status": "success",
                "updates": ["Scanned your Gmail inbox. No application or interview emails found matching criteria."],
                "message": "No matching job application emails found."
            }
        
        updates = []
        imported_count = 0
        updated_count = 0
        
        for msg in messages:
            msg_id = msg.get("id")
            detail_res = requests.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=full",
                headers=headers,
                timeout=10
            )
            if detail_res.status_code != 200:
                continue
            
            msg_data = detail_res.json()
            snippet = msg_data.get("snippet", "")
            payload = msg_data.get("payload", {})
            msg_headers = payload.get("headers", [])
            
            subject = ""
            sender = ""
            date_str = ""
            for h in msg_headers:
                name = h.get("name", "").lower()
                if name == "subject":
                    subject = h.get("value", "")
                elif name == "from":
                    sender = h.get("value", "")
                elif name == "date":
                    date_str = h.get("value", "")
            
            company = extract_company(subject, sender)
            if not company or len(company) < 2 or len(company) > 35:
                continue
                
            role = extract_role(subject, snippet)
            stage = extract_stage(subject, snippet)
            email_date = parse_email_date(date_str)
            
            # Check existing application for this user and company
            existing = db.query(DBApplication).filter(
                DBApplication.user_id == user_id,
                DBApplication.company_name.ilike(company)
            ).first()
            
            if existing:
                stage_order = {"Applied": 1, "Screening": 2, "Interview": 3, "Offer": 4, "Rejected": 0}
                curr_rank = stage_order.get(existing.current_stage, 1)
                new_rank = stage_order.get(stage, 1)
                
                changed = False
                if stage == "Rejected" and existing.current_stage != "Rejected":
                    existing.current_stage = "Rejected"
                    changed = True
                elif new_rank > curr_rank:
                    existing.current_stage = stage
                    changed = True
                
                if email_date and (not existing.last_contact_date or email_date > existing.last_contact_date):
                    existing.last_contact_date = email_date
                    changed = True
                
                if changed:
                    existing.notes = f"{existing.notes}\n[Update]: {subject}"[:500]
                    db.commit()
                    updates.append(f"Updated {company} to '{existing.current_stage}' stage")
                    updated_count += 1
            else:
                new_app = DBApplication(
                    id=f"gm-{str(uuid.uuid4())[:8]}",
                    company_name=company,
                    position=role or "Software Engineer",
                    current_stage=stage,
                    notes=f"Synced from Gmail: {subject}\nFrom: {sender}\nSnippet: {snippet[:150]}",
                    recruiter_name=sender[:100] if sender else None,
                    applied_date=email_date or datetime.now(),
                    last_contact_date=email_date or datetime.now(),
                    user_id=user_id
                )
                db.add(new_app)
                db.commit()
                updates.append(f"Added {company} ({new_app.position}) - Stage: {stage}")
                imported_count += 1
                
        summary_msg = f"Inbox processed: {imported_count} new application(s) added, {updated_count} existing updated."
        if not updates:
            updates.append("Inbox scanned. All tracked applications are already up to date.")
            
        return {
            "status": "success",
            "updates": updates,
            "message": summary_msg
        }
    except Exception as e:
        return {
            "status": "error",
            "updates": [f"Error during Gmail sync: {str(e)}"],
            "message": str(e)
        }
