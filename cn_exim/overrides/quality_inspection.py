import frappe
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

def before_save(doc, method):
    """
    Before save hook for Quality Inspection
    Auto-calculate expiry date if manufacturing date and expiry months are provided but expiry date is empty
    """
    try:
        # Check if both manufacturing date and expiry months are provided but expiry date is empty
        if (doc.custom_manufacturing_date and 
            doc.custom_expiry_in_months and 
            not doc.custom_expiry_date):
            
            try:
                manufacturing_date = datetime.strptime(str(doc.custom_manufacturing_date), '%Y-%m-%d')
                
                # Calculate expiry date using relativedelta for proper month handling
                expiry_date = manufacturing_date + relativedelta(months=doc.custom_expiry_in_months)
                
                # Format date to YYYY-MM-DD
                formatted_expiry_date = expiry_date.strftime('%Y-%m-%d')
                
                # Set the calculated expiry date
                doc.custom_expiry_date = formatted_expiry_date
                
                frappe.log_error(
                    f"Auto-calculated expiry date for Quality Inspection {doc.name}: {formatted_expiry_date} "
                    f"(Manufacturing: {doc.custom_manufacturing_date}, Months: {doc.custom_expiry_in_months})", 
                    "Quality Inspection Expiry Auto-Calculation"
                )
                
            except Exception as date_error:
                frappe.log_error(f"Error calculating expiry date: {str(date_error)}", "Quality Inspection Expiry Calculation Error")
                
    except Exception as e:
        frappe.log_error(f"Error in Quality Inspection before_save: {str(e)}", "Quality Inspection Before Save Error")

def after_insert(doc, method):
    """
    After insert hook for Quality Inspection
    If reference_type is Purchase Receipt, get warehouse and shelf from child table
    """
    try:
        # Check if reference_type is Purchase Receipt
        if doc.reference_type == "Purchase Receipt" and doc.reference_name:
            # Get the Purchase Receipt document
            purchase_receipt = frappe.get_doc("Purchase Receipt", doc.reference_name)
            
            # Check if child_row_reference is provided
            if doc.child_row_reference:
                # Find the specific item in Purchase Receipt items
                for item in purchase_receipt.items:
                    if item.name == doc.child_row_reference:
                        # Update custom_quality_warehouse
                        if item.warehouse:
                            doc.custom_quality_warehouse = item.warehouse
                        
                        # Update custom_quality_shelf
                        if hasattr(item, 'shelf') and item.shelf:
                            doc.custom_quality_shelf = item.shelf
                        
                        # Copy serial_and_batch_bundle from Purchase Receipt Item to Quality Inspection
                        if hasattr(item, 'serial_and_batch_bundle') and item.serial_and_batch_bundle:
                            doc.custom_serial_and_batch_bundle = item.serial_and_batch_bundle
                            
                            # Get batch number from Serial and Batch Bundle
                            try:
                                bundle_doc = frappe.get_doc("Serial and Batch Bundle", item.serial_and_batch_bundle)
                                if bundle_doc.entries:
                                    # Get the first entry's batch number
                                    first_entry = bundle_doc.entries[0]
                                    if first_entry.batch_no:
                                        doc.batch_no = first_entry.batch_no
                            except Exception as bundle_error:
                                frappe.log_error(f"Error getting batch number from bundle {item.serial_and_batch_bundle}: {str(bundle_error)}", "Quality Inspection Batch Number Error")
                        
                        # Save the document
                        doc.save()
                        break
            else:
                # If no child_row_reference, try to get from first item or main warehouse
                if purchase_receipt.items:
                    first_item = purchase_receipt.items[0]
                    if first_item.warehouse:
                        doc.custom_quality_warehouse = first_item.warehouse
                    
                    if hasattr(first_item, 'shelf') and first_item.shelf:
                        doc.custom_quality_shelf = first_item.shelf
                    
                    doc.save()
                elif purchase_receipt.set_warehouse:
                    # Fallback to main warehouse if no items
                    doc.custom_quality_warehouse = purchase_receipt.set_warehouse
                    doc.save()
                    
    except Exception as e:
        # Log error but don't throw exception to avoid breaking the insert process
        frappe.log_error(f"Error in Quality Inspection after_insert: {str(e)}", "Quality Inspection After Insert Error")

def on_submit(doc, method):
    """
    Validate Quality Inspection before submission and create Stock Entry for material movement
    """
    if doc.status == "Under Inspection":
        frappe.throw("Status must be 'Accepted' or 'Rejected' before submitting.")
    
    # Additional validation for Purchase Receipt reference type with Incoming inspection
    if doc.reference_type == "Purchase Receipt" and doc.inspection_type == "Incoming":
        if not doc.child_row_reference:
            frappe.throw("Child Row Reference is required for Purchase Receipt type Quality Inspection.")
        
        # Validate quantities
        total_qty = (doc.custom_accepted_quantity or 0) + (doc.custom_rejected_quantity or 0)
        if total_qty <= 0:
            frappe.throw("Total quantity (Accepted + Rejected) must be greater than 0.")
        
        # Create Stock Entry for material movement
        create_stock_entry_for_quality_inspection(doc)
        
        # Update batch expiry date if batch number and expiry date are available
        update_batch_expiry_date(doc)

