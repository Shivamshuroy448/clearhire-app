from sqlalchemy.orm import Session
from sql_models import DBApplication
import models
from datetime import datetime
import uuid
import re
import os
import os.path
import base64
import json
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def get_gmail_service(user_id: str):
    """Shows basic usage of the Gmail API.
    Lists the user's Gmail labels.
    """
    creds = None

    # The file token.json stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    token_file = f'token_{user_id}.json'
    
    if os.path.exists(token_file):
        creds = Credentials.from_authorized_user_file(token_file, SCOPES)
        
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # CHECK ENV VAR FIRST
            google_creds_json = os.getenv("GOOGLE_CREDENTIALS_JSON")
            if google_creds_json:
                try:
                    client_config = json.loads(google_creds_json)
                    flow = InstalledAppFlow.from_client_config(
                        client_config, SCOPES)
                except json.JSONDecodeError:
                     raise ValueError("GOOGLE_CREDENTIALS_JSON env var is not valid JSON")
            
            # FALLBACK TO FILE
            elif os.path.exists('credentials.json'):
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', SCOPES)
            else:
                raise FileNotFoundError("Neither GOOGLE_CREDENTIALS_JSON env var nor credentials.json file found.")
            
            # Run the auth flow
            # Note: run_local_server tries to open a browser window. 
            # In production (headless), this might hang. For a real production app, 
            # we'd need a web-based flow (redirect URI), but that requires significant architecture changes.
            # For this MVP, we assume the user runs this locally ONCE to generate the token, 
            # or we accept that on a cloud server this interactive step implies running it locally first and uploading the token!
            # ACTUALLY: For Render, you cannot run `run_local_server`. 
            # You must upload the `token_*.json` or store the REFRESH TOKEN in env vars.
            
            # Strategy for MVP Deployment:
            # We will rely on uploading the `token_{user_id}.json` (or pasting its content into an ENV var) for the specific user.
            # But the Code below is fine for hybrid dev/prod.
            creds = flow.run_local_server(port=0)
            
        # Save the credentials for the next run
        with open(token_file, 'w') as token:
            token.write(creds.to_json())

    service = build('gmail', 'v1', credentials=creds)
    return service

def parse_company_from_subject(subject: str) -> str:
    # "Thanks for applying to [Company]"
    # "Interview Invitation - [Company]"
    # "Company Name - Application Received"
    
    # Cleaning
    clean_subject = subject.replace("Re:", "").replace("Fwd:", "").strip()
    
    match_apply = re.search(r"applying to\s+(.*)", clean_subject, re.IGNORECASE)
    if match_apply:
        return match_apply.group(1).strip()
    
    match_interview = re.search(r"Interview Invitation\s+-\s+(.*)", clean_subject, re.IGNORECASE)
    if match_interview:
        return match_interview.group(1).strip()
        
    match_received = re.search(r"Application Received\s+-\s+(.*)", clean_subject, re.IGNORECASE)
    if match_received:
        return match_received.group(1).strip()
    
    # Fallback: Split by dash or pipe if present
    if " - " in clean_subject:
        return clean_subject.split(" - ")[-1].strip()
    if " | " in clean_subject:
        return clean_subject.split(" | ")[-1].strip()
        
    return None

def sync_gmail(db: Session, user_id: str):
    updates = []
    
    try:
        service = get_gmail_service(user_id)
        
        # Query for relevant emails
        # Broad query to catch potential applications
        query = 'subject:(application OR interview OR offer OR "thank you for applying") after:2024/01/01'
        
        results = service.users().messages().list(userId='me', q=query, maxResults=10).execute()
        messages = results.get('messages', [])
        
        if not messages:
            return ["No relevant emails found."]

        for msg in messages:
            msg_detail = service.users().messages().get(userId='me', id=msg['id']).execute()
            payload = msg_detail['payload']
            headers = payload.get('headers', [])
            
            subject = ""
            sender = ""
            for h in headers:
                if h['name'] == 'Subject':
                    subject = h['value']
                if h['name'] == 'From':
                    sender = h['value']
            
            company = parse_company_from_subject(subject)
            if not company or len(company) > 30: # Skip if parsing failed or too long
                continue
                
            # Logic similar to mock, but with real data
            db_app = db.query(DBApplication).filter(
                DBApplication.company_name.ilike(f"%{company}%"),
                DBApplication.user_id == user_id
            ).first()
            
            if db_app:
                 # Check for update logic (Simplified)
                old_stage = db_app.current_stage
                new_stage = None
                
                if "Interview" in subject:
                    new_stage = "Interview"
                elif "Offer" in subject:
                    new_stage = "Offer"
                    
                if new_stage and new_stage != old_stage:
                    db_app.current_stage = new_stage
                    db_app.last_contact_date = datetime.now()
                    db.commit()
                    updates.append(f"Updated {company} to {new_stage}")
            else:
                # Create new
                new_app = DBApplication(
                    id=str(uuid.uuid4()),
                    company_name=company,
                    position="Software Engineer", # Default inferred
                    current_stage="Applied",
                    notes=f"Gmail Sync: {subject}\nSender: {sender}",
                    recruiter_name=sender,
                    applied_date=datetime.now(),
                    last_contact_date=datetime.now(),
                    user_id=user_id
                )
                db.add(new_app)
                db.commit()
                updates.append(f"Auto-added application for {company}")
                
    except FileNotFoundError as e:
        return [f"Setup Required: {str(e)}"]
    except Exception as e:
        return [f"Sync Error: {str(e)}"]
            
    return updates or ["Sync completed. No new updates found matching criteria."]
