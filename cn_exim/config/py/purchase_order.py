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

# @frappe.whitelist()
# def get_item_wise_charges(name):
#     data = frappe.db.sql(" select * from `tabItem Charges Template` where parent=%s ",(name), as_dict=True)
    
#     return data

@frappe.whitelist()
def get_extra_charge_template(name):
    data = frappe.db.sql(" select * from `tabItem Charges Template` where  parent=%s ",(name), as_dict=True)
    
    return data


@frappe.whitelist()
def update_total_amount(purchase_order_name, total_amount, total_taxes_and_charges, rounding_adjustment):
    frappe.db.set_value("Purchase Order", purchase_order_name, "total", total_amount)
    frappe.db.set_value("Purchase Order", purchase_order_name, "net_total", total_amount)
    grand_total = float(total_amount) + float(total_taxes_and_charges)
    frappe.db.set_value("Purchase Order", purchase_order_name, "grand_total", grand_total)
    rounded_total = float(grand_total) + float(rounding_adjustment)
    frappe.db.set_value("Purchase Order", purchase_order_name, "rounded_total", rounded_total)