from flask import Blueprint,request,jsonify
from models.DeviceWifi import DeviceWifi
from database.db import db


wifi_bp = Blueprint("wifi",__name__)

@wifi_bp.route("/save-device-wifi", methods=[POST])

def save_device_wifi():
    data = request.json
    firebase_uid = data["firebase_uid"]
    device_id = data["device_id"]
    ssid = data["ssid"]
    password = data["password"]