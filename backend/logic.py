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

def detect_role_category(position: str) -> str:
    pos_lower = position.lower()
    if any(w in pos_lower for w in ["vision", "cv", "ai", "machine learning", "ml", "deep learning", "nlp", "llm"]):
        return "AI & Computer Vision"
    elif any(w in pos_lower for w in ["software", "developer", "backend", "frontend", "full stack", "engineer", "systems", "cloud", "devops"]):
        return "Software Engineering"
    elif any(w in pos_lower for w in ["product", "pm", "program manager"]):
        return "Product Management"
    elif any(w in pos_lower for w in ["data", "analyst", "analytics", "scientist", "quant"]):
        return "Data & Analytics"
    elif any(w in pos_lower for w in ["design", "ux", "ui", "product design"]):
        return "Design & UX"
    elif any(w in pos_lower for w in ["sales", "account", "growth", "marketing", "business", "operations"]):
        return "Business & Growth"
    return "General"

def detect_company_tone(company: str, notes: str = "") -> str:
    comp_lower = (company + " " + (notes or "")).lower()
    enterprise_names = ["google", "microsoft", "amazon", "apple", "meta", "oracle", "ibm", "cisco", "intel", "salesforce"]
    if any(ent in comp_lower for ent in enterprise_names):
        return "Enterprise Tech"
    elif any(w in comp_lower for w in ["startup", "seed", "series a", "series b", "yc", "stealth"]):
        return "High-Growth Startup"
    return "Modern Tech"

