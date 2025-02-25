# Copyright (c) 2025, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class BOEEntry(Document):
	pass


@frappe.whitelist()
def get_items_details(pre_alert_check_list):
    
    data = frappe.db.sql(" select * from `tabPre-Alert Item Details` where parent=%s ", (pre_alert_check_list), as_dict=True)
    parent_data = frappe.db.sql(" select * from `tabPre-Alert Check List` where name=%s ",(pre_alert_check_list), as_dict=True)
    
    return data, parent_data