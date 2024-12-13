# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PreAlert(Document):
	pass


@frappe.whitelist()
def get_percentage_of_hsn_and_category_base(name, category):
		data = frappe.db.sql(" select * from `tabApplication Bond Duty Details` where parent=%s and category=%s ",(name, category), as_dict=True)
		return data

@frappe.whitelist()
def get_exchange_rate(name):
    data = frappe.db.sql(" select exchange_rate,currency from `tabPurchase Order List` where parent=%s",(name), as_dict=True)
    items_data = frappe.db.sql(" select * from `tabPurchase Order Details` where parent=%s ",(name), as_dict=True)
    
    return data, items_data

@frappe.whitelist()
def get_attachments(name):
    data = frappe.db.sql(" select * from `tabAttach Document` where parent=%s  ", (name), as_dict=True)
    
    return data


@frappe.whitelist()
def update_rodtep(name, use_rodtep):
    data = frappe.db.sql(" select remaining_amount from `tabRodtep Utilization` where name=%s ",(name), as_dict=True)
    
    remaining_rodtep = float(data[0]['remaining_amount']) - float(use_rodtep)
    
    frappe.set_value("Rodtep Utilization", name, "remaining_amount", remaining_rodtep)
    if remaining_rodtep == 0:
        frappe.set_value("Rodtep Utilization", name, "status", "Use")