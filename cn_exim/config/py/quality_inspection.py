import frappe

@frappe.whitelist()
def check_existing_quality_inspections(stock_entries):
    """
    Check existing Quality Inspections for given Stock Entries
    """
    try:
        if not stock_entries:
            return {"existing_qis": []}
        
        # Build the query properly for SQL IN clause
        if len(stock_entries) == 1:
            existing_qis = frappe.db.sql("""
                SELECT name, reference_name, docstatus
                FROM `tabQuality Inspection`
                WHERE reference_type = 'Stock Entry' 
                AND reference_name = %s
                AND docstatus != 2
            """, (stock_entries[0],), as_dict=True)
        else:
            placeholders = ', '.join(['%s'] * len(stock_entries))
            existing_qis = frappe.db.sql(f"""
                SELECT name, reference_name, docstatus
                FROM `tabQuality Inspection`
                WHERE reference_type = 'Stock Entry' 
                AND reference_name IN ({placeholders})
                AND docstatus != 2
            """, tuple(stock_entries), as_dict=True)
        
        return {"existing_qis": existing_qis}
        
    except Exception as e:
        frappe.log_error(f"Error checking existing Quality Inspections: {str(e)}")
        return {"existing_qis": []}

@frappe.whitelist()
def create_quality_inspection_from_stock_entry(stock_entry_name, work_order_name, work_order_qty):
    """
    Create Quality Inspection from Stock Entry
    """
    try:
        # Check if Quality Inspection already exists for this Stock Entry
        existing_qi = frappe.db.exists("Quality Inspection", {
            "reference_type": "Stock Entry",
            "reference_name": stock_entry_name,
            "docstatus": ["!=", 2]  # Not cancelled
        })
        
        if existing_qi:
            return {"success": False, "error": f"Quality Inspection already exists for Stock Entry {stock_entry_name}"}
        
        # Get Stock Entry details
        stock_entry_doc = frappe.get_doc("Stock Entry", stock_entry_name)
        
        # Find the finished good item (is_finished_item = 1)
        finished_item = None
        batch_no = None
        serial_and_batch_bundle = None
        for item in stock_entry_doc.items:
            if item.is_finished_item:
                finished_item = item.item_code
                batch_no = item.batch_no
                serial_and_batch_bundle = item.serial_and_batch_bundle
                break
        
        if not finished_item:
            frappe.throw("No finished good item found in Stock Entry")
        
        # Create Quality Inspection
        qi = frappe.new_doc("Quality Inspection")
        qi.reference_type = "Stock Entry"
        qi.reference_name = stock_entry_name
        qi.item_code = finished_item
        qi.company = stock_entry_doc.company
        qi.inspection_type = "In Process"
        qi.custom_work_order_qty = stock_entry_doc.fg_completed_qty
        qi.custom_accepted_quantity = stock_entry_doc.fg_completed_qty
        qi.custom_work_order = work_order_name
        qi.report_date = frappe.utils.today()
        qi.status = "Under Inspection"
        qi.naming_series = "MAT-QA-.YYYY.-"
        qi.inspected_by = frappe.session.user
        qi.sample_size = stock_entry_doc.fg_completed_qty  # Set sample size to finished good quantity
        
        # Set batch number with priority: serial_and_batch_bundle > batch_no
        if serial_and_batch_bundle:
            qi.custom_serial_and_batch_bundle = serial_and_batch_bundle
            # Try to extract batch number from bundle
            try:
                bundle_doc = frappe.get_doc("Serial and Batch Bundle", serial_and_batch_bundle)
                if bundle_doc.entries and bundle_doc.entries[0].batch_no:
                    qi.batch_no = bundle_doc.entries[0].batch_no
            except:
                pass
        elif batch_no:
            qi.batch_no = batch_no
        
        qi.insert()
        
        return {"success": True, "name": qi.name}
        
    except Exception as e:
        frappe.log_error(f"Error creating Quality Inspection from Stock Entry: {str(e)}")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def get_stock_entry_item_qty(child_row_reference, item_code):
    """
    Get the quantity from Stock Entry Detail for a specific child row reference
    """
    try:
        # Get the quantity from Stock Entry Detail
        data = frappe.db.sql("""
            SELECT qty 
            FROM `tabStock Entry Detail` 
            WHERE name = %s AND item_code = %s
        """, (child_row_reference, item_code), as_dict=True)
        
        if data:
            return {
                "qty": data[0].qty,
                "success": True
            }
        else:
            return {
                "qty": 0,
                "success": False,
                "message": "No Stock Entry Detail found for this reference"
            }
            
    except Exception as e:
        frappe.log_error(f"Error getting Stock Entry item quantity: {str(e)}")
        return {
            "qty": 0,
            "success": False,
            "message": f"Error: {str(e)}"
        }

