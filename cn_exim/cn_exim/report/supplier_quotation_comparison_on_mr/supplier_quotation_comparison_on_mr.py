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
        {"label": "Create PO", "fieldname": "create_po", "fieldtype": "Check", "width": 35},
        {"label": "Supplier", "fieldname": "supplier", "fieldtype": "Link", "options": "Supplier", "width": 150},
        {"label": "Item Code", "fieldname": "item_code", "fieldtype": "Link", "options": "Item", "width": 150},
        {"label": "UOM", "fieldname": "uom", "fieldtype": "Link", "options": "UOM", "width": 50},
        {"label": "Quantity", "fieldname": "quantity", "fieldtype": "Float", "width": 100},
        {"label": "Stock UOM", "fieldname": "stock_uom", "fieldtype": "Link", "options": "UOM", "width": 100},
        {"label": "Currency", "fieldname": "currency", "fieldtype": "Link", "options": "Currency", "width": 50},
        {"label": "Rate", "fieldname": "price", "fieldtype": "Currency", "width": 100},
        # {"label": "Rate (Inr)", "fieldname": "price_inr", "fieldtype": "Currency", "width": 100},
        {"label": "Supplier Quotation", "fieldname": "supplier_quotation", "fieldtype": "Link", "options": "Supplier Quotation", "width": 150},
        {"label": "Valid Till", "fieldname": "valid_till", "fieldtype": "Date", "width": 100},
        {"label": "Lead Time", "fieldname": "lead_time", "fieldtype": "Data", "width": 50},
        {"label": "MOQ", "fieldname": "moq", "fieldtype": "float", "width": 50},
        {"label": "Request For Quotation", "fieldname": "request_for_quotation", "fieldtype": "Link", "options": "Request for Quotation", "width": 150},
        {"label": "Material Request", "fieldname": "material_request", "fieldtype": "Link", "options": "Material Request", "width": 150},
        {"label": "Previous Rate 1", "fieldname": "previous_price_1", "fieldtype": "Currency", "width": 100},
        {"label": "Previous Rate 2", "fieldname": "previous_price_2", "fieldtype": "Currency", "width": 100},
        {"label": "Previous Rate 3", "fieldname": "previous_price_3", "fieldtype": "Currency", "width": 100},
        # {"label": "Previous Rate (Inr)", "fieldname": "previous_price_inr", "fieldtype": "Currency", "width": 100},
        {"label": "Previous Po No 1", "fieldname": "previous_po_no_1", "fieldtype": "Link", "options": "Purchase Order", "width":100 },
        {"label": "Previous Po No 2", "fieldname": "previous_po_no_2", "fieldtype": "Link", "options": "Purchase Order", "width":100 },
        {"label": "Previous Po No 3", "fieldname": "previous_po_no_3", "fieldtype": "Link", "options": "Purchase Order", "width":100 },
        {"label": "Previous Qty 1", "fieldname": "previous_qty_1", "fieldtype": "float", "width":100 },
        {"label": "Previous Qty 2", "fieldname": "previous_qty_2", "fieldtype": "float", "width":100 },
        {"label": "Previous Qty 3", "fieldname": "previous_qty_3", "fieldtype": "float", "width":100 },
        {"label": "Previous Supplier 1", "fieldname": "previous_supplier_1", "fieldtype": "Currency", "width": 100},
        {"label": "Previous Supplier 2", "fieldname": "previous_supplier_2", "fieldtype": "Currency", "width": 100},
        {"label": "Previous Supplier 3", "fieldname": "previous_supplier_3", "fieldtype": "Currency", "width": 100},
        {"label": "Purchase Order", "fieldname": "purchase_order", "fieldtype": "Link", "options": "Purchase Order", "width": 150},
        {"label": "Remarks", "fieldname": "remarks", "fieldtype": "Data", "width": 200},
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
            (s_item.qty - IFNULL(s_item.custom_ordered_qty, 0)) AS quantity,
            s_item.stock_uom AS stock_uom,
            sq.currency AS currency,
            s_item.rate AS price,
            s_item.lead_time_days AS lead_time,
            s_item.custom_minimum_order_qty AS moq,
            -- s_item.rate * IFNULL(sq.conversion_rate, 1) AS price_inr,
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
            ), 0) AS previous_price_1,
            
            -- 2nd latest price
            IFNULL((
                SELECT poi.rate
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1 OFFSET 1
            ), 0) AS previous_price_2,
            
            IFNULL((
                SELECT poi.rate
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1 OFFSET 2
            ), 0) AS previous_price_3,

            -- IFNULL((
                -- SELECT poi.base_rate
                -- FROM `tabPurchase Order Item` poi
                -- INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                -- WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                -- ORDER BY po.transaction_date DESC, po.creation DESC
                -- LIMIT 1
            -- ), 0) AS previous_price_inr,

            IFNULL((
                SELECT po.supplier
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1
            ), '-') AS previous_supplier_1,
            
            IFNULL((
                SELECT po.supplier
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1 OFFSET 1
            ), '-') AS previous_supplier_2,
            
            IFNULL((
                SELECT po.supplier
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1 OFFSET 2
            ), '-') AS previous_supplier_3,

            IFNULL((
                SELECT po.name
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1
            ), '-') AS previous_po_no_1,
            
            IFNULL((
                SELECT po.name
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1 OFFSET 1
            ), '-') AS previous_po_no_2,
            
            IFNULL((
                SELECT po.name
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1 OFFSET 2
            ), '-') AS previous_po_no_3,

            IFNULL((
                SELECT ROUND(poi.qty, 2)
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1
            ), '-') AS previous_qty_1,
            
            IFNULL((
                SELECT ROUND(poi.qty, 2)
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1 OFFSET 1
            ), '-') AS previous_qty_2,
            
            IFNULL((
                SELECT ROUND(poi.qty, 2)
                FROM `tabPurchase Order Item` poi
                INNER JOIN `tabPurchase Order` po ON poi.parent = po.name
                WHERE poi.item_code = s_item.item_code AND po.docstatus != 2
                ORDER BY po.transaction_date DESC, po.creation DESC
                LIMIT 1 OFFSET 2
            ), '-') AS previous_qty_3,

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
    skipped_items = []

    for supplier, items_list in supplier_items_map.items():
        po = frappe.new_doc("Purchase Order")
        po.supplier = supplier

        mri_to_update = []

        for item in items_list:
            supplier_quotation = item["supplier_quotation"]
            item_code = item["item_code"]
            qty = float(item["qty"])
            
            # Get Supplier Quotation Item
            sq_items = frappe.get_all(
                "Supplier Quotation Item",
                filters={"parent": supplier_quotation, "item_code": item_code},
                fields=["item_code", "item_name", "qty", "uom", "rate", "material_request", "material_request_item", "request_for_quotation", "name"]
            )

            for sq_item in sq_items:
                if not sq_item.material_request_item or not sq_item.material_request:
                    continue

                # Step 1: Get MR Item record
                mr_data = frappe.db.get_value(
                    "Material Request Item",
                    {"parent": sq_item.material_request, "item_code": item_code},
                    ["name", "qty", "ordered_qty"],
                    as_dict=True
                )

                if not mr_data:
                    skipped_items.append(f"{item_code} not found in Material Request {sq_item.material_request}")
                    continue

                mri_name = mr_data.name
                mr_qty = float(mr_data.qty or 0)
                current_ordered_qty = float(mr_data.ordered_qty or 0)

                # Step 2: Get existing PO qty from other Purchase Orders (docstatus 0, 1)
                existing_po_qty = frappe.db.sql("""
                    SELECT SUM(qty) AS total_qty
                    FROM `tabPurchase Order Item`
                    WHERE material_request_item = %s
                    AND item_code = %s
                    AND parent IN (
                        SELECT name FROM `tabPurchase Order` WHERE docstatus IN (0, 1)
                    )
                """, (mri_name, item_code), as_dict=True)[0].total_qty or 0

                total_qty = float(existing_po_qty) + qty

                # Step 3: Validate total_qty <= Material Request qty
                if total_qty > mr_qty:
                    skipped_items.append(f"{item_code} exceeds MR quantity in MR {sq_item.material_request}")
                    continue

                # Step 4: Get schedule date from RFQ
                schedule_date = frappe.get_value("Material Request Item", sq_item.material_request_item, "schedule_date")
                custom_purchase_sub_type = frappe.get_value("Material Request", sq_item.material_request, "custom_purchase_sub_type")

                # Step 5: Append to PO
                po.append("items", {
                    "item_code": sq_item.item_code,
                    "item_name": sq_item.item_name,
                    "qty": qty,
                    "uom": sq_item.uom,
                    "rate": sq_item.rate,
                    "material_request": sq_item.material_request,
                    "material_request_item": sq_item.material_request_item,
                    "supplier_quotation": supplier_quotation,
                    "supplier_quotation_item": sq_item.name,
                    "schedule_date": schedule_date,
                    "custom_purchase_sub_type": custom_purchase_sub_type,
                })

                mri_to_update.append(mri_name)

        # Save PO if any items were added
        if po.items:
            po.insert(ignore_permissions=True)
            po_names.append(po.name)

            for mri in mri_to_update:
                frappe.db.set_value("Material Request Item", mri, {
                    "custom_po_created": 1
                })

    # Show skipped items if any
    if skipped_items:
        frappe.throw(f"The following items could not be added to Purchase Orders:<br><b>{'<br>'.join(skipped_items)}</b>")

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


