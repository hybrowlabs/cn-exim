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
        {"label": "Rate", "fieldname": "price", "fieldtype": "Currency", "width": 100},
        {"label": "Rate (Inr)", "fieldname": "price_inr", "fieldtype": "Currency", "width": 100},
        {"label": "Previous Rate", "fieldname": "previous_price", "fieldtype": "Currency", "width": 100},
        {"label": "Previous Rate (Inr)", "fieldname": "previous_price_inr", "fieldtype": "Currency", "width": 100},
        {"label": "Previous Po No", "fieldname": "previous_po_no", "fieldtype": "Link", "options": "Purchase Order", "width":100 },
        {"label": "Previous Qty", "fieldname": "previous_qty", "fieldtype": "float", "width":100 },
        {"label": "Previous Supplier", "fieldname": "previous_supplier", "fieldtype": "Currency", "width": 100},
        {"label": "Supplier Quotation", "fieldname": "supplier_quotation", "fieldtype": "Link", "options": "Supplier Quotation", "width": 150},
        {"label": "Valid Till", "fieldname": "valid_till", "fieldtype": "Date", "width": 100},
        {"label": "Lead Time", "fieldname": "lead_time", "fieldtype": "Data", "width": 100},
        {"label": "MOQ", "fieldname": "moq", "fieldtype": "float", "with": 100},
        {"label": "Request For Quotation", "fieldname": "request_for_quotation", "fieldtype": "Link", "options": "Request for Quotation", "width": 150},
        {"label": "Material Request", "fieldname": "material_request", "fieldtype": "Link", "options": "Material Request", "width": 150},
        {"label": "Remarks", "fieldname": "remarks", "fieldtype": "Data", "width": 200},
        {"label": "Purchase Order", "fieldname": "purchase_order", "fieldtype": "Link", "options": "Purchase Order", "width": 150},
    ]
    
    
