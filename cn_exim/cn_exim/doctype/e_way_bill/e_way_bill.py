# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EwayBill(Document):
	pass

@frappe.whitelist()
def get_items_details(name,pre_alert_name):
    
    item_data = frappe.db.sql(" select * from `tabBill of Entry Item` where parent=%s ", (name), as_dict=True)
    data = frappe.db.sql(" select * from `tabBill of Entry` where name=%s ", (name), as_dict=True)
    pre_alert_check_list_data = frappe.db.sql("select * from `tabPre-Alert Item Details` where parent=%s ",(pre_alert_name), as_dict=True)
    return item_data, data, pre_alert_check_list_data