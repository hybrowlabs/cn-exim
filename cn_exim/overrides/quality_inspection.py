import frappe
from datetime import datetime
from dateutil.relativedelta import relativedelta

def before_save(doc, method):
    # Auto-calculate expiry date and validate quantities
    calculate_expiry_date(doc)
    validate_rejected_quantity(doc)

def calculate_expiry_date(doc):
    # Auto-calculate expiry date if manufacturing date and months provided
    if (doc.custom_manufacturing_date and 
        doc.custom_expiry_in_months and 
        not doc.custom_expiry_date):
        
        manufacturing_date = datetime.strptime(str(doc.custom_manufacturing_date), '%Y-%m-%d')
        expiry_date = manufacturing_date + relativedelta(months=doc.custom_expiry_in_months)
        doc.custom_expiry_date = expiry_date.strftime('%Y-%m-%d')

def validate_rejected_quantity(doc):
    # Skip validation for Gate Entry and if quantities already set
    if (doc.reference_type != "Gate Entry" and 
        (not doc.custom_accepted_quantity or not doc.custom_rejected_quantity)):
        
        from cn_exim.config.py.quality_inspection import get_qty_from_purchase_receipt
        
        # Get original quantity from purchase receipt
        purchase_receipt_qty = get_qty_from_purchase_receipt(doc.reference_name, doc.item_code)
        
        if purchase_receipt_qty and len(purchase_receipt_qty) > 0:
            pr_qty = purchase_receipt_qty[0].get('qty', 0)
            
            # Validate rejected quantity doesn't exceed purchase receipt quantity
            if doc.custom_rejected_quantity and doc.custom_rejected_quantity > pr_qty:
                frappe.throw("Rejected quantity cannot be greater than Purchase Receipt quantity.")
                doc.custom_rejected_quantity = 0

def after_insert(doc, method):
    # Auto-populate warehouse and batch info from Purchase Receipt
    if doc.reference_type == "Purchase Receipt" and doc.reference_name:
        purchase_receipt = frappe.get_doc("Purchase Receipt", doc.reference_name)
        
        if doc.child_row_reference:
            # Find specific item from child row reference
            for item in purchase_receipt.items:
                if item.name == doc.child_row_reference:
                    # Copy warehouse and shelf info
                    if item.warehouse:
                        doc.custom_quality_warehouse = item.warehouse
                    
                    if hasattr(item, 'shelf') and item.shelf:
                        doc.custom_quality_shelf = item.shelf
                    
                    # Copy serial/batch bundle and extract batch number
                    if hasattr(item, 'serial_and_batch_bundle') and item.serial_and_batch_bundle:
                        doc.custom_serial_and_batch_bundle = item.serial_and_batch_bundle
                        
                        try:
                            bundle_doc = frappe.get_doc("Serial and Batch Bundle", item.serial_and_batch_bundle)
                            if bundle_doc.entries and bundle_doc.entries[0].batch_no:
                                doc.batch_no = bundle_doc.entries[0].batch_no
                        except:
                            pass
                    
                    doc.save()
                    break
        else:
            # Fallback to first item if no child row reference
            if purchase_receipt.items:
                first_item = purchase_receipt.items[0]
                if first_item.warehouse:
                    doc.custom_quality_warehouse = first_item.warehouse
                
                if hasattr(first_item, 'shelf') and first_item.shelf:
                    doc.custom_quality_shelf = first_item.shelf
                
                doc.save()
            elif purchase_receipt.set_warehouse:
                # Final fallback to main warehouse
                doc.custom_quality_warehouse = purchase_receipt.set_warehouse
                doc.save()

def on_submit(doc, method):
    # Validate status before submission
    if doc.status == "Under Inspection":
        frappe.throw("Status must be 'Accepted' or 'Rejected' before submitting.")
    
    # Handle Purchase Receipt quality inspection workflow
    if doc.reference_type == "Purchase Receipt" and doc.inspection_type == "Incoming":
        if not doc.child_row_reference:
            frappe.throw("Child Row Reference is required for Purchase Receipt type Quality Inspection.")
        
        # Validate total quantities
        total_qty = (doc.custom_accepted_quantity or 0) + (doc.custom_rejected_quantity or 0)
        if total_qty <= 0:
            frappe.throw("Total quantity (Accepted + Rejected) must be greater than 0.")
        
        # Create stock movement and update batch info
        create_stock_entry_for_quality_inspection(doc)
        update_batch_expiry_date(doc)

