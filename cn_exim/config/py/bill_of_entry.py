import frappe

@frappe.whitelist()
def get_items_details(pre_alert_check_list):
    
    data = frappe.db.sql(" select * from `tabPre-Alert Item Details` where parent=%s ", (pre_alert_check_list), as_dict=True)
    
    return data