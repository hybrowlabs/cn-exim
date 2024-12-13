# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PickupRequest(Document):
    @frappe.whitelist()
    def get_items(self, po):
        self.purchase_order_details = []
        for i in po:
            doc = frappe.get_doc("Purchase Order", i.get("po_number"))
            for j in doc.items:
                self.append(
                    "purchase_order_details",
                    {
                        "item": j.item_code,
                        "material": j.item_name,
                        "quantity": j.qty,
                        "po_number": i.get("po_number"),
                        "material_desc": j.description,
                    },
                )
                
@frappe.whitelist()
def get_items_details(parent, item_name):
    
    parent_data = frappe.db.sql(" select currency,conversion_rate from `tabPurchase Order` where name=%s ", (parent), as_dict=True)
    child_data = frappe.db.sql(" select rate from `tabPurchase Order Item` where parent=%s and item_code=%s ", (parent, item_name), as_dict=True)

    return parent_data, child_data


@frappe.whitelist()
def validate_po_order_qty_to_pickup_qty(po_no, item_code):
    data = frappe.db.sql(" select received_qty, qty from `tabPurchase Order Item` where parent=%s and item_code=%s ",(po_no, item_code), as_dict=True)
    
    return data

@frappe.whitelist()
def get_po_all_details(po_name):
    
    data = frappe.get_doc("Purchase Order", po_name)
    
    return data