def create_stock_entry_for_quality_inspection(doc):
    # Get purchase receipt and order item details
    purchase_receipt_item = frappe.get_doc("Purchase Receipt Item", doc.child_row_reference)
    
    purchase_order_item = None
    if purchase_receipt_item.purchase_order_item:
        purchase_order_item = frappe.get_doc("Purchase Order Item", purchase_receipt_item.purchase_order_item)
    
    # Create stock entry for material movement
    stock_entry = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Transfer",
        "company": doc.company,
        "posting_date": frappe.utils.today(),
        "posting_time": frappe.utils.nowtime(),
        "reference_doctype": "Quality Inspection",
        "reference_docname": doc.name,
        "custom_quality_inspection": doc.name,
        "items": []
    })
    
    # Check if item uses serial/batch tracking
    item_details = frappe.db.get_value("Item", doc.item_code, ["has_serial_no", "has_batch_no"], as_dict=True)
    use_serial_batch_fields = (item_details.has_serial_no or item_details.has_batch_no) if item_details else False
    
    # Add accepted quantity to stock entry
    if doc.custom_accepted_quantity and doc.custom_accepted_quantity > 0:
        if purchase_order_item and purchase_order_item.warehouse:
            target_shelf = frappe.db.get_value("Warehouse", purchase_order_item.warehouse, "custom_shelf")
            
            stock_entry_item = {
                "item_code": doc.item_code,
                "item_name": doc.item_name,
                "qty": doc.custom_accepted_quantity,
                "uom": purchase_receipt_item.uom,
                "s_warehouse": doc.custom_quality_warehouse,
                "shelf": doc.custom_quality_shelf,
                "t_warehouse": purchase_order_item.warehouse,
                "to_shelf": target_shelf,
                "allow_zero_valuation_rate": 1,
                "use_serial_batch_fields": use_serial_batch_fields
            }
            
            # Add serial/batch tracking info (priority order)
            if doc.custom_serial_and_batch_bundle:
                stock_entry_item["serial_and_batch_bundle"] = doc.custom_serial_and_batch_bundle
            elif doc.batch_no:
                stock_entry_item["batch_no"] = doc.batch_no
            elif purchase_receipt_item.serial_and_batch_bundle:
                stock_entry_item["serial_and_batch_bundle"] = purchase_receipt_item.serial_and_batch_bundle
            elif purchase_receipt_item.batch_no:
                stock_entry_item["batch_no"] = purchase_receipt_item.batch_no
            elif purchase_receipt_item.serial_no:
                stock_entry_item["serial_no"] = purchase_receipt_item.serial_no
            
            stock_entry.append("items", stock_entry_item)
    
    # Add rejected quantity to stock entry
    if doc.custom_rejected_quantity and doc.custom_rejected_quantity > 0:
        if purchase_order_item and purchase_order_item.warehouse:
            rejected_warehouse = frappe.db.get_value("Warehouse", purchase_order_item.warehouse, "custom_rejected_warehouse")
            if rejected_warehouse:
                rejected_shelf = frappe.db.get_value("Warehouse", rejected_warehouse, "custom_shelf")
                
                rejected_stock_entry_item = {
                    "item_code": doc.item_code,
                    "item_name": doc.item_name,
                    "qty": doc.custom_rejected_quantity,
                    "uom": purchase_receipt_item.uom,
                    "s_warehouse": doc.custom_quality_warehouse,
                    "shelf": doc.custom_quality_shelf,
                    "t_warehouse": rejected_warehouse,
                    "to_shelf": rejected_shelf,
                    "allow_zero_valuation_rate": 1,
                    "use_serial_batch_fields": use_serial_batch_fields
                }
                
                # Add serial/batch tracking info (same priority as accepted)
                if doc.custom_serial_and_batch_bundle:
                    rejected_stock_entry_item["serial_and_batch_bundle"] = doc.custom_serial_and_batch_bundle
                elif doc.batch_no:
                    rejected_stock_entry_item["batch_no"] = doc.batch_no
                elif purchase_receipt_item.serial_and_batch_bundle:
                    rejected_stock_entry_item["serial_and_batch_bundle"] = purchase_receipt_item.serial_and_batch_bundle
                elif purchase_receipt_item.batch_no:
                    rejected_stock_entry_item["batch_no"] = purchase_receipt_item.batch_no
                elif purchase_receipt_item.serial_no:
                    rejected_stock_entry_item["serial_no"] = purchase_receipt_item.serial_no
                
                stock_entry.append("items", rejected_stock_entry_item)
            else:
                warehouse_link = f'<a href="/app/warehouse/{purchase_order_item.warehouse}" target="_blank">{purchase_order_item.warehouse}</a>'
                frappe.throw(f"Rejected Warehouse not set for warehouse {warehouse_link}. Please set the Rejected Warehouse in the warehouse master.")
        else:
            frappe.throw("Purchase Order Item warehouse not found. Cannot determine rejected warehouse.")
    
    # Submit stock entry if items exist
    if stock_entry.items:
        stock_entry.insert()
        stock_entry.submit()
        
        # Update purchase receipt with new quantities and warehouses
        update_purchase_receipt_item(doc, purchase_order_item)
        
        frappe.msgprint(
            f"Stock Entry {stock_entry.name} has been created and submitted successfully.",
            title="Stock Entry Created",
            indicator='green'
        )
        
        # Store stock entry reference in quality inspection
        frappe.db.set_value("Quality Inspection", doc.name, "custom_stock_entry", stock_entry.name)
    else:
        frappe.throw("Please enter Accepted Quantity or Rejected Quantity before submitting Quality Inspection. No quantities found to transfer.")

