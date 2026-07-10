from datetime import datetime, timedelta
from models.RegisterProuct import RegisterProduct
from database.db import db


def update_status():
    timeout = datetime.utcnow() - timedelta(seconds=30)
    
    devices = RegisterProduct.query.all()
    
    for device in devices:
        if device.last_seen:
            if device.last_seen < timeout:
                device.online = False
                
    db.session.commit()
