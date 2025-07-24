# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe import _
from frappe.utils import flt



class GateEntry(Document):
    def on_submit(self):
        temp_wh = frappe.db.get_value("Company", self.company, "custom_default_temporary_warehouse")

        if not temp_wh:
            frappe.throw("Temporary Warehouse not found for this Company!")

        create_stock_entry_for_stock_received(self.as_dict(), temp_wh)

        for row in self.gate_entry_details:
            update_po_qty(row.purchase_order, row.item, row.qty)

@frappe.whitelist()
def get_purchase_order_details(po_name):
	purchase_order = frappe.db.sql(" select * from `tabPurchase Order` where name=%s ",(po_name), as_dict=True)
	items =  frappe.db.sql(" select  * from `tabPurchase Order Item` where parent=%s ", (po_name), as_dict=True)
	
	return purchase_order, items

@frappe.whitelist()
def get_po_item_name(po_name, item_code):
    name =  frappe.db.sql(" select name, warehouse, parent from `tabPurchase Order Item` where parent=%s and item_code=%s ",(po_name, item_code), as_dict=True)
    
    return name


@frappe.whitelist()
def create_stock_entry_for_stock_received(doc, warehouse):
    if isinstance(doc, str):
        doc = frappe.parse_json(doc)
    elif not isinstance(doc, dict) and hasattr(doc, "as_dict"):
        doc = doc.as_dict()

    stock_entry = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Receipt",
        "custom_gate_entry": doc["name"],
        "items": []
    })

    for item in doc.get("gate_entry_details", []):
        account = frappe.db.get_value("Item Default", {"parent": item["item"]}, "custom_difference_account")
        # if not account:
        #     frappe.throw(f"Custom Difference Account not set in Item Default for Item: {item['item']}")

        po_item_name = item.get("po_item")
        if not po_item_name:
            frappe.throw(f"PO Item reference missing in Gate Entry for Item: {item['item']}")

        warehouse_name = frappe.db.get_value("Purchase Order Item", po_item_name, "warehouse")
        if not warehouse_name:
            frappe.throw(f"Warehouse not set for PO Item: {po_item_name}")

        quality_warehouse = frappe.db.get_value("Warehouse", warehouse_name, "custom_quality_warehouse")
        if not quality_warehouse:
            frappe.throw(f"Quality Warehouse  not set in Warehouse: {warehouse_name}")

        shelf = frappe.db.get_value("Warehouse", quality_warehouse, "custom_shelf")
        if not shelf:
            frappe.throw(f"Shelf  not set in Quality Warehouse: {quality_warehouse}")

        stock_entry.append("items", {
            "item_code": item["item"],
            "item_name": item["item_name"],
            "qty": item["qty"],
            "uom": item["uom"],
            "t_warehouse": quality_warehouse,
            "expense_account": account,
            "allow_zero_valuation_rate": 1,
            "to_shelf": shelf,
        })

    stock_entry.insert()
    stock_entry.submit()
    
    
@frappe.whitelist()
def get_update_po_details(e_waybill):
    data = frappe.db.sql(" select * from `tabUpdate Po` where e_way_bill=%s ", (e_waybill), as_dict=True)
    
    return data


@frappe.whitelist()
def get_tax_and_charges(po_name):
    tax_table = frappe.db.sql(" select * from `tabPurchase Taxes and Charges` where parent=%s ",(po_name), as_dict=True)
    extra_charge = frappe.db.sql(" select * from `tabPurchase Extra Charges` where parent=%s ", (po_name), as_dict=True)
    
    return {
        "tax_table": tax_table,
        "extra_charge": extra_charge
    }
    
    
@frappe.whitelist()
def get_multiple_purchase_order(po_name):
    po_name = frappe.json.loads(po_name)
    
    po_items_list = []
    po_total_qty_list = []

    for i in po_name:
        po_details = frappe.db.get_value(
            "Purchase Order", {"name": i}, ["name", "supplier", "supplier_name", "currency", "conversion_rate", "cost_center"], as_dict=True
        )
        
        po_item_details = frappe.db.sql(
            "SELECT * FROM `tabPurchase Order Item` WHERE parent=%s", (po_details.get("name")), as_dict=True
        )
        
        for item in po_item_details:
            po_items_list.append({
                "purchase_order": item.get("parent"),
                "item": item.get("item_code"),
                "item_name": item.get("item_name"),
                "uom": item.get("uom"),
                "rate": item.get("rate"),
                "amount": item.get("amount"),
                "qty": item.get("qty"),
                "rate_inr": item.get("base_rate"),
                "amount_inr": item.get("base_amount"),
                "received_qty": item.get("received_qty"),
                "custom_gate_entry_qty": item.get("custom_gate_entry_qty"),
                "name": item.get("name")
            })

            # Handling total quantity PO-wise
            po_number = item.get("parent")
            qty = item.get("qty")
            found = False
            for entry in po_total_qty_list:
                if entry["purchase_order"] == po_number:
                    entry["incoming_quantity"] += qty
                    found = True
                    break

            if not found:
                po_total_qty_list.append({
                    "purchase_order": po_number,
                    "incoming_quantity": qty
                })
            
    return {
        "po_details": po_details,
        "po_items_list": po_items_list,
        "po_total_qty": po_total_qty_list
    }


@frappe.whitelist()
def update_po_qty(po_name, item_code, qty):
    
    frappe.db.sql(" update `tabPurchase Order Item` set custom_gate_entry_qty=custom_gate_entry_qty+%s where parent=%s and item_code=%s ", (qty, po_name, item_code))
                    
    return True

@frappe.whitelist()
def update_po_after_cancel(po_name, item_code, qty):
    # Ensure qty is a float
    qty = flt(qty)

    # Update the custom_gate_entry_qty by subtracting the quantity
    frappe.db.sql("""
        UPDATE `tabPurchase Order Item` 
        SET custom_gate_entry_qty = custom_gate_entry_qty - %s 
        WHERE parent = %s AND item_code = %s
    """, (qty, po_name, item_code))

    return True

@frappe.whitelist()
def get_row_wise_qty(po_name, item_code):
    # No need for json.loads if they are already strings
    data_qty = frappe.db.sql("""
        SELECT custom_gate_entry_qty, qty, received_qty 
        FROM `tabPurchase Order Item` 
        WHERE parent = %s AND item_code = %s
    """, (po_name, item_code), as_dict=True)

    if not data_qty:
        return []  # Always return a valid JSON-serializable object

    return data_qty