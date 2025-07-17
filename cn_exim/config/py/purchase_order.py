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
def update_total_amount(purchase_order_name, total_amount, total_taxes_and_charges, rounding_adjustment, doc):
    frappe.db.set_value("Purchase Order", purchase_order_name, "total", total_amount)
    frappe.db.set_value("Purchase Order", purchase_order_name, "net_total", total_amount)
    grand_total = float(total_amount) + float(total_taxes_and_charges)
    frappe.db.set_value("Purchase Order", purchase_order_name, "grand_total", grand_total)
    rounded_total = float(grand_total) + float(rounding_adjustment)
    frappe.db.set_value("Purchase Order", purchase_order_name, "rounded_total", rounded_total)
    
    # doc = frappe.json.loads(doc)
    
    # for item in doc.get("items"):
    #     amount = (float(item.get("qty")) * float(item.get("rate"))) + float(item.get("custom_freight")) + float(item.get("custom_packaging")) + float(item.get("custom_development")) + float(item.get("custom_miscellaneous"))
    #     frappe.db.set_value(item.get("doctype"), item.get("name"), "net_amount", amount)
    #     frappe.db.set_value(item.get("doctype"), item.get("name"), "base_net_amount", amount)
    #     frappe.db.set_value(item.get("doctype"), item.get("name"), "taxable_value", amount)
    
    
    
@frappe.whitelist()
def get_mr_item_fields(mr_item_name):
    return frappe.db.get_value(
        "Material Request Item",
        mr_item_name,
        ["custom_materil_po_text", "custom_supplier_suggestion", "custom_other_remarks", "custom_item_note"],
        as_dict=True
    )


@frappe.whitelist()
def get_item_rate_from_item_group_to(item_group, row_name):
    rate, valid_upto = None, None
    if item_group:
        rate, valid_upto = frappe.db.get_value(
            "Item Group Price",
            {"item_group": item_group},
            ["rate", "valid_upto"]
        ) or (None, None)

    return {
        "item_group": item_group,
        "rate": rate,
        "valid_upto": valid_upto
    }