def create_stock_entry_for_quality_inspection(doc):
    """
    Create Stock Entry for material movement after Quality Inspection
    """
    try:
        # Get Purchase Receipt Item details
        purchase_receipt_item = frappe.get_doc("Purchase Receipt Item", doc.child_row_reference)
        
        # Get Purchase Order Item to find target warehouse
        purchase_order_item = None
        if purchase_receipt_item.purchase_order_item:
            purchase_order_item = frappe.get_doc("Purchase Order Item", purchase_receipt_item.purchase_order_item)
        
        # Create Stock Entry
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
        
        # Get item details to check serial/batch fields (moved to beginning for both sections)
        item_details = frappe.db.get_value("Item", doc.item_code, ["has_serial_no", "has_batch_no"], as_dict=True)
        use_serial_batch_fields = (item_details.has_serial_no or item_details.has_batch_no) if item_details else False
        
        # Add accepted quantity item
        if doc.custom_accepted_quantity and doc.custom_accepted_quantity > 0:
            if purchase_order_item and purchase_order_item.warehouse:
                # Get target warehouse shelf
                target_shelf = frappe.db.get_value("Warehouse", purchase_order_item.warehouse, "custom_shelf")
                
                stock_entry.append("items", {
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
                })
        
        # Add rejected quantity item
        if doc.custom_rejected_quantity and doc.custom_rejected_quantity > 0:
            if purchase_order_item and purchase_order_item.warehouse:
                # Get rejected warehouse from Purchase Order Item warehouse
                rejected_warehouse = frappe.db.get_value("Warehouse", purchase_order_item.warehouse, "custom_rejected_warehouse")
                if rejected_warehouse:
                    # Get rejected warehouse shelf
                    rejected_shelf = frappe.db.get_value("Warehouse", rejected_warehouse, "custom_shelf")
                    
                    stock_entry.append("items", {
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
                    })
                else:
                    # Throw error with link to warehouse
                    warehouse_link = f'<a href="/app/warehouse/{purchase_order_item.warehouse}" target="_blank">{purchase_order_item.warehouse}</a>'
                    frappe.throw(f"Rejected Warehouse not set for warehouse {warehouse_link}. Please set the Rejected Warehouse in the warehouse master.")
            else:
                frappe.throw("Purchase Order Item warehouse not found. Cannot determine rejected warehouse.")
        
        # Save and submit Stock Entry if items exist
        if stock_entry.items:
            stock_entry.insert()
            stock_entry.submit()
            
            # Update Purchase Receipt Item with quantities and warehouses
            update_purchase_receipt_item(doc, purchase_order_item)
            
            frappe.msgprint(
                f"Stock Entry {stock_entry.name} has been created and submitted successfully.",
                title="Stock Entry Created",
                indicator='green'
            )
            
            # Store the Stock Entry name in Quality Inspection for later reference
            frappe.db.set_value("Quality Inspection", doc.name, "custom_stock_entry", stock_entry.name)
        else:
            frappe.throw("Please enter Accepted Quantity or Rejected Quantity before submitting Quality Inspection. No quantities found to transfer.")
            
    except Exception as e:
        frappe.log_error(f"Error creating Stock Entry for Quality Inspection {doc.name}: {str(e)}", "Quality Inspection Stock Entry Error")
        frappe.throw(f"Error creating Stock Entry: {str(e)}")

def update_batch_expiry_date(doc):
    """
    Update batch expiry date with Quality Inspection expiry date
    """
    try:
        # Check if batch number and expiry date are available
        if not doc.batch_no:
            frappe.log_error(f"No batch number found in Quality Inspection {doc.name}", "Quality Inspection Batch Update Error")
            return
            
        if not doc.custom_expiry_date:
            frappe.log_error(f"No expiry date found in Quality Inspection {doc.name}", "Quality Inspection Batch Update Error")
            return
        
        # Check if batch exists
        if not frappe.db.exists("Batch", doc.batch_no):
            frappe.log_error(f"Batch {doc.batch_no} not found", "Quality Inspection Batch Update Error")
            return
        
        # Update batch expiry date
        frappe.db.set_value("Batch", doc.batch_no, "expiry_date", doc.custom_expiry_date)
        
        frappe.msgprint(
            f"Batch {doc.batch_no} expiry date has been updated to {doc.custom_expiry_date}.",
            title="Batch Expiry Date Updated",
            indicator='green'
        )
        
        # Log the update
        frappe.log_error(
            f"Batch {doc.batch_no} expiry date updated to {doc.custom_expiry_date} from Quality Inspection {doc.name}",
            "Quality Inspection Batch Expiry Update"
        )
        
    except Exception as e:
        frappe.log_error(f"Error updating batch expiry date for batch {doc.batch_no}: {str(e)}", "Quality Inspection Batch Update Error")
        frappe.throw(f"Error updating batch expiry date: {str(e)}")

