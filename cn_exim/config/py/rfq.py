import frappe
import json

@frappe.whitelist()
def update_material_request_item(doc):
    doc = frappe.json.loads(doc)
    
    items = doc.get("items", [])
    for item in items:
        if item.get("material_request_item"):
            mr_item = frappe.db.get_value(
                "Material Request Item",
                item.get("material_request_item"),
                ["qty"],
                as_dict=True
            )
            rfq_item = frappe.db.sql("""
                SELECT SUM(qty) AS qty
                FROM `tabRequest for Quotation Item` AS item
                INNER JOIN `tabRequest for Quotation` AS parent
                ON item.parent = parent.name
                WHERE item.material_request_item = %s
                AND parent.docstatus IN (0, 1)
                """, (item.get("material_request_item"),), 
            as_dict=True)

            
            if rfq_item and rfq_item[0].get("qty"):
                rfq_qty = rfq_item[0].get("qty")
            else:
                rfq_qty = 0
                        
            frappe.db.set_value("Material Request Item", item.get("material_request_item"), "custom_rfq_qty", rfq_qty)
            mr_item_qty = mr_item.get("qty", 0)
            if rfq_qty >= mr_item_qty:
                frappe.db.set_value("Material Request Item", item.get("material_request_item"), "custom_rfq_created", 1)
            else:
                frappe.db.set_value("Material Request Item", item.get("material_request_item"), "custom_rfq_created", 0)
            
            
@frappe.whitelist()
def update_material_request_qty(removed_items):
    removed_items = frappe.json.loads(removed_items) if isinstance(removed_items, str) else removed_items
    if not removed_items:
        return

    for item in removed_items:
        material_request_item = item.get("material_request_item")
        rfq_qty = float(item.get("qty", 0))

        if material_request_item:
            mr_item = frappe.get_doc("Material Request Item", material_request_item)
            current_ordered_qty = mr_item.custom_rfq_qty or 0           

            updated_ordered_qty = current_ordered_qty - rfq_qty
            if updated_ordered_qty < 0:
                updated_ordered_qty = 0

            mr_item.custom_rfq_qty = updated_ordered_qty
            mr_item.custom_rfq_created = 0
            mr_item.save(ignore_permissions=True)