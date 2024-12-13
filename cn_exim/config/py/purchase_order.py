import frappe


@frappe.whitelist()
def get_stage_status(purchase_order_name):
    """Fetch connection status for each stage."""
    status = {
        "pickup_request": False,
        "rfq": False,
        "supplier_quotation": False,
        "pre_alert": False,
        "pre_alert_checklist": False,
        "bill_of_entry": False,
        "eway_bill": False,
        "po_update": False,
        "purchase_receipt": False,
        "purchase_invoice": False
    }

    # Example: Check if Pickup Request exists
    if frappe.db.exists("Purchase Order List", {"po_number": purchase_order_name}):
        status["pickup_request"] = True

    # Check other stages similarly
    if frappe.db.exists("Request for Quotation", {"purchase_order": purchase_order_name}):
        status["rfq"] = True

    # if frappe.db.exists("Supplier Quotation", {"purchase_order": purchase_order_name}):
    #     status["supplier_quotation"] = True
    

    return status