@frappe.whitelist()
def get_stock_entries_for_work_order(work_order):
    """
    Get Stock Entries for a Work Order
    """
    try:
        stock_entries = frappe.db.sql("""
            SELECT name, posting_date, fg_completed_qty, stock_entry_type
            FROM `tabStock Entry`
            WHERE work_order = %s AND docstatus = 1 AND stock_entry_type = 'Manufacture'
            ORDER BY posting_date DESC
        """, (work_order), as_dict=True)
        
        return stock_entries
        
    except Exception as e:
        frappe.log_error(f"Error getting Stock Entries for Work Order: {str(e)}")
        return []

@frappe.whitelist()
def get_stock_entry_details(stock_entry):
    """
    Get Stock Entry details for Quality Inspection creation
    """
    try:
        stock_entry_doc = frappe.get_doc("Stock Entry", stock_entry)
        
        # Find the finished good item (is_finished_item = 1)
        finished_item = None
        batch_no = None
        serial_and_batch_bundle = None
        for item in stock_entry_doc.items:
            if item.is_finished_item:
                finished_item = item.item_code
                batch_no = item.batch_no
                serial_and_batch_bundle = item.serial_and_batch_bundle
                break
        
        if not finished_item:
            frappe.throw("No finished good item found in Stock Entry")
        
        # Extract batch number from bundle if available
        extracted_batch_no = batch_no
        if serial_and_batch_bundle:
            try:
                bundle_doc = frappe.get_doc("Serial and Batch Bundle", serial_and_batch_bundle)
                if bundle_doc.entries and bundle_doc.entries[0].batch_no:
                    extracted_batch_no = bundle_doc.entries[0].batch_no
            except:
                pass
        
        return {
            "name": stock_entry_doc.name,
            "company": stock_entry_doc.company,
            "finished_item": finished_item,
            "fg_completed_qty": stock_entry_doc.fg_completed_qty,
            "posting_date": stock_entry_doc.posting_date,
            "batch_no": extracted_batch_no,
            "serial_and_batch_bundle": serial_and_batch_bundle
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting Stock Entry details: {str(e)}")
        frappe.throw(f"Error getting Stock Entry details: {str(e)}")

@frappe.whitelist()
def set_initial_quantity_from_reference(name):
    """
    Set initial accepted quantity in Quality Inspection based on reference type
    This function automatically detects the reference type and calls the appropriate function
    """
    try:
        if not name:
            return {"success": False, "message": "Missing name parameter"}
        
        # Get the Quality Inspection document
        qi_doc = frappe.get_doc("Quality Inspection", name)
        
        if not qi_doc.reference_type or not qi_doc.reference_name or not qi_doc.item_code:
            return {"success": False, "message": "Missing reference information"}
        
        # Call appropriate function based on reference type
        if qi_doc.reference_type == "Purchase Receipt":
            return set_value_in_qc_base_on_pr(
                parent=qi_doc.reference_name,
                item_code=qi_doc.item_code,
                name=name
            )
        elif qi_doc.reference_type == "Work Order":
            return set_value_in_qc_base_on_work_order(
                work_order=qi_doc.reference_name,
                item_code=qi_doc.item_code,
                name=name
            )
        else:
            return {"success": False, "message": f"Unsupported reference type: {qi_doc.reference_type}"}
            
    except Exception as e:
        frappe.log_error(f"Error in set_initial_quantity_from_reference: {str(e)}")
        return {"success": False, "message": f"Error: {str(e)}"}

@frappe.whitelist()
def set_value_in_qc_base_on_pr(parent=None, item_code=None, name=None):
    """
    Set initial accepted quantity in Quality Inspection based on Purchase Receipt
    """
    try:
        # If parameters are missing, try to get them from the Quality Inspection document
        if not name:
            frappe.log_error("Missing name parameter in set_value_in_qc_base_on_pr")
            return {"success": False, "message": "Missing name parameter"}
        
        # Get the Quality Inspection document
        qi_doc = frappe.get_doc("Quality Inspection", name)
        
        # Use document values if parameters are not provided
        if not parent:
            parent = qi_doc.reference_name
        if not item_code:
            item_code = qi_doc.item_code
        
        # Validate that we have the required data
        if not parent or not item_code:
            frappe.log_error(f"Missing required data: parent={parent}, item_code={item_code}, name={name}")
            return {"success": False, "message": "Missing required data"}
        
        # Only proceed if this is a Purchase Receipt reference type
        if qi_doc.reference_type != "Purchase Receipt":
            return {"success": False, "message": "This function is only for Purchase Receipt reference type"}
        
        data = frappe.db.sql("""
            SELECT qty 
            FROM `tabPurchase Receipt Item` 
            WHERE parent = %s AND item_code = %s
        """, (parent, item_code), as_dict=True)
        
        if data:
            frappe.db.set_value("Quality Inspection", name, "custom_accepted_quantity", data[0].qty)
            return {"success": True, "qty": data[0].qty}
        else:
            return {"success": False, "message": "No Purchase Receipt Item found"}
            
    except Exception as e:
        frappe.log_error(f"Error setting Purchase Receipt quantity in Quality Inspection: {str(e)}")
        return {"success": False, "message": f"Error: {str(e)}"}

@frappe.whitelist()
def set_value_in_qc_base_on_work_order(work_order=None, item_code=None, name=None):
    """
    Set initial accepted quantity in Quality Inspection based on Work Order
    """
    try:
        # If parameters are missing, try to get them from the Quality Inspection document
        if not name:
            frappe.log_error("Missing name parameter in set_value_in_qc_base_on_work_order")
            return {"success": False, "message": "Missing name parameter"}
        
        # Get the Quality Inspection document
        qi_doc = frappe.get_doc("Quality Inspection", name)
        
        # Use document values if parameters are not provided
        if not work_order:
            work_order = qi_doc.reference_name
        if not item_code:
            item_code = qi_doc.item_code
        
        # Validate that we have the required data
        if not work_order or not item_code:
            frappe.log_error(f"Missing required data: work_order={work_order}, item_code={item_code}, name={name}")
            return {"success": False, "message": "Missing required data"}
        
        # Only proceed if this is a Work Order reference type
        if qi_doc.reference_type != "Work Order":
            return {"success": False, "message": "This function is only for Work Order reference type"}
        
        data = frappe.db.sql("""
            SELECT qty 
            FROM `tabWork Order` 
            WHERE name = %s AND production_item = %s
        """, (work_order, item_code), as_dict=True)
        
        if data:
            frappe.db.set_value("Quality Inspection", name, "custom_accepted_quantity", data[0].qty)
            return {"success": True, "qty": data[0].qty}
        else:
            return {"success": False, "message": "Work Order or item not found"}
            
    except Exception as e:
        frappe.log_error(f"Error setting Work Order quantity in Quality Inspection: {str(e)}")
        return {"success": False, "message": f"Error: {str(e)}"}

@frappe.whitelist()
def get_qty_from_purchase_receipt(parent, item_code):
    
    data = frappe.db.sql(" select qty from `tabPurchase Receipt Item` where parent = %s and item_code = %s ", (parent, item_code), as_dict=True)
    
    return data

@frappe.whitelist()
def get_work_order_qty(work_order, item_code):
    """
    Get the quantity from Work Order for a specific item
    """
    try:
        # Get the quantity from Work Order using production_item field
        data = frappe.db.sql("""
            SELECT qty 
            FROM `tabWork Order` 
            WHERE name = %s AND production_item = %s
        """, (work_order, item_code), as_dict=True)
        
        if data:
            return {
                "qty": data[0].qty,
                "success": True
            }
        else:
            return {
                "qty": 0,
                "success": False,
                "message": "No Work Order found for this item"
            }
            
    except Exception as e:
        frappe.log_error(f"Error getting Work Order quantity: {str(e)}")
        return {
            "qty": 0,
            "success": False,
            "message": f"Error: {str(e)}"
        }

@frappe.whitelist()
def update_purchase_receipt(parent, item_code, accepted_qty, rejected_qty):
    
    data = frappe.db.sql(" select name from `tabPurchase Receipt Item` where parent = %s and item_code = %s ", (parent, item_code), as_dict=True)
    
    if data:
        frappe.db.set_value("Purchase Receipt Item", data[0].name, "qty", accepted_qty)
        frappe.db.set_value("Purchase Receipt Item", data[0].name, "rejected_qty", rejected_qty)
    
    return True

@frappe.whitelist()
def update_work_order(work_order, item_code, accepted_qty, rejected_qty):
    """
    Update Work Order with quality inspection results
    """
    try:
        wo = frappe.get_doc("Work Order", work_order)
        accepted = (accepted_qty or 0)
        rejected = (rejected_qty or 0)
        
        changed = False
        # Add to existing values
        current_accepted = getattr(wo, "custom_quality_accepted_qty", 0) or 0
        current_rejected = getattr(wo, "custom_quality_rejected_qty", 0) or 0
        
        new_accepted = current_accepted + accepted
        new_rejected = current_rejected + rejected
        
        if getattr(wo, "custom_quality_accepted_qty", None) != new_accepted:
            wo.custom_quality_accepted_qty = new_accepted
            changed = True
        if getattr(wo, "custom_quality_rejected_qty", None) != new_rejected:
            wo.custom_quality_rejected_qty = new_rejected
            changed = True
        
        if changed:
            wo.save(ignore_permissions=True)
        
        return {"success": True, "message": "Work Order updated successfully"}
        
    except Exception as e:
        frappe.log_error(f"Error updating Work Order: {str(e)}")
        return {"success": False, "message": f"Error: {str(e)}"}

@frappe.whitelist()
def get_gate_entry_received_qty(gate_entry_child, item_code):
    """
    Get the received quantity from Gate Entry Details for a specific item
    """
    try:
        # Get the received quantity from Gate Entry Details
        data = frappe.db.sql("""
            SELECT qty as received_qty 
            FROM `tabGate Entry Details` 
            WHERE name = %s AND item = %s
        """, (gate_entry_child, item_code), as_dict=True)
        
        if data:
            return {
                "received_qty": data[0].received_qty,
                "success": True
            }
        else:
            return {
                "received_qty": 0,
                "success": False,
                "message": "No Gate Entry Details found for this item"
            }
            
    except Exception as e:
        frappe.log_error(f"Error getting Gate Entry received quantity: {str(e)}")
        return {
            "received_qty": 0,
            "success": False,
            "message": f"Error: {str(e)}"
        }

@frappe.whitelist()
def get_purchase_receipt_item_qty(child_row_reference, item_code):
    """
    Get the quantity from Purchase Receipt Item for a specific child row reference
    """
    try:
        # Get the quantity from Purchase Receipt Item
        data = frappe.db.sql("""
            SELECT qty 
            FROM `tabPurchase Receipt Item` 
            WHERE name = %s AND item_code = %s
        """, (child_row_reference, item_code), as_dict=True)
        
        if data:
            return {
                "qty": data[0].qty,
                "success": True
            }
        else:
            return {
                "qty": 0,
                "success": False,
                "message": "No Purchase Receipt Item found for this reference"
            }
            
    except Exception as e:
        frappe.log_error(f"Error getting Purchase Receipt item quantity: {str(e)}")
        return {
            "qty": 0,
            "success": False,
            "message": f"Error: {str(e)}"
        }

