import frappe

@frappe.whitelist()
def get_item_charges(name):
    data = frappe.db.sql(" select * from `tabItem Charges Template` where parent=%s ", (name), as_dict=True)
    
    return data