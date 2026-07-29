import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import render_template

# ------------------------------------------------------------------
# Email (SMTP / Gmail App Password) - same pattern as the WTS project
# ------------------------------------------------------------------
SMTP_SERVER = 'smtp.gmail.com'
SMTP_PORT = 587
SENDER_EMAIL = "evoluzn999@gmail.com"
SENDER_NAME = "Evoluzn Team"
SENDER_PASSWORD = "cjbw fabr owpf plyz"  # Gmail App Password

# ------------------------------------------------------------------
# SMS (Fast2SMS DLT route) - same pattern as the smoke-detector project
# ------------------------------------------------------------------
FAST2SMS_API_KEY = "bpNGDhrI3AEHXMJdzsiuPWlRTt10CjoUVYFfcg9m2qS8Z65kKy6VS3s1wGZTfEFC4n8boLtPlAcxOvkN"


def send_threshold_email(to_email, serial_no, exceeded_phases, threshold, current_time):
    """Send a threshold-exceeded email alert for one device."""
    if not to_email:
        print(f"ℹ️ No alert_email set for {serial_no}, skipping email.")
        return

    try:
        html_body = render_template(
            "alert.html",
            serial_number=serial_no,
            threshold=threshold,
            exceeded_phases=', '.join(exceeded_phases),
            timestamp=current_time.strftime("%d %b %Y, %I:%M %p")
        )

        msg = MIMEMultipart("alternative")
        msg['From'] = f"{SENDER_NAME} <{SENDER_EMAIL}>"
        msg['To'] = to_email
        msg['Subject'] = f"⚠️ Temperature Alert for {serial_no} (Phases: {', '.join(exceeded_phases)})"
        msg.attach(MIMEText(html_body, 'html'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, [to_email], msg.as_string())
        server.quit()

        print(f"📧 Alert email sent to {to_email} for {serial_no}")

    except Exception as e:
        print(f"❌ Email send failed for {serial_no}: {e}")


def send_threshold_sms(mobile_number, serial_no, exceeded_phases, current_time):
    """Send a threshold-exceeded SMS alert for one device."""
    if not mobile_number:
        print(f"ℹ️ No sms_phone set for {serial_no}, skipping SMS.")
        return

    try:
        formatted_time = current_time.strftime("%d %b %Y %H:%M:%S")
        url = "https://www.fast2sms.com/dev/bulkV2"
        params = {
            "authorization": FAST2SMS_API_KEY,
            "route": "dlt",
            "sender_id": "EVZIND",
            "message": "217514",  # DLT-approved template ID
            "variables_values": f"TEMP EXCEEDED|{serial_no}|{formatted_time}",
            "numbers": mobile_number
        }

        response = requests.get(url, params=params)
        print(f"📱 SMS status for {serial_no}: {response.status_code} | {response.text}")

    except Exception as e:
        print(f"❌ SMS send failed for {serial_no}: {e}")