def generate_followup_email(app: models.Application, risk: models.RiskAssessment, strategy: str = "nudge") -> models.EmailDraftResponse:
    company = app.company_name
    position = app.position
    recruiter = app.recruiter_name or "Hiring Team"
    role_category = detect_role_category(position)
    tone = detect_company_tone(company, app.notes)
    is_interview = app.current_stage in [models.ApplicationStage.SCREENING, models.ApplicationStage.INTERVIEW]
    is_offer = app.current_stage == models.ApplicationStage.OFFER

    subject = ""
    body = ""

    if is_offer:
        subject = f"Question regarding Offer for {position} at {company}"
        body = (f"Hi {recruiter},\n\n"
                f"Thank you so much for extending the offer to join {company} as a {position}!\n\n"
                f"I am reviewing the package details and team roadmap with great excitement. "
                f"I had a quick question regarding [Insert specific question about start date, equity, or benefits] "
                f"and would love to touch base briefly.\n\n"
                f"Thank you again for this incredible opportunity,\n[Your Name]")
        return models.EmailDraftResponse(subject=subject, body=body, role_category=role_category, tone=tone)

    if strategy == "timeline_check":
        subject = f"Status check & timeline update: {position} - [Your Name]"
        intro = f"Thank you again for the interview conversation regarding the {position} role." if is_interview else f"I am following up on my application for the {position} role at {company}."
        body = (f"Hi {recruiter},\n\n"
                f"I hope you are having a great week.\n\n"
                f"{intro}\n\n"
                f"I currently have active timelines progressing with other teams, but because {company}'s mission, culture, and technical scope remain my absolute top priority, I wanted to check in with you first.\n\n"
                f"Could you share a quick update on where the team is in the review process? I would love to align our timelines if possible.\n\n"
                f"Thank you very much for your time and guidance,\n[Your Name]")

    elif strategy == "value_add":
        if role_category == "AI & Computer Vision":
            subject = f"Technical follow-up & vision project update for {position} at {company}"
            interview_context = "Reflecting on our discussion about real-time vision pipelines" if is_interview else "Given your team's focus on high-performance vision models"
            body = (f"Hi {recruiter},\n\n"
                    f"I hope all is well!\n\n"
                    f"{interview_context}, I recently built a modular project demonstrating low-latency edge inference and accuracy optimization that parallels the technical challenges at {company}.\n\n"
                    f"I would be glad to share the code repository or walk through the architecture if helpful for the team.\n\n"
                    f"Looking forward to hearing about next steps,\n[Your Name]")
        elif role_category == "Software Engineering":
            subject = f"Engineering follow-up regarding {position} at {company}"
            interview_context = "Following up on our engineering discussion" if is_interview else "Thinking about the scaling challenges your systems address"
            body = (f"Hi {recruiter},\n\n"
                    f"I hope you are having a productive week!\n\n"
                    f"{interview_context}, I wanted to share a relevant repository where I implemented concurrent task processing and caching to minimize API latency.\n\n"
                    f"I would love to discuss how this hands-on systems experience aligns with your team's upcoming roadmap.\n\n"
                    f"Best regards,\n[Your Name]")
        elif role_category == "Product Management":
            subject = f"Product insights & follow-up: {position} at {company}"
            body = (f"Hi {recruiter},\n\n"
                    f"I hope you are having a great week!\n\n"
                    f"Following up on the {position} role, I put together a quick 1-pager analyzing your recent product releases and outlining two potential experiments to improve user activation metrics.\n\n"
                    f"I would love to share these ideas and discuss how my product execution approach can support your goals this quarter.\n\n"
                    f"Looking forward to connecting,\n[Your Name]")
        else:
            subject = f"Quick thoughts & follow-up: {position} at {company}"
            body = (f"Hi {recruiter},\n\n"
                    f"I hope all is well with you.\n\n"
                    f"Following up on the {position} role at {company}, I wanted to share how I have previously driven measurable results by streamlining cross-functional workflows in fast-moving environments.\n\n"
                    f"I am eager to bring this focus to {company} and would welcome a chance to discuss how I can support your goals.\n\n"
                    f"Best regards,\n[Your Name]")

    else: # Default: "nudge"
        if is_interview:
            subject = f"Thank you & Next Steps: {position} Interview - {company}"
            body = (f"Hi {recruiter},\n\n"
                    f"Thank you again for the opportunity to interview for the {position} role at {company}.\n\n"
                    f"I really enjoyed our conversation and gained even greater appreciation for the team's direction. "
                    f"I wanted to check in and see if there are any updates regarding the next steps in the process.\n\n"
                    f"Please let me know if there is any additional information I can provide.\n\n"
                    f"Best regards,\n[Your Name]")
        else:
            if role_category == "AI & Computer Vision":
                subject = f"Follow-up: {position} application - {company}"
                body = (f"Hi {recruiter},\n\n"
                        f"I hope your week is off to a great start.\n\n"
                        f"I am following up on my application for the {position} role at {company}. Given {company}'s ongoing innovation in high-impact vision models, I remain particularly enthusiastic about contributing to your engineering team.\n\n"
                        f"I wanted to check in on the review timeline and see if there are any updates. In the meantime, I am happy to provide code repositories, research samples, or any additional background.\n\n"
                        f"Thank you for your time,\n[Your Name]")
            elif role_category == "Software Engineering":
                subject = f"Check-in: {position} Application - {company}"
                body = (f"Hi {recruiter},\n\n"
                        f"I hope you are having a great week.\n\n"
                        f"I am writing to check in on the status of my application for the {position} position at {company}. I continue to be very excited about joining the team and building scalable solutions with you.\n\n"
                        f"Please let me know if there are any updates regarding next steps or if you need any further information regarding my background.\n\n"
                        f"Best regards,\n[Your Name]")
            else:
                subject = f"Following up: {position} Application at {company}"
                body = (f"Hi {recruiter},\n\n"
                        f"I hope you are having a productive week.\n\n"
                        f"I wanted to briefly follow up on my recent application for the {position} role at {company}. I remain very eager about the opportunity to contribute to your team and wanted to check in on the review status.\n\n"
                        f"Please let me know if you need any additional materials or details from my end.\n\n"
                        f"Best regards,\n[Your Name]")

    return models.EmailDraftResponse(subject=subject, body=body, role_category=role_category, tone=tone)
