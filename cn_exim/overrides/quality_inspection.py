import frappe
from datetime import datetime
from dateutil.relativedelta import relativedelta

def before_save(doc, method):
    # Auto-calculate expiry date and validate quantities
    calculate_expiry_date(doc)
    validate_rejected_quantity(doc)
    
    # Auto-set initial quantities from reference if not set
    if (doc.reference_type and doc.reference_name and doc.item_code and 
        (not doc.custom_accepted_quantity or doc.custom_accepted_quantity == 0)):
        set_initial_quantity_from_reference_python(doc)

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

def set_initial_quantity_from_reference_python(doc):
    """
    Set initial accepted quantity in Quality Inspection based on reference type (Python version)
    """
    try:
        if doc.reference_type == "Purchase Receipt":
            # Get quantity from Purchase Receipt Item
            data = frappe.db.sql("""
                SELECT qty 
                FROM `tabPurchase Receipt Item` 
                WHERE parent = %s AND item_code = %s
            """, (doc.reference_name, doc.item_code), as_dict=True)
            
            if data:
                doc.custom_accepted_quantity = data[0].qty
                doc.sample_size = data[0].qty  # Also set sample size
        
        elif doc.reference_type == "Work Order":
            # Get quantity from Work Order
            data = frappe.db.sql("""
                SELECT qty 
                FROM `tabWork Order` 
                WHERE name = %s AND production_item = %s
            """, (doc.reference_name, doc.item_code), as_dict=True)
            
            if data:
                doc.custom_accepted_quantity = data[0].qty
                doc.sample_size = data[0].qty  # Also set sample size
        
        elif doc.reference_type == "Stock Entry":
            # Get quantity from Stock Entry Detail
            if doc.child_row_reference:
                data = frappe.db.sql("""
                    SELECT qty 
                    FROM `tabStock Entry Detail` 
                    WHERE name = %s AND item_code = %s
                """, (doc.child_row_reference, doc.item_code), as_dict=True)
                
                if data:
                    doc.custom_accepted_quantity = data[0].qty
                    doc.sample_size = data[0].qty  # Also set sample size
        
        elif doc.reference_type == "Gate Entry":
            # Get quantity from Gate Entry Details
            if doc.child_row_reference:
                data = frappe.db.sql("""
                    SELECT qty 
                    FROM `tabGate Entry Details` 
                    WHERE name = %s AND item = %s
                """, (doc.child_row_reference, doc.item_code), as_dict=True)
                
                if data:
                    doc.custom_accepted_quantity = data[0].qty
                    doc.sample_size = data[0].qty  # Also set sample size
                    
    except Exception as e:
        frappe.log_error(f"Error setting initial quantity from reference: {str(e)}")
        # Don't throw error, just log it

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
    if doc.status == "Under Inspection":
        frappe.throw("Quality Inspection is still under inspection.")
    if doc.reference_type == "Purchase Receipt":
        # Existing Purchase Receipt logic
        if doc.custom_accepted_quantity > 0:
            frappe.msgprint(f"Accepted Quantity: {doc.custom_accepted_quantity}")
        if doc.custom_rejected_quantity > 0:
            frappe.msgprint(f"Rejected Quantity: {doc.custom_rejected_quantity}")
        create_stock_entry_for_quality_inspection(doc)
        update_batch_expiry_date(doc)
    
    elif doc.reference_type == "Work Order":
        # Validate quantities
        if doc.custom_accepted_quantity + doc.custom_rejected_quantity != doc.sample_size:
            frappe.throw("Accepted Quantity + Rejected Quantity must equal Sample Size")
        
        # Update Work Order with quality results
        update_work_order_with_quality_results(doc)
    
    elif doc.reference_type == "Stock Entry":
        
        # Move quantities to target and rejected warehouses
        if (doc.custom_accepted_quantity > 0 or doc.custom_rejected_quantity > 0) and doc.custom_work_order:
            move_quantities_to_target_and_rejected_locations(doc)
        
        # Update Work Order if linked
        if doc.custom_work_order:
            update_work_order_with_quality_results(doc)
            update_batch_expiry_date(doc)

def create_stock_entry_for_quality_inspection(doc):
    if doc.status == "Under Inspection":
        frappe.throw("Quality Inspection is still under inspection.")
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
    elif doc.reference_type == "Stock Entry" and doc.custom_work_order:
        revert_stock_entry_and_work_order_changes(doc)

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

