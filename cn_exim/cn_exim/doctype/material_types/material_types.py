# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class MaterialTypes(Document):
	pass

@frappe.whitelist()
def get_Charges_of_item(name):
    data = frappe.db.sql(" select * from `tabItem Charges Template` where parent=%s ",(name), as_dict=True)
    
    return data
