from flask import Blueprint, jsonify, request
from database.db import db
from models.RegisterProduct import RegisterProduct
from models.temp_values import TempValues
from models.control_panel import ControlPanel
from datetime import datetime, date as date_cls
from alert_service import send_threshold_email, send_threshold_sms

# Create a Blueprint just like you did in product.py
telemetry = Blueprint("telemetry", __name__)

def process_and_save_mqtt_data(serial, raw_payload):
    """
    Helper function called by mqtt_service.py to process background data.
    """
    # 1. Update Online Status
    product = RegisterProduct.query.filter_by(serial_no=serial).first()
    
    if product:
        product.online_status = True
        product.last_seen = datetime.utcnow()
    else:
        # FIXED: Added a pass statement to prevent the IndentationError/SyntaxError
        pass

    # 2. Parse and Insert Telemetry Data
    if "{device_id:" in raw_payload:
        try:
            # Clean the string and split it
            clean_string = raw_payload.strip("{} ")
            parts = clean_string.split(":")
            
            if len(parts) > 2:
                float_values = [float(val) for val in parts[2:]]
                
                # The exact sequential order of your 24 columns
                column_order = [
                    'R1', 'Y1', 'B1', 'N1', 'R2', 'Y2', 'B2', 'N2',
                    'R3', 'Y3', 'B3', 'N3', 'R4', 'Y4', 'B4', 'N4',
                    'R5', 'Y5', 'B5', 'N5', 'R6', 'Y6', 'B6', 'N6'
                ]
                
                record_data = {'serial_no': serial}
                
                # Map the incoming array values to their specific column names
                for index, value in enumerate(float_values):
                    if index < len(column_order):
                        record_data[column_order[index]] = value
                        
                # Create the new record object
                new_temp_record = TempValues(**record_data)
                db.session.add(new_temp_record)

                # ------------------------------------------------------------
                # THRESHOLD ALERT CHECK
                # Alert once when threshold is exceeded, stay silent while it
                # remains exceeded, and re-arm once it drops back below.
                # ------------------------------------------------------------
                if product and product.threshold_value is not None:
                    exceeded_phases = [
                        col for col, val in record_data.items()
                        if col != 'serial_no'
                        and val is not None
                        and val > product.threshold_value
                    ]

                    now = datetime.utcnow()

                    if exceeded_phases:
                        if not product.alert_active:
                            print(f"🚨 Threshold exceeded for {serial}: {exceeded_phases}")

                            if product.email_enabled:
                                send_threshold_email(
                                    to_email=product.alert_email,
                                    serial_no=serial,
                                    exceeded_phases=exceeded_phases,
                                    threshold=product.threshold_value,
                                    current_time=now
                                )

                            if product.sms_enabled:
                                send_threshold_sms(
                                    mobile_number=product.sms_phone,
                                    serial_no=serial,
                                    exceeded_phases=exceeded_phases,
                                    current_time=now
                                )

                            product.alert_active = True
                        # else: alert already open for this device, do nothing
                    else:
                        if product.alert_active:
                            print(f"✅ {serial} back within safe limits, re-arming alert.")
                            product.alert_active = False
                # ------------------------------------------------------------

        except Exception as e:
            print("Error parsing/saving telemetry data:", str(e))

    # Commit both the status update and the new temperatures at once
    db.session.commit()


# ---------------------------------------------------------
# Dashboard API Route
# ---------------------------------------------------------
@telemetry.route("/api/dashboard", methods=["POST"])
def get_dashboard_data():
    """
    Expects { "firebase_uid": "user_uid_here" }
    Returns the live dashboard data specifically for this user's devices.
    """
    print("\nGET DASHBOARD API CALLED =================")
    data = request.get_json()
    firebase_uid = data.get("firebase_uid")

    if not firebase_uid:
        return jsonify({"success": False, "message": "Firebase UID required"}), 400

    # 1. Get only the devices this specific user owns
    user_products = RegisterProduct.query.filter_by(firebase_uid=firebase_uid).all()
    
    frontend_data = []

    for product in user_products:
        status_text = "Online" if product.online_status else "Offline"
        
        # 2. Get the latest temperature row for this device
        latest_data = TempValues.query.filter_by(serial_no=product.serial_no)\
                                    .order_by(TempValues.timestamp.desc())\
                                    .first()
                                    
        # 3. Get all custom panel names for this device
        custom_panels = ControlPanel.query.filter_by(serial_no=product.serial_no).all()
        # Convert to a dictionary for easy lookup: {1: "Living Room", 2: "Kitchen"}
        panel_names_dict = {p.panel_index: p.custom_name for p in custom_panels}
        
        panels_data = []
        
        if latest_data:
            phases = ['R', 'Y', 'B', 'N']
            
            # Loop through the 6 possible panels
            for panel_no in range(1, 7):
                panel_temps = []
                
                # If R column is not null, this panel has data and exists
                if getattr(latest_data, f"R{panel_no}") is not None:
                    for phase in phases:
                        col_name = f"{phase}{panel_no}"
                        val = getattr(latest_data, col_name)
                        panel_temps.append({
                            "phase": col_name,
                            "current": val,
                            "min": val, 
                            "max": val  
                        })
                    
                    # Fetch custom name if it exists, otherwise default to "Control Panel X"
                    custom_name = panel_names_dict.get(panel_no, f"Control Panel {panel_no}")
                    
                    panels_data.append({
                        "panel_no": panel_no,
                        "custom_name": custom_name, # Pass this to the frontend!
                        "temperatures": panel_temps
                    })

        # Append this device to the final array
        frontend_data.append({
            "device_name": product.device_name,
            "serial_no": product.serial_no,
            "status": status_text,
            "panels": panels_data,
            "graph": [] # Placeholder for now
        })
        
    print(f"Successfully returning dashboard data for {len(user_products)} devices.")
        
    return jsonify(frontend_data), 200

# history in graph

PHASE_COLUMNS = [
    'R1', 'Y1', 'B1', 'N1', 'R2', 'Y2', 'B2', 'N2',
    'R3', 'Y3', 'B3', 'N3', 'R4', 'Y4', 'B4', 'N4',
    'R5', 'Y5', 'B5', 'N5', 'R6', 'Y6', 'B6', 'N6',
]
 
 
@telemetry.route('/api/telemetry-history', methods=['GET'])
def telemetry_history():
    """
    GET /api/telemetry-history?serial_no=WTSF0C01E&date=2026-07-20
 
    - serial_no : required, the device serial number
    - date      : optional, YYYY-MM-DD. Defaults to today (server-local date).
 
    Returns a list of rows for that device on that day, ordered by time:
    [
      { "timestamp": "2026-07-20T07:49:20", "R1": 29.44, "Y1": 29.27, ... },
      ...
    ]
    """
    serial_no = request.args.get('serial_no')
    date_str = request.args.get('date')
 
    if not serial_no:
        return jsonify({"error": "serial_no is required"}), 400
 
    if date_str:
        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({"error": "date must be in YYYY-MM-DD format"}), 400
    else:
        target_date = date_cls.today()
 
    start = datetime.combine(target_date, datetime.min.time())
    end = datetime.combine(target_date, datetime.max.time())
 
    rows = (
        TempValues.query
        .filter(TempValues.serial_no == serial_no)
        .filter(TempValues.timestamp >= start, TempValues.timestamp <= end)
        .order_by(TempValues.timestamp.asc())
        .all()
    )
 
    result = []
    for r in rows:
        entry = {"timestamp": r.timestamp.isoformat()}
        for col in PHASE_COLUMNS:
            entry[col] = getattr(r, col)
        result.append(entry)
 
    return jsonify(result), 200