import frappe

def validate(doc, method):
    """
    Validate Material Request - sync qty and stock_qty if Stock Settings allows
    """
    sync_qty_and_stock_qty_if_enabled(doc)

def sync_qty_and_stock_qty_if_enabled(doc):
    """
    Sync qty and stock_qty in Material Request Item if checkbox is enabled in Stock Settings
    """
    try:
        # Check if Stock Settings allows qty updation
        stock_settings = frappe.get_single("Stock Settings")
        allow_qty_updation = stock_settings.get("allow_stock_qty_updation", 0)

        if allow_qty_updation:
            # Sync qty and stock_qty for all items
            for item in doc.items:
                if item.qty != item.stock_qty:
                    # Keep qty and stock_qty same
                    item.stock_qty = item.qty

    except Exception as e:
        frappe.log_error(f"Error in Material Request qty sync: {str(e)}", "Material Request Qty Sync")