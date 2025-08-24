import frappe
from frappe.model.mapper import get_mapped_doc

@frappe.whitelist()
def get_po_details_to_gate_entry(gate_entry_name):
    if not gate_entry_name:
        return
    gate_entry = frappe.db.sql(" select * from `tabGate Entry` where name=%s ", [gate_entry_name], as_dict=True)
    gate_entry_chid = frappe.db.sql(" select * from `tabGate Entry Details` where parent=%s ", [gate_entry_name], as_dict=True)

    parent=gate_entry_chid[0]["purchase_order"]
    if not parent:
        frappe.throw("No Purchase Order linked to this Gate Entry.")

    gate_entry_extra_purchase_items=frappe.db.sql("select * from `tabPurchase Extra Charges` where parent=%s",parent,as_dict=True)

    get_purchase_order_details=frappe.db.sql("select * from `tabPurchase Order` where name=%s",[parent],as_dict=True)

    return gate_entry, gate_entry_chid ,gate_entry_extra_purchase_items , get_purchase_order_details



# create stock entry for the deduct stock to temporary warehouse
# @frappe.whitelist()
# def create_stock_entry(doc, gate_entry, warehouse):
#     doc = frappe.json.loads(doc)
    
    
#     stock_entry = frappe.get_doc({
#         "doctype":"Stock Entry",
#         "stock_entry_type": "Material Issue",
#         "custom_gate_entry": gate_entry,
#         "items":[]
#     })
    
#     for item in doc['items']:
#         stock_entry.append("items",{
#             "item_code" : item['item_code'],
#             "item_name" : item['item_name'],
#             "qty": item['qty'],
#             "uom": item['uom'],
#             "s_warehouse": warehouse
#         })
        
#     stock_entry.insert()
#     stock_entry.submit()
    
@frappe.whitelist()
def validate_tolerance(name):
    data = frappe.db.sql(" select custom_under_tolerance, custom_over_tolerance,qty,received_qty from `tabPurchase Order Item` where name=%s ", (name), as_dict=True)
    
    return data

@frappe.whitelist()
def get_account(item_code, company):
    data = frappe.db.sql(" select custom_stock_received_but_not_billed, custom_default_inventory_account from `tabItem Default` where parent=%s and company=%s ",(item_code, company), as_dict=True)
    
    return data

@frappe.whitelist()
def validate_qty_for_blanket_order(item_code, name):
    data = frappe.db.sql(" select qty, custom_received_qty from `tabBlanket Order Item` where parent=%s and item_code=%s",(name, item_code),as_dict=True)
    
    return data


@frappe.whitelist()
def update_blanket_order(name, item_code, qty):
    data = frappe.db.sql(" select name, qty, custom_received_qty from `tabBlanket Order Item` where parent=%s and item_code=%s ",(name, item_code), as_dict=True)
    
    remaining_qty = 0
    if data[0]['custom_received_qty'] == 0.0:
        remaining_qty = float(data[0]['qty']) - float(qty)
    else:
        remaining_qty = float(data[0]['custom_received_qty']) + float(qty)
        
    frappe.db.set_value("Blanket Order Item", data[0]['name'], "custom_received_qty", remaining_qty)

@frappe.whitelist()
def get_purchase_order_item_name(item_code, purchase_order):
    data = frappe.db.sql("select name from `tabPurchase Order Item` where item_code=%s and parent=%s ",(item_code, purchase_order), as_dict=True)

    # item_name=data[0]["name"]
    # print(item_name)

    return data  



@frappe.whitelist()
def create_stock_entry_for_stock_issus(doc, warehouse):
    doc = frappe.parse_json(doc)
    
    gate_entry = doc.get("custom_gate_entry_no") or doc.get("name")

    stock_entry = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Issue",
        "custom_gate_entry": gate_entry,
        "items": []
    })

    doc_list = doc.get("gate_entry_details") or doc.get("items") or []
    shelf = frappe.db.get_value("Warehouse", warehouse, "custom_shelf") 

    for item in doc_list:
        item_code = item.get("item") or item.get("item_code")
        if not item_code:
            continue  # Skip if no item code

        stock_entry.append("items", {
            "item_code": item_code,
            "item_name": item.get("item_name"),
            "qty": item.get("qty"),
            "uom": item.get("uom"),
            "s_warehouse": warehouse,
            "expense_account": frappe.db.get_value("Item Default", {"parent": item_code}, "custom_difference_account"),
            "allow_zero_valuation_rate": 1,
            "shelf": shelf
        })

    stock_entry.insert()
    stock_entry.submit()
    
    
