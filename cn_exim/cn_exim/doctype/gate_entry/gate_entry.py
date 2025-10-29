# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe import _
from frappe.utils import flt



class GateEntry(Document):
    def validate(self):
        """Validate document before save"""
        self.validate_bill_number_uniqueness()
    
    def validate_bill_number_uniqueness(self):
        """Validate that bill_number is unique across all Gate Entry documents"""
        if self.bill_number:
            # Check for existing Gate Entry with same bill_number
            existing_gate_entry = frappe.db.exists("Gate Entry", {
                "bill_number": self.bill_number,
                "name": ("!=", self.name),  # Exclude current document
                "docstatus": ("!=", 2)  # Exclude cancelled documents
            })
            
            if existing_gate_entry:
                frappe.throw(_("Bill Number '{0}' is already used in Gate Entry '{1}'. Please use a unique bill number.").format(
                    self.bill_number, existing_gate_entry
                ))
    
    def on_submit(self):
        # temp_wh = frappe.db.get_value("Company", self.company, "custom_default_temporary_warehouse")

        # if not temp_wh:
        #     frappe.throw("Temporary Warehouse not found for this Company!")

        # create_stock_entry_for_stock_received(self.as_dict(), temp_wh)

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
def get_warehouse_details_with_shelf(warehouse_name):
    """Get warehouse details including shelf and rejected warehouse information"""
    if not warehouse_name:
        return {}
    
    warehouse_data = frappe.db.get_value(
        "Warehouse", 
        warehouse_name, 
        ["custom_shelf", "custom_rejected_warehouse"], 
        as_dict=True
    )
    
    result = {
        "warehouse": warehouse_name,
        "shelf": warehouse_data.get("custom_shelf", "") if warehouse_data else "",
        "rejected_warehouse": warehouse_data.get("custom_rejected_warehouse", "") if warehouse_data else "",
        "rejected_shelf": ""
    }
    
    # Get rejected shelf if rejected warehouse exists
    if result["rejected_warehouse"]:
        rejected_shelf = frappe.db.get_value(
            "Warehouse", 
            result["rejected_warehouse"], 
            "custom_shelf"
        )
        result["rejected_shelf"] = rejected_shelf or ""
    
    return result