def get_data(filters):
    conditions = []
    values = {}

    if filters.get("material_request"):
        mr_list = frappe.parse_json(filters.get("material_request"))
        if isinstance(mr_list, str):
            mr_list = [mr.strip() for mr in mr_list.split(",")]
        conditions.append("s_item.material_request IN %(material_request)s")
        values["material_request"] = mr_list

    if filters.get("company"):
        conditions.append("sq.company = %(company)s")
        values["company"] = filters.get("company")

    if filters.get("from_date"):
        conditions.append("sq.transaction_date >= %(from_date)s")
        values["from_date"] = filters.get("from_date")

    if filters.get("to_date"):
        conditions.append("sq.transaction_date <= %(to_date)s")
        values["to_date"] = filters.get("to_date")

    if filters.get("item"):
        item_list = frappe.parse_json(filters.get("item"))
        if isinstance(item_list, str):
            item_list = [item.strip() for item in item_list.split(",")]
        conditions.append("s_item.item_code IN %(item)s")
        values["item"] = item_list

    if filters.get("supplier"):
        sp_list = frappe.parse_json(filters.get("supplier"))
        if isinstance(sp_list, str):
            sp_list = [sp.strip() for sp in sp_list.split("-")]
        conditions.append("sq.supplier IN %(supplier)s")
        values["supplier"] = sp_list

    if filters.get("supplier_quotation"):
        sq_list = frappe.parse_json(filters.get("supplier_quotation"))
        if isinstance(sq_list, str):
            sq_list = [sq.strip() for sq in sq_list.split("-")]
        conditions.append("sq.name in %(supplier_quotation)s")
        values["supplier_quotation"] = sq_list

    if filters.get("request_for_quotation"):
        rfq_list = frappe.parse_json(filters.get("request_for_quotation"))
        if isinstance(rfq_list, str):
            rfq_list = [rfq.strip() for rfq in rfq_list.split("-")]
        conditions.append("s_item.request_for_quotation in %(request_for_quotation)s")
        values["request_for_quotation"] = rfq_list
        
    if filters.get("po_created"):
        conditions.append("mri.custom_po_created = 1")
    else:
        conditions.append("(mri.custom_po_created = 0 OR mri.custom_po_created IS NULL)")

    if not filters.get("include_expired"):
        conditions.append("sq.valid_till >= CURDATE()")

    condition_str = " AND ".join(conditions)
    if condition_str:
        condition_str = " AND " + condition_str

    query = f"""
        SELECT
            sq.supplier AS supplier,
            s_item.item_code AS item_code,
            s_item.uom AS uom,
            s_item.qty AS quantity,
            s_item.stock_uom AS stock_uom,
            sq.currency AS currency,
            s_item.rate AS price,
            s_item.lead_time_days AS lead_time,
            s_item.custom_minimum_order_qty AS moq,
            s_item.rate * IFNULL(sq.conversion_rate, 1) AS price_inr,
            sq.name AS supplier_quotation,
            sq.valid_till AS valid_till,
            s_item.request_for_quotation AS request_for_quotation,
            s_item.material_request AS material_request,
            s_item.custom_remark AS remarks,

            IFNULL((
                SELECT poi.rate
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1
            ), 0) AS previous_price,

            IFNULL((
                SELECT poi.base_rate
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1
            ), 0) AS previous_price_inr,

            IFNULL((
                SELECT po.supplier
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1
            ), '-') AS previous_supplier,

            IFNULL((
                SELECT po.name
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1
            ), '-') AS previous_po_no,

            IFNULL((
                SELECT poi.qty
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1
            ), '-') AS previous_qty,

            IFNULL((
                SELECT po.name
                FROM `tabPurchase Order` po
                INNER JOIN `tabPurchase Order Item` poi ON po.name = poi.parent
                WHERE poi.material_request = s_item.material_request
                AND poi.item_code = s_item.item_code
                AND po.docstatus != 2
                LIMIT 1
            ), '-') AS purchase_order

        FROM
            `tabSupplier Quotation` sq
        INNER JOIN
            `tabSupplier Quotation Item` s_item ON s_item.parent = sq.name
        INNER JOIN
            `tabMaterial Request Item` mri ON s_item.material_request_item = mri.name
        WHERE
            sq.docstatus = 1
            {condition_str}
        ORDER BY
            s_item.material_request,
            s_item.item_code
    """

    data = frappe.db.sql(query, values, as_dict=True)

    # 🔍 Add is_lowest field
    min_price_map = {}
    for row in data:
        key = (row["material_request"], row["item_code"])
        if key not in min_price_map or row["price"] < min_price_map[key]:
            min_price_map[key] = row["price"]

    for row in data:
        key = (row["material_request"], row["item_code"])
        row["is_lowest"] = 1 if row["price"] == min_price_map[key] else 0

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
    duplicate_items = []

    for supplier, items_list in supplier_items_map.items():
        po = frappe.new_doc("Purchase Order")
        po.supplier = supplier

        mri_to_update = []
        for item in items_list:
            supplier_quotation = item["supplier_quotation"]
            item_code = item["item_code"]
            qty = item["qty"]

            # Get Supplier Quotation Item
            sq_items = frappe.get_all(
                "Supplier Quotation Item",
                filters={"parent": supplier_quotation, "item_code": item_code},
                fields=["item_code", "item_name", "qty", "uom", "rate", "material_request", "material_request_item", "request_for_quotation"]
            )

            for sq_item in sq_items:
                # Check if this item with this material_request_item is already in another PO (Draft or Submitted)
                existing_po_items = frappe.get_all(
                    "Purchase Order Item",
                    filters={
                        "material_request_item": sq_item.material_request_item,
                        "item_code": sq_item.item_code
                    },
                    fields=["name", "parent"]
                )
                
                is_duplicate = False
                for po_item in existing_po_items:
                    po_docstatus = frappe.get_value("Purchase Order", po_item.parent, "docstatus")
                    if po_docstatus in [0, 1]:  # Draft or Submitted
                        is_duplicate = True
                        break

                if is_duplicate:
                    duplicate_items.append(f"{sq_item.item_code} - {existing_po_items[0].parent}")
                    continue  # Skip this item
                
                # Get schedule date from RFQ
                schedule_date = frappe.get_value("Request for Quotation", sq_item.request_for_quotation, "schedule_date")
                
                # Append item to PO
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
                
                mri_to_update.append(sq_item.material_request_item)

        # If at least one item is added, save the PO
        if po.items:
            po.insert(ignore_permissions=True)
            po.save()
            # po.submit()
            po_names.append(po.name)
            
            for mri in mri_to_update:
                frappe.db.set_value("Material Request Item", mri, {
                    "custom_po_created": 1
                })

    if duplicate_items:
        frappe.throw(f"The following items already have Purchase Orders: <br><b>{'<br>'.join(duplicate_items)}</b>")

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


