from database.db import db
from datetime import datetime,timedelta

class RegisterProduct(db.Model):
    __tablename__ = "register_product"
    
    id = db.Column(db.Integer,primary_key=True)
    
    firebase_uid = db.Column(db.String(200),nullable=False)
    user_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), nullable=False)
    contact = db.Column(db.String(20), nullable=False)
    device_name = db.Column(db.String(200), nullable=False)
    model_no = db.Column(db.String(100), nullable=False)
    serial_no = db.Column(db.String(100), unique=True, nullable=False)
    mac_id = db.Column(db.String(100), nullable=False)
    #new column added
    online_status = db.Column(db.Boolean, default = False)
    last_seen = db.Column(db.DateTime)
    
    warranty_year = db.Column(db.Integer, default=1)
    purchase_date = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )
    warranty_expiry = db.Column(
        db.DateTime,
        default=lambda: datetime.utcnow() + timedelta(days=365)
    )
    threshold_value=db.Column(db.Float,nullable=True)
    email_enabled = db.Column(db.Boolean,default=False)
    alert_email=db.Column(db.String(150),nullable=True)
    sms_enabled = db.Column(db.Boolean,default= False)
    sms_phone=db.Column(db.String(20),nullable=True)
    
     # Tracks whether an alert is currently "open" for this device.
        # True  -> threshold already breached, alert already sent, stay silent
        # False -> value is back in range, next breach will fire a new alert
    alert_active = db.Column(db.Boolean, default=False)
    
    #new column
    access_point = db.Column(db.String(100),nullable=False)
    