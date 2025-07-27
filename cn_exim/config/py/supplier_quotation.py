import frappe

@frappe.whitelist()
def get_details_to_item(row_name, item_code, supplier):
    data = frappe.db.sql(" select * from `tabItem Supplier` where parent=%s and supplier=%s ", (item_code, supplier), as_dict=True)
    
    if data:
        lead_time = data[0].custom_lead_time
        moq = data[0].custom_minimum_order_qty
        
        frappe.db.set_value("Supplier Quotation Item", row_name, "lead_time_days", lead_time)
        frappe.db.set_value("Supplier Quotation Item", row_name, "custom_minimum_order_qty", moq)

def update_rfq_status(doc, method):
    rfq_set = {item.request_for_quotation for item in doc.items if item.request_for_quotation}

    if not rfq_set:
        return

    status_map = {
        "before_insert": "Pending",
        "on_submit": "Completed",
        "on_cancel": "Submitted"
    }

    new_status = status_map.get(method)
    if not new_status:
        return

    for rfq in rfq_set:
        frappe.db.set_value("Request for Quotation", rfq, "status", new_status)
