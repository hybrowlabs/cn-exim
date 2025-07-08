import frappe

def on_trash(doc, method):
    # doc = frappe.json.loads(doc)
    for item in doc.get("items", []):
        material_request_item = item.get("material_request_item")
        if material_request_item:
            data = frappe.db.get_value(
                "Material Request Item",
                material_request_item,
                ["qty", "custom_rfq_qty"],
                as_dict=True
            )
            
        
            order_qty = float(data.custom_rfq_qty) - float(item.get("qty", 0))
            frappe.db.set_value("Material Request Item", item.get("material_request_item"), "custom_rfq_qty", order_qty)
            frappe.db.set_value("Material Request Item", item.get("material_request_item"), "custom_po_created", 0)
            