def update_batch_expiry_date(doc):
    if not doc.batch_no or not doc.custom_expiry_date:
        return
    
    if not frappe.db.exists("Batch", doc.batch_no):
        return
    
    frappe.db.set_value("Batch", doc.batch_no, "expiry_date", doc.custom_expiry_date)
    
    frappe.msgprint(
        f"Batch {doc.batch_no} expiry date has been updated to {doc.custom_expiry_date}.",
        title="Batch Expiry Date Updated",
        indicator='green'
    )

def update_purchase_receipt_item(doc, purchase_order_item):
    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "qty", doc.custom_accepted_quantity or 0)
    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_qty", doc.custom_rejected_quantity or 0)
    
    if doc.custom_accepted_quantity and doc.custom_accepted_quantity > 0:
        if purchase_order_item and purchase_order_item.warehouse:
            frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "warehouse", purchase_order_item.warehouse)
            target_shelf = frappe.db.get_value("Warehouse", purchase_order_item.warehouse, "custom_shelf")
            if target_shelf:
                frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "shelf", target_shelf)
    
    if doc.custom_rejected_quantity and doc.custom_rejected_quantity > 0:
        if purchase_order_item and purchase_order_item.warehouse:
            rejected_warehouse = frappe.db.get_value("Warehouse", purchase_order_item.warehouse, "custom_rejected_warehouse")
            if rejected_warehouse:
                frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_warehouse", rejected_warehouse)
                rejected_shelf = frappe.db.get_value("Warehouse", rejected_warehouse, "custom_shelf")
                if rejected_shelf:
                    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_shelf", rejected_shelf)

def on_cancel(doc, method):
    if doc.reference_type == "Purchase Receipt" and doc.inspection_type == "Incoming":
        revert_purchase_receipt_item_changes(doc)

def revert_purchase_receipt_item_changes(doc):
    if not doc.child_row_reference:
        return
        
    purchase_receipt_item = frappe.get_doc("Purchase Receipt Item", doc.child_row_reference)
    
    original_qty = purchase_receipt_item.qty + (doc.custom_accepted_quantity or 0) + (doc.custom_rejected_quantity or 0)
    
    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "qty", original_qty)
    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_qty", 0)
    
    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "warehouse", doc.custom_quality_warehouse)
    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "shelf", doc.custom_quality_shelf)
    
    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_warehouse", "")
    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_shelf", "")
    
    frappe.msgprint(
        f"Purchase Receipt Item {doc.child_row_reference} has been reverted to original state.",
        title="Purchase Receipt Item Reverted",
        indicator='orange'
    )

@frappe.whitelist()
def fetch_serial_batch_bundle_data(child_row_reference, reference_name):
    purchase_receipt_item = frappe.get_doc("Purchase Receipt Item", child_row_reference)
    
    if not purchase_receipt_item:
        return {"success": False, "message": "Purchase Receipt Item not found"}
    
    if not purchase_receipt_item.serial_and_batch_bundle:
        return {"success": False, "message": "No Serial and Batch Bundle found for this item"}
    
    bundle_doc = frappe.get_doc("Serial and Batch Bundle", purchase_receipt_item.serial_and_batch_bundle)
    
    batch_no = None
    if bundle_doc.entries and bundle_doc.entries[0].batch_no:
        batch_no = bundle_doc.entries[0].batch_no
    
    return {
        "success": True,
        "serial_and_batch_bundle": purchase_receipt_item.serial_and_batch_bundle,
        "batch_no": batch_no
    }
