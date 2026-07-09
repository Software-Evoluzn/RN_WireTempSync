from flask import Blueprint
from flask import request
from flask import jsonify

from database.db import db
from datetime import datetime, timedelta
from models.RegisterProuct import RegisterProduct

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

        warranty_expiry=purchase_date + timedelta(days=365)

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
        
        print("Received Data:", data)
        
        firebase_uid = data.get("firebase_uid")
        
        print("Firebase UID:", firebase_uid)

        
        if not firebase_uid:
            print("Firebase UID:", firebase_uid)

            return jsonify({
                "success" : False,
                "message" : "Firebase UID is required"
            }),400
            
        print("Searching products in database...")
            
        products = RegisterProduct.query.filter_by(firebase_uid=firebase_uid).all()
        
        if not products:
            print("No products found for this user.")
            return jsonify({
                "success":True,
                "products":[]
            }),200
            
        product_list = []
        
        for product in products:
            print("----------------------------------------")
            print("Product ID:", product.id)
            print("Device Name:", product.device_name)
            print("Model No:", product.model_no)
            print("Serial No:", product.serial_no)
            print("MAC ID:", product.mac_id)
            print("Purchase Date:", product.purchase_date)
            print("Warranty Expiry:", product.warranty_expiry)
        
            product_list.append({
                 "id": product.id,

                 "device_name": product.device_name,

                 "model_no": product.model_no,

                 "serial_no": product.serial_no,

                 "mac_id": product.mac_id,

                 "purchase_date": product.purchase_date.strftime("%Y-%m-%d"),

                 "warranty_expiry": product.warranty_expiry.strftime("%Y-%m-%d")
            })
            
            print("Returning Response:")
            print(product_list)
            print("========================================")

        
        return jsonify({
            "success":True,
            "products":product_list
        }),200