def update_purchase_receipt_item(doc, purchase_order_item):
    """
    Update Purchase Receipt Item with quantities and warehouses after Stock Entry submission
    """
    try:
        # Update quantities using frappe.db.set_value
        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "qty", doc.custom_accepted_quantity or 0)
        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_qty", doc.custom_rejected_quantity or 0)
        
        # Update warehouses and shelves for accepted quantity
        if doc.custom_accepted_quantity and doc.custom_accepted_quantity > 0:
            if purchase_order_item and purchase_order_item.warehouse:
                frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "warehouse", purchase_order_item.warehouse)
                # Get shelf from warehouse master
                target_shelf = frappe.db.get_value("Warehouse", purchase_order_item.warehouse, "custom_shelf")
                if target_shelf:
                    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "shelf", target_shelf)
        
        # Update warehouses and shelves for rejected quantity
        if doc.custom_rejected_quantity and doc.custom_rejected_quantity > 0:
            if purchase_order_item and purchase_order_item.warehouse:
                # Get rejected warehouse from Purchase Order Item warehouse
                rejected_warehouse = frappe.db.get_value("Warehouse", purchase_order_item.warehouse, "custom_rejected_warehouse")
                if rejected_warehouse:
                    frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_warehouse", rejected_warehouse)
                    # Get rejected shelf from warehouse master
                    rejected_shelf = frappe.db.get_value("Warehouse", rejected_warehouse, "custom_shelf")
                    if rejected_shelf:
                        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_shelf", rejected_shelf)
        
    except Exception as e:
        frappe.log_error(f"Error updating Purchase Receipt Item {doc.child_row_reference}: {str(e)}", "Purchase Receipt Item Update Error")
        frappe.throw(f"Error updating Purchase Receipt Item: {str(e)}")

def on_cancel(doc, method):
    """
    Handle cancellation of Quality Inspection - revert Purchase Receipt Item changes
    """
    try:
        if doc.reference_type == "Purchase Receipt" and doc.inspection_type == "Incoming":
            # Revert Purchase Receipt Item changes
            revert_purchase_receipt_item_changes(doc)
            
    except Exception as e:
        frappe.log_error(f"Error in Quality Inspection on_cancel: {str(e)}", "Quality Inspection Cancel Error")
        frappe.throw(f"Error cancelling Quality Inspection: {str(e)}")

def revert_purchase_receipt_item_changes(doc):
    """
    Revert Purchase Receipt Item changes back to original state
    """
    try:
        if not doc.child_row_reference:
            return
            
        # Get original Purchase Receipt Item data
        purchase_receipt_item = frappe.get_doc("Purchase Receipt Item", doc.child_row_reference)
        
        # Revert quantities back to original received quantity
        original_qty = purchase_receipt_item.qty + (doc.custom_accepted_quantity or 0) + (doc.custom_rejected_quantity or 0)
        
        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "qty", original_qty)
        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_qty", 0)
        
        # Revert warehouses back to original quality warehouse
        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "warehouse", doc.custom_quality_warehouse)
        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "shelf", doc.custom_quality_shelf)
        
        # Clear rejected warehouse fields
        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_warehouse", "")
        frappe.db.set_value("Purchase Receipt Item", doc.child_row_reference, "rejected_shelf", "")
        
        frappe.msgprint(
            f"Purchase Receipt Item {doc.child_row_reference} has been reverted to original state.",
            title="Purchase Receipt Item Reverted",
            indicator='orange'
        )
        
    except Exception as e:
        frappe.log_error(f"Error reverting Purchase Receipt Item {doc.child_row_reference}: {str(e)}", "Purchase Receipt Item Revert Error")
        frappe.throw(f"Error reverting Purchase Receipt Item: {str(e)}")

@frappe.whitelist()
def fetch_serial_batch_bundle_data(child_row_reference, reference_name):
    """
    Fetch Serial and Batch Bundle data from Purchase Receipt Item
    """
    try:
        # Get the Purchase Receipt Item
        purchase_receipt_item = frappe.get_doc("Purchase Receipt Item", child_row_reference)
        
        if not purchase_receipt_item:
            return {"success": False, "message": "Purchase Receipt Item not found"}
        
        # Check if serial_and_batch_bundle exists
        if not purchase_receipt_item.serial_and_batch_bundle:
            return {"success": False, "message": "No Serial and Batch Bundle found for this item"}
        
        # Get the Serial and Batch Bundle document
        bundle_doc = frappe.get_doc("Serial and Batch Bundle", purchase_receipt_item.serial_and_batch_bundle)
        
        batch_no = None
        if bundle_doc.entries:
            # Get the first entry's batch number
            first_entry = bundle_doc.entries[0]
            if first_entry.batch_no:
                batch_no = first_entry.batch_no
        
        return {
            "success": True,
            "serial_and_batch_bundle": purchase_receipt_item.serial_and_batch_bundle,
            "batch_no": batch_no
        }
        
    except Exception as e:
        frappe.log_error(f"Error fetching Serial and Batch Bundle data: {str(e)}", "Quality Inspection Fetch Bundle Error")
        return {"success": False, "message": f"Error: {str(e)}"}