def revert_stock_entry_and_work_order_changes(doc):
    """
    Revert changes made by Quality Inspection for Stock Entry and Work Order
    """
    try:
        # 1. Cancel the Stock Entry created during submit
        if doc.custom_stock_entry:
            stock_entry_name = doc.custom_stock_entry
            if frappe.db.exists("Stock Entry", stock_entry_name):
                stock_entry_doc = frappe.get_doc("Stock Entry", stock_entry_name)
                if stock_entry_doc.docstatus == 1:  # Only cancel if submitted
                    stock_entry_doc.cancel()
                    frappe.msgprint(
                        f"Stock Entry {stock_entry_name} has been cancelled.",
                        title="Stock Entry Cancelled",
                        indicator='orange'
                    )
        
        # 2. Revert Work Order quantities
        if doc.custom_work_order:
            work_order_name = doc.custom_work_order
            
            # Get current values from Work Order
            current_accepted = frappe.db.get_value("Work Order", work_order_name, "custom_quality_accepted_qty") or 0
            current_rejected = frappe.db.get_value("Work Order", work_order_name, "custom_quality_rejected_qty") or 0
            
            # Subtract the quantities from this Quality Inspection
            new_accepted = current_accepted - (doc.custom_accepted_quantity or 0)
            new_rejected = current_rejected - (doc.custom_rejected_quantity or 0)
            
            # Ensure values don't go negative
            new_accepted = max(0, new_accepted)
            new_rejected = max(0, new_rejected)
            
            # Update Work Order
            frappe.db.set_value("Work Order", work_order_name, "custom_quality_accepted_qty", new_accepted)
            frappe.db.set_value("Work Order", work_order_name, "custom_quality_rejected_qty", new_rejected)
            
            frappe.msgprint(
                f"Work Order {work_order_name} quantities have been reverted.",
                title="Work Order Reverted",
                indicator='orange'
            )
        
        # 3. Clear the stock entry reference from Quality Inspection
        # frappe.db.set_value("Quality Inspection", doc.name, "custom_stock_entry", "")
        
    except Exception as e:
        frappe.log_error(f"Error reverting Stock Entry and Work Order changes: {str(e)}")
        frappe.throw(f"Error reverting changes: {str(e)}")

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

def move_quantities_to_target_and_rejected_locations(doc):
    """
    Move accepted and rejected quantities to their respective warehouses in one Stock Entry
    """
    try:
        # Get Stock Entry Detail to find source warehouse and shelf
        stock_entry_detail = frappe.get_doc("Stock Entry Detail", doc.child_row_reference)
        
        if not stock_entry_detail:
            frappe.throw(f"Stock Entry Detail {doc.child_row_reference} not found")
        
        # Source: Stock Entry's target warehouse (where finished goods went)
        source_warehouse = stock_entry_detail.t_warehouse
        source_shelf = stock_entry_detail.to_shelf
        
        # Get Work Order details
        work_order_name = doc.custom_work_order
        if not work_order_name:
            frappe.throw("Work Order not found in Quality Inspection")
        
        stock_movement = frappe.db.get_value("Work Order", work_order_name, "custom_quality_stock_movement")
        
        target_warehouse, to_shelf, rejected_warehouse, rejected_shelf = get_warehouse_and_shelf(doc,stock_movement,work_order_name)

        if not target_warehouse and doc.custom_accepted_quantity > 0:
            frappe.throw("Target warehouse not found in Work Order")
        
        if not rejected_warehouse and doc.custom_rejected_quantity > 0:
            frappe.throw("Rejected warehouse not found in Work Order")
        
        # Create single Stock Entry for both movements
        stock_entry = frappe.new_doc("Stock Entry")
        stock_entry.stock_entry_type = "Material Transfer"
        stock_entry.purpose = "Material Transfer"
        stock_entry.company = doc.company
        stock_entry.posting_date = frappe.utils.today()
        stock_entry.posting_time = frappe.utils.nowtime()
        stock_entry.set_posting_time = 0
        stock_entry.from_warehouse = source_warehouse
        stock_entry.custom_work_order = work_order_name
        # Add accepted quantity to target warehouse
        if doc.custom_accepted_quantity > 0 :
            stock_entry.append("items", {
                "item_code": doc.item_code,
                "item_name": doc.item_name,
                "description": doc.description,
                "qty": doc.custom_accepted_quantity,
                "uom": stock_entry_detail.uom,
                "stock_uom": stock_entry_detail.stock_uom,
                "conversion_factor": stock_entry_detail.conversion_factor,
                "basic_rate": stock_entry_detail.basic_rate,
                "s_warehouse": source_warehouse,
                "t_warehouse": target_warehouse,
                "shelf": source_shelf,
                "to_shelf": to_shelf,
                "batch_no": doc.batch_no,
            })
        
        # Add rejected quantity to rejected warehouse
        if doc.custom_rejected_quantity > 0:
            stock_entry.append("items", {
                "item_code": doc.item_code,
                "item_name": doc.item_name,
                "description": doc.description,
                "qty": doc.custom_rejected_quantity,
                "uom": stock_entry_detail.uom,
                "stock_uom": stock_entry_detail.stock_uom,
                "conversion_factor": stock_entry_detail.conversion_factor,
                "basic_rate": stock_entry_detail.basic_rate,
                "s_warehouse": source_warehouse,
                "t_warehouse": rejected_warehouse,
                "shelf": source_shelf,
                "to_shelf": rejected_shelf,
                "batch_no": doc.batch_no,
            })
        
        # Submit the Stock Entry if items were added
        if stock_entry.items:
            stock_entry.insert()
            stock_entry.submit()
            
            # Store stock entry reference in quality inspection
            frappe.db.set_value("Quality Inspection", doc.name, "custom_stock_entry", stock_entry.name)
            
            message = "Successfully moved quantities:"
            if doc.custom_accepted_quantity > 0 and target_warehouse != source_warehouse:
                message += f"\n• {doc.custom_accepted_quantity} accepted to {target_warehouse}"
            if doc.custom_rejected_quantity > 0 and rejected_warehouse != source_warehouse:
                message += f"\n• {doc.custom_rejected_quantity} rejected to {rejected_warehouse}"
            
            frappe.msgprint(message)
        else:
            frappe.msgprint("No quantities to move - stock already in target locations")
        
    except Exception as e:
        frappe.log_error(f"Error moving quantities to target and rejected locations: {str(e)}")
        frappe.throw(f"Error moving quantities: {str(e)}")

