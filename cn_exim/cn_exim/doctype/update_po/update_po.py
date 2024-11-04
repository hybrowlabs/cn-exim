# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class UpdatePo(Document):
	pass

@frappe.whitelist()
def get_items_details_form_pre_alert(name):
    
    data = frappe.db.sql(" select * from `tabPre-Alert Item Details` where parent=%s ", (name), as_dict=True)
    
    return data

@frappe.whitelist()
def get_po_details(po_no, item_code):
    
    data = frappe.db.sql(" select * from `tabPurchase Order Item` where parent=%s and item_code=%s",(po_no, item_code), as_dict=True)
    
    return data
