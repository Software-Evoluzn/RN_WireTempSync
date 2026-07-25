from flask import Blueprint, request, jsonify
from models.DeviceWifi import DeviceWifi
from database.db import db

wifi_bp = Blueprint("wifi", __name__)

@wifi_bp.route("/save-device-wifi", methods=["POST"])
def save_device_wifi():
    data = request.get_json(silent=True) or {}
    
    firebase_uid = data.get("firebase_uid")
    device_id = data.get("device_id")
    ssid = data.get("ssid")
    password = data.get("password")

    # Guard clause against null/missing values
    if not device_id or not ssid or not password:
        return jsonify({
            "success": False,
            "message": "Missing required fields: device_id, ssid, or password"
        }), 400

    try:
        wifi = DeviceWifi.query.filter_by(device_id=device_id).first()

        if wifi:
            wifi.ssid = ssid
            wifi.password = password
            wifi.firebase_uid = firebase_uid or wifi.firebase_uid
        else:
            wifi = DeviceWifi(
                firebase_uid=firebase_uid or "unknown",
                device_id=device_id,
                ssid=ssid,
                password=password
            )
            db.session.add(wifi)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Wifi saved successfully"
        }), 200

    except Exception as e:
        db.session.rollback()
        print("Error saving wifi:", str(e))
        return jsonify({
            "success": False,
            "message": "Database error while saving Wi-Fi"
        }), 500
    
    
@wifi_bp.route("/get-device-wifi/<device_id>", methods=["GET"])
def get_device_wifi(device_id):

    wifi = DeviceWifi.query.filter_by(
        device_id=device_id
    ).first()

    if wifi is None:
        return jsonify({
            "success": False,
            "message": "No wifi found"
        }),404

    return jsonify({
        "success": True,
        "ssid": wifi.ssid
       
    }),200