@frappe.whitelist()
def update_gate_entry_and_purchase_order(name, doc):
    frappe.db.set_value("Gate Entry", name, "grn_created", 1)
    
    items = frappe.parse_json(doc).get("items", [])
    
    for item in items:
        purchase_order_item = item.get("purchase_order_item")
        gate_received_qty = frappe.db.sql(" select qty from `tabGate Entry Details` where parent=%s and item=%s", (name, item.get("item_code")), as_dict=True)
        received_qty = gate_received_qty[0].get("qty") if gate_received_qty else 0.0
        if purchase_order_item:
            gate_entry_qty = frappe.db.get_value(
                "Purchase Order Item", purchase_order_item, "custom_gate_entry_qty"
            ) or 0.0

            updated_qty = gate_entry_qty - received_qty
            frappe.db.set_value(
                "Purchase Order Item", purchase_order_item, "custom_gate_entry_qty", updated_qty
            )

        

@frappe.whitelist()
def get_quality_inspection_status(source_name):
    """
    Get quality inspection status for all items in a purchase receipt
    
    Args:
        source_name (str): Purchase Receipt name
        
    Returns:
        list: List of dictionaries containing quality inspection status for each item
    """
    purchase_receipt = frappe.get_doc("Purchase Receipt", source_name)
    status_info = []
    
    for item in purchase_receipt.items:
        item_status = {
            "item_code": item.item_code,
            "qty": item.qty,
            "has_quality_inspection": bool(item.quality_inspection),
            "quality_inspection": item.quality_inspection,
            "status": None
        }
        
        if item.quality_inspection:
            qi_status = frappe.db.get_value("Quality Inspection", item.quality_inspection, "status")
            item_status["status"] = qi_status
        
        status_info.append(item_status)
    
    return status_info

