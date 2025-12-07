import models
from datetime import datetime, timedelta

def calculate_risk(app: models.Application) -> models.RiskAssessment:
    now = datetime.now()
    days_since_contact = (now - app.last_contact_date).days
    
    # Base expectations by stage
    expected_response = {
        models.ApplicationStage.APPLIED: 7,
        models.ApplicationStage.SCREENING: 5,
        models.ApplicationStage.INTERVIEW: 7,
        models.ApplicationStage.OFFER: 3,
        models.ApplicationStage.REJECTED: 0,
        models.ApplicationStage.GHOSTED: 0
    }
    
    expected_days = expected_response.get(app.current_stage, 7)
    
    # Calculate Probability
    # Simple sigmoid-like logic for MVP
    if days_since_contact <= expected_days:
        ghost_prob = 0.1
        risk_level = models.RiskLevel.LOW
        recommendation = "Status normal. No action needed."
    elif days_since_contact <= expected_days * 1.5:
        ghost_prob = 0.4
        risk_level = models.RiskLevel.MEDIUM
        recommendation = "Slight delay. Prepare a follow-up draft."
    elif days_since_contact <= expected_days * 3:
        ghost_prob = 0.75
        risk_level = models.RiskLevel.HIGH
        recommendation = "Significant delay. Send a polite follow-up immediately."
    else:
        ghost_prob = 0.95
        risk_level = models.RiskLevel.CRITICAL
        recommendation = "Likely ghosted. Focus energy on other applications."

    if app.current_stage == models.ApplicationStage.OFFER and days_since_contact > 4:
         ghost_prob = 0.6
         risk_level = models.RiskLevel.HIGH
         recommendation = "Offer expiration risk! Contact recruiter."

    return models.RiskAssessment(
        application_id=app.id,
        ghosting_probability=min(ghost_prob, 1.0),
        risk_level=risk_level,
        days_since_contact=days_since_contact,
        expected_response_days=expected_days,
        recommendation=recommendation
    )

def generate_followup_email(app: models.Application, risk: models.RiskAssessment) -> models.EmailDraftResponse:
    company = app.company_name
    position = app.position
    recruiter = app.recruiter_name or "Hiring Manager"
    
    subject = ""
    body = ""
    
    # Generic templates (Mock AI)
    if app.current_stage == models.ApplicationStage.APPLIED:
        if risk.days_since_contact < 7:
            # Too soon
            subject = f"Following up: Application for {position} at {company}"
            body = (f"Hi {recruiter},\n\n"
                    f"I recently applied for the {position} role at {company} and wanted to briefly reiterate my strong interest in the team.\n\n"
                    f"Please let me know if there's any additional information I can provide to support my application.\n\n"
                    "Best regards,\n[Your Name]")
        else:
            # Post-1 week nudge
            subject = f"Check-in: {position} Application - {company}"
            body = (f"Hi {recruiter},\n\n"
                    f"I hope you're having a great week. I'm writing to follow up on my application for the {position} role.\n\n"
                    f"I remain very interested in the opportunity to join {company} and would love to discuss how my background aligns with your needs.\n\n"
                    "Best,\n[Your Name]")
            
    elif app.current_stage in [models.ApplicationStage.SCREENING, models.ApplicationStage.INTERVIEW]:
        subject = f"Thank you / Follow-up: {position} Interview"
        body = (f"Hi {recruiter},\n\n"
                f"Thank you again for the opportunity to interview for the {position} role.\n\n"
                f"I really enjoyed our conversation and am even more excited about the prospect of joining {company}. "
                f"I just wanted to check in on the timeline for the next steps.\n\n"
                "Looking forward to hearing from you.\n\n"
                "Best regards,\n[Your Name]")
                
    elif app.current_stage == models.ApplicationStage.OFFER:
        subject = f"Question regarding Offer for {position}"
        body = (f"Hi {recruiter},\n\n"
                f"Thank you so much for the offer to join {company} as a {position}!\n\n"
                "I am reviewing the details and had a quick question regarding... [Insert Question]\n\n"
                "Best,\n[Your Name]")
                
    else:
        # Default fallback
        subject = f"Following up on {position} role"
        body = f"Hi {recruiter},\n\nI just wanted to follow up on my application for the {position} position at {company}.\n\nBest,\n[Your Name]"

    return models.EmailDraftResponse(subject=subject, body=body)
