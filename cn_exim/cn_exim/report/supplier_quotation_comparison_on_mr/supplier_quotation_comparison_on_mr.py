# Copyright (c) 2025, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json

def execute(filters=None):
    columns, data = get_columns(), get_data(filters)
    return columns, data

def get_columns():
    return [
        {"label": "Create PO", "fieldname": "create_po", "fieldtype": "Check", "width": 100},
        {"label": "Supplier", "fieldname": "supplier", "fieldtype": "Link", "options": "Supplier", "width": 150},
        {"label": "Item Code", "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 150},
        {"label": "UOM", "fieldname": "uom", "fieldtype": "Link", "options": "UOM", "width": 100},
        {"label": "Quantity", "fieldname": "quantity", "fieldtype": "Float", "width": 100},
        {"label": "Stock UOM", "fieldname": "stock_uom", "fieldtype": "Link", "options": "UOM", "width": 100},
        {"label": "Currency", "fieldname": "currency", "fieldtype": "Link", "options": "Currency", "width": 100},
        {"label": "Price", "fieldname": "price", "fieldtype": "Currency", "width": 100},
        {"label": "Price (Inr)", "fieldname": "price_inr", "fieldtype": "Currency", "width": 100},
        {"label": "Supplier Quotation", "fieldname": "supplier_quotation", "fieldtype": "Link", "options": "Supplier Quotation", "width": 150},
        {"label": "Valid Till", "fieldname": "valid_till", "fieldtype": "Date", "width": 100},
        {"label": "Lead Time", "fieldname": "lead_time", "fieldtype": "Data", "width": 100},
        {"label": "Request For Quotation", "fieldname": "request_for_quotation", "fieldtype": "Link", "options": "Request for Quotation", "width": 150},
        {"label": "Material Request", "fieldname": "material_request", "fieldtype": "Link", "options": "Material Request", "width": 150},
        {"label": "Remarks", "fieldname": "remarks", "fieldtype": "Data", "width": 200},
    ]

def get_data(filters):
    data = []

    material_request = filters.get("material_request") if filters else None
    if not material_request:
        return []

    data = frappe.db.sql("""
        SELECT
            sq.supplier AS supplier,
            s_item.item_code AS item_code,
            s_item.uom AS uom,
            s_item.qty AS quantity,
            s_item.stock_uom AS stock_uom,
            sq.currency AS currency,
            s_item.rate AS price,
            s_item.lead_time_days AS lead_time,
            s_item.rate * IFNULL(sq.conversion_rate, 1) AS price_inr,
            sq.name AS supplier_quotation,
            sq.valid_till AS valid_till,
            s_item.request_for_quotation AS request_for_quotation,
            s_item.material_request AS material_request,
            s_item.custom_remark AS remarks
        FROM
            `tabSupplier Quotation` sq
        INNER JOIN
            `tabSupplier Quotation Item` s_item ON s_item.parent = sq.name
        WHERE
            s_item.material_request = %s
        ORDER BY
            sq.supplier, s_item.item_code
    """, (material_request,), as_dict=True)

    return data



@frappe.whitelist()
def create_purchase_orders(items):
    items = json.loads(items)

    # Group items by supplier
    supplier_items_map = {}
    for item in items:
        supplier = item["supplier"]
        if supplier not in supplier_items_map:
            supplier_items_map[supplier] = []
        supplier_items_map[supplier].append(item)

    po_names = []

    for supplier, items_list in supplier_items_map.items():
        po = frappe.new_doc("Purchase Order")
        po.supplier = supplier

        for item in items_list:
            supplier_quotation = item["supplier_quotation"]
            item_code = item["item_code"]
            qty = item["qty"]

            # Get Supplier Quotation Item
            sq_items = frappe.get_all("Supplier Quotation Item",
                                    filters={"parent": supplier_quotation, "item_code": item_code},
                                    fields=["item_code", "item_name", "qty", "uom", "rate", "material_request", "material_request_item", "request_for_quotation"])

            for sq_item in sq_items:
                schedule_date = frappe.get_value("Request for Quotation", sq_item.request_for_quotation, "schedule_date")

                po.append("items", {
                    "item_code": sq_item.item_code,
                    "item_name": sq_item.item_name,
                    "qty": qty,  # Use selected qty from the checked row
                    "uom": sq_item.uom,
                    "rate": sq_item.rate,
                    "material_request": sq_item.material_request,
                    "material_request_item": sq_item.material_request_item,
                    "supplier_quotation": supplier_quotation,
                    "schedule_date": schedule_date,
                })

        po.insert(ignore_permissions=True)
        po.save()
        # po.submit()
        po_names.append(po.name)

    return po_names


@frappe.whitelist()
def update_remarks(supplier_quotation, item_code, remarks):
    # Update the remarks for the specific Supplier Quotation Item
    frappe.db.set_value(
        "Supplier Quotation Item",
        {"parent": supplier_quotation, "item_code": item_code},
        "custom_remark",
        remarks
    )
    frappe.db.commit()
    return "Success"