def update_work_order_with_quality_results(doc):
    """
    Update Work Order with quality inspection results
    """
    try:
        work_order_name = doc.custom_work_order
        if not work_order_name:
            return
        
        # Get current values from Work Order
        current_accepted = frappe.db.get_value("Work Order", work_order_name, "custom_quality_accepted_qty") or 0
        current_rejected = frappe.db.get_value("Work Order", work_order_name, "custom_quality_rejected_qty") or 0
        
        # Calculate new values
        new_accepted = current_accepted + (doc.custom_accepted_quantity or 0)
        new_rejected = current_rejected + (doc.custom_rejected_quantity or 0)
        
        # Update using frappe.db.set_value
        frappe.db.set_value("Work Order", work_order_name, "custom_quality_accepted_qty", new_accepted)
        frappe.db.set_value("Work Order", work_order_name, "custom_quality_rejected_qty", new_rejected)
        
        frappe.msgprint(f"Updated Work Order {work_order_name} with quality results")
        
    except Exception as e:
        frappe.log_error(f"Error updating Work Order with quality results: {str(e)}")
        frappe.throw(f"Error updating Work Order: {str(e)}")

def get_warehouse_and_shelf(doc,stock_movement,work_order_name):
    if stock_movement == "Item Material Type":
        item_material_type = frappe.db.get_value("Item", doc.item_code, "custom_material_type")
        material_type_doc = frappe.get_doc("Material Types", item_material_type)
        target_warehouse = material_type_doc.warehouse
        to_shelf = material_type_doc.shelf
        rejected_warehouse = frappe.db.get_value("Warehouse",target_warehouse, "custom_rejected_warehouse")
        rejected_shelf = frappe.db.get_value("Warehouse", rejected_warehouse, "custom_shelf")
        #frappe.throw(f"Target warehouse: {target_warehouse}, To shelf: {to_shelf}, Rejected warehouse: {rejected_warehouse}, Rejected shelf: {rejected_shelf}")
    elif stock_movement == "Custom":
        target_warehouse = frappe.db.get_value("Work Order", work_order_name, "custom_target_warehouse")
        to_shelf = frappe.db.get_value("Work Order", work_order_name, "custom_target_shelf")
        rejected_warehouse = frappe.db.get_value("Warehouse", target_warehouse, "custom_rejected_warehouse")
        rejected_shelf = frappe.db.get_value("Warehouse", rejected_warehouse, "custom_shelf")
    else:
        target_warehouse = frappe.db.get_value("Work Order", work_order_name, "custom_target_warehouse")
        to_shelf = frappe.db.get_value("Warehouse", target_warehouse, "custom_shelf")
        rejected_warehouse = frappe.db.get_value("Warehouse", target_warehouse, "custom_rejected_warehouse")
        rejected_shelf = frappe.db.get_value("Warehouse", rejected_warehouse, "custom_shelf")
    return target_warehouse, to_shelf, rejected_warehouse, rejected_shelf