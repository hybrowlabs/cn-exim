import frappe

@frappe.whitelist()
def update_po_rate(po_details, rate):
    obj = frappe.parse_json(po_details)
    for item in obj:
        item_code = item.get("item_code")
        po_name = item.get("purchase_order")
        if item_code and rate is not None:
            item_data = frappe.db.sql("select name from `tabPurchase Order Item` where item_code=%s and parent=%s", (item_code, po_name), as_dict=True)
            if item_data:
                frappe.db.set_value("Purchase Order Item", item_data[0].name, "rate", rate)
            else:
                frappe.throw(f"No Purchase Order Item found for item code {item_code} in Purchase Order {obj.get('name')}")