@frappe.whitelist()
def create_purchase_receipt_from_gate_entry(gate_entry_name):
    """Create Purchase Receipt from Gate Entry with all warehouse and tax details"""
    try:
        # Get Gate Entry document
        gate_entry = frappe.get_doc("Gate Entry", gate_entry_name)
        if not gate_entry:
            frappe.throw(f"Gate Entry {gate_entry_name} not found")
        
        # Check if Purchase Receipt already exists
        existing_pr = frappe.db.get_value(
            "Purchase Receipt",
            {"custom_gate_entry_no": gate_entry_name, "docstatus": ["!=", 2]},
            "name"
        )
        
        if existing_pr:
            frappe.throw(f"Purchase Receipt <a href='/app/purchase-receipt/{existing_pr}' target='_blank'><b>{existing_pr}</b></a> already exists for this Gate Entry.")
        
        # Initialize data structures
        purchase_item_list = []
        purchase_tax_list = []
        purchase_extra_charges_list = []
        purchase_order_numbers = set()
        
        # Process Gate Entry items
        for item in gate_entry.gate_entry_details:
            purchase_order_numbers.add(item.purchase_order)
            
            # Get PO item details
            po_item_details = frappe.db.get_value(
                "Purchase Order Item",
                {"parent": item.purchase_order, "item_code": item.item},
                ["name", "warehouse", "parent","rate"],
                as_dict=True
            )
            
            if not po_item_details:
                frappe.throw(f"Purchase Order Item not found for {item.item}")
            
            # Get warehouse details with shelf and rejected warehouse
            warehouse_details = get_warehouse_details_with_shelf(po_item_details.warehouse)
            
            # Get quality warehouse and shelf from warehouse master
            quality_warehouse = frappe.db.get_value("Warehouse", po_item_details.warehouse, "custom_quality_warehouse")
            quality_shelf = ""
            if quality_warehouse:
                quality_shelf = frappe.db.get_value("Warehouse", quality_warehouse, "custom_shelf")
            
            # Get item details for serial/batch settings
            item_details = frappe.db.get_value("Item", item.item, ["has_serial_no", "has_batch_no"], as_dict=True)
            
            # Determine use_serial_batch_fields based on item settings
            use_serial_batch_fields = 0
            if item_details:
                # If item has serial or batch tracking, enable serial batch fields
                if item_details.has_serial_no or item_details.has_batch_no:
                    use_serial_batch_fields = 1
            
            # Create item data
            item_data = {
                "item_code": item.item,
                "item_name": item.item_name,
                "uom": item.uom,
                "rate": po_item_details.rate,
                "amount": item.amount,
                "base_rate": item.rate_inr,
                "base_amount": item.amount_inr,
                "qty": item.qty,
                "purchase_order_item": po_item_details.name,
                "warehouse": quality_warehouse or po_item_details.warehouse,
                "shelf": quality_shelf or warehouse_details.get("shelf", ""),
                # "rejected_warehouse": warehouse_details.get("rejected_warehouse", ""),
                # "rejected_shelf": warehouse_details.get("rejected_shelf", ""),
                "purchase_order": po_item_details.parent,
                "project": item.project or "",
                "use_serial_batch_fields": use_serial_batch_fields,
            }
            
            purchase_item_list.append(item_data)
        
        # Get tax and charges for all purchase orders
        for po_name in purchase_order_numbers:
            tax_data = get_tax_and_charges(po_name)
            
            # Add tax table
            for tax in tax_data.get("tax_table", []):
                purchase_tax_list.append({
                    "charge_type": tax.charge_type,
                    "account_head": tax.account_head,
                    "rate": tax.rate,
                    "amount": tax.tax_amount,
                    "total": tax.total,
                    "description": tax.description,
                    "base_amount": tax.base_amount,
                    "segment": tax.segment,
                    "plant": tax.plant,
                    "account_currency": tax.account_currency,
                    "tax_amount": tax.tax_amount,
                    "tax_amount_after_discount_amount": tax.tax_amount_after_discount_amount,
                    "base_tax_amount": tax.base_tax_amount,
                    "base_tax_amount_after_discount_amount": tax.base_tax_amount_after_discount_amount,
                })
            
            # Add extra charges
            for charge in tax_data.get("extra_charge", []):
                purchase_extra_charges_list.append({
                    "supplier": charge.supplier,
                    "account_head": charge.account_head,
                    "reference_item_code": charge.reference_item_code,
                    "amount": charge.amount,
                    "item_code": charge.item_code,
                    "description": charge.description
                })
        
        # Get update PO details for e-waybill
        update_po_data = {}
        if gate_entry.e_waybill_no:
            update_po_details = get_update_po_details(gate_entry.e_waybill_no)
            if update_po_details:
                update_po_data = update_po_details[0] or {}
        
        # Create Purchase Receipt data
        purchase_receipt_data = {
            "doctype": "Purchase Receipt",
            "company": gate_entry.company,
            "supplier": gate_entry.supplier,
            "supplier_name": gate_entry.supplier_name,
            "custom_gate_entry_no": gate_entry.name,
            "custom_supplier_document_no": gate_entry.bill_number,
            "custom_supplier_document_date": gate_entry.bill_date,
            "items": purchase_item_list,
            "taxes": purchase_tax_list,
            "currency": gate_entry.currency,
            "conversion_rate": gate_entry.currency_rate or 1,
            "custom_purchase_extra_charge": purchase_extra_charges_list,
            "custom_bcd_amount": update_po_data.get('bcd_amount', 0),
            "custom_pickup_request": update_po_data.get('pickup_request', ""),
            "custom_freight_amount": update_po_data.get('freight_amount', 0),
            "custom_hcs_amount": update_po_data.get('hcs_amount', 0),
            "custom_exworks": update_po_data.get('ex_works', 0),
            "custom_other_charges": update_po_data.get('other_charges', 0),
            "custom_rfq_no": update_po_data.get('rfq_no', ""),
            "custom_sws_amount": update_po_data.get('sws_amount', 0),
            "custom_insurance_amount": update_po_data.get('insurance_amount', 0),
            "custom_master_number": update_po_data.get('master_number', ""),
            "custom_igst_amount": update_po_data.get('igst_amount', 0),
            "custom_total_duty": update_po_data.get('total_duty', 0),
            "custom_insurance_": update_po_data.get('insurance_', 0),
            "CHA Agenncy Charges": update_po_data.get('cha_agenncy_charges', 0),
            "custom_cha_clearing_charges": update_po_data.get('cha_clearing_charges', 0),
            "custom_local_transporter_charges": update_po_data.get('local_transporter_charges', 0),
            "custom_local_freight_vendor_charges": update_po_data.get('local_freight_vendor_charges', 0),
            "custom_freight_and_forwarding_vendor_charges": update_po_data.get('freight_and_forwarding_vendor_charges', 0),
            "custom_update_po_number": update_po_data.get('name', ""),
            "custom_total_category_charges": update_po_data.get('total_category_charges', 0),
            "custom_house_number": update_po_data.get('house_number', ""),
        }
        
        # Add pre-alert request if e-waybill exists
        if gate_entry.e_waybill_no:
            purchase_receipt_data["custom_pre_alert_request"] = update_po_data.get('pre_alert_check_list', "")
        
        # Create and insert Purchase Receipt
        purchase_receipt = frappe.get_doc(purchase_receipt_data)
        purchase_receipt.insert()
        
        return {
            "success": True,
            "purchase_receipt_name": purchase_receipt.name,
            "message": f"Purchase Receipt {purchase_receipt.name} created successfully"
        }

    except Exception as e:
        frappe.log_error(f"Failed to create Purchase Receipt from Gate Entry {gate_entry_name}: {str(e)}")
        frappe.throw(f"Failed to create Purchase Receipt: {str(e)}")

