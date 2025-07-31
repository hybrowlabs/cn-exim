import frappe

@frappe.whitelist()
def set_value_in_qc_base_on_pr(parent, item_code, name):
    
    data =  frappe.db.sql(" select qty from `tabPurchase Receipt Item` where parent = %s and item_code = %s ", (parent, item_code), as_dict=True)
    
    frappe.db.set_value("Quality Inspection", name, "custom_accepted_quantity", data[0].qty if data else 0)
    
@frappe.whitelist()
def get_qty_from_purchase_receipt(parent, item_code):
    
    data = frappe.db.sql(" select qty from `tabPurchase Receipt Item` where parent = %s and item_code = %s ", (parent, item_code), as_dict=True)
    
    return data

@frappe.whitelist()
def update_purchase_receipt(parent, item_code, accepted_qty, rejected_qty):
    
    data = frappe.db.sql(" select name from `tabPurchase Receipt Item` where parent = %s and item_code = %s ", (parent, item_code), as_dict=True)
    
    if data:
        frappe.db.set_value("Purchase Receipt Item", data[0].name, "qty", accepted_qty)
        frappe.db.set_value("Purchase Receipt Item", data[0].name, "rejected_qty", rejected_qty)
    
    return True

@frappe.whitelist()
def get_gate_entry_received_qty(gate_entry_child, item_code):
    """
    Get the received quantity from Gate Entry Details for a specific item
    """
    try:
        # Get the received quantity from Gate Entry Details
        data = frappe.db.sql("""
            SELECT qty as received_qty 
            FROM `tabGate Entry Details` 
            WHERE name = %s AND item = %s
        """, (gate_entry_child, item_code), as_dict=True)
        
        if data:
            return {
                "received_qty": data[0].received_qty,
                "success": True
            }
        else:
            return {
                "received_qty": 0,
                "success": False,
                "message": "No Gate Entry Details found for this item"
            }
            
    except Exception as e:
        frappe.log_error(f"Error getting Gate Entry received quantity: {str(e)}")
        return {
            "received_qty": 0,
            "success": False,
            "message": f"Error: {str(e)}"
        }
    