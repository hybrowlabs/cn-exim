# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class GateEntry(Document):
    pass

@frappe.whitelist()
def get_purchase_order_details(po_name):
	purchase_order = frappe.db.sql(" select * from `tabPurchase Order` where name=%s ",(po_name), as_dict=True)
	items =  frappe.db.sql(" select  * from `tabPurchase Order Item` where parent=%s ", (po_name), as_dict=True)
	
	return purchase_order, items

@frappe.whitelist()
def get_po_item_name(po_name, item_code):
    name =  frappe.db.sql(" select name from `tabPurchase Order Item` where parent=%s and item_code=%s ",(po_name, item_code), as_dict=True)
    
    return name