@frappe.whitelist()
def check_grn_exists(gate_entry_name):
    """Check if Purchase Receipt (GRN) already exists for this Gate Entry"""

    grn_exists = frappe.db.exists("Purchase Receipt", {
        "custom_gate_entry_no": gate_entry_name,
        "docstatus": ["!=", 2]
    })

    return bool(grn_exists)


# @frappe.whitelist()
# def create_stock_entry_for_stock_received(doc, warehouse):
#     if isinstance(doc, str):
#         doc = frappe.parse_json(doc)
#     elif not isinstance(doc, dict) and hasattr(doc, "as_dict"):
#         doc = doc.as_dict()

#     stock_entry = frappe.get_doc({
#         "doctype": "Stock Entry",
#         "stock_entry_type": "Material Receipt",
#         "custom_gate_entry": doc["name"],
#         "items": []
#     })

#     for item in doc.get("gate_entry_details", []):
#         account = frappe.db.get_value("Item Default", {"parent": item["item"]}, "custom_difference_account")
#         # if not account:
#         #     frappe.throw(f"Custom Difference Account not set in Item Default for Item: {item['item']}")

#         po_item_name = item.get("po_item")
#         if not po_item_name:
#             frappe.throw(f"PO Item reference missing in Gate Entry for Item: {item['item']}")

#         po_warehouse = frappe.db.get_value("Purchase Order Item", po_item_name, "warehouse")
#         if not po_warehouse:
#             frappe.throw(f"Warehouse not set for PO Item: {po_item_name}")

#         inspection_required = frappe.db.get_value("Item", item["item"], "inspection_required_before_purchase")
#         target_warehouse = po_warehouse

