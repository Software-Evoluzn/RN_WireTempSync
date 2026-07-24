from database.db import db
from datetime import datetime

class DeviceWifi(db.Model):
    __tablename__ = "device_wifi"
    
    id = db.Column(db.Integer, primary_key=True) 
    device_id = db.Column(db.String(100), unique=True, nullable=False)
    firebase_uid = db.Column(db.String(100), nullable=False)
    ssid = db.Column(db.String(100), nullable=False)
    password = db.Column(db.Text, nullable=False) # Encrypt this
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    