@frappe.whitelist()
def custom_make_stock_entry(source_name, target_doc=None):
    """
    Custom make_stock_entry function that only includes items with accepted quality inspections
    
    This function overrides the standard ERPNext make_stock_entry function to filter items
    based on their quality inspection status. Only items with quality inspections that have
    'Accepted' status will be included in the generated bin posting (stock entry).
    
    Args:
        source_name (str): Purchase Receipt name
        target_doc: Target document (optional)
        
    Returns:
        Stock Entry document with filtered items
        
    Raises:
        frappe.ValidationError: If no items have accepted quality inspections
    """
    # First check if there are any items with accepted quality inspections that haven't been processed yet
    purchase_receipt = frappe.get_doc("Purchase Receipt", source_name)
    new_items_to_process = []
    
    for item in purchase_receipt.items:
        if item.quality_inspection:
            qi_status = frappe.db.get_value("Quality Inspection", item.quality_inspection, "status")
            if qi_status == "Accepted":
                # Check if this item has already been marked as processed
                # if hasattr(item, 'custom_bin_posting_processed') and item.custom_bin_posting_processed:
                #     frappe.log_error(f"Item {item.item_code} skipped: custom_bin_posting_processed = {item.custom_bin_posting_processed}", "Bin Posting Debug")
                #     continue
                
                # Check if this item has already been processed - using custom field
                item_processed = frappe.db.sql("""
                    SELECT sed.name 
                    FROM `tabStock Entry` se
                    JOIN `tabStock Entry Detail` sed ON se.name = sed.parent
                    WHERE se.custom_purchase_receipt_reference = %s
                    AND sed.item_code = %s
                    AND se.docstatus = 1
                    AND se.purpose = 'Material Transfer'
                """, (source_name, item.item_code), as_dict=True)
                # frappe.throw(f"item_processed: {item_processed}")
                
                if len(item_processed) == 0:
                    new_items_to_process.append(item.item_code)
                else:
                    frappe.log_error(f"Item {item.item_code} skipped: Stock Entry already exists - {len(item_processed)} entries found", "Bin Posting Debug")
            else:
                frappe.log_error(f"Item {item.item_code} skipped: Quality Inspection status = {qi_status}", "Bin Posting Debug")
        else:
            frappe.log_error(f"Item {item.item_code} skipped: No Quality Inspection linked", "Bin Posting Debug")
    
    if not new_items_to_process:
        frappe.throw("No new items found with accepted quality inspections that haven't been processed yet. All accepted items have already been moved to stock.")
    
    # Show success message with new items to process
    frappe.msgprint(
        f"Bin Posting will be created with {len(new_items_to_process)} new item(s) that have accepted Quality Inspections: {', '.join(new_items_to_process)}",
        title="New Items to Process",
        indicator="green"
    )
    
    def set_missing_values(source, target):
        target.stock_entry_type = "Material Transfer"
        target.purpose = "Material Transfer"
        target.custom_purchase_receipt_reference = source_name  # Store Purchase Receipt name in custom field
        target.set_missing_values()
        
        # Mark items as processed in the purchase receipt
        for item in target.items:
            if item.item_code:
                # Update the purchase receipt item to mark it as processed
                frappe.db.set_value(
                    "Purchase Receipt Item", 
                    {"parent": source_name, "item_code": item.item_code},
                    "custom_bin_posting_processed", 
                    1
                )

    def filter_items_by_quality_inspection(source):
        # Only include items that have quality inspection and it's accepted
        if not source.quality_inspection:
            return False
        
        # Check if quality inspection exists and is accepted
        qi_status = frappe.db.get_value("Quality Inspection", source.quality_inspection, "status")
        if qi_status != "Accepted":
            return False
        
        # Check if this item has already been marked as processed in the purchase receipt
        # if hasattr(source, 'custom_bin_posting_processed') and source.custom_bin_posting_processed:
        #     return False
        
        # Check if this specific item has been processed before - using custom field
        item_processed = frappe.db.sql("""
            SELECT sed.name 
            FROM `tabStock Entry` se
            JOIN `tabStock Entry Detail` sed ON se.name = sed.parent
            WHERE se.custom_purchase_receipt_reference = %s
            AND sed.item_code = %s
            AND se.docstatus = 1
            AND se.purpose = 'Material Transfer'
        """, (source_name, source.item_code), as_dict=True)
        
        # Only include if this item hasn't been processed before
        return len(item_processed) == 0
    
    def postprocess_item(source, target, source_parent):
        # Ensure serial/batch information is properly copied
        if source.serial_and_batch_bundle:
            target.serial_and_batch_bundle = source.serial_and_batch_bundle
            target.use_serial_batch_fields = 1
        elif source.serial_no:
            target.serial_no = source.serial_no
        elif source.batch_no:
            target.batch_no = source.batch_no

    def postprocess_doc(source, target, source_parent):
        # Set custom field after document is created
        target.custom_purchase_receipt_reference = source_name

    doclist = get_mapped_doc(
        "Purchase Receipt",
        source_name,
        {
            "Purchase Receipt": {
                "doctype": "Stock Entry",
                "postprocess": postprocess_doc,
            },
            "Purchase Receipt Item": {
                "doctype": "Stock Entry Detail",
                "field_map": {
                    "warehouse": "s_warehouse",
                    "parent": "reference_purchase_receipt",
                    "batch_no": "batch_no",
                    "serial_no": "serial_no",
                    "serial_and_batch_bundle": "serial_and_batch_bundle",
                    "use_serial_batch_fields": "use_serial_batch_fields",
                },
                "condition": filter_items_by_quality_inspection,
                "postprocess": postprocess_item,
            },
        },
        target_doc,
        set_missing_values,
    )

    return doclist

@frappe.whitelist()
def reset_bin_posting_status(purchase_receipt_name):
    """
    Reset bin posting status for all items in a purchase receipt
    This allows reprocessing of items that were already processed
    
    Args:
        purchase_receipt_name (str): Purchase Receipt name
    """
    try:
        # Reset the custom field for all items in the purchase receipt
        frappe.db.sql("""
            UPDATE `tabPurchase Receipt Item` 
            SET custom_bin_posting_processed = 0 
            WHERE parent = %s
        """, purchase_receipt_name)
        
        frappe.db.commit()
        frappe.msgprint(
            f"Bin posting status has been reset for Purchase Receipt: {purchase_receipt_name}",
            title="Status Reset",
            indicator="green"
        )
        
    except Exception as e:
        frappe.msgprint(
            f"Error resetting bin posting status: {str(e)}",
            title="Error",
            indicator="red"
        )


