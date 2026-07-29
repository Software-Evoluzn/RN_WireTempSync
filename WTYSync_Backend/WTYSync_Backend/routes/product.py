from flask import Blueprint
from flask import request
from flask import jsonify

from database.db import db
from datetime import datetime, timedelta
from models.RegisterProduct import RegisterProduct
from models.control_panel import ControlPanel 


product = Blueprint("product", __name__)

@product.route("/register-product", methods=["POST"])
def register_product():
    
    print("\n=================Register product api called==================")

    data = request.get_json()
    
    print("Received data" , data)

    if not data:
        return jsonify({
            "success": False,
            "message": "No data received"
        }), 400

    serial = data.get("serial_no")
    print("Serial no",serial)

    # Product already registered
    existing = RegisterProduct.query.filter_by(
        serial_no=serial
    ).first()

    if existing:
        print("Product already registered.")
        return jsonify({
            "success": False,
            "message": "Product already registered."
        }), 400

    purchase_date = datetime.strptime(
        data["purchase_date"],
        "%Y-%m-%d"
    )
    
    print("Purchase Date:", purchase_date)
    access_point=serial[:3]+"Ap"+serial[3:]


    product = RegisterProduct(

        firebase_uid=data["firebase_uid"],

        user_name=data["user_name"],

        email=data["email"],

        contact=data["contact"],

        device_name=data["device_name"],

        model_no=data["model_no"],

        serial_no=data["serial_no"],

        mac_id=data["mac_id"],
        
       purchase_date=purchase_date,

        warranty_year=1,

        warranty_expiry=purchase_date + timedelta(days=365),
        
        online_status=False,
        
        threshold_value=data.get("threshold_value"),
        
        email_enabled=data.get("email_enabled", False),
        
        alert_email=data.get("alert_email"),
        
        sms_enabled=data.get("sms_enabled", False),
         
        sms_phone=data.get('sms_phone'),
        access_point=access_point
       
        

    )
    
    print("Product Object Created:")
    print("Firebase UID:", product.firebase_uid)
    print("User Name:", product.user_name)
    print("Email:", product.email)
    print("Contact:", product.contact)
    print("Device Name:", product.device_name)
    print("Model No:", product.model_no)
    print("Serial No:", product.serial_no)
    print("MAC ID:", product.mac_id)
    print("Warranty Expiry:", product.warranty_expiry)
    print("thresold_value" ,product.threshold_value)
    print("email_enabled" , product.email_enabled)
    print("alert_email", product.alert_email)
    print("sms_enabled" ,  product.sms_enabled )
    print("alert_phone",product.sms_phone)
    print("Access Point:", product.access_point)
    

    db.session.add(product)

    db.session.commit()
    
    print("Product saved successfully in database.")
    print("================================================\n")

    return jsonify({

        "success": True,

        "message": "Product Registered Successfully"

    }), 201
    
    
@product.route("/get-products" , methods = ["POST"])   
def get_products():
    
        print("========================================")
        print("GET PRODUCTS API CALLED")
        data = request.get_json()
        
        # print("Received Data:", data)
        
        firebase_uid = data.get("firebase_uid")
        
        # print("Firebase UID:", firebase_uid)

        
        if not firebase_uid:
            print("Firebase UID:", firebase_uid)

            return jsonify({
                "success" : False,
                "message" : "Firebase UID is required"
            }),400
            
        # print("Searching products in database...")
            
        products = RegisterProduct.query.filter_by(firebase_uid=firebase_uid).all()
        
        if not products:
            print("No products found for this user.")
            return jsonify({
                "success":True,
                "products":[]
            }),200
            
        product_list = []
        
        for product in products:
        
            product_list.append({
                 "id": product.id,

                 "device_name": product.device_name,

                 "model_no": product.model_no,

                 "serial_no": product.serial_no,

                 "mac_id": product.mac_id,
                 
                "purchase_date": product.purchase_date.strftime("%Y-%m-%d"),

                 "warranty_expiry": product.warranty_expiry.strftime("%Y-%m-%d"),
                 
                 "online": product.online_status,
                 
                 "threshold_value": product.threshold_value,
                 
                 "email_enabled": product.email_enabled,
                 
                "alert_email": product.alert_email,
                  
                "sms_enabled": product.sms_enabled,
                
                "alert_phone": product.sms_phone,
                "access_point": product.access_point,
                 
                 
            })
            
            # print("Returning Response:")
            # print(product_list)
            # print("========================================")

        
        return jsonify({
            "success":True,
            "products":product_list
        }),200

# ... [Keep your existing /register-product and /get-products routes] ...

@product.route("/update-panel-name", methods=["POST"])
def update_panel_name():
    print("\n================= UPDATE PANEL NAME API CALLED =================")
    data = request.get_json()
    
    if not data:
        return jsonify({"success": False, "message": "No data received"}), 400

    serial = data.get("serial_no")
    index = data.get("panel_index")
    new_name = data.get("custom_name")

    if not serial or not index or not new_name:
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    # Check if a custom name already exists for this exact device and panel
    panel = ControlPanel.query.filter_by(serial_no=serial, panel_index=index).first()
    
    if not panel:
        print(f"Creating new custom name '{new_name}' for {serial} Panel {index}")
        panel = ControlPanel(serial_no=serial, panel_index=index, custom_name=new_name)
        db.session.add(panel)
    else:
        print(f"Updating custom name to '{new_name}' for {serial} Panel {index}")
        panel.custom_name = new_name
        
    db.session.commit()
    print("==============================================================\n")
    
    return jsonify({
        "success": True, 
        "message": "Panel renamed successfully!"
    }), 200