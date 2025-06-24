import frappe

def on_trash(doc, method):
    items = doc.get("items")
    for item in items:
        if item.get("material_request_item"):
            frappe.db.set_value("Material Request Item", item.get("material_request_item"), "custom_po_created", 0)
    