#         if inspection_required:
#             quality_warehouse = frappe.db.get_value("Warehouse", po_warehouse, "custom_quality_warehouse")
#             if not quality_warehouse:
#                 frappe.throw(f"Quality Warehouse not set in Warehouse: {po_warehouse}")
#             shelf = frappe.db.get_value("Warehouse", quality_warehouse, "custom_shelf")
#             if not shelf:
#                 frappe.throw(f"Shelf not set in Quality Warehouse: {quality_warehouse}")
#             target_warehouse = quality_warehouse
#         else:
#             shelf = frappe.db.get_value("Warehouse", po_warehouse, "custom_shelf")
#             if not shelf:
#                 frappe.throw(f"Shelf not set in Warehouse: {po_warehouse}")

#         stock_entry.append("items", {
#             "item_code": item["item"],
#             "item_name": item["item_name"],
#             "qty": item["qty"],
#             "uom": item["uom"],
#             "t_warehouse": target_warehouse,
#             "expense_account": account,
#             "allow_zero_valuation_rate": 1,
#             "to_shelf": shelf,
#         })

#     stock_entry.insert()
#     stock_entry.submit()
    
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
        
        po_item_details = frappe.db.sql("""
            SELECT * FROM `tabPurchase Order Item` 
            WHERE parent = %s AND (qty - received_qty - IFNULL(custom_gate_entry_qty, 0)) > 0
        """, (po_details.get("name")), as_dict=True)

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

@frappe.whitelist()
def get_valid_purchase_orders(supplier, company):
    po_names = frappe.db.sql("""
        SELECT po.name
        FROM `tabPurchase Order` po
        JOIN `tabPurchase Order Item` poi ON poi.parent = po.name
        WHERE po.docstatus = 1
        AND po.status NOT IN ('Closed', 'On Hold')
        AND po.supplier = %s
        AND po.company = %s
        AND (poi.qty - IFNULL(poi.received_qty, 0) - IFNULL(poi.custom_gate_entry_qty, 0)) > 0
        GROUP BY po.name
    """, (supplier, company), as_dict=True)

    return [po.name for po in po_names]

@frappe.whitelist()
def create_quality_inspection_from_gate_entry(gate_entry_name):
    created_list = []
    already_exists = []

    gate_entry = frappe.get_doc("Gate Entry", gate_entry_name)
    if not gate_entry:
        frappe.throw(_("Gate Entry {0} not found.").format(gate_entry_name))

    # Get settings for items needing inspection
    item_codes = list({row.item for row in gate_entry.gate_entry_details if row.item})
    if not item_codes:
        return []

    item_settings = frappe.get_all(
        "Item",
        filters={"name": ["in", item_codes], "inspection_required_before_purchase": 1},
        fields=["name"]
    )
    required_items = set([row["name"] for row in item_settings])

    for row in gate_entry.gate_entry_details:
        if row.item and row.item in required_items:
            # Check for existing QI on these two fields
            existing = frappe.db.get_value(
                "Quality Inspection",
                {
                    "custom_gate_entry": gate_entry.name,
                    "custom_gate_entry_child": row.name,
                    "item_code": row.item,
                    # Optionally: "docstatus": ["<", 2]  # Ignore cancelled
                },
                "name"
            )
            if existing:
                already_exists.append({
                    "item": row.item,
                    "inspection_name": existing
                })
                continue

            # Otherwise, create new
            qi_doc = frappe.new_doc("Quality Inspection")
            qi_doc.status = "Under Inspection"
            qi_doc.inspection_type = "Incoming"
            qi_doc.reference_type = "Gate Entry"
            qi_doc.reference_name = gate_entry.name
            qi_doc.custom_gate_entry = gate_entry.name
            qi_doc.custom_gate_entry_child = row.name
            qi_doc.item_code = row.item
            qi_doc.inspected_by = frappe.session.user
            qi_doc.sample_size = 0
            qi_doc.custom_rejected_quantity = row.qty

            qi_doc.save(ignore_permissions=True)
            frappe.db.commit()
            created_list.append({
                "item": row.item,
                "inspection_name": qi_doc.name
            })

    # Return both lists for UI message
    return {
        "created": created_list,
        "existing": already_exists
    }