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


@frappe.whitelist()
def create_stock_entry_for_stock_received(doc, warehouse):
    doc = frappe.json.loads(doc)
    
    stock_entry = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Receipt",
        "custom_gate_entry": doc['name'],
        "items":[]
    })
    
    for item in doc["gate_entry_details"]:
        stock_entry.append("items",{
            "item_code" : item['item'],
            "item_name" : item['item_name'],
            "qty": item['qty'],
            "uom": item['uom'],
            "t_warehouse": warehouse
        })
    
    stock_entry.insert()
    stock_entry.submit()
    
    
@frappe.whitelist()
def get_update_po_details(e_waybill):
    data = frappe.db.sql(" select * from `tabUpdate Po` where e_way_bill=%s ", (e_waybill), as_dict=True)
    
    return data